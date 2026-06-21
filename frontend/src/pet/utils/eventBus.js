export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(eventName, handler) {
    const key = String(eventName || "").trim();

    if (!key || typeof handler !== "function") {
      return () => {};
    }

    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }

    const handlers = this.listeners.get(key);
    handlers.add(handler);

    return () => this.off(key, handler);
  }

  off(eventName, handler) {
    const key = String(eventName || "").trim();
    const handlers = this.listeners.get(key);

    if (!handlers) {
      return;
    }

    handlers.delete(handler);

    if (handlers.size === 0) {
      this.listeners.delete(key);
    }
  }

  emit(eventName, payload) {
    const key = String(eventName || "").trim();
    const handlers = this.listeners.get(key);

    if (!handlers || handlers.size === 0) {
      return;
    }

    [...handlers].forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.warn("[EduKids][Pet][EventBus] listener failed", error);
      }
    });
  }

  clear() {
    this.listeners.clear();
  }
}

