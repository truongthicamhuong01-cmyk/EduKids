const { db } = require("../firebase");
const ApiError = require("../utils/apiError");
const { buildVersionQuizId } = require("./quizVersionService");
const { calculateTopicAccuracy } = require("./topicAccuracyService");

const USER_PROGRESS_COLLECTION = db.collection("user_progress");

function normalizeVersionList(versions) {
  return (Array.isArray(versions) ? versions : [])
    .map((version) => {
      const versionId = String(version?.versionId || "").trim();
      const versionNumber = Number(version?.versionNumber || 0);

      return {
        ...version,
        versionId,
        versionNumber: Number.isInteger(versionNumber) && versionNumber > 0 ? versionNumber : null,
      };
    })
    .filter((version) => version.versionId);
}

async function getUserTopicProgressRef(userId, topicId) {
  const normalizedUserId = String(userId || "").trim();
  const normalizedTopicId = String(topicId || "").trim();

  if (!normalizedUserId || !normalizedTopicId) {
    throw new ApiError(400, "userId and topicId are required");
  }

  return USER_PROGRESS_COLLECTION.doc(normalizedUserId).collection("topics").doc(normalizedTopicId);
}

async function getUserTopicProgress(userId, topicId) {
  const ref = await getUserTopicProgressRef(userId, topicId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return {
      lastVersionUsed: "",
      history: [],
      totalAnswered: 0,
      totalCorrect: 0,
      percentage: 0,
    };
  }

  const data = snapshot.data() || {};
  const totalAnswered = Number(data.totalAnswered) || 0;
  const totalCorrect = Number(data.totalCorrect) || 0;
  const percentage = Number.isFinite(Number(data.percentage))
    ? Math.max(0, Math.min(100, Math.round(Number(data.percentage))))
    : totalAnswered > 0
      ? Math.round((totalCorrect / totalAnswered) * 100)
      : 0;

  return {
    lastVersionUsed: String(data.lastVersionUsed || "").trim(),
    history: Array.isArray(data.history) ? data.history.filter(Boolean) : [],
    totalAnswered,
    totalCorrect,
    percentage,
  };
}

async function recordUserTopicAccuracy(userId, topicId, topicResults = []) {
  const progressRef = await getUserTopicProgressRef(userId, topicId);
  const currentProgress = await getUserTopicProgress(userId, topicId);
  const accuracy = calculateTopicAccuracy(topicResults);
  const now = new Date().toISOString();
  const totalAnswered = Math.max(0, Number(currentProgress.totalAnswered) || 0) + accuracy.totalAnswered;
  const totalCorrect = Math.max(0, Number(currentProgress.totalCorrect) || 0) + accuracy.totalCorrect;
  const percentage = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  await progressRef.set(
    {
      userId: String(userId || "").trim(),
      topicId: String(topicId || "").trim(),
      totalAnswered,
      totalCorrect,
      percentage,
      accuracyUpdatedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  return {
    totalAnswered,
    totalCorrect,
    percentage,
  };
}

function pickRandomVersion(versions, lastVersionUsed = "") {
  if (versions.length === 1) {
    return versions[0];
  }

  const filtered = versions.filter((version) => version.versionId !== lastVersionUsed);
  const pool = filtered.length > 0 ? filtered : versions;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

function pickRoundRobinVersion(versions, lastVersionUsed = "") {
  if (versions.length === 0) {
    return null;
  }

  const sorted = [...versions].sort((a, b) => a.versionNumber - b.versionNumber);

  if (!lastVersionUsed) {
    return sorted[0];
  }

  const currentIndex = sorted.findIndex((version) => version.versionId === lastVersionUsed);

  if (currentIndex < 0) {
    return sorted[0];
  }

  return sorted[(currentIndex + 1) % sorted.length];
}

async function selectQuizVersion({
  userId,
  grade,
  subject,
  topicId,
  versions,
  strategy = "round_robin",
}) {
  const normalizedVersions = normalizeVersionList(versions);

  if (normalizedVersions.length === 0) {
    throw new ApiError(404, "Quiz versions not found for this topic");
  }

  const progress = await getUserTopicProgress(userId, topicId);

  const selectedVersion =
    strategy === "random"
      ? pickRandomVersion(normalizedVersions, progress.lastVersionUsed)
      : pickRoundRobinVersion(normalizedVersions, progress.lastVersionUsed);

  if (!selectedVersion) {
    throw new ApiError(404, "Quiz versions not found for this topic");
  }

  const now = new Date().toISOString();
  const progressRef = await getUserTopicProgressRef(userId, topicId);
  const nextHistory = Array.from(new Set([...(progress.history || []), selectedVersion.versionId]));

  await progressRef.set(
    {
      userId: String(userId || "").trim(),
      topicId: String(topicId || "").trim(),
      lastVersionUsed: selectedVersion.versionId,
      history: nextHistory,
      updatedAt: now,
    },
    { merge: true }
  );

  return {
    selectedVersion,
    progress: {
      lastVersionUsed: selectedVersion.versionId,
      history: nextHistory,
    },
    quizId: buildVersionQuizId({
      grade,
      subject,
      topicId,
      versionId: selectedVersion.versionId,
    }),
  };
}

module.exports = {
  selectQuizVersion,
  getUserTopicProgress,
  recordUserTopicAccuracy,
};
