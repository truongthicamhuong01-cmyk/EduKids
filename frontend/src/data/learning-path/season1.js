const TASK_BLUEPRINTS = [
  {
    idSuffix: "login",
    type: "login",
    icon: "đŸ”",
    metric: "loginCountToday",
    threshold: 1,
    title: (checkpointTitle) => `ÄÄƒng nháº­p hĂ´m nay Ä‘á»ƒ má»Ÿ ${checkpointTitle}`,
    description: () =>
      "Chá»‰ tĂ­nh Ä‘Äƒng nháº­p Ä‘Æ°á»£c há»‡ thá»‘ng ghi nháº­n trong ngĂ y hiá»‡n táº¡i.",
    targetRoute: "/student/learning-path",
  },
  {
    idSuffix: "study-15",
    type: "study_minutes",
    icon: "â±ï¸",
    metric: "studyMinutesToday",
    threshold: 15,
    title: () => "Há»c Ä‘á»§ 15 phĂºt hĂ´m nay",
    description: () => "Chá»‰ tĂ­nh thá»i lÆ°á»£ng há»c phĂ¡t sinh trong ngĂ y hiá»‡n táº¡i.",
    targetRoute: "/student/learning-path",
  },
  {
    idSuffix: "study-30",
    type: "study_minutes",
    icon: "đŸ”¥",
    metric: "studyMinutesToday",
    threshold: 30,
    title: () => "Há»c Ä‘á»§ 30 phĂºt hĂ´m nay",
    description: () => "Chá»‰ tĂ­nh thá»i lÆ°á»£ng há»c phĂ¡t sinh trong ngĂ y hiá»‡n táº¡i.",
    targetRoute: "/student/learning-path",
  },
  {
    idSuffix: "study-45",
    type: "study_minutes",
    icon: "â›°ï¸",
    metric: "studyMinutesToday",
    threshold: 45,
    title: () => "Há»c Ä‘á»§ 45 phĂºt hĂ´m nay",
    description: () => "Chá»‰ tĂ­nh thá»i lÆ°á»£ng há»c phĂ¡t sinh trong ngĂ y hiá»‡n táº¡i.",
    targetRoute: "/student/learning-path",
  },
  {
    idSuffix: "study-60",
    type: "study_minutes",
    icon: "đŸ”ï¸",
    metric: "studyMinutesToday",
    threshold: 60,
    title: () => "Há»c Ä‘á»§ 60 phĂºt hĂ´m nay",
    description: () => "Chá»‰ tĂ­nh thá»i lÆ°á»£ng há»c phĂ¡t sinh trong ngĂ y hiá»‡n táº¡i.",
    targetRoute: "/student/learning-path",
  },
  {
    idSuffix: "lesson-1",
    type: "lesson",
    icon: "đŸ“˜",
    metric: "lessonCountToday",
    threshold: 1,
    title: () => "HoĂ n thĂ nh 1 bĂ i há»c hĂ´m nay",
    description: () =>
      "Chá»‰ tĂ­nh bĂ i há»c Ä‘Æ°á»£c há»‡ thá»‘ng ghi nháº­n trong ngĂ y hiá»‡n táº¡i.",
    targetRoute: "/student/quiz-ai",
  },
  {
    idSuffix: "lesson-2",
    type: "lesson",
    icon: "đŸ“—",
    metric: "lessonCountToday",
    threshold: 2,
    title: () => "HoĂ n thĂ nh 2 bĂ i há»c hĂ´m nay",
    description: () =>
      "Chá»‰ tĂ­nh bĂ i há»c Ä‘Æ°á»£c há»‡ thá»‘ng ghi nháº­n trong ngĂ y hiá»‡n táº¡i.",
    targetRoute: "/student/quiz-ai",
  },
  {
    idSuffix: "quiz-1",
    type: "quiz",
    icon: "đŸ§ ",
    metric: "quizCountToday",
    threshold: 1,
    title: () => "LĂ m 1 quiz hĂ´m nay",
    description: () => "Chá»‰ tĂ­nh quiz Ä‘Ă£ ná»™p trong ngĂ y hiá»‡n táº¡i.",
    targetRoute: "/student/quiz-ai",
  },
  {
    idSuffix: "quiz-2",
    type: "quiz",
    icon: "â­",
    metric: "quizCountToday",
    threshold: 2,
    title: () => "LĂ m 2 quiz hĂ´m nay",
    description: () => "Chá»‰ tĂ­nh quiz Ä‘Ă£ ná»™p trong ngĂ y hiá»‡n táº¡i.",
    targetRoute: "/student/quiz-ai",
  },
  {
    idSuffix: "quiz-strong",
    type: "quiz_score",
    icon: "đŸ…",
    metric: "highScoreQuizCountToday",
    threshold: 1,
    title: () => "Äáº¡t 8+ á»Ÿ má»™t quiz hĂ´m nay",
    description: () =>
      "Chá»‰ tĂ­nh quiz cĂ³ Ä‘iá»ƒm tá»« 8/10 hoáº·c 80/100 trá»Ÿ lĂªn trong ngĂ y hiá»‡n táº¡i.",
    targetRoute: "/student/quiz-ai",
  },
  {
    idSuffix: "assignment-1",
    type: "assignment",
    icon: "đŸ“",
    metric: "assignmentCountToday",
    threshold: 1,
    title: () => "HoĂ n thĂ nh 1 bĂ i táº­p hĂ´m nay",
    description: () => "Chá»‰ tĂ­nh bĂ i táº­p Ä‘Æ°á»£c ná»™p vĂ  cháº¥m trong ngĂ y hiá»‡n táº¡i.",
    targetRoute: "/student/assignments",
  },
  {
    idSuffix: "assignment-2",
    type: "assignment",
    icon: "đŸ“„",
    metric: "assignmentCountToday",
    threshold: 2,
    title: () => "HoĂ n thĂ nh 2 bĂ i táº­p hĂ´m nay",
    description: () => "Chá»‰ tĂ­nh bĂ i táº­p Ä‘Æ°á»£c ná»™p vĂ  cháº¥m trong ngĂ y hiá»‡n táº¡i.",
    targetRoute: "/student/assignments",
  },
  {
    idSuffix: "coach-1",
    type: "coach",
    icon: "đŸ¯",
    metric: "coachCountToday",
    threshold: 1,
    title: () => "DĂ¹ng AI Coach hĂ´m nay",
    description: () =>
      "Chá»‰ tĂ­nh lÆ°á»£t dĂ¹ng AI Coach Ä‘Æ°á»£c há»‡ thá»‘ng ghi nháº­n trong ngĂ y hiá»‡n táº¡i.",
    targetRoute: "/student/ai-coach",
  },
];

