import { asElement, escapeHtml } from "../utils/dom.js";
import { resolvePetAssetPath } from "../utils/assetResolver.js";

export function renderPet(target, state = {}) {
  const root = asElement(target);

  if (!root) {
    return null;
  }

  const pet = state.pet || {};
  const assetPath = resolvePetAssetPath({
    petType: pet.petType || pet.petTypeId,
    stage: pet.stage,
    mood: pet.mood,
    isSleeping: pet.isSleeping,
  });

  root.innerHTML = `
    <section class="pet-shell" data-pet-root>
      <div class="pet-shell__visual">
        <img class="pet-shell__image" src="${assetPath}" alt="${escapeHtml(pet.petName || "Pet")}" />
      </div>
      <div class="pet-shell__copy">
        <h3>${escapeHtml(pet.petName || "Pet")}</h3>
        <p>Cấp ${escapeHtml(pet.level ?? "--")} | ${escapeHtml(pet.mood || "normal")} | ${escapeHtml(pet.stage || "baby")}</p>
      </div>
    </section>
  `;

  return root;
}
