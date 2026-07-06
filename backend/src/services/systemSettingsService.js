const { db } = require("../firebase");

const SETTINGS_COLLECTION = db.collection("systemSettings");
const SETTINGS_DOC_ID = "config";
const LEGACY_AI_COLLECTION = db.collection("system_settings");
const LEGACY_AI_DOC_ID = "ai";
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
    version: "1.0.0",
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "",
    updatedAt: "",
  },
  cacheRevision: 0,
  updatedAt: "",
  updatedBy: "",
};

function normalizeBoolean(value, fallback = true) {
  return typeof value === "boolean" ? value : Boolean(fallback);
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeSettings(data = {}, fallback = DEFAULT_SETTINGS) {
  const source = data && typeof data === "object" ? data : {};
  const fallbackSettings =
    fallback && typeof fallback === "object" ? fallback : DEFAULT_SETTINGS;
  const aiCoachEnabled = normalizeBoolean(
    source.aiCoachEnabled,
    source.ai?.coachEnabled ??
      source.aiCoachEnabled ??
      fallbackSettings.aiCoachEnabled,
  );
  const aiTopicLearningEnabled = normalizeBoolean(
    source.aiTopicLearningEnabled,
    source.ai?.learningAnalysisEnabled ??
      source.aiLearningAnalysisEnabled ??
      source.aiTopicLearningEnabled ??
      fallbackSettings.aiTopicLearningEnabled,
  );
  const aiAssignmentEnabled = normalizeBoolean(
    source.aiAssignmentEnabled,
    source.ai?.assignmentEnabled ??
      source.aiAssignmentEnabled ??
      fallbackSettings.aiAssignmentEnabled,
  );

  return {
    registration: {
      studentEnabled: normalizeBoolean(
        source.registration?.studentEnabled,
        fallbackSettings.registration.studentEnabled,
      ),
      teacherEnabled: normalizeBoolean(
        source.registration?.teacherEnabled,
        fallbackSettings.registration.teacherEnabled,
      ),
    },
    ai: {
      coachEnabled: aiCoachEnabled,
      assignmentEnabled: aiAssignmentEnabled,
      learningAnalysisEnabled: aiTopicLearningEnabled,
    },
    aiCoachEnabled,
    aiTopicLearningEnabled,
    aiAssignmentEnabled,
    maintenance: {
      enabled: normalizeBoolean(
        source.maintenance?.enabled,
        fallbackSettings.maintenance.enabled,
      ),
      message: normalizeText(
        source.maintenance?.message ||
          source.maintenanceMessage ||
          fallbackSettings.maintenance.message,
      ),
    },
    systemInfo: {
      version:
        normalizeText(
          source.systemInfo?.version ||
            source.version ||
            fallbackSettings.systemInfo.version,
        ) || fallbackSettings.systemInfo.version,
      firebaseProjectId: normalizeText(
        source.systemInfo?.firebaseProjectId ||
          source.firebaseProjectId ||
          fallbackSettings.systemInfo.firebaseProjectId,
      ),
      updatedAt: normalizeText(
        source.systemInfo?.updatedAt ||
          source.updatedAt ||
          fallbackSettings.systemInfo.updatedAt,
      ),
    },
    cacheRevision:
      Number(source.cacheRevision ?? fallbackSettings.cacheRevision) || 0,
    updatedAt: normalizeText(source.updatedAt || fallbackSettings.updatedAt),
    updatedBy: normalizeText(source.updatedBy || fallbackSettings.updatedBy),
  };
}

async function readDocument(ref) {
  const snapshot = await ref.get();
  return snapshot.exists ? snapshot.data() || {} : null;
}

async function readSystemSettings() {
  const currentDoc = await readDocument(
    SETTINGS_COLLECTION.doc(SETTINGS_DOC_ID),
  ).catch(() => null);
  const legacyAiDoc = await readDocument(
    LEGACY_AI_COLLECTION.doc(LEGACY_AI_DOC_ID),
  ).catch(() => null);

  const merged = {
    ...DEFAULT_SETTINGS,
    ...(legacyAiDoc
      ? {
          aiCoachEnabled: legacyAiDoc.aiCoachEnabled !== false,
          aiTopicLearningEnabled:
            legacyAiDoc.aiTopicLearningEnabled !== false &&
            legacyAiDoc.aiLearningAnalysisEnabled !== false,
          aiAssignmentEnabled: legacyAiDoc.aiAssignmentEnabled !== false,
          ai: {
            ...DEFAULT_SETTINGS.ai,
            coachEnabled: legacyAiDoc.aiCoachEnabled !== false,
            assignmentEnabled: legacyAiDoc.aiAssignmentEnabled !== false,
            learningAnalysisEnabled:
              legacyAiDoc.aiTopicLearningEnabled !== false &&
              legacyAiDoc.aiLearningAnalysisEnabled !== false,
          },
          cacheRevision: Number(legacyAiDoc.cacheRevision) || 0,
          updatedAt: legacyAiDoc.updatedAt || "",
          updatedBy: legacyAiDoc.updatedBy || "",
        }
      : {}),
    ...(currentDoc || {}),
  };

  if (currentDoc?.aiCoachEnabled !== undefined) {
    merged.aiCoachEnabled = currentDoc.aiCoachEnabled !== false;
  }

  if (currentDoc?.aiTopicLearningEnabled !== undefined) {
    merged.aiTopicLearningEnabled = currentDoc.aiTopicLearningEnabled !== false;
  }

  if (currentDoc?.aiAssignmentEnabled !== undefined) {
    merged.aiAssignmentEnabled = currentDoc.aiAssignmentEnabled !== false;
  }

  merged.ai.coachEnabled = merged.aiCoachEnabled !== false;
  merged.ai.assignmentEnabled = merged.aiAssignmentEnabled !== false;
  merged.ai.learningAnalysisEnabled = merged.aiTopicLearningEnabled !== false;

  return normalizeSettings(merged);
}

async function updateSystemSettings(updates = {}, actor = "") {
  const current = await readSystemSettings();
  const now = new Date().toISOString();
  const payload = normalizeSettings(
    {
      ...current,
      ...updates,
      aiCoachEnabled:
        typeof updates.aiCoachEnabled === "boolean"
          ? updates.aiCoachEnabled
          : typeof updates.ai?.coachEnabled === "boolean"
            ? updates.ai.coachEnabled
            : current.aiCoachEnabled,
      aiTopicLearningEnabled:
        typeof updates.aiTopicLearningEnabled === "boolean"
          ? updates.aiTopicLearningEnabled
          : typeof updates.aiLearningAnalysisEnabled === "boolean"
            ? updates.aiLearningAnalysisEnabled
            : typeof updates.ai?.learningAnalysisEnabled === "boolean"
              ? updates.ai.learningAnalysisEnabled
              : current.aiTopicLearningEnabled,
      aiAssignmentEnabled:
        typeof updates.aiAssignmentEnabled === "boolean"
          ? updates.aiAssignmentEnabled
          : typeof updates.ai?.assignmentEnabled === "boolean"
            ? updates.ai.assignmentEnabled
            : current.aiAssignmentEnabled,
      registration: {
        ...current.registration,
        ...(updates.registration || {}),
      },
      ai: {
        ...current.ai,
        ...(updates.ai || {}),
        coachEnabled:
          typeof updates.aiCoachEnabled === "boolean"
            ? updates.aiCoachEnabled
            : typeof updates.ai?.coachEnabled === "boolean"
              ? updates.ai.coachEnabled
              : current.ai.coachEnabled,
        assignmentEnabled:
          typeof updates.aiAssignmentEnabled === "boolean"
            ? updates.aiAssignmentEnabled
            : typeof updates.ai?.assignmentEnabled === "boolean"
              ? updates.ai.assignmentEnabled
              : current.ai.assignmentEnabled,
        learningAnalysisEnabled:
          typeof updates.aiTopicLearningEnabled === "boolean"
            ? updates.aiTopicLearningEnabled
            : typeof updates.ai?.learningAnalysisEnabled === "boolean"
              ? updates.ai.learningAnalysisEnabled
              : current.ai.learningAnalysisEnabled,
      },
      maintenance: {
        ...current.maintenance,
        ...(updates.maintenance || {}),
      },
      systemInfo: {
        ...current.systemInfo,
        ...(updates.systemInfo || {}),
      },
      updatedAt: now,
      updatedBy: normalizeText(actor || updates.updatedBy || current.updatedBy),
    },
    current,
  );

  await SETTINGS_COLLECTION.doc(SETTINGS_DOC_ID).set(payload, { merge: true });

  return payload;
}

module.exports = {
  DEFAULT_SETTINGS,
  SETTINGS_COLLECTION,
  SETTINGS_DOC_ID,
  normalizeSettings,
  readSystemSettings,
  updateSystemSettings,
};
