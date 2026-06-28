import { resolvePopupIconPath } from "../utils/assetResolver.js";
import { escapeHtml } from "../utils/dom.js";
import { mountIntoPetHost } from "../utils/pageHost.js";

const FEEDBACK_ROOT_ID = "edukids-pet-feedback-layer";
const MAX_QUEUE = 12;
const TOAST_DURATION = 2800;
const POPUP_DURATION = 2800;
const FLOAT_DURATION = 1600;
const PULSE_DURATION = 420;

const EVENT_PRIORITY = {
  EVOLUTION: 0,
  LEVEL_UP: 1,
  ACHIEVEMENT: 2,
  REWARD_GRANTED: 3,
  REWARD: 3,
  FEED_SUCCESS: 4,
  PLAY_SUCCESS: 4,
  SLEEP_SUCCESS: 4,
  SHOP_BUY_SUCCESS: 4,
  ITEM_USE: 4,
  PET_SELECTED: 4,
  SUCCESS: 5,
  INFO: 6,
  WARNING: 7,
  ERROR: 8,
  STAT: 9,
  MOOD: 10,
};

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeType(value) {
  return normalizeText(value).toUpperCase();
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(number)));
}

function getPriority(type) {
  return EVENT_PRIORITY[normalizeType(type)] ?? EVENT_PRIORITY.INFO;
}

function getTone(type) {
  const normalized = normalizeType(type);
  if (normalized === "ERROR") return "danger";
  if (normalized === "WARNING") return "warning";
  if (normalized === "INFO") return "info";
  return "success";
}

function buildRewardSummary(reward = {}) {
  const parts = [];

  if (Number(reward.coin) > 0) {
    parts.push(`+${formatNumber(reward.coin)} Xu Edu`);
  }

  if (Number(reward.petExp) > 0) {
    parts.push(`+${formatNumber(reward.petExp)} EXP`);
  }

  if (Number(reward.petHappiness) > 0) {
    parts.push(`+${formatNumber(reward.petHappiness)} Hạnh phúc`);
  }

  if (Number(reward.petEnergy) > 0) {
    parts.push(`+${formatNumber(reward.petEnergy)} Năng lượng`);
  }

  if (Number(reward.petHealth) > 0) {
    parts.push(`+${formatNumber(reward.petHealth)} Sức khỏe`);
  }

  if (Number(reward.petHunger) > 0) {
    parts.push(`+${formatNumber(reward.petHunger)} Độ no`);
  }

  return parts;
}

