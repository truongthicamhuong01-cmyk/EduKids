/*
 * Chức năng: Hiển thị thanh máu của Boss trong Boss Battle.
 * Dữ liệu đầu vào: HP hiện tại, trạng thái Boss và callback đổi trạng thái.
 * Dữ liệu đầu ra: Một component DOM tự cập nhật theo HP.
 * File liên quan: frontend/src/boss/bossAnimation.js
 */
const DEFAULT_HP = 100;
const MIN_HP = 0;
const MAX_HP = 100;

function clampHP(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_HP;
  }

  return Math.max(MIN_HP, Math.min(MAX_HP, Math.round(numeric)));
}

function resolveBossStateByHP(hp) {
  if (hp <= 0) {
    return "die";
  }

  if (hp <= 25) {
    return "die";
  }

  if (hp <= 50) {
    return "rage";
  }

  if (hp <= 75) {
    return "angry";
  }

  return "idle";
}

export class BossHpComponent {
  constructor(options = {}) {
    this.assetBasePath = String(options.assetBasePath || "assets/game/boss").replace(/\/+$/, "");
    this.fillSrc = String(options.fillSrc || `${this.assetBasePath}/boss_hp_fill.png`);
    this.maxHP = Math.max(1, Number(options.maxHP) || DEFAULT_HP);
    this.currentHP = clampHP(options.initialHP ?? this.maxHP);
    this.onStateChange = typeof options.onStateChange === "function" ? options.onStateChange : null;
    this.linkedBoss = options.linkedBoss || null;
    this.root = this.createRoot();
    this.fillTrack = this.root.querySelector("[data-boss-hp-fill-track]");
    this.fillImage = this.root.querySelector("[data-boss-hp-fill-image]");
    this.valueText = this.root.querySelector("[data-boss-hp-value]");
    this.stateText = this.root.querySelector("[data-boss-hp-state]");

    this.syncUI({ animate: false });
    this.syncBossState(false);
  }

  createRoot() {
    const root = document.createElement("div");
    root.className = "boss-hp";
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", "Boss HP");
    root.style.cssText = [
      "position: relative",
      "display: grid",
      "gap: 10px",
      "width: 100%",
      "max-width: 100%",
      "padding: 10px 12px",
      "box-sizing: border-box",
    ].join(";");

    root.innerHTML = `
      <div class="boss-hp__visual" style="position: relative; width: 100%; min-height: 34px; border-radius: 999px; overflow: hidden;">
        <div data-boss-hp-fill-track class="boss-hp__fill-track" aria-hidden="true">
          <img
            data-boss-hp-fill-image-layer
            class="boss-hp__fill-image-layer"
            src="${this.fillSrc}"
            alt=""
            aria-hidden="true"
            draggable="false"
          />
        </div>
      </div>
      <div class="boss-hp__meta" style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <strong data-boss-hp-state class="boss-hp__state">idle</strong>
        <span data-boss-hp-value class="boss-hp__value">100 / 100</span>
      </div>
    `;

    const styleText = `
      .boss-hp__visual {
        isolation: isolate;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(229, 236, 247, 0.94));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.8),
          0 10px 20px rgba(31, 42, 90, 0.12);
      }
      .boss-hp__fill-track {
        position: absolute;
        inset: 4px;
        width: auto;
        overflow: hidden;
        border-radius: 999px;
        transition: width 280ms ease;
        background: linear-gradient(90deg, #ff6a5f, #ff322f 50%, #ff9841);
      }
      .boss-hp__fill-image-layer {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: left center;
        display: block;
        pointer-events: none;
        user-select: none;
        opacity: 0.32;
        mix-blend-mode: screen;
      }
      .boss-hp__state {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.78rem;
      }
      .boss-hp__value {
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
    `;

    if (!document.getElementById("boss-hp-inline-styles")) {
      const style = document.createElement("style");
      style.id = "boss-hp-inline-styles";
      style.textContent = styleText;
      document.head.appendChild(style);
    }

    return root;
  }

  getHP() {
    return this.currentHP;
  }

  getMaxHP() {
    return this.maxHP;
  }

  getStateByHP(hp = this.currentHP) {
    return resolveBossStateByHP(clampHP(hp));
  }

  syncBossState(shouldNotify = true) {
    const nextState = this.getStateByHP(this.currentHP);
    this.state = nextState;

    if (this.stateText) {
      this.stateText.textContent = nextState;
    }

    if (shouldNotify && this.onStateChange) {
      this.onStateChange(nextState, this.currentHP, this.maxHP);
    }

    if (this.linkedBoss && typeof this.linkedBoss.setState === "function") {
      this.linkedBoss.setState(nextState);
    }
  }

  syncUI(options = {}) {
    const animate = options.animate !== false;
    const ratio = this.maxHP > 0 ? this.currentHP / this.maxHP : 0;
    const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));

    if (this.fillTrack) {
      this.fillTrack.style.width = `${percent}%`;
      this.fillTrack.style.transition = animate ? "width 280ms ease" : "none";
    }

    if (this.valueText) {
      this.valueText.textContent = `${this.currentHP} / ${this.maxHP}`;
    }

    if (this.root) {
      this.root.dataset.hp = String(this.currentHP);
      this.root.dataset.maxHp = String(this.maxHP);
      this.root.dataset.state = this.getStateByHP(this.currentHP);
    }
  }

  setHP(value) {
    const nextHP = clampHP(value);
    this.currentHP = nextHP;
    this.syncUI({ animate: true });
    this.syncBossState(true);
    return this;
  }

  mount(container) {
    if (!container || typeof container.appendChild !== "function") {
      return this;
    }

    if (this.root.parentNode !== container) {
      container.appendChild(this.root);
    }

    return this;
  }

  unmount() {
    if (this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }

    return this;
  }
}

export function createBossHpComponent(options = {}) {
  return new BossHpComponent(options);
}

if (typeof window !== "undefined") {
  window.EduKidsBossHp = {
    BossHpComponent,
    createBossHpComponent,
  };
}
