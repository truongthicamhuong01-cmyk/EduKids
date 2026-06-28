const ApiError = require("../utils/apiError");
const { buildQuizPrompt } = require("./aiPrompt");
const {
  findTopicById,
  safeJsonParse,
  validateQuizPayload,
  generateJsonFromPrompt,
} = require("./aiService");
const {
  listQuizVersions,
  getNextVersionNumber,
  seedLegacyVersionIfNeeded,
  createQuizVersion,
  getVersionedQuizMeta,
} = require("./quizVersionService");
const { readSystemSettings } = require("./systemSettingsService");

function normalizeSubjectToken(subject) {
  return String(subject || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function generateQuizPayload({ grade, subject, topic, versionId, versionNumber }) {
  const prompt = buildQuizPrompt({
    grade,
    subject,
    topic,
    versionId,
    versionNumber,
  });

  const rawText = await generateJsonFromPrompt({ prompt });

  const parsed = safeJsonParse(rawText);
  return validateQuizPayload(parsed);
}

async function ensureNextQuizVersion({ grade, subject, topicId, minVersions = 3 }) {
  const systemSettings = await readSystemSettings();

  if (
    systemSettings?.aiTopicLearningEnabled === false ||
    systemSettings?.ai?.learningAnalysisEnabled === false
  ) {
    throw new ApiError(403, "AI topic learning is disabled");
  }

  const topic = findTopicById(topicId);

  if (!topic) {
    throw new ApiError(404, "topicId not found in topics.json");
  }

  const normalizedGrade = String(grade || "").trim();
  const normalizedSubject = String(subject || "").trim();

  if (topic.grade && String(topic.grade).trim() !== normalizedGrade) {
    throw new ApiError(400, "topicId does not belong to the requested grade");
  }

  if (
    topic.subject &&
    normalizeSubjectToken(topic.subject) !== normalizeSubjectToken(normalizedSubject)
  ) {
    throw new ApiError(400, "topicId does not belong to the requested subject");
  }

  const seededVersion = await seedLegacyVersionIfNeeded({
    grade: normalizedGrade,
    subject: normalizedSubject,
    topicId: topic.topicId,
  });

  if (seededVersion) {
    return seededVersion;
  }

  const meta = await getVersionedQuizMeta({
    grade: normalizedGrade,
    subject: normalizedSubject,
    topicId: topic.topicId,
  });

  if (meta.versionCount >= Number(minVersions) || meta.versionCount >= 3) {
    return {
      skipped: true,
      minVersionsReached: true,
      ...meta,
    };
  }

  const nextVersionNumber = getNextVersionNumber(meta.versions);
  const versionId = `v${nextVersionNumber}`;
  const quizPayload = await generateQuizPayload({
    grade: normalizedGrade,
    subject: normalizedSubject,
    topic: {
      ...topic,
      topicId: String(topic.topicId || topicId).trim(),
    },
    versionId,
    versionNumber: nextVersionNumber,
  });

  const version = await createQuizVersion({
    grade: normalizedGrade,
    subject: normalizedSubject,
    topicId: topic.topicId,
    versionNumber: nextVersionNumber,
    quizData: {
      grade: normalizedGrade,
      subject: normalizedSubject,
      topicId: String(topic.topicId).trim(),
      topicName: topic.title || topic.name || quizPayload.topicName || "",
      topicDescription: topic.description || "",
      questions: quizPayload.questions,
      source: "gemini-2.5-flash",
    },
  });

  return {
    generated: true,
    ...version,
  };
}

async function ensureQuizVersionsForTopic({ grade, subject, topicId, targetVersions = 3 }) {
  const normalizedTargetVersions = Number(targetVersions);
  const desiredVersions =
    Number.isInteger(normalizedTargetVersions) && normalizedTargetVersions > 0
      ? normalizedTargetVersions
      : 3;

  for (let attempt = 0; attempt < desiredVersions; attempt += 1) {
    const meta = await getVersionedQuizMeta({
      grade,
      subject,
      topicId,
    });

    if (meta.versionCount >= desiredVersions) {
      return meta;
    }

    await ensureNextQuizVersion({
      grade,
      subject,
      topicId,
      minVersions: desiredVersions,
    });
  }

  return getVersionedQuizMeta({
    grade,
    subject,
    topicId,
  });
}

module.exports = {
  ensureNextQuizVersion,
  ensureQuizVersionsForTopic,
};