function getIconMarkup(type = "", event = {}) {
  const normalized = normalizeType(type);
  const inlineIcons = {
    EVOLUTION: `
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path d="M24 6 31 16h-5v14h5l-7 12-7-12h5V16h-5l7-10Z" fill="currentColor"></path>
        <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" stroke-width="2.2" opacity="0.18"></circle>
      </svg>
    `,
    LEVEL_UP: `
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path d="M24 8 12 22h8v18h8V22h8L24 8Z" fill="currentColor"></path>
      </svg>
    `,
    ACHIEVEMENT: `
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path d="M12 10h24v8c0 6.6-4.7 12.1-11.3 13.4V38h7.2v4H16.1v-4h7.2v-6.6C16.7 30.1 12 24.6 12 18v-8Z" fill="currentColor" opacity="0.18"></path>
        <path d="M16 12h16v6.2c0 4.9-3.7 9.1-8 10.2-4.3-1.1-8-5.3-8-10.2V12Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"></path>
        <path d="M24 20.3 25.8 24l4.1.6-3 2.9.7 4.1-3.6-1.9-3.6 1.9.7-4.1-3-2.9 4.1-.6L24 20.3Z" fill="currentColor"></path>
      </svg>
    `,
    REWARD_GRANTED: `
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path d="M14 12h20l-2 6H16l-2-6Zm-2 8h24v18H12V20Z" fill="currentColor" opacity="0.18"></path>
        <path d="M20 20c0-3 1.8-5 4-5s4 2 4 5h6v3H14v-3h6Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>
        <path d="M24 20v18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      </svg>
    `,
    FEED_SUCCESS: `
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path d="M14 14h20l-3 20H17l-3-20Z" fill="currentColor" opacity="0.18"></path>
        <path d="M20 14c0-2 1.8-4 4-4s4 2 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
        <path d="M18 20h12M17 25h14M18 30h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      </svg>
    `,
    PLAY_SUCCESS: `
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path d="M18 14 34 24 18 34V14Z" fill="currentColor"></path>
        <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" stroke-width="2.2" opacity="0.18"></circle>
      </svg>
    `,
    SLEEP_SUCCESS: `
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path d="M14 28c0-5.5 4.5-10 10-10s10 4.5 10 10-4.5 10-10 10-10-4.5-10-10Z" fill="currentColor" opacity="0.18"></path>
        <path d="M20 18c2.6 0 5 1 6.8 2.7C29 22.5 30 25 30 27.8c0 4.7-3.7 8.5-8.4 8.5-2.7 0-5.2-1.3-6.8-3.5 2.1-.5 3.7-2.4 3.7-4.7 0-1.9-1-3.5-2.5-4.4.8-3 3.3-5.7 4-5.7Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>
      </svg>
    `,
    SHOP_BUY_SUCCESS: `
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path d="M13 19h22l-2 14H15l-2-14Z" fill="currentColor" opacity="0.18"></path>
        <path d="M16 19c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
        <path d="M19 24h10M18 29h12M20 34h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      </svg>
    `,
    ITEM_USE: `
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path d="M16 12h16l4 8-12 16-12-16 4-8Z" fill="currentColor" opacity="0.18"></path>
        <path d="M18 14h12l3 6-9 12-9-12 3-6Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>
        <path d="M24 19v10M19 24h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      </svg>
    `,
    PET_SELECTED: `
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path d="M24 9c8.3 0 15 6.7 15 15s-6.7 15-15 15S9 32.3 9 24 15.7 9 24 9Z" fill="currentColor" opacity="0.18"></path>
        <path d="M24 14a10 10 0 1 1 0 20 10 10 0 0 1 0-20Z" fill="none" stroke="currentColor" stroke-width="2.2"></path>
      </svg>
    `,
  };

  if (inlineIcons[normalized]) {
    return inlineIcons[normalized];
  }

  const path = resolvePopupIconPath(event?.icon || type);
  if (path) {
    return `<img src="${escapeHtml(path)}" alt="" aria-hidden="true" />`;
  }

  return `<span class="pet-feedback-fallback-icon">${escapeHtml((normalized || "P").slice(0, 1))}</span>`;
}

function ensureFeedbackRoot() {
  let root = document.getElementById(FEEDBACK_ROOT_ID);

  if (!root) {
    root = document.createElement("div");
    root.id = FEEDBACK_ROOT_ID;
    root.className = "pet-feedback-layer";
    root.innerHTML = `
      <div class="pet-feedback-layer__toast-stack" data-feedback-toast-stack aria-live="polite" aria-atomic="true"></div>
      <div class="pet-feedback-layer__center-stack" data-feedback-center-stack aria-live="polite" aria-atomic="true"></div>
      <div class="pet-feedback-layer__float-stack" data-feedback-float-stack aria-hidden="true"></div>
    `;
    mountIntoPetHost(root);
  }

  return root;
}

function renderToastCard(event = {}, tone = "success") {
  const title = escapeHtml(normalizeText(event.title) || "Pet");
  const message = escapeHtml(normalizeText(event.message));

  return `
    <article class="pet-feedback-toast pet-feedback-toast--${escapeHtml(tone)}">
      <span class="pet-feedback-toast__icon" aria-hidden="true">${getIconMarkup(event.type, event)}</span>
      <div class="pet-feedback-toast__content">
        <strong>${title}</strong>
        ${message ? `<p>${message}</p>` : ""}
      </div>
    </article>
  `;
}

