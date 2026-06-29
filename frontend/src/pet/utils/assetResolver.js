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
    apple: "apple",
    biscuit: "biscuit",
    bread: "bread",
    cake: "cake",
    candy: "candy",
    cushion: "cushion",
    dessert: "dessert",
    eventpass: "present",
    "event-pass": "present",
    food: "cookie",
    foods: "cookie",
    fluffy: "ball",
    "medicine-kit": "present",
    medicinekit: "medicinekit",
    hat: "present",
    rice: "cookie",
    snack: "cookie",
    teddy: "teddy",
    toy: "toy",
    tohe: "to-he",
    papermask: "paper-mask",
    firstaidkit: "firstaidkit",
    herbaltea: "herbaltea",
    lotusmedicine: "lotus-medicine",
    xoigac: "xoi-gac",
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

function getAvatarPetEntry(petType) {
  const key = normalizeSlug(petType);
  return petAssetManifest.avatarPet?.[key] || null;
}

function getAvatarLevelKey({ stage = "", level = "" } = {}) {
  const normalizedStage = normalizeSlug(stage);
  const normalizedLevel = normalizeLevelKey(level);

  const stageMap = {
    baby: "level1",
    young: "level10",
    teen: "level20",
    hero: "level30",
    legend: "level50",
    mythic: "level50",
  };

  if (normalizedStage && stageMap[normalizedStage]) {
    return stageMap[normalizedStage];
  }

  if (normalizedLevel) {
    const levelNumber = Number(normalizedLevel.replace("level", ""));
    if (Number.isFinite(levelNumber)) {
      if (levelNumber < 5) {
        return "level1";
      }
      if (levelNumber < 12) {
        return "level10";
      }
      if (levelNumber < 20) {
        return "level20";
      }
      if (levelNumber < 30) {
        return "level30";
      }
      return "level50";
    }
  }

  return "level1";
}

export function resolvePetAvatarPath({ petType = "", stage = "", level = "" } = {}) {
  const petEntry = getAvatarPetEntry(petType);
  const fallbackLevelKey = getAvatarLevelKey({ stage, level });

  if (!petEntry) {
    return resolvePetAssetPath({ petType, stage, level });
  }

  const stageAsset = normalizeAssetPath(petEntry.levels?.[fallbackLevelKey]);
  if (stageAsset) {
    return stageAsset;
  }

  const availableLevels = Object.keys(petEntry.levels || {}).sort((left, right) => {
    return Number(left.replace("level", "")) - Number(right.replace("level", ""));
  });

  for (const key of availableLevels) {
    const assetPath = normalizeAssetPath(petEntry.levels?.[key]);
    if (assetPath) {
      return assetPath;
    }
  }

  return resolvePetAssetPath({ petType, stage, level });
}

export function resolvePetAssetPath({ petType = "", stage = "", mood = "", level = "", isSleeping = false } = {}) {
  const petEntry = getPetEntry(petType);
  const normalizedMood = normalizeSlug(mood);
  const visualMood = Boolean(isSleeping) ? "sleepy" : normalizedMood === "sleepy" ? "normal" : normalizedMood;
  const normalizedStage = normalizeLevelKey(stage || level);
  const fallbackLevelKey = normalizedStage || "level1";

  if (!petEntry) {
    return (
      getFirstManifestPath(petAssetManifest.genericIcons) ||
      getFirstManifestPath(petAssetManifest.raw)
    );
  }

  const stageAssets = getLevelAssets(petType, fallbackLevelKey);
  if (stageAssets?.[visualMood]) {
    return stageAssets[visualMood];
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
    if (assets?.[visualMood]) {
      return assets[visualMood];
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
    elephant: "/assets/pet/background/pet-bg-elephant-fein.png",
    horse: "/assets/pet/background/pet-bg-horse-fein.png",
  };

  return (
    normalizeAssetPath(preferredSceneBackgrounds[normalizedPetType]) ||
    normalizeAssetPath(petAssetManifest.backgrounds?.[normalizedPetType]) ||
    getFirstManifestPath(petAssetManifest.backgrounds) ||
    getFirstManifestPath(petAssetManifest.raw)
  );
}

export function resolveShopBackgroundPath({ petType = "" } = {}) {
  const normalizedPetType = normalizeSlug(petType);
  const preferredShopBackgrounds = {
    elephant: "/assets/pet/background/pet-bg-elephant-shop.png",
    horse: "/assets/pet/background/pet-bg-horse-shop.png",
  };

  return (
    normalizeAssetPath(preferredShopBackgrounds[normalizedPetType]) ||
    normalizeAssetPath(petAssetManifest.backgrounds?.[normalizedPetType]) ||
    getFirstManifestPath(petAssetManifest.backgrounds) ||
    getFirstManifestPath(petAssetManifest.raw)
  );
}

export function resolveItemIconPath(item = {}) {
  const itemKey = normalizeSlug(item.itemId || item.id || item.key || item.code);
  const iconKey = normalizeSlug(item.icon);
  const category = normalizeSlug(item.category);
  const canonicalKey = itemKey || iconKey;
  const aliasKey = getItemIconAlias(canonicalKey || iconKey, category);

  if (String(item.icon || "").trim().startsWith("/")) {
    return normalizeAssetPath(item.icon);
  }

  return (
    normalizeAssetPath(petAssetManifest.shopIcons?.[canonicalKey]) ||
    normalizeAssetPath(petAssetManifest.shopIcons?.[iconKey]) ||
    (aliasKey ? normalizeAssetPath(petAssetManifest.shopIcons?.[aliasKey]) : "") ||
    normalizeAssetPath(petAssetManifest.genericIcons?.[canonicalKey]) ||
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
