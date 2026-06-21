const { db } = require("../firebase");

const usersCollection = db.collection("users");

function getUserRef(uid) {
  return usersCollection.doc(String(uid || "").trim());
}

async function getUserById(uid, transaction = null) {
  const userRef = getUserRef(uid);
  const snapshot = transaction ? await transaction.get(userRef) : await userRef.get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() || {}),
  };
}

async function updateUserById(uid, updates, transaction = null) {
  const userRef = getUserRef(uid);

  if (transaction) {
    transaction.set(userRef, updates, { merge: true });
    return true;
  }

  await userRef.set(updates, { merge: true });
  return true;
}

module.exports = {
  getUserById,
  getUserRef,
  updateUserById,
};
