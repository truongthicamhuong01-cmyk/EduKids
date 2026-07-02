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

function normalizeChoiceLabel(index = 0) {
  return String.fromCharCode(65 + index);
}

function normalizeQuestionChoices(question) {
  if (!question || typeof question !== "object" || !Array.isArray(question.options)) {
    return [];
  }

  return question.options
    .map((option, index) => {
      if (option && typeof option === "object") {
        return {
          label: normalizeScoringText(option.label || normalizeChoiceLabel(index)),
          text: String(option.text || option.answer || option.value || "").trim(),
          value: String(option.value || option.text || option.answer || "").trim(),
        };
      }

      return {
        label: normalizeScoringText(normalizeChoiceLabel(index)),
        text: String(option || "").trim(),
        value: String(option || "").trim(),
      };
    })
    .filter((option) => option.text);
}

function normalizeScoringText(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeQuestionCorrectAnswer(question) {
  const directAnswer = normalizeScoringText(question?.correctAnswer || question?.answer || question?.correct || "");

  if (!directAnswer) {
    return "";
  }

  if (/^[A-Z]$/.test(directAnswer)) {
    return directAnswer;
  }

  const choices = normalizeQuestionChoices(question);
  const matchedChoice = choices.find((choice) => {
    const normalizedText = normalizeScoringText(choice.text);
    const normalizedValue = normalizeScoringText(choice.value);

    return normalizedText === directAnswer || normalizedValue === directAnswer;
  });

  return matchedChoice?.label || directAnswer;
}

function normalizeSubmissionAnswer(answer) {
  if (answer === null || typeof answer === "undefined") {
    return "";
  }

  if (typeof answer === "string" || typeof answer === "number" || typeof answer === "boolean") {
    return normalizeScoringText(answer);
  }

  if (typeof answer !== "object") {
    return "";
  }

  return normalizeScoringText(
    answer.selected ??
      answer.selectedAnswer ??
      answer.studentAnswer ??
      answer.userAnswer ??
      answer.chosenAnswer ??
      answer.answer ??
      answer.correctAnswer ??
      answer.value ??
      answer.text ??
      answer.label ??
      answer.option ??
      "",
  );
}

function normalizeSelectedAnswerLabel(answer, question) {
  const normalizedSelected = normalizeSubmissionAnswer(answer);

  if (!normalizedSelected) {
    return "";
  }

  if (/^[A-Z]$/.test(normalizedSelected)) {
    return normalizedSelected;
  }

  const choices = normalizeQuestionChoices(question);
  const matchedChoice = choices.find((choice) => {
    const normalizedText = normalizeScoringText(choice.text);
    const normalizedValue = normalizeScoringText(choice.value);

    return normalizedText === normalizedSelected || normalizedValue === normalizedSelected;
  });

  return matchedChoice?.label || normalizedSelected;
}

function normalizeSubmissionAnswers(answers) {
  if (!Array.isArray(answers)) {
    return [];
  }

  return answers
    .map((answer, index) => {
      const normalizedValue = normalizeSubmissionAnswer(answer);

      if (!normalizedValue) {
        return null;
      }

      const questionIndex =
        typeof answer === "object" && answer !== null && Number.isFinite(Number(answer.questionIndex))
          ? Number(answer.questionIndex)
          : index;

      return {
        questionIndex,
        selected: normalizedValue,
      };
    })
    .filter(Boolean);
}

function gradeAssignmentSubmission(assignment, answers) {
  const questions = Array.isArray(assignment?.questions) ? assignment.questions : [];
  const normalizedAnswers = normalizeSubmissionAnswers(answers);
  const answerMap = new Map();

  normalizedAnswers.forEach((answer, index) => {
    const explicitIndex = Number.isFinite(Number(answer.questionIndex))
      ? Number(answer.questionIndex)
      : index;

    if (!answerMap.has(explicitIndex)) {
      answerMap.set(explicitIndex, answer.selected);
    }
  });

  let correctCount = 0;

  questions.forEach((question, index) => {
    const correctAnswer = normalizeQuestionCorrectAnswer(question);
    const selectedAnswer = normalizeSelectedAnswerLabel(answerMap.get(index), question);

    if (correctAnswer && selectedAnswer && selectedAnswer === correctAnswer) {
      correctCount += 1;
    }
  });

  const totalQuestions = questions.length;
  const wrongCount = Math.max(totalQuestions - correctCount, 0);
  const score =
    totalQuestions > 0
      ? Number(((correctCount / totalQuestions) * 10).toFixed(1))
      : 0;

  return {
    correctCount,
    wrongCount,
    totalQuestions,
    score,
  };
}

function applySubmissionResultToAssignment(assignment, submission = null) {
  if (!assignment) {
    return null;
  }

  if (!submission) {
    return {
      ...assignment,
      submissionStatus: "pending",
      submittedAt: "",
      score: null,
      correctCount: null,
      wrongCount: null,
      totalQuestions: Number(assignment.totalQuestions || assignment.questionCount || (Array.isArray(assignment.questions) ? assignment.questions.length : 0)) || 0,
      gradedAt: "",
    };
  }

  const hasGradedScore =
    submission.status === "graded" &&
    Number.isFinite(Number(submission.score));

  return {
    ...assignment,
    submissionStatus: submission.status || "submitted",
    submissionId: submission.id,
    submittedAt: submission.submittedAt || "",
    score: hasGradedScore ? Number(submission.score) : submission.score ?? null,
    status: hasGradedScore ? "done" : assignment.status,
    correctCount: Number.isFinite(Number(submission.correctCount)) ? Number(submission.correctCount) : null,
    wrongCount: Number.isFinite(Number(submission.wrongCount)) ? Number(submission.wrongCount) : null,
    totalQuestions: Number.isFinite(Number(submission.totalQuestions))
      ? Number(submission.totalQuestions)
      : Number(assignment.totalQuestions || assignment.questionCount || (Array.isArray(assignment.questions) ? assignment.questions.length : 0)) || 0,
    gradedAt: submission.gradedAt || "",
  };
}

function normalizeSubjectToken(subject) {
  return String(subject || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeSubjectLabel(subject) {
  const normalized = normalizeSubjectToken(subject);

  if (normalized === "math" || normalized === "toan") {
    return "Math";
  }

  if (normalized === "english" || normalized === "tieng anh") {
    return "English";
  }

  if (normalized === "vietnamese" || normalized === "tieng viet") {
    return "Vietnamese";
  }

  if (normalized === "science" || normalized === "khoa hoc") {
    return "Science";
  }

  if (normalized === "history" || normalized === "lich su") {
    return "History";
  }

  if (normalized === "geography" || normalized === "dia ly") {
    return "Geography";
  }

  return String(subject || "").trim();
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
    gradedAt: String(data.gradedAt || "").trim(),
    status: String(data.status || "").trim().toLowerCase() || "submitted",
    score: data.score ?? null,
    correctCount: Number.isFinite(Number(data.correctCount)) ? Number(data.correctCount) : null,
    wrongCount: Number.isFinite(Number(data.wrongCount)) ? Number(data.wrongCount) : null,
    totalQuestions: Number.isFinite(Number(data.totalQuestions)) ? Number(data.totalQuestions) : null,
  };
}

function sortAssignments(assignments) {
  return [...assignments].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt || left.updatedAt || "") || 0;
    const rightTime = Date.parse(right.createdAt || right.updatedAt || "") || 0;

    return rightTime - leftTime;
  });
}

