const TASK_TEMPLATES = [
  {
    idSuffix: "assignment",
    type: "assignment",
    icon: "📝",
    title: (checkpointTitle) => `Hoàn thành một bài tập thật trước khi chinh phục ${checkpointTitle}`,
    description: () => "Cần có ít nhất một bài tập đã nộp và được chấm từ dữ liệu thật.",
    targetRoute: "/student/assignments",
  },
  {
    idSuffix: "score",
    type: "score",
    icon: "⭐",
    title: (checkpointTitle) => `Đạt ít nhất 8 điểm ở bài tập trước khi lên ${checkpointTitle}`,
    description: () => "Dùng điểm bài tập thật, không dùng điểm mô phỏng.",
    targetRoute: "/student/assignments",
  },
  {
    idSuffix: "topic",
    type: "topic",
    icon: "📚",
    title: (checkpointTitle) => `Hoàn thành một chủ đề học trước khi mở ${checkpointTitle}`,
    description: () => "Dựa vào progress thật trong user_progress/topics.",
    targetRoute: "/student/quiz-ai",
  },
  {
    idSuffix: "coach",
    type: "coach",
    icon: "⏱️",
    title: (checkpointTitle) => `Sử dụng AI Coach ít nhất 1 lần trước ${checkpointTitle}`,
    description: () => "Lấy từ log sử dụng AI Coach thật của hệ thống.",
    targetRoute: "/student/ai-coach",
  },
];

const ROUTE_POSITIONS = [
  { left: 56.55, top: 92.1, side: "left" },
  { left: 41.1, top: 76.05, side: "left" },
  { left: 58.2, top: 61.75, side: "right" },
  { left: 41.3, top: 48.5, side: "left" },
  { left: 54.55, top: 36.45, side: "right" },
  { left: 44.8, top: 26.7, side: "left" },
];

const PEAK_POSITION = { left: 41.7, top: 11.25, side: "left" };

const MOUNTAIN_BLUEPRINTS = [
  {
    id: "everest",
    name: "Everest",
    continent: "Asia",
    height: "8.848 m",
    description: "Ngon nui cao nhat the gioi, nam tren day Himalaya hung vi.",
    image: "/assets/learning-path/icon/icon-everest.png",
    backgroundImage: "/assets/learning-path/backgrounds/bg-everest.png",
    badgeImage: "/assets/learning-path/badges/badge-everest.png",
    badgeName: "Huy hieu Everest",
  },
  {
    id: "kilimanjaro",
    name: "Kilimanjaro",
    continent: "Africa",
    height: "5.895 m",
    description: "Ngon nui lua cao nhat chau Phi, noi bat tren thao nguyen.",
    image: "/assets/learning-path/icon/icon-kilimanjaro.png",
    backgroundImage: "/assets/learning-path/backgrounds/bg-kilimanjaro.png",
    badgeImage: "/assets/learning-path/badges/badge-kilimanjaro.png",
    badgeName: "Huy hieu Kilimanjaro",
  },
  {
    id: "elbrus",
    name: "Elbrus",
    continent: "Europe",
    height: "5.642 m",
    description: "Ngon nui cao nhat chau Au, phu tuyet trang quanh nam.",
    image: "/assets/learning-path/icon/icon-elbrus.png",
    backgroundImage: "/assets/learning-path/backgrounds/bg-elbrus.png",
    badgeImage: "/assets/learning-path/badges/badge-elbrus.png",
    badgeName: "Huy hieu Elbrus",
  },
  {
    id: "denali",
    name: "Denali",
    continent: "North America",
    height: "6.190 m",
    description: "Ngon nui khac nghiet, bieu tuong cua Alaska.",
    image: "/assets/learning-path/icon/icon-denali.png",
    backgroundImage: "/assets/learning-path/backgrounds/bg-denali.png",
    badgeImage: "/assets/learning-path/badges/badge-denali.png",
    badgeName: "Huy hieu Denali",
  },
  {
    id: "aconcagua",
    name: "Aconcagua",
    continent: "South America",
    height: "6.961 m",
    description: "Dinh cao nhat day Andes, thu thach ben bi va y chi.",
    image: "/assets/learning-path/icon/icon-aconcagua.png",
    backgroundImage: "/assets/learning-path/backgrounds/bg-aconcagua.png",
    badgeImage: "/assets/learning-path/badges/badge-aconcagua.png",
    badgeName: "Huy hieu Aconcagua",
  },
  {
    id: "puncak-jaya",
    name: "Puncak Jaya",
    continent: "Oceania",
    height: "4.884 m",
    description: "Dinh nui dac biet giua vung nhiet doi va bang tuyet.",
    image: "/assets/learning-path/icon/icon-puncak-jaya.png",
    backgroundImage: "/assets/learning-path/backgrounds/bg-puncak-jaya.png",
    badgeImage: "/assets/learning-path/badges/badge-puncak-jaya.png",
    badgeName: "Huy hieu Puncak Jaya",
  },
  {
    id: "vinson-massif",
    name: "Vinson Massif",
    continent: "Antarctica",
    height: "4.892 m",
    description: "Dinh cao nhat Nam Cuc, noi lanh gia va co lap nhat.",
    image: "/assets/learning-path/icon/icon-vinson-massif.png",
    backgroundImage: "/assets/learning-path/backgrounds/bg-vinson-massif.png",
    badgeImage: "/assets/learning-path/badges/badge-vinson-massif.png",
    badgeName: "Huy hieu Vinson Massif",
  },
];

function createReward({ id, title, subtitle, icon, theme, xu = 0, exp = 0, badgeId = null }) {
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
  completed = false,
}) {
  return {
    id: `${mountainId}-${checkpointSlug}-task-${index + 1}`,
    title,
    description,
    targetRoute,
    type,
    icon,
    completed,
  };
}

