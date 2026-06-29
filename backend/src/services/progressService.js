const { admin, db } = require("../firebase");
const ApiError = require("../utils/apiError");
const { findUserById, updateUserById } = require("./userService");

const userRewardsCollection = db.collection("user_reward_receipts");

function calculateLevel(exp) {
  let remainingExp = Math.max(0, Math.floor(Number(exp) || 0));
  let level = 1;

  const getRequiredExpForLevel = (currentLevel) => {
    if (currentLevel === 1) return 100;
    if (currentLevel === 2) return 200;
    if (currentLevel === 3) return 400;
    if (currentLevel === 4) return 800;
    return 1000;
  };

  let requiredExp = getRequiredExpForLevel(level);

  while (remainingExp >= requiredExp) {
    remainingExp -= requiredExp;
    level += 1;
    requiredExp = getRequiredExpForLevel(level);
  }

  return {
    level,
    currentExp: remainingExp,
    requiredExp,
  };
}

function getStartOfDay(value) {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function updateStreak(user, now = new Date()) {
  const currentStats = user?.stats || {};
  const lastStudyDate = currentStats.lastStudyDate ? new Date(currentStats.lastStudyDate) : null;
  const today = getStartOfDay(now);

  if (!lastStudyDate || Number.isNaN(lastStudyDate.getTime())) {
    return {
      streak: 1,
      lastStudyDate: now.toISOString(),
    };
  }

  const lastStudyStart = getStartOfDay(lastStudyDate);
  const diffDays = Math.round((today.getTime() - lastStudyStart.getTime()) / 86400000);

  if (diffDays <= 0) {
    return {
      streak: Number(currentStats.streak) || 1,
      lastStudyDate: currentStats.lastStudyDate || now.toISOString(),
    };
  }

  if (diffDays === 1) {
    return {
      streak: Math.max(1, Number(currentStats.streak) || 0) + 1,
      lastStudyDate: now.toISOString(),
    };
  }

  return {
    streak: 1,
    lastStudyDate: now.toISOString(),
  };
}

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

function logProgress(message, payload) {
  if (isDevelopment()) {
    console.log(message, payload || "");
  }
}

async function awardExp(userId, amount, source, rewardId = "") {
  const normalizedUserId = String(userId || "").trim();
  const normalizedSource = String(source || "").trim();
  const normalizedRewardId = String(rewardId || "").trim();
  const numericAmount = Math.max(0, Math.floor(Number(amount) || 0));

  if (!normalizedUserId) {
    throw new ApiError(400, "userId is required");
  }

  if (!numericAmount) {
    return null;
  }

  const userRef = db.collection("users").doc(normalizedUserId);
  const rewardKey = normalizedRewardId || `${normalizedSource}:${normalizedUserId}`;
  const rewardRef = userRewardsCollection.doc(rewardKey);

  const result = await db.runTransaction(async (transaction) => {
    const rewardSnapshot = await transaction.get(rewardRef);

    if (rewardSnapshot.exists) {
      const userSnapshot = await transaction.get(userRef);
      if (!userSnapshot.exists) {
        throw new ApiError(404, "User document not found");
      }
      return {
        alreadyAwarded: true,
        user: { id: userSnapshot.id, ...(userSnapshot.data() || {}) },
      };
    }

    const userSnapshot = await transaction.get(userRef);

    if (!userSnapshot.exists) {
      throw new ApiError(404, "User document not found");
    }

    const currentUser = userSnapshot.data() || {};
    const currentStats = currentUser.stats || {};
    const currentExp = Math.max(0, Number(currentStats.exp) || 0);
    const nextExp = currentExp + numericAmount;
    const leveled = calculateLevel(nextExp);
    const updatedAt = new Date().toISOString();
    const progressDate = updatedAt;

    const nextStats = {
      ...currentStats,
      exp: nextExp,
      level: leveled.level,
      lastStudyDate: progressDate,
      streak: updateStreak({ stats: { ...currentStats, lastStudyDate: currentStats.lastStudyDate } }, new Date(progressDate)).streak,
    };

    transaction.set(
      userRef,
      {
        stats: nextStats,
        updatedAt,
      },
      { merge: true },
    );

    transaction.set(
      rewardRef,
      {
        userId: normalizedUserId,
        amount: numericAmount,
        source: normalizedSource,
        createdAt: updatedAt,
        updatedAt,
      },
      { merge: true },
    );

    logProgress(`[EXP] +${numericAmount} ${normalizedSource}`, {
      userId: normalizedUserId,
      rewardId: rewardKey,
    });

    if (leveled.level > (Number(currentStats.level) || 1)) {
      logProgress("[LEVEL] Level Up", {
        userId: normalizedUserId,
        from: Number(currentStats.level) || 1,
        to: leveled.level,
      });
    }

    logProgress("[STREAK] Updated", {
      userId: normalizedUserId,
      streak: nextStats.streak,
    });

    return {
      alreadyAwarded: false,
      user: {
        id: userSnapshot.id,
        ...currentUser,
        stats: nextStats,
        updatedAt,
      },
    };
  });

  return result;
}

function normalizeLearningActivityInput(activity = {}) {
  const startedAt = String(activity?.startedAt || "").trim();
  const completedAt = String(activity?.completedAt || "").trim();
  const sourceType = String(activity?.sourceType || "").trim();
  const sourceId = String(activity?.sourceId || "").trim();
  const idempotencyKey = String(activity?.idempotencyKey || activity?.id || "").trim();
  const topicId = String(activity?.topicId || "").trim();
  const quizId = String(activity?.quizId || "").trim();
  const totalQuestions = Math.max(0, Math.floor(Number(activity?.totalQuestions) || 0));
  const correctAnswers = Math.max(0, Math.floor(Number(activity?.correctAnswers) || 0));
  const wrongAnswers = Math.max(
    0,
    Math.floor(
      Number.isFinite(Number(activity?.wrongAnswers))
        ? Number(activity.wrongAnswers)
        : totalQuestions - correctAnswers,
    ),
  );
  const accuracy = Math.max(
    0,
    Math.min(
      100,
      Math.floor(
        Number.isFinite(Number(activity?.accuracy))
          ? Number(activity.accuracy)
          : totalQuestions > 0
            ? Math.round((correctAnswers / totalQuestions) * 100)
            : 0,
      ),
    ),
  );
  const rawScore = Number(activity?.score);
  const score = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(10, rawScore))
    : totalQuestions > 0
      ? Number((accuracy / 10).toFixed(1))
      : 0;
  const explicitStudyMinutes = Number(activity?.studyMinutes);
  let studyMinutes = Number.isFinite(explicitStudyMinutes)
    ? Math.max(0, Math.floor(explicitStudyMinutes))
    : 0;

  if (
    studyMinutes <= 0 &&
    startedAt &&
    completedAt
  ) {
    const startedDate = new Date(startedAt);
    const completedDate = new Date(completedAt);

    if (!Number.isNaN(startedDate.getTime()) && !Number.isNaN(completedDate.getTime())) {
      const diffMs = completedDate.getTime() - startedDate.getTime();
      if (diffMs > 0) {
        studyMinutes = Math.max(0, Math.floor(diffMs / 60000));
      }
    }
  }

  return {
    startedAt,
    completedAt,
    sourceType,
    sourceId,
    idempotencyKey,
    topicId,
    quizId,
    totalQuestions,
    correctAnswers,
    wrongAnswers,
    accuracy,
    score,
    studyMinutes,
  };
}

