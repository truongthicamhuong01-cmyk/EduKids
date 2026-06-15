const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const {
  createAssignment,
  getStudentAssignments,
  submitAssignment,
  getAssignmentSubmissions,
  getAssignmentById,
} = require("../controllers/assignmentController");
const {
  generateAssignmentAiQuestions,
} = require("../controllers/assignmentAiController");

const router = express.Router();

router.post("/", verifyToken, createAssignment);
router.post("/create", verifyToken, createAssignment);
router.post("/generate-ai", verifyToken, generateAssignmentAiQuestions);
router.post("/submit", verifyToken, submitAssignment);
router.get("/student", verifyToken, getStudentAssignments);
router.get("/:assignmentId/submissions", verifyToken, getAssignmentSubmissions);
router.get("/:assignmentId", verifyToken, getAssignmentById);

module.exports = router;
