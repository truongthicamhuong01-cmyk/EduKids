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

function getPetStateRef(uid) {
  return usersCollection.doc(normalizeId(uid)).collection("pet").doc("state");
}

function getPetRequestRef(uid, requestKey) {
  return usersCollection.doc(normalizeId(uid)).collection("petRequests").doc(hashKey(requestKey));
}

function getPetActivityLogRef(uid, activityId) {
  return usersCollection.doc(normalizeId(uid)).collection("petActivityLog").doc(hashKey(activityId));
}

async function getPetState(uid, transaction = null) {
  const ref = getPetStateRef(uid);
  const snapshot = transaction ? await transaction.get(ref) : await ref.get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() || {}),
  };
}

async function savePetState(uid, state, transaction = null) {
  const ref = getPetStateRef(uid);

  if (transaction) {
    transaction.set(ref, state, { merge: true });
    return true;
  }

  await ref.set(state, { merge: true });
  return true;
}

async function getPetRequest(uid, requestKey, transaction = null) {
  const ref = getPetRequestRef(uid, requestKey);
  const snapshot = transaction ? await transaction.get(ref) : await ref.get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() || {}),
  };
}

async function savePetRequest(uid, requestKey, payload, transaction = null) {
  const ref = getPetRequestRef(uid, requestKey);

  if (transaction) {
    transaction.set(ref, payload, { merge: true });
    return true;
  }

  await ref.set(payload, { merge: true });
  return true;
}

async function appendPetActivityLog(uid, activityId, payload, transaction = null) {
  const ref = getPetActivityLogRef(uid, activityId);

  if (transaction) {
    transaction.set(ref, payload, { merge: true });
    return true;
  }

  await ref.set(payload, { merge: true });
  return true;
}

async function runTransaction(executor) {
  return db.runTransaction(executor);
}

module.exports = {
  appendPetActivityLog,
  getPetRequest,
  getPetRequestRef,
  getPetState,
  getPetStateRef,
  runTransaction,
  savePetRequest,
  savePetState,
};
