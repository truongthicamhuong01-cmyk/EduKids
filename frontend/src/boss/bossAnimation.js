const DEFAULT_FRAME_COUNT = 8;
const DEFAULT_FRAME_DURATION = {
  idle: 140,
  angry: 95,
  rage: 70,
  die: 110,
};

const VALID_STATES = new Set(["idle", "angry", "rage", "die"]);
const LOOPING_STATES = new Set(["idle", "angry", "rage"]);

function normalizeState(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return VALID_STATES.has(normalized) ? normalized : "idle";
}

function clampFrameIndex(frameIndex, frameCount) {
  const total = Math.max(1, Number(frameCount) || DEFAULT_FRAME_COUNT);
  const index = Math.floor(Number(frameIndex) || 0);
  return Math.max(0, Math.min(total - 1, index));
}

export class BossAnimationComponent {
  constructor(options = {}) {
    this.assetBasePath = String(options.assetBasePath || "assets/game/boss").replace(/\/+$/, "");
    this.frameCount = Math.max(1, Number(options.frameCount) || DEFAULT_FRAME_COUNT);
    this.frameDuration = {
      ...DEFAULT_FRAME_DURATION,
      ...(options.frameDuration || {}),
    };
    this.framePathResolver =
      typeof options.framePathResolver === "function"
        ? options.framePathResolver
        : (state, frameNumber) => `${this.assetBasePath}/${state}/${frameNumber}.png`;

    this.loopingStates = new Set(
      Array.isArray(options.loopingStates) && options.loopingStates.length > 0
        ? options.loopingStates.map(normalizeState).filter(Boolean)
        : Array.from(LOOPING_STATES),
    );

    this.state = "idle";
    this.frameIndex = 0;
    this.playing = false;
    this.mounted = false;
    this.destroyed = false;
    this.lastTickAt = 0;
    this.nextFrameAt = 0;
    this.rafId = 0;
    this.preloadedFrames = new Map();
    this.root = this.createRoot();
    this.imageElement = this.root.querySelector("[data-boss-image]");

    this.setState(options.initialState || "idle", { restart: false });
  }

  createRoot() {
    const root = document.createElement("div");
    root.className = "boss-animation";
    root.setAttribute("role", "img");
    root.setAttribute("aria-label", "Boss animation");
    root.style.cssText = [
      "position: relative",
      "display: inline-flex",
      "align-items: center",
      "justify-content: center",
      "overflow: hidden",
      "width: 100%",
      "height: 100%",
      "min-width: 160px",
      "min-height: 160px",
    ].join(";");
    root.innerHTML = `
      <img data-boss-image class="boss-animation__image" alt="Boss" draggable="false" />
    `;
    const image = root.querySelector("[data-boss-image]");
    if (image) {
      image.style.cssText = [
        "width: 100%",
        "height: 100%",
        "object-fit: contain",
        "object-position: center",
        "display: block",
        "user-select: none",
        "-webkit-user-drag: none",
        "pointer-events: none",
      ].join(";");
    }
    return root;
  }

  getFrameDuration(state = this.state) {
    const normalized = normalizeState(state);
    return Math.max(16, Number(this.frameDuration[normalized]) || DEFAULT_FRAME_DURATION[normalized] || 120);
  }

  getFrameSrc(state = this.state, frameIndex = this.frameIndex) {
    const normalizedState = normalizeState(state);
    const normalizedIndex = clampFrameIndex(frameIndex, this.frameCount);
    const frameNumber = normalizedIndex + 1;
    return this.framePathResolver(normalizedState, frameNumber, normalizedIndex);
  }

  preloadFrame(state, frameIndex) {
    const src = this.getFrameSrc(state, frameIndex);
    if (!src) {
      return null;
    }

    if (this.preloadedFrames.has(src)) {
      return this.preloadedFrames.get(src);
    }

    const image = new Image();
    image.decoding = "async";
    image.src = src;
    this.preloadedFrames.set(src, image);
    return image;
  }

  updateImage(frameIndex = this.frameIndex) {
    if (!this.imageElement) {
      return;
    }

    const src = this.getFrameSrc(this.state, frameIndex);
    this.preloadFrame(this.state, frameIndex);
    this.imageElement.src = src;
    this.imageElement.alt = `Boss ${this.state}`;
    this.root.dataset.state = this.state;
    this.root.dataset.frame = String(clampFrameIndex(frameIndex, this.frameCount) + 1);
  }

  tick = (now) => {
    if (this.destroyed || !this.playing) {
      return;
    }

    if (!this.nextFrameAt) {
      this.nextFrameAt = now + this.getFrameDuration(this.state);
    }

    if (now >= this.nextFrameAt) {
      const isLooping = this.loopingStates.has(this.state);

      if (isLooping) {
        this.frameIndex = (this.frameIndex + 1) % this.frameCount;
      } else if (this.frameIndex < this.frameCount - 1) {
        this.frameIndex += 1;
      } else {
        this.updateImage(this.frameIndex);
        this.stop();
        return;
      }

      this.updateImage(this.frameIndex);
      this.nextFrameAt = now + this.getFrameDuration(this.state);
    }

    this.rafId = window.requestAnimationFrame(this.tick);
  };

  start() {
    if (this.destroyed || this.playing) {
      return this;
    }

    this.playing = true;
    this.nextFrameAt = 0;
    this.lastTickAt = 0;
    this.rafId = window.requestAnimationFrame(this.tick);
    return this;
  }

  stop() {
    this.playing = false;
    this.nextFrameAt = 0;
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    return this;
  }

  setState(nextState, options = {}) {
    const normalized = normalizeState(nextState);
    const restart = options.restart !== false;

    this.state = normalized;
    this.frameIndex = 0;
    this.updateImage(0);

    if (restart) {
      this.stop();
      this.start();
    }

    return this;
  }

  mount(container) {
    if (this.destroyed || !container || typeof container.appendChild !== "function") {
      return this;
    }

    if (this.root.parentNode !== container) {
      container.appendChild(this.root);
    }

    this.mounted = true;
    this.start();
    return this;
  }

  unmount() {
    this.stop();
    this.mounted = false;

    if (this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }

    return this;
  }

  destroy() {
    this.unmount();
    this.destroyed = true;
    this.preloadedFrames.clear();
    this.imageElement = null;
    return this;
  }
}

export function createBossAnimation(options = {}) {
  return new BossAnimationComponent(options);
}

if (typeof window !== "undefined") {
  window.EduKidsBossAnimation = {
    BossAnimationComponent,
    createBossAnimation,
  };
}
