const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const successResponse = require("../utils/apiResponse");
const { normalizeString, isValidGender, isValidRole } = require("../utils/validators");
const { loginUser, registerUser } = require("../services/authService");

const register = asyncHandler(async (req, res) => {
  console.log("[EduKids][authController] register called", {
    bodyKeys: Object.keys(req.body || {}),
  });

  const username = normalizeString(req.body.username);
  const password = normalizeString(req.body.password);
  const role = normalizeString(req.body.role);
  const fullName = normalizeString(req.body.fullName);
  const gender = normalizeString(req.body.gender);
  const email = normalizeString(req.body.email);
  const school = normalizeString(req.body.school);
  const className = normalizeString(req.body.className);
  const hobby = normalizeString(req.body.hobby);
  const dream = normalizeString(req.body.dream);
  const phone = normalizeString(req.body.phone);
  const address = normalizeString(req.body.address);
  const note = normalizeString(req.body.note);

  if (!username || !password || !role || !fullName || !gender) {
    throw new ApiError(400, "username, password, role, fullName, and gender are required");
  }

  if (!isValidRole(role)) {
    throw new ApiError(400, "role must be either student or teacher");
  }

  if (!isValidGender(gender)) {
    throw new ApiError(400, "gender must be either male or female");
  }

  const result = await registerUser({
    username,
    password,
    role,
    fullName,
    gender,
    email,
    school,
    className,
    hobby,
    dream,
    phone,
    address,
    note,
  });

  console.log("[EduKids][authController] register success", {
    username,
    role,
  });

  return successResponse(res, 201, "User registered successfully", result);
});

const login = asyncHandler(async (req, res) => {
  console.log("[EduKids][authController] login called", {
    bodyKeys: Object.keys(req.body || {}),
  });

  const username = normalizeString(req.body.username);
  const password = normalizeString(req.body.password);

  if (!username || !password) {
    throw new ApiError(400, "username and password are required");
  }

  const result = await loginUser({ username, password });

  console.log("[EduKids][authController] login success", {
    username,
  });

  return successResponse(res, 200, "Login successful", result);
});

module.exports = {
  register,
  login,
};
