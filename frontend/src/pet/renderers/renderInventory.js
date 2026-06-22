import { asElement, escapeHtml } from "../utils/dom.js";
import { resolveItemIconPath } from "../utils/assetResolver.js";

export function renderInventory(target, state = {}) {
  const root = asElement(target);

  if (!root) {
    return null;
  }

  const categories = state.inventory?.categories || {};
  const items = Object.entries(categories).flatMap(([categoryKey, categoryItems]) =>
    Object.values(categoryItems || {}).map((item) => ({
      ...item,
      category: categoryKey,
    })),
  );

  root.innerHTML = `
    <section class="pet-inventory" data-pet-inventory>
      ${items.length === 0 ? "<p>Kho vật phẩm trống.</p>" : ""}
      <ul class="pet-inventory__list">
        ${items
          .map(
            (item) => `
              <li class="pet-inventory__item">
                <img src="${resolveItemIconPath(item)}" alt="" aria-hidden="true" />
                <div>
                  <strong>${escapeHtml(item.itemId)}</strong>
                  <span>${escapeHtml(item.quantity ?? 0)} x</span>
                  ${Number(item.maxDurability) > 0 ? `<span>Độ bền: ${escapeHtml(item.durability ?? item.maxDurability)} / ${escapeHtml(item.maxDurability)}</span>` : ""}
                </div>
              </li>
            `,
          )
          .join("")}
      </ul>
    </section>
  `;

  return root;
}
