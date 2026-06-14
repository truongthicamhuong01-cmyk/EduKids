const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const {
  createAssignment,
  getStudentAssignments,
  submitAssignment,
  getAssignmentSubmissions,
} = require("../controllers/assignmentController");

const router = express.Router();

router.post("/", verifyToken, createAssignment);
router.post("/create", verifyToken, createAssignment);
router.post("/submit", verifyToken, submitAssignment);
router.get("/:assignmentId/submissions", verifyToken, getAssignmentSubmissions);
router.get("/student", verifyToken, getStudentAssignments);

module.exports = router;