const SUMMIT_CHECKPOINT_POSITION = { left: 51.65, top: 17, side: "right" };
const SUMMIT_CARD_POSITION = { left: 40, top: 10.5 };
const PEAK_POSITION = SUMMIT_CHECKPOINT_POSITION;


const ROUTE_POSITIONS = [
  { left: 56.5, top: 91.7, side: "left" },
  { left: 41, top: 76, side: "left" },
  { left: 58.25, top: 61.75, side: "right" },
  { left: 41.3, top: 48.5, side: "left" },
  { left: 54.6, top: 36.45, side: "right" },
  { left: 44.85, top: 26.75, side: "left" },
];


function formatLearningPathMeters(value) {
  const meters = Number(value);

  if (!Number.isFinite(meters)) {
    return "0 m";
  }

  return `${Math.round(meters).toLocaleString("vi-VN")} m`;
}

function getSummitHeightMeters(blueprint) {
  const explicitHeight = Number(blueprint?.summitHeight);
  if (Number.isFinite(explicitHeight)) {
    return Math.max(0, Math.round(explicitHeight));
  }

  const parsedHeight = Number(String(blueprint?.height || "").replace(/[^\d]/g, ""));
  return Number.isFinite(parsedHeight) ? Math.max(0, Math.round(parsedHeight)) : 0;
}

