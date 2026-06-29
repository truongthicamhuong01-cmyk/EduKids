const crypto = require("crypto");
const ApiError = require("../utils/apiError");
const { getQuizById } = require("./quizGradeService");
const { awardExp, recordLearningActivity } = require("./progressService");
const { grantReward } = require("./rewardService");
const { recordUserTopicAccuracy } = require("./quizSelectionService");
const { getUserById, getUserRef } = require("../repositories/userRepository");
const {
  createBattleSession,
  getBattleSessionById,
  getBattleSessionRef,
  runTransaction,
  updateBattleSessionById,
} = require("../repositories/battleSessionRepository");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeStatus(value) {
  const normalized = normalizeText(value).toLowerCase();
  return ["active", "victory", "defeat", "completed"].includes(normalized)
    ? normalized
    : "active";
}

function getInitialPlayerHP(totalQuestions) {
  return Math.max(1, Math.ceil(Math.max(0, Number(totalQuestions) || 0) / 2));
}

function normalizeAnswerLabel(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeBattleSessionLock(lock) {
  if (!lock || typeof lock !== "object") {
    return null;
  }

  const sessionId = normalizeText(lock.sessionId);
  if (!sessionId) {
    return null;
  }

  return {
    sessionId,
    topicId: normalizeText(lock.topicId),
    quizId: normalizeText(lock.quizId),
    status: normalizeStatus(lock.status || "active"),
    updatedAt: String(lock.updatedAt || ""),
  };
}

function isReusableBattleSession(session, { userId, topicId, quizId } = {}) {
  if (!session || typeof session !== "object") {
    return false;
  }

  if (normalizeText(session.userId) !== normalizeText(userId)) {
    return false;
  }

  if (normalizeStatus(session.status) !== "active") {
    return false;
  }

  return (
    normalizeText(session.topicId) === normalizeText(topicId) &&
    normalizeText(session.quizId) === normalizeText(quizId)
  );
}

function getOptionLabel(option, fallbackIndex) {
  return normalizeAnswerLabel(option?.label || ["A", "B", "C", "D"][fallbackIndex] || "");
}

function shuffleArray(items) {
  const nextItems = Array.isArray(items) ? [...items] : [];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1);
    const temp = nextItems[index];
    nextItems[index] = nextItems[swapIndex];
    nextItems[swapIndex] = temp;
  }

  return nextItems;
}

function getCorrectOption(question) {
  if (!question || typeof question !== "object" || !Array.isArray(question.options)) {
    return null;
  }

  return question.options.find((option) => option && option.correct === true) || null;
}

function getBossStateFromHP(hp) {
  const normalizedHP = Math.max(0, Math.floor(Number(hp) || 0));

  if (normalizedHP <= 0) {
    return "die";
  }

  if (normalizedHP <= 50) {
    return "rage";
  }

  if (normalizedHP <= 75) {
    return "angry";
  }

  return "idle";
}

const BOSS_BATTLE_ACHIEVEMENTS = [
  {
    key: "FIRST_BATTLE",
    badgeId: "badge_achievement",
    title: "FIRST BATTLE",
    description: "Hoàn thành Boss Battle đầu tiên",
  },
  {
    key: "BOSS_DEFEATED",
    badgeId: "badge_boss_defeated",
    title: "BOSS DEFEATED",
    description: "Đánh bại Boss trong Boss Battle",
  },
  {
    key: "COMBO_MASTER",
    badgeId: "badge_combo",
    title: "COMBO MASTER",
    description: "Đạt combo 5 trở lên trong một trận",
  },
  {
    key: "PERFECT_BATTLE",
    badgeId: "badge_perfect",
    title: "PERFECT BATTLE",
    description: "Hoàn thành trận với độ chính xác 100%",
  },
];

function getAchievementBadgeIds(user = {}) {
  const rewards = user?.rewards && typeof user.rewards === "object" ? user.rewards : {};
  return new Set(
    Array.isArray(rewards.badges)
      ? rewards.badges.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
  );
}

