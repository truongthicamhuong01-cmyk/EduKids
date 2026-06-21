const ApiError = require("../utils/apiError");
const { PET_ERROR_CODES } = require("../constants/petConstants");
const { getGameConfigBundle, readConfigDoc } = require("../repositories/gameConfigRepository");
const { getUserById, updateUserById } = require("../repositories/userRepository");
const { getRewardLedger, saveRewardLedger } = require("../repositories/rewardRepository");
const { getPetState, savePetState, runTransaction } = require("../repositories/petRepository");
const {
  calculateEvolutionStage,
  calculateLevelState,
  calculateMood,
  clampStats,
  toNumber,
} = require("./petMathService");

function normalizeText(value) {
  return String(value || "").trim();
}

function ensureStudent(user) {
  if (!user) {
    throw new ApiError(401, "Thiếu xác thực", PET_ERROR_CODES.UNAUTHORIZED);
  }

  if (String(user.role || "").toLowerCase() !== "student") {
    throw new ApiError(403, "Chỉ học sinh mới được nhận reward", PET_ERROR_CODES.FORBIDDEN);
  }
}

function getRewardRule(rewardConfig, ruleName) {
  const rules = rewardConfig && typeof rewardConfig.rules === "object" ? rewardConfig.rules : {};
  return rules[ruleName] || null;
}

function normalizeRewardRule(rule = {}) {
  if (!rule || typeof rule !== "object") {
    return null;
  }

  return {
    title: String(rule.title || rule.name || "").trim(),
    icon: String(rule.icon || "").trim(),
    coin: Math.max(
      0,
      Math.floor(
        toNumber(rule.coin ?? rule.xu ?? rule.amount ?? rule.reward?.xu ?? 0, 0),
      ),
    ),
    petExp: Math.max(0, Math.floor(toNumber(rule.petExp ?? rule.exp ?? rule.reward?.exp ?? 0, 0))),
    petHappiness: Math.max(
      0,
      Math.floor(toNumber(rule.petHappiness ?? rule.happiness ?? 0, 0)),
    ),
    petHealth: Math.max(0, Math.floor(toNumber(rule.petHealth ?? 0, 0))),
    petEnergy: Math.max(0, Math.floor(toNumber(rule.petEnergy ?? 0, 0))),
    petHunger: Math.max(0, Math.floor(toNumber(rule.petHunger ?? 0, 0))),
    badges: Array.isArray(rule.badges)
      ? [...new Set(rule.badges.map((item) => String(item || "").trim()).filter(Boolean))]
      : Array.isArray(rule.reward?.badges)
        ? [...new Set(rule.reward.badges.map((item) => String(item || "").trim()).filter(Boolean))]
        : [],
  };
}

function getLearningStreakRule(rewardConfig, streakCount = 0) {
  const streakRules = Array.isArray(rewardConfig?.rules?.learningStreak?.tiers)
    ? rewardConfig.rules.learningStreak.tiers
    : [];
  const normalizedStreak = Math.max(0, Math.floor(toNumber(streakCount, 0)));

  const matched = streakRules
    .map((item) => ({
      minDays: Math.max(0, Math.floor(toNumber(item.minDays, 0))),
      ...item,
    }))
    .filter((item) => normalizedStreak >= item.minDays)
    .sort((left, right) => right.minDays - left.minDays)[0];

  return matched || null;
}

function buildLedgerKey(sourceType, sourceId, ruleKey, idempotencyKey = "") {
  return normalizeText(idempotencyKey) || `${normalizeText(sourceType)}:${normalizeText(sourceId)}:${normalizeText(ruleKey)}`;
}

