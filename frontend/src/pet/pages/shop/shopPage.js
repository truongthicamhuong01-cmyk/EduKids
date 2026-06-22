import { escapeHtml } from "../../utils/dom.js";
import { mountIntoPetHost } from "../../utils/pageHost.js";
import {
  resolveBackgroundPath,
  resolveItemIconPath,
  resolvePetAssetPath,
} from "../../utils/assetResolver.js";

const SHOP_PAGE_ID = "edukids-pet-shop-page";

function iconShop() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4.8 8.3h14.4v8.5c0 1.2-1 2.2-2.2 2.2H7c-1.2 0-2.2-1-2.2-2.2V8.3Z" fill="currentColor" opacity="0.18"></path>
      <path d="M6.2 8.3c0-2.4 2.3-4.2 5.8-4.2s5.8 1.8 5.8 4.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
      <path d="M9.2 11.3h.01M14.8 11.3h.01" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"></path>
      <path d="M8.8 15.7h6.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
    </svg>
  `;
}

function iconCoin() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.5" fill="currentColor" opacity="0.22"></circle>
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2.2"></circle>
      <path d="M12 7.5v9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>
      <path d="M9.4 10.2c.3-1.1 1.2-1.8 2.6-1.8 1.4 0 2.4.8 2.4 2 0 1.2-.9 1.8-2.7 2.5-1.3.5-2.2 1-2.2 2.1 0 1.2 1 2 2.5 2 1.2 0 2.1-.4 2.8-1.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
    </svg>
  `;
}

function iconSparkle() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.8 13.8 8 19 9.8 13.8 11.6 12 16.8 10.2 11.6 5 9.8 10.2 8 12 2.8Z" fill="currentColor"></path>
    </svg>
  `;
}

function iconHeartSmall() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 20.4 4.8 13.1a4.8 4.8 0 0 1 0-6.8 4.8 4.8 0 0 1 6.8 0l.4.4.4-.4a4.8 4.8 0 0 1 6.8 0 4.8 4.8 0 0 1 0 6.8L12 20.4Z" fill="currentColor"></path>
    </svg>
  `;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeCategoryKey(category = "") {
  const normalized = normalizeText(category);

  if (!normalized) {
    return "";
  }

  if (normalized === "foods" || normalized === "food") {
    return "foods";
  }

  if (normalized === "toys" || normalized === "toy") {
    return "toys";
  }

  if (normalized === "medicine") {
    return "medicine";
  }

  if (normalized === "decoration") {
    return "decoration";
  }

  if (normalized === "special") {
    return "special";
  }

  return normalized;
}

function normalizeCategoryLabel(category = "") {
  const normalized = normalizeCategoryKey(category);
  const labels = {
    foods: "Thức ăn",
    toys: "Đồ chơi",
    medicine: "Thuốc",
    decoration: "Trang trí",
    special: "Đặc biệt",
  };

  return labels[normalized] || String(category || "").trim();
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(number)));
}

function normalizeError(error) {
  if (!error || typeof error !== "object") {
    return {
      message: "Mạng không ổn định.",
      errorCode: "",
    };
  }

  const payload = error.payload || {};
  return {
    message: String(payload.message || error.message || "Mạng không ổn định."),
    errorCode: String(payload.errorCode || error.errorCode || ""),
  };
}

