const {
  executeLearningPathAction,
  getLearningPathState,
} = require("../services/learningPathService");
const { rewardLearningPath } = require("../services/rewardService");

async function getState(req, res, next) {
  try {
    const { userId } = req.params;
    const result = await getLearningPathState(userId);
    const state = result?.state || {};
    const events = Array.isArray(result?.events) ? result.events : [];

    res.status(200).json({
      state,
      events,
    });
  } catch (error) {
    next(error);
  }
}

async function action(req, res, next) {
  try {
    const result = await executeLearningPathAction(req.body || {});
    const state = result?.state || {};
    const events = Array.isArray(result?.events) ? result.events : [];
    const userId = String(req.body?.userId || "").trim();
    const rewardEvents = events.filter((event) => String(event?.type || "").trim() === "REWARD_GRANTED");

    await Promise.all(
      rewardEvents.map((event, index) =>
        rewardLearningPath({
          userId,
          sourceId: `${state.currentCheckpointId || state.checkpointId || "learning-path"}:${index}`,
          rewardOverride: event.reward || null,
          idempotencyKey: `learning-path:${userId}:${state.currentCheckpointId || state.checkpointId || "learning-path"}:${index}`,
        }).catch(() => null),
      ),
    );

    res.status(200).json({
      state,
      events,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getState,
  action,
};
