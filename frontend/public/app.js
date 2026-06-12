// ======================
// PAGE ROUTER
import "./config.js";

// ======================

let previousPage = "student-home";
let currentPage = "student-home";
const menuItems = document.querySelectorAll(".menu-item");

const pages = document.querySelectorAll(".page");
const mobileMenuToggle = document.querySelector("[data-mobile-menu-toggle]");
const sidebarBackdrop = document.querySelector("[data-sidebar-backdrop]");
const installAppButtons = document.querySelectorAll("[data-install-app-btn]");
const mobileViewport = window.matchMedia("(max-width: 767px)");

let deferredInstallPrompt = null;
let isSidebarDrawerOpen = false;

menuItems.forEach((item) => {
  item.addEventListener("click", () => {
    const pageId = item.dataset.page;

    changePage(pageId);
  });
});

function changePage(pageId) {
  const role = getCurrentRole();
  const targetPageId = resolvePageForRole(pageId, role);

  previousPage = currentPage;
  currentPage = targetPageId;
  pages.forEach((page) => {
    page.classList.remove("active");
  });

  menuItems.forEach((item) => {
    item.classList.remove("active");
  });

  document.getElementById(targetPageId)?.classList.add("active");

  document
    .querySelector(`[data-page="${targetPageId}"]`)
    ?.classList.add("active");

  applyRoleVisibility(role);
  closeSidebarDrawer();
}

function isMobileLayout() {
  return mobileViewport.matches;
}

function setSidebarDrawer(open) {
  const shouldOpen = Boolean(open) && isMobileLayout();

  isSidebarDrawerOpen = shouldOpen;

  document.body.classList.toggle("sidebar-open", shouldOpen);
  mobileMenuToggle?.setAttribute("aria-expanded", String(shouldOpen));

  if (sidebarBackdrop) {
    sidebarBackdrop.hidden = !shouldOpen;
  }

  const sidebar = document.querySelector(".sidebar");

  if (sidebar) {
    sidebar.setAttribute(
      "aria-hidden",
      String(isMobileLayout() ? !shouldOpen : false),
    );
  }
}

function openSidebarDrawer() {
  setSidebarDrawer(true);
}

function closeSidebarDrawer() {
  setSidebarDrawer(false);
}

function syncSidebarDrawerState() {
  if (!isMobileLayout()) {
    closeSidebarDrawer();
    return;
  }

  setSidebarDrawer(isSidebarDrawerOpen);
}

// ======================
// TOAST
// ======================

