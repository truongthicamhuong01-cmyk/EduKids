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

const FLAG_ICON = `
  <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
    <path
      d="M6 3.75v16.5"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
    />
    <path
      d="M6 5.25c3.2-1.35 5.7 1.65 9 0v6c-3.3 1.65-5.8-1.35-9 0"
      fill="currentColor"
      opacity=".96"
    />
  </svg>
`;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildBackgroundStyle(imagePath, overlay = "rgba(255,255,255,0.08)") {
  return [
    `linear-gradient(180deg, ${overlay}, rgba(13, 34, 74, 0.18))`,
    `url("${escapeHtml(imagePath)}")`,
  ].join(", ");
}

export function MountainCard(mountain, index) {
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
  const list = mountains.map((mountain, index) => {
    const selected =
      mountain.id === currentMountainId
        ? { ...mountain, selected: true }
        : mountain;
    return MountainCard(selected, index);
  });

  return `
    <section class="learning-path-panel learning-path-list-panel">
      <div class="learning-path-panel-head">
        <div>
          <span class="learning-path-panel-eyebrow">SS1 - CHINH PHỤC 7 ĐỈNH CAO THẾ GIỚI</span>
          <h2>7 châu lục, 7 thử thách</h2>
        </div>
      </div>
      <div class="learning-path-mountain-list">
        ${list.join("")}
      </div>
    </section>
  `;
}

function renderStationNode(station, data) {
  const isCurrent = station.status === "current";
  const isCompleted = station.status === "completed";
  const isPeak = station.status === "peak";
  const sideClass = station.side === "left" ? " is-left" : " is-right";
  const statusClass = isPeak
    ? " is-peak"
    : isCurrent
      ? " is-current"
      : isCompleted
        ? " is-completed"
        : " is-upcoming";

  const content = isPeak
    ? `
        <span class="learning-path-node-marker is-flag" aria-hidden="true">
          ${FLAG_ICON}
        </span>
      `
    : isCurrent
      ? `
          <span
            class="learning-path-node-avatar"
            style="background-image: ${buildBackgroundStyle(data.avatarImage, "rgba(255,255,255,0.1)")};"
            aria-hidden="true"
          ></span>
        `
      : isCompleted
        ? `<span class="learning-path-node-badge is-completed" aria-hidden="true">${CHECK_ICON}</span>`
        : `<span class="learning-path-node-badge is-upcoming" aria-hidden="true"></span>`;

  return `
    <div
      class="learning-path-station${sideClass}${statusClass}"
      style="left: ${station.left}%; bottom: ${station.bottom}%"
    >
      ${content}
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
  const stations = (journey.stations || []).map((station) =>
    renderStationNode(station, journey),
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

        <div class="learning-path-route" aria-hidden="true">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <path
              d="M 10 92 C 18 84, 20 79, 26 72 S 38 56, 44 50 S 57 34, 64 26 S 75 16, 81 9"
              fill="none"
              stroke="rgba(255,255,255,0.96)"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-dasharray="2.3 6.2"
            />
            <path
              d="M 10 92 C 18 84, 20 79, 26 72 S 38 56, 44 50 S 57 34, 64 26 S 75 16, 81 9"
              fill="none"
              stroke="rgba(255,255,255,0.18)"
              stroke-width="4.4"
              stroke-linecap="round"
              stroke-dasharray="2.3 6.2"
            />
          </svg>
          ${stations.join("")}
          <div class="learning-path-peak" style="left: 84%; top: 10%;">
            <span class="learning-path-peak-flag" aria-hidden="true">
              ${FLAG_ICON}
            </span>
            <span class="learning-path-peak-copy">
              <strong>${escapeHtml(journey.peakLabel)}</strong>
              <span>${escapeHtml(journey.peakAltitude)}</span>
              <small>${escapeHtml(journey.peakNote)}</small>
            </span>
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
