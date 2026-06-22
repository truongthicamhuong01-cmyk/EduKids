import { escapeHtml } from "../../utils/dom.js";
import { mountIntoPetHost } from "../../utils/pageHost.js";
import {
  resolveBackgroundPath,
  resolveItemIconPath,
  resolvePetAssetPath,
} from "../../utils/assetResolver.js";

const FEED_PAGE_ID = "edukids-pet-feed-page";

function iconBack() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;
}

function iconBag() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5.4 12.1c.2-3.6 3.3-6.4 6.6-6.4 3.3 0 6.4 2.8 6.6 6.4H5.4Z" fill="currentColor" opacity="0.2"></path>
      <path d="M5.6 12.1h12.8l-1 4.7c-.3 1.4-1.4 2.4-2.8 2.4H9.4c-1.4 0-2.5-1-2.8-2.4l-1-4.7Z" fill="currentColor" opacity="0.18"></path>
      <path d="M7.2 12.1c0-2.7 2-4.8 4.8-4.8s4.8 2.1 4.8 4.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
      <circle cx="9" cy="9" r="1.1" fill="currentColor"></circle>
      <circle cx="12" cy="7.8" r="1.1" fill="currentColor"></circle>
      <circle cx="15" cy="9" r="1.1" fill="currentColor"></circle>
      <path d="M8.4 16.2h7.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
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

function iconHeart() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 20.4 4.8 13.1a4.8 4.8 0 0 1 0-6.8 4.8 4.8 0 0 1 6.8 0l.4.4.4-.4a4.8 4.8 0 0 1 6.8 0 4.8 4.8 0 0 1 0 6.8L12 20.4Z" fill="currentColor"></path>
    </svg>
  `;
}

function iconSmile() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.18"></circle>
      <path d="M8.8 11.2h.01M15.2 11.2h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      <path d="M8.8 14.3c.9 1.2 2.1 1.8 3.2 1.8s2.3-.6 3.2-1.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;
}

function iconBolt() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m13 2-7 10h4l-1 10 7-10h-4L13 2Z" fill="currentColor"></path>
    </svg>
  `;
}

function iconShield() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.2 19 6v5.4c0 4.4-2.7 7.7-7 9.4-4.3-1.7-7-5-7-9.4V6l7-2.8Z" fill="currentColor" opacity="0.18"></path>
      <path d="M12 6.4v10.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"></path>
      <path d="M8.1 10.2h7.8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"></path>
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

function isFoodCategory(category) {
  const normalized = normalizeText(category);
  return normalized === "food" || normalized === "foods";
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(number)));
}

function formatEffectSummary(item) {
  const effects = item?.effects && typeof item.effects === "object" ? item.effects : {};
  const parts = [];

  if (Number(effects.hungerDelta) > 0) {
    parts.push(`+${Math.abs(Number(effects.hungerDelta))} độ no`);
  }
  if (Number(effects.happinessDelta) > 0) {
    parts.push(`+${Math.abs(Number(effects.happinessDelta))} vui`);
  }
  if (Number(effects.healthDelta) > 0) {
    parts.push(`+${Math.abs(Number(effects.healthDelta))} khỏe`);
  }

  if (parts.length === 0) {
    return "Món ăn nhẹ nhàng";
  }

  return parts.join(" • ");
}

