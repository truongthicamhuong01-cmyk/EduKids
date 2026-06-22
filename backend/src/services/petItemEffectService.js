const { applyPetMutation } = require("./petDecayService");

function applyItemEffectsToPet(petState = {}, itemConfig = {}, configs = {}, now = new Date()) {
  const effects = itemConfig.effects && typeof itemConfig.effects === "object" ? itemConfig.effects : {};
  const mutation = applyPetMutation(
    petState,
    configs,
    {
      hunger: effects.hungerDelta,
      happiness: effects.happinessDelta,
      energy: effects.energyDelta,
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
