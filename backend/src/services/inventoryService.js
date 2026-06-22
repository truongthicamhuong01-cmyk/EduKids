const ApiError = require("../utils/apiError");
const { PET_ERROR_CODES } = require("../constants/petConstants");
const {
  getInventoryState,
  getInventoryTransaction,
  normalizeCategoryKey,
  saveInventoryState,
  saveInventoryTransaction,
} = require("../repositories/inventoryRepository");
const { getUserById, updateUserById } = require("../repositories/userRepository");
const { readConfigDoc } = require("../repositories/gameConfigRepository");
const { getPetState, savePetState, runTransaction } = require("../repositories/petRepository");
const { applyItemEffectsToPet } = require("./petItemEffectService");
const { stripDerivedPetFields } = require("./petDecayService");
const { clampStats, toNumber } = require("./petMathService");

function normalizeText(value) {
  return String(value || "").trim();
}

function ensureStudent(user) {
  if (!user) {
    throw new ApiError(401, "Thiếu xác thực", PET_ERROR_CODES.UNAUTHORIZED);
  }

  if (String(user.role || "").toLowerCase() !== "student") {
    throw new ApiError(403, "Chỉ học sinh mới được sử dụng Inventory", PET_ERROR_CODES.FORBIDDEN);
  }
}

function flattenInventoryState(state = {}) {
  const categories = state.categories && typeof state.categories === "object" ? state.categories : {};

  return Object.fromEntries(
    Object.entries(categories).map(([categoryKey, items]) => [
      categoryKey,
      Object.values(items || {}).sort((left, right) => String(left.itemId).localeCompare(String(right.itemId))),
    ]),
  );
}

function buildInventorySummary(state = {}) {
  const categories = state.categories && typeof state.categories === "object" ? state.categories : {};
  let totalItemTypes = 0;
  let totalQuantity = 0;

  Object.values(categories).forEach((items) => {
    Object.values(items || {}).forEach((item) => {
      if (Number(item.quantity) > 0) {
        totalItemTypes += 1;
        totalQuantity += Number(item.quantity) || 0;
      }
    });
  });

  return {
    totalItemTypes,
    totalQuantity,
  };
}

function getItemFromCatalog(catalog, itemId) {
  const items = catalog && typeof catalog.items === "object" ? catalog.items : {};
  return items[normalizeText(itemId)] || null;
}

function getInventoryItemDurabilityConfig(itemConfig = {}) {
  const maxDurability = Math.max(1, Math.floor(toNumber(itemConfig.maxDurability, 100)));
  const durabilityLossPerUse = Math.max(1, Math.floor(toNumber(itemConfig.durabilityLossPerUse, 1)));

  return {
    maxDurability,
    durabilityLossPerUse,
  };
}

function isToyItem(itemConfig = {}) {
  return normalizeCategoryKey(itemConfig.category) === "toys";
}

function normalizeInventoryItemDurability(item = {}, itemConfig = {}) {
  const nextItem = {
    ...item,
  };

  if (!isToyItem(itemConfig)) {
    return {
      item: nextItem,
      changed: false,
    };
  }

  const { maxDurability, durabilityLossPerUse } = getInventoryItemDurabilityConfig(itemConfig);
  const hasDurability = item?.durability !== undefined && item?.durability !== null;
  const hasMaxDurability = item?.maxDurability !== undefined && item?.maxDurability !== null;
  const currentDurability = hasDurability ? Math.floor(toNumber(item.durability, maxDurability)) : maxDurability;
  const normalizedDurability = Math.max(0, Math.min(maxDurability, currentDurability));
  let changed = Boolean(hasDurability === false || hasMaxDurability === false);

  nextItem.maxDurability = maxDurability;
  nextItem.durability = normalizedDurability;
  nextItem.metadata = {
    ...(nextItem.metadata || {}),
    durabilityLossPerUse,
    toy: true,
  };

  if (normalizedDurability <= 0 && Number(nextItem.quantity) > 0) {
    const nextQuantity = Math.max(0, Math.floor(Number(nextItem.quantity) || 0) - 1);
    changed = true;

    if (nextQuantity > 0) {
      nextItem.quantity = nextQuantity;
      nextItem.durability = maxDurability;
    } else {
      return {
        item: null,
        changed: true,
      };
    }
  }

  if (nextItem.durability > maxDurability) {
    nextItem.durability = maxDurability;
    changed = true;
  }

  return {
    item: nextItem,
    changed,
  };
}

