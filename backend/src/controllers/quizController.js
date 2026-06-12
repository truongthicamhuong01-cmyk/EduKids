const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const successResponse = require("../utils/apiResponse");
const { normalizeString } = require("../utils/validators");
const { ensureNextQuizVersion } = require("../services/quizGenerationService");

const createQuiz = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  if (req.user.role !== "teacher") {
    throw new ApiError(403, "Only teachers can generate quizzes");
  }

  const grade =
    typeof req.body.grade === "string" || typeof req.body.grade === "number"
      ? String(req.body.grade).trim()
      : "";
  const subject = normalizeString(req.body.subject);
  const topicId = normalizeString(req.body.topicId);

  if (!grade) {
    throw new ApiError(400, "grade is required");
  }

  if (!subject) {
    throw new ApiError(400, "subject is required");
  }

  if (!topicId) {
    throw new ApiError(400, "topicId is required");
  }

  const quiz = await ensureNextQuizVersion({
    grade,
    subject,
    topicId,
    minVersions: 3,
  });

  if (quiz?.skipped) {
    return successResponse(res, 200, "Quiz versions already exist", quiz);
  }

  return successResponse(res, 201, "Quiz version generated successfully", quiz);
});

module.exports = {
  createQuiz,
};
