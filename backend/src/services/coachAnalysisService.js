const { GoogleGenAI } = require("@google/genai");
const { db } = require("../firebase");
const ApiError = require("../utils/apiError");
const { safeJsonParse, readTopicsFile } = require("./aiService");
const { buildCoachPrompt } = require("./coachPrompt");
const { readSystemSettings } = require("./systemSettingsService");

const USER_PROGRESS_COLLECTION = db.collection("user_progress");
const COACH_CACHE_COLLECTION = db.collection("coach_analysis_cache");
const COACH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeTopicRecord(topic) {
  return {
    topicId: normalizeText(topic?.topicId),
    topicName: normalizeText(topic?.title || topic?.name || topic?.topicName),
    title: normalizeText(topic?.title || topic?.name || topic?.topicName),
    description: normalizeText(topic?.description),
    grade: normalizeText(topic?.grade),
    subject: normalizeText(topic?.subject),
  };
}

function getTopicMap() {
  const topicMap = new Map();

  readTopicsFile().forEach((topic) => {
    const normalized = normalizeTopicRecord(topic);

    if (normalized.topicId) {
      topicMap.set(normalized.topicId, normalized);
    }
  });

  return topicMap;
}

function normalizeProgressItem(doc, topicMap) {
  const data = doc.data() || {};
  const topicId = normalizeText(data.topicId || doc.id);
  const totalAnswered = Math.max(0, Number(data.totalAnswered) || 0);
  const totalCorrect = Math.max(0, Number(data.totalCorrect) || 0);
  const percentageFromDoc = Number(data.percentage);
  const accuracy =
    Number.isFinite(percentageFromDoc)
      ? Math.max(0, Math.min(100, Math.round(percentageFromDoc)))
      : totalAnswered > 0
        ? Math.round((totalCorrect / totalAnswered) * 100)
        : 0;
  const topicMeta = topicMap.get(topicId) || {};

  return {
    topicId,
    topicName: normalizeText(
      data.topicName ||
        topicMeta.topicName ||
        topicMeta.title ||
        topicId,
    ),
    accuracy,
    totalAnswered,
    correctAnswers: totalCorrect,
    grade: normalizeText(topicMeta.grade || data.grade || ""),
    subject: normalizeText(topicMeta.subject || data.subject || ""),
    description: normalizeText(topicMeta.description || data.description || ""),
    updatedAt: normalizeText(
      data.updatedAt || data.accuracyUpdatedAt || data.createdAt || "",
    ),
  };
}

function sortTopicsByAccuracy(topics, direction = "desc") {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...topics].sort((left, right) => {
    const diff = (left.accuracy - right.accuracy) * multiplier;

    if (diff !== 0) {
      return diff;
    }

    return left.topicName.localeCompare(right.topicName);
  });
}

function buildCoachTopics(progressItems) {
  const validTopics = (Array.isArray(progressItems) ? progressItems : []).filter(
    (item) => item && item.totalAnswered > 0,
  );

  const rankedDesc = sortTopicsByAccuracy(validTopics, "desc");
  const rankedAsc = sortTopicsByAccuracy(validTopics, "asc");

  return {
    bestTopics: rankedDesc.slice(0, 2),
    weakTopics: rankedAsc.slice(0, 2),
  };
}

function calculateAverageAccuracy(progressItems) {
  const validItems = (Array.isArray(progressItems) ? progressItems : []).filter(
    (item) => item && item.totalAnswered > 0,
  );

  if (validItems.length === 0) {
    return 0;
  }

  const total = validItems.reduce((sum, item) => sum + (Number(item.accuracy) || 0), 0);
  return Math.max(0, Math.min(100, Math.round(total / validItems.length)));
}

function getCoachLevel(averageAccuracy) {
  const value = Math.max(0, Math.min(100, Number(averageAccuracy) || 0));

  if (value >= 90) {
    return "Xuất sắc";
  }

  if (value >= 75) {
    return "Tốt";
  }

  if (value >= 60) {
    return "Đang tiến bộ";
  }

  return "Cần luyện thêm";
}

function buildProgressSignature(progressItems) {
  return (Array.isArray(progressItems) ? progressItems : [])
    .map((item) =>
      [
        item.topicId || "",
        item.totalAnswered || 0,
        item.correctAnswers || 0,
        item.accuracy || 0,
        item.updatedAt || "",
      ].join(":"),
    )
    .sort()
    .join("|");
}

async function readAiSettings() {
  const settings = await readSystemSettings();

  return {
    aiCoachEnabled:
      settings.aiCoachEnabled !== undefined
        ? settings.aiCoachEnabled !== false
        : settings.ai.coachEnabled !== false,
    aiTopicLearningEnabled:
      settings.aiTopicLearningEnabled !== undefined
        ? settings.aiTopicLearningEnabled !== false
        : settings.ai.learningAnalysisEnabled !== false,
    cacheRevision: Number(settings.ai.cacheRevision || settings.cacheRevision || 0) || 0,
  };
}

