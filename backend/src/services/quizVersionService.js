const { db } = require("../firebase");
const ApiError = require("../utils/apiError");
const { buildQuizDocId } = require("./aiService");

const QUIZZES_COLLECTION = db.collection("quizzes");

function normalizePart(value) {
  return String(value || "").trim();
}

function getQuizTopicDocRef({ grade, subject, topicId }) {
  const quizDocId = buildQuizDocId(grade, subject, topicId);
  return QUIZZES_COLLECTION.doc(quizDocId);
}

function getQuizTopicDocRefByParentId(parentId) {
  return QUIZZES_COLLECTION.doc(normalizePart(parentId));
}

function getQuizVersionsCollectionRef({ grade, subject, topicId }) {
  return getQuizTopicDocRef({ grade, subject, topicId }).collection("versions");
}

function getQuizVersionDocRefByParentId(parentId, versionId) {
  return getQuizTopicDocRefByParentId(parentId).collection("versions").doc(normalizePart(versionId));
}

function buildVersionId(versionNumber) {
  const parsed = Number(versionNumber);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ApiError(400, "versionNumber must be a positive integer");
  }

  return `v${parsed}`;
}

function parseVersionNumber(versionId) {
  const match = String(versionId || "").trim().match(/^v(\d+)$/i);

  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildVersionQuizId({ grade, subject, topicId, versionId }) {
  const parentId = buildQuizDocId(grade, subject, topicId);
  const normalizedVersionId = normalizePart(versionId);

  if (!normalizedVersionId) {
    throw new ApiError(400, "versionId is required");
  }

  return `${parentId}::${normalizedVersionId}`;
}

function parseVersionQuizId(quizId) {
  const normalizedQuizId = normalizePart(quizId);
  const separatorIndex = normalizedQuizId.lastIndexOf("::");

  if (separatorIndex < 0) {
    return null;
  }

  const parentId = normalizedQuizId.slice(0, separatorIndex);
  const versionId = normalizedQuizId.slice(separatorIndex + 2);

  if (!parentId || !versionId) {
    return null;
  }

  return {
    parentId,
    versionId,
  };
}

function normalizeVersionDoc(doc) {
  if (!doc || !doc.exists) {
    return null;
  }

  const data = doc.data() || {};

  return {
    versionId: doc.id,
    versionNumber: parseVersionNumber(doc.id) || Number(data.versionNumber) || null,
    createdAt: data.createdAt || "",
    updatedAt: data.updatedAt || data.createdAt || "",
    data: data.data || data.quizData || null,
    ...data,
  };
}

async function listQuizVersions({ grade, subject, topicId }) {
  const snapshot = await getQuizVersionsCollectionRef({ grade, subject, topicId }).get();
  const versions = snapshot.docs.map((doc) => normalizeVersionDoc(doc)).filter(Boolean);

  return versions.sort((a, b) => {
    const aNumber = Number(a.versionNumber || 0);
    const bNumber = Number(b.versionNumber || 0);

    return aNumber - bNumber;
  });
}

function getNextVersionNumber(existingVersions) {
  const existingNumbers = new Set(
    (Array.isArray(existingVersions) ? existingVersions : [])
      .map((version) => Number(version.versionNumber))
      .filter((value) => Number.isInteger(value) && value > 0)
  );

  for (let versionNumber = 1; versionNumber < 1000; versionNumber += 1) {
    if (!existingNumbers.has(versionNumber)) {
      return versionNumber;
    }
  }

  throw new ApiError(500, "Unable to determine next version number");
}

async function getLegacyQuizData({ grade, subject, topicId }) {
  const rootSnapshot = await getQuizTopicDocRef({ grade, subject, topicId }).get();

  if (!rootSnapshot.exists) {
    return null;
  }

  const data = rootSnapshot.data() || {};

  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    return null;
  }

  return {
    id: rootSnapshot.id,
    ...data,
  };
}

