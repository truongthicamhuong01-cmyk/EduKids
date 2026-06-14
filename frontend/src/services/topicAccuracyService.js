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
