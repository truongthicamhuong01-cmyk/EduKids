const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const successResponse = require("../utils/apiResponse");
const { normalizeString } = require("../utils/validators");
const { findUserById, resetUserPasswordById } = require("../services/userService");
const { listTopics } = require("../services/quizReadService");

function verifyAdminPassword(rawPassword) {
  const password = normalizeString(rawPassword);
  const adminPassword = normalizeString(process.env.ADMIN_PASSWORD);

  if (!adminPassword) {
    throw new ApiError(500, "ADMIN_PASSWORD is not configured");
  }

  if (!password || password !== adminPassword) {
    throw new ApiError(401, "Sai mật khẩu quản trị");
  }
}

const login = asyncHandler(async (req, res) => {
  const password = normalizeString(req.body.password);

  verifyAdminPassword(password);

  return res.status(200).json({
    success: true,
    message: "Đăng nhập quản trị thành công",
    data: {
      authenticated: true,
    },
  });
});

const resetTeacherPassword = asyncHandler(async (req, res) => {
  verifyAdminPassword(req.body.adminPassword);

  const teacherId = normalizeString(req.body.teacherId);
  const newPassword = normalizeString(req.body.newPassword);

  if (!teacherId) {
    throw new ApiError(400, "teacherId is required");
  }

  if (!newPassword) {
    throw new ApiError(400, "newPassword is required");
  }

  const teacher = await findUserById(teacherId);

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  if (String(teacher.role || "").toLowerCase() !== "teacher") {
    throw new ApiError(400, "User is not a teacher");
  }

  await resetUserPasswordById(teacherId, newPassword);

  return successResponse(res, 200, "Teacher password reset successfully", {
    teacherId,
  });
});

const getTopics = asyncHandler(async (req, res) => {
  const headerPassword = normalizeString(
    req.get("X-Admin-Password") || req.get("x-admin-password"),
  );
  const adminPassword = normalizeString(process.env.ADMIN_PASSWORD);

  if (!adminPassword) {
    throw new ApiError(500, "ADMIN_PASSWORD is not configured");
  }

  if (!headerPassword || headerPassword !== adminPassword) {
    throw new ApiError(401, "Unauthorized");
  }

  const grade = normalizeString(req.query.grade);
  const subject = normalizeString(req.query.subject);

  const topics = await listTopics({
    grade,
    subject,
  });

  return successResponse(res, 200, "Topics fetched successfully", topics);
});

module.exports = {
  getTopics,
  login,
  resetTeacherPassword,
};
