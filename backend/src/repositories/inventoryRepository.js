const crypto = require("crypto");
const { db } = require("../firebase");

const usersCollection = db.collection("users");

function normalizeId(value) {
  return String(value || "").trim();
}

function hashKey(value) {
  const normalized = normalizeId(value);
  if (!normalized) {
    return "";
  }

  return crypto.createHash("sha1").update(normalized).digest("hex");
}

function getInventoryRef(uid) {
  return usersCollection.doc(normalizeId(uid)).collection("inventory").doc("state");
}

function getInventoryTransactionRef(uid, requestKey) {
  return usersCollection
    .doc(normalizeId(uid))
    .collection("inventoryTransactions")
    .doc(hashKey(requestKey));
}

function createEmptyInventory() {
  return {
    categories: {
      foods: {},
      toys: {},
      medicine: {},
      decoration: {},
      special: {},
    },
    updatedAt: "",
    version: 0,
  };
}

function normalizeCategoryKey(category = "") {
  const normalized = String(category || "").trim().toLowerCase();

  if (normalized === "food" || normalized === "foods") {
    return "foods";
  }

  if (normalized === "toy" || normalized === "toys") {
    return "toys";
  }

  if (normalized === "medicine" || normalized === "medicines") {
    return "medicine";
  }

  if (normalized === "decoration" || normalized === "decorations") {
    return "decoration";
  }

  if (normalized === "special" || normalized === "specialitems") {
    return "special";
  }

  return "";
}

function normalizeInventoryState(data = {}) {
  const source = data && typeof data === "object" ? data : {};
  const categories = source.categories && typeof source.categories === "object" ? source.categories : {};
  const next = createEmptyInventory();

  Object.keys(next.categories).forEach((category) => {
    const sourceCategory = categories[category] && typeof categories[category] === "object" ? categories[category] : {};
    next.categories[category] = Object.fromEntries(
      Object.entries(sourceCategory)
        .map(([itemId, item]) => {
          const normalizedItemId = normalizeId(itemId);
          if (!normalizedItemId) {
            return null;
          }

          return [
            normalizedItemId,
            (() => {
              const normalizedItem = {
              itemId: normalizedItemId,
              quantity: Math.max(0, Math.floor(Number(item?.quantity || 0))),
              equipped: Boolean(item?.equipped),
              updatedAt: String(item?.updatedAt || ""),
              metadata: item?.metadata && typeof item.metadata === "object" ? { ...item.metadata } : {},
              };

              if (item?.durability !== undefined) {
                normalizedItem.durability = Math.max(0, Math.floor(Number(item.durability || 0)));
              }

              if (item?.maxDurability !== undefined) {
                normalizedItem.maxDurability = Math.max(0, Math.floor(Number(item.maxDurability || 0)));
              }

              return normalizedItem;
            })(),
          ];
        })
        .filter(Boolean),
    );
  });

  next.updatedAt = String(source.updatedAt || "");
  next.version = Math.max(0, Math.floor(Number(source.version || 0)));
  return next;
}

async function getInventoryState(uid, transaction = null) {
  const ref = getInventoryRef(uid);
  const snapshot = transaction ? await transaction.get(ref) : await ref.get();

  if (!snapshot.exists) {
    return createEmptyInventory();
  }

  return normalizeInventoryState(snapshot.data() || {});
}

async function saveInventoryState(uid, state, transaction = null) {
  const ref = getInventoryRef(uid);
  const payload = normalizeInventoryState(state);

  if (transaction) {
    transaction.set(ref, payload, { merge: true });
    return payload;
  }

  await ref.set(payload, { merge: true });
  return payload;
}

async function getInventoryTransaction(uid, requestKey, transaction = null) {
  const ref = getInventoryTransactionRef(uid, requestKey);
  const snapshot = transaction ? await transaction.get(ref) : await ref.get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() || {}),
  };
}

async function saveInventoryTransaction(uid, requestKey, payload, transaction = null) {
  const ref = getInventoryTransactionRef(uid, requestKey);

  if (transaction) {
    transaction.set(ref, payload, { merge: true });
    return payload;
  }

  await ref.set(payload, { merge: true });
  return payload;
}

module.exports = {
  createEmptyInventory,
  getInventoryState,
  getInventoryTransaction,
  getInventoryRef,
  getInventoryTransactionRef,
  normalizeCategoryKey,
  normalizeInventoryState,
  saveInventoryState,
  saveInventoryTransaction,
};