function getCheckpointAltitudeLabel(summitHeightMeters, checkpointNumber) {
  if (checkpointNumber === 0) {
    return "0 m";
  }

  if (checkpointNumber === 6) {
    return formatLearningPathMeters(summitHeightMeters);
  }

  return formatLearningPathMeters((summitHeightMeters * checkpointNumber) / 6);
}

const MOUNTAIN_BLUEPRINTS = [
  {
    id: "puncak-jaya",
    name: "Puncak Jaya",
    continent: "ChĂ¢u Äáº¡i DÆ°Æ¡ng",
    summitHeight: 4884,
    height: formatLearningPathMeters(4884),
    description: "Äá»‰nh nĂºi Ä‘áº·c biá»‡t giá»¯a vĂ¹ng nhiá»‡t Ä‘á»›i vĂ  bÄƒng tuyáº¿t.",
    image: "/assets/learning-path/icon/icon-puncak-jaya.png.jpg",
    icon: "/assets/learning-path/icon/icon-puncak-jaya.png.jpg",
    backgroundImage: "/assets/learning-path/backgrounds/bg-puncak-jaya.png",
    badgeImage: "/assets/learning-path/badges/badge-puncak-jaya.png",
    badgeName: "Huy hiá»‡u Puncak Jaya",
  },
  {
    id: "vinson-massif",
    name: "Vinson Massif",
    continent: "Nam Cá»±c",
    summitHeight: 4892,
    height: formatLearningPathMeters(4892),
    description: "Äá»‰nh cao nháº¥t Nam Cá»±c, nÆ¡i láº¡nh giĂ¡ vĂ  cĂ´ láº­p nháº¥t.",
    image: "/assets/learning-path/icon/icon-vinson-massif.png.jpg",
    icon: "/assets/learning-path/icon/icon-vinson-massif.png.jpg",
    backgroundImage: "/assets/learning-path/backgrounds/bg-vinson-massif.png",
    badgeImage: "/assets/learning-path/badges/badge-vinson-massif.png",
    badgeName: "Huy hiá»‡u Vinson Massif",
  },
  {
    id: "elbrus",
    name: "Elbrus",
    continent: "ChĂ¢u Ă‚u",
    summitHeight: 5642,
    height: formatLearningPathMeters(5642),
    description: "Äá»‰nh nĂºi cao nháº¥t chĂ¢u Ă‚u, phá»§ tuyáº¿t tráº¯ng quanh nÄƒm.",
    image: "/assets/learning-path/icon/icon-elbrus.png.jpg",
    icon: "/assets/learning-path/icon/icon-elbrus.png.jpg",
    backgroundImage: "/assets/learning-path/backgrounds/bg-elbrus.png",
    badgeImage: "/assets/learning-path/badges/badge-elbrus.png",
    badgeName: "Huy hiá»‡u Elbrus",
  },
  {
    id: "kilimanjaro",
    name: "Kilimanjaro",
    continent: "ChĂ¢u Phi",
    summitHeight: 5895,
    height: formatLearningPathMeters(5895),
    description: "Ngá»n nĂºi lá»­a cao nháº¥t chĂ¢u Phi, ná»•i báº­t trĂªn tháº£o nguyĂªn.",
    image: "/assets/learning-path/icon/icon-kilimanjaro.png.jpg",
    icon: "/assets/learning-path/icon/icon-kilimanjaro.png.jpg",
    backgroundImage: "/assets/learning-path/backgrounds/bg-kilimanjaro.png",
    badgeImage: "/assets/learning-path/badges/badge-kilimanjaro.png",
    badgeName: "Huy hiá»‡u Kilimanjaro",
  },
  {
    id: "denali",
    name: "Denali",
    continent: "Báº¯c Má»¹",
    summitHeight: 6190,
    height: formatLearningPathMeters(6190),
    description: "Äá»‰nh nĂºi kháº¯c nghiá»‡t, biá»ƒu tÆ°á»£ng cá»§a Alaska.",
    image: "/assets/learning-path/icon/icon-denali.png.jpg",
    icon: "/assets/learning-path/icon/icon-denali.png.jpg",
    backgroundImage: "/assets/learning-path/backgrounds/bg-denali.png",
    badgeImage: "/assets/learning-path/badges/badge-denali.png",
    badgeName: "Huy hiá»‡u Denali",
  },
  {
    id: "aconcagua",
    name: "Aconcagua",
    continent: "Nam Má»¹",
    summitHeight: 6961,
    height: formatLearningPathMeters(6961),
    description: "Äá»‰nh cao nháº¥t dĂ£y Andes, thá»­ thĂ¡ch bá»n bá»‰ vĂ  Ă½ chĂ­.",
    image: "/assets/learning-path/icon/icon-aconcagua.png.jpg",
    icon: "/assets/learning-path/icon/icon-aconcagua.png.jpg",
    backgroundImage: "/assets/learning-path/backgrounds/bg-aconcagua.png",
    badgeImage: "/assets/learning-path/badges/badge-aconcagua.png",
    badgeName: "Huy hiá»‡u Aconcagua",
  },
  {
    id: "everest",
    name: "Everest",
    continent: "ChĂ¢u Ă",
    summitHeight: 8849,
    height: formatLearningPathMeters(8849),
    description: "Ngá»n nĂºi cao nháº¥t tháº¿ giá»›i, náº±m trĂªn dĂ£y Himalaya hĂ¹ng vÄ©.",
    image: "/assets/learning-path/icon/icon-everest.png.jpg",
    icon: "/assets/learning-path/icon/icon-everest.png.jpg",
    backgroundImage: "/assets/learning-path/backgrounds/bg-everest.png",
    badgeImage: "/assets/learning-path/badges/badge-everest.png",
    badgeName: "Huy hiá»‡u Everest",
  },
];


