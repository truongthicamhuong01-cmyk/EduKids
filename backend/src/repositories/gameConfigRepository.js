const { db } = require("../firebase");
const ApiError = require("../utils/apiError");
const { PET_COLLECTIONS, PET_ERROR_CODES } = require("../constants/petConstants");

const gameConfigCollection = db.collection(PET_COLLECTIONS.GAME_CONFIG);
const configCache = new Map();
const CONFIG_CACHE_TTL_MS = 30 * 1000;

const REQUIRED_DOC_IDS = ["petBalance", "levelConfig", "evolutionConfig"];

function normalizeConfigId(value) {
  return String(value || "").trim();
}

async function readConfigDoc(docId, transaction = null) {
  const normalizedDocId = normalizeConfigId(docId);
  const ref = gameConfigCollection.doc(normalizedDocId);
  if (!transaction) {
    const cached = configCache.get(normalizedDocId);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        id: normalizedDocId,
        ...(cached.value || {}),
      };
    }
  }

  const snapshot = transaction ? await transaction.get(ref) : await ref.get();

  if (!snapshot.exists) {
    return null;
  }

  const value = {
    id: snapshot.id,
    ...(snapshot.data() || {}),
  };

  if (!transaction) {
    configCache.set(normalizedDocId, {
      value: { ...value },
      expiresAt: Date.now() + CONFIG_CACHE_TTL_MS,
    });
  }

  return value;
}

async function getGameConfigBundle(transaction = null) {
  const docs = await Promise.all(
    REQUIRED_DOC_IDS.map((docId) => readConfigDoc(normalizeConfigId(docId), transaction)),
  );

  const missingDocs = REQUIRED_DOC_IDS.filter((_, index) => !docs[index]);

  if (missingDocs.length > 0) {
    throw new ApiError(
      500,
      "Thiếu cấu hình game cho module Pet",
      PET_ERROR_CODES.GAME_CONFIG_NOT_FOUND,
      { missingDocs },
    );
  }

  const [petBalance, levelConfig, evolutionConfig] = docs;

  return {
    petBalance,
    levelConfig,
    evolutionConfig,
  };
}

module.exports = {
  getGameConfigBundle,
  readConfigDoc,
};
