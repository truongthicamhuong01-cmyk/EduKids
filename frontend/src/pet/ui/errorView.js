import { asElement, escapeHtml } from "../utils/dom.js";
import { mountIntoPetHost } from "../utils/pageHost.js";

const ERROR_ROOT_ID = "edukids-pet-error-root";

function ensureErrorRoot() {
  let root = document.getElementById(ERROR_ROOT_ID);

  if (!root) {
    root = document.createElement("div");
    root.id = ERROR_ROOT_ID;
    root.className = "pet-error-root";
    root.hidden = true;
    mountIntoPetHost(root);
  }

  return root;
}

export function createErrorView() {
  function show(error) {
    const root = ensureErrorRoot();
    const message = escapeHtml(error?.message || "Đã có lỗi xảy ra.");
    root.hidden = false;
    root.innerHTML = `
      <div class="pet-error-banner" role="status">
        <strong>Pet</strong>
        <span>${message}</span>
      </div>
    `;
  }

  function hide() {
    const root = ensureErrorRoot();
    root.hidden = true;
    root.innerHTML = "";
  }

  function mount(target) {
    const root = asElement(target);
    if (root) {
      root.appendChild(ensureErrorRoot());
    }
  }

  return {
    show,
    hide,
    mount,
  };
}
