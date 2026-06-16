(() => {
  const SUBJECTS = [
    { key: "math", label: "Toán" },
    { key: "english", label: "Tiếng Anh" },
  ];

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
      console.warn("Unable to initialize Firestore for admin content:", error);
      return null;
    }
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeKeyPart(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[\/\\#?%\[\]]/g, "-")
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "");
  }

  function buildQuizDocId(grade, subject, topicId) {
    const parts = [grade, subject, topicId].map(normalizeKeyPart).filter(Boolean);

    return parts.join("_");
  }

  async function fetchTopics(grade, subject) {
    const api = window.EduKidsApi?.requestAdmin;

    if (typeof api !== "function") {
      return [];
    }

    try {
      const response = await api(
        `/api/admin/topics?grade=${encodeURIComponent(String(grade || ""))}&subject=${encodeURIComponent(String(subject || ""))}`,
        { method: "GET" },
      );

      return Array.isArray(response?.data) ? response.data : [];
    } catch (error) {
      console.warn("[EduKids][admin-content] Failed to load topics:", error);
      return [];
    }
  }

  async function fetchVersionCountMap() {
    const firestore = getFirestore();

    if (!firestore || typeof firestore.collectionGroup !== "function") {
      return new Map();
    }

    try {
      const snapshot = await firestore.collectionGroup("versions").get();
      const counts = new Map();

      snapshot.docs.forEach((doc) => {
        const parentId = normalizeText(doc.ref?.parent?.parent?.id);
        const parentCollectionId = normalizeText(doc.ref?.parent?.parent?.parent?.id);

        if (!parentId || parentCollectionId !== "quizzes") {
          return;
        }

        counts.set(parentId, (counts.get(parentId) || 0) + 1);
      });

      return counts;
    } catch (error) {
      console.warn("[EduKids][admin-content] Failed to load version counts:", error);
      return new Map();
    }
  }

  function normalizeTopic(topic) {
    return {
      topicId: normalizeText(topic?.topicId || topic?.id),
      grade: normalizeText(topic?.grade),
      subject: normalizeText(topic?.subject).toLowerCase(),
      title: normalizeText(topic?.title || topic?.name || topic?.topicName),
    };
  }

  function buildBucketRow({ subject, grade, topics, versionCountMap }) {
    const subjectLabel =
      SUBJECTS.find((item) => item.key === subject)?.label || subject || "--";
    const rowTopics = Array.isArray(topics) ? topics : [];
    const versionCount = rowTopics.reduce((sum, topic) => {
      const parentId = buildQuizDocId(topic.grade, topic.subject, topic.topicId);
      return sum + (Number(versionCountMap.get(parentId) || 0) || 0);
    }, 0);

    return {
      subject,
      grade,
      title: `${subjectLabel} lớp ${grade}`,
      subtitle: `Khối ${grade}`,
      versionCount,
      status: versionCount > 0 ? "Đã có version" : "Chưa có version nào",
      statusClass: versionCount > 0 ? "is-green" : "is-orange",
      topics: rowTopics,
    };
  }

  async function fetchAdminContentData() {
    const versionCountMap = await fetchVersionCountMap();
    const subjectGradeResults = await Promise.all(
      SUBJECTS.flatMap((subject) =>
        GRADES.map(async (grade) => {
          const topics = (await fetchTopics(grade, subject.key)).map(normalizeTopic);
          const bucketTopics = topics.filter(
            (topic) => topic.grade === grade && topic.subject === subject.key && topic.topicId,
          );

          return buildBucketRow({
            subject: subject.key,
            grade,
            topics: bucketTopics,
            versionCountMap,
          });
        }),
      ),
    );

    const grouped = {
      math: subjectGradeResults.filter((item) => item.subject === "math"),
      english: subjectGradeResults.filter((item) => item.subject === "english"),
    };

    return {
      grouped,
      hasData:
        grouped.math.some((item) => item.topics.length > 0 || item.versionCount > 0) ||
        grouped.english.some((item) => item.topics.length > 0 || item.versionCount > 0),
    };
  }

  window.EduKidsAdminContentService = {
    fetchAdminContentData,
  };
})();
