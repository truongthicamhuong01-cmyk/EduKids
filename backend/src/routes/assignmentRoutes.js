const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const { createAssignment } = require("../controllers/assignmentController");

const router = express.Router();

router.post("/", verifyToken, createAssignment);
router.post("/create", verifyToken, createAssignment);

module.exports = router;
