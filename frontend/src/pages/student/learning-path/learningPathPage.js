import { API_BASE_URL } from "../../../config.js";
import { adaptLearningPathState } from "../../../data/learning-path/learningPathStateAdapter.js";
import {
  createGraphState,
  diffGraphState,
  getNodeIcon,
  renderGraphV3,
  updateAvatarPosition,
} from "./graphEngineV3.js";

const MODAL_CLOSE_MS = 220;
const TRANSITION_MS = 1700;

const CHECK_ICON = `
  <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
    <path
      d="M20 6.5 9.75 17.2 4 11.75"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
`;

const LOCK_ICON = `
  <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
    <path
      d="M7.5 10V8.2a4.5 4.5 0 1 1 9 0V10"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
    />
    <rect
      x="4.75"
      y="10"
      width="14.5"
      height="10.5"
      rx="2.8"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
    />
  </svg>
`;

const uiState = {
  bound: false,
  boundRoot: null,
  initialized: false,
  mounted: false,
  loading: false,
  backendState: null,
  graphState: null,
  errorMessage: "",
  authRetryTimer: null,
  authRetryStartedAt: 0,
  modalCheckpointId: null,
  modalClosing: false,
  modalCloseTimer: null,
  modalFocusRequested: false,
  taskResetCountdown: "00:00:00",
  taskResetTimer: null,
  rewardPopup: null,
  pendingRewardPopup: null,
  transition: null,
  transitionTimer: null,
  limitNotice: null,
};

function getLearningPathRoot() {
  return document.getElementById("learning-path");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeCssSelectorValue(value) {
  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function normalizePublicAssetPath(value) {
  const rawPath = String(value || "").trim().replaceAll("\\", "/");
  if (!rawPath) {
    return "";
  }

  const withoutPublicPrefix = rawPath.replace(/^\/?frontend\/public\/?/, "/").replace(/^frontend\/public\/?/, "/");
  if (withoutPublicPrefix.startsWith("/")) {
    return withoutPublicPrefix;
  }

  return `/${withoutPublicPrefix}`;
}

function uniqueByCheckpointId(checkpoints) {
  const seen = new Set();
  const uniqueCheckpoints = [];

  (Array.isArray(checkpoints) ? checkpoints : []).forEach((checkpoint) => {
    const checkpointId = String(checkpoint?.checkpointId || checkpoint?.id || "").trim();
    if (!checkpointId || seen.has(checkpointId)) {
      return;
    }

    seen.add(checkpointId);
    uniqueCheckpoints.push(checkpoint);
  });

  return uniqueCheckpoints;
}

function getLearningPathCheckpointId(checkpoint) {
  return String(checkpoint?.checkpointId || checkpoint?.id || "").trim();
}

function getLearningPathPageContent(root = getLearningPathRoot()) {
  return root?.querySelector?.("[data-learning-path-page-content]") || null;
}

function getLearningPathGraphViewport(root = getLearningPathRoot()) {
  return root?.querySelector?.("[data-learning-path-graph-viewport]") || null;
}

function getLearningPathGraphHeading(root = getLearningPathRoot()) {
  return root?.querySelector?.("[data-learning-path-graph-heading]") || null;
}

function getLearningPathGraphCaption(root = getLearningPathRoot()) {
  return root?.querySelector?.("[data-learning-path-graph-caption]") || null;
}

function getLearningPathLeftSlot(root = getLearningPathRoot()) {
  return root?.querySelector?.("[data-learning-path-left-slot]") || null;
}

function getLearningPathRightSlot(root = getLearningPathRoot()) {
  return root?.querySelector?.("[data-learning-path-right-slot]") || null;
}

function getLearningPathModalSlot(root = getLearningPathRoot()) {
  return root?.querySelector?.("[data-learning-path-modal-slot]") || null;
}

function getLearningPathRewardSlot(root = getLearningPathRoot()) {
  return root?.querySelector?.("[data-learning-path-reward-slot]") || null;
}

function getLearningPathCountdownNode(root = getLearningPathRoot()) {
  return root?.querySelector?.("[data-learning-path-reset-countdown]") || null;
}

function getLearningPathAvatarLayer(root = getLearningPathRoot()) {
  return root?.querySelector?.("#graph-avatar-layer") || null;
}

function commitLearningPathState() {
  const root = getLearningPathRoot();
  const state = getState();

  if (!root) {
    return;
  }

  if (!uiState.mounted) {
    root.innerHTML = renderLearningPathStaticShell(state || getEmptyLearningPathState());
    uiState.mounted = true;
    bindLearningPathControlsOnce();
  }

  const effectiveState = state || getEmptyLearningPathState();
  const nextGraphState = createGraphState(effectiveState);
  const graphDiff = diffGraphState(uiState.graphState, nextGraphState);
  uiState.graphState = nextGraphState;

  syncTaskResetCountdownTimer(uiState.modalCheckpointId !== null || uiState.modalClosing);
  syncLearningPathSlots(root, effectiveState, graphDiff);

  if (uiState.modalCheckpointId !== null && uiState.modalFocusRequested) {
    uiState.modalFocusRequested = false;
    const modalCloseButton = root.querySelector("[data-learning-path-close-modal]");
    if (modalCloseButton instanceof HTMLElement) {
      modalCloseButton.focus();
    }
  }
}

function scheduleRender() {
  commitLearningPathState();
}

function getEmptyLearningPathState() {
  return {
    season: null,
    mountain: null,
    checkpoints: [],
    rewards: { xu: 0, exp: 0, badges: [] },
    progressPercent: 0,
    checkpoint: null,
    avatar: { position: { left: 0, top: 0 } },
    checkpointProgress: { completed: 0, total: 0 },
    limits: {},
    currentCheckpointId: "everest-start",
    checkpointId: "everest-start",
    startPosition: { left: 0, top: 0, side: "left" },
  };
}

function clearTimers() {
  if (uiState.authRetryTimer) {
    window.clearTimeout(uiState.authRetryTimer);
    uiState.authRetryTimer = null;
  }

  if (uiState.modalCloseTimer) {
    window.clearTimeout(uiState.modalCloseTimer);
    uiState.modalCloseTimer = null;
  }

  if (uiState.taskResetTimer) {
    window.clearInterval(uiState.taskResetTimer);
    uiState.taskResetTimer = null;
  }

  if (uiState.transitionTimer) {
    window.clearTimeout(uiState.transitionTimer);
    uiState.transitionTimer = null;
  }
}

function closeLearningPathModalImmediate() {
  clearTimers();
  uiState.modalCheckpointId = null;
  uiState.modalClosing = false;
  uiState.modalFocusRequested = false;
  scheduleRender();
}

function requestLearningPathModalClose(afterClose) {
  if (uiState.modalCheckpointId === null) {
    if (typeof afterClose === "function") {
      afterClose();
    }
    return;
  }

  if (uiState.modalClosing) {
    return;
  }

  uiState.modalClosing = true;
  scheduleRender();

  uiState.modalCloseTimer = window.setTimeout(() => {
    uiState.modalCheckpointId = null;
    uiState.modalClosing = false;
    uiState.modalFocusRequested = false;
    uiState.taskResetCountdown = "00:00:00";
    scheduleRender();

    if (typeof afterClose === "function") {
      afterClose();
    }
  }, MODAL_CLOSE_MS);
}

function requestRewardPopupClose() {
  uiState.rewardPopup = null;
  uiState.pendingRewardPopup = null;
  scheduleRender();
}

function blurFocusedLearningPathElement() {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && typeof activeElement.blur === "function") {
    activeElement.blur();
  }
}

function blurFocusedLearningPathStationElement(root = getLearningPathRoot()) {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) {
    return;
  }

  const stationContainer = activeElement.closest(".learning-path-station-anchor");
  const journeyOverlay = activeElement.closest(".learning-path-journey-overlay");

  if (stationContainer || journeyOverlay) {
    blurFocusedLearningPathElement();
  }
}

