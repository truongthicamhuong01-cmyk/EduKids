import { escapeHtml } from "../../utils/dom.js";
import {
  resolveBackgroundPath,
  resolveItemIconPath,
  resolvePetAssetPath,
} from "../../utils/assetResolver.js";

const INVENTORY_PAGE_ID = "edukids-pet-inventory-page";

function iconBack() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;
}

function iconToy() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.2 9.8 6.5 6 7.2l2.7 2.6-.7 3.8L12 12l4 1.6-.7-3.8L18 7.2l-3.8-.7L12 3.2Z" fill="currentColor"></path>
      <circle cx="8.2" cy="15.8" r="1.2" fill="currentColor"></circle>
      <circle cx="15.8" cy="15.8" r="1.2" fill="currentColor"></circle>
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

function iconBolt() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m13 2-7 10h4l-1 10 7-10h-4L13 2Z" fill="currentColor"></path>
    </svg>
  `;
}

function iconChest() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 10.2c0-1.8 1.5-3.3 3.3-3.3h7.4c1.8 0 3.3 1.5 3.3 3.3V17c0 1.2-1 2.2-2.2 2.2H7.2C6 19.2 5 18.2 5 17v-6.8Z" fill="currentColor" opacity="0.18"></path>
      <path d="M5.8 10.3h12.4M10.8 10.3v8.8M13.2 10.3v8.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path>
      <path d="M8.6 8.2c0-1.4 1.2-2.6 2.6-2.6h1.6c1.4 0 2.6 1.2 2.6 2.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path>
    </svg>
  `;
}

function iconPlay() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8 6.8v10.4l8.8-5.2L8 6.8Z" fill="currentColor"></path>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" opacity="0.2"></circle>
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

function isToyCategory(category) {
  const normalized = normalizeText(category);
  return normalized === "toy" || normalized === "toys";
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

  if (Number(effects.happinessDelta) > 0) {
    parts.push(`+${Math.abs(Number(effects.happinessDelta))} hạnh phúc`);
  }
  if (Number(effects.energyDelta) < 0) {
    parts.push(`-${Math.abs(Number(effects.energyDelta))} năng lượng`);
  }
  if (Number(effects.expDelta) > 0) {
    parts.push(`+${Math.abs(Number(effects.expDelta))} EXP`);
  }

  return parts.length > 0 ? parts.join(" • ") : "Giúp pet vui hơn";
}

