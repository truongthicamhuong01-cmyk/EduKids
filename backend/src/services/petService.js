const ApiError = require("../utils/apiError");
const { PET_ACTIONS, PET_ERROR_CODES } = require("../constants/petConstants");
const { getUserById, updateUserById } = require("../repositories/userRepository");
const {
  getPetRequest,
  getPetState,
  runTransaction,
  savePetRequest,
  savePetState,
} = require("../repositories/petRepository");
const { getGameConfigBundle } = require("../repositories/gameConfigRepository");
const { useItem: useInventoryItem } = require("./inventoryService");
const { toNumber } = require("./petMathService");
const {
  applyPetDecay,
  applyPetMutation,
  buildPetRuntimeState,
  stripDerivedPetFields,
} = require("./petDecayService");

function normalizeText(value) {
  return String(value || "").trim();
}

function isStudentUser(user) {
  return String(user?.role || "").toLowerCase() === "student";
}

function ensureStudentUser(user) {
  if (!user) {
    throw new ApiError(401, "Người dùng chưa đăng nhập", PET_ERROR_CODES.UNAUTHORIZED);
  }

  if (!isStudentUser(user)) {
    throw new ApiError(403, "Chỉ học sinh mới được sử dụng Pet", PET_ERROR_CODES.FORBIDDEN);
  }
}

function requireObject(value, fieldName, errorCode = PET_ERROR_CODES.INVALID_GAME_CONFIG) {
  if (!value || typeof value !== "object") {
    throw new ApiError(422, `Thiếu cấu hình ${fieldName}`, errorCode, {
      fieldName,
    });
  }

  return value;
}

function hasPath(source, path) {
  return path.split(".").every((segment, index, segments) => {
    if (index === 0) {
      return source && Object.prototype.hasOwnProperty.call(source, segment);
    }

    const parentPath = segments.slice(0, index).join(".");
    const parent = parentPath.split(".").reduce((acc, key) => acc && acc[key], source);
    return parent && Object.prototype.hasOwnProperty.call(parent, segment);
  });
}

function assertConfigShape(configs) {
  const petBalance = requireObject(configs.petBalance, "petBalance");
  const levelConfig = requireObject(configs.levelConfig, "levelConfig");
  const evolutionConfig = requireObject(configs.evolutionConfig, "evolutionConfig");

  const requiredPetBalancePaths = [
    "statLimits.minValue",
    "statLimits.maxValue",
    "initialState.level",
    "initialState.exp",
    "initialState.hunger",
    "initialState.happiness",
    "initialState.energy",
    "initialState.health",
    "actions.feed",
    "actions.play",
    "actions.sleep",
    "offline",
    "moodThresholds",
  ];

  const missingPetBalance = requiredPetBalancePaths.filter((path) => !hasPath(petBalance, path));
  if (missingPetBalance.length > 0) {
    throw new ApiError(422, "Cấu hình petBalance chưa đầy đủ", PET_ERROR_CODES.INVALID_GAME_CONFIG, {
      missingFields: missingPetBalance,
    });
  }

  const requiredLevelConfigPaths = ["curveType", "baseExp", "linearStep", "quadraticFactor", "levelCap"];
  const missingLevelConfig = requiredLevelConfigPaths.filter((path) => !hasPath(levelConfig, path));
  if (missingLevelConfig.length > 0) {
    throw new ApiError(422, "Cấu hình levelConfig chưa đầy đủ", PET_ERROR_CODES.INVALID_GAME_CONFIG, {
      missingFields: missingLevelConfig,
    });
  }

  const hasPetTypeRules =
    Array.isArray(evolutionConfig.petTypes) ||
    (evolutionConfig.byPetType && typeof evolutionConfig.byPetType === "object");

  if (!hasPetTypeRules) {
    throw new ApiError(422, "Cấu hình evolutionConfig chưa đầy đủ", PET_ERROR_CODES.INVALID_GAME_CONFIG, {
      missingFields: ["petTypes|byPetType"],
    });
  }

  if (!Array.isArray(evolutionConfig.stages) || evolutionConfig.stages.length === 0) {
    throw new ApiError(422, "Cấu hình evolutionConfig.stages chưa đầy đủ", PET_ERROR_CODES.INVALID_GAME_CONFIG, {
      missingFields: ["stages"],
    });
  }

  return {
    petBalance,
    levelConfig,
    evolutionConfig,
  };
}

