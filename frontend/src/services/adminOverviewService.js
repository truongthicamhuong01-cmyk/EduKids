(() => {
  const AI_LOG_COLLECTION_CANDIDATES = [
    "ai_usage_logs",
    "ai_logs",
    "ai_requests",
    "coach_usage_logs",
    "ai_interactions",
  ];

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
      console.warn("Unable to initialize Firestore for admin overview:", error);
      return null;
    }
  }

  function toIsoDateKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function getLocalDateFromValue(value) {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  function getDateValue(doc) {
    const data = typeof doc?.data === "function" ? doc.data() || {} : doc || {};
    return (
      getLocalDateFromValue(data.submittedAt) ||
      getLocalDateFromValue(data.gradedAt) ||
      getLocalDateFromValue(data.usedAt) ||
      getLocalDateFromValue(data.occurredAt) ||
      getLocalDateFromValue(data.timestamp) ||
      getLocalDateFromValue(data.createdAt) ||
      getLocalDateFromValue(data.updatedAt) ||
      getLocalDateFromValue(data.date)
    );
  }

  function getDayWindow(days = 7) {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    start.setDate(start.getDate() - Math.max(0, days - 1));

    return Array.from({ length: days }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);

      return {
        date,
        key: toIsoDateKey(date),
        label: new Intl.DateTimeFormat("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        }).format(date),
      };
    });
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

  function buildDailySeries(docs, accessor) {
    const buckets = new Map();
    const window = getDayWindow(7);

    window.forEach((item) => {
      buckets.set(item.key, {
        date: item.date,
        label: item.label,
        value: 0,
      });
    });

    (Array.isArray(docs) ? docs : []).forEach((doc) => {
      const date = getDateValue(doc);
      const key = date ? toIsoDateKey(date) : "";
      const entry = buckets.get(key);

      if (!entry) {
        return;
      }

      const value = Number(accessor?.(doc)) || 0;
      entry.value += value;
    });

    return Array.from(buckets.values());
  }

  function buildAverageScore(entries) {
    const scoredEntries = (Array.isArray(entries) ? entries : [])
      .map((entry) => ({
        score: toScore10(entry?.score),
        weight:
          Number.isFinite(Number(entry?.totalQuestions)) && Number(entry.totalQuestions) > 0
            ? Math.max(1, Number(entry.totalQuestions))
            : 1,
      }))
      .filter((entry) => Number.isFinite(entry.score));

    if (scoredEntries.length === 0) {
      return 0;
    }

    const weightedScore = scoredEntries.reduce(
      (sum, entry) => sum + entry.score * entry.weight,
      0,
    );
    const totalWeight = scoredEntries.reduce((sum, entry) => sum + entry.weight, 0);

    return totalWeight > 0
      ? Number((weightedScore / totalWeight).toFixed(1))
      : 0;
  }

  function getTodayKey() {
    return toIsoDateKey(new Date());
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
      console.warn(`[EduKids][admin-overview] Failed to load ${collectionName}:`, error);
      return [];
    }
  }

  async function getAiUsageToday() {
    const todayKey = getTodayKey();
    const usageDocs = [];

    for (const collectionName of AI_LOG_COLLECTION_CANDIDATES) {
      const docs = await getCollectionDocs(collectionName);
      usageDocs.push(...docs);
    }

    if (usageDocs.length === 0) {
      return {
        count: 0,
        hasData: false,
        dailySeries: [],
      };
    }

    const dailySeries = buildDailySeries(usageDocs, () => 1);
    const count = usageDocs.filter((doc) => {
      const date = getDateValue(doc);
      return date ? toIsoDateKey(date) === todayKey : false;
    }).length;

    return {
      count,
      hasData: dailySeries.some((entry) => entry.value > 0),
      dailySeries,
    };
  }

  async function fetchAdminOverviewData() {
    const firestore = getFirestore();

    if (!firestore) {
      return {
        totals: {
          students: 0,
          teachers: 0,
          classes: 0,
          assignments: 0,
          aiUsageToday: 0,
          averageScore: 0,
        },
        charts: {
          workSubmissions: [],
          aiUsage: [],
        },
        hasData: false,
      };
    }

    const [
      users,
      classes,
      assignments,
      assignmentSubmissions,
      wrongAnswers,
      aiUsage,
    ] = await Promise.all([
      getCollectionDocs("users"),
      getCollectionDocs("classes"),
      getCollectionDocs("assignments"),
      getCollectionDocs("assignment_submissions"),
      getCollectionDocs("wrong_answers"),
      getAiUsageToday(),
    ]);

    const students = users.filter((user) => String(user.role || "").trim().toLowerCase() === "student").length;
    const teachers = users.filter((user) => String(user.role || "").trim().toLowerCase() === "teacher").length;
    const totalClasses = classes.length;
    const totalAssignments = assignments.length;
    const averageScore = buildAverageScore([
      ...assignmentSubmissions,
      ...wrongAnswers,
    ]);
    const workSubmissions = buildDailySeries(assignmentSubmissions, () => 1)
      .map((entry) => ({
        ...entry,
        value: Number(entry.value) || 0,
      }));

    return {
      totals: {
        students,
        teachers,
        classes: totalClasses,
        assignments: totalAssignments,
        aiUsageToday: aiUsage.count,
        averageScore,
      },
      charts: {
        workSubmissions,
        aiUsage: Array.isArray(aiUsage.dailySeries) ? aiUsage.dailySeries : [],
      },
      hasData:
        students > 0 ||
        teachers > 0 ||
        totalClasses > 0 ||
        totalAssignments > 0 ||
        workSubmissions.some((entry) => Number(entry.value) > 0) ||
        (Array.isArray(aiUsage.dailySeries) && aiUsage.dailySeries.some((entry) => Number(entry.value) > 0)),
      hasAiLogs: aiUsage.hasData,
    };
  }

  window.EduKidsAdminOverviewService = {
    fetchAdminOverviewData,
  };
})();
