import { petAssetAudit, petAssetManifest } from "../assets/petAssetManifest.js";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeSlug(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizeLevelKey(value) {
  const raw = normalizeText(value);
  if (!raw) {
    return "";
  }

  const match = raw.match(/(\d+)/);
  if (!match) {
    return raw.startsWith("level") ? raw : `level${raw}`;
  }

  return `level${String(Number(match[1]) || 0)}`;
}

function normalizeAssetPath(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  if (/^(https?:|data:|blob:)/i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("/")) {
    return raw;
  }

  return `/${raw.replace(/^\.\/+/, "")}`;
}

function getFirstManifestPath(collection) {
  return normalizeAssetPath(Object.values(collection || {})[0] || "");
}

function getItemIconAlias(iconKey, category) {
  const aliases = {
    apple: "cookie",
    biscuit: "cookie",
    bread: "cookie",
    cake: "present",
    candy: "present",
    cushion: "present",
    dessert: "cookie",
    eventpass: "present",
    "event-pass": "present",
    food: "cookie",
    foods: "cookie",
    fluffy: "ball",
    "medicine-kit": "present",
    medicinekit: "present",
    hat: "present",
    rice: "cookie",
    snack: "cookie",
    teddy: "ball",
    toy: "ball",
  };

  if (aliases[iconKey]) {
    return aliases[iconKey];
  }

  if (category === "food" || category === "foods") {
    return "cookie";
  }

  return "";
}

function getPetEntry(petType) {
  const key = normalizeSlug(petType);
  return petAssetManifest.petTypes?.[key] || null;
}

function getLevelAssets(petType, levelKey) {
  const petEntry = getPetEntry(petType);
  if (!petEntry) {
    return null;
  }

  return petEntry.levels?.[levelKey] || null;
}

export function resolvePetAssetPath({ petType = "", stage = "", mood = "", level = "" } = {}) {
  const petEntry = getPetEntry(petType);
  const normalizedMood = normalizeSlug(mood);
  const normalizedStage = normalizeLevelKey(stage || level);
  const fallbackLevelKey = normalizedStage || "level1";

  if (!petEntry) {
    return (
      getFirstManifestPath(petAssetManifest.genericIcons) ||
      getFirstManifestPath(petAssetManifest.raw)
    );
  }

  const stageAssets = getLevelAssets(petType, fallbackLevelKey);
  if (stageAssets?.[normalizedMood]) {
    return stageAssets[normalizedMood];
  }

  if (stageAssets) {
    const firstStageAsset = getFirstManifestPath(stageAssets);
    if (firstStageAsset) {
      return firstStageAsset;
    }
  }

  const availableLevels = Object.keys(petEntry.levels || {}).sort((left, right) => {
    return Number(left.replace("level", "")) - Number(right.replace("level", ""));
  });

  for (const key of availableLevels) {
    const assets = petEntry.levels[key];
    if (assets?.[normalizedMood]) {
      return assets[normalizedMood];
    }
    const firstAsset = getFirstManifestPath(assets);
    if (firstAsset) {
      return firstAsset;
    }
  }

  return (
    normalizeAssetPath(petEntry.backgrounds?.[0]) ||
    normalizeAssetPath(petAssetManifest.backgrounds?.[normalizeSlug(petType)]) ||
    getFirstManifestPath(petAssetManifest.raw)
  );
}

export function resolveBackgroundPath({ petType = "" } = {}) {
  const normalizedPetType = normalizeSlug(petType);
  const preferredBackgrounds = {
    elephant: "/assets/pet/background/pet-bg-elephant.png",
    horse: "/assets/pet/background/pet-bg-horse.png",
  };

  return (
    normalizeAssetPath(preferredBackgrounds[normalizedPetType]) ||
    normalizeAssetPath(petAssetManifest.backgrounds?.[normalizedPetType]) ||
    getFirstManifestPath(petAssetManifest.backgrounds) ||
    getFirstManifestPath(petAssetManifest.raw)
  );
}

export function resolveSceneBackgroundPath({ petType = "" } = {}) {
  const normalizedPetType = normalizeSlug(petType);
  const preferredSceneBackgrounds = {
    elephant: "/assets/pet/background/pet-bg-elephant-small.png",
    horse: "/assets/pet/background/pet-bg-horse-small.png",
  };

  return (
    normalizeAssetPath(preferredSceneBackgrounds[normalizedPetType]) ||
    normalizeAssetPath(petAssetManifest.backgrounds?.[normalizedPetType]) ||
    getFirstManifestPath(petAssetManifest.backgrounds) ||
    getFirstManifestPath(petAssetManifest.raw)
  );
}

export function resolveItemIconPath(item = {}) {
  const iconKey = normalizeSlug(item.icon || item.itemId);
  const category = normalizeSlug(item.category);
  const aliasKey = getItemIconAlias(iconKey, category);

  if (String(item.icon || "").trim().startsWith("/")) {
    return normalizeAssetPath(item.icon);
  }

  return (
    normalizeAssetPath(petAssetManifest.shopIcons?.[iconKey]) ||
    (aliasKey ? normalizeAssetPath(petAssetManifest.shopIcons?.[aliasKey]) : "") ||
    normalizeAssetPath(petAssetManifest.genericIcons?.[iconKey]) ||
    normalizeAssetPath(petAssetManifest.genericIcons?.[category]) ||
    (aliasKey ? normalizeAssetPath(petAssetManifest.genericIcons?.[aliasKey]) : "") ||
    getFirstManifestPath(petAssetManifest.shopIcons) ||
    getFirstManifestPath(petAssetManifest.genericIcons) ||
    ""
  );
}

export function resolvePopupIconPath(icon = "") {
  const normalized = normalizeSlug(icon);

  if (String(icon || "").trim().startsWith("/")) {
    return normalizeAssetPath(icon);
  }

  return (
    normalizeAssetPath(petAssetManifest.genericIcons?.[normalized]) ||
    normalizeAssetPath(petAssetManifest.shopIcons?.[normalized]) ||
    getFirstManifestPath(petAssetManifest.shopIcons) ||
    getFirstManifestPath(petAssetManifest.genericIcons) ||
    ""
  );
}

export function getAssetAudit() {
  return petAssetAudit;
}

export function listKnownPetTypes() {
  return Object.keys(petAssetManifest.petTypes || {});
}
