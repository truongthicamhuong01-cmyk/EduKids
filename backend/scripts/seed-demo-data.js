require("dotenv").config();

const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { admin, db } = require("../src/firebase");
const { createUser, updateUserById } = require("../src/services/userService");
const { joinClass } = require("../src/services/classService");
const { createAssignment, createSubmission } = require("../src/services/assignmentService");
const { createQuizVersion, buildVersionQuizId } = require("../src/services/quizVersionService");
const { buildQuizDocId, readTopicsFile } = require("../src/services/aiService");
const { season1 } = require("../src/services/learningPathData");

const nowIso = () => new Date().toISOString();
const DEMO_MARKER = "seed-demo-data";
const DEMO_ADDRESS = "Xã Sơn Cẩm Hà, thành phố Đà Nẵng";
const DEMO_SCHOOL = "Trường Tiểu học Nguyễn Bá Ngọc";
const DEMO_USERNAME_PREFIXES = ["demo-hs-", "demo-gv-"];
const DEMO_CLASS_PREFIX = "demo-class-";
const DEMO_EMAIL_SUFFIX = "@edukids.demo";

const USER_COUNT = {
  student: 140,
  teacher: 10,
};

const ROLE_PREFIX = {
  student: "hs",
  teacher: "gv",
};

const SUBJECTS = ["math", "english", "vietnamese", "science", "history", "geography"];
const GRADE_SUBJECT_PAIRS = [
  ["1", "math"],
  ["1", "english"],
  ["2", "math"],
  ["2", "english"],
  ["3", "math"],
  ["3", "english"],
  ["3", "vietnamese"],
  ["4", "science"],
  ["4", "history"],
  ["5", "geography"],
];

const SURNAMES = [
  "Nguyễn",
  "Trần",
  "Lê",
  "Phạm",
  "Hoàng",
  "Phan",
  "Vũ",
  "Võ",
  "Đặng",
  "Bùi",
  "Đỗ",
  "Hồ",
  "Ngô",
  "Dương",
  "Lý",
  "Thái",
];

const STUDENT_MIDDLES = [
  "Minh",
  "Thanh",
  "Thu",
  "Gia",
  "Ngọc",
  "Huỳnh",
  "Phương",
  "Diệu",
  "Kim",
  "Quỳnh",
  "Ánh",
  "Bảo",
  "Tâm",
  "Khánh",
  "Linh",
  "Nhàn",
];

const STUDENT_GIVENS = [
  "An",
  "Bao",
  "Chi",
  "Dung",
  "Em",
  "Giang",
  "Hà",
  "Khang",
  "Lan",
  "Lam",
  "Mai",
  "Nam",
  "Nhi",
  "Phuc",
  "Quang",
  "Quỳnh",
  "Son",
  "Tam",
  "Tuan",
  "Vy",
  "Yến",
  "Ý",
];

const TEACHER_MIDDLES = [
  "Hồng",
  "Thu",
  "Thanh",
  "Quỳnh",
  "Mai",
  "Ngọc",
  "Bảo",
  "Minh",
  "Diệu",
  "Xuân",
];

const TEACHER_GIVENS = [
  "Anh",
  "Linh",
  "Hạnh",
  "Lan",
  "Hoa",
  "Phương",
  "Trang",
  "Tuấn",
  "Khánh",
  "Đức",
];

const PET_TYPES = ["horse", "elephant"];
const BADGE_POOL = ["badge_star", "badge_math", "badge_reading", "badge_pet", "badge_path", "badge_bonus"];
const INVENTORY_ITEMS = [
  "biscuit",
  "milk",
  "apple",
  "carrot",
  "ball",
  "teddy",
  "kite",
  "pinwheel",
  "bandage",
  "vitamin",
];

const QUIZ_VERSION_COUNT = 1;
const ASSIGNMENTS_PER_CLASS = 2;
const SUBMISSIONS_PER_ASSIGNMENT = 4;

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hashText(value, length = 8) {
  return crypto
    .createHash("sha1")
    .update(String(value || ""))
    .digest("hex")
    .slice(0, length);
}

function sha1Text(value) {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex");
}

function isPlainObject(value) {
  return Boolean(value) && Object.prototype.toString.call(value) === "[object Object]";
}

function pruneUndefined(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => pruneUndefined(item))
      .filter((item) => item !== undefined);
  }

  if (isPlainObject(value)) {
    const next = {};

    Object.entries(value).forEach(([key, item]) => {
      if (typeof item === "undefined") {
        return;
      }

      const sanitized = pruneUndefined(item);

      if (typeof sanitized === "undefined") {
        return;
      }

      next[key] = sanitized;
    });

    return next;
  }

  return value;
}

function cleanForFirestore(value) {
  return pruneUndefined(value);
}

async function safeSet(ref, data, options = { merge: false }) {
  const payload = cleanForFirestore(data);
  return ref.set(payload, options);
}

async function safeUpdate(ref, data, options = {}) {
  const payload = cleanForFirestore(data);
  return ref.update(payload, options);
}

async function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function deleteDocument(ref) {
  if (!ref) {
    return;
  }

  await ref.delete().catch(() => null);
}

