const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const { getInventory, useItem } = require("../controllers/inventoryController");
const {
  feed,
  getPet,
  play,
  selectPet,
  sleep,
} = require("../controllers/petController");

const router = express.Router();

router.get("/", verifyToken, getPet);
router.post("/select", verifyToken, selectPet);
router.post("/feed", verifyToken, feed);
router.post("/play", verifyToken, play);
router.post("/sleep", verifyToken, sleep);
router.get("/inventory", verifyToken, getInventory);
router.post("/inventory/use", verifyToken, useItem);

module.exports = router;