function showToast(message, type = "success") {
  const toast = document.createElement("div");

  toast.className = `toast ${type}`;

  toast.innerHTML = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  setTimeout(() => {
    toast.classList.remove("show");

    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// ======================
// MODAL
// ======================

function createModal(title, content) {
  const modal = document.createElement("div");

  modal.className = "modal-overlay";

  modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">

                <h3>${title}</h3>

                <button class="close-btn">
                    ×
                </button>

            </div>

            <div class="modal-content">
                ${content}
            </div>

        </div>
    `;

  document.body.appendChild(modal);

  modal.querySelector(".close-btn").addEventListener("click", () => {
    modal.remove();
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  return modal;
}

// ======================
// AUTH STATE + RENDERING
// ======================

const AUTH_SESSION_KEY = "edukids-current-user";
const AUTH_ACCOUNTS_KEY = "edukids-mock-accounts";
const AUTH_CLEAR_KEYS = [
  "token",
  "authToken",
  "user",
  "currentUser",
  AUTH_SESSION_KEY,
];
const API_BASE_URL =
  window.EduKidsConfig?.apiBaseUrl || window.EDUKIDS_API_BASE_URL;
const ROLE_DEFAULT_PAGES = {
  student: "student-home",
  teacher: "teacher-dashboard",
};

const ROLE_ALLOWED_PAGES = {
  student: new Set([
    "student-home",
    "ai-coach",
    "ai-math",
    "ai-english",
    "subjects",
    "assignments",
    "missions",
    "progress",
    "profile",
  ]),
  teacher: new Set([
    "teacher-dashboard",
    "classroom",
    "create-assignment",
    "create-ai",
    "create-manual",
    "manage",
    "stats",
    "teacher-profile",
  ]),
};

const seedMockAccounts = [
  {
    id: 1,
    name: "nguyễn văn A",
    username: "ngva123",
    password: "123456",
    role: "student",
    gender: "male",
  },
  {
    id: 2,
    name: "Trần Thị B",
    username: "trantb234",
    password: "123456",
    role: "teacher",
    gender: "female",
  },
];

function cloneAccount(account) {
  return { ...account };
}

function loadStoredAccounts() {
  try {
    const stored = localStorage.getItem(AUTH_ACCOUNTS_KEY);

    if (stored) {
      const parsed = JSON.parse(stored);

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn("không thể đọc mock accounts:", error);
  }

  return seedMockAccounts.map(cloneAccount);
}

let mockAccounts = loadStoredAccounts();

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

function persistMockAccounts() {
  localStorage.setItem(AUTH_ACCOUNTS_KEY, JSON.stringify(mockAccounts));
}

function loadSessionUser() {
  try {
    const stored = localStorage.getItem(AUTH_SESSION_KEY);

    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn("không thể đọc session:", error);
    return null;
  }
}

function setSessionUser(user) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
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

function getCurrentSidebarProfile() {
  const service = window.EduKidsProfileService;

  if (service?.getCurrentProfileSync) {
    const profile = service.getCurrentProfileSync();

    if (profile) {
      return profile;
    }
  }

  return getCurrentAuthUser();
}

function getSidebarAvatar(profile) {
  if (window.EduKidsProfileService?.getAvatarPathFromProfile) {
    return window.EduKidsProfileService.getAvatarPathFromProfile(profile);
  }

  if (profile?.avatar) {
    return profile.avatar.startsWith("assets/")
      ? profile.avatar
      : `assets/userAvatar/${profile.avatar}`;
  }

  const role = normalizeRole(profile?.role);
  const isFemale = profile?.gender === "female";

  if (role === "teacher") {
    return `assets/userAvatar/${isFemale ? "femaleteacher.png" : "maleteacher.png"}`;
  }

  return `assets/userAvatar/${isFemale ? "girl.png" : "boy.png"}`;
}

function syncAppHistory() {
  if (window.history?.replaceState) {
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  }
}

function resetClassroomAndAssignmentState() {
  classroomState = [];
  classroomStateError = "";
  classroomLoadPromise = null;
  setActiveClassroomId("", "resetClassroomAndAssignmentState");

  if (typeof classroomSyncUnsubscribe === "function") {
    classroomSyncUnsubscribe();
  }
  classroomSyncUnsubscribe = null;

  if (typeof classroomSyncUserUnsubscribe === "function") {
    classroomSyncUserUnsubscribe();
  }
  classroomSyncUserUnsubscribe = null;

  classroomSyncClassUnsubscribers.forEach((unsubscribe) => {
    if (typeof unsubscribe === "function") {
      unsubscribe();
    }
  });
  classroomSyncClassUnsubscribers = [];
  classroomSyncOwnerKey = "";
  classroomSyncClassIdsKey = "";

  studentAssignmentState.classes = [];
  studentAssignmentState.activeClassId = "";
  studentAssignmentState.assignments = [];
  studentAssignmentState.unsubscribe = null;
  studentAssignmentState.isLoading = false;
  studentAssignmentState.loadError = "";
  studentAssignmentState.assignmentError = "";

  if (typeof teacherAssignmentsUnsubscribe === "function") {
    teacherAssignmentsUnsubscribe();
  }
  teacherAssignmentsUnsubscribe = null;
  window.__edukidsTeacherAssignments = [];
}

function redirectToLogin() {
  resetClassroomAndAssignmentState();
  clearStoredAuthKeys();
  clearSessionUser();
  profileState.current = null;
  profileState.error = null;
  setSidebarCardsLoading(true);
  resetSidebarProfileCards();
  authDrafts.login.password = "";
  syncAppHistory();
  setAuthMode(true);
  renderAuthScreen("login");
}

async function syncSidebarProfile() {
  const profile = getCurrentSidebarProfile();

  if (!profile) {
    setSidebarCardsLoading(true);
    resetSidebarProfileCards();
    return;
  }

  applyRoleVisibility(profile.role);
  setSidebarCardsLoading(true);

  try {
    let resolvedProfile = profile;

    if (window.EduKidsProfileService?.fetchCurrentProfile) {
      resolvedProfile =
        await window.EduKidsProfileService.fetchCurrentProfile();
    }

    renderSidebarProfileCards(resolvedProfile || profile);
  } catch (error) {
    console.warn("Không thể đồng bộ sidebar user:", error);
    renderSidebarProfileCards(profile);
  }
}

function handleLogout() {
  redirectToLogin();
  showToast("Đã đăng xuất thành công.", "success");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

async function apiRequest(path, payload) {
  console.log(`[EduKids][auth] POST ${path}`, payload);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  console.log(`[EduKids][auth] RESPONSE ${path}`, response.status, data);

  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }

  return data;
}

async function apiRequestWithAuth(path, options = {}) {
  const token =
    localStorage.getItem("authToken") || localStorage.getItem("token");
  const method = options.method || "GET";
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body:
      options.body === undefined || options.body === null
        ? undefined
        : JSON.stringify(options.body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }

  return data;
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

function getAuthContainer() {
  return document.getElementById("auth-root");
}

function getAppShell() {
  return document.getElementById("app-shell");
}

function setAuthMode(isAuthMode) {
  document.body.classList.toggle("auth-mode", isAuthMode);

  const appShell = getAppShell();

  if (appShell) {
    appShell.hidden = isAuthMode;
  }
}

function normalizeRole(role) {
  if (role === "teacher") {
    return "teacher";
  }

  if (role === "student") {
    return "student";
  }

  return null;
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
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const decoded = atob(padded);

    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
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

  return null;
}

function getCurrentRole() {
  return normalizeRole(getCurrentAuthUser()?.role);
}

function getDefaultPageForRole(role) {
  return ROLE_DEFAULT_PAGES[normalizeRole(role)] || ROLE_DEFAULT_PAGES.student;
}

function isPageAllowedForRole(pageId, role) {
  const normalizedRole = normalizeRole(role);

  return Boolean(
    normalizedRole && ROLE_ALLOWED_PAGES[normalizedRole]?.has(pageId),
  );
}

function resolvePageForRole(pageId, role) {
  return isPageAllowedForRole(pageId, role)
    ? pageId
    : getDefaultPageForRole(role);
}

function applyRoleVisibility(role = getCurrentRole()) {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    return;
  }

  const allowedPages = ROLE_ALLOWED_PAGES[normalizedRole];
  const showStudentCard = normalizedRole === "student";
  const showTeacherCard = normalizedRole === "teacher";

  menuItems.forEach((item) => {
    if (!item.dataset.page) {
      return;
    }

    item.hidden = !allowedPages.has(item.dataset.page);
  });

  pages.forEach((page) => {
    page.hidden = !allowedPages.has(page.id);
  });

  document.querySelectorAll(".student-card").forEach((card) => {
    card.hidden = !showStudentCard;
  });

  document.querySelectorAll(".teacher-card").forEach((card) => {
    card.hidden = !showTeacherCard;
  });
}

function setSidebarCardsLoading(isLoading) {
  document.querySelectorAll("[data-sidebar-card]").forEach((card) => {
    card.setAttribute("aria-busy", String(isLoading));
    card.classList.toggle("is-loading", isLoading);
  });
}

function getSidebarDefaultAvatar(role, gender) {
  const normalizedRole = normalizeRole(role) || "student";
  const normalizedGender = gender === "female" ? "female" : "male";

  return `assets/userAvatar/${
    normalizedRole === "teacher"
      ? normalizedGender === "female"
        ? "femaleTeacher.png"
        : "maleTeacher.png"
      : normalizedGender === "female"
        ? "femaleStudent.png"
        : "maleStudent.png"
  }`;
}

function getSidebarAvatarPath(profile) {
  const service = window.EduKidsProfileService;

  if (service?.getAvatarPathFromProfile) {
    return service.getAvatarPathFromProfile(profile);
  }

  const avatar = String(profile?.avatar || profile?.photoURL || "").trim();

  if (avatar) {
    if (/^https?:\/\//i.test(avatar) || avatar.startsWith("data:")) {
      return avatar;
    }

    if (avatar.startsWith("assets/")) {
      return avatar;
    }

    return `assets/userAvatar/${avatar}`;
  }

  return getSidebarDefaultAvatar(profile?.role, profile?.gender);
}

function getSidebarUserData(profile) {
  const role = normalizeRole(profile?.role) || "student";
  const name =
    String(
      profile?.name ||
        profile?.fullName ||
        profile?.displayName ||
        profile?.username ||
        "Đang tải...",
    ).trim() || "Đang tải...";
  const code =
    String(
      profile?.userCode ||
        profile?.studentCode ||
        profile?.teacherCode ||
        profile?.code ||
        "--",
    ).trim() || "--";

  return {
    role,
    name,
    code,
    roleLabel: role === "teacher" ? "Giáo viên" : "Học sinh",
    avatar: getSidebarAvatarPath(profile),
  };
}

function resetSidebarProfileCards() {
  document.querySelectorAll("[data-sidebar-card]").forEach((card) => {
    const role = card.dataset.sidebarRole || card.dataset.card || "student";
    const avatar = card.querySelector("[data-sidebar-avatar]");
    const name = card.querySelector("[data-sidebar-name]");
    const roleLabel = card.querySelector("[data-sidebar-role-label]");

    if (avatar) {
      avatar.src =
        "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
      avatar.alt = "";
    }

    if (name) {
      name.textContent = "Đang tải...";
    }

    if (roleLabel) {
      roleLabel.textContent = role === "teacher" ? "Giáo viên" : "Học sinh";
    }
  });
}

function renderSidebarProfileCards(profile) {
  const userData = getSidebarUserData(profile);

  document.querySelectorAll("[data-sidebar-card]").forEach((card) => {
    const shouldShow = card.dataset.sidebarRole === userData.role;
    card.hidden = !shouldShow;

    if (!shouldShow) {
      return;
    }

    const avatar = card.querySelector("[data-sidebar-avatar]");
    const name = card.querySelector("[data-sidebar-name]");
    const roleLabel = card.querySelector("[data-sidebar-role-label]");

    if (avatar) {
      avatar.src = userData.avatar;
      avatar.alt = `${userData.roleLabel} ${userData.name}`;
    }

    if (name) {
      name.textContent = userData.name;
    }

    if (roleLabel) {
      roleLabel.textContent = userData.roleLabel;
    }

    card.setAttribute("aria-busy", "false");
    card.classList.remove("is-loading");
  });
}

function renderAuthIcon(type) {
  if (type === "student") {
    return "👤";
  }

  if (type === "teacher") {
    return "👩‍🏫";
  }

  if (type === "male") {
    return "♂";
  }

  return "♀";
}

function renderChoiceGroup({ name, label, options, selectedValue }) {
  return `
    <div class="auth-field" data-field="${name}">
      <label class="auth-field-label">${label}</label>
      <div class="auth-choice-group" role="group" aria-label="${escapeHtml(label)}">
        <input type="hidden" name="${name}" value="${escapeHtml(selectedValue)}" />
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
                <span>${option.label}</span>
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
      <label class="auth-field-label" for="${id}">${label}</label>
      <div class="auth-input-wrap">
        <input
          id="${id}"
          class="auth-input"
          name="${name}"
          type="${type}"
          placeholder="${placeholder}"
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
      <label class="auth-field-label" for="${id}">${label}</label>
      <div class="auth-input-wrap">
        <input
          id="${id}"
          class="auth-input"
          name="${name}"
          type="password"
          placeholder="${placeholder}"
          value="${escapeHtml(value)}"
          autocomplete="${autocomplete}"
        />
        <button
          type="button"
          class="auth-password-toggle"
          data-password-toggle="${id}"
          aria-label="Hi�!n mật khẩu"
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

function renderAuthBrand() {
  return `
    <div class="auth-brand">
      <img src="assets/robot.png" alt="EduKids" class="auth-brand-icon" />
      <div class="auth-brand-name">EduKids</div>
    </div>
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

function updateAuthDraft(view, fieldName, value) {
  if (authDrafts[view]) {
    authDrafts[view][fieldName] = value;
  }
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
    isPassword ? "Ẩn mật khẩu" : "Hi�!n mật khẩu",
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

function renderAuthScreen(view = "login", options = {}) {
  authView = view;

  const container = getAuthContainer();

  if (!container) {
    return;
  }

  if (view === "login" && options.username) {
    authDrafts.login.username = options.username;
  }

  container.innerHTML =
    view === "login" ? renderLoginScreen() : renderRegisterScreen();
  setAuthMode(true);
  attachAuthEvents();
}

function attachAuthEvents() {
  const container = getAuthContainer();

  if (!container || container.dataset.authBound === "true") {
    return;
  }

  container.dataset.authBound = "true";

  container.addEventListener("click", (event) => {
    const switchButton = event.target.closest("[data-auth-switch]");

    if (switchButton) {
      renderAuthScreen(switchButton.dataset.authSwitch);
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

  container.addEventListener("input", (event) => {
    const input = event.target;

    if (!input.matches(".auth-input")) {
      return;
    }

    const form = input.closest("form");

    if (!form) {
      return;
    }

    updateAuthDraft(form.dataset.view, input.name, input.value);
    setFieldError(form, input.name, "");
  });

  container.addEventListener("submit", (event) => {
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

    if (authUser.role !== role) {
      setFieldError(form, "role", "Vai trò chưa khớp với tài khoản.");
      setFeedbackMessage(
        form,
        "Đăng nhập thất bại. Vui lòng thử lại.",
        "error",
      );
      return;
    }

    saveAuthSession(authUser, token);

    authDrafts.login.password = "";
    authDrafts.login.username = username;

    setFeedbackMessage(
      form,
      "Đăng nhập thành công. Đang chuyển vào hệ thống...",
      "success",
    );

    showToast(
      `Đăng nhập thành công: <b>${escapeHtml(
        authUser.fullName || authUser.username,
      )}</b>`,
    );

    setTimeout(() => {
      setAuthMode(false);
      getAuthContainer().innerHTML = "";

      const targetPage =
        authUser.role === "teacher" ? "teacher-dashboard" : "student-home";

      changePage(targetPage);
    }, 250);
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
    setFeedbackMessage(
      form,
      "Vui lòng kiểm tra lại các trường bị lỗi.",
      "error",
    );
    return;
  }

  try {
    setFeedbackMessage(form, "Đang đăng ký...", "success");

    const result = await apiRequest("/api/auth/register", {
      username,
      password,
      role,
      fullName: name,
      gender,
      school,
      className,
    });

    console.log("[EduKids][auth] register success payload", result);

    authDrafts.login.username = username;
    authDrafts.login.role = role;
    authDrafts.login.password = "";
    authDrafts.register.password = "";
    authDrafts.register.confirmPassword = "";

    setFeedbackMessage(
      form,
      "Đăng ký thành công. Chuyển sang màn đăng nhập...",
      "success",
    );

    showToast(`Đăng ký thành công: <b>${escapeHtml(name)}</b>`);

    setTimeout(() => {
      renderAuthScreen("login", { username });
    }, 250);
  } catch (error) {
    console.error("[EduKids][auth] register failed", error);

    setFeedbackMessage(
      form,
      error.message || "Đăng ký thất bại. Vui lòng thử lại.",
      "error",
    );
  }
}

function initializeAuth() {
  const sessionUser = getCurrentAuthUser();
  const role = normalizeRole(sessionUser?.role);

  if (sessionUser && role) {
    setAuthMode(false);
    applyRoleVisibility(role);
    setSidebarCardsLoading(true);

    const targetPage = getDefaultPageForRole(role);

    changePage(targetPage);
    return;
  }

  renderAuthScreen("login");
}

function syncAuthState() {
  const sessionUser = getCurrentAuthUser();
  const role = normalizeRole(sessionUser?.role);

  if (sessionUser && role) {
    setAuthMode(false);
    applyRoleVisibility(role);
    setSidebarCardsLoading(true);

    const targetPage = getDefaultPageForRole(role);

    changePage(targetPage);
    return;
  }

  renderAuthScreen("login");
}

// ======================
// PROFILE DATA
// ======================

const profileState = {
  current: null,
  loading: false,
  error: null,
};

function getProfilePageType(pageId) {
  if (pageId === "profile") {
    return "student";
  }

  if (pageId === "teacher-profile") {
    return "teacher";
  }

  return null;
}

function formatDateTime(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatRoleLabel(role) {
  if (role === "teacher") {
    return "Giáo viên";
  }

  if (role === "student") {
    return "Học sinh";
  }

  return "--";
}

function formatGenderLabel(gender) {
  if (gender === "male") {
    return "Nam";
  }

  if (gender === "female") {
    return "Nữ";
  }

  return "--";
}

function formatStatValue(value) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  return String(value);
}

function getProfileAvatar(profile) {
  if (window.EduKidsProfileService?.getAvatarPathFromProfile) {
    return window.EduKidsProfileService.getAvatarPathFromProfile(profile);
  }

  if (profile?.avatar) {
    return profile.avatar.startsWith("assets/")
      ? profile.avatar
      : `assets/userAvatar/${profile.avatar}`;
  }

  if (profile?.role === "teacher") {
    return `assets/userAvatar/${profile?.gender === "female" ? "femaleteacher.png" : "maleteacher.png"}`;
  }

  return `assets/userAvatar/${profile?.gender === "female" ? "girl.png" : "boy.png"}`;
}

function setProfileLoadingState(pageType, isLoading) {
  const root = document.querySelector(`[data-profile-page="${pageType}"]`);

  if (!root) {
    return;
  }

  profileState.loading = isLoading;
  root.classList.toggle("is-loading", isLoading);
  root.setAttribute("aria-busy", String(isLoading));
}

function applyProfileSkeleton(pageType, isLoading) {
  const root = document.querySelector(`[data-profile-page="${pageType}"]`);

  if (!root) {
    return;
  }

  const selectors = [
    "img",
    "h2",
    ".student-profile-role",
    ".teacher-profile-role",
    "[id$='-profile-code']",
    "[id$='-profile-class']",
    "[id$='-profile-created-at']",
    "[id$='-profile-full-name']",
    "[id$='-profile-username']",
    "[id$='-profile-gender']",
    "[id$='-profile-role-detail']",
    "[id$='-profile-school']",
    "[id$='-profile-class-extra']",
    "[id$='-profile-hobby']",
    "[id$='-profile-dream']",
    "[id$='-profile-phone']",
    "[id$='-profile-address']",
    "[id$='-profile-note']",
    "[id$='-profile-level']",
    "[id$='-profile-streak']",
    "[id$='-profile-completed']",
    "[id$='-profile-study-minutes']",
    "[id$='-profile-total-classes']",
    "[id$='-profile-assignments-created']",
    "[id$='-profile-students-managed']",
    "[id$='-profile-average-score']",
  ];

  root.querySelectorAll(selectors.join(",")).forEach((node) => {
    if (isLoading) {
      node.classList.add("profile-skeleton");
    } else {
      node.classList.remove("profile-skeleton");
    }
  });

  root.querySelectorAll("[data-student-subject]").forEach((node) => {
    if (isLoading) {
      node.classList.add("profile-skeleton-bar");
    } else {
      node.classList.remove("profile-skeleton-bar");
    }
  });
}

function renderStudentSubjectProgress(profile) {
  const subjects = Array.isArray(profile?.subjects) ? profile.subjects : [];
  const subjectMap = new Map(
    subjects.map((subject) => [subject.name, Number(subject.progress) || 0]),
  );

  document.querySelectorAll("[data-student-subject]").forEach((node) => {
    const name = node.dataset.studentSubject;
    const progress = subjectMap.get(name) ?? 0;
    node.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
  });

  document
    .querySelectorAll("[data-student-subject-percent]")
    .forEach((node) => {
      const name = node.dataset.studentSubjectPercent;
      const progress = subjectMap.get(name) ?? 0;
      node.textContent = `${Math.max(0, Math.min(progress, 100))}%`;
    });
}

function renderStudentProfile(profile) {
  const avatar = document.getElementById("student-profile-avatar");
  const name = document.getElementById("student-profile-name");
  const role = document.getElementById("student-profile-role");
  const code = document.getElementById("student-profile-code");
  const className = document.getElementById("student-profile-class");
  const createdAt = document.getElementById("student-profile-created-at");
  const level = document.getElementById("student-profile-level");
  const streak = document.getElementById("student-profile-streak");
  const completed = document.getElementById("student-profile-completed");
  const studyMinutes = document.getElementById("student-profile-study-minutes");
  const fullName = document.getElementById("student-profile-full-name");
  const username = document.getElementById("student-profile-username");
  const gender = document.getElementById("student-profile-gender");
  const roleDetail = document.getElementById("student-profile-role-detail");
  const school = document.getElementById("student-profile-school");
  const classExtra = document.getElementById("student-profile-class-extra");
  const hobby = document.getElementById("student-profile-hobby");
  const dream = document.getElementById("student-profile-dream");

  if (avatar) {
    avatar.src = getProfileAvatar(profile);
  }

  if (name) name.textContent = profile?.name || profile?.fullName || "--";
  if (role) role.textContent = formatRoleLabel(profile?.role);
  if (code) code.textContent = profile?.userCode || "--";
  if (className) className.textContent = profile?.className || "--";
  if (createdAt) createdAt.textContent = formatDateTime(profile?.createdAt);
  if (level) level.textContent = formatStatValue(profile?.stats?.level);

  if (streak) {
    streak.innerHTML = `${formatStatValue(profile?.stats?.streak)} <span>ngày</span>`;
  }

  if (completed) {
    completed.innerHTML = `${formatStatValue(profile?.stats?.completedQuestions)} <span>câu hỏi</span>`;
  }

  if (studyMinutes) {
    studyMinutes.innerHTML = `${formatStatValue(profile?.stats?.studyMinutes)} <span>phút</span>`;
  }

  if (fullName)
    fullName.textContent = profile?.name || profile?.fullName || "--";

  if (username) username.textContent = profile?.username || "--";
  if (gender) gender.textContent = formatGenderLabel(profile?.gender);
  if (roleDetail) roleDetail.textContent = formatRoleLabel(profile?.role);
  if (school) school.textContent = profile?.school || "--";
  if (classExtra) classExtra.textContent = profile?.className || "--";
  if (hobby) hobby.textContent = profile?.hobby || "--";
  if (dream) dream.textContent = profile?.dream || "--";

  renderStudentSubjectProgress(profile);
}

function renderTeacherProfile(profile) {
  const avatar = document.getElementById("teacher-profile-avatar");
  const name = document.getElementById("teacher-profile-name");
  const role = document.getElementById("teacher-profile-role");
  const code = document.getElementById("teacher-profile-code");
  const school = document.getElementById("teacher-profile-school");
  const createdAt = document.getElementById("teacher-profile-created-at");
  const fullName = document.getElementById("teacher-profile-full-name");
  const username = document.getElementById("teacher-profile-username");
  const gender = document.getElementById("teacher-profile-gender");
  const roleDetail = document.getElementById("teacher-profile-role-detail");
  const phone = document.getElementById("teacher-profile-phone");
  const address = document.getElementById("teacher-profile-address");
  const note = document.getElementById("teacher-profile-note");
  const totalClasses = document.getElementById("teacher-profile-total-classes");
  const assignmentsCreated = document.getElementById(
    "teacher-profile-assignments-created",
  );
  const studentsManaged = document.getElementById(
    "teacher-profile-students-managed",
  );
  const averageScore = document.getElementById("teacher-profile-average-score");
  const extra = document.getElementById("teacher-profile-extra");
  const birthdate = document.getElementById("teacher-profile-birthdate");
  const email = document.getElementById("teacher-profile-email");
  const classTags = document.querySelectorAll("[data-teacher-class-tag]");

  if (avatar) {
    avatar.src = getProfileAvatar(profile);
  }
  if (name) name.textContent = profile?.name || profile?.fullName || "--";
  if (role) role.textContent = formatRoleLabel(profile?.role);
  if (code) code.textContent = profile?.userCode || "--";
  if (school) school.textContent = profile?.school || "--";
  if (createdAt) createdAt.textContent = formatDateTime(profile?.createdAt);
  if (fullName)
    fullName.textContent = profile?.name || profile?.fullName || "--";
  if (username) username.textContent = profile?.username || "--";
  if (gender) gender.textContent = formatGenderLabel(profile?.gender);
  if (roleDetail) roleDetail.textContent = formatRoleLabel(profile?.role);
  if (phone) phone.textContent = profile?.phone || "--";
  if (address) address.textContent = profile?.address || "--";
  if (note) note.textContent = profile?.note || "--";
  if (extra) extra.textContent = profile?.note || profile?.address || "--";
  if (birthdate) birthdate.textContent = formatDateTime(profile?.createdAt);
  if (email) email.textContent = profile?.email || "--";

  const stats = profile?.stats || {};
  if (totalClasses)
    totalClasses.textContent = formatStatValue(stats.totalClasses);
  if (assignmentsCreated)
    assignmentsCreated.textContent = formatStatValue(stats.assignmentsCreated);
  if (studentsManaged)
    studentsManaged.textContent = formatStatValue(stats.studentsManaged);
  if (averageScore)
    averageScore.textContent = formatStatValue(stats.averageScore);

  const tags =
    Array.isArray(profile?.classTags) && profile.classTags.length > 0
      ? profile.classTags
      : [];

  if (classTags.length > 0) {
    classTags.forEach((tag, index) => {
      tag.textContent = tags[index] || tags[0] || "--";
    });
  }
}

function updateSidebarProfileCards(profile) {
  const studentCard = document.querySelector(".student-card");
  const teacherCard = document.querySelector(".teacher-card");
  const avatar = getSidebarAvatar(profile);
  const name = profile?.name || profile?.fullName || "--";
  const roleLabel = formatRoleLabel(profile?.role);
  const userCode = profile?.userCode || "--";

  if (studentCard) {
    const studentAvatar = studentCard.querySelector("img");
    const studentName = studentCard.querySelector(".student-card-info h4");
    const studentMeta = studentCard.querySelector(".student-card-info p");

    if (studentAvatar) {
      studentAvatar.src =
        profile?.role === "student"
          ? avatar
          : "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
      studentAvatar.alt = `${roleLabel} avatar`;
    }

    if (studentName) {
      studentName.textContent =
        profile?.role === "student" ? name : "Đang tải...";
    }

    if (studentMeta) {
      studentMeta.textContent =
        profile?.role === "student" ? `${userCode} · Học sinh` : "Học sinh";
    }
  }

  if (teacherCard) {
    const teacherAvatar = teacherCard.querySelector("img");
    const teacherName = teacherCard.querySelector(".teacher-card-info h4");
    const teacherMeta = teacherCard.querySelector(".teacher-card-info p");

    if (teacherAvatar) {
      teacherAvatar.src =
        profile?.role === "teacher"
          ? avatar
          : "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
      teacherAvatar.alt = `${roleLabel} avatar`;
    }

    if (teacherName) {
      teacherName.textContent =
        profile?.role === "teacher" ? name : "Đang tải...";
    }

    if (teacherMeta) {
      teacherMeta.textContent =
        profile?.role === "teacher" ? `${userCode} · giáo viên` : "giáo viên";
    }
  }

  setSidebarCardsLoading(false);
}

function resetSidebarProfileCards() {
  const studentCard = document.querySelector(".student-card");
  const teacherCard = document.querySelector(".teacher-card");

  if (studentCard) {
    const studentAvatar = studentCard.querySelector("img");
    const studentName = studentCard.querySelector(".student-card-info h4");
    const studentMeta = studentCard.querySelector(".student-card-info p");

    if (studentAvatar) {
      studentAvatar.src =
        "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
    }

    if (studentName) {
      studentName.textContent = "Đang tải...";
    }

    if (studentMeta) {
      studentMeta.textContent = "Học sinh";
    }
  }

  if (teacherCard) {
    const teacherAvatar = teacherCard.querySelector("img");
    const teacherName = teacherCard.querySelector(".teacher-card-info h4");
    const teacherMeta = teacherCard.querySelector(".teacher-card-info p");

    if (teacherAvatar) {
      teacherAvatar.src =
        "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
    }

    if (teacherName) {
      teacherName.textContent = "Đang tải...";
    }

    if (teacherMeta) {
      teacherMeta.textContent = "Giáo viên";
    }
  }
}

function renderProfileView(profile) {
  const profileType = profile?.role === "teacher" ? "teacher" : "student";

  if (profileType === "teacher") {
    renderTeacherProfile(profile);
  } else {
    renderStudentProfile(profile);
  }

  updateSidebarProfileCards(profile);

  applyProfileSkeleton(profileType, false);
  setProfileLoadingState(profileType, false);
}

function renderProfileError(profileType, message) {
  const fallbackMessage = message || "Không thể tải hồ sơ người dùng.";
  showToast(fallbackMessage, "error");
  setProfileLoadingState(profileType, false);
  applyProfileSkeleton(profileType, false);
  setSidebarCardsLoading(false);
}

async function ensureProfileLoaded(pageId) {
  const profileType = getProfilePageType(pageId);

  if (!profileType) {
    return;
  }

  try {
    setProfileLoadingState(profileType, true);
    applyProfileSkeleton(profileType, true);
    setSidebarCardsLoading(true);

    const profile = await window.EduKidsProfileService.fetchCurrentProfile();

    if (!profile) {
      throw new Error("Không tìm thấy hồ sơ người dùng.");
    }

    profileState.current = profile;
    renderProfileView(profile);
  } catch (error) {
    profileState.error = error;
    renderProfileError(
      profileType,
      error.message || "Lỗi tải hồ sơ người dùng.",
    );
  }
}

function buildProfileEditModal(profile) {
  const isTeacher = profile?.role === "teacher";
  const title = isTeacher
    ? "Chỉnh sửa hồ sơ giáo viên"
    : "Chỉnh sửa hồ sơ học sinh";
  const extraFields = isTeacher
    ? `
      <div class="profile-edit-field">
        <label for="profile-school">Trường</label>
        <input id="profile-school" name="school" type="text" value="${escapeHtml(profile?.school || "")}" placeholder="Nhập tên trường" />
      </div>
      <div class="profile-edit-field">
        <label for="profile-phone">Số điện thoại</label>
        <input id="profile-phone" name="phone" type="text" value="${escapeHtml(profile?.phone || "")}" placeholder="Nhập số điện thoại" />
      </div>
      <div class="profile-edit-field">
        <label for="profile-address">Địa chỉ</label>
        <input id="profile-address" name="address" type="text" value="${escapeHtml(profile?.address || "")}" placeholder="Nhập địa chỉ" />
      </div>
      <div class="profile-edit-field profile-edit-field-full">
        <label for="profile-note">Ghi chú</label>
        <textarea id="profile-note" name="note" rows="4" placeholder="Nhập ghi chú">${escapeHtml(profile?.note || "")}</textarea>
      </div>
    `
    : `
      <div class="profile-edit-field">
        <label for="profile-school">Trường</label>
        <input id="profile-school" name="school" type="text" value="${escapeHtml(profile?.school || "")}" placeholder="Nhập tên trường" />
      </div>
      <div class="profile-edit-field">
        <label for="profile-class-name">Lớp</label>
        <input id="profile-class-name" name="className" type="text" value="${escapeHtml(profile?.className || "")}" placeholder="Nhập lớp" />
      </div>
      <div class="profile-edit-field profile-edit-field-full">
        <label for="profile-hobby">Sở thích</label>
        <input id="profile-hobby" name="hobby" type="text" value="${escapeHtml(profile?.hobby || "")}" placeholder="Nhập sở thích" />
      </div>
      <div class="profile-edit-field profile-edit-field-full">
        <label for="profile-dream">Ước mơ</label>
        <input id="profile-dream" name="dream" type="text" value="${escapeHtml(profile?.dream || "")}" placeholder="Nhập ước mơ" />
      </div>
    `;

  const classTags =
    Array.isArray(profile?.classTags) && profile.classTags.length > 0
      ? profile.classTags
      : [];

  return `
    <form class="profile-edit-form" data-profile-edit-form>
      <div class="profile-edit-grid">
        <section class="profile-edit-avatar-card">
          <h4>Ảnh đại diện</h4>
          <div class="profile-edit-avatar">
            <img src="${getProfileAvatar(profile)}" alt="Ảnh đại diện" />
          </div>
          <button class="profile-edit-avatar-btn" type="button" disabled>
            Ảnh tự động theo giới tính và vai trò
          </button>
          <p class="profile-edit-help">JPG, PNG tối đa 2MB</p>
        </section>

        <section class="profile-edit-info-card">
          <h4>Thông tin cá nhân</h4>
          <div class="profile-edit-field">
            <label for="profile-name">Họ và tên</label>
            <input id="profile-name" name="name" type="text" value="${escapeHtml(profile?.name || profile?.fullName || "")}" placeholder="Nhập họ và tên" />
          </div>
          <div class="profile-edit-field">
            <label for="profile-code">Mã ${isTeacher ? "giáo viên" : "học sinh"}</label>
            <input id="profile-code" type="text" value="${escapeHtml(profile?.userCode || "")}" readonly />
          </div>
          <div class="profile-edit-field">
            <label for="profile-username">Tên đăng nhập</label>
            <input id="profile-username" name="username" type="text" value="${escapeHtml(profile?.username || "")}" placeholder="Nhập tên đăng nhập" />
          </div>
          <div class="profile-edit-field">
            <label for="profile-role">Vai trò</label>
            <input id="profile-role" type="text" value="${escapeHtml(formatRoleLabel(profile?.role))}" readonly />
          </div>
          <div class="profile-edit-field">
            <label for="profile-gender">Giới tính</label>
            <select id="profile-gender" name="gender">
              <option value="male" ${profile?.gender === "male" ? "selected" : ""}>Nam</option>
              <option value="female" ${profile?.gender === "female" ? "selected" : ""}>Nữ</option>
            </select>
          </div>
          ${extraFields}
        </section>
      </div>

      ${
        isTeacher
          ? `
            <section class="profile-edit-tags-card">
              <h4>Lớp đang chủ nhiệm</h4>
              <div class="profile-edit-tag-list">
                ${
                  classTags.length > 0
                    ? classTags
                        .map(
                          (tag) =>
                            `<span class="profile-edit-tag">${escapeHtml(tag)}</span>`,
                        )
                        .join("")
                    : `<span class="profile-edit-tag is-empty">Chưa cập nhật</span>`
                }
              </div>
            </section>
          `
          : ""
      }

      <div class="profile-edit-actions">
        <button type="button" class="profile-edit-cancel-btn" data-profile-edit-cancel>Hủy bỏ</button>
        <button type="submit" class="profile-edit-save-btn">Lưu thay đổi</button>
      </div>

      <div class="profile-edit-feedback" data-profile-edit-feedback aria-live="polite"></div>
    </form>
  `;
}

async function openProfileEditModal() {
  let profile = profileState.current || getCurrentAuthUser();

  if (!profile?.userCode && window.EduKidsProfileService?.fetchCurrentProfile) {
    try {
      profile = await window.EduKidsProfileService.fetchCurrentProfile();
      profileState.current = profile;
    } catch (error) {
      showToast(error.message || "Không thể tải hồ sơ.", "error");
      return;
    }
  }

  if (!profile) {
    showToast("Không có dữ liệu hồ sơ để chỉnh sửa.", "error");
    return;
  }

  const modal = document.createElement("div");
  modal.className = "modal-overlay profile-edit-overlay";
  modal.innerHTML = `
    <div class="modal profile-edit-modal">
      <div class="modal-header">
        <h3>${profile.role === "teacher" ? "Chỉnh sửa hồ sơ giáo viên" : "Chỉnh sửa hồ sơ học sinh"}</h3>
        <button class="close-btn" type="button" aria-label="Đóng cửa sổ">×</button>
      </div>
      <div class="modal-content">
        ${buildProfileEditModal(profile)}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => modal.remove();
  modal.querySelector(".close-btn")?.addEventListener("click", closeModal);
  modal
    .querySelector("[data-profile-edit-cancel]")
    ?.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  const form = modal.querySelector("[data-profile-edit-form]");
  const feedback = modal.querySelector("[data-profile-edit-feedback]");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');
    const originalLabel = submitButton?.textContent || "";

    try {
      if (feedback) {
        feedback.textContent = "Đang lưu thay đổi...";
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Đang lưu...";
      }

      const formData = new FormData(form);
      const payload = {
        name: String(formData.get("name") || "").trim(),
        username: String(formData.get("username") || "").trim(),
        gender: String(formData.get("gender") || "").trim(),
      };

      if (profile.role === "teacher") {
        payload.school = String(formData.get("school") || "").trim();
        payload.phone = String(formData.get("phone") || "").trim();
        payload.address = String(formData.get("address") || "").trim();
        payload.note = String(formData.get("note") || "").trim();
      } else {
        payload.school = String(formData.get("school") || "").trim();
        payload.className = String(formData.get("className") || "").trim();
        payload.hobby = String(formData.get("hobby") || "").trim();
        payload.dream = String(formData.get("dream") || "").trim();
      }

      const updatedProfile =
        await window.EduKidsProfileService.updateCurrentProfile(payload);

      profileState.current = updatedProfile;
      saveAuthSession(
        updatedProfile,
        localStorage.getItem("authToken") || localStorage.getItem("token"),
      );
      renderProfileView(updatedProfile);
      showToast("Đã cập nhật hồ sơ thành công.", "success");
      closeModal();
    } catch (error) {
      if (feedback) {
        feedback.textContent = error.message || "Không thể cập nhật hồ sơ.";
      }
      showToast(error.message || "Không thể cập nhật hồ sơ.", "error");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalLabel || "Lưu thay đổi";
      }
    }
  });
}

document.addEventListener("click", (event) => {
  const editButton = event.target.closest(
    ".student-profile-edit-btn, .teacher-profile-edit-btn",
  );

  if (!editButton) {
    return;
  }

  void openProfileEditModal();
});

function changePage(pageId) {
  const role = getCurrentRole();
  const targetPageId = resolvePageForRole(pageId, role);

  previousPage = currentPage;
  currentPage = targetPageId;
  pages.forEach((page) => {
    page.classList.remove("active");
  });

  menuItems.forEach((item) => {
    item.classList.remove("active");
  });

  document.getElementById(targetPageId)?.classList.add("active");
  document
    .querySelector(`[data-page="${targetPageId}"]`)
    ?.classList.add("active");

  applyRoleVisibility(role);

  if (targetPageId === "create-assignment" && role === "teacher") {
    void initializeManualAssignmentBuilder();
  }

  if (getProfilePageType(targetPageId)) {
    ensureProfileLoaded(targetPageId);
  }

  if (targetPageId === "classroom") {
    void loadClassroomData();
  }

  if (targetPageId === "teacher-dashboard" && role === "teacher") {
    void loadClassroomData();
  }

  if (targetPageId === "assignments" && role === "student") {
    void refreshStudentAssignments();
  }

  if (targetPageId === "manage" && role === "teacher") {
    void refreshTeacherAssignments();
  }

  if (targetPageId === "subjects" && role === "student") {
    void initializeStudentQuizPage();
  }

  startClassroomRealtimeSync();
}

// ======================
// DEMO AI COACH
// ======================

function askAI() {
  const answers = [
    "Bạn đang học rất tốt phần phân số.",
    "Hãy luyện thêm hình học hôm nay.",
    "Bạn nên làm thêm 5 câu hỏi về đo lường.",
    "Tiến độ của bạn đang cao hơn lớp.",
  ];

  const random = answers[Math.floor(Math.random() * answers.length)];

  createModal("AI Coach", `<p>${random}</p>`);
}

function updateInstallButtonVisibility(visible) {
  installAppButtons.forEach((button) => {
    button.hidden = !visible;
  });
}

async function promptAppInstall() {
  if (!deferredInstallPrompt) {
    showToast(
      "Trình duyệt này chưa hỗ trợ cài đặt ứng dụng ngay lúc này.",
      "error",
    );
    return;
  }

  const promptEvent = deferredInstallPrompt;
  deferredInstallPrompt = null;
  updateInstallButtonVisibility(false);

  promptEvent.prompt();

  try {
    await promptEvent.userChoice;
  } catch (error) {
    console.warn("[EduKids][pwa] install prompt failed", error);
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("[EduKids][pwa] service worker registration failed", error);
    });
  });
}

function setupPwaInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallButtonVisibility(true);
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    updateInstallButtonVisibility(false);
    showToast("EduKids đã được cài đặt trên thiết bị này.", "success");
  });

  installAppButtons.forEach((button) => {
    button.addEventListener("click", () => {
      void promptAppInstall();
    });
  });
}

// ======================
// AI BUTTON
// ======================

document.addEventListener("DOMContentLoaded", () => {
  initializeAuth();
  void syncSidebarProfile();
  registerServiceWorker();
  setupPwaInstallPrompt();
  syncSidebarDrawerState();

  mobileMenuToggle?.addEventListener("click", () => {
    if (isSidebarDrawerOpen) {
      closeSidebarDrawer();
      return;
    }

    openSidebarDrawer();
  });

  sidebarBackdrop?.addEventListener("click", () => {
    closeSidebarDrawer();
  });

  mobileViewport.addEventListener?.("change", () => {
    syncSidebarDrawerState();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSidebarDrawer();
    }
  });

  const aiBtn = document.querySelector("#student-home .btn-primary");

  if (aiBtn) {
    aiBtn.addEventListener("click", () => {
      showToast("Đang tạo bài tập...");
    });
  }
});

document.addEventListener("click", (event) => {
  const logoutButton = event.target.closest("[data-logout-button]");

  if (!logoutButton) {
    return;
  }

  handleLogout();
});

window.addEventListener("pageshow", () => {
  void syncSidebarProfile();
  syncAuthState();
  syncSidebarDrawerState();
});

// ======================
// QUICK ACTIONS
// ======================

function openCreateAssignment() {
  changePage("create-assignment");
}

function openProfile() {
  changePage("profile");
}

function openTeacherDashboard() {
  changePage("teacher-dashboard");
}
// ======================
// PAGE HELPER
// ======================
function showAssignmentTab(id, button) {
  document
    .querySelectorAll(".assignment-tab")
    .forEach((x) => x.classList.remove("active"));

  document
    .querySelectorAll(".assignment-tab-btn")
    .forEach((x) => x.classList.remove("active"));

  document.getElementById(id).classList.add("active");

  button.classList.add("active");
}

function showOnly(pageId) {
  pages.forEach((page) => {
    page.classList.remove("active");
  });

  const targetPage = document.getElementById(pageId);

  if (targetPage) {
    targetPage.classList.add("active");
  } else {
    console.error("không tìm thấy page:", pageId);
  }
}

// ======================
// QUICK ACTIONS
// ======================

function openCreateAssignment() {
  changePage("create-assignment");
}

function openProfile() {
  changePage("profile");
}

function openTeacherDashboard() {
  changePage("teacher-dashboard");
}

function toggleClassroomDropdown(forceState) {
  const dropdown = document.querySelector(".classroom-dropdown");
  const button = document.querySelector(".classroom-toggle-btn");

  if (!dropdown || !button) {
    return;
  }

  const shouldOpen =
    typeof forceState === "boolean"
      ? forceState
      : !dropdown.classList.contains("open");

  dropdown.classList.toggle("open", shouldOpen);
  dropdown.setAttribute("aria-hidden", String(!shouldOpen));
  button.setAttribute("aria-expanded", String(shouldOpen));
}

function copyClassroomCode() {
  const code = getActiveClassroom()?.classCode || "";

  if (!code) {
    return;
  }

  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        showToast(`Đã sao chép mã lớp: <b>${code}</b>`);
      })
      .catch(() => {
        const tempInput = document.createElement("input");
        tempInput.value = code;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        tempInput.remove();
        showToast(`Đã sao chép mã lớp: <b>${code}</b>`);
      });
    return;
  }

  const tempInput = document.createElement("input");
  tempInput.value = code;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand("copy");
  tempInput.remove();
  showToast(`Đã sao chép mã lớp: <b>${code}</b>`);
}

function normalizeClassroomRecord(classroom) {
  if (!classroom || typeof classroom !== "object") {
    return null;
  }

  return {
    id: String(classroom.id || classroom.classId || "").trim(),
    name: String(
      classroom.name || classroom.className || "Chưa đặt tên",
    ).trim(),
    description: String(classroom.description || "").trim(),
    teacherId: String(classroom.teacherId || "").trim(),
    teacherName: String(
      classroom.teacherName || classroom.teacherUsername || "",
    ).trim(),
    classCode: String(classroom.classCode || classroom.code || "").trim(),
    studentCount:
      Number(classroom.studentCount ?? classroom.studentsCount ?? 0) || 0,
    createdAt: classroom.createdAt || "",
  };
}

function sortClassroomRecords(classrooms) {
  return [...(Array.isArray(classrooms) ? classrooms : [])].sort(
    (left, right) => {
      const leftTime = Date.parse(left.createdAt || left.updatedAt || "") || 0;
      const rightTime =
        Date.parse(right.createdAt || right.updatedAt || "") || 0;

      return rightTime - leftTime;
    },
  );
}

