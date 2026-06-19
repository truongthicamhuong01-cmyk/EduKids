const { db } = require("../firebase");
const { season1 } = require("./learningPathData");
const { createEngine } = require("./learningPathEngine");
const { getSubmissionsByStudentId } = require("./assignmentService");

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

async function loadLearningPathFacts(userId) {
  const normalizedUserId = String(userId || "").trim();

  if (!normalizedUserId) {
    return {
      assignmentCompleted: false,
      scoreAchieved: false,
      topicCompleted: false,
      coachUsed: false,
    };
  }

  const [submissions, topicSnapshot, aiUsageSnapshot] = await Promise.all([
    getSubmissionsByStudentId(normalizedUserId).catch(() => []),
    userProgressRoot.doc(normalizedUserId).collection("topics").get().catch(() => null),
    aiUsageLogsRoot.where("userId", "==", normalizedUserId).get().catch(() => null),
  ]);

  const normalizedSubmissions = Array.isArray(submissions) ? submissions : [];
  const assignmentCompleted = normalizedSubmissions.some((submission) => submission?.status === "graded");
  const scoreAchieved = normalizedSubmissions.some((submission) => Number(submission?.score) >= 8);

  const topicCompleted =
    Boolean(topicSnapshot) &&
    topicSnapshot.docs.some((doc) => {
      const data = doc.data() || {};
      const totalAnswered = Math.max(0, Number(data.totalAnswered) || 0);
      const percentage = Number(data.percentage);

      return totalAnswered > 0 && Number.isFinite(percentage) && percentage >= 80;
    });

  const coachUsed =
    Boolean(aiUsageSnapshot) &&
    aiUsageSnapshot.docs.some((doc) => {
      const data = doc.data() || {};
      const feature = String(data.feature || "").trim().toLowerCase();
      const action = String(data.action || "").trim().toLowerCase();
      const success = data.success === true || String(data.status || "").trim().toLowerCase() === "success";

      return feature === "coach" && action === "analyze" && success;
    });

  return {
    assignmentCompleted,
    scoreAchieved,
    topicCompleted,
    coachUsed,
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
