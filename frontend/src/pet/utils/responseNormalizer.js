export function normalizeBackendResponse(response) {
  if (!response || typeof response !== "object") {
    return {
      success: false,
      message: "Phản hồi không hợp lệ",
      data: {},
      popupEvents: [],
      animationEvents: [],
      serverTime: "",
      requestId: "",
      meta: {},
    };
  }

  return {
    success: Boolean(response.success),
    message: String(response.message || ""),
    data: response.data && typeof response.data === "object" ? response.data : {},
    popupEvents: Array.isArray(response.popupEvents) ? response.popupEvents : [],
    animationEvents: Array.isArray(response.animationEvents) ? response.animationEvents : [],
    serverTime: String(response.serverTime || ""),
    requestId: String(response.requestId || ""),
    meta: response.meta && typeof response.meta === "object" ? response.meta : {},
  };
}

