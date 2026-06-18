import { learningPathMockData } from "../../../data/learningPathMockData.js";

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

const PEAK_LAYOUT = { left: 41.7, top: 9.25 };
const TASK_MODAL_CLOSE_MS = 220;
const STATION_TRANSITION_MS = 1700;
const TASK_TASK_PAGE_MAP = {
  exercise: {
    label: "Bài tập",
    page: "assignments",
  },
  quiz: {
    label: "Quiz AI",
    page: "subjects",
  },
  coach: {
    label: "AI Coach",
    page: "ai-coach",
  },
  topic: {
    label: "Học theo chủ đề",
    page: "subjects",
  },
};

const learningPathState = {
  initialized: false,
  currentStation: 0,
  modalStationNumber: null,
  modalClosing: false,
  transition: null,
  modalCloseTimer: null,
  transitionTimer: null,
  activeJourneyKey: "",
  bound: false,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getLearningPathRoot() {
  return document.getElementById("learning-path");
}

function getJourneyStations(journey) {
  return Array.isArray(journey?.stations) ? journey.stations : [];
}

function getStationNumber(station, index = 0) {
  return Number(station?.order ?? index + 1) || index + 1;
}

function getStationByNumber(journey, stationNumber) {
  return getJourneyStations(journey).find(
    (station, index) => getStationNumber(station, index) === stationNumber,
  );
}

function getStationTasks(station) {
  const tasks = Array.isArray(station?.tasks) ? station.tasks : [];
  return tasks.filter((task) => String(task?.id || "").trim());
}

function getTaskCompletedCount(tasks = []) {
  return tasks.filter((task) => Boolean(task?.completed)).length;
}

function getJourneyCurrentStation(journey) {
  const stations = getJourneyStations(journey);
  if (stations.length === 0) {
    return 0;
  }

  const rawInitialStation = Number(journey?.currentStation);
  const initialStation = Number.isFinite(rawInitialStation)
    ? rawInitialStation
    : 0;
  const activeStation = learningPathState.initialized
    ? learningPathState.currentStation
    : initialStation;

  return Math.max(
    0,
    Math.min(
      Number.isFinite(activeStation) ? activeStation : initialStation,
      stations.length,
    ),
  );
}

function getJourneyProgressPercent(journey, currentStation) {
  const stations = getJourneyStations(journey);
  if (stations.length <= 0) {
    return 100;
  }

  return Math.round((currentStation / stations.length) * 100);
}

function getJourneyAltitude(journey, currentStation) {
  const stations = getJourneyStations(journey);
  if (currentStation >= stations.length) {
    return String(journey?.peakAltitude || "");
  }

  const station = getStationByNumber(journey, currentStation);
  return String(station?.altitude || journey?.currentAltitude || "");
}

function getCurrentStationLabel(journey, currentStation) {
  const stations = getJourneyStations(journey);
  if (currentStation >= stations.length) {
    return String(journey?.peakLabel || "Đỉnh núi");
  }

  const station = getStationByNumber(journey, currentStation);
  return String(
    station?.label || journey?.currentStationLabel || `Trạm ${currentStation}`,
  );
}

function getCurrentStationTasks(journey, currentStation) {
  const station = getStationByNumber(journey, currentStation);
  return getStationTasks(station);
}

function getStationTitle(station, index = 0) {
  return String(station?.label || `Trạm ${index + 1}`);
}

function getTaskStatusCopy(task) {
  if (task?.completed) {
    return "✓ Đã hoàn thành";
  }

  return String(
    task?.statusText ||
      task?.progressText ||
      task?.progress ||
      task?.description ||
      "Chưa hoàn thành",
  );
}

function getTaskActionPage(taskType) {
  return TASK_TASK_PAGE_MAP[String(taskType || "").trim()]?.page || "subjects";
}

function getTaskActionLabel(taskType) {
  return (
    TASK_TASK_PAGE_MAP[String(taskType || "").trim()]?.label || "Thực hiện"
  );
}

function scheduleRender() {
  requestAnimationFrame(() => {
    renderLearningPathPage();
  });
}

function clearLearningPathTimers() {
  if (learningPathState.modalCloseTimer) {
    window.clearTimeout(learningPathState.modalCloseTimer);
    learningPathState.modalCloseTimer = null;
  }

  if (learningPathState.transitionTimer) {
    window.clearTimeout(learningPathState.transitionTimer);
    learningPathState.transitionTimer = null;
  }
}

function closeLearningPathModalImmediate() {
  clearLearningPathTimers();
  learningPathState.modalStationNumber = null;
  learningPathState.modalClosing = false;
  scheduleRender();
}

function requestLearningPathModalClose(afterClose) {
  if (learningPathState.modalStationNumber === null) {
    if (typeof afterClose === "function") {
      afterClose();
    }
    return;
  }

  if (learningPathState.modalClosing) {
    return;
  }

  learningPathState.modalClosing = true;
  scheduleRender();

  learningPathState.modalCloseTimer = window.setTimeout(() => {
    learningPathState.modalClosing = false;
    learningPathState.modalStationNumber = null;
    scheduleRender();

    if (typeof afterClose === "function") {
      afterClose();
    }
  }, TASK_MODAL_CLOSE_MS);
}

function beginStationTransition(journey, fromStationNumber, toStationNumber) {
  const stations = getJourneyStations(journey);
  const fromStation = getStationByNumber(journey, fromStationNumber);
  const toStation = getStationByNumber(journey, toStationNumber);
  const toPosition =
    toStation ||
    (toStationNumber >= stations.length ? { left: PEAK_LAYOUT.left, top: PEAK_LAYOUT.top } : null);

  if (!fromStation || !toPosition) {
    learningPathState.currentStation = toStationNumber;
    scheduleRender();
    return;
  }

  clearLearningPathTimers();
  learningPathState.transition = {
    fromStationNumber,
    toStationNumber,
    startedAt: Date.now(),
    duration: STATION_TRANSITION_MS,
  };
  scheduleRender();

  learningPathState.transitionTimer = window.setTimeout(() => {
    learningPathState.currentStation = Math.max(
      0,
      Math.min(toStationNumber, stations.length || toStationNumber),
    );
    learningPathState.transition = null;
    scheduleRender();
  }, STATION_TRANSITION_MS);
}

function openLearningPathTaskModal(stationNumber) {
  if (learningPathState.transition) {
    return;
  }

  learningPathState.modalStationNumber = stationNumber;
  learningPathState.modalClosing = false;
  scheduleRender();
}

function goToNextLearningPathStation(journey) {
  if (learningPathState.transition) {
    return;
  }

  const currentStation = getJourneyCurrentStation(journey);
  const stations = getJourneyStations(journey);
  const nextStationNumber = currentStation + 1;

  if (nextStationNumber > stations.length) {
    return;
  }

  requestLearningPathModalClose(() => {
    beginStationTransition(journey, currentStation, nextStationNumber);
  });
}

function bindLearningPathControlsOnce() {
  if (learningPathState.bound) {
    return;
  }

  learningPathState.bound = true;

  document.addEventListener("click", (event) => {
    const root = getLearningPathRoot();
    if (!root || !root.contains(event.target)) {
      return;
    }

    const modalOverlay = event.target.closest(
      "[data-learning-path-modal-overlay]",
    );
    if (modalOverlay) {
      if (event.target === modalOverlay) {
        event.preventDefault();
        requestLearningPathModalClose();
      }
      return;
    }

    const closeButton = event.target.closest(
      "[data-learning-path-close-modal]",
    );
    if (closeButton) {
      event.preventDefault();
      requestLearningPathModalClose();
      return;
    }

    const checkpointButton = event.target.closest(
      "[data-learning-path-open-task-modal]",
    );
    if (checkpointButton) {
      event.preventDefault();
      const stationNumber = Number(
        checkpointButton.dataset.learningPathStationNumber,
      );

      if (!Number.isNaN(stationNumber)) {
        openLearningPathTaskModal(stationNumber);
      }
      return;
    }

    const nextStationButton = event.target.closest(
      "[data-learning-path-next-station]",
    );
    if (nextStationButton) {
      event.preventDefault();
      goToNextLearningPathStation(learningPathState.activeJourney || {});
      return;
    }
  });
}

export function MountainCard(mountain) {
  const isSelected = Boolean(mountain.selected);
  const isUnlocked = Boolean(mountain.unlocked);

  return `
    <button
      class="learning-path-mountain-card${isSelected ? " is-selected" : ""}${isUnlocked ? "" : " is-locked"}"
      type="button"
      ${isUnlocked ? "" : 'aria-disabled="true" disabled'}
    >
      <span class="learning-path-mountain-thumb" aria-hidden="true">
        <img
          class="learning-path-mountain-thumb-image"
          src="${escapeHtml(mountain.image)}"
          alt=""
          loading="lazy"
          decoding="async"
          onerror="console.error('[Learning Path] Failed to load mountain thumbnail:', this.getAttribute('src')); this.style.display='none'; this.parentElement?.classList.add('is-image-missing');"
        />
      </span>
      <span class="learning-path-mountain-copy">
        <span class="learning-path-mountain-continent">${escapeHtml(
          mountain.continent,
        )}</span>
        <strong class="learning-path-mountain-name">${escapeHtml(
          mountain.name,
        )}</strong>
        <span class="learning-path-mountain-height">${escapeHtml(
          mountain.height,
        )}</span>
      </span>
      <span class="learning-path-mountain-lock" aria-hidden="true">
        ${isUnlocked ? "" : LOCK_ICON}
      </span>
    </button>
  `;
}

export function MountainList({ mountains = [], currentMountainId = "" } = {}) {
  const list = mountains.map((mountain) => {
    const selected =
      mountain.id === currentMountainId
        ? { ...mountain, selected: true }
        : mountain;
    return MountainCard(selected);
  });

  return `
    <section class="learning-path-panel learning-path-list-panel">
      <div class="learning-path-panel-head">
        <div>
          <span class="learning-path-panel-eyebrow">Mùa 1: 7 đỉnh cao thế giới</span>
          <h2>7 châu lục, 7 thử thách</h2>
        </div>
      </div>
      <div class="learning-path-mountain-list">
        ${list.join("")}
      </div>
    </section>
  `;
}

function resolveStationStatus(stationNumber, currentStation) {
  if (stationNumber < currentStation) {
    return "completed";
  }

  if (stationNumber === currentStation) {
    return "current";
  }

  return "locked";
}

function renderStationNode(station, journey, currentStation, index = 0) {
  const stationNumber = getStationNumber(station, index);
  const status = resolveStationStatus(stationNumber, currentStation);
  const sideClass = station.side === "left" ? " is-left" : " is-right";
  const statusClass =
    status === "current"
      ? " is-current"
      : status === "completed"
        ? " is-completed"
        : " is-locked";

  const checkpointContent =
    status === "current"
      ? `
          <button
            type="button"
            class="learning-path-station-checkpoint learning-path-station-checkpoint-button"
            data-learning-path-open-task-modal
            data-learning-path-station-number="${stationNumber}"
            aria-label="Mở nhiệm vụ ${escapeHtml(getStationTitle(station, index))}"
          >
            <span class="learning-path-station-avatar" aria-hidden="true">
              <img
                src="${escapeHtml(journey.avatarImage)}"
                alt=""
                loading="lazy"
                decoding="async"
              />
            </span>
          </button>
        `
      : `
          <span
            class="learning-path-station-checkpoint${status === "completed" ? " is-completed" : " is-locked"}"
            aria-hidden="true"
          >
            ${status === "completed" ? `<span class="learning-path-station-status-badge">${CHECK_ICON}</span>` : ""}
          </span>
        `;

  return `
    <div
      class="learning-path-station${sideClass}${statusClass}"
      style="left: ${station.left}%; top: ${station.top}%;"
    >
      <div class="learning-path-station-anchor" aria-hidden="true">
        ${checkpointContent}
      </div>
      <div class="learning-path-station-copy">
        <strong>${escapeHtml(station.label)}</strong>
        <span>${escapeHtml(station.altitude)}</span>
      </div>
    </div>
  `;
}

function renderLearningPathMovingAvatar(journey, transition) {
  if (!transition) {
    return "";
  }

  const fromStation = getStationByNumber(journey, transition.fromStationNumber);
  const toStation =
    getStationByNumber(journey, transition.toStationNumber) ||
    (transition.toStationNumber >= getJourneyStations(journey).length
      ? { left: PEAK_LAYOUT.left, top: PEAK_LAYOUT.top }
      : null);

  if (!fromStation || !toStation) {
    return "";
  }

  return `
    <span
      class="learning-path-station-avatar learning-path-moving-avatar"
      data-learning-path-moving-avatar
      style="left: ${fromStation.left}%; top: ${fromStation.top}%;"
      aria-hidden="true"
    >
      <img
        src="${escapeHtml(journey.avatarImage)}"
        alt=""
        loading="lazy"
        decoding="async"
      />
    </span>
  `;
}

function renderPeakAvatar(journey, currentStation, stations) {
  if (currentStation < stations.length) {
    return "";
  }

  return `
    <span
      class="learning-path-station-avatar learning-path-moving-avatar"
      style="left: ${PEAK_LAYOUT.left}%; top: ${PEAK_LAYOUT.top}%;"
      aria-hidden="true"
    >
      <img
        src="${escapeHtml(journey.avatarImage)}"
        alt=""
        loading="lazy"
        decoding="async"
      />
    </span>
  `;
}

function renderTaskActionButton(task) {
  if (task?.completed) {
    return "";
  }

  const page = getTaskActionPage(task?.type);
  return `
    <button
      type="button"
      class="learning-path-task-action-btn"
      data-page="${escapeHtml(page)}"
    >
      ${escapeHtml(getTaskActionLabel(task?.type))}
    </button>
  `;
}

function renderTaskCard(task) {
  const isCompleted = Boolean(task?.completed);
  const statusText = getTaskStatusCopy(task);

  return `
    <article class="learning-path-task-card${isCompleted ? " is-completed" : ""}">
      <div class="learning-path-task-head">
        <span class="learning-path-task-icon" aria-hidden="true">${escapeHtml(
          task?.icon || "📘",
        )}</span>
        <div class="learning-path-task-copy">
          <strong>${escapeHtml(task?.title || "Nhiệm vụ")}</strong>
          <p>${escapeHtml(task?.description || "")}</p>
        </div>
      </div>
      <div class="learning-path-task-footer">
        <span class="learning-path-task-status${isCompleted ? " is-completed" : ""}">
          ${escapeHtml(statusText)}
        </span>
        ${renderTaskActionButton(task)}
      </div>
    </article>
  `;
}

function renderLearningPathTaskModal(journey, currentStation) {
  const station = getStationByNumber(journey, currentStation);
  const tasks = getCurrentStationTasks(journey, currentStation);
  const completedCount = getTaskCompletedCount(tasks);
  const totalCount = tasks.length || 3;
  const allCompleted = completedCount >= totalCount;
  const titleLabel = `${getCurrentStationLabel(journey, currentStation)} • ${getJourneyAltitude(journey, currentStation)}`;

  return `
    <div
      class="learning-path-modal-overlay${learningPathState.modalClosing ? " is-closing" : " is-open"}"
      data-learning-path-modal-overlay
      role="presentation"
    >
      <section
        class="learning-path-modal${learningPathState.modalClosing ? " is-closing" : " is-open"}"
        role="dialog"
        aria-modal="true"
        aria-labelledby="learning-path-modal-title"
      >
        <header class="learning-path-modal-header">
          <div>
            <p class="learning-path-modal-kicker">Nhiệm vụ trạm</p>
            <h3 id="learning-path-modal-title">${escapeHtml(titleLabel)}</h3>
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
            <strong>${completedCount} / ${totalCount} nhiệm vụ</strong>
          </div>
          <div class="learning-path-modal-progress-track" aria-hidden="true">
            <span style="width: ${Math.max(0, Math.min((completedCount / totalCount) * 100, 100))}%"></span>
          </div>
        </div>

        <div class="learning-path-modal-task-list">
          ${(tasks.length ? tasks : []).map((task) => renderTaskCard(task)).join("")}
        </div>

        <div class="learning-path-modal-reward-card${allCompleted ? " is-complete" : ""}">
          <p>
            ${allCompleted ? "🎉 Trạm đã hoàn thành" : "Hoàn thành tất cả nhiệm vụ để nhận:"}
          </p>
          <strong>+20 Xu Edu</strong>
          <strong>+50 EXP</strong>
        </div>

        ${
          allCompleted && station
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

function renderLearningPathAnimation(root, journey) {
  const transition = learningPathState.transition;
  if (!transition || !root) {
    return;
  }

  const movingAvatar = root.querySelector("[data-learning-path-moving-avatar]");
  const toStation = getStationByNumber(journey, transition.toStationNumber);

  if (!movingAvatar || !toStation) {
    return;
  }

  const animate = () => {
    movingAvatar.style.left = `${toStation.left}%`;
    movingAvatar.style.top = `${toStation.top}%`;
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(animate);
  });
}

function getLearningPathViewModel(data = learningPathMockData) {
  const journey = data.journey || learningPathMockData.journey;
  const currentStation = getJourneyCurrentStation(journey);
  const stations = getJourneyStations(journey);
  const currentStationData =
    getStationByNumber(journey, currentStation) || stations[0] || null;

  return {
    data,
    journey,
    currentStation,
    currentStationData,
    progressPercent: getJourneyProgressPercent(journey, currentStation),
    currentStationLabel: getCurrentStationLabel(journey, currentStation),
    currentAltitude: getJourneyAltitude(journey, currentStation),
  };
}

export function ProgressCard({
  progressPercent = 0,
  currentStationLabel = "",
  currentAltitude = "",
  peakAltitude = "",
} = {}) {
  const percent = Number(progressPercent) || 0;

  return `
    <aside class="learning-path-progress-card">
      <h3>Tiến độ của bạn</h3>
      <div class="learning-path-progress-bar" aria-hidden="true">
        <span style="width: ${Math.max(0, Math.min(percent, 100))}%"></span>
      </div>
      <div class="learning-path-progress-meta">
        <strong>${Math.max(0, Math.min(percent, 100))}%</strong>
        <span>Bạn đang ở ${escapeHtml(currentStationLabel)}</span>
      </div>
      <p>${escapeHtml(currentAltitude)} / ${escapeHtml(peakAltitude)}</p>
    </aside>
  `;
}

function RewardItem(reward) {
  return `
    <div
      class="learning-path-reward-item is-${escapeHtml(reward.theme)}"
    >
      <span class="learning-path-reward-icon" aria-hidden="true">${escapeHtml(reward.icon)}</span>
      <div class="learning-path-reward-copy">
        <strong>${escapeHtml(reward.title)}</strong>
        <span>${escapeHtml(reward.subtitle)}</span>
      </div>
    </div>
  `;
}

export function RewardSection({ rewards = [] } = {}) {
  return `
    <div class="learning-path-reward-grid learning-path-reward-row">
      ${rewards.map((reward) => RewardItem(reward)).join("")}
    </div>
  `;
}

export function MountainJourney({
  journey = learningPathMockData.journey,
} = {}) {
  const currentStation = getJourneyCurrentStation(journey);
  const stations = getJourneyStations(journey);
  const stationNodes = stations.map((station, index) =>
    renderStationNode(station, journey, currentStation, index),
  );

  return `
    <section class="learning-path-panel learning-path-journey-panel">
      <div
        class="learning-path-journey-stage"
        style="background-image: url('${escapeHtml(journey.backgroundImage)}');"
      >
        <div class="learning-path-journey-glow"></div>
        <div class="learning-path-journey-copy">
          <span class="learning-path-level-pill">${escapeHtml(journey.title)}</span>
          <h2>${escapeHtml(journey.name)}</h2>
          <p class="learning-path-location">
            📍 ${escapeHtml(journey.continent)} | ${escapeHtml(journey.height)}
          </p>
          <p class="learning-path-description">${escapeHtml(
            journey.description,
          )}</p>
        </div>

        <div class="learning-path-journey-overlay" aria-hidden="true">
          <div class="learning-path-route">
            ${stationNodes.join("")}
            <div
              class="learning-path-peak"
              style="left: ${PEAK_LAYOUT.left}%; top: ${PEAK_LAYOUT.top}%;"
            >
              <span class="learning-path-peak-copy">
                <strong>${escapeHtml(journey.peakLabel)}</strong>
                <span>${escapeHtml(journey.peakAltitude)}</span>
                <small>${escapeHtml(journey.peakNote)}</small>
              </span>
            </div>
            ${renderPeakAvatar(journey, currentStation, stations)}
            ${renderLearningPathMovingAvatar(journey, learningPathState.transition)}
          </div>
        </div>

        ${ProgressCard({
          progressPercent: getJourneyProgressPercent(journey, currentStation),
          currentStationLabel: getCurrentStationLabel(journey, currentStation),
          currentAltitude: getJourneyAltitude(journey, currentStation),
          peakAltitude: learningPathMockData.peakAltitude,
        })}
      </div>
    </section>
  `;
}

export function LearningPathPage(data = learningPathMockData) {
  const viewModel = getLearningPathViewModel(data);
  const modalStationNumber =
    learningPathState.modalStationNumber ?? viewModel.currentStation;
  const currentStationData =
    getStationByNumber(viewModel.journey, modalStationNumber) ||
    viewModel.currentStationData;

  if (!learningPathState.initialized) {
    learningPathState.initialized = true;
    learningPathState.currentStation = viewModel.currentStation;
  }

  learningPathState.activeJourney = viewModel.journey;
  learningPathState.activeJourneyKey = String(
    viewModel.journey?.mountainId || "",
  );

  const modalHtml =
    learningPathState.modalStationNumber !== null ||
    learningPathState.modalClosing
      ? renderLearningPathTaskModal(viewModel.journey, modalStationNumber)
      : "";

  return `
    <div class="learning-path-page${modalHtml ? " is-modal-open" : ""}">
      <header class="learning-path-header">
        <div class="learning-path-header-copy">
          <span class="learning-path-title">🏔️ Hành Trình Chinh Phục</span>
          <p>Chinh phục 7 đỉnh núi cao nhất 7 châu lục</p>
        </div>
        <div class="learning-path-coin-card" aria-label="Xu Edu hiện có">
          <span class="learning-path-coin-label">🪙 Xu Edu</span>
          <strong>${escapeHtml(data.coinCount)}</strong>
        </div>
      </header>

      <div class="learning-path-main-grid">
        <div class="learning-path-left-column">
          ${MountainList({
            mountains: data.mountains,
            currentMountainId: data.currentMountainId,
          })}
        </div>
        <div class="learning-path-right-column">
          ${MountainJourney({ journey: viewModel.journey })}
          ${RewardSection({ rewards: data.rewards })}
        </div>
      </div>

      ${modalHtml}
    </div>
  `;
}

export function renderLearningPathPage(
  root = getLearningPathRoot(),
  data = learningPathMockData,
) {
  if (!root) {
    return;
  }

  bindLearningPathControlsOnce();

  if (!learningPathState.initialized) {
    learningPathState.currentStation = Number(
      data?.journey?.currentStation ?? data?.currentStation ?? 0,
    );
  }

  root.innerHTML = LearningPathPage(data);
  renderLearningPathAnimation(
    root,
    data?.journey || learningPathMockData.journey,
  );
}
