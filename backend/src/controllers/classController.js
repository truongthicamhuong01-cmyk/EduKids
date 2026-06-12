const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const successResponse = require("../utils/apiResponse");
const { normalizeString } = require("../utils/validators");
const { findUserById } = require("../services/userService");
const {
  createClass: createClassService,
  getStudentClasses,
  getTeacherClasses,
  joinClass,
} = require("../services/classService");

const createClass = asyncHandler(async (req, res) => {
  console.log("[EduKids][classController] createClass called", {
    teacherId: req.user?.userId || req.user?.uid || "",
    bodyKeys: Object.keys(req.body || {}),
  });

  if (req.user.role !== "teacher") {
    throw new ApiError(403, "Only teachers can create classes");
  }

  const rawName = normalizeString(req.body.name || req.body.className);
  const description = normalizeString(req.body.description);

  if (!rawName) {
    throw new ApiError(400, "name is required");
  }

  if (rawName.length > 100) {
    throw new ApiError(400, "name must not exceed 100 characters");
  }

  if (description.length > 500) {
    throw new ApiError(400, "description must not exceed 500 characters");
  }

  const teacherId = req.user.userId || req.user.uid;
  const teacherProfile = await findUserById(teacherId);

  if (!teacherProfile) {
    throw new ApiError(404, "Teacher profile not found");
  }

  const result = await createClassService({
    teacherId,
    teacherName: teacherProfile.fullName || teacherProfile.name || req.user.fullName || req.user.username,
    name: rawName,
    description,
  });

  console.log("[EduKids][classController] createClass success", {
    classId: result?.id || "",
    classCode: result?.classCode || "",
    teacherId,
  });

  return successResponse(res, 201, "Class created successfully", result);
});

const join = asyncHandler(async (req, res) => {
  console.log("[EduKids][classController] join called", {
    studentId: req.user?.userId || req.user?.uid || "",
    bodyKeys: Object.keys(req.body || {}),
  });

  if (req.user.role !== "student") {
    throw new ApiError(403, "Only students can join classes");
  }

  const classCode = normalizeString(req.body.classCode).toUpperCase();

  if (!classCode || classCode.length !== 6) {
    throw new ApiError(400, "classCode must be a 6-character code");
  }

  const result = await joinClass({
    classCode,
    user: req.user,
  });

  console.log("[EduKids][classController] join success", {
    classId: result?.class?.id || "",
    studentId: result?.studentId || "",
  });

  return successResponse(res, 200, "Joined class successfully", result);
});

const myClasses = asyncHandler(async (req, res) => {
  console.log("[EduKids][classController] myClasses called", {
    role: req.user?.role || "",
    userId: req.user?.userId || req.user?.uid || "",
  });

  let classes = [];

  if (req.user.role === "teacher") {
    classes = await getTeacherClasses(req.user.userId || req.user.uid);
  } else if (req.user.role === "student") {
    classes = await getStudentClasses(req.user.userId || req.user.uid);
  } else {
    throw new ApiError(403, "Invalid user role");
  }

  console.log("[EduKids][classController] myClasses success", {
    role: req.user?.role || "",
    classCount: Array.isArray(classes) ? classes.length : 0,
  });

  return successResponse(res, 200, "My classes fetched successfully", classes);
});

module.exports = {
  createClass,
  create: createClass,
  join,
  myClasses,
};
