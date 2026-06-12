import "./config.js";
import "./firebase-init.js";
import "./services/profileService.js";
import "./services/assignmentService.js";
import "./style.css";

const bootstrapState = (window.__EDUKIDS_BOOTSTRAP__ ||= {
  appBound: false,
  authRootBound: false,
  authMode: "login",
  currentUser: null,
  initializedUid: null,
  listenerReady: false,
});

function whenDomReady() {
  if (document.readyState !== "loading") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    document.addEventListener("DOMContentLoaded", resolve, { once: true });
  });
}

function getAppShell() {
  return document.getElementById("app-shell");
}

function getAuthRoot() {
  return document.getElementById("auth-root");
}

function getFirebaseAuth() {
  if (typeof window.firebase?.auth !== "function") {
    return null;
  }

  try {
    return window.firebase.auth();
  } catch (error) {
    console.warn("[EduKids] Unable to access Firebase auth:", error);
    return null;
  }
}

function setAuthFeedback(message, kind = "error") {
  const feedback = getAuthRoot()?.querySelector("[data-auth-feedback]");

  if (!feedback) {
    return;
  }

  feedback.textContent = message || "";
  feedback.classList.toggle("is-visible", Boolean(message));
  feedback.classList.toggle("is-error", kind === "error");
  feedback.classList.toggle("is-success", kind === "success");
}

function renderAuthView() {
  const authRoot = getAuthRoot();

  if (!authRoot) {
    return;
  }

  const isLoginMode = bootstrapState.authMode === "login";
  const renderKey = bootstrapState.authMode;

  if (authRoot.dataset.renderedMode === renderKey) {
    return;
  }

  authRoot.innerHTML = `
    <section class="auth-shell" aria-label="Đăng nhập EduKids">
      <div class="auth-stage">
        <span class="auth-badge">EduKids</span>
        <div class="auth-card">
          <div class="auth-brand">
            <img
              class="auth-brand-icon"
              src="/assets/edukids-icon-192.png"
              alt=""
              aria-hidden="true"
            />
            <div class="auth-brand-name">EduKids</div>
          </div>

          <h1 class="auth-title">
            ${isLoginMode ? "Chào mừng trở lại" : "Tạo tài khoản"}
          </h1>

          <form class="auth-form" data-auth-form>
            <label class="auth-field">
              <span class="auth-field-label">Email</span>
              <div class="auth-input-wrap">
                <input
                  class="auth-input"
                  name="email"
                  type="email"
                  autocomplete="email"
                  placeholder="teacher@edukids.vn"
                  required
                />
              </div>
              <div class="auth-field-error" data-auth-error-for="email"></div>
            </label>

            <label class="auth-field">
              <span class="auth-field-label">Mật khẩu</span>
              <div class="auth-input-wrap">
                <input
                  class="auth-input"
                  name="password"
                  type="password"
                  autocomplete="${isLoginMode ? "current-password" : "new-password"}"
                  placeholder="Nhập mật khẩu"
                  minlength="6"
                  required
                />
                <button
                  type="button"
                  class="auth-password-toggle"
                  data-password-toggle
                  aria-label="Hiện mật khẩu"
                >
                  <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
                    <path
                      d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linejoin="round"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="2.8"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                    />
                  </svg>
                </button>
              </div>
              <div class="auth-field-error" data-auth-error-for="password"></div>
            </label>

            <div class="auth-feedback" data-auth-feedback></div>

            <button type="submit" class="auth-submit-button" data-auth-submit>
              ${isLoginMode ? "Đăng nhập" : "Tạo tài khoản"}
            </button>
          </form>

          <div class="auth-switch">
            ${
              isLoginMode
                ? 'Chưa có tài khoản? <button type="button" class="auth-link-button" data-auth-mode-toggle="register">Đăng ký</button>'
                : 'Đã có tài khoản? <button type="button" class="auth-link-button" data-auth-mode-toggle="login">Đăng nhập</button>'
            }
          </div>
        </div>
      </div>
    </section>
  `;

  authRoot.dataset.renderedMode = renderKey;
  bindAuthRootEventsOnce();
}

