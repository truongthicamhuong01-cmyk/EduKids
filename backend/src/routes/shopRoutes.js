const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const { getShop, buyItem } = require("../controllers/shopController");

const router = express.Router();

router.get("/", verifyToken, getShop);
router.post("/buy", verifyToken, buyItem);

module.exports = router;
