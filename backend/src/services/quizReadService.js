const ApiError = require("../utils/apiError");
const { readTopicsFile } = require("./aiService");
const {
  listQuizVersions,
  getLegacyQuizData,
  buildVersionQuizId,
  seedLegacyVersionIfNeeded,
} = require("./quizVersionService");

function normalizeFilter(value) {
  return String(value || "").trim();
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

async function listTopics({ grade, subject } = {}) {
  const topics = readTopicsFile().map(normalizeTopicRecord);
  const normalizedGrade = normalizeFilter(grade);
  const normalizedSubject = normalizeFilter(subject).toLowerCase();

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

      return {
        ...topic,
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
      };
    })
  );

  return topicsWithAvailability;
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
