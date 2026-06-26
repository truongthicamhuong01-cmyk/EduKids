import { asElement, escapeHtml } from "../../utils/dom.js";
import { mountIntoPetHost } from "../../utils/pageHost.js";
import {
  resolveBackgroundPath,
  resolvePetAvatarPath,
  resolvePetAssetPath,
} from "../../utils/assetResolver.js";

const HOME_PAGE_ID = "edukids-pet-home-page";

function iconCart() {
  return `
    <img src="/assets/pet/icons/icon_shop.png" alt="" aria-hidden="true" loading="eager" decoding="async" />
  `;
}

function iconHand() {
  return `
    <img src="/assets/pet/icons/icon_touch.png" alt="" aria-hidden="true" loading="eager" decoding="async" />
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

function iconLevel() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m12 3 2.4 4.9 5.4.8-3.9 3.8.9 5.5-4.8-2.5-4.8 2.5.9-5.5-3.9-3.8 5.4-.8Z" fill="currentColor"></path>
    </svg>
  `;
}

function iconFeed() {
  return `
    <img src="/assets/pet/icons/icon_feed.png" alt="" aria-hidden="true" loading="eager" decoding="async" />
  `;
}

function iconPlay() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8.1 6.7v10.6L17 12 8.1 6.7Z" fill="currentColor"></path>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" opacity="0.22"></circle>
    </svg>
  `;
}

function iconSleep() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M15.4 5.8c-2.6.4-4.5 2.6-4.5 5.3 0 3 2.4 5.3 5.3 5.3.5 0 1-.1 1.5-.2-1 1.5-2.8 2.4-4.8 2.4-3.4 0-6.1-2.8-6.1-6.2 0-2.8 1.7-5 4.2-5.8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;
}

function iconInventory() {
  return `
    <img src="/assets/pet/icons/icon_inventory.png" alt="" aria-hidden="true" loading="eager" decoding="async" />
  `;
}

function iconSmile() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.16"></circle>
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
      <path d="M12 3.2 19 6v5.4c0 4.4-2.7 7.7-7 9.4-4.3-1.7-7-5-7-9.4V6l7-2.8Z" fill="currentColor" opacity="0.16"></path>
      <path d="M12 6.4v10.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"></path>
      <path d="M8.1 10.2h7.8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"></path>
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

function iconBubble() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 5.8A2.8 2.8 0 0 1 6.8 3h10.4A2.8 2.8 0 0 1 20 5.8v6.4a2.8 2.8 0 0 1-2.8 2.8H10l-4.2 4V15H6.8A2.8 2.8 0 0 1 4 12.2V5.8Z" fill="currentColor"></path>
    </svg>
  `;
}

function iconSparkle() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.8 13.8 8 19 9.8 13.8 11.6 12 16.8 10.2 11.6 5 9.8 10.2 8 12 2.8Z" fill="currentColor"></path>
      <path d="M5.5 14.5 6.4 17l2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9.9-2.5Z" fill="currentColor" opacity="0.6"></path>
    </svg>
  `;
}

function iconCookie() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 4c4.4 0 8 3.6 8 8s-3.6 8-8 8-8-3.6-8-8 3.6-8 8-8Z" fill="currentColor" opacity="0.18"></path>
      <circle cx="9.1" cy="9.3" r="1" fill="currentColor"></circle>
      <circle cx="14.8" cy="8.9" r="1" fill="currentColor"></circle>
      <circle cx="15.3" cy="14.4" r="1" fill="currentColor"></circle>
      <circle cx="9.6" cy="15" r="1" fill="currentColor"></circle>
      <path d="M12 6.5c-2.8 0-5.1 2.3-5.1 5.1S9.2 16.7 12 16.7 17.1 14.4 17.1 11.6 14.8 6.5 12 6.5Z" fill="none" stroke="currentColor" stroke-width="1.6"></path>
    </svg>
  `;
}

