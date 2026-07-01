/*
 * Chức năng: Chấm quiz, lưu câu sai và cập nhật độ chính xác theo chủ đề.
 * Dữ liệu đầu vào: quiz trong Firestore, answers từ học sinh.
 * Dữ liệu đầu ra: Điểm số, danh sách câu sai, dữ liệu đúng/sai theo topic.
 * File liên quan: src/services/topicAccuracyService.js, src/repositories/*
 */
const { db } = require("../firebase");
const ApiError = require("../utils/apiError");
const {
  parseVersionQuizId,
  getQuizVersionDocRefByParentId,
} = require("./quizVersionService");
const { recordUserTopicAccuracy } = require("./quizSelectionService");

const QUIZZES_COLLECTION = db.collection("quizzes");
const WRONG_ANSWERS_COLLECTION = db.collection("wrong_answers");

function normalizeAnswerLabel(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeQuestionIndex(value) {
  const index = Number(value);

  return Number.isInteger(index) && index >= 0 ? index : null;
}

function getCorrectOption(question) {
  if (!question || typeof question !== "object" || !Array.isArray(question.options)) {
    return null;
  }

  return question.options.find((option) => option && option.correct === true) || null;
}

function getOptionByLabel(question, label) {
  if (!question || typeof question !== "object" || !Array.isArray(question.options)) {
    return null;
  }

  const normalizedLabel = normalizeAnswerLabel(label);

  return (
    question.options.find(
      (option) => normalizeAnswerLabel(option?.label) === normalizedLabel
    ) || null
  );
}

function buildWrongAnswerEntry({ questionIndex, question, correctOption, userOption, selectedLabel }) {
  return {
    questionIndex,
    question: String(question?.question || "").trim(),
    correctAnswer: normalizeAnswerLabel(correctOption?.label),
    userAnswer: selectedLabel || null,
    correctAnswerText: String(correctOption?.text || "").trim(),
    userAnswerText: selectedLabel ? String(userOption?.text || "").trim() : "",
  };
}

function normalizeWrongAnswersRecord(record = {}, fallbackId = "") {
  const wrongQuestions = Array.isArray(record?.wrongQuestions)
    ? record.wrongQuestions.filter(Boolean)
    : [];
  const wrongCount = Number(record?.wrongCount);

  return {
    id: String(record?.id || fallbackId || record?.quizId || "").trim(),
    userId: String(record?.userId || "").trim(),
    quizId: String(record?.quizId || "").trim(),
    wrongCount:
      Number.isFinite(wrongCount) && wrongCount >= 0
        ? Math.max(wrongQuestions.length, Math.floor(wrongCount))
        : wrongQuestions.length,
    wrongQuestions,
    totalQuestions: Math.max(0, Math.floor(Number(record?.totalQuestions) || 0)),
    correctAnswers: Math.max(0, Math.floor(Number(record?.correctAnswers) || 0)),
    score: Math.max(0, Math.floor(Number(record?.score) || 0)),
    createdAt: String(record?.createdAt || "").trim(),
    updatedAt: String(record?.updatedAt || record?.createdAt || "").trim(),
  };
}

async function getRecentWrongAnswersByUserId(userId) {
  const normalizedUserId = String(userId || "").trim();

  if (!normalizedUserId) {
    return null;
  }

  const snapshot = await WRONG_ANSWERS_COLLECTION.doc(normalizedUserId).get();

  if (!snapshot.exists) {
    return null;
  }

  return normalizeWrongAnswersRecord(snapshot.data() || {}, snapshot.id);
}

async function getQuizById(quizId) {
  const normalizedQuizId = String(quizId || "").trim();

  if (!normalizedQuizId) {
    throw new ApiError(400, "quizId is required");
  }

  const parsedQuizId = parseVersionQuizId(normalizedQuizId);

  if (parsedQuizId) {
    const versionSnapshot = await getQuizVersionDocRefByParentId(
      parsedQuizId.parentId,
      parsedQuizId.versionId
    ).get();

    if (versionSnapshot.exists) {
      const versionData = versionSnapshot.data() || {};
      const quizData = versionData.data || versionData.quizData || {};

      return {
        id: normalizedQuizId,
        quizId: normalizedQuizId,
        versionId: parsedQuizId.versionId,
        versionNumber: versionData.versionNumber || null,
        ...quizData,
      };
    }

    const rootSnapshot = await QUIZZES_COLLECTION.doc(parsedQuizId.parentId).get();

    if (!rootSnapshot.exists) {
      throw new ApiError(404, "Quiz not found");
    }

    const rootData = rootSnapshot.data() || {};

    return {
      id: normalizedQuizId,
      quizId: normalizedQuizId,
      versionId: parsedQuizId.versionId,
      versionNumber: Number(parsedQuizId.versionId.replace(/^v/i, "")) || 1,
      ...rootData,
    };
  }

  const snapshot = await QUIZZES_COLLECTION.doc(normalizedQuizId).get();

  if (!snapshot.exists) {
    throw new ApiError(404, "Quiz not found");
  }

  return {
    id: snapshot.id,
    quizId: snapshot.id,
    versionId: "v1",
    versionNumber: 1,
    ...(snapshot.data() || {}),
  };
}

async function gradeQuizSubmission({ userId, quizId, answers }) {
  const normalizedUserId = String(userId || "").trim();

  if (!normalizedUserId) {
    throw new ApiError(400, "userId is required");
  }

  const quiz = await getQuizById(quizId);
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];

  if (questions.length === 0) {
    throw new ApiError(502, "Quiz has no questions");
  }

  const submittedAnswers = Array.isArray(answers) ? answers : [];
  const answersByQuestionIndex = new Map();

  submittedAnswers.forEach((answer) => {
    const questionIndex = normalizeQuestionIndex(answer?.questionIndex);
    const selected = normalizeAnswerLabel(answer?.selected);

    if (questionIndex === null) {
      throw new ApiError(400, "Each answer must include a valid questionIndex");
    }

    if (!["A", "B", "C", "D"].includes(selected)) {
      throw new ApiError(400, "Each selected answer must be A, B, C, or D");
    }

    if (questionIndex >= questions.length) {
      throw new ApiError(400, "questionIndex is out of range");
    }

    answersByQuestionIndex.set(questionIndex, selected);
  });

  const wrongQuestions = [];
  let correctAnswers = 0;
  const topicResults = [];

  questions.forEach((question, questionIndex) => {
    const correctOption = getCorrectOption(question);

    if (!correctOption) {
      throw new ApiError(502, `Question ${questionIndex + 1} is missing a correct option`);
    }

    const selectedLabel = answersByQuestionIndex.get(questionIndex) || "";
    const userOption = selectedLabel ? getOptionByLabel(question, selectedLabel) : null;
    const isCorrect = selectedLabel && normalizeAnswerLabel(correctOption.label) === selectedLabel;

    if (selectedLabel) {
      // Ghi đúng/sai theo từng câu để cập nhật độ chính xác của topic.
      topicResults.push({
        isCorrect,
      });
    }

    if (isCorrect) {
      correctAnswers += 1;
      return;
    }

    wrongQuestions.push(
      buildWrongAnswerEntry({
        questionIndex,
        question,
        correctOption,
        userOption,
        selectedLabel,
      })
    );
  });

  const totalQuestions = questions.length;
  const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  const createdAt = new Date().toISOString();

  await WRONG_ANSWERS_COLLECTION.doc(normalizedUserId).set(
    {
      userId: normalizedUserId,
      quizId: String(quiz.id || quizId).trim(),
      totalQuestions,
      correctAnswers,
      score,
      wrongCount: wrongQuestions.length,
      wrongQuestions,
      createdAt,
      updatedAt: createdAt,
    },
    { merge: true }
  );

  if (quiz.topicId) {
    try {
      // Nếu cập nhật topic accuracy lỗi thì vẫn giữ được kết quả chấm bài.
      await recordUserTopicAccuracy(normalizedUserId, quiz.topicId, topicResults);
    } catch (error) {
      console.warn("[EduKids][quizGradeService] Unable to update topic accuracy:", error);
    }
  }

  return {
    totalQuestions,
    correctAnswers,
    score,
    wrongQuestions,
    quizId: String(quiz.id || quizId).trim(),
    topicId: String(quiz.topicId || "").trim(),
  };
}

module.exports = {
  gradeQuizSubmission,
  getQuizById,
  getRecentWrongAnswersByUserId,
  normalizeWrongAnswersRecord,
};
