/*
 * Chức năng: Nhận request AI Coach và ghi log sử dụng AI.
 * Dữ liệu đầu vào: req.user, tiến trình học của học sinh.
 * Dữ liệu đầu ra: Kết quả phân tích từ Gemini và log vào Firestore.
 * File liên quan: src/services/coachAnalysisService.js, src/firebase.js
 */
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const successResponse = require("../utils/apiResponse");
const { db } = require("../firebase");
const { analyzeStudentProgress } = require("../services/coachAnalysisService");

const AI_LOG_COLLECTION = "ai_usage_logs";

async function recordAiUsageLog(payload = {}) {
  try {
    const docRef = db.collection(AI_LOG_COLLECTION).doc();
    const now = new Date().toISOString();
    const success = typeof payload.success === "boolean" ? payload.success : false;

    const record = {
      id: docRef.id,
      feature: String(payload.feature || "coach").trim(),
      action: String(payload.action || "analyze").trim(),
      status: success ? "success" : "failed",
      success,
      userId: String(payload.userId || "").trim(),
      role: String(payload.role || "").trim(),
      message: String(payload.message || "").trim(),
      createdAt: now,
      createdAtValue: Date.parse(now),
      meta: payload.meta || {},
    };

    await docRef.set(record);
    return record;
  } catch (error) {
    console.warn("[EduKids][coachController] Failed to record AI usage:", error);
    return null;
  }
}

const analyzeCoach = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  if (req.user.role && req.user.role !== "student") {
    throw new ApiError(403, "Only students can use AI Coach");
  }

  const userId = req.user.userId || req.user.uid;
  try {
    const result = await analyzeStudentProgress(userId);
    await recordAiUsageLog({
      feature: "coach",
      action: "analyze",
      success: true,
      userId,
      role: req.user.role || "student",
      meta: {
        fromCache: Boolean(result?.fromCache),
      },
    });

    return successResponse(res, 200, "AI Coach analysis generated successfully", result);
  } catch (error) {
    await recordAiUsageLog({
      feature: "coach",
      action: "analyze",
      success: false,
      userId,
      role: req.user.role || "student",
      message: error?.message || "AI Coach analysis failed",
    });
    throw error;
  }
});

module.exports = {
  analyzeCoach,
};
