require("dotenv").config();

const { db } = require("../src/firebase");

const gameConfigCollection = db.collection("gameConfig");
const now = new Date().toISOString();

const petBalance = {
  version: "1.0.0",
  statLimits: {
    minValue: 0,
    maxValue: 100,
  },
  initialState: {
    level: 1,
    exp: 0,
    hunger: 78,
    happiness: 78,
    energy: 78,
    health: 88,
  },
  actions: {
    feed: {
      cooldownSeconds: 120,
      minHungerToAllow: 95,
      hungerIncrease: 18,
      happinessIncrease: 2,
      healthIncrease: 1,
      expIncrease: 4,
    },
    play: {
      cooldownSeconds: 300,
      minEnergyToAllow: 15,
      happinessIncrease: 12,
      energyDecrease: 8,
      expIncrease: 4,
    },
    sleep: {
      cooldownSeconds: 600,
      maxEnergyToAllow: 95,
      energyIncrease: 28,
      healthIncrease: 6,
      happinessIncrease: 1,
    },
  },
  offline: {
    capMinutes: 1440,
    stepMinutes: 10,
    hungerDecayPerStep: 1,
    energyDecayPerStep: 1,
    happinessDecayPerStep: 1,
    happinessDecayEverySteps: 2,
    health: {
      lowThreshold: 20,
      lowDurationMinutes: 360,
      stepMinutes: 30,
      oneLowDecayPerStep: 1,
      twoLowDecayPerStep: 2,
      threeLowDecayPerStep: 3,
    },
  },
  moodThresholds: {
    sickThreshold: 35,
    sleepyThreshold: 40,
    hungryThreshold: 40,
    sadThreshold: 40,
    happy: {
      hunger: 70,
      happiness: 75,
      energy: 70,
      health: 80,
    },
  },
  createdAt: now,
  updatedAt: now,
};

const levelConfig = {
  version: "1.0.0",
  curveType: "quadratic",
  baseExp: 80,
  linearStep: 35,
  quadraticFactor: 0.8,
  levelCap: 100,
  createdAt: now,
  updatedAt: now,
};

const evolutionConfig = {
  version: "1.0.0",
  defaultStage: "baby",
  petTypes: ["horse", "cat", "dog"],
  stages: [
    { id: "baby", minLevel: 1, minHealth: 0, minHappiness: 0, minHunger: 0 },
    { id: "young", minLevel: 10, minHealth: 60, minHappiness: 50, minHunger: 40 },
    { id: "teen", minLevel: 20, minHealth: 65, minHappiness: 55, minHunger: 45 },
    { id: "hero", minLevel: 35, minHealth: 70, minHappiness: 60, minHunger: 50 },
    { id: "legend", minLevel: 50, minHealth: 75, minHappiness: 65, minHunger: 55 },
    { id: "mythic", minLevel: 80, minHealth: 80, minHappiness: 70, minHunger: 60 },
  ],
  byPetType: {
    horse: {
      stages: [
        { id: "baby", minLevel: 1, minHealth: 0, minHappiness: 0, minHunger: 0 },
        { id: "young", minLevel: 10, minHealth: 60, minHappiness: 50, minHunger: 40 },
        { id: "teen", minLevel: 20, minHealth: 65, minHappiness: 55, minHunger: 45 },
        { id: "hero", minLevel: 35, minHealth: 70, minHappiness: 60, minHunger: 50 },
        { id: "legend", minLevel: 50, minHealth: 75, minHappiness: 65, minHunger: 55 },
        { id: "mythic", minLevel: 80, minHealth: 80, minHappiness: 70, minHunger: 60 },
      ],
    },
    cat: {
      stages: [
        { id: "baby", minLevel: 1, minHealth: 0, minHappiness: 0, minHunger: 0 },
        { id: "young", minLevel: 10, minHealth: 60, minHappiness: 50, minHunger: 40 },
        { id: "teen", minLevel: 20, minHealth: 65, minHappiness: 55, minHunger: 45 },
        { id: "hero", minLevel: 35, minHealth: 70, minHappiness: 60, minHunger: 50 },
        { id: "legend", minLevel: 50, minHealth: 75, minHappiness: 65, minHunger: 55 },
        { id: "mythic", minLevel: 80, minHealth: 80, minHappiness: 70, minHunger: 60 },
      ],
    },
    dog: {
      stages: [
        { id: "baby", minLevel: 1, minHealth: 0, minHappiness: 0, minHunger: 0 },
        { id: "young", minLevel: 10, minHealth: 60, minHappiness: 50, minHunger: 40 },
        { id: "teen", minLevel: 20, minHealth: 65, minHappiness: 55, minHunger: 45 },
        { id: "hero", minLevel: 35, minHealth: 70, minHappiness: 60, minHunger: 50 },
        { id: "legend", minLevel: 50, minHealth: 75, minHappiness: 65, minHunger: 55 },
        { id: "mythic", minLevel: 80, minHealth: 80, minHappiness: 70, minHunger: 60 },
      ],
    },
  },
  createdAt: now,
  updatedAt: now,
};

