const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const ApiError = require("../utils/apiError");
const {
  createUser,
  ensureUserCode,
  findUserDocByUsername,
  findUserByUsername,
  getDefaultAvatar,
} = require("./userService");
const { updateUserStreak } = require("./progressService");
const { getLearningPathState } = require("./learningPathService");
const { getLocalDateKey } = require("../utils/dateUtils");
const { rewardDailyLogin } = require("./rewardService");

function buildAuthUserPayload(user) {
  return {
    uid: user.uid,
    userId: user.uid,
    id: user.uid,
    userCode: user.userCode,
    username: user.username,
    role: user.role,
    status: user.status || "active",
    fullName: user.fullName,
    name: user.name,
    gender: user.gender,
    avatar: user.avatar || getDefaultAvatar(user.role, user.gender),
    createdAt: user.createdAt,
    lastUsernameChangeAt: user.lastUsernameChangeAt || null,
    school: user.school,
    className: user.className,
    hobby: user.hobby,
    dream: user.dream,
    phone: user.phone,
    address: user.address,
    note: user.note,
    stats: user.stats,
    subjects: user.subjects,
    classTags: user.classTags,
    activityLogs: user.activityLogs,
    lastStudyDate: user.stats?.lastStudyDate || null,
  };
}

async function registerUser(payload) {
  const existingUser = await findUserByUsername(payload.username);

  if (existingUser) {
    throw new ApiError(409, "Username already exists");
  }

  const hashedPassword = await bcrypt.hash(payload.password, 10);
  const createdUser = await createUser({
    username: payload.username,
    password: hashedPassword,
    role: payload.role,
    fullName: payload.fullName,
    gender: payload.gender,
    email: payload.email || "",
    school: payload.school || "",
    className: payload.className || "",
    hobby: payload.hobby || "",
    dream: payload.dream || "",
    phone: payload.phone || "",
    address: payload.address || "",
    note: payload.note || "",
    stats: payload.stats,
    subjects: payload.subjects,
    classTags: payload.classTags,
  });

  return {
    user: buildAuthUserPayload(createdUser),
  };
}

async function loginUser({ username, password }) {
  const user = await findUserByUsername(username);
  const userDoc = await findUserDocByUsername(username);

  if (!user) {
    throw new ApiError(401, "Tài khoản hoặc mật khẩu không hợp lệ.");
  }

  const hashedPassword = userDoc?.password || null;
  const isPasswordValid = hashedPassword
    ? await bcrypt.compare(password, hashedPassword)
    : false;

  if (!isPasswordValid) {
    throw new ApiError(401, "Tài khoản hoặc mật khẩu không hợp lệ.");
  }

  if (String(user.status || "active").toLowerCase() === "locked") {
    throw new ApiError(403, "Account is locked");
  }

  const normalizedUser = await ensureUserCode(user.uid, user);
  const normalizedRole = String(normalizedUser.role || "").trim().toLowerCase();
  const isStudent = normalizedRole === "student";
  const sessionUser = isStudent
    ? await updateUserStreak(normalizedUser.uid)
    : normalizedUser;

  if (isStudent) {
    await rewardDailyLogin({
      userId: normalizedUser.uid,
      sourceId: getLocalDateKey(),
      idempotencyKey: `daily-login:${normalizedUser.uid}:${getLocalDateKey()}`,
    });

    await getLearningPathState(normalizedUser.uid);
  }

  const token = jwt.sign(
    {
      uid: normalizedUser.uid,
      userId: normalizedUser.uid,
      username: normalizedUser.username,
      role: normalizedUser.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
  );

  return {
    user: buildAuthUserPayload({
      ...sessionUser,
      password: hashedPassword,
    }),
    token,
  };
}

module.exports = {
  loginUser,
  registerUser,
};
