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
const { getPetState, runTransaction } = require("../repositories/petRepository");
const { addItemToInventory, buildInventorySummary, flattenInventoryState } = require("./inventoryService");
const { normalizeCategoryKey } = require("../repositories/inventoryRepository");
const { toNumber } = require("./petMathService");

function normalizeText(value) {
  return String(value || "").trim();
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
  const itemId = normalizeText(itemConfig.itemId);
  const categoryKey = normalizeCategoryKey(itemConfig.category);
  const ownedQuantity = Number(inventoryState?.categories?.[categoryKey]?.[itemId]?.quantity || 0);
  const maxStack = Math.max(1, Math.floor(toNumber(itemConfig.maxStack, 99)));
  const unlockLevel = Math.max(1, Math.floor(toNumber(itemConfig.unlockLevel, 1)));

  return {
    ...itemConfig,
    itemId,
    category: categoryKey || itemConfig.category,
    unlockLevel,
    maxStack,
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
  const itemId = normalizeText(body.itemId);
  const quantity = Math.max(1, Math.floor(Number(body.quantity) || 1));

  if (!itemId) {
    throw new ApiError(400, "itemId is required", PET_ERROR_CODES.VALIDATION_ERROR);
  }

  const catalog = await readConfigDoc("shopCatalog");
  if (!catalog) {
    throw new ApiError(404, "Shop Catalog không tồn tại", PET_ERROR_CODES.GAME_CONFIG_NOT_FOUND, {
      missingDocs: ["shopCatalog"],
    });
  }

  const itemConfig = getItemMap(catalog)[itemId];
  if (!itemConfig) {
    throw new ApiError(404, "Item không tồn tại", PET_ERROR_CODES.ITEM_NOT_FOUND);
  }

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
      throw new ApiError(403, "Vật phẩm chưa được mở khóa", PET_ERROR_CODES.SHOP_ITEM_LOCKED, {
        unlockLevel,
        userLevel,
      });
    }

    const inventory = await getInventoryState(normalizedUid, transaction);
    const categoryKey = normalizeCategoryKey(itemConfig.category);
    const existingQuantity = Number(inventory?.categories?.[categoryKey]?.[itemId]?.quantity || 0);
    const maxStack = Math.max(1, Math.floor(toNumber(itemConfig.maxStack, 99)));
    if (existingQuantity + quantity > maxStack) {
      throw new ApiError(409, "Vượt giới hạn số lượng vật phẩm", PET_ERROR_CODES.ITEM_OUT_OF_STOCK, {
        maxStack,
        existingQuantity,
      });
    }

    const coinBalance = Math.max(0, Number(user?.stats?.eduCoin || 0));
    const price = Math.max(0, Math.floor(toNumber(itemConfig.price, 0)) * quantity);
    if (coinBalance < price) {
      throw new ApiError(400, "Không đủ Xu Edu", PET_ERROR_CODES.NOT_ENOUGH_COIN, {
        coinBalance,
        price,
      });
    }

    const nextInventory = addItemToInventory(inventory, itemConfig, quantity);
    const nextCoinBalance = coinBalance - price;
    const nextStats = {
      ...(user.stats || {}),
      eduCoin: nextCoinBalance,
      totalEduCoinSpent: Math.max(0, Number(user?.stats?.totalEduCoinSpent || 0)) + price,
    };

    await saveInventoryState(normalizedUid, nextInventory, transaction);
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
      message: "Mua vật phẩm thành công",
      data: {
        inventory: {
          categories: flattenInventoryState(nextInventory),
          summary: buildInventorySummary(nextInventory),
          version: nextInventory.version || 0,
          updatedAt: nextInventory.updatedAt || "",
        },
        wallet: {
          eduCoin: nextCoinBalance,
        },
        item: {
          itemId,
          quantity,
          price,
        },
      },
      popupEvents: [
        {
          type: "SHOP_BUY_SUCCESS",
          title: "Mua thành công",
          message: `${itemConfig.name || itemId} đã được thêm vào kho.`,
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