function renderPopupCard(event = {}, options = {}) {
  const title = escapeHtml(options.title || normalizeText(event.title) || "Pet");
  const tone = escapeHtml(options.tone || getTone(event.type));
  const badges = Array.isArray(options.badges) ? options.badges : [];
  const content = options.content || escapeHtml(normalizeText(event.message));

  return `
    <article class="pet-feedback-popup pet-feedback-popup--${tone}">
      <div class="pet-feedback-popup__icon" aria-hidden="true">${options.iconMarkup || getIconMarkup(event.type, event)}</div>
      <div class="pet-feedback-popup__content">
        <strong>${title}</strong>
        ${content}
        ${badges.length > 0 ? `
          <div class="pet-feedback-popup__badges">
            ${badges.map((badge) => `<span class="pet-feedback-badge">${escapeHtml(badge)}</span>`).join("")}
          </div>
        ` : ""}
      </div>
    </article>
  `;
}

function renderLevelUpCard(previousLevel, nextLevel) {
  return `
    <article class="pet-feedback-popup pet-feedback-popup--hero pet-feedback-popup--success">
      <div class="pet-feedback-popup__icon" aria-hidden="true">${getIconMarkup("LEVEL_UP")}</div>
      <div class="pet-feedback-popup__content">
        <strong>LEVEL UP!</strong>
        <div class="pet-feedback-compare">
          <strong>Cấp ${escapeHtml(previousLevel ?? "--")}</strong>
          <span>↓</span>
          <strong>Cấp ${escapeHtml(nextLevel ?? "--")}</strong>
        </div>
      </div>
    </article>
  `;
}

function renderEvolutionCard(previousStage, nextStage, petName) {
  return `
    <article class="pet-feedback-popup pet-feedback-popup--hero pet-feedback-popup--success">
      <div class="pet-feedback-popup__icon" aria-hidden="true">${getIconMarkup("EVOLUTION")}</div>
      <div class="pet-feedback-popup__content">
        <strong>Tiến hóa!</strong>
        <div class="pet-feedback-compare">
          <strong>${escapeHtml(previousStage || "baby")}</strong>
          <span>↓</span>
          <strong>${escapeHtml(nextStage || "baby")}</strong>
        </div>
        ${petName ? `<small>${escapeHtml(petName)}</small>` : ""}
      </div>
    </article>
  `;
}

function renderRewardCard(event = {}, reward = {}) {
  const summary = buildRewardSummary(reward);

  return renderPopupCard(event, {
    title: "Nhận thưởng",
    content: summary.length > 0
      ? `<p>${escapeHtml(summary.join(" • "))}</p>`
      : `<p>${escapeHtml(normalizeText(event.message) || "Bạn vừa nhận thưởng.")}</p>`,
    badges: Array.isArray(reward.badges) ? reward.badges : [],
    iconMarkup: getIconMarkup("REWARD_GRANTED", event),
  });
}

function renderAchievementCard(event = {}, reward = {}) {
  const badges = Array.isArray(reward.badges) ? reward.badges : [];

  return renderPopupCard(event, {
    title: "Mở khóa thành tựu",
    content: `<p>${escapeHtml(normalizeText(event.message) || "Bạn vừa đạt được một thành tựu mới.")}</p>`,
    badges,
    iconMarkup: getIconMarkup("ACHIEVEMENT", event),
  });
}

function renderSuccessToast(event = {}) {
  return renderToastCard(event, "success");
}

function renderFloatingItem(label, type = "REWARD") {
  return `
    <div class="pet-feedback-float pet-feedback-float--${escapeHtml(getTone(type))}">
      <span class="pet-feedback-float__icon" aria-hidden="true">${getIconMarkup(type)}</span>
      <strong>${escapeHtml(label)}</strong>
    </div>
  `;
}

