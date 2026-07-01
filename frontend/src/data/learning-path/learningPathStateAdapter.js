/*
 * Chức năng: Chuyển state từ backend sang dạng mà màn Learning Path đọc được.
 * Dữ liệu đầu vào: state thô từ API và blueprint season1.
 * Dữ liệu đầu ra: state đã chuẩn hóa cho UI và avatar.
 * File liên quan: frontend/src/pages/student/learning-path/learningPathPage.js, backend/src/services/learningPathService.js
 */
import { season1 } from "./season1.js";

const DEFAULT_CURRENT_CHECKPOINT_ID = String(season1.mountains?.[0]?.checkpoints?.[0]?.id || "puncak-jaya-start");

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

function getLearningPathProgressPercent({
  currentMountainId,
  currentCheckpointId,
  isStart = false,
}) {
  if (isStart) {
    return 0;
  }

  const currentMountain = getBlueprintMountain(currentMountainId);
  const checkpoints = Array.isArray(currentMountain?.checkpoints)
    ? currentMountain.checkpoints
    : [];

  if (checkpoints.length <= 0) {
    return 0;
  }

  const resolvedCheckpointIndex = (() => {
    const directIndex = checkpoints.findIndex(
      (checkpoint) => String(checkpoint?.id || "").trim() === String(currentCheckpointId || "").trim(),
    );

    if (directIndex >= 0) {
      return directIndex;
    }

    const currentStatusIndex = checkpoints.findIndex((checkpoint) => {
      const status = normalizeStatus(checkpoint?.status || checkpoint?.state);
      return status === "current";
    });

    if (currentStatusIndex >= 0) {
      return currentStatusIndex;
    }

    for (let index = checkpoints.length - 1; index >= 0; index -= 1) {
      const status = normalizeStatus(checkpoints[index]?.status || checkpoints[index]?.state);
      if (status === "completed") {
        return index;
      }
    }

    return 0;
  })();

  const totalSegments = Math.max(checkpoints.length - 1, 1);
  const completedSegments = Math.min(Math.max(resolvedCheckpointIndex, 0), totalSegments);
  return Number(((completedSegments / totalSegments) * 100).toFixed(2));
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

function uniqueByCheckpointId(checkpoints) {
  const seen = new Set();
  const uniqueCheckpoints = [];

  (Array.isArray(checkpoints) ? checkpoints : []).forEach((checkpoint) => {
    const checkpointId = String(checkpoint?.checkpointId || checkpoint?.id || "").trim();
    if (!checkpointId || seen.has(checkpointId)) {
      return;
    }

    seen.add(checkpointId);
    uniqueCheckpoints.push(checkpoint);
  });

  return uniqueCheckpoints;
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
    progress: cloneValue(canonicalTask?.progress || null),
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
  const previousMountainId = mountainIndex > 0 ? season1.mountains?.[mountainIndex - 1]?.id || "" : "";
  const previousMountainCompleted = previousMountainId ? completedMountainIds.has(previousMountainId) : false;
  const mountainUnlocked =
    mountainIndex === 0 ||
    mountainIndex <= getBlueprintMountainIndex(currentMountainId) ||
    isCompletedMountain ||
    previousMountainCompleted;

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
  const hasProgressObject = Boolean(source.progress && typeof source.progress === "object");
  const progress = hasProgressObject ? source.progress : {};
  const completedCheckpointIds = getCompletedCheckpointIds(progress);
  const completedMountainIds = getCompletedMountainIds(progress);
  const currentMountainId = String(source.mountainId || source.currentMountainId || season1.mountains?.[0]?.id || "").trim();
  const currentMountainBlueprint = getBlueprintMountain(currentMountainId) || season1.mountains?.[0] || null;
  const startPosition = cloneValue(currentMountainBlueprint?.startPosition || season1.mountains?.[0]?.startPosition || {
    left: 56.55,
    top: 92.1,
    side: "left",
  });
  const firstCheckpointId = currentMountainBlueprint?.checkpoints?.[0]?.id || season1.mountains?.[0]?.checkpoints?.[0]?.id || "";
  const resolvedCheckpointIdRaw = hasProgressObject
    ? String(
        progress.currentCheckpoint ||
          progress.currentCheckpointId ||
          source.currentCheckpointId ||
          source.checkpointId ||
          "",
      ).trim() || firstCheckpointId
    : String(source.currentCheckpointId || source.checkpointId || "").trim() || firstCheckpointId;
  const resolvedCheckpointId =
    resolvedCheckpointIdRaw === "start" || resolvedCheckpointIdRaw === DEFAULT_CURRENT_CHECKPOINT_ID
      ? firstCheckpointId
      : resolvedCheckpointIdRaw || firstCheckpointId;
  const isLegacyStartCheckpoint =
    resolvedCheckpointIdRaw === "start" || resolvedCheckpointIdRaw === DEFAULT_CURRENT_CHECKPOINT_ID;
  const isBootstrapStart =
    isLegacyStartCheckpoint &&
    completedCheckpointIds.size === 0 &&
    completedMountainIds.size === 0;
  const isFreshStart =
    completedCheckpointIds.size === 0 &&
    currentMountainId === String(season1.mountains?.[0]?.id || "") &&
    resolvedCheckpointId === String(firstCheckpointId || "");

  const mountains = (Array.isArray(season1.mountains) ? season1.mountains : []).map((mountainBlueprint, mountainIndex) =>
    buildMountainView({
      mountainBlueprint,
      mountainIndex,
      canonicalCheckpointMap,
      currentMountainId,
      currentCheckpointId: resolvedCheckpointId,
      completedCheckpointIds,
      completedMountainIds,
    }),
  );

  const flattenedCheckpoints = uniqueByCheckpointId(
    mountains.flatMap((mountain) => (Array.isArray(mountain.checkpoints) ? mountain.checkpoints : [])),
  );
  const currentMountain = mountains.find((mountain) => mountain.id === currentMountainId) || mountains[0] || null;
  const currentCheckpoint =
    flattenedCheckpoints.find((checkpoint) => checkpoint.id === resolvedCheckpointId) ||
    currentMountain?.checkpoints?.find((checkpoint) => checkpoint.status === "current") ||
    currentMountain?.checkpoints?.[0] ||
    null;
  const currentCheckpointProgress = currentCheckpoint?.progress || { completed: 0, total: 0 };
  const avatarPosition = currentCheckpoint?.position
    ? cloneValue(currentCheckpoint.position)
    : startPosition;
  const resolvedProgress = hasProgressObject
    ? cloneValue(progress)
    : {
        currentCheckpoint: resolvedCheckpointId,
        completed: [],
        completedCheckpoints: [],
        completedMountains: [],
      };

  return {
    userId: String(source.userId || "").trim(),
    seasonId: String(source.seasonId || season1.id || "").trim(),
    mountainId: currentMountainId,
    checkpointId: resolvedCheckpointId,
    season: {
      ...cloneValue(season1),
      mountains,
    },
    mountain: currentMountain ? cloneValue(currentMountain) : null,
    checkpoint: currentCheckpoint ? cloneValue(currentCheckpoint) : null,
    checkpoints: cloneValue(flattenedCheckpoints),
    rewards: cloneValue(source.rewards || { xu: 0, exp: 0, badges: [] }),
    wallet: cloneValue(source.wallet || { eduCoin: 0 }),
    progress: resolvedProgress,
    limits: cloneValue(source.limits || {}),
    lockNotice: String(source.lockNotice || source.notice || ""),
    updatedAt: String(source.updatedAt || ""),
    avatar: {
      position: avatarPosition,
      isAtStart: isFreshStart || isBootstrapStart,
      altitudeLabel: isFreshStart || isBootstrapStart ? "0 m" : String(currentCheckpoint?.altitude || ""),
    },
    progressPercent: getLearningPathProgressPercent({
      currentMountainId,
      currentCheckpointId: resolvedCheckpointId,
      isStart: isFreshStart || isBootstrapStart,
    }),
    checkpointProgress: {
      completed: currentCheckpointProgress.completed || 0,
      total: currentCheckpointProgress.total || 0,
    },
    currentMountainId,
    currentCheckpointId: resolvedCheckpointId,
    tasks: cloneValue(currentCheckpoint?.tasks || []),
    startPosition,
    learningPathState: cloneValue(source.learningPathState || source),
  };
}
