const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const {
  answerSession,
  createSession,
  completeSession,
  hintSession,
  getSession,
} = require("../controllers/battleSessionController");

const router = express.Router();

router.post("/", verifyToken, createSession);
router.get("/:sessionId", verifyToken, getSession);
router.post("/:sessionId/answer", verifyToken, answerSession);
router.post("/:sessionId/complete", verifyToken, completeSession);
router.post("/:sessionId/hint", verifyToken, hintSession);

module.exports = router;
