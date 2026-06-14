const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const {
  createAssignment,
  getStudentAssignments,
} = require("../controllers/assignmentController");

const router = express.Router();

router.post("/", verifyToken, createAssignment);
router.post("/create", verifyToken, createAssignment);
router.get("/student", verifyToken, getStudentAssignments);

module.exports = router;
