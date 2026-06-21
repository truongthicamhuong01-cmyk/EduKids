const { db } = require("../firebase");
const { readConfigDoc } = require("./gameConfigRepository");
const crypto = require("crypto");

const usersCollection = db.collection("users");

function normalizeId(value) {
  return String(value || "").trim();
}

async function getShopCatalog(transaction = null) {
  const doc = await readConfigDoc("shopCatalog", transaction);
  return doc && typeof doc === "object" ? doc : null;
}

function getShopTransactionRef(uid, requestKey) {
  return usersCollection
    .doc(normalizeId(uid))
    .collection("shopTransactions")
    .doc(
      crypto
        .createHash("sha1")
        .update(String(requestKey || "").trim())
        .digest("hex"),
    );
}

async function getShopTransaction(uid, requestKey, transaction = null) {
  const ref = getShopTransactionRef(uid, requestKey);
  const snapshot = transaction ? await transaction.get(ref) : await ref.get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() || {}),
  };
}

async function saveShopTransaction(uid, requestKey, payload, transaction = null) {
  const ref = getShopTransactionRef(uid, requestKey);

  if (transaction) {
    transaction.set(ref, payload, { merge: true });
    return payload;
  }

  await ref.set(payload, { merge: true });
  return payload;
}

module.exports = {
  getShopCatalog,
  getShopTransaction,
  saveShopTransaction,
};
