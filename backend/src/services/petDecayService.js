const {
  calculateEvolutionStage,
  calculateLevelState,
  calculateMood,
  clampStats,
  toNumber,
} = require("./petMathService");

const DEFAULT_STAT_VALUE = 100;
const DEFAULT_SLEEP_THRESHOLD = 15;
const AUTO_WAKE_THRESHOLD = 70;
const DECAY_PER_HOUR = {
  hunger: 1,
  energy: 1,
  happiness: 0.25,
  health: 0.5,
  sleepingEnergyRecovery: 3,
};

function normalizeText(value) {
  return String(value || "").trim();
}

function cloneState(state = {}) {
  return JSON.parse(JSON.stringify(state || {}));
}

function hasOwn(source, key) {
  return Boolean(source && Object.prototype.hasOwnProperty.call(source, key));
}

function getPetBalance(configs = {}) {
  return configs.petBalance || {};
}

function getLevelConfig(configs = {}) {
  return configs.levelConfig || {};
}

function getEvolutionConfig(configs = {}) {
  return configs.evolutionConfig || {};
}

function getStatLimits(petBalance = {}) {
  const statLimits = petBalance.statLimits || {};

  return {
    minValue: toNumber(statLimits.minValue, 0),
    maxValue: toNumber(statLimits.maxValue, 100),
  };
}

function getDefaultStats(petBalance = {}, { useConfigInitialState = false } = {}) {
  const initialState = useConfigInitialState && petBalance.initialState && typeof petBalance.initialState === "object"
    ? petBalance.initialState
    : {};

  return {
    hunger: hasOwn(initialState, "hunger") ? toNumber(initialState.hunger, DEFAULT_STAT_VALUE) : DEFAULT_STAT_VALUE,
    energy: hasOwn(initialState, "energy") ? toNumber(initialState.energy, DEFAULT_STAT_VALUE) : DEFAULT_STAT_VALUE,
    happiness: hasOwn(initialState, "happiness") ? toNumber(initialState.happiness, DEFAULT_STAT_VALUE) : DEFAULT_STAT_VALUE,
    health: hasOwn(initialState, "health") ? toNumber(initialState.health, DEFAULT_STAT_VALUE) : DEFAULT_STAT_VALUE,
  };
}

function getInitialLevel(petBalance = {}, options = {}) {
  if (options.useConfigInitialState && petBalance.initialState) {
    return Math.max(1, Math.floor(toNumber(petBalance.initialState.level, 1)));
  }

  return 1;
}

function getInitialExp(petBalance = {}, options = {}) {
  if (options.useConfigInitialState && petBalance.initialState) {
    return Math.max(0, Math.floor(toNumber(petBalance.initialState.exp, 0)));
  }

  return 0;
}

function resolveSleepingState(state = {}) {
  const energy = toNumber(state.energy, DEFAULT_STAT_VALUE);
  const wasSleeping = Boolean(state.isSleeping);

  if (energy >= AUTO_WAKE_THRESHOLD) {
    return false;
  }

  if (energy <= DEFAULT_SLEEP_THRESHOLD) {
    return true;
  }

  return wasSleeping;
}

function normalizePetTypeId(source = {}) {
  return normalizeText(source.petTypeId || source.petType || "");
}

function resolvePetName(source = {}) {
  return normalizeText(source.petName || source.name || "");
}

function resolveBaseTimestamps(source = {}, now = new Date()) {
  const currentTime = now instanceof Date ? now : new Date(now);
  const createdAt = normalizeText(source.createdAt) || currentTime.toISOString();
  const updatedAt = currentTime.toISOString();
  const lastUpdateAt =
    normalizeText(source.lastUpdateAt || source.lastUpdate || source.updatedAt) || createdAt;

  return {
    createdAt,
    updatedAt,
    lastUpdateAt,
  };
}

