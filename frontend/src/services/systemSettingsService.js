(() => {
  const SETTINGS_COLLECTION = "systemSettings";
  const SETTINGS_DOC_ID = "config";
  const DEFAULT_SETTINGS = {
    registration: {
      studentEnabled: true,
      teacherEnabled: true,
    },
    aiCoachEnabled: true,
    aiTopicLearningEnabled: true,
    aiAssignmentEnabled: true,
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
    updatedAt: "",
    updatedBy: "",
  };

  let currentSettings = { ...DEFAULT_SETTINGS };
  let observer = null;
  let readyPromise = null;
  let readyResolve = null;

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
      console.warn("Unable to initialize Firestore for system settings:", error);
      return null;
    }
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeBoolean(value, fallback = true) {
    return typeof value === "boolean" ? value : Boolean(fallback);
  }

  function normalizeSettings(data = {}) {
    const source = data && typeof data === "object" ? data : {};
    const aiCoachEnabled = normalizeBoolean(
      source.aiCoachEnabled,
      source.ai?.coachEnabled ?? source.aiCoachEnabled ?? true,
    );
    const aiTopicLearningEnabled = normalizeBoolean(
      source.aiTopicLearningEnabled,
      source.ai?.learningAnalysisEnabled ??
        source.aiLearningAnalysisEnabled ??
        source.aiTopicLearningEnabled ??
        true,
    );
    const aiAssignmentEnabled = normalizeBoolean(
      source.aiAssignmentEnabled,
      source.ai?.assignmentEnabled ?? source.aiAssignmentEnabled ?? true,
    );

    return {
      registration: {
        studentEnabled:
          normalizeBoolean(source.registration?.studentEnabled, source.registration?.studentEnabled ?? true),
        teacherEnabled:
          normalizeBoolean(source.registration?.teacherEnabled, source.registration?.teacherEnabled ?? true),
      },
      aiCoachEnabled,
      aiTopicLearningEnabled,
      aiAssignmentEnabled,
      ai: {
        coachEnabled: aiCoachEnabled,
        assignmentEnabled: aiAssignmentEnabled,
        learningAnalysisEnabled: aiTopicLearningEnabled,
      },
      maintenance: {
        enabled: normalizeBoolean(source.maintenance?.enabled, source.maintenance?.enabled ?? false),
        message:
          normalizeText(source.maintenance?.message || source.maintenanceMessage) ||
          DEFAULT_SETTINGS.maintenance.message,
      },
      systemInfo: {
        version: normalizeText(source.systemInfo?.version || source.version || DEFAULT_SETTINGS.systemInfo.version) || DEFAULT_SETTINGS.systemInfo.version,
        firebaseProjectId: normalizeText(
          source.systemInfo?.firebaseProjectId || source.firebaseProjectId || "",
        ),
        updatedAt: normalizeText(source.systemInfo?.updatedAt || source.updatedAt || ""),
      },
      cacheRevision: Number(source.cacheRevision ?? source.ai?.cacheRevision) || 0,
      updatedAt: normalizeText(source.updatedAt || ""),
      updatedBy: normalizeText(source.updatedBy || ""),
    };
  }

  function getSettingsRef() {
    const firestore = getFirestore();

    if (!firestore) {
      return null;
    }

    return firestore.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID);
  }

  async function fetchSystemSettings() {
    const ref = getSettingsRef();

    if (!ref) {
      currentSettings = { ...DEFAULT_SETTINGS };
      return currentSettings;
    }

    try {
      const snapshot = await ref.get();
      currentSettings = snapshot.exists
        ? normalizeSettings(snapshot.data() || {})
        : { ...DEFAULT_SETTINGS };
      return currentSettings;
    } catch (error) {
      console.warn("[EduKids][system-settings] Failed to load settings:", error);
      currentSettings = { ...DEFAULT_SETTINGS };
      return currentSettings;
    }
  }

  function observeSystemSettings(onChange) {
    const ref = getSettingsRef();

    if (!ref) {
      currentSettings = { ...DEFAULT_SETTINGS };
      if (typeof onChange === "function") {
        onChange(currentSettings);
      }

      if (readyResolve) {
        readyResolve(currentSettings);
        readyResolve = null;
      }

      readyPromise ||= Promise.resolve(currentSettings);
      return () => {};
    }

    if (!readyPromise) {
      readyPromise = new Promise((resolve) => {
        readyResolve = resolve;
      });
    }

    if (observer) {
      observer();
      observer = null;
    }

    observer = ref.onSnapshot(
      (snapshot) => {
        currentSettings = snapshot.exists
          ? normalizeSettings(snapshot.data() || {})
          : { ...DEFAULT_SETTINGS };

        if (typeof onChange === "function") {
          onChange(currentSettings);
        }

        if (readyResolve) {
          readyResolve(currentSettings);
          readyResolve = null;
        }
      },
      (error) => {
        console.warn("[EduKids][system-settings] Realtime listener failed:", error);
        currentSettings = { ...DEFAULT_SETTINGS };

        if (typeof onChange === "function") {
          onChange(currentSettings);
        }

        if (readyResolve) {
          readyResolve(currentSettings);
          readyResolve = null;
        }
      },
    );

    return observer;
  }

  function getCurrentSystemSettings() {
    return currentSettings;
  }

  async function updateSystemSettings(updates = {}, updatedBy = "") {
    const ref = getSettingsRef();

    if (!ref) {
      throw new Error("Firestore is unavailable");
    }

    const current = currentSettings || (await fetchSystemSettings());
    const now = new Date().toISOString();
    const nextAiCoachEnabled =
      typeof updates.aiCoachEnabled === "boolean"
        ? updates.aiCoachEnabled
        : typeof updates.ai?.coachEnabled === "boolean"
          ? updates.ai.coachEnabled
          : current.aiCoachEnabled;
    const nextAiTopicLearningEnabled =
      typeof updates.aiTopicLearningEnabled === "boolean"
        ? updates.aiTopicLearningEnabled
        : typeof updates.aiLearningAnalysisEnabled === "boolean"
          ? updates.aiLearningAnalysisEnabled
        : typeof updates.ai?.learningAnalysisEnabled === "boolean"
          ? updates.ai.learningAnalysisEnabled
          : current.aiTopicLearningEnabled;
    const nextAiAssignmentEnabled =
      typeof updates.aiAssignmentEnabled === "boolean"
        ? updates.aiAssignmentEnabled
        : typeof updates.ai?.assignmentEnabled === "boolean"
          ? updates.ai.assignmentEnabled
          : current.aiAssignmentEnabled;
    const payload = normalizeSettings({
      ...current,
      ...updates,
      aiCoachEnabled: nextAiCoachEnabled,
      aiTopicLearningEnabled: nextAiTopicLearningEnabled,
      aiAssignmentEnabled: nextAiAssignmentEnabled,
      registration: {
        ...current.registration,
        ...(updates.registration || {}),
      },
      ai: {
        ...current.ai,
        ...(updates.ai || {}),
        coachEnabled: nextAiCoachEnabled,
        assignmentEnabled: nextAiAssignmentEnabled,
        learningAnalysisEnabled: nextAiTopicLearningEnabled,
      },
      maintenance: {
        ...current.maintenance,
        ...(updates.maintenance || {}),
      },
      systemInfo: {
        ...current.systemInfo,
        ...(updates.systemInfo || {}),
      },
      cacheRevision:
        Number.isFinite(Number(updates.cacheRevision)) ? Number(updates.cacheRevision) : current.cacheRevision,
      updatedAt: now,
      updatedBy: normalizeText(updatedBy || updates.updatedBy || current.updatedBy),
    });

    payload.systemInfo.firebaseProjectId =
      payload.systemInfo.firebaseProjectId ||
      normalizeText(
        window.firebase?.apps?.length && typeof window.firebase.app === "function"
          ? window.firebase.app().options?.projectId || ""
          : "",
      );

    await ref.set(payload, { merge: true });
    currentSettings = payload;
    return payload;
  }

  function getReadyPromise() {
    if (readyPromise) {
      return readyPromise;
    }

    readyPromise = Promise.resolve(currentSettings);
    return readyPromise;
  }

  window.EduKidsSystemSettingsService = {
    DEFAULT_SETTINGS,
    fetchSystemSettings,
    getCurrentSystemSettings,
    getReadyPromise,
    observeSystemSettings,
    updateSystemSettings,
  };
})();
