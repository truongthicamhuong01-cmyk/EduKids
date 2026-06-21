const { calculateEvolutionStage, calculateLevelState, calculateMood, clampStats, toNumber } = require("./petMathService");

function applyItemEffectsToPet(petState = {}, itemConfig = {}, configs = {}, now = new Date()) {
  const petBalance = configs.petBalance || {};
  const levelConfig = configs.levelConfig || {};
  const evolutionConfig = configs.evolutionConfig || {};
  const limits = petBalance.statLimits || { minValue: 0, maxValue: 100 };
  const effects = itemConfig.effects && typeof itemConfig.effects === "object" ? itemConfig.effects : {};
  const nextState = {
    ...petState,
  };

  nextState.hunger = toNumber(nextState.hunger, 0) + toNumber(effects.hungerDelta, 0);
  nextState.happiness = toNumber(nextState.happiness, 0) + toNumber(effects.happinessDelta, 0);
  nextState.energy = toNumber(nextState.energy, 0) + toNumber(effects.energyDelta, 0);
  nextState.health = toNumber(nextState.health, 0) + toNumber(effects.healthDelta, 0);
  nextState.exp = toNumber(nextState.exp, 0) + toNumber(effects.expDelta, 0);
  nextState.lastActionAt = now.toISOString();
  nextState.lastUpdateAt = now.toISOString();
  nextState.updatedAt = now.toISOString();
  nextState.version = Math.max(0, Math.floor(toNumber(nextState.version, 0))) + 1;

  const clamped = clampStats(nextState, limits);
  nextState.hunger = clamped.hunger;
  nextState.happiness = clamped.happiness;
  nextState.energy = clamped.energy;
  nextState.health = clamped.health;

  const levelState = calculateLevelState(nextState.exp, levelConfig);
  nextState.level = levelState.level;
  nextState.exp = levelState.exp;
  nextState.requiredExpToNextLevel = levelState.requiredExpToNextLevel;
  nextState.isMaxLevel = levelState.isMaxLevel;
  nextState.stage = calculateEvolutionStage(nextState.petTypeId, nextState.level, evolutionConfig, nextState);
  nextState.mood = calculateMood(nextState, petBalance);

  return nextState;
}

module.exports = {
  applyItemEffectsToPet,
};
