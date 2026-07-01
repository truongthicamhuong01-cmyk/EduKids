/*
 * Chức năng: Lưu và tính trạng thái hành trình Learning Path của từng học sinh.
 * Dữ liệu đầu vào: tiến trình học, bài nộp, AI logs, điểm quiz và hồ sơ user.
 * Dữ liệu đầu ra: Trạng thái checkpoint, nhiệm vụ, phần thưởng và dữ liệu mở khóa.
 * File liên quan: src/services/learningPathEngine.js, src/services/learningPathData.js
 */
const { db } = require("../firebase");
const { season1 } = require("./learningPathData");
const { createEngine } = require("./learningPathEngine");
const { getSubmissionsByStudentId } = require("./assignmentService");
const { findUserById } = require("./userService");
const { getLocalDateKey, getLocalWeekKey } = require("../utils/dateUtils");

const learningPathProgressRoot = db.collection("learningPathProgress");
const userProgressRoot = db.collection("user_progress");
const aiUsageLogsRoot = db.collection("ai_usage_logs");
const DEFAULT_CURRENT_CHECKPOINT_ID = String(season1.mountains?.[0]?.checkpoints?.[0]?.id || "puncak-jaya-start");

function getLearningPathDocRef(userId) {
  return learningPathProgressRoot.doc(userId);
}

function getEmptyProgressState() {
  return {
    currentCheckpointId: DEFAULT_CURRENT_CHECKPOINT_ID,
    currentCheckpoint: DEFAULT_CURRENT_CHECKPOINT_ID,
    completedCheckpoints: [],
    completedMountains: [],
  };
}

function buildBootstrapLearningPathState(userId) {
  const normalizedUserId = String(userId || "").trim();
  const nowIso = new Date().toISOString();

  return {
    userId: normalizedUserId,
    seasonId: String(season1.id || "").trim(),
    mountainId: String(season1.mountains?.[0]?.id || "").trim(),
    checkpointId: DEFAULT_CURRENT_CHECKPOINT_ID,
    currentCheckpointId: DEFAULT_CURRENT_CHECKPOINT_ID,
    progress: getEmptyProgressState(),
    rewards: {
      xu: 0,
      exp: 0,
      badges: [],
    },
    limits: {
      dailyCheckpointCount: 0,
      weeklySummitCount: 0,
      lastResetDate: getLocalDateKey(),
      lastResetWeek: getLocalWeekKey(),
      lastCheckpointCompletedAt: "",
      lastSummitCompletedAt: "",
    },
    updatedAt: nowIso,
  };
}

function unwrapStoredLearningPathState(snapshotData) {
  if (!snapshotData || typeof snapshotData !== "object") {
    return null;
  }

  if (snapshotData.state && typeof snapshotData.state === "object") {
    return snapshotData.state;
  }

  return snapshotData;
}

function sanitizeLearningPathState(state) {
  const source = state && typeof state === "object" ? state : {};
  const progressSource = source.progress && typeof source.progress === "object" ? source.progress : {};
  const mountainId = String(source.mountainId || source.currentMountainId || season1.mountains?.[0]?.id || "").trim();
  const mountain = Array.isArray(season1.mountains)
    ? season1.mountains.find((item) => item.id === mountainId) || season1.mountains[0] || null
    : null;
  const firstCheckpointId = String(mountain?.checkpoints?.[0]?.id || season1.mountains?.[0]?.checkpoints?.[0]?.id || DEFAULT_CURRENT_CHECKPOINT_ID);
  const currentCheckpointId = String(
    source.currentCheckpointId ??
      progressSource.currentCheckpointId ??
      progressSource.currentCheckpoint ??
      source.checkpointId ??
      firstCheckpointId,
  ).trim() || firstCheckpointId;
  const normalizedCurrentCheckpointId =
    currentCheckpointId === "start" || currentCheckpointId === DEFAULT_CURRENT_CHECKPOINT_ID
      ? firstCheckpointId
      : currentCheckpointId;
  const checkpointId = String(source.checkpointId ?? normalizedCurrentCheckpointId).trim() || normalizedCurrentCheckpointId;

  return {
    ...source,
    checkpointId,
    currentCheckpointId: normalizedCurrentCheckpointId,
    progress: {
      ...progressSource,
      currentCheckpointId: normalizedCurrentCheckpointId,
      currentCheckpoint: normalizedCurrentCheckpointId,
      completedCheckpoints: Array.isArray(progressSource.completedCheckpoints)
        ? progressSource.completedCheckpoints.map((item) => String(item))
        : [],
      completedMountains: Array.isArray(progressSource.completedMountains)
        ? progressSource.completedMountains.map((item) => String(item))
        : [],
    },
  };
}

