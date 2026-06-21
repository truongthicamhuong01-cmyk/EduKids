import { asElement, escapeHtml } from "../utils/dom.js";
import { resolveItemIconPath } from "../utils/assetResolver.js";

export function renderShop(target, state = {}) {
  const root = asElement(target);

  if (!root) {
    return null;
  }

  const items = Array.isArray(state.shop?.items)
    ? state.shop.items
    : Array.isArray(state.shop)
      ? state.shop
      : [];

  root.innerHTML = `
    <section class="pet-shop" data-pet-shop>
      ${items.length === 0 ? "<p>Shop chưa có vật phẩm.</p>" : ""}
      <ul class="pet-shop__list">
        ${items
          .map(
            (item) => `
              <li class="pet-shop__item">
                <img src="${resolveItemIconPath(item)}" alt="" aria-hidden="true" />
                <div>
                  <strong>${escapeHtml(item.name || item.itemId)}</strong>
                  <span>Giá: ${escapeHtml(item.price ?? 0)}</span>
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