function getBossBattleAchievementCandidates(summary = {}) {
  const candidates = [];
  const battleStatus = normalizeStatus(summary?.battleStatus);
  const accuracy = Math.max(0, Math.floor(Number(summary?.accuracy) || 0));
  const maxCombo = Math.max(0, Math.floor(Number(summary?.maxCombo) || 0));
  const totalQuestions = Math.max(0, Math.floor(Number(summary?.totalQuestions) || 0));

  if (battleStatus === "victory" || battleStatus === "defeat" || battleStatus === "completed") {
    candidates.push(BOSS_BATTLE_ACHIEVEMENTS[0]);
  }

  if (battleStatus === "victory") {
    candidates.push(BOSS_BATTLE_ACHIEVEMENTS[1]);
  }

  if (maxCombo >= 5) {
    candidates.push(BOSS_BATTLE_ACHIEVEMENTS[2]);
  }

  if (accuracy >= 100 && totalQuestions > 0) {
    candidates.push(BOSS_BATTLE_ACHIEVEMENTS[3]);
  }

  return candidates;
}

async function unlockBossBattleAchievements({
  userId,
  sessionId,
  rewardSummary,
  user,
} = {}) {
  const normalizedUserId = normalizeText(userId);
  const normalizedSessionId = normalizeText(sessionId);
  const currentBadgeIds = getAchievementBadgeIds(user);
  const candidates = getBossBattleAchievementCandidates(rewardSummary);
  const unlocked = [];

  for (const achievement of candidates) {
    if (!achievement || !achievement.badgeId) {
      continue;
    }

    const alreadyHasBadge = currentBadgeIds.has(achievement.badgeId);
    if (alreadyHasBadge) {
      continue;
    }
    const idempotencyKey = `boss-battle-achievement:${normalizedUserId}:${achievement.key}`;

    await grantReward({
      userId: normalizedUserId,
      sourceType: "bossBattleAchievement",
      sourceId: normalizedUserId,
      ruleKey: achievement.key,
      rewardRule: {
        title: achievement.title,
        icon: "achievement",
        coin: 0,
        petExp: 0,
        petHappiness: 0,
        petHealth: 0,
        petEnergy: 0,
        petHunger: 0,
        badges: [achievement.badgeId],
      },
      requestId: normalizedSessionId,
      idempotencyKey,
      title: achievement.title,
    });

    currentBadgeIds.add(achievement.badgeId);

    if (!alreadyHasBadge) {
      unlocked.push({
        id: achievement.key,
        badgeId: achievement.badgeId,
        title: achievement.title,
        description: achievement.description,
      });
    }
  }

  return unlocked;
}

function getDamagePerCorrectAnswer(totalQuestions) {
  const normalizedTotalQuestions = Math.max(1, Math.floor(Number(totalQuestions) || 0));
  return Math.max(1, Math.ceil(100 / normalizedTotalQuestions));
}

function buildAnswerRecord({
  questionIndex,
  selected,
  correct,
  correctAnswer,
  bossHP,
  playerHP,
  combo,
}) {
  return {
    questionIndex,
    selected,
    correct,
    correctAnswer,
    bossHP,
    playerHP,
    combo,
    answeredAt: new Date().toISOString(),
  };
}

function buildBattleSessionResponse(session) {
  if (!session) {
    return null;
  }

  return {
    id: session.id || session.sessionId || "",
    sessionId: session.sessionId || session.id || "",
    userId: session.userId || "",
    topicId: session.topicId || "",
    quizId: session.quizId || "",
    currentQuestionIndex: Number(session.currentQuestionIndex || 0),
    bossHP: Number(session.bossHP || 0),
    playerHP: Number(session.playerHP || 0),
    combo: Number(session.combo || 0),
    hintRemaining: Number(session.hintRemaining ?? 3),
    answers: Array.isArray(session.answers) ? session.answers : [],
    status: normalizeStatus(session.status),
    startedAt: session.startedAt || session.createdAt || "",
    completedAt: session.completedAt || "",
    createdAt: session.createdAt || "",
    updatedAt: session.updatedAt || session.createdAt || "",
  };
}

function resolveBattleStatus({ bossHP, playerHP, nextQuestionExists }) {
  if (Number(bossHP) <= 0) {
    return "victory";
  }

  if (Number(playerHP) <= 0) {
    return "defeat";
  }

  if (!nextQuestionExists) {
    return "completed";
  }

  return "active";
}

