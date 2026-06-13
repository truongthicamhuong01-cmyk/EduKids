import { API_BASE_URL } from "./config.js";
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
});

const AUTH_SESSION_KEY = "edukids-current-user";
const AUTH_ACCOUNTS_KEY = "edukids-mock-accounts";
const AUTH_CLEAR_KEYS = [
  "token",
  "authToken",
  "user",
  "currentUser",
  AUTH_SESSION_KEY,
];

function apiRequest(path, payload) {
  return fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
      throw new Error(data.message || `Request failed: ${response.status}`);
    }

    return data;
  });
}

function apiRequestWithAuth(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token =
    localStorage.getItem("authToken") || localStorage.getItem("token") || "";

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
      throw new Error(data.message || `Request failed: ${response.status}`);
    }

    return data;
  });
}

function readJsonStorage(key) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    return null;
  }
}

function decodeJwtPayload(token) {
  if (typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");

  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    return JSON.parse(atob(padded));
  } catch (error) {
    return null;
  }
}

function setSessionUser(user) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
}

function loadSessionUser() {
  return readJsonStorage(AUTH_SESSION_KEY);
}

function clearSessionUser() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function clearStoredAuthKeys() {
  AUTH_CLEAR_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

function saveAuthSession(user, token) {
  if (token) {
    localStorage.setItem("token", token);
    localStorage.setItem("authToken", token);
  }

  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("currentUser", JSON.stringify(user));
    setSessionUser(user);
  }
}

function normalizeRole(role) {
  return role === "teacher" ? "teacher" : "student";
}

function getCurrentAuthUser() {
  const storedKeys = [AUTH_SESSION_KEY, "currentUser", "user"];

  for (const key of storedKeys) {
    const storedUser = readJsonStorage(key);

    if (
      storedUser &&
      typeof storedUser === "object" &&
      normalizeRole(storedUser.role)
    ) {
      return storedUser;
    }
  }

  const token =
    localStorage.getItem("authToken") || localStorage.getItem("token");
  const payload = decodeJwtPayload(token);

  if (payload && typeof payload === "object" && normalizeRole(payload.role)) {
    if (
      payload.user &&
      typeof payload.user === "object" &&
      normalizeRole(payload.user.role)
    ) {
      return payload.user;
    }

    return payload;
  }

  return loadSessionUser();
}

function getCurrentRole() {
  return normalizeRole(getCurrentAuthUser()?.role);
}

function getDefaultPageForRole(role) {
  return role === "teacher" ? "teacher-dashboard" : "student-home";
}

function getAuthContainer() {
  return getAuthRoot();
}

function setAuthMode(isAuthMode) {
  document.body.classList.toggle("auth-mode", isAuthMode);

  const appShell = getAppShell();
  const authRoot = getAuthContainer();

  if (appShell) {
    appShell.hidden = isAuthMode;
  }

  if (authRoot) {
    authRoot.hidden = !isAuthMode;
  }
}

function handleLogout() {
  clearStoredAuthKeys();
  clearSessionUser();
  window.EduKidsCurrentUser = null;

  const authRoot = getAuthContainer();

  if (authRoot) {
    authRoot.removeAttribute("data-rendered-mode");
    authRoot.innerHTML = "";
  }

  bootstrapState.currentUser = null;
  bootstrapState.initializedUid = null;
  bootstrapState.authMode = "login";
  setAuthMode(true);
  renderAuthScreen("login");
}

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
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeAuthUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeAuthRole(role) {
  return role === "teacher" ? "teacher" : "student";
}

function buildAuthEmail(username, role) {
  const safeUsername = normalizeAuthUsername(username).replace(
    /[^a-z0-9._-]/g,
    "",
  );
  const safeRole = normalizeAuthRole(role);

  return `${safeRole}+${safeUsername || "account"}@${AUTH_EMAIL_DOMAIN}`;
}

function getAuthIdentityFromEmail(email) {
  const localPart = String(email || "")
    .trim()
    .split("@")[0];
  const [rolePart, ...usernameParts] = localPart.split("+");

  return {
    role: normalizeAuthRole(rolePart),
    username: usernameParts.join("+") || rolePart || "",
  };
}

