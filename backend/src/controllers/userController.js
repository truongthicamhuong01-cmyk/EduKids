const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const successResponse = require("../utils/apiResponse");
const { normalizeString, isValidGender } = require("../utils/validators");
const { ensureUserCode, findUserById, updateUserById } = require("../services/userService");
const { updateUserStreak } = require("../services/progressService");

function getCurrentUid(req) {
  return req.user?.uid || req.user?.userId || null;
}

const me = asyncHandler(async (req, res) => {
  const uid = getCurrentUid(req);

  if (!uid) {
    throw new ApiError(401, "Unauthorized");
  }

  const user = await findUserById(uid);

  if (!user) {
    throw new ApiError(404, "User document not found");
  }

  const userWithCode = await ensureUserCode(uid, user);
  const updatedUser = await updateUserStreak(uid).catch(() => userWithCode);
  const requiredFields = ["uid", "username", "role", "gender", "createdAt"];
  const missingFields = requiredFields.filter((field) => !updatedUser[field]);

  if (missingFields.length > 0) {
    throw new ApiError(422, `Missing user fields: ${missingFields.join(", ")}`);
  }

  return successResponse(res, 200, "User profile fetched successfully", updatedUser);
});

const updateMe = asyncHandler(async (req, res) => {
  const uid = getCurrentUid(req);

  if (!uid) {
    throw new ApiError(401, "Unauthorized");
  }

  const currentUser = await findUserById(uid);

  if (!currentUser) {
    throw new ApiError(404, "User document not found");
  }

  const updates = {};
  const rawBody = req.body || {};

  if (typeof rawBody.name === "string") {
    updates.name = normalizeString(rawBody.name);
    updates.fullName = updates.name;
  } else if (typeof rawBody.fullName === "string") {
    updates.fullName = normalizeString(rawBody.fullName);
    updates.name = updates.fullName;
  }

  if (typeof rawBody.username === "string") {
    updates.username = normalizeString(rawBody.username);
  }

  if (typeof rawBody.gender === "string") {
    const gender = normalizeString(rawBody.gender);

    if (!isValidGender(gender)) {
      throw new ApiError(400, "gender must be either male or female");
    }

    updates.gender = gender;
  }

  if (typeof rawBody.avatar === "string") {
    updates.avatar = normalizeString(rawBody.avatar);
  }

  if (typeof rawBody.school === "string") updates.school = normalizeString(rawBody.school);
  if (typeof rawBody.className === "string") updates.className = normalizeString(rawBody.className);
  if (typeof rawBody.hobby === "string") updates.hobby = normalizeString(rawBody.hobby);
  if (typeof rawBody.dream === "string") updates.dream = normalizeString(rawBody.dream);
  if (typeof rawBody.phone === "string") updates.phone = normalizeString(rawBody.phone);
  if (typeof rawBody.address === "string") updates.address = normalizeString(rawBody.address);
  if (typeof rawBody.note === "string") updates.note = normalizeString(rawBody.note);

  if (Array.isArray(rawBody.classTags)) {
    updates.classTags = rawBody.classTags.map((item) => normalizeString(item)).filter(Boolean);
  }

  if (Array.isArray(rawBody.subjects)) {
    updates.subjects = rawBody.subjects;
  }

  const result = await updateUserById(uid, updates);

  return successResponse(res, 200, "User profile updated successfully", result);
});

module.exports = {
  me,
  updateMe,
};
