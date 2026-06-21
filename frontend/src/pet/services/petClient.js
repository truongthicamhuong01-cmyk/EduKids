function wrapAction(store, flagName, action) {
  return async function runAction(...args) {
    store.setLoading(flagName, true);

    try {
      const response = await action(...args);
      store.applyBackendResponse(response, flagName);
      return response;
    } catch (error) {
      store.setError(error);
      throw error;
    } finally {
      store.setLoading(flagName, false);
    }
  };
}

export function createPetClient({ store, petApi, shopApi, inventoryApi, rewardApi }) {
  if (!store || !petApi || !shopApi || !inventoryApi || !rewardApi) {
    throw new Error("Pet client requires store and API adapters.");
  }

  return {
    loadPet: wrapAction(store, "pet", () => petApi.getPet()),
    selectPet: wrapAction(store, "pet", (body) => petApi.selectPet(body)),
    feedPet: wrapAction(store, "pet", (body) => petApi.feedPet(body)),
    playPet: wrapAction(store, "pet", (body) => petApi.playPet(body)),
    sleepPet: wrapAction(store, "pet", (body) => petApi.sleepPet(body)),
    loadInventory: wrapAction(store, "inventory", () => inventoryApi.getInventory()),
    useInventoryItem: wrapAction(store, "inventory", (body) => inventoryApi.useItem(body)),
    loadShop: wrapAction(store, "shop", () => shopApi.getShop()),
    buyShopItem: wrapAction(store, "shop", (body) => shopApi.buyItem(body)),
    rewards: {
      lessonComplete: wrapAction(store, "reward", (body) => rewardApi.rewardLessonComplete(body)),
      learningPath: wrapAction(store, "reward", (body) => rewardApi.rewardLearningPath(body)),
      assignment: wrapAction(store, "reward", (body) => rewardApi.rewardAssignment(body)),
      highScore: wrapAction(store, "reward", (body) => rewardApi.rewardHighScore(body)),
      learningStreak: wrapAction(store, "reward", (body) => rewardApi.rewardLearningStreak(body)),
      dailyLogin: wrapAction(store, "reward", (body) => rewardApi.rewardDailyLogin(body)),
    },
  };
}