function getStatLimits(petBalance = {}) {
  const statLimits = requireObject(petBalance.statLimits, "petBalance.statLimits");

  return {
    minValue: toNumber(statLimits.minValue, 0),
    maxValue: toNumber(statLimits.maxValue, 100),
  };
}

function getAllowedPetTypes(evolutionConfig = {}) {
  const allowed = new Set();

  if (Array.isArray(evolutionConfig.petTypes)) {
    evolutionConfig.petTypes.forEach((typeId) => {
      const normalized = normalizeText(typeId);
      if (normalized) {
        allowed.add(normalized);
      }
    });
  }

  if (evolutionConfig.byPetType && typeof evolutionConfig.byPetType === "object") {
    Object.keys(evolutionConfig.byPetType).forEach((typeId) => {
      const normalized = normalizeText(typeId);
      if (normalized) {
        allowed.add(normalized);
      }
    });
  }

  return Array.from(allowed);
}

function ensureAllowedPetType(petTypeId, evolutionConfig) {
  const allowedPetTypes = getAllowedPetTypes(evolutionConfig);

  if (allowedPetTypes.length === 0) {
    throw new ApiError(
      422,
      "Cấu hình pet type chưa được khai báo",
      PET_ERROR_CODES.INVALID_GAME_CONFIG,
      { fieldName: "evolutionConfig.petTypes" },
    );
  }

  if (!allowedPetTypes.includes(petTypeId)) {
    throw new ApiError(400, "Loại Pet không hợp lệ", PET_ERROR_CODES.INVALID_PET_TYPE, {
      petTypeId,
      allowedPetTypes,
    });
  }
}

function getInitialPetStats(petBalance = {}) {
  return {
    level: Math.max(1, Math.floor(toNumber(petBalance.initialState?.level, 1))),
    exp: Math.max(0, Math.floor(toNumber(petBalance.initialState?.exp, 0))),
    hunger: 100,
    happiness: 100,
    energy: 100,
    health: 100,
    isSleeping: false,
  };
}

function buildRuntimePetState(rawPetState, configs, now = new Date()) {
  return buildPetRuntimeState(rawPetState, configs, now, {
    useConfigInitialState: false,
  });
}

function buildPetResponse(petState, configs, extra = {}) {
  const petBalance = requireObject(configs.petBalance, "petBalance");
  const maxStatValue = toNumber(petBalance.statLimits?.maxValue, 100);
  const minStatValue = toNumber(petBalance.statLimits?.minValue, 0);
  const normalizedPet = buildRuntimePetState(petState, configs, new Date());

  const canFeed = normalizedPet.hunger < maxStatValue;
  const canPlay = normalizedPet.energy > toNumber(petBalance.actions?.play?.minEnergyToAllow, 0);
  const canSleep = normalizedPet.energy < toNumber(petBalance.actions?.sleep?.maxEnergyToAllow, maxStatValue);

  return {
    pet: {
      ...normalizedPet,
      petType: normalizedPet.petTypeId,
      name: normalizedPet.petName,
      isSleeping: Boolean(normalizedPet.isSleeping),
    },
    hasPet: true,
    wallet: {
      eduCoin: Math.max(0, Number(extra?.wallet?.eduCoin ?? extra?.wallet?.coin ?? extra?.eduCoin ?? 0)),
    },
    derivedState: {
      mood: normalizedPet.mood,
      stage: normalizedPet.stage,
      canFeed,
      canPlay,
      canSleep,
      isSleeping: Boolean(normalizedPet.isSleeping),
      maxStatValue,
      minStatValue,
    },
    ...extra,
  };
}

function getCooldownRemaining(lastActionAt, cooldownSeconds, now = new Date()) {
  const actionTime = lastActionAt ? new Date(lastActionAt) : null;
  if (!actionTime || Number.isNaN(actionTime.getTime())) {
    return 0;
  }

  const elapsedSeconds = Math.floor((now.getTime() - actionTime.getTime()) / 1000);
  return Math.max(0, cooldownSeconds - elapsedSeconds);
}