async function createBattleSessionFromQuiz({ userId, topicId, quizId }) {
  const normalizedUserId = normalizeText(userId);
  const normalizedTopicId = normalizeText(topicId);
  const normalizedQuizId = normalizeText(quizId);

  if (!normalizedUserId) {
    throw new ApiError(400, "userId is required");
  }

  if (!normalizedTopicId) {
    throw new ApiError(400, "topicId is required");
  }

  if (!normalizedQuizId) {
    throw new ApiError(400, "quizId is required");
  }

  const quiz = await getQuizById(normalizedQuizId);
  const totalQuestions = Array.isArray(quiz?.questions) ? quiz.questions.length : 0;
  const quizTopicId = normalizeText(quiz?.topicId);

  if (quizTopicId && quizTopicId !== normalizedTopicId) {
    throw new ApiError(400, "topicId does not match the quiz topic");
  }

  if (totalQuestions <= 0) {
    throw new ApiError(422, "Quiz has no questions");
  }

  const now = new Date().toISOString();
  const userRef = getUserRef(normalizedUserId);

  const result = await runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);

    if (!userSnapshot.exists) {
      throw new ApiError(404, "User document not found");
    }

    const userData = userSnapshot.data() || {};
    const activeLock = normalizeBattleSessionLock(userData.battleSessionLock);

    if (activeLock?.sessionId) {
      const activeSession = await getBattleSessionById(activeLock.sessionId, transaction);

      if (
        isReusableBattleSession(activeSession, {
          userId: normalizedUserId,
          topicId: normalizedTopicId,
          quizId: normalizedQuizId,
        })
      ) {
        return {
          existing: true,
          session: activeSession,
        };
      }
    }

    const sessionId = crypto.randomUUID();
    const session = {
      sessionId,
      userId: normalizedUserId,
      topicId: normalizedTopicId,
      quizId: normalizedQuizId,
      currentQuestionIndex: 0,
      bossHP: 100,
      playerHP: getInitialPlayerHP(totalQuestions),
      combo: 0,
      hintRemaining: 3,
      answers: [],
      status: "active",
      rewardStatus: "pending",
      rewardSummary: null,
      rewardedAt: "",
      startedAt: now,
      completedAt: "",
      createdAt: now,
      updatedAt: now,
    };

    transaction.set(getBattleSessionRef(sessionId), session, { merge: true });
    transaction.set(
      userRef,
      {
        battleSessionLock: {
          sessionId,
          topicId: normalizedTopicId,
          quizId: normalizedQuizId,
          status: "active",
          updatedAt: now,
        },
        updatedAt: now,
      },
      { merge: true },
    );

    return {
      existing: false,
      session,
    };
  });

  return buildBattleSessionResponse(result.session);
}

async function getBattleSession({ sessionId, userId }) {
  const normalizedSessionId = normalizeText(sessionId);
  const normalizedUserId = normalizeText(userId);

  if (!normalizedSessionId) {
    throw new ApiError(400, "sessionId is required");
  }

  const session = await getBattleSessionById(normalizedSessionId);

  if (!session) {
    throw new ApiError(404, "Battle session not found");
  }

  if (normalizedUserId && session.userId !== normalizedUserId) {
    throw new ApiError(403, "Forbidden");
  }

  return buildBattleSessionResponse(session);
}

async function updateBattleSession(sessionId, updates = {}, transaction = null) {
  const normalizedSessionId = normalizeText(sessionId);

  if (!normalizedSessionId) {
    throw new ApiError(400, "sessionId is required");
  }

  const session = await updateBattleSessionById(normalizedSessionId, updates, transaction);
  return buildBattleSessionResponse(session);
}

function getHintHiddenOptions(question) {
  if (!question || typeof question !== "object" || !Array.isArray(question.options)) {
    return [];
  }

  const correctOption = getCorrectOption(question);
  const correctAnswer = normalizeAnswerLabel(correctOption?.label);
  const wrongOptions = question.options
    .map((option, index) => ({
      label: getOptionLabel(option, index),
      correct: normalizeAnswerLabel(option?.label) === correctAnswer,
    }))
    .filter((option) => option.label && !option.correct)
    .map((option) => option.label);

  if (wrongOptions.length <= 0) {
    return [];
  }

  const hiddenCount = Math.min(2, wrongOptions.length);
  return shuffleArray(wrongOptions).slice(0, hiddenCount);
}

function normalizeRewardStatus(value) {
  const normalized = normalizeText(value).toLowerCase();

  if (["pending", "rewarded"].includes(normalized)) {
    return normalized;
  }

  return "pending";
}

function getBossBattleRankReward(accuracy) {
  const normalizedAccuracy = Math.max(0, Math.min(100, Math.floor(Number(accuracy) || 0)));

  if (normalizedAccuracy >= 90) {
    return {
      rank: "3 Sao",
      rankStars: 3,
      coinBonus: 10,
    };
  }

  if (normalizedAccuracy >= 70) {
    return {
      rank: "2 Sao",
      rankStars: 2,
      coinBonus: 5,
    };
  }

  return {
    rank: "1 Sao",
    rankStars: 1,
    coinBonus: 0,
  };
}