function getTaskBlueprint(taskKey) {
  return TASK_BLUEPRINTS.find((task) => task.idSuffix === taskKey) || null;
}

function createReward({
  id,
  title,
  subtitle,
  icon,
  theme,
  xu = 0,
  exp = 0,
  badgeId = null,
}) {
  return {
    id,
    title,
    subtitle,
    icon,
    theme,
    xu,
    exp,
    badgeId,
  };
}

function createTask({
  mountainId,
  checkpointSlug,
  index,
  title,
  description,
  targetRoute,
  type,
  icon,
  metric = "",
  threshold = 1,
  completed = false,
}) {
  return {
    id: `${mountainId}-${checkpointSlug}-task-${index + 1}`,
    title,
    description,
    targetRoute,
    type,
    icon,
    metric,
    threshold,
    completed,
  };
}

function createCheckpoint({
  mountainId,
  mountainName,
  checkpointNumber,
  title,
  type,
  altitude,
  position,
  summitCheckpointPosition = null,
  summitCardPosition = null,
  reward,
  taskKeys = [],
  completed = false,
  isSummit = false,
}) {
  const checkpointTitle =
    title ||
    (isSummit
      ? "Äá»‰nh NĂºi"
      : checkpointNumber === 0
        ? "Xuáº¥t PhĂ¡t"
        : `Tráº¡m ${checkpointNumber}`);
  const checkpointSlug = isSummit
    ? "summit"
    : checkpointNumber === 0
      ? "start"
      : `checkpoint-${checkpointNumber}`;
  const tasksSource = (Array.isArray(taskKeys) ? taskKeys : [])
    .map((taskKey) => getTaskBlueprint(taskKey))
    .filter(Boolean);

  return {
    id: `${mountainId}-${checkpointSlug}`,
    title: checkpointTitle,
    type,
    altitude,
    position: summitCheckpointPosition || position,
    summitCheckpointPosition: summitCheckpointPosition || null,
    summitCardPosition: summitCardPosition || null,
    reward,
    tasks: tasksSource.map((template, index) =>
      createTask({
        mountainId,
        checkpointSlug,
        index,
        title: template.title(
          isSummit ? `${mountainName} - Ä‘á»‰nh` : checkpointTitle,
        ),
        description: template.description(
          isSummit ? `${mountainName} - Ä‘á»‰nh` : checkpointTitle,
        ),
        targetRoute: template.targetRoute,
        type: template.type,
        icon: template.icon,
        metric: template.metric,
        threshold: template.threshold,
        completed: false,
      }),
    ),
    completed,
  };
}

