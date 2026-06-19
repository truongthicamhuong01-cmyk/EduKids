const TASK_TEMPLATES = [
  {
    idSuffix: "assignment",
    type: "assignment",
    icon: "📝",
    title: (checkpointTitle) =>
      `Hoàn thành một bài tập thật trước khi chinh phục ${checkpointTitle}`,
    description: () => "Cần có ít nhất một bài tập đã nộp và được chấm từ dữ liệu thật.",
    targetRoute: "/student/assignments",
  },
  {
    idSuffix: "score",
    type: "score",
    icon: "⭐",
    title: (checkpointTitle) =>
      `Đạt ít nhất 8 điểm ở bài tập trước khi lên ${checkpointTitle}`,
    description: () => "Dùng điểm bài tập thật, không dùng điểm mô phỏng.",
    targetRoute: "/student/assignments",
  },
  {
    idSuffix: "topic",
    type: "topic",
    icon: "📚",
    title: (checkpointTitle) =>
      `Hoàn thành một chủ đề học trước khi mở ${checkpointTitle}`,
    description: () => "Dựa vào progress thật trong user_progress/topics.",
    targetRoute: "/student/quiz-ai",
  },
  {
    idSuffix: "coach",
    type: "coach",
    icon: "⏱️",
    title: (checkpointTitle) =>
      `Sử dụng AI Coach ít nhất 1 lần trước ${checkpointTitle}`,
    description: () => "Lấy từ log sử dụng AI Coach thật của hệ thống.",
    targetRoute: "/student/ai-coach",
  },
];

