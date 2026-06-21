const asyncHandler = require("../utils/asyncHandler");
const { buildSuccessResponse } = require("../utils/petResponse");
const { validateUid, validatePetActionBody } = require("../validators/petValidators");
const shopService = require("../services/shopService");

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

function sendSuccess(res, result, requestId) {
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

const getShop = asyncHandler(async (req, res) => {
  const uid = validateUid(req.user?.uid || req.user?.userId);
  const requestId = getRequestId(req);
  const result = await shopService.getShop({ uid, requestId });
  return sendSuccess(res, result, requestId);
});

const buyItem = asyncHandler(async (req, res) => {
  const uid = validateUid(req.user?.uid || req.user?.userId);
  const requestId = getRequestId(req);
  const body = validatePetActionBody(req.body || {}, "shop-buy");
  const idempotencyKey = getIdempotencyKey(req, req.body || {});
  const result = await shopService.buyItem({
    uid,
    body,
    requestId,
    idempotencyKey,
  });

  return sendSuccess(res, result, requestId);
});

module.exports = {
  buyItem,
  getShop,
};
