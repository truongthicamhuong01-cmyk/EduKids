const fs = require("fs");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");
const { db } = require("../firebase");
const ApiError = require("../utils/apiError");
const { buildQuizPrompt } = require("./aiPrompt");
const { readSystemSettings } = require("./systemSettingsService");

const TOPICS_PATH = path.join(__dirname, "..", "topics.json");
const QUIZZES_COLLECTION = db.collection("quizzes");

let topicsCache = null;
let topicsCacheMtime = 0;

function readTopicsFile() {
  if (!fs.existsSync(TOPICS_PATH)) {
    throw new ApiError(500, "topics.json is missing");
  }

  const stat = fs.statSync(TOPICS_PATH);

  if (topicsCache && topicsCacheMtime === stat.mtimeMs) {
    return topicsCache;
  }

  const raw = fs.readFileSync(TOPICS_PATH, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new ApiError(500, "topics.json must contain an array");
  }

  topicsCache = parsed;
  topicsCacheMtime = stat.mtimeMs;

  return topicsCache;
}

function normalizeKeyPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[\/\\#?%\[\]]/g, "-")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

function buildQuizDocId(grade, subject, topicId) {
  const parts = [grade, subject, topicId].map(normalizeKeyPart).filter(Boolean);

  if (parts.length !== 3) {
    throw new ApiError(400, "grade, subject, and topicId are required");
  }

  return parts.join("_");
}

function findTopicById(topicId) {
  const topics = readTopicsFile();
  return topics.find((topic) => String(topic.topicId || "").trim() === String(topicId || "").trim()) || null;
}

function extractJsonText(text) {
  if (!text || typeof text !== "string") {
    return "";
  }

  const trimmed = text.trim();

  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  }

  return trimmed;
}

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
}

function getGeminiClient() {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new ApiError(500, "Missing GEMINI_API_KEY environment variable");
  }

  return new GoogleGenAI({ apiKey });
}

function safeJsonParse(text) {
  const cleanText = extractJsonText(text);

  if (!cleanText) {
    throw new ApiError(502, "Gemini returned empty content");
  }

  try {
    return JSON.parse(cleanText);
  } catch (error) {
    const firstBrace = cleanText.indexOf("{");
    const lastBrace = cleanText.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const sliced = cleanText.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(sliced);
      } catch (nestedError) {
        throw new ApiError(502, "Gemini did not return valid JSON");
      }
    }

    throw new ApiError(502, "Gemini did not return valid JSON");
  }
}

async function generateJsonFromPrompt({
  prompt,
  model = "gemini-2.5-flash",
  config = {},
}) {
  const client = getGeminiClient();
  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      ...config,
    },
  });

  return typeof response.text === "string"
    ? response.text
    : response.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("") || "";
}

function validateQuizPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError(502, "Quiz payload must be an object");
  }

  const questions = payload.questions;

  if (!Array.isArray(questions) || questions.length !== 10) {
    throw new ApiError(502, "Quiz must contain exactly 10 questions");
  }

  questions.forEach((question, questionIndex) => {
    if (!question || typeof question !== "object") {
      throw new ApiError(502, `Question ${questionIndex + 1} is invalid`);
    }

    if (typeof question.question !== "string" || !question.question.trim()) {
      throw new ApiError(502, `Question ${questionIndex + 1} must have question text`);
    }

    if (!Array.isArray(question.options) || question.options.length !== 4) {
      throw new ApiError(502, `Question ${questionIndex + 1} must have exactly 4 options`);
    }

    const labels = new Set();
    let correctCount = 0;

    question.options.forEach((option, optionIndex) => {
      if (!option || typeof option !== "object") {
        throw new ApiError(502, `Question ${questionIndex + 1} option ${optionIndex + 1} is invalid`);
      }

      const label = String(option.label || "").trim().toUpperCase();
      const text = String(option.text || "").trim();
      const correct = Boolean(option.correct);

      if (!["A", "B", "C", "D"].includes(label)) {
        throw new ApiError(502, `Question ${questionIndex + 1} option label must be A, B, C, or D`);
      }

      if (labels.has(label)) {
        throw new ApiError(502, `Question ${questionIndex + 1} has duplicate option labels`);
      }

      if (!text) {
        throw new ApiError(502, `Question ${questionIndex + 1} option ${label} must have text`);
      }

      labels.add(label);

      if (correct) {
        correctCount += 1;
      }

      option.label = label;
      option.text = text;
      option.correct = correct;
    });

    if (correctCount !== 1) {
      throw new ApiError(502, `Question ${questionIndex + 1} must have exactly one correct answer`);
    }
  });

  return {
    grade: String(payload.grade || "").trim(),
    subject: String(payload.subject || "").trim(),
    topicId: String(payload.topicId || "").trim(),
    topicName: String(payload.topicName || "").trim(),
    questions,
  };
}

async function generateQuiz({ grade, subject, topicId }) {
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

  if (topic.subject && String(topic.subject).trim().toLowerCase() !== normalizedSubject.toLowerCase()) {
    throw new ApiError(400, "topicId does not belong to the requested subject");
  }

  const prompt = buildQuizPrompt({
    grade: normalizedGrade,
    subject: normalizedSubject,
    topic: {
      ...topic,
      topicId: String(topic.topicId || topicId).trim(),
    },
  });

  const rawText = await generateJsonFromPrompt({ prompt });

  const parsed = safeJsonParse(rawText);
  const quizPayload = validateQuizPayload(parsed);
  const quizDocId = buildQuizDocId(normalizedGrade, normalizedSubject, topic.topicId);
  const now = new Date().toISOString();

  const quizData = {
    id: quizDocId,
    grade: normalizedGrade,
    subject: normalizedSubject,
    topicId: String(topic.topicId).trim(),
    topicName: topic.title || topic.name || quizPayload.topicName || "",
    topicDescription: topic.description || "",
    questions: quizPayload.questions,
    source: "gemini-2.5-flash",
    createdAt: now,
    updatedAt: now,
  };

  await QUIZZES_COLLECTION.doc(quizDocId).set(quizData, { merge: true });

  return quizData;
}

module.exports = {
  generateQuiz,
  readTopicsFile,
  findTopicById,
  buildQuizDocId,
  safeJsonParse,
  validateQuizPayload,
  extractJsonText,
  getGeminiApiKey,
  getGeminiClient,
  generateJsonFromPrompt,
};