const authDrafts = {
  login: {
    username: "",
    password: "",
    role: "student",
  },
  register: {
    name: "",
    username: "",
    password: "",
    confirmPassword: "",
    role: "student",
    gender: "male",
    className: "",
    school: "",
  },
};

function renderAuthBrand() {
  return `
    <div class="auth-brand">
      <img src="assets/robot.png" alt="EduKids" class="auth-brand-icon" />
      <div class="auth-brand-name">EduKids</div>
    </div>
  `;
}

function renderChoiceGroup({ name, label, options, selectedValue }) {
  return `
    <div class="auth-field" data-field="${name}">
      <label class="auth-field-label">${escapeHtml(label)}</label>
      <div class="auth-choice-group" role="group" aria-label="${escapeHtml(
        label,
      )}">
        <input type="hidden" name="${name}" value="${escapeHtml(
          selectedValue,
        )}" />
        ${options
          .map((option) => {
            const isSelected = option.value === selectedValue;

            return `
              <button
                type="button"
                class="auth-choice-btn ${isSelected ? "is-selected" : ""}"
                data-choice-group="${name}"
                data-choice-value="${option.value}"
                aria-pressed="${isSelected}"
              >
                <span class="auth-choice-icon" aria-hidden="true">${option.icon}</span>
                <span>${escapeHtml(option.label)}</span>
              </button>
            `;
          })
          .join("")}
      </div>
      <div class="auth-field-error" data-error-for="${name}"></div>
    </div>
  `;
}

function renderTextField({
  id,
  name,
  label,
  placeholder,
  value = "",
  type = "text",
  autocomplete = "off",
}) {
  return `
    <div class="auth-field" data-field="${name}">
      <label class="auth-field-label" for="${id}">${escapeHtml(label)}</label>
      <div class="auth-input-wrap">
        <input
          id="${id}"
          class="auth-input"
          name="${name}"
          type="${type}"
          placeholder="${escapeHtml(placeholder)}"
          value="${escapeHtml(value)}"
          autocomplete="${autocomplete}"
        />
      </div>
      <div class="auth-field-error" data-error-for="${name}"></div>
    </div>
  `;
}

function renderPasswordField({
  id,
  name,
  label,
  placeholder,
  value = "",
  autocomplete = "current-password",
}) {
  return `
    <div class="auth-field" data-field="${name}">
      <label class="auth-field-label" for="${id}">${escapeHtml(label)}</label>
      <div class="auth-input-wrap">
        <input
          id="${id}"
          class="auth-input"
          name="${name}"
          type="password"
          placeholder="${escapeHtml(placeholder)}"
          value="${escapeHtml(value)}"
          autocomplete="${autocomplete}"
        />
        <button
          type="button"
          class="auth-password-toggle"
          data-password-toggle="${id}"
          aria-label="Hiá»‡n máº­t kháº©u"
          aria-pressed="false"
        >
          <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
            <path
              d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linejoin="round"
            />
            <circle
              cx="12"
              cy="12"
              r="2.8"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
            />
          </svg>
        </button>
      </div>
      <div class="auth-field-error" data-error-for="${name}"></div>
    </div>
  `;
}

function renderAuthFeedback() {
  return `
    <div class="auth-feedback" id="auth-feedback" aria-live="polite"></div>
  `;
}

function renderLoginScreen() {
  const draft = authDrafts.login;

  return `
    <section class="auth-shell">
      <div class="auth-stage">
        <div class="auth-badge">ÄÄ‚NG NHáº¬P</div>
        <div class="auth-card">
          ${renderAuthBrand()}

          <form class="auth-form" id="auth-form" data-view="login" novalidate>
            ${renderTextField({
              id: "login-username",
              name: "username",
              label: "TĂªn Ä‘Äƒng nháº­p",
              placeholder: "Nháº­p tĂªn Ä‘Äƒng nháº­p",
              value: draft.username,
              autocomplete: "username",
            })}
            ${renderPasswordField({
              id: "login-password",
              name: "password",
              label: "Máº­t kháº©u",
              placeholder: "Nháº­p máº­t kháº©u",
              value: draft.password,
              autocomplete: "current-password",
            })}

            <div class="auth-help-row">
              <button type="button" class="auth-link-button" data-forgot-password>
                QuĂªn máº­t kháº©u
              </button>
            </div>

            ${renderChoiceGroup({
              name: "role",
              label: "Vai trĂ²",
              selectedValue: draft.role,
              options: [
                { value: "student", label: "Há»c sinh", icon: "đŸ‘¤" },
                { value: "teacher", label: "GiĂ¡o viĂªn", icon: "đŸ‘©â€đŸ«" },
              ],
            })}

            ${renderAuthFeedback()}

            <button type="submit" class="auth-submit-button">ÄÄƒng nháº­p</button>

            <p class="auth-switch">
              ChÆ°a cĂ³ tĂ i khoáº£n?
              <button
                type="button"
                class="auth-link-button"
                data-auth-switch="register"
              >
                ÄÄƒng kĂ½ ngay
              </button>
            </p>
          </form>
        </div>
      </div>
    </section>
  `;
}

