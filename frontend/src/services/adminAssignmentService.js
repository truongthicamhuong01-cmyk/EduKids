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
      console.warn("Unable to initialize Firestore for admin assignments:", error);
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

  function toScore10(value) {
    const score = Number(value);

    if (!Number.isFinite(score)) {
      return null;
    }

    if (score <= 10) {
      return Math.max(0, Math.min(10, score));
    }

    return Math.max(0, Math.min(10, score / 10));
  }

  function normalizeSubjectLabel(subject) {
    const normalized = normalizeText(subject).toLowerCase();

    if (normalized === "math" || normalized === "toán" || normalized === "toan") {
      return "Toán";
    }

    if (
      normalized === "english" ||
      normalized === "tiếng anh" ||
      normalized === "tieng anh"
    ) {
      return "Tiếng Anh";
    }

    return normalizeText(subject);
  }

  function getSubjectKey(subject) {
    const normalized = normalizeText(subject).toLowerCase();

    if (normalized === "math" || normalized === "toán" || normalized === "toan") {
      return "math";
    }

    if (
      normalized === "english" ||
      normalized === "tiếng anh" ||
      normalized === "tieng anh"
    ) {
      return "english";
    }

    return normalized;
  }

  function normalizeStatus(status) {
    const normalized = normalizeText(status).toLowerCase();

    if (normalized === "closed" || normalized === "archived" || normalized === "inactive") {
      return "closed";
    }

    if (normalized === "grading") {
      return "grading";
    }

    return "active";
  }

  function getAssignmentStatusLabel(status) {
    const normalized = normalizeStatus(status);

    if (normalized === "closed") {
      return "Đã đóng";
    }

    if (normalized === "grading") {
      return "Đang chấm";
    }

    return "Đang mở";
  }

  function getAssignmentStatusClass(status) {
    const normalized = normalizeStatus(status);

    if (normalized === "closed") {
      return "is-orange";
    }

    if (normalized === "grading") {
      return "is-purple";
    }

    return "is-green";
  }

  function normalizeAssignment(doc, teacherNameById = new Map()) {
    const data = typeof doc?.data === "function" ? doc.data() || {} : doc || {};
    const teacherId = normalizeText(data.teacherId);
    const teacherName =
      normalizeText(data.teacherName) ||
      normalizeText(teacherNameById.get(teacherId) || "");
    const subjectLabel = normalizeSubjectLabel(data.subject);

    return {
      id: normalizeText(doc?.id || data.id),
      title: normalizeText(data.title || data.name),
      description: normalizeText(data.description),
      subject: subjectLabel,
      subjectKey: getSubjectKey(data.subject),
      teacherId,
      teacherName: teacherName || teacherId || "--",
      classId: normalizeText(data.classId),
      className: normalizeText(data.className),
      classCode: normalizeText(data.classCode),
      status: normalizeStatus(data.status),
      statusLabel: getAssignmentStatusLabel(data.status),
      statusClass: getAssignmentStatusClass(data.status),
      dueDate: normalizeText(data.dueDate),
      createdAt: data.createdAt || "",
      createdAtValue: getTimestampValue(data.createdAt),
      updatedAt: data.updatedAt || "",
      totalQuestions: Number(data.totalQuestions || data.questionCount || 0) || 0,
      questionCount: Number(data.questionCount || data.totalQuestions || 0) || 0,
    };
  }

  function normalizeSubmission(doc) {
    const data = typeof doc?.data === "function" ? doc.data() || {} : doc || {};

    return {
      id: normalizeText(doc?.id || data.id),
      assignmentId: normalizeText(data.assignmentId),
      classId: normalizeText(data.classId),
      studentId: normalizeText(data.studentId),
      submittedAt: data.submittedAt || "",
      gradedAt: data.gradedAt || "",
      status: normalizeText(data.status).toLowerCase() || "submitted",
      score: data.score ?? null,
      totalQuestions: Number(data.totalQuestions || 0) || 0,
    };
  }

  function groupAssignmentsWithStats(assignments = [], submissions = []) {
    const groupedSubmissions = new Map();

    (Array.isArray(submissions) ? submissions : []).forEach((submission) => {
      if (!submission?.assignmentId) {
        return;
      }

      const bucket = groupedSubmissions.get(submission.assignmentId) || [];
      bucket.push(submission);
      groupedSubmissions.set(submission.assignmentId, bucket);
    });

    return (Array.isArray(assignments) ? assignments : []).map((assignment) => {
      const relatedSubmissions = groupedSubmissions.get(assignment.id) || [];
      const uniqueStudentIds = Array.from(
        new Set(
          relatedSubmissions
            .map((submission) => normalizeText(submission.studentId))
            .filter(Boolean),
        ),
      );
      const scoredSubmissions = relatedSubmissions
        .map((submission) => toScore10(submission.score))
        .filter((score) => Number.isFinite(score));
      const averageScore = scoredSubmissions.length
        ? scoredSubmissions.reduce((sum, value) => sum + value, 0) / scoredSubmissions.length
        : null;

      return {
        ...assignment,
        submissionCount: uniqueStudentIds.length,
        averageScoreValue: Number.isFinite(averageScore)
          ? Number(averageScore.toFixed(1))
          : null,
        averageScoreLabel: Number.isFinite(averageScore)
          ? Number(averageScore.toFixed(1))
          : "Chưa có dữ liệu",
        averageSampleCount: scoredSubmissions.length,
      };
    });
  }

  async function fetchAssignments() {
    const firestore = getFirestore();

    if (!firestore) {
      return [];
    }

    try {
      const [assignmentSnapshot, submissionSnapshot, teacherSnapshot] = await Promise.all([
        firestore.collection("assignments").get(),
        firestore.collection("assignment_submissions").get(),
        firestore.collection("users").where("role", "==", "teacher").get(),
      ]);

      const teacherNameById = new Map();
      teacherSnapshot.docs.forEach((doc) => {
        const data = doc.data() || {};
        const teacherId = normalizeText(doc.id || data.id || data.uid || data.userId);
        const teacherName = normalizeText(data.fullName || data.name || data.username);

        if (teacherId) {
          teacherNameById.set(teacherId, teacherName);
        }
      });

      const assignments = assignmentSnapshot.docs
        .map((doc) => normalizeAssignment(doc, teacherNameById))
        .filter((assignment) => assignment.id);
      const submissions = submissionSnapshot.docs
        .map((doc) => normalizeSubmission(doc))
        .filter((submission) => submission.assignmentId);

      return groupAssignmentsWithStats(assignments, submissions)
        .sort((left, right) => right.createdAtValue - left.createdAtValue);
    } catch (error) {
      console.warn("[EduKids][admin-assignments] Failed to load assignments:", error);
      return [];
    }
  }

  window.EduKidsAdminAssignmentService = {
    fetchAssignments,
    getAssignmentStatusClass,
    getAssignmentStatusLabel,
    normalizeAssignment,
  };
})();