async function deleteRefsInBatches(refs, batchSize = 400) {
  const validRefs = refs.filter(Boolean);

  for (let index = 0; index < validRefs.length; index += batchSize) {
    const batch = db.batch();
    const chunk = validRefs.slice(index, index + batchSize);
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function deleteQueryResults(query) {
  const snapshot = await query.get().catch(() => null);
  if (!snapshot || snapshot.empty) {
    return;
  }

  for (const doc of snapshot.docs) {
    await deleteDocument(doc.ref);
  }
}

function chunkArray(items, size = 10) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function isDemoUsername(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return DEMO_USERNAME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isDemoEmail(value) {
  return String(value || "").trim().toLowerCase().endsWith(DEMO_EMAIL_SUFFIX);
}

function isDemoClassId(value) {
  return String(value || "").trim().toLowerCase().startsWith(DEMO_CLASS_PREFIX);
}

function isDemoUserRecord(user) {
  return (
    String(user?.seedSource || "") === DEMO_MARKER ||
    isDemoUsername(user?.username) ||
    isDemoEmail(user?.email)
  );
}

function buildDemoQuizIds(classPlan, topics) {
  return classPlan
    .map((classroom) => selectTopicForClass(classroom, topics))
    .filter(Boolean)
    .map((topic) => buildQuizDocId(topic.grade, topic.subject, topic.topicId));
}

async function cleanupDemoQuizDoc(quizRootRef) {
  const rootSnapshot = await quizRootRef.get().catch(() => null);
  if (!rootSnapshot || !rootSnapshot.exists) {
    return;
  }

  const rootData = rootSnapshot.data() || {};
  const versionSnapshot = await quizRootRef.collection("versions").doc("v1").get().catch(() => null);
  const versionData = versionSnapshot && versionSnapshot.exists ? versionSnapshot.data() || {} : {};
  const payloadSource = versionData?.data?.source || rootData.source;
  const hasDemoMarker = String(rootData.seedSource || "") === DEMO_MARKER || String(versionData?.data?.seedSource || "") === DEMO_MARKER;

  if (hasDemoMarker || payloadSource === "demo-seed") {
    await deleteDocument(quizRootRef.collection("versions").doc("v1"));
    await deleteDocument(quizRootRef);
  }
}

async function cleanupPreviousDemoData(existingUsers, roster, topics) {
  const existingByUsername = new Map(
    existingUsers.map((user) => [String(user.username || "").trim().toLowerCase(), user]),
  );
  const orderedTeachers = roster
    .filter((user) => user.role === "teacher")
    .map((teacher) => existingByUsername.get(String(teacher.username || "").trim().toLowerCase()))
    .filter(Boolean);
  const orderedStudents = roster
    .filter((user) => user.role === "student")
    .map((student) => existingByUsername.get(String(student.username || "").trim().toLowerCase()))
    .filter(Boolean);
  const classPlan = buildClassPlan(orderedTeachers);
  const studentChunks = chunkArray(orderedStudents, 7);

  const step = async (label, refs) => {
    const filteredRefs = refs.filter(Boolean);
    console.log(`[seed-demo] Cleanup ${label} started`, { count: filteredRefs.length });
    await deleteRefsInBatches(filteredRefs);
    console.log(`[seed-demo] Cleanup ${label} completed`, { count: filteredRefs.length });
  };

  const usersRefs = [];
  const learningPathRefs = [];
  const coachCacheRefs = [];
  const wrongAnswerRefs = [];
  const userMetaRefs = [];
  const battleSessionRefs = [];
  const aiUsageRefs = [];
  const rewardReceiptRefs = [];
  const rewardLedgerRefs = [];
  const classRefs = [];
  const assignmentRefs = [];
  const submissionRefs = [];
  const userProgressRefs = [];
  const quizRefs = [];

  for (let index = 0; index < orderedStudents.length; index += 1) {
    const student = orderedStudents[index];
    const uid = String(student.uid || student.id || "").trim();

    if (!uid) {
      continue;
    }

    usersRefs.push(
      db.collection("users").doc(uid),
    );
    learningPathRefs.push(
      db.collection("learningPathProgress").doc(uid),
    );
    coachCacheRefs.push(
      db.collection("coach_analysis_cache").doc(uid),
    );
    wrongAnswerRefs.push(
      db.collection("wrong_answers").doc(uid),
    );

    userMetaRefs.push(
      db.collection("users").doc(uid).collection("pet").doc("state"),
      db.collection("users").doc(uid).collection("inventory").doc("state"),
      db.collection("users").doc(uid).collection("petRequests").doc(hashText(`${uid}:select`, 12)),
      db.collection("users").doc(uid).collection("inventoryTransactions").doc(hashText(`${uid}:seed`, 12)),
      db.collection("users").doc(uid).collection("shopTransactions").doc(hashText(`${uid}:shop`, 12)),
    );

    battleSessionRefs.push(db.collection("battle_sessions").doc(`demo-battle-${hashText(uid, 10)}-${index}`));
    aiUsageRefs.push(db.collection("ai_usage_logs").doc(`${uid}-${index}`));
    rewardReceiptRefs.push(
      db.collection("user_reward_receipts").doc(`${uid}-dailyLogin-0`),
      db.collection("user_reward_receipts").doc(`${uid}-assignment-1`),
    );
    rewardLedgerRefs.push(
      db.collection("rewardLedger").doc(sha1Text(`dailyLogin:${uid}:0`)),
      db.collection("rewardLedger").doc(sha1Text(`assignment:${uid}:1`)),
    );
  }

  for (let classIndex = 0; classIndex < classPlan.length; classIndex += 1) {
    const classroom = classPlan[classIndex];
    const classId = String(classroom.classId || "").trim();
    const students = studentChunks[classIndex] || [];
    const topicCandidates = getClassTopicCandidates(classroom, topics);
    const topicPool = topicCandidates.length > 0 ? topicCandidates : topics;
    const progressTopics = topicPool.slice(0, 4);
    const quizTopic = selectTopicForClass(classroom, topics);
    const quizId = buildQuizDocId(quizTopic.grade, quizTopic.subject, quizTopic.topicId);
    const quizRootRef = db.collection("quizzes").doc(quizId);
    const quizVersionRef = quizRootRef.collection("versions").doc("v1");

    classRefs.push(db.collection("classes").doc(classId));
    assignmentRefs.push(
      db.collection("classes").doc(classId).collection("assignments").doc(`${classId}-assignment-1`),
      db.collection("classes").doc(classId).collection("assignments").doc(`${classId}-assignment-2`),
      db.collection("assignments").doc(`${classId}-assignment-1`),
      db.collection("assignments").doc(`${classId}-assignment-2`),
    );

    for (let studentOffset = 0; studentOffset < students.length; studentOffset += 1) {
      const student = students[studentOffset];
      const uid = String(student.uid || student.id || "").trim();

      if (!uid) {
        continue;
      }

      const assignmentIds = [
        `${classId}-assignment-1`,
        `${classId}-assignment-2`,
      ];

      assignmentIds.forEach((assignmentId) => {
        submissionRefs.push(db.collection("assignment_submissions").doc(`${assignmentId}_${uid}`));
      });

      progressTopics.forEach((topic) => {
        userProgressRefs.push(db.collection("user_progress").doc(uid).collection("topics").doc(topic.topicId));
      });
    }

    const rootSnapshot = await quizRootRef.get().catch(() => null);
    const hasDemoQuiz = rootSnapshot && rootSnapshot.exists && String(rootSnapshot.data()?.seedSource || "") === DEMO_MARKER;
    if (hasDemoQuiz) {
      quizRefs.push(quizVersionRef, quizRootRef);
    }
  }

  console.log("[seed-demo] Cleanup plan prepared", {
    users: usersRefs.length,
    learningPathProgress: learningPathRefs.length,
    coachAnalysisCache: coachCacheRefs.length,
    wrongAnswers: wrongAnswerRefs.length,
    userMeta: userMetaRefs.length,
    battleSessions: battleSessionRefs.length,
    aiUsageLogs: aiUsageRefs.length,
    userRewardReceipts: rewardReceiptRefs.length,
    rewardLedger: rewardLedgerRefs.length,
    classes: classRefs.length,
    assignments: assignmentRefs.length,
    submissions: submissionRefs.length,
    userProgress: userProgressRefs.length,
    quizzes: quizRefs.length,
  });

  await step("users", usersRefs);
  await step("learningPathProgress", learningPathRefs);
  await step("coach_analysis_cache", coachCacheRefs);
  await step("wrong_answers", wrongAnswerRefs);
  await step("user meta", userMetaRefs);
  await step("battle_sessions", battleSessionRefs);
  await step("ai_usage_logs", aiUsageRefs);
  await step("user_reward_receipts", rewardReceiptRefs);
  await step("rewardLedger", rewardLedgerRefs);
  await step("classes", classRefs);
  await step("assignments", assignmentRefs);
  await step("submissions", submissionRefs);
  await step("user_progress", userProgressRefs);
  await step("quizzes", quizRefs);
}

function pickByIndex(list, index, offset = 0) {
  if (!Array.isArray(list) || list.length === 0) {
    return "";
  }

  return list[(index + offset) % list.length];
}

function uniqueValue(base, usedValues, suffixSeed = "") {
  let candidate = String(base || "").trim();
  let counter = 0;

  while (!candidate || usedValues.has(candidate)) {
    counter += 1;
    candidate = `${base}-${hashText(`${suffixSeed}:${counter}`, 4)}`;
  }

  usedValues.add(candidate);
  return candidate;
}

function buildVietnameseFullName(role, index, gender) {
  const surname = pickByIndex(SURNAMES, index, role === "teacher" ? 2 : 0);
  const suffix = gender === "female" ? "đẹp gái" : "đẹp trai";

  if (role === "teacher") {
    const middle = pickByIndex(TEACHER_MIDDLES, index, Math.floor(index / TEACHER_MIDDLES.length));
    const given = pickByIndex(TEACHER_GIVENS, index, Math.floor(index / TEACHER_GIVENS.length));
    return `${surname} ${middle} ${given} ${suffix}`;
  }

  const middle = pickByIndex(STUDENT_MIDDLES, index, Math.floor(index / STUDENT_MIDDLES.length));
  const given = pickByIndex(STUDENT_GIVENS, index, Math.floor(index / STUDENT_GIVENS.length));
  return `${surname} ${middle} ${given} ${suffix}`;
}

function buildUsername(role, fullName, index, existingUsernames, usedUsernames) {
  const rolePrefix = ROLE_PREFIX[role] || "demo";
  const slug = slugify(fullName);
  const suffix = hashText(`${role}:${fullName}:${index}`, 4);
  const base = `demo-${rolePrefix}-${slug}-${suffix}`;
  return uniqueValue(base, new Set([...existingUsernames, ...usedUsernames]), `${role}:${index}`);
}

function buildEmail(username) {
  return `${username}@edukids.demo`;
}

function buildGender(index, role) {
  const isFemale = (index + (role === "teacher" ? 1 : 0)) % 2 === 0;
  return isFemale ? "female" : "male";
}

function buildAvatar(role, gender) {
  if (role === "teacher") {
    return gender === "female" ? "femaleteacher.png" : "maleteacher.png";
  }

  return gender === "female" ? "girl.png" : "boy.png";
}

function buildStudentStats(index, classIndex) {
  const level = 1 + (index % 18);
  const exp = 20 + ((index * 37) % 760);
  const eduCoin = 120 + ((index * 53 + classIndex * 19) % 1800);
  const totalEduCoinSpent = Math.floor(eduCoin * (0.25 + ((index % 5) * 0.1)));
  const totalEduCoinEarned = eduCoin + totalEduCoinSpent;
  const studyMinutes = 35 + ((index * 17 + classIndex * 11) % 780);
  const streak = 1 + (index % 14);
  const averageScore = Number((6.2 + ((index % 9) * 0.4)).toFixed(1));

  return {
    level,
    exp,
    streak,
    lastStudyDate: new Date(Date.now() - ((index % 6) * 86400000)).toISOString(),
    completedQuestions: 60 + index * 9,
    studyMinutes,
    eduCoin,
    totalEduCoinEarned,
    totalEduCoinSpent,
    averageScore,
    lastRewardAt: new Date(Date.now() - ((index % 4) * 43200000)).toISOString(),
  };
}

function buildTeacherStats(index) {
  return {
    totalClasses: 0,
    assignmentsCreated: 0,
    studentsManaged: 0,
    averageScore: Number((7.1 + (index % 4) * 0.3).toFixed(1)),
  };
}

function buildActivityLogs(userId, topics, quizId, baseScore, count = 4) {
  const logs = [];
  const now = new Date();

  for (let index = 0; index < count; index += 1) {
    const topic = topics[index % topics.length];
    const completedAt = new Date(now.getTime() - index * 86400000 - 3600000).toISOString();

    logs.push({
      id: `${userId}:activity:${index}`,
      idempotencyKey: `${userId}:activity:${index}`,
      sourceType: index % 2 === 0 ? "quiz" : "assignment",
      sourceId: `${quizId}:${index}`,
      topicId: topic.topicId,
      quizId,
      startedAt: new Date(new Date(completedAt).getTime() - 1800000).toISOString(),
      completedAt,
      score: Number((baseScore - index * 0.2).toFixed(1)),
      accuracy: Math.max(0, Math.min(100, Math.round((baseScore - index * 0.2) * 10))),
      totalQuestions: 10,
      correctAnswers: Math.max(1, Math.round(((baseScore - index * 0.2) / 10) * 10)),
      wrongAnswers: Math.max(0, 10 - Math.round(((baseScore - index * 0.2) / 10) * 10)),
      studyMinutes: 15 + index * 10,
      createdAt: completedAt,
      updatedAt: completedAt,
    });
  }

  return logs;
}

function buildSubjectsForStudent(classroom) {
  const subject = String(classroom.subject || "").trim();
  return SUBJECTS.includes(subject) ? [{ name: subject, progress: 50, color: "blue" }] : [];
}

function buildInventoryState(index, level) {
  const foods = {};
  const toys = {};
  const medicine = {};
  const now = nowIso();

  INVENTORY_ITEMS.forEach((itemId, itemIndex) => {
    const quantity = 1 + ((index + itemIndex) % 4);
    const equipped = itemIndex === 4 || itemIndex === 5 ? quantity > 1 && level >= 2 : false;

    const category = itemIndex < 4 ? "foods" : itemIndex < 8 ? "toys" : "medicine";
    const target =
      category === "foods" ? foods : category === "toys" ? toys : medicine;

    target[itemId] = {
      itemId,
      quantity,
      equipped,
      updatedAt: now,
      metadata: {
        source: "demo",
        index: itemIndex,
      },
      ...(itemId === "teddy" || itemId === "kite" ? { durability: 70 + (index % 20), maxDurability: 100 } : {}),
    };
  });

  return {
    seedSource: DEMO_MARKER,
    categories: {
      foods,
      toys,
      medicine,
      decoration: {},
      special: {},
    },
    updatedAt: now,
    version: 1 + (index % 6),
  };
}

function buildPetState(index, fullName) {
  const petTypeId = PET_TYPES[index % PET_TYPES.length];
  const level = 1 + (index % 20);
  const exp = 15 + ((index * 29) % 240);
  const hunger = 45 + (index % 45);
  const happiness = 50 + ((index * 7) % 40);
  const energy = 40 + ((index * 11) % 50);
  const health = 55 + ((index * 5) % 35);
  const createdAt = new Date(Date.now() - ((index % 12) * 86400000)).toISOString();

  return {
    seedSource: DEMO_MARKER,
    petTypeId,
    petName: `${fullName.split(" ")[1] || "Pet"} ${index + 1}`,
    level,
    exp,
    hunger,
    happiness,
    energy,
    health,
    status: "active",
    createdAt,
    updatedAt: createdAt,
    lastUpdateAt: createdAt,
    lastLoginAt: createdAt,
    lastActionAt: createdAt,
    lastFeedAt: new Date(Date.now() - ((index % 4) * 3600000)).toISOString(),
    lastPlayAt: new Date(Date.now() - ((index % 5) * 5400000)).toISOString(),
    lastSleepAt: "",
    selectedAt: createdAt,
    version: 1,
  };
}

function buildLearningPathState(userId, studentIndex, classroom) {
  const seasonId = season1.id;
  const mountain = season1.mountains[studentIndex % season1.mountains.length];
  const checkpoint = mountain.checkpoints[Math.min(6, 1 + (studentIndex % 5))];
  const completedCheckpoints = mountain.checkpoints.slice(0, 1 + (studentIndex % 3)).map((item) => item.id);
  const rewardedXu = 70 + (studentIndex % 8) * 35;
  const rewardedExp = 100 + (studentIndex % 8) * 25;
  const badgeIds = studentIndex % 3 === 0 ? [mountain.badge.id] : [];
  const now = nowIso();

  return {
    seedSource: DEMO_MARKER,
    userId,
    seasonId,
    mountainId: mountain.id,
    checkpointId: checkpoint.id,
    currentCheckpointId: checkpoint.id,
    currentSeason: seasonId,
    currentMountain: mountain.id,
    currentCheckpoint: checkpoint.id,
    progress: {
      currentCheckpointId: checkpoint.id,
      currentCheckpoint: checkpoint.id,
      completedCheckpoints,
      completedMountains: studentIndex % 4 === 0 ? [mountain.id] : [],
    },
    rewards: {
      xu: rewardedXu,
      exp: rewardedExp,
      badges: badgeIds,
    },
    limits: {
      dailyCheckpointCount: studentIndex % 3,
      weeklySummitCount: studentIndex % 2,
      lastResetDate: now.slice(0, 10),
      lastResetWeek: `${now.slice(0, 4)}-W${String(1 + (studentIndex % 52)).padStart(2, "0")}`,
      lastCheckpointCompletedAt: new Date(Date.now() - (studentIndex % 6) * 86400000).toISOString(),
      lastSummitCompletedAt: studentIndex % 4 === 0 ? new Date(Date.now() - 86400000).toISOString() : "",
    },
    wallet: {
      eduCoin: 120 + (studentIndex % 12) * 30,
    },
    updatedAt: now,
  };
}

function buildQuizQuestions(topic, seedIndex) {
  const grade = String(topic.grade || "").trim();
  const subject = String(topic.subject || "").trim();
  const topicName = String(topic.title || topic.name || topic.topicName || "").trim();
  const questions = [];

  for (let index = 0; index < 10; index += 1) {
    const base = seedIndex * 10 + index + 1;

    if (subject === "math") {
      const a = 2 + ((base * 3) % 15);
      const b = 2 + ((base * 5) % 13);
      const answer = a + b;
      questions.push({
        id: `q${index + 1}`,
        question: `Lớp ${grade}: ${a} + ${b} bằng bao nhiêu?`,
        options: [
          { label: "A", text: String(answer), correct: true },
          { label: "B", text: String(answer + 1), correct: false },
          { label: "C", text: String(Math.max(0, answer - 1)), correct: false },
          { label: "D", text: String(answer + 3), correct: false },
        ],
        correctAnswer: "A",
      });
      continue;
    }

    if (subject === "english") {
      const options = [
        `${topicName} lesson`,
        `${topicName} book`,
        `${topicName} desk`,
        `${topicName} bag`,
      ];
      questions.push({
        id: `q${index + 1}`,
        question: `Which phrase matches the topic "${topicName}"?`,
        options: options.map((text, optionIndex) => ({
          label: String.fromCharCode(65 + optionIndex),
          text,
          correct: optionIndex === 0,
        })),
        correctAnswer: "A",
      });
      continue;
    }

    if (subject === "vietnamese") {
      questions.push({
        id: `q${index + 1}`,
        question: `Từ nào phù hợp nhất với chủ đề "${topicName}"?`,
        options: [
          { label: "A", text: `Đúng ${topicName}`, correct: true },
          { label: "B", text: `Sai ${topicName}`, correct: false },
          { label: "C", text: `Gần ${topicName}`, correct: false },
          { label: "D", text: `Khác ${topicName}`, correct: false },
        ],
        correctAnswer: "A",
      });
      continue;
    }

    if (subject === "science") {
      questions.push({
        id: `q${index + 1}`,
        question: `Trong chủ đề "${topicName}", đâu là mô tả đúng nhất?`,
        options: [
          { label: "A", text: `Hiểu đúng về ${topicName}`, correct: true },
          { label: "B", text: `Chọn ngẫu nhiên`, correct: false },
          { label: "C", text: `Không liên quan`, correct: false },
          { label: "D", text: `Sai nội dung`, correct: false },
        ],
        correctAnswer: "A",
      });
      continue;
    }

    if (subject === "history") {
      questions.push({
        id: `q${index + 1}`,
        question: `Sự kiện nào gắn với chủ đề "${topicName}"?`,
        options: [
          { label: "A", text: `Sự kiện chính của ${topicName}`, correct: true },
          { label: "B", text: `Sự kiện phụ`, correct: false },
          { label: "C", text: `Không phải lịch sử`, correct: false },
          { label: "D", text: `Tình huống khác`, correct: false },
        ],
        correctAnswer: "A",
      });
      continue;
    }

    questions.push({
      id: `q${index + 1}`,
      question: `Địa danh nào đúng với chủ đề "${topicName}"?`,
      options: [
        { label: "A", text: `Địa danh ${topicName}`, correct: true },
        { label: "B", text: "Phương án B", correct: false },
        { label: "C", text: "Phương án C", correct: false },
        { label: "D", text: "Phương án D", correct: false },
      ],
      correctAnswer: "A",
    });
  }

  return questions;
}

function buildAssignmentQuestions(topic, seedIndex) {
  const questions = buildQuizQuestions(topic, seedIndex);
  return questions.map((question) => ({
    ...question,
    options: question.options.map((option) => option.text),
    correctAnswer: question.options[0]?.text || "",
    correctAnswerIndex: 0,
  }));
}

async function docExists(ref) {
  const snapshot = await ref.get();
  return snapshot.exists;
}

async function ensureDoc(ref, data) {
  const exists = await docExists(ref);
  if (exists) {
    return false;
  }

  await safeSet(ref, data, { merge: false });
  return true;
}

async function fetchExistingUsers() {
  const snapshot = await db.collection("users").get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    uid: doc.id,
    ...(doc.data() || {}),
  }));
}

