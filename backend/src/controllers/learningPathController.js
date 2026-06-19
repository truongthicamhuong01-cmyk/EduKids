const {
  executeLearningPathAction,
  getLearningPathState,
} = require("../services/learningPathService");

async function getState(req, res, next) {
  try {
    const { userId } = req.params;
    const result = await getLearningPathState(userId);

    res.status(200).json({
      state: result.state,
      events: result.events || [],
    });
  } catch (error) {
    next(error);
  }
}

async function action(req, res, next) {
  try {
    const result = await executeLearningPathAction(req.body || {});

    res.status(200).json({
      state: result.state,
      events: result.events,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getState,
  action,
};