function getState() {
  return uiState.backendState;
}

function getOfficialCurrentUser() {
  if (typeof window.checkAuth === "function") {
    const authUser = window.checkAuth();
    if (authUser && typeof authUser === "object") {
      return authUser;
    }
  }

  const bootstrapUser = window.__EDUKIDS_BOOTSTRAP__?.currentUser;
  if (bootstrapUser && typeof bootstrapUser === "object") {
    return bootstrapUser;
  }

  if (window.EduKidsCurrentUser && typeof window.EduKidsCurrentUser === "object") {
    return window.EduKidsCurrentUser;
  }

  return null;
}

function getCheckpointById(state, checkpointId) {
  return Array.isArray(state?.checkpoints)
    ? state.checkpoints.find((checkpoint) => checkpoint.id === checkpointId) || null
    : null;
}

function getActiveCheckpointRecord(state) {
  const checkpointId = uiState.modalCheckpointId || state.currentCheckpointId;
  return getCheckpointById(state, checkpointId);
}

function normalizeCheckpointStatus(status) {
  return String(status || "locked").toLowerCase();
}

function formatLearningPathMeters(value) {
  const digits = String(value ?? "")
    .replace(/[^\d]/g, "")
    .trim();

  if (!digits) {
    return "0 m";
  }

  const meters = Number(digits);
  if (!Number.isFinite(meters)) {
    return `${String(value).trim()} m`;
  }

  return `${meters.toLocaleString("vi-VN")} m`;
}

function getLearningPathUserId() {
  const currentUser = getOfficialCurrentUser();
  return String(currentUser?.uid || currentUser?.userId || currentUser?.id || "").trim();
}

function scheduleAuthReadyRetry() {
  if (uiState.authRetryTimer) {
    return;
  }

  if (!uiState.authRetryStartedAt) {
    uiState.authRetryStartedAt = Date.now();
  }

  const elapsedMs = Date.now() - uiState.authRetryStartedAt;
  const maxWaitMs = 5000;

  if (elapsedMs >= maxWaitMs) {
    uiState.loading = false;
    uiState.errorMessage =
      "Không xác định được người dùng hiện tại để tải Learning Path.";
    scheduleRender();
    return;
  }

  uiState.loading = true;
  uiState.errorMessage = "";
  scheduleRender();

  uiState.authRetryTimer = window.setTimeout(() => {
    uiState.authRetryTimer = null;
    void hydrateLearningPathStateFromBackend();
  }, 120);
}

function buildLearningPathApiUrl(path) {
  const normalizedPath = String(path || "").trim();
  const prefix = String(API_BASE_URL || "").trim().replace(/\/+$/, "");

  if (!prefix) {
    return normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
  }

  return `${prefix}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`;
}

