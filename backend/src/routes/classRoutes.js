const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const { createClass, join, myClasses } = require("../controllers/classController");

const router = express.Router();

router.post("/", verifyToken, createClass);
router.post("/create", verifyToken, createClass);
router.post("/join", verifyToken, join);
router.get("/my", verifyToken, myClasses);

module.exports = router;
