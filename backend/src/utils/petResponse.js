function getServerTime() {
  return new Date().toISOString();
}

function buildSuccessResponse({
  message,
  data = {},
  popupEvents = [],
  animationEvents = [],
  requestId = "",
  meta = {},
  serverTime = getServerTime(),
}) {
  return {
    success: true,
    message,
    data,
    popupEvents,
    animationEvents,
    serverTime,
    requestId,
    meta,
  };
}

function buildErrorResponse({
  statusCode,
  errorCode,
  message,
  details = null,
  fieldErrors = [],
  requestId = "",
  retryAfterSeconds,
  serverTime = getServerTime(),
}) {
  const payload = {
    success: false,
    errorCode,
    message,
    details,
    fieldErrors,
    requestId,
    serverTime,
  };

  if (typeof retryAfterSeconds === "number") {
    payload.retryAfterSeconds = retryAfterSeconds;
  }

  return {
    statusCode,
    payload,
  };
}

module.exports = {
  buildErrorResponse,
  buildSuccessResponse,
  getServerTime,
};
