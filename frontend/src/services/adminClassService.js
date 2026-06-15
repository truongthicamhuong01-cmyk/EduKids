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
      console.warn("Unable to initialize Firestore for admin classes:", error);
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

  function uniqueStrings(values) {
    return Array.from(
      new Set(
        (Array.isArray(values) ? values : [])
          .flatMap((value) => {
            if (typeof value === "string" || typeof value === "number") {
              return [String(value).trim()];
            }

            if (!value || typeof value !== "object") {
              return [];
            }

            return [
              value.id,
              value.uid,
              value.userId,
              value.studentId,
              value.classId,
            ]
              .map((entry) => String(entry || "").trim())
              .filter(Boolean);
          })
          .filter(Boolean),
      ),
    );
  }

  function getClassGradeValue(classroom) {
    const directGrade = normalizeText(
      classroom?.grade ||
        classroom?.gradeLevel ||
        classroom?.classGrade ||
        classroom?.level,
    );

    if (directGrade) {
      const directMatch = directGrade.match(/(\d+)/);

      if (directMatch) {
        const grade = Number(directMatch[1]);
        if (Number.isFinite(grade) && grade >= 1 && grade <= 5) {
          return String(grade);
        }
      }
    }

    const fallbackSource = normalizeText(
      classroom?.name || classroom?.className || "",
    );
    const match = fallbackSource.match(/(\d+)/);

    if (match) {
      const grade = Number(match[1]);
      if (Number.isFinite(grade) && grade >= 1 && grade <= 5) {
        return String(grade);
      }
    }

    return "";
  }

  function normalizeTeacher(doc) {
    const data = typeof doc?.data === "function" ? doc.data() || {} : doc || {};

    return {
      id: normalizeText(doc?.id || data.id || data.uid || data.userId),
      fullName: normalizeText(data.fullName || data.name),
      username: normalizeText(data.username),
      email: normalizeText(data.email),
    };
  }

  function normalizeClassroom(doc, teacherNameById = new Map(), scoreByClassId = new Map(), sampleCountByClassId = new Map()) {
    const data = typeof doc?.data === "function" ? doc.data() || {} : doc || {};
    const students = uniqueStrings([
      ...(Array.isArray(data.students) ? data.students : []),
      ...(Array.isArray(data.studentIds) ? data.studentIds : []),
      ...(Array.isArray(data.members) ? data.members : []),
    ]);
    const id = normalizeText(doc?.id || data.id || data.classId);
    const teacherId = normalizeText(data.teacherId);
    const teacherName =
      normalizeText(data.teacherName) ||
      normalizeText(data.teacherUsername) ||
      normalizeText(teacherNameById.get(teacherId) || "");
    const averageScoreValue = scoreByClassId.has(id)
      ? scoreByClassId.get(id)
      : null;
    const hasAverageScore =
      averageScoreValue !== null && Number.isFinite(Number(averageScoreValue));
    const averageScoreLabel = hasAverageScore
      ? Number(averageScoreValue).toFixed(1)
      : "Chưa có dữ liệu";
    const averageSampleCount = Number(sampleCountByClassId.get(id) || 0);
    const studentCount =
      students.length || Number(data.studentCount ?? data.studentsCount ?? 0) || 0;

    return {
      id,
      name: normalizeText(data.name || data.className || "Chưa đặt tên"),
      className: normalizeText(data.className || data.name || ""),
      classCode: normalizeText(data.classCode || data.code || ""),
      teacherId,
      teacherName,
      teacherUsername: normalizeText(data.teacherUsername || ""),
      students,
      studentIds: students,
      members: students,
      studentCount,
      createdAt: data.createdAt || "",
      createdAtValue: getTimestampValue(data.createdAt),
      grade: getClassGradeValue(data),
      averageScoreValue: hasAverageScore ? Number(averageScoreValue) : null,
      averageScoreLabel,
      averageSampleCount,
      hasAverageScore,
    };
  }

  function getClassTeacherNameMap(teacherDocs = []) {
    const map = new Map();

    (Array.isArray(teacherDocs) ? teacherDocs : []).forEach((doc) => {
      const teacher = normalizeTeacher(doc);

      if (!teacher.id) {
        return;
      }

      map.set(teacher.id, teacher.fullName || teacher.username || teacher.email || "");
    });

    return map;
  }

  function getClassAverageMaps(submissionDocs = []) {
    const scoreBuckets = new Map();
    const sampleCountByClassId = new Map();

    (Array.isArray(submissionDocs) ? submissionDocs : []).forEach((doc) => {
      const data = typeof doc?.data === "function" ? doc.data() || {} : doc || {};
      const classId = normalizeText(data.classId);
      const score = toScore10(data.score);

      if (!classId || !Number.isFinite(score)) {
        return;
      }

      const scores = scoreBuckets.get(classId) || [];
      scores.push(score);
      scoreBuckets.set(classId, scores);
      sampleCountByClassId.set(classId, scores.length);
    });

    const averageByClassId = new Map();

    scoreBuckets.forEach((scores, classId) => {
      const average =
        scores.length > 0
          ? scores.reduce((sum, value) => sum + value, 0) / scores.length
          : null;

      averageByClassId.set(
        classId,
        Number.isFinite(average) ? Number(average.toFixed(1)) : null,
      );
    });

    return {
      averageByClassId,
      sampleCountByClassId,
    };
  }

  async function fetchClasses() {
    const firestore = getFirestore();

    if (!firestore) {
      return [];
    }

    try {
      const [classSnapshot, teacherSnapshot, submissionSnapshot] = await Promise.all([
        firestore.collection("classes").get(),
        firestore.collection("users").where("role", "==", "teacher").get(),
        firestore.collection("assignment_submissions").get(),
      ]);

      const teacherNameById = getClassTeacherNameMap(teacherSnapshot.docs);
      const { averageByClassId, sampleCountByClassId } = getClassAverageMaps(
        submissionSnapshot.docs,
      );

      return classSnapshot.docs
        .map((doc) =>
          normalizeClassroom(
            doc,
            teacherNameById,
            averageByClassId,
            sampleCountByClassId,
          ),
        )
        .filter((classroom) => classroom.id)
        .sort((left, right) => right.createdAtValue - left.createdAtValue);
    } catch (error) {
      console.warn("[EduKids][admin-classes] Failed to load classes:", error);
      return [];
    }
  }

  window.EduKidsAdminClassService = {
    fetchClasses,
    normalizeClassroom,
  };
})();
