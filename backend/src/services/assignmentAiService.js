const ApiError = require("../utils/apiError");
const {
  findTopicById,
  safeJsonParse,
  generateJsonFromPrompt,
} = require("./aiService");
const {
  buildAssignmentAiPrompt,
  getSubjectLabel,
} = require("./assignmentAiPrompt");
const { readSystemSettings } = require("./systemSettingsService");

function normalizeOptionText(option) {
  if (option && typeof option === "object") {
    return String(option.text || option.value || option.label || "").trim();
  }

  return String(option || "").trim();
}

function normalizeCorrectAnswerIndex(correctAnswer, options) {
  const normalizedOptions = Array.isArray(options) ? options.map(normalizeOptionText) : [];

  if (Number.isInteger(correctAnswer) && correctAnswer >= 0 && correctAnswer < 4) {
    return correctAnswer;
  }

  const parsedNumber = Number(correctAnswer);

  if (Number.isInteger(parsedNumber) && parsedNumber >= 0 && parsedNumber < 4) {
    return parsedNumber;
  }

  const text = String(correctAnswer || "").trim().toUpperCase();

  if (/^[A-D]$/.test(text)) {
    return text.charCodeAt(0) - 65;
  }

  const textMatchIndex = normalizedOptions.findIndex(
    (option) => option && option.toUpperCase() === text,
  );

  if (textMatchIndex >= 0) {
    return textMatchIndex;
  }

  throw new ApiError(502, "Gemini returned an invalid correctAnswer value");
}

function validateGeneratedQuestion(question, questionIndex) {
  if (!question || typeof question !== "object" || Array.isArray(question)) {
    throw new ApiError(502, `Question ${questionIndex + 1} is invalid`);
  }

  const questionText = String(question.question || "").trim();

  if (!questionText) {
    throw new ApiError(502, `Question ${questionIndex + 1} must have question text`);
  }

  if (!Array.isArray(question.options) || question.options.length !== 4) {
    throw new ApiError(502, `Question ${questionIndex + 1} must have exactly 4 options`);
  }

  const options = question.options.map(normalizeOptionText);

  if (options.some((option) => !option)) {
    throw new ApiError(502, `Question ${questionIndex + 1} must have non-empty options`);
  }

  const correctAnswer = normalizeCorrectAnswerIndex(question.correctAnswer, options);

  return {
    question: questionText,
    options,
    correctAnswer,
  };
}

function validateGeneratedAssignmentPayload(payload, questionCount) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError(502, "Assignment AI payload must be an object");
  }

  const questions = payload.questions;
  const expectedCount = Number(questionCount);

  if (!Number.isInteger(expectedCount) || expectedCount <= 0) {
    throw new ApiError(400, "questionCount must be a positive integer");
  }

  if (!Array.isArray(questions) || questions.length !== expectedCount) {
    throw new ApiError(502, `Assignment AI must return exactly ${expectedCount} questions`);
  }

  return {
    questions: questions.map(validateGeneratedQuestion),
  };
}

async function generateAssignmentQuestions({
  subject,
  topicId,
  topicName,
  grade,
  difficulty,
  questionCount,
  notes,
}) {
  const systemSettings = await readSystemSettings();

  if (
    systemSettings?.aiAssignmentEnabled === false ||
    systemSettings?.ai?.assignmentEnabled === false
  ) {
    throw new ApiError(403, "AI assignment generation is disabled");
  }

  const normalizedSubject = String(subject || "").trim();
  const normalizedGrade = String(grade || "").trim();
  const normalizedDifficulty = String(difficulty || "").trim();
  const normalizedNotes = String(notes || "").trim();
  const normalizedQuestionCount = Number(questionCount);

  if (!normalizedSubject) {
    throw new ApiError(400, "subject is required");
  }

  if (!normalizedGrade) {
    throw new ApiError(400, "grade is required");
  }

  if (!normalizedDifficulty) {
    throw new ApiError(400, "difficulty is required");
  }

  if (!Number.isInteger(normalizedQuestionCount) || normalizedQuestionCount <= 0) {
    throw new ApiError(400, "questionCount must be greater than 0");
  }

  const allowedQuestionCounts = new Set([5, 10, 15, 20]);
  if (!allowedQuestionCounts.has(normalizedQuestionCount)) {
    throw new ApiError(400, "questionCount must be one of 5, 10, 15, or 20");
  }

  const topic = topicId ? findTopicById(topicId) : null;
  const resolvedTopicName =
    String(topicName || topic?.title || topic?.name || topic?.topicName || topicId || "").trim();

  if (!resolvedTopicName) {
    throw new ApiError(400, "topicName is required");
  }

  if (topic && topic.grade && String(topic.grade).trim() !== normalizedGrade) {
    throw new ApiError(400, "topicId does not belong to the requested grade");
  }

  if (
    topic &&
    topic.subject &&
    String(topic.subject).trim().toLowerCase() !== normalizedSubject.toLowerCase()
  ) {
    throw new ApiError(400, "topicId does not belong to the requested subject");
  }

  const prompt = buildAssignmentAiPrompt({
    subject: getSubjectLabel(normalizedSubject),
    topicName: resolvedTopicName,
    grade: normalizedGrade,
    difficulty: normalizedDifficulty,
    questionCount: normalizedQuestionCount,
    notes: normalizedNotes,
  });

  const rawText = await generateJsonFromPrompt({ prompt });

  const parsed = safeJsonParse(rawText);
  const validated = validateGeneratedAssignmentPayload(parsed, normalizedQuestionCount);

  return {
    subject: normalizedSubject,
    subjectLabel: getSubjectLabel(normalizedSubject),
    grade: normalizedGrade,
    topicId: topic ? String(topic.topicId || topicId || "").trim() : String(topicId || "").trim(),
    topicName: resolvedTopicName,
    difficulty: normalizedDifficulty,
    questionCount: normalizedQuestionCount,
    notes: normalizedNotes,
    questions: validated.questions,
  };
}

module.exports = {
  generateAssignmentQuestions,
  validateGeneratedAssignmentPayload,
};
