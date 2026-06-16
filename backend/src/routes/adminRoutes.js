const express = require("express");
const {
  getTopics,
  login,
  resetTeacherPassword,
} = require("../controllers/adminController");

const router = express.Router();

router.post("/login", login);
router.get("/topics", getTopics);
router.post("/teacher/reset-password", resetTeacherPassword);

module.exports = router;
