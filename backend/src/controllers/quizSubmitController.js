const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const successResponse = require("../utils/apiResponse");
const { gradeQuizSubmission } = require("../services/quizGradeService");
const { awardExp } = require("../services/progressService");
const { findUserById } = require("../services/userService");

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

  const userId = req.user.userId || req.user.uid;
  const rewardTopicKey = String(result?.topicId || quizId || "").trim();
  const quizRewardId = `topic:${rewardTopicKey}:${userId}`;
  const awardResult = await awardExp(userId, 30, "Topic Learning", quizRewardId).catch(() => null);
  const latestProfile = awardResult?.user || (await findUserById(userId).catch(() => null));

  return successResponse(res, 200, "Quiz submitted successfully", {
    ...result,
    profile: latestProfile || undefined,
  });
});

module.exports = {
  submitQuiz,
};