function getBattleSessionAnswerMap(answers = []) {
  const answerMap = new Map();

  (Array.isArray(answers) ? answers : []).forEach((answer) => {
    const questionIndex = Number(answer?.questionIndex);

    if (!Number.isInteger(questionIndex) || questionIndex < 0) {
      return;
    }

    answerMap.set(questionIndex, {
      selected: normalizeAnswerLabel(answer?.selected),
      raw: answer || {},
    });
  });

  return answerMap;
}

function buildBossBattleRewardSummary({
  session = {},
  quiz = {},
} = {}) {
  const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
  const answers = Array.isArray(session?.answers) ? session.answers : [];
  const answerMap = getBattleSessionAnswerMap(answers);
  const battleStatus = normalizeStatus(session?.status);
  const isRewardEligible = battleStatus === "victory" || battleStatus === "completed";

  let correctAnswers = 0;
  let currentCombo = 0;
  let maxCombo = 0;
  let xpAwarded = 0;
  let coinAwarded = 0;

  questions.forEach((question, questionIndex) => {
    const answer = answerMap.get(questionIndex);
    const correctOption = getCorrectOption(question);
    const correctAnswer = normalizeAnswerLabel(correctOption?.label);
    const isCorrect = Boolean(answer?.selected) && answer.selected === correctAnswer;

    if (!isCorrect) {
      currentCombo = 0;
      return;
    }

    correctAnswers += 1;
    currentCombo += 1;
    maxCombo = Math.max(maxCombo, currentCombo);

    xpAwarded += 10;
    coinAwarded += 8 + crypto.randomInt(3);

    if (currentCombo >= 5) {
      coinAwarded += 1;
    }
  });

  const accuracy = questions.length > 0
    ? Math.round((correctAnswers / questions.length) * 100)
    : 0;
  const rankReward = getBossBattleRankReward(accuracy);
  const victory = battleStatus === "victory";
  const completionBonus = 20;
  const participationBonus = 25;

  if (isRewardEligible) {
    coinAwarded += rankReward.coinBonus;
    if (correctAnswers >= questions.length && questions.length > 0) {
      coinAwarded += completionBonus;
      xpAwarded += 50;
    } else {
      coinAwarded += participationBonus;
    }

    if (victory) {
      coinAwarded += 10;
      xpAwarded += 50;
    }
  } else {
    xpAwarded = 0;
    coinAwarded = 0;
  }

  if (isRewardEligible) {
    coinAwarded = Math.max(70, Math.min(160, coinAwarded));
  }

  return {
    xpAwarded,
    coinAwarded,
    accuracy,
    rank: isRewardEligible ? rankReward.rank : "0 Sao",
    rankStars: isRewardEligible ? rankReward.rankStars : 0,
    victory,
    correctAnswers,
    totalQuestions: questions.length,
    maxCombo,
    battleStatus,
  };
}

function normalizeBossBattleRewardSummary(summary = {}) {
  const normalizedBattleStatus = normalizeStatus(summary?.battleStatus);

  return {
    xpAwarded: Math.max(0, Math.floor(Number(summary?.xpAwarded) || 0)),
    coinAwarded: Math.max(0, Math.floor(Number(summary?.coinAwarded) || 0)),
    accuracy: Math.max(0, Math.min(100, Math.floor(Number(summary?.accuracy) || 0))),
    rank: String(summary?.rank || (normalizedBattleStatus === "defeat" ? "0 Sao" : "1 Sao")).trim(),
    rankStars: Math.max(0, Math.floor(Number(summary?.rankStars) || 0)),
    victory: Boolean(summary?.victory),
    correctAnswers: Math.max(0, Math.floor(Number(summary?.correctAnswers) || 0)),
    totalQuestions: Math.max(0, Math.floor(Number(summary?.totalQuestions) || 0)),
    maxCombo: Math.max(0, Math.floor(Number(summary?.maxCombo) || 0)),
    battleStatus: normalizedBattleStatus,
    rewardStatus: normalizeRewardStatus(summary?.rewardStatus || ""),
    userExpAfter: Math.max(0, Math.floor(Number(summary?.userExpAfter) || 0)),
    userCoinAfter: Math.max(0, Math.floor(Number(summary?.userCoinAfter) || 0)),
  };
}

