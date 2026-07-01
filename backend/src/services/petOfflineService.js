/*
 * Chức năng: Áp dụng hao mòn Pet khi người chơi quay lại sau một thời gian.
 * Dữ liệu đầu vào: petState, petBalance và thời điểm kiểm tra.
 * Dữ liệu đầu ra: Trạng thái Pet đã được trừ hao theo thời gian offline.
 * File liên quan: src/services/petDecayService.js
 */
const { applyPetDecay } = require("./petDecayService");

async function applyOfflineDecay(petState = {}, petBalance = {}, now = new Date()) {
  return applyPetDecay(petState, { petBalance }, now);
}

module.exports = {
  applyOfflineDecay,
};