function createMountain(blueprint, index) {
  const badge = {
    id: `badge-${blueprint.id}`,
    name: blueprint.badgeName,
    description: `HoĂ n thĂ nh ${blueprint.name} Ä‘á»ƒ nháº­n huy hiá»‡u.`,
    image: blueprint.badgeImage,
    unlocked: index === 0,
  };

  const stationRewards = [
    createReward({
      id: `${blueprint.id}-reward-start`,
      title: "+50 Xu Edu",
      subtitle: "Khá»Ÿi Ä‘á»™ng hĂ nh trĂ¬nh",
      icon: "đŸ§­",
      theme: "amber",
      xu: 50,
      exp: 100,
    }),
    createReward({
      id: `${blueprint.id}-reward-1`,
      title: "+50 Xu Edu",
      subtitle: "HoĂ n thĂ nh tráº¡m Ä‘áº§u",
      icon: "đŸª™",
      theme: "amber",
      xu: 50,
      exp: 100,
    }),
    createReward({
      id: `${blueprint.id}-reward-2`,
      title: "+50 Xu Edu",
      subtitle: "Giá»¯ nhá»‹p há»c",
      icon: "â­",
      theme: "gold",
      xu: 50,
      exp: 100,
    }),
    createReward({
      id: `${blueprint.id}-reward-3`,
      title: "+50 Xu Edu",
      subtitle: "Luyá»‡n táº­p thĂªm",
      icon: "đŸ“˜",
      theme: "blue",
      xu: 50,
      exp: 100,
    }),
    createReward({
      id: `${blueprint.id}-reward-4`,
      title: "+50 Xu Edu",
      subtitle: "HoĂ n thiá»‡n ká»¹ nÄƒng",
      icon: "â›°ï¸",
      theme: "green",
      xu: 50,
      exp: 100,
    }),
    createReward({
      id: `${blueprint.id}-reward-5`,
      title: "+50 Xu Edu",
      subtitle: "Chuáº©n bá»‹ lĂªn Ä‘á»‰nh",
      icon: "đŸ”ï¸",
      theme: "amber",
      xu: 50,
      exp: 100,
    }),
  ];

  const summitHeightMeters = getSummitHeightMeters(blueprint);

  const checkpoints = [
    createCheckpoint({
      mountainId: blueprint.id,
      mountainName: blueprint.name,
      checkpointNumber: 0,
      title: "Xuáº¥t PhĂ¡t",
      type: "station",
      altitude: getCheckpointAltitudeLabel(summitHeightMeters, 0),
      position: ROUTE_POSITIONS[0],
      reward: stationRewards[0],
      taskKeys: ["login", "study-15"],
      completed: index === 0,
    }),
    createCheckpoint({
      mountainId: blueprint.id,
      mountainName: blueprint.name,
      checkpointNumber: 1,
      type: "station",
      altitude: getCheckpointAltitudeLabel(summitHeightMeters, 1),
      position: ROUTE_POSITIONS[1],
      reward: stationRewards[1],
      taskKeys: ["lesson-1", "quiz-1", "study-30"],
      completed: index === 0,
    }),
    createCheckpoint({
      mountainId: blueprint.id,
      mountainName: blueprint.name,
      checkpointNumber: 2,
      type: "station",
      altitude: getCheckpointAltitudeLabel(summitHeightMeters, 2),
      position: { left: 59.1, top: 60.65, side: "right" },
      reward: stationRewards[2],
      taskKeys: ["assignment-1", "lesson-1", "coach-1"],
      completed: false,
    }),
    createCheckpoint({
      mountainId: blueprint.id,
      mountainName: blueprint.name,
      checkpointNumber: 3,
      type: "station",
      altitude: getCheckpointAltitudeLabel(summitHeightMeters, 3),
      position: ROUTE_POSITIONS[3],
      reward: stationRewards[3],
      taskKeys: ["coach-1", "study-30", "quiz-1"],
      completed: false,
    }),
    createCheckpoint({
      mountainId: blueprint.id,
      mountainName: blueprint.name,
      checkpointNumber: 4,
      type: "station",
      altitude: getCheckpointAltitudeLabel(summitHeightMeters, 4),
      position: ROUTE_POSITIONS[4],
      reward: stationRewards[4],
      taskKeys: ["lesson-2", "assignment-1", "study-45", "quiz-1"],
      completed: false,
    }),
    createCheckpoint({
      mountainId: blueprint.id,
      mountainName: blueprint.name,
      checkpointNumber: 5,
      type: "station",
      altitude: getCheckpointAltitudeLabel(summitHeightMeters, 5),
      position: ROUTE_POSITIONS[5],
      reward: stationRewards[5],
      taskKeys: ["coach-1", "quiz-2", "assignment-2", "study-60"],
      completed: false,
    }),
    createCheckpoint({
      mountainId: blueprint.id,
      mountainName: blueprint.name,
      checkpointNumber: 6,
      title: "Äá»‰nh NĂºi",
      type: "summit",
      altitude: getCheckpointAltitudeLabel(summitHeightMeters, 6),
      summitCheckpointPosition: SUMMIT_CHECKPOINT_POSITION,
      summitCardPosition: SUMMIT_CARD_POSITION,
      reward: createReward({
        id: `${blueprint.id}-summit-reward`,
        title: "+200 Xu Edu",
        subtitle: "Chinh phá»¥c Ä‘á»‰nh nĂºi",
        icon: "đŸ†",
        theme: "gold",
        xu: 200,
        exp: 250,
        badgeId: `badge-${blueprint.id}`,
      }),
      taskKeys: [],
      completed: false,
      isSummit: true,
    }),
  ];

  return {
    id: blueprint.id,
    name: blueprint.name,
    continent: blueprint.continent,
    height: blueprint.height,
    description: blueprint.description,
    image: blueprint.image,
    backgroundImage: blueprint.backgroundImage,
    badge,
    locked: index !== 0,
    startPosition: ROUTE_POSITIONS[0],
    checkpoints,
  };
}

