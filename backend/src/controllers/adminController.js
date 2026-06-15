const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const successResponse = require("../utils/apiResponse");
const { normalizeString } = require("../utils/validators");
const { findUserById, resetUserPasswordById } = require("../services/userService");

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

  console.log("[EduKids][admin] login request", {
    hasPassword: Boolean(password),
    passwordLength: password.length,
  });

  verifyAdminPassword(password);

  console.log("[EduKids][admin] login success");

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

module.exports = {
  login,
  resetTeacherPassword,
};
