/*
 * Chức năng: Điều khiển luồng Boss Battle ở mức API.
 * Dữ liệu đầu vào: sessionId, câu trả lời, yêu cầu hint và hoàn tất trận.
 * Dữ liệu đầu ra: Trạng thái trận và phần thưởng sau khi kết thúc.
 * File liên quan: src/services/battleSessionService.js
 */
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const successResponse = require("../utils/apiResponse");
const {
  answerBattleSession,
  createBattleSessionFromQuiz,
  completeBattleSession,
  hintBattleSession,
  getBattleSession,
} = require("../services/battleSessionService");

function getRequestId(req) {
  return String(req.requestId || req.headers["x-request-id"] || "").trim();
}

function requireStudent(req) {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  if (String(req.user.role || "").toLowerCase() !== "student") {
    throw new ApiError(403, "Only students can use battle sessions");
  }
}

const createSession = asyncHandler(async (req, res) => {
  requireStudent(req);

  const userId = String(req.user.userId || req.user.uid || "").trim();
  const topicId = String(req.body.topicId || "").trim();
  const quizId = String(req.body.quizId || "").trim();
  const requestId = getRequestId(req);

  const session = await createBattleSessionFromQuiz({
    userId,
    topicId,
    quizId,
    requestId,
  });

  return successResponse(res, 201, "Battle session created successfully", session);
});

const getSession = asyncHandler(async (req, res) => {
  requireStudent(req);

  const userId = String(req.user.userId || req.user.uid || "").trim();
  const sessionId = String(req.params.sessionId || "").trim();
  const session = await getBattleSession({
    sessionId,
    userId,
  });

  return successResponse(res, 200, "Battle session loaded successfully", session);
});

const answerSession = asyncHandler(async (req, res) => {
  requireStudent(req);

  const userId = String(req.user.userId || req.user.uid || "").trim();
  const sessionId = String(req.params.sessionId || "").trim();
  const questionIndex = req.body?.questionIndex;
  const selected = String(req.body?.selected || "").trim();

  const result = await answerBattleSession({
    sessionId,
    userId,
    questionIndex,
    selected,
  });

  return successResponse(res, 200, "Battle answer processed successfully", result);
});

const hintSession = asyncHandler(async (req, res) => {
  requireStudent(req);

  const userId = String(req.user.userId || req.user.uid || "").trim();
  const sessionId = String(req.params.sessionId || "").trim();

  const result = await hintBattleSession({
    sessionId,
    userId,
  });

  return successResponse(res, 200, "Battle hint processed successfully", result);
});

const completeSession = asyncHandler(async (req, res) => {
  requireStudent(req);

  const userId = String(req.user.userId || req.user.uid || "").trim();
  const sessionId = String(req.params.sessionId || "").trim();

  const result = await completeBattleSession({
    sessionId,
    userId,
  });

  return successResponse(res, 200, "Battle session reward synced successfully", {
    rewardSummary: result.rewardSummary,
    achievements: result.achievements || { unlocked: [] },
    session: result.session,
    profile: result.profile || null,
  });
});

module.exports = {
  answerSession,
  createSession,
  completeSession,
  hintSession,
  getSession,
};
