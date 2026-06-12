const { db } = require("../firebase");
const ApiError = require("../utils/apiError");

const usersCollection = db.collection("users");

function normalizeAvatarFilename(filename) {
  if (!filename) {
    return "";
  }

  return String(filename).trim();
}

function getDefaultAvatar(role, gender) {
  if (role === "teacher") {
    return gender === "female" ? "femaleteacher.png" : "maleteacher.png";
  }

  return gender === "female" ? "girl.png" : "boy.png";
}

function getDefaultStats(role) {
  if (role === "teacher") {
    return {
      totalClasses: 0,
      assignmentsCreated: 0,
      studentsManaged: 0,
      averageScore: 0,
    };
  }

  return {
    level: 1,
    streak: 0,
    completedQuestions: 0,
    studyMinutes: 0,
  };
}

function getDefaultSubjects(role) {
  if (role === "teacher") {
    return [];
  }

  return [
    { name: "Phân số", progress: 0, color: "green" },
    { name: "Tỉ số", progress: 0, color: "blue" },
    { name: "Hình học", progress: 0, color: "purple" },
    { name: "Đo lường", progress: 0, color: "orange" },
  ];
}

function getFormattedTimestamp(value) {
  if (!value) {
    return new Date().toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  return new Date(value).toISOString();
}

function mapUserDoc(doc) {
  if (!doc || !doc.exists) {
    return null;
  }

  const data = doc.data() || {};
  const joinedClasses = Array.isArray(data.joinedClasses) ? data.joinedClasses : [];
  const classIds = Array.isArray(data.classIds) ? data.classIds : [];
  const resolvedClassIds = Array.from(
    new Set([...classIds, ...joinedClasses].map((value) => String(value || "").trim()).filter(Boolean)),
  );

  return {
    uid: doc.id,
    id: doc.id,
    userCode: data.userCode || "",
    name: data.name || data.fullName || "",
    fullName: data.fullName || data.name || "",
    username: data.username || "",
    email: data.email || "",
    gender: data.gender || "",
    role: data.role || "",
    avatar: normalizeAvatarFilename(data.avatar || ""),
    createdAt: getFormattedTimestamp(data.createdAt),
    updatedAt: getFormattedTimestamp(data.updatedAt || data.createdAt),
    school: data.school || "",
    className: data.className || "",
    hobby: data.hobby || "",
    dream: data.dream || "",
    phone: data.phone || "",
    address: data.address || "",
    note: data.note || "",
    stats: data.stats || getDefaultStats(data.role),
    subjects: Array.isArray(data.subjects) ? data.subjects : getDefaultSubjects(data.role),
    classTags: Array.isArray(data.classTags) ? data.classTags : [],
    classIds: resolvedClassIds,
    joinedClasses: resolvedClassIds,
  };
}

async function generateUniqueUserCode(role) {
  const prefix = role === "teacher" ? "GV" : "HS";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    const userCode = `${prefix}${suffix}`;
    const snapshot = await usersCollection.where("userCode", "==", userCode).limit(1).get();

    if (snapshot.empty) {
      return userCode;
    }
  }

  throw new ApiError(500, "Unable to generate a unique user code");
}

async function findUserByUsername(username) {
  const snapshot = await usersCollection.where("username", "==", username).limit(1).get();

  if (snapshot.empty) {
    return null;
  }

  return mapUserDoc(snapshot.docs[0]);
}

async function findUserDocByUsername(username) {
  const snapshot = await usersCollection.where("username", "==", username).limit(1).get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];

  return {
    uid: doc.id,
    id: doc.id,
    ...doc.data(),
  };
}

async function findUserById(uid) {
  if (!uid) {
    return null;
  }

  const doc = await usersCollection.doc(uid).get();

  if (doc.exists) {
    return mapUserDoc(doc);
  }

  const legacySnapshot = await usersCollection.where("uid", "==", uid).limit(1).get();

  if (legacySnapshot.empty) {
    return null;
  }

  return mapUserDoc(legacySnapshot.docs[0]);
}