const MOOD_META = {
  happy: { label: "Vui vẻ", tone: "happy", icon: iconSmile() },
  normal: { label: "Bình thường", tone: "normal", icon: iconSmile() },
  hungry: { label: "Hơi đói", tone: "warning", icon: iconCookie() },
  sleepy: { label: "Buồn ngủ", tone: "info", icon: iconSleep() },
  sad: { label: "Buồn", tone: "danger", icon: iconHeart() },
  sick: { label: "Cần chăm sóc", tone: "danger", icon: iconShield() },
};

const STAT_META = {
  hunger: { label: "Độ no", icon: iconHeart(), tone: "danger", fillClass: "pet-home-stat__fill--hunger" },
  happiness: { label: "Vui vẻ", icon: iconSmile(), tone: "warning", fillClass: "pet-home-stat__fill--happiness" },
  energy: { label: "Năng lượng", icon: iconBolt(), tone: "info", fillClass: "pet-home-stat__fill--energy" },
  health: { label: "Sức khỏe", icon: iconShield(), tone: "success", fillClass: "pet-home-stat__fill--health" },
};

function createEmptyState() {
  return {
    mounted: false,
    visible: false,
    initialized: false,
    loadingAction: "",
    lastFailedAction: "",
    bubbleTimer: null,
    bubbleMessage: "",
    lastPetKey: "",
    lastCoinValue: null,
    lastExpValue: null,
    lastExpMaxValue: null,
    lastStats: {},
  };
}

