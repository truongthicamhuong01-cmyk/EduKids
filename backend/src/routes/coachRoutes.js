const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const { analyzeCoach } = require("../controllers/coachController");

const router = express.Router();

router.post("/analyze", verifyToken, analyzeCoach);

module.exports = router;