const MOUNTAIN_BLUEPRINTS = [
  {
    id: "everest",
    name: "Everest",
    continent: "Châu Á",
    height: "8.848 m",
    description: "Đỉnh núi cao nhất thế giới, nằm trên dãy Himalaya hùng vĩ.",
    image: "/assets/learning-path/icon/icon-everest.png",
    backgroundImage: "/assets/learning-path/backgrounds/bg-everest.png",
    badgeImage: "/assets/learning-path/badges/badge-everest.png",
    badgeName: "Huy hiệu Everest",
  },
  {
    id: "kilimanjaro",
    name: "Kilimanjaro",
    continent: "Châu Phi",
    height: "5.895 m",
    description: "Ngọn núi lửa cao nhất châu Phi, nổi bật trên thảo nguyên.",
    image: "/assets/learning-path/icon/icon-kilimanjaro.png",
    backgroundImage: "/assets/learning-path/backgrounds/bg-kilimanjaro.png",
    badgeImage: "/assets/learning-path/badges/badge-kilimanjaro.png",
    badgeName: "Huy hiệu Kilimanjaro",
  },
  {
    id: "elbrus",
    name: "Elbrus",
    continent: "Châu Âu",
    height: "5.642 m",
    description: "Đỉnh núi cao nhất châu Âu, phủ tuyết trắng quanh năm.",
    image: "/assets/learning-path/icon/icon-elbrus.png",
    backgroundImage: "/assets/learning-path/backgrounds/bg-elbrus.png",
    badgeImage: "/assets/learning-path/badges/badge-elbrus.png",
    badgeName: "Huy hiệu Elbrus",
  },
  {
    id: "denali",
    name: "Denali",
    continent: "Bắc Mỹ",
    height: "6.190 m",
    description: "Đỉnh núi khắc nghiệt, biểu tượng của Alaska.",
    image: "/assets/learning-path/icon/icon-denali.png",
    backgroundImage: "/assets/learning-path/backgrounds/bg-denali.png",
    badgeImage: "/assets/learning-path/badges/badge-denali.png",
    badgeName: "Huy hiệu Denali",
  },
  {
    id: "aconcagua",
    name: "Aconcagua",
    continent: "Nam Mỹ",
    height: "6.961 m",
    description: "Đỉnh cao nhất dãy Andes, thử thách bền bỉ và ý chí.",
    image: "/assets/learning-path/icon/icon-aconcagua.png",
    backgroundImage: "/assets/learning-path/backgrounds/bg-aconcagua.png",
    badgeImage: "/assets/learning-path/badges/badge-aconcagua.png",
    badgeName: "Huy hiệu Aconcagua",
  },
  {
    id: "puncak-jaya",
    name: "Puncak Jaya",
    continent: "Châu Đại Dương",
    height: "4.884 m",
    description: "Đỉnh núi đặc biệt giữa vùng nhiệt đới và băng tuyết.",
    image: "/assets/learning-path/icon/icon-puncak-jaya.png",
    backgroundImage: "/assets/learning-path/backgrounds/bg-puncak-jaya.png",
    badgeImage: "/assets/learning-path/badges/badge-puncak-jaya.png",
    badgeName: "Huy hiệu Puncak Jaya",
  },
  {
    id: "vinson-massif",
    name: "Vinson Massif",
    continent: "Nam Cực",
    height: "4.892 m",
    description: "Đỉnh cao nhất Nam Cực, nơi lạnh giá và cô lập nhất.",
    image: "/assets/learning-path/icon/icon-vinson-massif.png",
    backgroundImage: "/assets/learning-path/backgrounds/bg-vinson-massif.png",
    badgeImage: "/assets/learning-path/badges/badge-vinson-massif.png",
    badgeName: "Huy hiệu Vinson Massif",
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
  const checkpointTitle = isSummit ? "Đỉnh núi" : `Trạm ${checkpointNumber}`;
  const checkpointSlug = isSummit ? "summit" : `checkpoint-${checkpointNumber}`;
  const tasksSource = isSummit ? TASK_TEMPLATES : TASK_TEMPLATES;

  return {
    id: `${mountainId}-${checkpointSlug}`,
    title: checkpointTitle,
    type,
    altitude,
    position,
    reward,
    tasks: tasksSource.map((template, index) =>
      createTask({
        mountainId,
        checkpointSlug,
        index,
        title: template.title(isSummit ? `${mountainName} - đỉnh` : checkpointTitle),
        description: template.description(
          isSummit ? `${mountainName} - đỉnh` : checkpointTitle,
        ),
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
    description: `Hoàn thành ${blueprint.name} để nhận huy hiệu.`,
    image: blueprint.badgeImage,
    unlocked: index === 0,
  };

  const stationRewards = [
    createReward({
      id: `${blueprint.id}-reward-1`,
      title: "+20 Xu Edu",
      subtitle: "Hoàn thành trạm",
      icon: "🪙",
      theme: "amber",
      xu: 20,
      exp: 50,
    }),
    createReward({
      id: `${blueprint.id}-reward-2`,
      title: "+30 Xu Edu",
      subtitle: "Giữ nhịp học",
      icon: "⭐",
      theme: "gold",
      xu: 30,
      exp: 75,
    }),
    createReward({
      id: `${blueprint.id}-reward-3`,
      title: "+40 Xu Edu",
      subtitle: "Luyện tập thêm",
      icon: "📘",
      theme: "blue",
      xu: 40,
      exp: 90,
    }),
    createReward({
      id: `${blueprint.id}-reward-4`,
      title: "+50 Xu Edu",
      subtitle: "Hoàn thiện kỹ năng",
      icon: "⛰️",
      theme: "green",
      xu: 50,
      exp: 120,
    }),
    createReward({
      id: `${blueprint.id}-reward-5`,
      title: "+70 Xu Edu",
      subtitle: "Chuẩn bị lên đỉnh",
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
        subtitle: "Chinh phục đỉnh núi",
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
    icon: blueprint.image,
    backgroundImage: blueprint.backgroundImage,
    badge,
    startPosition: ROUTE_POSITIONS[0],
    locked: index !== 0,
    checkpoints,
  };
}

export const season1 = {
  id: "season-1",
  order: 1,
  name: "Season 1",
  title: "7 đỉnh cao thế giới",
  description: "Khám phá 7 ngọn núi biểu tượng của hành trình Learning Path.",
  badge: {
    id: "badge-world-explorer",
    name: "World Explorer Badge",
    description: "Hoàn thành toàn bộ 7 ngọn núi của Season 1.",
    image: "/assets/learning-path/badges/badge-world-explorer.png",
    unlocked: false,
  },
  mountains: MOUNTAIN_BLUEPRINTS.map((blueprint, index) =>
    createMountain(blueprint, index),
  ),
};

export const season1Progress = {
  currentSeason: season1.id,
  currentMountain: "everest",
  currentCheckpoint: "everest-checkpoint-1",
  completedTasks: [],
  earnedXu: 0,
  earnedExp: 0,
  earnedBadges: [],
  completedCheckpoints: [],
};

export { TASK_TEMPLATES, ROUTE_POSITIONS, PEAK_POSITION, MOUNTAIN_BLUEPRINTS };
