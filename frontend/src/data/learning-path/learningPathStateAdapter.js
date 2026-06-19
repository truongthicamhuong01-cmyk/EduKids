import { season1 } from "./season1.js";

function cloneValue(value) {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fall through to JSON clone.
    }
  }

  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();

  if (
    normalized === "CURRENT" ||
    normalized === "ACTIVE" ||
    normalized === "IN_PROGRESS" ||
    normalized === "ONGOING"
  ) {
    return "current";
  }

  if (
    normalized === "COMPLETED" ||
    normalized === "DONE" ||
    normalized === "FINISHED" ||
    normalized === "SUCCESS"
  ) {
    return "completed";
  }

  return "locked";
}

function getBlueprintMountainIndex(mountainId) {
  return Array.isArray(season1.mountains)
    ? season1.mountains.findIndex((mountain) => mountain.id === mountainId)
    : -1;
}

function getBlueprintMountain(mountainId) {
  return Array.isArray(season1.mountains)
    ? season1.mountains.find((mountain) => mountain.id === mountainId) || null
    : null;
}

function getCanonicalCheckpointMap(state) {
  const checkpointMap = new Map();
  const checkpoints = [];

  if (Array.isArray(state?.checkpoints)) {
    checkpoints.push(...state.checkpoints);
  }

  if (Array.isArray(state?.learningPathState?.checkpoints)) {
    checkpoints.push(...state.learningPathState.checkpoints);
  }

  checkpoints.forEach((checkpoint) => {
    const id = String(checkpoint?.id || "").trim();
    if (!id) {
      return;
    }

    checkpointMap.set(id, checkpoint);
  });

  return checkpointMap;
}

function getCanonicalTaskMap(checkpoint) {
  const taskMap = new Map();

  if (Array.isArray(checkpoint?.tasks)) {
    checkpoint.tasks.forEach((task) => {
      const id = String(task?.id || "").trim();
      if (!id) {
        return;
      }

      taskMap.set(id, task);
    });
  }

  return taskMap;
}

function getCompletedCheckpointIds(progress) {
  return new Set(
    Array.isArray(progress?.completedCheckpoints)
      ? progress.completedCheckpoints.map((id) => String(id || "").trim()).filter(Boolean)
      : [],
  );
}

function getCompletedMountainIds(progress) {
  return new Set(
    Array.isArray(progress?.completedMountains)
      ? progress.completedMountains.map((id) => String(id || "").trim()).filter(Boolean)
      : [],
  );
}

