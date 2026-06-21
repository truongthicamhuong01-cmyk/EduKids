import { asElement } from "../utils/dom.js";

export function renderLoading(target, isLoading = false, label = "Đang tải dữ liệu...") {
  const root = asElement(target);

  if (!root) {
    return null;
  }

  root.hidden = !isLoading;
  root.setAttribute("aria-hidden", String(!isLoading));
  root.dataset.loadingLabel = label;

  return root;
}

