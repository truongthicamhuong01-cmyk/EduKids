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
      console.warn("Unable to initialize Firestore for admin teachers:", error);
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

  function normalizeTeacher(doc) {
    const data = typeof doc?.data === "function" ? doc.data() || {} : doc || {};
    const status = normalizeText(data.status).toLowerCase();

    return {
      id: normalizeText(doc?.id || data.id || data.uid || data.userId),
      uid: normalizeText(doc?.id || data.uid || data.userId),
      fullName: normalizeText(data.fullName || data.name),
      name: normalizeText(data.name || data.fullName),
      username: normalizeText(data.username),
      email: normalizeText(data.email),
      createdAt: data.createdAt || "",
      createdAtValue: getTimestampValue(data.createdAt),
      status: status === "locked" ? "locked" : "active",
      role: normalizeText(data.role),
      avatar: normalizeText(data.avatar),
      school: normalizeText(data.school),
      userCode: normalizeText(data.userCode),
      classCount: Math.max(0, Number(data.classCount) || 0),
    };
  }

  async function fetchTeachers() {
    const firestore = getFirestore();

    if (!firestore) {
      return [];
    }

    try {
      const [teacherSnapshot, classSnapshot] = await Promise.all([
        firestore.collection("users").where("role", "==", "teacher").get(),
        firestore.collection("classes").get(),
      ]);

      const classCountByTeacherId = new Map();
      classSnapshot.docs.forEach((doc) => {
        const data = doc.data() || {};
        const teacherId = normalizeText(data.teacherId);

        if (!teacherId) {
          return;
        }

        classCountByTeacherId.set(
          teacherId,
          (classCountByTeacherId.get(teacherId) || 0) + 1,
        );
      });

      return teacherSnapshot.docs
        .map((doc) => {
          const teacher = normalizeTeacher(doc);
          return {
            ...teacher,
            classCount: classCountByTeacherId.get(teacher.id) || 0,
          };
        })
        .filter((teacher) => teacher.id);
    } catch (error) {
      console.warn("[EduKids][admin-teachers] Failed to load teachers:", error);
      return [];
    }
  }

  async function updateTeacherStatus(teacherId, status) {
    const firestore = getFirestore();
    const normalizedTeacherId = normalizeText(teacherId);
    const normalizedStatus = status === "locked" ? "locked" : "active";

    if (!firestore || !normalizedTeacherId) {
      throw new Error("Firestore is unavailable");
    }

    await firestore.collection("users").doc(normalizedTeacherId).set(
      {
        status: normalizedStatus,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  async function resetTeacherPassword(teacherId, newPassword, adminPassword) {
    const api = window.EduKidsApi?.requestWithAuth || window.EduKidsApi?.request;

    if (typeof api !== "function") {
      throw new Error("Admin API is unavailable");
    }

    const response = await api("/api/admin/teacher/reset-password", {
      method: "POST",
      body: {
        teacherId: normalizeText(teacherId),
        newPassword: normalizeText(newPassword),
        adminPassword: normalizeText(adminPassword),
      },
    });

    return response.data || null;
  }

  window.EduKidsAdminTeacherService = {
    fetchTeachers,
    normalizeTeacher,
    resetTeacherPassword,
    updateTeacherStatus,
  };
})();