function buildLearningPathResponse(state, events = [], wallet = null) {
  const sanitizedState = sanitizeLearningPathState(state);

  const resolvedWalletCoin = [
    wallet?.eduCoin,
    wallet?.eduCoins,
    sanitizedState?.wallet?.eduCoin,
    sanitizedState?.wallet?.eduCoins,
  ].find((value) => Number.isFinite(Number(value)));

  return {
    state: {
      ...sanitizedState,
      wallet: {
        eduCoin: Math.max(0, Math.floor(Number(resolvedWalletCoin ?? 0))),
      },
    },
    events: Array.isArray(events) ? events : [],
  };
}

async function loadLearningPathState(userId) {
  const normalizedUserId = String(userId || "").trim();
  const docRef = getLearningPathDocRef(normalizedUserId);
  const snapshot = await docRef.get();

  if (snapshot.exists) {
    return {
      state: unwrapStoredLearningPathState(snapshot.data()),
      docRef,
      exists: true,
      isBootstrap: false,
    };
  }

  const bootstrapState = buildBootstrapLearningPathState(normalizedUserId);
  await persistLearningPathState(docRef, { exportState: () => bootstrapState }, "create");

  return {
    state: bootstrapState,
    docRef,
    exists: false,
    isBootstrap: true,
  };
}

function createActionCollector() {
  const events = [];
  return {
    events,
    onEvent(event) {
      events.push(event);
    },
  };
}

function isSameLocalDate(leftValue, rightValue = new Date()) {
  if (!leftValue) {
    return false;
  }

  const leftDate = new Date(leftValue);
  const rightDate = rightValue instanceof Date ? rightValue : new Date(rightValue);

  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) {
    return false;
  }

  return getLocalDateKey(leftDate) === getLocalDateKey(rightDate);
}

function getActivityLogDateValue(entry) {
  const candidate =
    entry?.completedAt ||
    entry?.submittedAt ||
    entry?.finishedAt ||
    entry?.createdAt ||
    entry?.updatedAt ||
    entry?.timestamp ||
    entry?.time ||
    entry?.date ||
    entry?.day ||
    null;

  if (!candidate) {
    return null;
  }

  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function loadLearningPathFacts(userId) {
  const normalizedUserId = String(userId || "").trim();

  if (!normalizedUserId) {
    return {
      loginCountToday: 0,
      studyMinutesToday: 0,
      lessonCountToday: 0,
      quizCountToday: 0,
      highScoreQuizCountToday: 0,
      assignmentCountToday: 0,
      coachCountToday: 0,
    };
  }

  const [submissions, topicSnapshot, aiUsageSnapshot, wrongAnswersSnapshot, profile] = await Promise.all([
    getSubmissionsByStudentId(normalizedUserId).catch(() => []),
    userProgressRoot.doc(normalizedUserId).collection("topics").get().catch(() => null),
    aiUsageLogsRoot.where("userId", "==", normalizedUserId).get().catch(() => null),
    db.collection("wrong_answers").doc(normalizedUserId).get().catch(() => null),
    findUserById(normalizedUserId).catch(() => null),
  ]);

  const normalizedSubmissions = Array.isArray(submissions) ? submissions : [];
  const today = new Date();

  const assignmentCountToday = normalizedSubmissions.reduce((count, submission) => {
    if (submission?.status !== "graded") {
      return count;
    }

    return isSameLocalDate(submission?.submittedAt || submission?.gradedAt || submission?.updatedAt, today)
      ? count + 1
      : count;
  }, 0);

  const topicDocs = Boolean(topicSnapshot) && Array.isArray(topicSnapshot.docs) ? topicSnapshot.docs : [];
  const lessonCountToday = topicDocs.reduce((count, doc) => {
    const data = doc.data() || {};
    const totalAnswered = Math.max(0, Number(data.totalAnswered) || 0);
    const percentage = Number(data.percentage);
    const updatedAt = data.updatedAt || data.accuracyUpdatedAt || data.createdAt || "";

    if (!isSameLocalDate(updatedAt, today)) {
      return count;
    }

    if (totalAnswered <= 0) {
      return count;
    }

    return Number.isFinite(percentage) && percentage >= 80 ? count + 1 : count;
  }, 0);

  const wrongAnswersData = wrongAnswersSnapshot && typeof wrongAnswersSnapshot.data === "function"
    ? wrongAnswersSnapshot.data() || {}
    : null;
  const wrongAnswersUpdatedAt = wrongAnswersData?.updatedAt || wrongAnswersData?.createdAt || "";
  const quizCountToday = isSameLocalDate(wrongAnswersUpdatedAt, today) ? 1 : 0;
  const highScoreQuizCountToday =
    isSameLocalDate(wrongAnswersUpdatedAt, today) && Number(wrongAnswersData?.score) >= 80 ? 1 : 0;

  const activityLogs = Array.isArray(profile?.activityLogs) ? profile.activityLogs : [];
  const studyMinutesToday = activityLogs.reduce((minutes, entry) => {
    const logDate = getActivityLogDateValue(entry);
    if (!logDate || !isSameLocalDate(logDate, today)) {
      return minutes;
    }

    const explicitMinutes = Number(entry?.studyMinutes);
    if (!Number.isFinite(explicitMinutes) || explicitMinutes <= 0) {
      return minutes;
    }

    return minutes + Math.max(0, Math.floor(explicitMinutes));
  }, 0);

  const loginCountToday = profile?.stats?.lastStudyDate && isSameLocalDate(profile.stats.lastStudyDate, today) ? 1 : 0;

  const coachCountToday =
    Boolean(aiUsageSnapshot) &&
    aiUsageSnapshot.docs.some((doc) => {
      const data = doc.data() || {};
      const feature = String(data.feature || "").trim().toLowerCase();
      const action = String(data.action || "").trim().toLowerCase();
      const success = data.success === true || String(data.status || "").trim().toLowerCase() === "success";

      return feature === "coach" && action === "analyze" && success && isSameLocalDate(data.createdAt || data.updatedAt || "", today);
    })
      ? 1
      : 0;

  return {
    loginCountToday,
    studyMinutesToday,
    lessonCountToday,
    quizCountToday,
    highScoreQuizCountToday,
    assignmentCountToday,
    coachCountToday,
    wallet: {
      eduCoin: Math.max(
        0,
        Number(
          profile?.stats?.eduCoin ??
            profile?.stats?.eduCoins ??
            profile?.eduCoin ??
            profile?.eduCoins ??
            0,
        ),
      ),
    },
  };
}

async function persistLearningPathState(docRef, engine, mode = "merge") {
  const state = typeof engine?.exportState === "function" ? engine.exportState() : engine;
  const payload = {
    ...state,
    updatedAt: state.updatedAt || new Date().toISOString(),
    seasonId: state.seasonId || season1.id,
    userId: state.userId || "",
  };

  await docRef.set(payload, { merge: true });
}

async function getLearningPathState(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    const error = new Error("userId is required");
    error.statusCode = 400;
    throw error;
  }

  const loaded = await loadLearningPathState(normalizedUserId);
  const facts = await loadLearningPathFacts(normalizedUserId);
  const collector = createActionCollector();
  const engine = createEngine(
    season1,
    {
      ...(loaded.state || {}),
      userId: normalizedUserId,
      learningFacts: facts,
    },
    {
      onEvent: collector.onEvent,
    },
  );
  const state = engine.getState();
  const wallet = facts?.wallet || null;

  const nextState = engine.exportState();
  if (!loaded.state || JSON.stringify(loaded.state) !== JSON.stringify(nextState)) {
    // Chỉ ghi khi state đổi thật sự để giảm số lần ghi Firestore.
    await persistLearningPathState(loaded.docRef, engine);
  }

  return buildLearningPathResponse(state, collector.events, wallet);
}

