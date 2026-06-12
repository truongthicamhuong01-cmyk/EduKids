const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const { me, updateMe } = require("../controllers/userController");

const router = express.Router();

router.get("/me", verifyToken, me);
router.put("/me", verifyToken, updateMe);

module.exports = router;