function getLearningPathAuthHeaders() {
  const headers = {
    "Content-Type": "application/json",
  };

  const token = localStorage.getItem("authToken") || localStorage.getItem("token") || "";
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function requestLearningPathApi(path, { method = "GET", body } = {}) {
  const url = buildLearningPathApiUrl(path);

  const response = await fetch(url, {
    method,
    headers: getLearningPathAuthHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const rawText = await response.text().catch(() => "");
  let data = {};

  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { rawText };
    }
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }

  return data;
}

function extractRemoteLearningPathState(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (payload.state && typeof payload.state === "object") {
    return payload.state;
  }

  if (payload.learningPathState && typeof payload.learningPathState === "object") {
    return payload.learningPathState;
  }

  return payload;
}

async function hydrateLearningPathStateFromBackend() {
  const userId = getLearningPathUserId();
  if (!userId) {
    scheduleAuthReadyRetry();
    return null;
  }

  uiState.authRetryStartedAt = 0;
  if (uiState.authRetryTimer) {
    window.clearTimeout(uiState.authRetryTimer);
    uiState.authRetryTimer = null;
  }

  uiState.loading = true;
  uiState.errorMessage = "";
  scheduleRender();

  try {
    const data = await requestLearningPathApi(`/learning-path/state/${encodeURIComponent(userId)}`);
    const backendState = extractRemoteLearningPathState(data?.state);
    if (!backendState) {
      throw new Error("Backend Learning Path chưa trả về state hợp lệ.");
    }

    const remoteState = adaptLearningPathState(backendState);
    uiState.backendState = remoteState;
    uiState.loading = false;
    uiState.limitNotice = remoteState?.lockNotice || "";
    uiState.errorMessage = remoteState ? "" : "Backend Learning Path chưa trả về state hợp lệ.";
    applyLearningPathEvents(data?.events);
    commitLearningPathState();
    return remoteState;
  } catch (error) {
    uiState.backendState = null;
    uiState.loading = false;
    uiState.errorMessage =
      error?.message || "Không thể tải Learning Path từ backend.";
    commitLearningPathState();
    return null;
  }
}

async function performLearningPathAction(action, payload = {}) {
  const userId = getLearningPathUserId();
  const normalizedAction = String(action || "").trim();

  if (!normalizedAction) {
    return null;
  }

  if (!userId) {
    uiState.errorMessage = "Thiếu thông tin người dùng để gửi action Learning Path.";
    scheduleRender();
    return null;
  }

  try {
    const data = await requestLearningPathApi("/learning-path/action", {
      method: "POST",
      body: {
        userId,
        action: normalizedAction,
        payload,
      },
    });

    const backendState = extractRemoteLearningPathState(data?.state);
    if (!backendState) {
      throw new Error("Learning Path backend returned an empty state");
    }

    const remoteState = adaptLearningPathState(backendState);

    uiState.backendState = remoteState;
    uiState.errorMessage = "";
    uiState.limitNotice = remoteState?.lockNotice || "";
    applyLearningPathEvents(data?.events);
    commitLearningPathState();
    return remoteState;
  } catch (error) {
    uiState.errorMessage = error?.message || "Không thể thực hiện action Learning Path.";
    commitLearningPathState();
    return null;
  }
}

function openCheckpointModal(checkpointId) {
  const state = getState();
  const checkpoint = getCheckpointById(state, checkpointId);
  if (!checkpoint) {
    return;
  }

  const status = normalizeCheckpointStatus(checkpoint.status || checkpoint.state);
  if (status === "locked") {
    return;
  }

  if (
    String(checkpoint?.type || "").trim().toLowerCase() === "summit" &&
    (!Array.isArray(checkpoint?.tasks) || checkpoint.tasks.length === 0)
  ) {
    return;
  }

  blurFocusedLearningPathElement();

  uiState.modalCheckpointId = checkpoint.id;
  uiState.modalClosing = false;
  uiState.modalFocusRequested = true;
  scheduleRender();
}

function getTaskResetCountdownTarget(now = new Date()) {
  const nextReset = new Date(now);
  nextReset.setDate(now.getDate() + 1);
  nextReset.setHours(0, 0, 0, 0);
  return nextReset;
}

function formatCountdown(totalMs) {
  if (!Number.isFinite(totalMs) || totalMs < 0) {
    return "Đang làm mới...";
  }

  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function updateTaskResetCountdown() {
  const now = new Date();
  const nextReset = getTaskResetCountdownTarget(now);
  const diff = nextReset - now;
  uiState.taskResetCountdown = formatCountdown(diff);
  return uiState.taskResetCountdown;
}

function updateTaskResetCountdownLabel(root = getLearningPathRoot()) {
  if (!root) {
    return;
  }

  const countdownElement = root.querySelector(".learning-path-modal-reset-timer");
  if (!(countdownElement instanceof HTMLElement)) {
    return;
  }

  countdownElement.textContent = `Nhiệm vụ sẽ làm mới sau: ${uiState.taskResetCountdown || "00:00:00"}`;
}

function updateCountdownTextOnly(root = getLearningPathRoot()) {
  updateTaskResetCountdownLabel(root);
}

function syncTaskResetCountdownTimer(isModalVisible) {
  if (!isModalVisible) {
    if (uiState.taskResetTimer) {
      window.clearInterval(uiState.taskResetTimer);
      uiState.taskResetTimer = null;
    }
    return;
  }

  updateTaskResetCountdown();

  if (uiState.taskResetTimer) {
    return;
  }

  uiState.taskResetTimer = window.setInterval(() => {
    if (!(uiState.modalCheckpointId !== null || uiState.modalClosing)) {
      if (uiState.taskResetTimer) {
        window.clearInterval(uiState.taskResetTimer);
        uiState.taskResetTimer = null;
      }
      return;
    }

    updateTaskResetCountdown();
    updateCountdownTextOnly();
  }, 1000);
}

function clearTransitionTimer() {
  if (uiState.transitionTimer) {
    window.clearTimeout(uiState.transitionTimer);
    uiState.transitionTimer = null;
  }
}

function showCheckpointRewardPopup(event) {
  const checkpoint = event?.payload?.checkpoint || null;
  if (!checkpoint) {
    return false;
  }

  if (event?.payload?.suppressRewardPopup) {
    return false;
  }

  uiState.rewardPopup = {
    title: "🎉 Trạm đã hoàn thành",
    checkpointTitle: checkpoint.title || "",
    xu: checkpoint.reward?.xu || 50,
    exp: checkpoint.reward?.exp || 100,
  };
  return true;
}

function showAvatarTransition(event) {
  const payload = event?.payload || {};
  if (!payload.from || !payload.to) {
    return false;
  }

  clearTransitionTimer();
  uiState.transition = {
    from: payload.from,
    to: payload.to,
    toCheckpointId: payload.checkpointId,
    started: false,
  };

  uiState.transitionTimer = window.setTimeout(() => {
    if (uiState.pendingRewardPopup) {
      uiState.rewardPopup = uiState.pendingRewardPopup;
      uiState.pendingRewardPopup = null;
    }
    uiState.transition = null;
    scheduleRender();
  }, TRANSITION_MS);

  return true;
}

function showMountainCompletionPopup(event) {
  const payload = event?.payload || {};
  const mountain = payload.mountain || null;
  if (!mountain) {
    return false;
  }

  uiState.pendingRewardPopup = {
    title: `🏆 Chinh phục thành công ${mountain.name || "ngọn núi"}`,
    checkpointTitle: mountain.name || "",
    xu: Number(payload.reward?.xu ?? 200) || 200,
    exp: Number(payload.reward?.exp ?? 250) || 250,
    badgeName: mountain.badge?.name || "",
    unlockNext: true,
  };

  return true;
}

function applyLearningPathEvent(event) {
  if (!event || typeof event !== "object") {
    return false;
  }

  switch (event.eventName) {
    case "STATE_CHANGED":
    case "TASK_COMPLETED":
    case "TASK_PROGRESS_UPDATED":
    case "CHECKPOINT_UNLOCKED":
      return true;
    case "CHECKPOINT_COMPLETED":
      return showCheckpointRewardPopup(event);
    case "MOUNTAIN_COMPLETED":
      return showMountainCompletionPopup(event);
    case "CHECKPOINT_BLOCKED":
    case "DAILY_LIMIT_REACHED":
    case "WEEKLY_LIMIT_REACHED":
      uiState.limitNotice = event?.payload?.reason || event.eventName || null;
      return true;
    case "REWARD_GRANTED":
      return true;
    case "AVATAR_POSITION_CHANGED":
      return showAvatarTransition(event);
    default:
      return true;
  }
}

function applyLearningPathEvents(events) {
  if (!Array.isArray(events)) {
    return false;
  }

  return events.reduce((shouldRender, event) => applyLearningPathEvent(event) || shouldRender, false);
}

function getCurrentMountain(state) {
  return state?.mountain || state?.season?.mountains?.[0] || null;
}

function getNextMountain(state) {
  const mountains = Array.isArray(state?.season?.mountains) ? state.season.mountains : [];
  const currentMountainId = String(state?.currentMountainId || state?.mountainId || state?.mountain?.id || "").trim();
  const currentIndex = mountains.findIndex((mountain) => mountain.id === currentMountainId);

  if (currentIndex >= 0) {
    return mountains[currentIndex + 1] || null;
  }

  return mountains[1] || null;
}

function getSummitCheckpoint(mountain) {
  return Array.isArray(mountain?.checkpoints)
    ? mountain.checkpoints.find((checkpoint) => String(checkpoint?.type || "").trim().toLowerCase() === "summit") || null
    : null;
}

function getCurrentCheckpoint(state) {
  return state?.checkpoint || null;
}

function getTaskActionPageId(task) {
  const route = String(task?.targetRoute || "").trim();

  if (route === "/student/assignments") {
    return "assignments";
  }

  if (route === "/student/quiz-ai") {
    return "subjects";
  }

  if (route === "/student/ai-coach") {
    return "ai-coach";
  }

  return "";
}

function isLoadingState() {
  return uiState.loading && !uiState.backendState;
}

function renderMountainCard(mountain, state) {
  const isSelected = mountain.id === state.currentMountainId;
  const mountainIcon = getNodeIcon(mountain.id);

  return `
    <button
      class="learning-path-mountain-card${isSelected ? " is-selected" : ""}${mountain.locked && !isSelected ? " is-locked" : ""}"
      type="button"
      ${mountain.locked && !isSelected ? 'aria-disabled="true" disabled' : ""}
      data-page="learning-path"
    >
      <span class="learning-path-mountain-thumb" aria-hidden="true">
        <span class="learning-path-mountain-thumb-fallback" aria-hidden="true">⛰️</span>
        <img
          class="learning-path-mountain-thumb-image"
          src="${escapeHtml(mountainIcon)}"
          alt=""
          loading="lazy"
          decoding="async"
          onerror="this.style.display='none'; this.parentElement?.classList.add('is-image-missing');"
        />
      </span>
      <span class="learning-path-mountain-copy">
        <span class="learning-path-mountain-continent">${escapeHtml(mountain.continent)}</span>
        <strong class="learning-path-mountain-name">${escapeHtml(mountain.name)}</strong>
        <span class="learning-path-mountain-height">${escapeHtml(mountain.height)}</span>
      </span>
      <span class="learning-path-mountain-lock" aria-hidden="true">
        ${mountain.locked && !isSelected ? LOCK_ICON : ""}
      </span>
    </button>
  `;
}

function renderMountainList(state) {
  const mountains = Array.isArray(state.season?.mountains) ? state.season.mountains : [];

  return `
    <section class="learning-path-panel learning-path-list-panel">
      <div class="learning-path-panel-head">
        <div>
          <span class="learning-path-panel-eyebrow">Mùa 1: 7 đỉnh cao thế giới</span>
          <h2>7 châu lục, 7 thử thách</h2>
        </div>
      </div>
      <div class="learning-path-mountain-list">
        ${mountains
          .map((mountain) =>
            renderMountainCard(
              {
                ...mountain,
                locked: mountain.id !== state.currentMountainId && mountain.locked,
              },
              state,
            ),
          )
          .join("")}
      </div>
    </section>
  `;
}

function getCheckpointPosition(checkpoint) {
  return checkpoint?.position || { left: 0, top: 0 };
}

function renderCheckpointNode(checkpoint, status, state) {
  if (status === "locked") {
    return `
      <span
        class="learning-path-station-checkpoint is-locked"
      ></span>
    `;
  }

  if (status === "current") {
    return `
      <button
        type="button"
        class="learning-path-station-checkpoint learning-path-station-checkpoint-button"
        data-learning-path-open-checkpoint
        data-checkpoint="${escapeHtml(checkpoint.id)}"
        data-learning-path-checkpoint="${escapeHtml(checkpoint.id)}"
        aria-label="Mở nhiệm vụ ${escapeHtml(checkpoint.title)}"
      >
      </button>
    `;
  }

  return `
    <button
      type="button"
      class="learning-path-station-checkpoint is-completed"
      data-learning-path-open-checkpoint
      data-checkpoint="${escapeHtml(checkpoint.id)}"
      data-learning-path-checkpoint="${escapeHtml(checkpoint.id)}"
      aria-label="Xem lại ${escapeHtml(checkpoint.title)}"
    >
      <span class="learning-path-station-status-badge">${CHECK_ICON}</span>
    </button>
  `;
}

function renderStationNode(checkpoint, state) {
  const status = normalizeCheckpointStatus(checkpoint?.status || checkpoint?.state);
  const position = getCheckpointPosition(checkpoint);
  const sideClass = position.side === "left" ? " is-left" : " is-right";
  const statusClass =
    status === "current"
      ? " is-current"
      : status === "completed"
        ? " is-completed"
        : " is-locked";

  return `
    <div
      class="learning-path-station${sideClass}${statusClass}"
      style="left: ${position.left}%; top: ${position.top}%;"
      data-checkpoint="${escapeHtml(checkpoint.id)}"
      data-learning-path-checkpoint="${escapeHtml(checkpoint.id)}"
    >
      <div class="learning-path-station-anchor">
        ${renderCheckpointNode(checkpoint, status, state)}
      </div>
      <div class="learning-path-station-copy">
        <strong>${escapeHtml(checkpoint.title)}</strong>
        <span>${escapeHtml(checkpoint.altitude || "")}</span>
      </div>
    </div>
  `;
}

function renderMovingAvatar() {
  const transition = uiState.transition;
  if (!transition) {
    return "";
  }

  return `
    <span
      class="learning-path-station-avatar learning-path-moving-avatar"
      data-learning-path-moving-avatar
      style="left: ${transition.from.left}%; top: ${transition.from.top}%;"
      aria-hidden="true"
    >
      <img src="/assets/userAvatar/boy.png" alt="" loading="lazy" decoding="async" />
    </span>
  `;
}

function renderProgressCard(state) {
  const mountain = getCurrentMountain(state);
  const altitudeLabel = formatLearningPathMeters(state.avatar?.altitudeLabel || state.checkpoint?.altitude || 0);
  const targetAltitude = formatLearningPathMeters(mountain?.height || 0);
  return `
    <aside class="learning-path-progress-card">
      <h3>Tiến độ của bạn</h3>
      <div class="learning-path-progress-bar" aria-hidden="true">
        <span style="width: ${Math.max(0, Math.min(Number(state.progressPercent) || 0, 100))}%"></span>
      </div>
      <div class="learning-path-progress-meta">
        <strong>${escapeHtml(altitudeLabel)}</strong>
        <span>/ ${escapeHtml(targetAltitude)}</span>
      </div>
    </aside>
  `;
}

function renderRewardSection(state) {
  const mountain = getCurrentMountain(state);
  const nextMountain = getNextMountain(state);
  const summitCheckpoint = getSummitCheckpoint(mountain);
  const summitReward = summitCheckpoint?.reward || {};
  const rewardXu = Number(summitReward.xu ?? 200) || 200;
  const rewardExp = Number(summitReward.exp ?? 250) || 250;
  const badgeName = mountain?.badge?.name || (mountain?.name ? `Huy hiệu ${mountain.name}` : "Huy hiệu đỉnh núi");
  const unlockNextName = nextMountain?.name || "đỉnh tiếp theo";

  return `
    <div class="learning-path-reward-grid learning-path-reward-row">
      <div class="learning-path-reward-item is-gold">
        <span class="learning-path-reward-icon" aria-hidden="true">🪙</span>
        <div class="learning-path-reward-copy">
          <strong>+${escapeHtml(rewardXu)} Xu Edu</strong>
          <span>Phần thưởng chinh phục đỉnh</span>
        </div>
      </div>
      <div class="learning-path-reward-item is-amber">
        <span class="learning-path-reward-icon" aria-hidden="true">⭐</span>
        <div class="learning-path-reward-copy">
          <strong>+${escapeHtml(rewardExp)} EXP</strong>
          <span>Kinh nghiệm chinh phục đỉnh</span>
        </div>
      </div>
      <div class="learning-path-reward-item is-blue">
        <span class="learning-path-reward-icon" aria-hidden="true">🏅</span>
        <div class="learning-path-reward-copy">
          <strong>${escapeHtml(badgeName)}</strong>
          <span>Huy hiệu ${escapeHtml(mountain?.name || "")}</span>
        </div>
      </div>
      <div class="learning-path-reward-item is-green">
        <span class="learning-path-reward-icon" aria-hidden="true">🏔️</span>
        <div class="learning-path-reward-copy">
          <strong>Mở khóa ${escapeHtml(unlockNextName)}</strong>
          <span>Ngọn núi tiếp theo</span>
        </div>
      </div>
    </div>
  `;
}

function renderLearningPathLeftSlot(state) {
  const errorNotice = uiState.errorMessage
    ? `
      <section class="learning-path-panel learning-path-error-panel" role="alert">
        <div class="learning-path-panel-head">
          <div>
            <span class="learning-path-panel-eyebrow">Backend Learning Path</span>
            <h2>Không thể đồng bộ dữ liệu</h2>
          </div>
        </div>
        <p>${escapeHtml(uiState.errorMessage)}</p>
        <button type="button" class="learning-path-task-action-btn" data-learning-path-retry-load>
          Thử tải lại
        </button>
      </section>
    `
    : "";
  const loadingNotice = isLoadingState()
    ? `
      <section class="learning-path-panel learning-path-error-panel" role="status">
        <div class="learning-path-panel-head">
          <div>
            <span class="learning-path-panel-eyebrow">Đang tải</span>
            <h2>Đồng bộ Learning Path từ backend</h2>
          </div>
        </div>
        <p>Vui lòng chờ trong giây lát.</p>
      </section>
    `
    : "";
  const limitNotice = uiState.limitNotice
    ? `
      <section class="learning-path-panel learning-path-error-panel" role="status">
        <div class="learning-path-panel-head">
          <div>
            <span class="learning-path-panel-eyebrow">Giới hạn backend</span>
            <h2>Không thể tiếp tục</h2>
          </div>
        </div>
        <p>${escapeHtml(uiState.limitNotice)}</p>
      </section>
    `
    : "";

  return `
    ${errorNotice}
    ${loadingNotice}
    ${limitNotice}
    ${renderMountainList(state)}
  `;
}

function renderLearningPathGraphPanelShell(state) {
  const mountain = getCurrentMountain(state);
  return `
    <section class="learning-path-panel learning-path-journey-panel">
      <div
        class="learning-path-journey-stage"
        style="background-image: url('${escapeHtml(mountain?.backgroundImage || "")}');"
      >
        <div class="learning-path-journey-glow"></div>
        <div class="learning-path-journey-copy">
          <span class="learning-path-level-pill">${escapeHtml(`Cấp độ ${state.season?.order || 1}`)}</span>
          <h2>${escapeHtml(mountain?.name || "")}</h2>
          <p class="learning-path-location">
            📍 ${escapeHtml(mountain?.continent || "")} | ${escapeHtml(mountain?.height || "")}
          </p>
          <p class="learning-path-description">${escapeHtml(mountain?.description || "")}</p>
        </div>
        <div class="learning-path-journey-overlay">
          <div class="learning-path-route" data-learning-path-graph-viewport>
            <div data-learning-path-graph-nodes></div>
            ${renderMovingAvatar()}
          </div>
        </div>

        ${renderProgressCard(state)}
      </div>
    </section>
  `;
}

function renderLearningPathStaticShell(state) {
  const modalHtml =
    uiState.modalCheckpointId !== null || uiState.modalClosing
      ? renderLearningPathTaskModal(state)
      : "";

  return `
    <div class="learning-path-page${modalHtml || uiState.rewardPopup ? " is-modal-open" : ""}" data-learning-path-page>
      <header class="learning-path-header">
        <div class="learning-path-header-copy">
          <span class="learning-path-title" data-learning-path-header-title>🏔️ Hành Trình Chinh Phục</span>
          <p>Chinh phục 7 đỉnh núi cao nhất 7 châu lục</p>
        </div>
        <div class="learning-path-coin-card" aria-label="Xu Edu hiện có">
          <span class="learning-path-coin-label">🪙 Xu Edu</span>
          <strong data-learning-path-coin-count>${escapeHtml(state.rewards?.xu || 0)}</strong>
        </div>
      </header>

      <div class="learning-path-main-grid" data-learning-path-page-content>
        <div class="learning-path-left-column" data-learning-path-left-slot>
          ${renderLearningPathLeftSlot(state)}
        </div>
        <div class="learning-path-right-column" data-learning-path-right-slot>
          ${renderLearningPathGraphPanelShell(state)}
        </div>
      </div>

      <div data-learning-path-reward-slot>
        ${renderRewardSection(state)}
      </div>

      <div data-learning-path-modal-slot>
        ${modalHtml}
      </div>

      <div data-learning-path-popup-slot>
        ${renderRewardPopup(state)}
      </div>
    </div>
  `;
}

function syncLearningPathSlots(root, state, graphDiff) {
  const leftSlot = getLearningPathLeftSlot(root);
  if (leftSlot) {
    leftSlot.innerHTML = renderLearningPathLeftSlot(state);
  }

  const rewardSlot = getLearningPathRewardSlot(root);
  if (rewardSlot) {
    rewardSlot.innerHTML = renderRewardSection(state);
  }

  const popupSlot = root?.querySelector?.("[data-learning-path-popup-slot]");
  if (popupSlot) {
    popupSlot.innerHTML = renderRewardPopup(state);
  }

  const modalSlot = getLearningPathModalSlot(root);
  if (modalSlot) {
    modalSlot.innerHTML =
      uiState.modalCheckpointId !== null || uiState.modalClosing
        ? renderLearningPathTaskModal(state)
        : "";
  }

  const coinCount = root.querySelector("[data-learning-path-coin-count]");
  if (coinCount instanceof HTMLElement) {
    coinCount.textContent = String(state.rewards?.xu || 0);
  }

  const page = root.querySelector("[data-learning-path-page]");
  if (page instanceof HTMLElement) {
    page.classList.toggle("is-modal-open", Boolean(uiState.modalCheckpointId !== null || uiState.modalClosing || uiState.rewardPopup));
  }

  if (graphDiff?.versionChanged) {
    const rightSlot = getLearningPathRightSlot(root);
    if (rightSlot) {
      rightSlot.innerHTML = renderLearningPathGraphPanelShell(state);
    }
    renderGraphV3(root, uiState.graphState, { modalOpen: Boolean(uiState.modalCheckpointId !== null || uiState.modalClosing) });
    syncGraphAvatarVisibility(root);
    if (uiState.transition && !uiState.transition.started) {
      startAvatarTransitionAnimation(root);
    }
    return;
  }

  if (graphDiff?.avatarChanged) {
    updateAvatarPosition(root, uiState.graphState);
  }

  const graphViewport = getLearningPathGraphViewport(root);
  if (graphViewport instanceof HTMLElement) {
    graphViewport.inert = Boolean(uiState.modalCheckpointId !== null || uiState.modalClosing);
  }

  syncGraphAvatarVisibility(root);
  syncMovingAvatarLayer(root);
}

function startAvatarTransitionAnimation(root = getLearningPathRoot()) {
  const transition = uiState.transition;
  if (!root || !transition || transition.started) {
    return;
  }

  const movingAvatar = root.querySelector("[data-learning-path-moving-avatar]");
  if (!(movingAvatar instanceof HTMLElement)) {
    return;
  }

  transition.started = true;
  window.requestAnimationFrame(() => {
    if (!uiState.transition || !movingAvatar.isConnected) {
      return;
    }

    movingAvatar.style.left = `${uiState.transition.to.left}%`;
    movingAvatar.style.top = `${uiState.transition.to.top}%`;
  });
}

function syncGraphAvatarVisibility(root = getLearningPathRoot()) {
  const avatarLayer = root?.querySelector?.("#graph-avatar-layer");
  if (!(avatarLayer instanceof HTMLElement)) {
    return;
  }

  avatarLayer.style.opacity = uiState.transition ? "0" : "1";
}

function syncMovingAvatarLayer(root = getLearningPathRoot()) {
  const movingAvatar = root?.querySelector?.("[data-learning-path-moving-avatar]");
  if (!(movingAvatar instanceof HTMLElement)) {
    return;
  }

  if (!uiState.transition) {
    movingAvatar.remove();
  }
}

function renderTaskActionButton(task) {
  const pageId = getTaskActionPageId(task);
  if (!pageId) {
    return "";
  }

  return `
    <button
      type="button"
      class="learning-path-task-action-btn"
      data-page="${escapeHtml(pageId)}"
    >
      Thực hiện
    </button>
  `;
}

function formatTaskProgressText(task) {
  const progress = task?.progress || {};
  if (String(progress.label || "").trim()) {
    return String(progress.label).trim();
  }

  const threshold = Math.max(1, Number(progress.total || task?.threshold || 1) || 1);
  const rawCurrent = Number.isFinite(Number(progress.rawCurrent)) ? Number(progress.rawCurrent) : Number(progress.current);
  const completed = task?.state === "DONE" || task?.status === "DONE" || progress.completed === true;
  const currentValue = Number.isFinite(rawCurrent)
    ? Math.max(0, Math.floor(completed ? Math.min(rawCurrent, threshold) : Math.min(rawCurrent, threshold)))
    : completed
      ? threshold
      : 0;
  const displayCurrent = Math.min(currentValue, threshold);
  const unit = String(progress.unit || "").trim() || "lần";

  return `${displayCurrent} / ${threshold} ${unit}`;
}

function renderTaskCard(task) {
  return `
    <article class="learning-path-task-card${task.state === "DONE" ? " is-completed" : ""}">
      <div class="learning-path-task-head">
        <span class="learning-path-task-icon" aria-hidden="true">${escapeHtml(task.icon || "📘")}</span>
        <div class="learning-path-task-copy">
          <strong>${escapeHtml(task.title || "Nhiệm vụ")}</strong>
          <p>${escapeHtml(formatTaskProgressText(task))}</p>
        </div>
      </div>
      <div class="learning-path-task-footer">
        <span class="learning-path-task-status${task.state === "DONE" ? " is-completed" : ""}">
          ${task.state === "DONE" ? "✓ Đã hoàn thành" : "Chưa hoàn thành"}
        </span>
        ${renderTaskActionButton(task)}
      </div>
    </article>
  `;
}

function renderLearningPathTaskModal(state) {
  const checkpoint = getActiveCheckpointRecord(state);
  if (!checkpoint) {
    return "";
  }

  const tasks = Array.isArray(checkpoint.tasks) ? checkpoint.tasks : [];
  const completedCount = Number(state.checkpointProgress?.completed) || 0;
  const totalCount = Number(state.checkpointProgress?.total) || tasks.length || 3;
  const allCompleted = totalCount > 0 && completedCount >= totalCount;
  const progressLabel = `${completedCount} / ${totalCount} nhiệm vụ`;

  return `
    <div
      class="learning-path-modal-overlay${uiState.modalClosing ? " is-closing" : " is-open"}"
      data-learning-path-modal-overlay
      role="presentation"
    >
      <section
        class="learning-path-modal${uiState.modalClosing ? " is-closing" : " is-open"}"
        role="dialog"
        aria-modal="true"
        aria-labelledby="learning-path-modal-title"
      >
        <header class="learning-path-modal-header">
          <div>
            <p class="learning-path-modal-kicker">Nhiệm vụ trạm</p>
            <h3 id="learning-path-modal-title">${escapeHtml(checkpoint.title)}</h3>
          </div>
          <button
            type="button"
            class="learning-path-modal-close"
            data-learning-path-close-modal
            aria-label="Đóng"
          >
            ✕
          </button>
        </header>

        <div class="learning-path-modal-progress">
          <div class="learning-path-modal-progress-head">
            <span>Tiến độ trạm</span>
            <strong>${escapeHtml(progressLabel)}</strong>
          </div>
          <div class="learning-path-modal-progress-track" aria-hidden="true">
            <span style="width: ${totalCount ? Math.max(0, Math.min((completedCount / totalCount) * 100, 100)) : 0}%"></span>
          </div>
          <p class="learning-path-modal-reset-timer">
            Nhiệm vụ sẽ làm mới sau: ${escapeHtml(uiState.taskResetCountdown || "00:00:00")}
          </p>
        </div>

        <div class="learning-path-modal-task-list">
          ${tasks.map((task) => renderTaskCard(task)).join("")}
        </div>

        <div class="learning-path-modal-reward-card${allCompleted ? " is-complete" : ""}">
          <p>
            ${allCompleted ? "🎉 Trạm đã hoàn thành" : "Hoàn thành tất cả nhiệm vụ để nhận:"}
          </p>
          <strong>+${escapeHtml(checkpoint.reward?.xu || 20)} Xu Edu</strong>
          <strong>+${escapeHtml(checkpoint.reward?.exp || 50)} EXP</strong>
        </div>

        ${
          allCompleted
            ? `
              <div class="learning-path-modal-complete-footer">
                <button
                  type="button"
                  class="learning-path-modal-next-btn"
                  data-learning-path-next-station
                >
                  Tiến lên trạm tiếp theo
                </button>
              </div>
            `
            : ""
        }
      </section>
    </div>
  `;
}

function renderRewardPopup(state) {
  if (!uiState.rewardPopup) {
    return "";
  }

  const hasBadgeReward = Boolean(uiState.rewardPopup.badgeName);
  const showExp = Number(uiState.rewardPopup.exp) > 0;
  const showUnlockNext = Boolean(uiState.rewardPopup.unlockNext);
  const mountain = getCurrentMountain(state);
  const nextMountain = getNextMountain(state);
  const rewardIntro = showUnlockNext
    ? `Nhận: ${mountain?.name || uiState.rewardPopup.checkpointTitle || ""}`
    : uiState.rewardPopup.checkpointTitle;
  const unlockNextLabel = nextMountain?.name || "đỉnh tiếp theo";
  const rewardXu = showUnlockNext ? Number(uiState.rewardPopup.xu) || 200 : Number(uiState.rewardPopup.xu) || 0;
  const rewardExp = showUnlockNext ? Number(uiState.rewardPopup.exp) || 250 : Number(uiState.rewardPopup.exp) || 0;

  return `
    <div class="learning-path-modal-overlay is-open" role="presentation">
      <section class="learning-path-modal is-open" role="dialog" aria-modal="true">
        <header class="learning-path-modal-header">
          <div>
            <p class="learning-path-modal-kicker">Phần thưởng</p>
            <h3>${escapeHtml(uiState.rewardPopup.title)}</h3>
          </div>
        </header>
        <div class="learning-path-modal-reward-card is-complete">
          <p>${escapeHtml(rewardIntro)}</p>
          <strong>+${escapeHtml(rewardXu)} Xu Edu</strong>
          ${showExp ? `<strong>+${escapeHtml(rewardExp)} EXP</strong>` : ""}
          ${hasBadgeReward ? `<strong>+${escapeHtml(uiState.rewardPopup.badgeName)}</strong>` : ""}
          ${showUnlockNext ? `<strong>Mở khóa ${escapeHtml(unlockNextLabel)}</strong>` : ""}
        </div>
        <div class="learning-path-modal-complete-footer">
          <button
            type="button"
            class="learning-path-modal-next-btn"
            data-learning-path-close-reward-popup
          >
            Tiếp tục
          </button>
        </div>
      </section>
    </div>
  `;
}

function handleTaskCompletion(taskId) {
  void performLearningPathAction("COMPLETE_TASK", {
    taskId,
    checkpointId: uiState.modalCheckpointId || getState()?.checkpointId || "",
  });
}

function handleNextCheckpoint() {
  void performLearningPathAction("NEXT_CHECKPOINT");
}

function bindLearningPathControlsOnce() {
  const root = getLearningPathRoot();
  if (!root) {
    return;
  }

  if (uiState.bound && uiState.boundRoot === root) {
    return;
  }

  if (uiState.boundRoot && uiState.boundRoot !== root) {
    uiState.boundRoot.removeEventListener("click", handleLearningPathRootClick);
  }

  uiState.bound = true;
  uiState.boundRoot = root;
  root.addEventListener("click", handleLearningPathRootClick);
}

function handleLearningPathRootClick(event) {
  const root = getLearningPathRoot();
  if (!root || !root.contains(event.target)) {
    return;
  }

  const target = event.target instanceof Element ? event.target : null;
  if (!target) {
    return;
  }

  const avatarTrigger = target.closest("[data-learning-path-avatar-open]");
  if (avatarTrigger) {
    event.preventDefault();
    blurFocusedLearningPathElement();
    openCheckpointModal(getState()?.currentCheckpointId || getState()?.checkpointId || "everest-start");
    return;
  }

  const retryButton = target.closest("[data-learning-path-retry-load]");
  if (retryButton) {
    event.preventDefault();
    void hydrateLearningPathStateFromBackend();
    return;
  }

  const closeButton = target.closest("[data-learning-path-close-modal]");
  if (closeButton) {
    event.preventDefault();
    requestLearningPathModalClose();
    return;
  }

  const rewardPopupCloseButton = target.closest("[data-learning-path-close-reward-popup]");
  if (rewardPopupCloseButton) {
    event.preventDefault();
    requestRewardPopupClose();
    return;
  }

  const openCheckpointTrigger = target.closest("[data-learning-path-open-checkpoint]");
  if (openCheckpointTrigger) {
    event.preventDefault();
    blurFocusedLearningPathElement();
    openCheckpointModal(openCheckpointTrigger.dataset.learningPathCheckpoint);
    return;
  }

  const checkpointTrigger = target.closest("[data-checkpoint]");
  if (checkpointTrigger && checkpointTrigger.closest(".learning-path-journey-overlay")) {
    const checkpointId = checkpointTrigger.dataset.checkpoint;
    if (checkpointId) {
      event.preventDefault();
      blurFocusedLearningPathElement();
      openCheckpointModal(checkpointId);
      return;
    }
  }

  const nextStationButton = target.closest("[data-learning-path-next-station]");
  if (nextStationButton) {
    event.preventDefault();
    handleNextCheckpoint();
    return;
  }
}

export function renderLearningPathPage(root = getLearningPathRoot()) {
  if (!root) {
    return;
  }

  if (!uiState.initialized) {
    uiState.initialized = true;
    void hydrateLearningPathStateFromBackend();
  }

  bindLearningPathControlsOnce();
  const state = getState() || getEmptyLearningPathState();
  if (!uiState.mounted) {
    root.innerHTML = renderLearningPathStaticShell(state);
    uiState.mounted = true;
  }

  uiState.graphState = createGraphState(state);
  syncTaskResetCountdownTimer(uiState.modalCheckpointId !== null || uiState.modalClosing);
  blurFocusedLearningPathStationElement(root);
  syncLearningPathSlots(root, state, { versionChanged: true, avatarChanged: true });

  if (uiState.modalCheckpointId !== null && uiState.modalFocusRequested) {
    uiState.modalFocusRequested = false;
    const modalCloseButton = root.querySelector("[data-learning-path-close-modal]");
    if (modalCloseButton instanceof HTMLElement) {
      modalCloseButton.focus();
    }
  }
}