function buildFxId() {
  return `shop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function createDefaultState() {
  return {
    mounted: false,
    visible: false,
    initialized: false,
    openToken: 0,
    loadPromise: null,
    loadingCatalog: false,
    buyingItemId: "",
    items: [],
    categories: [],
    selectedCategory: "",
    userLevel: 1,
    bubbleMessage: "",
    bubbleTimer: null,
    toastMessage: "",
    toastTimer: null,
    errorMessage: "",
    emptyTitle: "Shop chÆ°a cĂ³ váº­t pháº©m.",
    emptyMessage: "HĂ£y quay láº¡i sau nhĂ©.",
    lastCoinValue: null,
  };
}

function ensureShopRoot() {
  let root = document.getElementById(SHOP_PAGE_ID);

  if (!root) {
    root = document.createElement("section");
    root.id = SHOP_PAGE_ID;
    root.className = "pet-shop-screen";
    root.hidden = true;
    root.innerHTML = `
      <div class="pet-shop-screen__background" aria-hidden="true"></div>
      <div class="pet-shop-screen__veil" aria-hidden="true"></div>
      <div class="pet-shop-screen__fx-layer" data-shop-fx-layer aria-hidden="true"></div>

      <div class="pet-shop-screen__shell">
        <header class="pet-shop-header">
          <div class="pet-shop-header__left">
            <button type="button" class="pet-shop-title pet-theme--glass" data-action="back" aria-label="Quay lại Home">
              <span class="pet-shop-title__icon" aria-hidden="true">${iconShop()}</span>
              <span class="pet-shop-title__copy">
                <strong>CỬA HÀNG</strong>
              </span>
            </button>
            <div class="pet-shop-subtitle pet-theme--glass">
              Dùng Xu Edu để mua các vật phẩm chăm sóc thú cưng của bạn nhé!
            </div>
          </div>

          <div class="pet-shop-coin pet-theme--glass" data-shop-coin>
            <span class="pet-shop-coin__icon" aria-hidden="true">${iconCoin()}</span>
            <strong data-shop-coin-value>0</strong>
          </div>
        </header>

        <section class="pet-shop-hero">
          <aside class="pet-shop-status pet-panel" aria-label="Chỉ số">
            <div class="pet-shop-status__list" data-shop-status-list></div>
          </aside>

          <section class="pet-shop-stage" aria-label="Pet">
            <div class="pet-shop-bubble pet-theme--glass" data-shop-bubble hidden role="status" aria-live="polite">
              <span class="pet-shop-bubble__icon" aria-hidden="true">${iconSparkle()}</span>
              <p data-shop-bubble-text></p>
            </div>

            <div class="pet-shop-stage__platform" aria-hidden="true"></div>
            <button type="button" class="pet-shop-pet" data-action="pet" aria-label="Thú cưng">
              <span class="pet-shop-pet__halo" aria-hidden="true"></span>
              <span class="pet-shop-pet__shadow" aria-hidden="true"></span>
              <img data-shop-pet-image src="" alt="Pet" loading="eager" decoding="async" />
            </button>
          </section>
        </section>

        <section class="pet-shop-categories" aria-label="Danh mục">
          <div class="pet-shop-categories__row" data-shop-category-row></div>
        </section>

        <section class="pet-shop-grid-wrap" aria-label="Vật phẩm">
          <div class="pet-shop-grid__empty" data-shop-empty hidden>
            <div class="pet-shop-empty__icon" aria-hidden="true">${iconShop()}</div>
            <strong>Shop chưa có vật phẩm.</strong>
            <p>Hãy quay lại sau nhé.</p>
          </div>

          <div class="pet-shop-grid" data-shop-grid></div>
          <div class="pet-shop-skeleton" data-shop-skeleton hidden aria-hidden="true">
            <div class="pet-shop-skeleton__card"></div>
            <div class="pet-shop-skeleton__card"></div>
            <div class="pet-shop-skeleton__card"></div>
            <div class="pet-shop-skeleton__card"></div>
            <div class="pet-shop-skeleton__card"></div>
          </div>
        </section>

        <div class="pet-shop-error pet-panel" data-shop-error hidden role="alert">
          <strong data-shop-error-title>Không thể tải Shop.</strong>
          <p data-shop-error-message>Vui lòng thử lại nhé.</p>
          <div class="pet-shop-error__actions">
            <button type="button" class="pet-btn pet-btn--secondary" data-action="retry">Thử lại</button>
          </div>
        </div>

        <div class="pet-shop-toast pet-theme--glass" data-shop-toast hidden role="status" aria-live="polite">
          <span class="pet-shop-toast__icon" aria-hidden="true">${iconSparkle()}</span>
          <p data-shop-toast-text></p>
        </div>
      </div>
    `;

    mountIntoPetHost(root);
  }

  return root;
}

function setBodyActive(isActive) {
  void isActive;
}

export function createShopPage({ store, shopApi } = {}) {
  const root = ensureShopRoot();
  const state = createDefaultState();

  function getRefs() {
    return {
      coinValue: root.querySelector("[data-shop-coin-value]"),
      petImage: root.querySelector("[data-shop-pet-image]"),
      bubble: root.querySelector("[data-shop-bubble]"),
      bubbleText: root.querySelector("[data-shop-bubble-text]"),
      toast: root.querySelector("[data-shop-toast]"),
      toastText: root.querySelector("[data-shop-toast-text]"),
      grid: root.querySelector("[data-shop-grid]"),
      categories: root.querySelector("[data-shop-category-row]"),
      empty: root.querySelector("[data-shop-empty]"),
      skeleton: root.querySelector("[data-shop-skeleton]"),
      error: root.querySelector("[data-shop-error]"),
      errorTitle: root.querySelector("[data-shop-error-title]"),
      errorMessage: root.querySelector("[data-shop-error-message]"),
      fxLayer: root.querySelector("[data-shop-fx-layer]"),
    };
  }

  function setLoadingCatalog(isLoading) {
    state.loadingCatalog = Boolean(isLoading);
    if (isLoading) {
      root.dataset.loadingCatalog = "true";
    } else {
      delete root.dataset.loadingCatalog;
    }

    const refs = getRefs();
    if (refs.skeleton) {
      refs.skeleton.hidden = !isLoading;
    }
    if (refs.grid) {
      refs.grid.classList.toggle("is-loading", Boolean(isLoading));
    }
  }

  function setBuyingItemId(itemId = "") {
    state.buyingItemId = String(itemId || "");
    if (state.buyingItemId) {
      root.dataset.buyingItemId = state.buyingItemId;
    } else {
      delete root.dataset.buyingItemId;
    }

    root.querySelectorAll("[data-shop-item-id]").forEach((card) => {
      if (!(card instanceof HTMLElement)) {
        return;
      }

      const currentItemId = card.dataset.shopItemId || "";
      const isCurrent = Boolean(state.buyingItemId) && currentItemId === state.buyingItemId;
      const shouldDisable = Boolean(state.buyingItemId) && !isCurrent;

      card.classList.toggle("is-loading", isCurrent);
      card.querySelectorAll("button").forEach((button) => {
        button.disabled = shouldDisable || isCurrent;
      });
    });
  }

  function hideError() {
    const refs = getRefs();
    if (refs.error) {
      refs.error.hidden = true;
    }
  }

  function setEmptyState(title, message) {
    state.emptyTitle = String(title || "Shop chÆ°a cĂ³ váº­t pháº©m.");
    state.emptyMessage = String(message || "HĂ£y quay láº¡i sau nhĂ©.");

    const refs = getRefs();
    if (refs.empty) {
      const titleEl = refs.empty.querySelector("strong");
      const messageEl = refs.empty.querySelector("p");

      if (titleEl) {
        titleEl.textContent = state.emptyTitle;
      }

      if (messageEl) {
        messageEl.textContent = state.emptyMessage;
      }
    }
  }

  function showError(message) {
    const refs = getRefs();
    if (!refs.error) {
      return;
    }

    if (refs.errorTitle) {
      refs.errorTitle.textContent = "Không thể tải Shop.";
    }
    if (refs.errorMessage) {
      refs.errorMessage.textContent = String(message || "Vui lòng thử lại nhé.");
    }

    refs.error.hidden = false;
  }

  function clearBubble() {
    if (state.bubbleTimer) {
      window.clearTimeout(state.bubbleTimer);
      state.bubbleTimer = null;
    }

    state.bubbleMessage = "";
    const refs = getRefs();
    if (refs.bubble) {
      refs.bubble.hidden = true;
      refs.bubble.classList.remove("is-visible");
    }
  }

  function clearToast() {
    if (state.toastTimer) {
      window.clearTimeout(state.toastTimer);
      state.toastTimer = null;
    }

    state.toastMessage = "";
    const refs = getRefs();
    if (refs.toast) {
      refs.toast.hidden = true;
      refs.toast.classList.remove("is-visible");
    }
  }

  function showToast(message) {
    const normalized = String(message || "").trim();
    if (!normalized) {
      clearToast();
      return;
    }

    const refs = getRefs();
    if (!refs.toast || !refs.toastText) {
      return;
    }

    clearToast();
    state.toastMessage = normalized;
    refs.toastText.textContent = normalized;
    refs.toast.hidden = false;
    refs.toast.classList.remove("is-visible");
    void refs.toast.offsetWidth;
    refs.toast.classList.add("is-visible");

    state.toastTimer = window.setTimeout(() => {
      if (refs.toast) {
        refs.toast.classList.remove("is-visible");
        refs.toast.hidden = true;
      }
      state.toastMessage = "";
      state.toastTimer = null;
    }, 2600);
  }

  function animateNumber(element, nextValue) {
    if (!element) {
      return;
    }

    const numericNext = Number(nextValue) || 0;
    const previous = Number(element.dataset.currentValue || "0") || 0;
    const duration = 260;
    const startedAt = performance.now();

    function step(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = previous + (numericNext - previous) * eased;
      element.textContent = formatNumber(value);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        element.dataset.currentValue = String(numericNext);
      }
    }

    window.requestAnimationFrame(step);
  }

  function getInventoryOwnedQuantity(snapshot, item) {
    const categoryKey = normalizeCategoryKey(item?.category || "");
    const inventoryCategories = snapshot.inventory?.categories || {};
    const categoryItems = inventoryCategories[categoryKey] || {};
    const normalizedItemId = String(item?.itemId || "").trim();

    if (Array.isArray(categoryItems)) {
      const found = categoryItems.find((entry) => String(entry?.itemId || "").trim() === normalizedItemId);
      return Math.max(0, Number(found?.quantity ?? item.ownedQuantity ?? 0));
    }

    const owned = Number(categoryItems?.[normalizedItemId]?.quantity ?? item.ownedQuantity ?? 0);
    return Math.max(0, owned);
  }

  function getCurrentCoin(snapshot) {
    return Math.max(0, Number(snapshot.wallet?.eduCoin || 0));
  }

  function getItemReason(item, snapshot) {
    const currentCoin = getCurrentCoin(snapshot);
    const currentLevel = Math.max(
      1,
      Number(snapshot.shop?.raw?.userLevel || snapshot.shop?.userLevel || snapshot.pet?.level || state.userLevel || 1),
    );
    const unlockLevel = Math.max(1, Number(item.unlockLevel || 1));
    const ownedQuantity = getInventoryOwnedQuantity(snapshot, item);
    const maxStack = Math.max(1, Number(item.maxStack || 99));
    const price = Math.max(0, Number(item.price || 0));
    const canBuy = item.canBuy !== false && currentLevel >= unlockLevel && ownedQuantity < maxStack;

    if (!canBuy) {
      if (currentLevel < unlockLevel) {
        return {
          disabled: true,
          label: "Khóa",
          tone: "locked",
        };
      }

      if (ownedQuantity >= maxStack) {
        return {
          disabled: true,
          label: "Đã đủ",
          tone: "full",
        };
      }
    }

    if (currentCoin < price) {
      return {
        disabled: true,
        label: "Không đủ Xu",
        tone: "coin",
      };
    }

    return {
      disabled: false,
      label: "Mua",
      tone: "buy",
    };
  }

  function getSortedItems(snapshot = {}) {
    const items = Array.isArray(state.items) && state.items.length > 0
      ? state.items
      : Array.isArray(snapshot.shop?.items)
        ? snapshot.shop.items
        : [];

    return [...items]
      .filter(Boolean)
      .sort((left, right) => {
        const leftCategory = normalizeCategoryKey(left.category || "");
        const rightCategory = normalizeCategoryKey(right.category || "");
        const categoryOrder = state.categories;
        const leftIndex = categoryOrder.indexOf(leftCategory);
        const rightIndex = categoryOrder.indexOf(rightCategory);
        if (leftIndex !== rightIndex) {
          return leftIndex - rightIndex;
        }
        return Number(left.sortOrder || 0) - Number(right.sortOrder || 0);
      });
  }

  function renderStatus(snapshot = {}) {
    const refs = getRefs();
    if (!refs.statusList) {
      return;
    }

    const pet = snapshot.pet || {};
    const stats = [
      { key: "happiness", label: "Hạnh phúc", value: pet.happiness, icon: iconHeart(), tone: "warning" },
      { key: "energy", label: "Năng lượng", value: pet.energy, icon: iconBolt(), tone: "info" },
    ];

    refs.statusList.innerHTML = stats
      .map((stat) => {
        const value = Math.max(0, Math.min(100, Number(stat.value) || 0));
        return `
          <div class="pet-shop-stat pet-shop-stat--${escapeHtml(stat.key)}">
            <div class="pet-shop-stat__head">
              <span class="pet-shop-stat__icon" aria-hidden="true">${stat.icon}</span>
              <span class="pet-shop-stat__label">${escapeHtml(stat.label)}</span>
              <strong class="pet-shop-stat__value" data-shop-stat-value="${escapeHtml(stat.key)}">${formatNumber(value)}</strong>
            </div>
            <div class="pet-progress pet-shop-stat__bar pet-progress--${escapeHtml(stat.tone)}">
              <div
                class="pet-progress__fill pet-shop-stat__fill"
                data-shop-stat-fill="${escapeHtml(stat.key)}"
                style="width: ${value}%"
              ></div>
            </div>
          </div>
        `;
      })
      .join("");

    stats.forEach((stat) => {
      const value = Math.max(0, Math.min(100, Number(stat.value) || 0));
      const valueEl = refs.statusList.querySelector(`[data-shop-stat-value="${stat.key}"]`);
      const fillEl = refs.statusList.querySelector(`[data-shop-stat-fill="${stat.key}"]`);
      animateNumber(valueEl, value);
      if (fillEl) {
        fillEl.style.width = `${value}%`;
      }
    });
  }

  function renderPet(snapshot = {}) {
    const pet = snapshot.pet || null;
    const refs = getRefs();
    if (!refs.petImage) {
      return;
    }

    root.style.setProperty(
      "--pet-shop-scene",
      `url('${resolveBackgroundPath({ petType: pet?.petTypeId || pet?.petType || "horse" })}')`,
    );

    if (!pet) {
      return;
    }

    const petImage = resolvePetAssetPath({
      petType: pet.petTypeId || pet.petType,
      stage: pet.stage,
      mood: pet.mood,
      level: `level${pet.level || 1}`,
    });
    const nextSrc = new URL(petImage || "", window.location.href).href;

    if (refs.petImage.src !== nextSrc) {
      refs.petImage.classList.remove("is-loaded");
      refs.petImage.src = petImage;
      refs.petImage.alt = pet.petName || "Pet";
      void refs.petImage.offsetWidth;
      refs.petImage.classList.add("is-loaded");
    }

    const moodKey = String(pet.mood || "normal").toLowerCase();
    root.dataset.mood = moodKey;
  }

  function renderCoin(snapshot = {}) {
    const refs = getRefs();
    if (!refs.coinValue) {
      return;
    }

    const coinValue = getCurrentCoin(snapshot);
    animateNumber(refs.coinValue, coinValue);
    state.lastCoinValue = coinValue;

    const coinWrap = root.querySelector(".pet-shop-coin");
    if (coinWrap) {
      coinWrap.classList.remove("is-updated");
      void coinWrap.offsetWidth;
      coinWrap.classList.add("is-updated");
      window.setTimeout(() => {
        coinWrap.classList.remove("is-updated");
      }, 280);
    }
  }

  function renderCategoryRow(snapshot = {}) {
    const refs = getRefs();
    if (!refs.categories) {
      return;
    }

    const categories = state.categories.length > 0
      ? state.categories
      : Array.from(
          new Set(
            getSortedItems(snapshot).map((item) => normalizeCategoryKey(item.category || "")),
          ),
        ).filter(Boolean);

    if (categories.length === 0) {
      refs.categories.innerHTML = "";
      return;
    }

    if (!state.selectedCategory) {
      state.selectedCategory = categories[0];
    }

    refs.categories.innerHTML = categories
      .map((category) => {
        const active = state.selectedCategory === category || (!state.selectedCategory && category === categories[0]);
        return `
          <button
            type="button"
            class="pet-shop-category ${active ? "is-active" : ""}"
            data-action="category"
            data-shop-category="${escapeHtml(category)}"
            aria-pressed="${String(active)}"
          >
            ${escapeHtml(normalizeCategoryLabel(category))}
          </button>
        `;
      })
      .join("");
  }

  function renderCard(item, index, snapshot = {}) {
    const icon = resolveItemIconPath(item);
    const itemId = String(item.itemId || "").trim();
    const ownedQuantity = getInventoryOwnedQuantity(snapshot, item);
    const reason = getItemReason(item, snapshot);
    const price = Math.max(0, Number(item.price || 0));
    const categoryLabel = normalizeCategoryLabel(item.category || "");
    const toneClass = `tone-${index % 5}`;
    const categoryKey = normalizeCategoryKey(item.category || "");
    const quantityReached = ownedQuantity >= Math.max(1, Number(item.maxStack || 99));

    return `
      <article class="pet-shop-card ${toneClass} ${reason.disabled ? "is-disabled" : ""}" data-shop-item-id="${escapeHtml(itemId)}" data-shop-item-category="${escapeHtml(categoryKey)}">
        <div class="pet-shop-card__inner">
          <h3 class="pet-shop-card__title">${escapeHtml(item.name || itemId)}</h3>
          <div class="pet-shop-card__visual">
            <img src="${escapeHtml(icon)}" alt="${escapeHtml(item.name || itemId)}" loading="eager" decoding="async" />
          </div>
          <p class="pet-shop-card__description">${escapeHtml(item.description || "Món đồ hữu ích cho pet.")}</p>
          <div class="pet-shop-card__meta">
            <span class="pet-shop-card__category">${escapeHtml(categoryLabel)}</span>
            <span class="pet-shop-card__quantity">Đã có: <strong data-shop-owned="${escapeHtml(itemId)}">${formatNumber(ownedQuantity)}</strong></span>
          </div>
          <div class="pet-shop-card__price-row">
            <button
              type="button"
              class="pet-btn pet-btn--primary pet-shop-card__action"
              data-action="buy-item"
              data-shop-item-id="${escapeHtml(itemId)}"
              data-shop-price="${escapeHtml(price)}"
              aria-label="${escapeHtml(reason.label)} ${escapeHtml(item.name || itemId)}"
              ${reason.disabled ? "disabled" : ""}
            >
              <span class="pet-shop-card__action-icon" aria-hidden="true">${iconCoin()}</span>
              <span class="pet-shop-card__action-text">${escapeHtml(reason.label === "Mua" ? `${formatNumber(price)}` : reason.label)}</span>
              <span class="pet-shop-card__action-loading" aria-hidden="true"></span>
            </button>
            <span class="pet-shop-card__hint ${reason.tone === "coin" ? "is-warning" : reason.tone === "locked" ? "is-locked" : quantityReached ? "is-full" : ""}">
              ${reason.tone === "coin" ? "Không đủ Xu" : reason.tone === "locked" ? "Đã khóa" : quantityReached ? "Đã đủ số lượng" : item.unlockLevel ? `Mở ở cấp ${formatNumber(item.unlockLevel)}` : "Sẵn sàng mua"}
            </span>
          </div>
        </div>
      </article>
    `;
  }

  function renderGrid(snapshot = {}) {
    const refs = getRefs();
    if (!refs.grid || !refs.empty) {
      return;
    }

    const items = getSortedItems(snapshot);
    const visibleItems = state.selectedCategory
      ? items.filter((item) => normalizeCategoryKey(item.category || "") === state.selectedCategory)
      : items;

    const hasItems = visibleItems.length > 0;
    refs.empty.hidden = hasItems;
    refs.grid.hidden = !hasItems;

    if (refs.empty) {
      const titleEl = refs.empty.querySelector("strong");
      const messageEl = refs.empty.querySelector("p");

      if (titleEl) {
        titleEl.textContent = state.emptyTitle;
      }

      if (messageEl) {
        messageEl.textContent = state.emptyMessage;
      }
    }

    if (!hasItems) {
      refs.grid.innerHTML = "";
      return;
    }

    refs.grid.innerHTML = visibleItems.map((item, index) => renderCard(item, index, snapshot)).join("");
  }

  function render(snapshot = {}) {
    if (!state.visible) {
      return;
    }

    const pet = snapshot.pet || null;
    const hasPet = Boolean(pet);

    if (!hasPet) {
      root.hidden = true;
      setBodyActive(false);
      hideError();
      clearBubble();
      return;
    }

    root.hidden = false;
    setBodyActive(true);

    const refs = getRefs();
    if (refs.skeleton) {
      refs.skeleton.hidden = !state.loadingCatalog;
    }

    renderPet(snapshot);
    renderCoin(snapshot);
    renderCategoryRow(snapshot);
    renderGrid(snapshot);

    if (state.buyingItemId) {
      setBuyingItemId(state.buyingItemId);
    }
  }

  function syncStateFromShopResponse(response) {
    const items = Array.isArray(response?.data?.items) ? response.data.items : [];
    state.items = items;
    state.userLevel = Math.max(1, Number(response?.data?.userLevel || state.userLevel || 1));
    state.categories = Array.from(
      new Set(items.map((item) => normalizeCategoryKey(item.category || "")).filter(Boolean)),
    );
    if (!state.selectedCategory) {
      state.selectedCategory = state.categories[0] || "";
    }
  }

  function scrollToCategory(category) {
    const normalized = normalizeCategoryKey(category || "");
    if (!normalized) {
      return;
    }

    const target = root.querySelector(`[data-shop-item-category="${String(normalized).replace(/"/g, '\\"')}"]`);
    if (target?.scrollIntoView) {
      target.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    }
  }

  function pulsePet() {
    const petButton = root.querySelector(".pet-shop-pet");
    if (!petButton) {
      return;
    }

    petButton.classList.remove("is-bounce");
    void petButton.offsetWidth;
    petButton.classList.add("is-bounce");
    window.setTimeout(() => {
      petButton.classList.remove("is-bounce");
    }, 520);
  }

  function spawnBuyFx(card) {
    if (!card) {
      return;
    }

    const refs = getRefs();
    if (!refs.fxLayer) {
      return;
    }

    const cardRect = card.getBoundingClientRect();
    const coinRect = root.querySelector(".pet-shop-coin")?.getBoundingClientRect();
    if (!coinRect) {
      return;
    }

    const startX = cardRect.left + cardRect.width / 2;
    const startY = cardRect.top + cardRect.height / 2;
    const endX = coinRect.left + coinRect.width / 2;
    const endY = coinRect.top + coinRect.height / 2;

    const fx = document.createElement("div");
    fx.className = "pet-shop-fx";
    fx.innerHTML = `
      <span class="pet-shop-fx__coin" aria-hidden="true">${iconCoin()}</span>
      <span class="pet-shop-fx__spark pet-shop-fx__spark--one" aria-hidden="true">${iconSparkle()}</span>
      <span class="pet-shop-fx__spark pet-shop-fx__spark--two" aria-hidden="true">${iconSparkle()}</span>
    `;
    fx.style.setProperty("--fx-x", `${startX}px`);
    fx.style.setProperty("--fx-y", `${startY}px`);
    fx.style.setProperty("--fx-dx", `${endX - startX}px`);
    fx.style.setProperty("--fx-dy", `${endY - startY}px`);
    fx.dataset.fxId = buildFxId();
    refs.fxLayer.appendChild(fx);

    window.setTimeout(() => {
      fx.classList.add("is-flight");
    }, 0);

    window.setTimeout(() => {
      fx.remove();
    }, 900);
  }

  async function buyItem(itemId, card) {
    if (!itemId || state.buyingItemId) {
      return;
    }

    const item = getSortedItems(store?.getState?.() || {}).find((entry) => entry.itemId === itemId) || state.items.find((entry) => entry.itemId === itemId);
    if (!item) {
      return;
    }

    const requestState = getItemReason(item, store?.getState?.() || {});
    if (requestState.disabled) {
      return;
    }

    setBuyingItemId(itemId);
    hideError();
    spawnBuyFx(card);

    try {
      const response = await shopApi.buyItem({
        itemId,
        idempotencyKey: `shop-buy-${itemId}-${Date.now().toString(36)}`,
      });

      if (store?.applyBackendResponse) {
        store.applyBackendResponse(response, "shop-buy");
      }

      showToast(response?.popupEvents?.[0]?.message || response?.message || "Mua thành công.");
      pulsePet();
    } catch (error) {
      const normalized = normalizeError(error);
      showError(normalized.message);
    } finally {
      setBuyingItemId("");
    }
  }

  async function loadShop() {
    if (!shopApi) {
      throw new Error("Shop page requires shop API.");
    }

    setLoadingCatalog(true);
    hideError();

    try {
      const response = await shopApi.getShop();
      syncStateFromShopResponse(response);
      setEmptyState("Shop chưa có vật phẩm.", "Hãy quay lại sau nhé.");
      if (store?.applyBackendResponse) {
        store.applyBackendResponse(response, "shop-load");
      }
    } catch (error) {
      const normalized = normalizeError(error);
      if (normalized.errorCode === "GAME_CONFIG_NOT_FOUND") {
        state.items = [];
        state.categories = [];
        state.selectedCategory = "";
        setEmptyState(
          "Cửa hàng hiện chưa được cấu hình.",
          "HĂ£y quay láº¡i sau nhĂ©.",
        );
        hideError();
        render(store?.getState?.() || {});
        return;
      }

      showError(normalized.message);
      throw error;
    } finally {
      setLoadingCatalog(false);
    }
  }

  function handleClick(event) {
    const actionButton = event.target.closest?.("[data-action]");
    if (!actionButton) {
      return;
    }

    const action = actionButton.dataset.action;

    if (action === "back") {
      window.dispatchEvent(new CustomEvent("edukids:pet:home-requested", { detail: { source: "shop" } }));
      return;
    }

    if (action === "retry") {
      initialize({ forceReload: true }).catch(() => {});
      return;
    }

    if (action === "pet") {
      pulsePet();
      return;
    }

    if (action === "category") {
      const category = String(actionButton.dataset.shopCategory || "").trim();
      if (category) {
        state.selectedCategory = category;
        render(store?.getState?.() || {});
        scrollToCategory(category);
      }
      return;
    }

    if (action === "buy-item") {
      const card = actionButton.closest("[data-shop-item-id]");
      const itemId = String(actionButton.dataset.shopItemId || "").trim();
      buyItem(itemId, card);
    }
  }

  function handleKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const actionButton = event.target.closest?.("[data-action]");
    if (!actionButton) {
      return;
    }

    event.preventDefault();
    actionButton.click();
  }

  function syncFromStore(snapshot = {}) {
    if (!state.visible) {
      return;
    }

    if (!snapshot.pet) {
      root.hidden = true;
      setBodyActive(false);
      clearBubble();
      return;
    }

    render(snapshot);
  }

  function mount() {
    if (state.mounted) {
      return;
    }

    root.addEventListener("click", handleClick);
    root.addEventListener("keydown", handleKeydown);
    state.mounted = true;
  }

  async function initialize({ forceReload = false } = {}) {
    mount();
    state.openToken += 1;
    const openToken = state.openToken;
    state.visible = true;
    root.hidden = false;
    setBodyActive(true);

    if (!state.initialized || forceReload) {
      if (!forceReload && state.loadPromise) {
        await state.loadPromise;
      } else {
        state.loadPromise = loadShop()
          .finally(() => {
            state.loadPromise = null;
            state.initialized = true;
          });
        await state.loadPromise;
      }
    }

    if (state.openToken !== openToken || !state.visible) {
      return;
    }

    const snapshot = store?.getState?.() || {};
    const hasPet = Boolean(snapshot.pet) || snapshot.hasPet === true;

    if (hasPet) {
      root.hidden = false;
      render(snapshot);
    } else {
      root.hidden = true;
      setBodyActive(false);
    }
  }

  function show() {
    state.openToken += 1;
    state.visible = true;
    root.hidden = false;
    setBodyActive(true);
    render(store?.getState?.() || {});
  }

  function hide() {
    state.openToken += 1;
    state.visible = false;
    root.hidden = true;
    setBodyActive(false);
    clearBubble();
    clearToast();
  }

  function destroy() {
    root.removeEventListener("click", handleClick);
    root.removeEventListener("keydown", handleKeydown);
    hide();
    state.mounted = false;
  }

  if (store?.on) {
    store.on("STATE_UPDATED", syncFromStore);
  }

  return {
    initialize,
    show,
    hide,
    destroy,
    get state() {
      return { ...state };
    },
  };
}
