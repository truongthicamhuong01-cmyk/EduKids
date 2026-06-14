const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const successResponse = require("../utils/apiResponse");
const { normalizeString } = require("../utils/validators");
const { findUserById } = require("../services/userService");
const { getStudentClasses } = require("../services/classService");
const {
  createAssignment: createAssignmentService,
  getAssignmentsByClassIds,
  createSubmission,
  getAssignmentById,
  getSubmissionByStudent,
  getSubmissionsByAssignmentId,
} = require("../services/assignmentService");

function uniqueStrings(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

function parseClassIds(value) {
  if (Array.isArray(value)) {
    return uniqueStrings(value);
  }

  if (typeof value === "string") {
    return uniqueStrings(value.split(","));
  }

  return [];
}

async function resolveStudentClassIds(userId, userProfile = null) {
  if (!userId) {
    return [];
  }

  const profile = userProfile || (await findUserById(userId));
  const directClassIds = uniqueStrings([
    ...(Array.isArray(profile?.classIds) ? profile.classIds : []),
    ...(Array.isArray(profile?.joinedClasses) ? profile.joinedClasses : []),
  ]);

  if (directClassIds.length > 0) {
    return directClassIds;
  }

  const classes = await getStudentClasses(userId);

  return uniqueStrings(classes.map((classroom) => classroom?.id));
}

const createAssignment = asyncHandler(async (req, res) => {
  console.log("[EduKids][assignmentController] createAssignment called", {
    teacherId: req.user?.userId || req.user?.uid || "",
    bodyKeys: Object.keys(req.body || {}),
  });

  if (req.user.role !== "teacher") {
    throw new ApiError(403, "Only teachers can create assignments");
  }

  const teacherId = req.user.userId || req.user.uid;
  const teacherProfile = await findUserById(teacherId);

  if (!teacherProfile) {
    throw new ApiError(404, "Teacher profile not found");
  }

  const classId = normalizeString(req.body.classId);
  const title = normalizeString(req.body.title);
  const description = normalizeString(req.body.description);
  const dueDate = normalizeString(req.body.dueDate);
  const subject = normalizeString(req.body.subject);
  const rawQuestions = req.body.questions;

  let questions = [];

  if (Array.isArray(rawQuestions)) {
    questions = rawQuestions;
  } else if (typeof rawQuestions === "string" && rawQuestions.trim()) {
    try {
      const parsed = JSON.parse(rawQuestions);

      if (Array.isArray(parsed)) {
        questions = parsed;
      }
    } catch (error) {
      questions = [];
    }
  }

  const result = await createAssignmentService({
    classId,
    teacherId,
    teacherName: teacherProfile.fullName || teacherProfile.name || req.user.fullName || req.user.username,
    title,
    description,
    dueDate,
    subject,
    questions,
  });

  console.log("[EduKids][assignmentController] createAssignment success", {
    assignmentId: result?.id || "",
    classId: result?.classId || classId,
    teacherId,
  });

  return successResponse(res, 201, "Assignment created successfully", result);
});

const getStudentAssignments = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || req.user?.uid || "";

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const userProfile = await findUserById(userId);

  if (!userProfile) {
    throw new ApiError(404, "User profile not found");
  }

  if (userProfile.role !== "student") {
    throw new ApiError(403, "Only students can load student assignments");
  }

  const allowedClassIds = await resolveStudentClassIds(userId, userProfile);
  const requestedSelectedClassId = normalizeString(req.query.selectedClassId);
  const requestedClassIds = parseClassIds(req.query.classIds);

  let finalClassIds = [];

  if (requestedSelectedClassId && allowedClassIds.includes(requestedSelectedClassId)) {
    finalClassIds = [requestedSelectedClassId];
  } else if (requestedSelectedClassId) {
    finalClassIds = allowedClassIds;
  } else if (requestedClassIds.length > 0) {
    finalClassIds = requestedClassIds.filter((classId) => allowedClassIds.includes(classId));
  } else {
    finalClassIds = allowedClassIds;
  }

  const assignments = await getAssignmentsByClassIds(finalClassIds, userId);

  console.log("[EduKids][assignmentController] getStudentAssignments success", {
    userId,
    requestedSelectedClassId,
    requestedClassCount: requestedClassIds.length,
    classCount: finalClassIds.length,
    assignmentCount: Array.isArray(assignments) ? assignments.length : 0,
  });

  return successResponse(res, 200, "Student assignments fetched successfully", assignments);
});

