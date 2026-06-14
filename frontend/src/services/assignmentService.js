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

  function getFirestoreCollection(name) {
    const firestore = getFirestore();

    if (!firestore) {
      return null;
    }

    return firestore.collection(name);
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

  async function fetchAssignmentSubmissions(assignmentId) {
    const api = window.EduKidsApi?.requestWithAuth;

    if (typeof api !== "function") {
      throw new Error("Assignment API is unavailable");
    }

    const normalizedAssignmentId = String(assignmentId || "").trim();

    if (!normalizedAssignmentId) {
      throw new Error("assignmentId is required");
    }

    const response = await api(
      `/api/assignments/${encodeURIComponent(normalizedAssignmentId)}/submissions`,
      {
        method: "GET",
      },
    );

    return Array.isArray(response.data) ? response.data : [];
  }

  async function fetchAssignmentSubmissionByStudent(assignmentId, studentId) {
    const normalizedAssignmentId = String(assignmentId || "").trim();
    const normalizedStudentId = String(studentId || "").trim();

    if (!normalizedAssignmentId || !normalizedStudentId) {
      return null;
    }

    const collection = getFirestoreCollection("assignment_submissions");

    if (!collection) {
      return null;
    }

    const directDocId = `${normalizedAssignmentId}_${normalizedStudentId}`;
    const directSnapshot = await collection.doc(directDocId).get();

    if (directSnapshot.exists) {
      return {
        id: directSnapshot.id,
        ...(directSnapshot.data() || {}),
      };
    }

    const querySnapshot = await collection
      .where("assignmentId", "==", normalizedAssignmentId)
      .where("studentId", "==", normalizedStudentId)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];

    return {
      id: doc.id,
      ...(doc.data() || {}),
    };
  }

  window.EduKidsAssignmentService = {
    createAssignment,
    fetchAssignmentSubmissions,
    fetchAssignmentSubmissionByStudent,
    getTeacherAssignments,
    listenTeacherAssignments,
  };
})();