function normalizePetShape(rawPetState = {}, configs = {}, now = new Date(), options = {}) {
  const petBalance = getPetBalance(configs);
  const levelConfig = getLevelConfig(configs);
  const evolutionConfig = getEvolutionConfig(configs);
  const statLimits = getStatLimits(petBalance);
  const source = cloneState(rawPetState);
  const defaultStats = getDefaultStats(petBalance, options);
  const levelState = calculateLevelState(toNumber(source.exp, getInitialExp(petBalance, options)), levelConfig);
  const petTypeId = normalizePetTypeId(source);
  const baseTimestamps = resolveBaseTimestamps(source, now);
  const nextState = {
    ...source,
    petTypeId,
    petType: petTypeId,
    petName: resolvePetName(source),
    level: Math.max(1, Math.floor(toNumber(source.level, getInitialLevel(petBalance, options)))),
    exp: Math.max(0, Math.floor(toNumber(source.exp, getInitialExp(petBalance, options)))),
    hunger: hasOwn(source, "hunger") ? source.hunger : defaultStats.hunger,
    energy: hasOwn(source, "energy") ? source.energy : defaultStats.energy,
    happiness: hasOwn(source, "happiness") ? source.happiness : defaultStats.happiness,
    health: hasOwn(source, "health") ? source.health : defaultStats.health,
    status: normalizeText(source.status) || "active",
    isSleeping: resolveSleepingState(source),
    ...baseTimestamps,
  };

  const clampedStats = clampStats(nextState, statLimits);
  nextState.hunger = clampedStats.hunger;
  nextState.energy = clampedStats.energy;
  nextState.happiness = clampedStats.happiness;
  nextState.health = clampedStats.health;
  nextState.level = levelState.level;
  nextState.exp = levelState.exp;
  nextState.requiredExpToNextLevel = levelState.requiredExpToNextLevel;
  nextState.isMaxLevel = levelState.isMaxLevel;
  nextState.stage = calculateEvolutionStage(nextState.petTypeId, nextState.level, evolutionConfig, nextState);
  nextState.mood = calculateMood(nextState, petBalance);
  nextState.petBalanceVersion = normalizeText(source.petBalanceVersion) || normalizeText(petBalance.version) || "";
  nextState.version = Math.max(0, Math.floor(toNumber(source.version, 0)));
  nextState.lastSleepAt = normalizeText(source.lastSleepAt) || null;
  nextState.lastFeedAt = normalizeText(source.lastFeedAt) || null;
  nextState.lastPlayAt = normalizeText(source.lastPlayAt) || null;
  nextState.lastActionAt = normalizeText(source.lastActionAt) || null;
  nextState.lastLoginAt = normalizeText(source.lastLoginAt) || null;

  return nextState;
}

function shouldSleep(petState = {}) {
  return toNumber(petState.energy, DEFAULT_STAT_VALUE) <= DEFAULT_SLEEP_THRESHOLD;
}

function applyDecayStep(state, stepHours) {
  const nextState = { ...state };
  const sleeping = Boolean(nextState.isSleeping);
  const hungerDelta = -DECAY_PER_HOUR.hunger * stepHours;
  const happinessDelta = -DECAY_PER_HOUR.happiness * stepHours;
  const energyDelta = sleeping
    ? DECAY_PER_HOUR.sleepingEnergyRecovery * stepHours
    : -DECAY_PER_HOUR.energy * stepHours;

  nextState.hunger = toNumber(nextState.hunger, DEFAULT_STAT_VALUE) + hungerDelta;
  nextState.happiness = toNumber(nextState.happiness, DEFAULT_STAT_VALUE) + happinessDelta;
  nextState.energy = toNumber(nextState.energy, DEFAULT_STAT_VALUE) + energyDelta;

  const hungerLow = toNumber(nextState.hunger, DEFAULT_STAT_VALUE) < 20;
  const energyLow = toNumber(nextState.energy, DEFAULT_STAT_VALUE) < 20;
  if (hungerLow || energyLow) {
    nextState.health = toNumber(nextState.health, DEFAULT_STAT_VALUE) - (DECAY_PER_HOUR.health * stepHours);
  }

  nextState.isSleeping = resolveSleepingState(nextState);

  return nextState;
}

function applyPetDecay(rawPetState = {}, configs = {}, now = new Date()) {
  const petBalance = getPetBalance(configs);
  const levelConfig = getLevelConfig(configs);
  const evolutionConfig = getEvolutionConfig(configs);
  const currentTime = now instanceof Date ? now : new Date(now);
  const normalized = normalizePetShape(rawPetState, configs, currentTime, {
    useConfigInitialState: false,
  });
  const lastUpdateAt = new Date(normalized.lastUpdateAt || normalized.updatedAt || normalized.createdAt);
  const elapsedMs = Number.isNaN(lastUpdateAt.getTime()) ? 0 : Math.max(0, currentTime.getTime() - lastUpdateAt.getTime());
  const maxMinutes = Math.max(0, Math.floor(toNumber(petBalance.offline?.capMinutes, 0)));
  const maxElapsedMs = maxMinutes > 0 ? maxMinutes * 60000 : elapsedMs;
  const processedMs = Math.min(elapsedMs, maxElapsedMs);
  const elapsedHours = processedMs / 3600000;

  if (elapsedHours <= 0) {
    const settledState = {
      ...normalized,
      isSleeping: resolveSleepingState(normalized),
    };

    settledState.mood = calculateMood(settledState, petBalance);
    settledState.stage = calculateEvolutionStage(settledState.petTypeId, settledState.level, evolutionConfig, settledState);
    const didChange = JSON.stringify(settledState) !== JSON.stringify(normalized);
    return {
      state: settledState,
      elapsedHours: 0,
      applied: false,
      didChange,
    };
  }

  let nextState = { ...normalized };
  let remainingHours = elapsedHours;

  while (remainingHours > 0) {
    const stepHours = Math.min(1, remainingHours);
    nextState = applyDecayStep(nextState, stepHours);
    remainingHours -= stepHours;
  }

  nextState.hunger = clampStats(nextState, getStatLimits(petBalance)).hunger;
  nextState.happiness = clampStats(nextState, getStatLimits(petBalance)).happiness;
  nextState.energy = clampStats(nextState, getStatLimits(petBalance)).energy;
  nextState.health = clampStats(nextState, getStatLimits(petBalance)).health;
  nextState.health = Math.max(0, nextState.health);
  nextState.isSleeping = resolveSleepingState(nextState);
  nextState.mood = calculateMood(nextState, petBalance);
  nextState.stage = calculateEvolutionStage(nextState.petTypeId, nextState.level, evolutionConfig, nextState);
  nextState.updatedAt = currentTime.toISOString();
  nextState.lastUpdateAt = currentTime.toISOString();

  return {
    state: nextState,
    elapsedHours,
    applied: true,
    didChange: JSON.stringify(nextState) !== JSON.stringify(normalized),
  };
}

