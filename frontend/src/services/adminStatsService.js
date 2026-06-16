(() => {
  const SUBJECTS = ["math", "english"];
  const GRADES = ["1", "2", "3", "4", "5"];

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
      console.warn("Unable to initialize Firestore for admin stats:", error);
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

  function getDateValue(value) {
    if (!value) {
      return null;
    }

    if (typeof value?.toDate === "function") {
      const date = value.toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
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

  function normalizeSubjectKey(value) {
    const normalized = normalizeText(value).toLowerCase();

    if (normalized === "math" || normalized === "toan" || normalized === "toán") {
      return "math";
    }

    if (
      normalized === "english" ||
      normalized === "tieng anh" ||
      normalized === "tiếng anh"
    ) {
      return "english";
    }

    return "";
  }

  function getMonthBuckets() {
    const year = new Date().getFullYear();

    return Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      key: `${year}-${String(index + 1).padStart(2, "0")}`,
      label: `T${index + 1}`,
      scores: [],
    }));
  }

  function getTopicCatalogRequest() {
    return window.EduKidsApi?.requestAdmin || null;
  }

  async function fetchTopicCatalog() {
    const request = getTopicCatalogRequest();

    if (typeof request !== "function") {
      return [];
    }

    const results = await Promise.all(
      SUBJECTS.flatMap((subject) =>
        GRADES.map(async (grade) => {
          try {
            const response = await request(
              `/api/admin/topics?grade=${encodeURIComponent(grade)}&subject=${encodeURIComponent(subject)}`,
              { method: "GET" },
            );

            return Array.isArray(response?.data)
              ? response.data
                  .map((topic) => ({
                    topicId: normalizeText(topic?.topicId || topic?.id),
                    title: normalizeText(topic?.title || topic?.name || topic?.topicName),
                    subject: normalizeSubjectKey(topic?.subject) || subject,
                    grade: normalizeText(topic?.grade || grade),
                  }))
                  .filter((topic) => topic.topicId)
              : [];
          } catch (error) {
            console.warn("[EduKids][admin-stats] Failed to load topic catalog:", error);
            return [];
          }
        }),
      ),
    );

    return results.flat();
  }

  async function getCollectionDocs(collectionName) {
    const firestore = getFirestore();

    if (!firestore || !collectionName) {
      return [];
    }

    try {
      const snapshot = await firestore.collection(collectionName).get();
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() || {}),
      }));
    } catch (error) {
      console.warn(`[EduKids][admin-stats] Failed to load ${collectionName}:`, error);
      return [];
    }
  }

  async function getCollectionGroupDocs(collectionName) {
    const firestore = getFirestore();

    if (!firestore || typeof firestore.collectionGroup !== "function" || !collectionName) {
      return [];
    }

    try {
      const snapshot = await firestore.collectionGroup(collectionName).get();
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() || {}),
      }));
    } catch (error) {
      console.warn(`[EduKids][admin-stats] Failed to load collectionGroup ${collectionName}:`, error);
      return [];
    }
  }

  function normalizeSubmission(doc) {
    return {
      id: normalizeText(doc?.id),
      assignmentId: normalizeText(doc?.assignmentId),
      classId: normalizeText(doc?.classId),
      studentId: normalizeText(doc?.studentId),
      submittedAt: doc?.submittedAt || "",
      gradedAt: doc?.gradedAt || "",
      createdAt: doc?.createdAt || "",
      updatedAt: doc?.updatedAt || "",
      score: doc?.score ?? null,
      correctCount: Number(doc?.correctCount || doc?.correctAnswers || 0) || 0,
      totalQuestions: Number(doc?.totalQuestions || doc?.questionCount || 0) || 0,
    };
  }

  function getSubmissionDate(submission) {
    return (
      getDateValue(submission?.submittedAt) ||
      getDateValue(submission?.gradedAt) ||
      getDateValue(submission?.createdAt) ||
      getDateValue(submission?.updatedAt)
    );
  }

  function normalizeScoreValue(submission) {
    const directScore = toScore10(submission?.score);

    if (Number.isFinite(directScore)) {
      return directScore;
    }

    const correctCount = Number(submission?.correctCount || 0);
    const totalQuestions = Number(submission?.totalQuestions || 0);

    if (Number.isFinite(correctCount) && Number.isFinite(totalQuestions) && totalQuestions > 0) {
      return Math.max(0, Math.min(10, (correctCount / totalQuestions) * 10));
    }

    return null;
  }

  function buildMonthlyAverageScores(submissions = []) {
    const buckets = getMonthBuckets();
    const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    (Array.isArray(submissions) ? submissions : []).forEach((submission) => {
      const date = getSubmissionDate(submission);
      const score = normalizeScoreValue(submission);

      if (!date || !Number.isFinite(score)) {
        return;
      }

      const year = date.getFullYear();
      const currentYear = new Date().getFullYear();

      if (year !== currentYear) {
        return;
      }

      const key = `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const bucket = bucketMap.get(key);

      if (!bucket) {
        return;
      }

      bucket.scores.push(score);
    });

    return buckets.map((bucket) => {
      if (bucket.scores.length === 0) {
        return {
          label: bucket.label,
          value: 0,
        };
      }

      const average =
        bucket.scores.reduce((sum, score) => sum + score, 0) / bucket.scores.length;

      return {
        label: bucket.label,
        value: Number(average.toFixed(1)),
      };
    });
  }

  function normalizeTopicProgress(doc, topicMetaMap = new Map()) {
    const topicId = normalizeText(doc?.topicId || doc?.id);
    const topicMeta = topicMetaMap.get(topicId) || {};
    const totalAnswered = Math.max(0, Number(doc?.totalAnswered) || 0);
    const totalCorrect = Math.max(0, Number(doc?.totalCorrect) || 0);
    const percentage = Number.isFinite(Number(doc?.percentage))
      ? Math.max(0, Math.min(100, Math.round(Number(doc?.percentage))))
      : totalAnswered > 0
        ? Math.round((totalCorrect / totalAnswered) * 100)
        : 0;

    return {
      topicId,
      title: normalizeText(doc?.topicName || doc?.title || doc?.name || topicMeta.title || topicId),
      subject: normalizeSubjectKey(doc?.subject || topicMeta.subject),
      grade: normalizeText(doc?.grade || topicMeta.grade),
      totalAnswered,
      totalCorrect,
      percentage,
      updatedAt: normalizeText(doc?.updatedAt || doc?.accuracyUpdatedAt || doc?.createdAt || ""),
    };
  }

  function buildGradeLabel(grades = []) {
    const normalized = Array.from(
      new Set(
        (Array.isArray(grades) ? grades : [])
          .map((grade) => Number.parseInt(String(grade || "").trim(), 10))
          .filter((grade) => Number.isFinite(grade) && grade >= 1 && grade <= 5),
      ),
    ).sort((left, right) => left - right);

    if (normalized.length === 0) {
      return "Chưa xác định khối";
    }

    if (normalized.length === 1) {
      return `Khối ${normalized[0]}`;
    }

    return `Khối ${normalized[0]} - ${normalized[normalized.length - 1]}`;
  }

  function buildTopTopic(topicProgressDocs = [], subjectKey = "") {
    const buckets = new Map();

    (Array.isArray(topicProgressDocs) ? topicProgressDocs : []).forEach((doc) => {
      if (doc.subject !== subjectKey || doc.totalAnswered <= 0) {
        return;
      }

      const key = doc.topicId || doc.title;
      if (!key) {
        return;
      }

      const bucket =
        buckets.get(key) || {
          topicId: doc.topicId,
          title: doc.title,
          subject: subjectKey,
          totalAnswered: 0,
          totalCorrect: 0,
          grades: new Set(),
        };

      bucket.topicId = bucket.topicId || doc.topicId;
      bucket.title = bucket.title || doc.title;
      bucket.totalAnswered += doc.totalAnswered;
      bucket.totalCorrect += doc.totalCorrect;
      if (doc.grade) {
        bucket.grades.add(doc.grade);
      }

      buckets.set(key, bucket);
    });

    const ranked = Array.from(buckets.values())
      .map((item) => ({
        topicId: item.topicId,
        title: item.title || item.topicId || "Chủ đề",
        subtitle: buildGradeLabel(Array.from(item.grades)),
        note:
          item.totalAnswered > 0
            ? `${Math.round((item.totalCorrect / item.totalAnswered) * 100)}% chính xác`
            : "Chưa có dữ liệu",
        value: `${item.totalAnswered.toLocaleString("vi-VN")} lượt`,
        totalAnswered: item.totalAnswered,
        accuracy:
          item.totalAnswered > 0
            ? Math.round((item.totalCorrect / item.totalAnswered) * 100)
            : 0,
      }))
      .sort((left, right) => {
        const answerDiff = (right.totalAnswered || 0) - (left.totalAnswered || 0);
        if (answerDiff !== 0) {
          return answerDiff;
        }

        const accuracyDiff = (right.accuracy || 0) - (left.accuracy || 0);
        if (accuracyDiff !== 0) {
          return accuracyDiff;
        }

        return left.title.localeCompare(right.title);
      });

    return ranked[0] || null;
  }

  function normalizeTeacherMap(teacherDocs = []) {
    const map = new Map();

    (Array.isArray(teacherDocs) ? teacherDocs : []).forEach((doc) => {
      const teacherId = normalizeText(doc?.id || doc?.uid || doc?.userId);
      if (!teacherId) {
        return;
      }

      const teacherName = normalizeText(doc?.fullName || doc?.name || doc?.username || doc?.email);
      map.set(teacherId, teacherName);
    });

    return map;
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

    const fallbackSource = normalizeText(classroom?.name || classroom?.className || "");
    const match = fallbackSource.match(/(\d+)/);

    if (match) {
      const grade = Number(match[1]);
      if (Number.isFinite(grade) && grade >= 1 && grade <= 5) {
        return String(grade);
      }
    }

    return "";
  }

  function getClassAverageMaps(submissionDocs = []) {
    const scoreBuckets = new Map();
    const sampleCountByClassId = new Map();

    (Array.isArray(submissionDocs) ? submissionDocs : []).forEach((doc) => {
      const submission = normalizeSubmission(doc);
      const classId = normalizeText(submission.classId);
      const score = normalizeScoreValue(submission);

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
      const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
      averageByClassId.set(classId, Number(average.toFixed(1)));
    });

    return {
      averageByClassId,
      sampleCountByClassId,
    };
  }

  function normalizeClassroom(doc, teacherNameById = new Map(), averageByClassId = new Map(), sampleCountByClassId = new Map()) {
    const data = typeof doc?.data === "function" ? doc.data() || {} : doc || {};
    const students = Array.from(
      new Set(
        [
          ...(Array.isArray(data.students) ? data.students : []),
          ...(Array.isArray(data.studentIds) ? data.studentIds : []),
          ...(Array.isArray(data.members) ? data.members : []),
        ]
          .flatMap((value) => {
            if (typeof value === "string" || typeof value === "number") {
              return [String(value).trim()];
            }

            if (!value || typeof value !== "object") {
              return [];
            }

            return [value.id, value.uid, value.userId, value.studentId]
              .map((entry) => String(entry || "").trim())
              .filter(Boolean);
          })
          .filter(Boolean),
      ),
    );
    const id = normalizeText(doc?.id || data.id || data.classId);
    const teacherId = normalizeText(data.teacherId);
    const teacherName =
      normalizeText(data.teacherName) ||
      normalizeText(data.teacherUsername) ||
      normalizeText(teacherNameById.get(teacherId) || "");
    const averageScoreValue = averageByClassId.has(id) ? averageByClassId.get(id) : null;
    const studentCount =
      students.length || Number(data.studentCount ?? data.studentsCount ?? 0) || 0;

    return {
      id,
      name: normalizeText(data.name || data.className || "Chưa đặt tên"),
      className: normalizeText(data.className || data.name || ""),
      teacherName: teacherName || teacherId || "--",
      teacherUsername: normalizeText(data.teacherUsername || ""),
      studentCount,
      createdAt: data.createdAt || "",
      createdAtValue: getTimestampValue(data.createdAt),
      averageScoreValue: Number.isFinite(Number(averageScoreValue)) ? Number(averageScoreValue) : null,
      averageSampleCount: Number(sampleCountByClassId.get(id) || 0),
      grade: getClassGradeValue(data),
    };
  }

  function buildTopClasses(classDocs = [], teacherNameById = new Map(), submissionDocs = []) {
    const { averageByClassId, sampleCountByClassId } = getClassAverageMaps(submissionDocs);

    return (Array.isArray(classDocs) ? classDocs : [])
      .map((doc) => normalizeClassroom(doc, teacherNameById, averageByClassId, sampleCountByClassId))
      .filter((classroom) => classroom.id && Number.isFinite(Number(classroom.averageScoreValue)))
      .sort((left, right) => {
        const scoreDiff = (Number(right.averageScoreValue) || 0) - (Number(left.averageScoreValue) || 0);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        const sampleDiff = (Number(right.averageSampleCount) || 0) - (Number(left.averageSampleCount) || 0);
        if (sampleDiff !== 0) {
          return sampleDiff;
        }

        const studentDiff = (Number(right.studentCount) || 0) - (Number(left.studentCount) || 0);
        if (studentDiff !== 0) {
          return studentDiff;
        }

        return left.name.localeCompare(right.name);
      })
      .slice(0, 10);
  }

  async function fetchAdminStatsData() {
    const firestore = getFirestore();

    if (!firestore) {
      return {
        charts: {
          monthlyAverageScores: [],
        },
        topTopics: {
          math: null,
          english: null,
        },
        topClasses: [],
        hasData: false,
      };
    }

    const [teacherDocs, classDocs, submissionDocs, topicDocs, topicCatalog] = await Promise.all([
      getCollectionDocs("users").then((docs) =>
        docs.filter((doc) => normalizeText(doc?.role).toLowerCase() === "teacher"),
      ),
      getCollectionDocs("classes"),
      getCollectionDocs("assignment_submissions"),
      getCollectionGroupDocs("topics"),
      fetchTopicCatalog(),
    ]);

    const teacherNameById = normalizeTeacherMap(teacherDocs);
    const monthlyAverageScores = buildMonthlyAverageScores(
      (Array.isArray(submissionDocs) ? submissionDocs : []).map(normalizeSubmission),
    );

    const topicMetaMap = new Map();
    topicCatalog.forEach((topic) => {
      if (topic.topicId) {
        topicMetaMap.set(topic.topicId, topic);
      }
    });

    const normalizedTopicDocs = (Array.isArray(topicDocs) ? topicDocs : []).map((doc) =>
      normalizeTopicProgress(doc, topicMetaMap),
    );

    const topTopics = {
      math: buildTopTopic(normalizedTopicDocs, "math"),
      english: buildTopTopic(normalizedTopicDocs, "english"),
    };

    const topClasses = buildTopClasses(classDocs, teacherNameById, submissionDocs);

    return {
      charts: {
        monthlyAverageScores,
      },
      topTopics,
      topClasses,
      hasData:
        monthlyAverageScores.some((item) => Number(item.value) > 0) ||
        Boolean(topTopics.math || topTopics.english || topClasses.length > 0),
    };
  }

  window.EduKidsAdminStatsService = {
    fetchAdminStatsData,
  };
})();
