import { EventBus } from "../utils/eventBus.js";
import { normalizeBackendResponse } from "../utils/responseNormalizer.js";

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function createDefaultState() {
  return {
    pet: null,
    inventory: null,
    shop: null,
    wallet: null,
    loading: false,
    loadingFlags: {},
    hasPet: null,
    popupQueue: [],
    error: null,
    serverTime: "",
    lastResponse: null,
    animationEvents: [],
    requestId: "",
  };
}

export function createPetStore(initialState = {}) {
  const bus = new EventBus();
  let state = {
    ...createDefaultState(),
    ...clone(initialState),
  };

  function getState() {
    return clone(state);
  }

  function emitUpdate(type = "STATE_UPDATED") {
    const snapshot = getState();
    bus.emit(type, snapshot);
    bus.emit("STATE_UPDATED", snapshot);
    return snapshot;
  }

  function setState(patch = {}, type = "STATE_UPDATED") {
    state = {
      ...state,
      ...clone(patch),
    };
    return emitUpdate(type);
  }

  function setLoading(flagName, value) {
    const loadingFlags = {
      ...(state.loadingFlags || {}),
      [String(flagName || "").trim() || "default"]: Boolean(value),
    };
    const loading = Object.values(loadingFlags).some(Boolean);
    return setState({ loadingFlags, loading }, "LOADING_CHANGED");
  }

  function setError(error) {
    const normalizedError =
      error && typeof error === "object"
        ? {
            message: String(error.message || "Đã có lỗi xảy ra."),
            status: Number(error.status || 0),
            errorCode: String(error.errorCode || ""),
            details: error.details || null,
          }
        : {
            message: String(error || "Đã có lỗi xảy ra."),
            status: 0,
            errorCode: "",
            details: null,
          };

    return setState({ error: normalizedError }, "ERROR_CHANGED");
  }

  function clearError() {
    return setState({ error: null }, "ERROR_CHANGED");
  }

  function pushPopups(events = []) {
    const popupQueue = [...(state.popupQueue || []), ...events.filter(Boolean)];
    return setState({ popupQueue }, "POPUP");
  }

  function shiftPopup() {
    const popupQueue = [...(state.popupQueue || [])];
    popupQueue.shift();
    return setState({ popupQueue }, "POPUP");
  }

  function applyBackendResponse(response, source = "") {
    const normalized = normalizeBackendResponse(response);
    const popupQueue = Array.isArray(normalized.popupEvents) && normalized.popupEvents.length > 0
      ? [...(state.popupQueue || []), ...normalized.popupEvents.filter(Boolean)]
      : [...(state.popupQueue || [])];
    const nextState = {
      lastResponse: normalized,
      serverTime: normalized.serverTime || state.serverTime || "",
      requestId: normalized.requestId || state.requestId || "",
      animationEvents: normalized.animationEvents || [],
      popupQueue,
      error: null,
    };

    const data = normalized.data || {};

    if (data.pet !== undefined) {
      nextState.pet = data.pet;
      nextState.hasPet = Boolean(data.pet);
    }

    if (data.hasPet !== undefined) {
      nextState.hasPet = Boolean(data.hasPet);
      if (data.hasPet === false) {
        nextState.pet = null;
        nextState.inventory = null;
        nextState.shop = null;
        nextState.wallet = null;
        nextState.popupQueue = [];
        nextState.animationEvents = [];
      }
    }

    if (data.inventory !== undefined) {
      nextState.inventory = data.inventory;
    }

    if (data.shop !== undefined || data.items !== undefined) {
      nextState.shop = {
        items: Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.shop?.items)
            ? data.shop.items
            : [],
        currency: data.currency || data.shop?.currency || "",
        raw: data.shop || data,
      };
    }

    if (data.wallet !== undefined) {
      nextState.wallet = data.wallet;
    }

    const snapshot = setState(nextState, "PET_UPDATED");

    if (data.inventory !== undefined) {
      bus.emit("INVENTORY_UPDATED", { inventory: data.inventory, source, state: snapshot });
    }

    if (data.shop !== undefined || data.items !== undefined) {
      bus.emit("SHOP_UPDATED", { shop: snapshot.shop, source, state: snapshot });
    }

    if (Array.isArray(normalized.popupEvents) && normalized.popupEvents.length > 0) {
      bus.emit("POPUP", snapshot);
    }

    return snapshot;
  }

  function subscribe(handler) {
    return bus.on("STATE_UPDATED", handler);
  }

  function on(eventName, handler) {
    return bus.on(eventName, handler);
  }

  function off(eventName, handler) {
    return bus.off(eventName, handler);
  }

  function reset() {
    state = createDefaultState();
    return emitUpdate("STATE_UPDATED");
  }

  return {
    bus,
    getState,
    setState,
    setLoading,
    setError,
    clearError,
    pushPopups,
    shiftPopup,
    applyBackendResponse,
    subscribe,
    on,
    off,
    reset,
  };
}