function getCheckpointNumber(checkpointId) {
  const match = String(checkpointId || "").match(/checkpoint-(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function buildTaskView(blueprintTask, canonicalTask) {
  const status = normalizeStatus(canonicalTask?.status || canonicalTask?.state);

  return {
    ...cloneValue(blueprintTask),
    completed:
      status === "completed" ||
      canonicalTask?.completed === true ||
      blueprintTask?.completed === true,
    status: status === "locked" ? "NOT_DONE" : status === "completed" ? "DONE" : "CURRENT",
    state: status === "locked" ? "NOT_DONE" : status === "completed" ? "DONE" : "CURRENT",
    targetPageId: blueprintTask?.targetPageId || "",
  };
}

function buildCheckpointView({
  mountainId,
  mountainIndex,
  checkpointBlueprint,
  canonicalCheckpoint,
  currentMountainId,
  currentCheckpointId,
  completedCheckpointIds,
}) {
  const currentMountainIndex = getBlueprintMountainIndex(currentMountainId);
  const checkpointOrder = getCheckpointNumber(checkpointBlueprint?.id);
  const canonicalStatus = normalizeStatus(canonicalCheckpoint?.status || canonicalCheckpoint?.state);
  const isCurrentCheckpoint = checkpointBlueprint.id === currentCheckpointId;
  const isCompletedCheckpoint = completedCheckpointIds.has(checkpointBlueprint.id);

  let status = canonicalStatus;

  if (status === "locked") {
    if (isCurrentCheckpoint) {
      status = "current";
    } else if (isCompletedCheckpoint) {
      status = "completed";
    } else if (
      mountainIndex < currentMountainIndex &&
      currentMountainIndex >= 0 &&
      mountainId !== currentMountainId
    ) {
      status = "completed";
    } else if (
      mountainId === currentMountainId &&
      currentCheckpointId &&
      checkpointOrder > 0 &&
      checkpointOrder < Number.parseInt(String(currentCheckpointId).match(/checkpoint-(\d+)/)?.[1] || "0", 10)
    ) {
      status = "completed";
    }
  }

  const canonicalTaskMap = getCanonicalTaskMap(canonicalCheckpoint);
  const tasks = (Array.isArray(checkpointBlueprint.tasks) ? checkpointBlueprint.tasks : []).map(
    (taskBlueprint) => buildTaskView(taskBlueprint, canonicalTaskMap.get(taskBlueprint.id)),
  );
  const completedCount = tasks.filter((task) => task.state === "DONE").length;

  return {
    ...cloneValue(checkpointBlueprint),
    status,
    state: status,
    completed: status === "completed",
    tasks,
    progress: {
      completed: completedCount,
      total: tasks.length,
    },
    mountainId,
    mountainIndex,
    checkpointIndex: Number.isFinite(checkpointOrder) ? Math.max(0, checkpointOrder - 1) : 0,
  };
}

function buildMountainView({
  mountainBlueprint,
  mountainIndex,
  canonicalCheckpointMap,
  currentMountainId,
  currentCheckpointId,
  completedCheckpointIds,
  completedMountainIds,
}) {
  const checkpoints = (Array.isArray(mountainBlueprint.checkpoints) ? mountainBlueprint.checkpoints : []).map(
    (checkpointBlueprint) =>
      buildCheckpointView({
        mountainId: mountainBlueprint.id,
        mountainIndex,
        checkpointBlueprint,
        canonicalCheckpoint: canonicalCheckpointMap.get(checkpointBlueprint.id),
        currentMountainId,
        currentCheckpointId,
        completedCheckpointIds,
      }),
  );

  const isCurrentMountain = mountainBlueprint.id === currentMountainId;
  const isCompletedMountain = completedMountainIds.has(mountainBlueprint.id);
  const mountainUnlocked =
    mountainIndex === 0 || mountainIndex <= getBlueprintMountainIndex(currentMountainId) || isCompletedMountain;

  return {
    ...cloneValue(mountainBlueprint),
    badge: {
      ...cloneValue(mountainBlueprint.badge),
      unlocked: mountainUnlocked,
    },
    locked: !mountainUnlocked && !isCurrentMountain,
    checkpoints,
  };
}

export function adaptLearningPathState(apiState) {
  const source = apiState && typeof apiState === "object" ? apiState : {};
  const canonicalCheckpointMap = getCanonicalCheckpointMap(source);
  const progress = source.progress && typeof source.progress === "object" ? source.progress : {};
  const completedCheckpointIds = getCompletedCheckpointIds(progress);
  const completedMountainIds = getCompletedMountainIds(progress);
  const currentMountainId = String(source.mountainId || source.currentMountainId || season1.mountains?.[0]?.id || "").trim();
  const currentCheckpointId = String(source.checkpointId || source.currentCheckpointId || "").trim();
  const currentMountainBlueprint = getBlueprintMountain(currentMountainId) || season1.mountains?.[0] || null;
  const startPosition = cloneValue(currentMountainBlueprint?.startPosition || season1.mountains?.[0]?.startPosition || {
    left: 56.55,
    top: 92.1,
    side: "left",
  });
  const firstCheckpointId = currentMountainBlueprint?.checkpoints?.[0]?.id || season1.mountains?.[0]?.checkpoints?.[0]?.id || "";
  const isFreshStart =
    completedCheckpointIds.size === 0 &&
    currentMountainId === String(season1.mountains?.[0]?.id || "") &&
    currentCheckpointId === String(firstCheckpointId || "");

  const mountains = (Array.isArray(season1.mountains) ? season1.mountains : []).map((mountainBlueprint, mountainIndex) =>
    buildMountainView({
      mountainBlueprint,
      mountainIndex,
      canonicalCheckpointMap,
      currentMountainId,
      currentCheckpointId,
      completedCheckpointIds,
      completedMountainIds,
    }),
  );

  const flattenedCheckpoints = mountains.flatMap((mountain) =>
    Array.isArray(mountain.checkpoints) ? mountain.checkpoints : [],
  );
  const currentMountain = mountains.find((mountain) => mountain.id === currentMountainId) || mountains[0] || null;
  const currentCheckpoint =
    flattenedCheckpoints.find((checkpoint) => checkpoint.id === currentCheckpointId) ||
    currentMountain?.checkpoints?.find((checkpoint) => checkpoint.status === "current") ||
    currentMountain?.checkpoints?.[0] ||
    null;
  const currentCheckpointProgress = currentCheckpoint?.progress || { completed: 0, total: 0 };
  const completedCount = completedCheckpointIds.size;
  const totalCheckpointCount = flattenedCheckpoints.length || 1;
  const avatarPosition = isFreshStart
    ? startPosition
    : currentCheckpoint?.position
      ? cloneValue(currentCheckpoint.position)
      : { left: 0, top: 0, side: "left" };

  return {
    userId: String(source.userId || "").trim(),
    seasonId: String(source.seasonId || season1.id || "").trim(),
    mountainId: currentMountainId,
    checkpointId: currentCheckpointId,
    season: {
      ...cloneValue(season1),
      mountains,
    },
    mountain: currentMountain ? cloneValue(currentMountain) : null,
    checkpoint: currentCheckpoint ? cloneValue(currentCheckpoint) : null,
    checkpoints: cloneValue(flattenedCheckpoints),
    rewards: cloneValue(source.rewards || { xu: 0, exp: 0, badges: [] }),
    progress: cloneValue(progress),
    limits: cloneValue(source.limits || {}),
    lockNotice: String(source.lockNotice || source.notice || ""),
    updatedAt: String(source.updatedAt || ""),
    avatar: {
      position: avatarPosition,
      isAtStart: isFreshStart,
      altitudeLabel: isFreshStart ? "0 m" : String(currentCheckpoint?.altitude || ""),
    },
    progressPercent: Math.round((completedCount / totalCheckpointCount) * 100),
    checkpointProgress: {
      completed: currentCheckpointProgress.completed || 0,
      total: currentCheckpointProgress.total || 0,
    },
    currentMountainId,
    currentCheckpointId,
    tasks: cloneValue(currentCheckpoint?.tasks || []),
    startPosition,
    learningPathState: cloneValue(source.learningPathState || source),
  };
}
