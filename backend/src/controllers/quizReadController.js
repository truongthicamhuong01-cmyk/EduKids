const asyncHandler = require("../utils/asyncHandler");
const successResponse = require("../utils/apiResponse");
const ApiError = require("../utils/apiError");
const { normalizeString } = require("../utils/validators");
const { listTopics, getQuizByTopic } = require("../services/quizReadService");
const { selectQuizVersion } = require("../services/quizSelectionService");
const { listQuizVersions } = require("../services/quizVersionService");

const getTopics = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  const grade = normalizeString(req.query.grade);
  const subject = normalizeString(req.query.subject);
  const topics = await listTopics({ grade, subject });

  return successResponse(res, 200, "Topics fetched successfully", topics);
});

const getQuizByTopicId = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  const grade = normalizeString(req.query.grade);
  const subject = normalizeString(req.query.subject);
  const topicId = normalizeString(req.query.topicId);

  if (!grade) {
    throw new ApiError(400, "grade is required");
  }

  if (!subject) {
    throw new ApiError(400, "subject is required");
  }

  if (!topicId) {
    throw new ApiError(400, "topicId is required");
  }

  const versions = await listQuizVersions({
    grade,
    subject,
    topicId,
  });

  if (versions.length === 0) {
    const legacyQuiz = await getQuizByTopic({ grade, subject, topicId });
    return successResponse(res, 200, "Quiz fetched successfully", legacyQuiz);
  }

  const selected = await selectQuizVersion({
    userId: req.user.userId || req.user.uid,
    grade,
    subject,
    topicId,
    versions,
    strategy: normalizeString(req.query.strategy) || "round_robin",
  });

  const selectedVersion = selected.selectedVersion;
  const quizData = selectedVersion.data || {};
  const quiz = {
    ...quizData,
    id: selected.quizId,
    quizId: selected.quizId,
    versionId: selectedVersion.versionId,
    versionNumber: selectedVersion.versionNumber,
    availableVersions: versions.map((version) => version.versionId),
  };

  return successResponse(res, 200, "Quiz fetched successfully", quiz);
});

module.exports = {
  getTopics,
  getQuizByTopicId,
};
