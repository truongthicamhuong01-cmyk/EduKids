import "./styles/pet.css";
import { createPetApi } from "./api/petApi.js";
import { createShopApi } from "./api/shopApi.js";
import { createInventoryApi } from "./api/inventoryApi.js";
import { createRewardApi } from "./api/rewardApi.js";
import { createPetStore } from "./store/petStore.js";
import { createPetClient } from "./services/petClient.js";
import { createFeedbackManager } from "./ui/feedbackManager.js";
import { createLoadingOverlay } from "./ui/loadingOverlay.js";
import { createErrorView } from "./ui/errorView.js";
import { renderPet } from "./renderers/renderPet.js";
import { renderStats } from "./renderers/renderStats.js";
import { renderInventory } from "./renderers/renderInventory.js";
import { renderShop } from "./renderers/renderShop.js";
import { renderLoading } from "./renderers/renderLoading.js";
import { getAssetAudit, listKnownPetTypes } from "./utils/assetResolver.js";
import { createChoosePetPage } from "./pages/choosePet/choosePetPage.js";
import { createHomePetPage } from "./pages/homePet/homePetPage.js";
import { createFeedPage } from "./pages/feed/feedPage.js";
import { createInventoryPage } from "./pages/inventory/inventoryPage.js";
import { createShopPage } from "./pages/shop/shopPage.js";

const petStore = createPetStore();
const petApi = createPetApi();
const shopApi = createShopApi();
const inventoryApi = createInventoryApi();
const rewardApi = createRewardApi();
const petClient = createPetClient({
  store: petStore,
  petApi,
  shopApi,
  inventoryApi,
  rewardApi,
});
const loadingOverlay = createLoadingOverlay();
const errorView = createErrorView();
const assetAudit = getAssetAudit();
const homePetPage = createHomePetPage({
  store: petStore,
  petApi,
});
const choosePetPage = createChoosePetPage({
  store: petStore,
  petApi,
  loadingOverlay,
});
const feedPage = createFeedPage({
  store: petStore,
  petApi,
  shopApi,
  inventoryApi,
});
const inventoryPage = createInventoryPage({
  store: petStore,
  petApi,
  inventoryApi,
});
const shopPage = createShopPage({
  store: petStore,
  shopApi,
});

if (assetAudit?.issues?.length > 0) {
  console.warn("[EduKids][Pet][Assets] audit issues", assetAudit.issues);
}

function renderAll(state) {
  renderPet("[data-pet-root]", state);
  renderStats("[data-pet-stats-root]", state);
  renderInventory("[data-pet-inventory-root]", state);
  renderShop("[data-pet-shop-root]", state);
  renderLoading("[data-pet-loading-root]", state.loading, "Đang tải dữ liệu...");
}

function syncUiFromStore(snapshot) {
  renderAll(snapshot);

  if (snapshot.loading) {
    loadingOverlay.setVisible(true, "Đang tải dữ liệu...");
  } else {
    loadingOverlay.setVisible(false);
  }

  if (snapshot.error) {
    errorView.show(snapshot.error);
  } else {
    errorView.hide();
  }
}

petStore.subscribe(syncUiFromStore);

const feedbackManager = createFeedbackManager({ store: petStore });

function bootstrapPetUi() {
  syncUiFromStore(petStore.getState());
  feedbackManager.sync(petStore.getState());
}

function showHomePetPage() {
  feedPage.hide();
  inventoryPage.hide();
  shopPage.hide();
  choosePetPage.hide();
  homePetPage.show();
}

function showFeedPage() {
  choosePetPage.hide();
  inventoryPage.hide();
  shopPage.hide();
  homePetPage.hide();
  void feedPage.initialize().catch(() => {});
}

function showInventoryPage() {
  choosePetPage.hide();
  feedPage.hide();
  shopPage.hide();
  homePetPage.hide();
  void inventoryPage.initialize().catch(() => {});
}

function showShopPage() {
  choosePetPage.hide();
  feedPage.hide();
  inventoryPage.hide();
  homePetPage.hide();
  void shopPage.initialize().catch(() => {});
}

function bindPetNavigationEvents() {
  window.addEventListener("edukids:pet:feed-requested", () => {
    showFeedPage();
  });

  window.addEventListener("edukids:pet:inventory-requested", () => {
    showInventoryPage();
  });

  window.addEventListener("edukids:pet:shop-requested", () => {
    showShopPage();
  });

  window.addEventListener("edukids:pet:home-requested", () => {
    showHomePetPage();
  });
}

if (typeof document !== "undefined") {
  bindPetNavigationEvents();

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        bootstrapPetUi();
        homePetPage.initialize().catch(() => {});
        choosePetPage.initialize().catch(() => {});
      },
      { once: true },
    );
  } else {
    bootstrapPetUi();
    homePetPage.initialize().catch(() => {});
    choosePetPage.initialize().catch(() => {});
  }
}

window.EduKidsPet = {
  store: petStore,
  api: {
    pet: petApi,
    shop: shopApi,
    inventory: inventoryApi,
    reward: rewardApi,
  },
  client: petClient,
  ui: {
    feedbackManager,
    loadingOverlay,
    errorView,
    homePetPage,
    choosePetPage,
    feedPage,
    inventoryPage,
    shopPage,
  },
  assets: {
    audit: assetAudit,
    petTypes: listKnownPetTypes(),
  },
  renderers: {
    renderPet,
    renderStats,
    renderInventory,
    renderShop,
    renderLoading,
  },
};

export {
  errorView,
  inventoryApi,
  loadingOverlay,
  petApi,
  petClient,
  petStore,
  feedbackManager,
  renderAll,
  rewardApi,
  shopApi,
  assetAudit,
  homePetPage,
  choosePetPage,
  feedPage,
  inventoryPage,
  shopPage,
};
