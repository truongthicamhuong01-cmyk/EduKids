import { asElement, escapeHtml } from "../utils/dom.js";

export function renderStats(target, state = {}) {
  const root = asElement(target);

  if (!root) {
    return null;
  }

  const pet = state.pet || {};
  const wallet = state.wallet || {};
  const inventory = state.inventory || {};

  root.innerHTML = `
    <section class="pet-stats" data-pet-stats>
      <div><strong>Level</strong><span>${escapeHtml(pet.level ?? "--")}</span></div>
      <div><strong>EXP</strong><span>${escapeHtml(pet.exp ?? "--")}</span></div>
      <div><strong>Xu Edu</strong><span>${escapeHtml(wallet.eduCoin ?? "--")}</span></div>
      <div><strong>Kho</strong><span>${escapeHtml(inventory?.summary?.totalQuantity ?? 0)}</span></div>
    </section>
  `;

  return root;
}

