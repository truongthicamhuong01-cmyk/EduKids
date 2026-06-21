import { createPetHttpClient } from "./httpClient.js";

function createRewardPath(actionName) {
  return `/api/rewards/${String(actionName || "").trim()}`;
}

export function createRewardApi() {
  const client = createPetHttpClient();

  return {
    rewardLessonComplete: (body, options = {}) =>
      client.request(createRewardPath("lesson-complete"), { method: "POST", body, ...options }),
    rewardLearningPath: (body, options = {}) =>
      client.request(createRewardPath("learning-path"), { method: "POST", body, ...options }),
    rewardAssignment: (body, options = {}) =>
      client.request(createRewardPath("assignment"), { method: "POST", body, ...options }),
    rewardHighScore: (body, options = {}) =>
      client.request(createRewardPath("high-score"), { method: "POST", body, ...options }),
    rewardLearningStreak: (body, options = {}) =>
      client.request(createRewardPath("learning-streak"), { method: "POST", body, ...options }),
    rewardDailyLogin: (body, options = {}) =>
      client.request(createRewardPath("daily-login"), { method: "POST", body, ...options }),
  };
}

