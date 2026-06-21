import { asElement, escapeHtml } from "../utils/dom.js";
import { mountIntoPetHost } from "../utils/pageHost.js";

const MODAL_ROOT_ID = "edukids-pet-modal-root";

function ensureModalRoot() {
  let root = document.getElementById(MODAL_ROOT_ID);

  if (!root) {
    root = document.createElement("div");
    root.id = MODAL_ROOT_ID;
    root.className = "pet-modal-layer";
    root.hidden = true;
    mountIntoPetHost(root);
  }

  return root;
}

function getFocusableElements(root) {
  return Array.from(
    root.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.disabled && element.offsetParent !== null);
}

export function createModal() {
  let state = {
    open: false,
    title: "",
    description: "",
    confirmText: "Xác nhận",
    cancelText: "Hủy",
    onConfirm: null,
    onCancel: null,
  };

  function close() {
    const root = ensureModalRoot();
    root.hidden = true;
    root.innerHTML = "";
    document.body.classList.remove("pet-modal-open");
    state.open = false;
  }

  function handleBackdropClick(event) {
    if (event.target?.dataset?.modalAction === "cancel") {
      state.onCancel?.();
      close();
    }

    if (event.target?.dataset?.modalAction === "confirm") {
      state.onConfirm?.();
      close();
    }

    if (event.target === event.currentTarget) {
      state.onCancel?.();
      close();
    }
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      state.onCancel?.();
      close();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const root = ensureModalRoot();
    const focusables = getFocusableElements(root);
    if (focusables.length === 0) {
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function open(options = {}) {
    state = {
      ...state,
      open: true,
      title: String(options.title || state.title || ""),
      description: String(options.description || state.description || ""),
      confirmText: String(options.confirmText || "Xác nhận"),
      cancelText: String(options.cancelText || "Hủy"),
      onConfirm: typeof options.onConfirm === "function" ? options.onConfirm : null,
      onCancel: typeof options.onCancel === "function" ? options.onCancel : null,
    };

    const root = ensureModalRoot();
    root.hidden = false;
    root.innerHTML = `
      <div class="pet-modal-backdrop" data-modal-backdrop>
        <section class="pet-modal pet-modal--dialog" role="dialog" aria-modal="true" aria-labelledby="pet-modal-title" aria-describedby="pet-modal-description">
          <h2 class="pet-modal__title" id="pet-modal-title">${escapeHtml(state.title)}</h2>
          <p class="pet-modal__description" id="pet-modal-description">${escapeHtml(state.description)}</p>
          <div class="pet-modal__actions">
            <button type="button" class="pet-btn pet-btn--secondary" data-modal-action="cancel">${escapeHtml(state.cancelText)}</button>
            <button type="button" class="pet-btn pet-btn--primary" data-modal-action="confirm">${escapeHtml(state.confirmText)}</button>
          </div>
        </section>
      </div>
    `;

    root.querySelector("[data-modal-backdrop]")?.addEventListener("click", handleBackdropClick);
    root.addEventListener("keydown", handleKeydown);
    document.body.classList.add("pet-modal-open");

    const primaryButton = root.querySelector('[data-modal-action="confirm"]');
    if (primaryButton instanceof HTMLElement) {
      window.setTimeout(() => primaryButton.focus(), 0);
    }
  }

  function mount(target) {
    const root = asElement(target);
    if (root) {
      root.appendChild(ensureModalRoot());
    }
  }

  return {
    open,
    close,
    mount,
    get isOpen() {
      return state.open;
    },
  };
}
