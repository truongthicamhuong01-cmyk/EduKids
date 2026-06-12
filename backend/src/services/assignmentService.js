const { admin, db } = require("../firebase");
const ApiError = require("../utils/apiError");

const classesCollection = db.collection("classes");
const assignmentsCollection = db.collection("assignments");

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

module.exports = {
  createAssignment,
};
