(() => {
  const SUBJECTS = [
    { key: "math", label: "Toán" },
    { key: "english", label: "Tiếng Anh" },
  ];

  const GRADES = ["1", "2", "3", "4", "5"];

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function getSubjectLabel(subject) {
    return SUBJECTS.find((item) => item.key === subject)?.label || subject || "--";
  }

  function fetchTopics(grade, subject) {
    const api = window.EduKidsApi?.requestAdmin;

    if (typeof api !== "function") {
      return Promise.resolve([]);
    }

    return api(
      `/api/admin/topics?grade=${encodeURIComponent(String(grade || ""))}&subject=${encodeURIComponent(String(subject || ""))}`,
      { method: "GET" },
    )
      .then((response) => (Array.isArray(response?.data) ? response.data : []))
      .catch((error) => {
        console.warn("[EduKids][admin-content] Failed to load topics:", error);
        return [];
      });
  }

  function normalizeTopic(topic, grade, subject) {
    const topicId = normalizeText(topic?.topicId || topic?.id);
    const totalAnswered = normalizeNumber(topic?.totalAnswered);
    const totalCorrect = normalizeNumber(topic?.totalCorrect);
    const percentage =
      totalAnswered > 0
        ? Math.round((totalCorrect / totalAnswered) * 100)
        : Number.isFinite(Number(topic?.percentage))
          ? Math.max(0, Math.min(100, Math.round(Number(topic?.percentage))))
          : null;
    const versionCount = Math.max(0, normalizeNumber(topic?.versionCount));

    return {
      topicId,
      grade: normalizeText(topic?.grade || grade),
      subject: normalizeText(topic?.subject || subject).toLowerCase(),
      title: normalizeText(topic?.title || topic?.name || topic?.topicName),
      image: normalizeText(topic?.image),
      description: normalizeText(topic?.description),
      versionCount,
      totalAnswered,
      totalCorrect,
      percentage,
      hasProgressData: totalAnswered > 0,
      hasQuiz: Boolean(topic?.hasQuiz || versionCount > 0),
      quizId: normalizeText(topic?.quizId),
    };
  }

  function buildBucketRow({ subject, grade, topics }) {
    const rowTopics = Array.isArray(topics) ? topics : [];
    const totalAnswered = rowTopics.reduce((sum, topic) => sum + normalizeNumber(topic.totalAnswered), 0);
    const totalCorrect = rowTopics.reduce((sum, topic) => sum + normalizeNumber(topic.totalCorrect), 0);
    const versionCount = rowTopics.reduce((sum, topic) => sum + Math.max(0, normalizeNumber(topic.versionCount)), 0);
    const coveredTopics = rowTopics.filter((topic) => topic.hasProgressData).length;
    const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : null;

    return {
      subject,
      grade,
      title: `${getSubjectLabel(subject)} lớp ${grade}`,
      subtitle: `Khối ${grade}`,
      versionCount,
      accuracy,
      totalAnswered,
      totalCorrect,
      coveredTopics,
      topicCount: rowTopics.length,
      status: versionCount > 0 ? "Đã có version" : "Chưa có version nào",
      statusClass: versionCount > 0 ? "is-green" : "is-orange",
      topics: rowTopics
        .slice()
        .sort((left, right) => (left.title || "").localeCompare(right.title || "", "vi")),
    };
  }

  async function fetchAdminContentData() {
    const subjectGradeResults = await Promise.all(
      SUBJECTS.flatMap((subject) =>
        GRADES.map(async (grade) => {
          const topics = (await fetchTopics(grade, subject.key)).map((topic) =>
            normalizeTopic(topic, grade, subject.key),
          );

          return buildBucketRow({
            subject: subject.key,
            grade,
            topics: topics.filter((topic) => topic.topicId),
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
        grouped.math.some((item) => item.topicCount > 0 || item.versionCount > 0) ||
        grouped.english.some((item) => item.topicCount > 0 || item.versionCount > 0),
    };
  }

  window.EduKidsAdminContentService = {
    fetchAdminContentData,
  };
})();
