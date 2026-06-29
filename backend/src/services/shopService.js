const ApiError = require("../utils/apiError");
const { PET_ERROR_CODES } = require("../constants/petConstants");
const { readConfigDoc } = require("../repositories/gameConfigRepository");
const {
  getInventoryState,
  getInventoryTransaction,
  saveInventoryState,
  saveInventoryTransaction,
} = require("../repositories/inventoryRepository");
const { getUserById, updateUserById } = require("../repositories/userRepository");
const { getPetState, runTransaction, savePetState } = require("../repositories/petRepository");
const { addItemToInventory, buildInventorySummary, flattenInventoryState } = require("./inventoryService");
const { normalizeCategoryKey } = require("../repositories/inventoryRepository");
const { toNumber } = require("./petMathService");
const { applyItemEffectsToPet } = require("./petItemEffectService");
const { stripDerivedPetFields } = require("./petDecayService");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeItemReference(value) {
  if (!value || typeof value === "string" || typeof value === "number") {
    return normalizeText(value);
  }

  if (typeof value === "object") {
    return normalizeText(
      value.itemId || value.id || value.key || value.code || value.item || "",
    );
  }

  return "";
}

const ECONOMY_SHOP_PRICES = {
  ball: 30,
  teddy: 38,
  kite: 63,
  pinwheel: 50,
  drum: 70,
  lantern: 75,
  toHe: 55,
  paperMask: 60,
};

function resolveEconomyShopPrice(itemConfig) {
  const itemId = normalizeText(itemConfig?.itemId || itemConfig?.id || itemConfig?.key || itemConfig?.code);
  const overridePrice = ECONOMY_SHOP_PRICES[itemId];

  if (Number.isFinite(overridePrice)) {
    return Math.max(0, Math.floor(overridePrice));
  }

  return Math.max(0, Math.floor(toNumber(itemConfig?.price, 0)));
}

function ensureStudent(user) {
  if (!user) {
    throw new ApiError(401, "Thiếu xác thực", PET_ERROR_CODES.UNAUTHORIZED);
  }

  if (String(user.role || "").toLowerCase() !== "student") {
    throw new ApiError(403, "Chỉ học sinh mới được dùng Shop", PET_ERROR_CODES.FORBIDDEN);
  }
}

function getItemMap(catalog) {
  return catalog && typeof catalog.items === "object" ? catalog.items : {};
}

function resolvePetLevel(user, petState) {
  const userLevel = Math.max(1, Math.floor(toNumber(user?.stats?.level, 1)));
  const petLevel = Math.max(1, Math.floor(toNumber(petState?.level, 1)));
  return Math.max(userLevel, petLevel);
}

function buildShopItemView(itemConfig, userLevel, inventoryState) {
  const itemId = normalizeText(
    itemConfig.itemId || itemConfig.id || itemConfig.key || itemConfig.code,
  );
  const categoryKey = normalizeCategoryKey(itemConfig.category);
  const ownedQuantity = Number(inventoryState?.categories?.[categoryKey]?.[itemId]?.quantity || 0);
  const maxStack = Math.max(1, Math.floor(toNumber(itemConfig.maxStack, 99)));
  const unlockLevel = Math.max(1, Math.floor(toNumber(itemConfig.unlockLevel, 1)));
  const name = normalizeText(itemConfig.name || itemConfig.title || itemId);
  const key = normalizeText(itemConfig.key || itemId);
  const code = normalizeText(itemConfig.code || itemId);
  const price = resolveEconomyShopPrice(itemConfig);
  const displayName = name || itemId;

  return {
    ...itemConfig,
    id: itemId,
    key: key || itemId,
    code: code || itemId,
    itemId,
    name: displayName,
    displayName,
    category: categoryKey || itemConfig.category,
    unlockLevel,
    maxStack,
    price,
    ownedQuantity,
    canBuy: userLevel >= unlockLevel && ownedQuantity < maxStack,
  };
}