async function loadStudentProgress(userId) {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    throw new ApiError(400, "userId is required");
  }

  const topicMap = getTopicMap();
  const progressSnapshot = await USER_PROGRESS_COLLECTION.doc(normalizedUserId)
    .collection("topics")
    .get();

  return progressSnapshot.docs
    .map((doc) => normalizeProgressItem(doc, topicMap))
    .filter((item) => item.totalAnswered > 0);
}

function extractResponseText(response) {
  if (typeof response?.text === "string") {
    return response.text;
  }

  return (
    response?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("") || ""
  );
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new ApiError(500, "Missing GEMINI_API_KEY environment variable");
  }

  return new GoogleGenAI({ apiKey });
}

function normalizeCoachAnalysisPayload(payload, fallbackFocusTopic) {
  const strengths = normalizeText(payload?.strengths || "");
  const weaknesses = normalizeText(payload?.weaknesses || "");
  const advice = normalizeText(payload?.advice || "");

  return {
    strengths,
    weaknesses,
    advice,
    focusTopic: fallbackFocusTopic.topicName,
    focusTopicId: fallbackFocusTopic.topicId,
    focusTopicName: fallbackFocusTopic.topicName,
  };
}

async function readCoachCache(userId) {
  const snapshot = await COACH_CACHE_COLLECTION.doc(userId).get();

  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() || null;
}

function isFreshCoachCache(cacheDoc, signature, cacheRevision = 0) {
  if (!cacheDoc) {
    return false;
  }

  if (String(cacheDoc.signature || "") !== signature) {
    return false;
  }

  if (Number(cacheDoc.cacheRevision || 0) !== Number(cacheRevision || 0)) {
    return false;
  }

  const cachedAt = Date.parse(cacheDoc.cachedAt || "");

  if (!Number.isFinite(cachedAt)) {
    return false;
  }

  return Date.now() - cachedAt < COACH_CACHE_TTL_MS;
}

async function saveCoachCache(userId, payload, cacheRevision = 0) {
  const now = new Date().toISOString();

  await COACH_CACHE_COLLECTION.doc(userId).set(
    {
      userId,
      cacheRevision: Number(cacheRevision) || 0,
      ...payload,
      cachedAt: now,
      updatedAt: now,
    },
    { merge: true },
  );
}

async function analyzeStudentProgress(userId) {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    throw new ApiError(400, "userId is required");
  }

  const aiSettings = await readAiSettings();

  if (aiSettings.aiCoachEnabled === false) {
    throw new ApiError(403, "AI Coach is disabled");
  }

  const progressItems = await loadStudentProgress(normalizedUserId);

  if (progressItems.length === 0) {
    throw new ApiError(404, "Bạn cần làm bài trước khi AI Coach có thể phân tích.");
  }

  const signature = buildProgressSignature(progressItems);
  const cacheDoc = await readCoachCache(normalizedUserId);

  const cacheRevision = Number(aiSettings.cacheRevision) || 0;

  if (isFreshCoachCache(cacheDoc, signature, cacheRevision)) {
    return {
      ...cacheDoc.analysis,
      averageAccuracy: Number(cacheDoc.averageAccuracy) || 0,
      coachLevel: normalizeText(cacheDoc.coachLevel || ""),
      bestTopics: Array.isArray(cacheDoc.bestTopics) ? cacheDoc.bestTopics : [],
      weakTopics: Array.isArray(cacheDoc.weakTopics) ? cacheDoc.weakTopics : [],
      fromCache: true,
    };
  }

  const { bestTopics, weakTopics } = buildCoachTopics(progressItems);

  if (weakTopics.length === 0) {
    throw new ApiError(404, "Bạn cần làm bài trước khi AI Coach có thể phân tích.");
  }

  const focusTopic = weakTopics[0];
  const averageAccuracy = calculateAverageAccuracy(progressItems);
  const coachLevel = getCoachLevel(averageAccuracy);

  const prompt = buildCoachPrompt({
    bestTopics,
    weakTopics,
  });

  const client = getGeminiClient();
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const rawText = extractResponseText(response);
  const parsed = safeJsonParse(rawText);
  const analysis = normalizeCoachAnalysisPayload(parsed, focusTopic);
  const payload = {
    analysis,
    averageAccuracy,
    coachLevel,
    bestTopics,
    weakTopics,
    focusTopicId: focusTopic.topicId,
    focusTopicName: focusTopic.topicName,
    signature,
  };

  await saveCoachCache(normalizedUserId, payload, cacheRevision);

  return {
    ...analysis,
    averageAccuracy,
    coachLevel,
    bestTopics,
    weakTopics,
    focusTopicId: focusTopic.topicId,
    focusTopicName: focusTopic.topicName,
    fromCache: false,
  };
}

module.exports = {
  analyzeStudentProgress,
  buildCoachTopics,
  loadStudentProgress,
  calculateAverageAccuracy,
  getCoachLevel,
  buildProgressSignature,
  readAiSettings,
};