function buildRewardResponse({ reward, user, petState, requestId, sourceType, sourceId, ruleKey }) {
  return {
    statusCode: 200,
    message: "Nhận thưởng thành công",
    data: {
      reward,
      wallet: {
        eduCoin: Math.max(0, Number(user?.stats?.eduCoin || 0)),
      },
      pet: petState
        ? {
            petType: petState.petTypeId,
            level: petState.level,
            exp: petState.exp,
            hunger: petState.hunger,
            happiness: petState.happiness,
            energy: petState.energy,
            health: petState.health,
            mood: petState.mood,
            stage: petState.stage,
            version: petState.version,
          }
        : null,
    },
    popupEvents: [
      {
        type: "REWARD_GRANTED",
        title: "Nhận thưởng",
        message: reward.title || "Bạn vừa nhận được phần thưởng.",
        icon: reward.icon || "reward",
        priority: "normal",
        duration: 2200,
      },
    ],
    animationEvents: [],
    meta: {
      requestId,
      sourceType,
      sourceId,
      ruleKey,
    },
  };
}

function buildPetRewardState(petState, rewardRule, configs) {
  if (!petState) {
    return null;
  }

  const petBalance = configs.petBalance || {};
  const levelConfig = configs.levelConfig || {};
  const evolutionConfig = configs.evolutionConfig || {};
  const limits = petBalance.statLimits || { minValue: 0, maxValue: 100 };
  const nextPetState = {
    ...petState,
  };

  nextPetState.exp = toNumber(nextPetState.exp, 0) + Math.max(0, Math.floor(toNumber(rewardRule.petExp, 0)));
  nextPetState.happiness = toNumber(nextPetState.happiness, 0) + Math.max(0, Math.floor(toNumber(rewardRule.petHappiness, 0)));
  nextPetState.health = toNumber(nextPetState.health, 0) + Math.max(0, Math.floor(toNumber(rewardRule.petHealth, 0)));
  nextPetState.energy = toNumber(nextPetState.energy, 0) + Math.max(0, Math.floor(toNumber(rewardRule.petEnergy, 0)));
  nextPetState.hunger = toNumber(nextPetState.hunger, 0) + Math.max(0, Math.floor(toNumber(rewardRule.petHunger, 0)));
  nextPetState.updatedAt = new Date().toISOString();
  nextPetState.lastUpdateAt = new Date().toISOString();
  nextPetState.version = Math.max(0, Number(nextPetState.version) || 0) + 1;

  const clamped = clampStats(nextPetState, limits);
  nextPetState.hunger = clamped.hunger;
  nextPetState.happiness = clamped.happiness;
  nextPetState.energy = clamped.energy;
  nextPetState.health = clamped.health;

  const levelState = calculateLevelState(nextPetState.exp, levelConfig);
  nextPetState.level = levelState.level;
  nextPetState.exp = levelState.exp;
  nextPetState.requiredExpToNextLevel = levelState.requiredExpToNextLevel;
  nextPetState.isMaxLevel = levelState.isMaxLevel;
  nextPetState.stage = calculateEvolutionStage(nextPetState.petTypeId, nextPetState.level, evolutionConfig, nextPetState);
  nextPetState.mood = calculateMood(nextPetState, petBalance);

  return nextPetState;
}