function ensureHomePageRoot() {
  let root = document.getElementById(HOME_PAGE_ID);

  if (!root) {
    root = document.createElement("section");
    root.id = HOME_PAGE_ID;
    root.className = "pet-home-screen";
    root.hidden = false;
    root.innerHTML = `
      <div class="pet-home-screen__background" aria-hidden="true"></div>
      <div class="pet-home-screen__veil" aria-hidden="true"></div>

      <div class="pet-home-screen__shell">
        <header class="pet-home-topbar">
          <div class="pet-home-tip pet-theme--glass" data-home-tip>
            <span class="pet-home-tip__icon" aria-hidden="true">${iconHand()}</span>
            <p>Chạm vào pet<br />để tương tác</p>
          </div>

          <button type="button" class="pet-home-shop pet-btn" data-action="shop" aria-label="Cửa hàng">
            <span class="pet-home-shop__icon" aria-hidden="true">${iconCart()}</span>
            <span>Cửa hàng</span>
          </button>
        </header>

        <section class="pet-home-stage" aria-label="Khu vực Pet">
          <div class="pet-home-bubble pet-theme--glass" data-home-bubble hidden role="status" aria-live="polite">
            <span class="pet-home-bubble__icon" aria-hidden="true">${iconBubble()}</span>
            <p data-home-bubble-text></p>
          </div>

          <button type="button" class="pet-home-pet" data-action="pet" aria-label="Tương tác với Pet">
            <span class="pet-home-pet__halo" aria-hidden="true"></span>
            <span class="pet-home-pet__shadow" aria-hidden="true"></span>
            <span class="pet-home-pet__sparkle pet-home-pet__sparkle--one" aria-hidden="true">${iconSparkle()}</span>
            <span class="pet-home-pet__sparkle pet-home-pet__sparkle--two" aria-hidden="true">${iconSparkle()}</span>
            <span class="pet-home-pet__hunger-bubble" aria-hidden="true">${iconCookie()}</span>
            <img
              data-home-pet-image
              src=""
              alt="Pet"
              loading="eager"
              decoding="async"
            />
          </button>

          <div class="pet-home-skeleton" data-home-skeleton hidden aria-hidden="true">
            <div class="pet-home-skeleton__bubble"></div>
            <div class="pet-home-skeleton__pet"></div>
            <div class="pet-home-skeleton__hud">
              <div class="pet-home-skeleton__card"></div>
              <div class="pet-home-skeleton__card pet-home-skeleton__card--wide"></div>
              <div class="pet-home-skeleton__card"></div>
            </div>
          </div>
        </section>

        <section class="pet-home-hud">
          <article class="pet-home-profile pet-panel" data-home-profile>
            <div class="pet-home-profile__head">
              <div class="pet-home-avatar" aria-hidden="true">
                <img data-home-avatar src="" alt="" />
              </div>

              <div class="pet-home-profile__copy">
                <div class="pet-home-profile__name-row">
                  <h1 data-home-name>Pet</h1>
                  <span class="pet-home-mood pet-home-mood--normal" data-home-mood>
                    <span class="pet-home-mood__icon" aria-hidden="true" data-home-mood-icon>${MOOD_META.normal.icon}</span>
                    <span data-home-mood-label>Bình thường</span>
                  </span>
                </div>

                <div class="pet-home-profile__meta">
                  <span class="pet-home-chip" data-home-level-chip>
                    <span class="pet-home-chip__icon" aria-hidden="true">${iconLevel()}</span>
                    <span>Cấp <strong data-home-level>--</strong></span>
                  </span>
                  <span class="pet-home-chip pet-home-chip--coin" data-home-coin-chip>
                    <span class="pet-home-chip__icon" aria-hidden="true">${iconCoin()}</span>
                    <span data-home-coin>0</span>
                  </span>
                </div>
              </div>
            </div>

            <div class="pet-home-exp">
              <div class="pet-home-exp__row">
                <span class="pet-home-exp__label">
                  <span class="pet-home-exp__label-icon" aria-hidden="true">${iconLevel()}</span>
                  EXP
                </span>
                <strong data-home-exp-text>0 / 0</strong>
              </div>
              <div class="pet-progress pet-progress--happy pet-home-exp__bar" title="Thanh EXP">
                <div class="pet-progress__fill pet-home-exp__fill" data-home-exp-fill style="width: 0%"></div>
              </div>
            </div>
          </article>

          <section class="pet-home-actions" aria-label="Hành động">
            <div class="pet-home-actions__primary">
              <button type="button" class="pet-home-action-card pet-home-action-card--feed pet-theme--glass" data-action="feed">
                <span class="pet-home-action-card__icon" aria-hidden="true">${iconFeed()}</span>
                <span class="pet-home-action-card__title">Cho ăn</span>
                <span class="pet-home-action-card__loading" aria-hidden="true"></span>
              </button>

              <button type="button" class="pet-home-action-card pet-home-action-card--inventory pet-theme--glass" data-action="inventory">
                <span class="pet-home-action-card__icon" aria-hidden="true">${iconInventory()}</span>
                <span class="pet-home-action-card__title">Túi đồ</span>
                <span class="pet-home-action-card__loading" aria-hidden="true"></span>
              </button>
            </div>
          </section>

          <article class="pet-home-stats pet-panel" aria-label="Chỉ số Pet">
            <div class="pet-home-stats__list" data-home-stats></div>
          </article>
        </section>

        <div class="pet-home-error pet-panel" data-home-error hidden role="alert">
          <strong data-home-error-title>Không thể tải Pet.</strong>
          <p data-home-error-message>Vui lòng thử lại nhé.</p>
          <div class="pet-home-error__actions">
            <button type="button" class="pet-btn pet-btn--secondary" data-action="retry">Thử lại</button>
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

function scrollPageToTop(root) {
  if (!root) {
    return;
  }

  root.scrollIntoView({ block: "start" });
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0";
  }
  return new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(number)));
}

function animateNumberText(element, targetValue) {
  if (!element) {
    return;
  }

  const nextValue = Number(targetValue) || 0;
  const previousValue = Number(element.dataset.currentValue || "0") || 0;

  if (Math.abs(previousValue - nextValue) < 0.5) {
    element.textContent = formatNumber(nextValue);
    element.dataset.currentValue = String(nextValue);
    return;
  }

  const duration = 360;
  const startedAt = performance.now();

  function step(now) {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentValue = previousValue + (nextValue - previousValue) * eased;
    element.textContent = formatNumber(currentValue);

    if (progress < 1) {
      window.requestAnimationFrame(step);
      return;
    }

    element.dataset.currentValue = String(nextValue);
  }

  window.requestAnimationFrame(step);
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

function createIdempotencyKey(actionName) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${actionName}-${Date.now().toString(36)}-${random}`;
}

export function createHomePetPage({ store, petApi } = {}) {
  const root = ensureHomePageRoot();
  const state = createEmptyState();

  function getRefs() {
    return {
      bubble: root.querySelector("[data-home-bubble]"),
      bubbleText: root.querySelector("[data-home-bubble-text]"),
      skeleton: root.querySelector("[data-home-skeleton]"),
      error: root.querySelector("[data-home-error]"),
      errorTitle: root.querySelector("[data-home-error-title]"),
      errorMessage: root.querySelector("[data-home-error-message]"),
      petImage: root.querySelector("[data-home-pet-image]"),
      avatar: root.querySelector("[data-home-avatar]"),
      name: root.querySelector("[data-home-name]"),
      level: root.querySelector("[data-home-level]"),
      mood: root.querySelector("[data-home-mood]"),
      moodIcon: root.querySelector("[data-home-mood-icon]"),
      moodLabel: root.querySelector("[data-home-mood-label]"),
      coin: root.querySelector("[data-home-coin]"),
      expText: root.querySelector("[data-home-exp-text]"),
      expFill: root.querySelector("[data-home-exp-fill]"),
      stats: root.querySelector("[data-home-stats]"),
    };
  }

  function setLoadingAction(actionName = "") {
    state.loadingAction = String(actionName || "");
    if (state.loadingAction) {
      root.dataset.loadingAction = state.loadingAction;
    } else {
      delete root.dataset.loadingAction;
    }
    root.querySelectorAll("[data-action]").forEach((button) => {
      const isActionButton = button instanceof HTMLButtonElement;
      if (!isActionButton) {
        return;
      }
      const nextDisabled = Boolean(state.loadingAction) && button.dataset.action !== "retry";
      button.disabled = nextDisabled;
      button.setAttribute("aria-busy", String(Boolean(state.loadingAction && button.dataset.action === state.loadingAction)));
      button.classList.toggle("is-loading", Boolean(state.loadingAction && button.dataset.action === state.loadingAction));
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
      refs.errorTitle.textContent = "Không thể tải Pet.";
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
    }, 3200);
  }

  function getPetKey(snapshot = {}) {
    const pet = snapshot.pet || {};
    return [pet.petTypeId || pet.petType || "", pet.level || "", pet.stage || "", pet.mood || ""].join("|");
  }

  function renderStatsList(snapshot = {}) {
    const refs = getRefs();
    if (!refs.stats) {
      return;
    }

    const pet = snapshot.pet || {};
    const previousStats = state.lastStats || {};
    const stats = [
      { key: "hunger", value: pet.hunger },
      { key: "happiness", value: pet.happiness },
      { key: "energy", value: pet.energy },
      { key: "health", value: pet.health },
    ];

    refs.stats.innerHTML = stats
      .map((stat) => {
        const meta = STAT_META[stat.key];
        const value = Math.max(0, Math.min(100, Number(stat.value) || 0));
        return `
          <div class="pet-home-stat pet-home-stat--${stat.key}">
            <div class="pet-home-stat__head">
              <span class="pet-home-stat__icon" aria-hidden="true">${meta.icon}</span>
              <span class="pet-home-stat__label">${escapeHtml(meta.label)}</span>
              <strong class="pet-home-stat__value" data-home-stat-value="${escapeHtml(stat.key)}">${formatNumber(value)}</strong>
            </div>
            <div class="pet-progress pet-home-stat__bar pet-progress--${meta.tone}" title="${escapeHtml(meta.label)}">
              <div
                class="pet-progress__fill pet-home-stat__fill ${meta.fillClass}"
                data-home-stat-fill="${escapeHtml(stat.key)}"
                style="width: ${value}%"
              ></div>
            </div>
          </div>
        `;
      })
      .join("");

    stats.forEach((stat) => {
      const valueEl = refs.stats.querySelector(`[data-home-stat-value="${stat.key}"]`);
      const fillEl = refs.stats.querySelector(`[data-home-stat-fill="${stat.key}"]`);
      const value = Math.max(0, Math.min(100, Number(stat.value) || 0));
      animateNumberText(valueEl, value);
      if (fillEl) {
        fillEl.classList.remove("is-updating", "is-increasing", "is-decreasing");
        void fillEl.offsetWidth;
        fillEl.style.width = `${value}%`;
        const previousValue = Number(previousStats[stat.key]);
        if (Number.isFinite(previousValue)) {
          fillEl.classList.add(value >= previousValue ? "is-increasing" : "is-decreasing", "is-updating");
          window.setTimeout(() => {
            fillEl.classList.remove("is-updating", "is-increasing", "is-decreasing");
          }, 340);
        }
      }
    });

    state.lastStats = {
      hunger: Math.max(0, Math.min(100, Number(pet.hunger) || 0)),
      happiness: Math.max(0, Math.min(100, Number(pet.happiness) || 0)),
      energy: Math.max(0, Math.min(100, Number(pet.energy) || 0)),
      health: Math.max(0, Math.min(100, Number(pet.health) || 0)),
    };
  }

  function render(snapshot = {}) {
    const pet = snapshot.pet || null;
    const hasPet = Boolean(pet);

    root.style.setProperty(
      "--pet-home-scene",
      `url('${resolveBackgroundPath({ petType: pet?.petTypeId || pet?.petType || "horse" })}')`,
    );

    if (!hasPet) {
      root.hidden = false;
      setBodyActive(false);
      delete root.dataset.mood;
      delete root.dataset.petType;
      delete root.dataset.loadingAction;
      const refs = getRefs();
      if (refs.skeleton) {
        refs.skeleton.hidden = false;
      }
      hideError();
      clearBubble();
      return;
    }

    root.hidden = false;
    setBodyActive(true);
    if (state.loadingAction) {
      root.dataset.loadingAction = state.loadingAction;
    } else {
      delete root.dataset.loadingAction;
    }

    const refs = getRefs();
    if (refs.skeleton) {
      refs.skeleton.hidden = true;
    }
    hideError();

    const petImage = resolvePetAssetPath({
      petType: pet.petTypeId || pet.petType,
      stage: pet.stage,
      mood: pet.mood,
      level: `level${pet.level || 1}`,
    });
    const avatarImage = resolvePetAvatarPath({
      petType: pet.petTypeId || pet.petType,
      stage: pet.stage,
      level: `level${pet.level || 1}`,
    });
    const petKey = getPetKey(snapshot);

    if (refs.petImage && refs.petImage.src !== new URL(petImage, window.location.href).href) {
      refs.petImage.classList.remove("is-loaded");
      refs.petImage.src = petImage;
      refs.petImage.alt = pet.petName || "Pet";
      void refs.petImage.offsetWidth;
      refs.petImage.classList.add("is-loaded");
    }

    if (refs.avatar && refs.avatar.src !== new URL(avatarImage, window.location.href).href) {
      refs.avatar.src = avatarImage;
      refs.avatar.alt = pet.petName || "Pet";
    }

    if (refs.name) {
      refs.name.textContent = pet.petName || "Pet";
    }

    if (refs.level) {
      animateNumberText(refs.level, pet.level || 1);
    }

    if (refs.coin) {
      const coinValue = Number(snapshot.wallet?.eduCoin || 0);
      if (state.lastCoinValue === null || Math.abs(state.lastCoinValue - coinValue) >= 1) {
        animateNumberText(refs.coin, coinValue);
      } else {
        refs.coin.textContent = formatNumber(coinValue);
      }
      state.lastCoinValue = coinValue;
    }

    const moodKey = String(pet.mood || "normal").toLowerCase();
    const moodMeta = MOOD_META[moodKey] || MOOD_META.normal;
    root.dataset.mood = moodKey;
    root.dataset.petType = String(pet.petTypeId || pet.petType || "");
    if (refs.mood) {
      refs.mood.className = `pet-home-mood pet-home-mood--${moodMeta.tone}`;
    }
    if (refs.moodIcon) {
      refs.moodIcon.innerHTML = moodMeta.icon;
    }
    if (refs.moodLabel) {
      refs.moodLabel.textContent = moodMeta.label;
    }

    if (refs.expText) {
      const requiredExp = Math.max(0, Number(pet.requiredExpToNextLevel || 0));
      const currentExp = Math.max(0, Number(pet.exp || 0));
      const previousExp = state.lastExpValue;
      const previousMax = state.lastExpMaxValue;
      const targetText = `${formatNumber(currentExp)} / ${formatNumber(requiredExp)}`;
      if (state.lastExpValue !== currentExp || state.lastExpMaxValue !== requiredExp) {
        refs.expText.textContent = targetText;
      } else {
        refs.expText.textContent = targetText;
      }

      const fillPercent = requiredExp > 0 ? Math.min(100, (currentExp / requiredExp) * 100) : 100;
      if (refs.expFill) {
        refs.expFill.classList.remove("is-updating", "is-increasing", "is-decreasing");
        void refs.expFill.offsetWidth;
        refs.expFill.style.width = `${fillPercent}%`;
        if (previousExp !== null && previousMax !== null) {
          const previousPercent = previousMax > 0 ? Math.min(100, (previousExp / previousMax) * 100) : 0;
          refs.expFill.classList.add(fillPercent >= previousPercent ? "is-increasing" : "is-decreasing", "is-updating");
          window.setTimeout(() => {
            refs.expFill.classList.remove("is-updating", "is-increasing", "is-decreasing");
          }, 340);
        }
      }

      state.lastExpValue = currentExp;
      state.lastExpMaxValue = requiredExp;
    }

    renderStatsList(snapshot);

    if (state.lastPetKey !== petKey) {
      state.lastPetKey = petKey;
      const petArea = root.querySelector(".pet-home-pet");
      if (petArea) {
        petArea.classList.remove("is-flash");
        void petArea.offsetWidth;
        petArea.classList.add("is-flash");
      }
    }

    root.querySelectorAll("[data-action]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }
      const isBusy = Boolean(state.loadingAction);
      button.disabled = isBusy && button.dataset.action !== state.loadingAction && button.dataset.action !== "retry";
      button.setAttribute("aria-busy", String(Boolean(isBusy && button.dataset.action === state.loadingAction)));
      button.classList.toggle("is-loading", Boolean(isBusy && button.dataset.action === state.loadingAction));
    });

    const actionButtons = root.querySelectorAll("[data-action='feed'], [data-action='play'], [data-action='sleep']");
    actionButtons.forEach((button) => {
      const icon = button.querySelector(".pet-home-action-card__icon");
      if (!icon) {
        return;
      }
      button.classList.toggle("is-loading", Boolean(state.loadingAction && button.dataset.action === state.loadingAction));
    });

  }

  async function runHomeAction(actionName) {
    if (state.loadingAction || !petApi) {
      return;
    }

    const currentPet = store?.getState?.()?.pet;
    if (!currentPet) {
      return;
    }

    if (actionName === "feed") {
      window.dispatchEvent(
        new CustomEvent("edukids:pet:feed-requested", {
          detail: { source: "home-pet" },
        }),
      );
      return;
    }

    if (actionName === "inventory" || actionName === "shop") {
      window.dispatchEvent(
        new CustomEvent(`edukids:pet:${actionName}-requested`, {
          detail: { source: "home-pet" },
        }),
      );
      return;
    }

    setLoadingAction(actionName);
    state.lastFailedAction = actionName;
    hideError();

    try {
      const body = { idempotencyKey: createIdempotencyKey(actionName) };
      const response =
        actionName === "feed"
          ? await petApi.feedPet(body)
          : actionName === "play"
            ? await petApi.playPet(body)
            : await petApi.sleepPet(body);

      showBubble(response?.popupEvents?.[0]?.message || response?.message || "");

      const sanitizedResponse = {
        ...response,
        popupEvents: [],
      };

      if (store?.applyBackendResponse) {
        store.applyBackendResponse(sanitizedResponse, `home-${actionName}`);
      }

      if (actionName === "feed" && currentPet?.mood === "hungry") {
        const petElement = root.querySelector(".pet-home-pet");
        petElement?.classList.add("is-cheer");
        window.setTimeout(() => {
          petElement?.classList.remove("is-cheer");
        }, 640);
      }
      state.lastFailedAction = "";
    } catch (error) {
      const normalized = normalizeError(error);
      showError(normalized.message);
    } finally {
      setLoadingAction("");
    }
  }

  function handleClick(event) {
    const button = event.target.closest?.("[data-action]");
    if (!button) {
      return;
    }

    const action = button.dataset.action;
    if (!action) {
      return;
    }

    if (action === "retry") {
      if (state.lastFailedAction) {
        runHomeAction(state.lastFailedAction);
        return;
      }

      const snapshot = store?.getState?.() || {};
      render(snapshot);
      return;
    }

    if (action === "pet") {
      window.dispatchEvent(
        new CustomEvent("edukids:pet:interact", {
          detail: {
            source: "home-pet",
            petTypeId: store?.getState?.()?.pet?.petTypeId || "",
          },
        }),
      );
      root.querySelector(".pet-home-pet")?.classList.add("is-tap");
      window.setTimeout(() => {
        root.querySelector(".pet-home-pet")?.classList.remove("is-tap");
      }, 180);
      return;
    }

    runHomeAction(action);
  }

  function handleKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const button = event.target.closest?.("[data-action]");
    if (!button) {
      return;
    }

    event.preventDefault();
    button.click();
  }

  function syncFromStore(snapshot = {}) {
    const hasPet = Boolean(snapshot.pet) || snapshot.hasPet === true;
    const noPetKnown = snapshot.hasPet === false && !snapshot.pet;
    const feedPageOpen =
      typeof document !== "undefined" &&
      document.body?.classList?.contains("pet-feed-active");
    const inventoryPageOpen =
      typeof document !== "undefined" &&
      document.body?.classList?.contains("pet-inventory-active");

    if (noPetKnown) {
      state.visible = false;
      root.hidden = true;
      setBodyActive(false);
      clearBubble();
      return;
    }

    if (feedPageOpen || inventoryPageOpen) {
      state.visible = false;
      root.hidden = true;
      setBodyActive(false);
      return;
    }

    if (hasPet) {
      state.visible = true;
      root.hidden = false;
      render(snapshot);
      return;
    }

    // Show a lightweight skeleton while the app is still hydrating.
    root.hidden = false;
    setBodyActive(false);
    const refs = getRefs();
    if (refs.skeleton) {
      refs.skeleton.hidden = false;
    }
  }

  function mount() {
    if (state.mounted) {
      return;
    }

    root.addEventListener("click", handleClick);
    root.addEventListener("keydown", handleKeydown);
    state.mounted = true;
  }

  async function initialize() {
    mount();
    const snapshot = store?.getState?.() || {};
    syncFromStore(snapshot);
    state.initialized = true;
    if (!root.hidden) {
      scrollPageToTop(root);
    }
  }

  function destroy() {
    root.removeEventListener("click", handleClick);
    root.removeEventListener("keydown", handleKeydown);
    root.hidden = true;
    setBodyActive(false);
    clearBubble();
    state.mounted = false;
    state.visible = false;
  }

  if (store?.on) {
    store.on("STATE_UPDATED", syncFromStore);
  }

  return {
    initialize,
    destroy,
    show: () => {
      root.hidden = false;
      state.visible = true;
      setBodyActive(Boolean(store?.getState?.()?.pet));
      render(store?.getState?.() || {});
      scrollPageToTop(root);
    },
    hide: () => {
      root.hidden = true;
      state.visible = false;
      setBodyActive(false);
      clearBubble();
    },
    get state() {
      return { ...state };
    },
    get assetBackground() {
      const pet = store?.getState?.()?.pet || {};
      return resolveBackgroundPath({ petType: pet.petTypeId || pet.petType || "horse" });
    },
  };
}