export const season1 = {
  id: "season-1",
  order: 1,
  name: "Season 1",
  title: "7 Ä‘á»‰nh cao tháº¿ giá»›i",
  description: "KhĂ¡m phĂ¡ 7 ngá»n nĂºi biá»ƒu tÆ°á»£ng cá»§a hĂ nh trĂ¬nh Learning Path.",
  badge: {
    id: "badge-world-explorer",
    name: "World Explorer Badge",
    description: "HoĂ n thĂ nh toĂ n bá»™ 7 ngá»n nĂºi cá»§a Season 1.",
    image: "/assets/learning-path/badges/badge-world-explorer.png",
    unlocked: false,
  },
  mountains: MOUNTAIN_BLUEPRINTS.map((blueprint, index) =>
    createMountain(blueprint, index),
  ),
};

export const season1Progress = {
  currentSeason: season1.id,
  currentMountain: "puncak-jaya",
  currentCheckpoint: "puncak-jaya-start",
  completedTasks: [],
  earnedXu: 0,
  earnedExp: 0,
  earnedBadges: [],
  completedCheckpoints: [],
};

export {
  TASK_BLUEPRINTS,
  TASK_BLUEPRINTS as TASK_TEMPLATES,
  ROUTE_POSITIONS,
  PEAK_POSITION,
  SUMMIT_CHECKPOINT_POSITION,
  SUMMIT_CARD_POSITION,
  MOUNTAIN_BLUEPRINTS,
};
