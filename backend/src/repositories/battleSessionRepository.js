const crypto = require("crypto");
const { db } = require("../firebase");

const battleSessionsCollection = db.collection("battle_sessions");

function normalizeSessionId(value) {
  return String(value || "").trim();
}

function getBattleSessionRef(sessionId) {
  const normalizedSessionId = normalizeSessionId(sessionId);

  if (!normalizedSessionId) {
    return null;
  }

  return battleSessionsCollection.doc(normalizedSessionId);
}

async function getBattleSessionById(sessionId, transaction = null) {
  const ref = getBattleSessionRef(sessionId);

  if (!ref) {
    return null;
  }

  const snapshot = transaction ? await transaction.get(ref) : await ref.get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() || {};

  return {
    id: snapshot.id,
    sessionId: data.sessionId || snapshot.id,
    userId: data.userId || "",
    topicId: data.topicId || "",
    quizId: data.quizId || "",
    currentQuestionIndex: Number(data.currentQuestionIndex || 0),
    bossHP: Number(data.bossHP || 0),
    playerHP: Number(data.playerHP || 0),
    combo: Number(data.combo || 0),
    hintRemaining: Number(data.hintRemaining ?? 3),
    answers: Array.isArray(data.answers) ? data.answers : [],
    status: String(data.status || "active").trim() || "active",
    rewardStatus: String(data.rewardStatus || "pending").trim() || "pending",
    rewardSummary: data.rewardSummary && typeof data.rewardSummary === "object" ? data.rewardSummary : null,
    rewardedAt: String(data.rewardedAt || ""),
    createdAt: String(data.createdAt || ""),
    updatedAt: String(data.updatedAt || data.createdAt || ""),
  };
}

async function createBattleSession(session, transaction = null) {
  const normalizedSession = {
    sessionId: normalizeSessionId(session?.sessionId),
    userId: normalizeSessionId(session?.userId),
    topicId: normalizeSessionId(session?.topicId),
    quizId: normalizeSessionId(session?.quizId),
    currentQuestionIndex: Math.max(0, Math.floor(Number(session?.currentQuestionIndex) || 0)),
    bossHP: Math.max(0, Math.floor(Number(session?.bossHP) || 0)),
    playerHP: Math.max(0, Math.floor(Number(session?.playerHP) || 0)),
    combo: Math.max(0, Math.floor(Number(session?.combo) || 0)),
    hintRemaining: Math.max(0, Math.floor(Number(session?.hintRemaining ?? 3) || 0)),
    answers: Array.isArray(session?.answers) ? session.answers : [],
    status: String(session?.status || "active").trim() || "active",
    rewardStatus: String(session?.rewardStatus || "pending").trim() || "pending",
    rewardSummary:
      session?.rewardSummary && typeof session.rewardSummary === "object"
        ? session.rewardSummary
        : null,
    rewardedAt: String(session?.rewardedAt || ""),
    createdAt: String(session?.createdAt || ""),
    updatedAt: String(session?.updatedAt || session?.createdAt || ""),
  };

  if (!normalizedSession.sessionId) {
    normalizedSession.sessionId = crypto.randomUUID();
  }

  const ref = getBattleSessionRef(normalizedSession.sessionId);

  if (!ref) {
    return null;
  }

  if (transaction) {
    transaction.set(ref, normalizedSession, { merge: true });
    return normalizedSession;
  }

  await ref.set(normalizedSession, { merge: true });
  return normalizedSession;
}

async function updateBattleSessionById(sessionId, updates = {}, transaction = null) {
  const ref = getBattleSessionRef(sessionId);

  if (!ref) {
    return null;
  }

  const patch = {
    ...updates,
  };

  if (Object.prototype.hasOwnProperty.call(patch, "currentQuestionIndex")) {
    patch.currentQuestionIndex = Math.max(0, Math.floor(Number(patch.currentQuestionIndex) || 0));
  }

  if (Object.prototype.hasOwnProperty.call(patch, "bossHP")) {
    patch.bossHP = Math.max(0, Math.floor(Number(patch.bossHP) || 0));
  }

  if (Object.prototype.hasOwnProperty.call(patch, "playerHP")) {
    patch.playerHP = Math.max(0, Math.floor(Number(patch.playerHP) || 0));
  }

  if (Object.prototype.hasOwnProperty.call(patch, "combo")) {
    patch.combo = Math.max(0, Math.floor(Number(patch.combo) || 0));
  }

  if (Object.prototype.hasOwnProperty.call(patch, "hintRemaining")) {
    patch.hintRemaining = Math.max(
      0,
      Math.floor(Number(patch.hintRemaining) || 0),
    );
  }

  if (Object.prototype.hasOwnProperty.call(patch, "answers")) {
    patch.answers = Array.isArray(patch.answers) ? patch.answers : [];
  }

  if (Object.prototype.hasOwnProperty.call(patch, "status")) {
    patch.status = String(patch.status || "active").trim() || "active";
  }

  if (Object.prototype.hasOwnProperty.call(patch, "rewardStatus")) {
    patch.rewardStatus = String(patch.rewardStatus || "pending").trim() || "pending";
  }

  if (Object.prototype.hasOwnProperty.call(patch, "rewardSummary")) {
    patch.rewardSummary =
      patch.rewardSummary && typeof patch.rewardSummary === "object"
        ? patch.rewardSummary
        : null;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "rewardedAt")) {
    patch.rewardedAt = String(patch.rewardedAt || "");
  }

  if (Object.prototype.hasOwnProperty.call(patch, "sessionId")) {
    patch.sessionId = normalizeSessionId(patch.sessionId) || sessionId;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "userId")) {
    patch.userId = normalizeSessionId(patch.userId);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "topicId")) {
    patch.topicId = normalizeSessionId(patch.topicId);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "quizId")) {
    patch.quizId = normalizeSessionId(patch.quizId);
  }

  if (transaction) {
    transaction.set(ref, patch, { merge: true });
    return patch;
  }

  await ref.set(patch, { merge: true });
  return patch;
}

async function runTransaction(executor) {
  return db.runTransaction(executor);
}

module.exports = {
  createBattleSession,
  getBattleSessionById,
  getBattleSessionRef,
  runTransaction,
  updateBattleSessionById,
};
