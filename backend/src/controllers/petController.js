const asyncHandler = require("../utils/asyncHandler");
const { buildSuccessResponse } = require("../utils/petResponse");
const {
  validatePetActionBody,
  validateSelectPetBody,
  validateUid,
} = require("../validators/petValidators");
const petService = require("../services/petService");

function getRequestId(req) {
  return String(req.requestId || req.headers["x-request-id"] || "").trim();
}

function getIdempotencyKey(req, body = {}) {
  return String(
    body.idempotencyKey ||
      req.headers["idempotency-key"] ||
      req.headers["Idempotency-Key"] ||
      "",
  ).trim();
}

function sendPetSuccess(res, result, requestId) {
  return res.status(result.statusCode || 200).json(
    buildSuccessResponse({
      message: result.message,
      data: result.data,
      popupEvents: result.popupEvents || [],
      animationEvents: result.animationEvents || [],
      requestId,
      meta: result.meta || {},
    }),
  );
}

const getPet = asyncHandler(async (req, res) => {
  const uid = validateUid(req.user?.uid || req.user?.userId);
  const requestId = getRequestId(req);
  const result = await petService.getPet({ uid, requestId });
  return sendPetSuccess(res, result, requestId);
});

const selectPet = asyncHandler(async (req, res) => {
  const uid = validateUid(req.user?.uid || req.user?.userId);
  const requestId = getRequestId(req);
  const body = validateSelectPetBody(req.body || {});
  const idempotencyKey = getIdempotencyKey(req, req.body || {});
  const result = await petService.selectPet({
    uid,
    body,
    requestId,
    idempotencyKey,
  });

  return sendPetSuccess(res, result, requestId);
});

const feed = asyncHandler(async (req, res) => {
  const uid = validateUid(req.user?.uid || req.user?.userId);
  const requestId = getRequestId(req);
  const body = validatePetActionBody(req.body || {}, "feed");
  const idempotencyKey = getIdempotencyKey(req, req.body || {});
  const result = await petService.feed({
    uid,
    body,
    requestId,
    idempotencyKey,
  });

  return sendPetSuccess(res, result, requestId);
});

const play = asyncHandler(async (req, res) => {
  const uid = validateUid(req.user?.uid || req.user?.userId);
  const requestId = getRequestId(req);
  const body = validatePetActionBody(req.body || {}, "play");
  const idempotencyKey = getIdempotencyKey(req, req.body || {});
  const result = await petService.play({
    uid,
    body,
    requestId,
    idempotencyKey,
  });

  return sendPetSuccess(res, result, requestId);
});

const sleep = asyncHandler(async (req, res) => {
  const uid = validateUid(req.user?.uid || req.user?.userId);
  const requestId = getRequestId(req);
  const body = validatePetActionBody(req.body || {}, "sleep");
  const idempotencyKey = getIdempotencyKey(req, req.body || {});
  const result = await petService.sleep({
    uid,
    body,
    requestId,
    idempotencyKey,
  });

  return sendPetSuccess(res, result, requestId);
});

const wake = asyncHandler(async (req, res) => {
  const uid = validateUid(req.user?.uid || req.user?.userId);
  const requestId = getRequestId(req);
  const body = validatePetActionBody(req.body || {}, "wake");
  const idempotencyKey = getIdempotencyKey(req, req.body || {});
  const result = await petService.wake({
    uid,
    body,
    requestId,
    idempotencyKey,
  });

  return sendPetSuccess(res, result, requestId);
});

module.exports = {
  feed,
  getPet,
  play,
  selectPet,
  sleep,
  wake,
};
