const ApiError = require("../utils/apiError");
const { PET_ERROR_CODES } = require("../constants/petConstants");

function normalizeText(value) {
  return String(value || "").trim();
}

function validateSelectPetBody(body = {}) {
  const petTypeId = normalizeText(body.petTypeId);
  const petName = normalizeText(body.petName || body.name);
  const errors = [];

  if (!petTypeId) {
    errors.push({ field: "petTypeId", message: "petTypeId is required" });
  }

  if (petName && petName.length > 24) {
    errors.push({ field: "petName", message: "petName must be 24 characters or less" });
  }

  if (errors.length > 0) {
    throw new ApiError(400, "Dữ liệu chọn Pet không hợp lệ", PET_ERROR_CODES.VALIDATION_ERROR, {
      fieldErrors: errors,
    });
  }

  return {
    petTypeId,
    petName,
  };
}

function validatePetActionBody(body = {}, actionName = "") {
  const idempotencyKey = normalizeText(body.idempotencyKey || body.requestKey || "");
  const errors = [];

  if (idempotencyKey && idempotencyKey.length > 128) {
    errors.push({ field: "idempotencyKey", message: "idempotencyKey must be 128 characters or less" });
  }

  if (errors.length > 0) {
    throw new ApiError(400, "Dữ liệu hành động không hợp lệ", PET_ERROR_CODES.VALIDATION_ERROR, {
      actionName,
      fieldErrors: errors,
    });
  }

  return {
    idempotencyKey,
  };
}

function validateUid(uid) {
  const normalizedUid = normalizeText(uid);

  if (!normalizedUid) {
    throw new ApiError(401, "Thiếu thông tin người dùng", PET_ERROR_CODES.UNAUTHORIZED);
  }

  return normalizedUid;
}

module.exports = {
  validatePetActionBody,
  validateSelectPetBody,
  validateUid,
};