async function getShop({ uid, requestId = "" }) {
  const normalizedUid = normalizeText(uid);
  const user = await getUserById(normalizedUid);
  ensureStudent(user);

  const [catalog, inventoryState, petState] = await Promise.all([
    readConfigDoc("shopCatalog"),
    getInventoryState(normalizedUid),
    getPetState(normalizedUid).catch(() => null),
  ]);

  if (!catalog) {
    throw new ApiError(404, "Shop Catalog không tồn tại", PET_ERROR_CODES.GAME_CONFIG_NOT_FOUND, {
      missingDocs: ["shopCatalog"],
    });
  }

  const userLevel = resolvePetLevel(user, petState);
  const items = Object.values(getItemMap(catalog))
    .filter(Boolean)
    .map((itemConfig) => buildShopItemView(itemConfig, userLevel, inventoryState))
    .sort((left, right) => {
      const leftOrder = Number(left.sortOrder || 0);
      const rightOrder = Number(right.sortOrder || 0);
      return leftOrder - rightOrder;
    });

  console.info("[PET][INFO] shop.get", {
    requestId,
    itemCount: items.length,
  });

  return {
    statusCode: 200,
    message: "Lấy danh sách Shop thành công",
    data: {
      items,
      userLevel,
      currency: catalog.currency || "eduCoin",
    },
    popupEvents: [],
    animationEvents: [],
    meta: {
      requestId,
    },
  };
}

