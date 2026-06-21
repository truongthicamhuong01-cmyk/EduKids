const asyncHandler = require("../utils/asyncHandler");
const { buildSuccessResponse } = require("../utils/petResponse");
const { validateUid, validatePetActionBody } = require("../validators/petValidators");
const inventoryService = require("../services/inventoryService");

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

const getInventory = asyncHandler(async (req, res) => {
  const uid = validateUid(req.user?.uid || req.user?.userId);
  const requestId = getRequestId(req);
  const result = await inventoryService.getInventory({ uid, requestId });
  return sendSuccess(res, result, requestId);
});

const useItem = asyncHandler(async (req, res) => {
  const uid = validateUid(req.user?.uid || req.user?.userId);
  const requestId = getRequestId(req);
  const body = validatePetActionBody(req.body || {}, "inventory-use");
  const idempotencyKey = getIdempotencyKey(req, req.body || {});
  const result = await inventoryService.useItem({
    uid,
    body,
    requestId,
    idempotencyKey,
  });

  return sendSuccess(res, result, requestId);
});

module.exports = {
  getInventory,
  useItem,
};