async function ensureUserCode(uid, userData) {
  if (!uid || !userData) {
    return userData;
  }

  if (userData.userCode) {
    return userData;
  }

  const role = userData.role || "student";
  const userCode = await generateUniqueUserCode(role);

  await usersCollection.doc(uid).set(
    {
      userCode,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return {
    ...userData,
    userCode,
  };
}

async function createUser(userData) {
  const role = userData.role;
  const gender = userData.gender;
  const docRef = usersCollection.doc();
  const createdAt = userData.createdAt || new Date().toISOString();
  const userCode = userData.userCode || (await generateUniqueUserCode(role));
  const avatar = normalizeAvatarFilename(
    userData.avatar || getDefaultAvatar(role, gender)
  );

  const record = {
    uid: docRef.id,
    userCode,
    name: userData.fullName || userData.name || "",
    fullName: userData.fullName || userData.name || "",
    username: userData.username || "",
    password: userData.password || "",
    email: userData.email || "",
    role,
    gender,
    avatar,
    school: userData.school || "",
    className: userData.className || "",
    hobby: userData.hobby || "",
    dream: userData.dream || "",
    phone: userData.phone || "",
    address: userData.address || "",
    note: userData.note || "",
    stats: userData.stats || getDefaultStats(role),
    subjects: Array.isArray(userData.subjects) ? userData.subjects : getDefaultSubjects(role),
    classTags: Array.isArray(userData.classTags) ? userData.classTags : [],
    classIds: Array.isArray(userData.classIds) ? userData.classIds : [],
    joinedClasses: Array.isArray(userData.joinedClasses) ? userData.joinedClasses : [],
    createdAt,
    updatedAt: createdAt,
  };

  await docRef.set(record);

  return mapUserDoc({
    id: docRef.id,
    exists: true,
    data: () => record,
  });
}

async function updateUserById(uid, updates) {
  if (!uid) {
    throw new ApiError(400, "uid is required");
  }

  const docRef = usersCollection.doc(uid);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    throw new ApiError(404, "User document not found");
  }

  const current = snapshot.data() || {};
  const nextRole = updates.role || current.role;
  const nextGender = updates.gender || current.gender;
  const currentAvatar = normalizeAvatarFilename(current.avatar || "");
  const shouldRecomputeAvatar = Boolean(updates.role || updates.gender);

  const safeUpdates = {
    ...updates,
    name: updates.name ?? updates.fullName ?? current.name ?? current.fullName ?? "",
    fullName: updates.fullName ?? updates.name ?? current.fullName ?? current.name ?? "",
    avatar: normalizeAvatarFilename(
      updates.avatar || (shouldRecomputeAvatar ? getDefaultAvatar(nextRole, nextGender) : currentAvatar)
    ),
    updatedAt: new Date().toISOString(),
  };

  delete safeUpdates.uid;
  delete safeUpdates.userCode;
  delete safeUpdates.createdAt;
  delete safeUpdates.password;
  delete safeUpdates.role;
  delete safeUpdates.email;
  delete safeUpdates.stats;
  delete safeUpdates.subjects;
  delete safeUpdates.classTags;
  delete safeUpdates.classIds;
  delete safeUpdates.joinedClasses;

  const nextPayload = {
    ...current,
    ...safeUpdates,
    avatar: normalizeAvatarFilename(
      updates.avatar || (shouldRecomputeAvatar ? getDefaultAvatar(nextRole, nextGender) : currentAvatar)
    ),
    updatedAt: safeUpdates.updatedAt,
  };

  await docRef.set(nextPayload, { merge: true });

  return mapUserDoc({
    id: uid,
    exists: true,
    data: () => nextPayload,
  });
}

module.exports = {
  createUser,
  findUserById,
  findUserByUsername,
  findUserDocByUsername,
  ensureUserCode,
  generateUniqueUserCode,
  getDefaultAvatar,
  mapUserDoc,
  updateUserById,
};
