const { season1 } = require("./learningPathData");

const CHECKPOINT_STATE = {
  LOCKED: "LOCKED",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
};

const TASK_STATE = {
  DONE: "DONE",
  NOT_DONE: "NOT_DONE",
};

function getTimeZone() {
  return process.env.LEARNING_PATH_TIMEZONE || "Asia/Ho_Chi_Minh";
}

function padTwo(value) {
  return String(value).padStart(2, "0");
}

function getZonedDateParts(date = new Date(), timeZone = getTimeZone()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
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

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

function getLocalDateKey(date = new Date()) {
  const zoned = getZonedDateParts(date);
  return [zoned.year, padTwo(zoned.month), padTwo(zoned.day)].join("-");
}

function getLocalWeekKey(date = new Date()) {
  const zoned = getZonedDateParts(date);
  const target = new Date(Date.UTC(zoned.year, zoned.month - 1, zoned.day));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);

  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNum + 3);

  const weekNumber = 1 + Math.round((target - firstThursday) / (7 * 24 * 60 * 60 * 1000));
  return `${target.getUTCFullYear()}-${padTwo(weekNumber)}`;
}

function getNowIsoString() {
  return new Date().toISOString();
}

function cloneValue(value) {
  if (value === null || typeof value === "undefined") {
    return value;
  }

  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizeCheckpointStatus(status) {
  if (status === CHECKPOINT_STATE.ACTIVE || status === CHECKPOINT_STATE.COMPLETED) {
    return status;
  }

  return CHECKPOINT_STATE.LOCKED;
}

function normalizeTaskStatus(status) {
  if (status === TASK_STATE.DONE) {
    return TASK_STATE.DONE;
  }

  return TASK_STATE.NOT_DONE;
}

const TASK_METRIC_BY_TYPE = {
  assignment: "assignmentCountToday",
  score: "highScoreQuizCountToday",
  topic: "lessonCountToday",
  coach: "coachCountToday",
  login: "loginCountToday",
  lesson: "lessonCountToday",
  quiz: "quizCountToday",
  study_minutes: "studyMinutesToday",
  quiz_score: "highScoreQuizCountToday",
};

function normalizeCount(value) {
  if (Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function normalizeLearningFacts(candidate = {}) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const facts = source.learningFacts && typeof source.learningFacts === "object" ? source.learningFacts : source;

  return {
    loginCountToday: normalizeCount(
      facts.loginCountToday ?? facts.loginCount ?? facts.loggedInToday ?? facts.loggedIn ?? facts.loginToday,
    ),
    studyMinutesToday: normalizeCount(
      facts.studyMinutesToday ?? facts.studyMinutes ?? facts.studyTimeMinutes ?? facts.timeStudied,
    ),
    lessonCountToday: normalizeCount(
      facts.lessonCountToday ?? facts.topicCompletedToday ?? facts.topicCompleted ?? facts.topicCountToday,
    ),
    quizCountToday: normalizeCount(
      facts.quizCountToday ?? facts.quizCompletedToday ?? facts.quizCompleted ?? facts.quizCount,
    ),
    highScoreQuizCountToday: normalizeCount(
      facts.highScoreQuizCountToday ?? facts.scoreAchievedToday ?? facts.scoreAchieved,
    ),
    assignmentCountToday: normalizeCount(
      facts.assignmentCountToday ?? facts.assignmentCompletedToday ?? facts.assignmentCompleted,
    ),
    coachCountToday: normalizeCount(facts.coachCountToday ?? facts.coachUsedToday ?? facts.coachUsed),
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

function isTaskSatisfiedByFacts(task, facts) {
  const taskMetric = String(task?.metric || "").trim();
  const metric = taskMetric || TASK_METRIC_BY_TYPE[String(task?.type || "").trim().toLowerCase()];
  const threshold = Math.max(1, normalizeCount(task?.threshold || 1));

  if (!metric) {
    return false;
  }

  return normalizeCount(facts?.[metric]) >= threshold;
}

function getMountainById(season, mountainId) {
  return Array.isArray(season?.mountains)
    ? season.mountains.find((mountain) => mountain.id === mountainId) || null
    : null;
}

function getCheckpointMetaById(season, checkpointId) {
  if (!Array.isArray(season?.mountains)) {
    return null;
  }

  for (let mountainIndex = 0; mountainIndex < season.mountains.length; mountainIndex += 1) {
    const mountain = season.mountains[mountainIndex];
    const checkpointIndex = Array.isArray(mountain?.checkpoints)
      ? mountain.checkpoints.findIndex((checkpoint) => checkpoint.id === checkpointId)
      : -1;

    if (checkpointIndex >= 0) {
      return {
        mountain,
        mountainIndex,
        checkpoint: mountain.checkpoints[checkpointIndex],
        checkpointIndex,
      };
    }
  }

  return null;
}

function getFirstCheckpointIdForMountain(season, mountainId) {
  const mountain = getMountainById(season, mountainId);
  return mountain?.checkpoints?.[0]?.id || "";
}

function getCurrentMountainIdFromLegacyState(candidate, season) {
  if (candidate?.mountainId) {
    return String(candidate.mountainId);
  }

  if (candidate?.currentMountainId) {
    return String(candidate.currentMountainId);
  }

  if (candidate?.progress?.currentMountain) {
    return String(candidate.progress.currentMountain);
  }

  if (Number.isInteger(candidate?.mountainIndex)) {
    return season.mountains[candidate.mountainIndex]?.id || season.mountains[0]?.id || "";
  }

  return season.mountains[0]?.id || "";
}

function getCurrentCheckpointIdFromLegacyState(candidate, season, mountainId) {
  if (candidate?.checkpointId) {
    return String(candidate.checkpointId);
  }

  if (candidate?.currentCheckpointId) {
    return String(candidate.currentCheckpointId);
  }

  if (candidate?.progress?.currentCheckpoint) {
    return String(candidate.progress.currentCheckpoint);
  }

  if (Number.isInteger(candidate?.checkpointIndex)) {
    const mountain = getMountainById(season, mountainId);
    return (
      mountain?.checkpoints?.[candidate.checkpointIndex]?.id ||
      getFirstCheckpointIdForMountain(season, mountainId)
    );
  }

  return getFirstCheckpointIdForMountain(season, mountainId);
}

function buildRawCheckpointState(
  meta,
  candidate,
  currentCheckpointId,
  completedCheckpointIds,
  learningFacts,
) {
  const rawCheckpoints = Array.isArray(candidate?.checkpoints) ? candidate.checkpoints : [];
  const legacyCheckpoint = rawCheckpoints.find((item) => item?.id === meta.checkpoint.id) || null;
  const legacyStatus = normalizeCheckpointStatus(legacyCheckpoint?.status || legacyCheckpoint?.state);
  const isCompleted =
    legacyStatus === CHECKPOINT_STATE.COMPLETED || completedCheckpointIds.has(meta.checkpoint.id);
  const isCurrent = meta.checkpoint.id === currentCheckpointId;
  const status = isCompleted
    ? CHECKPOINT_STATE.COMPLETED
    : isCurrent
      ? CHECKPOINT_STATE.ACTIVE
      : CHECKPOINT_STATE.LOCKED;

  const tasks = (meta.checkpoint.tasks || []).map((task) => {
    const factCompleted = isTaskSatisfiedByFacts(task, learningFacts);
    const taskStatus = normalizeTaskStatus(factCompleted ? TASK_STATE.DONE : "");

    return {
      id: task.id,
      status: isCompleted ? TASK_STATE.DONE : taskStatus,
    };
  });

  return {
    id: meta.checkpoint.id,
    status,
    tasks,
  };
}

function deriveCompletedCheckpoints(checkpoints) {
  return checkpoints
    .filter((checkpoint) => checkpoint.status === CHECKPOINT_STATE.COMPLETED)
    .map((checkpoint) => checkpoint.id);
}

function deriveCompletedMountains(season, checkpoints) {
  return (season.mountains || [])
    .filter((mountain) => {
      const summit = mountain.checkpoints?.find((checkpoint) => checkpoint.type === "summit");
      if (!summit) {
        return false;
      }

      const summitState = checkpoints.find((checkpoint) => checkpoint.id === summit.id);
      return summitState?.status === CHECKPOINT_STATE.COMPLETED;
    })
    .map((mountain) => mountain.id);
}

function applyCheckpointAvailability(state) {
  const currentCheckpoint = getRawCheckpointById(state, state.checkpointId);
  const completedAt = String(state?.limits?.lastCheckpointCompletedAt || "").trim();
  const shouldHoldUntilTomorrow = Boolean(completedAt) && isSameLocalDate(completedAt);

  if (!currentCheckpoint) {
    state.lockNotice = "";
    return state;
  }

  if (currentCheckpoint.status === CHECKPOINT_STATE.COMPLETED) {
    state.lockNotice = "";
    return state;
  }

  if (shouldHoldUntilTomorrow) {
    currentCheckpoint.status = CHECKPOINT_STATE.LOCKED;
    state.lockNotice = "Quay lại vào ngày mai để tiếp tục hành trình";
  } else {
    if (currentCheckpoint.status === CHECKPOINT_STATE.LOCKED) {
      currentCheckpoint.status = CHECKPOINT_STATE.ACTIVE;
    }
    state.lockNotice = "";
  }

  return state;
}

function buildInitialState(season = season1, progress = {}) {
  const seasonData = cloneValue(season);
  const candidate = cloneValue(progress);
  const learningFacts = normalizeLearningFacts(candidate);
  const userId = String(candidate?.userId || "");
  const mountainId = getCurrentMountainIdFromLegacyState(candidate, seasonData);
  const checkpointId = getCurrentCheckpointIdFromLegacyState(candidate, seasonData, mountainId);
  const legacyCompletedCheckpointIds = Array.isArray(candidate?.checkpoints)
    ? candidate.checkpoints
        .filter(
          (item) =>
            normalizeCheckpointStatus(item?.status || item?.state) === CHECKPOINT_STATE.COMPLETED,
        )
        .map((item) => String(item.id))
    : [];
  const progressCompletedCheckpointIds = Array.isArray(candidate?.progress?.completedCheckpoints)
    ? candidate.progress.completedCheckpoints.map((item) => String(item))
    : [];
  const completedCheckpointIds = new Set(
    progressCompletedCheckpointIds.length ? progressCompletedCheckpointIds : legacyCompletedCheckpointIds,
  );

  const checkpoints = (seasonData.mountains || []).flatMap((mountain, mountainIndex) =>
    (mountain.checkpoints || []).map((checkpoint, checkpointIndex) =>
      buildRawCheckpointState(
        {
          mountain,
          mountainIndex,
          checkpoint,
          checkpointIndex,
        },
        candidate,
        checkpointId,
        completedCheckpointIds,
        learningFacts,
      ),
    ),
  );

  const normalizedProgress = {
    completedCheckpoints:
      Array.isArray(candidate?.progress?.completedCheckpoints) && candidate.progress.completedCheckpoints.length
        ? Array.from(new Set(candidate.progress.completedCheckpoints.map((item) => String(item))))
        : deriveCompletedCheckpoints(checkpoints),
    completedMountains:
      Array.isArray(candidate?.progress?.completedMountains) && candidate.progress.completedMountains.length
        ? Array.from(new Set(candidate.progress.completedMountains.map((item) => String(item))))
        : deriveCompletedMountains(seasonData, checkpoints),
  };

  const state = {
    userId,
    seasonId: String(candidate?.seasonId || seasonData.id || ""),
    mountainId,
    checkpointId,
    checkpoints,
    progress: normalizedProgress,
    rewards: {
      xu: Number(candidate?.rewards?.xu ?? candidate?.earnedXu ?? 0) || 0,
      exp: Number(candidate?.rewards?.exp ?? candidate?.earnedExp ?? 0) || 0,
      badges: Array.isArray(candidate?.rewards?.badges)
        ? Array.from(new Set(candidate.rewards.badges.map((item) => String(item))))
        : Array.isArray(candidate?.earnedBadges)
          ? Array.from(new Set(candidate.earnedBadges.map((item) => String(item))))
          : [],
    },
    limits: {
      dailyCheckpointCount: Number(candidate?.limits?.dailyCheckpointCount ?? 0) || 0,
      weeklySummitCount: Number(candidate?.limits?.weeklySummitCount ?? 0) || 0,
      lastResetDate: String(candidate?.limits?.lastResetDate || getLocalDateKey()),
      lastResetWeek: String(candidate?.limits?.lastResetWeek || getLocalWeekKey()),
      lastCheckpointCompletedAt: String(candidate?.limits?.lastCheckpointCompletedAt || ""),
      lastSummitCompletedAt: String(candidate?.limits?.lastSummitCompletedAt || ""),
    },
    learningFacts,
    lockNotice: "",
    updatedAt: String(candidate?.updatedAt || getNowIsoString()),
  };

  return applyCheckpointAvailability(state);
}

function getRawCheckpointById(state, checkpointId) {
  return state.checkpoints.find((checkpoint) => checkpoint.id === checkpointId) || null;
}

function getCurrentMountainMeta(state, season) {
  return getMountainById(season, state.mountainId) || null;
}

function calculateAvatarPosition(state, season = season1) {
  const checkpointMeta = getCheckpointMetaById(season, state.checkpointId);
  if (!checkpointMeta) {
    return { left: 0, top: 0, side: "left" };
  }

  return cloneValue(checkpointMeta.checkpoint.position || { left: 0, top: 0, side: "left" });
}

function calculateRewards(event, context = {}) {
  if (event === "task") {
    return {
      xu: Number(context.taskReward?.xu) || 0,
      exp: Number(context.taskReward?.exp) || 0,
      badges: [],
    };
  }

  if (event === "checkpoint") {
    return {
      xu: Number(context.checkpointReward?.xu) || 20,
      exp: Number(context.checkpointReward?.exp) || 50,
      badges: context.checkpointReward?.badgeId ? [context.checkpointReward.badgeId] : [],
    };
  }

  if (event === "mountain") {
    return {
      xu: 100,
      exp: 200,
      badges: context.badgeId ? [context.badgeId] : [],
    };
  }

  return {
    xu: 0,
    exp: 0,
    badges: [],
  };
}

function createEngine(initialSeason = season1, initialProgress = {}, options = {}) {
  let seasonData = cloneValue(initialSeason);
  let state = buildInitialState(seasonData, initialProgress);
  const listeners = new Map();
  const eventSink = typeof options.onEvent === "function" ? options.onEvent : null;

  function on(eventName, callback) {
    if (typeof callback !== "function") {
      return () => {};
    }

    const key = String(eventName || "");
    if (!listeners.has(key)) {
      listeners.set(key, new Set());
    }

    const bucket = listeners.get(key);
    bucket.add(callback);

    return () => {
      bucket.delete(callback);
      if (bucket.size === 0) {
        listeners.delete(key);
      }
    };
  }

  function emit(eventName, payload = {}) {
    const key = String(eventName || "");
    const emitted = {
      eventName: key,
      payload: cloneValue(payload),
      state: getState(),
    };

    if (eventSink) {
      try {
        eventSink(cloneValue(emitted));
      } catch {
        // Ignore sink failures so the engine stays deterministic.
      }
    }

    const bucket = listeners.get(key);
    if (!bucket || bucket.size === 0) {
      return;
    }

    const callbacks = Array.from(bucket);
    callbacks.forEach((callback) => {
      try {
        callback(emitted);
      } catch {
        // Keep engine flow stable even if a subscriber fails.
      }
    });
  }

  function emitStateChanged(meta = {}) {
    emit("STATE_CHANGED", {
      ...meta,
      exportState: exportState(),
    });
  }

  function emitCheckpointBlocked(reason, checkpointId, extra = {}) {
    emit("CHECKPOINT_BLOCKED", {
      reason,
      checkpointId,
      ...extra,
    });
    emit(reason, {
      reason,
      checkpointId,
      ...extra,
    });
  }

  function emitRewardGranted(reward, extra = {}) {
    const safeReward = {
      xu: Number(reward?.xu) || 0,
      exp: Number(reward?.exp) || 0,
      badges: Array.isArray(reward?.badges) ? [...reward.badges] : [],
    };

    emit("REWARD_GRANTED", {
      reward: safeReward,
      ...extra,
    });
  }

  function touchState() {
    state.updatedAt = getNowIsoString();
  }

  function syncProgressFromCheckpoints() {
    state.progress.completedCheckpoints = deriveCompletedCheckpoints(state.checkpoints);
    state.progress.completedMountains = deriveCompletedMountains(seasonData, state.checkpoints);
  }

  function hasAllTasksDone(checkpoint) {
    return Array.isArray(checkpoint?.tasks) && checkpoint.tasks.every((task) => task.status === TASK_STATE.DONE);
  }

  function applyTimeLimits() {
    const today = getLocalDateKey();
    const currentWeek = getLocalWeekKey();
    let touched = false;

    if (state.limits.lastResetDate !== today) {
      state.limits.dailyCheckpointCount = 0;
      state.limits.lastResetDate = today;
      touched = true;
    }

    if (state.limits.lastResetWeek !== currentWeek) {
      state.limits.weeklySummitCount = 0;
      state.limits.lastResetWeek = currentWeek;
      touched = true;
    }

    if (touched) {
      touchState();
    }
  }

  function getCurrentCheckpointRecord() {
    return getRawCheckpointById(state, state.checkpointId);
  }

  function getCurrentMountainRecord() {
    return getCurrentMountainMeta(state, seasonData);
  }

  function getNextCheckpointRecord() {
    const currentMeta = getCheckpointMetaById(seasonData, state.checkpointId);
    if (!currentMeta) {
      return null;
    }

    const currentMountain = currentMeta.mountain;
    const nextCheckpoint = currentMountain.checkpoints?.[currentMeta.checkpointIndex + 1] || null;
    if (nextCheckpoint) {
      return nextCheckpoint;
    }

    const nextMountain = seasonData.mountains[currentMeta.mountainIndex + 1] || null;
    return nextMountain?.checkpoints?.[0] || null;
  }

  function setCheckpointStatus(checkpointId, status) {
    const checkpoint = getRawCheckpointById(state, checkpointId);
    if (!checkpoint) {
      return null;
    }

    checkpoint.status = normalizeCheckpointStatus(status);
    return checkpoint;
  }

  function setTaskStatus(checkpointId, taskId, status) {
    const checkpoint = getRawCheckpointById(state, checkpointId);
    if (!checkpoint) {
      return null;
    }

    const task = Array.isArray(checkpoint.tasks)
      ? checkpoint.tasks.find((item) => item.id === taskId)
      : null;
    if (!task) {
      return null;
    }

    task.status = normalizeTaskStatus(status);
    return task;
  }

  function completeCheckpoint(checkpointId = state.checkpointId) {
    applyTimeLimits();

    const checkpoint = getRawCheckpointById(state, checkpointId);
    if (!checkpoint) {
      emitCheckpointBlocked("CHECKPOINT_NOT_FOUND", checkpointId, {
        action: "completeCheckpoint",
      });
      return {
        ...getState(),
        success: false,
      };
    }

    if (checkpoint.status === CHECKPOINT_STATE.LOCKED) {
      emitCheckpointBlocked("CHECKPOINT_LOCKED", checkpointId, {
        action: "completeCheckpoint",
      });
      return {
        ...getState(),
        success: false,
        reason: "CHECKPOINT_LOCKED",
      };
    }

    if (!hasAllTasksDone(checkpoint)) {
      emitCheckpointBlocked("CHECKPOINT_TASKS_INCOMPLETE", checkpointId, {
        action: "completeCheckpoint",
      });
      return {
        ...getState(),
        success: false,
        reason: "CHECKPOINT_TASKS_INCOMPLETE",
      };
    }

    if (checkpoint.status === CHECKPOINT_STATE.COMPLETED) {
      return {
        ...getState(),
        success: true,
      };
    }

    if (state.limits.dailyCheckpointCount >= 1) {
      emitCheckpointBlocked("DAILY_LIMIT_REACHED", checkpointId, {
        action: "completeCheckpoint",
      });
      return {
        ...getState(),
        success: false,
        reason: "DAILY_LIMIT_REACHED",
      };
    }

    const checkpointMeta = getCheckpointMetaById(seasonData, checkpointId);
    const mountainMeta = checkpointMeta?.mountain || null;
    const summitMeta = mountainMeta?.checkpoints?.find((item) => item.type === "summit") || null;
    const isSummit = Boolean(summitMeta && summitMeta.id === checkpointId);

    if (isSummit && state.limits.weeklySummitCount >= 1) {
      emitCheckpointBlocked("WEEKLY_LIMIT_REACHED", checkpointId, {
        action: "completeCheckpoint",
      });
      return {
        ...getState(),
        success: false,
        reason: "WEEKLY_LIMIT_REACHED",
      };
    }

    setCheckpointStatus(checkpointId, CHECKPOINT_STATE.COMPLETED);

    const checkpointRewards = calculateRewards("checkpoint", {
      checkpointReward: checkpointMeta?.checkpoint?.reward,
    });
    state.rewards.xu += checkpointRewards.xu;
    state.rewards.exp += checkpointRewards.exp;
    checkpointRewards.badges.forEach((badgeId) => {
      if (!state.rewards.badges.includes(badgeId)) {
        state.rewards.badges.push(badgeId);
      }
    });
    if (checkpointRewards.xu || checkpointRewards.exp || checkpointRewards.badges.length) {
      emitRewardGranted(checkpointRewards, {
        source: "checkpoint",
        checkpointId,
      });
    }

    state.limits.dailyCheckpointCount += 1;
    state.limits.lastCheckpointCompletedAt = getNowIsoString();

    if (isSummit && mountainMeta?.badge?.id) {
      state.limits.weeklySummitCount += 1;
      state.limits.lastSummitCompletedAt = getNowIsoString();
      const mountainRewards = calculateRewards("mountain", {
        badgeId: mountainMeta.badge.id,
      });
      state.rewards.xu += mountainRewards.xu;
      state.rewards.exp += mountainRewards.exp;
      mountainRewards.badges.forEach((badgeId) => {
        if (!state.rewards.badges.includes(badgeId)) {
          state.rewards.badges.push(badgeId);
        }
      });
      if (mountainRewards.xu || mountainRewards.exp || mountainRewards.badges.length) {
        emitRewardGranted(mountainRewards, {
          source: "mountain",
          checkpointId,
          mountainId: mountainMeta.id,
        });
      }
    }

    syncProgressFromCheckpoints();
    touchState();

    emit("CHECKPOINT_COMPLETED", {
      checkpointId,
      checkpoint: cloneValue(checkpoint),
      mountainId: mountainMeta?.id || state.mountainId,
      isSummit,
    });
    emitStateChanged({
      action: "completeCheckpoint",
      checkpointId,
    });

    return {
      ...getState(),
      success: true,
    };
  }

  function completeTask(taskId) {
    applyTimeLimits();

    const taskEntry = state.checkpoints
      .flatMap((checkpoint) => checkpoint.tasks.map((task) => ({ checkpoint, task })))
      .find((entry) => entry.task.id === taskId);

    if (!taskEntry) {
      emit("TASK_BLOCKED", {
        reason: "TASK_NOT_FOUND",
        taskId,
      });
      return getState();
    }

    if (taskEntry.checkpoint.status === CHECKPOINT_STATE.LOCKED) {
      emit("TASK_BLOCKED", {
        reason: "CHECKPOINT_LOCKED",
        taskId,
        checkpointId: taskEntry.checkpoint.id,
      });
      return getState();
    }

    if (taskEntry.task.status === TASK_STATE.DONE) {
      if (hasAllTasksDone(taskEntry.checkpoint) && taskEntry.checkpoint.status === CHECKPOINT_STATE.ACTIVE) {
        const checkpointResult = completeCheckpoint(taskEntry.checkpoint.id);
        if (checkpointResult?.success === false) {
          return {
            ...getState(),
            success: false,
            reason: checkpointResult.reason,
          };
        }

        const nextCheckpointResult = goToNextCheckpoint();
        if (nextCheckpointResult?.success === false) {
          return {
            ...getState(),
            success: false,
            reason: nextCheckpointResult.reason,
          };
        }
      }

      return {
        ...getState(),
        success: true,
      };
    }

    emit("TASK_BLOCKED", {
      reason: "TASK_REQUIRES_REAL_DATA",
      taskId,
      checkpointId: taskEntry.checkpoint.id,
    });
    return {
      ...getState(),
      success: false,
      reason: "TASK_REQUIRES_REAL_DATA",
    }
  }

  function goToNextCheckpoint() {
    applyTimeLimits();

    const currentCheckpoint = getCurrentCheckpointRecord();
    if (!currentCheckpoint || currentCheckpoint.status !== CHECKPOINT_STATE.COMPLETED) {
      emit("CHECKPOINT_BLOCKED", {
        reason: "CHECKPOINT_NOT_COMPLETED",
        checkpointId: currentCheckpoint?.id || state.checkpointId,
        action: "goToNextCheckpoint",
      });
      return {
        ...getState(),
        success: false,
      };
    }

    const nextCheckpoint = getNextCheckpointRecord();
    if (!nextCheckpoint) {
      syncProgressFromCheckpoints();
      touchState();
      emitStateChanged({
        action: "goToNextCheckpoint",
        checkpointId: state.checkpointId,
      });
      return getState();
    }

    state.checkpoints.forEach((checkpoint) => {
      if (checkpoint.id === nextCheckpoint.id) {
        checkpoint.status = CHECKPOINT_STATE.LOCKED;
        return;
      }

      if (checkpoint.status !== CHECKPOINT_STATE.COMPLETED) {
        checkpoint.status = CHECKPOINT_STATE.LOCKED;
      }
    });

    state.mountainId = nextCheckpoint.id
      ? getCheckpointMetaById(seasonData, nextCheckpoint.id)?.mountain?.id || state.mountainId
      : state.mountainId;
    state.checkpointId = nextCheckpoint.id;

    syncProgressFromCheckpoints();
    touchState();
    applyCheckpointAvailability(state);

    emit("CHECKPOINT_LOCKED", {
      checkpointId: nextCheckpoint.id,
      mountainId: state.mountainId,
    });
    emit("AVATAR_POSITION_CHANGED", {
      from: calculateAvatarPosition({ ...state, checkpointId: currentCheckpoint.id }, seasonData),
      to: calculateAvatarPosition(state, seasonData),
      checkpointId: nextCheckpoint.id,
    });
    emitStateChanged({
      action: "goToNextCheckpoint",
      checkpointId: nextCheckpoint.id,
    });

    return {
      ...buildStateSnapshot(),
      success: true,
    };
  }

  function buildViewCheckpoint(checkpoint) {
    const meta = getCheckpointMetaById(seasonData, checkpoint.id);
    if (!meta) {
      return cloneValue(checkpoint);
    }

    return {
      id: meta.checkpoint.id,
      mountainId: meta.mountain.id,
      mountainIndex: meta.mountainIndex,
      checkpointIndex: meta.checkpointIndex,
      type: meta.checkpoint.type,
      title: meta.checkpoint.title,
      altitude: meta.checkpoint.altitude,
      position: cloneValue(meta.checkpoint.position),
      reward: cloneValue(meta.checkpoint.reward),
      status: checkpoint.status,
      state: checkpoint.status,
      completed: checkpoint.status === CHECKPOINT_STATE.COMPLETED,
      tasks: (meta.checkpoint.tasks || []).map((task) => {
        const currentTask = Array.isArray(checkpoint.tasks)
          ? checkpoint.tasks.find((item) => item.id === task.id)
          : null;

        return {
          id: task.id,
          title: task.title,
          description: task.description,
          targetRoute: task.targetRoute,
          targetPageId: task.targetPageId || "",
          type: task.type || "",
          icon: task.icon || "",
          metric: task.metric || "",
          threshold: Number(task.threshold) || 1,
          completed: currentTask?.status === TASK_STATE.DONE,
          status: currentTask?.status || TASK_STATE.NOT_DONE,
          state: currentTask?.status || TASK_STATE.NOT_DONE,
        };
      }),
    };
  }

  function buildStateSnapshot() {
    const currentMountain = getCurrentMountainRecord();
    const currentCheckpointRecord = getCurrentCheckpointRecord();
    const viewCheckpoints = state.checkpoints.map((checkpoint) => buildViewCheckpoint(checkpoint));
    const viewCurrentCheckpoint = currentCheckpointRecord ? buildViewCheckpoint(currentCheckpointRecord) : null;
    const viewTasks = viewCurrentCheckpoint?.tasks || [];
    const checkpointProgressCompleted = viewTasks.filter((task) => task.status === TASK_STATE.DONE).length;
    const checkpointProgressTotal = viewTasks.length || 3;
    const completedCheckpoints = state.progress.completedCheckpoints.length || 0;
    const totalCheckpoints = state.checkpoints.length || 1;

    return {
      userId: state.userId,
      seasonId: state.seasonId,
      mountainId: state.mountainId,
      checkpointId: state.checkpointId,
      season: cloneValue(seasonData),
      mountain: currentMountain ? cloneValue(currentMountain) : null,
      checkpoint: viewCurrentCheckpoint,
      tasks: cloneValue(viewTasks),
      checkpoints: cloneValue(viewCheckpoints),
      rewards: cloneValue(state.rewards),
      progress: cloneValue(state.progress),
      limits: cloneValue(state.limits),
      updatedAt: state.updatedAt,
      lockNotice: String(state.lockNotice || ""),
      avatar: {
        position: calculateAvatarPosition(state, seasonData),
      },
      progressPercent: Math.round((completedCheckpoints / totalCheckpoints) * 100),
      checkpointProgress: {
        completed: checkpointProgressCompleted,
        total: checkpointProgressTotal,
      },
      currentMountainId: state.mountainId,
      currentCheckpointId: state.checkpointId,
      learningPathState: exportState(),
    };
  }

  function reconcileAutoProgress() {
    applyTimeLimits();
    applyCheckpointAvailability(state);

    const currentCheckpoint = getCurrentCheckpointRecord();
    if (!currentCheckpoint || currentCheckpoint.status !== CHECKPOINT_STATE.ACTIVE) {
      return;
    }

    if (!hasAllTasksDone(currentCheckpoint)) {
      return;
    }

    const completedCheckpointResult = completeCheckpoint(currentCheckpoint.id);
    if (completedCheckpointResult?.success === false) {
      return;
    }

    if (getNextCheckpointRecord()) {
      goToNextCheckpoint();
      return;
    }

    applyCheckpointAvailability(state);
    touchState();
    emitStateChanged({
      action: "autoCompleteCheckpoint",
      checkpointId: currentCheckpoint.id,
    });
  }

  function getState() {
    applyTimeLimits();
    return buildStateSnapshot();
  }

  function exportState() {
    return cloneValue({
      userId: state.userId,
      seasonId: state.seasonId,
      mountainId: state.mountainId,
      checkpointId: state.checkpointId,
      checkpoints: state.checkpoints,
      progress: state.progress,
      rewards: state.rewards,
      limits: state.limits,
      updatedAt: state.updatedAt,
    });
  }

  function normalizeIncomingState(candidate) {
    if (!candidate || typeof candidate !== "object") {
      return buildInitialState(seasonData, initialProgress);
    }

    const source = candidate.state && typeof candidate.state === "object" ? candidate.state : candidate;
    return buildInitialState(seasonData, source);
  }

  function importState(nextState) {
    state = normalizeIncomingState(nextState);
    syncProgressFromCheckpoints();
    touchState();
    reconcileAutoProgress();
    emitStateChanged({
      action: "importState",
    });
    return buildStateSnapshot();
  }

  function saveState() {
    return buildStateSnapshot();
  }

  function loadState() {
    emitStateChanged({
      action: "loadState",
      hydrated: false,
    });
    return buildStateSnapshot();
  }

  state = buildInitialState(seasonData, initialProgress);
  syncProgressFromCheckpoints();
  reconcileAutoProgress();

  return {
    getState,
    completeTask,
    completeCheckpoint,
    goToNextCheckpoint,
    calculateAvatarPosition: () => calculateAvatarPosition(state, seasonData),
    calculateRewards,
    saveState,
    loadState,
    exportState,
    importState,
    on,
    emit,
  };
}

module.exports = {
  CHECKPOINT_STATE,
  TASK_STATE,
  createEngine,
  buildInitialState,
  calculateAvatarPosition,
  calculateRewards,
};
