(() => {
  function getFirestore() {
    if (
      !window.firebase?.apps?.length ||
      typeof window.firebase.app !== "function" ||
      typeof window.firebase.firestore !== "function"
    ) {
      return null;
    }

    try {
      return window.firebase.app().firestore();
    } catch (error) {
      console.warn("Unable to initialize Firestore for admin students:", error);
      return null;
    }
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function getTimestampValue(value) {
    if (!value) {
      return 0;
    }

    if (typeof value?.toDate === "function") {
      const date = value.toDate();
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function normalizeStudent(doc) {
    const data = typeof doc?.data === "function" ? doc.data() || {} : doc || {};
    const status = normalizeText(data.status || data.accountStatus).toLowerCase();
    const className =
      normalizeText(data.className) ||
      normalizeText(Array.isArray(data.classTags) ? data.classTags[0] : "") ||
      normalizeText(Array.isArray(data.classIds) ? data.classIds[0] : "") ||
      normalizeText(Array.isArray(data.joinedClasses) ? data.joinedClasses[0] : "");

    return {
      id: normalizeText(doc?.id || data.id || data.uid || data.userId),
      uid: normalizeText(doc?.id || data.uid || data.userId),
      fullName: normalizeText(data.fullName || data.name),
      username: normalizeText(data.username),
      className,
      createdAt: data.createdAt || "",
      createdAtValue: getTimestampValue(data.createdAt),
      status: status === "locked" ? "locked" : "active",
      role: normalizeText(data.role),
      school: normalizeText(data.school),
      avatar: normalizeText(data.avatar),
      userCode: normalizeText(data.userCode),
    };
  }

  async function fetchStudents() {
    const firestore = getFirestore();

    if (!firestore) {
      return [];
    }

    try {
      const snapshot = await firestore
        .collection("users")
        .where("role", "==", "student")
        .get();

      return snapshot.docs
        .map((doc) => normalizeStudent(doc))
        .filter((student) => student.id);
    } catch (error) {
      console.warn("[EduKids][admin-students] Failed to load students:", error);
      return [];
    }
  }

  async function updateStudentStatus(studentId, status) {
    const firestore = getFirestore();
    const normalizedStudentId = normalizeText(studentId);
    const normalizedStatus = status === "locked" ? "locked" : "active";

    if (!firestore || !normalizedStudentId) {
      throw new Error("Firestore is unavailable");
    }

    await firestore.collection("users").doc(normalizedStudentId).set(
      {
        status: normalizedStatus,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  async function deleteStudent(studentId) {
    const firestore = getFirestore();
    const normalizedStudentId = normalizeText(studentId);

    if (!firestore || !normalizedStudentId) {
      throw new Error("Firestore is unavailable");
    }

    await firestore.collection("users").doc(normalizedStudentId).delete();
  }

  window.EduKidsAdminStudentService = {
    deleteStudent,
    fetchStudents,
    normalizeStudent,
    updateStudentStatus,
  };
})();
