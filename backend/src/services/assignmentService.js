const { admin, db } = require("../firebase");
const ApiError = require("../utils/apiError");

const classesCollection = db.collection("classes");
const assignmentsCollection = db.collection("assignments");
const assignmentSubmissionsCollection = db.collection("assignment_submissions");

function uniqueStrings(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

function chunkArray(values, size = 10) {
  const chunks = [];
  const list = Array.isArray(values) ? values : [];

  for (let index = 0; index < list.length; index += size) {
    chunks.push(list.slice(index, index + size));
  }

  return chunks;
}

function normalizeQuestions(questions) {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions
    .map((question) => ({
      id: String(question?.id || "").trim() || null,
      question: String(question?.question || "").trim(),
      options: Array.isArray(question?.options)
        ? question.options.map((answer) => String(answer || "").trim()).filter(Boolean)
        : [
            String(question?.correctAnswer || "").trim(),
            ...(Array.isArray(question?.wrongAnswers)
              ? question.wrongAnswers.map((answer) => String(answer || "").trim())
              : []),
          ].filter(Boolean),
      correctAnswer: String(question?.correctAnswer || "").trim(),
    }))
    .map((question, index) => ({
      id: question.id || `question-${index + 1}`,
      question: question.question,
      options: question.options.slice(0, 4),
      correctAnswer: question.correctAnswer || question.options[0] || "",
    }))
    .filter(
      (question) =>
        question.question &&
        question.correctAnswer &&
        Array.isArray(question.options) &&
        question.options.length >= 4,
    );
}

function normalizeSubjectLabel(subject) {
  const normalized = String(subject || "").trim().toLowerCase();

  if (normalized === "math" || normalized === "toán" || normalized === "toan") {
    return "Math";
  }

  if (normalized === "english" || normalized === "tiếng anh" || normalized === "tieng anh") {
    return "English";
  }

  return "";
}

function normalizeAssignmentDoc(doc, fallbackClassId = "") {
  if (!doc) {
    return null;
  }

  const data =
    typeof doc.data === "function"
      ? doc.data() || {}
      : doc && typeof doc === "object"
        ? doc
        : {};
  const resolvedStatus = String(data.status || "").trim().toLowerCase() || "active";
  const dueDate = String(data.dueDate || "").trim();

  return {
    id: String(doc.id || data.id || "").trim(),
    classId: String(data.classId || fallbackClassId || "").trim(),
    className: String(data.className || "").trim(),
    classCode: String(data.classCode || "").trim(),
    teacherId: String(data.teacherId || "").trim(),
    teacherName: String(data.teacherName || "").trim(),
    title: String(data.title || "").trim(),
    description: String(data.description || "").trim(),
    subject: String(data.subject || "").trim(),
    dueDate: dueDate || null,
    status: resolvedStatus || "active",
    createdAt: String(data.createdAt || "").trim(),
    updatedAt: String(data.updatedAt || "").trim(),
    questions: Array.isArray(data.questions) ? data.questions : [],
    totalQuestions: Number(data.totalQuestions || data.questionCount || 0),
    questionCount: Number(data.questionCount || data.totalQuestions || 0),
  };
}

function normalizeSubmissionDoc(doc) {
  if (!doc) {
    return null;
  }

  const data =
    typeof doc.data === "function"
      ? doc.data() || {}
      : doc && typeof doc === "object"
        ? doc
        : {};

  return {
    id: String(doc.id || data.id || "").trim(),
    assignmentId: String(data.assignmentId || "").trim(),
    classId: String(data.classId || "").trim(),
    studentId: String(data.studentId || "").trim(),
    answers: Array.isArray(data.answers) ? data.answers : [],
    submittedAt: String(data.submittedAt || "").trim(),
    status: String(data.status || "").trim().toLowerCase() || "submitted",
    score: data.score ?? null,
  };
}

function sortAssignments(assignments) {
  return [...assignments].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt || left.updatedAt || "") || 0;
    const rightTime = Date.parse(right.createdAt || right.updatedAt || "") || 0;

    return rightTime - leftTime;
  });
}

