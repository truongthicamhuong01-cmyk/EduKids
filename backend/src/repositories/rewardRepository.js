const crypto = require("crypto");
const { db } = require("../firebase");

const rewardLedgerCollection = db.collection("rewardLedger");

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

function getRewardLedgerRef(ledgerKey) {
  return rewardLedgerCollection.doc(hashKey(ledgerKey));
}

async function getRewardLedger(ledgerKey, transaction = null) {
  const ref = getRewardLedgerRef(ledgerKey);
  const snapshot = transaction ? await transaction.get(ref) : await ref.get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() || {}),
  };
}

async function saveRewardLedger(ledgerKey, payload, transaction = null) {
  const ref = getRewardLedgerRef(ledgerKey);

  if (transaction) {
    transaction.set(ref, payload, { merge: true });
    return payload;
  }

  await ref.set(payload, { merge: true });
  return payload;
}

module.exports = {
  getRewardLedger,
  getRewardLedgerRef,
  saveRewardLedger,
};
