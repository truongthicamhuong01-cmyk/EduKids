(() => {
  const AI_LOG_COLLECTION = "ai_usage_logs";
  const AI_SETTINGS_COLLECTION = "systemSettings";
  const AI_SETTINGS_DOC_ID = "config";
  const COACH_CACHE_COLLECTION = "coach_analysis_cache";
  const DAY_MS = 24 * 60 * 60 * 1000;

  function getFirestore() {
    if (
      !window.firebase?.apps?.length ||
      typeof window.firebase.app !== "function" ||
      typeof window.firebase.firestore !== "function"
    ) {
      return null;
    }

    try {
      return window.firebase.app().firestore();
    } catch (error) {
      console.warn("Unable to initialize Firestore for admin AI:", error);
      return null;
    }
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeBoolean(value, fallback = true) {
    return typeof value === "boolean" ? value : Boolean(fallback);
  }

  function getTimestampValue(value) {
    if (!value) {
      return 0;
    }

    if (typeof value?.toDate === "function") {
      const date = value.toDate();
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function toIsoDateKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function startOfTodayLocal() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function startOfMonthLocal() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  function isSuccessStatus(status) {
    const normalized = normalizeText(status).toLowerCase();
    return normalized === "success" || normalized === "ok" || normalized === "passed";
  }

  function normalizeLog(doc) {
    const data = typeof doc?.data === "function" ? doc.data() || {} : doc || {};
    return {
      id: normalizeText(doc?.id || data.id),
      feature: normalizeText(data.feature || data.module || ""),
      action: normalizeText(data.action || ""),
      status: normalizeText(data.status || data.result || "").toLowerCase() || "success",
      success:
        typeof data.success === "boolean"
          ? data.success
          : isSuccessStatus(data.status || data.result),
      userId: normalizeText(data.userId || data.uid || ""),
      role: normalizeText(data.role || ""),
      message: normalizeText(data.message || data.error || ""),
      createdAt: data.createdAt || data.timestamp || data.usedAt || data.occurredAt || "",
      createdAtValue: getTimestampValue(
        data.createdAt || data.timestamp || data.usedAt || data.occurredAt || "",
      ),
      meta: data.meta || {},
    };
  }

  function buildDaySeries(logs = [], days = 7) {
    const today = startOfTodayLocal();
    const buckets = new Map();

    for (let index = days - 1; index >= 0; index -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - index);
      buckets.set(toIsoDateKey(date), {
        date,
        label: new Intl.DateTimeFormat("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        }).format(date),
        value: 0,
      });
    }

    (Array.isArray(logs) ? logs : []).forEach((log) => {
      const date = log.createdAtValue ? new Date(log.createdAtValue) : null;
      const key = date ? toIsoDateKey(date) : "";
      const bucket = buckets.get(key);

      if (bucket) {
        bucket.value += 1;
      }
    });

    return Array.from(buckets.values());
  }

  async function fetchCollectionDocs(collectionName) {
    const firestore = getFirestore();

    if (!firestore || !collectionName) {
      return [];
    }

    try {
      const snapshot = await firestore.collection(collectionName).get();
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() || {}),
      }));
    } catch (error) {
      console.warn(`[EduKids][admin-ai] Failed to load ${collectionName}:`, error);
      return [];
    }
  }

  async function fetchAiSettings() {
    const firestore = getFirestore();

    if (!firestore) {
      return {
        registration: {
          studentEnabled: true,
          teacherEnabled: true,
        },
        ai: {
          coachEnabled: true,
          assignmentEnabled: true,
          learningAnalysisEnabled: true,
        },
        maintenance: {
          enabled: false,
          message: "Hệ thống đang bảo trì, vui lòng quay lại sau.",
        },
        systemInfo: {
          version: "2.0.0",
          firebaseProjectId: "",
          updatedAt: "",
        },
        cacheRevision: 0,
      };
    }

    try {
      const snapshot = await firestore.collection(AI_SETTINGS_COLLECTION).doc(AI_SETTINGS_DOC_ID).get();

      if (!snapshot.exists) {
        return {
          registration: {
            studentEnabled: true,
            teacherEnabled: true,
          },
          ai: {
            coachEnabled: true,
            assignmentEnabled: true,
            learningAnalysisEnabled: true,
          },
          maintenance: {
            enabled: false,
            message: "Hệ thống đang bảo trì, vui lòng quay lại sau.",
          },
          systemInfo: {
            version: "2.0.0",
            firebaseProjectId: "",
            updatedAt: "",
          },
          cacheRevision: 0,
        };
      }

      const data = snapshot.data() || {};

      return {
        registration: {
          studentEnabled: normalizeBoolean(data.registration?.studentEnabled, true),
          teacherEnabled: normalizeBoolean(data.registration?.teacherEnabled, true),
        },
        ai: {
          coachEnabled: normalizeBoolean(data.ai?.coachEnabled, data.aiCoachEnabled !== false),
          assignmentEnabled: normalizeBoolean(data.ai?.assignmentEnabled, data.aiAssignmentEnabled !== false),
          learningAnalysisEnabled: normalizeBoolean(
            data.ai?.learningAnalysisEnabled,
            data.aiLearningAnalysisEnabled !== false,
          ),
        },
        maintenance: {
          enabled: normalizeBoolean(data.maintenance?.enabled, false),
          message:
            normalizeText(data.maintenance?.message || data.maintenanceMessage) ||
            "Hệ thống đang bảo trì, vui lòng quay lại sau.",
        },
        systemInfo: {
          version: normalizeText(data.systemInfo?.version || data.version || "2.0.0") || "2.0.0",
          firebaseProjectId: normalizeText(
            data.systemInfo?.firebaseProjectId || data.firebaseProjectId || "",
          ),
          updatedAt: normalizeText(data.systemInfo?.updatedAt || data.updatedAt || ""),
        },
        cacheRevision: Number(data.cacheRevision ?? data.ai?.cacheRevision) || 0,
        updatedAt: data.updatedAt || "",
        updatedBy: normalizeText(data.updatedBy || ""),
      };
    } catch (error) {
      console.warn("[EduKids][admin-ai] Failed to load AI settings:", error);
      return {
        registration: {
          studentEnabled: true,
          teacherEnabled: true,
        },
        ai: {
          coachEnabled: true,
          assignmentEnabled: true,
          learningAnalysisEnabled: true,
        },
        maintenance: {
          enabled: false,
          message: "Hệ thống đang bảo trì, vui lòng quay lại sau.",
        },
        systemInfo: {
          version: "2.0.0",
          firebaseProjectId: "",
          updatedAt: "",
        },
        cacheRevision: 0,
      };
    }
  }

  async function updateAiSettings(updates = {}) {
    const firestore = getFirestore();

    if (!firestore) {
      throw new Error("Firestore is unavailable");
    }

    const current = await fetchAiSettings();
    const payload = {
      registration: {
        studentEnabled:
          typeof updates.registration?.studentEnabled === "boolean"
            ? updates.registration.studentEnabled
            : current.registration.studentEnabled,
        teacherEnabled:
          typeof updates.registration?.teacherEnabled === "boolean"
            ? updates.registration.teacherEnabled
            : current.registration.teacherEnabled,
      },
      ai: {
        coachEnabled:
          typeof updates.ai?.coachEnabled === "boolean"
            ? updates.ai.coachEnabled
            : current.ai.coachEnabled,
        assignmentEnabled:
          typeof updates.ai?.assignmentEnabled === "boolean"
            ? updates.ai.assignmentEnabled
            : current.ai.assignmentEnabled,
        learningAnalysisEnabled:
          typeof updates.ai?.learningAnalysisEnabled === "boolean"
            ? updates.ai.learningAnalysisEnabled
            : current.ai.learningAnalysisEnabled,
      },
      maintenance: {
        enabled:
          typeof updates.maintenance?.enabled === "boolean"
            ? updates.maintenance.enabled
            : current.maintenance.enabled,
        message:
          normalizeText(updates.maintenance?.message) || current.maintenance.message,
      },
      systemInfo: {
        version: normalizeText(updates.systemInfo?.version || current.systemInfo.version) || "2.0.0",
        firebaseProjectId:
          normalizeText(updates.systemInfo?.firebaseProjectId || current.systemInfo.firebaseProjectId),
        updatedAt: normalizeText(updates.systemInfo?.updatedAt || current.systemInfo.updatedAt),
      },
      cacheRevision:
        Number.isFinite(Number(updates.cacheRevision))
          ? Number(updates.cacheRevision)
          : current.cacheRevision,
      updatedAt: new Date().toISOString(),
      updatedBy: normalizeText(updates.updatedBy || ""),
    };

    await firestore.collection(AI_SETTINGS_COLLECTION).doc(AI_SETTINGS_DOC_ID).set(payload, {
      merge: true,
    });

    return payload;
  }

  async function toggleAiCoachEnabled(enabled, updatedBy = "") {
    return updateAiSettings({
      ai: {
        coachEnabled: Boolean(enabled),
      },
      updatedBy,
    });
  }

  async function bumpCacheRevision(updatedBy = "") {
    const current = await fetchAiSettings();
    return updateAiSettings({
      cacheRevision: Number(current.cacheRevision || 0) + 1,
      updatedBy,
    });
  }

  async function clearCoachCache() {
    const firestore = getFirestore();

    if (!firestore) {
      throw new Error("Firestore is unavailable");
    }

    const snapshot = await firestore.collection(COACH_CACHE_COLLECTION).get();
    const batch = firestore.batch();
    let operations = 0;

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      operations += 1;
    });

    if (operations > 0) {
      await batch.commit();
    }

    await bumpCacheRevision("admin");

    return {
      deletedCount: operations,
    };
  }

  async function recordAiUsage(payload = {}) {
    const firestore = getFirestore();

    if (!firestore) {
      return null;
    }

    try {
      const docRef = firestore.collection(AI_LOG_COLLECTION).doc();
      const now = new Date().toISOString();
      const normalizedSuccess =
        typeof payload.success === "boolean"
          ? payload.success
          : isSuccessStatus(payload.status);

      const record = {
        id: docRef.id,
        feature: normalizeText(payload.feature || "coach"),
        action: normalizeText(payload.action || "analyze"),
        status: normalizedSuccess ? "success" : "failed",
        success: normalizedSuccess,
        userId: normalizeText(payload.userId || ""),
        role: normalizeText(payload.role || ""),
        message: normalizeText(payload.message || ""),
        createdAt: now,
        createdAtValue: Date.parse(now),
        meta: payload.meta || {},
      };

      await docRef.set(record);
      return record;
    } catch (error) {
      console.warn("[EduKids][admin-ai] Failed to record log:", error);
      return null;
    }
  }

  async function fetchAiUsageLogs() {
    const docs = await fetchCollectionDocs(AI_LOG_COLLECTION);
    return docs
      .map((doc) => normalizeLog(doc))
      .filter((log) => log.id)
      .sort((left, right) => right.createdAtValue - left.createdAtValue);
  }

  async function fetchAiDashboardData() {
    const [settings, logs] = await Promise.all([fetchAiSettings(), fetchAiUsageLogs()]);
    const now = new Date();
    const todayKey = toIsoDateKey(startOfTodayLocal());
    const monthStart = startOfMonthLocal().getTime();

    const todayLogs = logs.filter((log) => {
      const date = log.createdAtValue ? new Date(log.createdAtValue) : null;
      return date ? toIsoDateKey(date) === todayKey : false;
    });

    const monthLogs = logs.filter((log) => log.createdAtValue >= monthStart);
    const successCount = logs.filter((log) => Boolean(log.success)).length;
    const successRate = logs.length > 0 ? Number(((successCount / logs.length) * 100).toFixed(1)) : 0;

    return {
      settings,
      logs,
      todayCount: todayLogs.length,
      monthCount: monthLogs.length,
      successRate,
      dailySeries: buildDaySeries(logs, 7),
      hasLogs: logs.length > 0,
      generatedAt: now.toISOString(),
    };
  }

  window.EduKidsAdminAiService = {
    clearCoachCache,
    fetchAiDashboardData,
    fetchAiSettings,
    recordAiUsage,
    toggleAiCoachEnabled,
  };
})();