function hydrateInventoryDurability(state = {}, catalog = null) {
  const nextState = cloneInventory(state);
  const items = catalog && typeof catalog.items === "object" ? catalog.items : {};
  let changed = false;

  Object.entries(nextState.categories || {}).forEach(([categoryKey, categoryItems]) => {
    Object.entries(categoryItems || {}).forEach(([itemId, item]) => {
      const itemConfig = items[normalizeText(itemId)];
      if (!itemConfig || !isToyItem(itemConfig)) {
        return;
      }

      const normalized = normalizeInventoryItemDurability(item, itemConfig);
      changed = changed || normalized.changed;

      if (!normalized.item) {
        delete nextState.categories[categoryKey][itemId];
        return;
      }

      nextState.categories[categoryKey][itemId] = normalized.item;
    });
  });

  if (changed) {
    nextState.updatedAt = new Date().toISOString();
    nextState.version = Math.max(0, Number(nextState.version) || 0) + 1;
  }

  return {
    state: nextState,
    changed,
  };
}

function cloneInventory(state) {
  return JSON.parse(JSON.stringify(state || {}));
}

function addItemToInventory(state, itemConfig, quantity = 1) {
  const nextState = cloneInventory(state);
  const categoryKey = normalizeCategoryKey(itemConfig.category);
  const itemId = normalizeText(itemConfig.itemId);
  if (!categoryKey || !itemId) {
    throw new ApiError(400, "Dữ liệu vật phẩm không hợp lệ", PET_ERROR_CODES.VALIDATION_ERROR);
  }

  if (!nextState.categories || typeof nextState.categories !== "object") {
    nextState.categories = {};
  }
  if (!nextState.categories[categoryKey] || typeof nextState.categories[categoryKey] !== "object") {
    nextState.categories[categoryKey] = {};
  }

  const existing = nextState.categories[categoryKey][itemId] || {
    itemId,
    quantity: 0,
    equipped: false,
    updatedAt: "",
    metadata: {},
  };
  const isToy = isToyItem(itemConfig);
  const durabilityConfig = isToy ? getInventoryItemDurabilityConfig(itemConfig) : null;
  const existingDurability = isToy
    ? Math.max(0, Math.min(
        durabilityConfig.maxDurability,
        Math.floor(toNumber(existing.durability, durabilityConfig.maxDurability)),
      ))
    : null;

  const maxStack = Math.max(
    1,
    Math.floor(toNumber(itemConfig.maxStack, itemConfig.maxStack ?? 99)),
  );
  const nextQuantity = Math.min(maxStack, Math.max(0, Number(existing.quantity) || 0) + Math.max(0, Math.floor(quantity)));

  nextState.categories[categoryKey][itemId] = {
    ...existing,
    itemId,
    quantity: nextQuantity,
    updatedAt: new Date().toISOString(),
    metadata: {
      ...(existing.metadata || {}),
      icon: itemConfig.icon || "",
      description: itemConfig.description || "",
      ...(isToy
        ? {
            durabilityLossPerUse: durabilityConfig.durabilityLossPerUse,
            toy: true,
          }
        : {}),
    },
  };

  if (isToy) {
    nextState.categories[categoryKey][itemId].maxDurability = durabilityConfig.maxDurability;
    nextState.categories[categoryKey][itemId].durability =
      Number.isFinite(existingDurability) && existingDurability > 0
        ? existingDurability
        : durabilityConfig.maxDurability;
  }

  nextState.updatedAt = new Date().toISOString();
  nextState.version = Math.max(0, Number(nextState.version) || 0) + 1;
  return nextState;
}

