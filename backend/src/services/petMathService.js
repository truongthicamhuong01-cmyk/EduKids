/*
 * Chức năng: Tính toán điểm, cấp độ, cảm xúc và giai đoạn tiến hóa của Pet.
 * Dữ liệu đầu vào: exp, level, chỉ số hunger/happiness/energy/health và config.
 * Dữ liệu đầu ra: Level mới, mood, stage và mức exp còn lại.
 * File liên quan: src/services/petDecayService.js, src/services/petService.js
 */
const { PET_MOOD_PRIORITY } = require("../constants/petConstants");

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  const lower = toNumber(min, 0);
  const upper = toNumber(max, 100);
  return Math.max(lower, Math.min(upper, toNumber(value, lower)));
}

function clampStats(stats = {}, limits = {}) {
  const minValue = toNumber(limits.minValue, 0);
  const maxValue = toNumber(limits.maxValue, 100);

  return {
    hunger: clamp(stats.hunger, minValue, maxValue),
    happiness: clamp(stats.happiness, minValue, maxValue),
    energy: clamp(stats.energy, minValue, maxValue),
    health: clamp(stats.health, minValue, maxValue),
  };
}

function normalizeLevelConfig(levelConfig = {}) {
  return {
    curveType: String(levelConfig.curveType || "quadratic").toLowerCase(),
    baseExp: toNumber(levelConfig.baseExp, 0),
    linearStep: toNumber(levelConfig.linearStep, 0),
    quadraticFactor: toNumber(levelConfig.quadraticFactor, 0),
    levelCap: Math.max(1, Math.floor(toNumber(levelConfig.levelCap, 100))),
    expTable: levelConfig.expTable || levelConfig.expByLevel || null,
  };
}

function getExpRequirementForLevel(level, levelConfig = {}) {
  const normalized = normalizeLevelConfig(levelConfig);
  const currentLevel = Math.max(1, Math.floor(toNumber(level, 1)));

  if (currentLevel >= normalized.levelCap) {
    return null;
  }

  if (normalized.curveType === "table" && normalized.expTable) {
    const table = normalized.expTable;
    const tableValue =
      Array.isArray(table)
        ? table[currentLevel - 1]
        : table[String(currentLevel)] ?? table[currentLevel];

    if (tableValue !== undefined && tableValue !== null) {
      return Math.max(0, Math.floor(toNumber(tableValue, 0)));
    }
  }

  if (normalized.curveType === "linear") {
    return Math.max(
      0,
      Math.floor(normalized.baseExp + (currentLevel - 1) * normalized.linearStep),
    );
  }

  const offset = currentLevel - 1;
  return Math.max(
    0,
    Math.floor(
      normalized.baseExp +
        offset * normalized.linearStep +
        offset * offset * normalized.quadraticFactor,
    ),
  );
}

function calculateLevelState(exp, levelConfig = {}) {
  const normalized = normalizeLevelConfig(levelConfig);
  let remainingExp = Math.max(0, Math.floor(toNumber(exp, 0)));
  let level = 1;
  let requiredExp = getExpRequirementForLevel(level, normalized);

  while (requiredExp !== null && remainingExp >= requiredExp && level < normalized.levelCap) {
    remainingExp -= requiredExp;
    level += 1;
    requiredExp = getExpRequirementForLevel(level, normalized);
  }

  return {
    level,
    exp: remainingExp,
    requiredExpToNextLevel: requiredExp,
    isMaxLevel: level >= normalized.levelCap,
    levelCap: normalized.levelCap,
  };
}

function normalizeStageRules(evolutionConfig = {}, petType = "") {
  const byPetType = evolutionConfig.byPetType || {};
  const petSpecific = byPetType[String(petType || "").trim()];
  const sourceStages = Array.isArray(petSpecific?.stages)
    ? petSpecific.stages
    : Array.isArray(evolutionConfig.stages)
      ? evolutionConfig.stages
      : [];

  return sourceStages
    .map((stage) => ({
      id: String(stage.id || stage.stage || "").trim(),
      minLevel: Math.max(1, Math.floor(toNumber(stage.minLevel, 1))),
      minHealth: Math.max(0, Math.floor(toNumber(stage.minHealth, 0))),
      minHappiness: Math.max(0, Math.floor(toNumber(stage.minHappiness, 0))),
      minHunger: Math.max(0, Math.floor(toNumber(stage.minHunger, 0))),
      requiresAchievement: stage.requiresAchievement || "",
    }))
    .filter((stage) => stage.id)
    .sort((a, b) => a.minLevel - b.minLevel);
}

function calculateEvolutionStage(petType, level, evolutionConfig = {}, petState = {}) {
  const stages = normalizeStageRules(evolutionConfig, petType);
  const currentLevel = Math.max(1, Math.floor(toNumber(level, 1)));
  const currentHealth = toNumber(petState.health, 100);
  const currentHappiness = toNumber(petState.happiness, 100);
  const currentHunger = toNumber(petState.hunger, 100);

  let selectedStage = String(evolutionConfig.defaultStage || "").trim();

  for (const stage of stages) {
    const meetsLevel = currentLevel >= stage.minLevel;
    const meetsHealth = currentHealth >= stage.minHealth;
    const meetsHappiness = currentHappiness >= stage.minHappiness;
    const meetsHunger = currentHunger >= stage.minHunger;

    if (meetsLevel && meetsHealth && meetsHappiness && meetsHunger) {
      selectedStage = stage.id;
    }
  }

  return selectedStage || (stages[0] ? stages[0].id : "baby");
}

function calculateMood(petState = {}, petBalance = {}) {
  const thresholds = petBalance.moodThresholds || {};
  const sickThreshold = toNumber(thresholds.sickThreshold, 20);
  const sleepyThreshold = toNumber(thresholds.sleepyThreshold, 20);
  const hungryThreshold = toNumber(thresholds.hungryThreshold, 20);
  const sadThreshold = toNumber(thresholds.sadThreshold, 30);
  const happyRule = thresholds.happy || {};
  const hunger = toNumber(petState.hunger, 0);
  const happiness = toNumber(petState.happiness, 0);
  const energy = toNumber(petState.energy, 0);
  const health = toNumber(petState.health, 0);

  if (health < sickThreshold) {
    return "sick";
  }

  if (energy < sleepyThreshold) {
    return "sleepy";
  }

  if (hunger < hungryThreshold) {
    return "hungry";
  }

  if (happiness < sadThreshold) {
    return "sad";
  }

  const happyHunger = toNumber(happyRule.hunger, 70);
  const happyHappiness = toNumber(happyRule.happiness, 70);
  const happyEnergy = toNumber(happyRule.energy, 70);
  const happyHealth = toNumber(happyRule.health, 70);

  if (
    hunger >= happyHunger &&
    happiness >= happyHappiness &&
    energy >= happyEnergy &&
    health >= happyHealth
  ) {
    return "happy";
  }

  return "normal";
}

module.exports = {
  calculateEvolutionStage,
  calculateLevelState,
  calculateMood,
  clamp,
  clampStats,
  getExpRequirementForLevel,
  normalizeLevelConfig,
  normalizeStageRules,
  toNumber,
};
