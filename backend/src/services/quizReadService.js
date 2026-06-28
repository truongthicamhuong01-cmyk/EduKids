const ApiError = require("../utils/apiError");
const { db } = require("../firebase");
const { readTopicsFile } = require("./aiService");
const {
  listQuizVersions,
  getLegacyQuizData,
  buildVersionQuizId,
  seedLegacyVersionIfNeeded,
} = require("./quizVersionService");
const { getUserTopicProgress } = require("./quizSelectionService");

function normalizeFilter(value) {
  return String(value || "").trim();
}

function normalizeProgressKeyPart(value) {
  return String(value || "").trim().toLowerCase();
}

function buildTopicProgressKey({ grade, subject, topicId }) {
  return [
    normalizeProgressKeyPart(grade),
    normalizeProgressKeyPart(subject),
    normalizeProgressKeyPart(topicId),
  ]
    .filter(Boolean)
    .join(":");
}

function normalizeTopicRecord(topic) {
  return {
    topicId: String(topic.topicId || "").trim(),
    grade: String(topic.grade || "").trim(),
    subject: String(topic.subject || "").trim(),
    name: String(topic.title || topic.name || "").trim(),
    title: String(topic.title || topic.name || "").trim(),
    image: String(topic.image || "").trim(),
    description: String(topic.description || "").trim(),
  };
}

function buildTopicMetaMap() {
  const topicMetaMap = new Map();

  readTopicsFile().map(normalizeTopicRecord).forEach((topic) => {
    if (topic.topicId) {
      topicMetaMap.set(topic.topicId, topic);
    }
  });

  return topicMetaMap;
}

async function listTopics({ grade, subject, userId } = {}) {
  const topics = readTopicsFile().map(normalizeTopicRecord);
  const normalizedGrade = normalizeFilter(grade);
  const normalizedSubject = normalizeFilter(subject).toLowerCase();
  const normalizedUserId = normalizeFilter(userId);
  const useAggregateProgress = !normalizedUserId && Boolean(db?.collectionGroup);
  const aggregateProgressMap = useAggregateProgress
    ? await loadAggregateTopicProgressMap()
    : new Map();

  const filteredTopics = topics.filter((topic) => {
    if (normalizedGrade && topic.grade !== normalizedGrade) {
      return false;
    }

    if (normalizedSubject && topic.subject.toLowerCase() !== normalizedSubject) {
      return false;
    }

    return true;
  });

  const topicsWithAvailability = await Promise.all(
    filteredTopics.map(async (topic) => {
      const versions = await listQuizVersions({
        grade: topic.grade,
        subject: topic.subject,
        topicId: topic.topicId,
      });

      const legacyQuiz = versions.length === 0 ? await getLegacyQuizData(topic) : null;
      const progress = normalizedUserId
        ? await getUserTopicProgress(normalizedUserId, topic.topicId).catch(() => null)
        : aggregateProgressMap.get(buildTopicProgressKey(topic)) || null;
      const totalAnswered = Math.max(0, Number(progress?.totalAnswered) || 0);
      const totalCorrect = Math.max(0, Number(progress?.totalCorrect) || 0);
      const percentage =
        totalAnswered > 0
          ? Math.round((totalCorrect / totalAnswered) * 100)
          : Math.max(0, Math.min(100, Number(progress?.percentage) || 0));

      return {
        ...topic,
        topicName: topic.name,
        quizId:
          versions.length > 0
            ? buildVersionQuizId({
                grade: topic.grade,
                subject: topic.subject,
                topicId: topic.topicId,
                versionId: versions[versions.length - 1].versionId,
              })
            : legacyQuiz
              ? buildVersionQuizId({
                  grade: topic.grade,
                  subject: topic.subject,
                  topicId: topic.topicId,
                  versionId: "v1",
                })
              : "",
        hasQuiz: versions.length > 0 || Boolean(legacyQuiz),
        versionCount: versions.length || (legacyQuiz ? 1 : 0),
        totalAnswered,
        totalCorrect,
        percentage,
        hasProgressData: totalAnswered > 0,
      };
    })
  );

  return topicsWithAvailability;
}