function buildDesiredRoster() {
  const roster = [];

  for (let index = 0; index < USER_COUNT.teacher; index += 1) {
    const gender = buildGender(index, "teacher");
    const fullName = buildVietnameseFullName("teacher", index, gender);
    roster.push({
      role: "teacher",
      index,
      fullName,
      username: `demo-gv-${slugify(fullName)}-${String(index + 1).padStart(2, "0")}`,
      email: buildEmail(`demo-gv-${slugify(fullName)}-${String(index + 1).padStart(2, "0")}`),
      gender,
      school: DEMO_SCHOOL,
      className: "",
      hobby: index % 2 === 0 ? "Đọc sách" : "Âm nhạc",
      dream: index % 2 === 0 ? "Giúp học sinh tự tin học tập" : "Xây dựng lớp học vui vẻ",
      phone: "",
      address: DEMO_ADDRESS,
      note: "Tài khoản demo giáo viên",
      password: "Demo@12345",
      stats: buildTeacherStats(index),
    });
  }

  for (let index = 0; index < USER_COUNT.student; index += 1) {
    const gender = buildGender(index, "student");
    const fullName = buildVietnameseFullName("student", index, gender);
    roster.push({
      role: "student",
      index,
      fullName,
      username: `demo-hs-${slugify(fullName)}-${String(index + 1).padStart(3, "0")}`,
      email: buildEmail(`demo-hs-${slugify(fullName)}-${String(index + 1).padStart(3, "0")}`),
      gender,
      school: DEMO_SCHOOL,
      className: "",
      hobby: index % 3 === 0 ? "Vẽ tranh" : index % 3 === 1 ? "Bóng đá" : "Đọc truyện",
      dream: index % 2 === 0 ? "Học giỏi Toán" : "Trở thành lớp trưởng",
      phone: "",
      address: DEMO_ADDRESS,
      note: "Tài khoản demo học sinh",
      password: "Demo@12345",
      stats: buildStudentStats(index, Math.floor(index / 7)),
    });
  }

  return roster;
}