async function buyItem({ uid, body = {}, requestId = "", idempotencyKey = "" }) {
  const normalizedUid = normalizeText(uid);
  const itemId = normalizeItemReference(
    body.itemId || body.item || body.id || body.key || body.code || "",
  );
  const quantity = Math.max(1, Math.floor(Number(body.quantity) || 1));

  if (!itemId) {
    throw new ApiError(400, "itemId is required", PET_ERROR_CODES.VALIDATION_ERROR);
  }

  const catalog = await readConfigDoc("shopCatalog");
  if (!catalog) {
    throw new ApiError(404, "Shop Catalog kh?ng t?n t?i", PET_ERROR_CODES.GAME_CONFIG_NOT_FOUND, {
      missingDocs: ["shopCatalog"],
    });
  }

  const itemConfig = getItemMap(catalog)[itemId];
  if (!itemConfig) {
    throw new ApiError(404, "Item kh?ng t?n t?i", PET_ERROR_CODES.ITEM_NOT_FOUND);
  }

  const isMedicineItem = normalizeCategoryKey(itemConfig.category) === "medicine";

  const result = await runTransaction(async (transaction) => {
    const user = await getUserById(normalizedUid, transaction);
    ensureStudent(user);

    if (idempotencyKey) {
      const cached = await getInventoryTransaction(normalizedUid, `shop:${idempotencyKey}`, transaction);
      if (cached?.response) {
        return cached.response;
      }
    }

    const petState = await getPetState(normalizedUid, transaction).catch(() => null);
    const userLevel = resolvePetLevel(user, petState);
    const unlockLevel = Math.max(1, Math.floor(toNumber(itemConfig.unlockLevel, 1)));
    if (userLevel < unlockLevel) {
      throw new ApiError(403, "V?t ph?m ch?a ???c m? kh?a", PET_ERROR_CODES.SHOP_ITEM_LOCKED, {
        unlockLevel,
        userLevel,
      });
    }

    const inventory = await getInventoryState(normalizedUid, transaction);
    const categoryKey = normalizeCategoryKey(itemConfig.category);
    const existingQuantity = Number(inventory?.categories?.[categoryKey]?.[itemId]?.quantity || 0);
    const maxStack = Math.max(1, Math.floor(toNumber(itemConfig.maxStack, 99)));
    if (!isMedicineItem && existingQuantity + quantity > maxStack) {
      throw new ApiError(409, "V??t gi?i h?n s? l??ng v?t ph?m", PET_ERROR_CODES.ITEM_OUT_OF_STOCK, {
        maxStack,
        existingQuantity,
      });
    }

    const coinBalance = Math.max(0, Number(user?.stats?.eduCoin || 0));
    const price = Math.max(0, resolveEconomyShopPrice(itemConfig) * quantity);
    if (coinBalance < price) {
      throw new ApiError(400, "Kh?ng ?? Xu Edu", PET_ERROR_CODES.NOT_ENOUGH_COIN, {
        coinBalance,
        price,
      });
    }

    const nextCoinBalance = coinBalance - price;
    const nextStats = {
      ...(user.stats || {}),
      eduCoin: nextCoinBalance,
      totalEduCoinSpent: Math.max(0, Number(user?.stats?.totalEduCoinSpent || 0)) + price,
    };

    let nextInventory = inventory;
    let nextPetState = petState;

    if (isMedicineItem) {
      if (petState) {
        const qty = Math.max(1, Math.floor(quantity));
        const scaledItemConfig = {
          ...itemConfig,
          effects: Object.fromEntries(
            Object.entries(itemConfig.effects || {}).map(([effectKey, effectValue]) => [
              effectKey,
              Number.isFinite(Number(effectValue)) ? Number(effectValue) * qty : effectValue,
            ]),
          ),
        };
        const bundle = {
          petBalance: await readConfigDoc("petBalance", transaction),
          levelConfig: await readConfigDoc("levelConfig", transaction),
          evolutionConfig: await readConfigDoc("evolutionConfig", transaction),
        };

        nextPetState = applyItemEffectsToPet(petState, scaledItemConfig, bundle, new Date());
        await savePetState(normalizedUid, stripDerivedPetFields(nextPetState), transaction);
      }
    } else {
      nextInventory = addItemToInventory(inventory, itemConfig, quantity);
      await saveInventoryState(normalizedUid, nextInventory, transaction);
    }

    await updateUserById(
      normalizedUid,
      {
        stats: nextStats,
        updatedAt: new Date().toISOString(),
      },
      transaction,
    );

    const response = {
      statusCode: 200,
      message: isMedicineItem ? "Mua v? s? d?ng v?t ph?m th?nh c?ng" : "Mua v?t ph?m th?nh c?ng",
      data: {
        inventory: {
          categories: flattenInventoryState(nextInventory, catalog),
          summary: buildInventorySummary(nextInventory),
          version: nextInventory.version || 0,
          updatedAt: nextInventory.updatedAt || "",
        },
        pet: nextPetState
          ? {
              petType: nextPetState.petTypeId,
              level: nextPetState.level,
              exp: nextPetState.exp,
              requiredExpToNextLevel: nextPetState.requiredExpToNextLevel,
              hunger: nextPetState.hunger,
              happiness: nextPetState.happiness,
              energy: nextPetState.energy,
              health: nextPetState.health,
              mood: nextPetState.mood,
              stage: nextPetState.stage,
              version: nextPetState.version,
            }
          : null,
        wallet: {
          eduCoin: nextCoinBalance,
        },
        item: {
          itemId,
          quantity,
          price,
          usedImmediately: isMedicineItem,
        },
      },
      popupEvents: [
        {
          type: "SHOP_BUY_SUCCESS",
          title: "Mua th?nh c?ng",
          message: isMedicineItem
            ? `${itemConfig.name || itemId} ?? ???c mua v? d?ng ngay.`
            : `${itemConfig.name || itemId} ?? ???c th?m v?o kho.`,
          icon: itemConfig.icon || "shop",
          priority: "normal",
          duration: 2200,
        },
      ],
      animationEvents: [],
      meta: {
        requestId,
        itemId,
        quantity,
        price,
        usedImmediately: isMedicineItem,
      },
    };

    if (idempotencyKey) {
      await saveInventoryTransaction(
        normalizedUid,
        `shop:${idempotencyKey}`,
        {
          action: "buy",
          requestId,
          response,
          createdAt: new Date().toISOString(),
        },
        transaction,
      );
    }

    console.info("[PET][INFO] SHOP_BUY", {
      requestId,
      itemId,
      quantity,
      price,
      usedImmediately: isMedicineItem,
    });
    console.info("[PET][INFO] COIN_SPENT", {
      requestId,
      amount: price,
    });

    return response;
  });

  return result;
}


module.exports = {
  buyItem,
  getShop,
};