function applyPetMutation(rawPetState = {}, configs = {}, deltas = {}, now = new Date(), options = {}) {
  const petBalance = getPetBalance(configs);
  const levelConfig = getLevelConfig(configs);
  const evolutionConfig = getEvolutionConfig(configs);
  const currentTime = now instanceof Date ? now : new Date(now);
  const normalized = normalizePetShape(rawPetState, configs, currentTime, options);
  const statLimits = getStatLimits(petBalance);
  const nextState = {
    ...normalized,
    hunger: toNumber(normalized.hunger, DEFAULT_STAT_VALUE) + toNumber(deltas.hunger, 0),
    happiness: toNumber(normalized.happiness, DEFAULT_STAT_VALUE) + toNumber(deltas.happiness, 0),
    energy: toNumber(normalized.energy, DEFAULT_STAT_VALUE) + toNumber(deltas.energy, 0),
    health: toNumber(normalized.health, DEFAULT_STAT_VALUE) + toNumber(deltas.health, 0),
    exp: toNumber(normalized.exp, 0) + toNumber(deltas.exp, 0),
  };

  const clampedStats = clampStats(nextState, statLimits);
  nextState.hunger = clampedStats.hunger;
  nextState.happiness = clampedStats.happiness;
  nextState.energy = clampedStats.energy;
  nextState.health = clampedStats.health;
  nextState.level = calculateLevelState(nextState.exp, levelConfig).level;
  const levelState = calculateLevelState(nextState.exp, levelConfig);
  nextState.level = levelState.level;
  nextState.exp = levelState.exp;
  nextState.requiredExpToNextLevel = levelState.requiredExpToNextLevel;
  nextState.isMaxLevel = levelState.isMaxLevel;
  nextState.isSleeping = resolveSleepingState(nextState);
  nextState.stage = calculateEvolutionStage(nextState.petTypeId, nextState.level, evolutionConfig, nextState);
  nextState.mood = calculateMood(nextState, petBalance);
  nextState.updatedAt = currentTime.toISOString();
  nextState.lastUpdateAt = currentTime.toISOString();
  nextState.lastActionAt = currentTime.toISOString();
  nextState.version = Math.max(0, Math.floor(toNumber(normalized.version, 0))) + 1;

  if (deltas.feedAt) {
    nextState.lastFeedAt = currentTime.toISOString();
  }

  if (deltas.playAt) {
    nextState.lastPlayAt = currentTime.toISOString();
  }

  if (deltas.sleepAt) {
    nextState.lastSleepAt = currentTime.toISOString();
  }

  const shouldWake = toNumber(nextState.energy, DEFAULT_STAT_VALUE) >= AUTO_WAKE_THRESHOLD;
  if (shouldWake) {
    nextState.isSleeping = false;
  }

  if (!shouldWake && shouldSleep(nextState)) {
    nextState.isSleeping = true;
    nextState.lastSleepAt = nextState.lastSleepAt || currentTime.toISOString();
  }

  return {
    state: nextState,
    applied: true,
  };
}

function stripDerivedPetFields(petState = {}) {
  const nextState = cloneState(petState);
  delete nextState.mood;
  return nextState;
}

module.exports = {
  AUTO_WAKE_THRESHOLD,
  DEFAULT_SLEEP_THRESHOLD,
  DECAY_PER_HOUR,
  applyPetDecay,
  applyPetMutation,
  buildPetRuntimeState: normalizePetShape,
  getDefaultStats,
  normalizePetShape,
  resolveSleepingState,
  stripDerivedPetFields,
};
