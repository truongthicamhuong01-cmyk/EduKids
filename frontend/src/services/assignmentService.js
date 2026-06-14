(() => {
  function getFirestore() {
    if (
      !window.firebase?.apps?.length ||
      typeof window.firebase.app !== "function"
    ) {
      return null;
    }

    if (typeof window.firebase.firestore !== "function") {
      return null;
    }

    try {
      const app = window.firebase.app();
      return app.firestore();
    } catch (error) {
      console.warn("Unable to initialize Firestore:", error);
      return null;
    }
  }

  function normalizeAssignment(doc) {
    const data = typeof doc.data === "function" ? doc.data() || {} : doc || {};
    const dueDate = String(data.dueDate || "").trim();

    return {
      id: doc.id || data.id || "",
      classId: data.classId || "",
      className: data.className || "",
      classCode: data.classCode || "",
      teacherId: data.teacherId || "",
      teacherName: data.teacherName || "",
      title: data.title || "",
      description: data.description || "",
      subject: data.subject || "",
      dueDate: dueDate || null,
      totalQuestions: Number(data.totalQuestions || data.questionCount || 0),
      questionCount: Number(data.questionCount || data.totalQuestions || 0),
      status: data.status || "active",
      createdAt: data.createdAt || "",
      updatedAt: data.updatedAt || "",
      questions: Array.isArray(data.questions) ? data.questions : [],
    };
  }

  function sortAssignments(assignments) {
    return [...assignments].sort((a, b) => {
      const aTime = Date.parse(a.createdAt || a.updatedAt || "") || 0;
      const bTime = Date.parse(b.createdAt || b.updatedAt || "") || 0;

      return bTime - aTime;
    });
  }

  async function getTeacherAssignments(teacherId) {
    const firestore = getFirestore();

    if (!firestore || !teacherId) {
      return [];
    }

    const snapshot = await firestore
      .collection("assignments")
      .where("teacherId", "==", teacherId)
      .get();

    return sortAssignments(snapshot.docs.map((doc) => normalizeAssignment(doc)));
  }

  function listenTeacherAssignments(teacherId, onChange) {
    const firestore = getFirestore();

    if (!firestore || !teacherId || typeof onChange !== "function") {
      onChange?.([], []);
      return () => {};
    }

    const query = firestore
      .collection("assignments")
      .where("teacherId", "==", teacherId);

    return query.onSnapshot(
      (snapshot) => {
        const assignments = sortAssignments(
          snapshot.docs.map((doc) => {
            const data = doc.data() || {};

            return {
              id: doc.id,
              ...data,
              totalQuestions: Number(
                data.totalQuestions || data.questionCount || 0,
              ),
              questionCount: Number(
                data.questionCount || data.totalQuestions || 0,
              ),
            };
          }),
        );

        onChange(assignments, []);
      },
      (error) => {
        console.warn(
          "[EduKids][assignmentService] listenTeacherAssignments failed",
          error,
        );
        onChange([], [
          {
            message:
              error?.message || "Không thể tải bài tập đã giao từ Firestore.",
          },
        ]);
      },
    );
  }

  async function createAssignment(payload) {
    const api = window.EduKidsApi?.requestWithAuth;

    if (typeof api !== "function") {
      throw new Error("Assignment API is unavailable");
    }

    const response = await api("/api/assignments", {
      method: "POST",
      body: payload,
    });

    return response.data;
  }

  window.EduKidsAssignmentService = {
    createAssignment,
    getTeacherAssignments,
    listenTeacherAssignments,
  };
})();