function pulseElements(selectors, duration = PULSE_DURATION) {
  if (typeof document === "undefined") {
    return [];
  }

  const pulses = [];

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      if (!(element instanceof HTMLElement)) {
        return;
      }

      element.classList.remove("is-feedback-pulse");
      void element.offsetWidth;
      element.classList.add("is-feedback-pulse");
      const timerId = window.setTimeout(() => {
        element.classList.remove("is-feedback-pulse");
      }, duration);
      pulses.push(timerId);
    });
  });

  return pulses;
}

function normalizeEventSource(event = {}) {
  const type = normalizeType(event.type);

  return {
    ...event,
    type,
    priority: getPriority(type),
    channel: event.channel || (["EVOLUTION", "LEVEL_UP", "ACHIEVEMENT", "REWARD_GRANTED", "REWARD"].includes(type) ? "popup" : "toast"),
  };
}

function deriveEvents(snapshot = {}, previousSnapshot = null) {
  const events = [];
  const popupQueue = Array.isArray(snapshot.popupQueue) ? snapshot.popupQueue.filter(Boolean) : [];
  const response = snapshot.lastResponse || {};
  const reward = response?.data?.reward || response?.data?.rewardData || null;

  popupQueue.forEach((rawEvent) => {
    const event = normalizeEventSource(rawEvent);
    if (!event.type) {
      return;
    }

    if ((event.type === "REWARD_GRANTED" || event.type === "REWARD") && reward) {
      event.reward = reward;
    }

    events.push(event);
  });

  const currentPet = snapshot.pet || {};
  const previousPet = previousSnapshot?.pet || {};
  const previousLevel = Number(previousPet.level ?? 0);
  const currentLevel = Number(currentPet.level ?? 0);
  const previousStage = normalizeText(previousPet.stage || "");
  const currentStage = normalizeText(currentPet.stage || "");
  const hasLevelUpEvent = popupQueue.some((event) => normalizeType(event?.type) === "LEVEL_UP");
  const hasEvolutionEvent = popupQueue.some((event) => normalizeType(event?.type) === "EVOLUTION");
  const hasAchievementEvent = popupQueue.some((event) => normalizeType(event?.type) === "ACHIEVEMENT");
  const rewardBadges = Array.isArray(reward?.badges) ? reward.badges.filter(Boolean) : [];

  if (currentLevel > previousLevel && !hasLevelUpEvent) {
    events.push({
      type: "LEVEL_UP",
      channel: "popup",
      priority: getPriority("LEVEL_UP"),
      previousLevel,
      nextLevel: currentLevel,
    });
  }

  if (currentStage && previousStage !== currentStage && !hasEvolutionEvent) {
    events.push({
      type: "EVOLUTION",
      channel: "popup",
      priority: getPriority("EVOLUTION"),
      previousStage,
      nextStage: currentStage,
      petName: currentPet.petName || currentPet.name || "",
    });
  }

  if (rewardBadges.length > 0 && !hasAchievementEvent) {
    events.push({
      type: "ACHIEVEMENT",
      channel: "popup",
      priority: getPriority("ACHIEVEMENT"),
      reward,
      event: {
        type: "ACHIEVEMENT",
        title: "Mở khóa thành tựu",
        message: response.message || "Bạn vừa mở khóa một thành tựu mới.",
      },
    });
  }

  ["hunger", "happiness", "energy", "health"].forEach((stat) => {
    if (Number(previousPet?.[stat] ?? 0) === Number(currentPet?.[stat] ?? 0)) {
      return;
    }

    events.push({
      type: "STAT",
      channel: "pulse",
      priority: getPriority("STAT"),
      selectors: [
        `[data-home-stat-fill="${stat}"]`,
        `[data-feed-stat-fill="${stat}"]`,
        `[data-inventory-stat-fill="${stat}"]`,
      ],
    });
  });

  if (snapshot.error && snapshot.error !== previousSnapshot?.error) {
    events.push({
      type: "ERROR",
      channel: "toast",
      priority: getPriority("ERROR"),
      event: {
        type: "ERROR",
        title: "Đã có lỗi",
        message: snapshot.error.message || "Đã có lỗi xảy ra.",
      },
    });
  }

  return events.sort((left, right) => left.priority - right.priority);
}

