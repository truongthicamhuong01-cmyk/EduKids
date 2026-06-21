const jwt = require("jsonwebtoken");
const { db } = require("../firebase");
const { readSystemSettings } = require("../services/systemSettingsService");
const { buildErrorResponse } = require("../utils/petResponse");

async function sendAuthError(res, req, statusCode, errorCode, message) {
  const { payload } = buildErrorResponse({
    statusCode,
    errorCode,
    message,
    requestId: req.requestId || req.headers["x-request-id"] || "",
  });

  return res.status(statusCode).json(payload);
}

async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return sendAuthError(res, req, 401, "UNAUTHORIZED", "Access token is required");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    decoded.uid = decoded.uid || decoded.userId || null;
    decoded.userId = decoded.userId || decoded.uid || null;

    if (decoded.uid) {
      const userSnapshot = await db.collection("users").doc(String(decoded.uid)).get();

      if (!userSnapshot.exists) {
        return sendAuthError(res, req, 401, "UNAUTHORIZED", "User account not found");
      }

      const status = String(userSnapshot.data()?.status || "active").toLowerCase();

      if (status === "locked") {
        return sendAuthError(res, req, 403, "FORBIDDEN", "Account is locked");
      }

      const systemSettings = await readSystemSettings().catch(() => null);
      const role = String(userSnapshot.data()?.role || decoded.role || "").toLowerCase();

      if (systemSettings?.maintenance?.enabled && role !== "admin") {
        return sendAuthError(
          res,
          req,
          503,
          "SYSTEM_MAINTENANCE",
          systemSettings.maintenance.message || "Hệ thống đang bảo trì, vui lòng quay lại sau.",
        );
      }
    }

    req.user = decoded;
    return next();
  } catch (error) {
    return sendAuthError(res, req, 401, "UNAUTHORIZED", "Invalid or expired token");
  }
}

module.exports = verifyToken;