function renderRegisterScreen() {
  const draft = authDrafts.register;

  return `
    <section class="auth-shell">
      <div class="auth-stage">
        <div class="auth-badge">ÄÄ‚NG KĂ</div>
        <div class="auth-card">
          ${renderAuthBrand()}

          <form class="auth-form" id="auth-form" data-view="register" novalidate>
            ${renderTextField({
              id: "register-name",
              name: "name",
              label: "Há» vĂ  tĂªn",
              placeholder: "Nháº­p há» vĂ  tĂªn",
              value: draft.name,
              autocomplete: "name",
            })}
            ${renderTextField({
              id: "register-username",
              name: "username",
              label: "TĂªn Ä‘Äƒng nháº­p",
              placeholder: "Nháº­p tĂªn Ä‘Äƒng nháº­p",
              value: draft.username,
              autocomplete: "username",
            })}
            ${renderPasswordField({
              id: "register-password",
              name: "password",
              label: "Máº­t kháº©u",
              placeholder: "Nháº­p máº­t kháº©u",
              value: draft.password,
              autocomplete: "new-password",
            })}
            ${renderPasswordField({
              id: "register-confirm-password",
              name: "confirmPassword",
              label: "XĂ¡c nháº­n máº­t kháº©u",
              placeholder: "Nháº­p láº¡i máº­t kháº©u",
              value: draft.confirmPassword,
              autocomplete: "new-password",
            })}

            ${renderChoiceGroup({
              name: "role",
              label: "Vai trĂ²",
              selectedValue: draft.role,
              options: [
                { value: "student", label: "Há»c sinh", icon: "đŸ‘¤" },
                { value: "teacher", label: "GiĂ¡o viĂªn", icon: "đŸ‘©â€đŸ«" },
              ],
            })}

            ${renderChoiceGroup({
              name: "gender",
              label: "Giá»›i tĂ­nh",
              selectedValue: draft.gender,
              options: [
                { value: "male", label: "Nam", icon: "â™‚" },
                { value: "female", label: "Ná»¯", icon: "â™€" },
              ],
            })}

            ${renderTextField({
              id: "register-class",
              name: "className",
              label: "Lá»›p (náº¿u lĂ  há»c sinh)",
              placeholder: "Chá»n lá»›p",
              value: draft.className,
              autocomplete: "off",
            })}
            ${renderTextField({
              id: "register-school",
              name: "school",
              label: "Trường",
              placeholder: "Nhập tên trường",
              value: draft.school,
              autocomplete: "organization",
            })}

            ${renderAuthFeedback()}

            <button type="submit" class="auth-submit-button">Tạo tài khoản</button>

            <p class="auth-switch">
              Đã có tài khoản?
              <button
                type="button"
                class="auth-link-button"
                data-auth-switch="login"
              >
                Đăng nhập
              </button>
            </p>
          </form>
        </div>
      </div>
    </section>
  `;
}

function setFieldError(form, fieldName, message) {
  const field = form.querySelector(`[data-field="${fieldName}"]`);
  const error = form.querySelector(`[data-error-for="${fieldName}"]`);

  if (field) {
    field.classList.toggle("has-error", Boolean(message));
  }

  if (error) {
    error.textContent = message || "";
  }
}

function clearFormErrors(form) {
  form.querySelectorAll("[data-field]").forEach((field) => {
    field.classList.remove("has-error");
  });

  form.querySelectorAll("[data-error-for]").forEach((error) => {
    error.textContent = "";
  });

  const feedback = form.querySelector("#auth-feedback");

  if (feedback) {
    feedback.className = "auth-feedback";
    feedback.textContent = "";
  }
}