function bindAuthRootEventsOnce() {
  const authRoot = getAuthRoot();

  if (!authRoot || bootstrapState.authRootBound) {
    return;
  }

  authRoot.addEventListener("click", (event) => {
    const modeToggle = event.target.closest("[data-auth-mode-toggle]");
    if (modeToggle) {
      const nextMode = modeToggle.dataset.authModeToggle;
      if (nextMode === "login" || nextMode === "register") {
        bootstrapState.authMode = nextMode;
        authRoot.removeAttribute("data-rendered-mode");
        renderAuthView();
        setAuthFeedback("");
      }
      return;
    }

    const passwordToggle = event.target.closest("[data-password-toggle]");
    if (passwordToggle) {
      const input = authRoot.querySelector('input[name="password"]');
      if (!input) {
        return;
      }

      input.type = input.type === "password" ? "text" : "password";
      passwordToggle.setAttribute(
        "aria-label",
        input.type === "password" ? "Hiện mật khẩu" : "Ẩn mật khẩu",
      );
    }
  });

  authRoot.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-auth-form]");
    if (!form) {
      return;
    }

    event.preventDefault();

    const submitButton = form.querySelector("[data-auth-submit]");
    const email = String(form.querySelector('input[name="email"]')?.value || "").trim();
    const password = String(form.querySelector('input[name="password"]')?.value || "").trim();

    if (!email || !password) {
      setAuthFeedback("Vui lòng nhập email và mật khẩu.");
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthFeedback("Firebase Auth chưa sẵn sàng. Vui lòng tải lại trang.");
      return;
    }

    try {
      if (submitButton) {
        submitButton.disabled = true;
      }

      setAuthFeedback("Đang xác thực...", "success");

      if (bootstrapState.authMode === "register") {
        await auth.createUserWithEmailAndPassword(email, password);
      } else {
        await auth.signInWithEmailAndPassword(email, password);
      }
    } catch (error) {
      console.error("[EduKids] Auth request failed:", error);
      setAuthFeedback(error?.message || "Đăng nhập thất bại. Vui lòng thử lại.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });

  bootstrapState.authRootBound = true;
}

function showPage(pageId) {
  const appShell = getAppShell();
  if (!appShell || !pageId) {
    return;
  }

  appShell.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === pageId);
  });

  appShell.querySelectorAll("[data-page]").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === pageId);
  });
}

function bindAppEventsOnce() {
  const appShell = getAppShell();
  if (!appShell || bootstrapState.appBound) {
    return;
  }

  appShell.addEventListener("click", async (event) => {
    const pageTrigger = event.target.closest("[data-page]");
    if (pageTrigger?.dataset.page) {
      showPage(pageTrigger.dataset.page);
      return;
    }

    const menuToggle = event.target.closest("[data-mobile-menu-toggle]");
    if (menuToggle) {
      const isOpen = document.body.classList.toggle("sidebar-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      return;
    }

    const logoutButton = event.target.closest("[data-logout-button]");
    if (logoutButton) {
      const auth = getFirebaseAuth();
      if (auth) {
        await auth.signOut();
      }
    }
  });

  bootstrapState.appBound = true;
}

function showAssignmentTab(status, trigger) {
  const appShell = getAppShell();
  if (!appShell || !status) {
    return;
  }

  appShell.querySelectorAll(".assignment-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.id === status);
  });

  appShell.querySelectorAll(".assignment-tab-btn").forEach((button) => {
    button.classList.toggle("active", button === trigger);
  });
}

function initApp(user) {
  if (!user) {
    return;
  }

  if (bootstrapState.initializedUid === user.uid) {
    return;
  }

  bootstrapState.initializedUid = user.uid;
  bootstrapState.currentUser = user;

  bindAppEventsOnce();
  showPage("student-home");
  window.EduKidsCurrentUser = user;
}

function handleAuthStateChanged(user) {
  bootstrapState.currentUser = user || null;

  const appShell = getAppShell();
  const authRoot = getAuthRoot();

  if (appShell) {
    appShell.hidden = !user;
  }

  if (authRoot) {
    authRoot.hidden = Boolean(user);
  }

  document.body?.classList.toggle("auth-mode", !user);

  if (user) {
    initApp(user);
    return;
  }

  bootstrapState.authMode = "login";
  if (authRoot) {
    authRoot.removeAttribute("data-rendered-mode");
  }
  renderAuthView();
}

function startAuthListenerOnce() {
  if (window.__authInitialized) {
    return;
  }

  window.__authInitialized = true;

  const auth = getFirebaseAuth();
  if (!auth) {
    console.warn("[EduKids] Firebase Auth is unavailable.");
    handleAuthStateChanged(null);
    bootstrapState.listenerReady = true;
    return;
  }

  auth.onAuthStateChanged(
    (user) => {
      handleAuthStateChanged(user);
      bootstrapState.listenerReady = true;
    },
    (error) => {
      console.error("[EduKids] Auth listener failed:", error);
      handleAuthStateChanged(null);
      bootstrapState.listenerReady = true;
    },
  );
}

function installCompatibilityGlobals() {
  window.checkAuth = () => getFirebaseAuth()?.currentUser || null;
  window.renderLogin = () => {
    bootstrapState.authMode = "login";
    const authRoot = getAuthRoot();
    if (authRoot) {
      authRoot.removeAttribute("data-rendered-mode");
    }
    renderAuthView();
    return getAuthRoot()?.innerHTML || "";
  };
  window.initApp = initApp;
  window.showAssignmentTab = showAssignmentTab;
  window.askAI = () => {
    console.info("[EduKids] AI Coach action triggered.");
  };
}

async function bootstrap() {
  const appShell = getAppShell();
  const authRoot = getAuthRoot();

  if (appShell) {
    appShell.hidden = true;
  }
  if (authRoot) {
    authRoot.hidden = false;
  }
  document.body?.classList.add("auth-mode");

  renderAuthView();
  installCompatibilityGlobals();
  startAuthListenerOnce();
}

void whenDomReady().then(bootstrap);
