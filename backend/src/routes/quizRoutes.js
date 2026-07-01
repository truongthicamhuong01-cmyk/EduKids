/*
 * Chức năng: API tạo quiz AI, lấy danh sách topic và nộp bài quiz.
 * Dữ liệu đầu vào: user đã đăng nhập, grade/subject/topicId, danh sách đáp án.
 * Dữ liệu đầu ra: Quiz, danh sách topic, kết quả chấm và phần thưởng.
 * File liên quan: src/controllers/quizController.js, src/controllers/quizReadController.js, src/controllers/quizSubmitController.js
 */
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