function buildClassPlan(teachers) {
  const classPlan = [];

  teachers.forEach((teacher, teacherIndex) => {
    const firstPair = GRADE_SUBJECT_PAIRS[(teacherIndex * 2) % GRADE_SUBJECT_PAIRS.length];
    const secondPair = GRADE_SUBJECT_PAIRS[(teacherIndex * 2 + 1) % GRADE_SUBJECT_PAIRS.length];

    classPlan.push({
      classId: `demo-class-${String(teacherIndex + 1).padStart(2, "0")}-a`,
      teacher,
      section: "A",
      grade: firstPair[0],
      subject: firstPair[1],
    });

    classPlan.push({
      classId: `demo-class-${String(teacherIndex + 1).padStart(2, "0")}-b`,
      teacher,
      section: "B",
      grade: secondPair[0],
      subject: secondPair[1],
    });
  });

  return classPlan;
}

function buildClassDoc(classroom, teacher, classIndex) {
  const gradeLabel = `Lớp ${classroom.grade}${classroom.section}`;
  const classCode = `DM${hashText(classroom.classId, 6).toUpperCase()}`;
  const createdAt = new Date(Date.now() - classIndex * 86400000).toISOString();

  return {
    seedSource: DEMO_MARKER,
    id: classroom.classId,
    name: `${gradeLabel} - ${teacher.fullName}`,
    className: `${gradeLabel} - ${teacher.fullName}`,
    description: `Lớp demo ${gradeLabel.toLowerCase()} môn ${classroom.subject}`,
    teacherId: teacher.uid,
    teacherName: teacher.fullName,
    teacherUsername: teacher.username,
    classCode,
    level: classroom.grade,
    grade: classroom.grade,
    subject: classroom.subject,
    studentCount: 0,
    students: [],
    studentIds: [],
    members: [],
    assignmentIds: [],
    createdAt,
    updatedAt: createdAt,
  };
}

function selectTopicForClass(classroom, topics) {
  const matchingTopics = topics.filter(
    (topic) => String(topic.grade || "").trim() === String(classroom.grade).trim() &&
      String(topic.subject || "").trim() === String(classroom.subject).trim(),
  );

  return matchingTopics.length > 0
    ? matchingTopics[0]
    : topics[(Number(classroom.grade) + classroom.subject.length) % topics.length];
}