function ensureActionCooldown(petState, actionName, actionConfig, now = new Date()) {
  const cooldownSeconds = Math.max(0, Math.floor(toNumber(actionConfig.cooldownSeconds, 0)));
  if (cooldownSeconds <= 0) {
    return;
  }

  const fieldMap = {
    [PET_ACTIONS.FEED]: "lastFeedAt",
    [PET_ACTIONS.PLAY]: "lastPlayAt",
    [PET_ACTIONS.SLEEP]: "lastSleepAt",
  };

  const fieldName = fieldMap[actionName];
  const lastActionAt = fieldName ? petState[fieldName] : petState.lastActionAt;
  const remaining = getCooldownRemaining(lastActionAt, cooldownSeconds, now);

  if (remaining > 0) {
    throw new ApiError(429, "Hành động đang trong thời gian chờ", PET_ERROR_CODES.ACTION_COOLDOWN_ACTIVE, {
      actionName,
      retryAfterSeconds: remaining,
    });
  }
}

function recordPetRequestResponse(result) {
  return {
    statusCode: result.statusCode,
    message: result.message,
    data: result.data,
    popupEvents: result.popupEvents || [],
    animationEvents: result.animationEvents || [],
    meta: result.meta || {},
  };
}

function ensureCachedResponse(requestRecord, requestKey) {
  if (!requestRecord || !requestKey) {
    return null;
  }

  if (!requestRecord.response) {
    return null;
  }

  return requestRecord.response;
}

function applyActionDelta(petState, actionName, actionConfig, petBalance, levelConfig, evolutionConfig, now = new Date()) {
  const deltas = {
    hunger: 0,
    happiness: 0,
    energy: 0,
    health: 0,
    exp: 0,
  };

  if (actionName === PET_ACTIONS.FEED) {
    deltas.hunger = toNumber(actionConfig.hungerIncrease, 0);
    deltas.happiness = toNumber(actionConfig.happinessIncrease, 0);
    deltas.health = toNumber(actionConfig.healthIncrease, 0);
    deltas.exp = toNumber(actionConfig.expIncrease, 0);
    deltas.feedAt = true;
  } else if (actionName === PET_ACTIONS.PLAY) {
    deltas.happiness = toNumber(actionConfig.happinessIncrease, 0);
    deltas.energy = -toNumber(actionConfig.energyDecrease, 0);
    deltas.exp = toNumber(actionConfig.expIncrease, 0);
    deltas.playAt = true;
  } else if (actionName === PET_ACTIONS.SLEEP) {
    deltas.energy = toNumber(actionConfig.energyIncrease, 0);
    deltas.health = toNumber(actionConfig.healthIncrease, 0);
    deltas.happiness = toNumber(actionConfig.happinessIncrease, 0);
    deltas.sleepAt = true;
  }

  const mutation = applyPetMutation(
    petState,
    {
      petBalance,
      levelConfig,
      evolutionConfig,
    },
    deltas,
    now,
  );

  return mutation.state;
}

function getActionConfig(petBalance = {}, actionName = "") {
  const actions = requireObject(petBalance.actions, "petBalance.actions");
  const actionConfig = actions[actionName];

  if (!actionConfig || typeof actionConfig !== "object") {
    throw new ApiError(422, `Thiếu cấu hình cho hành động ${actionName}`, PET_ERROR_CODES.INVALID_GAME_CONFIG, {
      actionName,
    });
  }

  return actionConfig;
}