async function grantReward({
  userId,
  sourceType,
  sourceId,
  ruleKey,
  rewardRule,
  requestId = "",
  idempotencyKey = "",
  title = "",
}) {
  const normalizedUserId = normalizeText(userId);
  const normalizedSourceType = normalizeText(sourceType);
  const normalizedSourceId = normalizeText(sourceId);
  const normalizedRuleKey = normalizeText(ruleKey);

  if (!normalizedUserId) {
    throw new ApiError(400, "userId is required", PET_ERROR_CODES.VALIDATION_ERROR);
  }

  if (!normalizedSourceType || !normalizedSourceId || !normalizedRuleKey) {
    throw new ApiError(400, "Thiếu thông tin reward", PET_ERROR_CODES.VALIDATION_ERROR);
  }

  const rewardConfig = await readConfigDoc("rewardConfig");
  if (!rewardConfig) {
    throw new ApiError(404, "Reward Config không tồn tại", PET_ERROR_CODES.GAME_CONFIG_NOT_FOUND, {
      missingDocs: ["rewardConfig"],
    });
  }

  const rule = normalizeRewardRule(rewardRule || getRewardRule(rewardConfig, normalizedRuleKey));
  if (!rule) {
    throw new ApiError(422, "Reward rule không tồn tại", PET_ERROR_CODES.INVALID_GAME_CONFIG, {
      ruleKey: normalizedRuleKey,
    });
  }

  const ledgerKey = buildLedgerKey(normalizedSourceType, normalizedSourceId, normalizedRuleKey, idempotencyKey);
  const result = await runTransaction(async (transaction) => {
    const existing = await getRewardLedger(ledgerKey, transaction);
    if (existing?.response) {
      return existing.response;
    }

    const user = await getUserById(normalizedUserId, transaction);
    ensureStudent(user);

    const configs = await getGameConfigBundle(transaction);
    const currentCoin = Math.max(0, Number(user?.stats?.eduCoin || 0));
    const coinDelta = Math.max(0, Math.floor(toNumber(rule.coin, 0)));
    const nextCoin = currentCoin + coinDelta;
    const nextStats = {
      ...(user.stats || {}),
      eduCoin: nextCoin,
      totalEduCoinEarned: Math.max(0, Number(user?.stats?.totalEduCoinEarned || 0)) + coinDelta,
      lastRewardAt: new Date().toISOString(),
    };

    let nextPetState = null;
    const petState = await getPetState(normalizedUserId, transaction).catch(() => null);
    if (petState) {
      nextPetState = buildPetRewardState(petState, rule, configs);
      await savePetState(normalizedUserId, nextPetState, transaction);
    }

    await updateUserById(
      normalizedUserId,
      {
        stats: nextStats,
        updatedAt: new Date().toISOString(),
      },
      transaction,
    );

    const reward = {
      key: normalizedRuleKey,
      title: title || rule.title || normalizedRuleKey,
      coin: coinDelta,
      petExp: Math.max(0, Math.floor(toNumber(rule.petExp, 0))),
      petHappiness: Math.max(0, Math.floor(toNumber(rule.petHappiness, 0))),
      petHealth: Math.max(0, Math.floor(toNumber(rule.petHealth, 0))),
      petEnergy: Math.max(0, Math.floor(toNumber(rule.petEnergy, 0))),
      petHunger: Math.max(0, Math.floor(toNumber(rule.petHunger, 0))),
      icon: rule.icon || "reward",
      badges: rule.badges || [],
      sourceType: normalizedSourceType,
      sourceId: normalizedSourceId,
    };

    const response = buildRewardResponse({
      reward,
      user: { ...user, stats: nextStats },
      petState: nextPetState,
      requestId,
      sourceType: normalizedSourceType,
      sourceId: normalizedSourceId,
      ruleKey: normalizedRuleKey,
    });

    await saveRewardLedger(
      ledgerKey,
      {
        userId: normalizedUserId,
        sourceType: normalizedSourceType,
        sourceId: normalizedSourceId,
        ruleKey: normalizedRuleKey,
        idempotencyKey: normalizeText(idempotencyKey),
        reward,
        response,
        createdAt: new Date().toISOString(),
      },
      transaction,
    );

    console.info("[PET][INFO] REWARD_GRANTED", {
      requestId,
      sourceType: normalizedSourceType,
      sourceId: normalizedSourceId,
      ruleKey: normalizedRuleKey,
      coinDelta,
    });
    if (coinDelta > 0) {
      console.info("[PET][INFO] COIN_REWARD", {
        requestId,
        amount: coinDelta,
      });
    }

    return response;
  });

  return result;
}

