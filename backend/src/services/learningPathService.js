const { db } = require("../firebase");
const { season1 } = require("./learningPathData");
const { createEngine } = require("./learningPathEngine");
const { getSubmissionsByStudentId } = require("./assignmentService");
const { findUserById } = require("./userService");

const learningPathRoot = db.collection("users");
const userProgressRoot = db.collection("user_progress");
const aiUsageLogsRoot = db.collection("ai_usage_logs");

function getLearningPathDocRef(userId) {
  return learningPathRoot.doc(userId).collection("learningPath").doc("state");
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

async function loadLearningPathState(userId) {
  const normalizedUserId = String(userId || "").trim();
  const docRef = getLearningPathDocRef(normalizedUserId);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    return {
      state: null,
      docRef,
    };
  }

  return {
    state: unwrapStoredLearningPathState(snapshot.data()),
    docRef,
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

function getTimeZone() {
  return process.env.LEARNING_PATH_TIMEZONE || "Asia/Ho_Chi_Minh";
}

function padTwo(value) {
  return String(value).padStart(2, "0");
}

function getLocalDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: getTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return [Number(parts.year), padTwo(Number(parts.month)), padTwo(Number(parts.day))].join("-");
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

    return minutes + explicitMinutes;
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
  };
}

async function persistLearningPathState(docRef, engine) {
  const state = engine.exportState();
  await docRef.set(
    {
      ...state,
      updatedAt: state.updatedAt || new Date().toISOString(),
      seasonId: state.seasonId || season1.id,
      userId: state.userId || "",
    },
    { merge: true },
  );
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

  const nextState = engine.exportState();
  if (!loaded.state || JSON.stringify(loaded.state) !== JSON.stringify(nextState)) {
    await persistLearningPathState(loaded.docRef, engine);
  }

  return {
    state,
    events: collector.events,
  };
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

  return {
    state: engine.getState(),
    events: collector.events,
  };
}

module.exports = {
  getLearningPathState,
  executeLearningPathAction,
  getLearningPathDocRef,
  loadLearningPathState,
  loadLearningPathFacts,
};
