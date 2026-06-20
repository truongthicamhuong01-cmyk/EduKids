const TASK_BLUEPRINTS = [
  {
    idSuffix: "login",
    type: "login",
    icon: "🔐",
    metric: "loginCountToday",
    threshold: 1,
    title: (checkpointTitle) => `Đăng nhập hôm nay để mở ${checkpointTitle}`,
    description: () =>
      "Chỉ tính đăng nhập được hệ thống ghi nhận trong ngày hiện tại.",
    targetRoute: "/student/learning-path",
  },
  {
    idSuffix: "study-15",
    type: "study_minutes",
    icon: "⏱️",
    metric: "studyMinutesToday",
    threshold: 15,
    title: () => "Học đủ 15 phút hôm nay",
    description: () => "Chỉ tính thời lượng học phát sinh trong ngày hiện tại.",
    targetRoute: "/student/learning-path",
  },
  {
    idSuffix: "study-30",
    type: "study_minutes",
    icon: "🔥",
    metric: "studyMinutesToday",
    threshold: 30,
    title: () => "Học đủ 30 phút hôm nay",
    description: () => "Chỉ tính thời lượng học phát sinh trong ngày hiện tại.",
    targetRoute: "/student/learning-path",
  },
  {
    idSuffix: "study-45",
    type: "study_minutes",
    icon: "⛰️",
    metric: "studyMinutesToday",
    threshold: 45,
    title: () => "Học đủ 45 phút hôm nay",
    description: () => "Chỉ tính thời lượng học phát sinh trong ngày hiện tại.",
    targetRoute: "/student/learning-path",
  },
  {
    idSuffix: "study-60",
    type: "study_minutes",
    icon: "🏔️",
    metric: "studyMinutesToday",
    threshold: 60,
    title: () => "Học đủ 60 phút hôm nay",
    description: () => "Chỉ tính thời lượng học phát sinh trong ngày hiện tại.",
    targetRoute: "/student/learning-path",
  },
  {
    idSuffix: "lesson-1",
    type: "lesson",
    icon: "📘",
    metric: "lessonCountToday",
    threshold: 1,
    title: () => "Hoàn thành 1 bài học hôm nay",
    description: () =>
      "Chỉ tính bài học được hệ thống ghi nhận trong ngày hiện tại.",
    targetRoute: "/student/quiz-ai",
  },
  {
    idSuffix: "lesson-2",
    type: "lesson",
    icon: "📗",
    metric: "lessonCountToday",
    threshold: 2,
    title: () => "Hoàn thành 2 bài học hôm nay",
    description: () =>
      "Chỉ tính bài học được hệ thống ghi nhận trong ngày hiện tại.",
    targetRoute: "/student/quiz-ai",
  },
  {
    idSuffix: "quiz-1",
    type: "quiz",
    icon: "🧠",
    metric: "quizCountToday",
    threshold: 1,
    title: () => "Làm 1 quiz hôm nay",
    description: () => "Chỉ tính quiz đã nộp trong ngày hiện tại.",
    targetRoute: "/student/quiz-ai",
  },
  {
    idSuffix: "quiz-2",
    type: "quiz",
    icon: "⭐",
    metric: "quizCountToday",
    threshold: 2,
    title: () => "Làm 2 quiz hôm nay",
    description: () => "Chỉ tính quiz đã nộp trong ngày hiện tại.",
    targetRoute: "/student/quiz-ai",
  },
  {
    idSuffix: "quiz-strong",
    type: "quiz_score",
    icon: "🏅",
    metric: "highScoreQuizCountToday",
    threshold: 1,
    title: () => "Đạt 8+ ở một quiz hôm nay",
    description: () =>
      "Chỉ tính quiz có điểm từ 8/10 hoặc 80/100 trở lên trong ngày hiện tại.",
    targetRoute: "/student/quiz-ai",
  },
  {
    idSuffix: "assignment-1",
    type: "assignment",
    icon: "📝",
    metric: "assignmentCountToday",
    threshold: 1,
    title: () => "Hoàn thành 1 bài tập hôm nay",
    description: () => "Chỉ tính bài tập được nộp và chấm trong ngày hiện tại.",
    targetRoute: "/student/assignments",
  },
  {
    idSuffix: "assignment-2",
    type: "assignment",
    icon: "📄",
    metric: "assignmentCountToday",
    threshold: 2,
    title: () => "Hoàn thành 2 bài tập hôm nay",
    description: () => "Chỉ tính bài tập được nộp và chấm trong ngày hiện tại.",
    targetRoute: "/student/assignments",
  },
  {
    idSuffix: "coach-1",
    type: "coach",
    icon: "🎯",
    metric: "coachCountToday",
    threshold: 1,
    title: () => "Dùng AI Coach hôm nay",
    description: () =>
      "Chỉ tính lượt dùng AI Coach được hệ thống ghi nhận trong ngày hiện tại.",
    targetRoute: "/student/ai-coach",
  },
];

const ROUTE_POSITIONS = [
  { left: 56.5, top: 91.7, side: "left" },
  { left: 41, top: 76, side: "left" },
  { left: 58.25, top: 61.75, side: "right" },
  { left: 41.3, top: 48.5, side: "left" },
  { left: 54.6, top: 36.45, side: "right" },
  { left: 44.85, top: 26.75, side: "left" },
];