function buildBossBattleTopicResults(session = {}, quiz = {}) {
  const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
  const answers = Array.isArray(session?.answers) ? session.answers : [];
  const answerMap = getBattleSessionAnswerMap(answers);
  const topicResults = [];

  questions.forEach((question, questionIndex) => {
    const answer = answerMap.get(questionIndex);
    const correctOption = getCorrectOption(question);
    const correctAnswer = normalizeAnswerLabel(correctOption?.label);
    const selectedAnswer = normalizeAnswerLabel(answer?.selected);
    const isCorrect = Boolean(selectedAnswer) && selectedAnswer === correctAnswer;

    if (selectedAnswer) {
      topicResults.push({
        isCorrect,
      });
    }
  });

  return topicResults;
}

function getBattleSessionStudyMinutes(session = {}) {
  const startedAt = String(session?.startedAt || session?.createdAt || "").trim();
  const completedAt = String(session?.completedAt || session?.rewardedAt || new Date().toISOString()).trim();

  if (!startedAt || !completedAt) {
    return 0;
  }

  const startDate = new Date(startedAt);
  const endDate = new Date(completedAt);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs <= 0) {
    return 0;
  }

  return Math.max(0, Math.floor(diffMs / 60000));
}

async function completeBattleSession({ sessionId, userId }) {
  const normalizedSessionId = normalizeText(sessionId);
  const normalizedUserId = normalizeText(userId);

  if (!normalizedSessionId) {
    throw new ApiError(400, "sessionId is required");
  }

  if (!normalizedUserId) {
    throw new ApiError(400, "userId is required");
  }

  const currentSession = await getBattleSessionById(normalizedSessionId);

  if (!currentSession) {
    throw new ApiError(404, "Battle session not found");
  }

  if (currentSession.userId !== normalizedUserId) {
    throw new ApiError(403, "Forbidden");
  }

  const battleStatus = normalizeStatus(currentSession.status);

  if (battleStatus === "active") {
    throw new ApiError(409, "Battle session is still active");
  }

  const quiz = await getQuizById(currentSession.quizId);
  const rewardSummaryFromSession = normalizeBossBattleRewardSummary(
    currentSession.rewardSummary || {},
  );
  const computedRewardSummary =
    rewardSummaryFromSession.xpAwarded > 0 ||
    rewardSummaryFromSession.coinAwarded > 0 ||
    rewardSummaryFromSession.accuracy > 0 ||
    rewardSummaryFromSession.totalQuestions > 0
      ? rewardSummaryFromSession
      : normalizeBossBattleRewardSummary(
          buildBossBattleRewardSummary({
            session: currentSession,
            quiz,
          }),
        );
  const currentRewardStatus = normalizeRewardStatus(currentSession.rewardStatus);

  if (currentRewardStatus === "rewarded") {
    const currentProfile = await getUserById(normalizedUserId).catch(() => null);
    return {
      session: buildBattleSessionResponse({
        ...currentSession,
        rewardStatus: "rewarded",
        rewardSummary: computedRewardSummary,
      }),
      rewardSummary: computedRewardSummary,
      achievements: {
        unlocked: [],
      },
      profile: currentProfile,
    };
  }

  const sessionSnapshot = {
    ...currentSession,
    rewardStatus: "pending",
    rewardSummary: computedRewardSummary,
    updatedAt: new Date().toISOString(),
  };
  const ref = getBattleSessionRef(normalizedSessionId);

  if (!ref) {
    throw new ApiError(500, "Unable to resolve battle session reference");
  }

  const preparedSession = await runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists) {
      throw new ApiError(404, "Battle session not found");
    }

    const sessionData = {
      id: snapshot.id,
      ...(snapshot.data() || {}),
    };

    if (sessionData.userId !== normalizedUserId) {
      throw new ApiError(403, "Forbidden");
    }

    const sessionStatus = normalizeStatus(sessionData.status);
    if (sessionStatus === "active") {
      throw new ApiError(409, "Battle session is still active");
    }

    const savedRewardStatus = normalizeRewardStatus(sessionData.rewardStatus);
    const savedRewardSummary = normalizeBossBattleRewardSummary(
      sessionData.rewardSummary || computedRewardSummary,
    );

    if (savedRewardStatus === "rewarded") {
      return {
        id: snapshot.id,
        ...sessionData,
        rewardStatus: "rewarded",
        rewardSummary: savedRewardSummary,
        achievements: {
          unlocked: [],
        },
      };
    }

    transaction.set(ref, sessionSnapshot, { merge: true });

    return {
      id: snapshot.id,
      ...sessionData,
      ...sessionSnapshot,
    };
  });

  if (normalizeRewardStatus(preparedSession.rewardStatus) === "rewarded") {
    const currentProfile = await getUserById(normalizedUserId).catch(() => null);

    return {
      session: buildBattleSessionResponse({
        ...preparedSession,
        rewardStatus: "rewarded",
      }),
      rewardSummary: normalizeBossBattleRewardSummary(
        preparedSession.rewardSummary || computedRewardSummary,
      ),
      achievements: {
        unlocked: [],
      },
      profile: currentProfile,
    };
  }

  const rewardSummary = normalizeBossBattleRewardSummary(
    preparedSession.rewardSummary || computedRewardSummary,
  );
  const battleSourceId = `battle-session:${normalizedSessionId}`;
  const rewardId = `${battleSourceId}:xp`;
  const rewardKey = `${battleSourceId}:reward`;
  const rewardUserBeforeGrant = await getUserById(normalizedUserId).catch(() => null);

  let xpReceipt = null;
  let coinReceipt = null;

  if (rewardSummary.xpAwarded > 0) {
    xpReceipt = await awardExp(
      normalizedUserId,
      rewardSummary.xpAwarded,
      "Boss Battle",
      rewardId,
    );
  }

  if (rewardSummary.coinAwarded > 0) {
    coinReceipt = await grantReward({
      userId: normalizedUserId,
      sourceType: "bossBattle",
      sourceId: battleSourceId,
      ruleKey: "complete",
      rewardRule: {
        title: "Boss Battle Reward",
        icon: "reward",
        coin: rewardSummary.coinAwarded,
        petExp: 0,
        petHappiness: 0,
        petHealth: 0,
        petEnergy: 0,
        petHunger: 0,
        badges: [],
      },
      requestId: normalizedSessionId,
      idempotencyKey: rewardKey,
      title: "Boss Battle Reward",
    });
  }

  const unlockedAchievements = await unlockBossBattleAchievements({
    userId: normalizedUserId,
    sessionId: normalizedSessionId,
    rewardSummary,
    user: rewardUserBeforeGrant || undefined,
  });

  const rewardedAt = new Date().toISOString();
  const completedAt = rewardedAt;
  const studyMinutes = getBattleSessionStudyMinutes({
    ...preparedSession,
    startedAt: preparedSession.startedAt || currentSession.startedAt || currentSession.createdAt || "",
    completedAt,
  });
  const topicResults = buildBossBattleTopicResults(currentSession, quiz);
  const topicId = String(currentSession.topicId || preparedSession.topicId || "").trim();

  if (topicId) {
    await recordUserTopicAccuracy(normalizedUserId, topicId, topicResults);
  }

  const progressReceipt = await recordLearningActivity(normalizedUserId, {
    sourceType: "bossBattle",
    sourceId: battleSourceId,
    idempotencyKey: `${battleSourceId}:progress`,
    topicId,
    quizId: String(currentSession.quizId || preparedSession.quizId || "").trim(),
    startedAt: preparedSession.startedAt || currentSession.startedAt || currentSession.createdAt || "",
    completedAt,
    studyMinutes,
    totalQuestions: rewardSummary.totalQuestions,
    correctAnswers: rewardSummary.correctAnswers,
    wrongAnswers: Math.max(0, rewardSummary.totalQuestions - rewardSummary.correctAnswers),
    accuracy: rewardSummary.accuracy,
    score: Number((rewardSummary.accuracy / 10).toFixed(1)),
  });
  const finalRewardSummary = {
    ...rewardSummary,
    userExpAfter: Math.max(
      0,
      Math.floor(Number(xpReceipt?.user?.stats?.exp ?? xpReceipt?.user?.stats?.currentExp ?? 0) || 0),
    ),
    userCoinAfter: Math.max(
      0,
      Math.floor(Number(coinReceipt?.data?.wallet?.eduCoin ?? 0) || 0),
    ),
    rewardStatus: "rewarded",
    achievementCount: unlockedAchievements.length,
  };

  const updatedSession = await updateBattleSessionById(normalizedSessionId, {
    rewardStatus: "rewarded",
    rewardSummary: finalRewardSummary,
    rewardedAt,
    completedAt,
    updatedAt: rewardedAt,
  });

  return {
    session: buildBattleSessionResponse(updatedSession),
    rewardSummary: finalRewardSummary,
    achievements: {
      unlocked: unlockedAchievements,
    },
    profile: progressReceipt?.user || rewardUserBeforeGrant || null,
  };
}