const submitAssignment = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || req.user?.uid || "";

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const userProfile = await findUserById(userId);

  if (!userProfile) {
    throw new ApiError(404, "User profile not found");
  }

  if (userProfile.role !== "student") {
    throw new ApiError(403, "Only students can submit assignments");
  }

  const assignmentId = normalizeString(req.body.assignmentId);
  const rawAnswers = Array.isArray(req.body.answers) ? req.body.answers : null;

  if (!assignmentId) {
    throw new ApiError(400, "assignmentId is required");
  }

  if (!rawAnswers) {
    throw new ApiError(400, "answers must be an array");
  }

  const assignment = await getAssignmentById(assignmentId);

  if (!assignment) {
    throw new ApiError(404, "Assignment not found");
  }

  const allowedClassIds = await resolveStudentClassIds(userId, userProfile);

  if (assignment.classId && !allowedClassIds.includes(assignment.classId)) {
    throw new ApiError(403, "You cannot submit this assignment");
  }

  const existingSubmission = await getSubmissionByStudent(assignmentId, userId);
  const submission = await createSubmission({
    assignmentId,
    classId: assignment.classId,
    studentId: userId,
    answers: rawAnswers,
  });

  console.log("[EduKids][assignmentController] submitAssignment success", {
    assignmentId,
    studentId: userId,
    hasExistingSubmission: Boolean(existingSubmission),
    answerCount: Array.isArray(rawAnswers) ? rawAnswers.length : 0,
  });

  return successResponse(
    res,
    200,
      existingSubmission
      ? "Assignment resubmitted successfully"
      : "Assignment submitted successfully",
    submission,
  );
});

const getAssignmentSubmissions = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || req.user?.uid || "";

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const userProfile = await findUserById(userId);

  if (!userProfile) {
    throw new ApiError(404, "User profile not found");
  }

  if (userProfile.role !== "teacher") {
    throw new ApiError(403, "Only teachers can view assignment submissions");
  }

  const assignmentId = normalizeString(req.params.assignmentId);

  if (!assignmentId) {
    throw new ApiError(400, "assignmentId is required");
  }

  const assignment = await getAssignmentById(assignmentId);

  if (!assignment) {
    throw new ApiError(404, "Assignment not found");
  }

  if (assignment.teacherId && assignment.teacherId !== userId) {
    throw new ApiError(403, "You can only view submissions for your own assignments");
  }

  const submissions = await getSubmissionsByAssignmentId(assignmentId);

  console.log("[EduKids][assignmentController] getAssignmentSubmissions success", {
    teacherId: userId,
    assignmentId,
    submissionCount: Array.isArray(submissions) ? submissions.length : 0,
  });

  return successResponse(
    res,
    200,
    "Assignment submissions fetched successfully",
    submissions,
  );
});

const getAssignmentByIdController = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || req.user?.uid || "";

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const userProfile = await findUserById(userId);

  if (!userProfile) {
    throw new ApiError(404, "User profile not found");
  }

  const assignmentId = normalizeString(req.params.assignmentId);

  if (!assignmentId) {
    throw new ApiError(400, "assignmentId is required");
  }

  const assignment = await getAssignmentById(assignmentId);

  if (!assignment) {
    throw new ApiError(404, "Assignment not found");
  }

  if (userProfile.role === "teacher") {
    if (assignment.teacherId && assignment.teacherId !== userId) {
      throw new ApiError(403, "You can only view your own assignments");
    }

    return successResponse(res, 200, "Assignment fetched successfully", assignment);
  }

  if (userProfile.role !== "student") {
    throw new ApiError(403, "Only students or teachers can load assignments");
  }

  const allowedClassIds = await resolveStudentClassIds(userId, userProfile);

  if (assignment.classId && !allowedClassIds.includes(assignment.classId)) {
    throw new ApiError(403, "You cannot view this assignment");
  }

  const submission = await getSubmissionByStudent(assignmentId, userId);
  const normalizedAssignment = submission
    ? {
        ...assignment,
        submissionStatus: submission.status || "submitted",
        submissionId: submission.id,
        submittedAt: submission.submittedAt,
        score: submission.score ?? null,
      }
    : {
        ...assignment,
        submissionStatus: "pending",
        submittedAt: "",
        score: null,
      };

  return successResponse(
    res,
    200,
    "Assignment fetched successfully",
    normalizedAssignment,
  );
});

module.exports = {
  createAssignment,
  getStudentAssignments,
  submitAssignment,
  getAssignmentSubmissions,
  getAssignmentById: getAssignmentByIdController,
};