function parseDueDateTimestamp(dueDate) {
  const rawDueDate = String(dueDate || "").trim();

  if (!rawDueDate) {
    return null;
  }

  const normalizedDueDate =
    rawDueDate.includes(" ") && !rawDueDate.includes("T")
      ? rawDueDate.replace(" ", "T")
      : rawDueDate;
  const parsedTime = Date.parse(normalizedDueDate);

  return Number.isFinite(parsedTime) ? parsedTime : null;
}

function isAssignmentPastDue(dueDate, now = Date.now()) {
  const dueTimestamp = parseDueDateTimestamp(dueDate);

  if (dueTimestamp === null) {
    return false;
  }

  return dueTimestamp < now;
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

async function getSubmissionsByStudentId(studentId) {
  const normalizedStudentId = String(studentId || "").trim();

  if (!normalizedStudentId) {
    return [];
  }

  const snapshot = await assignmentSubmissionsCollection
    .where("studentId", "==", normalizedStudentId)
    .get();

  return snapshot.docs
    .map((doc) => normalizeSubmissionDoc(doc))
    .filter((submission) => submission && submission.studentId === normalizedStudentId);
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

  const grading = gradeAssignmentSubmission(assignment, normalizedAnswers);

  const submissionRef = assignmentSubmissionsCollection.doc(
    `${normalizedAssignmentId}_${normalizedStudentId}`,
  );
  const submittedAt = new Date().toISOString();
  const gradedAt = submittedAt;
  const submissionData = {
    id: submissionRef.id,
    assignmentId: normalizedAssignmentId,
    classId: normalizedClassId,
    studentId: normalizedStudentId,
    answers: normalizedAnswers,
    submittedAt,
    gradedAt,
    status: "graded",
    score: grading.score,
    correctCount: grading.correctCount,
    wrongCount: grading.wrongCount,
    totalQuestions: grading.totalQuestions,
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
    const submissions = await getSubmissionsByStudentId(studentId);

    submissions.forEach((submission) => {
      if (
        submission?.assignmentId &&
        normalizedClassIds.includes(submission.classId)
      ) {
        submissionsByAssignmentId.set(submission.assignmentId, submission);
      }
    });
  }

  const visibleAssignments = activeAssignments.filter((assignment) => {
    const submission = submissionsByAssignmentId.get(assignment.id);

    if (submission) {
      return true;
    }

    return !isAssignmentPastDue(assignment.dueDate);
  });

  const mergedAssignments = visibleAssignments.map((assignment) => {
    const submission = submissionsByAssignmentId.get(assignment.id);

    return applySubmissionResultToAssignment(assignment, submission);
  });

  return sortAssignments(mergedAssignments);
}

module.exports = {
  createAssignment,
  getAssignmentsByClassIds,
  createSubmission,
  getAssignmentById,
  getSubmissionByStudent,
  getSubmissionsByStudentId,
  getSubmissionsByAssignmentId,
  normalizeAssignmentDoc,
  applySubmissionResultToAssignment,
  gradeAssignmentSubmission,
  normalizeSubmissionDoc,
};