const shopCatalog = {
  version: "1.0.0",
  currency: "eduCoin",
  defaultMaxStack: 99,
  items: {
    biscuit: {
      itemId: "biscuit",
      name: "Bánh quy",
      category: "food",
      price: 5,
      effects: {
        hungerDelta: 18,
        happinessDelta: 2,
        healthDelta: 1,
      },
      unlockLevel: 1,
      maxStack: 99,
      icon: "biscuit",
      description: "Món ăn nhẹ giúp pet no nhanh.",
      consumable: true,
      affectsPet: true,
      sortOrder: 1,
    },
    milk: {
      itemId: "milk",
      name: "Sữa",
      category: "food",
      price: 8,
      effects: {
        hungerDelta: 22,
        happinessDelta: 3,
        healthDelta: 2,
      },
      unlockLevel: 1,
      maxStack: 99,
      icon: "milk",
      description: "Giúp pet khỏe và vui hơn.",
      consumable: true,
      affectsPet: true,
      sortOrder: 2,
    },
    apple: {
      itemId: "apple",
      name: "Táo",
      category: "food",
      price: 6,
      effects: {
        hungerDelta: 16,
        happinessDelta: 1,
        healthDelta: 1,
      },
      unlockLevel: 1,
      maxStack: 99,
      icon: "apple",
      description: "Món ăn cơ bản mỗi ngày.",
      consumable: true,
      affectsPet: true,
      sortOrder: 3,
    },
    carrot: {
      itemId: "carrot",
      name: "Cà rốt",
      category: "food",
      price: 6,
      effects: {
        hungerDelta: 15,
        happinessDelta: 1,
        healthDelta: 1,
      },
      unlockLevel: 1,
      maxStack: 99,
      icon: "carrot",
      description: "Rau củ tốt cho pet.",
      consumable: true,
      affectsPet: true,
      sortOrder: 4,
    },
    ball: {
      itemId: "ball",
      name: "Bóng",
      category: "toy",
      price: 12,
      effects: {
        happinessDelta: 12,
        energyDelta: -4,
      },
      unlockLevel: 2,
      maxStack: 20,
      icon: "ball",
      description: "Đồ chơi giúp pet vui hơn.",
      consumable: true,
      affectsPet: true,
      sortOrder: 10,
    },
    teddy: {
      itemId: "teddy",
      name: "Gấu bông",
      category: "toy",
      price: 15,
      effects: {
        happinessDelta: 14,
        energyDelta: -3,
      },
      unlockLevel: 3,
      maxStack: 20,
      icon: "teddy",
      description: "Đồ chơi mềm dễ thương.",
      consumable: true,
      affectsPet: true,
      sortOrder: 11,
    },
    vitamin: {
      itemId: "vitamin",
      name: "Vitamin",
      category: "medicine",
      price: 18,
      effects: {
        healthDelta: 14,
        happinessDelta: 1,
      },
      unlockLevel: 3,
      maxStack: 20,
      icon: "vitamin",
      description: "Hỗ trợ hồi sức nhẹ.",
      consumable: true,
      affectsPet: true,
      sortOrder: 20,
    },
    medicineKit: {
      itemId: "medicineKit",
      name: "Bộ hồi phục",
      category: "medicine",
      price: 28,
      effects: {
        healthDelta: 22,
        energyDelta: 8,
      },
      unlockLevel: 5,
      maxStack: 10,
      icon: "medicine-kit",
      description: "Dùng khi pet cần được chăm sóc hơn.",
      consumable: true,
      affectsPet: true,
      sortOrder: 21,
    },
    hat: {
      itemId: "hat",
      name: "Mũ nhỏ",
      category: "decoration",
      price: 20,
      effects: {
        happinessDelta: 4,
      },
      unlockLevel: 2,
      maxStack: 9,
      icon: "hat",
      description: "Trang trí cho pet thêm đáng yêu.",
      consumable: false,
      affectsPet: true,
      sortOrder: 30,
    },
    cushion: {
      itemId: "cushion",
      name: "Đệm êm",
      category: "decoration",
      price: 25,
      effects: {
        healthDelta: 4,
        happinessDelta: 3,
      },
      unlockLevel: 4,
      maxStack: 9,
      icon: "cushion",
      description: "Không gian nghỉ ngơi dễ chịu.",
      consumable: false,
      affectsPet: true,
      sortOrder: 31,
    },
    eventPass: {
      itemId: "eventPass",
      name: "Vé sự kiện",
      category: "special",
      price: 40,
      effects: {
        happinessDelta: 8,
      },
      unlockLevel: 6,
      maxStack: 5,
      icon: "event-pass",
      description: "Mở khóa các sự kiện đặc biệt.",
      consumable: true,
      affectsPet: false,
      sortOrder: 40,
    },
  },
  createdAt: now,
  updatedAt: now,
};

