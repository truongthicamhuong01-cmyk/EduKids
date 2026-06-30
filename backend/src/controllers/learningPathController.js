const {
  executeLearningPathAction,
  getLearningPathState,
} = require("../services/learningPathService");
const { findUserById } = require("../services/userService");
const { rewardLearningPath } = require("../services/rewardService");

async function getState(req, res, next) {
  try {
    const { userId } = req.params;
    const result = await getLearningPathState(userId);
    const state = result?.state || {};
    const events = Array.isArray(result?.events) ? result.events : [];

    console.log("[LP_API_GET_STATE]", {
      userId: String(userId || "").trim(),
      walletEduCoin: state?.wallet?.eduCoin,
    });

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
    const rewardEvents = events.filter((event) => {
      const type = String(event?.type || "").trim();
      return type === "REWARD_GRANTED" || type === "MOUNTAIN_COMPLETED";
    });

    await Promise.all(
      rewardEvents.map((event, index) =>
        rewardLearningPath({
          userId,
          sourceId: [
            String(event?.type || "reward").trim(),
            String(event?.checkpointId || state.currentCheckpointId || state.checkpointId || "learning-path").trim(),
            String(event?.mountainId || "").trim(),
            String(index),
          ]
            .filter(Boolean)
            .join(":"),
          rewardOverride: event.reward || null,
          idempotencyKey: [
            "learning-path",
            userId,
            String(event?.type || "reward").trim(),
            String(event?.checkpointId || state.currentCheckpointId || state.checkpointId || "learning-path").trim(),
            String(event?.mountainId || "").trim(),
            String(index),
          ]
            .filter(Boolean)
            .join(":"),
        }).catch(() => null),
      ),
    );

    const refreshedProfile = await findUserById(userId).catch(() => null);
    const refreshedWallet = {
      eduCoin: Math.max(0, Number(refreshedProfile?.stats?.eduCoin || 0)),
    };
    state.wallet = refreshedWallet;

    console.log("[LP_API_ACTION]", {
      userId,
      walletEduCoin: state?.wallet?.eduCoin,
    });

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
