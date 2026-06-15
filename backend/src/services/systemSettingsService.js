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
  const fallbackSettings = fallback && typeof fallback === "object" ? fallback : DEFAULT_SETTINGS;

  return {
    registration: {
      studentEnabled:
        normalizeBoolean(source.registration?.studentEnabled, fallbackSettings.registration.studentEnabled),
      teacherEnabled:
        normalizeBoolean(source.registration?.teacherEnabled, fallbackSettings.registration.teacherEnabled),
    },
    ai: {
      coachEnabled:
        normalizeBoolean(source.ai?.coachEnabled, source.aiCoachEnabled ?? fallbackSettings.ai.coachEnabled),
      assignmentEnabled:
        normalizeBoolean(
          source.ai?.assignmentEnabled,
          source.aiAssignmentEnabled ?? fallbackSettings.ai.assignmentEnabled,
        ),
      learningAnalysisEnabled:
        normalizeBoolean(
          source.ai?.learningAnalysisEnabled,
          source.aiLearningAnalysisEnabled ?? fallbackSettings.ai.learningAnalysisEnabled,
        ),
    },
    maintenance: {
      enabled:
        normalizeBoolean(source.maintenance?.enabled, fallbackSettings.maintenance.enabled),
      message: normalizeText(
        source.maintenance?.message ||
          source.maintenanceMessage ||
          fallbackSettings.maintenance.message,
      ),
    },
    systemInfo: {
      version: normalizeText(
        source.systemInfo?.version || source.version || fallbackSettings.systemInfo.version,
      ) || fallbackSettings.systemInfo.version,
      firebaseProjectId: normalizeText(
        source.systemInfo?.firebaseProjectId ||
          source.firebaseProjectId ||
          fallbackSettings.systemInfo.firebaseProjectId,
      ),
      updatedAt: normalizeText(
        source.systemInfo?.updatedAt || source.updatedAt || fallbackSettings.systemInfo.updatedAt,
      ),
    },
    cacheRevision: Number(source.cacheRevision ?? fallbackSettings.cacheRevision) || 0,
    updatedAt: normalizeText(source.updatedAt || fallbackSettings.updatedAt),
    updatedBy: normalizeText(source.updatedBy || fallbackSettings.updatedBy),
  };
}

async function readDocument(ref) {
  const snapshot = await ref.get();
  return snapshot.exists ? snapshot.data() || {} : null;
}

async function readSystemSettings() {
  const currentDoc = await readDocument(SETTINGS_COLLECTION.doc(SETTINGS_DOC_ID)).catch(() => null);
  const legacyAiDoc = await readDocument(LEGACY_AI_COLLECTION.doc(LEGACY_AI_DOC_ID)).catch(() => null);

  const merged = {
    ...DEFAULT_SETTINGS,
    ...(legacyAiDoc
      ? {
          ai: {
            ...DEFAULT_SETTINGS.ai,
            coachEnabled: legacyAiDoc.aiCoachEnabled !== false,
          },
          cacheRevision: Number(legacyAiDoc.cacheRevision) || 0,
          updatedAt: legacyAiDoc.updatedAt || "",
          updatedBy: legacyAiDoc.updatedBy || "",
        }
      : {}),
    ...(currentDoc || {}),
  };

  if (currentDoc?.aiCoachEnabled !== undefined) {
    merged.ai.coachEnabled = currentDoc.aiCoachEnabled !== false;
  }

  return normalizeSettings(merged);
}

async function updateSystemSettings(updates = {}, actor = "") {
  const current = await readSystemSettings();
  const now = new Date().toISOString();
  const payload = normalizeSettings(
    {
      ...current,
      ...updates,
      registration: {
        ...current.registration,
        ...(updates.registration || {}),
      },
      ai: {
        ...current.ai,
        ...(updates.ai || {}),
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
