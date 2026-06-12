const { admin, db } = require("../firebase");
const ApiError = require("../utils/apiError");

const classesCollection = db.collection("classes");
const usersCollection = db.collection("users");
const classMembersCollection = db.collection("class_members");

function uniqueStrings(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

function generateClassCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";

  for (let i = 0; i < 6; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
}

async function generateUniqueClassCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const classCode = generateClassCode();
    const snapshot = await classesCollection.where("classCode", "==", classCode).limit(1).get();

    if (snapshot.empty) {
      return classCode;
    }
  }

  throw new ApiError(500, "Unable to generate a unique class code");
}

function mapClassDoc(doc) {
  if (!doc || !doc.exists) {
    return null;
  }

  const data = doc.data() || {};
  const students = uniqueStrings(
    data.students || data.studentIds || data.members || [],
  );

  return {
    id: doc.id,
    name: data.name || data.className || "",
    description: data.description || "",
    teacherId: data.teacherId || "",
    teacherName: data.teacherName || data.teacherUsername || "",
    classCode: data.classCode || data.code || "",
    students,
    studentIds: students,
    members: students,
    assignmentIds: Array.isArray(data.assignmentIds) ? data.assignmentIds : [],
    studentCount: students.length || Number(data.studentCount ?? data.studentsCount ?? 0),
    createdAt: data.createdAt || "",
  };
}

async function createClass({ teacherId, teacherName, name, description }) {
  const classCode = await generateUniqueClassCode();
  const docRef = classesCollection.doc();
  const createdAt = new Date().toISOString();

  const classData = {
    name,
    description: description || "",
    teacherId,
    teacherName,
    classCode,
    studentCount: 0,
    students: [],
    studentIds: [],
    members: [],
    assignmentIds: [],
    createdAt,
  };

  await docRef.set(classData);

  return {
    id: docRef.id,
    ...classData,
  };
}

async function getClassByCode(code) {
  const snapshot = await classesCollection.where("classCode", "==", code).limit(1).get();

  if (snapshot.empty) {
    const legacySnapshot = await classesCollection.where("code", "==", code).limit(1).get();

    if (legacySnapshot.empty) {
      return null;
    }

    return mapClassDoc(legacySnapshot.docs[0]);
  }

  const doc = snapshot.docs[0];
  return mapClassDoc(doc);
}

async function joinClass({ classCode, user }) {
  const classroom = await getClassByCode(classCode);

  if (!classroom) {
    throw new ApiError(404, "Class code not found");
  }

  const studentId = user.userId || user.uid;
  const userRef = usersCollection.doc(studentId);
  const classRef = classesCollection.doc(classroom.id);
  const timestamp = new Date().toISOString();

  console.log("[EduKids][classService] joinClass requested", {
    classCode,
    classId: classroom.id,
    studentId,
  });

  await db.runTransaction(async (transaction) => {
    const [classSnapshot, userSnapshot] = await Promise.all([
      transaction.get(classRef),
      transaction.get(userRef),
    ]);

    if (!classSnapshot.exists) {
      throw new ApiError(404, "Class code not found");
    }

    if (!userSnapshot.exists) {
      throw new ApiError(404, "User profile not found");
    }

    const classData = classSnapshot.data() || {};
    const userData = userSnapshot.data() || {};
    const currentStudentIds = uniqueStrings(
      classData.students || classData.studentIds || classData.members || [],
    );
    const currentJoinedClasses = uniqueStrings(
      [
        ...(Array.isArray(userData.joinedClasses) ? userData.joinedClasses : []),
        ...(Array.isArray(userData.classIds) ? userData.classIds : []),
      ],
    );
    const alreadyJoined = currentStudentIds.includes(studentId);
    const nextStudentCount = alreadyJoined
      ? currentStudentIds.length
      : currentStudentIds.length + 1;

    console.log("[EduKids][classService] joinClass before update", {
      classId: classroom.id,
      studentId,
      classMembersBefore: currentStudentIds,
      userJoinedClassesBefore: currentJoinedClasses,
    });

    transaction.update(classRef, {
      students: admin.firestore.FieldValue.arrayUnion(studentId),
      studentIds: admin.firestore.FieldValue.arrayUnion(studentId),
      members: admin.firestore.FieldValue.arrayUnion(studentId),
      studentCount: nextStudentCount,
      updatedAt: timestamp,
    });

    transaction.update(userRef, {
      classIds: admin.firestore.FieldValue.arrayUnion(classroom.id),
      joinedClasses: admin.firestore.FieldValue.arrayUnion(classroom.id),
      updatedAt: timestamp,
    });
  });

  console.log("[EduKids][classService] joinClass success", {
    classId: classroom.id,
    studentId,
  });

  const classSnapshotAfter = await classRef.get();
  const userSnapshotAfter = await userRef.get();

  console.log("[EduKids][classService] joinClass after update", {
    classId: classroom.id,
    studentId,
    classMembersAfter: uniqueStrings(
      classSnapshotAfter.data()?.students ||
        classSnapshotAfter.data()?.studentIds ||
        classSnapshotAfter.data()?.members ||
        [],
    ),
    userJoinedClassesAfter: uniqueStrings(
      userSnapshotAfter.data()?.joinedClasses ||
        userSnapshotAfter.data()?.classIds ||
        [],
    ),
  });

  return {
    class: classroom,
    studentId,
  };
}