async function answerBattleSession({ sessionId, userId, questionIndex, selected }) {
  const normalizedSessionId = normalizeText(sessionId);
  const normalizedUserId = normalizeText(userId);
  const normalizedSelected = normalizeAnswerLabel(selected);
  const normalizedQuestionIndex = Number(questionIndex);

  if (!normalizedSessionId) {
    throw new ApiError(400, "sessionId is required");
  }

  if (!normalizedUserId) {
    throw new ApiError(400, "userId is required");
  }

  if (!Number.isInteger(normalizedQuestionIndex) || normalizedQuestionIndex < 0) {
    throw new ApiError(400, "questionIndex must be a valid integer");
  }

  if (!["A", "B", "C", "D"].includes(normalizedSelected)) {
    throw new ApiError(400, "selected must be A, B, C, or D");
  }

  const currentSession = await getBattleSessionById(normalizedSessionId);

  if (!currentSession) {
    throw new ApiError(404, "Battle session not found");
  }

  if (currentSession.userId !== normalizedUserId) {
    throw new ApiError(403, "Forbidden");
  }

  if (normalizeStatus(currentSession.status) !== "active") {
    throw new ApiError(409, "Battle session is not active");
  }

  const quiz = await getQuizById(currentSession.quizId);
  const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];

  if (questions.length === 0) {
    throw new ApiError(422, "Quiz has no questions");
  }

  if (normalizedQuestionIndex !== Number(currentSession.currentQuestionIndex || 0)) {
    throw new ApiError(409, "Question index does not match the current battle session state");
  }

  const currentQuestion = questions[normalizedQuestionIndex];

  if (!currentQuestion) {
    throw new ApiError(400, "Question index is out of range");
  }

  const correctOption = getCorrectOption(currentQuestion);

  if (!correctOption) {
    throw new ApiError(422, `Question ${normalizedQuestionIndex + 1} is missing a correct option`);
  }

  const correctAnswer = normalizeAnswerLabel(correctOption.label);
  const isCorrect = normalizedSelected === correctAnswer;
  const damagePerCorrectAnswer = getDamagePerCorrectAnswer(questions.length);
  const currentAnswers = Array.isArray(currentSession.answers) ? currentSession.answers : [];

  let nextBossHP = Math.max(0, Number(currentSession.bossHP || 0));
  let nextPlayerHP = Math.max(0, Number(currentSession.playerHP || 0));
  let nextCombo = Math.max(0, Number(currentSession.combo || 0));

  if (isCorrect) {
    nextCombo += 1;
    nextBossHP = Math.max(0, nextBossHP - damagePerCorrectAnswer);
  } else {
    nextPlayerHP = Math.max(0, nextPlayerHP - 1);
    nextCombo = 0;
  }

  const nextQuestionIndex = normalizedQuestionIndex + 1;
  const nextQuestionExists = nextQuestionIndex < questions.length;
  const nextStatus = resolveBattleStatus({
    bossHP: nextBossHP,
    playerHP: nextPlayerHP,
    nextQuestionExists,
  });

  const nextSessionSnapshot = {
    ...currentSession,
    currentQuestionIndex: nextQuestionIndex,
    bossHP: nextBossHP,
    playerHP: nextPlayerHP,
    combo: nextCombo,
    answers: [
      ...currentAnswers,
      buildAnswerRecord({
        questionIndex: normalizedQuestionIndex,
        selected: normalizedSelected,
        correct: isCorrect,
        correctAnswer,
        bossHP: nextBossHP,
        playerHP: nextPlayerHP,
        combo: nextCombo,
      }),
    ],
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  };

  const ref = getBattleSessionRef(normalizedSessionId);

  if (!ref) {
    throw new ApiError(500, "Unable to resolve battle session reference");
  }

  const updatedSession = await runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists) {
      throw new ApiError(404, "Battle session not found");
    }

    const sessionData = {
      id: snapshot.id,
      ...(snapshot.data() || {}),
    };

    if (sessionData.userId !== normalizedUserId) {
      throw new ApiError(403, "Forbidden");
    }

    if (normalizeStatus(sessionData.status) !== "active") {
      throw new ApiError(409, "Battle session is not active");
    }

    if (Number(sessionData.currentQuestionIndex || 0) !== normalizedQuestionIndex) {
      throw new ApiError(409, "Question index does not match the current battle session state");
    }

    transaction.set(ref, nextSessionSnapshot, { merge: true });
    transaction.set(
      getUserRef(normalizedUserId),
      {
        battleSessionLock: {
          sessionId: normalizedSessionId,
          topicId: normalizeText(sessionData.topicId || currentSession.topicId || ""),
          quizId: normalizeText(sessionData.quizId || currentSession.quizId || ""),
          status: nextStatus,
          updatedAt: nextSessionSnapshot.updatedAt,
        },
      },
      { merge: true },
    );

    return {
      id: snapshot.id,
      ...nextSessionSnapshot,
    };
  });

  return {
    session: buildBattleSessionResponse(updatedSession),
    correct: isCorrect,
    correctAnswer,
    bossState: getBossStateFromHP(nextBossHP),
    battleStatus: nextStatus,
    nextQuestionExists,
    questionIndex: normalizedQuestionIndex,
    currentQuestionIndex: nextQuestionIndex,
    bossHP: nextBossHP,
    playerHP: nextPlayerHP,
    combo: nextCombo,
  };
}

