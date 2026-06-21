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
    },
  };

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

  const consumable = itemConfig.consumable !== false;

  if (consumable) {
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

  const inventory = await getInventoryState(normalizedUid);

  console.info("[PET][INFO] inventory.get", {
    requestId,
  });

  return {
    statusCode: 200,
    message: "Lấy kho vật phẩm thành công",
    data: {
      inventory: {
        categories: flattenInventoryState(inventory),
        summary: buildInventorySummary(inventory),
        version: inventory.version || 0,
        updatedAt: inventory.updatedAt || "",
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
    throw new ApiError(500, "Shop Catalog không tồn tại", PET_ERROR_CODES.GAME_CONFIG_NOT_FOUND);
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
    const nextInventory = useItemFromInventory(inventory, itemConfig, quantity);
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
        await savePetState(normalizedUid, nextPetState, transaction);
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
        quantity,
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
      quantity,
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