function uniqueStrings(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

let classroomState = [];
let classroomStateError = "";
let classroomLoadPromise = null;
let classroomSyncUnsubscribe = null;
let classroomSyncUserUnsubscribe = null;
let classroomSyncClassUnsubscribers = [];
let classroomSyncOwnerKey = "";
let classroomSyncClassIdsKey = "";
let activeClassroomId = "";
console.log("ACTIVE_CLASSROOM_PATCH_V1");

function getActiveClassroomId(context = "read") {
  console.log("[DEBUG] activeClassroomId", {
    context,
    value: activeClassroomId,
  });
  return activeClassroomId;
}

function setActiveClassroomId(nextValue, context = "write") {
  activeClassroomId = String(nextValue || "").trim();
  console.log("[DEBUG] activeClassroomId", {
    context,
    value: activeClassroomId,
  });
  return activeClassroomId;
}

function getActiveClassroom() {
  const currentActiveClassroomId = getActiveClassroomId("getActiveClassroom");

  return (
    classroomState.find(
      (classroom) => classroom.id === currentActiveClassroomId,
    ) ||
    classroomState[0] ||
    null
  );
}

function getClassroomSelectOptions() {
  return classroomState
    .map((classroom) => ({
      id: String(classroom.id || "").trim(),
      name: String(classroom.name || classroom.className || "Lớp học").trim(),
      className: String(classroom.className || classroom.name || "").trim(),
    }))
    .filter((classroom) => classroom.id);
}

function syncClassroomSelectElement(select) {
  if (!select) {
    return [];
  }

  const classrooms = getClassroomSelectOptions();
  const currentValue = String(select.value || "").trim();

  if (classrooms.length === 0) {
    select.innerHTML = `<option value="">Chưa có lớp nào</option>`;
    select.disabled = true;
    return classrooms;
  }

  select.innerHTML = `
    <option value="">Chọn lớp</option>
    ${classrooms
      .map(
        (classroom) =>
          `<option value="${escapeHtml(classroom.id)}">${escapeHtml(classroom.id)} - ${escapeHtml(classroom.name || classroom.className || "Lớp học")}</option>`,
      )
      .join("")}
  `;

  if (
    currentValue &&
    classrooms.some((classroom) => classroom.id === currentValue)
  ) {
    select.value = currentValue;
  }

  select.disabled = false;

  return classrooms;
}

function syncManualAssignmentClassOptions() {
  const classSelect = getManualAssignmentClassSelect();
  const classrooms = syncClassroomSelectElement(classSelect);

  manualAssignmentState.classes = classrooms;

  if (!classSelect) {
    return classrooms;
  }

  if (classrooms.length === 0) {
    manualAssignmentState.classId = "";
    manualAssignmentState.className = "";
    syncManualAssignmentPreview();
    return classrooms;
  }

  if (
    manualAssignmentState.classId &&
    !classrooms.some(
      (classroom) => classroom.id === manualAssignmentState.classId,
    )
  ) {
    manualAssignmentState.classId = "";
    manualAssignmentState.className = "";
  }

  classSelect.value = manualAssignmentState.classId || "";
  manualAssignmentState.classId = classSelect.value || "";
  manualAssignmentState.className =
    getSelectedManualAssignmentClass()?.name ||
    getSelectedManualAssignmentClass()?.className ||
    "";

  syncManualAssignmentFormFields();
  syncManualAssignmentPreview();

  return classrooms;
}

function syncTeacherAssignmentClassSelect() {
  const form =
    document.querySelector("#create-assignment-form") ||
    document.querySelector(".create-assignment-form") ||
    document.querySelector("[data-create-assignment-form]");

  if (!form) {
    return [];
  }

  const classSelect =
    form.querySelector('[name="classId"]') ||
    form.querySelector("#assignment-class-id") ||
    form.querySelector("[data-assignment-class-id]");

  if (!classSelect || classSelect.tagName !== "SELECT") {
    return [];
  }

  const classrooms = getClassroomSelectOptions();
  const currentValue = String(classSelect.value || "").trim();

  if (classrooms.length === 0) {
    classSelect.innerHTML = `<option value="">Chưa có lớp nào</option>`;
    classSelect.disabled = true;
    return classrooms;
  }

  classSelect.innerHTML = `
    <option value="">Chọn lớp</option>
    ${classrooms
      .map(
        (classroom) =>
          `<option value="${escapeHtml(classroom.id)}">${escapeHtml(classroom.id)} - ${escapeHtml(classroom.name || classroom.className || "Lớp học")}</option>`,
      )
      .join("")}
  `;

  if (
    currentValue &&
    classrooms.some((classroom) => classroom.id === currentValue)
  ) {
    classSelect.value = currentValue;
  }

  classSelect.disabled = false;
  return classrooms;
}

function syncClassroomDependentUi() {
  renderClassroomList();
  renderJoinedClassList();
  renderClassroom();
  syncManualAssignmentClassOptions();
  syncTeacherAssignmentClassSelect();
}

function logEduKidsDebugSnapshot(label, extra = {}) {
  const currentUser = getCurrentAuthUser();
  const role = normalizeRole(currentUser?.role);
  const userId = String(
    currentUser?.userId || currentUser?.uid || currentUser?.id || "",
  ).trim();

  console.log(`[DEBUG] ${label}`, {
    currentUser,
    currentRole: role,
    currentUserId: userId,
    classroomState: classroomState.map((classroom) => ({
      id: classroom.id,
      classCode: classroom.classCode,
      name: classroom.name,
      teacherId: classroom.teacherId,
    })),
    classroomStateError,
    studentClasses: studentAssignmentState.classes.map((classroom) => ({
      id: classroom.id,
      classCode: classroom.classCode,
      name: classroom.name,
    })),
    assignmentCount: Array.isArray(studentAssignmentState.assignments)
      ? studentAssignmentState.assignments.length
      : 0,
    teacherAssignments: Array.isArray(window.__edukidsTeacherAssignments)
      ? window.__edukidsTeacherAssignments.map((assignment) => ({
          id: assignment.id,
          classId: assignment.classId,
          teacherId: assignment.teacherId,
          title: assignment.title,
        }))
      : [],
    joinedClasses: classroomState
      .map((classroom) => classroom.id)
      .filter(Boolean),
    ...extra,
  });
}

function commitClassroomState(
  nextClassrooms,
  { source = "unknown", error = "" } = {},
) {
  const normalized = sortClassroomRecords(
    (Array.isArray(nextClassrooms) ? nextClassrooms : [])
      .map(normalizeClassroomRecord)
      .filter(Boolean),
  );

  classroomState = normalized;
  classroomStateError = String(error || "").trim();

  const currentActiveClassroomId = getActiveClassroomId("commitClassroomState");

  if (
    !classroomState.some(
      (classroom) => classroom.id === currentActiveClassroomId,
    )
  ) {
    setActiveClassroomId(classroomState[0]?.id || "", "commitClassroomState");
  }

  if (isStudentView()) {
    studentAssignmentState.classes = classroomState.map((classroom) => ({
      ...classroom,
    }));

    if (
      studentAssignmentState.activeClassId &&
      !studentAssignmentState.classes.some(
        (classroom) => classroom.id === studentAssignmentState.activeClassId,
      )
    ) {
      studentAssignmentState.activeClassId =
        studentAssignmentState.classes[0]?.id || "";
    }

    if (!studentAssignmentState.activeClassId) {
      studentAssignmentState.activeClassId =
        studentAssignmentState.classes[0]?.id || "";
    }

    renderClassSwitcher();
    renderAssignmentsFeed(studentAssignmentState.assignments);
  }

  console.log("[EduKids][classrooms] commitClassroomState", {
    source,
    classroomCount: classroomState.length,
    classroomIds: classroomState
      .map((classroom) => classroom.id)
      .filter(Boolean),
    activeClassroomId: getActiveClassroomId("commitClassroomState:log"),
  });
  logEduKidsDebugSnapshot("Classroom State");

  syncClassroomDependentUi();
}

function renderJoinedClassList() {
  const joinedClassList = document.getElementById("joined-class-list");
  const currentActiveClassroomId = getActiveClassroomId(
    "renderJoinedClassList",
  );

  if (!joinedClassList) {
    return;
  }

  if (classroomState.length === 0) {
    joinedClassList.innerHTML = `<div class="joined-class-empty">${escapeHtml(
      classroomStateError || "Chưa có lớp nào.",
    )}</div>`;
    return;
  }

  joinedClassList.innerHTML = classroomState
    .map(
      (classroom) => `
        <button type="button" class="joined-class-item ${classroom.id === currentActiveClassroomId ? "is-active" : ""}" data-class-id="${escapeHtml(classroom.id)}">
          <span class="joined-class-dot ${classroom.id === currentActiveClassroomId ? "active" : ""}"></span>
          <div>
            <strong>${escapeHtml(classroom.name)}</strong>
            <p>Mã lớp: ${escapeHtml(classroom.classCode || "--")}</p>
          </div>
        </button>
      `,
    )
    .join("");
}

function renderClassroomList() {
  const listPanel = document.getElementById("classroom-list-panel");
  const currentActiveClassroomId = getActiveClassroomId("renderClassroomList");

  if (!listPanel) {
    return;
  }

  if (classroomState.length === 0) {
    listPanel.innerHTML = `
      <div class="classroom-empty-state">
        <h3>${escapeHtml(
          classroomStateError ? "Không thể tải lớp học" : "Chưa có lớp nào",
        )}</h3>
        <p>${escapeHtml(
          classroomStateError ||
            "Tạo lớp đầu tiên để bắt đầu quản lý học sinh.",
        )}</p>
      </div>
    `;
    return;
  }

  listPanel.innerHTML = classroomState
    .map(
      (classroom) => `
      <button class="classroom-card ${
        classroom.id === currentActiveClassroomId ? "active" : ""
      }" data-class-id="${escapeHtml(classroom.id)}" type="button">
        <div>
          <h3>${escapeHtml(classroom.name)}</h3>
          <p>${escapeHtml(String(classroom.studentCount))} học sinh</p>
          <span>Mã lớp: ${escapeHtml(classroom.classCode || "--")}</span>
        </div>
        <span class="classroom-card-action">Xem lớp</span>
      </button>
    `,
    )
    .join("");

  listPanel.querySelectorAll(".classroom-card").forEach((card) => {
    card.addEventListener("click", () => {
      setActiveClassroom(card.dataset.classId);
    });
  });
}

function renderClassroom(classId) {
  if (classId) {
    setActiveClassroomId(classId, "renderClassroom");
  }

  const currentActiveClassroomId = getActiveClassroomId("renderClassroom");
  const classroom = getActiveClassroom();
  const nameNode = document.getElementById("classroom-detail-name");
  const codeNode = document.getElementById("classroom-detail-code");
  const studentList = document.getElementById("classroom-student-list");
  const sizeNode = document.getElementById("classroom-stat-size");
  const averageNode = document.getElementById("classroom-stat-average");
  const completionNode = document.getElementById("classroom-stat-completion");
  const copyButton = document.querySelector(".classroom-copy-btn");

  if (nameNode)
    nameNode.textContent = classroom ? classroom.name : "Chưa có lớp nào";
  if (codeNode)
    codeNode.textContent = `Mã lớp: ${classroom?.classCode || "--"}`;
  if (sizeNode)
    sizeNode.textContent = classroom
      ? String(classroom.studentCount || 0)
      : "0";
  if (averageNode) averageNode.textContent = "0%";
  if (completionNode) completionNode.textContent = "0%";

  if (copyButton) {
    copyButton.disabled = !classroom?.classCode;
  }

  if (studentList) {
    if (!classroom) {
      studentList.innerHTML = `
        <div class="classroom-empty-state classroom-empty-state-compact">
          <h3>Chưa có dữ liệu học sinh</h3>
          <p>Chọn hoặc tạo một lớp để xem danh sách học sinh.</p>
        </div>
      `;
    } else if (!classroom.studentCount) {
      studentList.innerHTML = `
        <div class="classroom-empty-state classroom-empty-state-compact">
          <h3>Lớp chưa có học sinh</h3>
          <p>Mã lớp: ${escapeHtml(classroom.classCode || "--")}</p>
        </div>
      `;
    } else {
      studentList.innerHTML = `
        <div class="classroom-empty-state classroom-empty-state-compact">
          <h3>Danh sách học sinh sẽ được đồng bộ từ Firestore</h3>
          <p>Số học sinh hiện tại: ${escapeHtml(String(classroom.studentCount))}</p>
        </div>
      `;
    }
  }

  document.querySelectorAll(".classroom-card").forEach((card) => {
    card.classList.toggle(
      "active",
      card.dataset.classId === currentActiveClassroomId,
    );
  });

  document.querySelectorAll(".joined-class-item").forEach((item) => {
    item.classList.toggle(
      "is-active",
      item.dataset.classId === currentActiveClassroomId,
    );
    const dot = item.querySelector(".joined-class-dot");

    if (dot) {
      dot.classList.toggle(
        "active",
        item.dataset.classId === currentActiveClassroomId,
      );
    }
  });
}

function setActiveClassroom(classroomId) {
  if (!classroomId) {
    return;
  }

  setActiveClassroomId(classroomId, "setActiveClassroom");
  renderClassroom(classroomId);
}

function stopClassroomRealtimeSync() {
  if (typeof classroomSyncUnsubscribe === "function") {
    classroomSyncUnsubscribe();
  }

  classroomSyncUnsubscribe = null;

  if (typeof classroomSyncUserUnsubscribe === "function") {
    classroomSyncUserUnsubscribe();
  }

  classroomSyncUserUnsubscribe = null;

  classroomSyncClassUnsubscribers.forEach((unsubscribe) => {
    if (typeof unsubscribe === "function") {
      unsubscribe();
    }
  });

  classroomSyncClassUnsubscribers = [];
  classroomSyncOwnerKey = "";
  classroomSyncClassIdsKey = "";
}

function startClassroomRealtimeSync() {
  const firestore = getFirebaseFirestore();
  const currentUser = getCurrentAuthUser();
  const role = normalizeRole(currentUser?.role);
  const userId = String(
    currentUser?.userId || currentUser?.uid || currentUser?.id || "",
  ).trim();

  logEduKidsDebugSnapshot("Current User");

  if (!firestore || !currentUser || !role || !userId) {
    console.warn("[EduKids][classrooms] realtime sync skipped", {
      hasFirestore: Boolean(firestore),
      hasCurrentUser: Boolean(currentUser),
      role,
      userId,
    });
    stopClassroomRealtimeSync();
    return false;
  }

  const ownerKey = `${role}:${userId}`;

  if (classroomSyncOwnerKey === ownerKey) {
    return true;
  }

  stopClassroomRealtimeSync();
  classroomSyncOwnerKey = ownerKey;

  console.log("[EduKids][classrooms] startClassroomRealtimeSync", {
    role,
    userId,
  });

  if (role === "teacher") {
    const query = firestore
      .collection("classes")
      .where("teacherId", "==", userId);

    classroomSyncUnsubscribe = query.onSnapshot(
      (snapshot) => {
        const classes = snapshot.docs.map((doc) =>
          normalizeClassroomRecord({
            id: doc.id,
            ...(typeof doc.data === "function" ? doc.data() || {} : {}),
          }),
        );

        console.log("[TeacherClasses] snapshot size", snapshot.size);
        console.log("[TeacherClasses] state before update", {
          classroomIds: classroomState.map((item) => item.id).filter(Boolean),
          activeClassroomId: getActiveClassroomId(
            "teacher-listener:before-update",
          ),
        });
        console.log("[TeacherClasses] state after update", {
          teacherId: userId,
          classroomIds: classes.map((item) => item.id).filter(Boolean),
          classCount: classes.length,
        });

        commitClassroomState(classes, { source: "teacher-listener" });
      },
      (error) => {
        console.warn("[EduKids][classrooms] teacher listener failed", error);
        classroomStateError =
          error?.message || "Không thể đồng bộ Firestore lớp học.";
        syncClassroomDependentUi();
      },
    );

    return true;
  }

  const userRef = firestore.collection("users").doc(userId);

  let knownClassIds = [];

  const subscribeToClasses = (classIds) => {
    const normalizedIds = Array.isArray(classIds)
      ? classIds.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    const classIdsKey = normalizedIds.join("|");

    if (classroomSyncClassIdsKey === classIdsKey) {
      return;
    }

    classroomSyncClassIdsKey = classIdsKey;

    classroomSyncClassUnsubscribers.forEach((unsubscribe) => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    });
    classroomSyncClassUnsubscribers = [];

    if (normalizedIds.length === 0) {
      commitClassroomState([], { source: "student-listener-empty" });
      return;
    }

    const mergedClasses = new Map();

    const emit = (source) => {
      commitClassroomState(Array.from(mergedClasses.values()), { source });
    };

    normalizedIds.forEach((classId, index) => {
      const unsubscribe = firestore
        .collection("classes")
        .doc(classId)
        .onSnapshot(
          (doc) => {
            if (doc.exists) {
              mergedClasses.set(
                classId,
                normalizeClassroomRecord({
                  id: doc.id,
                  ...(typeof doc.data === "function" ? doc.data() || {} : {}),
                }),
              );
            } else {
              mergedClasses.delete(classId);
            }

            console.log(
              "[EduKids][classrooms] student class listener snapshot",
              {
                classId,
                listenerIndex: index,
                docExists: Boolean(doc.exists),
                classroomIds: Array.from(mergedClasses.keys()),
              },
            );

            emit(`student-class-doc-${index}`);
          },
          (error) => {
            console.warn(
              "[EduKids][classrooms] student class listener failed",
              {
                classId,
                error,
              },
            );
            mergedClasses.delete(classId);
            classroomStateError =
              error?.message || "Không thể đồng bộ lớp học của học sinh.";
            emit(`student-class-doc-error-${index}`);
          },
        );

      classroomSyncClassUnsubscribers.push(unsubscribe);
    });
  };

  classroomSyncUserUnsubscribe = userRef.onSnapshot(
    (snapshot) => {
      const data = snapshot.exists ? snapshot.data() || {} : {};
      const nextClassIds = uniqueStrings([
        ...(Array.isArray(data.joinedClasses) ? data.joinedClasses : []),
        ...(Array.isArray(data.classIds) ? data.classIds : []),
      ]);
      const nextClassIdsKey = nextClassIds.join("|");

      console.log("[EduKids][classrooms] student membership listener", {
        userId,
        classIdsBefore: knownClassIds,
        classIdsAfter: nextClassIds,
      });
      logEduKidsDebugSnapshot("Joined Classes", {
        joinedClasses: nextClassIds,
        userSnapshotExists: snapshot.exists,
      });

      if (nextClassIdsKey !== classroomSyncClassIdsKey) {
        subscribeToClasses(nextClassIds);
      }

      const shouldRefreshAssignments =
        nextClassIdsKey !== knownClassIds.join("|");

      knownClassIds = nextClassIds;

      if (shouldRefreshAssignments && isStudentView()) {
        void refreshStudentAssignments();
      }
    },
    (error) => {
      console.warn("[EduKids][classrooms] student user listener failed", error);
      classroomStateError =
        error?.message || "Không thể đồng bộ trạng thái lớp học của học sinh.";
      syncClassroomDependentUi();
    },
  );

  return true;
}

async function loadClassroomData({ forceRefresh = false } = {}) {
  if (classroomLoadPromise && !forceRefresh) {
    return classroomLoadPromise;
  }

  const currentUser = getCurrentAuthUser();

  if (!currentUser || !normalizeRole(currentUser.role)) {
    classroomState = [];
    setActiveClassroomId("", "loadClassroomData:reset");
    classroomStateError = "";
    renderClassroom();
    renderClassroomList();
    renderJoinedClassList();
    return [];
  }

  classroomLoadPromise = (async () => {
    try {
      logEduKidsDebugSnapshot("Classroom State", { source: "api-load-start" });
      const result = await apiRequestWithAuth("/api/classes/my", {
        method: "GET",
      });

      commitClassroomState(Array.isArray(result.data) ? result.data : [], {
        source: "api-load",
      });

      return classroomState;
    } finally {
      startClassroomRealtimeSync();
    }
  })();

  try {
    return await classroomLoadPromise;
  } catch (error) {
    classroomStateError = error?.message || "Không thể tải lớp học.";
    syncClassroomDependentUi();
    console.warn("[EduKids][classrooms] loadClassroomData failed", error);
    return classroomState;
  } finally {
    classroomLoadPromise = null;
  }
}

function openCreateClassModal() {
  const currentUser = getCurrentAuthUser();

  if (!currentUser || normalizeRole(currentUser.role) !== "teacher") {
    showToast("Chỉ giáo viên mới có thể tạo lớp.", "error");
    return;
  }

  const modal = createModal(
    "Tạo lớp học",
    `
      <form class="classroom-create-form" data-classroom-create-form novalidate>
        <div class="classroom-create-field">
          <label for="classroom-name">Tên lớp</label>
          <input id="classroom-name" name="name" type="text" class="auth-input" maxlength="100" placeholder="Nhập tên lớp" autocomplete="off" required />
        </div>
        <div class="classroom-create-field">
          <label for="classroom-description">Mô tả lớp</label>
          <textarea id="classroom-description" name="description" class="auth-input classroom-create-textarea" maxlength="500" placeholder="Mô tả ngắn về lớp học"></textarea>
        </div>
        <div class="classroom-create-feedback" data-classroom-create-feedback aria-live="polite"></div>
        <div class="classroom-create-actions">
          <button type="button" class="classroom-create-cancel">Hủy</button>
          <button type="submit" class="classroom-create-submit">Tạo lớp</button>
        </div>
      </form>
    `,
  );

  const form = modal?.querySelector("[data-classroom-create-form]");
  const feedback = modal?.querySelector("[data-classroom-create-feedback]");
  const cancelButton = modal?.querySelector(".classroom-create-cancel");

  if (cancelButton) {
    cancelButton.addEventListener("click", () => modal?.remove());
  }

  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = form.elements.name?.value.trim();
    const description = form.elements.description?.value.trim() || "";
    const submitButton = form.querySelector(".classroom-create-submit");

    if (feedback) {
      feedback.textContent = "";
      feedback.classList.remove("is-error", "is-success");
    }

    if (!name) {
      if (feedback) {
        feedback.textContent = "Tên lớp là bắt buộc.";
        feedback.classList.add("is-error");
      }
      return;
    }

    if (name.length > 100) {
      if (feedback) {
        feedback.textContent = "Tên lớp tối đa 100 ký tự.";
        feedback.classList.add("is-error");
      }
      return;
    }

    if (description.length > 500) {
      if (feedback) {
        feedback.textContent = "Mô tả lớp tối đa 500 ký tự.";
        feedback.classList.add("is-error");
      }
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const result = await apiRequestWithAuth("/api/classes", {
        method: "POST",
        body: {
          name,
          description,
        },
      });

      const createdClass = normalizeClassroomRecord(result.data);

      if (createdClass) {
        classroomState = sortClassroomRecords([
          createdClass,
          ...classroomState.filter((item) => item.id !== createdClass.id),
        ]);
        setActiveClassroomId(createdClass.id, "createClassroom:success");
      }

      syncClassroomDependentUi();

      showToast(
        `Đã tạo lớp <b>${escapeHtml(createdClass?.name || name)}</b> thành công.`,
      );
      modal?.remove();
      changePage("classroom");
    } catch (error) {
      if (feedback) {
        feedback.textContent = error.message || "Không thể tạo lớp.";
        feedback.classList.add("is-error");
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}

function copyClassroomCode() {
  const code = getActiveClassroom()?.classCode;

  if (!code) {
    showToast("Không có mã lớp để sao chép.", "error");
    return;
  }

  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        showToast(`Đã sao chép mã lớp <b>${code}</b>`);
      })
      .catch(() => {
        const tempInput = document.createElement("input");
        tempInput.value = code;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        tempInput.remove();
        showToast(`Đã sao chép mã lớp <b>${code}</b>`);
      });
    return;
  }

  const tempInput = document.createElement("input");
  tempInput.value = code;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand("copy");
  tempInput.remove();
  showToast(`Đã sao chép mã lớp <b>${code}</b>`);
}

// ======================
// SUBJECTS
// ======================

const STUDENT_QUIZ_DEFAULTS = {
  grade: "1",
  subject: "math",
};

const studentQuizState = {
  initialized: false,
  grade: STUDENT_QUIZ_DEFAULTS.grade,
  subject: STUDENT_QUIZ_DEFAULTS.subject,
  topics: [],
  loadedTopicsKey: "",
  topicsMessage: "",
  selectedTopicId: "",
  quiz: null,
  answers: [],
  isSubmitted: false,
  resultData: null,
  wrongQuestions: [],
  submissionLoading: false,
  reviewVisible: false,
  loadingTopics: false,
  loadingQuiz: false,
};

function getStudentQuizRoot() {
  return document.getElementById("subjects");
}

function getStudentQuizTopicGrid() {
  return document.getElementById("student-topic-grid");
}

function getStudentQuizScreen() {
  return document.getElementById("student-quiz-screen");
}

function getStudentResultScreen() {
  return document.getElementById("student-result-screen");
}

