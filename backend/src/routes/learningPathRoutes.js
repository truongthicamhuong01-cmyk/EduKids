const express = require("express");
const { action, getState } = require("../controllers/learningPathController");

const router = express.Router();

router.post("/action", action);
router.get("/state/:userId", getState);

module.exports = router;
