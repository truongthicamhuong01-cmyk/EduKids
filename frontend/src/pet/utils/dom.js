export function asElement(target) {
  if (!target) {
    return null;
  }

  if (typeof target === "string") {
    return document.querySelector(target);
  }

  if (target instanceof Element) {
    return target;
  }

  return null;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

