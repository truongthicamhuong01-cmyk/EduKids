const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const successResponse = require("../utils/apiResponse");
const { normalizeString } = require("../utils/validators");
const { findUserById } = require("../services/userService");
const { createAssignment: createAssignmentService } = require("../services/assignmentService");

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

module.exports = {
  createAssignment,
};
