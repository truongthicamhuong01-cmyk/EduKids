const express = require("express");
const { login, resetTeacherPassword } = require("../controllers/adminController");

const router = express.Router();

router.post("/login", login);
router.post("/teacher/reset-password", resetTeacherPassword);

module.exports = router;
