const { applyPetDecay } = require("./petDecayService");

async function applyOfflineDecay(petState = {}, petBalance = {}, now = new Date()) {
  return applyPetDecay(petState, { petBalance }, now);
}

module.exports = {
  applyOfflineDecay,
};