async function executeLearningPathAction({ userId, action, payload = {} }) {
  const normalizedUserId = String(userId || "").trim();
  const normalizedAction = String(action || "").trim();

  if (!normalizedUserId) {
    const error = new Error("userId is required");
    error.statusCode = 400;
    throw error;
  }

  if (!normalizedAction) {
    const error = new Error("action is required");
    error.statusCode = 400;
    throw error;
  }

  const loaded = await loadLearningPathState(normalizedUserId);
  const facts = await loadLearningPathFacts(normalizedUserId);
  const baseState = {
    ...(loaded.state || {}),
    userId: normalizedUserId,
    learningFacts: facts,
  };
  const collector = createActionCollector();
  const engine = createEngine(season1, baseState, {
    onEvent: collector.onEvent,
  });
  const wallet = facts?.wallet || null;

  if (normalizedAction === "COMPLETE_TASK") {
    const taskId = String(payload.taskId || payload.id || "").trim();
    if (!taskId) {
      const error = new Error("payload.taskId is required for COMPLETE_TASK");
      error.statusCode = 400;
      throw error;
    }

    engine.completeTask(taskId);
  } else if (normalizedAction === "COMPLETE_CHECKPOINT") {
    const checkpointId = String(payload.checkpointId || payload.id || engine.getState().checkpointId || "").trim();
    if (!checkpointId) {
      const error = new Error("payload.checkpointId is required for COMPLETE_CHECKPOINT");
      error.statusCode = 400;
      throw error;
    }

    engine.completeCheckpoint(checkpointId);
  } else if (normalizedAction === "NEXT_CHECKPOINT") {
    engine.goToNextCheckpoint();
  } else {
    const error = new Error("Unsupported action");
    error.statusCode = 400;
    throw error;
  }

  await persistLearningPathState(loaded.docRef, engine);

  return buildLearningPathResponse(engine.getState(), collector.events, wallet);
}

module.exports = {
  getLearningPathState,
  executeLearningPathAction,
  getLearningPathDocRef,
  loadLearningPathState,
  loadLearningPathFacts,
};
