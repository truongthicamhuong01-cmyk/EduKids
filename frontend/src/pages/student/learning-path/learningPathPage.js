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

const PEAK_LAYOUT = { left: 41.7, top: 8.5 };

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
          <span class="learning-path-panel-eyebrow">MÙA 1: 7 ĐỈNH CAO THẾ GIỚI</span>
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

function renderStationNode(station, data, currentStation, index = 0) {
  const stationNumber = Number(station.order ?? index + 1) || 0;
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
          <span class="learning-path-station-avatar" aria-hidden="true">
            <img
              src="${escapeHtml(data.avatarImage)}"
              alt=""
              loading="lazy"
              decoding="async"
            />
        </span>
      `
      : "";

  const statusBadge =
    status === "completed"
      ? `
        <span class="learning-path-station-status-badge" aria-hidden="true">${CHECK_ICON}</span>
      `
      : "";

  return `
    <div
      class="learning-path-station${sideClass}${statusClass}"
      style="left: ${station.left}%; top: ${station.top}%;"
    >
      <div class="learning-path-station-anchor" aria-hidden="true">
        <span class="learning-path-station-checkpoint">
          ${checkpointContent}
          ${statusBadge}
        </span>
      </div>
      <div class="learning-path-station-copy">
        <strong>${escapeHtml(station.label)}</strong>
        <span>${escapeHtml(station.altitude)}</span>
      </div>
    </div>
  `;
}

export function MountainJourney({
  journey = learningPathMockData.journey,
} = {}) {
  const currentStation = Number(
    journey.currentStation ?? learningPathMockData.currentStation ?? 1,
  );
  const stations = (journey.stations || []).map((station, index) =>
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
            ${stations.join("")}
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
          </div>
        </div>

        ${ProgressCard({
          progressPercent: learningPathMockData.progressPercent,
          currentStationLabel: learningPathMockData.currentStationLabel,
          currentAltitude: learningPathMockData.currentAltitude,
          peakAltitude: learningPathMockData.peakAltitude,
        })}
      </div>
    </section>
  `;
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
    <div class="learning-path-reward-item is-${escapeHtml(reward.theme)}">
      <span class="learning-path-reward-icon" aria-hidden="true">${escapeHtml(
        reward.icon,
      )}</span>
      <div class="learning-path-reward-copy">
        <strong>${escapeHtml(reward.title)}</strong>
        <span>${escapeHtml(reward.subtitle)}</span>
      </div>
    </div>
  `;
}

export function RewardSection({ rewards = [] } = {}) {
  return `
    <section class="learning-path-panel learning-path-reward-panel">
      <div class="learning-path-panel-head">
        <span class="learning-path-panel-eyebrow">Phần thưởng</span>
      </div>
      <div class="learning-path-reward-grid">
        ${rewards.map((reward) => RewardItem(reward)).join("")}
      </div>
    </section>
  `;
}

export function LearningPathPage(data = learningPathMockData) {
  return `
    <div class="learning-path-page">
      <header class="learning-path-header">
        <div class="learning-path-header-copy">
          <span class="learning-path-title">🏔️ Learning Path</span>
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
          ${MountainJourney({ journey: data.journey })}
          ${RewardSection({ rewards: data.rewards })}
        </div>
      </div>
    </div>
  `;
}

export function renderLearningPathPage(
  root = document.getElementById("learning-path"),
  data = learningPathMockData,
) {
  if (!root) {
    return;
  }

  root.innerHTML = LearningPathPage(data);
}