function validateActionGate(petState, actionName, petBalance, now = new Date()) {
  const actionConfig = getActionConfig(petBalance, actionName);
  const maxStatValue = toNumber(petBalance.statLimits?.maxValue, 100);
  const minEnergyToPlay = toNumber(actionConfig.minEnergyToAllow, 0);
  const maxEnergyToSleep = toNumber(actionConfig.maxEnergyToAllow, maxStatValue);
  const minHungerToFeed = toNumber(actionConfig.minHungerToAllow, maxStatValue);

  if (actionName === PET_ACTIONS.FEED && toNumber(petState.hunger, 0) >= minHungerToFeed) {
    throw new ApiError(400, "Pet đã no rồi", PET_ERROR_CODES.PET_TOO_FULL, {
      actionName,
      hunger: petState.hunger,
    });
  }

  if (actionName === PET_ACTIONS.PLAY && toNumber(petState.energy, 0) <= minEnergyToPlay) {
    throw new ApiError(400, "Pet đang quá mệt để chơi", PET_ERROR_CODES.PET_TOO_TIRED, {
      actionName,
      energy: petState.energy,
    });
  }

  if (actionName === PET_ACTIONS.SLEEP && toNumber(petState.energy, 0) >= maxEnergyToSleep) {
    throw new ApiError(400, "Pet chưa cần ngủ ngay", PET_ERROR_CODES.PET_NOT_READY, {
      actionName,
      energy: petState.energy,
    });
  }

  ensureActionCooldown(petState, actionName, actionConfig, now);

  return actionConfig;
}

async function syncPetRuntime(uid, petState, configs, now = new Date()) {
  const synced = applyPetDecay(petState, configs, now);
  const nextState = buildRuntimePetState(synced.state, configs, now);
  const finalState = {
    ...stripDerivedPetFields(nextState),
    updatedAt: now.toISOString(),
    lastUpdateAt: now.toISOString(),
    version: Math.max(0, Math.floor(toNumber(petState.version, 0))),
  };

  return {
    state: finalState,
    offlineApplied: synced.applied && synced.didChange,
    offlineMinutes: Math.round(synced.elapsedHours * 60),
  };
}