function buildFxId() {
  return `fx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
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

function createDefaultState() {
  return {
    mounted: false,
    visible: false,
    initialized: false,
    openToken: 0,
    loadPromise: null,
    loadingCatalog: false,
    loadingItemId: "",
    catalog: [],
    bubbleMessage: "",
    bubbleTimer: null,
    errorMessage: "",
    lastPetKey: "",
    lastCoinValue: null,
  };
}

function ensureFeedRoot() {
  let root = document.getElementById(FEED_PAGE_ID);

  if (!root) {
    root = document.createElement("section");
    root.id = FEED_PAGE_ID;
    root.className = "pet-feed-screen";
    root.hidden = true;
    root.innerHTML = `
      <div class="pet-feed-screen__background" aria-hidden="true"></div>
      <div class="pet-feed-screen__veil" aria-hidden="true"></div>
      <div class="pet-feed-screen__fx-layer" data-feed-fx-layer aria-hidden="true"></div>

      <div class="pet-feed-screen__shell">
        <section class="pet-feed-hero-shell">
          <header class="pet-feed-header">
            <div class="pet-feed-header__left">
              <button type="button" class="pet-feed-title pet-theme--glass" data-action="back" aria-label="Quay về Home">
                <span class="pet-feed-title__icon" aria-hidden="true">${iconBag()}</span>
                <span class="pet-feed-title__copy">
                  <strong>CHO THÚ CƯNG ĂN</strong>
                </span>
              </button>
              <div class="pet-feed-subtitle pet-theme--glass">
                Chọn món ăn để chăm sóc thú cưng nhé!
              </div>
            </div>

            <div class="pet-feed-coin pet-theme--glass" data-feed-coin>
              <span class="pet-feed-coin__icon" aria-hidden="true">${iconCoin()}</span>
              <strong data-feed-coin-value>0</strong>
            </div>
          </header>

          <section class="pet-feed-hero">
            <div class="pet-feed-status-block">
              <div class="pet-feed-status-block__label">TRẠNG THÁI</div>
              <aside class="pet-feed-status pet-panel" aria-label="Trạng thái">
                <div class="pet-feed-status__list" data-feed-status-list></div>
              </aside>
            </div>

            <section class="pet-feed-stage" aria-label="Pet">
              <div class="pet-feed-bubble pet-theme--glass" data-feed-bubble hidden role="status" aria-live="polite">
                <span class="pet-feed-bubble__icon" aria-hidden="true">${iconSparkle()}</span>
                <p data-feed-bubble-text></p>
              </div>

              <div class="pet-feed-stage__platform" aria-hidden="true"></div>
              <button type="button" class="pet-feed-pet" data-action="pet" aria-label="Thú cưng">
                <span class="pet-feed-pet__halo" aria-hidden="true"></span>
                <span class="pet-feed-pet__shadow" aria-hidden="true"></span>
                <img data-feed-pet-image src="" alt="Pet" loading="eager" decoding="async" />
              </button>
            </section>
          </section>
        </section>

        <section class="pet-feed-foods" aria-label="Danh sách thức ăn">
          <div class="pet-feed-foods__skeleton" data-feed-skeleton hidden aria-hidden="true">
            <div class="pet-feed-foods__skeleton-card"></div>
            <div class="pet-feed-foods__skeleton-card"></div>
            <div class="pet-feed-foods__skeleton-card"></div>
            <div class="pet-feed-foods__skeleton-card"></div>
            <div class="pet-feed-foods__skeleton-card"></div>
          </div>
          <div class="pet-feed-foods__grid" data-feed-food-grid></div>
        </section>

        <div class="pet-feed-error pet-panel" data-feed-error hidden role="alert">
          <strong data-feed-error-title>Không thể tải màn Feed.</strong>
          <p data-feed-error-message>Vui lòng thử lại nhé.</p>
          <div class="pet-feed-error__actions">
            <button type="button" class="pet-btn pet-btn--secondary" data-action="retry-feed">Thử lại</button>
          </div>
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

export function createFeedPage({ store, petApi, shopApi, inventoryApi } = {}) {
  const root = ensureFeedRoot();
  const state = createDefaultState();

  function getRefs() {
    return {
      coinValue: root.querySelector("[data-feed-coin-value]"),
      statusList: root.querySelector("[data-feed-status-list]"),
      petImage: root.querySelector("[data-feed-pet-image]"),
      bubble: root.querySelector("[data-feed-bubble]"),
      bubbleText: root.querySelector("[data-feed-bubble-text]"),
      grid: root.querySelector("[data-feed-food-grid]"),
      skeleton: root.querySelector("[data-feed-skeleton]"),
      error: root.querySelector("[data-feed-error]"),
      errorTitle: root.querySelector("[data-feed-error-title]"),
      errorMessage: root.querySelector("[data-feed-error-message]"),
      fxLayer: root.querySelector("[data-feed-fx-layer]"),
    };
  }

  function setLoadingCatalog(isLoading) {
    state.loadingCatalog = Boolean(isLoading);
    root.dataset.loadingCatalog = String(Boolean(isLoading));
    const refs = getRefs();
    if (refs.skeleton) {
      refs.skeleton.hidden = !isLoading;
    }
    if (refs.grid) {
      refs.grid.classList.toggle("is-loading", Boolean(isLoading));
    }
  }

  function setLoadingItemId(itemId = "") {
    state.loadingItemId = String(itemId || "");
    if (state.loadingItemId) {
      root.dataset.loadingItemId = state.loadingItemId;
    } else {
      delete root.dataset.loadingItemId;
    }

    root.querySelectorAll("[data-food-item-id]").forEach((card) => {
      if (!(card instanceof HTMLElement)) {
        return;
      }
      const itemIdValue = card.dataset.foodItemId || "";
      const shouldDisable = Boolean(state.loadingItemId) && itemIdValue !== state.loadingItemId;
      card.classList.toggle("is-loading", Boolean(state.loadingItemId && itemIdValue === state.loadingItemId));
      card.querySelectorAll("button").forEach((button) => {
        button.disabled = shouldDisable || Boolean(state.loadingItemId && itemIdValue === state.loadingItemId);
      });
    });
  }

  function hideError() {
    const refs = getRefs();
    if (refs.error) {
      refs.error.hidden = true;
    }
  }

  function showError(message) {
    const refs = getRefs();
    if (!refs.error) {
      return;
    }

    if (refs.errorTitle) {
      refs.errorTitle.textContent = "Không thể tải màn Feed.";
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

  function showBubble(message) {
    const normalized = String(message || "").trim();
    if (!normalized) {
      clearBubble();
      return;
    }

    const refs = getRefs();
    if (!refs.bubble || !refs.bubbleText) {
      return;
    }

    clearBubble();
    state.bubbleMessage = normalized;
    refs.bubbleText.textContent = normalized;
    refs.bubble.hidden = false;
    refs.bubble.classList.remove("is-visible");
    void refs.bubble.offsetWidth;
    refs.bubble.classList.add("is-visible");

    state.bubbleTimer = window.setTimeout(() => {
      if (refs.bubble) {
        refs.bubble.classList.remove("is-visible");
        refs.bubble.hidden = true;
      }
      state.bubbleMessage = "";
      state.bubbleTimer = null;
    }, 3000);
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

  function getPet() {
    return store?.getState?.()?.pet || null;
  }

  function getInventoryFoods(snapshot = {}) {
    const inventoryFoods = snapshot.inventory?.categories?.foods || {};
    return Object.values(inventoryFoods).reduce((map, item) => {
      const id = String(item?.itemId || "").trim();
      if (!id) {
        return map;
      }
      map[id] = Number(item.quantity || 0);
      return map;
    }, {});
  }

  function mergeFoodCatalog(shopItems = [], inventoryFoods = {}) {
    return shopItems
      .filter((item) => isFoodCategory(item.category))
      .map((item, index) => {
        const itemId = String(item.itemId || item.id || "").trim();
        return {
          ...item,
          itemId,
          quantity: Number(inventoryFoods[itemId] ?? item.ownedQuantity ?? 0),
          tone: item.tone || `tone-${index % 5}`,
        };
      })
      .sort((left, right) => {
        const leftOrder = Number(left.sortOrder || 0);
        const rightOrder = Number(right.sortOrder || 0);
        return leftOrder - rightOrder;
      });
  }

  function renderStats(snapshot = {}) {
    const refs = getRefs();
    if (!refs.statusList) {
      return;
    }

    const pet = snapshot.pet || {};
    const stats = [
      { key: "hunger", label: "Độ no", value: pet.hunger, icon: iconHeart(), tone: "feed" },
      { key: "happiness", label: "Hạnh phúc", value: pet.happiness, icon: iconSmile(), tone: "happy" },
      { key: "energy", label: "Năng lượng", value: pet.energy, icon: iconBolt(), tone: "energy" },
    ];

    refs.statusList.innerHTML = stats
      .map((stat) => {
        const value = Math.max(0, Math.min(100, Number(stat.value) || 0));
        return `
          <div class="pet-feed-stat pet-feed-stat--${escapeHtml(stat.key)}">
            <div class="pet-feed-stat__head">
              <span class="pet-feed-stat__icon" aria-hidden="true">${stat.icon}</span>
              <span class="pet-feed-stat__label">${escapeHtml(stat.label)}</span>
              <strong class="pet-feed-stat__value" data-feed-stat-value="${escapeHtml(stat.key)}">${formatNumber(value)}</strong>
            </div>
            <div class="pet-progress pet-feed-stat__bar pet-progress--${escapeHtml(stat.tone)}">
              <div
                class="pet-progress__fill pet-feed-stat__fill"
                data-feed-stat-fill="${escapeHtml(stat.key)}"
                style="width: ${value}%"
              ></div>
            </div>
          </div>
        `;
      })
      .join("");

    stats.forEach((stat) => {
      const value = Math.max(0, Math.min(100, Number(stat.value) || 0));
      const valueEl = refs.statusList.querySelector(`[data-feed-stat-value="${stat.key}"]`);
      const fillEl = refs.statusList.querySelector(`[data-feed-stat-fill="${stat.key}"]`);
      animateNumber(valueEl, value);
      if (fillEl) {
        fillEl.style.width = `${value}%`;
      }
    });
  }

  function renderFoodCard(item, index, currentQuantity) {
    const icon = resolveItemIconPath(item);
    const itemId = String(item.itemId || "").trim();
    const quantity = Math.max(0, Number(currentQuantity ?? item.quantity ?? 0));
    const disabled = quantity <= 0 || Boolean(state.loadingItemId);
    const toneClass = `tone-${index % 5}`;
    const effectSummary = formatEffectSummary(item);

    return `
      <article class="pet-feed-food-card ${toneClass} ${disabled ? "is-disabled" : ""}" data-food-item-id="${escapeHtml(itemId)}">
        <div class="pet-feed-food-card__inner">
          <h3 class="pet-feed-food-card__title">${escapeHtml(item.name || itemId)}</h3>
          <div class="pet-feed-food-card__visual">
            <img src="${escapeHtml(icon)}" alt="${escapeHtml(item.name || itemId)}" loading="eager" decoding="async" />
          </div>
          <div class="pet-feed-food-card__quantity">Số lượng: <strong data-food-quantity="${escapeHtml(itemId)}">${formatNumber(quantity)}</strong></div>
          <div class="pet-feed-food-card__effect">${escapeHtml(effectSummary)}</div>
          <button type="button" class="pet-btn pet-btn--primary pet-feed-food-card__action" data-action="feed-item" data-food-item-id="${escapeHtml(itemId)}" ${disabled ? "disabled" : ""}>
            Cho ăn
            <span class="pet-feed-food-card__loading" aria-hidden="true"></span>
          </button>
        </div>
      </article>
    `;
  }

  function renderCatalog(snapshot = {}) {
    const refs = getRefs();
    if (!refs.grid) {
      return;
    }

    const foodCatalog = state.catalog || [];
    const inventoryFoods = getInventoryFoods(snapshot);

    if (foodCatalog.length === 0) {
      refs.grid.innerHTML = "";
      return;
    }

    refs.grid.innerHTML = foodCatalog.map((item, index) => renderFoodCard(item, index, inventoryFoods[item.itemId])).join("");
  }

  function renderPet(snapshot = {}) {
    const pet = snapshot.pet || null;
    const refs = getRefs();
    if (!refs.petImage) {
      return;
    }

    root.style.setProperty(
      "--pet-feed-scene",
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

    const coinValue = Number(snapshot.wallet?.eduCoin || 0);
    animateNumber(refs.coinValue, coinValue);
    state.lastCoinValue = coinValue;
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
    renderStats(snapshot);
    renderCatalog(snapshot);

    if (state.loadingItemId) {
      setLoadingItemId(state.loadingItemId);
    }
  }

  async function loadCatalog() {
    if (!shopApi || !inventoryApi) {
      throw new Error("Feed page requires shop and inventory APIs.");
    }

    setLoadingCatalog(true);
    hideError();

    try {
      const [shopResponse, inventoryResponse] = await Promise.all([
        shopApi.getShop(),
        inventoryApi.getInventory(),
      ]);

      const shopItems = Array.isArray(shopResponse?.data?.items) ? shopResponse.data.items : [];
      const inventoryFoods = getInventoryFoods(inventoryResponse?.data || {});
      state.catalog = mergeFoodCatalog(shopItems, inventoryFoods);
      if (store?.applyBackendResponse) {
        store.applyBackendResponse(shopResponse, "feed-shop");
        store.applyBackendResponse(inventoryResponse, "feed-inventory");
      }
    } catch (error) {
      const normalized = normalizeError(error);
      showError(normalized.message);
      throw error;
    } finally {
      setLoadingCatalog(false);
    }
  }

  function spawnFoodFx(card, item) {
    if (!card) {
      return;
    }

    const refs = getRefs();
    if (!refs.fxLayer) {
      return;
    }

    const cardRect = card.getBoundingClientRect();
    const petRect = root.querySelector(".pet-feed-pet")?.getBoundingClientRect();
    if (!petRect) {
      return;
    }

    const startX = cardRect.left + cardRect.width / 2;
    const startY = cardRect.top + cardRect.height / 2;
    const endX = petRect.left + petRect.width / 2;
    const endY = petRect.top + petRect.height / 2;
    const deltaX = endX - startX;
    const deltaY = endY - startY;

    const fx = document.createElement("div");
    fx.className = "pet-feed-fx";
    fx.innerHTML = `
      <span class="pet-feed-fx__food">
        <img src="${escapeHtml(resolveItemIconPath(item))}" alt="" aria-hidden="true" />
      </span>
      <span class="pet-feed-fx__heart pet-feed-fx__heart--one" aria-hidden="true">${iconHeartSmall()}</span>
      <span class="pet-feed-fx__heart pet-feed-fx__heart--two" aria-hidden="true">${iconHeartSmall()}</span>
      <span class="pet-feed-fx__heart pet-feed-fx__heart--three" aria-hidden="true">${iconHeartSmall()}</span>
    `;

    fx.style.setProperty("--fx-x", `${startX}px`);
    fx.style.setProperty("--fx-y", `${startY}px`);
    fx.style.setProperty("--fx-dx", `${deltaX}px`);
    fx.style.setProperty("--fx-dy", `${deltaY}px`);
    fx.dataset.fxId = buildFxId();
    refs.fxLayer.appendChild(fx);

    window.setTimeout(() => {
      fx.classList.add("is-flight");
    }, 0);

    window.setTimeout(() => {
      fx.remove();
    }, 900);
  }

  function pulsePet() {
    const petButton = root.querySelector(".pet-feed-pet");
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

  async function feedItem(itemId, card) {
    if (!itemId || state.loadingItemId) {
      return;
    }

    const item = state.catalog.find((entry) => entry.itemId === itemId);
    if (!item || Number(item.quantity || 0) <= 0) {
      return;
    }

    setLoadingItemId(itemId);
    hideError();
    spawnFoodFx(card, item);

    try {
      const response = await petApi.feedPet({
        itemId,
        idempotencyKey: `feed-${itemId}-${Date.now().toString(36)}`,
      });

      if (store?.applyBackendResponse) {
        store.applyBackendResponse(response, "feed-item");
      }

      if (state.visible) {
        const bubbleMessage = response?.popupEvents?.[0]?.message || response?.message || "";
        showBubble(bubbleMessage);
        pulsePet();
      }
      if (response?.data?.inventory?.categories?.foods) {
        state.catalog = state.catalog.map((entry) => {
          const nextQuantity = Number(response.data.inventory.categories.foods?.[entry.itemId]?.quantity);
          if (Number.isFinite(nextQuantity)) {
            return { ...entry, quantity: nextQuantity };
          }
          return entry;
        });
      }
      render(store?.getState?.() || {});
    } catch (error) {
      const normalized = normalizeError(error);
      showError(normalized.message);
    } finally {
      setLoadingItemId("");
    }
  }

  function handleClick(event) {
    const actionButton = event.target.closest?.("[data-action]");
    if (!actionButton) {
      return;
    }

    const action = actionButton.dataset.action;

    if (action === "back") {
      window.dispatchEvent(new CustomEvent("edukids:pet:home-requested", { detail: { source: "feed" } }));
      return;
    }

    if (action === "retry-feed") {
      initialize({ forceReload: true }).catch(() => {});
      return;
    }

    if (action === "pet") {
      pulsePet();
      return;
    }

    if (action === "feed-item") {
      const card = actionButton.closest("[data-food-item-id]");
      const itemId = String(actionButton.dataset.foodItemId || "").trim();
      feedItem(itemId, card);
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

    const inventoryPageOpen =
      typeof document !== "undefined" &&
      document.body?.classList?.contains("pet-inventory-active");

    if (inventoryPageOpen) {
      root.hidden = true;
      setBodyActive(false);
      clearBubble();
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
        state.loadPromise = loadCatalog()
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

    state.visible = hasPet;
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
