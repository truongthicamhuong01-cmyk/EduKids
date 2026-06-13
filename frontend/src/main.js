import "./config.js";
import "./firebase-init.js";
import "./services/profileService.js";
import "./services/assignmentService.js";
import "./style.css";

const bootstrapState = (window.__EDUKIDS_BOOTSTRAP__ ||= {
  appBound: false,
  authRootBound: false,
  authMode: "login",
  pendingRegisterFlow: false,
  currentUser: null,
  initializedUid: null,
  listenerReady: false,
});

const AUTH_EMAIL_DOMAIN = "edukids.local";

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

function renderAuthViewLegacy() {
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

function bindAuthRootEventsOnceLegacy() {
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
          aria-label="Hiện mật khẩu"
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
        <div class="auth-badge">ĐĂNG NHẬP</div>
        <div class="auth-card">
          ${renderAuthBrand()}

          <form class="auth-form" id="auth-form" data-view="login" novalidate>
            ${renderTextField({
              id: "login-username",
              name: "username",
              label: "Tên đăng nhập",
              placeholder: "Nhập tên đăng nhập",
              value: draft.username,
              autocomplete: "username",
            })}
            ${renderPasswordField({
              id: "login-password",
              name: "password",
              label: "Mật khẩu",
              placeholder: "Nhập mật khẩu",
              value: draft.password,
              autocomplete: "current-password",
            })}

            <div class="auth-help-row">
              <button type="button" class="auth-link-button" data-forgot-password>
                Quên mật khẩu
              </button>
            </div>

            ${renderChoiceGroup({
              name: "role",
              label: "Vai trò",
              selectedValue: draft.role,
              options: [
                { value: "student", label: "Học sinh", icon: "👤" },
                { value: "teacher", label: "Giáo viên", icon: "👩‍🏫" },
              ],
            })}

            ${renderAuthFeedback()}

            <button type="submit" class="auth-submit-button">Đăng nhập</button>

            <p class="auth-switch">
              Chưa có tài khoản?
              <button
                type="button"
                class="auth-link-button"
                data-auth-switch="register"
              >
                Đăng ký ngay
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
        <div class="auth-badge">ĐĂNG KÝ</div>
        <div class="auth-card">
          ${renderAuthBrand()}

          <form class="auth-form" id="auth-form" data-view="register" novalidate>
            ${renderTextField({
              id: "register-name",
              name: "name",
              label: "Họ và tên",
              placeholder: "Nhập họ và tên",
              value: draft.name,
              autocomplete: "name",
            })}
            ${renderTextField({
              id: "register-username",
              name: "username",
              label: "Tên đăng nhập",
              placeholder: "Nhập tên đăng nhập",
              value: draft.username,
              autocomplete: "username",
            })}
            ${renderPasswordField({
              id: "register-password",
              name: "password",
              label: "Mật khẩu",
              placeholder: "Nhập mật khẩu",
              value: draft.password,
              autocomplete: "new-password",
            })}
            ${renderPasswordField({
              id: "register-confirm-password",
              name: "confirmPassword",
              label: "Xác nhận mật khẩu",
              placeholder: "Nhập lại mật khẩu",
              value: draft.confirmPassword,
              autocomplete: "new-password",
            })}

            ${renderChoiceGroup({
              name: "role",
              label: "Vai trò",
              selectedValue: draft.role,
              options: [
                { value: "student", label: "Học sinh", icon: "👤" },
                { value: "teacher", label: "Giáo viên", icon: "👩‍🏫" },
              ],
            })}

            ${renderChoiceGroup({
              name: "gender",
              label: "Giới tính",
              selectedValue: draft.gender,
              options: [
                { value: "male", label: "Nam", icon: "♂" },
                { value: "female", label: "Nữ", icon: "♀" },
              ],
            })}

            ${renderTextField({
              id: "register-class",
              name: "className",
              label: "Lớp (nếu là học sinh)",
              placeholder: "Chọn lớp",
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
  button.setAttribute("aria-label", isPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu");
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
      "Vui lòng kiểm tra lại các thông tin đã nhập.",
      "error",
    );
    return;
  }

  const auth = getFirebaseAuth();

  if (!auth) {
    setFeedbackMessage(
      form,
      "Firebase Auth chưa sẵn sàng. Vui lòng tải lại trang.",
      "error",
    );
    return;
  }

  try {
    setFeedbackMessage(form, "Đang đăng nhập...", "success");

    await auth.signInWithEmailAndPassword(
      buildAuthEmail(username, role),
      password,
    );

    authDrafts.login.password = "";
    authDrafts.login.username = username;
  } catch (error) {
    console.error("[EduKids][auth] login failed", error);

    setFeedbackMessage(
      form,
      error.message || "Đăng nhập thất bại. Vui lòng thử lại.",
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
    setFieldError(form, "username", "Tên đăng nhập phải có ít nhất 3 ký tự.");
    hasError = true;
  } else if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    setFieldError(
      form,
      "username",
      "Tên đăng nhập chỉ được gồm chữ, số và ký tự . _ -",
    );
    hasError = true;
  }

  if (!password) {
    setFieldError(form, "password", "Vui lòng nhập mật khẩu.");
    hasError = true;
  } else if (password.length < 6) {
    setFieldError(form, "password", "Mật khẩu phải có ít nhất 6 ký tự.");
    hasError = true;
  }

  if (!confirmPassword) {
    setFieldError(form, "confirmPassword", "Vui lòng xác nhận mật khẩu.");
    hasError = true;
  } else if (confirmPassword !== password) {
    setFieldError(form, "confirmPassword", "Mật khẩu xác nhận không khớp.");
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
    setFeedbackMessage(form, "Vui lòng kiểm tra lại các trường bị lỗi.", "error");
    return;
  }

  const auth = getFirebaseAuth();

  if (!auth) {
    setFeedbackMessage(
      form,
      "Firebase Auth chưa sẵn sàng. Vui lòng tải lại trang.",
      "error",
    );
    return;
  }

  bootstrapState.pendingRegisterFlow = true;

  try {
    setFeedbackMessage(form, "Đang đăng ký...", "success");

    const credential = await auth.createUserWithEmailAndPassword(
      buildAuthEmail(username, role),
      password,
    );

    if (credential?.user?.updateProfile) {
      await credential.user.updateProfile({ displayName: name });
    }

    authDrafts.login.username = username;
    authDrafts.login.role = role;
    authDrafts.login.password = "";
    authDrafts.register.password = "";
    authDrafts.register.confirmPassword = "";

    try {
      await auth.signOut();
    } catch (error) {
      console.warn("[EduKids][auth] signOut after register failed", error);
    }

    bootstrapState.pendingRegisterFlow = false;

    setFeedbackMessage(
      form,
      "Đăng ký thành công. Chuyển sang màn đăng nhập...",
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
    bootstrapState.pendingRegisterFlow = false;

    console.error("[EduKids][auth] register failed", error);

    setFeedbackMessage(
      form,
      error.message || "Đăng ký thất bại. Vui lòng thử lại.",
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

  if (bootstrapState.pendingRegisterFlow) {
    if (user) {
      return;
    }

    bootstrapState.pendingRegisterFlow = false;
  }

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
