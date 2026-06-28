import { asElement, escapeHtml } from "../utils/dom.js";
import { resolveItemIconPath } from "../utils/assetResolver.js";

function normalizeShopItem(item = {}) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const itemId = String(
    item.itemId || item.id || item.key || item.code || "",
  ).trim();

  if (!itemId) {
    return null;
  }

  return {
    ...item,
    id: String(item.id || itemId).trim() || itemId,
    key: String(item.key || itemId).trim() || itemId,
    code: String(item.code || itemId).trim() || itemId,
    itemId,
    name: String(item.name || item.title || item.displayName || itemId).trim() || itemId,
    displayName: String(item.displayName || item.name || item.title || itemId).trim() || itemId,
  };
}

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
  const normalizedItems = items
    .map((item) => normalizeShopItem(item))
    .filter(Boolean);

  root.innerHTML = `
    <section class="pet-shop" data-pet-shop>
      ${normalizedItems.length === 0 ? "<p>Shop chưa có vật phẩm.</p>" : ""}
      <ul class="pet-shop__list">
        ${normalizedItems
          .map(
            (item) => `
              <li class="pet-shop__item" data-shop-item-id="${escapeHtml(item.itemId)}" data-shop-item-key="${escapeHtml(item.key)}" data-shop-item-code="${escapeHtml(item.code)}">
                <img src="${resolveItemIconPath(item)}" alt="" aria-hidden="true" />
                <div>
                  <strong>${escapeHtml(item.displayName || item.name || item.itemId)}</strong>
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
