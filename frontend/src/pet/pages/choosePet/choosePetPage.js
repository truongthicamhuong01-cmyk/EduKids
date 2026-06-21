import { createModal } from "../../ui/modal.js";
import { asElement, escapeHtml } from "../../utils/dom.js";
import {
  resolveBackgroundPath,
  resolvePetAssetPath,
  getAssetAudit,
} from "../../utils/assetResolver.js";

const CHOOSE_PAGE_ID = "edukids-pet-choose-page";

const PET_OPTIONS = [
  {
    petTypeId: "elephant",
    displayName: "Voi Bà Trưng",
    description: "Hiền lành, mạnh mẽ và luôn ở bên bạn trong hành trình học tập.",
    background: resolveBackgroundPath({ petType: "elephant" }),
    petImage: resolvePetAssetPath({
      petType: "elephant",
      level: "level1",
      mood: "happy",
    }),
  },
  {
    petTypeId: "horse",
    displayName: "Ngựa Thánh Gióng",
    description: "Nhanh nhẹn, bền bỉ và thích cùng bạn chinh phục thử thách mới.",
    background: resolveBackgroundPath({ petType: "horse" }),
    petImage: resolvePetAssetPath({
      petType: "horse",
      level: "level1",
      mood: "happy",
    }),
  },
];

function iconBack() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;
}

function iconShop() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 5h2l1.1 8.1A2 2 0 0 0 8 15h8.2a2 2 0 0 0 1.94-1.52L19.7 8H6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M7 19a1.2 1.2 0 1 0 0 .01M16.2 19a1.2 1.2 0 1 0 0 .01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      <path d="M10 6.3h.01M14 6.3h.01" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"></path>
    </svg>
  `;
}

function iconStar() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m12 2.2 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 16.8 6.2 20.1l1.1-6.5-4.7-4.6 6.5-.9Z" fill="currentColor"></path>
    </svg>
  `;
}

function iconCheck() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m5.5 12.4 4 4.1 9-9.2" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;
}

function iconSuccess() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m5.5 12.4 4 4.1 9-9.2" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"></path>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" opacity="0.2"></circle>
    </svg>
  `;
}

function ensureChoosePageRoot() {
  let root = document.getElementById(CHOOSE_PAGE_ID);

  if (!root) {
    root = document.createElement("section");
    root.id = CHOOSE_PAGE_ID;
    root.className = "pet-choose-screen";
    root.hidden = true;
    root.innerHTML = `
      <div class="pet-choose-screen__background" aria-hidden="true"></div>
      <div class="pet-choose-screen__shell">
        <header class="pet-choose-screen__header">
          <button type="button" class="pet-choose-back" data-action="back" aria-label="Quay lại">
            ${iconBack()}
          </button>

          <div class="pet-choose-banner" aria-label="Chọn Pet">
            <span class="pet-choose-banner__star" aria-hidden="true">${iconStar()}</span>
            <h1 class="pet-choose-banner__title">CHỌN PET</h1>
            <span class="pet-choose-banner__star" aria-hidden="true">${iconStar()}</span>
          </div>

          <button type="button" class="pet-choose-shop" data-action="shop" aria-label="Mở Cửa hàng">
            <span aria-hidden="true">${iconShop()}</span>
            <span>Cửa hàng</span>
          </button>
        </header>

        <p class="pet-choose-subtitle">
          Chọn một người bạn đồng hành đầu tiên cho hành trình học tập của bạn.
        </p>

        <div class="pet-choose-grid" data-pet-options></div>

        <div class="pet-choose-error" data-pet-error hidden>
          <strong class="pet-choose-error__title" data-pet-error-title>Đã có lỗi xảy ra.</strong>
          <p class="pet-choose-error__message" data-pet-error-message>Hãy thử lại nhé.</p>
          <button type="button" class="pet-btn pet-btn--secondary pet-choose-error__action" data-action="retry">
            Thử lại
          </button>
        </div>

        <div class="pet-choose-success" data-pet-success hidden aria-hidden="true">
          <div class="pet-choose-success__card">
            <span class="pet-choose-success__icon">${iconSuccess()}</span>
            <strong class="pet-choose-success__title">Đã chọn Pet thành công</strong>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(root);
  }

  root.style.setProperty(
    "--pet-choose-scene",
    `url('${resolveBackgroundPath({ petType: "horse" })}')`,
  );

  return root;
}

function setBodyActive(isActive) {
  document.body.classList.toggle("pet-choose-active", Boolean(isActive));
}

function preloadAsset(src) {
  if (!src) {
    return;
  }

  const img = new Image();
  img.decoding = "async";
  img.src = src;
}

