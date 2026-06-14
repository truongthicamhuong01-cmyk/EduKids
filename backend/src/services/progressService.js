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
  updateStreak,
  updateUserStreak,
};
