import { API_BASE_URL } from "../../../config.js";

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
  initialized: false,
  loading: false,
  backendState: null,
  errorMessage: "",
  authRetryTimer: null,
  authRetryStartedAt: 0,
  modalCheckpointId: null,
  modalClosing: false,
  modalCloseTimer: null,
  taskResetCountdown: "00:00:00",
  taskResetTimer: null,
  rewardPopup: null,
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

function scheduleRender() {
  requestAnimationFrame(() => {
    renderLearningPathPage();
  });
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
    uiState.taskResetCountdown = "00:00:00";
    scheduleRender();

    if (typeof afterClose === "function") {
      afterClose();
    }
  }, MODAL_CLOSE_MS);
}

function requestRewardPopupClose() {
  uiState.rewardPopup = null;
  scheduleRender();
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
  const response = await fetch(buildLearningPathApiUrl(path), {
    method,
    headers: getLearningPathAuthHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

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
    const remoteState = extractRemoteLearningPathState(data?.state);
    uiState.backendState = remoteState;
    uiState.loading = false;
    uiState.limitNotice = "";
    uiState.errorMessage = remoteState ? "" : "Backend Learning Path chưa trả về state hợp lệ.";
    scheduleRender();
    return remoteState;
  } catch (error) {
    console.warn("Learning Path backend hydrate failed:", error);
    uiState.backendState = null;
    uiState.loading = false;
    uiState.errorMessage =
      error?.message || "Không thể tải Learning Path từ backend.";
    scheduleRender();
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

    const remoteState = extractRemoteLearningPathState(data?.state);
    if (!remoteState) {
      throw new Error("Learning Path backend returned an empty state");
    }

    uiState.backendState = remoteState;
    uiState.errorMessage = "";
    uiState.limitNotice = "";
    applyLearningPathEvents(data?.events);
    scheduleRender();
    return remoteState;
  } catch (error) {
    console.warn("Learning Path backend action failed:", error);
    uiState.errorMessage = error?.message || "Không thể thực hiện action Learning Path.";
    scheduleRender();
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

  uiState.modalCheckpointId = checkpoint.id;
  uiState.modalClosing = false;
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
    scheduleRender();
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
    return;
  }

  uiState.rewardPopup = {
    title: "🎉 Trạm đã hoàn thành",
    checkpointTitle: checkpoint.title || "",
    xu: checkpoint.reward?.xu || 20,
    exp: checkpoint.reward?.exp || 50,
  };
  scheduleRender();
}

function showAvatarTransition(event) {
  const payload = event?.payload || {};
  if (!payload.from || !payload.to) {
    return;
  }

  clearTransitionTimer();
  uiState.modalCheckpointId = null;
  uiState.modalClosing = false;
  uiState.transition = {
    from: payload.from,
    to: payload.to,
    toCheckpointId: payload.checkpointId,
  };

  uiState.transitionTimer = window.setTimeout(() => {
    uiState.transition = null;
    scheduleRender();
  }, TRANSITION_MS);

  scheduleRender();
}

function applyLearningPathEvent(event) {
  if (!event || typeof event !== "object") {
    return;
  }

  switch (event.eventName) {
    case "STATE_CHANGED":
    case "TASK_COMPLETED":
    case "TASK_PROGRESS_UPDATED":
    case "CHECKPOINT_UNLOCKED":
      scheduleRender();
      break;
    case "CHECKPOINT_COMPLETED":
      showCheckpointRewardPopup(event);
      break;
    case "CHECKPOINT_BLOCKED":
    case "DAILY_LIMIT_REACHED":
    case "WEEKLY_LIMIT_REACHED":
      uiState.limitNotice = event?.payload?.reason || event.eventName || null;
      scheduleRender();
      break;
    case "REWARD_GRANTED":
      scheduleRender();
      break;
    case "AVATAR_POSITION_CHANGED":
      showAvatarTransition(event);
      break;
    default:
      scheduleRender();
      break;
  }
}

function applyLearningPathEvents(events) {
  if (!Array.isArray(events)) {
    return;
  }

  events.forEach((event) => applyLearningPathEvent(event));
}

function getCurrentMountain(state) {
  return state?.mountain || state?.season?.mountains?.[0] || null;
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

  if (route === "/student/learning-path") {
    return "learning-path";
  }

  return "";
}

function isLoadingState() {
  return uiState.loading && !uiState.backendState;
}

function renderMountainCard(mountain, state) {
  const isSelected = mountain.id === state.currentMountainId;

  return `
    <button
      class="learning-path-mountain-card${isSelected ? " is-selected" : ""}${mountain.locked && !isSelected ? " is-locked" : ""}"
      type="button"
      ${mountain.locked && !isSelected ? 'aria-disabled="true" disabled' : ""}
      data-page="learning-path"
    >
      <span class="learning-path-mountain-thumb" aria-hidden="true">
        <img
          class="learning-path-mountain-thumb-image"
          src="${escapeHtml(mountain.image)}"
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

function renderCheckpointNode(checkpoint, status) {
  if (status === "locked") {
    return `
      <span class="learning-path-station-checkpoint is-locked" aria-hidden="true">
        ${LOCK_ICON}
      </span>
    `;
  }

  if (status === "current") {
    const shouldHideStaticAvatar =
      uiState.transition && uiState.transition.toCheckpointId === checkpoint.id;

    return `
      <button
        type="button"
        class="learning-path-station-checkpoint learning-path-station-checkpoint-button"
        data-learning-path-open-checkpoint
        data-learning-path-checkpoint="${escapeHtml(checkpoint.id)}"
        aria-label="Mở nhiệm vụ ${escapeHtml(checkpoint.title)}"
      >
        ${
          shouldHideStaticAvatar
            ? ""
            : `<span class="learning-path-station-avatar" aria-hidden="true">
                <img src="/assets/userAvatar/boy.png" alt="" loading="lazy" decoding="async" />
              </span>`
        }
      </button>
    `;
  }

  return `
    <button
      type="button"
      class="learning-path-station-checkpoint is-completed"
      data-learning-path-open-checkpoint
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
    >
      <div class="learning-path-station-anchor" aria-hidden="true">
        ${renderCheckpointNode(checkpoint, status)}
      </div>
      <div class="learning-path-station-copy">
        <strong>${escapeHtml(checkpoint.title)}</strong>
        <span>${escapeHtml(checkpoint.altitude || "")}</span>
      </div>
    </div>
  `;
}

function renderCurrentAvatar(state) {
  const position = state.avatar?.position || { left: 0, top: 0 };

  return `
    <span
      class="learning-path-station-avatar learning-path-moving-avatar"
      style="left: ${position.left}%; top: ${position.top}%;"
      aria-hidden="true"
    >
      <img src="/assets/userAvatar/boy.png" alt="" loading="lazy" decoding="async" />
    </span>
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

function renderPeakNode(state) {
  const mountain = getCurrentMountain(state);
  if (!mountain) {
    return "";
  }

  const summit = mountain.checkpoints.find((checkpoint) => checkpoint.type === "summit");
  const summitRuntime = summit ? getCheckpointById(state, summit.id) : null;
  if (!summit) {
    return "";
  }

  const status = normalizeCheckpointStatus(summitRuntime?.status || summitRuntime?.state);
  const isCurrent = status === "current";
  const shouldHideStaticAvatar =
    uiState.transition && uiState.transition.toCheckpointId === summit.id;

  return `
    <div
      class="learning-path-peak"
      style="left: ${summit.position.left}%; top: ${summit.position.top}%;"
      ${status !== "locked" ? 'data-learning-path-open-checkpoint data-learning-path-checkpoint="' + escapeHtml(summit.id) + '"' : ""}
      ${status !== "locked" ? 'role="button" tabindex="0"' : ""}
    >
      <span class="learning-path-peak-copy">
        <strong>${escapeHtml(summit.title)}</strong>
        <span>${escapeHtml(summit.altitude || mountain.height)}</span>
        <small>${escapeHtml(summit.reward?.subtitle || "Hoàn thành để nhận huy hiệu")}</small>
      </span>
      ${isCurrent && !shouldHideStaticAvatar ? renderCurrentAvatar(state) : ""}
    </div>
  `;
}

function renderProgressCard(state) {
  const mountain = getCurrentMountain(state);
  return `
    <aside class="learning-path-progress-card">
      <h3>Tiến độ của bạn</h3>
      <div class="learning-path-progress-bar" aria-hidden="true">
        <span style="width: ${Math.max(0, Math.min(Number(state.progressPercent) || 0, 100))}%"></span>
      </div>
      <div class="learning-path-progress-meta">
        <strong>${Math.max(0, Math.min(Number(state.progressPercent) || 0, 100))}%</strong>
        <span>Bạn đang ở ${escapeHtml(mountain?.name || "Xuất phát")}</span>
      </div>
      <p>${escapeHtml(state.checkpoint?.altitude || "0 m")} / ${escapeHtml(mountain?.height || "")}</p>
    </aside>
  `;
}

function renderJourneyPanel(state) {
  const mountain = getCurrentMountain(state);
  const checkpoints = Array.isArray(mountain?.checkpoints)
    ? mountain.checkpoints.filter((checkpoint) => checkpoint.type === "station")
    : [];
  const checkpointNodes = checkpoints.map((checkpoint) =>
    renderStationNode(getCheckpointById(state, checkpoint.id) || checkpoint, state),
  );

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

        <div class="learning-path-journey-overlay" aria-hidden="true">
          <div class="learning-path-route">
            ${checkpointNodes.join("")}
            ${renderPeakNode(state)}
            ${renderMovingAvatar()}
          </div>
        </div>

        ${renderProgressCard(state)}
      </div>
    </section>
  `;
}

function renderRewardSection(state) {
  const rewards = Array.isArray(state.rewards?.badges) ? state.rewards.badges : [];
  const mountain = getCurrentMountain(state);

  return `
    <div class="learning-path-reward-grid learning-path-reward-row">
      <div class="learning-path-reward-item is-gold">
        <span class="learning-path-reward-icon" aria-hidden="true">🪙</span>
        <div class="learning-path-reward-copy">
          <strong>+${escapeHtml(state.rewards?.xu || 0)} Xu Edu</strong>
          <span>Phần thưởng</span>
        </div>
      </div>
      <div class="learning-path-reward-item is-amber">
        <span class="learning-path-reward-icon" aria-hidden="true">⭐</span>
        <div class="learning-path-reward-copy">
          <strong>+${escapeHtml(state.rewards?.exp || 0)} EXP</strong>
          <span>Kinh nghiệm Learning Path</span>
        </div>
      </div>
      <div class="learning-path-reward-item is-blue">
        <span class="learning-path-reward-icon" aria-hidden="true">🏅</span>
        <div class="learning-path-reward-copy">
          <strong>${escapeHtml(mountain?.badge?.name || "Huy hiệu")}</strong>
          <span>${escapeHtml(mountain?.badge?.description || "")}</span>
        </div>
      </div>
      <div class="learning-path-reward-item is-green">
        <span class="learning-path-reward-icon" aria-hidden="true">🏔️</span>
        <div class="learning-path-reward-copy">
          <strong>${rewards.length > 0 ? `${rewards.length} badge` : "Mở khóa tiếp"}</strong>
          <span>Tiến trình mùa giải</span>
        </div>
      </div>
    </div>
  `;
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

function renderDebugCompleteButton(task, checkpointId) {
  return `
    <button
      type="button"
      class="learning-path-task-action-btn"
      data-learning-path-retry-action="COMPLETE_CHECKPOINT"
      data-learning-path-checkpoint-id="${escapeHtml(checkpointId || "")}"
    >
      Đánh dấu hoàn thành
    </button>
  `;
}

function renderTaskCard(task, checkpointId) {
  return `
    <article class="learning-path-task-card${task.state === "DONE" ? " is-completed" : ""}">
      <div class="learning-path-task-head">
        <span class="learning-path-task-icon" aria-hidden="true">${escapeHtml(task.icon || "📘")}</span>
        <div class="learning-path-task-copy">
          <strong>${escapeHtml(task.title || "Nhiệm vụ")}</strong>
          <p>${escapeHtml(task.description || "")}</p>
        </div>
      </div>
      <div class="learning-path-task-footer">
        <span class="learning-path-task-status${task.state === "DONE" ? " is-completed" : ""}">
          ${task.state === "DONE" ? "✓ Đã hoàn thành" : "Chưa hoàn thành"}
        </span>
        ${renderTaskActionButton(task)}
        ${renderDebugCompleteButton(task, checkpointId)}
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
          ${tasks.map((task) => renderTaskCard(task, checkpoint.id)).join("")}
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

function renderRewardPopup() {
  if (!uiState.rewardPopup) {
    return "";
  }

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
          <p>${escapeHtml(uiState.rewardPopup.checkpointTitle)}</p>
          <strong>+${escapeHtml(uiState.rewardPopup.xu)} Xu Edu</strong>
          <strong>+${escapeHtml(uiState.rewardPopup.exp)} EXP</strong>
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

function handleCheckpointCompletion(checkpointId) {
  void performLearningPathAction("COMPLETE_CHECKPOINT", {
    checkpointId,
  });
}

function bindLearningPathControlsOnce() {
  if (uiState.bound) {
    return;
  }

  uiState.bound = true;

  document.addEventListener("click", (event) => {
    const root = getLearningPathRoot();
    if (!root || !root.contains(event.target)) {
      return;
    }

    const retryButton = event.target.closest("[data-learning-path-retry-load]");
    if (retryButton) {
      event.preventDefault();
      void hydrateLearningPathStateFromBackend();
      return;
    }

    const closeButton = event.target.closest("[data-learning-path-close-modal]");
    if (closeButton) {
      event.preventDefault();
      requestLearningPathModalClose();
      return;
    }

    const rewardPopupCloseButton = event.target.closest(
      "[data-learning-path-close-reward-popup]",
    );
    if (rewardPopupCloseButton) {
      event.preventDefault();
      requestRewardPopupClose();
      return;
    }

    const checkpointTrigger = event.target.closest(
      "[data-learning-path-open-checkpoint]",
    );
    if (checkpointTrigger) {
      event.preventDefault();
      openCheckpointModal(checkpointTrigger.dataset.learningPathCheckpoint);
      return;
    }

    const nextStationButton = event.target.closest(
      "[data-learning-path-next-station]",
    );
    if (nextStationButton) {
      event.preventDefault();
      handleNextCheckpoint();
    }

    const retryActionButton = event.target.closest("[data-learning-path-retry-action]");
    if (retryActionButton) {
      event.preventDefault();
      const action = String(retryActionButton.dataset.learningPathRetryAction || "").trim();
      const checkpointId = String(retryActionButton.dataset.learningPathCheckpointId || "").trim();

      if (action === "COMPLETE_CHECKPOINT" && checkpointId) {
        handleCheckpointCompletion(checkpointId);
      }
    }
  });
}

function renderLearningPathPageShell(state) {
  const modalHtml =
    uiState.modalCheckpointId !== null || uiState.modalClosing
      ? renderLearningPathTaskModal(state)
      : "";
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
    <div class="learning-path-page${modalHtml || uiState.rewardPopup ? " is-modal-open" : ""}">
      <header class="learning-path-header">
        <div class="learning-path-header-copy">
          <span class="learning-path-title">🏔️ Hành Trình Chinh Phục</span>
          <p>Chinh phục 7 đỉnh núi cao nhất 7 châu lục</p>
        </div>
        <div class="learning-path-coin-card" aria-label="Xu Edu hiện có">
          <span class="learning-path-coin-label">🪙 Xu Edu</span>
          <strong>${escapeHtml(state.rewards?.xu || 0)}</strong>
        </div>
      </header>

      <div class="learning-path-main-grid">
        <div class="learning-path-left-column">
          ${errorNotice}
          ${loadingNotice}
          ${limitNotice}
          ${renderMountainList(state)}
        </div>
        <div class="learning-path-right-column">
          ${renderJourneyPanel(state)}
          ${renderRewardSection(state)}
        </div>
      </div>

      ${modalHtml}
      ${renderRewardPopup()}
    </div>
  `;
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

  const state = getState();
  if (!state) {
    root.innerHTML = renderLearningPathPageShell({
      season: null,
      mountain: null,
      checkpoints: [],
      rewards: { xu: 0, exp: 0, badges: [] },
      progressPercent: 0,
      checkpoint: null,
      avatar: { position: { left: 0, top: 0 } },
      checkpointProgress: { completed: 0, total: 0 },
      limits: {},
    });
    return;
  }

  syncTaskResetCountdownTimer(uiState.modalCheckpointId !== null || uiState.modalClosing);
  root.innerHTML = renderLearningPathPageShell(state);

  if (uiState.transition) {
    const movingAvatar = root.querySelector("[data-learning-path-moving-avatar]");
    if (movingAvatar) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          movingAvatar.style.left = `${uiState.transition.to.left}%`;
          movingAvatar.style.top = `${uiState.transition.to.top}%`;
        });
      });
    }
  }
}