function getStudentWrongReviewScreen() {
  return document.getElementById("student-wrong-review-screen");
}

function getStudentQuizEmptyState() {
  return document.getElementById("student-topic-empty");
}

function getStudentQuizGradeSelect() {
  return document.getElementById("quiz-grade-select");
}

function getStudentQuizSubjectSelect() {
  return document.getElementById("quiz-subject-select");
}

function getStudentQuizLoadButton() {
  return document.getElementById("quiz-load-topics-btn");
}

function normalizeQuizText(value) {
  return String(value || "").trim();
}

function getInitialStudentQuizGrade() {
  const profile = getCurrentAuthUser();
  const className = normalizeQuizText(profile?.className);
  const gradeMatch = className.match(/(\d+)/);

  if (gradeMatch) {
    return gradeMatch[1];
  }

  const profileGrade = normalizeQuizText(profile?.grade);

  if (profileGrade) {
    return profileGrade;
  }

  return STUDENT_QUIZ_DEFAULTS.grade;
}

function getStudentTopicImage(topic) {
  const image = normalizeQuizText(topic?.image);

  if (image) {
    return image;
  }

  if (topic?.subject === "english") {
    return "assets/englishTopic/vocabulary.png";
  }

  return "assets/math.png";
}

function getSelectedQuizAnswer(questionIndex) {
  return (
    studentQuizState.answers.find(
      (item) => item.questionIndex === questionIndex,
    )?.selected || ""
  );
}

function setStudentQuizAnswer(questionIndex, selected) {
  const existingIndex = studentQuizState.answers.findIndex(
    (item) => item.questionIndex === questionIndex,
  );

  if (existingIndex >= 0) {
    studentQuizState.answers[existingIndex].selected = selected;
  } else {
    studentQuizState.answers.push({
      questionIndex,
      selected,
    });
  }
}

function getStudentQuizAnsweredCount() {
  return studentQuizState.answers.filter((item) =>
    normalizeQuizText(item.selected),
  ).length;
}

function getQuizCorrectAnswerLabel(question) {
  const correctOption = Array.isArray(question?.options)
    ? question.options.find((option) => option && option.correct === true)
    : null;

  return normalizeQuizText(correctOption?.label).toUpperCase();
}

function getQuizCorrectAnswerText(question) {
  const correctOption = Array.isArray(question?.options)
    ? question.options.find((option) => option && option.correct === true)
    : null;

  return normalizeQuizText(correctOption?.text);
}

function getSubmittedAnswerOption(question, selectedLabel) {
  const normalizedSelected = normalizeQuizText(selectedLabel).toUpperCase();

  return Array.isArray(question?.options)
    ? question.options.find(
        (option) =>
          normalizeQuizText(option?.label).toUpperCase() === normalizedSelected,
      ) || null
    : null;
}

function resetQuizSubmissionState() {
  studentQuizState.isSubmitted = false;
  studentQuizState.resultData = null;
  studentQuizState.wrongQuestions = [];
  studentQuizState.submissionLoading = false;
  studentQuizState.reviewVisible = false;
}