function calculateAverageScore(activityLogs = []) {
  const scoredLogs = (Array.isArray(activityLogs) ? activityLogs : [])
    .map((entry) => {
      const score = Number(entry?.score);
      const totalQuestions = Math.max(0, Number(entry?.totalQuestions) || 0);
      const weight = totalQuestions > 0 ? totalQuestions : 1;

      if (!Number.isFinite(score)) {
        return null;
      }

      return {
        score: Math.max(0, Math.min(10, score)),
        weight,
      };
    })
    .filter(Boolean);

  if (scoredLogs.length === 0) {
    return 0;
  }

  const totalWeightedScore = scoredLogs.reduce(
    (sum, entry) => sum + entry.score * entry.weight,
    0,
  );
  const totalWeight = scoredLogs.reduce((sum, entry) => sum + entry.weight, 0);

  return totalWeight > 0 ? Number((totalWeightedScore / totalWeight).toFixed(1)) : 0;
}

async function recordLearningActivity(userId, activity = {}) {
  const normalizedUserId = String(userId || "").trim();
  const normalizedActivity = normalizeLearningActivityInput(activity);

  if (!normalizedUserId) {
    throw new ApiError(400, "userId is required");
  }

  const userRef = db.collection("users").doc(normalizedUserId);
  const result = await db.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);

    if (!userSnapshot.exists) {
      throw new ApiError(404, "User document not found");
    }

    const currentUser = userSnapshot.data() || {};
    const currentStats = currentUser.stats || {};
    const currentLogs = Array.isArray(currentUser.activityLogs) ? currentUser.activityLogs : [];
    const currentIdempotencyKey = normalizedActivity.idempotencyKey
      || (normalizedActivity.sourceType && normalizedActivity.sourceId
        ? `${normalizedActivity.sourceType}:${normalizedActivity.sourceId}`
        : "");

    const existingLog = currentLogs.find((entry) => {
      if (!entry || typeof entry !== "object") {
        return false;
      }

      const entryKey = String(entry.idempotencyKey || entry.id || "").trim();
      if (currentIdempotencyKey && entryKey && entryKey === currentIdempotencyKey) {
        return true;
      }

      if (!normalizedActivity.sourceType || !normalizedActivity.sourceId) {
        return false;
      }

      return (
        String(entry.sourceType || "").trim() === normalizedActivity.sourceType &&
        String(entry.sourceId || "").trim() === normalizedActivity.sourceId
      );
    });

    if (existingLog) {
      return {
        alreadyRecorded: true,
        user: {
          id: userSnapshot.id,
          ...currentUser,
        },
        activityLog: existingLog,
      };
    }

    const completedAt = normalizedActivity.completedAt || new Date().toISOString();
    const activityKey =
      currentIdempotencyKey ||
      `${normalizedActivity.sourceType || "learning"}:${normalizedActivity.sourceId || normalizedUserId}:${completedAt}`;
    const nextActivityLog = {
      id: activityKey,
      idempotencyKey: activityKey,
      sourceType: normalizedActivity.sourceType,
      sourceId: normalizedActivity.sourceId,
      topicId: normalizedActivity.topicId,
      quizId: normalizedActivity.quizId,
      startedAt: normalizedActivity.startedAt,
      completedAt,
      score: normalizedActivity.score,
      accuracy: normalizedActivity.accuracy,
      totalQuestions: normalizedActivity.totalQuestions,
      correctAnswers: normalizedActivity.correctAnswers,
      wrongAnswers: normalizedActivity.wrongAnswers,
      studyMinutes: normalizedActivity.studyMinutes,
      createdAt: completedAt,
      updatedAt: completedAt,
    };
    const nextActivityLogs = [...currentLogs, nextActivityLog];

    const nextStats = {
      ...currentStats,
      studyMinutes:
        Math.max(0, Math.floor(Number(currentStats.studyMinutes) || 0)) +
        Math.max(0, Math.floor(Number(normalizedActivity.studyMinutes) || 0)),
      lastStudyDate: completedAt,
      averageScore: calculateAverageScore(nextActivityLogs),
    };

    transaction.set(
      userRef,
      {
        stats: nextStats,
        activityLogs: nextActivityLogs,
        updatedAt: completedAt,
      },
      { merge: true },
    );

    return {
      alreadyRecorded: false,
      activityLog: nextActivityLog,
      user: {
        id: userSnapshot.id,
        ...currentUser,
        stats: nextStats,
        activityLogs: nextActivityLogs,
        updatedAt: completedAt,
      },
    };
  });

  return result;
}

async function updateUserStreak(userId) {
  const normalizedUserId = String(userId || "").trim();

  if (!normalizedUserId) {
    throw new ApiError(400, "userId is required");
  }

  const user = await findUserById(normalizedUserId);

  if (!user) {
    throw new ApiError(404, "User document not found");
  }

  const update = updateStreak(user, new Date());
  const nextStats = {
    ...(user.stats || {}),
    streak: update.streak,
    lastStudyDate: update.lastStudyDate,
  };

  const updatedUser = await updateUserById(normalizedUserId, {
    stats: nextStats,
  });

  logProgress("[STREAK] Updated", {
    userId: normalizedUserId,
    streak: nextStats.streak,
  });

  return updatedUser;
}

module.exports = {
  awardExp,
  calculateLevel,
  recordLearningActivity,
  updateStreak,
  updateUserStreak,
};
