const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const successResponse = require("../utils/apiResponse");
const { normalizeString } = require("../utils/validators");
const { generateAssignmentQuestions } = require("../services/assignmentAiService");
const { readSystemSettings } = require("../services/systemSettingsService");

const generateAssignmentAiQuestions = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  if (req.user.role !== "teacher") {
    throw new ApiError(403, "Only teachers can generate AI assignment questions");
  }

  const systemSettings = await readSystemSettings();
  if (systemSettings?.maintenance?.enabled) {
    throw new ApiError(
      503,
      systemSettings.maintenance.message || "Hệ thống đang bảo trì, vui lòng quay lại sau.",
    );
  }

  if (
    systemSettings?.aiAssignmentEnabled === false ||
    systemSettings?.ai?.assignmentEnabled === false
  ) {
    throw new ApiError(403, "AI assignment generation is disabled");
  }

  const subject = normalizeString(req.body.subject);
  const topicId = normalizeString(req.body.topicId);
  const topicName = normalizeString(req.body.topicName);
  const grade = normalizeString(req.body.grade);
  const difficulty = normalizeString(req.body.difficulty);
  const questionCount = Number(req.body.questionCount);
  const notes = normalizeString(req.body.notes);

  if (!subject) {
    throw new ApiError(400, "subject is required");
  }

  if (!grade) {
    throw new ApiError(400, "grade is required");
  }

  if (!difficulty) {
    throw new ApiError(400, "difficulty is required");
  }

  if (!Number.isInteger(questionCount) || questionCount <= 0) {
    throw new ApiError(400, "questionCount must be greater than 0");
  }

  const questions = await generateAssignmentQuestions({
    subject,
    topicId,
    topicName,
    grade,
    difficulty,
    questionCount,
    notes,
  });

  return successResponse(res, 200, "Assignment questions generated successfully", questions);
});

module.exports = {
  generateAssignmentAiQuestions,
};
