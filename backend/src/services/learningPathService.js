const { db } = require("../firebase");
const { season1, season1Progress } = require("./learningPathData");
const { createEngine } = require("./learningPathEngine");

const learningPathRoot = db.collection("users");

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

  return state;
}

async function getLearningPathState(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    const error = new Error("userId is required");
    error.statusCode = 400;
    throw error;
  }

  const loaded = await loadLearningPathState(normalizedUserId);
  const engine = createEngine(season1, loaded.state || { userId: normalizedUserId, ...season1Progress });
  const state = engine.getState();

  if (!loaded.state) {
    await persistLearningPathState(loaded.docRef, engine);
  }

  return state;
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
  const baseState = loaded.state || { userId: normalizedUserId, ...season1Progress };
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
};