function setFeedbackMessage(form, message, type) {
  const feedback = form.querySelector("#auth-feedback");

  if (!feedback) {
    return;
  }

  feedback.className = `auth-feedback is-visible is-${type}`;
  feedback.textContent = message;
}

function updateAuthDraft(view, fieldName, value) {
  if (authDrafts[view]) {
    authDrafts[view][fieldName] = value;
  }
}

function setSelectedChoice(form, groupName, value) {
  const hiddenInput = form.querySelector(
    `input[type="hidden"][name="${groupName}"]`,
  );

  if (hiddenInput) {
    hiddenInput.value = value;
  }

  form
    .querySelectorAll(`[data-choice-group="${groupName}"]`)
    .forEach((button) => {
      const isSelected = button.dataset.choiceValue === value;

      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    });

  const view = form.dataset.view;

  updateAuthDraft(view, groupName, value);
  setFieldError(form, groupName, "");
}

function togglePasswordVisibility(button) {
  const targetId = button.dataset.passwordToggle;
  const input = document.getElementById(targetId);

  if (!input) {
    return;
  }

  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  button.setAttribute(
    "aria-label",
    isPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu",
  );
  button.setAttribute("aria-pressed", String(isPassword));
  button.innerHTML = isPassword
    ? `
      <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
        <path
          d="M3.5 4.5 20.5 19.5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        />
        <path
          d="M9.2 9.2A3.75 3.75 0 0 1 14.8 14.8"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        />
        <path
          d="M10.8 4.9C11.2 4.8 11.6 4.75 12 4.75c5.9 0 9.5 5.85 9.5 7.25 0 .57-1.05 2.4-2.9 4.03"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        />
        <path
          d="M8.2 6.3C4.9 8.05 2.5 11.27 2.5 12c0 1.4 3.6 7.25 9.5 7.25 1.1 0 2.1-.15 3.02-.42"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        />
      </svg>
    `
    : `
      <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
        <path
          d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6Z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linejoin="round"
        />
        <circle
          cx="12"
          cy="12"
          r="2.8"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
        />
      </svg>
    `;
}

function renderAuthScreen(view = "login") {
  const normalizedView = view === "register" ? "register" : "login";
  bootstrapState.authMode = normalizedView;

  const authRoot = getAuthRoot();

  if (!authRoot) {
    return;
  }

  const renderKey = bootstrapState.authMode;

  if (authRoot.dataset.renderedMode === renderKey) {
    return;
  }

  authRoot.innerHTML =
    renderKey === "login" ? renderLoginScreen() : renderRegisterScreen();
  authRoot.dataset.renderedMode = renderKey;
  bindAuthRootEventsOnce();
}

function renderAuthView(view = bootstrapState.authMode) {
  renderAuthScreen(view);
}

function bindAuthRootEventsOnce() {
  const authRoot = getAuthRoot();

  if (!authRoot || bootstrapState.authRootBound) {
    return;
  }

  authRoot.addEventListener("click", (event) => {
    const switchButton = event.target.closest("[data-auth-switch]");
    if (switchButton) {
      const nextMode = switchButton.dataset.authSwitch;
      if (nextMode === "login" || nextMode === "register") {
        authRoot.removeAttribute("data-rendered-mode");
        renderAuthScreen(nextMode);
      }
      return;
    }

    const passwordToggle = event.target.closest("[data-password-toggle]");
    if (passwordToggle) {
      togglePasswordVisibility(passwordToggle);
      return;
    }

    const choiceButton = event.target.closest("[data-choice-group]");

    if (choiceButton) {
      const form = choiceButton.closest("form");

      if (!form) {
        return;
      }

      setSelectedChoice(
        form,
        choiceButton.dataset.choiceGroup,
        choiceButton.dataset.choiceValue,
      );
    }
  });

  authRoot.addEventListener("input", (event) => {
    const input = event.target;

    if (!(input instanceof HTMLInputElement) || !input.matches(".auth-input")) {
      return;
    }

    const form = input.closest("form");

    if (!form) {
      return;
    }

    updateAuthDraft(form.dataset.view, input.name, input.value);
    setFieldError(form, input.name, "");
  });

  authRoot.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "auth-form") {
      return;
    }

    event.preventDefault();
    clearFormErrors(form);

    const view = form.dataset.view;

    if (view === "login") {
      handleLoginSubmit(form).catch((error) => {
        console.error("[EduKids][auth] login handler failed", error);
      });
      return;
    }

    handleRegisterSubmit(form).catch((error) => {
      console.error("[EduKids][auth] register handler failed", error);
    });
  });

  bootstrapState.authRootBound = true;
}