function buildQuizPayload(topic, seedIndex) {
  const grade = String(topic.grade || "").trim();
  const subject = String(topic.subject || "").trim();
  const topicId = String(topic.topicId || "").trim();
  const topicName = String(topic.title || topic.name || "").trim();
  const questions = buildQuizQuestions(topic, seedIndex);

  return {
    seedSource: DEMO_MARKER,
    id: buildVersionQuizId({ grade, subject, topicId, versionId: "v1" }),
    grade,
    subject,
    topicId,
    topicName,
    topicDescription: String(topic.description || "").trim(),
    questions,
    source: "demo-seed",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function buildRewardReceipt(userId, source, amount, createdAt) {
  return {
    seedSource: DEMO_MARKER,
    userId,
    amount,
    source,
    createdAt,
    updatedAt: createdAt,
  };
}

function buildWrongAnswers(userId, quiz, score, studentIndex) {
  const wrongQuestions = quiz.questions
    .slice(0, 3)
    .map((question, questionIndex) => {
      const wrongOption = question.options[1];

      return {
        questionIndex,
        question: question.question,
        correctAnswer: "A",
        userAnswer: "B",
        correctAnswerText: question.options[0].text,
        userAnswerText: wrongOption.text,
      };
    });

  const createdAt = new Date(Date.now() - studentIndex * 3600000).toISOString();

  return {
    seedSource: DEMO_MARKER,
    id: userId,
    userId,
    quizId: quiz.id,
    wrongCount: wrongQuestions.length,
    wrongQuestions,
    totalQuestions: quiz.questions.length,
    correctAnswers: Math.max(0, quiz.questions.length - wrongQuestions.length),
    score,
    createdAt,
    updatedAt: createdAt,
  };
}

function buildCoachCache(userId, progressItems, score, topic) {
  const bestTopics = progressItems.slice(0, 2).map((item) => ({
    topicId: item.topicId,
    topicName: item.topicName,
    accuracy: item.accuracy,
    totalAnswered: item.totalAnswered,
  }));

  const weakTopics = [...progressItems]
    .sort((left, right) => left.accuracy - right.accuracy)
    .slice(0, 2)
    .map((item) => ({
      topicId: item.topicId,
      topicName: item.topicName,
      accuracy: item.accuracy,
      totalAnswered: item.totalAnswered,
    }));

  const averageAccuracy = progressItems.length
    ? Math.round(progressItems.reduce((sum, item) => sum + item.accuracy, 0) / progressItems.length)
    : score;

  const topicLabel = topic.topicName || topic.title || topic.topicId || "";
  const focusTopicName = weakTopics[0]?.topicName || topicLabel;
  const focusTopicId = weakTopics[0]?.topicId || topic.topicId || "";
  const analysis = {
    strengths: `Học sinh có tiến bộ tốt ở ${bestTopics[0]?.topicName || topicLabel}.`,
    weaknesses: `Cần luyện thêm ở ${weakTopics[0]?.topicName || topicLabel}.`,
    advice: "Duy trì nhịp học đều và làm thêm bài luyện tập ngắn mỗi ngày.",
    focusTopic: focusTopicName,
    focusTopicId,
    focusTopicName,
  };

  const signature = progressItems
    .map((item) => `${item.topicId}:${item.totalAnswered}:${item.totalCorrect}:${item.percentage}:${item.updatedAt}`)
    .sort()
    .join("|");
  const now = nowIso();

  return {
    seedSource: DEMO_MARKER,
    userId,
    cacheRevision: 0,
    analysis,
    averageAccuracy,
    coachLevel:
      averageAccuracy >= 90
        ? "Xuất sắc"
        : averageAccuracy >= 75
          ? "Tốt"
          : averageAccuracy >= 60
            ? "Đang tiến bộ"
            : "Cần luyện thêm",
    bestTopics,
    weakTopics,
    focusTopicId,
    focusTopicName,
    signature,
    cachedAt: now,
    updatedAt: now,
  };
}

function buildAiUsageLog(userId, topicId, createdAt) {
  return {
    seedSource: DEMO_MARKER,
    userId,
    feature: "coach",
    action: "analyze",
    success: true,
    topicId,
    createdAt,
    updatedAt: createdAt,
  };
}

function buildBattleSession(userId, quiz, studentIndex, topicId) {
  const createdAt = new Date(Date.now() - (studentIndex % 10) * 86400000).toISOString();
  const answers = quiz.questions.map((question, index) => ({
    questionIndex: index,
    selected: index % 4 === 0 ? "A" : "B",
    correct: index % 4 === 0,
    correctAnswer: "A",
    bossHP: Math.max(0, 100 - index * 8),
    playerHP: Math.max(0, 6 - Math.floor(index / 3)),
    combo: index % 4 === 0 ? index + 1 : 0,
    answeredAt: createdAt,
  }));
  const correctAnswers = answers.filter((answer) => answer.correct).length;
  const accuracy = Math.round((correctAnswers / quiz.questions.length) * 100);

  return {
    seedSource: DEMO_MARKER,
    sessionId: `demo-battle-${hashText(userId, 10)}-${studentIndex}`,
    userId,
    topicId,
    quizId: quiz.id,
    currentQuestionIndex: quiz.questions.length,
    bossHP: Math.max(0, 100 - correctAnswers * 10),
    playerHP: Math.max(0, 6 - Math.max(0, quiz.questions.length - correctAnswers)),
    combo: Math.min(7, correctAnswers),
    hintRemaining: 1 + (studentIndex % 3),
    answers,
    status: "completed",
    rewardStatus: "rewarded",
    rewardSummary: {
      xpAwarded: 100 + (studentIndex % 5) * 10,
      coinAwarded: 60 + (studentIndex % 4) * 8,
      accuracy,
      rank: accuracy >= 90 ? "3 Sao" : accuracy >= 70 ? "2 Sao" : "1 Sao",
      rankStars: accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : 1,
      victory: accuracy >= 60,
      correctAnswers,
      totalQuestions: quiz.questions.length,
      maxCombo: Math.max(1, correctAnswers - 1),
      battleStatus: "completed",
      rewardStatus: "rewarded",
      userExpAfter: 0,
      userCoinAfter: 0,
    },
    rewardedAt: createdAt,
    startedAt: createdAt,
    completedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  };
}

function getClassTopicCandidates(classDoc, topics) {
  return topics.filter(
    (topic) => String(topic.grade || "").trim() === String(classDoc.grade).trim() &&
      String(topic.subject || "").trim() === String(classDoc.subject).trim(),
  );
}

async function getCachedQuizData(quizDataCache, quizTopic, seedIndex) {
  const quizKey = buildQuizDocId(quizTopic.grade, quizTopic.subject, quizTopic.topicId);
  if (quizDataCache.has(quizKey)) {
    return quizDataCache.get(quizKey);
  }

  const snapshot = await db.collection("quizzes").doc(quizKey).get();
  const quizData = snapshot.exists
    ? {
        id: buildVersionQuizId({
          grade: quizTopic.grade,
          subject: quizTopic.subject,
          topicId: quizTopic.topicId,
          versionId: "v1",
        }),
        ...(snapshot.data() || {}),
      }
    : buildQuizPayload(quizTopic, seedIndex);

  quizDataCache.set(quizKey, quizData);
  return quizData;
}

async function closeAdminApps() {
  const apps = Array.isArray(admin.apps) ? admin.apps : [];

  await Promise.all(
    apps.map((app) =>
      app.delete().catch(() => null),
    ),
  );
}

async function main() {
  console.log("[seed-demo] START");
  console.log("[seed-demo] Firebase initialized");
  const roster = buildDesiredRoster();
  console.log("[seed-demo] Roster prepared", {
    teachers: USER_COUNT.teacher,
    students: USER_COUNT.student,
  });
  const teachers = roster.filter((user) => user.role === "teacher");
  const topics = readTopicsFile().filter((topic) => topic.grade && topic.subject);
  console.log("[seed-demo] Firestore ready");
  console.log("[seed-demo] Loading existing users");
  const existingUsersBeforeCleanup = await withTimeout(fetchExistingUsers(), 2 * 60 * 1000, "fetchExistingUsers(before cleanup)");
  console.log("[seed-demo] Existing users loaded");
  console.log("[seed-demo] Cleanup started");
  await withTimeout(
    cleanupPreviousDemoData(existingUsersBeforeCleanup, roster, topics),
    10 * 60 * 1000,
    "cleanupPreviousDemoData",
  );
  console.log("[seed-demo] Cleanup completed");
  console.log("[seed-demo] Reloading existing users");
  const existingUsers = await withTimeout(fetchExistingUsers(), 2 * 60 * 1000, "fetchExistingUsers(after cleanup)");
  console.log("[seed-demo] Existing demo users checked");
  const studentsToCreate = roster.filter((user) => user.role === "student");
  const teachersToCreate = teachers;
  const studentRecords = [];
  const teacherRecords = [];
  const userByUsername = new Map(existingUsers.map((user) => [String(user.username || "").trim().toLowerCase(), user]));

  console.log("[seed-demo] existing demo users", {
    students: existingUsers.filter((user) => isDemoUserRecord(user) && String(user.role || "") === "student").length,
    teachers: existingUsers.filter((user) => isDemoUserRecord(user) && String(user.role || "") === "teacher").length,
  });
  console.log("[seed-demo] Users sync started");

  for (const payload of [...teachersToCreate, ...studentsToCreate]) {
    const username = String(payload.username || "").trim().toLowerCase();
    if (userByUsername.has(username)) {
      const existing = userByUsername.get(username);
      const record = {
        ...payload,
        uid: existing.uid || existing.id || payload.username,
        id: existing.uid || existing.id || payload.username,
        avatar: buildAvatar(payload.role, payload.gender),
        createdAt: existing.createdAt || nowIso(),
        updatedAt: nowIso(),
        seedSource: DEMO_MARKER,
      };

      if (isDemoUserRecord(existing)) {
        await updateUserById(record.uid, cleanForFirestore({
          seedSource: DEMO_MARKER,
          username: payload.username,
          role: payload.role,
          fullName: payload.fullName,
          gender: payload.gender,
          email: payload.email,
          school: payload.school,
          className: payload.className,
          hobby: payload.hobby,
          dream: payload.dream,
          phone: payload.phone,
          address: payload.address,
          note: payload.note,
          avatar: buildAvatar(payload.role, payload.gender),
          userCode: `${payload.role === "teacher" ? "GV" : "HS"}${hashText(payload.username, 6).toUpperCase()}`,
          stats: payload.stats,
          subjects: [],
          classTags: [],
          activityLogs: [],
        }));
      }

      if (payload.role === "teacher") {
        teacherRecords.push(record);
      } else {
        studentRecords.push(record);
      }

      userByUsername.set(username, record);
      continue;
    }

    const fullName = payload.fullName;
    const gender = payload.gender;
    const created = await createUser(cleanForFirestore({
      username: payload.username,
      password: await bcrypt.hash(payload.password, 10),
      role: payload.role,
      seedSource: DEMO_MARKER,
      fullName,
      gender,
      email: payload.email,
      school: payload.school,
      className: payload.className,
      hobby: payload.hobby,
      dream: payload.dream,
      phone: payload.phone,
      address: payload.address,
      note: payload.note,
      avatar: buildAvatar(payload.role, gender),
      userCode: `${payload.role === "teacher" ? "GV" : "HS"}${hashText(payload.username, 6).toUpperCase()}`,
      stats: payload.stats,
      subjects: payload.role === "student" ? [] : [],
      classTags: [],
      activityLogs: payload.role === "student" ? [] : [],
    }));

    const record = {
      ...payload,
      uid: created.uid,
      id: created.uid,
      avatar: buildAvatar(payload.role, gender),
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      seedSource: DEMO_MARKER,
    };

    if (payload.role === "teacher") {
      teacherRecords.push(record);
    } else {
      studentRecords.push(record);
    }

    userByUsername.set(username, record);
  }
  console.log("[seed-demo] Users sync completed", {
    teachers: teacherRecords.length,
    students: studentRecords.length,
  });

  const teacherMap = new Map(
    teacherRecords.map((teacher) => [String(teacher.username || "").trim().toLowerCase(), teacher]),
  );
  const orderedTeachers = roster.filter((user) => user.role === "teacher").map((teacher) =>
    teacherMap.get(String(teacher.username || "").trim().toLowerCase()) || teacher,
  ).slice(0, USER_COUNT.teacher);

  const orderedStudents = roster.filter((user) => user.role === "student").map((student) =>
    userByUsername.get(String(student.username || "").trim().toLowerCase()) || student,
  ).slice(0, USER_COUNT.student);

  const studentChunks = [];
  for (let index = 0; index < orderedStudents.length; index += 7) {
    studentChunks.push(orderedStudents.slice(index, index + 7));
  }

  const classPlan = buildClassPlan(orderedTeachers);
  const classDocs = [];
  const quizDocs = [];
  console.log("[seed-demo] Class seeding started");

  for (let classIndex = 0; classIndex < classPlan.length; classIndex += 1) {
    const classroom = classPlan[classIndex];
    const teacher = classroom.teacher;
    const classRef = db.collection("classes").doc(classroom.classId);
    const classDoc = buildClassDoc(classroom, teacher, classIndex);
    const students = studentChunks[classIndex] || [];
    const classSnapshot = await classRef.get();
    const classData = classSnapshot.data() || {};
    const shouldSeedClass = !classSnapshot.exists || isDemoClassId(classroom.classId) || String(classData.seedSource || "") === DEMO_MARKER;

    if (shouldSeedClass) {
      await safeSet(classRef, classDoc, { merge: false });
    }

    const effectiveClassDoc = shouldSeedClass ? classDoc : { id: classroom.classId, ...classData };

    classDocs.push(effectiveClassDoc);

    if (shouldSeedClass) {
      console.log(`[seed-demo] class created ${classroom.classId}`);
    }

    for (const student of students) {
      if (!student?.uid) {
        continue;
      }

      await joinClass({
        classCode: effectiveClassDoc.classCode,
        user: {
          uid: student.uid,
          userId: student.uid,
        },
      });

      await updateUserById(student.uid, cleanForFirestore({
        seedSource: DEMO_MARKER,
        className: effectiveClassDoc.name,
        classTags: [effectiveClassDoc.name],
        classTagNames: [effectiveClassDoc.name],
        subjects: buildSubjectsForStudent(classroom),
        stats: {
          ...(student.stats || {}),
          level: Math.max(1, Number(student.stats?.level || 1)),
        },
      }));
    }

    const topic = selectTopicForClass(classroom, topics);
    const quizRootId = buildQuizDocId(topic.grade, topic.subject, topic.topicId);
    const quizRootRef = db.collection("quizzes").doc(quizRootId);
    const quizRootSnapshot = await quizRootRef.get();
    const quizRootData = quizRootSnapshot.data() || {};
    const shouldSeedQuiz = !quizRootSnapshot.exists || String(quizRootData.seedSource || "") === DEMO_MARKER;

    if (shouldSeedQuiz) {
      const quizPayload = buildQuizPayload(topic, classIndex);
      const quizRoot = {
        seedSource: DEMO_MARKER,
        id: quizRootId,
        grade: quizPayload.grade,
        subject: quizPayload.subject,
        topicId: quizPayload.topicId,
        topicName: quizPayload.topicName,
        topicDescription: quizPayload.topicDescription,
        latestVersionId: "v1",
        versionCount: 1,
        hasVersions: true,
        createdAt: quizPayload.createdAt,
        updatedAt: quizPayload.updatedAt,
      };

      await safeSet(quizRootRef, quizRoot, { merge: false });

      await safeSet(
        quizRootRef.collection("versions").doc("v1"),
        {
          versionId: "v1",
          versionNumber: 1,
          data: {
            seedSource: DEMO_MARKER,
            ...quizPayload,
            id: buildVersionQuizId({
              grade: quizPayload.grade,
              subject: quizPayload.subject,
              topicId: quizPayload.topicId,
              versionId: "v1",
            }),
            versionId: "v1",
            versionNumber: 1,
          },
          createdAt: quizPayload.createdAt,
          updatedAt: quizPayload.updatedAt,
        },
        { merge: false },
      );

      quizDocs.push(quizPayload);
      console.log(`[seed-demo] quiz created ${quizRootId}`);
    }

    for (let assignmentIndex = 0; assignmentIndex < ASSIGNMENTS_PER_CLASS; assignmentIndex += 1) {
      const assignmentId = `${classroom.classId}-assignment-${assignmentIndex + 1}`;
      const assignmentRef = db.collection("assignments").doc(assignmentId);

      if (false && !(await docExists(assignmentRef))) {
        const assignmentQuestions = buildAssignmentQuestions(topic, classIndex + assignmentIndex);
        const createdAt = new Date(Date.now() - (classIndex * 2 + assignmentIndex) * 86400000).toISOString();
        const assignmentData = {
          seedSource: DEMO_MARKER,
          id: assignmentId,
          classId: classroom.classId,
          classCode: effectiveClassDoc.classCode,
          className: effectiveClassDoc.name,
          teacherId: teacher.uid,
          teacherName: teacher.fullName,
          title: `Bài tập ${assignmentIndex + 1} - ${topic.title}`,
          description: `Luyện tập theo chủ đề ${topic.title} của lớp ${classroom.grade}${classroom.section}.`,
          dueDate: new Date(Date.now() + 86400000 * (7 + assignmentIndex)).toISOString(),
          subject: classroom.subject,
          questions: assignmentQuestions,
          totalQuestions: assignmentQuestions.length,
          questionCount: assignmentQuestions.length,
          status: "active",
          createdAt,
          updatedAt: createdAt,
        };

        await safeSet(assignmentRef, assignmentData, { merge: false });
        await safeSet(
          db.collection("classes").doc(classroom.classId).collection("assignments").doc(assignmentId),
          assignmentData,
          { merge: false },
        );
        const nextAssignmentIds = Array.from(
          new Set([
            ...(Array.isArray(effectiveClassDoc.assignmentIds) ? effectiveClassDoc.assignmentIds : []),
            assignmentId,
          ]),
        );
        await safeSet(
          db.collection("classes").doc(classroom.classId),
          {
            ...effectiveClassDoc,
            assignmentIds: nextAssignmentIds,
            updatedAt: createdAt,
          },
          { merge: false },
        );
        console.log(`[seed-demo] assignment created ${assignmentId}`);
      }

      let assignmentSnapshot = await assignmentRef.get();
      let assignmentData = assignmentSnapshot.data() || {};
      const shouldSeedAssignment =
        !assignmentSnapshot.exists ||
        isDemoClassId(classroom.classId) ||
        String(assignmentData.seedSource || "") === DEMO_MARKER;

      if (shouldSeedAssignment) {
        const assignmentQuestions = buildAssignmentQuestions(topic, classIndex + assignmentIndex);
        const createdAt = new Date(Date.now() - (classIndex * 2 + assignmentIndex) * 86400000).toISOString();
        assignmentData = {
          seedSource: DEMO_MARKER,
          id: assignmentId,
          classId: classroom.classId,
          classCode: effectiveClassDoc.classCode,
          className: effectiveClassDoc.name,
          teacherId: teacher.uid,
          teacherName: teacher.fullName,
          title: `Bài tập ${assignmentIndex + 1} - ${topic.title}`,
          description: `Luyện tập theo chủ đề ${topic.title} của lớp ${classroom.grade}${classroom.section}.`,
          dueDate: new Date(Date.now() + 86400000 * (7 + assignmentIndex)).toISOString(),
          subject: classroom.subject,
          questions: assignmentQuestions,
          totalQuestions: assignmentQuestions.length,
          questionCount: assignmentQuestions.length,
          status: "active",
          createdAt,
          updatedAt: createdAt,
        };

        await safeSet(assignmentRef, assignmentData, { merge: false });
        await safeSet(
          db.collection("classes").doc(classroom.classId).collection("assignments").doc(assignmentId),
          assignmentData,
          { merge: false },
        );
        const nextAssignmentIds = Array.from(
          new Set([
            ...(Array.isArray(effectiveClassDoc.assignmentIds) ? effectiveClassDoc.assignmentIds : []),
            assignmentId,
          ]),
        );
        await safeSet(
          db.collection("classes").doc(classroom.classId),
          {
            ...effectiveClassDoc,
            seedSource: DEMO_MARKER,
            assignmentIds: nextAssignmentIds,
            updatedAt: createdAt,
          },
          { merge: false },
        );
        console.log(`[seed-demo] assignment created ${assignmentId}`);
      }
      const submissionStudents = students.slice(0, SUBMISSIONS_PER_ASSIGNMENT);

      for (let studentOffset = 0; studentOffset < submissionStudents.length; studentOffset += 1) {
        const student = submissionStudents[studentOffset];
        if (!student?.uid) {
          continue;
        }

        const submissionId = `${assignmentId}_${student.uid}`;
        const submissionRef = db.collection("assignment_submissions").doc(submissionId);

        const answers = (assignmentData.questions || []).map((question, questionIndex) => ({
          questionIndex,
          selected: questionIndex % 3 === 0 ? "A" : questionIndex % 3 === 1 ? "B" : "A",
        }));

        const gradeScore = Math.max(6, 10 - ((classIndex + assignmentIndex + studentOffset) % 4));
        const correctCount = Math.round((gradeScore / 10) * (assignmentData.questions?.length || 10));
        const wrongCount = Math.max(0, (assignmentData.questions?.length || 10) - correctCount);
        const submittedAt = new Date(Date.now() - (studentOffset + assignmentIndex + classIndex) * 43200000).toISOString();
        const submissionData = {
          seedSource: DEMO_MARKER,
          id: submissionId,
          assignmentId,
          classId: classroom.classId,
          studentId: student.uid,
          answers,
          submittedAt,
          gradedAt: submittedAt,
          status: "graded",
          score: Number((gradeScore / 1).toFixed(1)),
          correctCount,
          wrongCount,
          totalQuestions: assignmentData.questions?.length || 10,
        };

        await safeSet(submissionRef, submissionData, { merge: false });
      }
    }
  }
  console.log("[seed-demo] Class seeding completed", {
    classes: classDocs.length,
    quizzes: quizDocs.length,
  });

  const userProgressCollection = db.collection("user_progress");
  const learningPathCollection = db.collection("learningPathProgress");
  const coachCacheCollection = db.collection("coach_analysis_cache");
  const wrongAnswersCollection = db.collection("wrong_answers");
  const aiUsageCollection = db.collection("ai_usage_logs");
  const rewardReceiptCollection = db.collection("user_reward_receipts");
  const rewardLedgerCollection = db.collection("rewardLedger");
  const battleSessionCollection = db.collection("battle_sessions");
  const quizDataCache = new Map();
  let enrichmentCompleted = 0;
  console.log("[seed-demo] Student enrichment started");

  for (let index = 0; index < orderedStudents.length; index += 1) {
    const student = orderedStudents[index];
    const className = String(student.className || "").trim();
    const classDoc = classDocs[index % classDocs.length];
    const classTopicCandidates = getClassTopicCandidates(classDoc, topics);
    const topicPool = classTopicCandidates.length > 0 ? classTopicCandidates : topics;
    const progressTopics = topicPool.slice(0, 4);
    const quizTopic = selectTopicForClass(classDoc, topics);
    const quizId = buildVersionQuizId({
      grade: quizTopic.grade,
      subject: quizTopic.subject,
      topicId: quizTopic.topicId,
      versionId: "v1",
    });
    const userRef = db.collection("users").doc(student.uid);
    const batch = db.batch();
    const progressDoc = learningPathCollection.doc(student.uid);
    batch.set(progressDoc, buildLearningPathState(student.uid, index, classDoc), { merge: false });
    const progressItems = progressTopics.map((topic, topicIndex) => {
      const totalAnswered = 10 + index + topicIndex * 3;
      const totalCorrect = Math.max(1, totalAnswered - ((index + topicIndex) % 4) - 1);
      const percentage = Math.round((totalCorrect / totalAnswered) * 100);
      const updatedAt = new Date(Date.now() - (topicIndex + (index % 5)) * 86400000).toISOString();

      return {
        seedSource: DEMO_MARKER,
        userId: student.uid,
        topicId: topic.topicId,
        grade: topic.grade,
        subject: topic.subject,
        totalAnswered,
        totalCorrect,
        percentage,
        accuracyUpdatedAt: updatedAt,
        updatedAt,
        lastVersionUsed: "v1",
        history: ["v1"],
      };
    });

    for (const progressItem of progressItems) {
      const ref = userProgressCollection.doc(student.uid).collection("topics").doc(progressItem.topicId);
      batch.set(ref, progressItem, { merge: false });
    }

    const activityLogs = buildActivityLogs(student.uid, progressTopics, quizId, 8.8 - (index % 3) * 0.4, 3);
    const rewards = {
      badges: index % 4 === 0 ? [BADGE_POOL[index % BADGE_POOL.length]] : BADGE_POOL.slice(0, index % 3),
      lastRewardAt: new Date(Date.now() - index * 43200000).toISOString(),
    };
    const studentStats = {
      ...(student.stats || {}),
      level: Math.max(1, Number(student.stats?.level || 1)),
      exp: Math.max(0, Number(student.stats?.exp || 0)),
      streak: Math.max(0, Number(student.stats?.streak || 0)),
      lastStudyDate: student.stats?.lastStudyDate || nowIso(),
      eduCoin: Math.max(0, Number(student.stats?.eduCoin || 0)),
      eduCoins: Math.max(0, Number(student.stats?.eduCoin || 0)),
      averageScore: Number((7.1 + (index % 8) * 0.3).toFixed(1)),
    };

    const quizData = await getCachedQuizData(quizDataCache, quizTopic, index);

    const wrongAnswers = buildWrongAnswers(student.uid, {
      id: quizData.id || quizId,
      questions: buildQuizQuestions(quizTopic, index),
    }, 58, index);
    batch.set(wrongAnswersCollection.doc(student.uid), wrongAnswers, { merge: false });

    const coachCache = buildCoachCache(student.uid, progressItems, 78, quizTopic);
    batch.set(coachCacheCollection.doc(student.uid), coachCache, { merge: false });

    const aiUsageLog = buildAiUsageLog(student.uid, progressTopics[0]?.topicId || quizTopic.topicId, nowIso());
    batch.set(aiUsageCollection.doc(`${student.uid}-${index}`), aiUsageLog, { merge: false });

    const rewardSources = [
      buildRewardReceipt(student.uid, "dailyLogin", 3, nowIso()),
      buildRewardReceipt(student.uid, "assignment", 20 + (index % 5), nowIso()),
    ];

    for (let receiptIndex = 0; receiptIndex < rewardSources.length; receiptIndex += 1) {
      const receipt = rewardSources[receiptIndex];
      const receiptRef = rewardReceiptCollection.doc(`${student.uid}-${receipt.source}-${receiptIndex}`);
      batch.set(receiptRef, receipt, { merge: false });

      const ledgerKey = `${receipt.source}:${student.uid}:${receiptIndex}`;
      const ledgerRef = rewardLedgerCollection.doc(sha1Text(ledgerKey));
      batch.set(
        ledgerRef,
        {
          seedSource: DEMO_MARKER,
          userId: student.uid,
          sourceType: receipt.source,
          sourceId: `${student.uid}:${receiptIndex}`,
          ruleKey: receipt.source,
          idempotencyKey: ledgerKey,
          reward: {
            key: receipt.source,
            title: receipt.source === "dailyLogin" ? "Đăng nhập hằng ngày" : "Hoàn thành bài tập",
            coin: receipt.amount,
            petExp: receipt.source === "dailyLogin" ? 1 : 5,
            petHappiness: receipt.source === "dailyLogin" ? 1 : 3,
            petHealth: 0,
            petEnergy: 0,
            petHunger: 0,
            icon: receipt.source === "dailyLogin" ? "login" : "assignment",
            badges: [],
            sourceType: receipt.source,
            sourceId: `${student.uid}:${receiptIndex}`,
          },
          response: {
            statusCode: 200,
            message: "Nhận thưởng thành công",
            data: {
              reward: {
                title: receipt.source === "dailyLogin" ? "Đăng nhập hằng ngày" : "Hoàn thành bài tập",
                coin: receipt.amount,
              },
              wallet: {
                eduCoin: Number(studentStats.eduCoin || 0) + receipt.amount,
              },
            },
            popupEvents: [],
            animationEvents: [],
            meta: {
              sourceType: receipt.source,
              sourceId: `${student.uid}:${receiptIndex}`,
              ruleKey: receipt.source,
            },
          },
          createdAt: receipt.createdAt,
        },
        { merge: false },
      );
    }

    const battleSession = buildBattleSession(student.uid, {
      id: quizId,
      questions: buildQuizQuestions(quizTopic, index),
    }, index, quizTopic.topicId);
    batch.set(battleSessionCollection.doc(battleSession.sessionId), battleSession, { merge: false });

    batch.set(db.collection("users").doc(student.uid).collection("pet").doc("state"), buildPetState(index, student.fullName), { merge: false });
    batch.set(db.collection("users").doc(student.uid).collection("inventory").doc("state"), buildInventoryState(index, studentStats.level), { merge: false });
    batch.set(db.collection("users").doc(student.uid).collection("petRequests").doc(hashText(`${student.uid}:select`, 12)), {
      seedSource: DEMO_MARKER,
      action: "select",
      response: null,
      processedAt: nowIso(),
    }, { merge: false });
    batch.set(db.collection("users").doc(student.uid).collection("inventoryTransactions").doc(hashText(`${student.uid}:seed`, 12)), {
      seedSource: DEMO_MARKER,
      action: "seed",
      createdAt: nowIso(),
      response: null,
    }, { merge: false });
    batch.set(db.collection("users").doc(student.uid).collection("shopTransactions").doc(hashText(`${student.uid}:shop`, 12)), {
      seedSource: DEMO_MARKER,
      action: "seed",
      createdAt: nowIso(),
      response: null,
    }, { merge: false });

    const studentUpdateAt = nowIso();
    batch.set(userRef, cleanForFirestore({
      seedSource: DEMO_MARKER,
      className,
      classTags: [className].filter(Boolean),
      classTagNames: [className].filter(Boolean),
      activityLogs,
      rewards,
      stats: studentStats,
      selectedPetId: PET_TYPES[index % PET_TYPES.length],
      pet: {
        selectedPetId: PET_TYPES[index % PET_TYPES.length],
      },
      lastActiveAt: studentUpdateAt,
      lastLoginAt: studentUpdateAt,
      updatedAt: studentUpdateAt,
    }), { merge: true });

    await batch.commit();

    enrichmentCompleted += 1;
    if (enrichmentCompleted % 10 === 0 || enrichmentCompleted === orderedStudents.length) {
      console.log(`[seed-demo] Student enrichment ${enrichmentCompleted}/${orderedStudents.length}`);
    }
  }

  console.log("[seed-demo] Student enrichment completed");

  console.log("[seed-demo] done", {
    teachers: USER_COUNT.teacher,
    students: USER_COUNT.student,
    classes: classDocs.length,
    assignments: classDocs.length * ASSIGNMENTS_PER_CLASS,
    quizzes: quizDocs.length,
  });
}

main()
  .then(async () => {
    console.log("[seed-demo] DONE");
    await closeAdminApps().catch(() => null);
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[seed-demo] failed", error && error.stack ? error.stack : error);
    await closeAdminApps().catch(() => null);
    process.exit(1);
  });