const PEAK_POSITION = { left: 51.8, top: 16.5, side: "right" };

const MOUNTAIN_BLUEPRINTS = [
  {
    id: "everest",
    name: "Everest",
    continent: "Châu Á",
    height: "8.848 m",
    description: "Ngọn núi cao nhất thế giới, nằm trên dãy Himalaya hùng vĩ.",
    image: "/assets/learning-path/icon/icon-everest.png.jpg",
    icon: "/assets/learning-path/icon/icon-everest.png.jpg",
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
    image: "/assets/learning-path/icon/icon-kilimanjaro.png.jpg",
    icon: "/assets/learning-path/icon/icon-kilimanjaro.png.jpg",
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
    image: "/assets/learning-path/icon/icon-elbrus.png.jpg",
    icon: "/assets/learning-path/icon/icon-elbrus.png.jpg",
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
    image: "/assets/learning-path/icon/icon-denali.png.jpg",
    icon: "/assets/learning-path/icon/icon-denali.png.jpg",
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
    image: "/assets/learning-path/icon/icon-aconcagua.png.jpg",
    icon: "/assets/learning-path/icon/icon-aconcagua.png.jpg",
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
    image: "/assets/learning-path/icon/icon-puncak-jaya.png.jpg",
    icon: "/assets/learning-path/icon/icon-puncak-jaya.png.jpg",
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
    image: "/assets/learning-path/icon/icon-vinson-massif.png.jpg",
    icon: "/assets/learning-path/icon/icon-vinson-massif.png.jpg",
    backgroundImage: "/assets/learning-path/backgrounds/bg-vinson-massif.png",
    badgeImage: "/assets/learning-path/badges/badge-vinson-massif.png",
    badgeName: "Huy hiệu Vinson Massif",
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
  reward,
  taskKeys = [],
  completed = false,
  isSummit = false,
}) {
  const checkpointTitle =
    title ||
    (isSummit
      ? "Đỉnh Núi"
      : checkpointNumber === 0
        ? "Xuất Phát"
        : `Trạm ${checkpointNumber}`);
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
    position,
    reward,
    tasks: tasksSource.map((template, index) =>
      createTask({
        mountainId,
        checkpointSlug,
        index,
        title: template.title(
          isSummit ? `${mountainName} - đỉnh` : checkpointTitle,
        ),
        description: template.description(
          isSummit ? `${mountainName} - đỉnh` : checkpointTitle,
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
    description: `Hoàn thành ${blueprint.name} để nhận huy hiệu.`,
    image: blueprint.badgeImage,
    unlocked: index === 0,
  };

  const stationRewards = [
    createReward({
      id: `${blueprint.id}-reward-start`,
      title: "+50 Xu Edu",
      subtitle: "Khởi động hành trình",
      icon: "🧭",
      theme: "amber",
      xu: 50,
      exp: 100,
    }),
    createReward({
      id: `${blueprint.id}-reward-1`,
      title: "+50 Xu Edu",
      subtitle: "Hoàn thành trạm đầu",
      icon: "🪙",
      theme: "amber",
      xu: 50,
      exp: 100,
    }),
    createReward({
      id: `${blueprint.id}-reward-2`,
      title: "+50 Xu Edu",
      subtitle: "Giữ nhịp học",
      icon: "⭐",
      theme: "gold",
      xu: 50,
      exp: 100,
    }),
    createReward({
      id: `${blueprint.id}-reward-3`,
      title: "+50 Xu Edu",
      subtitle: "Luyện tập thêm",
      icon: "📘",
      theme: "blue",
      xu: 50,
      exp: 100,
    }),
    createReward({
      id: `${blueprint.id}-reward-4`,
      title: "+50 Xu Edu",
      subtitle: "Hoàn thiện kỹ năng",
      icon: "⛰️",
      theme: "green",
      xu: 50,
      exp: 100,
    }),
    createReward({
      id: `${blueprint.id}-reward-5`,
      title: "+50 Xu Edu",
      subtitle: "Chuẩn bị lên đỉnh",
      icon: "🏔️",
      theme: "amber",
      xu: 50,
      exp: 100,
    }),
  ];

  const checkpoints = [
    createCheckpoint({
      mountainId: blueprint.id,
      mountainName: blueprint.name,
      checkpointNumber: 0,
      title: "Xuất Phát",
      type: "station",
      altitude: "0 m",
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
      altitude: "1.000 m",
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
      altitude: "2.500 m",
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
      altitude: "4.000 m",
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
      altitude: "5.500 m",
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
      altitude: "7.000 m",
      position: ROUTE_POSITIONS[5],
      reward: stationRewards[5],
      taskKeys: ["coach-1", "quiz-2", "assignment-2", "study-60"],
      completed: false,
    }),
    createCheckpoint({
      mountainId: blueprint.id,
      mountainName: blueprint.name,
      checkpointNumber: 6,
      title: "Đỉnh Núi",
      type: "summit",
      altitude: blueprint.height,
      position: PEAK_POSITION,
      reward: createReward({
        id: `${blueprint.id}-summit-reward`,
        title: "+200 Xu Edu",
        subtitle: "Chinh phục đỉnh núi",
        icon: "🏆",
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
  currentCheckpoint: "everest-start",
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
  MOUNTAIN_BLUEPRINTS,
};
