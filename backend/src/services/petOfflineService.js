const { calculateMood, clampStats, toNumber } = require("./petMathService");

function parseISODate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function cloneState(state = {}) {
  return JSON.parse(JSON.stringify(state || {}));
}

function applyOfflineDecay(petState = {}, petBalance = {}, now = new Date()) {
  const offlineConfig = petBalance.offline || {};
  const statLimits = petBalance.statLimits || {};
  const stepMinutes = Math.max(1, Math.floor(toNumber(offlineConfig.stepMinutes, 10)));
  const maxMinutes = Math.max(0, Math.floor(toNumber(offlineConfig.capMinutes, 1440)));
  const hungerDecayPerStep = Math.max(0, Math.floor(toNumber(offlineConfig.hungerDecayPerStep, 0)));
  const energyDecayPerStep = Math.max(0, Math.floor(toNumber(offlineConfig.energyDecayPerStep, 0)));
  const happinessDecayPerStep = Math.max(0, Math.floor(toNumber(offlineConfig.happinessDecayPerStep, 0)));
  const happinessDecayEverySteps = Math.max(
    1,
    Math.floor(toNumber(offlineConfig.happinessDecayEverySteps, 2)),
  );
  const healthConfig = offlineConfig.health || {};
  const lowThreshold = Math.max(0, Math.floor(toNumber(healthConfig.lowThreshold, 20)));
  const lowDurationMinutes = Math.max(0, Math.floor(toNumber(healthConfig.lowDurationMinutes, 360)));
  const healthStepMinutes = Math.max(1, Math.floor(toNumber(healthConfig.stepMinutes, 30)));
  const healthDecayRates = {
    1: Math.max(0, Math.floor(toNumber(healthConfig.oneLowDecayPerStep, 1))),
    2: Math.max(0, Math.floor(toNumber(healthConfig.twoLowDecayPerStep, 2))),
    3: Math.max(0, Math.floor(toNumber(healthConfig.threeLowDecayPerStep, 3))),
  };
  const lastUpdateAt = parseISODate(petState.lastUpdateAt || petState.lastUpdate || petState.updatedAt);
  const currentTime = now instanceof Date ? now : new Date(now);
  const elapsedMinutesRaw = lastUpdateAt
    ? Math.max(0, Math.floor((currentTime.getTime() - lastUpdateAt.getTime()) / 60000))
    : 0;
  const elapsedMinutes = Math.min(elapsedMinutesRaw, maxMinutes);
  let nextState = cloneState(petState);
  let processedMinutes = 0;
  let happinessStepCounter = 0;
  let lowMinutesCounter = 0;

  if (elapsedMinutes <= 0) {
    return {
      state: nextState,
      offlineMinutes: 0,
      applied: false,
      didChange: false,
    };
  }

  while (processedMinutes < elapsedMinutes) {
    const step = Math.min(stepMinutes, elapsedMinutes - processedMinutes);
    processedMinutes += step;

    nextState.hunger = (toNumber(nextState.hunger, 0) - hungerDecayPerStep);
    nextState.energy = (toNumber(nextState.energy, 0) - energyDecayPerStep);

    happinessStepCounter += 1;
    if (happinessDecayPerStep > 0 && happinessStepCounter % happinessDecayEverySteps === 0) {
      nextState.happiness = toNumber(nextState.happiness, 0) - happinessDecayPerStep;
    }

    nextState = Object.assign(nextState, clampStats(nextState, statLimits));

    const lowFlags = [
      nextState.hunger <= lowThreshold,
      nextState.energy <= lowThreshold,
      nextState.happiness <= lowThreshold,
    ].filter(Boolean).length;

    if (lowFlags > 0) {
      lowMinutesCounter += step;

      if (lowMinutesCounter >= lowDurationMinutes) {
        const healthDecayPerStep = healthDecayRates[Math.min(3, lowFlags)] || 0;

        if (healthDecayPerStep > 0 && processedMinutes % healthStepMinutes === 0) {
          nextState.health = toNumber(nextState.health, 0) - healthDecayPerStep;
        }
      }
    } else {
      lowMinutesCounter = 0;
    }

    nextState = Object.assign(nextState, clampStats(nextState, statLimits));
  }

  nextState.lastUpdateAt = currentTime.toISOString();
  nextState.updatedAt = currentTime.toISOString();
  nextState.mood = calculateMood(nextState, petBalance);

  return {
    state: nextState,
    offlineMinutes: elapsedMinutes,
    applied: true,
    didChange: JSON.stringify(nextState) !== JSON.stringify(petState),
  };
}

module.exports = {
  applyOfflineDecay,
};
