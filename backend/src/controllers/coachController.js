const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const successResponse = require("../utils/apiResponse");
const { analyzeStudentProgress } = require("../services/coachAnalysisService");

const analyzeCoach = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  if (req.user.role && req.user.role !== "student") {
    throw new ApiError(403, "Only students can use AI Coach");
  }

  const userId = req.user.userId || req.user.uid;
  const result = await analyzeStudentProgress(userId);

  return successResponse(res, 200, "AI Coach analysis generated successfully", result);
});

module.exports = {
  analyzeCoach,
};
