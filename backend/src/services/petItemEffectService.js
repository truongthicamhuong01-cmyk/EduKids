const { applyPetMutation } = require("./petDecayService");
const { normalizeCategoryKey } = require("../repositories/inventoryRepository");

const FOOD_ENERGY_BONUS = 5;

function isFoodItem(itemConfig = {}) {
  return normalizeCategoryKey(itemConfig.category) === "foods";
}

function applyItemEffectsToPet(petState = {}, itemConfig = {}, configs = {}, now = new Date()) {
  const effects = itemConfig.effects && typeof itemConfig.effects === "object" ? itemConfig.effects : {};
  const mutation = applyPetMutation(
    petState,
    configs,
    {
      hunger: effects.hungerDelta,
      happiness: effects.happinessDelta,
      energy: isFoodItem(itemConfig) ? FOOD_ENERGY_BONUS : effects.energyDelta,
      health: effects.healthDelta,
      exp: effects.expDelta,
    },
    now,
  );

  return mutation.state;
}

module.exports = {
  applyItemEffectsToPet,
};
