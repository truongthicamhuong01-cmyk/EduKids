/*
 * Chức năng: API AI Coach để phân tích tiến độ học của học sinh.
 * Dữ liệu đầu vào: user đã đăng nhập và dữ liệu tiến trình trong Firestore.
 * Dữ liệu đầu ra: Nhận xét, điểm mạnh, điểm cần luyện thêm.
 * File liên quan: src/controllers/coachController.js, src/services/coachAnalysisService.js
 */
const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const { analyzeCoach } = require("../controllers/coachController");

const router = express.Router();

router.post("/analyze", verifyToken, analyzeCoach);

module.exports = router;