function useItemFromInventory(state, itemConfig, quantity = 1) {
  const nextState = cloneInventory(state);
  const categoryKey = normalizeCategoryKey(itemConfig.category);
  const itemId = normalizeText(itemConfig.itemId);
  if (!categoryKey || !itemId) {
    throw new ApiError(400, "Dữ liệu vật phẩm không hợp lệ", PET_ERROR_CODES.VALIDATION_ERROR);
  }

  const category = nextState.categories?.[categoryKey] || {};
  const existing = category[itemId];

  if (!existing || Number(existing.quantity) <= 0) {
    throw new ApiError(404, "Không tìm thấy vật phẩm trong kho", PET_ERROR_CODES.ITEM_NOT_FOUND);
  }

  const normalizedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));

  if (Number(existing.quantity) < normalizedQuantity) {
    throw new ApiError(400, "Số lượng vật phẩm không đủ", PET_ERROR_CODES.INSUFFICIENT_ITEM_QUANTITY);
  }

  const isToy = isToyItem(itemConfig);
  const consumable = itemConfig.consumable !== false;

  if (isToy) {
    const durabilityConfig = getInventoryItemDurabilityConfig(itemConfig);
    const currentDurability = Math.max(
      0,
      Math.min(
        durabilityConfig.maxDurability,
        Math.floor(toNumber(existing.durability, durabilityConfig.maxDurability)),
      ),
    );
    const nextDurability = currentDurability - durabilityConfig.durabilityLossPerUse;
    const nextQuantity = Number(existing.quantity) - 1;

    if (nextDurability > 0) {
      category[itemId] = {
        ...existing,
        durability: nextDurability,
        maxDurability: durabilityConfig.maxDurability,
        updatedAt: new Date().toISOString(),
      };
      nextState.categories[categoryKey] = category;
    } else if (nextQuantity > 0) {
      category[itemId] = {
        ...existing,
        quantity: nextQuantity,
        durability: durabilityConfig.maxDurability,
        maxDurability: durabilityConfig.maxDurability,
        updatedAt: new Date().toISOString(),
      };
      nextState.categories[categoryKey] = category;
    } else {
      delete category[itemId];
      nextState.categories[categoryKey] = category;
    }
  } else if (consumable) {
    const nextQuantity = Number(existing.quantity) - normalizedQuantity;
    if (nextQuantity > 0) {
      category[itemId] = {
        ...existing,
        quantity: nextQuantity,
        updatedAt: new Date().toISOString(),
      };
      nextState.categories[categoryKey] = category;
    } else {
      delete category[itemId];
      nextState.categories[categoryKey] = category;
    }
  } else {
    category[itemId] = {
      ...existing,
      equipped: true,
      updatedAt: new Date().toISOString(),
    };
    nextState.categories[categoryKey] = category;
  }

  nextState.updatedAt = new Date().toISOString();
  nextState.version = Math.max(0, Number(nextState.version) || 0) + 1;
  return nextState;
}

async function getInventory({ uid, requestId = "" }) {
  const normalizedUid = normalizeText(uid);
  const user = await getUserById(normalizedUid);
  ensureStudent(user);

  const [inventory, catalog] = await Promise.all([
    getInventoryState(normalizedUid),
    readConfigDoc("shopCatalog").catch(() => null),
  ]);
  const hydrated = catalog ? hydrateInventoryDurability(inventory, catalog) : { state: inventory, changed: false };
  const nextInventory = hydrated.state;

  if (hydrated.changed) {
    await saveInventoryState(normalizedUid, nextInventory);
  }

  console.info("[PET][INFO] inventory.get", {
    requestId,
  });

  return {
    statusCode: 200,
    message: "Lấy kho vật phẩm thành công",
    data: {
      inventory: {
        categories: flattenInventoryState(nextInventory),
        summary: buildInventorySummary(nextInventory),
        version: nextInventory.version || 0,
        updatedAt: nextInventory.updatedAt || "",
      },
    },
    popupEvents: [],
    animationEvents: [],
    meta: {
      requestId,
    },
  };
}

