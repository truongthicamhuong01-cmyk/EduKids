import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..");
const assetsRoot = path.join(repoRoot, "public", "assets", "pet");
const outputFile = path.join(
  repoRoot,
  "src",
  "pet",
  "assets",
  "petAssetManifest.js",
);

const imageExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
]);

function toPosix(value) {
  return String(value || "").replaceAll("\\", "/");
}

function toSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toTitleCase(value) {
  const normalized = toSlug(value).replace(/-/g, " ");
  if (!normalized) {
    return "";
  }

  return normalized
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (imageExtensions.has(ext)) {
      files.push(fullPath);
    }
  }

  return files;
}

function makeRelativeAssetPath(filePath) {
  return `/assets/pet/${toPosix(path.relative(assetsRoot, filePath))}`;
}

function createEmptyCategory() {
  return {};
}

async function main() {
  const files = await walk(assetsRoot);
  const audit = {
    generatedAt: new Date().toISOString(),
    totalAssets: files.length,
    duplicates: [],
    issues: [],
    summary: {
      avatarPetTypes: [],
      petTypes: [],
      backgrounds: [],
      shopIcons: [],
      orphanAssets: [],
    },
  };

  const manifest = {
    avatarPet: {},
    petTypes: {},
    backgrounds: {},
    shopIcons: {},
    genericIcons: {},
    raw: [],
  };

  const seenPaths = new Map();

  for (const filePath of files) {
    const relativePath = makeRelativeAssetPath(filePath);
    const fileName = path.basename(filePath);
    const dirParts = toPosix(path.relative(assetsRoot, path.dirname(filePath)))
      .split("/")
      .filter(Boolean);
    const baseName = path.basename(fileName, path.extname(fileName));
    const normalizedBaseName = toSlug(baseName);

    if (seenPaths.has(relativePath)) {
      audit.duplicates.push(relativePath);
      continue;
    }
    seenPaths.set(relativePath, true);

    manifest.raw.push(relativePath);

    if (dirParts[0] === "shop") {
      const iconKey = normalizedBaseName;
      manifest.shopIcons[iconKey] = relativePath;
      continue;
    }

    if (dirParts[0] === "avatarPet") {
      const petType = toSlug(dirParts[1]);
      const avatarMatch = normalizedBaseName.match(/^icon-(.+)-level(\d+)$/);

      if (petType && avatarMatch) {
        const levelKey = `level${String(avatarMatch[2]).replace(/^0+/, "") || "0"}`;

        if (!manifest.avatarPet[petType]) {
          manifest.avatarPet[petType] = {
            levels: {},
            displayName: toTitleCase(petType),
          };
        }

        manifest.avatarPet[petType].levels[levelKey] = relativePath;
        continue;
      }
    }

    if (
      dirParts[0] === "backrounds" ||
      dirParts[0] === "backgrounds" ||
      dirParts[0] === "background"
    ) {
      const backgroundMatch = normalizedBaseName.match(/^pet-bg-(.+)$/);
      const petType = toSlug(
        backgroundMatch?.[1] || normalizedBaseName.replace(/^pet-bg-/, ""),
      );

      if (petType) {
        manifest.backgrounds[petType] = relativePath;
      } else {
        manifest.genericIcons[normalizedBaseName] = relativePath;
      }

      continue;
    }

    const petType = toSlug(dirParts[0]);
    const levelMatch = normalizedBaseName.match(/-lv(\d+)-([a-z0-9-]+)$/);

    if (
      petType &&
      levelMatch &&
      dirParts[1] &&
      /^level\d+$/i.test(dirParts[1])
    ) {
      const levelKey = `level${String(levelMatch[1]).replace(/^0+/, "") || "0"}`;
      const moodKey = toSlug(levelMatch[2]);

      if (!manifest.petTypes[petType]) {
        manifest.petTypes[petType] = {
          levels: {},
          backgrounds: [],
          displayName: toTitleCase(petType),
        };
      }

      if (!manifest.petTypes[petType].levels[levelKey]) {
        manifest.petTypes[petType].levels[levelKey] = createEmptyCategory();
      }

      manifest.petTypes[petType].levels[levelKey][moodKey] = relativePath;
      continue;
    }

    audit.summary.orphanAssets.push(relativePath);
    manifest.genericIcons[normalizedBaseName] = relativePath;
  }

  const avatarPetTypes = Object.keys(manifest.avatarPet).sort();
  const petTypes = Object.keys(manifest.petTypes).sort();
  const backgroundKeys = Object.keys(manifest.backgrounds).sort();
  const shopIconKeys = Object.keys(manifest.shopIcons).sort();

  audit.summary.avatarPetTypes = avatarPetTypes;
  audit.summary.petTypes = petTypes;
  audit.summary.backgrounds = backgroundKeys;
  audit.summary.shopIcons = shopIconKeys;

  if (avatarPetTypes.length === 0) {
    audit.issues.push({
      type: "missing-avatar-pet",
      message:
        "Không phát hiện avatarPet nào trong frontend/public/assets/pet.",
    });
  }

  if (petTypes.length === 0) {
    audit.issues.push({
      type: "missing-pet-types",
      message: "Không phát hiện petType nào trong frontend/public/assets/pet.",
    });
  }

  if (backgroundKeys.length === 0) {
    audit.issues.push({
      type: "missing-backgrounds",
      message: "Không phát hiện background Pet nào.",
    });
  }

  if (
    !manifest.genericIcons["default"] &&
    !manifest.genericIcons["pet-default"]
  ) {
    audit.issues.push({
      type: "missing-global-default",
      message: "Không có asset mặc định dùng làm fallback toàn cục.",
    });
  }

  if (
    Object.keys(manifest.backgrounds).some((key) => key.includes("backround"))
  ) {
    audit.issues.push({
      type: "folder-typo",
      message:
        "Phát hiện thư mục backrounds bị sai chính tả. Nên đổi thành backgrounds để đồng bộ quy ước.",
    });
  } else if (
    files.some((filePath) => toPosix(filePath).includes("/backrounds/"))
  ) {
    audit.issues.push({
      type: "folder-typo",
      message:
        "Phát hiện thư mục backrounds bị sai chính tả. Nên đổi thành backgrounds để đồng bộ quy ước.",
    });
  }

  const content = `// This file is generated by scripts/generate-pet-assets.mjs
export const petAssetManifest = ${JSON.stringify(manifest, null, 2)};

export const petAssetAudit = ${JSON.stringify(audit, null, 2)};
`;

  await fs.writeFile(outputFile, content, "utf8");
  console.log(
    `[pet-assets] generated ${toPosix(path.relative(repoRoot, outputFile))}`,
  );
  console.log(`[pet-assets] total assets: ${files.length}`);
  if (audit.issues.length > 0) {
    console.log("[pet-assets] audit issues:");
    audit.issues.forEach((issue) => {
      console.log(`- ${issue.type}: ${issue.message}`);
    });
  }
}

main().catch((error) => {
  console.error("[pet-assets] generation failed", error);
  process.exitCode = 1;
});