function scrollToElement(elementId) {
  const element = document.getElementById(elementId);

  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderStudentTopicEmpty(message) {
  const empty = getStudentQuizEmptyState();

  if (!empty) {
    return;
  }

  empty.textContent = message;
  empty.classList.remove("hidden");
}

function hideStudentTopicEmpty() {
  const empty = getStudentQuizEmptyState();

  if (empty) {
    empty.classList.add("hidden");
  }
}

function updateStudentQuizControls() {
  const gradeSelect = getStudentQuizGradeSelect();
  const subjectSelect = getStudentQuizSubjectSelect();

  if (gradeSelect && gradeSelect.value !== studentQuizState.grade) {
    gradeSelect.value = studentQuizState.grade;
  }

  if (subjectSelect && subjectSelect.value !== studentQuizState.subject) {
    subjectSelect.value = studentQuizState.subject;
  }
}

function renderStudentTopicCards() {
  const grid = getStudentQuizTopicGrid();

  if (!grid) {
    return;
  }

  const topics = Array.isArray(studentQuizState.topics)
    ? studentQuizState.topics
    : [];

  if (studentQuizState.loadingTopics) {
    grid.innerHTML = `
      <div class="quiz-loading-card">
        <span class="quiz-loading-spinner"></span>
        <p>Đang tải chủ đề...</p>
      </div>
    `;
    hideStudentTopicEmpty();
    return;
  }

  if (topics.length === 0) {
    grid.innerHTML = "";
    renderStudentTopicEmpty(
      studentQuizState.topicsMessage ||
        "Không tìm thấy chủ đề nào cho khối và môn học đã chọn.",
    );
    return;
  }

  hideStudentTopicEmpty();

  grid.innerHTML = topics
    .map((topic) => {
      const isActive = topic.topicId === studentQuizState.selectedTopicId;
      const hasQuiz = topic.hasQuiz !== false;

      return `
        <button
          type="button"
          class="topic-card ${isActive ? "is-active" : ""} ${hasQuiz ? "" : "is-disabled"}"
          data-topic-id="${escapeHtml(topic.topicId)}"
          data-topic-name="${escapeHtml(topic.name)}"
          ${hasQuiz ? "" : "disabled"}
        >
          <img class="topic-card-image" src="${escapeHtml(getStudentTopicImage(topic))}" alt="${escapeHtml(topic.name)}" />
          <span class="topic-card-grade">Lớp ${escapeHtml(topic.grade)}</span>
          <h3 class="topic-card-title">${escapeHtml(topic.name)}</h3>
          <p class="topic-card-description">${escapeHtml(topic.description || "Chọn để mở quiz để luyện.")}</p>
          ${hasQuiz ? "" : `<span class="topic-card-status">Chưa có quiz</span>`}
        </button>
      `;
    })
    .join("");
}

function renderStudentQuizScreen() {
  const screen = getStudentQuizScreen();

  if (!screen) {
    return;
  }

  const quiz = studentQuizState.quiz;
  const resultScreen = getStudentResultScreen();
  const reviewScreen = getStudentWrongReviewScreen();

  if (studentQuizState.loadingQuiz) {
    screen.classList.remove("hidden");
    screen.innerHTML = `
      <div class="quiz-panel-header">
        <div>
          <span class="quiz-panel-kicker">Quiz</span>
          <h2>đang tạo bài quiz...</h2>
        </div>
      </div>
      <div class="quiz-loading-card">
        <span class="quiz-loading-spinner"></span>
        <p>Đang lấy dữ liệu từ Firestore...</p>
      </div>
    `;
    resultScreen?.classList.add("hidden");
    reviewScreen?.classList.add("hidden");
    return;
  }

  if (!quiz) {
    screen.classList.add("hidden");
    screen.innerHTML = "";
    resultScreen?.classList.add("hidden");
    reviewScreen?.classList.add("hidden");
    return;
  }

  const answeredCount = getStudentQuizAnsweredCount();
  const totalQuestions = Array.isArray(quiz.questions)
    ? quiz.questions.length
    : 0;
  const submitDisabled =
    studentQuizState.submissionLoading || studentQuizState.isSubmitted;

  screen.classList.remove("hidden");
  screen.innerHTML = `
    <div class="quiz-panel-header">
      <div>
        <span class="quiz-panel-kicker">Quiz đã lưu</span>
        <h2>${escapeHtml(quiz.topicName || quiz.topicId || "Bài quiz")}</h2>
        <p>Lớp: ${escapeHtml(quiz.grade || studentQuizState.grade)} ⬢ ${escapeHtml(quiz.subject || studentQuizState.subject)} ⬢ ${escapeHtml(quiz.topicId || "")}</p>
      </div>
      <div class="quiz-panel-progress">
        <strong>${answeredCount}/${totalQuestions}</strong>
        <span>đã chọn</span>
      </div>
    </div>
    <div class="quiz-question-list ${studentQuizState.isSubmitted ? "is-submitted" : ""}">
      ${(Array.isArray(quiz.questions) ? quiz.questions : [])
        .map((question, questionIndex) => {
          const selected = getSelectedQuizAnswer(questionIndex);
          const correctLabel = getQuizCorrectAnswerLabel(question);
          const isQuestionCorrect =
            studentQuizState.isSubmitted && selected === correctLabel;
          const isQuestionWrong =
            studentQuizState.isSubmitted &&
            selected &&
            selected !== correctLabel;

          return `
            <article class="quiz-question-card ${isQuestionCorrect ? "is-correct" : ""} ${isQuestionWrong ? "is-wrong" : ""}">
              <div class="quiz-question-meta">Câu ${questionIndex + 1}</div>
              <h3 class="quiz-question-text">${escapeHtml(question.question)}</h3>
              <div class="quiz-option-grid">
                ${(Array.isArray(question.options) ? question.options : [])
                  .map((option) => {
                    const optionLabel = normalizeQuizText(
                      option.label,
                    ).toUpperCase();
                    const isSelected = selected === optionLabel;
                    const isCorrectAnswer =
                      studentQuizState.isSubmitted &&
                      optionLabel === correctLabel;
                    const isWrongSelection =
                      studentQuizState.isSubmitted &&
                      isSelected &&
                      optionLabel !== correctLabel;

                    return `
                      <button
                        type="button"
                        class="quiz-option-btn ${isSelected ? "is-selected" : ""} ${isCorrectAnswer ? "is-correct" : ""} ${isWrongSelection ? "is-wrong" : ""}"
                        data-question-index="${questionIndex}"
                        data-option-label="${escapeHtml(optionLabel)}"
                        ${studentQuizState.isSubmitted ? "disabled" : ""}
                      >
                        <span class="quiz-option-label">${escapeHtml(optionLabel)}</span>
                        <span class="quiz-option-text">${escapeHtml(option.text)}</span>
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
    <div class="quiz-actions">
      <button
        type="button"
        class="quiz-submit-btn"
        data-action="submit-quiz"
        ${submitDisabled ? "disabled" : ""}
      >
        ${studentQuizState.submissionLoading ? "Đang nộp..." : studentQuizState.isSubmitted ? "Quiz đã nộp" : "Submit Quiz"}
      </button>
    </div>
  `;
}

function renderStudentResultScreen() {
  const screen = getStudentResultScreen();

  if (!screen) {
    return;
  }

  if (!studentQuizState.isSubmitted || !studentQuizState.resultData) {
    screen.classList.add("hidden");
    screen.innerHTML = "";
    return;
  }

  const result = studentQuizState.resultData;

  screen.classList.remove("hidden");
  screen.innerHTML = `
    <div class="result-card">
      <div class="result-card-header">
        <div>
          <span class="quiz-panel-kicker">Kết quả</span>
          <h2>Bạn đã hoàn thành bài quiz</h2>
        </div>
        <div class="result-score-badge">${escapeHtml(result.score)}%</div>
      </div>

      <div class="result-stats">
        <div class="result-stat">
          <strong>${escapeHtml(result.correctAnswers)}</strong>
          <span>đúng</span>
        </div>
        <div class="result-stat">
          <strong>${escapeHtml(result.totalQuestions)}</strong>
          <span>Tổng câu</span>
        </div>
      </div>

      <div class="result-summary">
        <p><b>${escapeHtml(result.correctAnswers)}</b> / <b>${escapeHtml(result.totalQuestions)}</b> câu trả lời đúng.</p>
      </div>

      <div class="result-actions">
        <button type="button" class="quiz-link-btn" data-action="show-wrong-review">
          Xem câu sai
        </button>
      </div>
    </div>
  `;
}

function renderStudentWrongAnswerScreen() {
  const screen = getStudentWrongReviewScreen();

  if (!screen) {
    return;
  }

  if (!studentQuizState.isSubmitted) {
    screen.classList.add("hidden");
    screen.innerHTML = "";
    return;
  }

  const wrongQuestions = Array.isArray(studentQuizState.wrongQuestions)
    ? studentQuizState.wrongQuestions
    : [];

  screen.classList.remove("hidden");
  screen.innerHTML = `
    <div class="wrong-review-card">
      <div class="wrong-review-header">
        <div>
          <span class="quiz-panel-kicker">Wrong Answer Review</span>
          <h2>Câu trả lời sai</h2>
        </div>
        <div class="wrong-review-count">${escapeHtml(wrongQuestions.length)} câu</div>
      </div>

      ${
        wrongQuestions.length === 0
          ? `<div class="quiz-empty">Không có câu sai. Bài làm của bạn rất tốt.</div>`
          : `
            <div class="wrong-review-list">
              ${wrongQuestions
                .map((item) => {
                  const userAnswerLabel = normalizeQuizText(item.userAnswer);
                  const correctAnswerLabel = normalizeQuizText(
                    item.correctAnswer,
                  );
                  const userAnswerText = normalizeQuizText(item.userAnswerText);
                  const correctAnswerText = normalizeQuizText(
                    item.correctAnswerText,
                  );

                  return `
                    <article class="wrong-review-item">
                      <div class="wrong-review-meta">Câu ${Number(item.questionIndex) + 1}</div>
                      <h3>${escapeHtml(item.question)}</h3>
                      <div class="wrong-review-row">
                        <span>Bạn chọn</span>
                        <strong>${escapeHtml(userAnswerLabel || "Chưa chọn")}</strong>
                        <p>${escapeHtml(userAnswerText || "Không có lựa chọn")}</p>
                      </div>
                      <div class="wrong-review-row is-correct">
                        <span>Đáp án đúng</span>
                        <strong>${escapeHtml(correctAnswerLabel)}</strong>
                        <p>${escapeHtml(correctAnswerText)}</p>
                      </div>
                    </article>
                  `;
                })
                .join("")}
            </div>
          `
      }
    </div>
  `;
}
function renderStudentQuizFlow() {
  renderStudentQuizScreen();
  renderStudentResultScreen();
  renderStudentWrongAnswerScreen();
}

async function loadStudentQuizTopics() {
  const gradeSelect = getStudentQuizGradeSelect();
  const subjectSelect = getStudentQuizSubjectSelect();
  const grade = normalizeQuizText(gradeSelect?.value || studentQuizState.grade);
  const subject = normalizeQuizText(
    subjectSelect?.value || studentQuizState.subject,
  );

  studentQuizState.grade = grade || STUDENT_QUIZ_DEFAULTS.grade;
  studentQuizState.subject = subject || STUDENT_QUIZ_DEFAULTS.subject;
  studentQuizState.selectedTopicId = "";
  studentQuizState.quiz = null;
  studentQuizState.answers = [];
  resetQuizSubmissionState();
  studentQuizState.loadedTopicsKey = "";
  studentQuizState.topicsMessage = "";
  studentQuizState.loadingTopics = true;
  studentQuizState.loadingQuiz = false;

  updateStudentQuizControls();
  renderStudentTopicCards();
  renderStudentQuizFlow();

  try {
    const params = new URLSearchParams({
      grade: studentQuizState.grade,
      subject: studentQuizState.subject,
    });

    const response = await apiRequestWithAuth(
      `/api/quiz/topics?${params.toString()}`,
      {
        method: "GET",
      },
    );

    studentQuizState.topics = Array.isArray(response.data) ? response.data : [];
    studentQuizState.loadedTopicsKey = `${studentQuizState.grade}:${studentQuizState.subject}`;
    studentQuizState.topicsMessage = "";
  } catch (error) {
    studentQuizState.topics = [];
    studentQuizState.topicsMessage =
      error.message || "Không thể tải danh sách chủ đề.";
  } finally {
    studentQuizState.loadingTopics = false;
    renderStudentTopicCards();
  }
}

async function loadStudentQuizByTopic(topicId) {
  const normalizedTopicId = normalizeQuizText(topicId);

  if (!normalizedTopicId) {
    return;
  }

  studentQuizState.selectedTopicId = normalizedTopicId;
  studentQuizState.loadingQuiz = true;
  studentQuizState.quiz = null;
  studentQuizState.answers = [];
  resetQuizSubmissionState();

  renderStudentTopicCards();
  renderStudentQuizFlow();

  try {
    const params = new URLSearchParams({
      grade: studentQuizState.grade,
      subject: studentQuizState.subject,
      topicId: normalizedTopicId,
    });

    const response = await apiRequestWithAuth(
      `/api/quiz/by-topic?${params.toString()}`,
      {
        method: "GET",
      },
    );

    studentQuizState.quiz = response.data || null;
    studentQuizState.answers = [];
  } catch (error) {
    studentQuizState.quiz = null;

    if ((error.message || "").toLowerCase().includes("quiz not found")) {
      showToast("Chủ đề này chưa có quiz được tạo.", "error");
    } else {
      showToast(error.message || "Không thể tải quiz cho chủ đề này.", "error");
    }
  } finally {
    studentQuizState.loadingQuiz = false;
    renderStudentTopicCards();
    renderStudentQuizFlow();
  }
}
async function submitStudentQuiz() {
  const quiz = studentQuizState.quiz;

  if (!quiz) {
    showToast("Chưa có quiz để nộp.", "error");
    return;
  }

  if (studentQuizState.submissionLoading || studentQuizState.isSubmitted) {
    return;
  }

  studentQuizState.submissionLoading = true;
  renderStudentQuizFlow();

  try {
    const response = await apiRequestWithAuth("/api/quiz/submit", {
      method: "POST",
      body: {
        quizId: quiz.id || quiz.quizId || "",
        answers: studentQuizState.answers,
      },
    });

    studentQuizState.isSubmitted = true;
    studentQuizState.resultData = response.data || null;
    studentQuizState.wrongQuestions = Array.isArray(
      response.data?.wrongQuestions,
    )
      ? response.data.wrongQuestions
      : [];
    studentQuizState.reviewVisible = true;
    renderStudentQuizFlow();
    showToast("Đã nộp quiz thành công.", "success");
    scrollToElement("student-result-screen");
  } catch (error) {
    showToast(error.message || "Không thể nộp quiz.", "error");
  } finally {
    studentQuizState.submissionLoading = false;
    renderStudentQuizFlow();
  }
}

function showStudentWrongAnswerReview() {
  if (!studentQuizState.isSubmitted) {
    return;
  }

  studentQuizState.reviewVisible = true;
  renderStudentWrongAnswerScreen();
  scrollToElement("student-wrong-review-screen");
}

async function initializeStudentQuizPage() {
  if (getCurrentRole() !== "student") {
    return;
  }

  if (!studentQuizState.initialized) {
    studentQuizState.initialized = true;
    studentQuizState.grade = getInitialStudentQuizGrade();
    studentQuizState.subject = STUDENT_QUIZ_DEFAULTS.subject;
  }

  updateStudentQuizControls();

  const currentTopicsKey = `${studentQuizState.grade}:${studentQuizState.subject}`;

  if (
    !studentQuizState.topics.length ||
    studentQuizState.loadedTopicsKey !== currentTopicsKey
  ) {
    await loadStudentQuizTopics();
  } else {
    renderStudentTopicCards();
    renderStudentQuizFlow();
  }
}

function openSubject(subject) {
  if (subject) {
    studentQuizState.subject =
      normalizeQuizText(subject) || STUDENT_QUIZ_DEFAULTS.subject;
    updateStudentQuizControls();
  }

  studentQuizState.topics = [];
  studentQuizState.loadedTopicsKey = "";
  changePage("subjects");
}

function showSubject(subject, button) {
  if (button) {
    document
      .querySelectorAll(".quiz-subject-tab")
      .forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
  }

  if (subject) {
    studentQuizState.subject =
      normalizeQuizText(subject) || STUDENT_QUIZ_DEFAULTS.subject;
    updateStudentQuizControls();
    studentQuizState.topics = [];
    studentQuizState.loadedTopicsKey = "";
    void loadStudentQuizTopics();
  }
}

function goBackSubjects() {
  changePage(previousPage === "subjects" ? "student-home" : previousPage);
}

document.addEventListener("click", (event) => {
  const topicCard = event.target.closest("[data-topic-id]");

  if (topicCard && getStudentQuizRoot()?.contains(topicCard)) {
    if (topicCard.disabled) {
      showToast("Chủ đề này chưa có quiz được tạo.", "error");
      return;
    }
    void loadStudentQuizByTopic(topicCard.dataset.topicId);
    return;
  }

  const optionButton = event.target.closest(
    "[data-question-index][data-option-label]",
  );

  if (optionButton && getStudentQuizScreen()?.contains(optionButton)) {
    if (studentQuizState.isSubmitted) {
      return;
    }

    const questionIndex = Number(optionButton.dataset.questionIndex);
    const selected = normalizeQuizText(
      optionButton.dataset.optionLabel,
    ).toUpperCase();

    if (Number.isNaN(questionIndex) || !selected) {
      return;
    }

    setStudentQuizAnswer(questionIndex, selected);
    renderStudentQuizFlow();
    return;
  }

  const actionButton = event.target.closest("[data-action]");

  if (actionButton && getStudentQuizRoot()?.contains(actionButton)) {
    const action = actionButton.dataset.action;

    if (action === "submit-quiz") {
      void submitStudentQuiz();
    }

    if (action === "show-wrong-review") {
      showStudentWrongAnswerReview();
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const gradeSelect = getStudentQuizGradeSelect();
  const subjectSelect = getStudentQuizSubjectSelect();
  const loadButton = getStudentQuizLoadButton();

  if (gradeSelect) {
    gradeSelect.value = studentQuizState.grade;
    gradeSelect.addEventListener("change", () => {
      studentQuizState.grade =
        normalizeQuizText(gradeSelect.value) || STUDENT_QUIZ_DEFAULTS.grade;
      void loadStudentQuizTopics();
    });
  }

  if (subjectSelect) {
    subjectSelect.value = studentQuizState.subject;
    subjectSelect.addEventListener("change", () => {
      studentQuizState.subject =
        normalizeQuizText(subjectSelect.value) || STUDENT_QUIZ_DEFAULTS.subject;
      void loadStudentQuizTopics();
    });
  }

  if (loadButton) {
    loadButton.addEventListener("click", () => {
      void loadStudentQuizTopics();
    });
  }
});

// ======================
// AI COACH
// ======================

function openAICoach(subject) {
  if (subject === "math") {
    showOnly("ai-math");
  }

  if (subject === "english") {
    showOnly("ai-english");
  }
}

function goBackAI() {
  showOnly("ai-coach");
}

// ======================
// HOME
// ======================

function goHome() {
  changePage("student-home");
}
let createMethod = "manual";

document.addEventListener("DOMContentLoaded", () => {
  ensureAssignmentService();
  syncManualAssignmentMethodCards();

  const classroomCards = document.querySelectorAll(".classroom-card");

  classroomCards.forEach((card) => {
    card.addEventListener("click", () => {
      renderClassroom(card.dataset.classId);
    });
  });

  const classroomCreateBtn = document.querySelector(".classroom-create-btn");

  if (classroomCreateBtn) {
    classroomCreateBtn.addEventListener("click", () => {
      showToast("Đang mở form tạo lớp...");
    });
  }

  const classroomToggleBtn = document.querySelector(".classroom-toggle-btn");

  if (classroomToggleBtn) {
    classroomToggleBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleClassroomDropdown();
    });
  }

  const classroomCopyBtn = document.querySelector(".classroom-copy-btn");

  if (classroomCopyBtn) {
    classroomCopyBtn.addEventListener("click", copyClassroomCode);
  }

  const joinClassBtn = document.getElementById("join-class-btn");
  const joinClassInput = document.getElementById("join-class-code");

  if (joinClassBtn && joinClassInput) {
    joinClassBtn.addEventListener("click", () => {
      const code = joinClassInput.value.trim().toUpperCase();

      if (!code) {
        showToast("Nhập mã lớp trước khi tham gia.", "error");
        return;
      }

      console.log("[JoinClass] button clicked", {
        classCode: code,
        studentId: getCurrentUserId(),
      });
      console.log("[EduKids][classroom] join class shortcut submit", {
        classCode: code,
        studentId: getCurrentUserId(),
      });

      void apiRequestWithAuth("/api/classes/join", {
        method: "POST",
        body: { classCode: code },
      })
        .then(() => {
          console.log("[JoinClass] api response", {
            classCode: code,
            studentId: getCurrentUserId(),
          });
          showToast(`Đã tham gia lớp <b>${escapeHtml(code)}</b>`, "success");
          joinClassInput.value = "";
          toggleClassroomDropdown(false);
          void (async () => {
            await loadClassroomData({ forceRefresh: true });
            if (isStudentView()) {
              await refreshStudentAssignments();
            }
            console.log("[JoinClass] firestore update success", {
              classCode: code,
              studentId: getCurrentUserId(),
            });
          })();
        })
        .catch((error) => {
          showToast(error.message || "Không thể tham gia lớp học.", "error");
        });
    });
  }

  document.addEventListener("click", (event) => {
    const wrapper = document.querySelector(".classroom-join-wrapper");

    if (wrapper && !wrapper.contains(event.target)) {
      toggleClassroomDropdown(false);
    }
  });

  renderClassroom(getActiveClassroomId("DOMContentLoaded:renderClassroom"));
  initializeStudentAssignments();
  void initializeTeacherAssignmentForm();
  void initializeManualAssignmentBuilder();
  void refreshTeacherAssignments();
});

document.addEventListener(
  "DOMContentLoaded",
  () => {
    const classroomCreateBtn = document.querySelector(".classroom-create-btn");

    if (classroomCreateBtn) {
      classroomCreateBtn.addEventListener(
        "click",
        (event) => {
          event.stopImmediatePropagation();
          event.preventDefault();
          openCreateClassModal();
        },
        true,
      );
    }

    void loadClassroomData();
  },
  { once: true },
);

function goBackPage() {
  changePage(previousPage);
}

window.goBackPage = goBackPage;

function showOnly(pageId) {
  changePage(pageId);
}

// ======================
// STUDENT CLASSES + ASSIGNMENTS
// ======================

const studentAssignmentState = {
  classes: [],
  activeClassId: "",
  assignments: [],
  unsubscribe: null,
  isLoading: false,
  loadError: "",
  assignmentError: "",
};

function getAssignmentService() {
  return window.EduKidsAssignmentService || null;
}

function isStudentView() {
  return getCurrentRole() === "student";
}

function getAssignmentStatus(assignment) {
  const rawStatus = String(assignment?.status || "").toLowerCase();

  if (
    rawStatus === "doing" ||
    rawStatus === "done" ||
    rawStatus === "pending"
  ) {
    return rawStatus;
  }

  return "pending";
}

function getAssignmentTabElement(status) {
  return document.querySelector(
    `.assignment-tab[data-assignment-status="${status}"]`,
  );
}

function renderAssignmentTab(status, assignments) {
  const tab = getAssignmentTabElement(status);

  if (!tab) {
    return;
  }

  const list = tab.querySelector(".assignment-list");

  if (!list) {
    return;
  }

  if (assignments.length === 0) {
    list.innerHTML = `
      <div class="assignment-empty">
        ${
          studentAssignmentState.assignmentError
            ? escapeHtml(studentAssignmentState.assignmentError)
            : "Chưa có bài tập nào trong mục này."
        }
      </div>
    `;
    return;
  }

  list.innerHTML = assignments
    .map((assignment) => {
      const title = escapeHtml(assignment.title || "Bài tập");
      const teacherName = escapeHtml(assignment.teacherName || "Giáo viên");
      const className = escapeHtml(assignment.className || "Lớp học");
      const subject = escapeHtml(assignment.subject || "Chung");
      const dueDate = assignment.dueDate
        ? escapeHtml(assignment.dueDate)
        : "Chưa có hạn nộp";
      const statusLabel =
        status === "done"
          ? "Hoàn thành"
          : status === "doing"
            ? "Đang làm"
            : "Chưa làm";

      return `
        <article class="assignment-item">
          <div class="assignment-left">
            <div class="subject-icon math">📘</div>
            <div class="assignment-info">
              <h3>${title}</h3>
              <p>${subject} ⬢ ${teacherName}</p>
              <small>Hạn nộp: ${dueDate}</small>
              <div class="assignment-source">
                <span class="assignment-badge">${className}</span>
              </div>
            </div>
          </div>
          <div class="assignment-right">
            <span class="status ${status}">${statusLabel}</span>
            <button class="action-btn" type="button">Xem bài</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAssignmentsFeed(assignments) {
  const visibleAssignments = studentAssignmentState.activeClassId
    ? assignments.filter(
        (assignment) =>
          assignment.classId === studentAssignmentState.activeClassId,
      )
    : assignments;

  const grouped = {
    pending: [],
    doing: [],
    done: [],
  };

  visibleAssignments.forEach((assignment) => {
    const status = getAssignmentStatus(assignment);
    grouped[status].push(assignment);
  });

  logEduKidsDebugSnapshot("Assignment Count", {
    visibleAssignments: visibleAssignments.map((assignment) => ({
      id: assignment.id,
      classId: assignment.classId,
      teacherId: assignment.teacherId,
      title: assignment.title,
    })),
  });

  renderAssignmentTab("pending", grouped.pending);
  renderAssignmentTab("doing", grouped.doing);
  renderAssignmentTab("done", grouped.done);
}

function renderClassSwitcher() {
  const switcher = document.getElementById("student-class-switcher");

  if (!switcher) {
    return;
  }

  if (
    studentAssignmentState.isLoading &&
    studentAssignmentState.classes.length === 0
  ) {
    switcher.innerHTML = `
      <button type="button" class="student-class-switcher-btn" disabled>
        Đang tải lớp...
      </button>
    `;
    return;
  }

  if (!studentAssignmentState.classes.length) {
    switcher.innerHTML = `
      <button type="button" class="student-class-switcher-btn" disabled>
        ${studentAssignmentState.loadError ? "Không tải được lớp" : "Chưa tham gia lớp nào"}
      </button>
    `;
    return;
  }

  const activeClass =
    studentAssignmentState.classes.find(
      (item) => item.id === studentAssignmentState.activeClassId,
    ) || studentAssignmentState.classes[0];

  const menuItems = studentAssignmentState.classes
    .map(
      (classroom) => `
        <button type="button" data-class-switch-id="${classroom.id}">
          ${escapeHtml(classroom.name || classroom.className || "Lớp học")}
        </button>
      `,
    )
    .join("");

  switcher.innerHTML = `
    <button type="button" class="student-class-switcher-btn" data-class-switch-toggle>
      <span>${escapeHtml(activeClass.name || activeClass.className || "Lớp học")}</span>
      <span class="class-switcher-arrow">▾</span>
    </button>
    <div class="student-class-switcher-menu">
      ${menuItems}
      <div class="student-class-menu-divider"></div>
      <button type="button" data-class-switch-join>Tham gia lớp học</button>
    </div>
  `;

  switcher
    .querySelector("[data-class-switch-toggle]")
    ?.addEventListener("click", (event) => {
      event.stopPropagation();
      switcher.classList.toggle("is-open");
    });

  switcher.querySelectorAll("[data-class-switch-id]").forEach((button) => {
    button.addEventListener("click", () => {
      studentAssignmentState.activeClassId = button.dataset.classSwitchId || "";
      switcher.classList.remove("is-open");
      renderClassSwitcher();
      renderAssignmentsFeed(studentAssignmentState.assignments);
    });
  });

  switcher
    .querySelector("[data-class-switch-join]")
    ?.addEventListener("click", () => {
      switcher.classList.remove("is-open");
      openJoinClassModal();
    });
}

function closeClassSwitcherOnOutsideClick() {
  document.addEventListener("click", (event) => {
    const switcher = document.getElementById("student-class-switcher");

    if (switcher && !switcher.contains(event.target)) {
      switcher.classList.remove("is-open");
    }
  });
}

async function loadStudentClasses() {
  const userId = getCurrentUserId();
  console.log("[StudentAssignments] loadStudentClasses start", { userId });
  logEduKidsDebugSnapshot("Current Role");
  logEduKidsDebugSnapshot("Current UserId");

  studentAssignmentState.isLoading = true;
  studentAssignmentState.loadError = "";
  renderClassSwitcher();

  try {
    const result = await apiRequestWithAuth("/api/classes/my", {
      method: "GET",
    });

    const classes = Array.isArray(result?.data)
      ? sortClassroomRecords(result.data)
      : [];
    studentAssignmentState.classes = classes;
    studentAssignmentState.loadError = "";

    console.log("[StudentAssignments] loadStudentClasses result", {
      classCount: classes.length,
      classIds: classes.map((item) => item.id).filter(Boolean),
    });
    const joinedClassIds = classes.map((item) => item.id).filter(Boolean);

    logEduKidsDebugSnapshot("Student Classes", {
      classCount: classes.length,
      classIds: joinedClassIds,
    });
    console.log("[StudentAssignments] joinedClassIds", {
      userId,
      joinedClassIds,
    });

    if (!studentAssignmentState.activeClassId && classes.length > 0) {
      studentAssignmentState.activeClassId = classes[0].id;
    }

    if (
      studentAssignmentState.activeClassId &&
      !classes.some((item) => item.id === studentAssignmentState.activeClassId)
    ) {
      studentAssignmentState.activeClassId = classes[0]?.id || "";
    }

    return classes;
  } catch (error) {
    studentAssignmentState.loadError =
      error?.message || "Không thể tải lớp học";
    studentAssignmentState.assignmentError = studentAssignmentState.loadError;
    console.warn("[StudentAssignments] loadStudentClasses failed", error);

    if (!studentAssignmentState.classes.length) {
      studentAssignmentState.activeClassId = "";
    }

    return studentAssignmentState.classes;
  } finally {
    studentAssignmentState.isLoading = false;
    renderClassSwitcher();
  }
}

function syncAssignmentListener() {
  const service = getAssignmentService();

  if (!service?.listenAssignments) {
    console.log("[EduKids][studentAssignments] listenAssignments unavailable");
    studentAssignmentState.assignmentError = "Dịch vụ bài tập chưa sẵn sàng.";
    studentAssignmentState.assignments = [];
    renderAssignmentsFeed([]);
    return;
  }

  if (typeof studentAssignmentState.unsubscribe === "function") {
    studentAssignmentState.unsubscribe();
  }

  const classIds = studentAssignmentState.classes
    .map((item) => item.id)
    .filter(Boolean);

  console.log("[StudentAssignments] syncAssignmentListener", {
    activeClassId: studentAssignmentState.activeClassId || "",
    classIds,
  });

  if (classIds.length === 0) {
    studentAssignmentState.assignments = [];
    studentAssignmentState.assignmentError = "";
    renderAssignmentsFeed([]);
    return;
  }

  studentAssignmentState.unsubscribe = service.listenAssignments(
    classIds,
    (assignments, errors = []) => {
      studentAssignmentState.assignments = Array.isArray(assignments)
        ? assignments
        : [];
      studentAssignmentState.assignmentError =
        Array.isArray(errors) && errors.length
          ? errors[0]?.message || "Không thể tải bài tập."
          : "";
      console.log("[StudentAssignments] assignments found", {
        assignmentCount: studentAssignmentState.assignments.length,
        assignmentIds: studentAssignmentState.assignments
          .map((item) => item.id)
          .filter(Boolean),
        errorCount: Array.isArray(errors) ? errors.length : 0,
      });
      renderAssignmentsFeed(studentAssignmentState.assignments);
    },
  );
}

async function refreshStudentAssignments() {
  if (!isStudentView()) {
    return;
  }

  console.log("[StudentAssignments] refreshStudentAssignments start", {
    userId: getCurrentUserId(),
  });
  await loadStudentClasses();
  syncAssignmentListener();
  logEduKidsDebugSnapshot("Joined Classes");
}

function openJoinClassModal() {
  const modal = createModal(
    "Tham gia lớp học",
    `
      <form class="join-class-form" id="join-class-form">
        <label for="join-class-code-input" class="auth-field-label">Mã lớp (classCode)</label>
        <input
          id="join-class-code-input"
          type="text"
          placeholder="Nhập mã lớp"
          autocomplete="off"
          maxlength="6"
          class="auth-input"
        />
        <button type="submit" class="btn-primary">Tham gia lớp học</button>
      </form>
    `,
  );

  const form = modal.querySelector("#join-class-form");
  const input = modal.querySelector("#join-class-code-input");

  setTimeout(() => input?.focus(), 50);

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const classCode = String(input?.value || "")
      .trim()
      .toUpperCase();

    if (!classCode) {
      showToast("Nhập mã lớp trước khi tham gia.", "error");
      return;
    }

    try {
      console.log("[EduKids][studentAssignments] joinClass submit", {
        classCode,
        studentId: getCurrentUserId(),
      });
      console.log("[JoinClass] button clicked", {
        classCode,
        studentId: getCurrentUserId(),
      });
      await apiRequestWithAuth("/api/classes/join", {
        method: "POST",
        body: { classCode },
      });
      console.log("[JoinClass] api response", {
        classCode,
        studentId: getCurrentUserId(),
      });

      modal.remove();
      showToast(`Đã tham gia lớp <b>${escapeHtml(classCode)}</b>`, "success");
      await loadClassroomData({ forceRefresh: true });
      await refreshStudentAssignments();
      console.log("[JoinClass] firestore update success", {
        classCode,
        studentId: getCurrentUserId(),
      });
    } catch (error) {
      showToast(error.message || "Không thể tham gia lớp học.", "error");
    }
  });
}

function showAssignmentTab(status, button) {
  document
    .querySelectorAll(".assignment-tab-btn")
    .forEach((item) => item.classList.remove("active"));
  document
    .querySelectorAll(".assignment-tab")
    .forEach((tab) => tab.classList.remove("active"));

  button?.classList.add("active");
  document.getElementById(status)?.classList.add("active");
}

function initializeStudentAssignments() {
  const joinButton = document.getElementById("join-class-action-btn");

  if (joinButton) {
    joinButton.addEventListener("click", openJoinClassModal);
  }

  closeClassSwitcherOnOutsideClick();
  void refreshStudentAssignments();
}

async function initializeTeacherAssignmentForm() {
  const form =
    document.querySelector("#create-assignment-form") ||
    document.querySelector(".create-assignment-form") ||
    document.querySelector("[data-create-assignment-form]");

  if (!form || getCurrentRole() !== "teacher") {
    return;
  }

  const classSelect =
    form.querySelector('[name="classId"]') ||
    form.querySelector("#assignment-class-id") ||
    form.querySelector("[data-assignment-class-id]");

  if (classSelect && classSelect.tagName === "SELECT") {
    try {
      const classrooms = syncTeacherAssignmentClassSelect();

      if (classrooms.length === 0 && classroomState.length === 0) {
        const result = await apiRequestWithAuth("/api/classes/my", {
          method: "GET",
        });
        commitClassroomState(Array.isArray(result?.data) ? result.data : [], {
          source: "teacher-assignment-fallback",
        });
        syncTeacherAssignmentClassSelect();
      }
    } catch (error) {
      console.warn("Không thể tải danh sách lớp cho form tạo bài tập:", error);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!window.EduKidsAssignmentService?.createAssignment) {
      showToast("Dịch vụ tạo bài tập chưa sẵn sàng.", "error");
      return;
    }

    const payload = {
      classId:
        form.querySelector('[name="classId"]')?.value ||
        form.querySelector("#assignment-class-id")?.value ||
        "",
      title:
        form.querySelector('[name="title"]')?.value ||
        form.querySelector('[name="assignmentTitle"]')?.value ||
        "",
      description:
        form.querySelector('[name="description"]')?.value ||
        form.querySelector('[name="assignmentDescription"]')?.value ||
        "",
      dueDate:
        form.querySelector('[name="dueDate"]')?.value ||
        form.querySelector('[name="deadline"]')?.value ||
        "",
      subject:
        form.querySelector('[name="subject"]')?.value ||
        form.querySelector('[name="assignmentSubject"]')?.value ||
        "",
      points: Number(
        form.querySelector('[name="points"]')?.value ||
          form.querySelector('[name="score"]')?.value ||
          0,
      ),
    };

    if (!payload.classId || !payload.title) {
      showToast("Vui lòng chọn lớp và nhập tiêu đề bài tập.", "error");
      return;
    }

    try {
      console.log("[EduKids][teacherAssignments] createAssignment submit", {
        teacherId: getCurrentUserId(),
        classId: payload.classId,
        title: payload.title,
      });
      const createdAssignment =
        await window.EduKidsAssignmentService.createAssignment(payload);
      console.log("[Assignment] created", {
        assignmentId: createdAssignment?.id || "",
        classId: payload.classId,
        teacherId: getCurrentUserId(),
      });
      showToast("Đã lưu bài tập vào lớp đã chọn.", "success");
      form.reset();
      await refreshTeacherAssignments();
    } catch (error) {
      showToast(error.message || "Không thể tạo bài tập.", "error");
    }
  });
}

const manualAssignmentState = {
  classes: [],
  classId: "",
  className: "",
  title: "",
  description: "",
  subject: "Math",
  dueDate: "",
  questions: [createManualQuestion(1)],
};

function getCurrentUserId() {
  const user = getCurrentAuthUser();

  return String(user?.userId || user?.uid || user?.id || "").trim();
}

function getFirebaseFirestore() {
  if (
    !window.firebase?.apps?.length ||
    typeof window.firebase.app !== "function"
  ) {
    return null;
  }

  if (typeof window.firebase.firestore !== "function") {
    return null;
  }

  return window.firebase.app().firestore();
}

function createManualQuestion(index = 1) {
  return {
    id: generateManualQuestionId(index),
    question: "",
    correctAnswer: "",
    wrongAnswer1: "",
    wrongAnswer2: "",
    wrongAnswer3: "",
  };
}

function generateManualQuestionId(index = 1) {
  if (window.crypto?.randomUUID) {
    return `question-${window.crypto.randomUUID()}`;
  }

  return `question-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

function resetManualAssignmentState() {
  manualAssignmentState.classId = "";
  manualAssignmentState.className = "";
  manualAssignmentState.title = "";
  manualAssignmentState.description = "";
  manualAssignmentState.subject = "Math";
  manualAssignmentState.dueDate = "";
  manualAssignmentState.questions = [createManualQuestion(1)];
}

function getSelectedManualAssignmentClass() {
  return (
    manualAssignmentState.classes.find(
      (item) => item.id === manualAssignmentState.classId,
    ) || null
  );
}

function syncManualAssignmentFormFields() {
  const titleInput = getManualAssignmentTitleInput();
  const subjectSelect = getManualAssignmentSubjectSelect();
  const classSelect = getManualAssignmentClassSelect();
  const dueDateInput = getManualAssignmentDueDateInput();

  if (titleInput) {
    titleInput.value = manualAssignmentState.title || "";
  }

  if (subjectSelect) {
    subjectSelect.value = manualAssignmentState.subject || "Math";
  }

  if (classSelect) {
    classSelect.value = manualAssignmentState.classId || "";
  }

  if (dueDateInput) {
    dueDateInput.value = manualAssignmentState.dueDate || "";
  }
}

function syncManualAssignmentMethodCards() {
  document.querySelectorAll("[data-create-method]").forEach((card) => {
    card.classList.toggle("active", card.dataset.method === createMethod);
  });
}

function getManualAssignmentDraft() {
  const selectedClass = getSelectedManualAssignmentClass();

  return {
    title: String(manualAssignmentState.title || "").trim(),
    description: String(manualAssignmentState.description || "").trim(),
    subject: String(manualAssignmentState.subject || "").trim(),
    classId: String(manualAssignmentState.classId || "").trim(),
    className: String(
      selectedClass?.name ||
        selectedClass?.className ||
        manualAssignmentState.className ||
        "",
    ).trim(),
    dueDate: String(manualAssignmentState.dueDate || "").trim(),
    questions: Array.isArray(manualAssignmentState.questions)
      ? manualAssignmentState.questions.map((question, index) => ({
          id: String(question?.id || generateManualQuestionId(index + 1)),
          question: String(question?.question || "").trim(),
          correctAnswer: String(question?.correctAnswer || "").trim(),
          wrongAnswer1: String(question?.wrongAnswer1 || "").trim(),
          wrongAnswer2: String(question?.wrongAnswer2 || "").trim(),
          wrongAnswer3: String(question?.wrongAnswer3 || "").trim(),
        }))
      : [],
  };
}

function readManualAssignmentDraftFromDom() {
  return getManualAssignmentDraft();
}

function updateManualAssignmentStateFromElement(target) {
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.matches("[data-manual-title]")) {
    manualAssignmentState.title = target.value;
    return;
  }

  if (target.matches("[data-manual-subject]")) {
    manualAssignmentState.subject = target.value || "Math";
    return;
  }

  if (target.matches("[data-manual-class-select]")) {
    manualAssignmentState.classId = target.value || "";
    const selectedClass = getSelectedManualAssignmentClass();
    manualAssignmentState.className =
      selectedClass?.name || selectedClass?.className || "";
    return;
  }

  if (target.matches("[data-manual-due-date]")) {
    manualAssignmentState.dueDate = target.value;
    return;
  }

  const block = target.closest("[data-question-block]");

  if (!block) {
    return;
  }

  const questionIndex = Number(block.dataset.questionIndex) - 1;
  const question = manualAssignmentState.questions[questionIndex];

  if (!question) {
    return;
  }

  const fieldName = target.getAttribute("name");

  if (!fieldName || !(fieldName in question)) {
    return;
  }

  question[fieldName] = target.value;
}

function normalizeSubjectLabel(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "math" ||
    normalized === "toĂ¡n" ||
    normalized === "toan"
  ) {
    return "Math";
  }

  if (
    normalized === "english" ||
    normalized === "tiếng anh" ||
    normalized === "tieng anh"
  ) {
    return "English";
  }

  return "";
}

function formatAssignmentDate(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("vi-VN");
}

function formatAssignmentStatusLabel(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "active") {
    return "Đang giao";
  }

  if (normalized === "draft") {
    return "Nháp";
  }

  if (normalized === "done" || normalized === "completed") {
    return "Hoàn thành";
  }

  return status || "--";
}

function shuffleArray(items) {
  const array = Array.isArray(items) ? [...items] : [];

  for (let index = array.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[randomIndex]] = [array[randomIndex], array[index]];
  }

  return array;
}

function getManualAssignmentCard() {
  return document.querySelector("[data-manual-assignment-root]");
}

function getManualAssignmentForm() {
  return document.getElementById("manual-assignment-form");
}

function getManualAssignmentQuestionList() {
  return document.querySelector("[data-manual-question-list]");
}

function getManualAssignmentPreviewPanel() {
  return document.querySelector("[data-manual-preview-panel]");
}

function getManualAssignmentClassSelect() {
  return document.querySelector("[data-manual-class-select]");
}

function getManualAssignmentTitleInput() {
  return document.querySelector("[data-manual-title]");
}

function getManualAssignmentSubjectSelect() {
  return document.querySelector("[data-manual-subject]");
}

function getManualAssignmentDueDateInput() {
  return document.querySelector("[data-manual-due-date]");
}

function renderManualQuestionBlock(question, index) {
  const questionNumber = index + 1;

  return `
    <article class="manual-question-card" data-question-block data-question-index="${questionNumber}" data-question-id="${escapeHtml(question.id || "")}">
      <div class="manual-question-card-head">
        <span class="manual-question-badge">Câu ${questionNumber}</span>
        <button
          type="button"
          class="manual-question-remove"
          data-manual-remove-question
          aria-label="Xoá câu ${questionNumber}"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div class="manual-question-field">
        <label class="auth-field-label" for="manual-question-${questionNumber}">Câu hỏi</label>
        <input
          id="manual-question-${questionNumber}"
          class="auth-input manual-question-input"
          type="text"
          name="question"
          placeholder="Nhập câu hỏi của bạn..."
          value="${escapeHtml(question.question)}"
        />
      </div>

      <div class="manual-answer-grid">
        <div class="manual-answer-field is-correct">
          <label class="auth-field-label" for="manual-correct-${questionNumber}">Đáp án đúng</label>
          <input
            id="manual-correct-${questionNumber}"
            class="auth-input manual-answer-input"
            type="text"
            name="correctAnswer"
            placeholder="Nhập đáp án đúng"
            value="${escapeHtml(question.correctAnswer)}"
          />
        </div>

        <div class="manual-answer-field is-wrong">
          <label class="auth-field-label" for="manual-wrong-1-${questionNumber}">Đáp án sai 1</label>
          <input
            id="manual-wrong-1-${questionNumber}"
            class="auth-input manual-answer-input"
            type="text"
            name="wrongAnswer1"
            placeholder="Nhập đáp án sai"
            value="${escapeHtml(question.wrongAnswer1)}"
          />
        </div>

        <div class="manual-answer-field is-wrong">
          <label class="auth-field-label" for="manual-wrong-2-${questionNumber}">Đáp án sai 2</label>
          <input
            id="manual-wrong-2-${questionNumber}"
            class="auth-input manual-answer-input"
            type="text"
            name="wrongAnswer2"
            placeholder="Nhập đáp án sai"
            value="${escapeHtml(question.wrongAnswer2)}"
          />
        </div>

        <div class="manual-answer-field is-wrong">
          <label class="auth-field-label" for="manual-wrong-3-${questionNumber}">Đáp án sai 3</label>
          <input
            id="manual-wrong-3-${questionNumber}"
            class="auth-input manual-answer-input"
            type="text"
            name="wrongAnswer3"
            placeholder="Nhập đáp án sai"
            value="${escapeHtml(question.wrongAnswer3)}"
          />
        </div>
      </div>
    </article>
  `;
}

function renderManualQuestionList() {
  const list = getManualAssignmentQuestionList();

  if (!list) {
    return;
  }

  list.innerHTML = manualAssignmentState.questions
    .map((question, index) => renderManualQuestionBlock(question, index))
    .join("");
}

function renderManualAssignmentShell() {
  const card = getManualAssignmentCard();

  if (!card) {
    return;
  }

  card.innerHTML = `
    <div class="create-assignment-shell">
      <div class="create-assignment-layout">
        <section class="create-assignment-main">
          <header class="create-assignment-hero">
            <div class="create-assignment-hero-icon" aria-hidden="true">
              <span>✦</span>
            </div>

            <div class="create-assignment-hero-copy">
              <h1>Tạo bài tập mới</h1>
              <p>Tạo bài tập thủ công hoặc bằng AI nhanh chóng</p>
            </div>
          </header>

          <form id="manual-assignment-form" class="manual-assignment-form">
            <section class="manual-assignment-section manual-assignment-section-card">
              <div class="manual-assignment-meta">
                <div class="auth-field">
                  <label class="auth-field-label" for="manual-assignment-title">Tên bài tập</label>
                  <input
                    id="manual-assignment-title"
                    class="auth-input"
                    type="text"
                    placeholder="Nhập tên bài tập"
                    data-manual-title
                  />
                </div>

                <div class="auth-field">
                  <label class="auth-field-label" for="manual-assignment-subject">Môn</label>
                  <select id="manual-assignment-subject" class="auth-input" data-manual-subject>
                    <option value="Math">Toán</option>
                    <option value="English">Tiếng Anh</option>
                  </select>
                </div>

                <div class="auth-field">
                  <label class="auth-field-label" for="manual-assignment-class">Lớp</label>
                  <select id="manual-assignment-class" class="auth-input" data-manual-class-select>
                    <option value="">Đang tải lớp...</option>
                  </select>
                </div>

                <div class="auth-field">
                  <label class="auth-field-label" for="manual-assignment-due-date">Hạn nộp</label>
                  <input
                    id="manual-assignment-due-date"
                    class="auth-input"
                    type="date"
                    data-manual-due-date
                  />
                </div>
              </div>
            </section>

            <section class="manual-assignment-section">
              <div class="manual-section-heading">
                <h2>Chọn cách tạo bài tập</h2>
              </div>

              <div class="create-methods">
                <div class="create-method active" data-create-method data-method="manual">
                  <div class="create-method-icon create-method-icon-manual" aria-hidden="true">
                    <span>✎</span>
                  </div>
                  <div class="create-method-copy">
                    <h3>Tự tạo</h3>
                    <p>Tự tạo câu hỏi và đáp án thủ công</p>
                  </div>
                  <span class="create-method-check" aria-hidden="true">✓</span>
                </div>

                <div class="create-method" data-create-method data-method="ai">
                  <div class="create-method-icon create-method-icon-ai" aria-hidden="true">
                    <span>AI</span>
                  </div>
                  <div class="create-method-copy">
                    <h3>Tạo bằng AI</h3>
                    <p>AI sẽ tạo câu hỏi dựa trên chủ đề của bạn</p>
                  </div>
                </div>
              </div>
            </section>

            <section class="manual-assignment-section">
              <div class="manual-section-heading">
                <h2>Nội dung bài tập</h2>
              </div>
              <div class="manual-assignment-question-list" data-manual-question-list></div>
            </section>

            <div class="manual-assignment-actions">
              <div class="manual-assignment-actions-row">
                <button type="button" class="manual-btn manual-btn-secondary" data-manual-add-question>
                  + Thêm câu
                </button>
              </div>

              <button type="submit" class="manual-btn manual-btn-primary">Tạo bài tập</button>
            </div>
          </form>
        </section>

        <aside class="manual-preview-panel" data-manual-preview-panel>
          <div class="manual-preview-card">
            <div class="manual-preview-header">
              <div class="manual-preview-icon" aria-hidden="true">✦</div>
              <h2>Xem trước đề</h2>
            </div>
            <div class="manual-preview-content"></div>
          </div>
        </aside>
      </div>
    </div>
  `;
}

async function loadManualAssignmentClasses() {
  const classSelect = getManualAssignmentClassSelect();

  if (!classSelect) {
    return [];
  }

  try {
    classSelect.disabled = true;
    const classes = syncManualAssignmentClassOptions();

    if (classes.length === 0 && classroomState.length === 0) {
      const result = await apiRequestWithAuth("/api/classes/my", {
        method: "GET",
      });
      commitClassroomState(Array.isArray(result?.data) ? result.data : [], {
        source: "manual-assignment-fallback",
      });
      syncManualAssignmentClassOptions();
    }
  } catch (error) {
    console.warn("Không thể tải danh sách lớp cho bài tập thủ công:", error);
    classSelect.innerHTML = `
      <option value="">Không thể tải danh sách lớp.</option>
    `;
    manualAssignmentState.classId = "";
    manualAssignmentState.className = "";
    classSelect.disabled = true;
  }

  syncManualAssignmentPreview();
  return manualAssignmentState.classes;
}

function createManualAssignmentPreviewHtml(draft) {
  const previewQuestions = (draft.questions || []).map((question, index) => {
    const answers = [
      {
        key: "A",
        text: question.correctAnswer || "Chưa nhập đáp án đúng",
        isCorrect: true,
      },
      {
        key: "B",
        text: question.wrongAnswer1 || "Chưa nhập đáp án sai",
        isCorrect: false,
      },
      {
        key: "C",
        text: question.wrongAnswer2 || "Chưa nhập đáp án sai",
        isCorrect: false,
      },
      {
        key: "D",
        text: question.wrongAnswer3 || "Chưa nhập đáp án sai",
        isCorrect: false,
      },
    ];
    const letters = ["A", "B", "C", "D"];

    return `
      <section class="manual-preview-question">
        <div class="manual-preview-question-head">
          <span class="manual-preview-badge">Câu ${index + 1}</span>
          <p class="manual-preview-question-text">${escapeHtml(
            question.question || "Chưa nhập câu hỏi",
          )}</p>
        </div>
        <div class="manual-preview-answer-list">
          ${answers
            .map(
              (answer, answerIndex) => `
                <div class="manual-preview-answer ${answer.isCorrect ? "is-correct" : "is-wrong"}">
                  <span class="manual-preview-answer-key">${letters[answerIndex]}</span>
                  <span class="manual-preview-answer-text">${escapeHtml(answer.text)}</span>
                  ${answer.isCorrect ? '<span class="manual-preview-answer-mark">✓</span>' : ""}
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  });

  const subjectLabel =
    draft.subject === "Math"
      ? "Toán"
      : draft.subject === "English"
        ? "Tiếng Anh"
        : "--";

  const meta = `
    <div class="manual-preview-summary">
      <h3>${escapeHtml(draft.title || "Chưa có tên bài tập")}</h3>
      <p>Môn: ${escapeHtml(subjectLabel)}</p>
      <p>Lớp: ${escapeHtml(draft.className || "--")}</p>
      <p>Hạn nộp: ${escapeHtml(draft.dueDate || "--")}</p>
    </div>
  `;

  return `${meta}${previewQuestions.join("")}`;
}

function syncManualAssignmentPreview() {
  const panel = getManualAssignmentPreviewPanel();

  if (!panel) {
    return;
  }

  const content = panel.querySelector(".manual-preview-content");

  if (!content) {
    return;
  }

  const draft = getManualAssignmentDraft();
  content.innerHTML = createManualAssignmentPreviewHtml(draft);
}

function validateManualAssignmentDraft(draft) {
  if (!draft.title) {
    return "Vui lòng nhập tên bài tập.";
  }

  if (!draft.subject) {
    return "Vui lòng chọn môn học.";
  }

  if (!draft.classId) {
    return "Vui lòng chọn lớp học.";
  }

  if (!draft.dueDate) {
    return "Vui lòng chọn hạn nộp.";
  }

  if (!Array.isArray(draft.questions) || draft.questions.length === 0) {
    return "Vui lòng thêm ít nhất 1 câu hỏi.";
  }

  for (let index = 0; index < draft.questions.length; index += 1) {
    const question = draft.questions[index];

    if (!question.question) {
      return `Câu ${index + 1}: vui lòng nhập nội dung câu hỏi.`;
    }

    if (!question.correctAnswer) {
      return `Câu ${index + 1}: vui lòng nhập câu trả lời đúng.`;
    }

    if (
      !question.wrongAnswer1 ||
      !question.wrongAnswer2 ||
      !question.wrongAnswer3
    ) {
      return `Câu ${index + 1}: vui lòng nhập đủ 3 đáp án sai.`;
    }
  }

  return "";
}

function normalizeManualAssignmentQuestions(questions) {
  return questions.map((question, index) => {
    const options = [
      String(question?.correctAnswer || "").trim(),
      String(question?.wrongAnswer1 || "").trim(),
      String(question?.wrongAnswer2 || "").trim(),
      String(question?.wrongAnswer3 || "").trim(),
    ];

    return {
      id: String(question?.id || generateManualQuestionId(index + 1)),
      question: String(question?.question || "").trim(),
      options,
      correctAnswer: options[0],
    };
  });
}

let teacherAssignmentsUnsubscribe = null;

async function refreshTeacherAssignments() {
  if (getCurrentRole() !== "teacher") {
    return;
  }

  const list = document.querySelector("#manage .manage-list");
  const service = getAssignmentService();

  if (!service?.getTeacherAssignments) {
    if (list) {
      list.innerHTML = `
      <div class="manage-empty-state">
        <h3>Không thể tải bài tập.</h3>
        <p>Dịch vụ bài tập chưa sẵn sàng.</p>
      </div>
    `;
    }
    return;
  }

  const teacherId = getCurrentUserId();

  if (!teacherId || !list) {
    return;
  }

  console.log("[EduKids][teacherAssignments] refreshTeacherAssignments start", {
    teacherId,
  });
  logEduKidsDebugSnapshot("Teacher Assignments", { teacherId });

  if (typeof teacherAssignmentsUnsubscribe === "function") {
    teacherAssignmentsUnsubscribe();
  }

  const renderAssignments = (assignments, errors = []) => {
    const hasErrors = Array.isArray(errors) && errors.length > 0;

    console.log("[EduKids][teacherAssignments] assignments updated", {
      teacherId,
      assignmentCount: Array.isArray(assignments) ? assignments.length : 0,
      assignmentIds: Array.isArray(assignments)
        ? assignments.map((item) => item.id).filter(Boolean)
        : [],
      errorCount: hasErrors ? errors.length : 0,
    });

    window.__edukidsTeacherAssignments = Array.isArray(assignments)
      ? assignments
      : [];

    console.log("[Assignment] assignments found", {
      teacherId,
      assignmentCount: Array.isArray(assignments) ? assignments.length : 0,
      assignmentIds: Array.isArray(assignments)
        ? assignments.map((item) => item.id).filter(Boolean)
        : [],
      errorCount: hasErrors ? errors.length : 0,
    });

    if (
      hasErrors &&
      (!Array.isArray(assignments) || assignments.length === 0)
    ) {
      list.innerHTML = `
        <div class="manage-empty-state">
          <h3>Không thể tải bài tập.</h3>
          <p>${escapeHtml(errors[0]?.message || "Lỗi đồng bộ Firestore.")}</p>
        </div>
      `;
      return;
    }

    if (!Array.isArray(assignments) || assignments.length === 0) {
      list.innerHTML = `
        <div class="manage-empty-state">
          <h3>Chưa có bài tập nào.</h3>
          <p>Bài tập sẽ được xuất hiện ở đây sau khi bạn lưu.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = assignments
      .map((assignment) => {
        const questionCount =
          Number(assignment.totalQuestions || assignment.questionCount) ||
          (Array.isArray(assignment.questions)
            ? assignment.questions.length
            : 0);

        return `
          <article class="manage-card">
            <div class="manage-card-top">
              <div>
                <h3>${escapeHtml(assignment.title || "Bài tập")}</h3>
                <p>${escapeHtml(assignment.className || "Lớp học")}</p>
              </div>
              <span class="manage-date">Ngày giao: ${escapeHtml(formatAssignmentDate(assignment.createdAt))}</span>
            </div>

            <div class="manage-card-meta">
              <span>${questionCount} câu hỏi</span>
              <strong>${escapeHtml(formatAssignmentStatusLabel(assignment.status))}</strong>
            </div>

            <div class="manage-progress">
              <div class="manage-progress-fill is-green" style="width: 0%"></div>
            </div>

            <div class="manage-card-actions">
              <button type="button" class="manage-detail-btn">
                Xem chi tiết
              </button>
            </div>
          </article>
        `;
      })
      .join("");
  };

  list.innerHTML = `
    <div class="manage-empty-state">
      <h3>Đang tải bài tập...</h3>
      <p>Vui lòng chờ trong giây lát.</p>
    </div>
  `;

  if (typeof service?.listenTeacherAssignments === "function") {
    teacherAssignmentsUnsubscribe = service.listenTeacherAssignments(
      teacherId,
      renderAssignments,
    );
    return;
  }

  try {
    const assignments = await service.getTeacherAssignments(teacherId);
    renderAssignments(assignments);
  } catch (error) {
    console.warn("Không thể tải danh sách bài tập của giáo viên:", error);
    window.__edukidsTeacherAssignments = [];
    list.innerHTML = `
      <div class="manage-empty-state">
        <h3>Không thể tải bài tập.</h3>
        <p>${escapeHtml(error?.message || "Vui lòng thử lại sau.")}</p>
      </div>
    `;
  }
}

async function initializeManualAssignmentBuilder() {
  if (getCurrentRole() !== "teacher") {
    return;
  }

  const card = getManualAssignmentCard();

  if (!card) {
    return;
  }

  renderManualAssignmentShell();
  renderManualQuestionList();
  syncManualAssignmentMethodCards();
  syncManualAssignmentFormFields();
  syncManualAssignmentPreview();

  await loadManualAssignmentClasses();
  syncManualAssignmentFormFields();

  const form = getManualAssignmentForm();

  if (!form) {
    return;
  }

  const handleDraftChange = (event) => {
    updateManualAssignmentStateFromElement(event.target);
    syncManualAssignmentMethodCards();
    syncManualAssignmentPreview();
  };

  form.addEventListener("input", handleDraftChange);
  form.addEventListener("change", handleDraftChange);

  form.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-manual-remove-question]");

    if (removeButton) {
      const block = removeButton.closest("[data-question-block]");
      const nextQuestions = manualAssignmentState.questions.filter(
        (_, index) =>
          !block || index !== Number(block.dataset.questionIndex) - 1,
      );

      manualAssignmentState.questions = nextQuestions.length
        ? nextQuestions.map((question, index) => ({
            ...question,
            id: question.id || generateManualQuestionId(index + 1),
          }))
        : [createManualQuestion(1)];

      renderManualQuestionList();
      syncManualAssignmentFormFields();
      syncManualAssignmentMethodCards();
      syncManualAssignmentPreview();
    }
  });

  form
    .querySelector("[data-manual-add-question]")
    ?.addEventListener("click", () => {
      manualAssignmentState.questions = manualAssignmentState.questions.length
        ? manualAssignmentState.questions.map((question, index) => ({
            ...question,
            id: question.id || generateManualQuestionId(index + 1),
          }))
        : [createManualQuestion(1)];
      manualAssignmentState.questions.push(
        createManualQuestion(manualAssignmentState.questions.length + 1),
      );
      renderManualQuestionList();
      syncManualAssignmentFormFields();
      syncManualAssignmentPreview();
    });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const draft = getManualAssignmentDraft();
    const validationMessage = validateManualAssignmentDraft(draft);

    if (validationMessage) {
      showToast(validationMessage, "error");
      return;
    }

    const service = getAssignmentService();

    if (!service?.createAssignment) {
      showToast("Dịch vụ tạo bài tập chưa sẵn sàng.", "error");
      return;
    }

    const selectedClass = manualAssignmentState.classes.find(
      (item) => item.id === draft.classId,
    );

    try {
      console.log("[EduKids][manualAssignment] createAssignment submit", {
        teacherId: getCurrentUserId(),
        classId: draft.classId,
        title: draft.title,
        questionCount: draft.questions.length,
      });
      const createdAssignment = await service.createAssignment({
        title: draft.title,
        description: draft.description || "",
        subject: draft.subject,
        classId: draft.classId,
        className:
          selectedClass?.name ||
          selectedClass?.className ||
          draft.className ||
          "",
        dueDate: draft.dueDate,
        teacherId: getCurrentUserId(),
        teacherName:
          getCurrentAuthUser()?.fullName ||
          getCurrentAuthUser()?.name ||
          getCurrentAuthUser()?.username ||
          "",
        totalQuestions: draft.questions.length,
        questions: normalizeManualAssignmentQuestions(draft.questions),
      });

      console.log("[Assignment] created", {
        assignmentId: createdAssignment?.id || "",
        classId: draft.classId,
        teacherId: getCurrentUserId(),
      });

      showToast("Đã tạo bài tập thành công.", "success");
      resetManualAssignmentState();
      syncManualAssignmentFormFields();
      renderManualQuestionList();
      await loadManualAssignmentClasses();
      syncManualAssignmentPreview();
      await refreshTeacherAssignments();
    } catch (error) {
      showToast(error.message || "Không thể tạo bài tập.", "error");
    }
  });
}
function ensureAssignmentService() {
  const firestore = getFirebaseFirestore();
  const existingService = window.EduKidsAssignmentService || {};

  async function createAssignment(payload) {
    const requestWithAuth = window.EduKidsApi?.requestWithAuth;

    if (typeof requestWithAuth !== "function") {
      throw new Error("Assignment API is unavailable");
    }

    console.log("[EduKids][assignmentService] createAssignment request", {
      classId: String(payload?.classId || ""),
      teacherId: String(payload?.teacherId || ""),
      title: String(payload?.title || ""),
    });

    const response = await requestWithAuth("/api/assignments", {
      method: "POST",
      body: payload,
    });

    console.log("[EduKids][assignmentService] createAssignment response", {
      assignmentId: response?.data?.id || "",
      classId: response?.data?.classId || String(payload?.classId || ""),
    });

    return response?.data;
  }

  async function getTeacherAssignments(teacherId) {
    if (!teacherId) {
      return [];
    }

    if (!firestore) {
      return [];
    }

    console.log("[EduKids][assignmentService] getTeacherAssignments", {
      teacherId,
    });

    const snapshot = await firestore
      .collection("assignments")
      .where("teacherId", "==", teacherId)
      .get();

    const assignments = snapshot.docs
      .map((doc) => {
        const data = doc.data() || {};

        return {
          id: doc.id,
          ...data,
          totalQuestions: Number(
            data.totalQuestions || data.questionCount || 0,
          ),
        };
      })
      .sort(
        (left, right) =>
          new Date(right.createdAt || 0).getTime() -
          new Date(left.createdAt || 0).getTime(),
      );

    console.log("[EduKids][assignmentService] getTeacherAssignments result", {
      teacherId,
      assignmentCount: assignments.length,
      assignmentIds: assignments.map((item) => item.id).filter(Boolean),
    });

    return assignments;
  }

  function listenTeacherAssignments(teacherId, onChange) {
    if (!firestore || !teacherId || typeof onChange !== "function") {
      onChange?.([], []);
      return () => {};
    }

    console.log("[EduKids][assignmentService] listenTeacherAssignments", {
      teacherId,
    });

    const query = firestore
      .collection("assignments")
      .where("teacherId", "==", teacherId);

    return query.onSnapshot(
      (snapshot) => {
        const assignments = snapshot.docs.map((doc) => {
          const data = doc.data() || {};

          return {
            id: doc.id,
            ...data,
            totalQuestions: Number(
              data.totalQuestions || data.questionCount || 0,
            ),
            questionCount: Number(
              data.questionCount || data.totalQuestions || 0,
            ),
          };
        });

        console.log(
          "[EduKids][assignmentService] listenTeacherAssignments snapshot",
          {
            teacherId,
            snapshotSize: snapshot.size,
            assignmentIds: assignments.map((item) => item.id).filter(Boolean),
          },
        );

        onChange(
          assignments.sort(
            (left, right) =>
              new Date(right.createdAt || right.updatedAt || 0).getTime() -
              new Date(left.createdAt || left.updatedAt || 0).getTime(),
          ),
          [],
        );
      },
      (error) => {
        console.warn(
          "[EduKids][assignmentService] listenTeacherAssignments failed",
          error,
        );
        onChange(
          [],
          [
            {
              message:
                error?.message || "Không thể tải bài tập đã giao từ Firestore.",
            },
          ],
        );
      },
    );
  }

  function listenAssignments(classIds, callback) {
    const ids = Array.isArray(classIds)
      ? classIds.map((value) => String(value || "").trim()).filter(Boolean)
      : [];

    if (!firestore) {
      callback(
        [],
        [
          {
            message: "Firestore chưa sẵn sàng.",
          },
        ],
      );
      return () => {};
    }

    if (ids.length === 0) {
      callback([], []);
      return () => {};
    }

    console.log("[EduKids][assignmentService] listenAssignments", {
      classIds: ids,
    });

    const batches = [];

    for (let index = 0; index < ids.length; index += 10) {
      batches.push(ids.slice(index, index + 10));
    }

    const batchState = new Map();
    const errorState = new Map();
    const unsubscribers = batches.map((batchIds, batchIndex) => {
      return firestore
        .collection("assignments")
        .where("classId", "in", batchIds)
        .onSnapshot(
          (snapshot) => {
            const assignments = snapshot.docs.map((doc) => {
              const data = doc.data() || {};

              return {
                id: doc.id,
                ...data,
                totalQuestions: Number(
                  data.totalQuestions || data.questionCount || 0,
                ),
                questionCount: Number(
                  data.questionCount || data.totalQuestions || 0,
                ),
              };
            });

            console.log(
              "[EduKids][assignmentService] listenAssignments batch update",
              {
                batchIds,
                batchIndex,
                assignmentCount: snapshot.size,
                assignmentIds: assignments
                  .map((item) => item.id)
                  .filter(Boolean),
              },
            );

            batchState.set(batchIndex, assignments);
            errorState.delete(batchIndex);

            const merged = Array.from(batchState.values())
              .flat()
              .sort(
                (left, right) =>
                  new Date(right.createdAt || right.updatedAt || 0).getTime() -
                  new Date(left.createdAt || left.updatedAt || 0).getTime(),
              );

            callback(merged, Array.from(errorState.values()));
          },
          (error) => {
            console.warn(
              "[EduKids][assignmentService] listenAssignments batch failed",
              {
                batchIds,
                batchIndex,
                error,
              },
            );

            batchState.set(batchIndex, []);
            errorState.set(batchIndex, {
              batchIds,
              message:
                error?.message || "Không thể tải bài tập của lớp từ Firestore.",
            });

            const merged = Array.from(batchState.values())
              .flat()
              .sort(
                (left, right) =>
                  new Date(right.createdAt || right.updatedAt || 0).getTime() -
                  new Date(left.createdAt || left.updatedAt || 0).getTime(),
              );

            callback(merged, Array.from(errorState.values()));
          },
        );
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => {
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
      });
    };
  }

  window.EduKidsAssignmentService = {
    ...existingService,
    createAssignment,
    getTeacherAssignments,
    listenTeacherAssignments,
    listenAssignments,
  };
}

// ======================
// GLOBAL
// ======================

window.showToast = showToast;
window.createModal = createModal;
window.askAI = askAI;

window.openProfile = openProfile;
window.openTeacherDashboard = openTeacherDashboard;
window.openCreateAssignment = openCreateAssignment;

window.openSubject = openSubject;
window.goBackSubjects = goBackSubjects;
window.submitStudentQuiz = submitStudentQuiz;
window.showStudentWrongAnswerReview = showStudentWrongAnswerReview;

window.openAICoach = openAICoach;
window.goBackAI = goBackAI;

window.goHome = goHome;
window.EduKidsApi = {
  request: apiRequest,
  requestWithAuth: apiRequestWithAuth,
};
if (false) {
  let mockAccounts = [
    {
      id: 1,
      name: "Nguyễn Văn A",
      username: "ngva123",
      password: "123456",
      role: "student",
      gender: "male",
    },
    {
      id: 2,
      name: "Trần Thị B",
      username: "trantb234",
      password: "123456",
      role: "teacher",
      gender: "female",
    },
  ];

  // LOGIN
  function login(username, password) {
    const user = mockAccounts.find(
      (u) => u.username === username && u.password === password,
    );

    if (!user) {
      alert("Sai tài khoản hoặc mật khẩu.");
      return false;
    }

    alert("Đăng nhập thành công: " + user.name);
    localStorage.setItem("user", JSON.stringify(user));
    return true;
  }

  // REGISTER
  function register(data) {
    if (mockAccounts.find((u) => u.username === data.username)) {
      alert("Tên đăng nhập đã tồn tại");
      return;
    }

    data.id = Date.now();
    mockAccounts.push(data);

    alert("Đăng ký thành công");
  }
}

window.mockAccounts = mockAccounts;
window.renderAuthScreen = renderAuthScreen;
window.initializeAuth = initializeAuth;