async function loadAggregateTopicProgressMap() {
  if (!db?.collectionGroup) {
    return new Map();
  }

  try {
    const snapshot = await db.collectionGroup("topics").get();
    const progressBuckets = new Map();
    const topicMetaMap = buildTopicMetaMap();

    snapshot.docs.forEach((doc) => {
      const data = doc.data() || {};
      const topicId = normalizeFilter(data.topicId || doc.id);
      const topicMeta = topicMetaMap.get(topicId) || {};
      const grade = normalizeFilter(data.grade || topicMeta.grade);
      const subject = normalizeFilter(data.subject || topicMeta.subject).toLowerCase();
      const key = buildTopicProgressKey({ grade, subject, topicId });
      const totalAnswered = Math.max(0, Number(data.totalAnswered) || 0);
      const totalCorrect = Math.max(0, Number(data.totalCorrect) || 0);
      const percentage = Number.isFinite(Number(data.percentage))
        ? Math.max(0, Math.min(100, Math.round(Number(data.percentage))))
        : totalAnswered > 0
          ? Math.round((totalCorrect / totalAnswered) * 100)
          : 0;

      if (!key) {
        return;
      }

      const bucket = progressBuckets.get(key) || {
        totalAnswered: 0,
        totalCorrect: 0,
        percentage: 0,
      };

      bucket.totalAnswered += totalAnswered;
      bucket.totalCorrect += totalCorrect;
      bucket.percentage =
        bucket.totalAnswered > 0
          ? Math.round((bucket.totalCorrect / bucket.totalAnswered) * 100)
          : Math.max(bucket.percentage, percentage);

      progressBuckets.set(key, bucket);
    });

    return progressBuckets;
  } catch (error) {
    console.warn("[EduKids][quizReadService] Unable to load aggregate topic progress:", error);
    return new Map();
  }
}

async function getQuizByTopic({ grade, subject, topicId }) {
  const normalizedGrade = normalizeFilter(grade);
  const normalizedSubject = normalizeFilter(subject);
  const normalizedTopicId = normalizeFilter(topicId);

  if (!normalizedGrade || !normalizedSubject || !normalizedTopicId) {
    throw new ApiError(400, "grade, subject, and topicId are required");
  }

  const versions = await listQuizVersions({
    grade: normalizedGrade,
    subject: normalizedSubject,
    topicId: normalizedTopicId,
  });

  if (versions.length > 0) {
    const selectedVersion = versions[versions.length - 1];
    const versionData = selectedVersion.data || {};

    return {
      ...versionData,
      id: buildVersionQuizId({
        grade: normalizedGrade,
        subject: normalizedSubject,
        topicId: normalizedTopicId,
        versionId: selectedVersion.versionId,
      }),
      quizId: buildVersionQuizId({
        grade: normalizedGrade,
        subject: normalizedSubject,
        topicId: normalizedTopicId,
        versionId: selectedVersion.versionId,
      }),
      versionId: selectedVersion.versionId,
      versionNumber: selectedVersion.versionNumber,
      availableVersions: versions.map((version) => version.versionId),
    };
  }

  const legacyQuiz = await getLegacyQuizData({
    grade: normalizedGrade,
    subject: normalizedSubject,
    topicId: normalizedTopicId,
  });

  if (!legacyQuiz) {
    throw new ApiError(404, "Quiz not found for this topic");
  }

  await seedLegacyVersionIfNeeded({
    grade: normalizedGrade,
    subject: normalizedSubject,
    topicId: normalizedTopicId,
  });

  const seededVersions = await listQuizVersions({
    grade: normalizedGrade,
    subject: normalizedSubject,
    topicId: normalizedTopicId,
  });

  const selectedVersion = seededVersions[0];
  const versionData = selectedVersion?.data || legacyQuiz;

  return {
    ...versionData,
    id: buildVersionQuizId({
      grade: normalizedGrade,
      subject: normalizedSubject,
      topicId: normalizedTopicId,
      versionId: selectedVersion?.versionId || "v1",
    }),
    quizId: buildVersionQuizId({
      grade: normalizedGrade,
      subject: normalizedSubject,
      topicId: normalizedTopicId,
      versionId: selectedVersion?.versionId || "v1",
    }),
    versionId: selectedVersion?.versionId || "v1",
    versionNumber: selectedVersion?.versionNumber || 1,
    availableVersions: seededVersions.map((version) => version.versionId || "v1"),
  };
}

module.exports = {
  listTopics,
  getQuizByTopic,
};