function normalizeError(error) {
  if (!error || typeof error !== "object") {
    return {
      message: "Mạng không ổn định.",
      errorCode: "",
    };
  }

  const response = error.payload || {};
  return {
    message: String(response.message || error.message || "Mạng không ổn định."),
    errorCode: String(response.errorCode || error.errorCode || ""),
  };
}

export function createChoosePetPage({
  store,
  petApi,
  loadingOverlay,
} = {}) {
  const root = ensureChoosePageRoot();
  const modal = createModal();

  const state = {
    selectedPetTypeId: "",
    loading: false,
    visible: false,
    initialized: false,
    mounted: false,
    errorMessage: "",
  };

  function getOptionsRoot() {
    return root.querySelector("[data-pet-options]");
  }

  function getErrorRoot() {
    return root.querySelector("[data-pet-error]");
  }

  function getSuccessRoot() {
    return root.querySelector("[data-pet-success]");
  }

  function setLoading(isLoading) {
    state.loading = Boolean(isLoading);
    root.setAttribute("aria-busy", String(Boolean(isLoading)));
    root.querySelectorAll("button").forEach((button) => {
      button.disabled = Boolean(isLoading);
    });
    if (loadingOverlay?.setVisible) {
      loadingOverlay.setVisible(Boolean(isLoading), "Đang tải Pet...");
    }
  }

  function showError(message) {
    state.errorMessage = String(message || "Đã có lỗi xảy ra.");
    const errorRoot = getErrorRoot();
    const title = root.querySelector("[data-pet-error-title]");
    const messageEl = root.querySelector("[data-pet-error-message]");

    if (title) {
      title.textContent = "Không thể tải Choose Pet";
    }
    if (messageEl) {
      messageEl.textContent = state.errorMessage;
    }

    if (errorRoot) {
      errorRoot.hidden = false;
    }
  }

  function hideError() {
    state.errorMessage = "";
    const errorRoot = getErrorRoot();
    if (errorRoot) {
      errorRoot.hidden = true;
    }
  }

  function showSuccess() {
    const successRoot = getSuccessRoot();
    if (!successRoot) {
      return;
    }

    successRoot.hidden = false;
    successRoot.classList.remove("pet-animate-fade-in");
    void successRoot.offsetWidth;
    successRoot.classList.add("pet-animate-fade-in");

    window.setTimeout(() => {
      successRoot.hidden = true;
      root.hidden = true;
      state.visible = false;
      setBodyActive(false);
      window.dispatchEvent(
        new CustomEvent("edukids:pet:selected", {
          detail: {
            petTypeId: state.selectedPetTypeId,
          },
        }),
      );
    }, 800);
  }

  function renderOption(option) {
    const selected = state.selectedPetTypeId === option.petTypeId;
    const activeClass = selected ? "is-selected" : "";
    const buttonClass = selected ? "pet-btn pet-btn--primary pet-choice-card__action is-active" : "pet-btn pet-btn--secondary pet-choice-card__action";

    return `
      <article
        class="pet-choice-card ${activeClass}"
        data-pet-card="${escapeHtml(option.petTypeId)}"
        data-pet-background="${escapeHtml(option.background)}"
        data-pet-image="${escapeHtml(option.petImage)}"
        tabindex="0"
        aria-label="${escapeHtml(option.displayName)}"
      >
        <div class="pet-choice-card__inner">
          <h2 class="pet-choice-card__name">${escapeHtml(option.displayName)}</h2>

          <div class="pet-choice-card__art" style="--pet-card-scene: url('${escapeHtml(option.background)}')">
            <img
              class="pet-choice-card__pet"
              src="${escapeHtml(option.petImage)}"
              alt="${escapeHtml(option.displayName)}"
              loading="eager"
              decoding="async"
            />
            <span class="pet-choice-card__check" aria-hidden="true">${iconCheck()}</span>
          </div>

          <p class="pet-choice-card__description">
            ${escapeHtml(option.description)}
          </p>

          <button
            type="button"
            class="${buttonClass}"
            data-action="choose"
            data-pet-type-id="${escapeHtml(option.petTypeId)}"
            aria-pressed="${String(selected)}"
          >
            Chọn
          </button>
        </div>
      </article>
    `;
  }

  function renderOptions() {
    const optionsRoot = getOptionsRoot();
    if (!optionsRoot) {
      return;
    }

    optionsRoot.innerHTML = PET_OPTIONS.map(renderOption).join("");

    PET_OPTIONS.forEach((option) => {
      preloadAsset(option.background);
      preloadAsset(option.petImage);
    });
  }

  function updateSelection(nextPetTypeId) {
    state.selectedPetTypeId = nextPetTypeId;
    renderOptions();
  }

  function openConfirmModal(petOption) {
    modal.open({
      title: `Bạn có chắc muốn chọn ${petOption.displayName} không?`,
      description: "Sau khi chọn, bạn sẽ không thể đổi Pet này nữa.",
      confirmText: "Xác nhận",
      cancelText: "Hủy",
      onConfirm: async () => {
        await choosePet(petOption);
      },
    });
  }

  async function choosePet(petOption) {
    if (state.loading) {
      return;
    }

    state.selectedPetTypeId = petOption.petTypeId;
    hideError();
    setLoading(true);

    try {
      const response = await petApi.selectPet({
        petTypeId: petOption.petTypeId,
        petName: petOption.displayName,
      });

      if (store?.applyBackendResponse) {
        store.applyBackendResponse(response, "pet-select");
      }

      showSuccess();
    } catch (error) {
      const normalized = normalizeError(error);
      showError(normalized.message);
    } finally {
      setLoading(false);
    }
  }

  function handleAction(action, event) {
    const card = event.target.closest?.("[data-pet-card]");
    const petTypeId = event.target.closest?.("[data-pet-type-id]")?.dataset?.petTypeId || card?.dataset?.petCard || "";
    const petOption = PET_OPTIONS.find((item) => item.petTypeId === petTypeId);

    if (action === "back") {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.dispatchEvent(new CustomEvent("edukids:pet:back"));
      }
      return;
    }

    if (action === "shop") {
      window.dispatchEvent(new CustomEvent("edukids:pet:shop-requested"));
      return;
    }

    if (action === "retry") {
      initialize();
      return;
    }

    if (action === "choose" && petOption) {
      openConfirmModal(petOption);
      return;
    }

    if (petOption && card) {
      updateSelection(petOption.petTypeId);
    }
  }

  function handleRootClick(event) {
    const button = event.target.closest?.("[data-action]");
    const card = event.target.closest?.("[data-pet-card]");

    if (button) {
      handleAction(button.dataset.action, event);
      return;
    }

    if (card) {
      updateSelection(card.dataset.petCard || "");
    }
  }

  function handleRootKeydown(event) {
    const card = event.target.closest?.("[data-pet-card]");

    if (!card) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      updateSelection(card.dataset.petCard || "");
    }
  }

  async function loadPetState() {
    setLoading(true);
    hideError();

    try {
      const response = await petApi.getPet();
      const hasPet = response?.data?.hasPet;

      if (store?.applyBackendResponse) {
        store.applyBackendResponse(response, "pet-load");
      }

      if (hasPet === false || !response?.data?.pet) {
        state.visible = true;
        root.hidden = false;
        setBodyActive(true);
        renderOptions();
        return;
      }

      state.visible = false;
      root.hidden = true;
      setBodyActive(false);
    } catch (error) {
      const errorCode = String(error?.errorCode || error?.payload?.errorCode || "").trim();
      if (errorCode === "PET_NOT_FOUND") {
        state.visible = true;
        root.hidden = false;
        setBodyActive(true);
        renderOptions();
        if (store?.setState) {
          store.setState({ hasPet: false, pet: null });
        }
        return;
      }

      const normalized = normalizeError(error);
      showError(normalized.message);
    } finally {
      setLoading(false);
      state.initialized = true;
    }
  }

  function syncFromStore(snapshot = {}) {
    if (snapshot.pet) {
      state.visible = false;
      root.hidden = true;
      setBodyActive(false);
      hideError();
      return;
    }

    if (snapshot.hasPet === false && state.initialized) {
      state.visible = true;
      root.hidden = false;
      setBodyActive(true);
      renderOptions();
    }
  }

  function mount() {
    if (state.mounted) {
      return;
    }

    root.addEventListener("click", handleRootClick);
    root.addEventListener("keydown", handleRootKeydown);
    renderOptions();
    modal.mount(document.body);
    state.mounted = true;
  }

  async function initialize() {
    state.initialized = false;
    mount();
    await loadPetState();
  }

  function destroy() {
    root.removeEventListener("click", handleRootClick);
    root.removeEventListener("keydown", handleRootKeydown);
    root.hidden = true;
    setBodyActive(false);
    modal.close();
    state.mounted = false;
  }

  if (store?.on) {
    store.on("STATE_UPDATED", syncFromStore);
  }

  return {
    initialize,
    destroy,
    show: () => {
      state.visible = true;
      root.hidden = false;
      setBodyActive(true);
      renderOptions();
    },
    hide: () => {
      state.visible = false;
      root.hidden = true;
      setBodyActive(false);
    },
    get state() {
      return { ...state };
    },
    get assetAudit() {
      return getAssetAudit();
    },
  };
}
