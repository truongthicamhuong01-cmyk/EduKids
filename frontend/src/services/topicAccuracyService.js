/*
 * Chức năng: Tính phần trăm đúng theo chủ đề để hiển thị trên giao diện.
 * Dữ liệu đầu vào: danh sách câu đúng/sai hoặc số liệu đã lưu.
 * Dữ liệu đầu ra: totalAnswered, totalCorrect và percentage.
 * File liên quan: backend/src/services/quizGradeService.js, backend/src/services/quizSelectionService.js
 */
(() => {
  function calculateTopicAccuracy(topicResults) {
    const normalizedResults = Array.isArray(topicResults)
      ? topicResults.map((item) => ({
          isCorrect: Boolean(item && item.isCorrect === true),
        }))
      : [];

    const totalAnswered = normalizedResults.length;
    const totalCorrect = normalizedResults.filter((result) => result.isCorrect).length;
    const percentage = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

    return {
      totalAnswered,
      totalCorrect,
      percentage,
    };
  }

  function normalizeTopicAccuracySummary(topic) {
    const totalAnswered = Math.max(0, Number(topic?.totalAnswered) || 0);
    const totalCorrect = Math.max(0, Number(topic?.totalCorrect) || 0);
    const rawPercentage = Number(topic?.percentage);
    const percentage = Number.isFinite(rawPercentage)
      ? Math.max(0, Math.min(100, Math.round(rawPercentage)))
      : totalAnswered > 0
        ? Math.round((totalCorrect / totalAnswered) * 100)
        : 0;

    return {
      totalAnswered,
      totalCorrect,
      percentage,
    };
  }

  function getTopicAccuracyProgressClass(percentage) {
    const value = Number(percentage) || 0;

    if (value <= 33) {
      return "is-red";
    }

    if (value <= 66) {
      return "is-yellow";
    }

    return "is-green";
  }

  window.EduKidsTopicAccuracyService = {
    calculateTopicAccuracy,
    getTopicAccuracyProgressClass,
    normalizeTopicAccuracySummary,
  };
})();