async function handleLoginSubmit(form) {
  const username = form.elements.username?.value.trim();
  const password = form.elements.password?.value;
  const role = form.elements.role?.value;
  let hasError = false;

  if (!username) {
    setFieldError(form, "username", "Vui lòng nhập tên đăng nhập.");
    hasError = true;
  }

  if (!password) {
    setFieldError(form, "password", "Vui lòng nhập mật khẩu.");
    hasError = true;
  }

  if (!role) {
    setFieldError(form, "role", "Vui lòng chọn vai trò.");
    hasError = true;
  }

  if (hasError) {
    setFeedbackMessage(
      form,
      "Vui lòng trả lời các thông tin đăng nhập.",
      "error",
    );
    return;
  }

  try {
    setFeedbackMessage(form, "Đang đăng nhập...", "success");

    const result = await apiRequest("/api/auth/login", {
      username,
      password,
      role,
    });

    const authUser = result.data?.user;
    const token = result.data?.token;

    if (!authUser) {
      throw new Error("Thiếu dữ liệu người dùng từ server");
    }

    if (normalizeRole(authUser.role) !== normalizeRole(role)) {
      setFieldError(form, "role", "Vai trò chưa khớp với tài khoản.");
      setFeedbackMessage(
        form,
        "Đăng nhập thất bại, vui lòng thử lại.",
        "error",
      );
      return;
    }

    saveAuthSession(authUser, token);

    authDrafts.login.password = "";
    authDrafts.login.username = username;
    authDrafts.login.role = role;

    setFeedbackMessage(
      form,
      "Đăng nhập thành công. Đang chuyển vào hệ thống",
      "success",
    );

    setTimeout(() => {
      const authRoot = getAuthContainer();
      if (authRoot) {
        authRoot.removeAttribute("data-rendered-mode");
        authRoot.innerHTML = "";
      }

      setAuthMode(false);
      initApp(authUser);
      changePage(getDefaultPageForRole(authUser.role));
    }, 250);
  } catch (error) {
    console.error("[EduKids][auth] login failed", error);

    setFeedbackMessage(
      form,
      error.message || "Đăng nhập thất bại, vui lòng thử lại.",
      "error",
    );
  }
}