function createCheckpoint({
  mountainId,
  mountainName,
  checkpointNumber,
  type,
  altitude,
  position,
  reward,
  completed = false,
  isSummit = false,
}) {
  const checkpointTitle = isSummit ? "Dinh nui" : `Tram ${checkpointNumber}`;
  const checkpointSlug = isSummit ? "summit" : `checkpoint-${checkpointNumber}`;

  return {
    id: `${mountainId}-${checkpointSlug}`,
    title: checkpointTitle,
    type,
    altitude,
    position,
    reward,
    tasks: TASK_TEMPLATES.map((template, index) =>
      createTask({
        mountainId,
        checkpointSlug,
        index,
        title: template.title(isSummit ? `${mountainName} - dinh` : checkpointTitle),
        description: template.description(isSummit ? `${mountainName} - dinh` : checkpointTitle),
        targetRoute: template.targetRoute,
        type: template.type,
        icon: template.icon,
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
    description: `Hoan thanh ${blueprint.name} de nhan huy hieu.`,
    image: blueprint.badgeImage,
    unlocked: index === 0,
  };

  const stationRewards = [
    createReward({
      id: `${blueprint.id}-reward-1`,
      title: "+20 Xu Edu",
      subtitle: "Hoan thanh tram",
      icon: "🪙",
      theme: "amber",
      xu: 20,
      exp: 50,
    }),
    createReward({
      id: `${blueprint.id}-reward-2`,
      title: "+30 Xu Edu",
      subtitle: "Giu nhip hoc",
      icon: "⭐",
      theme: "gold",
      xu: 30,
      exp: 75,
    }),
    createReward({
      id: `${blueprint.id}-reward-3`,
      title: "+40 Xu Edu",
      subtitle: "Luyen tap them",
      icon: "📘",
      theme: "blue",
      xu: 40,
      exp: 90,
    }),
    createReward({
      id: `${blueprint.id}-reward-4`,
      title: "+50 Xu Edu",
      subtitle: "Hoan thien ky nang",
      icon: "⛰️",
      theme: "green",
      xu: 50,
      exp: 120,
    }),
    createReward({
      id: `${blueprint.id}-reward-5`,
      title: "+70 Xu Edu",
      subtitle: "Chuan bi len dinh",
      icon: "🏔️",
      theme: "amber",
      xu: 70,
      exp: 150,
    }),
  ];

  const checkpoints = [
    createCheckpoint({
      mountainId: blueprint.id,
      mountainName: blueprint.name,
      checkpointNumber: 1,
      type: "station",
      altitude: "1.000 m",
      position: ROUTE_POSITIONS[1],
      reward: stationRewards[0],
      completed: index === 0,
    }),
    createCheckpoint({
      mountainId: blueprint.id,
      mountainName: blueprint.name,
      checkpointNumber: 2,
      type: "station",
      altitude: "2.500 m",
      position: ROUTE_POSITIONS[2],
      reward: stationRewards[1],
      completed: index === 0,
    }),
    createCheckpoint({
      mountainId: blueprint.id,
      mountainName: blueprint.name,
      checkpointNumber: 3,
      type: "station",
      altitude: "4.000 m",
      position: ROUTE_POSITIONS[3],
      reward: stationRewards[2],
      completed: false,
    }),
    createCheckpoint({
      mountainId: blueprint.id,
      mountainName: blueprint.name,
      checkpointNumber: 4,
      type: "station",
      altitude: "5.500 m",
      position: ROUTE_POSITIONS[4],
      reward: stationRewards[3],
      completed: false,
    }),
    createCheckpoint({
      mountainId: blueprint.id,
      mountainName: blueprint.name,
      checkpointNumber: 5,
      type: "station",
      altitude: "7.000 m",
      position: ROUTE_POSITIONS[5],
      reward: stationRewards[4],
      completed: false,
    }),
    createCheckpoint({
      mountainId: blueprint.id,
      mountainName: blueprint.name,
      checkpointNumber: 6,
      type: "summit",
      altitude: blueprint.height,
      position: PEAK_POSITION,
      reward: createReward({
        id: `${blueprint.id}-summit-reward`,
        title: "+100 Xu Edu",
        subtitle: "Chinh phuc dinh nui",
        icon: "🏆",
        theme: "gold",
        xu: 100,
        exp: 200,
        badgeId: `badge-${blueprint.id}`,
      }),
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
    checkpoints,
  };
}

const season1 = {
  id: "season-1",
  order: 1,
  name: "Season 1",
  title: "7 dinh cao the gioi",
  description: "Kham pha 7 ngon nui bieu tuong cua hanh trinh Learning Path.",
  badge: {
    id: "badge-world-explorer",
    name: "World Explorer Badge",
    description: "Hoan thanh toan bo 7 ngon nui cua Season 1.",
    image: "/assets/learning-path/badges/badge-world-explorer.png",
    unlocked: false,
  },
  mountains: MOUNTAIN_BLUEPRINTS.map((blueprint, index) => createMountain(blueprint, index)),
};

const season1Progress = {
  currentSeason: season1.id,
  currentMountain: "everest",
  currentCheckpoint: "everest-checkpoint-1",
  completedTasks: [],
  earnedXu: 0,
  earnedExp: 0,
  earnedBadges: [],
  completedCheckpoints: [],
};

module.exports = {
  TASK_TEMPLATES,
  ROUTE_POSITIONS,
  PEAK_POSITION,
  MOUNTAIN_BLUEPRINTS,
  season1,
  season1Progress,
};
