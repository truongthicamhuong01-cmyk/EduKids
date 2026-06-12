const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const successResponse = require("../utils/apiResponse");
const { gradeQuizSubmission } = require("../services/quizGradeService");

const submitQuiz = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  if (req.user.role && req.user.role !== "student") {
    throw new ApiError(403, "Only students can submit quizzes");
  }

  const quizId = String(req.body.quizId || "").trim();
  const answers = Array.isArray(req.body.answers) ? req.body.answers : null;

  if (!quizId) {
    throw new ApiError(400, "quizId is required");
  }

  if (!answers) {
    throw new ApiError(400, "answers must be an array");
  }

  const result = await gradeQuizSubmission({
    userId: req.user.userId || req.user.uid,
    quizId,
    answers,
  });

  return successResponse(res, 200, "Quiz submitted successfully", result);
});

module.exports = {
  submitQuiz,
};
