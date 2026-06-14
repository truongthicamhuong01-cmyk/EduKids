function normalizeTopicResultItem(item) {
  return {
    isCorrect: Boolean(item && item.isCorrect === true),
  };
}

function calculateTopicAccuracy(topicResults) {
  const normalizedResults = Array.isArray(topicResults)
    ? topicResults.map(normalizeTopicResultItem)
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

module.exports = {
  calculateTopicAccuracy,
};