async function createAssignment({
  classId,
  teacherId,
  teacherName,
  title,
  description = "",
  dueDate = "",
  subject = "",
  questions = [],
}) {
  const normalizedClassId = String(classId || "").trim();
  const normalizedTeacherId = String(teacherId || "").trim();

  console.log("[EduKids][assignmentService] createAssignment requested", {
    classId: normalizedClassId,
    teacherId: normalizedTeacherId,
    title: String(title || "").trim(),
    subject: String(subject || "").trim(),
    questionCount: Array.isArray(questions) ? questions.length : 0,
  });

  if (!normalizedClassId) {
    throw new ApiError(400, "classId is required");
  }

  const classRef = classesCollection.doc(normalizedClassId);
  const classSnapshot = await classRef.get();

  if (!classSnapshot.exists) {
    throw new ApiError(404, "Class not found");
  }

  const classData = classSnapshot.data() || {};

  if (classData.teacherId && normalizedTeacherId && classData.teacherId !== normalizedTeacherId) {
    throw new ApiError(403, "You can only create assignments for your own class");
  }

  if (!title || !String(title).trim()) {
    throw new ApiError(400, "title is required");
  }

  const normalizedSubject = normalizeSubjectLabel(subject);

  if (!normalizedSubject) {
    throw new ApiError(400, "subject is required");
  }

  const normalizedQuestions = normalizeQuestions(questions);

  if (normalizedQuestions.length === 0) {
    throw new ApiError(400, "questions are required");
  }

  const assignmentRef = assignmentsCollection.doc();
  const timestamp = new Date().toISOString();
  const assignmentData = {
    id: assignmentRef.id,
    classId: normalizedClassId,
    classCode: classData.classCode || "",
    className: classData.name || classData.className || "",
    teacherId: normalizedTeacherId || classData.teacherId || "",
    teacherName: teacherName || classData.teacherName || "",
    title: String(title).trim(),
    description: String(description || "").trim(),
    dueDate: String(dueDate || "").trim(),
    subject: normalizedSubject,
    questions: normalizedQuestions,
    totalQuestions: normalizedQuestions.length,
    questionCount: normalizedQuestions.length,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await assignmentRef.set(assignmentData);
  await classRef.collection("assignments").doc(assignmentRef.id).set(assignmentData);
  await classRef.set(
    {
      assignmentIds: admin.firestore.FieldValue.arrayUnion(assignmentRef.id),
      updatedAt: timestamp,
    },
    { merge: true },
  );

  console.log("[EduKids][assignmentService] createAssignment success", {
    assignmentId: assignmentRef.id,
    classId: normalizedClassId,
    teacherId: assignmentData.teacherId,
  });

  return assignmentData;
}

async function getAssignmentById(assignmentId) {
  const normalizedAssignmentId = String(assignmentId || "").trim();

  if (!normalizedAssignmentId) {
    return null;
  }

  const snapshot = await assignmentsCollection.doc(normalizedAssignmentId).get();

  if (!snapshot.exists) {
    return null;
  }

  return normalizeAssignmentDoc(snapshot);
}

async function getSubmissionByStudent(assignmentId, studentId) {
  const normalizedAssignmentId = String(assignmentId || "").trim();
  const normalizedStudentId = String(studentId || "").trim();

  if (!normalizedAssignmentId || !normalizedStudentId) {
    return null;
  }

  const docId = `${normalizedAssignmentId}_${normalizedStudentId}`;
  const docSnapshot = await assignmentSubmissionsCollection.doc(docId).get();

  if (docSnapshot.exists) {
    return normalizeSubmissionDoc(docSnapshot);
  }

  const querySnapshot = await assignmentSubmissionsCollection
    .where("assignmentId", "==", normalizedAssignmentId)
    .where("studentId", "==", normalizedStudentId)
    .limit(1)
    .get();

  if (querySnapshot.empty) {
    return null;
  }

  return normalizeSubmissionDoc(querySnapshot.docs[0]);
}

async function getSubmissionsByStudentAndClassIds(classIds, studentId) {
  const normalizedClassIds = uniqueStrings(classIds);
  const normalizedStudentId = String(studentId || "").trim();

  if (normalizedClassIds.length === 0 || !normalizedStudentId) {
    return [];
  }

  const snapshot = await assignmentSubmissionsCollection
    .where("studentId", "==", normalizedStudentId)
    .get();

  return snapshot.docs
    .map((doc) => normalizeSubmissionDoc(doc))
    .filter(
      (submission) =>
        submission && normalizedClassIds.includes(submission.classId),
    );
}

async function getSubmissionsByAssignmentId(assignmentId) {
  const normalizedAssignmentId = String(assignmentId || "").trim();

  if (!normalizedAssignmentId) {
    return [];
  }

  const snapshot = await assignmentSubmissionsCollection
    .where("assignmentId", "==", normalizedAssignmentId)
    .get();

  return snapshot.docs
    .map((doc) => normalizeSubmissionDoc(doc))
    .filter((submission) => submission && submission.assignmentId === normalizedAssignmentId)
    .sort((left, right) => {
      const leftTime = Date.parse(left.submittedAt || "") || 0;
      const rightTime = Date.parse(right.submittedAt || "") || 0;

      return rightTime - leftTime;
    });
}

async function createSubmission({
  assignmentId,
  classId,
  studentId,
  answers = [],
}) {
  const normalizedAssignmentId = String(assignmentId || "").trim();
  const normalizedClassId = String(classId || "").trim();
  const normalizedStudentId = String(studentId || "").trim();
  const normalizedAnswers = Array.isArray(answers) ? answers : [];

  console.log("[EduKids][assignmentService] createSubmission requested", {
    assignmentId: normalizedAssignmentId,
    classId: normalizedClassId,
    studentId: normalizedStudentId,
    answerCount: normalizedAnswers.length,
  });

  if (!normalizedAssignmentId) {
    throw new ApiError(400, "assignmentId is required");
  }

  if (!normalizedClassId) {
    throw new ApiError(400, "classId is required");
  }

  if (!normalizedStudentId) {
    throw new ApiError(400, "studentId is required");
  }

  const assignment = await getAssignmentById(normalizedAssignmentId);

  if (!assignment) {
    throw new ApiError(404, "Assignment not found");
  }

  if (assignment.classId && assignment.classId !== normalizedClassId) {
    throw new ApiError(400, "classId does not match this assignment");
  }

  const submissionRef = assignmentSubmissionsCollection.doc(
    `${normalizedAssignmentId}_${normalizedStudentId}`,
  );
  const submittedAt = new Date().toISOString();
  const submissionData = {
    id: submissionRef.id,
    assignmentId: normalizedAssignmentId,
    classId: normalizedClassId,
    studentId: normalizedStudentId,
    answers: normalizedAnswers,
    submittedAt,
    status: "submitted",
    score: null,
  };

  await submissionRef.set(submissionData, { merge: true });

  console.log("[EduKids][assignmentService] createSubmission success", {
    submissionId: submissionRef.id,
    assignmentId: normalizedAssignmentId,
    studentId: normalizedStudentId,
  });

  return submissionData;
}

async function getAssignmentsByClassIds(classIds, studentId = "") {
  const normalizedClassIds = uniqueStrings(classIds);

  if (normalizedClassIds.length === 0) {
    return [];
  }

  const snapshots = await Promise.all(
    chunkArray(normalizedClassIds, 10).map((batchIds) =>
      assignmentsCollection.where("classId", "in", batchIds).get(),
    ),
  );

  const assignments = [];

  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((doc) => {
      const assignment = normalizeAssignmentDoc(doc);

      if (assignment) {
        assignments.push(assignment);
      }
    });
  });

  const activeAssignments = assignments.filter((assignment) => assignment.status === "active");

  const submissionsByAssignmentId = new Map();

  if (String(studentId || "").trim()) {
    const submissions = await getSubmissionsByStudentAndClassIds(
      normalizedClassIds,
      studentId,
    );

    submissions.forEach((submission) => {
      if (submission?.assignmentId) {
        submissionsByAssignmentId.set(submission.assignmentId, submission);
      }
    });
  }

  const mergedAssignments = activeAssignments.map((assignment) => {
    const submission = submissionsByAssignmentId.get(assignment.id);

    if (!submission) {
      return assignment;
    }

    return {
      ...assignment,
      status: submission.status || "submitted",
      submissionId: submission.id,
      submittedAt: submission.submittedAt,
      score: submission.score ?? null,
    };
  });

  return sortAssignments(mergedAssignments);
}

module.exports = {
  createAssignment,
  getAssignmentsByClassIds,
  createSubmission,
  getAssignmentById,
  getSubmissionByStudent,
  getSubmissionsByAssignmentId,
  normalizeAssignmentDoc,
};
