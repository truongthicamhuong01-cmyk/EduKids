const PET_HOST_SELECTOR = "#pet";

export function getPetHostElement() {
  if (typeof document === "undefined") {
    return null;
  }

  return document.querySelector(PET_HOST_SELECTOR);
}

export function mountIntoPetHost(node) {
  const host = getPetHostElement();

  if (!host || !node) {
    return host;
  }

  if (node.parentElement !== host) {
    host.appendChild(node);
  }

  return host;
}