function buildFxId() {
  return `toy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
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
    loadingInventory: false,
    playingItemId: "",
    items: [],
    bubbleMessage: "",
    bubbleTimer: null,
    errorMessage: "",
    lastCoinValue: null,
    lastPetKey: "",
  };
}

function ensureInventoryRoot() {
  let root = document.getElementById(INVENTORY_PAGE_ID);

  if (!root) {
    root = document.createElement("section");
    root.id = INVENTORY_PAGE_ID;
    root.className = "pet-inventory-screen";
    root.hidden = true;
    root.innerHTML = `
      <div class="pet-inventory-screen__background" aria-hidden="true"></div>
      <div class="pet-inventory-screen__veil" aria-hidden="true"></div>
      <div class="pet-inventory-screen__fx-layer" data-inventory-fx-layer aria-hidden="true"></div>

      <div class="pet-inventory-screen__shell">
        <header class="pet-inventory-header">
          <div class="pet-inventory-header__left">
            <button type="button" class="pet-inventory-title pet-theme--glass" data-action="back" aria-label="Quay lại Home">
              <span class="pet-inventory-title__icon" aria-hidden="true">${iconToy()}</span>
              <span class="pet-inventory-title__copy">
                <strong>TÚI ĐỒ CHƠI</strong>
              </span>
            </button>
            <div class="pet-inventory-subtitle pet-theme--glass">
              Các món đồ chơi dành cho thú cưng của bạn.
            </div>
          </div>

          <div class="pet-inventory-coin pet-theme--glass" data-inventory-coin>
            <span class="pet-inventory-coin__icon" aria-hidden="true">${iconCoin()}</span>
            <strong data-inventory-coin-value>0</strong>
            <span class="pet-inventory-coin__plus" aria-hidden="true">+</span>
          </div>
        </header>

        <section class="pet-inventory-hero">
          <aside class="pet-inventory-status pet-panel" aria-label="Trạng thái">
            <div class="pet-inventory-status__list" data-inventory-status-list></div>
          </aside>

          <section class="pet-inventory-stage" aria-label="Pet">
            <div class="pet-inventory-bubble pet-theme--glass" data-inventory-bubble hidden role="status" aria-live="polite">
              <span class="pet-inventory-bubble__icon" aria-hidden="true">${iconSparkle()}</span>
              <p data-inventory-bubble-text></p>
            </div>

            <div class="pet-inventory-stage__platform" aria-hidden="true"></div>
            <button type="button" class="pet-inventory-pet" data-action="pet" aria-label="Thú cưng">
              <span class="pet-inventory-pet__halo" aria-hidden="true"></span>
              <span class="pet-inventory-pet__shadow" aria-hidden="true"></span>
              <img data-inventory-pet-image src="" alt="Pet" loading="eager" decoding="async" />
            </button>
          </section>
        </section>

        <section class="pet-inventory-grid-wrap" aria-label="Đồ chơi">
          <div class="pet-inventory-grid__empty" data-inventory-empty hidden>
            <div class="pet-inventory-empty__icon" aria-hidden="true">${iconChest()}</div>
            <strong>Bạn chưa có đồ chơi nào.</strong>
            <p>Hãy mua vài món đồ chơi để cùng pet vui hơn nhé.</p>
            <button type="button" class="pet-btn pet-btn--primary" data-action="open-shop">Mua đồ chơi</button>
          </div>

          <div class="pet-inventory-grid" data-inventory-grid></div>
          <div class="pet-inventory-skeleton" data-inventory-skeleton hidden aria-hidden="true">
            <div class="pet-inventory-skeleton__card"></div>
            <div class="pet-inventory-skeleton__card"></div>
            <div class="pet-inventory-skeleton__card"></div>
            <div class="pet-inventory-skeleton__card"></div>
            <div class="pet-inventory-skeleton__card"></div>
          </div>
        </section>

        <div class="pet-inventory-error pet-panel" data-inventory-error hidden role="alert">
          <strong data-inventory-error-title>Không thể tải Túi đồ chơi.</strong>
          <p data-inventory-error-message>Vui lòng thử lại nhé.</p>
          <div class="pet-inventory-error__actions">
            <button type="button" class="pet-btn pet-btn--secondary" data-action="retry">Thử lại</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);
  }

  return root;
}

function setBodyActive(isActive) {
  document.body.classList.toggle("pet-inventory-active", Boolean(isActive));
}

