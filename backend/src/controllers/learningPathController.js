const {
  executeLearningPathAction,
  getLearningPathState,
} = require("../services/learningPathService");

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
