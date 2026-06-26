const ApiError = require("../utils/apiError");
const { PET_ERROR_CODES } = require("../constants/petConstants");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeItemReference(value) {
  if (!value || typeof value === "string" || typeof value === "number") {
    return normalizeText(value);
  }

  if (typeof value === "object") {
    return normalizeText(
      value.itemId || value.id || value.key || value.code || value.item || "",
    );
  }

  return "";
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

  if (actionName === "inventory-use") {
    const itemId = normalizeText(body.itemId || body.inventoryItemId || "");
    const targetPetId = normalizeText(body.targetPetId || body.petId || "");
    const quantity = Math.max(1, Math.floor(Number(body.quantity || 1)));

    if (!itemId) {
      throw new ApiError(400, "itemId is required", PET_ERROR_CODES.VALIDATION_ERROR, {
        actionName,
        fieldErrors: [{ field: "itemId", message: "itemId is required" }],
      });
    }

    if (quantity <= 0 || !Number.isFinite(quantity)) {
      throw new ApiError(400, "quantity must be greater than 0", PET_ERROR_CODES.VALIDATION_ERROR, {
        actionName,
        fieldErrors: [{ field: "quantity", message: "quantity must be greater than 0" }],
      });
    }

    return {
      itemId,
      quantity,
      targetPetId,
      idempotencyKey,
    };
  }

  if (actionName === "shop-buy") {
    const itemId = normalizeItemReference(
      body.itemId || body.item || body.id || body.key || body.code || "",
    );
    const quantity = Math.max(1, Math.floor(Number(body.quantity || 1)));

    if (!itemId) {
      throw new ApiError(400, "itemId is required", PET_ERROR_CODES.VALIDATION_ERROR, {
        actionName,
        fieldErrors: [{ field: "itemId", message: "itemId is required" }],
      });
    }

    if (quantity <= 0 || !Number.isFinite(quantity)) {
      throw new ApiError(400, "quantity must be greater than 0", PET_ERROR_CODES.VALIDATION_ERROR, {
        actionName,
        fieldErrors: [{ field: "quantity", message: "quantity must be greater than 0" }],
      });
    }

    return {
      itemId,
      quantity,
      idempotencyKey,
    };
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