async function hintBattleSession({ sessionId, userId }) {
  const normalizedSessionId = normalizeText(sessionId);
  const normalizedUserId = normalizeText(userId);

  if (!normalizedSessionId) {
    throw new ApiError(400, "sessionId is required");
  }

  if (!normalizedUserId) {
    throw new ApiError(400, "userId is required");
  }

  const currentSession = await getBattleSessionById(normalizedSessionId);

  if (!currentSession) {
    throw new ApiError(404, "Battle session not found");
  }

  if (currentSession.userId !== normalizedUserId) {
    throw new ApiError(403, "Forbidden");
  }

  if (normalizeStatus(currentSession.status) !== "active") {
    throw new ApiError(409, "Battle session is not active");
  }

  const remainingHints = Math.max(0, Number(currentSession.hintRemaining ?? 3) || 0);

  if (remainingHints <= 0) {
    throw new ApiError(409, "No hints remaining");
  }

  const quiz = await getQuizById(currentSession.quizId);
  const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];

  if (questions.length === 0) {
    throw new ApiError(422, "Quiz has no questions");
  }

  const currentQuestionIndex = Number(currentSession.currentQuestionIndex || 0);
  const currentQuestion = questions[currentQuestionIndex];

  if (!currentQuestion) {
    throw new ApiError(400, "Question index is out of range");
  }

  const hiddenOptions = getHintHiddenOptions(currentQuestion);
  const nextHintRemaining = remainingHints - 1;
  const nextSessionSnapshot = {
    ...currentSession,
    hintRemaining: nextHintRemaining,
    updatedAt: new Date().toISOString(),
  };

  const ref = getBattleSessionRef(normalizedSessionId);

  if (!ref) {
    throw new ApiError(500, "Unable to resolve battle session reference");
  }

  const updatedSession = await runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists) {
      throw new ApiError(404, "Battle session not found");
    }

    const sessionData = {
      id: snapshot.id,
      ...(snapshot.data() || {}),
    };

    if (sessionData.userId !== normalizedUserId) {
      throw new ApiError(403, "Forbidden");
    }

    if (normalizeStatus(sessionData.status) !== "active") {
      throw new ApiError(409, "Battle session is not active");
    }

    const currentHints = Math.max(0, Number(sessionData.hintRemaining ?? 3) || 0);

    if (currentHints <= 0) {
      throw new ApiError(409, "No hints remaining");
    }

    transaction.set(ref, nextSessionSnapshot, { merge: true });
    transaction.set(
      getUserRef(normalizedUserId),
      {
        battleSessionLock: {
          sessionId: normalizedSessionId,
          topicId: normalizeText(sessionData.topicId || currentSession.topicId || ""),
          quizId: normalizeText(sessionData.quizId || currentSession.quizId || ""),
          status: "active",
          updatedAt: nextSessionSnapshot.updatedAt,
        },
      },
      { merge: true },
    );

    return {
      id: snapshot.id,
      ...nextSessionSnapshot,
    };
  });

  return {
    session: buildBattleSessionResponse(updatedSession),
    hiddenOptions,
    hintRemaining: nextHintRemaining,
  };
}

module.exports = {
  createBattleSessionFromQuiz,
  answerBattleSession,
  completeBattleSession,
  hintBattleSession,
  getBattleSession,
  updateBattleSession,
};