async function useItem({ uid, body = {}, requestId = "", idempotencyKey = "" }) {
  const normalizedUid = normalizeText(uid);
  const itemId = normalizeText(body.itemId);
  const quantity = Math.max(1, Math.floor(Number(body.quantity) || 1));
  const targetPetId = normalizeText(body.targetPetId);

  if (!itemId) {
    throw new ApiError(400, "itemId is required", PET_ERROR_CODES.VALIDATION_ERROR);
  }

  const catalog = await readConfigDoc("shopCatalog");
  if (!catalog) {
    throw new ApiError(404, "Shop Catalog không tồn tại", PET_ERROR_CODES.GAME_CONFIG_NOT_FOUND, {
      missingDocs: ["shopCatalog"],
    });
  }

  const itemConfig = getItemFromCatalog(catalog, itemId);
  if (!itemConfig) {
    throw new ApiError(404, "Item không tồn tại", PET_ERROR_CODES.ITEM_NOT_FOUND);
  }

  const result = await runTransaction(async (transaction) => {
    const user = await getUserById(normalizedUid, transaction);
    ensureStudent(user);

    if (idempotencyKey) {
      const cached = await getInventoryTransaction(normalizedUid, idempotencyKey, transaction);
      if (cached?.response) {
        return cached.response;
      }
    }

    const inventory = await getInventoryState(normalizedUid, transaction);
    const hydratedInventory = hydrateInventoryDurability(inventory, catalog);
    const normalizedQuantity = isToyItem(itemConfig) ? 1 : quantity;
    const nextInventory = useItemFromInventory(hydratedInventory.state, itemConfig, normalizedQuantity);
    let nextPetState = null;

    if (itemConfig.affectsPet !== false) {
      const petState = await getPetState(normalizedUid, transaction);
      if (petState) {
        const bundle = {
          petBalance: await readConfigDoc("petBalance", transaction),
          levelConfig: await readConfigDoc("levelConfig", transaction),
          evolutionConfig: await readConfigDoc("evolutionConfig", transaction),
        };
        nextPetState = applyItemEffectsToPet(petState, itemConfig, bundle, new Date());
        await savePetState(normalizedUid, stripDerivedPetFields(nextPetState), transaction);
      }
    }

    await saveInventoryState(normalizedUid, nextInventory, transaction);
    await updateUserById(
      normalizedUid,
      {
        updatedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      },
      transaction,
    );

    const response = {
      statusCode: 200,
      message: "Sử dụng vật phẩm thành công",
      data: {
        inventory: {
          categories: flattenInventoryState(nextInventory),
          summary: buildInventorySummary(nextInventory),
          version: nextInventory.version || 0,
          updatedAt: nextInventory.updatedAt || "",
        },
        pet: nextPetState
          ? {
              petType: nextPetState.petTypeId,
              level: nextPetState.level,
              exp: nextPetState.exp,
              hunger: nextPetState.hunger,
              happiness: nextPetState.happiness,
              energy: nextPetState.energy,
              health: nextPetState.health,
              mood: nextPetState.mood,
              stage: nextPetState.stage,
              version: nextPetState.version,
            }
          : null,
      },
      popupEvents: [
        {
          type: "ITEM_USE",
          title: "Đã dùng vật phẩm",
          message: `${itemConfig.name || itemId} đã được sử dụng.`,
          icon: itemConfig.icon || "item",
          priority: "normal",
          duration: 2200,
        },
      ],
      animationEvents: [],
      meta: {
        requestId,
        itemId,
        quantity: normalizedQuantity,
        targetPetId,
      },
    };

    if (idempotencyKey) {
      await saveInventoryTransaction(
        normalizedUid,
        idempotencyKey,
        {
          action: "use",
          requestId,
          response,
          createdAt: new Date().toISOString(),
        },
        transaction,
      );
    }

    console.info("[PET][INFO] item.use", {
      requestId,
      itemId,
      quantity: normalizedQuantity,
    });

    return response;
  });

  return result;
}

module.exports = {
  addItemToInventory,
  buildInventorySummary,
  flattenInventoryState,
  getInventory,
  useItem,
  useItemFromInventory,
};
