/*
 * Chức năng: Áp dụng hiệu ứng của item lên Pet.
 * Dữ liệu đầu vào: petState, itemConfig, configs và thời điểm hiện tại.
 * Dữ liệu đầu ra: Trạng thái Pet sau khi dùng item.
 * File liên quan: src/services/petDecayService.js, src/repositories/inventoryRepository.js
 */
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
