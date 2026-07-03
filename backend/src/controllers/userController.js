const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const successResponse = require("../utils/apiResponse");
const { normalizeString, isValidGender } = require("../utils/validators");
const { ensureUserCode, findUserById, updateUserById } = require("../services/userService");
const { updateUserStreak } = require("../services/progressService");
const { getRecentWrongAnswersByUserId } = require("../services/quizGradeService");

const USERNAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function getCurrentUid(req) {
  return req.user?.uid || req.user?.userId || null;
}

function getValidDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getUsernameCooldownMessage(lastUsernameChangeAt) {
  const lastChangeDate = getValidDate(lastUsernameChangeAt);

  if (!lastChangeDate) {
    return null;
  }

  const elapsed = Date.now() - lastChangeDate.getTime();

  if (elapsed >= USERNAME_CHANGE_COOLDOWN_MS) {
    return null;
  }

  const remainingDays = Math.max(1, Math.ceil((USERNAME_CHANGE_COOLDOWN_MS - elapsed) / DAY_MS));

  return `Bạn chỉ có thể thay đổi tên đăng nhập 7 ngày một lần. Bạn có thể đổi tên đăng nhập sau ${remainingDays} ngày nữa.`;
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
  const recentWrongAnswers = await getRecentWrongAnswersByUserId(uid).catch(() => null);
  const profileWithWrongAnswers = {
    ...updatedUser,
    recentWrongAnswers,
  };
  const requiredFields = ["uid", "username", "role", "gender", "createdAt"];
  const missingFields = requiredFields.filter((field) => !profileWithWrongAnswers[field]);

  if (missingFields.length > 0) {
    throw new ApiError(422, `Missing user fields: ${missingFields.join(", ")}`);
  }

  return successResponse(res, 200, "User profile fetched successfully", profileWithWrongAnswers);
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
  let usernameChangeBlocked = false;
  let usernameChangeMessage = "";

  if (typeof rawBody.name === "string") {
    updates.name = normalizeString(rawBody.name);
    updates.fullName = updates.name;
  } else if (typeof rawBody.fullName === "string") {
    updates.fullName = normalizeString(rawBody.fullName);
    updates.name = updates.fullName;
  }

  if (typeof rawBody.username === "string") {
    const nextUsername = normalizeString(rawBody.username);
    const currentUsername = normalizeString(currentUser.username);

    if (nextUsername !== currentUsername) {
      const cooldownMessage = getUsernameCooldownMessage(currentUser.lastUsernameChangeAt);

      if (cooldownMessage) {
        usernameChangeBlocked = true;
        usernameChangeMessage = cooldownMessage;
      } else {
        updates.username = nextUsername;
        updates.lastUsernameChangeAt = new Date().toISOString();
      }
    }
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

  return successResponse(res, 200, "User profile updated successfully", {
    ...result,
    usernameChangeBlocked,
    usernameChangeMessage,
  });
});

module.exports = {
  me,
  updateMe,
};
