const ApiError = require("../utils/apiError");
const { GoogleGenAI } = require("@google/genai");
const { buildQuizPrompt, findTopicById, safeJsonParse, validateQuizPayload } = require("./aiService");
const {
  listQuizVersions,
  getNextVersionNumber,
  seedLegacyVersionIfNeeded,
  createQuizVersion,
  getVersionedQuizMeta,
} = require("./quizVersionService");

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new ApiError(500, "Missing GEMINI_API_KEY environment variable");
  }

  return new GoogleGenAI({ apiKey });
}

async function generateQuizPayload({ grade, subject, topic, versionId, versionNumber }) {
  const prompt = buildQuizPrompt({
    grade,
    subject,
    topic,
    versionId,
    versionNumber,
  });

  const client = getGeminiClient();
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const rawText =
    typeof response.text === "string"
      ? response.text
      : response.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || "")
          .join("") || "";

  const parsed = safeJsonParse(rawText);
  return validateQuizPayload(parsed);
}

async function ensureNextQuizVersion({ grade, subject, topicId, minVersions = 3 }) {
  const topic = findTopicById(topicId);

  if (!topic) {
    throw new ApiError(404, "topicId not found in topics.json");
  }

  const normalizedGrade = String(grade || "").trim();
  const normalizedSubject = String(subject || "").trim();

  if (topic.grade && String(topic.grade).trim() !== normalizedGrade) {
    throw new ApiError(400, "topicId does not belong to the requested grade");
  }

  if (topic.subject && String(topic.subject).trim().toLowerCase() !== normalizedSubject.toLowerCase()) {
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

module.exports = {
  ensureNextQuizVersion,
};