async function getTeacherClasses(teacherId) {
  const snapshot = await classesCollection
    .where("teacherId", "==", teacherId)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => mapClassDoc(doc)).filter(Boolean);
}

async function getStudentClasses(userId) {
  const userSnapshot = await usersCollection.doc(userId).get();
  const userData = userSnapshot.exists ? userSnapshot.data() || {} : {};
  const collectedClassIds = new Set(
    uniqueStrings([
      ...(Array.isArray(userData.joinedClasses) ? userData.joinedClasses : []),
      ...(Array.isArray(userData.classIds) ? userData.classIds : []),
    ]),
  );

  if (collectedClassIds.size === 0) {
    const legacyMembersSnapshot = await classMembersCollection.where("userId", "==", userId).get();
    legacyMembersSnapshot.docs.forEach((doc) => {
      const classId = String(doc.data()?.classId || "").trim();

      if (classId) {
        collectedClassIds.add(classId);
      }
    });
  }

  const membershipSnapshots = await Promise.all(
    userId
      ? [
          classesCollection.where("students", "array-contains", userId).get(),
          classesCollection.where("studentIds", "array-contains", userId).get(),
          classesCollection.where("members", "array-contains", userId).get(),
        ]
      : [],
  );

  membershipSnapshots.forEach((snapshot) => {
    snapshot.docs.forEach((doc) => {
      collectedClassIds.add(doc.id);
    });
  });

  const classIds = Array.from(collectedClassIds);

  if (classIds.length === 0) {
    return [];
  }

  const classDocs = [];

  for (let i = 0; i < classIds.length; i += 10) {
    const batchIds = classIds.slice(i, i + 10);
    const classSnapshot = await classesCollection
      .where(admin.firestore.FieldPath.documentId(), "in", batchIds)
      .get();

    classSnapshot.docs.forEach((doc) => {
      const classroom = mapClassDoc(doc);

      if (classroom) {
        classDocs.push(classroom);
      }
    });
  }

  const seenClassIds = new Set();

  return classDocs.filter((classroom) => {
    if (seenClassIds.has(classroom.id)) {
      return false;
    }

    seenClassIds.add(classroom.id);
    return true;
  });
}

module.exports = {
  createClass,
  generateClassCode,
  joinClass,
  getTeacherClasses,
  getStudentClasses,
  getClassByCode,
  findClassByCode: getClassByCode,
};
