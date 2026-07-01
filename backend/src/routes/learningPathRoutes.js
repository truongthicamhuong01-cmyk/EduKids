/*
 * Chức năng: Lấy trạng thái và thực thi hành động của Learning Path.
 * Dữ liệu đầu vào: userId, action, payload nhiệm vụ/trạm.
 * Dữ liệu đầu ra: Trạng thái hành trình, phần thưởng và sự kiện mở khóa.
 * File liên quan: src/controllers/learningPathController.js, src/services/learningPathService.js
 */
const express = require("express");
const { action, getState } = require("../controllers/learningPathController");

const router = express.Router();

router.post("/action", action);
router.get("/state/:userId", getState);

module.exports = router;