export function createInventoryPage({ store, petApi, inventoryApi } = {}) {
  const root = ensureInventoryRoot();
  const state = createDefaultState();

  function getRefs() {
    return {
      coinValue: root.querySelector("[data-inventory-coin-value]"),
      statusList: root.querySelector("[data-inventory-status-list]"),
      petImage: root.querySelector("[data-inventory-pet-image]"),
      bubble: root.querySelector("[data-inventory-bubble]"),
      bubbleText: root.querySelector("[data-inventory-bubble-text]"),
      grid: root.querySelector("[data-inventory-grid]"),
      empty: root.querySelector("[data-inventory-empty]"),
      skeleton: root.querySelector("[data-inventory-skeleton]"),
      error: root.querySelector("[data-inventory-error]"),
      errorTitle: root.querySelector("[data-inventory-error-title]"),
      errorMessage: root.querySelector("[data-inventory-error-message]"),
      fxLayer: root.querySelector("[data-inventory-fx-layer]"),
    };
  }

  function setLoadingInventory(isLoading) {
    state.loadingInventory = Boolean(isLoading);
    if (isLoading) {
      root.dataset.loadingInventory = "true";
    } else {
      delete root.dataset.loadingInventory;
    }

    const refs = getRefs();
    if (refs.skeleton) {
      refs.skeleton.hidden = !isLoading;
    }
    if (refs.grid) {
      refs.grid.classList.toggle("is-loading", Boolean(isLoading));
    }
  }

  function setPlayingItemId(itemId = "") {
    state.playingItemId = String(itemId || "");
    if (state.playingItemId) {
      root.dataset.playingItemId = state.playingItemId;
    } else {
      delete root.dataset.playingItemId;
    }

    root.querySelectorAll("[data-inventory-item-id]").forEach((card) => {
      if (!(card instanceof HTMLElement)) {
        return;
      }

      const currentItemId = card.dataset.inventoryItemId || "";
      const isCurrent = Boolean(state.playingItemId) && currentItemId === state.playingItemId;
      const shouldDisable = Boolean(state.playingItemId) && !isCurrent;

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

  function showError(message) {
    const refs = getRefs();
    if (!refs.error) {
      return;
    }

    if (refs.errorTitle) {
      refs.errorTitle.textContent = "Không thể tải Túi đồ chơi.";
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

  function getInventoryItems(snapshot = {}) {
    const toys = snapshot.inventory?.categories?.toys || [];
    return Array.isArray(toys) ? toys : Object.values(toys || {});
  }

  function getToyItems(snapshot = {}) {
    return getInventoryItems(snapshot)
      .filter((item) => isToyCategory(item?.category || "toy"))
      .map((item) => ({
        ...item,
        itemId: String(item?.itemId || "").trim(),
        quantity: Math.max(0, Number(item?.quantity || 0)),
      }))
      .filter((item) => Boolean(item.itemId))
      .sort((left, right) => String(left.itemId).localeCompare(String(right.itemId)));
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
          <div class="pet-inventory-stat pet-inventory-stat--${escapeHtml(stat.key)}">
            <div class="pet-inventory-stat__head">
              <span class="pet-inventory-stat__icon" aria-hidden="true">${stat.icon}</span>
              <span class="pet-inventory-stat__label">${escapeHtml(stat.label)}</span>
              <strong class="pet-inventory-stat__value" data-inventory-stat-value="${escapeHtml(stat.key)}">${formatNumber(value)}</strong>
            </div>
            <div class="pet-progress pet-inventory-stat__bar pet-progress--${escapeHtml(stat.tone)}">
              <div
                class="pet-progress__fill pet-inventory-stat__fill"
                data-inventory-stat-fill="${escapeHtml(stat.key)}"
                style="width: ${value}%"
              ></div>
            </div>
          </div>
        `;
      })
      .join("");

    stats.forEach((stat) => {
      const value = Math.max(0, Math.min(100, Number(stat.value) || 0));
      const valueEl = refs.statusList.querySelector(`[data-inventory-stat-value="${stat.key}"]`);
      const fillEl = refs.statusList.querySelector(`[data-inventory-stat-fill="${stat.key}"]`);
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
      "--pet-inventory-scene",
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

  function renderToyCard(item, index) {
    const icon = resolveItemIconPath(item);
    const itemId = String(item.itemId || "").trim();
    const quantity = Math.max(0, Number(item.quantity || 0));
    const disabled = quantity <= 0 || Boolean(state.playingItemId);
    const effectSummary = formatEffectSummary(item);
    const toneClass = `tone-${index % 5}`;

    return `
      <article class="pet-inventory-card ${toneClass} ${disabled ? "is-disabled" : ""}" data-inventory-item-id="${escapeHtml(itemId)}">
        <div class="pet-inventory-card__inner">
          <h3 class="pet-inventory-card__title">${escapeHtml(item.name || itemId)}</h3>
          <div class="pet-inventory-card__visual">
            <img src="${escapeHtml(icon)}" alt="${escapeHtml(item.name || itemId)}" loading="eager" decoding="async" />
          </div>
          <div class="pet-inventory-card__quantity">Số lượng: <strong data-inventory-quantity="${escapeHtml(itemId)}">${formatNumber(quantity)}</strong></div>
          <div class="pet-inventory-card__effect">${escapeHtml(effectSummary)}</div>
          <button type="button" class="pet-btn pet-btn--primary pet-inventory-card__action" data-action="play-item" data-inventory-item-id="${escapeHtml(itemId)}" ${disabled ? "disabled" : ""}>
            Chơi
            <span class="pet-inventory-card__loading" aria-hidden="true"></span>
          </button>
        </div>
      </article>
    `;
  }

  function renderGrid(snapshot = {}) {
    const refs = getRefs();
    if (!refs.grid || !refs.empty) {
      return;
    }

    const toyItems = getToyItems(snapshot);
    const hasItems = toyItems.length > 0;

    refs.empty.hidden = hasItems;
    refs.grid.hidden = !hasItems;

    if (!hasItems) {
      refs.grid.innerHTML = "";
      return;
    }

    refs.grid.innerHTML = toyItems.map((item, index) => renderToyCard(item, index)).join("");
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
      refs.skeleton.hidden = !state.loadingInventory;
    }

    renderPet(snapshot);
    renderCoin(snapshot);
    renderStatus(snapshot);
    renderGrid(snapshot);

    if (state.playingItemId) {
      setPlayingItemId(state.playingItemId);
    }
  }

  function spawnToyFx(card, item) {
    if (!card) {
      return;
    }

    const refs = getRefs();
    if (!refs.fxLayer) {
      return;
    }

    const cardRect = card.getBoundingClientRect();
    const petRect = root.querySelector(".pet-inventory-pet")?.getBoundingClientRect();
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
    fx.className = "pet-inventory-fx";
    fx.innerHTML = `
      <span class="pet-inventory-fx__toy">
        <img src="${escapeHtml(resolveItemIconPath(item))}" alt="" aria-hidden="true" />
      </span>
      <span class="pet-inventory-fx__heart pet-inventory-fx__heart--one" aria-hidden="true">${iconHeartSmall()}</span>
      <span class="pet-inventory-fx__heart pet-inventory-fx__heart--two" aria-hidden="true">${iconHeartSmall()}</span>
      <span class="pet-inventory-fx__heart pet-inventory-fx__heart--three" aria-hidden="true">${iconHeartSmall()}</span>
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
    const petButton = root.querySelector(".pet-inventory-pet");
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

  async function playItem(itemId, card) {
    if (!itemId || state.playingItemId) {
      return;
    }

    const item = state.items.find((entry) => entry.itemId === itemId);
    if (!item || Number(item.quantity || 0) <= 0) {
      return;
    }

    setPlayingItemId(itemId);
    hideError();
    spawnToyFx(card, item);

    try {
      const response = await petApi.playPet({
        itemId,
        idempotencyKey: `inventory-play-${itemId}-${Date.now().toString(36)}`,
      });

      if (store?.applyBackendResponse) {
        store.applyBackendResponse(response, "inventory-play");
      }

      const bubbleMessage = response?.popupEvents?.[0]?.message || response?.message || "";
      showBubble(bubbleMessage);
      pulsePet();
    } catch (error) {
      const normalized = normalizeError(error);
      showError(normalized.message);
    } finally {
      setPlayingItemId("");
    }
  }

  async function loadInventory() {
    if (!inventoryApi) {
      throw new Error("Inventory page requires inventory API.");
    }

    setLoadingInventory(true);
    hideError();

    try {
      const response = await inventoryApi.getInventory();
      if (store?.applyBackendResponse) {
        store.applyBackendResponse(response, "inventory-load");
      }
    } catch (error) {
      const normalized = normalizeError(error);
      showError(normalized.message);
      throw error;
    } finally {
      setLoadingInventory(false);
    }
  }

  function handleClick(event) {
    const actionButton = event.target.closest?.("[data-action]");
    if (!actionButton) {
      return;
    }

    const action = actionButton.dataset.action;
    if (action === "back") {
      window.dispatchEvent(new CustomEvent("edukids:pet:home-requested", { detail: { source: "inventory" } }));
      return;
    }

    if (action === "open-shop") {
      window.dispatchEvent(new CustomEvent("edukids:pet:shop-requested", { detail: { source: "inventory" } }));
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

    if (action === "play-item") {
      const card = actionButton.closest("[data-inventory-item-id]");
      const itemId = String(actionButton.dataset.inventoryItemId || "").trim();
      playItem(itemId, card);
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

    const feedPageOpen =
      typeof document !== "undefined" &&
      document.body?.classList?.contains("pet-feed-active");

    if (feedPageOpen) {
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

    state.items = getToyItems(snapshot);
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
      await loadInventory();
      state.initialized = true;
    }

    if (state.openToken !== openToken || !state.visible) {
      return;
    }

    const snapshot = store?.getState?.() || {};
    const hasPet = Boolean(snapshot.pet) || snapshot.hasPet === true;

    state.items = getToyItems(snapshot);
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
    state.items = getToyItems(store?.getState?.() || {});
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