function pulseStateElements(snapshot = {}, previousSnapshot = null) {
  const currentPet = snapshot.pet || {};
  const previousPet = previousSnapshot?.pet || {};
  const currentCoin = Number(snapshot.wallet?.eduCoin ?? 0);
  const previousCoin = Number(previousSnapshot?.wallet?.eduCoin ?? 0);

  if (Number(currentPet.exp ?? 0) !== Number(previousPet.exp ?? 0) || Number(currentPet.level ?? 0) !== Number(previousPet.level ?? 0)) {
    pulseElements(["[data-home-exp-fill]"], 520);
  }

  if (currentCoin !== previousCoin) {
    pulseElements([
      "[data-home-coin-chip]",
      "[data-home-coin]",
      "[data-feed-coin]",
      "[data-feed-coin-value]",
      "[data-inventory-coin]",
      "[data-inventory-coin-value]",
      "[data-shop-coin]",
      "[data-shop-coin-value]",
    ], 420);
  }

  ["hunger", "happiness", "energy", "health"].forEach((stat) => {
    if (Number(currentPet?.[stat] ?? 0) === Number(previousPet?.[stat] ?? 0)) {
      return;
    }

    pulseElements([
      `[data-home-stat-fill="${stat}"]`,
      `[data-feed-stat-fill="${stat}"]`,
      `[data-inventory-stat-fill="${stat}"]`,
    ], 420);
  });

  if (normalizeText(currentPet.mood || "") !== normalizeText(previousPet.mood || "")) {
    pulseElements(["[data-home-mood]", "[data-home-mood-icon]"], 1000);
  }
}