async function seedLegacyVersionIfNeeded({ grade, subject, topicId }) {
  const versions = await listQuizVersions({ grade, subject, topicId });

  if (versions.length > 0) {
    return null;
  }

  const legacyQuiz = await getLegacyQuizData({ grade, subject, topicId });

  if (!legacyQuiz) {
    return null;
  }

  const versionId = buildVersionId(1);
  const now = new Date().toISOString();
  const versionRef = getQuizVersionsCollectionRef({ grade, subject, topicId }).doc(versionId);

  const quizData = {
    ...legacyQuiz,
    id: buildVersionQuizId({ grade, subject, topicId, versionId }),
    versionId,
    versionNumber: 1,
    source: legacyQuiz.source || "legacy",
    createdAt: legacyQuiz.createdAt || now,
    updatedAt: now,
  };

  await versionRef.set(
    {
      versionId,
      versionNumber: 1,
      data: quizData,
      createdAt: quizData.createdAt,
      updatedAt: now,
    },
    { merge: false }
  );

  await getQuizTopicDocRef({ grade, subject, topicId }).set(
    {
      grade: normalizePart(grade),
      subject: normalizePart(subject),
      topicId: normalizePart(topicId),
      latestVersionId: versionId,
      versionCount: 1,
      hasVersions: true,
      updatedAt: now,
    },
    { merge: true }
  );

  return {
    versionId,
    versionNumber: 1,
    data: quizData,
  };
}

async function createQuizVersion({ grade, subject, topicId, versionNumber, quizData }) {
  const normalizedGrade = normalizePart(grade);
  const normalizedSubject = normalizePart(subject);
  const normalizedTopicId = normalizePart(topicId);
  const normalizedVersionNumber = Number(versionNumber);

  if (!normalizedGrade || !normalizedSubject || !normalizedTopicId) {
    throw new ApiError(400, "grade, subject, and topicId are required");
  }

  if (!Number.isInteger(normalizedVersionNumber) || normalizedVersionNumber <= 0) {
    throw new ApiError(400, "versionNumber must be a positive integer");
  }

  const versionId = buildVersionId(normalizedVersionNumber);
  const now = new Date().toISOString();
  const versionRef = getQuizVersionsCollectionRef({
    grade: normalizedGrade,
    subject: normalizedSubject,
    topicId: normalizedTopicId,
  }).doc(versionId);
  const rootRef = getQuizTopicDocRef({
    grade: normalizedGrade,
    subject: normalizedSubject,
    topicId: normalizedTopicId,
  });

  const versionSnapshot = await versionRef.get();

  if (versionSnapshot.exists) {
    return normalizeVersionDoc(versionSnapshot);
  }

  const storedQuizData = {
    ...quizData,
    id: buildVersionQuizId({
      grade: normalizedGrade,
      subject: normalizedSubject,
      topicId: normalizedTopicId,
      versionId,
    }),
    versionId,
    versionNumber: normalizedVersionNumber,
    grade: normalizedGrade,
    subject: normalizedSubject,
    topicId: normalizedTopicId,
    updatedAt: now,
  };

  await versionRef.set(
    {
      versionId,
      versionNumber: normalizedVersionNumber,
      data: storedQuizData,
      createdAt: now,
      updatedAt: now,
    },
    { merge: false }
  );

  const existingVersions = await listQuizVersions({
    grade: normalizedGrade,
    subject: normalizedSubject,
    topicId: normalizedTopicId,
  });

  await rootRef.set(
    {
      grade: normalizedGrade,
      subject: normalizedSubject,
      topicId: normalizedTopicId,
      latestVersionId: versionId,
      versionCount: existingVersions.length,
      hasVersions: true,
      updatedAt: now,
    },
    { merge: true }
  );

  return {
    versionId,
    versionNumber: normalizedVersionNumber,
    createdAt: now,
    updatedAt: now,
    data: storedQuizData,
  };
}

async function getVersionedQuizMeta({ grade, subject, topicId }) {
  const rootSnapshot = await getQuizTopicDocRef({ grade, subject, topicId }).get();
  const rootData = rootSnapshot.exists ? rootSnapshot.data() || {} : {};
  const versions = await listQuizVersions({ grade, subject, topicId });

  return {
    rootExists: rootSnapshot.exists,
    legacyQuizExists: Array.isArray(rootData.questions) && rootData.questions.length > 0,
    versionCount: versions.length,
    latestVersionId: versions.length > 0 ? versions[versions.length - 1].versionId : "",
    versions,
  };
}

module.exports = {
  buildVersionId,
  parseVersionNumber,
  buildVersionQuizId,
  parseVersionQuizId,
  getQuizTopicDocRef,
  getQuizTopicDocRefByParentId,
  getQuizVersionsCollectionRef,
  getQuizVersionDocRefByParentId,
  listQuizVersions,
  getNextVersionNumber,
  getLegacyQuizData,
  seedLegacyVersionIfNeeded,
  createQuizVersion,
  getVersionedQuizMeta,
};
