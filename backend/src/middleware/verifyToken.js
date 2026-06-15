const jwt = require("jsonwebtoken");
const { db } = require("../firebase");
const { readSystemSettings } = require("../services/systemSettingsService");

async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token is required",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    decoded.uid = decoded.uid || decoded.userId || null;
    decoded.userId = decoded.userId || decoded.uid || null;

    if (decoded.uid) {
      const userSnapshot = await db.collection("users").doc(String(decoded.uid)).get();

      if (!userSnapshot.exists) {
        return res.status(401).json({
          success: false,
          message: "User account not found",
        });
      }

      const status = String(userSnapshot.data()?.status || "active").toLowerCase();

      if (status === "locked") {
        return res.status(403).json({
          success: false,
          message: "Account is locked",
        });
      }

      const systemSettings = await readSystemSettings().catch(() => null);
      const role = String(userSnapshot.data()?.role || decoded.role || "").toLowerCase();

      if (systemSettings?.maintenance?.enabled && role !== "admin") {
        return res.status(503).json({
          success: false,
          message:
            systemSettings.maintenance.message ||
            "Hệ thống đang bảo trì, vui lòng quay lại sau.",
        });
      }
    }

    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}

module.exports = verifyToken;