export function createFeedbackManager({ store } = {}) {
  const root = ensureFeedbackRoot();
  const state = {
    mounted: false,
    queue: [],
    active: false,
    lastSignature: "",
    previousSnapshot: null,
    unsubscribe: null,
    activeTimerId: null,
    floatTimerIds: new Set(),
  };

  function getRefs() {
    return {
      toastStack: root.querySelector("[data-feedback-toast-stack]"),
      centerStack: root.querySelector("[data-feedback-center-stack]"),
      floatStack: root.querySelector("[data-feedback-float-stack]"),
    };
  }

  function renderToast(markup) {
    const refs = getRefs();
    if (refs.toastStack) {
      refs.toastStack.innerHTML = markup;
    }
  }

  function renderCenter(markup) {
    const refs = getRefs();
    if (refs.centerStack) {
      refs.centerStack.innerHTML = markup;
    }
  }

  function clearTimer(timerId) {
    if (timerId) {
      window.clearTimeout(timerId);
    }
  }

  function clearFloatTimers() {
    state.floatTimerIds.forEach((timerId) => window.clearTimeout(timerId));
    state.floatTimerIds.clear();
  }

  function pushFloat(markup) {
    const refs = getRefs();
    if (!refs.floatStack) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.innerHTML = markup;
    const node = wrapper.firstElementChild;
    if (!node) {
      return;
    }

    refs.floatStack.appendChild(node);
    window.requestAnimationFrame(() => {
      node.classList.add("is-visible");
    });

    const timerId = window.setTimeout(() => {
      node.classList.add("is-leaving");
      const removeTimerId = window.setTimeout(() => {
        node.remove();
        state.floatTimerIds.delete(removeTimerId);
      }, 220);
      state.floatTimerIds.add(removeTimerId);
      state.floatTimerIds.delete(timerId);
    }, FLOAT_DURATION);

    state.floatTimerIds.add(timerId);
  }

  function clearActive() {
    renderToast("");
    renderCenter("");
    state.active = false;
    clearTimer(state.activeTimerId);
    state.activeTimerId = null;
  }

  function advanceQueue() {
    if (state.active) {
      return;
    }

    const next = state.queue.shift();
    if (!next) {
      return;
    }

    state.active = true;

    if (next.channel === "pulse") {
      pulseElements(next.selectors || []);
      state.activeTimerId = window.setTimeout(() => {
        clearActive();
        advanceQueue();
      }, 120);
      return;
    }

    if (next.channel === "float") {
      state.activeTimerId = window.setTimeout(() => {
        clearActive();
        advanceQueue();
      }, 120);
      return;
    }

    if (next.channel === "toast") {
      renderToast(renderToastCard(next.event || next, getTone(next.type)));
      state.activeTimerId = window.setTimeout(() => {
        clearActive();
        advanceQueue();
      }, TOAST_DURATION);
      return;
    }

    if (next.type === "LEVEL_UP") {
      renderCenter(renderLevelUpCard(next.previousLevel, next.nextLevel));
      state.activeTimerId = window.setTimeout(() => {
        clearActive();
        advanceQueue();
      }, POPUP_DURATION);
      return;
    }

    if (next.type === "EVOLUTION") {
      renderCenter(renderEvolutionCard(next.previousStage, next.nextStage, next.petName));
      state.activeTimerId = window.setTimeout(() => {
        clearActive();
        advanceQueue();
      }, POPUP_DURATION);
      return;
    }

    if (next.type === "ACHIEVEMENT") {
      renderCenter(renderAchievementCard(next.event || next, next.reward || {}));
      state.activeTimerId = window.setTimeout(() => {
        clearActive();
        advanceQueue();
      }, POPUP_DURATION);
      return;
    }

    if (next.type === "REWARD_GRANTED" || next.type === "REWARD") {
      const reward = next.reward || {};
      renderCenter(renderRewardCard(next.event || next, reward));
      state.activeTimerId = window.setTimeout(() => {
        clearActive();
        advanceQueue();
      }, POPUP_DURATION);
      return;
    }

    renderToast(renderToastCard(next.event || next, getTone(next.type)));
    state.activeTimerId = window.setTimeout(() => {
      clearActive();
      advanceQueue();
    }, TOAST_DURATION);
  }

  function ingest(snapshot = {}) {
    if (!snapshot || typeof snapshot !== "object") {
      return;
    }

    const response = snapshot.lastResponse || {};
    const signature = JSON.stringify({
      requestId: response.requestId || snapshot.requestId || "",
      popupQueue: snapshot.popupQueue || [],
      level: snapshot.pet?.level || 0,
      stage: snapshot.pet?.stage || "",
      mood: snapshot.pet?.mood || "",
      coin: snapshot.wallet?.eduCoin || 0,
      exp: snapshot.pet?.exp || 0,
      error: snapshot.error?.message || "",
    });

    if (signature === state.lastSignature) {
      return;
    }

    const previousSnapshot = state.previousSnapshot;
    pulseStateElements(snapshot, previousSnapshot);
    state.previousSnapshot = snapshot;
    state.lastSignature = signature;

    const nextEvents = deriveEvents(snapshot, previousSnapshot);
    if (nextEvents.length > 0) {
      state.queue.push(...nextEvents);
      while (state.queue.length > MAX_QUEUE) {
        state.queue.shift();
      }
      advanceQueue();
    }
  }

  function mount() {
    if (state.mounted) {
      return;
    }

    state.mounted = true;
    if (store?.on) {
      state.unsubscribe = store.on("STATE_UPDATED", ingest);
    }
  }

  function sync(snapshot = {}) {
    ingest(snapshot);
  }

  function destroy() {
    state.queue.length = 0;
    clearActive();
    clearFloatTimers();
    state.unsubscribe?.();
    state.unsubscribe = null;
    state.mounted = false;
  }

  mount();

  return {
    mount,
    sync,
    destroy,
    get state() {
      return {
        mounted: state.mounted,
        queueSize: state.queue.length,
      };
    },
  };
}