const rewardConfig = {
  version: "1.0.0",
  rules: {
    lessonComplete: {
      title: "Hoàn thành bài học",
      icon: "lesson",
      coin: 5,
      petExp: 3,
      petHappiness: 2,
    },
    learningPath: {
      title: "Hoàn thành Learning Path",
      icon: "path",
      coin: 20,
      petExp: 10,
      petHappiness: 5,
    },
    assignment: {
      title: "Hoàn thành bài tập",
      icon: "assignment",
      coin: 10,
      petExp: 5,
      petHappiness: 3,
    },
    highScore: {
      title: "Điểm số cao",
      icon: "score",
      minScore: 9,
      coin: 10,
      petExp: 5,
      petHappiness: 4,
    },
    learningStreak: {
      tiers: [
        {
          minDays: 3,
          title: "Chuỗi 3 ngày",
          icon: "streak-3",
          coin: 10,
          petExp: 4,
          petHappiness: 2,
        },
        {
          minDays: 7,
          title: "Chuỗi 7 ngày",
          icon: "streak-7",
          coin: 25,
          petExp: 10,
          petHappiness: 5,
        },
        {
          minDays: 14,
          title: "Chuỗi 14 ngày",
          icon: "streak-14",
          coin: 50,
          petExp: 18,
          petHappiness: 8,
        },
      ],
    },
    dailyLogin: {
      title: "Đăng nhập hằng ngày",
      icon: "login",
      coin: 3,
      petExp: 1,
      petHappiness: 1,
    },
  },
  createdAt: now,
  updatedAt: now,
};

async function seedDoc(docId, data) {
  await gameConfigCollection.doc(docId).set(data, { merge: true });
  console.log(`[seed-pet] wrote gameConfig/${docId}`);
}

const SEED_DOCS = [
  ["petBalance", petBalance],
  ["levelConfig", levelConfig],
  ["evolutionConfig", evolutionConfig],
  ["shopCatalog", shopCatalog],
  ["rewardConfig", rewardConfig],
];

async function main() {
  for (const [docId, data] of SEED_DOCS) {
    await seedDoc(docId, data);
  }

  console.log("[seed-pet] done");
}

main().catch((error) => {
  console.error("[seed-pet] failed", error);
  process.exitCode = 1;
});
