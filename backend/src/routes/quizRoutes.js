const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const { createQuiz } = require("../controllers/quizController");
const { getTopics, getQuizByTopicId } = require("../controllers/quizReadController");
const { submitQuiz } = require("../controllers/quizSubmitController");

const router = express.Router();

router.post("/generate", verifyToken, createQuiz);
router.get("/topics", verifyToken, getTopics);
router.get("/by-topic", verifyToken, getQuizByTopicId);
router.post("/submit", verifyToken, submitQuiz);

module.exports = router;
