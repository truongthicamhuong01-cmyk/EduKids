/*
 * Chức năng: API cho Pet và kho đồ đi kèm của học sinh.
 * Dữ liệu đầu vào: uid từ token, hành động nuôi pet, item trong kho.
 * Dữ liệu đầu ra: Trạng thái pet, ví, pop-up và animation.
 * File liên quan: src/controllers/petController.js, src/controllers/inventoryController.js, src/services/petService.js
 */
const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const { getInventory, useItem } = require("../controllers/inventoryController");
const {
  feed,
  getPet,
  play,
  selectPet,
  sleep,
  wake,
} = require("../controllers/petController");

const router = express.Router();

router.get("/", verifyToken, getPet);
router.post("/select", verifyToken, selectPet);
router.post("/feed", verifyToken, feed);
router.post("/play", verifyToken, play);
router.post("/sleep", verifyToken, sleep);
router.post("/wake", verifyToken, wake);
router.get("/inventory", verifyToken, getInventory);
router.post("/inventory/use", verifyToken, useItem);

module.exports = router;