async function getPet({ uid, requestId = "" }) {
  const normalizedUid = normalizeText(uid);
  ensureStudentUser(await getUserById(normalizedUid));
  const now = new Date();

  const result = await runTransaction(async (transaction) => {
    const user = await getUserById(normalizedUid, transaction);
    ensureStudentUser(user);

    const petState = await getPetState(normalizedUid, transaction);

    if (!petState) {
      throw new ApiError(404, "Không tìm thấy Pet của bạn", PET_ERROR_CODES.PET_NOT_FOUND);
    }

    const configs = assertConfigShape(await getGameConfigBundle());
    const synced = await syncPetRuntime(normalizedUid, petState, configs, now);
    const nextVersion = Math.max(1, Math.floor(toNumber(petState.version, 0)) + 1);
    const petToSave = {
      ...stripDerivedPetFields(synced.state),
      version: nextVersion,
    };
    const userPatch = {
      lastActiveAt: now.toISOString(),
      lastLoginAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await updateUserById(normalizedUid, userPatch, transaction);
    await savePetState(normalizedUid, petToSave, transaction);
    return {
      statusCode: 200,
      message: "Lấy thông tin Pet thành công",
      data: buildPetResponse(petToSave, configs, {
        wallet: {
          eduCoin: Math.max(0, Number(user?.stats?.eduCoin || 0)),
        },
        sync: {
          offlineApplied: synced.offlineApplied,
          offlineMinutes: synced.offlineMinutes,
        },
      }),
      popupEvents: [],
      animationEvents: [],
      meta: {
        requestId,
        offlineApplied: synced.offlineApplied,
        offlineMinutes: synced.offlineMinutes,
      },
    };
  });

  console.info("[PET][INFO] getPet", {
    requestId,
    offlineApplied: Boolean(result.meta?.offlineApplied),
  });

  return result;
}

async function selectPet({ uid, body = {}, requestId = "", idempotencyKey = "" }) {
  const normalizedUid = normalizeText(uid);
  const petTypeId = normalizeText(body.petTypeId);
  const petName = normalizeText(body.petName || body.name);
  ensureStudentUser(await getUserById(normalizedUid));

  const configs = assertConfigShape(await getGameConfigBundle());
  const petBalance = requireObject(configs.petBalance, "petBalance");
  const evolutionConfig = requireObject(configs.evolutionConfig, "evolutionConfig");
  const now = new Date();

  ensureAllowedPetType(petTypeId, evolutionConfig);

  const result = await runTransaction(async (transaction) => {
    const user = await getUserById(normalizedUid, transaction);
    ensureStudentUser(user);

    if (idempotencyKey) {
      const cached = await getPetRequest(normalizedUid, idempotencyKey, transaction);
      const cachedResponse = ensureCachedResponse(cached, idempotencyKey);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    const existingPet = await getPetState(normalizedUid, transaction);
    if (existingPet || normalizeText(user?.selectedPetId)) {
      throw new ApiError(409, "Bạn đã chọn Pet rồi", PET_ERROR_CODES.PET_ALREADY_SELECTED, {
        petTypeId: existingPet?.petTypeId || existingPet?.petType || user?.selectedPetId || "",
      });
    }

    const initialStats = getInitialPetStats(petBalance);
    const initialState = {
      petTypeId,
      petName: petName || petTypeId,
      level: initialStats.level,
      exp: initialStats.exp,
      hunger: initialStats.hunger,
      happiness: initialStats.happiness,
      energy: initialStats.energy,
      health: initialStats.health,
      status: "active",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lastUpdateAt: now.toISOString(),
      lastLoginAt: now.toISOString(),
      lastActionAt: now.toISOString(),
      version: 1,
    };
    const runtimeState = buildRuntimePetState(initialState, configs, now);
    const payload = {
      ...stripDerivedPetFields(runtimeState),
      petTypeId,
      petName: petName || petTypeId,
      selectedAt: now.toISOString(),
      version: 1,
    };

    await savePetState(normalizedUid, payload, transaction);
    await updateUserById(
      normalizedUid,
      {
        selectedPetId: petTypeId,
        lastActiveAt: now.toISOString(),
        lastLoginAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      transaction,
    );

    const response = {
      statusCode: 201,
      message: "Chọn Pet thành công",
      data: buildPetResponse(payload, configs),
      popupEvents: [
        {
          type: "PET_SELECTED",
          title: "Chào mừng Pet mới",
          message: "Pet của bạn đã sẵn sàng cùng bạn học tập.",
          icon: "pet",
          priority: "normal",
          duration: 2500,
        },
      ],
      animationEvents: [
        {
          type: "PET_SELECTED",
          target: "pet",
          intensity: "low",
          duration: 1000,
          delay: 0,
          queueBehavior: "append",
          payload: {
            stage: payload.stage,
          },
        },
      ],
      meta: {
        requestId,
        offlineApplied: false,
        petTypeId,
      },
    };

    if (idempotencyKey) {
      await savePetRequest(
        normalizedUid,
        idempotencyKey,
        {
          action: PET_ACTIONS.SELECT,
          response: recordPetRequestResponse(response),
          processedAt: now.toISOString(),
        },
        transaction,
      );
    }

    return response;
  });

  console.info("[PET][INFO] selectPet", {
    requestId,
    petTypeId,
  });

  return result;
}

async function mutatePetAction({ uid, actionName, body = {}, requestId = "", idempotencyKey = "" }) {
  const normalizedUid = normalizeText(uid);
  ensureStudentUser(await getUserById(normalizedUid));
  const now = new Date();

  const result = await runTransaction(async (transaction) => {
    const user = await getUserById(normalizedUid, transaction);
    ensureStudentUser(user);

    const petState = await getPetState(normalizedUid, transaction);

    if (!petState) {
      throw new ApiError(404, "Không tìm thấy Pet của bạn", PET_ERROR_CODES.PET_NOT_FOUND);
    }

    const configs = assertConfigShape(await getGameConfigBundle());
    const petBalance = requireObject(configs.petBalance, "petBalance");
    const levelConfig = requireObject(configs.levelConfig, "levelConfig");
    const evolutionConfig = requireObject(configs.evolutionConfig, "evolutionConfig");

    if (idempotencyKey) {
      const cached = await getPetRequest(normalizedUid, idempotencyKey, transaction);
      const cachedResponse = ensureCachedResponse(cached, idempotencyKey);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    const synced = await syncPetRuntime(normalizedUid, petState, configs, now);
    const syncedState = synced.state;
    const actionConfig = validateActionGate(syncedState, actionName, petBalance, now);
    const nextState = applyActionDelta(
      syncedState,
      actionName,
      actionConfig,
      petBalance,
      levelConfig,
      evolutionConfig,
      now,
    );

    await savePetState(normalizedUid, stripDerivedPetFields(nextState), transaction);
    await updateUserById(
      normalizedUid,
      {
        lastActiveAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      transaction,
    );
    const actionPopupMap = {
      [PET_ACTIONS.FEED]: {
        type: "FEED_SUCCESS",
        title: "Cho ăn thành công",
        message: "Pet đã được nạp năng lượng rồi.",
        icon: "food",
        priority: "normal",
        duration: 2500,
      },
      [PET_ACTIONS.PLAY]: {
        type: "PLAY_SUCCESS",
        title: "Chơi vui lắm",
        message: "Pet của bạn đang rất vui.",
        icon: "toy",
        priority: "normal",
        duration: 2500,
      },
      [PET_ACTIONS.SLEEP]: {
        type: "SLEEP_SUCCESS",
        title: "Pet đã nghỉ ngơi",
        message: "Pet đang khỏe hơn rồi.",
        icon: "sleep",
        priority: "normal",
        duration: 2500,
      },
    };

    const actionAnimationMap = {
      [PET_ACTIONS.FEED]: "FEED",
      [PET_ACTIONS.PLAY]: "PLAY",
      [PET_ACTIONS.SLEEP]: "SLEEP",
    };

    const response = {
      statusCode: 200,
      message:
        actionName === PET_ACTIONS.FEED
          ? "Cho Pet ăn thành công"
          : actionName === PET_ACTIONS.PLAY
            ? "Chơi với Pet thành công"
            : "Cho Pet ngủ thành công",
      data: buildPetResponse(nextState, configs, {
        wallet: {
          eduCoin: Math.max(0, Number(user?.stats?.eduCoin || 0)),
        },
        sync: {
          offlineApplied: synced.offlineApplied,
          offlineMinutes: synced.offlineMinutes,
        },
        delta: {
          action: actionName,
          hunger: nextState.hunger - syncedState.hunger,
          happiness: nextState.happiness - syncedState.happiness,
          energy: nextState.energy - syncedState.energy,
          health: nextState.health - syncedState.health,
          exp: nextState.exp - syncedState.exp,
        },
      }),
      popupEvents: [actionPopupMap[actionName]].filter(Boolean),
      animationEvents: [
        {
          type: actionAnimationMap[actionName],
          target: "pet",
          intensity: "normal",
          duration: 1000,
          delay: 0,
          queueBehavior: "append",
          payload: {
            mood: nextState.mood,
            stage: nextState.stage,
          },
        },
      ],
      meta: {
        requestId,
        actionName,
        offlineApplied: synced.offlineApplied,
        offlineMinutes: synced.offlineMinutes,
      },
    };

    if (idempotencyKey) {
      await savePetRequest(
        normalizedUid,
        idempotencyKey,
        {
          action: actionName,
          response: recordPetRequestResponse(response),
          processedAt: now.toISOString(),
        },
        transaction,
      );
    }

    return response;
  });

  console.info("[PET][INFO] petAction", {
    requestId,
    actionName,
    offlineApplied: Boolean(result.meta?.offlineApplied),
  });

  return result;
}

async function feed({ uid, body = {}, requestId = "", idempotencyKey = "" }) {
  const itemId = normalizeText(body.itemId);

  if (itemId) {
    return useInventoryItem({
      uid,
      body,
      requestId,
      idempotencyKey,
    });
  }

  return mutatePetAction({
    uid,
    actionName: PET_ACTIONS.FEED,
    body,
    requestId,
    idempotencyKey,
  });
}

async function play({ uid, body = {}, requestId = "", idempotencyKey = "" }) {
  return mutatePetAction({
    uid,
    actionName: PET_ACTIONS.PLAY,
    body,
    requestId,
    idempotencyKey,
  });
}

async function sleep({ uid, body = {}, requestId = "", idempotencyKey = "" }) {
  return mutatePetAction({
    uid,
    actionName: PET_ACTIONS.SLEEP,
    body,
    requestId,
    idempotencyKey,
  });
}

module.exports = {
  feed,
  getPet,
  selectPet,
  sleep,
  play,
  buildPetResponse,
  buildRuntimePetState,
  mutatePetAction,
};