async function rewardLessonComplete({ userId, sourceId, requestId = "", idempotencyKey = "" }) {
  return grantReward({
    userId,
    sourceType: "lesson",
    sourceId,
    ruleKey: "lessonComplete",
    requestId,
    idempotencyKey,
    title: "Hoàn thành bài học",
  });
}

async function rewardLearningPath({ userId, sourceId, requestId = "", idempotencyKey = "", rewardOverride = null }) {
  return grantReward({
    userId,
    sourceType: "learningPath",
    sourceId,
    ruleKey: "learningPath",
    rewardRule: rewardOverride,
    requestId,
    idempotencyKey,
    title: "Hoàn thành Learning Path",
  });
}

async function rewardAssignment({ userId, sourceId, requestId = "", idempotencyKey = "" }) {
  return grantReward({
    userId,
    sourceType: "assignment",
    sourceId,
    ruleKey: "assignment",
    requestId,
    idempotencyKey,
    title: "Hoàn thành bài tập",
  });
}

async function rewardHighScore({ userId, sourceId, score = 0, requestId = "", idempotencyKey = "" }) {
  const rewardConfig = await readConfigDoc("rewardConfig");
  if (!rewardConfig) {
    throw new ApiError(404, "Reward Config không tồn tại", PET_ERROR_CODES.GAME_CONFIG_NOT_FOUND, {
      missingDocs: ["rewardConfig"],
    });
  }

  const rule = getRewardRule(rewardConfig, "highScore");
  if (!rule) {
    throw new ApiError(422, "Reward highScore không tồn tại", PET_ERROR_CODES.INVALID_GAME_CONFIG);
  }

  const minimumScore = Math.max(0, Math.floor(toNumber(rule.minScore, 9)));
  if (Math.floor(toNumber(score, 0)) < minimumScore) {
    return {
      statusCode: 200,
      message: "Không đủ điều kiện nhận thưởng điểm cao",
      data: {
        reward: null,
      },
      popupEvents: [],
      animationEvents: [],
      meta: {
        requestId,
        sourceId: normalizeText(sourceId),
        skipped: true,
      },
    };
  }

  return grantReward({
    userId,
    sourceType: "highScore",
    sourceId,
    ruleKey: "highScore",
    rewardRule: rule,
    requestId,
    idempotencyKey,
    title: "Điểm số rất cao",
  });
}

async function rewardLearningStreak({ userId, sourceId, streak = 0, requestId = "", idempotencyKey = "" }) {
  const rewardConfig = await readConfigDoc("rewardConfig");
  if (!rewardConfig) {
    throw new ApiError(404, "Reward Config không tồn tại", PET_ERROR_CODES.GAME_CONFIG_NOT_FOUND, {
      missingDocs: ["rewardConfig"],
    });
  }

  const rule = getLearningStreakRule(rewardConfig, streak);
  if (!rule) {
    return {
      statusCode: 200,
      message: "Chưa có thưởng cho chuỗi học này",
      data: {
        reward: null,
      },
      popupEvents: [],
      animationEvents: [],
      meta: {
        requestId,
        sourceId: normalizeText(sourceId),
        skipped: true,
      },
    };
  }

  return grantReward({
    userId,
    sourceType: "streak",
    sourceId,
    ruleKey: `streak:${rule.minDays}`,
    rewardRule: rule,
    requestId,
    idempotencyKey,
    title: rule.title || "Chuỗi học liên tục",
  });
}

async function rewardDailyLogin({ userId, sourceId, requestId = "", idempotencyKey = "" }) {
  return grantReward({
    userId,
    sourceType: "dailyLogin",
    sourceId,
    ruleKey: "dailyLogin",
    requestId,
    idempotencyKey,
    title: "Đăng nhập hằng ngày",
  });
}

module.exports = {
  grantReward,
  rewardAssignment,
  rewardDailyLogin,
  rewardHighScore,
  rewardLessonComplete,
  rewardLearningPath,
  rewardLearningStreak,
};