async function handleRegisterSubmit(form) {
  const name = form.elements.name?.value.trim();
  const username = form.elements.username?.value.trim();
  const password = form.elements.password?.value;
  const confirmPassword = form.elements.confirmPassword?.value;
  const role = form.elements.role?.value;
  const gender = form.elements.gender?.value;
  const className = form.elements.className?.value.trim();
  const school = form.elements.school?.value.trim();

  let hasError = false;

  if (!name) {
    setFieldError(form, "name", "Vui lòng nhập họ và tên.");
    hasError = true;
  }

  if (!username) {
    setFieldError(form, "username", "Vui lòng nhập tên đăng nhập.");
    hasError = true;
  } else if (username.length < 3) {
    setFieldError(form, "username", "Tên đăng nhập phải có ít nhất 3 kí tự.");
    hasError = true;
  } else if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    setFieldError(
      form,
      "username",
      "Tên đăng nhập chỉ được gồm chữ, số và kí tự . _ -",
    );
    hasError = true;
  }

  if (!password) {
    setFieldError(form, "password", "Vui lòng nhập mật khẩu.");
    hasError = true;
  } else if (password.length < 6) {
    setFieldError(form, "password", "Mật khẩu phải có ít nhất 6 kí tự.");
    hasError = true;
  }

  if (!confirmPassword) {
    setFieldError(form, "confirmPassword", "Vui lòng xác nhận mật khẩu.");
    hasError = true;
  } else if (confirmPassword !== password) {
    setFieldError(form, "confirmPassword", "Mật khẩu không khớp.");
    hasError = true;
  }

  if (!role) {
    setFieldError(form, "role", "Vui lòng chọn vai trò.");
    hasError = true;
  }

  if (!gender) {
    setFieldError(form, "gender", "Vui lòng chọn giới tính.");
    hasError = true;
  }

  if (role === "student" && !className) {
    setFieldError(form, "className", "Vui lòng chọn lớp.");
    hasError = true;
  }

  if (!school) {
    setFieldError(form, "school", "Vui lòng nhập tên trường.");
    hasError = true;
  }

  if (hasError) {
    setFeedbackMessage(
      form,
      "Vui lòng kiểm tra lại các trường còn thiếu.",
      "error",
    );
    return;
  }

  try {
    setFeedbackMessage(form, "Đang đăng k?...", "success");

    await apiRequest("/api/auth/register", {
      username,
      password,
      role,
      fullName: name,
      gender,
      school,
      className,
    });

    authDrafts.login.username = username;
    authDrafts.login.role = role;
    authDrafts.login.password = "";
    authDrafts.register.password = "";
    authDrafts.register.confirmPassword = "";

    setFeedbackMessage(
      form,
      "Đăng kí thành công, chuyển sang màn hình đăng nhập...",
      "success",
    );

    setTimeout(() => {
      const authRoot = getAuthRoot();
      if (authRoot) {
        authRoot.removeAttribute("data-rendered-mode");
      }
      renderAuthScreen("login");
    }, 250);
  } catch (error) {
    console.error("[EduKids][auth] register failed", error);

    setFeedbackMessage(
      form,
      error.message || "Đăng kí thất bại. Vui lòng thử lại.",
      "error",
    );
  }
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
      handleLogout();
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

  const identityKey = String(
    user.uid || user.userId || user.id || user.username || user.email || "",
  ).trim();

  if (bootstrapState.initializedUid === identityKey) {
    return;
  }

  bootstrapState.initializedUid = identityKey;
  bootstrapState.currentUser = user;

  bindAppEventsOnce();
  showPage(getDefaultPageForRole(user.role));
  window.EduKidsCurrentUser = user;
}

function initializeAuth() {
  const sessionUser = getCurrentAuthUser();
  const role = normalizeRole(sessionUser?.role);
  const appShell = getAppShell();
  const authRoot = getAuthRoot();

  if (sessionUser && role) {
    bootstrapState.currentUser = sessionUser;
    setAuthMode(false);
    initApp(sessionUser);
    changePage(getDefaultPageForRole(role));
    return;
  }

  bootstrapState.currentUser = null;
  bootstrapState.initializedUid = null;
  setAuthMode(true);

  if (appShell) {
    appShell.hidden = true;
  }

  if (authRoot) {
    authRoot.removeAttribute("data-rendered-mode");
  }

  renderAuthScreen("login");
}

function syncAuthState() {
  const sessionUser = getCurrentAuthUser();
  const role = normalizeRole(sessionUser?.role);

  if (sessionUser && role) {
    bootstrapState.currentUser = sessionUser;
    setAuthMode(false);
    initApp(sessionUser);
    changePage(getDefaultPageForRole(role));
    return;
  }

  bootstrapState.currentUser = null;
  bootstrapState.initializedUid = null;
  bootstrapState.authMode = "login";
  setAuthMode(true);

  const authRoot = getAuthRoot();
  if (authRoot) {
    authRoot.removeAttribute("data-rendered-mode");
  }

  renderAuthScreen("login");
}

function installCompatibilityGlobals() {
  window.checkAuth = () => getCurrentAuthUser();
  window.renderLogin = () => {
    const authRoot = getAuthRoot();
    if (authRoot) {
      authRoot.removeAttribute("data-rendered-mode");
    }
    renderAuthView("login");
    return getAuthRoot()?.innerHTML || "";
  };
  window.renderRegister = () => {
    const authRoot = getAuthRoot();
    if (authRoot) {
      authRoot.removeAttribute("data-rendered-mode");
    }
    renderAuthView("register");
    return getAuthRoot()?.innerHTML || "";
  };
  window.initApp = initApp;
  window.showAssignmentTab = showAssignmentTab;
  window.askAI = () => {
    console.info("[EduKids] AI Coach action triggered.");
  };
  window.EduKidsApi = {
    request: apiRequest,
    requestWithAuth: apiRequestWithAuth,
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

  installCompatibilityGlobals();
  initializeAuth();
}

void whenDomReady().then(bootstrap);
