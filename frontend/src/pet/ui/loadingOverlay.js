import { asElement } from "../utils/dom.js";
import { mountIntoPetHost } from "../utils/pageHost.js";

const LOADING_OVERLAY_ID = "edukids-pet-loading-overlay";

function ensureOverlay() {
  let overlay = document.getElementById(LOADING_OVERLAY_ID);

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = LOADING_OVERLAY_ID;
    overlay.className = "pet-loading-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="pet-loading-overlay__panel" data-pet-loading-panel>
        <span class="pet-loading-overlay__spinner" aria-hidden="true"></span>
        <strong data-pet-loading-title>Đang tải dữ liệu...</strong>
      </div>
    `;
    mountIntoPetHost(overlay);
  }

  return overlay;
}

export function createLoadingOverlay() {
  function setVisible(visible, label = "Đang tải dữ liệu...") {
    const overlay = ensureOverlay();
    const shouldShow = Boolean(visible);
    overlay.hidden = !shouldShow;
    overlay.setAttribute("aria-hidden", String(!shouldShow));

    const title = overlay.querySelector("[data-pet-loading-title]");
    if (title) {
      title.textContent = label;
    }
  }

  return {
    setVisible,
    mount(target) {
      const root = asElement(target);
      if (root && root !== ensureOverlay()) {
        root.appendChild(ensureOverlay());
      }
    },
  };
}
