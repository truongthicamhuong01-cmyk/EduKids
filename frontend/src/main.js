import { API_BASE_URL } from "./config.js";
import "./firebase-init.js";
import "./services/profileService.js";
import "./services/assignmentService.js";
import "./services/adminOverviewService.js";
import "./services/adminStudentService.js";
import "./services/adminTeacherService.js";
import "./services/adminClassService.js";
import "./services/adminContentService.js";
import "./services/adminAssignmentService.js";
import "./services/adminAiService.js";
import "./services/systemSettingsService.js";
import "./services/adminStatsService.js";
import "./services/appReviewService.js";
import "./services/topicAccuracyService.js";
import { renderLearningPathPage } from "./pages/student/learning-path/learningPathPage.js";
import { adaptLearningPathState } from "./data/learning-path/learningPathStateAdapter.js";
import "./style.css";

const bootstrapState = (window.__EDUKIDS_BOOTSTRAP__ ||= {
  appBound: false,
  authRootBound: false,
  authMode: "login",
  currentUser: null,
  initializedUid: null,
});

const AUTH_SESSION_KEY = "edukids-current-user";
const ADMIN_AUTH_KEY = "edukids-admin-authenticated";
const ADMIN_PASSWORD_KEY = "edukids-admin-password";
const ADMIN_BRAND_ICON_SRC = "/assets/edukids-icon-admin.png";
const DEFAULT_BRAND_ICON_SRC = "/assets/edukids-icon-512.png";
const MOBILE_BRAND_ICON_SRC = "/assets/edukids-icon-192.png";
const AUTH_ACCOUNTS_KEY = "edukids-mock-accounts";
const AUTH_CLEAR_KEYS = [
  "token",
  "authToken",
  "user",
  "currentUser",
  ADMIN_PASSWORD_KEY,
  AUTH_SESSION_KEY,
];

const ROLE_DEFAULT_PAGES = {
  student: "student-home",
  teacher: "teacher-dashboard",
};

const STUDENT_ROUTE_PATHS = {
  "learning-path": "/student/learning-path",
  pet: "/pet",
};

const ADMIN_DEFAULT_PAGE = "admin-overview";

const ROLE_ALLOWED_PAGES = {
  student: new Set([
    "student-home",
    "ai-coach",
    "subjects",
    "assignments",
    "progress",
    "learning-path",
    "profile",
    "pet",
  ]),
  teacher: new Set([
    "teacher-dashboard",
    "classroom",
    "create-assignment",
    "manage",
    "stats",
    "teacher-profile",
  ]),
};

let previousPage = ROLE_DEFAULT_PAGES.student;
let currentPage = ROLE_DEFAULT_PAGES.student;
let currentAdminPage = ADMIN_DEFAULT_PAGE;
let currentAdminContentTab = "math";
const adminOverviewState = {
  loading: false,
  loaded: false,
  data: null,
  pendingPromise: null,
};
const adminStudentsState = {
  loading: false,
  loaded: false,
  data: [],
  filtered: [],
  pendingPromise: null,
  searchQuery: "",
  classFilter: "",
  statusFilter: "",
};
const adminTeachersState = {
  loading: false,
  loaded: false,
  data: [],
  filtered: [],
  pendingPromise: null,
  searchQuery: "",
  classCountFilter: "",
  statusFilter: "",
};
const adminClassesState = {
  loading: false,
  loaded: false,
  data: [],
  filtered: [],
  pendingPromise: null,
  searchQuery: "",
  gradeFilter: "",
  selectedClassId: "",
};
const adminContentState = {
  loading: false,
  loaded: false,
  data: {
    math: [],
    english: [],
  },
  pendingPromise: null,
  hasData: false,
  detail: {
    visible: false,
    subject: "",
    grade: "",
    bucket: null,
  },
};
const adminReviewsState = {
  loading: false,
  loaded: false,
  data: [],
  filtered: [],
  pendingPromise: null,
  ratingFilter: "all",
  roleFilter: "all",
};
const adminAssignmentsState = {
  loading: false,
  loaded: false,
  data: [],
  filtered: [],
  pendingPromise: null,
  searchQuery: "",
  subjectFilter: "",
};
const adminAiState = {
  loading: false,
  loaded: false,
  data: null,
  pendingPromise: null,
};
const systemSettingsState = {
  loading: false,
  loaded: false,
  data: null,
  pendingPromise: null,
  listenerReady: null,
  unsubscribe: null,
};
const adminStatsState = {
  loading: false,
  loaded: false,
  data: null,
  pendingPromise: null,
  selectedRange: "week",
};

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

function apiRequestPublic(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

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

function apiRequestAdmin(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const adminPassword = getAdminPassword();

  if (adminPassword) {
    headers["X-Admin-Password"] = adminPassword;
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

function apiRequestWithAuth(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = getAccessToken();

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

function getAccessToken() {
  return (
    localStorage.getItem("authToken") || localStorage.getItem("token") || ""
  );
}

function hasAccessToken() {
  return Boolean(getAccessToken());
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

function isAdminAuthenticated() {
  return localStorage.getItem(ADMIN_AUTH_KEY) === "true";
}

function getAdminPassword() {
  return (
    sessionStorage.getItem(ADMIN_PASSWORD_KEY) ||
    localStorage.getItem(ADMIN_PASSWORD_KEY) ||
    ""
  );
}

function setAdminPassword(password) {
  if (password) {
    sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
    localStorage.setItem(ADMIN_PASSWORD_KEY, password);
    return;
  }

  sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
  localStorage.removeItem(ADMIN_PASSWORD_KEY);
}

function setAdminAuthenticated(isAuthenticated) {
  if (isAuthenticated) {
    localStorage.setItem(ADMIN_AUTH_KEY, "true");
    return;
  }

  localStorage.removeItem(ADMIN_AUTH_KEY);
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

  const token = getAccessToken();
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
  return ROLE_DEFAULT_PAGES[normalizeRole(role)] || ROLE_DEFAULT_PAGES.student;
}

function getRoutePageForPathname(pathname = window.location?.pathname || "") {
  const normalizedPathname = String(pathname || "").replace(/\/+$/, "") || "/";

  if (normalizedPathname === STUDENT_ROUTE_PATHS["learning-path"]) {
    return "learning-path";
  }

  if (normalizedPathname === STUDENT_ROUTE_PATHS.pet) {
    return "pet";
  }

  return null;
}

function getRoutePathForPage(pageId) {
  return STUDENT_ROUTE_PATHS[pageId] || "/";
}

let petModuleBootstrapPromise = null;

function getPetModuleApi() {
  return window.EduKidsPet || null;
}

function resetPetModuleState() {
  const pet = getPetModuleApi();

  if (typeof pet?.store?.reset === "function") {
    pet.store.reset();
  }
}

function hidePetModulePages() {
  const pet = getPetModuleApi();
  if (typeof pet?.hidePetModule !== "function") {
    return;
  }

  pet.hidePetModule();
}

function showPetModulePage() {
  const pet = getPetModuleApi();
  if (typeof pet?.showPetModule !== "function") {
    return;
  }

  pet.showPetModule();
}

async function ensurePetModuleLoaded() {
  if (getPetModuleApi()?.ui) {
    return getPetModuleApi();
  }

  if (!petModuleBootstrapPromise) {
    petModuleBootstrapPromise = import("./pet/index.js")
      .then((module) => {
        if (typeof module.bootstrapPetModule === "function") {
          return module.bootstrapPetModule();
        }

        return getPetModuleApi();
      })
      .catch((error) => {
        petModuleBootstrapPromise = null;
        throw error;
      });
  }

  return petModuleBootstrapPromise;
}

function getProfilePageType(pageId) {
  if (pageId === "profile") {
    return "student";
  }

  if (pageId === "teacher-profile") {
    return "teacher";
  }

  return null;
}

function isPageAllowedForRole(pageId, role) {
  const normalizedRole = normalizeRole(role);

  return Boolean(
    normalizedRole && ROLE_ALLOWED_PAGES[normalizedRole]?.has(pageId),
  );
}

function resolvePageForRole(pageId, role) {
  if (normalizeRole(role) === "student" && pageId === "classroom") {
    return "assignments";
  }

  return isPageAllowedForRole(pageId, role)
    ? pageId
    : getDefaultPageForRole(role);
}

function isAdminRoute() {
  const pathname =
    String(window.location?.pathname || "").replace(/\/+$/, "") || "/";

  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function redirectToLoginRoute() {
  if (window.location.pathname !== "/") {
    window.history.replaceState({}, "", "/");
  }
}

function getSidebarAvatarPath(profile) {
  if (window.EduKidsProfileService?.getAvatarPathFromProfile) {
    const avatarPath =
      window.EduKidsProfileService.getAvatarPathFromProfile(profile);

    if (normalizeRole(profile?.role) === "admin") {
      return "assets/admin.png";
    }

    return avatarPath;
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

  const role = normalizeRole(profile?.role) || "student";
  const gender = profile?.gender === "female" ? "female" : "male";

  if (role === "admin") {
    return "assets/admin.png";
  }

  if (role === "teacher") {
    return `assets/userAvatar/${gender === "female" ? "femaleteacher.png" : "maleteacher.png"}`;
  }

  return `assets/userAvatar/${gender === "female" ? "girl.png" : "boy.png"}`;
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
    roleLabel:
      role === "admin"
        ? "Quản trị viên"
        : role === "teacher"
          ? "Giáo viên"
          : "Học sinh",
    avatar: getSidebarAvatarPath(profile),
  };
}

function setSidebarCardsLoading(isLoading) {
  document.querySelectorAll("[data-sidebar-card]").forEach((card) => {
    card.setAttribute("aria-busy", String(isLoading));
    card.classList.toggle("is-loading", isLoading);
  });
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

function applyRoleVisibility(role = getCurrentRole()) {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    return;
  }

  const allowedPages = ROLE_ALLOWED_PAGES[normalizedRole];
  const showStudentCard = normalizedRole === "student";
  const showTeacherCard = normalizedRole === "teacher";

  document.querySelectorAll(".menu-item").forEach((item) => {
    if (!item.dataset.page) {
      return;
    }

    item.hidden = !allowedPages.has(item.dataset.page);
  });

  document.querySelectorAll(".page").forEach((page) => {
    page.hidden = !allowedPages.has(page.id);
  });

  document.querySelectorAll(".student-card").forEach((card) => {
    card.hidden = !showStudentCard;
  });

  document.querySelectorAll(".teacher-card").forEach((card) => {
    card.hidden = !showTeacherCard;
  });
}

function getAdminShell() {
  return document.getElementById("admin-shell");
}

function setAdminMode(isAdminMode) {
  const adminShell = getAdminShell();
  const appShell = getAppShell();
  const authRoot = getAuthContainer();

  document.body.classList.toggle("admin-mode", isAdminMode);

  if (isAdminMode) {
    document.body.classList.remove("auth-mode");
  }

  if (adminShell) {
    adminShell.hidden = !isAdminMode;
  }

  if (appShell) {
    appShell.hidden = isAdminMode;
  }

  if (authRoot) {
    authRoot.hidden = isAdminMode;
  }

  syncAdminBrandIcons(isAdminMode);
}

function getBrandIconSrc({ admin = false, mobile = false } = {}) {
  if (admin) {
    return ADMIN_BRAND_ICON_SRC;
  }

  return mobile ? MOBILE_BRAND_ICON_SRC : DEFAULT_BRAND_ICON_SRC;
}

function syncAdminBrandIcons(isAdminMode = isAdminRoute()) {
  const adminShell = getAdminShell();

  if (!adminShell) {
    return;
  }

  const iconSrc = getBrandIconSrc({ admin: Boolean(isAdminMode) });

  adminShell.querySelectorAll("[data-admin-brand-icon]").forEach((img) => {
    if (img instanceof HTMLImageElement) {
      img.src = iconSrc;
    }
  });
}

function showAdminPage(pageId) {
  if (!pageId) {
    return;
  }

  document.querySelectorAll(".admin-page").forEach((page) => {
    page.classList.toggle("active", page.id === pageId);
  });

  document.querySelectorAll("[data-admin-page]").forEach((item) => {
    item.classList.toggle("active", item.dataset.adminPage === pageId);
  });
}

function showAdminContentTab(tabKey) {
  const normalizedTab = tabKey === "english" ? "english" : "math";
  currentAdminContentTab = normalizedTab;

  document.querySelectorAll("[data-admin-content-tab]").forEach((item) => {
    item.classList.toggle(
      "active",
      item.dataset.adminContentTab === normalizedTab,
    );
  });

  document.querySelectorAll("[data-admin-content-panel]").forEach((panel) => {
    panel.classList.toggle(
      "active",
      panel.dataset.adminContentPanel === normalizedTab,
    );
  });
}

function getAdminContentRoot() {
  return document.getElementById("admin-content");
}

function getAdminContentPanel(tabKey) {
  const normalizedTab = tabKey === "english" ? "english" : "math";

  return (
    getAdminContentRoot()?.querySelector(
      `[data-admin-content-panel="${normalizedTab}"]`,
    ) || null
  );
}

function getAdminContentTopicBody(tabKey) {
  const normalizedTab = tabKey === "english" ? "english" : "math";

  return (
    getAdminContentRoot()?.querySelector(
      `[data-admin-content-topic-body="${normalizedTab}"]`,
    ) || null
  );
}

function getAdminContentDrawerRoot() {
  return (
    getAdminContentRoot()?.querySelector("[data-admin-content-drawer]") || null
  );
}

function getAdminContentDrawerPanel() {
  return (
    getAdminContentRoot()?.querySelector("[data-admin-content-drawer-panel]") ||
    null
  );
}

function getAdminContentDrawerTitleNode() {
  return (
    getAdminContentRoot()?.querySelector("[data-admin-content-drawer-title]") ||
    null
  );
}

function getAdminContentDrawerSubtitleNode() {
  return (
    getAdminContentRoot()?.querySelector(
      "[data-admin-content-drawer-subtitle]",
    ) || null
  );
}

function getAdminContentDrawerSummaryNode(key) {
  return (
    getAdminContentRoot()?.querySelector(
      `[data-admin-content-drawer-summary="${key}"]`,
    ) || null
  );
}

function getAdminContentDrawerListNode() {
  return (
    getAdminContentRoot()?.querySelector("[data-admin-content-drawer-list]") ||
    null
  );
}

function getAdminContentRowLabel(subject, grade) {
  const subjectLabel = subject === "english" ? "Tiếng Anh" : "Toán";
  return `${subjectLabel} lớp ${grade}`;
}

function getAdminContentSubjectLabel(subject) {
  return subject === "english" ? "Tiếng Anh" : "Toán";
}

function getAdminContentStatusLabel(versionCount) {
  return Number(versionCount) > 0 ? "Đã có version" : "Chưa có version nào";
}

function getAdminContentStatusClass(versionCount) {
  return Number(versionCount) > 0 ? "is-green" : "is-orange";
}

function buildAdminContentRow(bucket) {
  const versionCount = Math.max(0, Number(bucket?.versionCount) || 0);
  const statusLabel = getAdminContentStatusLabel(versionCount);
  const statusClass = getAdminContentStatusClass(versionCount);
  const topicCount = Array.isArray(bucket?.topics) ? bucket.topics.length : 0;
  const topicLabel =
    topicCount > 0 ? `${formatStatValue(topicCount)} topic` : "Chưa có topic";
  const accuracyLabel = Number.isFinite(Number(bucket?.accuracy))
    ? `${formatStatValue(bucket.accuracy)}%`
    : "Chưa có dữ liệu";

  return `
    <tr data-admin-content-row data-admin-content-subject="${escapeHtml(String(bucket?.subject || ""))}" data-admin-content-grade="${escapeHtml(String(bucket?.grade || ""))}">
      <td>
        <div class="admin-topic-cell">
          <button type="button" class="admin-topic-cell-button" data-admin-content-action="view" data-admin-content-subject="${escapeHtml(String(bucket?.subject || ""))}" data-admin-content-grade="${escapeHtml(String(bucket?.grade || ""))}">
            ${escapeHtml(bucket?.title || getAdminContentRowLabel(bucket?.subject, bucket?.grade))}
          </button>
          <span>${escapeHtml(bucket?.subtitle || `Khối ${bucket?.grade || "--"}`)} · ${escapeHtml(topicLabel)} · ${escapeHtml(accuracyLabel)}</span>
        </div>
      </td>
      <td>${versionCount > 0 ? `${escapeHtml(formatStatValue(versionCount))} version` : "Chưa có version nào"}</td>
      <td><span class="admin-topic-badge ${escapeHtml(statusClass)}">${escapeHtml(statusLabel)}</span></td>
      <td>
        <div class="admin-topic-actions">
          <button type="button" data-admin-content-action="view" data-admin-content-subject="${escapeHtml(String(bucket?.subject || ""))}" data-admin-content-grade="${escapeHtml(String(bucket?.grade || ""))}">Xem chi tiết</button>
          <button type="button" class="is-danger" disabled>Xóa</button>
        </div>
      </td>
    </tr>
  `;
}

function buildAdminContentEmptyRow(message, description) {
  return `
    <tr>
      <td colspan="4">
        <div class="admin-empty-state is-large">
          <div>
            <p>${escapeHtml(message)}</p>
            <span>${escapeHtml(description)}</span>
          </div>
        </div>
      </td>
    </tr>
  `;
}

function renderAdminContentPanel(tabKey) {
  const body = getAdminContentTopicBody(tabKey);
  const buckets = Array.isArray(adminContentState.data?.[tabKey])
    ? adminContentState.data[tabKey]
    : [];

  if (!body) {
    return;
  }

  if (adminContentState.loading && !adminContentState.loaded) {
    body.innerHTML = buildAdminContentEmptyRow(
      "Đang tải topic...",
      "Hệ thống đang đồng bộ dữ liệu thật từ Firestore và dịch vụ topic.",
    );
    return;
  }

  if (buckets.length === 0) {
    body.innerHTML = buildAdminContentEmptyRow(
      "Chưa có dữ liệu topic",
      "Chưa có topic hoặc version nào được ghi nhận cho môn học này.",
    );
    return;
  }

  body.innerHTML = buckets
    .map((bucket) => buildAdminContentRow(bucket))
    .join("");
}

function renderAdminContentPage() {
  renderAdminContentPanel("math");
  renderAdminContentPanel("english");
  renderAdminContentDrawer();
}

function getAdminContentBucket(tabKey, grade) {
  const normalizedTab = tabKey === "english" ? "english" : "math";
  const normalizedGrade = String(grade || "").trim();

  return (
    (Array.isArray(adminContentState.data?.[normalizedTab])
      ? adminContentState.data[normalizedTab]
      : []
    ).find(
      (bucket) => String(bucket?.grade || "").trim() === normalizedGrade,
    ) || null
  );
}

function getAdminContentTopicAccuracyLabel(topic) {
  if (
    !topic ||
    !Number.isFinite(Number(topic.totalAnswered)) ||
    Number(topic.totalAnswered) <= 0
  ) {
    return "Chưa có dữ liệu";
  }

  const accuracy = Number(topic.percentage);
  return Number.isFinite(accuracy)
    ? `${formatStatValue(Math.max(0, Math.min(100, Math.round(accuracy))))}%`
    : "Chưa có dữ liệu";
}

function getAdminContentTopicVersionLabel(topic) {
  const versionCount = Math.max(0, Number(topic?.versionCount) || 0);

  return versionCount > 0
    ? `${formatStatValue(versionCount)} version`
    : "Chưa có version nào";
}

function getAdminContentTopicStatusLabel(topic) {
  const versionCount = Math.max(0, Number(topic?.versionCount) || 0);
  return versionCount > 0 ? "Đã có version" : "Chưa có version nào";
}

function getAdminContentTopicAccuracyState(topic) {
  if (
    !topic ||
    !Number.isFinite(Number(topic.totalAnswered)) ||
    Number(topic.totalAnswered) <= 0
  ) {
    return "is-gray";
  }

  const accuracy = Math.max(
    0,
    Math.min(100, Math.round(Number(topic.percentage) || 0)),
  );

  if (accuracy >= 80) {
    return "is-green";
  }

  if (accuracy >= 60) {
    return "is-yellow";
  }

  return "is-red";
}

function buildAdminContentTopicRow(topic, index) {
  const versionLabel = getAdminContentTopicVersionLabel(topic);
  const accuracyLabel = getAdminContentTopicAccuracyLabel(topic);
  const statusLabel = getAdminContentTopicStatusLabel(topic);
  const topicTitle =
    String(topic?.title || topic?.topicId || `Topic ${index + 1}`).trim() ||
    `Topic ${index + 1}`;
  const accuracyValue = Number.isFinite(Number(topic?.percentage))
    ? Math.max(0, Math.min(100, Math.round(Number(topic.percentage) || 0)))
    : 0;
  const accuracyState = getAdminContentTopicAccuracyState(topic);
  const hasData = Number(topic?.totalAnswered) > 0;

  return `
    <article class="admin-content-topic-card ${escapeHtml(accuracyState)}">
      <div class="admin-content-topic-card-head">
        <div class="admin-content-topic-copy">
          <strong>${escapeHtml(topicTitle)}</strong>
          <span>${escapeHtml(String(topic?.topicId || "--"))}</span>
        </div>

        <span class="admin-topic-badge ${hasData ? "is-green" : "is-orange"}">
          ${escapeHtml(hasData ? accuracyLabel : "Chưa có dữ liệu")}
        </span>
      </div>

      <div class="admin-content-topic-progress">
        <div class="admin-content-topic-progress-head">
          <span>Độ chính xác</span>
          <strong>${escapeHtml(accuracyLabel)}</strong>
        </div>

        <div class="admin-content-topic-progress-track" aria-hidden="true">
          <div
            class="admin-content-topic-progress-fill"
            style="width: ${hasData ? `${accuracyValue}%` : "0%"}"
          ></div>
        </div>
      </div>

      <div class="admin-content-topic-card-footer">
        <div class="admin-content-topic-metric">
          <span>Số version</span>
          <strong>${escapeHtml(versionLabel)}</strong>
        </div>

        <div class="admin-content-topic-metric">
          <span>Trạng thái</span>
          <strong>${escapeHtml(statusLabel)}</strong>
        </div>
      </div>
    </article>
  `;
}

function renderAdminContentDrawer() {
  const drawer = getAdminContentDrawerRoot();
  const panel = getAdminContentDrawerPanel();
  const titleNode = getAdminContentDrawerTitleNode();
  const subtitleNode = getAdminContentDrawerSubtitleNode();
  const summaryTopicsNode = getAdminContentDrawerSummaryNode("topics");
  const summaryDataNode = getAdminContentDrawerSummaryNode("data");
  const summaryVersionNode = getAdminContentDrawerSummaryNode("versions");
  const summaryAccuracyNode = getAdminContentDrawerSummaryNode("accuracy");
  const listNode = getAdminContentDrawerListNode();
  const detail = adminContentState.detail || {};

  if (!drawer || !panel || !listNode) {
    return;
  }

  if (!detail.visible || !detail.bucket) {
    drawer.hidden = true;
    document.body.classList.remove("admin-content-drawer-open");
    return;
  }

  const bucket = detail.bucket;
  const topics = Array.isArray(bucket.topics) ? bucket.topics : [];
  const topicCount = topics.length;
  const topicsWithData = topics.filter(
    (topic) => Number(topic.totalAnswered) > 0,
  ).length;
  const versionCount = Math.max(0, Number(bucket.versionCount) || 0);
  const accuracyValue = Math.max(
    0,
    Math.min(100, Math.round(Number(bucket.accuracy) || 0)),
  );
  const accuracyLabel = Number.isFinite(Number(bucket.accuracy))
    ? `${formatStatValue(accuracyValue)}%`
    : "Chưa có dữ liệu";
  const title =
    bucket.title || getAdminContentRowLabel(bucket.subject, bucket.grade);

  drawer.hidden = false;
  drawer.classList.add("is-open");
  document.body.classList.add("admin-content-drawer-open");

  if (titleNode) {
    titleNode.textContent = title;
  }

  if (subtitleNode) {
    subtitleNode.textContent = `${bucket.subtitle || `Khối ${bucket.grade || "--"}`} · ${getAdminContentSubjectLabel(bucket.subject)} · ${formatStatValue(topicCount)} topic`;
  }

  if (summaryTopicsNode) {
    summaryTopicsNode.textContent = formatStatValue(topicCount);
  }

  if (summaryDataNode) {
    summaryDataNode.textContent =
      topicsWithData > 0
        ? `${formatStatValue(topicsWithData)} topic có dữ liệu`
        : "Chưa có dữ liệu";
  }

  if (summaryVersionNode) {
    summaryVersionNode.textContent =
      versionCount > 0
        ? `${formatStatValue(versionCount)} version`
        : "Chưa có version nào";
  }

  if (summaryAccuracyNode) {
    summaryAccuracyNode.textContent = accuracyLabel;
  }

  if (topics.length === 0) {
    listNode.innerHTML = `
      <div class="admin-empty-state is-large">
        <div>
          <p>Chưa có dữ liệu</p>
          <span>Không có topic nào được ghi nhận cho lớp này.</span>
        </div>
      </div>
    `;
  } else {
    listNode.innerHTML = topics
      .map((topic, index) => buildAdminContentTopicRow(topic, index))
      .join("");
  }

  requestAnimationFrame(() => {
    panel.scrollTop = 0;
  });
}

function closeAdminContentDetail() {
  adminContentState.detail = {
    visible: false,
    subject: "",
    grade: "",
    bucket: null,
  };
  renderAdminContentDrawer();
}

function showAdminContentDetail(tabKey, grade) {
  const bucket = getAdminContentBucket(tabKey, grade);

  if (!bucket) {
    showToast("Không tìm thấy topic.", "error");
    return;
  }

  adminContentState.detail = {
    visible: true,
    subject: tabKey,
    grade,
    bucket,
  };

  renderAdminContentDrawer();
}

async function syncAdminContent({ forceRefresh = false } = {}) {
  const root = getAdminContentRoot();

  if (!root) {
    return null;
  }

  if (adminContentState.loaded && !forceRefresh) {
    renderAdminContentPage();
    return adminContentState.data;
  }

  if (adminContentState.loading && adminContentState.pendingPromise) {
    return adminContentState.pendingPromise;
  }

  adminContentState.loading = true;
  root.setAttribute("aria-busy", "true");
  renderAdminContentPage();

  const request = (async () => {
    try {
      const service = window.EduKidsAdminContentService;
      const content =
        typeof service?.fetchAdminContentData === "function"
          ? await service.fetchAdminContentData()
          : { grouped: { math: [], english: [] }, hasData: false };

      adminContentState.data = {
        math: Array.isArray(content?.grouped?.math) ? content.grouped.math : [],
        english: Array.isArray(content?.grouped?.english)
          ? content.grouped.english
          : [],
      };
      adminContentState.hasData = Boolean(content?.hasData);
      adminContentState.loaded = true;
      renderAdminContentPage();
      return adminContentState.data;
    } catch (error) {
      console.warn("Không thể tải nội dung học tập:", error);
      adminContentState.data = {
        math: [],
        english: [],
      };
      adminContentState.hasData = false;
      adminContentState.loaded = true;
      renderAdminContentPage();
      return adminContentState.data;
    } finally {
      adminContentState.loading = false;
      adminContentState.pendingPromise = null;
      root.removeAttribute("aria-busy");
    }
  })();

  adminContentState.pendingPromise = request;
  return request;
}

function getAdminOverviewRoot() {
  return document.querySelector("#admin-overview[data-admin-overview-root]");
}

function getAdminOverviewStatNode(key) {
  if (!key) {
    return null;
  }

  return (
    getAdminOverviewRoot()?.querySelector(
      `[data-admin-overview-stat="${key}"]`,
    ) || document.querySelector(`[data-admin-overview-stat="${key}"]`)
  );
}

function getAdminOverviewNoteNode(key) {
  if (!key) {
    return null;
  }

  return (
    getAdminOverviewRoot()?.querySelector(
      `[data-admin-overview-note="${key}"]`,
    ) || document.querySelector(`[data-admin-overview-note="${key}"]`)
  );
}

function getAdminOverviewChartCard(key) {
  if (!key) {
    return null;
  }

  return (
    getAdminOverviewRoot()?.querySelector(
      `[data-admin-overview-chart-card="${key}"]`,
    ) || document.querySelector(`[data-admin-overview-chart-card="${key}"]`)
  );
}

function getAdminChartPalette(chartKey) {
  if (chartKey === "ai") {
    return {
      areaClass: "is-purple",
      lineClass: "is-purple",
      gridClass: "is-purple",
      fillId: "admin-overview-ai-fill",
      fillStart: "#9333ea",
      fillEnd: "#9333ea",
      stroke: "#9333ea",
    };
  }

  return {
    areaClass: "",
    lineClass: "",
    gridClass: "",
    fillId: "admin-overview-work-fill",
    fillStart: "#4f46e5",
    fillEnd: "#4f46e5",
    stroke: "#4f46e5",
  };
}

function buildAdminChartSvg(series, { chartKey, ariaLabel }) {
  const points = Array.isArray(series) ? series : [];
  const safeSeries = points
    .map((entry) => ({
      label: String(entry?.label || "").trim(),
      value: Math.max(0, Number(entry?.value) || 0),
    }))
    .filter((entry) => entry.label);

  if (
    safeSeries.length === 0 ||
    safeSeries.every((entry) => entry.value <= 0)
  ) {
    return null;
  }

  const palette = getAdminChartPalette(chartKey);
  const width = 720;
  const height = 260;
  const leftPad = 48;
  const rightPad = 40;
  const topPad = 34;
  const bottomPad = 34;
  const chartWidth = width - leftPad - rightPad;
  const chartHeight = height - topPad - bottomPad;
  const maxValue = Math.max(...safeSeries.map((entry) => entry.value), 1);
  const upperBound = Math.max(1, Math.ceil(maxValue / 5) * 5);
  const pointCount = safeSeries.length;
  const step = pointCount > 1 ? chartWidth / (pointCount - 1) : 0;
  const chartPoints = safeSeries.map((entry, index) => {
    const x = leftPad + step * index;
    const ratio = upperBound > 0 ? entry.value / upperBound : 0;
    const y = topPad + (1 - Math.max(0, Math.min(1, ratio))) * chartHeight;

    return {
      ...entry,
      x,
      y,
    };
  });
  const linePoints = chartPoints
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const areaPoints = [
    ...chartPoints.map(
      (point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`,
    ),
    `${chartPoints[chartPoints.length - 1].x.toFixed(1)},${height - bottomPad}`,
    `${chartPoints[0].x.toFixed(1)},${height - bottomPad}`,
  ].join(" ");
  const yLabels = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const value = Math.round(upperBound * (1 - ratio));
    const y = topPad + chartHeight * ratio;

    return {
      value,
      y,
    };
  });

  return `
    <svg viewBox="0 0 ${width} ${height}" class="admin-chart" role="img" aria-label="${escapeHtml(ariaLabel)}">
      <defs>
        <linearGradient id="${palette.fillId}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="${palette.fillStart}" stop-opacity="0.22" />
          <stop offset="100%" stop-color="${palette.fillEnd}" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <g class="admin-chart-grid-lines ${palette.gridClass}">
        ${yLabels
          .map(
            (label) =>
              `<line x1="${leftPad}" y1="${label.y.toFixed(1)}" x2="${width - rightPad}" y2="${label.y.toFixed(1)}" />`,
          )
          .join("")}
      </g>
      <g class="admin-chart-ylabels">
        ${yLabels
          .map(
            (label) =>
              `<text x="${label.value > 999 ? 8 : 12}" y="${(label.y + 4).toFixed(1)}">${escapeHtml(formatStatValue(label.value))}</text>`,
          )
          .join("")}
      </g>
      <polyline
        class="admin-chart-area ${palette.areaClass}"
        points="${escapeHtml(areaPoints)}"
        fill="url(#${palette.fillId})"
      />
      <polyline
        class="admin-chart-line ${palette.lineClass}"
        points="${escapeHtml(linePoints)}"
      />
      <g class="admin-chart-points ${palette.lineClass}">
        ${chartPoints
          .map(
            (point) =>
              `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="6" />`,
          )
          .join("")}
      </g>
      <g class="admin-chart-labels">
        ${chartPoints
          .map(
            (point) =>
              `<text x="${point.x.toFixed(1)}" y="${height - 14}">${escapeHtml(point.label)}</text>`,
          )
          .join("")}
      </g>
    </svg>
  `;
}

function renderAdminOverviewChart(
  chartKey,
  series,
  { ariaLabel, emptyTitle, emptyDescription },
) {
  const card = getAdminOverviewChartCard(chartKey);

  if (!card) {
    return;
  }

  const svgMarkup = buildAdminChartSvg(series, {
    chartKey,
    ariaLabel,
  });

  if (!svgMarkup) {
    card.innerHTML = `
      <div class="admin-empty-state is-large">
        <div>
          <p>${escapeHtml(emptyTitle)}</p>
          <span>${escapeHtml(emptyDescription)}</span>
        </div>
      </div>
    `;
    return;
  }

  card.innerHTML = svgMarkup;
}

function renderAdminOverviewStats(data = null) {
  const totals = data?.totals || {};
  const statConfig = [
    {
      key: "total-students",
      value: totals.students,
      note: `${formatStatValue(totals.students)} tài khoản học sinh`,
    },
    {
      key: "total-teachers",
      value: totals.teachers,
      note: `${formatStatValue(totals.teachers)} tài khoản giáo viên`,
    },
    {
      key: "total-classes",
      value: totals.classes,
      note: `${formatStatValue(totals.classes)} lớp học`,
    },
    {
      key: "total-assignments",
      value: totals.assignments,
      note: `${formatStatValue(totals.assignments)} bài tập`,
    },
    {
      key: "ai-usage-today",
      value: totals.aiUsageToday,
      note:
        Number(totals.aiUsageToday) > 0
          ? `${formatStatValue(totals.aiUsageToday)} lượt AI hôm nay`
          : "Chưa có log AI",
    },
    {
      key: "average-score",
      value: totals.averageScore,
      note:
        Number(totals.averageScore) > 0
          ? "Tính từ kết quả làm bài hiện có"
          : "Chưa có kết quả làm bài",
    },
  ];

  statConfig.forEach((item) => {
    const statNode = getAdminOverviewStatNode(item.key);
    const noteNode = getAdminOverviewNoteNode(item.key);

    if (statNode) {
      if (item.key === "average-score") {
        statNode.innerHTML = `${escapeHtml(formatStatValue(item.value ?? 0))}<span>/10</span>`;
      } else {
        statNode.textContent = formatStatValue(item.value ?? 0);
      }
    }

    if (noteNode) {
      noteNode.textContent = item.note;
    }
  });
}

async function syncAdminOverview({ forceRefresh = false } = {}) {
  const root = getAdminOverviewRoot();

  if (!root) {
    return null;
  }

  if (adminOverviewState.loaded && adminOverviewState.data && !forceRefresh) {
    renderAdminOverviewStats(adminOverviewState.data);
    renderAdminOverviewChart(
      "work",
      adminOverviewState.data?.charts?.workSubmissions || [],
      {
        ariaLabel: "Lượt làm bài theo ngày",
        emptyTitle: "Chưa có dữ liệu làm bài",
        emptyDescription:
          "Hệ thống chưa ghi nhận bài làm nào trong 7 ngày gần nhất.",
      },
    );
    renderAdminOverviewChart(
      "ai",
      adminOverviewState.data?.charts?.aiUsage || [],
      {
        ariaLabel: "Lượt sử dụng AI theo ngày",
        emptyTitle: "Chưa có dữ liệu AI",
        emptyDescription: "Hệ thống chưa có log AI để vẽ biểu đồ.",
      },
    );
    return adminOverviewState.data;
  }

  if (adminOverviewState.loading && adminOverviewState.pendingPromise) {
    return adminOverviewState.pendingPromise;
  }

  adminOverviewState.loading = true;
  root.setAttribute("aria-busy", "true");

  const request = (async () => {
    try {
      const service = window.EduKidsAdminOverviewService;
      const data =
        typeof service?.fetchAdminOverviewData === "function"
          ? await service.fetchAdminOverviewData()
          : null;

      adminOverviewState.data = data || {
        totals: {
          students: 0,
          teachers: 0,
          classes: 0,
          assignments: 0,
          aiUsageToday: 0,
          averageScore: 0,
        },
        charts: {
          workSubmissions: [],
          aiUsage: [],
        },
      };
      adminOverviewState.loaded = true;

      renderAdminOverviewStats(adminOverviewState.data);
      renderAdminOverviewChart(
        "work",
        adminOverviewState.data?.charts?.workSubmissions || [],
        {
          ariaLabel: "Lượt làm bài theo ngày",
          emptyTitle: "Chưa có dữ liệu làm bài",
          emptyDescription:
            "Hệ thống chưa ghi nhận bài làm nào trong 7 ngày gần nhất.",
        },
      );
      renderAdminOverviewChart(
        "ai",
        adminOverviewState.data?.charts?.aiUsage || [],
        {
          ariaLabel: "Lượt sử dụng AI theo ngày",
          emptyTitle: "Chưa có dữ liệu AI",
          emptyDescription: "Hệ thống chưa có log AI để vẽ biểu đồ.",
        },
      );

      return adminOverviewState.data;
    } catch (error) {
      console.warn("Không thể tải dữ liệu tổng quan admin:", error);
      adminOverviewState.data = {
        totals: {
          students: 0,
          teachers: 0,
          classes: 0,
          assignments: 0,
          aiUsageToday: 0,
          averageScore: 0,
        },
        charts: {
          workSubmissions: [],
          aiUsage: [],
        },
      };
      renderAdminOverviewStats(adminOverviewState.data);
      renderAdminOverviewChart("work", [], {
        ariaLabel: "Lượt làm bài theo ngày",
        emptyTitle: "Chưa có dữ liệu làm bài",
        emptyDescription:
          "Hệ thống chưa ghi nhận bài làm nào trong 7 ngày gần nhất.",
      });
      renderAdminOverviewChart("ai", [], {
        ariaLabel: "Lượt sử dụng AI theo ngày",
        emptyTitle: "Chưa có dữ liệu AI",
        emptyDescription: "Hệ thống chưa có log AI để vẽ biểu đồ.",
      });
      return adminOverviewState.data;
    } finally {
      adminOverviewState.loading = false;
      adminOverviewState.pendingPromise = null;
      root.removeAttribute("aria-busy");
    }
  })();

  adminOverviewState.pendingPromise = request;
  return request;
}

function getAdminStatsRoot() {
  return document.getElementById("admin-stats");
}

function getAdminStatsChartCard() {
  return (
    getAdminStatsRoot()?.querySelector("[data-admin-stats-chart-card]") || null
  );
}

function getAdminStatsTopicCard(topicKey) {
  const normalizedKey = topicKey === "english" ? "english" : "math";
  return (
    getAdminStatsRoot()?.querySelector(
      `[data-admin-stats-topic-card="${normalizedKey}"]`,
    ) || null
  );
}

function getAdminStatsTopicNode(topicKey, key) {
  const normalizedTopicKey = topicKey === "english" ? "english" : "math";
  return (
    getAdminStatsRoot()?.querySelector(
      `[data-admin-stats-${key}="${normalizedTopicKey}"]`,
    ) || null
  );
}

function getAdminStatsTableBody() {
  return (
    getAdminStatsRoot()?.querySelector("[data-admin-stats-table-body]") || null
  );
}

function getAdminStatsRangeButtons() {
  return Array.from(
    getAdminStatsRoot()?.querySelectorAll("[data-admin-stats-range]") || [],
  );
}

function normalizeAdminStatsRangeKey(value) {
  const rangeKey = String(value || "")
    .trim()
    .toLowerCase();

  if (rangeKey === "month" || rangeKey === "year") {
    return rangeKey;
  }

  return "week";
}

function getAdminStatsRangeLabel(rangeKey) {
  const normalizedRange = normalizeAdminStatsRangeKey(rangeKey);

  if (normalizedRange === "month") {
    return "Tháng này";
  }

  if (normalizedRange === "year") {
    return "Năm nay";
  }

  return "Tuần này";
}

function getAdminStatsRangeStateLabel(rangeKey) {
  const normalizedRange = normalizeAdminStatsRangeKey(rangeKey);

  if (normalizedRange === "month") {
    return "Tháng";
  }

  if (normalizedRange === "year") {
    return "Năm";
  }

  return "Tuần";
}

function getAdminStatsRangeWindow(rangeKey) {
  const normalizedRange = normalizeAdminStatsRangeKey(rangeKey);
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (normalizedRange === "year") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    return { start, end, bucket: "month" };
  }

  if (normalizedRange === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return { start, end, bucket: "day" };
  }

  start.setDate(start.getDate() - 6);
  return { start, end, bucket: "day" };
}

function getAdminStatsDateValue(value) {
  if (!value) {
    return null;
  }

  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getAdminStatsSubmissionDate(submission) {
  return (
    getAdminStatsDateValue(submission?.submittedAt) ||
    getAdminStatsDateValue(submission?.gradedAt) ||
    getAdminStatsDateValue(submission?.createdAt) ||
    getAdminStatsDateValue(submission?.updatedAt)
  );
}

function getAdminStatsSubmissionScore(submission) {
  const directScore = Number(submission?.score);

  if (Number.isFinite(directScore)) {
    if (directScore <= 10) {
      return Math.max(0, Math.min(10, directScore));
    }

    return Math.max(0, Math.min(10, directScore / 10));
  }

  const correctCount = Number(
    submission?.correctCount || submission?.correctAnswers || 0,
  );
  const totalQuestions = Number(
    submission?.totalQuestions || submission?.questionCount || 0,
  );

  if (
    Number.isFinite(correctCount) &&
    Number.isFinite(totalQuestions) &&
    totalQuestions > 0
  ) {
    return Math.max(0, Math.min(10, (correctCount / totalQuestions) * 10));
  }

  return null;
}

function isAdminStatsDateInRange(date, rangeKey) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return false;
  }

  const { start, end } = getAdminStatsRangeWindow(rangeKey);
  return date >= start && date <= end;
}

function getAdminStatsDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function getAdminStatsMonthKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getAdminStatsChartLabel(date, rangeKey) {
  const normalizedRange = normalizeAdminStatsRangeKey(rangeKey);

  if (normalizedRange === "year") {
    return `T${date.getMonth() + 1}`;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function buildAdminStatsTimelineSeries(submissions = [], rangeKey = "week") {
  const normalizedRange = normalizeAdminStatsRangeKey(rangeKey);
  const { start, end, bucket } = getAdminStatsRangeWindow(normalizedRange);
  const buckets = [];
  const bucketMap = new Map();

  if (bucket === "month") {
    const year = start.getFullYear();
    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
      const entry = {
        key,
        label: `T${monthIndex + 1}`,
        values: [],
      };
      buckets.push(entry);
      bucketMap.set(key, entry);
    }
  } else {
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = getAdminStatsDateKey(cursor);
      const entry = {
        key,
        label: getAdminStatsChartLabel(cursor, normalizedRange),
        values: [],
      };
      buckets.push(entry);
      bucketMap.set(key, entry);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  (Array.isArray(submissions) ? submissions : []).forEach((submission) => {
    const date = getAdminStatsSubmissionDate(submission);
    const score = getAdminStatsSubmissionScore(submission);

    if (
      !date ||
      !Number.isFinite(score) ||
      !isAdminStatsDateInRange(date, normalizedRange)
    ) {
      return;
    }

    const key =
      bucket === "month"
        ? getAdminStatsMonthKey(date)
        : getAdminStatsDateKey(date);
    const entry = bucketMap.get(key);

    if (!entry) {
      return;
    }

    entry.values.push(score);
  });

  return buckets.map((entry) => {
    if (entry.values.length === 0) {
      return {
        label: entry.label,
        value: 0,
      };
    }

    const average =
      entry.values.reduce((sum, value) => sum + value, 0) / entry.values.length;

    return {
      label: entry.label,
      value: Number(average.toFixed(1)),
    };
  });
}

function getAdminStatsTopicProgressDate(topic) {
  return (
    getAdminStatsDateValue(topic?.updatedAt) ||
    getAdminStatsDateValue(topic?.accuracyUpdatedAt) ||
    getAdminStatsDateValue(topic?.createdAt)
  );
}

function buildAdminStatsTopic(
  topicProgressDocs = [],
  topicCatalog = [],
  subjectKey = "",
  rangeKey = "week",
) {
  const catalogMap = new Map();
  (Array.isArray(topicCatalog) ? topicCatalog : []).forEach((topic) => {
    if (topic?.topicId) {
      catalogMap.set(topic.topicId, topic);
    }
  });

  const buckets = new Map();
  (Array.isArray(topicProgressDocs) ? topicProgressDocs : []).forEach((doc) => {
    if (doc?.subject !== subjectKey || doc?.totalAnswered <= 0) {
      return;
    }

    const date = getAdminStatsTopicProgressDate(doc);

    if (!isAdminStatsDateInRange(date, rangeKey)) {
      return;
    }

    const topicId = String(doc?.topicId || "").trim();
    const meta = catalogMap.get(topicId) || {};
    const key = topicId || String(doc?.title || "").trim();

    if (!key) {
      return;
    }

    const bucket = buckets.get(key) || {
      topicId,
      title: String(
        doc?.title || meta.title || doc?.topicName || topicId || "Chủ đề",
      ).trim(),
      subject: subjectKey,
      totalAnswered: 0,
      totalCorrect: 0,
      grades: new Set(),
    };

    bucket.totalAnswered += Math.max(0, Number(doc?.totalAnswered) || 0);
    bucket.totalCorrect += Math.max(0, Number(doc?.totalCorrect) || 0);
    if (doc?.grade || meta.grade) {
      bucket.grades.add(String(doc?.grade || meta.grade).trim());
    }

    buckets.set(key, bucket);
  });

  const ranked = Array.from(buckets.values())
    .map((item) => {
      const accuracy =
        item.totalAnswered > 0
          ? Math.round((item.totalCorrect / item.totalAnswered) * 100)
          : 0;
      return {
        topicId: item.topicId,
        title: item.title || item.topicId || "Chủ đề",
        subtitle:
          item.grades.size > 0
            ? `Khối ${Array.from(item.grades).filter(Boolean).join(", ")}`
            : "Chưa xác định khối",
        note:
          item.totalAnswered > 0 ? `${accuracy}% chính xác` : "Chưa có dữ liệu",
        value: `${item.totalAnswered.toLocaleString("vi-VN")} lượt`,
        totalAnswered: item.totalAnswered,
        accuracy,
      };
    })
    .sort((left, right) => {
      const answerDiff = (right.totalAnswered || 0) - (left.totalAnswered || 0);
      if (answerDiff !== 0) {
        return answerDiff;
      }

      const accuracyDiff = (right.accuracy || 0) - (left.accuracy || 0);
      if (accuracyDiff !== 0) {
        return accuracyDiff;
      }

      return left.title.localeCompare(right.title);
    });

  return ranked[0] || null;
}

function getAdminStatsClassAverageMaps(submissionDocs = [], rangeKey = "week") {
  const buckets = new Map();

  (Array.isArray(submissionDocs) ? submissionDocs : []).forEach(
    (submission) => {
      const date = getAdminStatsSubmissionDate(submission);

      if (!isAdminStatsDateInRange(date, rangeKey)) {
        return;
      }

      const classId = String(submission?.classId || "").trim();
      const score = getAdminStatsSubmissionScore(submission);

      if (!classId || !Number.isFinite(score)) {
        return;
      }

      const scores = buckets.get(classId) || [];
      scores.push(score);
      buckets.set(classId, scores);
    },
  );

  const averageByClassId = new Map();
  buckets.forEach((scores, classId) => {
    const average =
      scores.reduce((sum, value) => sum + value, 0) / scores.length;
    averageByClassId.set(classId, Number(average.toFixed(1)));
  });

  return averageByClassId;
}

function buildAdminStatsTopClasses(
  classDocs = [],
  teacherNameById = new Map(),
  submissionDocs = [],
  rangeKey = "week",
) {
  const averageByClassId = getAdminStatsClassAverageMaps(
    submissionDocs,
    rangeKey,
  );

  return (Array.isArray(classDocs) ? classDocs : [])
    .map((doc) => {
      const data =
        typeof doc?.data === "function" ? doc.data() || {} : doc || {};
      const id = String(doc?.id || data.id || data.classId || "").trim();
      const teacherId = String(data.teacherId || "").trim();
      const students = Array.from(
        new Set(
          [
            ...(Array.isArray(data.students) ? data.students : []),
            ...(Array.isArray(data.studentIds) ? data.studentIds : []),
            ...(Array.isArray(data.members) ? data.members : []),
          ]
            .flatMap((value) => {
              if (typeof value === "string" || typeof value === "number") {
                return [String(value).trim()];
              }

              if (!value || typeof value !== "object") {
                return [];
              }

              return [value.id, value.uid, value.userId, value.studentId]
                .map((entry) => String(entry || "").trim())
                .filter(Boolean);
            })
            .filter(Boolean),
        ),
      );
      const averageScoreValue = averageByClassId.has(id)
        ? averageByClassId.get(id)
        : null;

      return {
        id,
        name: String(data.name || data.className || "Chưa đặt tên").trim(),
        className: String(data.className || data.name || "").trim(),
        teacherName: String(
          data.teacherName ||
            data.teacherUsername ||
            teacherNameById.get(teacherId) ||
            teacherId ||
            "--",
        ).trim(),
        teacherUsername: String(data.teacherUsername || "").trim(),
        studentCount:
          students.length ||
          Number(data.studentCount ?? data.studentsCount ?? 0) ||
          0,
        averageScoreValue: Number.isFinite(Number(averageScoreValue))
          ? Number(averageScoreValue)
          : null,
      };
    })
    .filter(
      (classroom) =>
        classroom.id && Number.isFinite(Number(classroom.averageScoreValue)),
    )
    .sort((left, right) => {
      const scoreDiff =
        (Number(right.averageScoreValue) || 0) -
        (Number(left.averageScoreValue) || 0);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      const studentDiff =
        (Number(right.studentCount) || 0) - (Number(left.studentCount) || 0);
      if (studentDiff !== 0) {
        return studentDiff;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, 10);
}

function buildAdminStatsViewModel(source, rangeKey = "week") {
  if (!source || typeof source !== "object") {
    return {
      chartTitle: "Điểm trung bình theo ngày",
      chartEmptyTitle: "Chưa có dữ liệu điểm",
      chartEmptyDescription:
        "Hệ thống chưa ghi nhận đủ bài nộp có điểm để vẽ biểu đồ.",
      chartSeries: [],
      topTopics: {
        math: null,
        english: null,
      },
      topClasses: [],
      hasData: false,
    };
  }

  const submissionDocs = Array.isArray(source.submissionDocs)
    ? source.submissionDocs
    : [];
  const topicDocs = Array.isArray(source.topicDocs) ? source.topicDocs : [];
  const topicCatalog = Array.isArray(source.topicCatalog)
    ? source.topicCatalog
    : [];
  const teacherDocs = Array.isArray(source.teacherDocs)
    ? source.teacherDocs
    : [];
  const teacherNameById = new Map(
    teacherDocs
      .map((doc) => {
        const id = String(doc?.id || doc?.uid || doc?.userId || "").trim();
        const name = String(
          doc?.fullName || doc?.name || doc?.username || doc?.email || "",
        ).trim();
        return id ? [id, name] : null;
      })
      .filter(Boolean),
  );
  const normalizedRange = normalizeAdminStatsRangeKey(rangeKey);
  const chartSeries = buildAdminStatsTimelineSeries(
    submissionDocs,
    normalizedRange,
  );
  const topTopics = {
    math: buildAdminStatsTopic(
      topicDocs,
      topicCatalog,
      "math",
      normalizedRange,
    ),
    english: buildAdminStatsTopic(
      topicDocs,
      topicCatalog,
      "english",
      normalizedRange,
    ),
  };
  const topClasses = buildAdminStatsTopClasses(
    source.classDocs || [],
    teacherNameById,
    submissionDocs,
    normalizedRange,
  );

  return {
    chartTitle:
      normalizedRange === "year"
        ? "Điểm trung bình theo tháng"
        : "Điểm trung bình theo ngày",
    chartEmptyTitle: "Chưa có dữ liệu điểm",
    chartEmptyDescription:
      normalizedRange === "year"
        ? "Hệ thống chưa ghi nhận đủ bài nộp có điểm trong năm nay."
        : "Hệ thống chưa ghi nhận đủ bài nộp có điểm trong khoảng thời gian này.",
    chartSeries,
    topTopics,
    topClasses,
    hasData:
      chartSeries.some((item) => Number(item.value) > 0) ||
      Boolean(topTopics.math || topTopics.english || topClasses.length > 0),
  };
}

function buildAdminStatsEmptyState(message, description) {
  return `
    <div class="admin-empty-state is-large">
      <div>
        <p>${escapeHtml(message)}</p>
        <span>${escapeHtml(description)}</span>
      </div>
    </div>
  `;
}

function syncAdminStatsRangeButtons(rangeKey = "week") {
  const normalizedRange = normalizeAdminStatsRangeKey(rangeKey);

  getAdminStatsRangeButtons().forEach((button) => {
    const isActive =
      normalizeAdminStatsRangeKey(button.dataset.adminStatsRange) ===
      normalizedRange;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function renderAdminStatsChart(
  series = [],
  {
    loading = false,
    title = "Điểm trung bình theo ngày",
    emptyTitle,
    emptyDescription,
  } = {},
) {
  const card = getAdminStatsChartCard();

  if (!card) {
    return;
  }

  if (loading) {
    card.innerHTML = buildAdminStatsEmptyState(
      "Đang tải dữ liệu thống kê",
      "Hệ thống đang đồng bộ dữ liệu thật từ Firestore.",
    );
    return;
  }

  const svgMarkup = buildAdminChartSvg(series, {
    chartKey: "work",
    ariaLabel: title,
  });

  if (!svgMarkup) {
    card.innerHTML = buildAdminStatsEmptyState(
      emptyTitle || "Chưa có dữ liệu điểm",
      emptyDescription ||
        "Hệ thống chưa ghi nhận đủ bài nộp có điểm để vẽ biểu đồ.",
    );
    return;
  }

  card.innerHTML = svgMarkup;
}

function renderAdminStatsTopic(topicKey, topic, { loading = false } = {}) {
  const titleNode = getAdminStatsTopicNode(topicKey, "topic-title");
  const subtitleNode = getAdminStatsTopicNode(topicKey, "topic-subtitle");
  const noteNode = getAdminStatsTopicNode(topicKey, "topic-note");
  const valueNode = getAdminStatsTopicNode(topicKey, "topic-value");
  const hasTopic = Boolean(topic && topic.title);
  const title = loading
    ? "Đang tải dữ liệu..."
    : hasTopic
      ? topic.title
      : "Chưa có dữ liệu";
  const subtitle = loading
    ? "Hệ thống đang đồng bộ tiến trình học..."
    : hasTopic
      ? topic.subtitle || "Chưa xác định khối"
      : "Hệ thống chưa ghi nhận tiến trình học.";
  const note = loading
    ? "Vui lòng đợi"
    : hasTopic
      ? topic.note || "Dữ liệu thật từ hệ thống"
      : "Không có dữ liệu";
  const value = loading ? "--" : hasTopic ? topic.value || "--" : "--";

  if (titleNode) {
    titleNode.textContent = title;
  }

  if (subtitleNode) {
    subtitleNode.textContent = subtitle;
  }

  if (noteNode) {
    noteNode.textContent = note;
  }

  if (valueNode) {
    valueNode.textContent = value;
  }
}

function buildAdminStatsTableRow(classroom, index) {
  const score = Number(classroom?.averageScoreValue);
  const scoreLabel = Number.isFinite(score)
    ? score.toFixed(1)
    : "Chưa có dữ liệu";

  return `
    <tr data-admin-stats-row data-admin-stats-class-id="${escapeHtml(String(classroom?.id || ""))}">
      <td>${escapeHtml(String(index + 1))}</td>
      <td><strong>${escapeHtml(classroom?.name || classroom?.className || "--")}</strong></td>
      <td>${escapeHtml(classroom?.teacherName || classroom?.teacherUsername || "--")}</td>
      <td>${escapeHtml(formatStatValue(classroom?.studentCount ?? 0))}</td>
      <td><span class="admin-stats-score">${escapeHtml(scoreLabel)}</span></td>
    </tr>
  `;
}

function renderAdminStatsTable(topClasses = [], { loading = false } = {}) {
  const tbody = getAdminStatsTableBody();
  const rows = Array.isArray(topClasses) ? topClasses : [];

  if (!tbody) {
    return;
  }

  if (loading) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="admin-empty-state is-large">
            <div>
              <p>Đang tải dữ liệu lớp học</p>
              <span>Hệ thống đang đồng bộ điểm và sĩ số từ Firestore.</span>
            </div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="admin-empty-state is-large">
            <div>
              <p>Chưa có dữ liệu lớp học</p>
              <span>Chưa đủ bài nộp có điểm để xếp hạng top lớp.</span>
            </div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows
    .map((classroom, index) => buildAdminStatsTableRow(classroom, index))
    .join("");
}

function renderAdminStatsPage() {
  const loading = adminStatsState.loading && !adminStatsState.loaded;
  syncAdminStatsRangeButtons(adminStatsState.selectedRange);

  const viewModel = buildAdminStatsViewModel(
    adminStatsState.data?.source || null,
    adminStatsState.selectedRange,
  );

  renderAdminStatsChart(viewModel.chartSeries || [], {
    loading,
    title: viewModel.chartTitle,
    emptyTitle: viewModel.chartEmptyTitle,
    emptyDescription: viewModel.chartEmptyDescription,
  });
  renderAdminStatsTopic("math", viewModel.topTopics?.math || null, { loading });
  renderAdminStatsTopic("english", viewModel.topTopics?.english || null, {
    loading,
  });
  renderAdminStatsTable(viewModel.topClasses || [], { loading });
}

async function syncAdminStats({ forceRefresh = false } = {}) {
  const root = getAdminStatsRoot();

  if (!root) {
    return null;
  }

  if (adminStatsState.loaded && adminStatsState.data && !forceRefresh) {
    renderAdminStatsPage();
    return adminStatsState.data;
  }

  if (adminStatsState.loading && adminStatsState.pendingPromise) {
    return adminStatsState.pendingPromise;
  }

  adminStatsState.loading = true;
  root.setAttribute("aria-busy", "true");
  renderAdminStatsPage();

  const request = (async () => {
    try {
      const service = window.EduKidsAdminStatsService;
      const data =
        typeof service?.fetchAdminStatsData === "function"
          ? await service.fetchAdminStatsData()
          : null;

      adminStatsState.data = data || {
        source: {
          teacherDocs: [],
          classDocs: [],
          submissionDocs: [],
          topicDocs: [],
          topicCatalog: [],
        },
        charts: {
          monthlyAverageScores: [],
        },
        topTopics: {
          math: null,
          english: null,
        },
        topClasses: [],
        hasData: false,
      };
      adminStatsState.loaded = true;
      renderAdminStatsPage();
      return adminStatsState.data;
    } catch (error) {
      console.warn("Không thể tải thống kê admin:", error);
      adminStatsState.data = {
        source: {
          teacherDocs: [],
          classDocs: [],
          submissionDocs: [],
          topicDocs: [],
          topicCatalog: [],
        },
        charts: {
          monthlyAverageScores: [],
        },
        topTopics: {
          math: null,
          english: null,
        },
        topClasses: [],
        hasData: false,
      };
      adminStatsState.loaded = true;
      renderAdminStatsPage();
      return adminStatsState.data;
    } finally {
      adminStatsState.loading = false;
      adminStatsState.pendingPromise = null;
      root.removeAttribute("aria-busy");
    }
  })();

  adminStatsState.pendingPromise = request;
  return request;
}

function getAdminReviewsRoot() {
  return document.getElementById("admin-reviews");
}

function getAdminReviewsListNode() {
  return (
    getAdminReviewsRoot()?.querySelector("[data-admin-reviews-list]") || null
  );
}

function getAdminReviewsSummaryNode() {
  return (
    getAdminReviewsRoot()?.querySelector("[data-admin-reviews-summary]") || null
  );
}

function getAdminReviewsRoleSelect() {
  return (
    getAdminReviewsRoot()?.querySelector("[data-admin-reviews-role-filter]") ||
    null
  );
}

function getAdminReviewsRatingButtons() {
  return Array.from(
    getAdminReviewsRoot()?.querySelectorAll(
      "[data-admin-reviews-rating-filter]",
    ) || [],
  );
}

function getAdminReviewAvatarPath(review) {
  const avatar = String(review?.userAvatar || "").trim();

  if (avatar) {
    return avatar;
  }

  return (
    window.EduKidsAppReviewService?.getDefaultAvatarByRole?.(review?.role) ||
    (review?.role === "teacher"
      ? "/assets/userAvatar/maleteacher.png"
      : "/assets/userAvatar/boy.png")
  );
}

function getAdminReviewRoleLabel(role) {
  return role === "teacher" ? "Giáo viên" : "Học sinh";
}

function getAdminReviewDateValue(review) {
  return getNormalizedDateFromValue(review?.createdAt)?.getTime() || 0;
}

function getAdminReviewAverageRating(reviews = []) {
  const items = Array.isArray(reviews) ? reviews : [];

  if (items.length === 0) {
    return 0;
  }

  const total = items.reduce(
    (sum, review) => sum + (Number(review?.rating) || 0),
    0,
  );
  return total / items.length;
}

function filterAdminReviews(reviews = []) {
  const ratingFilter = String(adminReviewsState.ratingFilter || "all").trim();
  const roleFilter = String(adminReviewsState.roleFilter || "all").trim();

  return (Array.isArray(reviews) ? reviews : []).filter((review) => {
    if (
      ratingFilter !== "all" &&
      String(review?.rating || "") !== ratingFilter
    ) {
      return false;
    }

    if (roleFilter !== "all" && String(review?.role || "") !== roleFilter) {
      return false;
    }

    return true;
  });
}

function buildAdminReviewStars(rating = 0) {
  return Array.from({ length: 5 }, (_, index) => {
    const value = index + 1;
    const isActive = value <= Number(rating || 0);

    return `
      <span class="admin-review-star ${isActive ? "is-active" : ""}" aria-hidden="true">
        <svg viewBox="0 0 24 24" role="presentation">
          <path
            d="M12 3.4l2.76 5.59 6.17.9-4.46 4.34 1.05 6.15L12 17.5l-5.52 2.88 1.05-6.15-4.46-4.34 6.17-.9L12 3.4z"
            fill="currentColor"
          />
        </svg>
      </span>
    `;
  }).join("");
}

function buildAdminReviewCard(review, index) {
  const comment = String(review?.comment || "").trim() || "Chưa có nội dung.";
  const dateLabel = formatReviewDate(review?.createdAt || "");
  const avatarSrc = getAdminReviewAvatarPath(review);

  return `
    <article class="admin-review-card" data-admin-review-card data-admin-review-id="${escapeHtml(String(review?.id || ""))}">
      <div class="admin-review-card-head">
        <div class="admin-review-avatar-wrap">
          <img
            class="admin-review-avatar"
            src="${escapeHtml(avatarSrc)}"
            alt="Avatar mặc định"
            onerror="this.onerror=null;this.src='${escapeHtml(
              review?.role === "teacher"
                ? "/assets/userAvatar/maleteacher.png"
                : "/assets/userAvatar/boy.png",
            )}';"
          />
          <div class="admin-review-user-copy">
            <strong>${escapeHtml(review?.userName || "Người dùng")}</strong>
            <span>${escapeHtml(getAdminReviewRoleLabel(review?.role))}</span>
          </div>
        </div>

        <div class="admin-review-meta">
          <div class="admin-review-stars">
            ${buildAdminReviewStars(review?.rating || 0)}
          </div>
          <span class="admin-review-date">${escapeHtml(dateLabel)}</span>
        </div>
      </div>

      <p class="admin-review-comment">${escapeHtml(comment)}</p>

      <div class="admin-review-footer">
        <span class="admin-review-order">#${escapeHtml(String(index + 1))}</span>
        <button
          type="button"
          class="admin-review-delete-btn"
          data-admin-review-action="delete"
          data-admin-review-id="${escapeHtml(String(review?.id || ""))}"
        >
          Xóa đánh giá
        </button>
      </div>
    </article>
  `;
}

function renderAdminReviewsStats(reviews = []) {
  const totalReviews = Array.isArray(reviews) ? reviews.length : 0;
  const averageRating = getAdminReviewAverageRating(reviews);
  const fiveStarCount = (Array.isArray(reviews) ? reviews : []).filter(
    (review) => Number(review?.rating) === 5,
  ).length;
  const oneStarCount = (Array.isArray(reviews) ? reviews : []).filter(
    (review) => Number(review?.rating) === 1,
  ).length;

  const cards = [
    {
      key: "total-reviews",
      icon: "💬",
      label: "Tổng số đánh giá",
      value: formatStatValue(totalReviews),
      note: "Tất cả phản hồi đã ghi nhận",
      color: "is-blue",
    },
    {
      key: "average-rating",
      icon: "⭐",
      label: "Điểm trung bình",
      value: totalReviews > 0 ? averageRating.toFixed(1) : "--",
      note: "Thang điểm 5 sao",
      color: "is-yellow",
    },
    {
      key: "five-star-count",
      icon: "✨",
      label: "Số đánh giá 5 sao",
      value: formatStatValue(fiveStarCount),
      note: "Phản hồi tích cực nhất",
      color: "is-green",
    },
    {
      key: "one-star-count",
      icon: "⚠",
      label: "Số đánh giá 1 sao",
      value: formatStatValue(oneStarCount),
      note: "Cần ưu tiên theo dõi",
      color: "is-red",
    },
  ];

  const root = getAdminReviewsRoot();
  if (!root) {
    return;
  }

  const nodes = root.querySelectorAll("[data-admin-reviews-stat]");
  cards.forEach((card, index) => {
    const node = nodes[index];
    if (!node) {
      return;
    }

    node.className = `admin-kpi-card ${card.color}`;
    node.innerHTML = `
      <div class="admin-kpi-icon ${card.color}">${escapeHtml(card.icon)}</div>
      <small>${escapeHtml(card.label)}</small>
      <strong>${escapeHtml(card.value)}</strong>
      <span>${escapeHtml(card.note)}</span>
    `;
  });
}

function renderAdminReviewsList(reviews = []) {
  const listNode = getAdminReviewsListNode();
  const summaryNode = getAdminReviewsSummaryNode();
  const total = Array.isArray(adminReviewsState.data)
    ? adminReviewsState.data.length
    : 0;
  const filtered = Array.isArray(reviews) ? reviews : [];

  if (!listNode) {
    return;
  }

  if (filtered.length === 0) {
    const hasData = total > 0;
    listNode.innerHTML = `
      <div class="admin-empty-state is-large">
        <div>
          <p>${hasData ? ADMIN_NO_RESULTS_MESSAGE : "Chưa có đánh giá nào"}</p>
          <span>${hasData ? "Thử thay đổi bộ lọc sao hoặc vai trò." : "Đánh giá từ người dùng sẽ xuất hiện ở đây."}</span>
        </div>
      </div>
    `;
  } else {
    listNode.innerHTML = filtered
      .map((review, index) => buildAdminReviewCard(review, index))
      .join("");
  }

  if (summaryNode) {
    summaryNode.innerHTML = `Hiển thị <strong>${escapeHtml(formatStatValue(filtered.length))}</strong> / <strong>${escapeHtml(formatStatValue(total))}</strong> đánh giá`;
  }
}

function syncAdminReviewsFilterState() {
  const ratingButtons = getAdminReviewsRatingButtons();
  const roleSelect = getAdminReviewsRoleSelect();

  ratingButtons.forEach((button) => {
    const value = String(
      button.dataset.adminReviewsRatingFilter || "all",
    ).trim();
    const isActive =
      value === String(adminReviewsState.ratingFilter || "all").trim();
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  if (roleSelect) {
    roleSelect.value = adminReviewsState.roleFilter || "all";
  }
}

function renderAdminReviewsPage() {
  syncAdminReviewsFilterState();
  const filtered = filterAdminReviews(adminReviewsState.data);
  adminReviewsState.filtered = filtered;
  renderAdminReviewsStats(adminReviewsState.data);
  renderAdminReviewsList(filtered);
}

async function syncAdminReviews({ forceRefresh = false } = {}) {
  const root = getAdminReviewsRoot();

  if (!root) {
    return null;
  }

  if (
    adminReviewsState.loaded &&
    Array.isArray(adminReviewsState.data) &&
    !forceRefresh
  ) {
    renderAdminReviewsPage();
    return adminReviewsState.data;
  }

  if (adminReviewsState.loading && adminReviewsState.pendingPromise) {
    return adminReviewsState.pendingPromise;
  }

  adminReviewsState.loading = true;
  root.setAttribute("aria-busy", "true");
  renderAdminReviewsPage();

  const request = (async () => {
    try {
      const service = window.EduKidsAppReviewService;
      const reviews =
        typeof service?.fetchReviews === "function"
          ? await service.fetchReviews()
          : [];

      adminReviewsState.data = Array.isArray(reviews) ? reviews : [];
      adminReviewsState.loaded = true;
      renderAdminReviewsPage();
      return adminReviewsState.data;
    } catch (error) {
      console.warn("Không thể tải danh sách đánh giá:", error);
      adminReviewsState.data = [];
      adminReviewsState.loaded = true;
      renderAdminReviewsPage();
      return [];
    } finally {
      adminReviewsState.loading = false;
      adminReviewsState.pendingPromise = null;
      root.removeAttribute("aria-busy");
    }
  })();

  adminReviewsState.pendingPromise = request;
  return request;
}

async function deleteAdminReview(reviewId) {
  const review = (
    Array.isArray(adminReviewsState.data) ? adminReviewsState.data : []
  ).find(
    (item) => String(item?.id || "").trim() === String(reviewId || "").trim(),
  );

  if (!review) {
    showToast("Không tìm thấy đánh giá.", "error");
    return;
  }

  const confirmed = await openConfirmModal({
    title: "Xóa đánh giá",
    message: `Bạn có chắc muốn xóa đánh giá của ${review.userName || "người dùng"} không? Hành động này không thể hoàn tác.`,
    confirmLabel: "Xóa",
    cancelLabel: "Hủy",
  });

  if (!confirmed) {
    return;
  }

  try {
    const service = window.EduKidsAppReviewService;

    if (typeof service?.deleteReview !== "function") {
      throw new Error("Dịch vụ đánh giá chưa sẵn sàng.");
    }

    await service.deleteReview(review.id);
    showToast("Đã xóa đánh giá thành công.", "success");
    await syncAdminReviews({ forceRefresh: true });
  } catch (error) {
    console.warn("Không thể xóa đánh giá:", error);
    showToast(error?.message || "Không thể xóa đánh giá.", "error");
  }
}

function getAdminStudentsRoot() {
  return document.getElementById("admin-students");
}

function getAdminStudentsSearchInput() {
  return (
    getAdminStudentsRoot()?.querySelector("[data-admin-students-search]") ||
    null
  );
}

function getAdminStudentsClassSelect() {
  return (
    getAdminStudentsRoot()?.querySelector(
      "[data-admin-students-class-filter]",
    ) || null
  );
}

function getAdminStudentsStatusSelect() {
  return (
    getAdminStudentsRoot()?.querySelector(
      "[data-admin-students-status-filter]",
    ) || null
  );
}

function getAdminStudentsTableBody() {
  return getAdminStudentsRoot()?.querySelector("tbody") || null;
}

function getAdminStudentsSummaryNode() {
  return getAdminStudentsRoot()?.querySelector(".admin-table-summary") || null;
}

function getAdminTeachersRoot() {
  return document.getElementById("admin-teachers");
}

function getAdminTeachersSearchInput() {
  return (
    getAdminTeachersRoot()?.querySelector("[data-admin-teachers-search]") ||
    null
  );
}

function getAdminTeachersClassCountSelect() {
  return (
    getAdminTeachersRoot()?.querySelector(
      "[data-admin-teachers-class-filter]",
    ) || null
  );
}

function getAdminTeachersStatusSelect() {
  return (
    getAdminTeachersRoot()?.querySelector(
      "[data-admin-teachers-status-filter]",
    ) || null
  );
}

function getAdminTeachersTableBody() {
  return (
    getAdminTeachersRoot()?.querySelector("[data-admin-teachers-tbody]") || null
  );
}

function getAdminTeachersSummaryNode() {
  return (
    getAdminTeachersRoot()?.querySelector("[data-admin-teachers-summary]") ||
    null
  );
}

function getAdminAssignmentsRoot() {
  return document.getElementById("admin-assignments");
}

function getAdminAssignmentsSearchInput() {
  return (
    getAdminAssignmentsRoot()?.querySelector(
      "[data-admin-assignments-search]",
    ) || null
  );
}

function getAdminAssignmentsSubjectSelect() {
  return (
    getAdminAssignmentsRoot()?.querySelector(
      "[data-admin-assignments-subject-filter]",
    ) || null
  );
}

function getAdminAssignmentsTableBody() {
  return (
    getAdminAssignmentsRoot()?.querySelector(
      "[data-admin-assignments-tbody]",
    ) || null
  );
}

function getAdminAssignmentsSummaryNode() {
  return (
    getAdminAssignmentsRoot()?.querySelector(
      "[data-admin-assignments-summary]",
    ) || null
  );
}

function getAdminAssignmentsStatNode(key) {
  if (!key) {
    return null;
  }

  return (
    getAdminAssignmentsRoot()?.querySelector(
      `[data-admin-assignments-stat="${key}"]`,
    ) || document.querySelector(`[data-admin-assignments-stat="${key}"]`)
  );
}

function getAdminAssignmentsNoteNode(key) {
  if (!key) {
    return null;
  }

  return (
    getAdminAssignmentsRoot()?.querySelector(
      `[data-admin-assignments-note="${key}"]`,
    ) || document.querySelector(`[data-admin-assignments-note="${key}"]`)
  );
}

function getAdminAssignmentById(assignmentId) {
  const normalizedId = String(assignmentId || "").trim();

  if (!normalizedId) {
    return null;
  }

  return (
    (Array.isArray(adminAssignmentsState.data)
      ? adminAssignmentsState.data
      : []
    ).find(
      (assignment) => String(assignment?.id || "").trim() === normalizedId,
    ) || null
  );
}

function getAdminAssignmentSubjectLabel(subject) {
  const normalized = String(subject || "")
    .trim()
    .toLowerCase();

  if (normalized === "math" || normalized === "toán" || normalized === "toan") {
    return "Toán";
  }

  if (
    normalized === "english" ||
    normalized === "tiếng anh" ||
    normalized === "tieng anh"
  ) {
    return "Tiếng Anh";
  }

  return String(subject || "").trim() || "--";
}

function getAdminAssignmentSubjectKey(subject) {
  const normalized = String(subject || "")
    .trim()
    .toLowerCase();

  if (normalized === "math" || normalized === "toán" || normalized === "toan") {
    return "math";
  }

  if (
    normalized === "english" ||
    normalized === "tiếng anh" ||
    normalized === "tieng anh"
  ) {
    return "english";
  }

  return normalized;
}

function getAdminAssignmentStatusLabel(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  if (normalized === "closed") {
    return "Đã đóng";
  }

  if (normalized === "grading") {
    return "Đang chấm";
  }

  return "Đang mở";
}

function getAdminAssignmentScoreLabel(assignment) {
  const value = Number(assignment?.averageScoreValue);

  if (!Number.isFinite(value)) {
    return "Chưa có dữ liệu";
  }

  return value.toFixed(1);
}

function getAdminAssignmentScoreWidth(assignment) {
  const value = Number(assignment?.averageScoreValue);

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value * 10));
}

function buildAdminAssignmentDetailText(assignment) {
  if (!assignment) {
    return "";
  }

  const scoreLabel = getAdminAssignmentScoreLabel(assignment);

  return [
    `Tên bài: ${assignment.title || "--"}`,
    `Môn học: ${getAdminAssignmentSubjectLabel(assignment.subject)}`,
    `Giáo viên tạo: ${assignment.teacherName || assignment.teacherId || "--"}`,
    `Số lượt làm: ${formatStatValue(assignment.submissionCount ?? 0)}`,
    `Điểm trung bình: ${scoreLabel}${Number.isFinite(Number(assignment.averageScoreValue)) ? "/10" : ""}`,
    `Trạng thái: ${getAdminAssignmentStatusLabel(assignment.status)}`,
    `Ngày tạo: ${formatDateOnly(assignment.createdAt || "")}`,
  ].join("\n");
}

function getAdminClassesRoot() {
  return document.getElementById("admin-classes");
}

function getAdminClassesSearchInput() {
  return (
    getAdminClassesRoot()?.querySelector("[data-admin-classes-search]") || null
  );
}

function getAdminClassesFilterSelect() {
  return (
    getAdminClassesRoot()?.querySelector("[data-admin-classes-filter]") || null
  );
}

function getAdminClassesGrid() {
  return (
    getAdminClassesRoot()?.querySelector("[data-admin-classes-grid]") || null
  );
}

function getAdminClassById(classId) {
  const normalizedId = String(classId || "").trim();

  if (!normalizedId) {
    return null;
  }

  return (
    (Array.isArray(adminClassesState.data) ? adminClassesState.data : []).find(
      (classroom) => String(classroom?.id || "").trim() === normalizedId,
    ) || null
  );
}

function getAdminClassGradeValue(classroom) {
  const directGrade = String(
    classroom?.grade ||
      classroom?.gradeLevel ||
      classroom?.classGrade ||
      classroom?.level ||
      "",
  ).trim();

  if (directGrade) {
    const directMatch = directGrade.match(/(\d+)/);

    if (directMatch) {
      const grade = Number(directMatch[1]);
      if (Number.isFinite(grade) && grade >= 1 && grade <= 5) {
        return String(grade);
      }
    }
  }

  const fallbackSource = String(
    classroom?.name || classroom?.className || "",
  ).trim();
  const match = fallbackSource.match(/(\d+)/);

  if (match) {
    const grade = Number(match[1]);
    if (Number.isFinite(grade) && grade >= 1 && grade <= 5) {
      return String(grade);
    }
  }

  return "";
}

function getAdminClassGradeLabel(classroom) {
  const grade = getAdminClassGradeValue(classroom);
  return grade ? `Khối ${grade}` : "Chưa xác định";
}

function getAdminClassAverageValue(classroom) {
  const value = Number(classroom?.averageScoreValue);
  return Number.isFinite(value) ? Math.max(0, Math.min(10, value)) : null;
}

function getAdminClassAverageLabel(classroom) {
  const value = getAdminClassAverageValue(classroom);
  return Number.isFinite(value) ? value.toFixed(1) : "Chưa có dữ liệu";
}

function getAdminClassAverageWidth(classroom) {
  const value = getAdminClassAverageValue(classroom);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value * 10)) : 0;
}

function getAdminClassColorClass(index) {
  const colors = ["is-blue", "is-purple", "is-green", "is-orange", "is-red"];
  return colors[Math.abs(Number(index) || 0) % colors.length];
}

function buildAdminClassDetailText(classroom) {
  if (!classroom) {
    return "";
  }

  const averageValue = getAdminClassAverageValue(classroom);
  const averageLabel = getAdminClassAverageLabel(classroom);

  return [
    `Tên lớp: ${classroom.name || classroom.className || "--"}`,
    `Khối: ${getAdminClassGradeLabel(classroom)}`,
    `Giáo viên phụ trách: ${classroom.teacherName || "--"}`,
    `Số học sinh: ${formatStatValue(classroom.studentCount ?? 0)}`,
    `Điểm trung bình lớp: ${averageLabel}${Number.isFinite(averageValue) ? "/10" : ""}`,
    `Số bài làm đã dùng để tính: ${formatStatValue(classroom.averageSampleCount ?? 0)}`,
    `Ngày tạo: ${formatDateOnly(classroom.createdAt || "")}`,
  ].join("\n");
}

function getAdminTeachersStatNode(key) {
  if (!key) {
    return null;
  }

  return (
    getAdminTeachersRoot()?.querySelector(
      `[data-admin-teachers-stat="${key}"]`,
    ) || document.querySelector(`[data-admin-teachers-stat="${key}"]`)
  );
}

function getAdminTeachersNoteNode(key) {
  if (!key) {
    return null;
  }

  return (
    getAdminTeachersRoot()?.querySelector(
      `[data-admin-teachers-note="${key}"]`,
    ) || document.querySelector(`[data-admin-teachers-note="${key}"]`)
  );
}

function getAdminTeacherStatusLabel(status) {
  return status === "locked" ? "Đã khóa" : "Hoạt động";
}

function getAdminTeacherStatusClass(status) {
  return status === "locked" ? "is-red" : "is-green";
}

function getAdminTeacherActionLabel(status) {
  return status === "locked" ? "Mở khóa" : "Khóa";
}

function getAdminTeacherActionName(status) {
  return status === "locked" ? "unlock" : "lock";
}

function getAdminTeacherInitials(teacher) {
  const source = String(
    teacher?.fullName || teacher?.name || teacher?.email || "",
  ).trim();

  if (!source) {
    return "--";
  }

  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "--";
}

function getAdminTeacherClassCountBucket(classCount) {
  const total = Math.max(0, Number(classCount) || 0);

  if (total <= 0) {
    return "0";
  }

  if (total === 1) {
    return "1";
  }

  if (total === 2) {
    return "2";
  }

  if (total === 3) {
    return "3";
  }

  return "4+";
}

function buildAdminTeacherRow(teacher, index) {
  const status = teacher.status === "locked" ? "locked" : "active";
  const statusLabel = getAdminTeacherStatusLabel(status);
  const statusClass = getAdminTeacherStatusClass(status);
  const actionLabel = getAdminTeacherActionLabel(status);
  const actionName = getAdminTeacherActionName(status);
  const classCount = Math.max(0, Number(teacher.classCount) || 0);
  const email = String(teacher.email || "--").trim() || "--";

  return `
    <tr data-admin-teacher-row data-admin-teacher-id="${escapeHtml(teacher.id)}">
      <td>${escapeHtml(String(index + 1))}</td>
      <td class="admin-user-cell">
        <div class="admin-user-avatar is-purple">${escapeHtml(getAdminTeacherInitials(teacher))}</div>
        <div>
          <strong>${escapeHtml(teacher.fullName || teacher.name || "--")}</strong>
          <span>Giáo viên</span>
        </div>
      </td>
      <td>${escapeHtml(email)}</td>
      <td>${escapeHtml(formatStatValue(classCount))}</td>
      <td>${escapeHtml(formatDateOnly(teacher.createdAt || ""))}</td>
      <td><span class="admin-status-badge ${escapeHtml(statusClass)}">${escapeHtml(statusLabel)}</span></td>
      <td>
        <div class="admin-action-group">
          <button type="button" data-admin-teacher-action="reset-password" data-admin-teacher-id="${escapeHtml(teacher.id)}">Đặt lại mật khẩu</button>
          <button type="button" class="${actionName === "lock" ? "is-danger" : ""}" data-admin-teacher-action="${escapeHtml(actionName)}" data-admin-teacher-id="${escapeHtml(teacher.id)}">${escapeHtml(actionLabel)}</button>
        </div>
      </td>
    </tr>
  `;
}

function filterAdminTeachers(teachers = []) {
  const query = normalizeAdminSearchValue(adminTeachersState.searchQuery);
  const classCountFilter = String(
    adminTeachersState.classCountFilter || "",
  ).trim();
  const statusFilter = String(adminTeachersState.statusFilter || "")
    .trim()
    .toLowerCase();

  return (Array.isArray(teachers) ? teachers : []).filter((teacher) => {
    const searchIndex = getAdminSearchIndex(
      teacher?.fullName,
      teacher?.name,
      teacher?.email,
    );
    const status = String(teacher?.status || "active").toLowerCase();
    const classBucket = getAdminTeacherClassCountBucket(teacher?.classCount);

    if (query && !searchIndex.includes(query)) {
      return false;
    }

    if (classCountFilter && classBucket !== classCountFilter) {
      return false;
    }

    if (statusFilter && status !== statusFilter) {
      return false;
    }

    return true;
  });
}

function renderAdminTeachersClassOptions() {
  const select = getAdminTeachersClassCountSelect();

  if (!select) {
    return;
  }

  const currentValue = String(adminTeachersState.classCountFilter || "").trim();

  select.innerHTML = `
    <option value="">Tất cả</option>
    <option value="1">1 lớp</option>
    <option value="2">2 lớp</option>
    <option value="3">3 lớp</option>
    <option value="4+">4 lớp trở lên</option>
  `;

  select.value = currentValue || "";
}

function renderAdminTeachersStats(teachers = []) {
  const totalTeachers = Array.isArray(teachers) ? teachers.length : 0;
  const totalClasses = (Array.isArray(teachers) ? teachers : []).reduce(
    (sum, teacher) => sum + Math.max(0, Number(teacher?.classCount) || 0),
    0,
  );

  const statConfig = [
    {
      key: "total-teachers",
      value: totalTeachers,
      note: `${formatStatValue(totalTeachers)} tài khoản giáo viên`,
    },
    {
      key: "total-classes",
      value: totalClasses,
      note: `${formatStatValue(totalClasses)} lớp đang được quản lý`,
    },
  ];

  statConfig.forEach((item) => {
    const statNode = getAdminTeachersStatNode(item.key);
    const noteNode = getAdminTeachersNoteNode(item.key);

    if (statNode) {
      statNode.textContent = formatStatValue(item.value ?? 0);
    }

    if (noteNode) {
      noteNode.textContent = item.note;
    }
  });
}

function renderAdminTeachersTable(teachers = []) {
  const tbody = getAdminTeachersTableBody();
  const summaryNode = getAdminTeachersSummaryNode();
  const total = Array.isArray(adminTeachersState.data)
    ? adminTeachersState.data.length
    : 0;
  const filtered = Array.isArray(teachers) ? teachers : [];

  if (tbody) {
    if (filtered.length === 0) {
      const hasData = total > 0;
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="admin-empty-state is-large">
              <div>
                <p>${hasData ? ADMIN_NO_RESULTS_MESSAGE : "Không có dữ liệu giáo viên"}</p>
                <span>${hasData ? "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm." : "Danh sách giáo viên sẽ được đồng bộ từ Firestore."}</span>
              </div>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered
        .map((teacher, index) => buildAdminTeacherRow(teacher, index))
        .join("");
    }
  }

  if (summaryNode) {
    if (filtered.length === 0) {
      summaryNode.innerHTML =
        total === 0
          ? "Chưa có dữ liệu giáo viên trong hệ thống."
          : ADMIN_NO_RESULTS_MESSAGE;
    } else {
      summaryNode.innerHTML = `Hiển thị 1 đến ${escapeHtml(formatStatValue(filtered.length))} trong tổng số <strong>${escapeHtml(formatStatValue(total))}</strong> giáo viên`;
    }
  }
}

function setAdminTeachersFiltersFromInputs() {
  const searchInput = getAdminTeachersSearchInput();
  const classSelect = getAdminTeachersClassCountSelect();
  const statusSelect = getAdminTeachersStatusSelect();

  adminTeachersState.searchQuery = String(searchInput?.value || "");
  adminTeachersState.classCountFilter = String(classSelect?.value || "");
  adminTeachersState.statusFilter = String(statusSelect?.value || "");
}

function renderAdminTeachersPage() {
  renderAdminTeachersStats(adminTeachersState.data);
  renderAdminTeachersClassOptions();
  setAdminTeachersFiltersFromInputs();
  const teachers = filterAdminTeachers(adminTeachersState.data);
  adminTeachersState.filtered = teachers;
  renderAdminTeachersTable(teachers);
}

async function syncAdminTeachers({ forceRefresh = false } = {}) {
  const root = getAdminTeachersRoot();

  if (!root) {
    return null;
  }

  if (
    adminTeachersState.loaded &&
    Array.isArray(adminTeachersState.data) &&
    !forceRefresh
  ) {
    renderAdminTeachersPage();
    return adminTeachersState.data;
  }

  if (adminTeachersState.loading && adminTeachersState.pendingPromise) {
    return adminTeachersState.pendingPromise;
  }

  adminTeachersState.loading = true;
  root.setAttribute("aria-busy", "true");

  const request = (async () => {
    try {
      const service = window.EduKidsAdminTeacherService;
      const teachers =
        typeof service?.fetchTeachers === "function"
          ? await service.fetchTeachers()
          : [];

      adminTeachersState.data = Array.isArray(teachers)
        ? teachers
            .map((teacher) => service?.normalizeTeacher?.(teacher) || teacher)
            .filter((teacher) => String(teacher?.id || "").trim())
            .sort((left, right) => {
              const leftTime = Number(left?.createdAtValue) || 0;
              const rightTime = Number(right?.createdAtValue) || 0;
              return rightTime - leftTime;
            })
        : [];
      adminTeachersState.loaded = true;

      renderAdminTeachersPage();
      return adminTeachersState.data;
    } catch (error) {
      console.warn("Không thể tải danh sách giáo viên:", error);
      adminTeachersState.data = [];
      adminTeachersState.loaded = true;
      renderAdminTeachersPage();
      return [];
    } finally {
      adminTeachersState.loading = false;
      adminTeachersState.pendingPromise = null;
      root.removeAttribute("aria-busy");
    }
  })();

  adminTeachersState.pendingPromise = request;
  return request;
}

function filterAdminClasses(classrooms = []) {
  const query = normalizeAdminSearchValue(adminClassesState.searchQuery);
  const gradeFilter = String(adminClassesState.gradeFilter || "").trim();

  return (Array.isArray(classrooms) ? classrooms : []).filter((classroom) => {
    const searchIndex = getAdminSearchIndex(
      classroom?.name,
      classroom?.className,
      classroom?.teacherName,
      classroom?.teacherUsername,
      classroom?.classCode,
    );
    const gradeValue = getAdminClassGradeValue(classroom);

    if (query && !searchIndex.includes(query)) {
      return false;
    }

    if (gradeFilter && gradeValue !== gradeFilter) {
      return false;
    }

    return true;
  });
}

function buildAdminClassCard(classroom, index) {
  const colorClass = getAdminClassColorClass(index);
  const gradeLabel = getAdminClassGradeLabel(classroom);
  const averageValue = getAdminClassAverageValue(classroom);
  const averageLabel = getAdminClassAverageLabel(classroom);
  const averageWidth = getAdminClassAverageWidth(classroom);
  const studentCount = Math.max(0, Number(classroom?.studentCount) || 0);
  const teacherLabel =
    String(
      classroom?.teacherName || classroom?.teacherUsername || "--",
    ).trim() || "--";
  const scoreClass = Number.isFinite(averageValue) ? "" : " is-empty";
  const scoreText = Number.isFinite(averageValue)
    ? averageLabel
    : "Chưa có dữ liệu";
  const scoreSuffix = Number.isFinite(averageValue) ? "/10" : "";

  return `
    <article
      class="admin-class-card ${escapeHtml(colorClass)}"
      data-admin-class-card
      data-admin-class-id="${escapeHtml(classroom.id)}"
      data-admin-class-grade="${escapeHtml(String(getAdminClassGradeValue(classroom) || ""))}"
    >
      <div class="admin-class-card-top">
        <div>
          <span class="admin-class-badge">${escapeHtml(gradeLabel)}</span>
          <h3>${escapeHtml(classroom.name || classroom.className || "Lớp học")}</h3>
          <p>Giáo viên phụ trách</p>
        </div>
        <div class="admin-class-score${scoreClass}">
          <strong>${escapeHtml(scoreText)}</strong>
          ${scoreSuffix ? `<span>${escapeHtml(scoreSuffix)}</span>` : ""}
        </div>
      </div>

      <div class="admin-class-card-meta">
        <span>👩‍🏫 ${escapeHtml(teacherLabel)}</span>
        <span>👨‍🎓 ${escapeHtml(formatStatValue(studentCount))} học sinh</span>
      </div>

      <div class="admin-class-progress">
        <div class="admin-class-progress-label">
          <span>Điểm trung bình lớp</span>
          <strong>${escapeHtml(scoreText)}${scoreSuffix}</strong>
        </div>
        <div class="admin-class-progress-track">
          <div class="admin-class-progress-fill ${escapeHtml(colorClass)}" style="width: ${escapeHtml(String(averageWidth))}%"></div>
        </div>
      </div>

      <div class="admin-class-actions">
        <button type="button" class="is-primary" data-admin-class-action="view" data-admin-class-id="${escapeHtml(classroom.id)}">Xem chi tiết</button>
        <button type="button">Sửa lớp</button>
      </div>
    </article>
  `;
}

function renderAdminClassesGrid(classrooms = []) {
  const grid = getAdminClassesGrid();
  const filtered = Array.isArray(classrooms) ? classrooms : [];
  const total = Array.isArray(adminClassesState.data)
    ? adminClassesState.data.length
    : 0;

  if (!grid) {
    return;
  }

  if (filtered.length === 0) {
    const hasData = total > 0;
    grid.innerHTML = `
      <div class="admin-empty-state is-large">
        <div>
          <p>${hasData ? ADMIN_NO_RESULTS_MESSAGE : "Chưa có dữ liệu lớp học"}</p>
          <span>${hasData ? "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm." : "Hệ thống sẽ hiển thị dữ liệu thật từ Firestore khi có lớp học."}</span>
        </div>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered
    .map((classroom, index) => buildAdminClassCard(classroom, index))
    .join("");
}

function setAdminClassesFiltersFromInputs() {
  const searchInput = getAdminClassesSearchInput();
  const filterSelect = getAdminClassesFilterSelect();

  adminClassesState.searchQuery = String(searchInput?.value || "");
  adminClassesState.gradeFilter = String(filterSelect?.value || "");
}

function renderAdminClassesPage() {
  setAdminClassesFiltersFromInputs();
  const classrooms = filterAdminClasses(adminClassesState.data);
  adminClassesState.filtered = classrooms;
  renderAdminClassesGrid(classrooms);
}

async function syncAdminClasses({ forceRefresh = false } = {}) {
  const root = getAdminClassesRoot();

  if (!root) {
    return null;
  }

  if (
    adminClassesState.loaded &&
    Array.isArray(adminClassesState.data) &&
    !forceRefresh
  ) {
    renderAdminClassesPage();
    return adminClassesState.data;
  }

  if (adminClassesState.loading && adminClassesState.pendingPromise) {
    return adminClassesState.pendingPromise;
  }

  adminClassesState.loading = true;
  root.setAttribute("aria-busy", "true");

  const request = (async () => {
    try {
      const service = window.EduKidsAdminClassService;
      const classrooms =
        typeof service?.fetchClasses === "function"
          ? await service.fetchClasses()
          : [];

      adminClassesState.data = Array.isArray(classrooms)
        ? classrooms
            .filter((classroom) => String(classroom?.id || "").trim())
            .sort((left, right) => {
              const leftTime = Number(left?.createdAtValue) || 0;
              const rightTime = Number(right?.createdAtValue) || 0;
              return rightTime - leftTime;
            })
        : [];
      adminClassesState.loaded = true;

      renderAdminClassesPage();
      return adminClassesState.data;
    } catch (error) {
      console.warn("Không thể tải danh sách lớp học:", error);
      adminClassesState.data = [];
      adminClassesState.loaded = true;
      renderAdminClassesPage();
      return [];
    } finally {
      adminClassesState.loading = false;
      adminClassesState.pendingPromise = null;
      root.removeAttribute("aria-busy");
    }
  })();

  adminClassesState.pendingPromise = request;
  return request;
}

function showAdminClassDetail(classroom) {
  if (!classroom) {
    showToast("Không tìm thấy lớp học.", "error");
    return;
  }

  window.alert(buildAdminClassDetailText(classroom));
}

function filterAdminAssignments(assignments = []) {
  const query = normalizeAdminSearchValue(adminAssignmentsState.searchQuery);
  const subjectFilter = String(adminAssignmentsState.subjectFilter || "")
    .trim()
    .toLowerCase();

  return (Array.isArray(assignments) ? assignments : []).filter(
    (assignment) => {
      const searchIndex = getAdminSearchIndex(
        assignment?.title,
        assignment?.teacherName,
        assignment?.className,
        assignment?.subject,
      );
      const subjectKey = getAdminAssignmentSubjectKey(assignment?.subject);

      if (query && !searchIndex.includes(query)) {
        return false;
      }

      if (subjectFilter && subjectKey !== subjectFilter) {
        return false;
      }

      return true;
    },
  );
}

function buildAdminAssignmentRow(assignment, index) {
  const subjectLabel = getAdminAssignmentSubjectLabel(assignment.subject);
  const statusLabel = getAdminAssignmentStatusLabel(assignment.status);
  const statusClass = assignment.statusClass || "is-green";
  const scoreLabel = getAdminAssignmentScoreLabel(assignment);
  const scoreSuffix = Number.isFinite(Number(assignment.averageScoreValue))
    ? "/10"
    : "";

  return `
    <tr data-admin-assignment-row data-admin-assignment-id="${escapeHtml(assignment.id)}">
      <td>${escapeHtml(String(index + 1))}</td>
      <td class="admin-assign-cell">
        <div>
          <strong>${escapeHtml(assignment.title || "--")}</strong>
          <span>${escapeHtml(assignment.className || assignment.classId || "--")}</span>
        </div>
      </td>
      <td><span class="admin-topic-badge is-green">${escapeHtml(subjectLabel)}</span></td>
      <td>${escapeHtml(assignment.teacherName || assignment.teacherId || "--")}</td>
      <td>${escapeHtml(formatStatValue(assignment.submissionCount ?? 0))}</td>
      <td>${escapeHtml(scoreLabel)}${scoreSuffix}</td>
      <td>
        <div class="admin-topic-actions">
          <button type="button" data-admin-assignment-action="view" data-admin-assignment-id="${escapeHtml(assignment.id)}">Xem chi tiết</button>
          <button type="button" class="is-danger">Xóa</button>
        </div>
      </td>
    </tr>
  `;
}

function renderAdminAssignmentsStats(assignments = []) {
  const totalAssignments = Array.isArray(assignments) ? assignments.length : 0;
  const totalSubmissions = (
    Array.isArray(assignments) ? assignments : []
  ).reduce(
    (sum, assignment) =>
      sum + Math.max(0, Number(assignment?.submissionCount) || 0),
    0,
  );
  const scoredAssignments = (
    Array.isArray(assignments) ? assignments : []
  ).filter((assignment) =>
    Number.isFinite(Number(assignment?.averageScoreValue)),
  );
  const averageScore = scoredAssignments.length
    ? scoredAssignments.reduce(
        (sum, assignment) => sum + Number(assignment.averageScoreValue || 0),
        0,
      ) / scoredAssignments.length
    : null;
  const averageLabel = Number.isFinite(averageScore)
    ? Number(averageScore).toFixed(1)
    : "Chưa có dữ liệu";

  const statConfig = [
    {
      key: "total-assignments",
      value: totalAssignments,
      note: `${formatStatValue(totalAssignments)} bài tập đang có`,
    },
    {
      key: "total-submissions",
      value: totalSubmissions,
      note: `${formatStatValue(totalSubmissions)} lượt làm từ assignment_submissions`,
    },
    {
      key: "average-score",
      value: averageLabel,
      note: Number.isFinite(averageScore)
        ? "Tính từ các bài nộp đã chấm"
        : "Chưa có bài nộp có điểm",
    },
  ];

  statConfig.forEach((item) => {
    const statNode = getAdminAssignmentsStatNode(item.key);
    const noteNode = getAdminAssignmentsNoteNode(item.key);

    if (statNode) {
      if (item.key === "average-score") {
        if (Number.isFinite(averageScore)) {
          statNode.innerHTML = `${escapeHtml(String(item.value))}<span>/10</span>`;
        } else {
          statNode.textContent = String(item.value);
        }
      } else {
        statNode.textContent = formatStatValue(item.value ?? 0);
      }
    }

    if (noteNode) {
      noteNode.textContent = item.note;
    }
  });
}

function renderAdminAssignmentsTable(assignments = []) {
  const tbody = getAdminAssignmentsTableBody();
  const summaryNode = getAdminAssignmentsSummaryNode();
  const total = Array.isArray(adminAssignmentsState.data)
    ? adminAssignmentsState.data.length
    : 0;
  const filtered = Array.isArray(assignments) ? assignments : [];

  if (tbody) {
    if (filtered.length === 0) {
      const hasData = total > 0;
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="admin-empty-state is-large">
              <div>
                <p>${hasData ? ADMIN_NO_RESULTS_MESSAGE : "Chưa có dữ liệu bài tập"}</p>
                <span>${hasData ? "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc môn học." : "Hệ thống chưa ghi nhận bài tập nào từ Firestore."}</span>
              </div>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered
        .map((assignment, index) => buildAdminAssignmentRow(assignment, index))
        .join("");
    }
  }

  if (summaryNode) {
    if (filtered.length === 0) {
      summaryNode.innerHTML =
        total === 0
          ? "Chưa có dữ liệu bài tập trong hệ thống."
          : ADMIN_NO_RESULTS_MESSAGE;
    } else {
      summaryNode.innerHTML = `Hiển thị 1 đến ${escapeHtml(formatStatValue(filtered.length))} trong tổng số <strong>${escapeHtml(formatStatValue(total))}</strong> bài tập`;
    }
  }
}

function setAdminAssignmentsFiltersFromInputs() {
  const searchInput = getAdminAssignmentsSearchInput();
  const subjectSelect = getAdminAssignmentsSubjectSelect();

  adminAssignmentsState.searchQuery = String(searchInput?.value || "");
  adminAssignmentsState.subjectFilter = String(subjectSelect?.value || "");
}

function renderAdminAssignmentsPage() {
  renderAdminAssignmentsStats(adminAssignmentsState.data);
  setAdminAssignmentsFiltersFromInputs();
  const assignments = filterAdminAssignments(adminAssignmentsState.data);
  adminAssignmentsState.filtered = assignments;
  renderAdminAssignmentsTable(assignments);
}

async function syncAdminAssignments({ forceRefresh = false } = {}) {
  const root = getAdminAssignmentsRoot();

  if (!root) {
    return null;
  }

  if (
    adminAssignmentsState.loaded &&
    Array.isArray(adminAssignmentsState.data) &&
    !forceRefresh
  ) {
    renderAdminAssignmentsPage();
    return adminAssignmentsState.data;
  }

  if (adminAssignmentsState.loading && adminAssignmentsState.pendingPromise) {
    return adminAssignmentsState.pendingPromise;
  }

  adminAssignmentsState.loading = true;
  root.setAttribute("aria-busy", "true");

  const request = (async () => {
    try {
      const service = window.EduKidsAdminAssignmentService;
      const assignments =
        typeof service?.fetchAssignments === "function"
          ? await service.fetchAssignments()
          : [];

      adminAssignmentsState.data = Array.isArray(assignments)
        ? assignments
            .filter((assignment) => String(assignment?.id || "").trim())
            .sort((left, right) => {
              const leftTime = Number(left?.createdAtValue) || 0;
              const rightTime = Number(right?.createdAtValue) || 0;
              return rightTime - leftTime;
            })
        : [];
      adminAssignmentsState.loaded = true;
      renderAdminAssignmentsPage();
      return adminAssignmentsState.data;
    } catch (error) {
      console.warn("Không thể tải danh sách bài tập:", error);
      adminAssignmentsState.data = [];
      adminAssignmentsState.loaded = true;
      renderAdminAssignmentsPage();
      return [];
    } finally {
      adminAssignmentsState.loading = false;
      adminAssignmentsState.pendingPromise = null;
      root.removeAttribute("aria-busy");
    }
  })();

  adminAssignmentsState.pendingPromise = request;
  return request;
}

function showAdminAssignmentDetail(assignment) {
  if (!assignment) {
    showToast("Không tìm thấy bài tập.", "error");
    return;
  }

  window.alert(buildAdminAssignmentDetailText(assignment));
}

function getAdminAiRoot() {
  return document.getElementById("admin-ai");
}

function getAdminAiStatNode(key) {
  if (!key) {
    return null;
  }

  return (
    getAdminAiRoot()?.querySelector(`[data-admin-ai-stat="${key}"]`) ||
    document.querySelector(`[data-admin-ai-stat="${key}"]`)
  );
}

function getAdminAiNoteNode(key) {
  if (!key) {
    return null;
  }

  return (
    getAdminAiRoot()?.querySelector(`[data-admin-ai-note="${key}"]`) ||
    document.querySelector(`[data-admin-ai-note="${key}"]`)
  );
}

function getAdminAiChartCard() {
  return getAdminAiRoot()?.querySelector("[data-admin-ai-chart-card]") || null;
}

function getAdminAiToggleButton(key) {
  if (!key) {
    return null;
  }

  return (
    getAdminAiRoot()?.querySelector(`[data-admin-ai-toggle="${key}"]`) || null
  );
}

function getAdminAiToggleStateNode(key) {
  if (!key) {
    return null;
  }

  return (
    getAdminAiRoot()?.querySelector(`[data-admin-ai-toggle-state="${key}"]`) ||
    null
  );
}

function getAdminAiActionButton(action) {
  if (!action) {
    return null;
  }

  return (
    getAdminAiRoot()?.querySelector(`[data-admin-ai-action="${action}"]`) ||
    null
  );
}

function getAdminAiChartSeries(logs = []) {
  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  start.setDate(start.getDate() - 6);
  const buckets = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      }).format(date),
      value: 0,
    };
  });

  const bucketMap = new Map(buckets.map((item) => [item.key, item]));

  (Array.isArray(logs) ? logs : []).forEach((log) => {
    const createdAtValue = Number(log?.createdAtValue) || 0;
    if (!createdAtValue) {
      return;
    }

    const date = new Date(createdAtValue);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const bucket = bucketMap.get(key);

    if (bucket) {
      bucket.value += 1;
    }
  });

  return buckets;
}

function renderAdminAiChart(series = []) {
  const card = getAdminAiChartCard();

  if (!card) {
    return;
  }

  const normalizedSeries = Array.isArray(series) ? series : [];
  const hasData = normalizedSeries.some((entry) => Number(entry?.value) > 0);

  if (!hasData) {
    card.innerHTML = `
      <div class="admin-empty-state is-large">
        <div>
          <p>Chưa có dữ liệu AI</p>
          <span>Hệ thống sẽ vẽ biểu đồ khi có log AI đầu tiên.</span>
        </div>
      </div>
    `;
    return;
  }

  const svg = buildAdminChartSvg(normalizedSeries, {
    chartKey: "ai",
    ariaLabel: "Lượt sử dụng AI theo ngày",
  });

  if (!svg) {
    card.innerHTML = `
      <div class="admin-empty-state is-large">
        <div>
          <p>Chưa có dữ liệu AI</p>
          <span>Hệ thống sẽ vẽ biểu đồ khi có log AI đầu tiên.</span>
        </div>
      </div>
    `;
    return;
  }

  card.innerHTML = svg;
}

function renderAdminAiStats(data = null) {
  const todayCount = Number(data?.todayCount) || 0;
  const monthCount = Number(data?.monthCount) || 0;
  const successRate = Number(data?.successRate) || 0;

  const statConfig = [
    {
      key: "today",
      value: todayCount,
      note:
        todayCount > 0
          ? `${formatStatValue(todayCount)} lượt hôm nay`
          : "Chưa có log AI trong hôm nay",
    },
    {
      key: "month",
      value: monthCount,
      note:
        monthCount > 0
          ? `${formatStatValue(monthCount)} lượt trong tháng này`
          : "Chưa có log AI trong tháng này",
    },
    {
      key: "success-rate",
      value: successRate,
      note:
        data?.logs?.length > 0
          ? "Tính từ toàn bộ log AI"
          : "Chưa có log AI để tính tỷ lệ",
    },
  ];

  statConfig.forEach((item) => {
    const statNode = getAdminAiStatNode(item.key);
    const noteNode = getAdminAiNoteNode(item.key);

    if (statNode) {
      if (item.key === "success-rate") {
        statNode.innerHTML = `${escapeHtml(formatStatValue(item.value ?? 0))}<span>%</span>`;
      } else {
        statNode.textContent = formatStatValue(item.value ?? 0);
      }
    }

    if (noteNode) {
      noteNode.textContent = item.note;
    }
  });

  syncAdminAiToggleStates();
}

function renderAdminAiPage() {
  renderAdminAiStats(adminAiState.data);
  renderAdminAiChart(adminAiState.data?.dailySeries || []);
}

async function syncAdminAi({ forceRefresh = false } = {}) {
  const root = getAdminAiRoot();

  if (!root) {
    return null;
  }

  if (adminAiState.loaded && adminAiState.data && !forceRefresh) {
    renderAdminAiPage();
    return adminAiState.data;
  }

  if (adminAiState.loading && adminAiState.pendingPromise) {
    return adminAiState.pendingPromise;
  }

  adminAiState.loading = true;
  root.setAttribute("aria-busy", "true");

  const request = (async () => {
    try {
      const service = window.EduKidsAdminAiService;
      const data =
        typeof service?.fetchAiDashboardData === "function"
          ? await service.fetchAiDashboardData()
          : {
              settings: {
                aiCoachEnabled: true,
                aiTopicLearningEnabled: true,
                aiAssignmentEnabled: true,
                ai: {
                  coachEnabled: true,
                  assignmentEnabled: true,
                  learningAnalysisEnabled: true,
                },
                cacheRevision: 0,
              },
              logs: [],
              todayCount: 0,
              monthCount: 0,
              successRate: 0,
              dailySeries: [],
              hasLogs: false,
            };

      adminAiState.data = data;
      adminAiState.loaded = true;
      renderAdminAiPage();
      return data;
    } catch (error) {
      console.warn("Không thể tải dữ liệu AI:", error);
      adminAiState.data = {
        settings: {
          aiCoachEnabled: true,
          aiTopicLearningEnabled: true,
          aiAssignmentEnabled: true,
          ai: {
            coachEnabled: true,
            assignmentEnabled: true,
            learningAnalysisEnabled: true,
          },
          cacheRevision: 0,
        },
        logs: [],
        todayCount: 0,
        monthCount: 0,
        successRate: 0,
        dailySeries: [],
        hasLogs: false,
      };
      adminAiState.loaded = true;
      renderAdminAiPage();
      return adminAiState.data;
    } finally {
      adminAiState.loading = false;
      adminAiState.pendingPromise = null;
      root.removeAttribute("aria-busy");
    }
  })();

  adminAiState.pendingPromise = request;
  return request;
}

async function refreshAiCoachEnabledState(forceRefresh = false) {
  const settings = forceRefresh
    ? await syncSystemSettings({ forceRefresh: true })
    : getSystemSettingsData() || (await syncSystemSettings());

  return settings?.aiCoachEnabled !== false;
}

function syncAdminAiToggleStates() {
  const ai = getSystemSettingsAi();
  const toggleMap = {
    coach: ai.aiCoachEnabled !== false,
    "topic-learning": ai.aiTopicLearningEnabled !== false,
    assignment: ai.aiAssignmentEnabled !== false,
  };

  Object.entries(toggleMap).forEach(([key, enabled]) => {
    const toggleButton = getAdminAiToggleButton(key);
    const toggleStateNode = getAdminAiToggleStateNode(key);

    if (toggleButton) {
      toggleButton.classList.toggle("is-on", enabled);
      toggleButton.setAttribute("aria-pressed", String(enabled));
    }

    if (toggleStateNode) {
      toggleStateNode.textContent = enabled ? "Đang bật" : "Đang tắt";
      toggleStateNode.classList.toggle("is-off", !enabled);
    }
  });
}

function getAiFeatureUpdatePayload(featureKey, enabled) {
  const nextEnabled = Boolean(enabled);

  if (featureKey === "coach") {
    return {
      updates: {
        aiCoachEnabled: nextEnabled,
        ai: {
          coachEnabled: nextEnabled,
        },
      },
      confirmMessage: nextEnabled
        ? "Bật AI Coach?"
        : "Tắt AI Coach? AI Coach sẽ bị chặn trên toàn hệ thống.",
      successMessage: nextEnabled ? "Đã bật AI Coach." : "Đã tắt AI Coach.",
      errorMessage: "Không thể cập nhật cấu hình AI Coach.",
    };
  }

  if (featureKey === "topic-learning") {
    return {
      updates: {
        aiTopicLearningEnabled: nextEnabled,
        ai: {
          learningAnalysisEnabled: nextEnabled,
        },
      },
      confirmMessage: nextEnabled
        ? "Bật AI Học theo chủ đề?"
        : "Tắt AI Học theo chủ đề? Hệ thống sẽ không tạo nội dung AI cho chủ đề.",
      successMessage: nextEnabled
        ? "Đã bật AI Học theo chủ đề."
        : "Đã tắt AI Học theo chủ đề.",
      errorMessage: "Không thể cập nhật cấu hình AI Học theo chủ đề.",
    };
  }

  if (featureKey === "assignment") {
    return {
      updates: {
        aiAssignmentEnabled: nextEnabled,
        ai: {
          assignmentEnabled: nextEnabled,
        },
      },
      confirmMessage: nextEnabled
        ? "Bật AI Tạo bài tập giáo viên?"
        : "Tắt AI Tạo bài tập giáo viên? Giáo viên sẽ không tạo đề bằng AI.",
      successMessage: nextEnabled
        ? "Đã bật AI Tạo bài tập giáo viên."
        : "Đã tắt AI Tạo bài tập giáo viên.",
      errorMessage: "Không thể cập nhật cấu hình AI Tạo bài tập giáo viên.",
    };
  }

  return null;
}

async function toggleAdminAiFeature(featureKey) {
  const normalizedKey = String(featureKey || "").trim();
  const ai = getSystemSettingsAi();
  const currentEnabled =
    normalizedKey === "coach"
      ? ai.aiCoachEnabled !== false
      : normalizedKey === "topic-learning"
        ? ai.aiTopicLearningEnabled !== false
        : normalizedKey === "assignment"
          ? ai.aiAssignmentEnabled !== false
          : true;
  const payload = getAiFeatureUpdatePayload(normalizedKey, !currentEnabled);

  if (!payload) {
    return;
  }

  if (!window.confirm(payload.confirmMessage)) {
    return;
  }

  try {
    await updateSystemSettings(payload.updates);
    await syncSystemSettings({ forceRefresh: true });
    await syncAdminAi({ forceRefresh: true });
    syncAdminAiToggleStates();
    if (currentPage === "ai-coach") {
      renderAICoachPage();
    }
    if (currentAdminPage === "admin-settings") {
      renderAdminSettingsPage();
    }
    showToast(payload.successMessage, "success");
  } catch (error) {
    console.warn(`Không thể cập nhật cấu hình ${normalizedKey}:`, error);
    showToast(payload.errorMessage, "error");
  }
}

async function toggleAdminAiCoach() {
  return toggleAdminAiFeature("coach");
}

async function toggleAdminAiTopicLearning() {
  return toggleAdminAiFeature("topic-learning");
}

async function toggleAdminAiAssignment() {
  return toggleAdminAiFeature("assignment");
}

async function clearAdminAiCache() {
  const service = window.EduKidsAdminAiService;

  if (typeof service?.clearCoachCache !== "function") {
    showToast("Dịch vụ xóa cache AI chưa sẵn sàng.", "error");
    return;
  }

  if (!window.confirm("Xóa cache AI Coach trong Firebase?")) {
    return;
  }

  try {
    const result = await service.clearCoachCache();
    await syncAdminAi({ forceRefresh: true });
    if (currentPage === "ai-coach") {
      renderAICoachPage();
    }
    showToast(
      `Đã xóa ${formatStatValue(result?.deletedCount || 0)} cache AI.`,
      "success",
    );
  } catch (error) {
    console.warn("Không thể xóa cache AI:", error);
    showToast("Không thể xóa cache AI.", "error");
  }
}

async function showAdminAiLogs() {
  const service = window.EduKidsAdminAiService;

  if (typeof service?.fetchAiDashboardData !== "function") {
    showToast("Dịch vụ log AI chưa sẵn sàng.", "error");
    return;
  }

  try {
    const data = adminAiState.data || (await service.fetchAiDashboardData());
    const latestLogs = Array.isArray(data?.logs) ? data.logs.slice(0, 8) : [];
    const lines = [
      `Tổng log: ${formatStatValue(Array.isArray(data?.logs) ? data.logs.length : 0)}`,
      `Hôm nay: ${formatStatValue(data?.todayCount || 0)}`,
      `Tháng này: ${formatStatValue(data?.monthCount || 0)}`,
      "",
      ...latestLogs.map((log) => {
        const dateLabel = formatDateOnly(log.createdAt || "");
        return `${dateLabel} | ${log.feature || "--"} | ${log.status || "--"}`;
      }),
    ];

    window.alert(lines.join("\n"));
  } catch (error) {
    console.warn("Không thể mở log AI:", error);
    showToast("Không thể tải log AI.", "error");
  }
}

function getSystemSettingsService() {
  return window.EduKidsSystemSettingsService || null;
}

function getSystemSettingsData() {
  return (
    systemSettingsState.data ||
    getSystemSettingsService()?.getCurrentSystemSettings?.() ||
    null
  );
}

function getSystemSettingsAi() {
  const settings = getSystemSettingsData() || {};

  return {
    aiCoachEnabled:
      settings.aiCoachEnabled !== undefined
        ? settings.aiCoachEnabled
        : settings.ai?.coachEnabled !== false,
    aiTopicLearningEnabled:
      settings.aiTopicLearningEnabled !== undefined
        ? settings.aiTopicLearningEnabled
        : settings.ai?.learningAnalysisEnabled !== false,
    aiAssignmentEnabled:
      settings.aiAssignmentEnabled !== undefined
        ? settings.aiAssignmentEnabled
        : settings.ai?.assignmentEnabled !== false,
  };
}

function isAICoachAvailable() {
  return getSystemSettingsAi().aiCoachEnabled !== false;
}

function isAiTopicLearningEnabled() {
  return getSystemSettingsAi().aiTopicLearningEnabled !== false;
}

function isAiAssignmentEnabled() {
  return getSystemSettingsAi().aiAssignmentEnabled !== false;
}

function getSystemSettingsRegistration() {
  return (
    getSystemSettingsData()?.registration || {
      studentEnabled: true,
      teacherEnabled: true,
    }
  );
}

function getSystemSettingsMaintenance() {
  return (
    getSystemSettingsData()?.maintenance || {
      enabled: false,
      message: "Hệ thống đang bảo trì, vui lòng quay lại sau.",
    }
  );
}

function getSystemSettingsInfo() {
  return (
    getSystemSettingsData()?.systemInfo || {
      version: "2.0.0",
      firebaseProjectId: "",
      updatedAt: "",
    }
  );
}

function getAdminSettingsRoot() {
  return document.getElementById("admin-settings");
}

function getAdminSettingsToggleNode(key) {
  if (!key) {
    return null;
  }

  return (
    getAdminSettingsRoot()?.querySelector(
      `[data-admin-settings-toggle="${key}"]`,
    ) || null
  );
}

function getAdminSettingsInfoNode(key) {
  if (!key) {
    return null;
  }

  return (
    getAdminSettingsRoot()?.querySelector(
      `[data-admin-settings-info="${key}"]`,
    ) || null
  );
}

function isRegistrationEnabled(role) {
  const registration = getSystemSettingsRegistration();
  return role === "teacher"
    ? registration.teacherEnabled !== false
    : registration.studentEnabled !== false;
}

function isSystemMaintenanceEnabled() {
  return getSystemSettingsMaintenance().enabled === true;
}

function getSystemMaintenanceMessage() {
  return (
    getSystemSettingsMaintenance().message ||
    "Hệ thống đang bảo trì, vui lòng quay lại sau."
  );
}

function renderMaintenanceScreen() {
  const authRoot = getAuthRoot();
  const appShell = getAppShell();

  if (appShell) {
    appShell.hidden = true;
  }

  if (authRoot) {
    authRoot.hidden = false;
    authRoot.dataset.renderedMode = "maintenance";
    authRoot.innerHTML = `
      <div class="admin-empty-state is-large" style="min-height: 100vh; border: none; border-radius: 0;">
        <div>
          <p>Hệ thống đang bảo trì, vui lòng quay lại sau.</p>
          <span>${escapeHtml(getSystemMaintenanceMessage())}</span>
        </div>
      </div>
    `;
  }

  document.body.classList.add("auth-mode");
  document.body.classList.remove("admin-mode");
}

function syncSystemSettingsUi(settings = null) {
  const data = settings || getSystemSettingsData();

  if (!data) {
    return;
  }

  const info = data.systemInfo || {};
  const registration = data.registration || {};
  const maintenance = data.maintenance || {};

  const toggleMap = {
    "registration.student": registration.studentEnabled !== false,
    "registration.teacher": registration.teacherEnabled !== false,
    "ai.coach": data.aiCoachEnabled !== false,
    "ai.assignment": data.aiAssignmentEnabled !== false,
    "ai.learning": data.aiTopicLearningEnabled !== false,
    "maintenance.enabled": maintenance.enabled === true,
  };

  Object.entries(toggleMap).forEach(([key, enabled]) => {
    const toggleNode = getAdminSettingsToggleNode(key);

    if (toggleNode) {
      toggleNode.classList.toggle("is-on", enabled);
      toggleNode.setAttribute("aria-pressed", String(enabled));
    }
  });

  const versionNode = getAdminSettingsInfoNode("version");
  const firebaseNode = getAdminSettingsInfoNode("firebaseProjectId");
  const updatedAtNode = getAdminSettingsInfoNode("updatedAt");

  if (versionNode) {
    versionNode.textContent = info.version || "2.0.0";
  }

  if (firebaseNode) {
    const firebaseProjectId =
      window.firebase?.apps?.length && typeof window.firebase.app === "function"
        ? normalizeQuizText(window.firebase.app().options?.projectId || "")
        : "";

    firebaseNode.textContent =
      info.firebaseProjectId || firebaseProjectId || "Chưa có dữ liệu";
  }

  if (updatedAtNode) {
    updatedAtNode.textContent = formatDateOnly(
      info.updatedAt || data.updatedAt || "",
    );
  }
}

function renderAdminSettingsPage() {
  syncSystemSettingsUi();
}

async function syncSystemSettings({ forceRefresh = false } = {}) {
  const service = getSystemSettingsService();

  if (!service) {
    return null;
  }

  if (systemSettingsState.loaded && systemSettingsState.data && !forceRefresh) {
    syncSystemSettingsUi(systemSettingsState.data);
    return systemSettingsState.data;
  }

  if (systemSettingsState.loading && systemSettingsState.pendingPromise) {
    return systemSettingsState.pendingPromise;
  }

  systemSettingsState.loading = true;

  const request = (async () => {
    try {
      const data =
        typeof service.fetchSystemSettings === "function"
          ? await service.fetchSystemSettings()
          : null;

      systemSettingsState.data = data || null;
      systemSettingsState.loaded = true;
      syncSystemSettingsUi(systemSettingsState.data);
      return systemSettingsState.data;
    } catch (error) {
      console.warn("Không thể tải cấu hình hệ thống:", error);
      systemSettingsState.data = null;
      systemSettingsState.loaded = true;
      return null;
    } finally {
      systemSettingsState.loading = false;
      systemSettingsState.pendingPromise = null;
    }
  })();

  systemSettingsState.pendingPromise = request;
  return request;
}

async function updateSystemSettings(updates = {}) {
  const service = getSystemSettingsService();

  if (typeof service?.updateSystemSettings !== "function") {
    throw new Error("System settings service is unavailable");
  }

  const data = await service.updateSystemSettings(updates, "admin");
  systemSettingsState.data = data;
  systemSettingsState.loaded = true;
  syncSystemSettingsUi(data);
  return data;
}

async function toggleAdminSystemSetting(settingKey) {
  const current = getSystemSettingsData();

  if (!current) {
    showToast("Cấu hình hệ thống chưa sẵn sàng.", "error");
    return;
  }

  const nextState = {
    ...current,
    registration: { ...current.registration },
    aiCoachEnabled: current.aiCoachEnabled,
    aiTopicLearningEnabled: current.aiTopicLearningEnabled,
    aiAssignmentEnabled: current.aiAssignmentEnabled,
    ai: { ...current.ai },
    maintenance: { ...current.maintenance },
  };

  if (settingKey === "registration.student") {
    nextState.registration.studentEnabled = !isRegistrationEnabled("student");
  } else if (settingKey === "registration.teacher") {
    nextState.registration.teacherEnabled = !isRegistrationEnabled("teacher");
  } else if (settingKey === "ai.coach") {
    const nextEnabled = !isAICoachAvailable();
    nextState.aiCoachEnabled = nextEnabled;
    nextState.ai.coachEnabled = nextEnabled;
  } else if (settingKey === "ai.assignment") {
    const nextEnabled = !isAiAssignmentEnabled();
    nextState.aiAssignmentEnabled = nextEnabled;
    nextState.ai.assignmentEnabled = nextEnabled;
  } else if (settingKey === "ai.learning") {
    const nextEnabled = !isAiTopicLearningEnabled();
    nextState.aiTopicLearningEnabled = nextEnabled;
    nextState.ai.learningAnalysisEnabled = nextEnabled;
  } else if (settingKey === "maintenance.enabled") {
    nextState.maintenance.enabled = !isSystemMaintenanceEnabled();
  } else {
    return;
  }

  const confirmMessage =
    settingKey === "maintenance.enabled" && nextState.maintenance.enabled
      ? "Bật chế độ bảo trì? Học sinh và giáo viên sẽ không thể sử dụng hệ thống."
      : `Cập nhật cấu hình ${settingKey}?`;

  if (!window.confirm(confirmMessage)) {
    return;
  }

  try {
    await updateSystemSettings(nextState);
    showToast("Đã cập nhật cấu hình hệ thống.", "success");
    syncCurrentRouteState();
    if (currentAdminPage === "admin-settings") {
      renderAdminSettingsPage();
    }
    if (currentAdminPage === "admin-ai") {
      renderAdminAiPage();
    }
    if (currentPage === "ai-coach") {
      renderAICoachPage();
    }
  } catch (error) {
    console.warn("Không thể cập nhật cấu hình hệ thống:", error);
    showToast("Không thể cập nhật cấu hình hệ thống.", "error");
  }
}

function handleAdminSettingsAction(action) {
  if (action === "logout") {
    setAdminAuthenticated(false);
    redirectToLoginRoute();
    showLoginScreen();
  }
}

function applySystemAccessGate() {
  const settings = getSystemSettingsData();
  const sessionUser = getCurrentAuthUser();
  const role = normalizeRole(sessionUser?.role);

  if (!settings) {
    return;
  }

  if (isSystemMaintenanceEnabled() && role !== "admin") {
    renderMaintenanceScreen();
    return;
  }

  const authRoot = getAuthRoot();
  if (authRoot && authRoot.dataset.renderedMode === "maintenance") {
    authRoot.removeAttribute("data-rendered-mode");
    authRoot.innerHTML = "";
  }

  if (sessionUser && role) {
    bootstrapState.currentUser = sessionUser;
    setAuthMode(false);
    initApp(sessionUser);
  } else {
    initializeAuth();
  }
}

function getAdminTeacherById(teacherId) {
  const normalizedId = String(teacherId || "").trim();

  if (!normalizedId) {
    return null;
  }

  return (
    (Array.isArray(adminTeachersState.data)
      ? adminTeachersState.data
      : []
    ).find((teacher) => String(teacher?.id || "").trim() === normalizedId) ||
    null
  );
}

async function updateAdminTeacherStatus(teacherId, status) {
  const teacher = getAdminTeacherById(teacherId);

  if (!teacher) {
    showToast("Không tìm thấy giáo viên.", "error");
    return;
  }

  const normalizedStatus = status === "locked" ? "locked" : "active";
  const actionText = normalizedStatus === "locked" ? "khóa" : "mở khóa";
  const confirmMessage = `Bạn có chắc muốn ${actionText} tài khoản "${teacher.fullName || teacher.name || teacher.email || teacher.id}"?`;

  if (!window.confirm(confirmMessage)) {
    return;
  }

  try {
    const service = window.EduKidsAdminTeacherService;
    if (typeof service?.updateTeacherStatus !== "function") {
      throw new Error("Teacher service is unavailable");
    }

    await service.updateTeacherStatus(teacher.id, normalizedStatus);
    showToast(`Đã ${actionText} tài khoản thành công.`, "success");
    await syncAdminTeachers({ forceRefresh: true });
  } catch (error) {
    console.warn("Không thể cập nhật trạng thái giáo viên:", error);
    showToast(`Không thể ${actionText} tài khoản.`, "error");
  }
}

async function resetAdminTeacherPassword(teacherId) {
  const teacher = getAdminTeacherById(teacherId);

  if (!teacher) {
    showToast("Không tìm thấy giáo viên.", "error");
    return;
  }

  const newPassword = window.prompt(
    `Nhập mật khẩu mới cho ${teacher.fullName || teacher.name || teacher.email || teacher.id}`,
  );

  if (!newPassword || !String(newPassword).trim()) {
    return;
  }

  const adminPassword = window.prompt("Nhập mật khẩu quản trị để xác nhận:");

  if (!adminPassword || !String(adminPassword).trim()) {
    return;
  }

  try {
    const service = window.EduKidsAdminTeacherService;
    if (typeof service?.resetTeacherPassword !== "function") {
      throw new Error("Teacher service is unavailable");
    }

    await service.resetTeacherPassword(teacher.id, newPassword, adminPassword);
    showToast("Đã đặt lại mật khẩu thành công.", "success");
  } catch (error) {
    console.warn("Không thể đặt lại mật khẩu giáo viên:", error);
    showToast(error?.message || "Không thể đặt lại mật khẩu.", "error");
  }
}

function getAdminStudentStatusLabel(status) {
  return status === "locked" ? "Đã khóa" : "Hoạt động";
}

function getAdminStudentStatusClass(status) {
  return status === "locked" ? "is-red" : "is-green";
}

function getAdminStudentActionLabel(status) {
  return status === "locked" ? "Mở khóa" : "Khóa";
}

function getAdminStudentActionName(status) {
  return status === "locked" ? "unlock" : "lock";
}

function getAdminStudentInitials(student) {
  const source = String(student?.fullName || student?.username || "").trim();
  if (!source) {
    return "--";
  }

  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "--";
}

function buildAdminStudentRow(student, index) {
  const status = student.status === "locked" ? "locked" : "active";
  const statusLabel = getAdminStudentStatusLabel(status);
  const statusClass = getAdminStudentStatusClass(status);
  const actionLabel = getAdminStudentActionLabel(status);
  const actionName = getAdminStudentActionName(status);
  const className = String(student.className || "--").trim() || "--";

  return `
    <tr data-admin-student-row data-admin-student-id="${escapeHtml(student.id)}">
      <td>${escapeHtml(String(index + 1))}</td>
      <td class="admin-user-cell">
        <div class="admin-user-avatar is-blue">${escapeHtml(getAdminStudentInitials(student))}</div>
        <div>
          <strong>${escapeHtml(student.fullName || "--")}</strong>
          <span>Học sinh</span>
        </div>
      </td>
      <td>${escapeHtml(student.username || "--")}</td>
      <td>${escapeHtml(className)}</td>
      <td>${escapeHtml(formatDateOnly(student.createdAt || ""))}</td>
      <td><span class="admin-status-badge ${escapeHtml(statusClass)}">${escapeHtml(statusLabel)}</span></td>
      <td>
        <div class="admin-action-group">
          <button type="button" data-admin-student-action="view" data-admin-student-id="${escapeHtml(student.id)}">Xem hồ sơ</button>
          <button type="button" class="${actionName === "lock" ? "is-danger" : ""}" data-admin-student-action="${escapeHtml(actionName)}" data-admin-student-id="${escapeHtml(student.id)}">${escapeHtml(actionLabel)}</button>
          <button type="button" class="is-danger" data-admin-student-action="delete" data-admin-student-id="${escapeHtml(student.id)}">Xóa</button>
        </div>
      </td>
    </tr>
  `;
}

function filterAdminStudents(students = []) {
  const query = normalizeAdminSearchValue(adminStudentsState.searchQuery);
  const classFilter = String(adminStudentsState.classFilter || "")
    .trim()
    .toLowerCase();
  const statusFilter = String(adminStudentsState.statusFilter || "")
    .trim()
    .toLowerCase();

  return (Array.isArray(students) ? students : []).filter((student) => {
    const searchIndex = getAdminSearchIndex(
      student?.fullName,
      student?.username,
      student?.className,
    );
    const className = String(student?.className || "").toLowerCase();
    const status = String(student?.status || "active").toLowerCase();

    if (query && !searchIndex.includes(query)) {
      return false;
    }

    if (classFilter && className !== classFilter) {
      return false;
    }

    if (statusFilter && status !== statusFilter) {
      return false;
    }

    return true;
  });
}

function renderAdminStudentsClassOptions(students = []) {
  const select = getAdminStudentsClassSelect();

  if (!select) {
    return;
  }

  const currentValue = String(adminStudentsState.classFilter || "").trim();
  const classes = Array.from(
    new Set(
      (Array.isArray(students) ? students : [])
        .map((student) => String(student?.className || "").trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, "vi"));

  select.innerHTML = `
    <option value="">Tất cả lớp</option>
    ${classes
      .map(
        (className) =>
          `<option value="${escapeHtml(className)}">${escapeHtml(className)}</option>`,
      )
      .join("")}
  `;

  if (currentValue && classes.includes(currentValue)) {
    select.value = currentValue;
  } else {
    adminStudentsState.classFilter = "";
    select.value = "";
  }
}

function renderAdminStudentsTable(students = []) {
  const tbody = getAdminStudentsTableBody();
  const summaryNode = getAdminStudentsSummaryNode();
  const total = Array.isArray(adminStudentsState.data)
    ? adminStudentsState.data.length
    : 0;
  const filtered = Array.isArray(students) ? students : [];

  if (tbody) {
    if (filtered.length === 0) {
      const hasData = total > 0;
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="admin-empty-state is-large">
              <div>
                <p>${hasData ? ADMIN_NO_RESULTS_MESSAGE : "Không có dữ liệu học sinh"}</p>
                <span>${hasData ? "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm." : "Danh sách học sinh sẽ được đồng bộ từ Firestore."}</span>
              </div>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered
        .map((student, index) => buildAdminStudentRow(student, index))
        .join("");
    }
  }

  if (summaryNode) {
    if (filtered.length === 0) {
      summaryNode.innerHTML =
        total === 0
          ? "Chưa có dữ liệu học sinh trong hệ thống."
          : ADMIN_NO_RESULTS_MESSAGE;
    } else {
      summaryNode.innerHTML = `Hiển thị 1 đến ${escapeHtml(formatStatValue(filtered.length))} trong tổng số <strong>${escapeHtml(formatStatValue(total))}</strong> học sinh`;
    }
  }
}

function renderAdminStudentsPage() {
  renderAdminStudentsClassOptions(adminStudentsState.data);
  setAdminStudentsFiltersFromInputs();
  const students = filterAdminStudents(adminStudentsState.data);
  adminStudentsState.filtered = students;
  renderAdminStudentsTable(students);
}

function setAdminStudentsFiltersFromInputs() {
  const searchInput = getAdminStudentsSearchInput();
  const classSelect = getAdminStudentsClassSelect();
  const statusSelect = getAdminStudentsStatusSelect();

  adminStudentsState.searchQuery = String(searchInput?.value || "");
  adminStudentsState.classFilter = String(classSelect?.value || "");
  adminStudentsState.statusFilter = String(statusSelect?.value || "");
}

async function syncAdminStudents({ forceRefresh = false } = {}) {
  const root = getAdminStudentsRoot();

  if (!root) {
    return null;
  }

  if (
    adminStudentsState.loaded &&
    Array.isArray(adminStudentsState.data) &&
    !forceRefresh
  ) {
    renderAdminStudentsPage();
    return adminStudentsState.data;
  }

  if (adminStudentsState.loading && adminStudentsState.pendingPromise) {
    return adminStudentsState.pendingPromise;
  }

  adminStudentsState.loading = true;
  root.setAttribute("aria-busy", "true");

  const request = (async () => {
    try {
      const service = window.EduKidsAdminStudentService;
      const students =
        typeof service?.fetchStudents === "function"
          ? await service.fetchStudents()
          : [];

      adminStudentsState.data = Array.isArray(students)
        ? students
            .map((student) => service?.normalizeStudent?.(student) || student)
            .filter((student) => String(student?.id || "").trim())
            .sort((left, right) => {
              const leftTime = Number(left?.createdAtValue) || 0;
              const rightTime = Number(right?.createdAtValue) || 0;
              return rightTime - leftTime;
            })
        : [];
      adminStudentsState.loaded = true;

      renderAdminStudentsPage();
      return adminStudentsState.data;
    } catch (error) {
      console.warn("Không thể tải danh sách học sinh:", error);
      adminStudentsState.data = [];
      adminStudentsState.loaded = true;
      renderAdminStudentsPage();
      return [];
    } finally {
      adminStudentsState.loading = false;
      adminStudentsState.pendingPromise = null;
      root.removeAttribute("aria-busy");
    }
  })();

  adminStudentsState.pendingPromise = request;
  return request;
}

function getAdminStudentById(studentId) {
  const normalizedId = String(studentId || "").trim();

  if (!normalizedId) {
    return null;
  }

  return (
    (Array.isArray(adminStudentsState.data)
      ? adminStudentsState.data
      : []
    ).find((student) => String(student?.id || "").trim() === normalizedId) ||
    null
  );
}

function showAdminStudentProfile(student) {
  if (!student) {
    showToast("Không tìm thấy hồ sơ học sinh.", "error");
    return;
  }

  window.alert(
    [
      `Họ tên: ${student.fullName || "--"}`,
      `Username: ${student.username || "--"}`,
      `Lớp: ${student.className || "--"}`,
      `Ngày tạo: ${formatDateOnly(student.createdAt || "")}`,
      `Trạng thái: ${getAdminStudentStatusLabel(student.status)}`,
    ].join("\n"),
  );
}

async function updateAdminStudentStatus(studentId, status) {
  const student = getAdminStudentById(studentId);

  if (!student) {
    showToast("Không tìm thấy học sinh.", "error");
    return;
  }

  const normalizedStatus = status === "locked" ? "locked" : "active";
  const actionText = normalizedStatus === "locked" ? "khóa" : "mở khóa";
  const confirmMessage = `Bạn có chắc muốn ${actionText} tài khoản "${student.fullName || student.username || student.id}"?`;

  if (!window.confirm(confirmMessage)) {
    return;
  }

  try {
    const service = window.EduKidsAdminStudentService;
    if (typeof service?.updateStudentStatus !== "function") {
      throw new Error("Student service is unavailable");
    }

    await service.updateStudentStatus(student.id, normalizedStatus);
    showToast(`Đã ${actionText} tài khoản thành công.`, "success");
    await syncAdminStudents({ forceRefresh: true });
    void syncAdminOverview({ forceRefresh: true });
  } catch (error) {
    console.warn("Không thể cập nhật trạng thái học sinh:", error);
    showToast(`Không thể ${actionText} tài khoản.`, "error");
  }
}

async function deleteAdminStudent(studentId) {
  const student = getAdminStudentById(studentId);

  if (!student) {
    showToast("Không tìm thấy học sinh.", "error");
    return;
  }

  const confirmMessage = `Xóa tài khoản "${student.fullName || student.username || student.id}"? Hành động này không thể hoàn tác.`;

  if (!window.confirm(confirmMessage)) {
    return;
  }

  try {
    const service = window.EduKidsAdminStudentService;
    if (typeof service?.deleteStudent !== "function") {
      throw new Error("Student service is unavailable");
    }

    await service.deleteStudent(student.id);
    showToast("Đã xóa tài khoản thành công.", "success");
    await syncAdminStudents({ forceRefresh: true });
    void syncAdminOverview({ forceRefresh: true });
  } catch (error) {
    console.warn("Không thể xóa học sinh:", error);
    showToast("Không thể xóa tài khoản.", "error");
  }
}

function changeAdminPage(pageId) {
  if (pageId !== "admin-content" && adminContentState.detail?.visible) {
    closeAdminContentDetail();
  }

  closeSidebar();

  currentAdminPage = pageId || ADMIN_DEFAULT_PAGE;
  showAdminPage(currentAdminPage);

  if (currentAdminPage === "admin-content") {
    showAdminContentTab(currentAdminContentTab);
    void syncAdminContent();
  } else if (currentAdminPage === "admin-ai") {
    void syncAdminAi();
  } else if (currentAdminPage === "admin-overview") {
    void syncAdminOverview();
  } else if (currentAdminPage === "admin-classes") {
    void syncAdminClasses();
  } else if (currentAdminPage === "admin-assignments") {
    void syncAdminAssignments();
  } else if (currentAdminPage === "admin-stats") {
    void syncAdminStats();
  } else if (currentAdminPage === "admin-reviews") {
    void syncAdminReviews();
  } else if (currentAdminPage === "admin-settings") {
    renderAdminSettingsPage();
    void syncSystemSettings();
  } else if (currentAdminPage === "admin-students") {
    void syncAdminStudents();
  } else if (currentAdminPage === "admin-teachers") {
    void syncAdminTeachers();
  }
}

let adminEventsBound = false;

function bindAdminEventsOnce() {
  if (adminEventsBound) {
    return;
  }

  document.addEventListener("click", (event) => {
    const pageTrigger = event.target.closest("[data-admin-page]");
    if (pageTrigger) {
      changeAdminPage(pageTrigger.dataset.adminPage);
      return;
    }

    const contentTabTrigger = event.target.closest("[data-admin-content-tab]");
    if (contentTabTrigger) {
      showAdminContentTab(contentTabTrigger.dataset.adminContentTab);
      if (currentAdminPage === "admin-content") {
        void syncAdminContent();
      }
      return;
    }

    const menuToggle = event.target.closest("[data-mobile-menu-toggle]");
    if (menuToggle) {
      const isOpen = !document.body.classList.contains("sidebar-open");
      setSidebarOpen(isOpen);
      return;
    }

    const sidebarBackdrop = event.target.closest("[data-sidebar-backdrop]");
    if (sidebarBackdrop) {
      closeSidebar();
      return;
    }

    const statsRangeButton = event.target.closest("[data-admin-stats-range]");
    if (statsRangeButton) {
      const nextRange = normalizeAdminStatsRangeKey(
        statsRangeButton.dataset.adminStatsRange,
      );
      if (adminStatsState.selectedRange !== nextRange) {
        adminStatsState.selectedRange = nextRange;
        renderAdminStatsPage();
      }
      return;
    }

    const reviewsRatingButton = event.target.closest(
      "[data-admin-reviews-rating-filter]",
    );
    if (reviewsRatingButton) {
      const nextRating =
        String(
          reviewsRatingButton.dataset.adminReviewsRatingFilter || "all",
        ).trim() || "all";
      if (adminReviewsState.ratingFilter !== nextRating) {
        adminReviewsState.ratingFilter = nextRating;
        renderAdminReviewsPage();
      }
      return;
    }

    const studentActionButton = event.target.closest(
      "[data-admin-student-action]",
    );

    if (studentActionButton) {
      const action = String(
        studentActionButton.dataset.adminStudentAction || "",
      ).trim();
      const studentId = String(
        studentActionButton.dataset.adminStudentId || "",
      ).trim();

      if (!studentId) {
        return;
      }

      if (action === "view") {
        showAdminStudentProfile(getAdminStudentById(studentId));
        return;
      }

      if (action === "lock") {
        void updateAdminStudentStatus(studentId, "locked");
        return;
      }

      if (action === "unlock") {
        void updateAdminStudentStatus(studentId, "active");
        return;
      }

      if (action === "delete") {
        void deleteAdminStudent(studentId);
      }
    }

    const teacherActionButton = event.target.closest(
      "[data-admin-teacher-action]",
    );

    if (teacherActionButton) {
      const action = String(
        teacherActionButton.dataset.adminTeacherAction || "",
      ).trim();
      const teacherId = String(
        teacherActionButton.dataset.adminTeacherId || "",
      ).trim();

      if (!teacherId) {
        return;
      }

      if (action === "lock") {
        void updateAdminTeacherStatus(teacherId, "locked");
        return;
      }

      if (action === "unlock") {
        void updateAdminTeacherStatus(teacherId, "active");
        return;
      }

      if (action === "reset-password") {
        void resetAdminTeacherPassword(teacherId);
      }
    }

    const classActionButton = event.target.closest("[data-admin-class-action]");

    if (classActionButton) {
      const action = String(
        classActionButton.dataset.adminClassAction || "",
      ).trim();
      const classId = String(
        classActionButton.dataset.adminClassId || "",
      ).trim();

      if (!classId) {
        return;
      }

      if (action === "view") {
        showAdminClassDetail(getAdminClassById(classId));
      }
    }

    const assignmentActionButton = event.target.closest(
      "[data-admin-assignment-action]",
    );

    if (assignmentActionButton) {
      const action = String(
        assignmentActionButton.dataset.adminAssignmentAction || "",
      ).trim();
      const assignmentId = String(
        assignmentActionButton.dataset.adminAssignmentId || "",
      ).trim();

      if (!assignmentId) {
        return;
      }

      if (action === "view") {
        showAdminAssignmentDetail(getAdminAssignmentById(assignmentId));
      }
    }

    const contentActionButton = event.target.closest(
      "[data-admin-content-action]",
    );

    if (contentActionButton) {
      const action = String(
        contentActionButton.dataset.adminContentAction || "",
      ).trim();
      const subject = String(
        contentActionButton.dataset.adminContentSubject || "",
      ).trim();
      const grade = String(
        contentActionButton.dataset.adminContentGrade || "",
      ).trim();

      if (action === "view") {
        showAdminContentDetail(subject, grade);
      }
    }

    const contentDrawerClose = event.target.closest(
      "[data-admin-content-drawer-close]",
    );

    if (contentDrawerClose) {
      closeAdminContentDetail();
      return;
    }

    const contentDrawerBackdrop = event.target.closest(
      "[data-admin-content-drawer-backdrop]",
    );

    if (contentDrawerBackdrop) {
      closeAdminContentDetail();
      return;
    }

    const aiActionButton = event.target.closest("[data-admin-ai-action]");

    if (aiActionButton) {
      const action = String(aiActionButton.dataset.adminAiAction || "").trim();

      if (action === "show-logs") {
        void showAdminAiLogs();
        return;
      }

      if (action === "clear-cache") {
        void clearAdminAiCache();
      }
    }

    const aiToggleButton = event.target.closest("[data-admin-ai-toggle]");

    if (aiToggleButton) {
      const toggleName = String(
        aiToggleButton.dataset.adminAiToggle || "",
      ).trim();

      if (toggleName === "coach") {
        void toggleAdminAiCoach();
        return;
      }

      if (toggleName === "topic-learning") {
        void toggleAdminAiTopicLearning();
        return;
      }

      if (toggleName === "assignment") {
        void toggleAdminAiAssignment();
        return;
      }
    }

    const systemSettingsToggle = event.target.closest(
      "[data-admin-settings-toggle]",
    );

    if (systemSettingsToggle) {
      void toggleAdminSystemSetting(
        systemSettingsToggle.dataset.adminSettingsToggle,
      );
      return;
    }

    const systemSettingsAction = event.target.closest(
      "[data-admin-settings-action]",
    );

    if (systemSettingsAction) {
      handleAdminSettingsAction(
        systemSettingsAction.dataset.adminSettingsAction,
      );
      return;
    }

    const reviewActionButton = event.target.closest(
      "[data-admin-review-action]",
    );

    if (reviewActionButton) {
      const action = String(
        reviewActionButton.dataset.adminReviewAction || "",
      ).trim();
      const reviewId = String(
        reviewActionButton.dataset.adminReviewId || "",
      ).trim();

      if (!reviewId) {
        return;
      }

      if (action === "delete") {
        void deleteAdminReview(reviewId);
      }
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;

    if (
      target instanceof HTMLInputElement &&
      target.matches("#admin-students input[type='search']")
    ) {
      setAdminStudentsFiltersFromInputs();
      renderAdminStudentsPage();
      return;
    }

    if (
      target instanceof HTMLInputElement &&
      target.matches("#admin-teachers input[type='search']")
    ) {
      setAdminTeachersFiltersFromInputs();
      renderAdminTeachersPage();
      return;
    }

    if (
      target instanceof HTMLInputElement &&
      target.matches("#admin-classes input[type='search']")
    ) {
      setAdminClassesFiltersFromInputs();
      renderAdminClassesPage();
      return;
    }

    if (
      target instanceof HTMLInputElement &&
      target.matches("#admin-assignments input[type='search']")
    ) {
      setAdminAssignmentsFiltersFromInputs();
      renderAdminAssignmentsPage();
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;

    if (
      target instanceof HTMLSelectElement &&
      target.closest("#admin-students")
    ) {
      setAdminStudentsFiltersFromInputs();
      renderAdminStudentsPage();
      return;
    }

    if (
      target instanceof HTMLSelectElement &&
      target.closest("#admin-teachers")
    ) {
      setAdminTeachersFiltersFromInputs();
      renderAdminTeachersPage();
      return;
    }

    if (
      target instanceof HTMLSelectElement &&
      target.closest("#admin-classes")
    ) {
      setAdminClassesFiltersFromInputs();
      renderAdminClassesPage();
      return;
    }

    if (
      target instanceof HTMLSelectElement &&
      target.closest("#admin-assignments")
    ) {
      setAdminAssignmentsFiltersFromInputs();
      renderAdminAssignmentsPage();
      return;
    }

    if (
      target instanceof HTMLSelectElement &&
      target.closest("#admin-reviews")
    ) {
      adminReviewsState.roleFilter =
        String(target.value || "all").trim() || "all";
      renderAdminReviewsPage();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (adminContentState.detail?.visible) {
      closeAdminContentDetail();
    }
  });

  adminEventsBound = true;
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

    if (resolvedProfile) {
      bootstrapState.currentUser = resolvedProfile;
      window.EduKidsCurrentUser = resolvedProfile;
    }

    renderSidebarProfileCards(resolvedProfile || profile);
    renderStudentHomeOverview(resolvedProfile || profile);
    void syncStudentProgress(resolvedProfile || profile);
  } catch (error) {
    console.warn("Không thể đồng bộ sidebar user:", error);
    renderSidebarProfileCards(profile);
    renderStudentHomeOverview(profile);
    void syncStudentProgress(profile);
  }
}

function showPage(pageId) {
  if (!pageId) {
    return;
  }

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === pageId);
  });

  document.querySelectorAll("[data-page]").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === pageId);
  });
}

function syncRouteForPageChange(nextPageId, previousPageId, role) {
  if (normalizeRole(role) !== "student") {
    return;
  }

  const currentPath =
    String(window.location?.pathname || "").replace(/\/+$/, "") || "/";
  const learningPath = getRoutePathForPage("learning-path");
  const petPath = getRoutePathForPage("pet");

  if (nextPageId === "learning-path") {
    if (currentPath !== learningPath) {
      window.history.pushState({}, "", learningPath);
    }
    return;
  }

  if (nextPageId === "pet") {
    if (currentPath !== petPath) {
      window.history.pushState({}, "", petPath);
    }
    return;
  }

  if (previousPageId === "learning-path" && currentPath === learningPath) {
    window.history.replaceState({}, "", "/");
    return;
  }

  if (previousPageId === "pet" && currentPath === petPath) {
    window.history.replaceState({}, "", "/");
  }
}

function changePage(pageId) {
  const role = getCurrentRole();
  const targetPageId = resolvePageForRole(pageId, role);

  closeSidebar();

  previousPage = currentPage;
  currentPage = targetPageId;

  showPage(targetPageId);
  applyRoleVisibility(role);
  syncRouteForPageChange(targetPageId, previousPage, role);

  if (targetPageId === "pet" && role === "student") {
    void ensurePetModuleLoaded()
      .then(() => {
        if (currentPage === "pet") {
          showPetModulePage();
        }
      })
      .catch((error) => {
        console.warn("Không thể khởi tạo Pet module:", error);
      });
  } else {
    hidePetModulePages();
  }

  if (targetPageId === "student-home" && role === "student") {
    void syncStudentProgress(getCurrentAuthUser());
    void syncStudentWeeklyProgress(getCurrentAuthUser());
    void syncStudentHomeAssignments(getCurrentAuthUser());
    void syncStudentRecentWrongAnswers(getCurrentAuthUser());
  }

  if (
    role === "teacher" &&
    targetPageId !== "manage" &&
    currentTeacherAssignmentDetail.visible
  ) {
    closeTeacherAssignmentDetail();
  }

  const profilePageType = getProfilePageType(targetPageId);

  if (profilePageType && typeof ensureProfileLoaded === "function") {
    void ensureProfileLoaded(targetPageId);
  }

  if (
    targetPageId === "create-assignment" &&
    role === "teacher" &&
    typeof initializeTeacherAssignmentForm === "function"
  ) {
    void initializeTeacherAssignmentForm();
  }

  if (
    targetPageId === "manage" &&
    role === "teacher" &&
    typeof refreshTeacherAssignments === "function"
  ) {
    void refreshTeacherAssignments();
  }

  if (
    targetPageId === "subjects" &&
    role === "student" &&
    typeof initializeStudentQuizPage === "function"
  ) {
    void initializeStudentQuizPage();
  }

  if (
    targetPageId === "ai-coach" &&
    role === "student" &&
    typeof initializeAICoachPage === "function"
  ) {
    void initializeAICoachPage();
  }

  if (
    targetPageId === "assignments" &&
    role === "student" &&
    typeof initializeStudentAssignmentPage === "function"
  ) {
    void initializeStudentAssignmentPage();
  }

  if (
    targetPageId === "classroom" &&
    typeof initializeClassroomPage === "function"
  ) {
    void initializeClassroomPage();
  }

  if (
    targetPageId === "stats" &&
    role === "teacher" &&
    typeof initializeTeacherStatsPage === "function"
  ) {
    void initializeTeacherStatsPage();
  }

  if (targetPageId === "teacher-dashboard" && role === "teacher") {
    void syncTeacherDashboard(getCurrentAuthUser());
  }

  if (targetPageId === "progress" && normalizeRole(role) === "student") {
    const currentProfile =
      bootstrapState.currentUser ||
      profileState.current ||
      getCurrentAuthUser();
    renderStudentProgressPage(
      currentProfile,
      getProfileActivityLogs(currentProfile),
    );
  }

  if (targetPageId === "learning-path" && normalizeRole(role) === "student") {
    renderLearningPathPage();
  }
}

function openCreateAssignment() {
  changePage("create-assignment");
}

function openProfile() {
  changePage("profile");
}

function openTeacherDashboard() {
  changePage("teacher-dashboard");
}

function openAdminDashboard() {
  if (isAdminRoute()) {
    changeAdminPage(ADMIN_DEFAULT_PAGE);
  }
}

function goBackPage() {
  if (currentPage === "pet") {
    hidePetModulePages();
  }

  changePage(previousPage);
}

const profileState = {
  current: null,
  loading: false,
  error: null,
};

const studentProgressCache = new Map();
const studentRecommendationCache = new Map();
const classroomStudentProfileCache = new Map();
const studentWeeklyProgressCache = new Map();
const studentStrengthWeaknessCache = new Map();
const studentHomeAssignmentCache = new Map();
const studentRecentWrongAnswersCache = new Map();
const aiCoachState = {
  analysis: null,
  loading: false,
  error: "",
  initialized: false,
};

function getProfilePageRoot(pageType) {
  if (!pageType) {
    return null;
  }

  return document.querySelector(`[data-profile-page="${pageType}"]`);
}

function getAICoachRoot() {
  return document.querySelector("[data-ai-coach-root]");
}

function getAICoachStatusNode() {
  return document.querySelector("[data-ai-coach-status]");
}

function getAICoachResultsNode() {
  return document.querySelector("[data-ai-coach-results]");
}

function getAICoachAnalyzeButton() {
  return document.querySelector("[data-ai-coach-analyze-btn]");
}

function getAICoachSummaryNode() {
  return document.querySelector("[data-ai-coach-summary]");
}

function resetAICoachStatus() {
  const statusNode = getAICoachStatusNode();

  if (statusNode) {
    statusNode.hidden = true;
    statusNode.textContent = "";
    statusNode.classList.remove("is-error", "is-loading");
  }
}

function renderAICoachStatus(message = "", type = "") {
  const statusNode = getAICoachStatusNode();

  if (!statusNode) {
    return;
  }

  const normalizedMessage = String(message || "").trim();

  if (!normalizedMessage) {
    statusNode.hidden = true;
    statusNode.textContent = "";
    statusNode.classList.remove("is-error", "is-loading");
    return;
  }

  statusNode.hidden = false;
  statusNode.textContent = normalizedMessage;
  statusNode.classList.toggle("is-error", type === "error");
  statusNode.classList.toggle("is-loading", type === "loading");
}

function buildAICoachCard(title, body, variant) {
  return `
    <article class="coach-insight-card ${escapeHtml(variant)}">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
    </article>
  `;
}

function formatCoachLevelLabel(level) {
  const normalized = String(level || "").trim();

  if (!normalized) {
    return "🌟 --";
  }

  return `🌟 ${normalized}`;
}

function renderAICoachResults() {
  const resultsNode = getAICoachResultsNode();
  const summaryNode = getAICoachSummaryNode();
  const analyzeButton = getAICoachAnalyzeButton();
  const analysis = aiCoachState.analysis;
  const aiCoachEnabled = isAICoachAvailable();

  if (analyzeButton) {
    analyzeButton.disabled = aiCoachState.loading || !aiCoachEnabled;
    analyzeButton.textContent = aiCoachState.loading
      ? "Đang phân tích..."
      : !aiCoachEnabled
        ? "AI Coach đã tắt"
        : "✨ AI phân tích";
  }

  if (summaryNode && analysis && !aiCoachState.loading) {
    summaryNode.textContent = `Đã phân tích ${formatStatValue(analysis.bestTopics?.length || 0)} điểm mạnh và ${formatStatValue(analysis.weakTopics?.length || 0)} điểm cần cải thiện.`;
  } else if (summaryNode && !analysis && !aiCoachState.loading) {
    summaryNode.textContent =
      "Nhấn nút bên dưới để AI phân tích kết quả học tập mới nhất của bạn!";
  }

  if (!resultsNode) {
    return;
  }

  if (aiCoachState.loading) {
    resultsNode.hidden = false;
    resultsNode.innerHTML = `
      <div class="coach-loading-card">
        AI Coach đang phân tích kết quả học tập...
      </div>
    `;
    return;
  }

  if (analysis) {
    const focusTopicName = String(
      analysis.focusTopicName || analysis.focusTopic || "",
    ).trim();
    const focusTopicId = String(analysis.focusTopicId || "").trim();
    const focusTopicGrade = String(
      analysis.weakTopics?.[0]?.grade || analysis.focusGrade || "",
    ).trim();
    const focusTopicSubject = String(
      analysis.weakTopics?.[0]?.subject || analysis.focusSubject || "",
    ).trim();
    const averageAccuracy = Number(analysis.averageAccuracy) || 0;
    const coachLevel = String(analysis.coachLevel || "").trim();

    resultsNode.hidden = false;
    resultsNode.innerHTML = [
      buildAICoachCard("Điểm mạnh", analysis.strengths || "", "is-strength"),
      buildAICoachCard(
        "Cần cải thiện",
        analysis.weaknesses || "",
        "is-weakness",
      ),
      `
        <article class="coach-insight-card is-advice">
          <h3>Gợi ý luyện tập</h3>
          <p>${escapeHtml(analysis.advice || "")}</p>
          <div class="coach-practice-block">
            <span class="coach-practice-label">Luyện chủ đề ${escapeHtml(focusTopicName || "--")}</span>
            <button
              type="button"
              class="coach-practice-btn"
              data-ai-coach-practice-topic="${escapeHtml(focusTopicId)}"
              data-ai-coach-practice-grade="${escapeHtml(focusTopicGrade)}"
              data-ai-coach-practice-subject="${escapeHtml(focusTopicSubject)}"
              ${focusTopicId ? "" : "disabled"}
            >
              Luyện topic này
            </button>
          </div>
        </article>
      `,
      `
        <article class="coach-insight-card is-level">
          <h3>Mức độ hiện tại</h3>
          <p class="coach-level-label">${escapeHtml(formatCoachLevelLabel(coachLevel))}</p>
          <p>Độ chính xác trung bình: <strong>${escapeHtml(String(Math.round(averageAccuracy)))}%</strong></p>
        </article>
      `,
    ].join("");
    return;
  }

  if (aiCoachState.error) {
    resultsNode.hidden = true;
    resultsNode.innerHTML = "";
    return;
  }

  resultsNode.hidden = false;
  resultsNode.innerHTML = `
    <div class="coach-empty-card">
      Bạn cần làm bài trước khi AI Coach có thể phân tích.
    </div>
  `;
}

function renderAICoachPage() {
  const root = getAICoachRoot();

  if (!root) {
    return;
  }

  resetAICoachStatus();

  if (aiCoachState.loading) {
    renderAICoachStatus(
      "AI Coach đang phân tích kết quả học tập...",
      "loading",
    );
  } else if (aiCoachState.error) {
    renderAICoachStatus(aiCoachState.error, "error");
  }

  renderAICoachResults();
}

function getProfileAvatar(profile) {
  if (window.EduKidsProfileService?.getAvatarPathFromProfile) {
    return window.EduKidsProfileService.getAvatarPathFromProfile(profile);
  }

  const avatar = String(profile?.avatar || "").trim();

  if (avatar) {
    if (avatar.startsWith("assets/")) {
      return avatar;
    }

    return `assets/userAvatar/${avatar}`;
  }
  return "";
}

function formatRoleLabel(role) {
  return role === "teacher" ? "Giáo viên" : "Học sinh";
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

function formatDateTime(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
  }).format(date);
}

function formatDateOnly(value) {
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

function getNormalizedDateFromValue(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "object" && typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatReviewDate(value) {
  const date = getNormalizedDateFromValue(value);

  if (!date) {
    return "--";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatStatValue(value) {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? String(numeric) : "--";
}

function getDisplayName(fullName) {
  const normalized = String(fullName || "")
    .trim()
    .replace(/\s+/g, " ");

  if (!normalized) {
    return "";
  }

  const parts = normalized.split(" ").filter(Boolean);

  if (parts.length <= 1) {
    return parts[0] || "";
  }

  return parts.slice(-2).join(" ");
}

function getRequiredExpForLevel(level) {
  const normalizedLevel = Math.max(1, Math.floor(Number(level) || 1));

  if (normalizedLevel === 1) {
    return 100;
  }

  if (normalizedLevel === 2) {
    return 200;
  }

  if (normalizedLevel === 3) {
    return 400;
  }

  if (normalizedLevel === 4) {
    return 800;
  }

  return 1000;
}

function calculateLevel(exp) {
  let remainingExp = Math.max(0, Math.floor(Number(exp) || 0));
  let level = 1;
  let requiredExp = getRequiredExpForLevel(level);

  while (remainingExp >= requiredExp) {
    remainingExp -= requiredExp;
    level += 1;
    requiredExp = getRequiredExpForLevel(level);
  }

  return {
    level,
    currentExp: remainingExp,
    requiredExp,
  };
}

function getActivityLogDateValue(entry) {
  if (!entry) {
    return null;
  }

  if (entry instanceof Date) {
    return Number.isNaN(entry.getTime()) ? null : entry;
  }

  if (typeof entry === "string" || typeof entry === "number") {
    const parsed = new Date(entry);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof entry === "object") {
    const candidate =
      entry.completedAt ||
      entry.submittedAt ||
      entry.finishedAt ||
      entry.createdAt ||
      entry.updatedAt ||
      entry.timestamp ||
      entry.time ||
      entry.date ||
      entry.day ||
      null;

    if (candidate) {
      const parsed = new Date(candidate);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  return null;
}

function toLocalDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function calculateStreak(activityLogs) {
  const uniqueDates = Array.from(
    new Set(
      (Array.isArray(activityLogs) ? activityLogs : [])
        .map(getActivityLogDateValue)
        .filter(Boolean)
        .map(toLocalDateKey)
        .filter(Boolean),
    ),
  ).sort((left, right) => right.localeCompare(left));

  if (uniqueDates.length === 0) {
    return 0;
  }

  const orderedDates = uniqueDates
    .map((dateKey) => new Date(`${dateKey}T00:00:00`))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (orderedDates.length === 0) {
    return 0;
  }

  const today = new Date();
  const todayKey = toLocalDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday);

  const latestKey = toLocalDateKey(orderedDates[0]);

  if (latestKey !== todayKey && latestKey !== yesterdayKey) {
    return 0;
  }

  let streak = 1;

  for (let index = 1; index < orderedDates.length; index += 1) {
    const previousDate = orderedDates[index - 1];
    const currentDate = orderedDates[index];
    const diffDays = Math.round(
      (previousDate.getTime() - currentDate.getTime()) / 86400000,
    );

    if (diffDays === 1) {
      streak += 1;
      continue;
    }

    if (diffDays === 0) {
      continue;
    }

    break;
  }

  return streak;
}

function getProfileActivityLogs(profile) {
  const candidateLogs =
    profile?.activityLogs ||
    profile?.stats?.activityLogs ||
    profile?.learningLogs ||
    profile?.studyLogs ||
    profile?.recentActivities ||
    [];

  return Array.isArray(candidateLogs) ? candidateLogs : [];
}

function getStudentStreakValue(profile, activityLogs = []) {
  const stats = profile?.stats || {};
  const numericStreak = Number(stats.streak);

  if (Number.isFinite(numericStreak) && numericStreak > 0) {
    return numericStreak;
  }

  const logs = Array.isArray(activityLogs) ? activityLogs : [];
  return logs.length > 0 ? calculateStreak(logs) : 0;
}

function getStudentStudyMinutesValue(profile, activityLogs = []) {
  const logs = Array.isArray(activityLogs) ? activityLogs : [];
  const stats = profile?.stats || {};
  const numericStudyMinutes =
    Number(stats.studyMinutes) ||
    Number(stats.studyTimeMinutes) ||
    Number(stats.timeStudied);

  if (Number.isFinite(numericStudyMinutes) && numericStudyMinutes > 0) {
    return numericStudyMinutes;
  }

  return logs.reduce(
    (total, entry) => total + Math.max(0, Number(entry?.studyMinutes) || 0),
    0,
  );
}

function getStudentProgressStats(profile) {
  const stats = profile?.stats || {};
  const rawExp = Number(stats.exp);

  if (Number.isFinite(rawExp)) {
    const calculated = calculateLevel(rawExp);

    return {
      level: calculated.level,
      currentExp: calculated.currentExp,
      requiredExp: calculated.requiredExp,
      streak: Number.isFinite(Number(stats.streak)) ? Number(stats.streak) : 0,
      exp: Math.max(0, Math.floor(rawExp)),
    };
  }

  const legacyLevel = Number(stats.level);
  const level =
    Number.isFinite(legacyLevel) && legacyLevel > 0
      ? Math.floor(legacyLevel)
      : 1;

  return {
    level,
    currentExp: 0,
    requiredExp: getRequiredExpForLevel(level),
    streak: Number.isFinite(Number(stats.streak)) ? Number(stats.streak) : 0,
    exp: 0,
  };
}

function getStudentGrade(profile) {
  const className = normalizeQuizText(profile?.className);
  const classMatch = className.match(/(\d+)/);

  if (classMatch) {
    const grade = Number(classMatch[1]);
    if (Number.isFinite(grade) && grade >= 1 && grade <= 5) {
      return String(grade);
    }
  }

  const profileGrade = normalizeQuizText(profile?.grade);

  if (profileGrade) {
    return profileGrade;
  }

  return STUDENT_QUIZ_DEFAULTS.grade;
}

function pickRandomItem(items, excludedIds = []) {
  const excluded = new Set(
    (Array.isArray(excludedIds) ? excludedIds : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );
  const candidates = (Array.isArray(items) ? items : []).filter((item) => {
    const key = String(
      item?.topicId || item?.id || item?.topicName || item?.name || "",
    ).trim();
    return key && !excluded.has(key);
  });

  if (candidates.length === 0) {
    return null;
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

function startOfTodayLocal() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getSevenDayWindowStart() {
  const start = startOfTodayLocal();
  start.setDate(start.getDate() - 6);
  return start;
}

function getLogDate(entry) {
  const value =
    entry?.submittedAt ||
    entry?.gradedAt ||
    entry?.accuracyUpdatedAt ||
    entry?.updatedAt ||
    entry?.createdAt ||
    entry?.completedAt ||
    entry?.timestamp ||
    null;
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function toQuestionCount(entry) {
  const score = Number(entry?.score);
  if (Number.isFinite(Number(entry?.totalQuestions))) {
    return Math.max(0, Number(entry.totalQuestions));
  }
  if (Number.isFinite(score) && score > 0) {
    return 1;
  }
  return 0;
}

function toNormalizedScore(entry) {
  const score = Number(entry?.score);

  if (!Number.isFinite(score)) {
    return null;
  }

  if (score <= 10) {
    return Math.max(0, Math.min(10, score));
  }

  return Math.max(0, Math.min(10, score / 10));
}

function calculateWeeklyProgress(activityLogs) {
  const logs = Array.isArray(activityLogs) ? activityLogs : [];
  const windowStart = getSevenDayWindowStart();
  const windowEnd = new Date(startOfTodayLocal().getTime() + 86400000);
  const recentLogs = logs.filter((entry) => {
    const date = getLogDate(entry);
    return date && date >= windowStart && date < windowEnd;
  });

  const studyTime = recentLogs.reduce((total, entry) => {
    const explicitMinutes = Number(entry?.studyMinutes);
    if (Number.isFinite(explicitMinutes) && explicitMinutes > 0) {
      return total + explicitMinutes;
    }

    return total;
  }, 0);

  const totalQuestions = recentLogs.reduce(
    (total, entry) => total + toQuestionCount(entry),
    0,
  );
  const scoredEntries = recentLogs
    .map((entry) => ({
      score: toNormalizedScore(entry),
      questions: toQuestionCount(entry),
    }))
    .filter((entry) => Number.isFinite(entry.score) && entry.questions > 0);
  const totalScore = scoredEntries.reduce(
    (sum, entry) => sum + entry.score * entry.questions,
    0,
  );
  const answeredQuestions = scoredEntries.reduce(
    (sum, entry) => sum + entry.questions,
    0,
  );
  const averageScore =
    answeredQuestions > 0
      ? Number((totalScore / answeredQuestions).toFixed(1))
      : 0;

  return {
    studyTime,
    totalQuestions,
    averageScore,
  };
}

function formatProgressChartDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function getStudentProgressChartEntries(activityLogs) {
  const logs = Array.isArray(activityLogs) ? activityLogs : [];

  return logs
    .map((entry) => {
      const date = getLogDate(entry);
      const score = toNormalizedScore(entry);

      if (!date || !Number.isFinite(score)) {
        return null;
      }

      return {
        id: entry?.id || `${date.getTime()}-${score}`,
        date,
        score: Math.max(0, Math.min(10, Number(score))),
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.date.getTime() - left.date.getTime())
    .slice(0, 7)
    .reverse();
}

function getStudentProgressOverview(profile, activityLogs = []) {
  const stats = profile?.stats || {};
  const logs = Array.isArray(activityLogs) ? activityLogs : [];
  const scoredLogs = logs
    .map((entry) => ({
      score: toNormalizedScore(entry),
    }))
    .filter((entry) => Number.isFinite(entry.score));
  const averageScore =
    scoredLogs.length > 0
      ? Number(
          (
            scoredLogs.reduce((sum, entry) => sum + entry.score, 0) /
            scoredLogs.length
          ).toFixed(1),
        )
      : null;

  return {
    studyTime: getStudentStudyMinutesValue(profile, logs),
    completedAssignments:
      Number(stats.completedQuestions) ||
      Number(stats.completedAssignments) ||
      Number(stats.questionsAnswered) ||
      logs.filter((entry) => Number.isFinite(Number(entry?.score))).length,
    averageScore: Number.isFinite(Number(stats.averageScore))
      ? Number(stats.averageScore)
      : averageScore,
    streak: getStudentStreakValue(profile, logs),
  };
}

function getStudentProgressCount(profile, activityLogs = []) {
  const stats = profile?.stats || {};
  const logs = Array.isArray(activityLogs) ? activityLogs : [];
  const completedFromStats =
    Number(stats.completedQuestions) ||
    Number(stats.completedAssignments) ||
    Number(stats.questionsAnswered) ||
    Number(stats.totalAnswered) ||
    Number(stats.totalQuestions);

  if (Number.isFinite(completedFromStats) && completedFromStats > 0) {
    return completedFromStats;
  }

  return logs.reduce((total, entry) => {
    const count =
      Number(entry?.totalQuestions) ||
      Number(entry?.totalAnswered) ||
      Number(entry?.questionsAnswered) ||
      (Number.isFinite(Number(entry?.score)) ? 1 : 0);
    return total + Math.max(0, count);
  }, 0);
}

function renderStudentProgressPage(profile, activityLogs = null) {
  const root = document.getElementById("progress");

  if (!root || normalizeRole(profile?.role) !== "student") {
    return;
  }

  const logs = Array.isArray(activityLogs)
    ? activityLogs
    : getProfileActivityLogs(profile);
  const overview = getStudentProgressOverview(profile, logs);
  const chartEntries = getStudentProgressChartEntries(logs);

  const studyTimeNode = root.querySelector(
    '[data-progress-overview="study-time"]',
  );
  const completedNode = root.querySelector(
    '[data-progress-overview="completed-assignments"]',
  );
  const averageScoreNode = root.querySelector(
    '[data-progress-overview="average-score"]',
  );
  const streakNode = root.querySelector('[data-progress-overview="streak"]');
  const chartNode = root.querySelector("[data-progress-chart]");
  const emptyStateNode = root.querySelector("[data-progress-empty-state]");

  if (studyTimeNode) {
    studyTimeNode.textContent = `${formatStatValue(overview.studyTime)} phút`;
  }

  if (completedNode) {
    completedNode.textContent = `${formatStatValue(overview.completedAssignments)} bài`;
  }

  if (averageScoreNode) {
    averageScoreNode.textContent = Number.isFinite(
      Number(overview.averageScore),
    )
      ? `${formatStatValue(overview.averageScore)} / 10`
      : "--";
  }

  if (streakNode) {
    streakNode.textContent = `${formatStatValue(overview.streak)} ngày`;
  }

  if (!chartNode) {
    return;
  }

  chartNode.innerHTML = "";

  if (chartEntries.length === 0) {
    if (emptyStateNode) {
      emptyStateNode.hidden = false;
    }
    chartNode.hidden = true;
    return;
  }

  if (emptyStateNode) {
    emptyStateNode.hidden = true;
  }

  chartNode.hidden = false;

  chartEntries.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "bar-item";

    const scoreLabel = document.createElement("div");
    scoreLabel.className = "bar-score";
    scoreLabel.textContent = formatStatValue(entry.score);

    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = `${Math.max(0, Math.min(100, (entry.score / 10) * 100))}%`;
    bar.title = `${formatStatValue(entry.score)} điểm - ${formatProgressChartDate(entry.date)}`;

    const dateLabel = document.createElement("span");
    dateLabel.textContent = formatProgressChartDate(entry.date);

    item.append(scoreLabel, bar, dateLabel);
    chartNode.appendChild(item);
  });
}

function formatRecommendationText(prefix, topicName, suffix = "") {
  if (!topicName) {
    return `${prefix} --${suffix}`;
  }

  return `${prefix} ${topicName}${suffix}`;
}

function renderStudentStudyRecommendations(recommendations) {
  const practiceText = document.querySelector(
    "[data-home-study-text='practice']",
  );
  const reviewText = document.querySelector("[data-home-study-text='review']");
  const newText = document.querySelector("[data-home-study-text='new']");
  const practiceBadge = document.querySelector(
    "[data-home-study-badge='practice']",
  );
  const reviewBadge = document.querySelector(
    "[data-home-study-badge='review']",
  );
  const newBadge = document.querySelector("[data-home-study-badge='new']");

  const practice = recommendations?.practice || null;
  const review = recommendations?.review || null;
  const fresh = recommendations?.new || null;

  if (practiceText) {
    practiceText.textContent = practice
      ? `Luyện ${practice.topicName} (10 câu)`
      : "Luyện -- (10 câu)";
  }

  if (reviewText) {
    reviewText.textContent = review
      ? `Ôn lại ${review.topicName}`
      : "Ôn lại --";
  }

  if (newText) {
    newText.textContent = fresh ? `5 câu ${fresh.topicName}` : "5 câu --";
  }

  if (practiceBadge) {
    practiceBadge.textContent =
      practice?.percentage <= 33 ? "Cần cải thiện" : "Ôn tập";
  }

  if (reviewBadge) {
    reviewBadge.textContent = "Ôn lại";
  }

  if (newBadge) {
    newBadge.textContent = "Bài mới";
  }
}

function buildStudentRecommendationSet(topics = []) {
  const sorted = [...topics].sort((left, right) => {
    const leftAccuracy = Number(left?.percentage) || 0;
    const rightAccuracy = Number(right?.percentage) || 0;
    if (leftAccuracy !== rightAccuracy) {
      return leftAccuracy - rightAccuracy;
    }
    return String(left?.topicName || left?.name || "").localeCompare(
      String(right?.topicName || right?.name || ""),
    );
  });

  const practice = sorted[0] || null;
  const review = sorted[1] || null;
  const fresh = pickRandomItem(sorted, [practice?.topicId, review?.topicId]);

  return {
    practice,
    review,
    new:
      fresh ||
      pickRandomItem(sorted, [practice?.topicId]) ||
      review ||
      practice ||
      null,
  };
}

async function fetchStudentRecommendationTopics(profile) {
  const cacheKey = String(
    profile?.uid || profile?.userId || profile?.id || "",
  ).trim();
  const grade = getStudentGrade(profile);
  const cacheId = `${cacheKey}:${grade}`;
  const cached = studentRecommendationCache.get(cacheId);

  if (cached) {
    return cached;
  }

  const subjects = ["math", "english"];

  try {
    const responses = await Promise.all(
      subjects.map((subject) =>
        apiRequestWithAuth(
          `/api/quiz/topics?grade=${encodeURIComponent(grade)}&subject=${encodeURIComponent(subject)}`,
          {
            method: "GET",
          },
        ),
      ),
    );

    const topics = responses.flatMap((response) =>
      Array.isArray(response.data) ? response.data : [],
    );
    const selected = buildStudentRecommendationSet(topics);
    studentRecommendationCache.set(cacheId, selected);
    return selected;
  } catch (error) {
    console.warn("Không thể tải chủ đề gợi ý:", error);
    const fallback = buildStudentRecommendationSet([]);
    studentRecommendationCache.set(cacheId, fallback);
    return fallback;
  }
}

function getStudentTopicSortName(topic) {
  return String(topic?.topicName || topic?.name || topic?.title || "").trim();
}

function getStudentTopicAccuracy(topic) {
  return Math.max(0, Math.min(100, Number(topic?.percentage) || 0));
}

function getTopicAccuracyValue(topic) {
  if (!topic || typeof topic !== "object") {
    return null;
  }

  if (!Object.prototype.hasOwnProperty.call(topic, "percentage")) {
    return null;
  }

  const percentage = Number(topic.percentage);

  if (!Number.isFinite(percentage)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(percentage)));
}

function sortTopicsByAccuracy(topicAccuracies, direction = "desc") {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...(Array.isArray(topicAccuracies) ? topicAccuracies : [])]
    .filter((topic) => getTopicAccuracyValue(topic) !== null)
    .sort((left, right) => {
      const diff =
        (getStudentTopicAccuracy(left) - getStudentTopicAccuracy(right)) *
        multiplier;

      if (diff !== 0) {
        return diff;
      }

      return getStudentTopicSortName(left).localeCompare(
        getStudentTopicSortName(right),
      );
    });
}

function getStrengthTopics(topicAccuracies) {
  return sortTopicsByAccuracy(topicAccuracies, "desc").slice(0, 2);
}

function getWeaknessTopics(topicAccuracies, excludedTopics = []) {
  const excludedKeys = new Set(
    (Array.isArray(excludedTopics) ? excludedTopics : [])
      .map((topic) => getStudentTopicSortName(topic))
      .filter(Boolean),
  );

  return sortTopicsByAccuracy(topicAccuracies, "asc")
    .filter((topic) => !excludedKeys.has(getStudentTopicSortName(topic)))
    .slice(0, 2);
}

function getAssignmentSortTime(assignment) {
  return (
    Date.parse(
      assignment?.createdAt ||
        assignment?.updatedAt ||
        assignment?.submittedAt ||
        assignment?.gradedAt ||
        "",
    ) || 0
  );
}

function getAssignmentHomeStatus(assignment) {
  return normalizeStudentAssignmentStatus(assignment);
}

function getAssignmentHomeStatusLabel(statusKey) {
  if (statusKey === "doing") {
    return "Đang làm";
  }

  if (statusKey === "done") {
    return "Đã làm";
  }

  return "Chưa làm";
}

function getAssignmentHomeStatusClass(statusKey) {
  if (statusKey === "doing") {
    return "tag-blue";
  }

  if (statusKey === "done") {
    return "tag-green";
  }

  return "tag-orange";
}

function buildStudentHomeAssignments(assignments) {
  const sorted = [...(Array.isArray(assignments) ? assignments : [])]
    .sort(
      (left, right) =>
        getAssignmentSortTime(right) - getAssignmentSortTime(left),
    )
    .map((assignment) => ({
      ...assignment,
      statusKey: getAssignmentHomeStatus(assignment),
    }));

  const pending = sorted.filter(
    (assignment) => assignment.statusKey === "pending",
  );
  const doing = sorted.filter((assignment) => assignment.statusKey === "doing");
  const done = sorted.filter((assignment) => assignment.statusKey === "done");

  const firstPending = pending[0] || null;
  const secondAssignment = doing[0] || done[0] || null;

  const selected = [];

  if (firstPending) {
    selected.push(firstPending);
  }

  if (
    secondAssignment &&
    (!firstPending || secondAssignment.id !== firstPending.id)
  ) {
    selected.push(secondAssignment);
  }

  if (selected.length < 2) {
    const fallbackPool = sorted.filter(
      (assignment) => !selected.some((item) => item.id === assignment.id),
    );

    const fallback = fallbackPool[0] || null;

    if (fallback) {
      selected.push(fallback);
    }
  }

  return selected.slice(0, 2);
}

function calculateRecentWrongAnswers(records) {
  const logs = Array.isArray(records) ? records : [];
  const sorted = [...logs]
    .map((entry) => ({
      ...entry,
      time: getAssignmentSortTime(entry),
    }))
    .sort((left, right) => right.time - left.time);

  for (const entry of sorted) {
    const wrongCount = Number(entry?.wrongCount ?? entry?.wrongAnswersCount);

    if (Number.isFinite(wrongCount) && wrongCount > 0) {
      return {
        recentWrongCount: wrongCount,
      };
    }
  }

  return {
    recentWrongCount: 0,
  };
}

function renderStudentRecentWrongAnswers(progress) {
  const card = document.querySelector(".mistake-card");

  if (!card) {
    return;
  }

  const title = card.querySelector(".mistake-copy h2");
  const description = card.querySelector(".mistake-copy p");
  const button = card.querySelector(".btn-danger");
  const recentWrongCount = Number(progress?.recentWrongCount) || 0;

  if (title) {
    title.textContent = `${recentWrongCount} câu`;
  }

  if (description) {
    description.textContent =
      recentWrongCount > 0
        ? `Luyện lại để ghi nhớ tốt hơn nhé!`
        : "Bạn đang làm rất tốt! Cố gắng tiếp tục nhé!";
  }

  if (button) {
    button.setAttribute("type", "button");
    button.setAttribute("data-retry-later", "true");
    button.setAttribute(
      "title",
      "Chức năng luyện lại sẽ được hoàn thiện ở giai đoạn sau",
    );
  }
}

async function fetchStudentRecentWrongAnswers(profile) {
  const cacheKey = String(
    profile?.uid || profile?.userId || profile?.id || "",
  ).trim();
  const cached = studentRecentWrongAnswersCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const studentId = cacheKey;

  if (!studentId) {
    return {
      recentWrongCount: 0,
    };
  }

  const firestore =
    window.firebase?.apps?.length &&
    typeof window.firebase.app === "function" &&
    typeof window.firebase.firestore === "function"
      ? window.firebase.app().firestore()
      : null;

  if (!firestore) {
    return {
      recentWrongCount: 0,
    };
  }

  const records = [];

  try {
    const assignmentSnapshot = await firestore
      .collection("assignment_submissions")
      .where("studentId", "==", studentId)
      .get();

    assignmentSnapshot.docs.forEach((doc) => {
      const data = doc.data() || {};
      records.push({
        id: doc.id,
        wrongCount: Number(data.wrongCount) || 0,
        submittedAt:
          data.submittedAt ||
          data.gradedAt ||
          data.updatedAt ||
          data.createdAt ||
          "",
      });
    });
  } catch (error) {
    console.warn(
      "Không thể tải lịch sử bài làm để tính câu sai gần đây:",
      error,
    );
  }

  try {
    const wrongSnapshot = await firestore
      .collection("wrong_answers")
      .doc(studentId)
      .get();

    if (wrongSnapshot.exists) {
      const data = wrongSnapshot.data() || {};
      records.push({
        id: wrongSnapshot.id,
        wrongCount: Array.isArray(data.wrongQuestions)
          ? data.wrongQuestions.length
          : Number(data.wrongCount) || 0,
        submittedAt: data.updatedAt || data.createdAt || "",
      });
    }
  } catch (error) {
    console.warn("Không thể tải wrong_answers để tính câu sai gần đây:", error);
  }

  const result = calculateRecentWrongAnswers(records);
  studentRecentWrongAnswersCache.set(cacheKey, result);
  return result;
}

async function syncStudentRecentWrongAnswers(profile) {
  if (normalizeRole(profile?.role) !== "student") {
    return;
  }

  const result = await fetchStudentRecentWrongAnswers(profile);
  renderStudentRecentWrongAnswers(result);
}

function renderStudentHomeAssignments(assignments) {
  const titleNodes = Array.from(
    document.querySelectorAll("[data-student-home-assignment-title]"),
  );
  const statusNodes = Array.from(
    document.querySelectorAll("[data-student-home-assignment-status]"),
  );
  const selectedAssignments = Array.isArray(assignments) ? assignments : [];

  titleNodes.forEach((node, index) => {
    const assignment = selectedAssignments[index];
    node.textContent = assignment ? assignment.title : "--";
  });

  statusNodes.forEach((node, index) => {
    const assignment = selectedAssignments[index];
    const statusKey = assignment ? assignment.statusKey : "pending";
    node.textContent = assignment
      ? getAssignmentHomeStatusLabel(statusKey)
      : "Chưa làm";
    node.className = getAssignmentHomeStatusClass(statusKey);
  });
}

async function syncStudentHomeAssignments(profile) {
  if (normalizeRole(profile?.role) !== "student") {
    return;
  }

  const cacheKey = String(
    profile?.uid || profile?.userId || profile?.id || "",
  ).trim();
  const cached = studentHomeAssignmentCache.get(cacheKey);

  if (cached && Array.isArray(cached.assignments)) {
    renderStudentHomeAssignments(cached.assignments);
    return;
  }

  const assignments =
    Array.isArray(currentAssignments) && currentAssignments.length > 0
      ? currentAssignments
      : await loadStudentAssignmentsFromAPI().catch(() => []);

  const selectedAssignments = buildStudentHomeAssignments(assignments);
  studentHomeAssignmentCache.set(cacheKey, {
    assignments: selectedAssignments,
  });
  renderStudentHomeAssignments(selectedAssignments);
}

async function fetchStudentStrengthWeaknessTopics(profile) {
  const cacheKey = String(
    profile?.uid || profile?.userId || profile?.id || "",
  ).trim();
  const grade = getStudentGrade(profile);
  const subjectKey = String(studentQuizState.subject || "").trim();
  const topicsKey = String(studentQuizState.loadedTopicsKey || "").trim();
  const cacheId = `${cacheKey}:${grade}:${subjectKey}:${topicsKey}:strength-weakness`;
  const cached = studentStrengthWeaknessCache.get(cacheId);

  if (cached) {
    return cached;
  }

  try {
    const topics = Array.isArray(studentQuizState.topics)
      ? studentQuizState.topics
      : await fetchStudentQuizTopics();
    const strengths = getStrengthTopics(topics);
    const weaknesses = getWeaknessTopics(topics, strengths);

    const result = {
      strengths,
      weaknesses,
    };

    studentStrengthWeaknessCache.set(cacheId, result);
    return result;
  } catch (error) {
    console.warn("Không thể tải dữ liệu phân tích học tập:", error);
    const fallback = {
      strengths: [],
      weaknesses: [],
    };
    studentStrengthWeaknessCache.set(cacheId, fallback);
    return fallback;
  }
}

function renderStudentStrengthWeakness(profile, payload = null) {
  if (normalizeRole(profile?.role) !== "student") {
    return;
  }

  const strengthNodes = Array.from(
    document.querySelectorAll("[data-student-strength-item]"),
  );
  const weaknessNodes = Array.from(
    document.querySelectorAll("[data-student-weakness-item]"),
  );

  const strengths = Array.isArray(payload?.strengths) ? payload.strengths : [];
  const weaknesses = Array.isArray(payload?.weaknesses)
    ? payload.weaknesses
    : [];

  strengthNodes.forEach((node, index) => {
    const topic = strengths[index];
    const topicName = topic ? getStudentTopicSortName(topic) : "--";
    const accuracy = topic ? getTopicAccuracyValue(topic) : null;
    node.textContent = topicName;

    const skillLine = node.closest(".skill-line");
    const fill = skillLine?.querySelector(".skill-fill");
    const valueNode = skillLine?.querySelector("b");

    if (fill) {
      fill.classList.remove("green");
      fill.classList.add("red");
      fill.style.width = `${accuracy ?? 0}%`;
      fill.style.backgroundColor = accuracy !== null ? "#EF4444" : "#D1D5DB";
    }

    if (valueNode) {
      valueNode.textContent = `${accuracy ?? 0}% đúng`;
    }
  });

  weaknessNodes.forEach((node, index) => {
    const topic = weaknesses[index];
    const topicName = topic ? getStudentTopicSortName(topic) : "--";
    const accuracy = topic ? getTopicAccuracyValue(topic) : null;
    node.textContent = topicName;

    const skillLine = node.closest(".skill-line");
    const fill = skillLine?.querySelector(".skill-fill");
    const valueNode = skillLine?.querySelector("b");

    if (fill) {
      fill.classList.remove("red");
      fill.classList.add("green");
      fill.style.width = `${accuracy ?? 0}%`;
      fill.style.backgroundColor = accuracy !== null ? "#22C55E" : "#D1D5DB";
    }

    if (valueNode) {
      valueNode.textContent = `${accuracy ?? 0}% đúng`;
    }
  });
}

async function syncStudentStrengthWeakness(profile) {
  if (normalizeRole(profile?.role) !== "student") {
    return;
  }

  const payload = await fetchStudentStrengthWeaknessTopics(profile);
  renderStudentStrengthWeakness(profile, payload);
}

async function fetchAICoachAnalysis() {
  const response = await apiRequestWithAuth("/api/coach/analyze", {
    method: "POST",
  });

  return response.data || null;
}

async function recordAiUsageLog(payload) {
  const service = window.EduKidsAdminAiService;

  if (typeof service?.recordAiUsage !== "function") {
    return null;
  }

  try {
    return await service.recordAiUsage(payload);
  } catch (error) {
    console.warn("Không thể ghi log AI:", error);
    return null;
  }
}

async function handleAICoachAnalyze() {
  const profile = getCurrentAuthUser();

  if (normalizeRole(profile?.role) !== "student") {
    return;
  }

  if (aiCoachState.loading) {
    return;
  }

  const aiEnabled = await refreshAiCoachEnabledState();

  if (!aiEnabled) {
    showToast("AI Coach hiện đang tắt trong hệ thống.", "error");
    return;
  }

  aiCoachState.loading = true;
  aiCoachState.error = "";
  renderAICoachPage();

  try {
    const analysis = await fetchAICoachAnalysis();

    if (!analysis) {
      throw new Error("Không thể phân tích kết quả học tập. Vui lòng thử lại.");
    }

    aiCoachState.analysis = analysis;
    aiCoachState.error = "";
    void recordAiUsageLog({
      feature: "coach",
      action: "analyze",
      status: "success",
      success: true,
      userId: profile?.uid || profile?.userId || profile?.id || "",
      role: profile?.role || "student",
      meta: {
        fromCache: Boolean(analysis?.fromCache),
      },
    });
  } catch (error) {
    const rawMessage = String(error?.message || "");
    aiCoachState.error = rawMessage.includes(
      "Bạn cần làm bài trước khi AI Coach có thể phân tích.",
    )
      ? "Bạn cần làm bài trước khi AI Coach có thể phân tích."
      : "Không thể phân tích kết quả học tập. Vui lòng thử lại.";
    showToast(aiCoachState.error, "error");
    void recordAiUsageLog({
      feature: "coach",
      action: "analyze",
      status: "failed",
      success: false,
      userId: profile?.uid || profile?.userId || profile?.id || "",
      role: profile?.role || "student",
      message: aiCoachState.error,
      meta: {
        rawMessage,
      },
    });
  } finally {
    aiCoachState.loading = false;
    aiCoachState.initialized = true;
    renderAICoachPage();
  }
}

async function openAICoachPracticeTopic(topicId, grade, subject) {
  const normalizedTopicId = normalizeQuizText(topicId);
  const normalizedGrade = normalizeQuizText(grade);
  const normalizedSubject = normalizeQuizText(subject);

  if (!isAiTopicLearningEnabled()) {
    showToast("AI Học theo chủ đề hiện đang tắt trong hệ thống.", "error");
    return;
  }

  if (!normalizedTopicId) {
    showToast("Chủ đề này hiện chưa có bộ câu hỏi luyện tập.", "error");
    return;
  }

  if (!normalizedGrade || !normalizedSubject) {
    showToast(
      "Không thể xác định khối lớp hoặc môn học cho chủ đề này.",
      "error",
    );
    return;
  }

  studentQuizState.initialized = true;
  studentQuizState.grade = normalizedGrade;
  studentQuizState.subject = normalizedSubject;
  studentQuizState.pendingTopicId = normalizedTopicId;

  changePage("subjects");
}

function initializeAICoachPage() {
  const root = getAICoachRoot();

  if (!root) {
    return;
  }

  if (!aiCoachState.initialized) {
    aiCoachState.initialized = true;
    aiCoachState.analysis = null;
    aiCoachState.loading = false;
    aiCoachState.error = "";
  }

  renderAICoachPage();
  void refreshAiCoachEnabledState(true).then(() => {
    if (getAICoachRoot()) {
      renderAICoachPage();
    }
  });
}

function invalidateStudentHomeAssignmentCache(profile) {
  const cacheKey = String(
    profile?.uid || profile?.userId || profile?.id || "",
  ).trim();

  if (cacheKey) {
    studentHomeAssignmentCache.delete(cacheKey);
  }
}

async function fetchStudentWeeklyActivityLogs(profile) {
  const cacheKey = String(
    profile?.uid || profile?.userId || profile?.id || "",
  ).trim();
  const cached = studentWeeklyProgressCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const studentId = cacheKey;

  if (!studentId) {
    return [];
  }

  const firestore =
    window.firebase?.apps?.length &&
    typeof window.firebase.app === "function" &&
    typeof window.firebase.firestore === "function"
      ? window.firebase.app().firestore()
      : null;

  if (!firestore) {
    return [];
  }

  const logs = [];

  try {
    const assignmentSnapshot = await firestore
      .collection("assignment_submissions")
      .where("studentId", "==", studentId)
      .get();

    assignmentSnapshot.docs.forEach((doc) => {
      const data = doc.data() || {};
      const totalQuestions = Number(data.totalQuestions) || 0;
      const explicitMinutes = Number(data.studyMinutes) || 0;
      logs.push({
        id: doc.id,
        type: "assignment",
        submittedAt:
          data.submittedAt ||
          data.gradedAt ||
          data.updatedAt ||
          data.createdAt ||
          "",
        totalQuestions,
        score: data.score ?? null,
        studyMinutes: explicitMinutes || Math.max(0, totalQuestions * 2),
      });
    });
  } catch (error) {
    console.warn(
      "Không thể tải assignment submissions cho tiến độ tuần:",
      error,
    );
  }

  try {
    const progressSnapshot = await firestore
      .collectionGroup("topics")
      .where("userId", "==", studentId)
      .get();

    progressSnapshot.docs.forEach((doc) => {
      const data = doc.data() || {};
      const totalQuestions = Number(data.totalAnswered) || 0;
      const explicitMinutes = Number(data.studyMinutes) || 0;
      logs.push({
        id: doc.id,
        type: "topic-progress",
        updatedAt:
          data.updatedAt || data.accuracyUpdatedAt || data.createdAt || "",
        totalQuestions,
        score: data.percentage ?? null,
        studyMinutes: explicitMinutes || Math.max(0, totalQuestions * 2),
      });
    });
  } catch (error) {
    console.warn("Không thể tải topic progress cho tiến độ tuần:", error);
  }

  studentWeeklyProgressCache.set(cacheKey, logs);
  return logs;
}

async function syncStudentWeeklyProgress(profile) {
  if (normalizeRole(profile?.role) !== "student") {
    return;
  }

  const activityLogs = await fetchStudentWeeklyActivityLogs(profile);
  const weeklyProgress = calculateWeeklyProgress(activityLogs);
  const root = document.querySelector("[data-student-weekly-progress]");

  if (!root) {
    return;
  }

  const studyTimeNode = root.querySelector("[data-weekly-study-time]");
  const totalQuestionsNode = root.querySelector(
    "[data-weekly-total-questions]",
  );
  const averageScoreNode = root.querySelector("[data-weekly-average-score]");

  if (studyTimeNode) {
    studyTimeNode.textContent = `${formatStatValue(weeklyProgress.studyTime)} phút`;
  }

  if (totalQuestionsNode) {
    totalQuestionsNode.textContent = `${formatStatValue(weeklyProgress.totalQuestions)} câu`;
  }

  if (averageScoreNode) {
    averageScoreNode.textContent = `${formatStatValue(weeklyProgress.averageScore)} điểm`;
  }
}

function setProfileLoadingState(pageType, isLoading) {
  const root = getProfilePageRoot(pageType);

  if (!root) {
    return;
  }

  root.setAttribute("aria-busy", String(isLoading));
  root.classList.toggle("is-loading", isLoading);
}

function applyProfileSkeleton(pageType, isLoading) {
  const root = getProfilePageRoot(pageType);

  if (!root) {
    return;
  }

  const selectorList = [
    "[id$='-profile-avatar']",
    "[id$='-profile-name']",
    "[id$='-profile-role']",
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

  selectorList.forEach((selector) => {
    root.querySelectorAll(selector).forEach((node) => {
      if (isLoading) {
        node.classList.add("profile-skeleton");
      } else {
        node.classList.remove("profile-skeleton");
      }
    });
  });
}

function extractLearningPathStatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (payload.state && typeof payload.state === "object") {
    return payload.state;
  }

  if (
    payload.learningPathState &&
    typeof payload.learningPathState === "object"
  ) {
    return payload.learningPathState;
  }

  return payload;
}

function buildStudentLearningPathBadges(learningPathState) {
  const state =
    learningPathState && typeof learningPathState === "object"
      ? learningPathState
      : {};
  const season =
    state.season && typeof state.season === "object" ? state.season : null;
  const mountains = Array.isArray(season?.mountains) ? season.mountains : [];
  const completedMountains = new Set(
    Array.isArray(state?.progress?.completedMountains)
      ? state.progress.completedMountains
          .map((id) => String(id || "").trim())
          .filter(Boolean)
      : [],
  );
  const rewardedBadges = new Set(
    Array.isArray(state?.rewards?.badges)
      ? state.rewards.badges
          .map((id) => String(id || "").trim())
          .filter(Boolean)
      : [],
  );
  const seasonId = String(state.seasonId || season?.id || "").trim();
  const unlockedAtFallback = String(
    state?.limits?.lastSummitCompletedAt || state?.updatedAt || "",
  ).trim();

  return mountains
    .map((mountain) => {
      const badge =
        mountain?.badge && typeof mountain.badge === "object"
          ? mountain.badge
          : {};
      const mountainId = String(mountain?.id || "").trim();
      const badgeId = String(badge.id || `badge-${mountainId}`).trim();

      if (!mountainId || !badgeId) {
        return null;
      }

      const isUnlocked =
        completedMountains.has(mountainId) || rewardedBadges.has(badgeId);

      if (!isUnlocked) {
        return null;
      }

      return {
        id: badgeId,
        name: String(
          badge.name ||
            mountain?.badgeName ||
            `Huy hiệu ${mountain?.name || ""}`,
        ).trim(),
        image: String(
          badge.image || mountain?.badgeImage || mountain?.image || "",
        ).trim(),
        seasonId,
        mountainId,
        unlockedAt: unlockedAtFallback,
      };
    })
    .filter(Boolean);
}

async function fetchStudentLearningPathState(userId) {
  const normalizedUserId = String(userId || "").trim();

  if (!normalizedUserId) {
    return null;
  }

  const response = await apiRequestWithAuth(
    `/api/learning-path/state/${encodeURIComponent(normalizedUserId)}`,
    { method: "GET" },
  );

  const backendState = extractLearningPathStatePayload(response?.state);
  if (!backendState) {
    return null;
  }

  return adaptLearningPathState(backendState);
}

function renderStudentAchievementBadgeState(message, isLoading = false) {
  const grid = document.querySelector("[data-student-badge-grid]");
  const empty = document.querySelector("[data-student-badge-empty]");

  if (!(grid instanceof HTMLElement) || !(empty instanceof HTMLElement)) {
    return;
  }

  grid.innerHTML = "";
  empty.hidden = false;
  empty.classList.toggle("is-loading", isLoading);
  empty.innerHTML = `
    <span class="student-profile-badge-empty-icon" aria-hidden="true">🏅</span>
    <strong>${escapeHtml(message)}</strong>
  `;
}

function renderStudentAchievementBadges(profile, learningPathState) {
  const grid = document.querySelector("[data-student-badge-grid]");
  const empty = document.querySelector("[data-student-badge-empty]");

  if (!(grid instanceof HTMLElement) || !(empty instanceof HTMLElement)) {
    return;
  }

  const learningPathBadges = buildStudentLearningPathBadges(learningPathState);
  const bossBattleBadges = getBossBattleAchievementBadgeList(
    Array.isArray(profile?.rewards?.badges) ? profile.rewards.badges : [],
  );
  const badgeMap = new Map();

  [...learningPathBadges, ...bossBattleBadges].forEach((badge) => {
    if (!badge || !badge.id || badgeMap.has(badge.id)) {
      return;
    }

    badgeMap.set(badge.id, badge);
  });

  const badges = Array.from(badgeMap.values());

  if (!Array.isArray(badges) || badges.length === 0) {
    renderStudentAchievementBadgeState("Chưa có huy hiệu nào");
    return;
  }

  empty.hidden = true;
  empty.classList.remove("is-loading");
  grid.innerHTML = badges
    .map(
      (badge) => `
        <article
          class="student-profile-badge-item"
          data-badge-id="${escapeHtml(badge.id)}"
          data-badge-season-id="${escapeHtml(badge.seasonId || "")}"
          data-badge-mountain-id="${escapeHtml(badge.mountainId || "")}"
          data-badge-unlocked-at="${escapeHtml(badge.unlockedAt || "")}"
          title="${escapeHtml(badge.name)}"
        >
          <div class="student-profile-badge-image-wrap">
            <img src="${escapeHtml(badge.image)}" alt="${escapeHtml(badge.name)}" loading="lazy" decoding="async" />
          </div>
          <span class="student-profile-badge-name">${escapeHtml(badge.name)}</span>
        </article>
      `,
    )
    .join("");
}

async function syncStudentAchievementBadges(profile) {
  if (normalizeRole(profile?.role) !== "student") {
    renderStudentAchievementBadgeState("Chưa có huy hiệu nào");
    return;
  }

  const userId = String(
    profile?.uid || profile?.userId || profile?.id || "",
  ).trim();

  if (!userId) {
    renderStudentAchievementBadgeState("Chưa có huy hiệu nào");
    return;
  }

  renderStudentAchievementBadgeState("Đang tải huy hiệu...", true);

  try {
    const learningPathState = await fetchStudentLearningPathState(userId);
    if (learningPathState) {
      renderStudentAchievementBadges(profile, learningPathState);
      return;
    }
  } catch (error) {
    console.warn("Không thể tải huy hiệu Learning Path:", error);
  }

  renderStudentAchievementBadges(profile, null);
}

function renderStudentHomeOverview(profile, activityLogs = null) {
  if (normalizeRole(profile?.role) !== "student") {
    return;
  }

  const greeting = document.getElementById("student-home-greeting");
  const streakValue = document.getElementById("student-home-streak");
  const levelValue = document.getElementById("student-home-level");
  const expValue = document.getElementById("student-home-exp");
  const expFill = document.getElementById("student-home-exp-fill");

  const displayName = getDisplayName(
    profile?.fullName || profile?.name || profile?.username || "",
  );
  const progressStats = getStudentProgressStats(profile);
  const logs = Array.isArray(activityLogs)
    ? activityLogs
    : getProfileActivityLogs(profile);
  const streak = getStudentStreakValue(profile, logs);
  const currentExp = progressStats.currentExp;
  const requiredExp = Math.max(progressStats.requiredExp, 1);
  const expPercent = Math.max(
    0,
    Math.min(100, (currentExp / requiredExp) * 100),
  );

  if (greeting) {
    greeting.textContent = displayName
      ? `Xin chào, ${displayName}! 👋`
      : "Xin chào! 👋";
  }

  if (streakValue) {
    streakValue.textContent = `${formatStatValue(streak)} ngày`;
  }

  if (levelValue) {
    levelValue.textContent = formatStatValue(progressStats.level);
  }

  if (expValue) {
    expValue.textContent = `${formatStatValue(currentExp)} / ${formatStatValue(requiredExp)}`;
  }

  if (expFill) {
    expFill.style.width = `${expPercent}%`;
  }
}

function applyLatestCurrentUser(profile) {
  if (!profile) {
    return;
  }

  const normalizedProfile =
    window.EduKidsProfileService?.normalizeProfile?.(profile) || profile;

  bootstrapState.currentUser = normalizedProfile;
  window.EduKidsCurrentUser = normalizedProfile;
  saveAuthSession(
    normalizedProfile,
    localStorage.getItem("authToken") || localStorage.getItem("token"),
  );

  if (currentPage === "student-home" || currentPage === "profile") {
    renderStudentHomeOverview(normalizedProfile);
    renderStudentProfile(normalizedProfile);
  }
}

function syncPetWalletFromProfile(profile) {
  const pet = getPetModuleApi();
  const coinValue = Math.max(0, Math.floor(Number(profile?.stats?.eduCoin || 0)));

  if (!pet?.store?.setState) {
    return;
  }

  pet.store.setState(
    {
      wallet: {
        eduCoin: coinValue,
      },
    },
    "STATE_UPDATED",
  );
}

async function syncStudentHomeRecommendations(profile) {
  if (normalizeRole(profile?.role) !== "student") {
    return;
  }

  const recommendations = await fetchStudentRecommendationTopics(profile);
  renderStudentStudyRecommendations(recommendations);
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
  const progressStats = getStudentProgressStats(profile);
  const activityLogs = getProfileActivityLogs(profile);
  const completedCount = getStudentProgressCount(profile, activityLogs);
  const streakValue = getStudentStreakValue(profile, activityLogs);

  if (avatar) {
    avatar.src = getProfileAvatar(profile);
  }

  if (name) name.textContent = profile?.name || profile?.fullName || "--";
  if (role) role.textContent = formatRoleLabel(profile?.role);
  if (code) code.textContent = profile?.userCode || "--";
  if (className) className.textContent = profile?.className || "--";
  if (createdAt) createdAt.textContent = formatDateOnly(profile?.createdAt);
  if (level) level.textContent = formatStatValue(progressStats.level);

  if (streak) {
    streak.innerHTML = `${formatStatValue(streakValue)} <span>ngày</span>`;
  }

  if (completed) {
    completed.innerHTML = `${formatStatValue(completedCount)} <span>câu hỏi</span>`;
  }

  if (studyMinutes) {
    const resolvedStudyMinutes = getStudentStudyMinutesValue(
      profile,
      activityLogs,
    );
    studyMinutes.innerHTML = `${formatStatValue(resolvedStudyMinutes)} <span>phút</span>`;
  }

  if (fullName) {
    fullName.textContent = profile?.name || profile?.fullName || "--";
  }

  if (username) username.textContent = profile?.username || "--";
  if (gender) gender.textContent = formatGenderLabel(profile?.gender);
  if (roleDetail) roleDetail.textContent = formatRoleLabel(profile?.role);
  if (school) school.textContent = profile?.school || "--";
  if (classExtra) classExtra.textContent = profile?.className || "--";
  if (hobby) hobby.textContent = profile?.hobby || "--";
  if (dream) dream.textContent = profile?.dream || "--";
  void syncStudentAchievementBadges(profile);
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
  if (createdAt) createdAt.textContent = formatDateOnly(profile?.createdAt);
  if (fullName) {
    fullName.textContent = profile?.name || profile?.fullName || "--";
  }
  if (username) username.textContent = profile?.username || "--";
  if (gender) gender.textContent = formatGenderLabel(profile?.gender);
  if (roleDetail) roleDetail.textContent = formatRoleLabel(profile?.role);
  if (phone) phone.textContent = profile?.phone || "--";
  if (address) address.textContent = profile?.address || "--";
  if (note) note.textContent = profile?.note || "--";
  if (extra) extra.textContent = profile?.note || profile?.address || "--";
  if (birthdate) birthdate.textContent = formatDateOnly(profile?.createdAt);
  if (email) email.textContent = profile?.email || "--";

  const stats = profile?.stats || {};
  const dashboardData = teacherDashboardState?.data || null;
  if (totalClasses) {
    totalClasses.textContent = formatStatValue(
      Number(stats.totalClasses) ||
        Number(dashboardData?.totalClasses) ||
        Number(profile?.classTags?.length) ||
        Number(profile?.classTagNames?.length),
    );
  }
  if (assignmentsCreated) {
    assignmentsCreated.textContent = formatStatValue(
      Number(stats.assignmentsCreated) ||
        Number(dashboardData?.totalAssignments),
    );
  }
  if (studentsManaged) {
    studentsManaged.textContent = formatStatValue(
      Number(stats.studentsManaged) || Number(dashboardData?.totalStudents),
    );
  }
  if (averageScore) {
    averageScore.textContent = formatStatValue(
      Number(stats.averageScore) || Number(dashboardData?.overallAverageScore),
    );
  }

  const tags =
    Array.isArray(profile?.classTags) && profile.classTags.length > 0
      ? profile.classTags
      : Array.isArray(profile?.classTagNames) &&
          profile.classTagNames.length > 0
        ? profile.classTagNames
        : [];

  if (classTags.length > 0) {
    classTags.forEach((tag, index) => {
      tag.textContent = tags[index] || tags[0] || "--";
    });
  }
}

async function syncTeacherProfileSupplement(profile) {
  if (normalizeRole(profile?.role) !== "teacher") {
    return;
  }

  const resolvedTags = [];

  try {
    const classes = await window.EduKidsProfileService?.fetchMyClasses?.();
    if (Array.isArray(classes)) {
      classes.forEach((classroom) => {
        const label = String(
          classroom?.name || classroom?.className || "",
        ).trim();
        if (label) {
          resolvedTags.push(label);
        }
      });
    }
  } catch (error) {
    console.warn("Không thể tải lớp chủ nhiệm cho hồ sơ giáo viên:", error);
  }

  if (resolvedTags.length > 0) {
    const tagNodes = document.querySelectorAll("[data-teacher-class-tag]");
    tagNodes.forEach((tag, index) => {
      tag.textContent = resolvedTags[index] || resolvedTags[0] || "--";
    });
  }
}

async function syncTeacherDashboard(profile = null, forceRefresh = true) {
  if (normalizeRole(profile?.role || getCurrentRole()) !== "teacher") {
    return;
  }

  renderTeacherDashboardFallback(profile || getCurrentAuthUser());
  const dashboardData = await fetchTeacherDashboardData(profile, {
    forceRefresh,
  });

  if (dashboardData) {
    renderTeacherDashboard(
      dashboardData.profile || profile || getCurrentAuthUser(),
    );
    return;
  }

  renderTeacherDashboard(profile || getCurrentAuthUser());
}

function updateSidebarProfileCards(profile) {
  renderSidebarProfileCards(profile);
}

function getStudentActivityCacheKey(profile) {
  return String(profile?.uid || profile?.userId || profile?.id || "").trim();
}

async function fetchStudentActivityLogs(profile) {
  const existingLogs = getProfileActivityLogs(profile);

  if (existingLogs.length > 0) {
    return existingLogs;
  }

  const studentId = getStudentActivityCacheKey(profile);

  if (!studentId) {
    return [];
  }

  const firestore =
    window.firebase?.apps?.length &&
    typeof window.firebase.app === "function" &&
    typeof window.firebase.firestore === "function"
      ? window.firebase.app().firestore()
      : null;

  if (!firestore) {
    return [];
  }

  try {
    const snapshot = await firestore
      .collection("assignment_submissions")
      .where("studentId", "==", studentId)
      .get();

    return snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() || {}),
      }))
      .sort((left, right) => {
        const leftTime =
          Date.parse(
            left.submittedAt || left.completedAt || left.createdAt || "",
          ) || 0;
        const rightTime =
          Date.parse(
            right.submittedAt || right.completedAt || right.createdAt || "",
          ) || 0;

        return rightTime - leftTime;
      });
  } catch (error) {
    console.warn("Không thể tải lịch sử học tập để tính streak:", error);
    return [];
  }
}

async function syncStudentProgress(profile) {
  if (normalizeRole(profile?.role) !== "student") {
    return;
  }

  const cacheKey = getStudentActivityCacheKey(profile);
  const cachedLogs = cacheKey ? studentProgressCache.get(cacheKey) : null;
  const profileLogs = getProfileActivityLogs(profile);
  const activityLogs =
    Array.isArray(profileLogs) && profileLogs.length > 0
      ? profileLogs
      : Array.isArray(cachedLogs) && cachedLogs.length > 0
        ? cachedLogs
        : await fetchStudentActivityLogs(profile);

  if (cacheKey && Array.isArray(activityLogs)) {
    studentProgressCache.set(cacheKey, activityLogs);
  }

  const resolvedProfile = {
    ...profile,
    activityLogs: Array.isArray(activityLogs) ? activityLogs : [],
    stats: profile?.stats || {},
  };

  if (
    bootstrapState.currentUser &&
    String(
      bootstrapState.currentUser.uid ||
        bootstrapState.currentUser.userId ||
        bootstrapState.currentUser.id ||
        "",
    ).trim() === cacheKey
  ) {
    bootstrapState.currentUser = resolvedProfile;
    window.EduKidsCurrentUser = resolvedProfile;
  }

  if (profileState.current && cacheKey) {
    const currentKey = getStudentActivityCacheKey(profileState.current);

    if (currentKey === cacheKey) {
      profileState.current = resolvedProfile;
    }
  }

  renderStudentHomeOverview(resolvedProfile, activityLogs);
  renderStudentProgressPage(resolvedProfile, activityLogs);

  if (currentPage === "profile" || currentPage === "student-home") {
    renderStudentProfile(resolvedProfile);
  }

  if (currentPage === "student-home") {
    void syncStudentHomeRecommendations(resolvedProfile);
    void syncStudentStrengthWeakness(resolvedProfile);
    void syncStudentHomeAssignments(resolvedProfile);
  }
}

function renderProfileView(profile) {
  const profileType = profile?.role === "teacher" ? "teacher" : "student";

  profileState.current = profile;

  if (profileType === "teacher") {
    renderTeacherProfile(profile);
    void syncTeacherProfileSupplement(profile);
  } else {
    renderStudentProfile(profile);
  }

  updateSidebarProfileCards(profile);
  renderStudentHomeOverview(profile);
  renderStudentProgressPage(profile);
  void syncStudentProgress(profile);
  void syncStudentHomeRecommendations(profile);
  void syncStudentStrengthWeakness(profile);
  void syncStudentHomeAssignments(profile);
  void syncStudentRecentWrongAnswers(profile);

  applyProfileSkeleton(profileType, false);
  setProfileLoadingState(profileType, false);
}

function renderProfileError(profileType, message) {
  const fallbackMessage = message || "Không thể tải hồ sơ người dùng.";
  console.warn(fallbackMessage);
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
    profileState.loading = true;
    setProfileLoadingState(profileType, true);
    applyProfileSkeleton(profileType, true);
    setSidebarCardsLoading(true);

    const profile = await window.EduKidsProfileService.fetchCurrentProfile();

    if (!profile) {
      throw new Error("Không tìm thấy hồ sơ người dùng.");
    }

    profileState.current = profile;
    profileState.error = null;
    bootstrapState.currentUser = profile;
    window.EduKidsCurrentUser = profile;
    renderProfileView(profile);
  } catch (error) {
    profileState.error = error;
    renderProfileError(
      profileType,
      error.message || "Lỗi tải hồ sơ người dùng.",
    );
  } finally {
    profileState.loading = false;
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
      console.warn(error?.message || "Không thể tải hồ sơ.");
      return;
    }
  }

  if (!profile) {
    console.warn("Không có dữ liệu hồ sơ để chỉnh sửa.");
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
      profileState.error = null;
      bootstrapState.currentUser = updatedProfile;
      window.EduKidsCurrentUser = updatedProfile;
      saveAuthSession(
        updatedProfile,
        localStorage.getItem("authToken") || localStorage.getItem("token"),
      );
      renderProfileView(updatedProfile);
      console.info("Đã cập nhật hồ sơ thành công.");
      closeModal();
    } catch (error) {
      if (feedback) {
        feedback.textContent = error.message || "Không thể cập nhật hồ sơ.";
      }
      console.warn(error?.message || "Không thể cập nhật hồ sơ.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalLabel || "Lưu thay đổi";
      }
    }
  });
}

function buildAppReviewStarMarkup(rating = 0, { interactive = false } = {}) {
  return Array.from({ length: 5 }, (_, index) => {
    const value = index + 1;
    const isActive = value <= Number(rating || 0);
    const starSvg = `
      <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
        <path
          d="M12 3.4l2.76 5.59 6.17.9-4.46 4.34 1.05 6.15L12 17.5l-5.52 2.88 1.05-6.15-4.46-4.34 6.17-.9L12 3.4z"
          fill="currentColor"
        />
      </svg>
    `;

    if (interactive) {
      return `
        <button
          type="button"
          class="app-review-star-btn ${isActive ? "is-active" : ""}"
          data-app-review-rating="${value}"
          aria-pressed="${String(isActive)}"
          aria-label="${value} sao"
        >
          ${starSvg}
        </button>
      `;
    }

    return `
      <span class="app-review-star ${isActive ? "is-active" : ""}" aria-hidden="true">
        ${starSvg}
      </span>
    `;
  }).join("");
}

function buildAppReviewModal(profile) {
  const roleLabel = formatRoleLabel(profile?.role);
  const nameLabel =
    profile?.fullName || profile?.name || profile?.username || "Người dùng";

  return `
    <form class="app-review-form" data-app-review-form>
      <div class="app-review-profile">
        <img
          class="app-review-avatar"
          src="${getProfileAvatar(profile)}"
          alt="${escapeHtml(nameLabel)}"
        />
        <div class="app-review-profile-copy">
          <strong>${escapeHtml(nameLabel)}</strong>
          <span>${escapeHtml(roleLabel)}</span>
        </div>
      </div>

      <section class="app-review-section">
        <div class="app-review-section-head">
          <h4>Chọn số sao</h4>
          <span>1 đến 5 sao</span>
        </div>
        <div class="app-review-stars" data-app-review-stars>
          ${buildAppReviewStarMarkup(0, { interactive: true })}
        </div>
        <input type="hidden" name="rating" value="0" data-app-review-rating-input />
        <p class="app-review-rating-hint" data-app-review-rating-hint>
          Hãy chọn số sao phù hợp với trải nghiệm của bạn.
        </p>
      </section>

      <section class="app-review-section">
        <div class="app-review-section-head">
          <h4>Nhận xét</h4>
          <span data-app-review-count>0 / 1000</span>
        </div>
        <textarea
          class="app-review-textarea"
          name="comment"
          rows="6"
          maxlength="1000"
          placeholder="Hãy chia sẻ trải nghiệm của bạn về EduKids..."
          data-app-review-comment
        ></textarea>
      </section>

      <div class="app-review-actions">
        <button type="button" class="app-review-cancel-btn" data-app-review-cancel>Hủy</button>
        <button type="submit" class="app-review-submit-btn">Gửi đánh giá</button>
      </div>

      <div class="app-review-feedback" data-app-review-feedback aria-live="polite"></div>
    </form>
  `;
}

function syncAppReviewModalStars(modal, rating) {
  const normalizedRating = Math.max(
    0,
    Math.min(5, Number.parseInt(rating, 10) || 0),
  );
  const ratingInput = modal.querySelector("[data-app-review-rating-input]");
  const hintNode = modal.querySelector("[data-app-review-rating-hint]");

  if (ratingInput) {
    ratingInput.value = String(normalizedRating);
  }

  modal.querySelectorAll("[data-app-review-rating]").forEach((button) => {
    const value = Number.parseInt(button.dataset.appReviewRating || "0", 10);
    const isActive = value <= normalizedRating;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(value === normalizedRating));
  });

  if (hintNode) {
    hintNode.textContent =
      normalizedRating > 0
        ? `Bạn đã chọn ${normalizedRating} sao.`
        : "Hãy chọn số sao phù hợp với trải nghiệm của bạn.";
  }
}

async function openAppReviewModal() {
  let profile = profileState.current || getCurrentAuthUser();

  if (!profile?.userCode && window.EduKidsProfileService?.fetchCurrentProfile) {
    try {
      profile = await window.EduKidsProfileService.fetchCurrentProfile();
      profileState.current = profile;
    } catch (error) {
      console.warn(error?.message || "Không thể tải hồ sơ để đánh giá.");
      showToast(error?.message || "Không thể tải hồ sơ để đánh giá.", "error");
      return;
    }
  }

  if (!profile) {
    showToast("Không tìm thấy thông tin người dùng.", "error");
    return;
  }

  const modal = document.createElement("div");
  modal.className = "modal-overlay app-review-overlay";
  modal.innerHTML = `
    <div class="modal app-review-modal">
      <div class="modal-header">
        <h3>Đánh giá EduKids</h3>
        <button class="close-btn" type="button" aria-label="Đóng cửa sổ">×</button>
      </div>
      <div class="modal-content">
        ${buildAppReviewModal(profile)}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => modal.remove();
  const form = modal.querySelector("[data-app-review-form]");
  const feedback = modal.querySelector("[data-app-review-feedback]");
  const textarea = modal.querySelector("[data-app-review-comment]");
  const countNode = modal.querySelector("[data-app-review-count]");

  modal.querySelector(".close-btn")?.addEventListener("click", closeModal);
  modal
    .querySelector("[data-app-review-cancel]")
    ?.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  syncAppReviewModalStars(modal, 0);

  modal.querySelectorAll("[data-app-review-rating]").forEach((button) => {
    button.addEventListener("click", () => {
      syncAppReviewModalStars(modal, button.dataset.appReviewRating || "0");
    });
  });

  if (textarea && countNode) {
    const syncCount = () => {
      countNode.textContent = `${String(textarea.value || "").length} / 1000`;
    };

    textarea.addEventListener("input", syncCount);
    syncCount();
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const reviewService = window.EduKidsAppReviewService;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalLabel = submitButton?.textContent || "Gửi đánh giá";
    const formData = new FormData(form);
    const rating = Number.parseInt(String(formData.get("rating") || "0"), 10);
    const comment = String(formData.get("comment") || "").trim();

    if (!Number.isFinite(rating) || rating < 1) {
      if (feedback) {
        feedback.textContent = "Vui lòng chọn số sao từ 1 đến 5.";
      }
      return;
    }

    if (!comment) {
      if (feedback) {
        feedback.textContent = "Vui lòng nhập nhận xét.";
      }
      return;
    }

    if (comment.length > 1000) {
      if (feedback) {
        feedback.textContent = "Nhận xét không được vượt quá 1000 ký tự.";
      }
      return;
    }

    try {
      if (feedback) {
        feedback.textContent = "Đang gửi đánh giá...";
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Đang gửi...";
      }

      if (!reviewService?.submitReview) {
        throw new Error("Dịch vụ đánh giá chưa sẵn sàng.");
      }

      await reviewService.submitReview({
        profile,
        rating,
        comment,
      });

      showToast("Đã gửi đánh giá thành công.", "success");
      closeModal();
      if (currentAdminPage === "admin-reviews") {
        void syncAdminReviews({ forceRefresh: true });
      }
    } catch (error) {
      if (feedback) {
        feedback.textContent = error?.message || "Không thể gửi đánh giá.";
      }
      showToast(error?.message || "Không thể gửi đánh giá.", "error");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalLabel;
      }
    }
  });
}

function openConfirmModal({
  title = "Xác nhận",
  message = "",
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
} = {}) {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "modal-overlay confirm-modal-overlay";
    modal.innerHTML = `
      <div class="modal confirm-modal">
        <div class="modal-header">
          <h3>${escapeHtml(title)}</h3>
          <button class="close-btn" type="button" aria-label="Đóng cửa sổ">×</button>
        </div>
        <div class="modal-content">
          <div class="confirm-modal-body">${escapeHtml(message)}</div>
          <div class="confirm-modal-actions">
            <button type="button" class="confirm-modal-cancel-btn">${escapeHtml(cancelLabel)}</button>
            <button type="button" class="confirm-modal-confirm-btn">${escapeHtml(confirmLabel)}</button>
          </div>
        </div>
      </div>
    `;

    const finish = (value) => {
      if (!modal.isConnected) {
        resolve(value);
        return;
      }

      modal.remove();
      resolve(value);
    };

    document.body.appendChild(modal);

    modal
      .querySelector(".close-btn")
      ?.addEventListener("click", () => finish(false));
    modal
      .querySelector(".confirm-modal-cancel-btn")
      ?.addEventListener("click", () => finish(false));
    modal
      .querySelector(".confirm-modal-confirm-btn")
      ?.addEventListener("click", () => finish(true));
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        finish(false);
      }
    });
  });
}

document.addEventListener("click", (event) => {
  const reviewButton = event.target.closest(
    ".student-profile-review-btn, .teacher-profile-review-btn",
  );

  if (reviewButton) {
    void openAppReviewModal();
    return;
  }

  const editButton = event.target.closest(
    ".student-profile-edit-btn, .teacher-profile-edit-btn",
  );

  if (!editButton) {
    return;
  }

  void openProfileEditModal();
});

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
  pendingTopicId: "",
};

const studentQuizScreenState = {
  screen: "subjects",
};

const bossBattleState = {
  sessionId: "",
  topicId: "",
  quizId: "",
  session: null,
  loadingSession: false,
  answering: false,
  currentQuestionIndex: 0,
  totalQuestions: 0,
  bossHP: 100,
  playerHP: 0,
  combo: 0,
  bossState: "idle",
  battleStatus: "idle",
  visualBossHP: 100,
  visualPlayerHP: 0,
  hintRemaining: 3,
  hintLoading: false,
  hiddenOptions: [],
  assetPreloading: false,
  answerPhase: "idle",
  selectedAnswer: "",
  selectedQuestionIndex: 0,
  revealedQuestion: null,
  revealedCorrectAnswer: "",
  revealedCorrect: null,
  terminalLocked: false,
};

const bossBattleReviewMode = {
  active: false,
  wrongQuestions: [],
  currentQuestionIndex: 0,
  selectedAnswer: "",
  answerPhase: "idle",
  locked: false,
  reviewedCount: 0,
  correctCount: 0,
  completedVisible: false,
  revealedQuestion: null,
  revealedCorrectAnswer: "",
  revealedCorrect: null,
  advanceTimerId: null,
};

const BOSS_BATTLE_BOSS_FRAME_COUNTS = {
  idle: 8,
  angry: 8,
  rage: 8,
  die: 8,
};

const bossBattleAnimationState = {
  timerId: null,
  currentState: "idle",
  currentFrame: 1,
  playOnce: false,
  frameDelay: 120,
  feedbackTimerId: null,
  petTimerId: null,
  comboTimerId: null,
  effectId: 0,
  frameRequestId: null,
};

const bossBattlePopupManager = {
  mode: "none",
  visible: false,
  lastStatus: "idle",
};

const bossBattleRewardPreview = {
  earnedXP: 0,
  earnedCoin: 0,
  comboBonusXP: 0,
  comboBonusCoin: 0,
  victoryBonusXP: 0,
  victoryBonusCoin: 0,
  rankStars: 0,
  rankBonusCoin: 0,
  accuracy: 0,
  rankLabel: "",
  active: false,
  lastBattleStatus: "idle",
  lastRankKey: "",
  lastRewardEventKey: "",
  baseXP: 0,
  baseCoin: 0,
};

const bossBattleRewardCounterState = {
  animationFrameId: null,
  startTime: 0,
  duration: 420,
  fromXP: 0,
  fromCoin: 0,
  toXP: 0,
  toCoin: 0,
  displayXP: 0,
  displayCoin: 0,
  pendingSync: false,
};

const bossBattleRewardSyncState = {
  sessionId: "",
  status: "idle",
  summary: null,
  promise: null,
};

const bossBattleAchievementPopupState = {
  visible: false,
  badges: [],
  title: "",
  description: "",
  timerId: null,
};

const BOSS_BATTLE_SOUND_PATHS = {
  correct: "/assets/game/sounds/correct.mp3",
  wrong: "/assets/game/sounds/wrong.mp3",
  reward: "/assets/game/sounds/reward.mp3",
  bossDie: "/assets/game/sounds/boss_die.mp3",
  click: "/assets/game/sounds/click.mp3",
};

const bossBattleAssetManagerState = {
  status: "idle",
  promise: null,
  imageCache: new Map(),
  audioCache: new Map(),
};

const BOSS_BATTLE_RECOVERY_STORAGE_KEY = "bossBattleRecoveryState";

let studentQuizControlsBound = false;

function getStudentQuizRoot() {
  return document.getElementById("subjects");
}

function getStudentQuizTopicGrid() {
  return document.getElementById("student-topic-grid");
}

function getStudentQuizScreen() {
  return document.getElementById("student-boss-battle-screen");
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

function setStudentQuizScreen(screen) {
  studentQuizScreenState.screen =
    screen === "bossBattle" ? "bossBattle" : "subjects";
}

function isStudentBossBattleScreenActive() {
  return studentQuizScreenState.screen === "bossBattle";
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

function getTopicAccuracySummary(topic) {
  return (
    window.EduKidsTopicAccuracyService?.normalizeTopicAccuracySummary(
      topic,
    ) || {
      totalAnswered: 0,
      totalCorrect: 0,
      percentage: 0,
    }
  );
}

function getTopicAccuracyProgressClass(percentage) {
  return (
    window.EduKidsTopicAccuracyService?.getTopicAccuracyProgressClass(
      percentage,
    ) || "is-red"
  );
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

const BOSS_BATTLE_OPTION_META = [
  { iconPath: getBossBattleAssetPath("icons", "icon_A.png"), tone: "blue" },
  { iconPath: getBossBattleAssetPath("icons", "icon_B.png"), tone: "gold" },
  { iconPath: getBossBattleAssetPath("icons", "icon_C.png"), tone: "green" },
  { iconPath: getBossBattleAssetPath("icons", "icon_D.png"), tone: "violet" },
];

function getBossBattleOptionMeta(index) {
  return BOSS_BATTLE_OPTION_META[index % BOSS_BATTLE_OPTION_META.length];
}

function getBossBattleCoins(profile) {
  return Math.max(0, Math.floor(Number(profile?.stats?.eduCoin || 0)));
}

function getBossBattleExp(profile) {
  return Math.max(0, Math.floor(Number(profile?.stats?.exp || 0)));
}

function getBossBattleHearts(answeredCount, totalQuestions) {
  const playerHP = Math.max(0, Number(answeredCount || 0));
  const total = Math.max(1, Number(totalQuestions || 0));
  return Math.min(total, Math.max(1, playerHP));
}

function getBossBattleQuestionStageIndex(totalQuestions, answeredCount) {
  const total = Math.max(1, Number(totalQuestions || 0));
  const answered = Math.max(0, Number(answeredCount || 0));
  return Math.min(total, Math.max(1, answered + 1));
}

function normalizeBossBattleStatus(value) {
  const normalized = normalizeQuizText(value).toLowerCase();
  return ["active", "victory", "defeat", "completed"].includes(normalized)
    ? normalized
    : "idle";
}

function isBossBattleTerminalStatus(value) {
  const normalized = normalizeBossBattleStatus(value);
  return (
    normalized === "victory" ||
    normalized === "defeat" ||
    normalized === "completed"
  );
}

function getBossBattleStateFromHP(hp) {
  const normalizedHP = Math.max(0, Math.floor(Number(hp) || 0));

  if (normalizedHP <= 0) {
    return "die";
  }

  if (normalizedHP <= 50) {
    return "rage";
  }

  if (normalizedHP <= 75) {
    return "angry";
  }

  return "idle";
}

function getBossBattleStatusLabel(status) {
  switch (normalizeBossBattleStatus(status)) {
    case "victory":
      return "Victory";
    case "defeat":
      return "Defeat";
    case "completed":
      return "Completed";
    case "active":
      return "Đang chiến đấu";
    default:
      return "Chưa khởi tạo";
  }
}

function getBossBattleCurrentPetState() {
  const petState = getPetModuleApi()?.store?.getState?.()?.pet || null;

  if (!petState || typeof petState !== "object") {
    return null;
  }

  const petType = normalizeQuizText(
    petState.petTypeId || petState.petType,
  ).toLowerCase();
  const petLevelValue = Number.parseInt(
    String(petState.level || petState.petLevel || "").replace(/[^\d]/g, ""),
    10,
  );
  const petLevel =
    Number.isFinite(petLevelValue) && petLevelValue > 0 ? petLevelValue : 0;

  if (!petType || !petLevel) {
    return null;
  }

  const petName = normalizeQuizText(
    petState.petName || petState.name || petType,
  );

  return {
    petType,
    petLevel,
    petName,
    imagePath: `assets/game/pets/${petType}/level_${petLevel}.png`,
  };
}

function getBossBattleAssetPath(...segments) {
  return `/assets/game/${segments.map((segment) => String(segment || "").trim()).join("/")}`;
}

function getBossBattleSoundPath(soundName) {
  const normalized = normalizeQuizText(soundName).toLowerCase();

  if (normalized === "correct") {
    return BOSS_BATTLE_SOUND_PATHS.correct;
  }

  if (normalized === "wrong") {
    return BOSS_BATTLE_SOUND_PATHS.wrong;
  }

  if (normalized === "reward") {
    return BOSS_BATTLE_SOUND_PATHS.reward;
  }

  if (normalized === "bossdie" || normalized === "boss_die") {
    return BOSS_BATTLE_SOUND_PATHS.bossDie;
  }

  if (normalized === "click") {
    return BOSS_BATTLE_SOUND_PATHS.click;
  }

  return BOSS_BATTLE_SOUND_PATHS.correct;
}

function getBossBattleImageAssetManifest() {
  const bossStates = ["idle", "angry", "rage", "die"];
  const manifest = [
    "/assets/game/background.png",
    getBossBattleAssetPath("icons", "icon_coin.png"),
    getBossBattleAssetPath("icons", "icon_continue.png"),
    getBossBattleAssetPath("icons", "icon_heart.png"),
    getBossBattleAssetPath("icons", "icon_hint.png"),
    getBossBattleAssetPath("icons", "icon_quit.png"),
    getBossBattleAssetPath("icons", "icon_restart.png"),
    getBossBattleAssetPath("icons", "icon_review.png"),
    getBossBattleAssetPath("icons", "icon_xp.png"),
    getBossBattleAssetPath("badges", "badge_achievement.png"),
    getBossBattleAssetPath("badges", "badge_boss_defeated.png"),
    getBossBattleAssetPath("badges", "badge_combo.png"),
    getBossBattleAssetPath("badges", "badge_perfect.png"),
    getBossBattleAssetPath("effects", "effect_sparkle.png"),
    getBossBattleAssetPath("effects", "effect_confetti.png"),
    getBossBattleAssetPath("effects", "effect_xp_burst.png"),
    getBossBattleAssetPath("effects", "effect_coin_burst.png"),
    getBossBattleAssetPath("hp", "boss_hp_fill.png"),
  ];

  bossStates.forEach((state) => {
    const frameCount = getBossBattleBossFrameCount(state);
    for (let frame = 1; frame <= frameCount; frame += 1) {
      manifest.push(getBossBattleAssetPath("boss", state, `${frame}.png`));
    }
  });

  ["elephant", "horse"].forEach((petType) => {
    [1, 10, 20, 30, 50].forEach((level) => {
      manifest.push(
        getBossBattleAssetPath("pets", petType, `level_${level}.png`),
      );
    });
  });

  return Array.from(new Set(manifest));
}

function getBossBattleAudioAssetManifest() {
  return [
    BOSS_BATTLE_SOUND_PATHS.correct,
    BOSS_BATTLE_SOUND_PATHS.wrong,
    BOSS_BATTLE_SOUND_PATHS.reward,
    BOSS_BATTLE_SOUND_PATHS.bossDie,
    BOSS_BATTLE_SOUND_PATHS.click,
  ].filter(Boolean);
}

function preloadBossBattleImage(path) {
  const normalizedPath = normalizeQuizText(path);

  if (!normalizedPath) {
    return Promise.resolve(null);
  }

  if (bossBattleAssetManagerState.imageCache.has(normalizedPath)) {
    return bossBattleAssetManagerState.imageCache.get(normalizedPath);
  }

  const promise = new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(image);
    image.src = normalizedPath;
  });

  bossBattleAssetManagerState.imageCache.set(normalizedPath, promise);
  return promise;
}

function preloadBossBattleAudio(path) {
  const normalizedPath = normalizeQuizText(path);

  if (!normalizedPath) {
    return Promise.resolve(null);
  }

  if (bossBattleAssetManagerState.audioCache.has(normalizedPath)) {
    return bossBattleAssetManagerState.audioCache.get(normalizedPath);
  }

  const audio = new Audio(normalizedPath);
  audio.preload = "auto";
  const promise = new Promise((resolve) => {
    const done = () => resolve(audio);
    audio.addEventListener("canplaythrough", done, { once: true });
    audio.addEventListener("loadeddata", done, { once: true });
    audio.addEventListener("error", done, { once: true });
    audio.load();
  });

  bossBattleAssetManagerState.audioCache.set(normalizedPath, promise);
  return promise;
}

async function ensureBossBattleAssetsPreloaded() {
  if (
    bossBattleAssetManagerState.status === "ready" &&
    bossBattleAssetManagerState.promise
  ) {
    return bossBattleAssetManagerState.promise;
  }

  if (
    bossBattleAssetManagerState.status === "loading" &&
    bossBattleAssetManagerState.promise
  ) {
    return bossBattleAssetManagerState.promise;
  }

  bossBattleAssetManagerState.status = "loading";
  bossBattleAssetManagerState.promise = (async () => {
    const imagePaths = getBossBattleImageAssetManifest();
    const audioPaths = getBossBattleAudioAssetManifest();

    await Promise.all([
      ...imagePaths.map((path) => preloadBossBattleImage(path)),
      ...audioPaths.map((path) => preloadBossBattleAudio(path)),
    ]);

    bossBattleAssetManagerState.status = "ready";
    return true;
  })().catch((error) => {
    bossBattleAssetManagerState.status = "error";
    throw error;
  });

  return bossBattleAssetManagerState.promise;
}

function stopBossBattleAudio() {
  bossBattleAssetManagerState.audioCache.forEach((entry) => {
    Promise.resolve(entry)
      .then((audio) => {
        if (!audio) {
          return;
        }

        audio.pause();
        audio.currentTime = 0;
      })
      .catch(() => {});
  });
}

function playBossBattleSound(soundName) {
  const path = getBossBattleSoundPath(soundName);
  const cached = bossBattleAssetManagerState.audioCache.get(path);

  const handleAudio = (audio) => {
    if (!audio) {
      return;
    }

    try {
      audio.currentTime = 0;
    } catch (_) {
      /* noop */
    }

    void audio.play().catch(() => {});
  };

  if (cached) {
    Promise.resolve(cached)
      .then(handleAudio)
      .catch(() => {});
    return;
  }

  const audio = new Audio(path);
  audio.preload = "auto";
  bossBattleAssetManagerState.audioCache.set(path, Promise.resolve(audio));
  handleAudio(audio);
}

function playCorrect() {
  playBossBattleSound("correct");
}

function playWrong() {
  playBossBattleSound("wrong");
}

function playReward() {
  playBossBattleSound("reward");
}

function playBossDie() {
  playBossBattleSound("boss_die");
}

function playClick() {
  playBossBattleSound("click");
}

function getBossBattleBossImagePath(state) {
  const normalizedState = normalizeQuizText(state).toLowerCase();
  const allowedState = ["idle", "angry", "rage", "die"].includes(
    normalizedState,
  )
    ? normalizedState
    : "idle";
  const frame = allowedState === "die" ? 8 : 1;
  return getBossBattleAssetPath("boss", allowedState, `${frame}.png`);
}

function getBossBattleBossFrameCount(state) {
  const normalizedState = normalizeQuizText(state).toLowerCase();
  return BOSS_BATTLE_BOSS_FRAME_COUNTS[normalizedState] || 7;
}

function getBossBattleBossFramePath(state, frameIndex) {
  const normalizedState = normalizeQuizText(state).toLowerCase();
  const frameCount = getBossBattleBossFrameCount(normalizedState);
  const frame = Math.max(
    1,
    Math.min(frameCount, Math.floor(Number(frameIndex) || 1)),
  );
  return getBossBattleAssetPath(
    "boss",
    normalizedState || "idle",
    `${frame}.png`,
  );
}

function getBossBattleStateFromBossHP(hp) {
  return getBossBattleStateFromHP(hp);
}

function isBossBattleSceneMounted() {
  return Boolean(getStudentQuizScreen()?.querySelector(".boss-battle-panel"));
}

function clearBossBattleAnimationTimers() {
  if (bossBattleAnimationState.timerId) {
    clearInterval(bossBattleAnimationState.timerId);
    bossBattleAnimationState.timerId = null;
  }

  if (bossBattleAnimationState.frameRequestId) {
    cancelAnimationFrame(bossBattleAnimationState.frameRequestId);
    bossBattleAnimationState.frameRequestId = null;
  }

  if (bossBattleAnimationState.feedbackTimerId) {
    clearTimeout(bossBattleAnimationState.feedbackTimerId);
    bossBattleAnimationState.feedbackTimerId = null;
  }

  if (bossBattleAnimationState.petTimerId) {
    clearTimeout(bossBattleAnimationState.petTimerId);
    bossBattleAnimationState.petTimerId = null;
  }

  if (bossBattleAnimationState.comboTimerId) {
    clearTimeout(bossBattleAnimationState.comboTimerId);
    bossBattleAnimationState.comboTimerId = null;
  }
}

function ensureBossBattleAnimationLoop() {
  if (bossBattleAnimationState.timerId) {
    return;
  }

  bossBattleAnimationState.timerId = setInterval(() => {
    if (!isBossBattleSceneMounted()) {
      clearBossBattleAnimationTimers();
      return;
    }

    syncBossBattleBossAnimation();
  }, bossBattleAnimationState.frameDelay);
}

function getBossBattleAnimationTargets() {
  const screen = getStudentQuizScreen();

  if (!screen) {
    return [];
  }

  return Array.from(screen.querySelectorAll("[data-boss-anim]"));
}

function getBossBattleCurrentAnimationState() {
  return getBossBattleStateFromBossHP(bossBattleState.bossHP);
}

function syncBossBattleBossAnimation(forceReset = false) {
  const nextState = getBossBattleCurrentAnimationState();
  const previousState = bossBattleAnimationState.currentState;
  const stateChanged = forceReset || nextState !== previousState;

  if (stateChanged) {
    bossBattleAnimationState.currentState = nextState;
    bossBattleAnimationState.currentFrame = 1;
    bossBattleAnimationState.playOnce = nextState === "die";
  }

  const frameCount = getBossBattleBossFrameCount(nextState);
  const shouldStopAfterDie =
    bossBattleAnimationState.playOnce &&
    nextState === "die" &&
    bossBattleAnimationState.currentFrame >= frameCount;
  const nextFrame = shouldStopAfterDie
    ? frameCount
    : bossBattleAnimationState.currentFrame;
  const framePath = getBossBattleBossFramePath(nextState, nextFrame);

  getBossBattleAnimationTargets().forEach((target) => {
    if (target instanceof HTMLImageElement) {
      target.src = framePath;
      target.dataset.bossAnimState = nextState;
      target.dataset.bossAnimFrame = String(nextFrame);
    }
  });

  if (!bossBattleAnimationState.playOnce || nextState !== "die") {
    bossBattleAnimationState.currentFrame =
      nextFrame >= frameCount ? 1 : nextFrame + 1;
  }
}

function syncBossBattleHPVisuals() {
  const screen = getStudentQuizScreen();

  if (!screen) {
    return;
  }

  const bossFill = screen.querySelector(".boss-battle-header-card__track-fill");
  const bossHP = Math.max(
    0,
    Math.min(100, Number(bossBattleState.bossHP) || 0),
  );

  if (bossFill) {
    bossFill.style.width = `${bossHP}%`;
  }

  bossBattleState.visualBossHP = bossHP;
}

function setBossBattleEffect(type, duration = 420) {
  const screen = getStudentQuizScreen();

  if (!screen) {
    return;
  }

  const effectLayer = screen.querySelector(".boss-battle-effects");

  if (!effectLayer) {
    return;
  }

  const effectId = ++bossBattleAnimationState.effectId;
  const effect = document.createElement("span");
  effect.className = `boss-battle-effect boss-battle-effect--${type}`;
  effectLayer.appendChild(effect);

  window.setTimeout(() => {
    if (effectId !== bossBattleAnimationState.effectId) {
      return;
    }

    effect.remove();
  }, duration);
}

function triggerBossBattleFeedback(type) {
  const screen = getStudentQuizScreen();

  if (!screen) {
    return;
  }

  const bossCard = screen.querySelector(".boss-battle-header-card__boss");
  const bossImage = screen.querySelector(
    ".boss-battle-header-card__boss-image",
  );
  const petCard = screen.querySelector(".boss-battle-sidebar__pet");
  const petImage = screen.querySelector(".boss-battle-sidebar__pet-image");
  const comboCard = screen.querySelector(".boss-battle-sidebar__metric--combo");

  const addClass = (node, className) => {
    if (!node) {
      return;
    }

    node.classList.remove(
      "is-boss-hit",
      "is-boss-flicker",
      "is-pet-bounce",
      "is-pet-shake",
      "is-pet-celebrate",
      "is-combo-glow",
      "is-combo-strong",
    );
    node.classList.add(className);
  };

  const clearClasses = () => {
    [bossCard, bossImage, petCard, petImage, comboCard].forEach((node) => {
      if (!node) {
        return;
      }

      node.classList.remove(
        "is-boss-hit",
        "is-boss-flicker",
        "is-pet-bounce",
        "is-pet-shake",
        "is-pet-celebrate",
      );
    });
  };

  clearTimeout(bossBattleAnimationState.feedbackTimerId);
  clearTimeout(bossBattleAnimationState.petTimerId);
  clearTimeout(bossBattleAnimationState.comboTimerId);

  if (type === "correct") {
    addClass(bossCard, "is-boss-hit");
    addClass(bossImage, "is-boss-flicker");
    addClass(petCard, "is-pet-bounce");
    addClass(petImage, "is-pet-bounce");
    setBossBattleEffect("sparkle", 450);
  } else if (type === "wrong") {
    addClass(petCard, "is-pet-shake");
    addClass(petImage, "is-pet-shake");
  } else if (type === "victory") {
    addClass(petCard, "is-pet-celebrate");
    addClass(petImage, "is-pet-celebrate");
    setBossBattleEffect("confetti", 900);
  }

  const comboValue = Math.max(0, Number(bossBattleState.combo) || 0);
  if (comboValue >= 5) {
    addClass(comboCard, "is-combo-strong");
    setBossBattleEffect("xp", 500);
  } else if (comboValue >= 3) {
    addClass(comboCard, "is-combo-glow");
    setBossBattleEffect("coin", 450);
  }

  bossBattleAnimationState.feedbackTimerId = window.setTimeout(
    () => {
      clearClasses();
    },
    type === "wrong" ? 420 : 540,
  );

  if (type === "victory") {
    bossBattleAnimationState.petTimerId = window.setTimeout(() => {
      clearClasses();
    }, 1200);
  }
}

function syncBossBattleVisualLayer() {
  if (!isBossBattleSceneMounted()) {
    return;
  }

  syncBossBattleBossAnimation();
  syncBossBattleHPVisuals();
}

function refreshBossBattleVisualLayer() {
  if (!isBossBattleSceneMounted()) {
    return;
  }

  ensureBossBattleAnimationLoop();
  bossBattleAnimationState.frameRequestId = requestAnimationFrame(() => {
    bossBattleAnimationState.frameRequestId = null;
    syncBossBattleVisualLayer();
  });
}

function getBossBattleIconPath(iconName) {
  return getBossBattleAssetPath("icons", `icon_${iconName}.png`);
}

function getBossBattleBadgePath(badgeName) {
  const normalized = normalizeQuizText(badgeName).toLowerCase();

  if (normalized === "combo") {
    return getBossBattleAssetPath("badges", "badge_combo.png");
  }

  if (normalized === "victory") {
    return getBossBattleAssetPath("badges", "badge_boss_defeated.png");
  }

  if (normalized === "perfect") {
    return getBossBattleAssetPath("badges", "badge_perfect.png");
  }

  return getBossBattleAssetPath("badges", "badge_achievement.png");
}

function getBossBattleAchievementBadgeMeta(badgeId) {
  const normalized = normalizeQuizText(badgeId);

  if (normalized === "badge_boss_defeated") {
    return {
      id: normalized,
      title: "BOSS_DEFEATED",
      name: "BOSS DEFEATED",
      description: "Đánh bại Boss trong Boss Battle",
      image: getBossBattleBadgePath("victory"),
    };
  }

  if (normalized === "badge_combo") {
    return {
      id: normalized,
      title: "COMBO_MASTER",
      name: "COMBO MASTER",
      description: "Đạt combo 5 trở lên trong một trận",
      image: getBossBattleBadgePath("combo"),
    };
  }

  if (normalized === "badge_perfect") {
    return {
      id: normalized,
      title: "PERFECT_BATTLE",
      name: "PERFECT BATTLE",
      description: "Hoàn thành trận với độ chính xác 100%",
      image: getBossBattleBadgePath("perfect"),
    };
  }

  if (normalized === "badge_achievement") {
    return {
      id: normalized,
      title: "FIRST_BATTLE",
      name: "FIRST BATTLE",
      description: "Hoàn thành Boss Battle đầu tiên",
      image: getBossBattleBadgePath("achievement"),
    };
  }

  return null;
}

function getBossBattleAchievementBadgeList(sourceBadges = []) {
  return Array.isArray(sourceBadges)
    ? sourceBadges
        .map((badgeId) => getBossBattleAchievementBadgeMeta(badgeId))
        .filter(Boolean)
    : [];
}

function mergeBossBattleAchievementBadgesIntoProfile(profile, badges = []) {
  const normalizedProfile =
    profile && typeof profile === "object" ? { ...profile } : {};
  const currentRewards =
    normalizedProfile.rewards && typeof normalizedProfile.rewards === "object"
      ? { ...normalizedProfile.rewards }
      : {};
  const currentBadges = Array.isArray(currentRewards.badges)
    ? currentRewards.badges
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];
  const mergedBadges = Array.from(
    new Set([
      ...currentBadges,
      ...badges.map((item) => String(item || "").trim()).filter(Boolean),
    ]),
  );

  normalizedProfile.rewards = {
    ...currentRewards,
    badges: mergedBadges,
  };

  return normalizedProfile;
}

function getBossBattleRecoveryStorageKey() {
  const currentUser = getCurrentAuthUser();
  const userId = normalizeQuizText(
    currentUser?.uid || currentUser?.userId || currentUser?.id || "",
  );

  return userId
    ? `${BOSS_BATTLE_RECOVERY_STORAGE_KEY}:${userId}`
    : BOSS_BATTLE_RECOVERY_STORAGE_KEY;
}

function getBossBattleRecoveryStorageState() {
  try {
    const raw = localStorage.getItem(getBossBattleRecoveryStorageKey());
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const sessionId = normalizeQuizText(parsed.sessionId);
    const topicId = normalizeQuizText(parsed.topicId);
    const quizId = normalizeQuizText(parsed.quizId);
    const battleStatus = normalizeBossBattleStatus(parsed.battleStatus);

    if (!sessionId || !topicId || !quizId) {
      return null;
    }

    return {
      sessionId,
      topicId,
      quizId,
      battleStatus,
      updatedAt: String(parsed.updatedAt || ""),
    };
  } catch (error) {
    return null;
  }
}

function saveBossBattleRecoveryStorageState(session = {}) {
  const sessionId = normalizeQuizText(session.sessionId || session.id || "");
  const topicId = normalizeQuizText(session.topicId || "");
  const quizId = normalizeQuizText(session.quizId || "");
  const battleStatus = normalizeBossBattleStatus(
    session.battleStatus || session.status || "active",
  );

  if (!sessionId || !topicId || !quizId) {
    return;
  }

  try {
    localStorage.setItem(
      getBossBattleRecoveryStorageKey(),
      JSON.stringify({
        sessionId,
        topicId,
        quizId,
        battleStatus,
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch (error) {
    /* noop */
  }
}

function clearBossBattleRecoveryStorageState() {
  try {
    localStorage.removeItem(getBossBattleRecoveryStorageKey());
  } catch (error) {
    /* noop */
  }
}

async function restoreBossBattleSessionFromStorage(quizData = null) {
  const recoveryState = getBossBattleRecoveryStorageState();

  if (!recoveryState) {
    return false;
  }

  const currentTopicId = normalizeQuizText(
    studentQuizState.selectedTopicId || quizData?.topicId || "",
  );
  const currentQuizId = normalizeQuizText(
    quizData?.quizId || quizData?.id || "",
  );

  if (currentTopicId && recoveryState.topicId !== currentTopicId) {
    return false;
  }

  if (currentQuizId && recoveryState.quizId !== currentQuizId) {
    return false;
  }

  try {
    const response = await apiRequestWithAuth(
      `/api/battle-sessions/${encodeURIComponent(recoveryState.sessionId)}`,
      { method: "GET" },
    );

    const session = response.data || response.session || null;

    if (
      !session ||
      normalizeQuizText(session.sessionId || session.id || "") !==
        recoveryState.sessionId
    ) {
      return false;
    }

    applyBossBattleSessionResponse({
      ...session,
      session,
    });

    if (normalizeBossBattleStatus(session.status) === "active") {
      initializeBossBattleRewardPreview();
    }

    return true;
  } catch (error) {
    return false;
  }
}

function getBossBattleRewardRankPreview(accuracy, totalQuestions = 0) {
  const normalizedAccuracy = Math.max(
    0,
    Math.min(100, Math.floor(Number(accuracy) || 0)),
  );
  const normalizedTotalQuestions = Math.max(0, Number(totalQuestions) || 0);

  if (normalizedTotalQuestions <= 0) {
    return {
      stars: 0,
      bonusCoin: 0,
      label: "Chưa xếp hạng",
    };
  }

  if (normalizedAccuracy >= 90) {
    return {
      stars: 3,
      bonusCoin: 100,
      label: "3 Sao",
    };
  }

  if (normalizedAccuracy >= 70) {
    return {
      stars: 2,
      bonusCoin: 50,
      label: "2 Sao",
    };
  }

  return {
    stars: 1,
    bonusCoin: 20,
    label: "1 Sao",
  };
}

function getBossBattleSessionSummary() {
  const answers = Array.isArray(bossBattleState.session?.answers)
    ? bossBattleState.session.answers
    : [];
  const answeredCount = answers.length;
  const correctCount = answers.filter(
    (item) => item && item.correct === true,
  ).length;
  const wrongCount = Math.max(0, answeredCount - correctCount);
  const maxCombo = answers.reduce((highest, item) => {
    const value = Math.max(0, Number(item?.combo) || 0);
    return Math.max(highest, value);
  }, 0);
  const totalQuestions = Math.max(
    1,
    Number(bossBattleState.totalQuestions) || 0,
  );
  const score = Math.max(
    0,
    Math.min(100, Math.round((correctCount / totalQuestions) * 100)),
  );

  return {
    answeredCount,
    correctCount,
    wrongCount,
    maxCombo,
    score,
  };
}

function getBossBattleRewardPreviewSummary() {
  const sessionSummary = getBossBattleSessionSummary();
  const totalQuestions = Math.max(
    0,
    Number(bossBattleState.totalQuestions) || 0,
  );
  const rankPreview = getBossBattleRewardRankPreview(
    sessionSummary.score,
    totalQuestions,
  );
  const isFinalBattle =
    normalizeBossBattleStatus(bossBattleState.battleStatus) === "victory" ||
    normalizeBossBattleStatus(bossBattleState.battleStatus) === "completed";
  const previewXP =
    Number(bossBattleRewardPreview.earnedXP || 0) +
    Number(bossBattleRewardPreview.comboBonusXP || 0) +
    Number(bossBattleRewardPreview.victoryBonusXP || 0);
  const previewCoin =
    Number(bossBattleRewardPreview.earnedCoin || 0) +
    Number(bossBattleRewardPreview.comboBonusCoin || 0) +
    Number(bossBattleRewardPreview.victoryBonusCoin || 0) +
    (isFinalBattle ? Number(rankPreview.bonusCoin || 0) : 0);
  const totalXP = Math.max(
    0,
    Number(bossBattleRewardPreview.baseXP || 0) + previewXP,
  );
  const totalCoin = Math.max(
    0,
    Number(bossBattleRewardPreview.baseCoin || 0) + previewCoin,
  );

  return {
    ...sessionSummary,
    score: sessionSummary.score,
    accuracy: sessionSummary.score,
    correctAnswers: sessionSummary.correctCount,
    totalQuestions,
    xpAwarded: previewXP,
    coinAwarded: previewCoin,
    rankStars: rankPreview.stars,
    rank: rankPreview.label,
    rankLabel: rankPreview.label,
    rankBonusCoin: isFinalBattle ? rankPreview.bonusCoin : 0,
    victory:
      normalizeBossBattleStatus(bossBattleState.battleStatus) === "victory",
    totalXP,
    totalCoin,
    rewardXP: totalXP,
    rewardCoin: totalCoin,
    totalRewardXP: totalXP,
    totalRewardCoin: totalCoin,
  };
}

function normalizeBossBattleRewardSummary(summary = {}) {
  const normalized = {
    score: Math.max(
      0,
      Math.min(
        100,
        Math.floor(Number(summary?.score ?? summary?.accuracy) || 0),
      ),
    ),
    accuracy: Math.max(
      0,
      Math.min(
        100,
        Math.floor(Number(summary?.accuracy ?? summary?.score) || 0),
      ),
    ),
    correctAnswers: Math.max(
      0,
      Math.floor(Number(summary?.correctAnswers ?? summary?.correctCount) || 0),
    ),
    correctCount: Math.max(
      0,
      Math.floor(Number(summary?.correctCount ?? summary?.correctAnswers) || 0),
    ),
    totalQuestions: Math.max(
      0,
      Math.floor(Number(summary?.totalQuestions) || 0),
    ),
    xpAwarded: Math.max(0, Math.floor(Number(summary?.xpAwarded) || 0)),
    coinAwarded: Math.max(0, Math.floor(Number(summary?.coinAwarded) || 0)),
    rankStars: Math.max(0, Math.floor(Number(summary?.rankStars) || 0)),
    rank: normalizeQuizText(summary?.rank || summary?.rankLabel || ""),
    rankLabel: normalizeQuizText(summary?.rankLabel || summary?.rank || ""),
    rankBonusCoin: Math.max(0, Math.floor(Number(summary?.rankBonusCoin) || 0)),
    victory: Boolean(summary?.victory),
    maxCombo: Math.max(0, Math.floor(Number(summary?.maxCombo) || 0)),
    totalXP: Math.max(
      0,
      Math.floor(Number(summary?.totalXP ?? summary?.rewardXP) || 0),
    ),
    totalCoin: Math.max(
      0,
      Math.floor(Number(summary?.totalCoin ?? summary?.rewardCoin) || 0),
    ),
  };

  normalized.rewardXP = normalized.totalXP;
  normalized.rewardCoin = normalized.totalCoin;
  normalized.totalRewardXP = normalized.totalXP;
  normalized.totalRewardCoin = normalized.totalCoin;

  if (!normalized.rank) {
    normalized.rank =
      normalized.rankLabel ||
      (normalized.rankStars >= 3
        ? "3 Sao"
        : normalized.rankStars === 2
          ? "2 Sao"
          : normalized.rankStars === 1
            ? "1 Sao"
            : "");
  }

  if (!normalized.rankLabel) {
    normalized.rankLabel = normalized.rank;
  }

  return normalized;
}

function getBossBattleRewardDisplaySummary() {
  if (bossBattleRewardSyncState.summary) {
    return normalizeBossBattleRewardSummary(bossBattleRewardSyncState.summary);
  }

  return normalizeBossBattleRewardSummary(getBossBattleRewardPreviewSummary());
}

async function syncBossBattleRewardWithBackend() {
  const sessionId = normalizeQuizText(bossBattleState.sessionId);
  const battleStatus = normalizeBossBattleStatus(bossBattleState.battleStatus);

  if (
    !sessionId ||
    (battleStatus !== "victory" && battleStatus !== "completed")
  ) {
    return null;
  }

  if (
    bossBattleRewardSyncState.sessionId === sessionId &&
    bossBattleRewardSyncState.status === "synced" &&
    bossBattleRewardSyncState.summary
  ) {
    return bossBattleRewardSyncState.summary;
  }

  if (
    bossBattleRewardSyncState.sessionId === sessionId &&
    bossBattleRewardSyncState.status === "loading" &&
    bossBattleRewardSyncState.promise
  ) {
    return bossBattleRewardSyncState.promise;
  }

  bossBattleRewardSyncState.sessionId = sessionId;
  bossBattleRewardSyncState.status = "loading";
  bossBattleRewardSyncState.promise = (async () => {
    const response = await apiRequestWithAuth(
      `/api/battle-sessions/${encodeURIComponent(sessionId)}/complete`,
      {
        method: "POST",
      },
    );

    const backendSummary = normalizeBossBattleRewardSummary(
      response.data?.rewardSummary || {},
    );
    const unlockedAchievements = getBossBattleAchievementBadgeList(
      Array.isArray(response.data?.achievements?.unlocked)
        ? response.data.achievements.unlocked.map(
            (item) => item?.badgeId || item?.id,
          )
        : [],
    );
    const session = response.data?.session || null;
    const summary = {
      ...backendSummary,
      rewardXP: backendSummary.totalXP,
      rewardCoin: backendSummary.totalCoin,
      totalRewardXP: backendSummary.totalXP,
      totalRewardCoin: backendSummary.totalCoin,
    };

    bossBattleRewardSyncState.summary = summary;
    bossBattleRewardSyncState.status = "synced";
    bossBattleRewardSyncState.promise = null;

    if (session) {
      bossBattleState.session = session;
      bossBattleState.sessionId = normalizeQuizText(
        session.sessionId || session.id || sessionId,
      );
      bossBattleState.battleStatus = normalizeBossBattleStatus(
        session.status || bossBattleState.battleStatus,
      );
    }

    if (unlockedAchievements.length > 0) {
      const updatedProfile = mergeBossBattleAchievementBadgesIntoProfile(
        getCurrentAuthUser(),
        unlockedAchievements.map((item) => item.badgeId || item.id),
      );
      applyLatestCurrentUser(updatedProfile);
      void syncStudentAchievementBadges(updatedProfile);
    }

    try {
      const refreshedProfile = window.EduKidsProfileService?.fetchCurrentProfile
        ? await window.EduKidsProfileService.fetchCurrentProfile()
        : null;

      if (refreshedProfile) {
        applyLatestCurrentUser(refreshedProfile);
        syncPetWalletFromProfile(refreshedProfile);
      } else {
        syncPetWalletFromProfile(getCurrentAuthUser());
      }
    } catch (error) {
      console.warn(
        "Không thể refresh profile sau khi nhận reward Boss Battle:",
        error,
      );
      syncPetWalletFromProfile(getCurrentAuthUser());
    }

    bossBattleRewardPreview.earnedXP = summary.xpAwarded;
    bossBattleRewardPreview.earnedCoin = summary.coinAwarded;
    bossBattleRewardPreview.comboBonusXP = 0;
    bossBattleRewardPreview.comboBonusCoin = 0;
    bossBattleRewardPreview.victoryBonusXP = 0;
    bossBattleRewardPreview.victoryBonusCoin = 0;
    bossBattleRewardPreview.rankStars = summary.rankStars;
    bossBattleRewardPreview.rankBonusCoin = summary.rankBonusCoin;
    bossBattleRewardPreview.accuracy = summary.accuracy;
    bossBattleRewardPreview.rankLabel = summary.rankLabel || summary.rank;

    const baseXP =
      bossBattleRewardPreview.baseXP || getBossBattleExp(getCurrentAuthUser());
    const baseCoin =
      bossBattleRewardPreview.baseCoin ||
      getBossBattleCoins(getCurrentAuthUser());
    const totalXP = Math.max(0, baseXP + summary.xpAwarded);
    const totalCoin = Math.max(0, baseCoin + summary.coinAwarded);

    renderStudentQuizFlow();

    queueMicrotask(() => {
      requestAnimationFrame(() => {
        animateBossBattleRewardCounters(totalXP, totalCoin, 380);
        setBossBattleEffect("confetti", 900);
        spawnBossBattleFloatingReward(`+${summary.xpAwarded} XP`, "xp");
        spawnBossBattleFloatingReward(`+${summary.coinAwarded} Coin`, "coin");
        spawnBossBattleRewardBadge(summary.victory ? "victory" : "combo");
        playBossBattleRewardSoundOnce(
          `${sessionId}:${bossBattleState.currentQuestionIndex}:${summary.victory ? "victory" : "completed"}:${summary.rankStars}:${summary.rankBonusCoin}`,
        );
        if (unlockedAchievements.length > 0) {
          showBossBattleAchievementPopup(unlockedAchievements);
        }
      });
    });

    return summary;
  })().catch((error) => {
    bossBattleRewardSyncState.status = "error";
    bossBattleRewardSyncState.promise = null;
    throw error;
  });

  return bossBattleRewardSyncState.promise;
}

function clearBossBattleRewardCounterAnimation() {
  if (bossBattleRewardCounterState.animationFrameId) {
    cancelAnimationFrame(bossBattleRewardCounterState.animationFrameId);
    bossBattleRewardCounterState.animationFrameId = null;
  }
}

function syncBossBattleRewardCounterNodes() {
  const screen = getStudentQuizScreen();

  if (!screen) {
    return;
  }

  const xpNodes = screen.querySelectorAll("[data-boss-reward-xp-counter]");
  const coinNodes = screen.querySelectorAll("[data-boss-reward-coin-counter]");
  const xpValue = Math.max(
    0,
    Math.round(Number(bossBattleRewardCounterState.displayXP) || 0),
  );
  const coinValue = Math.max(
    0,
    Math.round(Number(bossBattleRewardCounterState.displayCoin) || 0),
  );

  xpNodes.forEach((node) => {
    node.textContent = String(xpValue);
  });

  coinNodes.forEach((node) => {
    node.textContent = String(coinValue);
  });
}

function animateBossBattleRewardCounters(targetXP, targetCoin, duration = 420) {
  clearBossBattleRewardCounterAnimation();

  const fromXP = Number.isFinite(Number(bossBattleRewardCounterState.displayXP))
    ? Number(bossBattleRewardCounterState.displayXP)
    : 0;
  const fromCoin = Number.isFinite(
    Number(bossBattleRewardCounterState.displayCoin),
  )
    ? Number(bossBattleRewardCounterState.displayCoin)
    : 0;
  const toXP = Math.max(0, Math.round(Number(targetXP) || 0));
  const toCoin = Math.max(0, Math.round(Number(targetCoin) || 0));

  bossBattleRewardCounterState.fromXP = fromXP;
  bossBattleRewardCounterState.fromCoin = fromCoin;
  bossBattleRewardCounterState.toXP = toXP;
  bossBattleRewardCounterState.toCoin = toCoin;
  bossBattleRewardCounterState.startTime = performance.now();
  bossBattleRewardCounterState.duration = Math.max(
    120,
    Number(duration) || 420,
  );

  const tick = (now) => {
    const elapsed = Math.max(0, now - bossBattleRewardCounterState.startTime);
    const progress = Math.max(
      0,
      Math.min(1, elapsed / bossBattleRewardCounterState.duration),
    );
    const eased = 1 - Math.pow(1 - progress, 3);

    bossBattleRewardCounterState.displayXP =
      bossBattleRewardCounterState.fromXP +
      (bossBattleRewardCounterState.toXP -
        bossBattleRewardCounterState.fromXP) *
        eased;
    bossBattleRewardCounterState.displayCoin =
      bossBattleRewardCounterState.fromCoin +
      (bossBattleRewardCounterState.toCoin -
        bossBattleRewardCounterState.fromCoin) *
        eased;
    syncBossBattleRewardCounterNodes();

    if (progress < 1) {
      bossBattleRewardCounterState.animationFrameId =
        requestAnimationFrame(tick);
      return;
    }

    bossBattleRewardCounterState.displayXP = bossBattleRewardCounterState.toXP;
    bossBattleRewardCounterState.displayCoin =
      bossBattleRewardCounterState.toCoin;
    bossBattleRewardCounterState.animationFrameId = null;
    syncBossBattleRewardCounterNodes();
  };

  bossBattleRewardCounterState.animationFrameId = requestAnimationFrame(tick);
}

function playBossBattleRewardSound() {
  playReward();
}

function playBossBattleRewardSoundOnce(rewardKey = "") {
  const normalizedRewardKey = normalizeQuizText(rewardKey);

  if (!normalizedRewardKey) {
    playBossBattleRewardSound();
    return;
  }

  if (bossBattleRewardPreview.lastRewardEventKey === normalizedRewardKey) {
    return;
  }

  bossBattleRewardPreview.lastRewardEventKey = normalizedRewardKey;
  playBossBattleRewardSound();
}

function spawnBossBattleFloatingReward(text, kind = "xp") {
  const screen = getStudentQuizScreen();

  if (!screen) {
    return;
  }

  const effectLayer = screen.querySelector(".boss-battle-effects");

  if (!effectLayer) {
    return;
  }

  const node = document.createElement("span");
  node.className = `boss-battle-float-reward boss-battle-float-reward--${kind}`;
  node.textContent = text;
  node.style.left = `${Math.max(12, Math.min(88, 18 + Math.random() * 58))}%`;
  node.style.top = `${Math.max(12, Math.min(84, 18 + Math.random() * 46))}%`;
  effectLayer.appendChild(node);

  window.setTimeout(() => {
    node.remove();
  }, 900);
}

function spawnBossBattleRewardBadge(kind = "combo") {
  const screen = getStudentQuizScreen();

  if (!screen) {
    return;
  }

  const effectLayer = screen.querySelector(".boss-battle-effects");

  if (!effectLayer) {
    return;
  }

  const badge = document.createElement("div");
  badge.className = `boss-battle-badge-float boss-battle-badge-float--${normalizeQuizText(kind).toLowerCase()}`;
  badge.innerHTML = `
    <img src="${escapeHtml(getBossBattleBadgePath(kind))}" alt="" aria-hidden="true" />
  `;
  effectLayer.appendChild(badge);

  window.setTimeout(() => {
    badge.remove();
  }, 1100);
}

function getBossBattleRewardFloatingXPText(value) {
  const xpValue = Math.max(0, Math.round(Number(value) || 0));
  return `+${xpValue} XP`;
}

function getBossBattleRewardFloatingCoinText(value) {
  const coinValue = Math.max(0, Math.round(Number(value) || 0));
  return `+${coinValue} Coin`;
}

function getBossBattlePopupMode(status, bossHP = bossBattleState.bossHP) {
  const normalizedStatus = normalizeBossBattleStatus(status);
  const normalizedBossHP = Math.max(0, Math.floor(Number(bossHP) || 0));

  if (normalizedStatus === "victory") {
    return "victory";
  }

  if (normalizedStatus === "defeat") {
    return "defeat";
  }

  if (normalizedStatus === "completed" && normalizedBossHP > 0) {
    return "completed";
  }

  return "none";
}

function getBossBattleHintCountLabel(value) {
  const hintCount = Math.max(0, Math.floor(Number(value) || 0));
  return `Hint x${hintCount}`;
}

function getBossBattleHiddenOptionSet() {
  return new Set(
    Array.isArray(bossBattleState.hiddenOptions)
      ? bossBattleState.hiddenOptions
          .map((item) => normalizeQuizText(item).toUpperCase())
          .filter(Boolean)
      : [],
  );
}

function syncBossBattlePopupManager() {
  bossBattlePopupManager.mode = getBossBattlePopupMode(
    bossBattleState.battleStatus,
    bossBattleState.bossHP,
  );
  bossBattlePopupManager.visible = bossBattlePopupManager.mode !== "none";
  bossBattlePopupManager.lastStatus = normalizeBossBattleStatus(
    bossBattleState.battleStatus,
  );
  return bossBattlePopupManager;
}

function canUseBossBattleHint() {
  const answerPhase = normalizeQuizText(
    bossBattleReviewMode.active
      ? bossBattleReviewMode.answerPhase
      : bossBattleState.answerPhase,
  ).toLowerCase();

  return (
    bossBattlePopupManager.mode === "none" &&
    !bossBattleReviewMode.active &&
    normalizeBossBattleStatus(bossBattleState.battleStatus) === "active" &&
    answerPhase !== "reveal" &&
    !bossBattleState.loadingSession &&
    !bossBattleState.answering &&
    !bossBattleState.hintLoading &&
    Math.max(0, Number(bossBattleState.hintRemaining) || 0) > 0 &&
    Boolean(bossBattleState.sessionId)
  );
}

async function requestBossBattleHint() {
  if (bossBattleState.terminalLocked || !canUseBossBattleHint()) {
    return null;
  }

  const sessionId = normalizeQuizText(bossBattleState.sessionId);

  if (!sessionId) {
    return null;
  }

  bossBattleState.hintLoading = true;
  renderStudentQuizFlow();

  try {
    const response = await apiRequestWithAuth(
      `/api/battle-sessions/${encodeURIComponent(sessionId)}/hint`,
      {
        method: "POST",
      },
    );

    const hiddenOptions = Array.isArray(response.data?.hiddenOptions)
      ? response.data.hiddenOptions
      : [];
    const hintRemaining = Math.max(
      0,
      Number(
        response.data?.hintRemaining ??
          response.data?.session?.hintRemaining ??
          0,
      ) || 0,
    );

    bossBattleState.hiddenOptions = hiddenOptions
      .map((item) => normalizeQuizText(item).toUpperCase())
      .filter(Boolean);
    bossBattleState.hintRemaining = hintRemaining;
    bossBattleState.session = response.data?.session || bossBattleState.session;
    bossBattleState.sessionId = normalizeQuizText(
      response.data?.session?.sessionId || bossBattleState.sessionId || "",
    );
    renderStudentQuizFlow();
    return response.data || null;
  } finally {
    bossBattleState.hintLoading = false;
    renderStudentQuizFlow();
  }
}

function getBossBattleHeartMarkup(playerHP) {
  const totalSlots = 5;
  const activeCount = Math.max(
    0,
    Math.min(totalSlots, Math.floor(Number(playerHP) || 0)),
  );

  return Array.from({ length: totalSlots }, (_, index) => {
    const isActive = index < activeCount;

    return `
      <span class="boss-battle-heart ${isActive ? "is-active" : "is-empty"}" aria-hidden="true">
        <img src="${getBossBattleIconPath("heart")}" alt="" />
      </span>
    `;
  }).join("");
}

function getBossBattleOutcomeCopy(status) {
  const normalizedStatus = normalizeBossBattleStatus(status);

  if (normalizedStatus === "victory") {
    return {
      title: "CHIẾN THẮNG!",
      subtitle: "Boss đã bị đánh bại. Đây là kết quả tạm tính của trận chiến.",
      bossImage: getBossBattleBossImagePath("die"),
    };
  }

  if (normalizedStatus === "defeat") {
    return {
      title: "HẾT LƯỢT!",
      subtitle: "Học sinh đã hết lượt trước khi hạ được Boss.",
      bossImage: getBossBattleBossImagePath("angry"),
    };
  }

  return {
    title: "HOÀN THÀNH BÀI!",
    subtitle: "Đã đi hết bộ câu hỏi của chủ đề hiện tại. Boss vẫn còn HP.",
    bossImage: getBossBattleBossImagePath(bossBattleState.bossState || "idle"),
  };
}

function getBossBattlePopupButtonSet(mode) {
  if (mode === "victory") {
    return `
      <button type="button" class="boss-battle-popup__action boss-battle-popup__action--primary" data-action="battle-popup-continue">
        <img src="${getBossBattleIconPath("continue")}" alt="" aria-hidden="true" />
        <span>Tiếp tục</span>
      </button>
      <button type="button" class="boss-battle-popup__action" data-action="battle-popup-retry">
        <img src="${getBossBattleIconPath("restart")}" alt="" aria-hidden="true" />
        <span>Làm lại</span>
      </button>
      <button type="button" class="boss-battle-popup__action" data-action="battle-popup-exit">
        <img src="${getBossBattleIconPath("quit")}" alt="" aria-hidden="true" />
        <span>Thoát</span>
      </button>
    `;
  }

  if (mode === "defeat") {
    return `
      <button type="button" class="boss-battle-popup__action boss-battle-popup__action--primary" data-action="battle-popup-retry">
        <img src="${getBossBattleIconPath("restart")}" alt="" aria-hidden="true" />
        <span>Làm lại</span>
      </button>
      <button type="button" class="boss-battle-popup__action" data-action="battle-popup-review-wrong">
        <img src="${getBossBattleIconPath("review")}" alt="" aria-hidden="true" />
        <span>Làm lại câu sai</span>
      </button>
      <button type="button" class="boss-battle-popup__action" data-action="battle-popup-exit">
        <img src="${getBossBattleIconPath("quit")}" alt="" aria-hidden="true" />
        <span>Thoát</span>
      </button>
    `;
  }

  if (mode === "completed") {
    return `
      <button type="button" class="boss-battle-popup__action boss-battle-popup__action--primary" data-action="battle-popup-retry">
        <img src="${getBossBattleIconPath("restart")}" alt="" aria-hidden="true" />
        <span>Làm lại</span>
      </button>
      <button type="button" class="boss-battle-popup__action" data-action="battle-popup-review-wrong">
        <img src="${getBossBattleIconPath("review")}" alt="" aria-hidden="true" />
        <span>Làm lại câu sai</span>
      </button>
      <button type="button" class="boss-battle-popup__action" data-action="battle-popup-exit">
        <img src="${getBossBattleIconPath("quit")}" alt="" aria-hidden="true" />
        <span>Thoát</span>
      </button>
    `;
  }

  return "";
}

function getBossBattleAchievementPopupHtml() {
  if (!bossBattleAchievementPopupState.visible) {
    return "";
  }

  const badgeCards = Array.isArray(bossBattleAchievementPopupState.badges)
    ? bossBattleAchievementPopupState.badges
        .map(
          (badge) => `
            <div class="boss-battle-popup__reward-badge">
              <img src="${escapeHtml(badge.image || getBossBattleBadgePath("achievement"))}" alt="" aria-hidden="true" />
              <span>${escapeHtml(badge.name || badge.title || "Achievement")}</span>
            </div>
          `,
        )
        .join("")
    : "";

  return `
    <article class="boss-battle-popup boss-battle-popup--achievement">
      <div class="boss-battle-popup__content">
        <span class="boss-battle-popup__badge">Achievement Unlocked</span>
        <h2>${escapeHtml(bossBattleAchievementPopupState.title || "ACHIEVEMENT UNLOCKED")}</h2>
        <p>${escapeHtml(bossBattleAchievementPopupState.description || "Bạn vừa mở khóa huy hiệu mới.")}</p>
        <div class="boss-battle-popup__reward-badges">
          ${badgeCards}
        </div>
        <div class="boss-battle-popup__actions">
          <button type="button" class="boss-battle-popup__action boss-battle-popup__action--primary" data-action="boss-achievement-close">
            <img src="${getBossBattleIconPath("continue")}" alt="" aria-hidden="true" />
            <span>Tiếp tục</span>
          </button>
        </div>
      </div>
    </article>
  `;
}

function closeBossBattlePopup() {
  bossBattlePopupManager.mode = "none";
  bossBattlePopupManager.visible = false;
}

function clearBossBattleAchievementPopupTimer() {
  if (bossBattleAchievementPopupState.timerId) {
    clearTimeout(bossBattleAchievementPopupState.timerId);
    bossBattleAchievementPopupState.timerId = null;
  }
}

function closeBossBattleAchievementPopup() {
  clearBossBattleAchievementPopupTimer();
  bossBattleAchievementPopupState.visible = false;
  bossBattleAchievementPopupState.badges = [];
  bossBattleAchievementPopupState.title = "";
  bossBattleAchievementPopupState.description = "";
  renderStudentQuizFlow();
}

function showBossBattleAchievementPopup(achievements = []) {
  const badgeList = Array.isArray(achievements)
    ? achievements.map((item) => ({
        ...item,
        image: item?.image || getBossBattleBadgePath("achievement"),
      }))
    : [];

  if (badgeList.length === 0) {
    return;
  }

  clearBossBattleAchievementPopupTimer();
  bossBattleAchievementPopupState.visible = true;
  bossBattleAchievementPopupState.badges = badgeList;
  bossBattleAchievementPopupState.title =
    badgeList.length === 1 ? badgeList[0].name : "ACHIEVEMENT UNLOCKED";
  bossBattleAchievementPopupState.description =
    badgeList.length === 1
      ? badgeList[0].description || ""
      : `${badgeList.length} huy hiệu mới đã được mở khóa`;

  setBossBattleEffect("sparkle", 700);
  renderStudentQuizFlow();

  bossBattleAchievementPopupState.timerId = window.setTimeout(() => {
    closeBossBattleAchievementPopup();
  }, 2800);
}

function clearBossBattleReviewTimer() {
  if (bossBattleReviewMode.advanceTimerId) {
    clearTimeout(bossBattleReviewMode.advanceTimerId);
    bossBattleReviewMode.advanceTimerId = null;
  }
}

function resetBossBattleReviewMode() {
  clearBossBattleReviewTimer();
  bossBattleReviewMode.active = false;
  bossBattleReviewMode.wrongQuestions = [];
  bossBattleReviewMode.currentQuestionIndex = 0;
  bossBattleReviewMode.selectedAnswer = "";
  bossBattleReviewMode.answerPhase = "idle";
  bossBattleReviewMode.locked = false;
  bossBattleReviewMode.reviewedCount = 0;
  bossBattleReviewMode.correctCount = 0;
  bossBattleReviewMode.completedVisible = false;
  bossBattleReviewMode.revealedQuestion = null;
  bossBattleReviewMode.revealedCorrectAnswer = "";
  bossBattleReviewMode.revealedCorrect = null;
}

function buildBossBattleWrongReviewQuestions() {
  const quizQuestions = Array.isArray(studentQuizState.quiz?.questions)
    ? studentQuizState.quiz.questions
    : [];
  const answers = Array.isArray(bossBattleState.session?.answers)
    ? bossBattleState.session.answers
    : [];

  return answers
    .filter((answer) => answer && answer.correct === false)
    .map((answer) => {
      const question = quizQuestions[Number(answer.questionIndex) || 0] || null;
      const options = Array.isArray(question?.options)
        ? question.options.map((option, optionIndex) => ({
            index: optionIndex,
            label: normalizeQuizText(option?.label).toUpperCase(),
            text: normalizeQuizText(option?.text || option?.label),
            correct: Boolean(option?.correct),
          }))
        : [];
      const selectedAnswer = normalizeQuizText(answer.selected).toUpperCase();
      const selectedOption =
        options.find((option) => option.label === selectedAnswer) || null;
      const correctOption =
        options.find((option) => option.correct === true) || null;
      const correctAnswer = normalizeQuizText(
        answer.correctAnswer || correctOption?.label,
      ).toUpperCase();

      return {
        questionIndex: Number(answer.questionIndex) || 0,
        question:
          normalizeQuizText(question?.question) ||
          `Câu ${Number(answer.questionIndex) + 1}`,
        options,
        userAnswer: selectedAnswer,
        userAnswerText: normalizeQuizText(
          selectedOption?.text || selectedOption?.label || answer.selected,
        ),
        correctAnswer,
        correctAnswerText: normalizeQuizText(
          correctOption?.text || correctOption?.label,
        ),
      };
    });
}

function showBossBattleWrongAnswerReview() {
  const wrongQuestions = buildBossBattleWrongReviewQuestions();

  closeBossBattlePopup();
  clearBossBattleReviewTimer();
  bossBattleReviewMode.active = true;
  bossBattleReviewMode.wrongQuestions = wrongQuestions;
  bossBattleReviewMode.currentQuestionIndex = 0;
  bossBattleReviewMode.selectedAnswer = "";
  bossBattleReviewMode.locked = false;
  bossBattleReviewMode.reviewedCount = 0;
  bossBattleReviewMode.correctCount = 0;
  bossBattleReviewMode.completedVisible = wrongQuestions.length === 0;
  renderStudentQuizFlow();
  scrollToElement("student-boss-battle-screen");
}

function getBossBattleReviewCurrentQuestion() {
  const questions = Array.isArray(bossBattleReviewMode.wrongQuestions)
    ? bossBattleReviewMode.wrongQuestions
    : [];
  const currentIndex = Math.max(
    0,
    Math.min(
      Number(bossBattleReviewMode.currentQuestionIndex) || 0,
      questions.length,
    ),
  );

  return {
    currentIndex,
    totalQuestions: questions.length,
    question: questions[currentIndex] || null,
  };
}

function finishBossBattleReviewMode() {
  bossBattleReviewMode.completedVisible = true;
  bossBattleReviewMode.locked = false;
  bossBattleReviewMode.selectedAnswer = "";
  bossBattleReviewMode.reviewedCount = Array.isArray(
    bossBattleReviewMode.wrongQuestions,
  )
    ? bossBattleReviewMode.wrongQuestions.length
    : 0;
  renderStudentQuizFlow();
  scrollToElement("student-boss-battle-screen");
}

function advanceBossBattleReviewQuestion() {
  clearBossBattleReviewTimer();

  const questions = Array.isArray(bossBattleReviewMode.wrongQuestions)
    ? bossBattleReviewMode.wrongQuestions
    : [];
  const nextIndex = Number(bossBattleReviewMode.currentQuestionIndex) + 1;

  if (nextIndex >= questions.length) {
    finishBossBattleReviewMode();
    return;
  }

  bossBattleReviewMode.currentQuestionIndex = nextIndex;
  bossBattleReviewMode.selectedAnswer = "";
  bossBattleReviewMode.answerPhase = "idle";
  bossBattleReviewMode.locked = false;
  bossBattleReviewMode.completedVisible = false;
  bossBattleReviewMode.revealedQuestion = null;
  bossBattleReviewMode.revealedCorrectAnswer = "";
  bossBattleReviewMode.revealedCorrect = null;
  renderStudentQuizFlow();
}

function submitBossBattleReviewAnswer(questionIndex, selected) {
  if (!bossBattleReviewMode.active || bossBattleReviewMode.completedVisible) {
    return;
  }

  const { currentIndex, question } = getBossBattleReviewCurrentQuestion();

  if (!question || currentIndex !== Number(questionIndex)) {
    return;
  }

  if (bossBattleReviewMode.locked) {
    return;
  }

  const normalizedSelected = normalizeQuizText(selected).toUpperCase();
  const normalizedCorrect = normalizeQuizText(
    question.correctAnswer,
  ).toUpperCase();
  const isCorrect = normalizedSelected === normalizedCorrect;

  bossBattleReviewMode.selectedAnswer = normalizedSelected;
  bossBattleReviewMode.answerPhase = "reveal";
  bossBattleReviewMode.locked = true;
  bossBattleReviewMode.revealedQuestion = question;
  bossBattleReviewMode.revealedCorrectAnswer = normalizedCorrect;
  bossBattleReviewMode.revealedCorrect = isCorrect;
  bossBattleReviewMode.reviewedCount = currentIndex + 1;
  if (isCorrect) {
    bossBattleReviewMode.correctCount += 1;
  }

  renderStudentQuizFlow();

  queueMicrotask(() => {
    requestAnimationFrame(() => {
      triggerBossBattleFeedback(isCorrect ? "correct" : "wrong");
    });
  });
}

function restartBossBattleReviewMode() {
  const wrongQuestions = buildBossBattleWrongReviewQuestions();

  clearBossBattleReviewTimer();
  bossBattleReviewMode.active = true;
  bossBattleReviewMode.wrongQuestions = wrongQuestions;
  bossBattleReviewMode.currentQuestionIndex = 0;
  bossBattleReviewMode.selectedAnswer = "";
  bossBattleReviewMode.answerPhase = "idle";
  bossBattleReviewMode.locked = false;
  bossBattleReviewMode.reviewedCount = 0;
  bossBattleReviewMode.correctCount = 0;
  bossBattleReviewMode.completedVisible = wrongQuestions.length === 0;
  bossBattleReviewMode.revealedQuestion = null;
  bossBattleReviewMode.revealedCorrectAnswer = "";
  bossBattleReviewMode.revealedCorrect = null;
  renderStudentQuizFlow();
  scrollToElement("student-boss-battle-screen");
}

function closeBossBattleReviewMode() {
  resetBossBattleReviewMode();
  renderStudentQuizFlow();
}

async function handleBossBattlePopupAction(action) {
  const normalizedAction = normalizeQuizText(action);

  if (!normalizedAction) {
    return;
  }

  if (normalizedAction === "battle-popup-exit") {
    closeBossBattlePopup();
    clearBossBattleRecoveryStorageState();
    goBackSubjects();
    return;
  }

  if (normalizedAction === "battle-popup-continue") {
    closeBossBattlePopup();
    clearBossBattleRecoveryStorageState();
    goBackSubjects();
    return;
  }

  if (normalizedAction === "battle-popup-review-wrong") {
    showBossBattleWrongAnswerReview();
    return;
  }

  if (normalizedAction === "battle-popup-retry") {
    const topicId = normalizeQuizText(
      bossBattleState.topicId || studentQuizState.selectedTopicId || "",
    );

    closeBossBattlePopup();
    clearBossBattleRecoveryStorageState();

    if (topicId) {
      await loadStudentQuizByTopic(topicId);
    }
  }

  if (normalizedAction === "boss-review-back-topic") {
    closeBossBattleReviewMode();
    clearBossBattleRecoveryStorageState();
    goBackSubjects();
    return;
  }

  if (normalizedAction === "boss-review-retry") {
    restartBossBattleReviewMode();
    return;
  }
}

function resetBossBattleState(totalQuestions = 0) {
  const normalizedTotalQuestions = Math.max(0, Number(totalQuestions) || 0);
  clearBossBattleAnimationTimers();
  clearBossBattleRewardCounterAnimation();
  clearBossBattleAchievementPopupTimer();
  stopBossBattleAudio();
  resetBossBattleReviewMode();
  bossBattleState.sessionId = "";
  bossBattleState.topicId = "";
  bossBattleState.quizId = "";
  bossBattleState.session = null;
  bossBattleState.loadingSession = false;
  bossBattleState.answering = false;
  bossBattleState.currentQuestionIndex = 0;
  bossBattleState.totalQuestions = normalizedTotalQuestions;
  bossBattleState.bossHP = 100;
  bossBattleState.playerHP = Math.max(
    1,
    Math.ceil(normalizedTotalQuestions / 2),
  );
  bossBattleState.combo = 0;
  bossBattleState.bossState = "idle";
  bossBattleState.battleStatus = "idle";
  bossBattleState.visualBossHP = 100;
  bossBattleState.visualPlayerHP = Math.max(
    1,
    Math.ceil(normalizedTotalQuestions / 2),
  );
  bossBattleState.hintRemaining = 3;
  bossBattleState.hintLoading = false;
  bossBattleState.hiddenOptions = [];
  bossBattleState.assetPreloading = false;
  bossBattleState.answerPhase = "idle";
  bossBattleState.selectedAnswer = "";
  bossBattleState.selectedQuestionIndex = 0;
  bossBattleState.revealedQuestion = null;
  bossBattleState.revealedCorrectAnswer = "";
  bossBattleState.revealedCorrect = null;
  bossBattleState.terminalLocked = false;
  bossBattleAnimationState.currentState = "idle";
  bossBattleAnimationState.currentFrame = 1;
  bossBattleAnimationState.playOnce = false;
  bossBattleRewardPreview.earnedXP = 0;
  bossBattleRewardPreview.earnedCoin = 0;
  bossBattleRewardPreview.comboBonusXP = 0;
  bossBattleRewardPreview.comboBonusCoin = 0;
  bossBattleRewardPreview.victoryBonusXP = 0;
  bossBattleRewardPreview.victoryBonusCoin = 0;
  bossBattleRewardPreview.rankStars = 0;
  bossBattleRewardPreview.rankBonusCoin = 0;
  bossBattleRewardPreview.accuracy = 0;
  bossBattleRewardPreview.rankLabel = "";
  bossBattleRewardPreview.active = false;
  bossBattleRewardPreview.lastBattleStatus = "idle";
  bossBattleRewardPreview.lastRankKey = "";
  bossBattleRewardPreview.lastRewardEventKey = "";
  bossBattleRewardPreview.baseXP = 0;
  bossBattleRewardPreview.baseCoin = 0;
  bossBattleRewardCounterState.displayXP = 0;
  bossBattleRewardCounterState.displayCoin = 0;
  bossBattleRewardCounterState.fromXP = 0;
  bossBattleRewardCounterState.fromCoin = 0;
  bossBattleRewardCounterState.toXP = 0;
  bossBattleRewardCounterState.toCoin = 0;
  bossBattleRewardSyncState.sessionId = "";
  bossBattleRewardSyncState.status = "idle";
  bossBattleRewardSyncState.summary = null;
  bossBattleRewardSyncState.promise = null;
  bossBattleAchievementPopupState.visible = false;
  bossBattleAchievementPopupState.badges = [];
  bossBattleAchievementPopupState.title = "";
  bossBattleAchievementPopupState.description = "";
  syncBossBattleRewardCounterNodes();
}

function initializeBossBattleRewardPreview(profile = getCurrentAuthUser()) {
  bossBattleRewardPreview.baseXP = getBossBattleExp(profile);
  bossBattleRewardPreview.baseCoin = getBossBattleCoins(profile);
  bossBattleRewardPreview.active = true;
  bossBattleRewardPreview.lastBattleStatus = normalizeBossBattleStatus(
    bossBattleState.battleStatus,
  );
  bossBattleRewardCounterState.displayXP = bossBattleRewardPreview.baseXP;
  bossBattleRewardCounterState.displayCoin = bossBattleRewardPreview.baseCoin;
  bossBattleRewardCounterState.fromXP = bossBattleRewardPreview.baseXP;
  bossBattleRewardCounterState.fromCoin = bossBattleRewardPreview.baseCoin;
  bossBattleRewardCounterState.toXP = bossBattleRewardPreview.baseXP;
  bossBattleRewardCounterState.toCoin = bossBattleRewardPreview.baseCoin;
  syncBossBattleRewardCounterNodes();
}

function applyBossBattleRewardPreviewEvent({
  correct = false,
  battleStatus = bossBattleState.battleStatus,
  previousBattleStatus = bossBattleRewardPreview.lastBattleStatus,
  combo = bossBattleState.combo,
} = {}) {
  if (!bossBattleRewardPreview.active) {
    initializeBossBattleRewardPreview();
  }

  const normalizedStatus = normalizeBossBattleStatus(battleStatus);
  const normalizedPreviousStatus =
    normalizeBossBattleStatus(previousBattleStatus);
  const normalizedCombo = Math.max(0, Math.floor(Number(combo) || 0));
  const rewardKey = [
    bossBattleState.sessionId || "",
    bossBattleState.currentQuestionIndex || 0,
    normalizedStatus,
    String(correct ? 1 : 0),
    String(normalizedCombo),
  ].join(":");
  const queuedVisuals = [];
  let shouldPlayRewardSound = false;
  const queueVisual = (callback) => {
    if (typeof callback === "function") {
      queuedVisuals.push(callback);
    }
  };

  if (correct) {
    bossBattleRewardPreview.earnedXP += 10;
    const earnedCoin = 3 + Math.floor(Math.random() * 6);
    bossBattleRewardPreview.earnedCoin += earnedCoin;

    queueVisual(() => {
      spawnBossBattleFloatingReward(
        getBossBattleRewardFloatingXPText(10),
        "xp",
      );
      spawnBossBattleFloatingReward(
        getBossBattleRewardFloatingCoinText(earnedCoin),
        "coin",
      );
      setBossBattleEffect("xp", 500);
      setBossBattleEffect("coin", 450);
    });

    let comboBonusPlayed = false;
    if (normalizedCombo >= 3) {
      bossBattleRewardPreview.comboBonusXP += 10;
      queueVisual(() => {
        spawnBossBattleFloatingReward("+10 XP", "xp");
        spawnBossBattleRewardBadge("combo");
        setBossBattleEffect("sparkle", 450);
      });
      comboBonusPlayed = true;
    }

    if (normalizedCombo >= 5) {
      bossBattleRewardPreview.comboBonusCoin += 20;
      queueVisual(() => {
        spawnBossBattleFloatingReward("+20 Coin", "coin");
        setBossBattleEffect("coin", 450);
      });
      comboBonusPlayed = true;
    }

    if (comboBonusPlayed) {
      shouldPlayRewardSound = true;
    }
  }

  if (
    normalizedStatus === "victory" &&
    normalizedPreviousStatus !== "victory"
  ) {
    bossBattleRewardPreview.victoryBonusXP += 50;
    bossBattleRewardPreview.victoryBonusCoin += 50;
    queueVisual(() => {
      spawnBossBattleFloatingReward("+50 XP", "xp");
      spawnBossBattleFloatingReward("+50 Coin", "coin");
      spawnBossBattleRewardBadge("victory");
      setBossBattleEffect("confetti", 900);
    });
    shouldPlayRewardSound = true;
  }

  if (normalizedStatus === "victory" || normalizedStatus === "completed") {
    const totalQuestions = Math.max(
      1,
      Number(bossBattleState.totalQuestions) || 0,
    );
    const sessionSummary = getBossBattleSessionSummary();
    const rankPreview = getBossBattleRewardRankPreview(
      sessionSummary.score,
      totalQuestions,
    );
    const rankKey = `${normalizedStatus}:${sessionSummary.score}:${rankPreview.stars}`;

    bossBattleRewardPreview.accuracy = sessionSummary.score;
    bossBattleRewardPreview.rankStars = rankPreview.stars;
    bossBattleRewardPreview.rankBonusCoin = rankPreview.bonusCoin;
    bossBattleRewardPreview.rankLabel = rankPreview.label;

    if (
      rankPreview.bonusCoin > 0 &&
      bossBattleRewardPreview.lastRankKey !== rankKey
    ) {
      queueVisual(() => {
        spawnBossBattleFloatingReward(`+${rankPreview.bonusCoin} Coin`, "coin");
      });
      shouldPlayRewardSound = true;
    }

    bossBattleRewardPreview.lastRankKey = rankKey;
  }

  bossBattleRewardPreview.lastBattleStatus = normalizedStatus;
  bossBattleRewardPreview.lastRewardEventKey = rewardKey;

  const totalXP =
    bossBattleRewardPreview.baseXP +
    bossBattleRewardPreview.earnedXP +
    bossBattleRewardPreview.comboBonusXP +
    bossBattleRewardPreview.victoryBonusXP;
  const totalCoin =
    bossBattleRewardPreview.baseCoin +
    bossBattleRewardPreview.earnedCoin +
    bossBattleRewardPreview.comboBonusCoin +
    bossBattleRewardPreview.victoryBonusCoin +
    (normalizedStatus === "victory" || normalizedStatus === "completed"
      ? bossBattleRewardPreview.rankBonusCoin
      : 0);

  animateBossBattleRewardCounters(totalXP, totalCoin, 380);

  if (queuedVisuals.length > 0) {
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        queuedVisuals.forEach((callback) => callback());
      });
    });
  }

  if (shouldPlayRewardSound) {
    playBossBattleRewardSoundOnce(rewardKey);
  }
}

function getBossBattleCurrentQuestionIndex() {
  const totalQuestions = Math.max(
    0,
    Number(bossBattleState.totalQuestions) || 0,
  );
  if (totalQuestions <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      Number(bossBattleState.currentQuestionIndex) || 0,
      totalQuestions - 1,
    ),
  );
}

function getBossBattleCurrentQuestion(quiz) {
  const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
  const questionIndex = getBossBattleCurrentQuestionIndex();
  return {
    questionIndex,
    question: questions[questionIndex] || null,
  };
}

function getBossBattleQuestionCorrectAnswer(question) {
  if (!question || typeof question !== "object") {
    return "";
  }

  const explicitAnswer = normalizeQuizText(
    question.correctAnswer,
  ).toUpperCase();
  if (explicitAnswer) {
    return explicitAnswer;
  }

  const options = Array.isArray(question.options) ? question.options : [];
  const correctOption = options.find(
    (option) => option && option.correct === true,
  );

  return normalizeQuizText(correctOption?.label || "").toUpperCase();
}

function getBossBattleDisplayedQuestion(quiz) {
  const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
  const answerPhase = normalizeQuizText(
    bossBattleState.answerPhase,
  ).toLowerCase();

  if (
    answerPhase === "reveal" &&
    bossBattleState.revealedQuestion &&
    typeof bossBattleState.revealedQuestion === "object"
  ) {
    return {
      questionIndex: Math.max(
        0,
        Number(bossBattleState.selectedQuestionIndex) || 0,
      ),
      question: bossBattleState.revealedQuestion,
      phase: "reveal",
    };
  }

  const questionIndex = getBossBattleCurrentQuestionIndex();
  return {
    questionIndex,
    question: questions[questionIndex] || null,
    phase: answerPhase === "selected" ? "selected" : "idle",
  };
}

function getBossBattleQuestionViewMeta(
  question,
  selectedAnswer = "",
  revealMode = false,
) {
  const normalizedSelected = normalizeQuizText(selectedAnswer).toUpperCase();
  const correctAnswer = getBossBattleQuestionCorrectAnswer(question);
  const isCorrect = Boolean(
    revealMode && normalizedSelected && normalizedSelected === correctAnswer,
  );

  return {
    selectedAnswer: normalizedSelected,
    correctAnswer,
    isCorrect,
    isWrong: Boolean(
      revealMode && normalizedSelected && normalizedSelected !== correctAnswer,
    ),
  };
}

function applyBossBattleSessionResponse(payload = {}) {
  const session = payload.session || payload || {};
  const totalQuestions = Array.isArray(studentQuizState.quiz?.questions)
    ? studentQuizState.quiz.questions.length
    : Math.max(0, Number(bossBattleState.totalQuestions) || 0);
  const currentBattleStatus = normalizeBossBattleStatus(
    bossBattleState.battleStatus,
  );
  const previousVisualBossHP = Number.isFinite(
    Number(bossBattleState.visualBossHP),
  )
    ? Number(bossBattleState.visualBossHP)
    : Math.max(0, Math.floor(Number(bossBattleState.bossHP) || 0));
  const previousVisualPlayerHP = Number.isFinite(
    Number(bossBattleState.visualPlayerHP),
  )
    ? Number(bossBattleState.visualPlayerHP)
    : Math.max(0, Math.floor(Number(bossBattleState.playerHP) || 0));
  const currentQuestionIndex = Number(
    payload.currentQuestionIndex ??
      session.currentQuestionIndex ??
      session.questionIndex ??
      0,
  );
  const bossHP = Math.max(
    0,
    Math.floor(Number(payload.bossHP ?? session.bossHP ?? 0) || 0),
  );
  const playerHP = Math.max(
    0,
    Math.floor(Number(payload.playerHP ?? session.playerHP ?? 0) || 0),
  );
  const combo = Math.max(
    0,
    Math.floor(Number(payload.combo ?? session.combo ?? 0) || 0),
  );
  const battleStatus = normalizeBossBattleStatus(
    payload.battleStatus ?? session.status ?? session.battleStatus,
  );
  const previousBattleStatus = normalizeBossBattleStatus(
    bossBattleState.battleStatus,
  );
  const bossState =
    normalizeQuizText(payload.bossState ?? session.bossState) ||
    getBossBattleStateFromHP(bossHP);

  bossBattleState.session = session;
  bossBattleState.sessionId = normalizeQuizText(
    session.sessionId || session.id || bossBattleState.sessionId || "",
  );
  bossBattleState.topicId = normalizeQuizText(
    session.topicId || bossBattleState.topicId || "",
  );
  bossBattleState.quizId = normalizeQuizText(
    session.quizId || bossBattleState.quizId || "",
  );
  bossBattleState.totalQuestions = totalQuestions;
  bossBattleState.currentQuestionIndex = Math.max(
    0,
    Math.min(
      Number.isFinite(currentQuestionIndex)
        ? Math.floor(currentQuestionIndex)
        : 0,
      totalQuestions,
    ),
  );
  bossBattleState.bossHP = bossHP;
  bossBattleState.playerHP = playerHP;
  bossBattleState.combo = combo;
  bossBattleState.bossState = bossState;
  bossBattleState.battleStatus =
    bossBattleState.terminalLocked &&
    battleStatus === "active" &&
    isBossBattleTerminalStatus(currentBattleStatus)
      ? currentBattleStatus
      : battleStatus;
  bossBattleState.loadingSession = false;
  bossBattleState.answering = false;
  bossBattleState.hintLoading = false;
  bossBattleState.hintRemaining = Math.max(
    0,
    Number(
      payload.hintRemaining ??
        session.hintRemaining ??
        bossBattleState.hintRemaining ??
        3,
    ) || 0,
  );
  bossBattleState.hiddenOptions = Array.isArray(payload.hiddenOptions)
    ? payload.hiddenOptions
        .map((item) => normalizeQuizText(item).toUpperCase())
        .filter(Boolean)
    : [];
  bossBattleState.visualBossHP = bossHP;
  bossBattleState.visualPlayerHP = previousVisualPlayerHP;
  if (isBossBattleTerminalStatus(bossBattleState.battleStatus)) {
    bossBattleState.terminalLocked = true;
  }
  saveBossBattleRecoveryStorageState({
    sessionId: bossBattleState.sessionId,
    topicId: bossBattleState.topicId,
    quizId: bossBattleState.quizId,
    battleStatus: bossBattleState.battleStatus,
  });

  if (
    payload.correct === true ||
    normalizeBossBattleStatus(battleStatus) === "victory" ||
    normalizeBossBattleStatus(battleStatus) === "completed"
  ) {
    applyBossBattleRewardPreviewEvent({
      correct: payload.correct === true,
      battleStatus,
      previousBattleStatus,
      combo,
    });
  }

  if (payload.correct === true) {
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        triggerBossBattleFeedback(
          battleStatus === "victory" ? "victory" : "correct",
        );
        playCorrect();
        if (normalizeBossBattleStatus(battleStatus) === "victory") {
          playBossDie();
        }
      });
    });
  } else if (payload.correct === false) {
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        triggerBossBattleFeedback("wrong");
        playWrong();
      });
    });
  }

  return bossBattleState;
}

async function createBossBattleSessionForCurrentQuiz() {
  const quiz = studentQuizState.quiz;

  if (!quiz) {
    throw new Error("Chưa có quiz để tạo battle session.");
  }

  const quizId = normalizeQuizText(quiz.quizId || quiz.id || "");
  const topicId = normalizeQuizText(
    studentQuizState.selectedTopicId || quiz.topicId || "",
  );

  if (!quizId || !topicId) {
    throw new Error("Thiếu quizId hoặc topicId để tạo battle session.");
  }

  bossBattleState.loadingSession = true;
  renderStudentQuizFlow();

  try {
    bossBattleState.assetPreloading = true;
    renderStudentQuizFlow();
    await ensureBossBattleAssetsPreloaded();
    bossBattleState.assetPreloading = false;
    renderStudentQuizFlow();

    const response = await apiRequestWithAuth("/api/battle-sessions", {
      method: "POST",
      body: {
        topicId,
        quizId,
      },
    });

    applyBossBattleSessionResponse(response.data || {});
    initializeBossBattleRewardPreview();
    return response.data || null;
  } finally {
    bossBattleState.loadingSession = false;
    bossBattleState.assetPreloading = false;
    renderStudentQuizFlow();
  }
}

async function submitBossBattleAnswer(questionIndex, selected) {
  const sessionId = normalizeQuizText(bossBattleState.sessionId);
  const normalizedSelected = normalizeQuizText(selected).toUpperCase();

  if (!sessionId) {
    throw new Error("Battle session chưa được khởi tạo.");
  }

  if (
    bossBattleState.terminalLocked ||
    normalizeBossBattleStatus(bossBattleState.battleStatus) !== "active"
  ) {
    return null;
  }

  if (!normalizedSelected) {
    return null;
  }

  if (
    normalizeQuizText(bossBattleState.answerPhase).toLowerCase() === "reveal"
  ) {
    return null;
  }

  bossBattleState.answering = true;
  renderStudentQuizFlow();

  try {
    const questionSnapshot = getBossBattleDisplayedQuestion(
      studentQuizState.quiz,
    );
    const response = await apiRequestWithAuth(
      `/api/battle-sessions/${encodeURIComponent(sessionId)}/answer`,
      {
        method: "POST",
        body: {
          questionIndex,
          selected: normalizedSelected,
        },
      },
    );

    applyBossBattleSessionResponse(response.data || {});
    bossBattleState.answerPhase = "reveal";
    bossBattleState.selectedAnswer = normalizedSelected;
    bossBattleState.selectedQuestionIndex = Number(questionIndex) || 0;
    bossBattleState.revealedQuestion = questionSnapshot.question || null;
    bossBattleState.revealedCorrectAnswer = getBossBattleQuestionCorrectAnswer(
      questionSnapshot.question,
    );
    bossBattleState.revealedCorrect = Boolean(response.data?.correct === true);
    return response.data || null;
  } finally {
    bossBattleState.answering = false;
    renderStudentQuizFlow();
  }
}

function clearBossBattleAnswerRevealState() {
  bossBattleState.answerPhase = "idle";
  bossBattleState.selectedAnswer = "";
  bossBattleState.selectedQuestionIndex = 0;
  bossBattleState.revealedQuestion = null;
  bossBattleState.revealedCorrectAnswer = "";
  bossBattleState.revealedCorrect = null;
}

function continueBossBattleQuestion() {
  clearBossBattleAnswerRevealState();
  renderStudentQuizFlow();
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
      const topicName = topic.topicName || topic.name || "";
      const topicAccuracy = getTopicAccuracySummary(topic);
      const topicAccuracyClass = getTopicAccuracyProgressClass(
        topicAccuracy.percentage,
      );
      const topicAccuracyWidth = `${Math.max(0, Math.min(topicAccuracy.percentage, 100))}%`;

      return `
        <button
          type="button"
          class="topic-card ${isActive ? "is-active" : ""}"
          data-topic-id="${escapeHtml(topic.topicId)}"
          data-topic-name="${escapeHtml(topicName)}"
        >
          <img class="topic-card-image" src="${escapeHtml(getStudentTopicImage(topic))}" alt="${escapeHtml(topicName)}" />
          <span class="topic-card-grade">Lớp ${escapeHtml(topic.grade)}</span>
          <h3 class="topic-card-title">${escapeHtml(topicName)}</h3>
          <p class="topic-card-description">${escapeHtml(topic.description || "Chọn để mở quiz để luyện.")}</p>
          <div class="topic-card-progress">
            <div class="topic-card-progress-label">
              <span>Độ chính xác</span>
              <strong>${escapeHtml(String(topicAccuracy.percentage))}%</strong>
            </div>
            <div class="topic-card-progress-track" aria-hidden="true">
              <div class="topic-card-progress-fill ${escapeHtml(topicAccuracyClass)}" style="width: ${escapeHtml(topicAccuracyWidth)}"></div>
            </div>
          </div>
        </button>
      `;
    })
    .join("");
}

async function fetchStudentQuizTopics() {
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

  return Array.isArray(response.data) ? response.data : [];
}

function getStudentSubjectsScreenHtml() {
  return `
    <div class="student-subjects-screen">
      <div class="quiz-page-hero">
        <div>
          <h1>Học theo chủ đề - Boss Battle Quiz</h1>
          <p class="subtitle">
            Chọn khối lớp, môn học và chủ đề để bước vào trận đấu ngay trong Dashboard.
          </p>
        </div>
      </div>

      <div class="quiz-toolbar">
        <label class="quiz-filter">
          <span>Khối lớp</span>
          <select id="quiz-grade-select">
            <option value="1">Lớp 1</option>
            <option value="2">Lớp 2</option>
            <option value="3">Lớp 3</option>
            <option value="4">Lớp 4</option>
            <option value="5">Lớp 5</option>
          </select>
        </label>

        <label class="quiz-filter">
          <span>Môn học</span>
          <select id="quiz-subject-select">
            <option value="math">Toán</option>
            <option value="english">Tiếng Anh</option>
          </select>
        </label>

        <button type="button" class="quiz-load-btn" id="quiz-load-topics-btn">
          Tải chủ đề
        </button>
      </div>

      <div class="topic-grid" id="student-topic-grid"></div>
      <div id="student-topic-empty" class="quiz-empty hidden"></div>

      <section id="student-result-screen" class="quiz-result boss-battle-result hidden"></section>
      <section id="student-wrong-review-screen" class="quiz-review boss-battle-review hidden"></section>
    </div>
  `;
}

function getStudentBossBattleScreenHtml() {
  return `
    <section id="student-boss-battle-screen" class="boss-battle-panel"></section>
  `;
}

function ensureStudentSubjectsScreenMounted() {
  const root = getStudentQuizRoot();

  if (!root) {
    return null;
  }

  const hasSubjectScreen =
    getStudentQuizGradeSelect() &&
    getStudentQuizSubjectSelect() &&
    getStudentQuizTopicGrid() &&
    getStudentQuizEmptyState() &&
    getStudentResultScreen() &&
    getStudentWrongReviewScreen();

  if (hasSubjectScreen && !getStudentQuizScreen()) {
    return root;
  }

  root.innerHTML = getStudentSubjectsScreenHtml();
  updateStudentQuizControls();
  return root;
}

function ensureStudentBossBattleScreenMounted() {
  const root = getStudentQuizRoot();

  if (!root) {
    return null;
  }

  const hasBattleScreen = getStudentQuizScreen();
  const hasSubjectScreen =
    getStudentQuizGradeSelect() ||
    getStudentQuizTopicGrid() ||
    getStudentQuizEmptyState() ||
    getStudentResultScreen() ||
    getStudentWrongReviewScreen();

  if (hasBattleScreen && !hasSubjectScreen) {
    return root;
  }

  root.innerHTML = getStudentBossBattleScreenHtml();
  return root;
}

function renderStudentSubjectsScreen() {
  const root = ensureStudentSubjectsScreenMounted();

  if (!root) {
    return;
  }

  renderStudentTopicCards();
  renderStudentResultScreen();
  renderStudentWrongAnswerScreen();
}

function renderStudentQuizScreen() {
  const screen = getStudentQuizScreen();

  if (!screen) {
    return;
  }

  if (!isStudentBossBattleScreenActive()) {
    return;
  }

  const quiz = studentQuizState.quiz;
  const quizMeta = quiz && typeof quiz === "object" ? quiz : {};
  const resultScreen = getStudentResultScreen();
  const reviewScreen = getStudentWrongReviewScreen();
  const profile = getCurrentAuthUser();
  const reviewModeActive = bossBattleReviewMode.active;
  const reviewQuestionState = reviewModeActive
    ? getBossBattleReviewCurrentQuestion()
    : null;
  const reviewQuestion = reviewQuestionState?.question || null;
  const reviewQuestionIndex = Math.max(
    0,
    Number(reviewQuestionState?.currentIndex) || 0,
  );
  const reviewTotalQuestions = Math.max(
    0,
    Number(reviewQuestionState?.totalQuestions) || 0,
  );
  const totalQuestions = Array.isArray(quiz?.questions)
    ? quiz.questions.length
    : 0;
  const displayedQuestionState = reviewModeActive
    ? {
        questionIndex: reviewQuestionIndex,
        question: reviewQuestion,
        phase: bossBattleReviewMode.answerPhase || "idle",
      }
    : getBossBattleDisplayedQuestion(quiz);
  const currentQuestionIndex = Math.max(
    0,
    Math.min(
      Number(displayedQuestionState?.questionIndex) || 0,
      totalQuestions,
    ),
  );
  const currentQuestion = displayedQuestionState?.question || null;
  const answerPhase = normalizeQuizText(
    reviewModeActive
      ? bossBattleReviewMode.answerPhase
      : bossBattleState.answerPhase,
  ).toLowerCase();
  const answerRevealMode = answerPhase === "reveal";
  const selectedAnswer = normalizeQuizText(
    reviewModeActive
      ? bossBattleReviewMode.selectedAnswer
      : bossBattleState.selectedAnswer,
  ).toUpperCase();
  const revealedCorrectAnswer = normalizeQuizText(
    reviewModeActive
      ? bossBattleReviewMode.revealedCorrectAnswer
      : bossBattleState.revealedCorrectAnswer,
  ).toUpperCase();
  const correctAnswer = getBossBattleQuestionCorrectAnswer(currentQuestion);
  const currentPet = getBossBattleCurrentPetState();
  const petDisplayName = currentPet?.petName || "Chưa có Pet";
  const petDisplayLevel = currentPet?.petLevel || null;
  const petDisplayImage = currentPet?.imagePath || "";
  const petDisplayStateImage = petDisplayImage || "";
  const battleStatus = normalizeBossBattleStatus(bossBattleState.battleStatus);
  const terminalLocked =
    bossBattleState.terminalLocked || isBossBattleTerminalStatus(battleStatus);
  const renderBattleStatus =
    terminalLocked && battleStatus === "active" ? "completed" : battleStatus;
  const battleStatusLabel = getBossBattleStatusLabel(battleStatus);
  const bossStateLabel = normalizeQuizText(bossBattleState.bossState || "idle");
  const playerHP = Math.max(
    0,
    Math.floor(Number(bossBattleState.playerHP) || 0),
  );
  const comboValue = Math.max(
    0,
    Math.floor(Number(bossBattleState.combo) || 0),
  );
  const bossHP = Math.max(0, Math.floor(Number(bossBattleState.bossHP) || 0));
  const bossHpPercent = Math.max(0, Math.min(100, bossHP));
  const profileCoins = getBossBattleCoins(profile);
  const profileExp = getBossBattleExp(profile);
  const rewardSummary = getBossBattleRewardDisplaySummary();
  const displayedRewardXP = Math.max(
    0,
    Math.round(
      Number.isFinite(Number(bossBattleRewardCounterState.displayXP))
        ? Number(bossBattleRewardCounterState.displayXP)
        : profileExp,
    ),
  );
  const displayedRewardCoin = Math.max(
    0,
    Math.round(
      Number.isFinite(Number(bossBattleRewardCounterState.displayCoin))
        ? Number(bossBattleRewardCounterState.displayCoin)
        : profileCoins,
    ),
  );
  const topicName = normalizeQuizText(
    quiz?.topicName || quiz?.topicDescription || quiz?.topicId || "MINI BOSS",
  );
  const bossAnimationState = getBossBattleCurrentAnimationState();
  const bossImagePath = getBossBattleBossFramePath(
    bossAnimationState,
    bossBattleAnimationState.currentFrame,
  );
  const popupMode = syncBossBattlePopupManager().mode;

  if (
    (popupMode === "victory" || popupMode === "completed") &&
    bossBattleRewardSyncState.status === "idle"
  ) {
    void syncBossBattleRewardWithBackend().catch((error) => {
      showToast(
        error.message || "Không thể đồng bộ phần thưởng Boss Battle.",
        "error",
      );
    });
  }
  const canAnswer =
    !terminalLocked &&
    battleStatus === "active" &&
    popupMode === "none" &&
    !bossBattleState.loadingSession &&
    !bossBattleState.answering &&
    !bossBattleState.hintLoading &&
    !answerRevealMode &&
    Boolean(currentQuestion);
  const canReviewAnswer =
    reviewModeActive &&
    !bossBattleReviewMode.completedVisible &&
    !answerRevealMode &&
    Boolean(currentQuestion);
  const hiddenOptionSet = getBossBattleHiddenOptionSet();
  const questionPrompt =
    currentQuestion?.question ||
    (renderBattleStatus === "victory"
      ? "Victory đang chờ hiển thị."
      : renderBattleStatus === "defeat"
        ? "Defeat đang chờ hiển thị."
        : renderBattleStatus === "completed"
          ? "Completed đang chờ hiển thị."
          : "Đang chuẩn bị câu hỏi...");
  const outcomeCopy = getBossBattleOutcomeCopy(renderBattleStatus);
  const activeAnswerButtons =
    currentQuestion && !terminalLocked && renderBattleStatus === "active"
      ? (Array.isArray(currentQuestion.options) ? currentQuestion.options : [])
          .map((option, optionIndex) => {
            const optionLabel = normalizeQuizText(option?.label).toUpperCase();
            const optionText = normalizeQuizText(option?.text || option?.label);
            const meta = getBossBattleOptionMeta(optionIndex);
            const isHidden = hiddenOptionSet.has(optionLabel);
            const isSelected = selectedAnswer === optionLabel;
            const isCorrect = answerRevealMode && optionLabel === correctAnswer;
            const isWrong =
              answerRevealMode &&
              isSelected &&
              selectedAnswer !== correctAnswer;
            const buttonDisabled = !canAnswer || isHidden || answerRevealMode;

            return `
              <button
                type="button"
                class="boss-battle-answer-card boss-battle-answer-card--${meta.tone} quiz-option-btn ${isHidden ? "is-hidden" : ""} ${isSelected ? "is-selected" : ""} ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""}"
                data-question-index="${currentQuestionIndex}"
                data-option-label="${escapeHtml(optionLabel)}"
                ${buttonDisabled ? "disabled" : ""}
                aria-pressed="${isSelected ? "true" : "false"}"
                ${isHidden ? 'aria-hidden="true"' : ""}
              >
                <span class="boss-battle-answer-card__badge" aria-hidden="true">
                  <img src="${escapeHtml(meta.iconPath)}" alt="" />
                </span>
                <span class="boss-battle-answer-card__body">
                  <span class="boss-battle-answer-card__label">${escapeHtml(optionLabel || ["A", "B", "C", "D"][optionIndex] || "")}</span>
                  <span class="boss-battle-answer-card__text">${escapeHtml(optionText || optionLabel || "")}</span>
                </span>
              </button>
            `;
          })
          .join("")
      : "";

  const reviewAnswerButtons =
    reviewModeActive && reviewQuestion
      ? (Array.isArray(reviewQuestion.options) ? reviewQuestion.options : [])
          .map((option, optionIndex) => {
            const optionLabel = normalizeQuizText(option?.label).toUpperCase();
            const optionText = normalizeQuizText(option?.text || option?.label);
            const meta = getBossBattleOptionMeta(optionIndex);
            const isSelected = selectedAnswer === optionLabel;
            const isCorrect =
              answerRevealMode && optionLabel === revealedCorrectAnswer;
            const isWrong =
              answerRevealMode &&
              isSelected &&
              selectedAnswer !== revealedCorrectAnswer;
            const buttonDisabled = !canReviewAnswer || answerRevealMode;

            return `
              <button
                type="button"
                class="boss-battle-answer-card boss-battle-answer-card--${meta.tone} quiz-option-btn ${isSelected ? "is-selected" : ""} ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""}"
                data-question-index="${reviewQuestionIndex}"
                data-option-label="${escapeHtml(optionLabel)}"
                ${buttonDisabled ? "disabled" : ""}
                aria-pressed="${isSelected ? "true" : "false"}"
              >
                <span class="boss-battle-answer-card__badge" aria-hidden="true">
                  <img src="${escapeHtml(meta.iconPath)}" alt="" />
                </span>
                <span class="boss-battle-answer-card__body">
                  <span class="boss-battle-answer-card__label">${escapeHtml(optionLabel || ["A", "B", "C", "D"][optionIndex] || "")}</span>
                  <span class="boss-battle-answer-card__text">${escapeHtml(optionText || optionLabel || "")}</span>
                </span>
              </button>
            `;
          })
          .join("")
      : "";

  const activeQuestionPanel = `
    <article class="boss-battle-question-card">
      <div class="boss-battle-question-card__badge">Câu ${currentQuestionIndex + 1} / ${Math.max(totalQuestions, 1)}</div>
      <h3 class="boss-battle-question-card__text">${escapeHtml(questionPrompt)}</h3>
      <div class="boss-battle-question-card__divider" aria-hidden="true"></div>
      <div class="boss-battle-answer-grid">
        ${
          activeAnswerButtons ||
          `<div class="boss-battle-empty-state">Không có câu hỏi để hiển thị.</div>`
        }
      </div>
    </article>
  `;

  const reviewQuestionPanel = reviewModeActive
    ? `
      <article class="boss-battle-question-card boss-battle-question-card--review">
        <div class="boss-battle-question-card__badge">Câu ${reviewQuestionIndex + 1} / ${Math.max(reviewTotalQuestions, 1)}</div>
        <h3 class="boss-battle-question-card__text">${escapeHtml(reviewQuestion?.question || "Đang tải câu sai cần ôn tập...")}</h3>
        <div class="boss-battle-question-card__divider" aria-hidden="true"></div>
        <div class="boss-battle-answer-grid">
          ${
            reviewAnswerButtons ||
            `<div class="boss-battle-empty-state">Không có câu sai để ôn tập.</div>`
          }
        </div>
      </article>
    `
    : "";

  const activeBattleActionHtml = reviewModeActive
    ? ""
    : answerRevealMode
      ? `
        <button type="button" class="boss-battle-next-btn boss-battle-next-btn--continue" data-action="battle-answer-continue">
          <img src="${getBossBattleIconPath("continue")}" alt="" aria-hidden="true" />
          <span>TIẾP TỤC</span>
        </button>
      `
      : `
        <button type="button" class="boss-battle-next-btn boss-battle-next-btn--fight" data-action="battle-answer-commit" ${selectedAnswer && !bossBattleState.answering ? "" : "disabled"}>
          <img src="${escapeHtml(getBossBattleAssetPath("icons", "icon_fight.png"))}" alt="" aria-hidden="true" onerror="this.onerror=null;this.src='${escapeHtml(getBossBattleIconPath("review"))}'" />
          <span>KHIÊU CHIẾN</span>
        </button>
      `;

  const reviewBattleActionHtml = reviewModeActive
    ? answerRevealMode
      ? `
        <button type="button" class="boss-battle-next-btn boss-battle-next-btn--continue" data-action="boss-review-continue">
          <img src="${getBossBattleIconPath("continue")}" alt="" aria-hidden="true" />
          <span>TIẾP TỤC</span>
        </button>
      `
      : `
        <button type="button" class="boss-battle-next-btn boss-battle-next-btn--fight" data-action="boss-review-commit" ${selectedAnswer && !bossBattleReviewMode.locked ? "" : "disabled"}>
          <img src="${escapeHtml(getBossBattleAssetPath("icons", "icon_fight.png"))}" alt="" aria-hidden="true" onerror="this.onerror=null;this.src='${escapeHtml(getBossBattleIconPath("review"))}'" />
          <span>KHIÊU CHIẾN</span>
        </button>
      `
    : "";

  const activeSidebar = `
    <aside class="boss-battle-sidebar">
      <div class="boss-battle-sidebar__speech">
        <strong>${reviewModeActive ? "Ôn lại!" : "Cố lên!"}</strong>
        <span>${reviewModeActive ? "Chỉ luyện các câu sai." : "Bạn làm rất tốt!"}</span>
      </div>
      <div class="boss-battle-sidebar__card ${reviewModeActive ? "is-review-mode" : ""} ${comboValue >= 5 ? "is-combo-strong" : comboValue >= 3 ? "is-combo-glow" : ""} ${renderBattleStatus === "victory" ? "is-pet-celebrate" : ""}">
        <div class="boss-battle-sidebar__pet boss-battle-pet">
          ${
            currentPet
              ? `<img class="boss-battle-sidebar__pet-image" src="${escapeHtml(petDisplayStateImage)}" alt="${escapeHtml(petDisplayName)}" />`
              : `<span class="boss-battle-sidebar__pet-fallback" aria-hidden="true">🐾</span>`
          }
        </div>
        <div class="boss-battle-sidebar__level">Lv ${escapeHtml(String(petDisplayLevel ?? "--"))}</div>
        <h3>${escapeHtml(petDisplayName)}</h3>
        ${reviewModeActive ? '<div class="boss-battle-sidebar__review-chip">REVIEW MODE</div>' : ""}

        <div class="boss-battle-sidebar__metric">
          <div class="boss-battle-sidebar__metric-head">
            <img src="${getBossBattleIconPath("heart")}" alt="" aria-hidden="true" />
            <span>MÁU</span>
          </div>
          <div class="boss-battle-sidebar__hearts">${getBossBattleHeartMarkup(playerHP)}</div>
        </div>

        <div class="boss-battle-sidebar__metric boss-battle-sidebar__metric--combo ${comboValue >= 5 ? "is-combo-strong" : comboValue >= 3 ? "is-combo-glow" : ""}">
          <div class="boss-battle-sidebar__metric-head">
            <span class="boss-battle-sidebar__metric-flame" aria-hidden="true">🔥</span>
            <span>COMBO</span>
          </div>
          <strong>x${escapeHtml(String(comboValue))}</strong>
        </div>

        <div class="boss-battle-sidebar__metric">
          <div class="boss-battle-sidebar__metric-head">
            <img src="${getBossBattleIconPath("xp")}" alt="" aria-hidden="true" />
            <span>XP</span>
          </div>
          <div class="boss-battle-sidebar__progress">
            <div class="boss-battle-sidebar__progress-fill" style="width: ${escapeHtml(String(Math.min(100, displayedRewardXP > 0 ? displayedRewardXP % 100 || 60 : 60)))}%"></div>
          </div>
          <strong><span data-boss-reward-xp-counter>${escapeHtml(String(displayedRewardXP))}</span> / 100</strong>
        </div>

        <div class="boss-battle-sidebar__metric">
          <div class="boss-battle-sidebar__metric-head">
            <img src="${getBossBattleIconPath("coin")}" alt="" aria-hidden="true" />
            <span>Xu Edu</span>
          </div>
          <strong data-boss-reward-coin-counter>${escapeHtml(String(displayedRewardCoin))}</strong>
        </div>
      </div>
    </aside>
  `;

  const activeHeader = `
    <section class="boss-battle-header-card">
      <div class="boss-battle-header-card__boss ${renderBattleStatus === "victory" ? "is-pet-celebrate" : ""}">
        <img class="boss-battle-header-card__boss-image" data-boss-anim="main" src="${escapeHtml(bossImagePath)}" alt="Mini Boss" />
      </div>
      <div class="boss-battle-header-card__copy">
        <h2>MINI BOSS</h2>
        <p>${escapeHtml(topicName)}</p>
      </div>
      <div class="boss-battle-header-card__hp">
        <strong>${escapeHtml(`${bossHP} / 100 HP`)}</strong>
      </div>
      <div class="boss-battle-header-card__track" aria-hidden="true">
        <div class="boss-battle-header-card__track-fill" style="width: ${escapeHtml(String(bossHpPercent))}%">
          <img class="boss-battle-header-card__track-asset" src="${getBossBattleAssetPath("hp", "boss_hp_fill.png")}" alt="" />
        </div>
      </div>
    </section>
  `;

  const activeHint = `
    <button type="button" class="boss-battle-hint-pill" data-action="battle-hint" aria-label="${escapeHtml(getBossBattleHintCountLabel(bossBattleState.hintRemaining))}" ${canUseBossBattleHint() ? "" : "disabled"}>
      <img src="${getBossBattleIconPath("hint")}" alt="" aria-hidden="true" />
      <span>Hint</span>
      <strong>x${escapeHtml(String(Math.max(0, Number(bossBattleState.hintRemaining) || 0)))}</strong>
    </button>
  `;

  const activeBattleControlsHtml = reviewModeActive
    ? ""
    : `
      <div class="boss-battle-action-row">
        ${activeHint}
        ${activeBattleActionHtml}
      </div>
    `;

  const bossBattleExitButtonHtml = `
    <button type="button" class="boss-battle-exit-btn" data-action="boss-battle-exit" aria-label="Thoát khỏi Boss Battle">
      <img src="${getBossBattleIconPath("quit")}" alt="" aria-hidden="true" />
      <span>Thoát</span>
    </button>
  `;

  const terminalStatsHtml =
    popupMode === "victory"
      ? `
        <div class="boss-battle-popup__stats">
          <div class="boss-battle-popup__stat">
            <strong>${escapeHtml(String(rewardSummary.score))}%</strong>
            <span>Accuracy</span>
          </div>
          <div class="boss-battle-popup__stat">
            <strong>${escapeHtml(String(rewardSummary.correctCount))}</strong>
            <span>Số câu đúng</span>
          </div>
          <div class="boss-battle-popup__stat">
            <strong>${escapeHtml(rewardSummary.rankLabel || "1 Sao")}</strong>
            <span>Rank</span>
          </div>
          <div class="boss-battle-popup__stat">
            <strong>+${escapeHtml(String(rewardSummary.rewardXP))}</strong>
            <span>XP nhận được</span>
          </div>
          <div class="boss-battle-popup__stat">
            <strong>+${escapeHtml(String(rewardSummary.rewardCoin))}</strong>
            <span>Coin nhận được</span>
          </div>
        </div>
        <div class="boss-battle-popup__reward-strip">
          <span>Boss đã bị đánh bại</span>
          <strong>Preview chỉ hiển thị trên UI, chưa sync reward thật.</strong>
        </div>
        <div class="boss-battle-popup__reward-badges">
          <div class="boss-battle-popup__reward-badge">
            <img src="${getBossBattleBadgePath("victory")}" alt="" aria-hidden="true" />
            <span>Victory Bonus</span>
          </div>
          <div class="boss-battle-popup__reward-badge">
            <div class="boss-battle-popup__reward-stars" aria-hidden="true">${"★".repeat(Math.max(1, Number(rewardSummary.rankStars) || 1))}</div>
            <span>${escapeHtml(rewardSummary.rankLabel || "1 Sao")}</span>
          </div>
        </div>
      `
      : popupMode === "defeat"
        ? `
          <div class="boss-battle-popup__stats">
            <div class="boss-battle-popup__stat">
              <strong>${escapeHtml(String(playerHP))}</strong>
              <span>Hết tim</span>
            </div>
            <div class="boss-battle-popup__stat">
              <strong>${escapeHtml(String(rewardSummary.correctCount))}</strong>
              <span>Số câu đúng</span>
            </div>
            <div class="boss-battle-popup__stat">
              <strong>${escapeHtml(String(rewardSummary.score))}%</strong>
              <span>Accuracy hiện tại</span>
            </div>
          </div>
          <div class="boss-battle-popup__reward-strip">
            <span>Hết lượt</span>
            <strong>Điểm tạm tính chỉ để xem trước.</strong>
          </div>
        `
        : `
          <div class="boss-battle-popup__stats">
            <div class="boss-battle-popup__stat">
              <strong>${escapeHtml(String(bossHP))}</strong>
              <span>Boss còn HP</span>
            </div>
            <div class="boss-battle-popup__stat">
              <strong>${escapeHtml(String(rewardSummary.score))}%</strong>
              <span>Accuracy</span>
            </div>
            <div class="boss-battle-popup__stat">
              <strong>${escapeHtml(String(rewardSummary.correctCount))}</strong>
              <span>Số câu đúng</span>
            </div>
            <div class="boss-battle-popup__stat">
              <strong>+${escapeHtml(String(rewardSummary.rewardXP))}</strong>
              <span>XP nhận được</span>
            </div>
            <div class="boss-battle-popup__stat">
              <strong>+${escapeHtml(String(rewardSummary.rewardCoin))}</strong>
              <span>Coin nhận được</span>
            </div>
          </div>
          <div class="boss-battle-popup__reward-strip">
            <span>Boss vẫn còn HP</span>
            <strong>Preview chỉ hiển thị trên UI, chưa sync reward thật.</strong>
          </div>
          <div class="boss-battle-popup__reward-badges">
            <div class="boss-battle-popup__reward-badge">
              <img src="${getBossBattleBadgePath("combo")}" alt="" aria-hidden="true" />
              <span>Combo Bonus</span>
            </div>
            <div class="boss-battle-popup__reward-badge">
              <div class="boss-battle-popup__reward-stars" aria-hidden="true">${"★".repeat(Math.max(1, Number(rewardSummary.rankStars) || 1))}</div>
              <span>${escapeHtml(rewardSummary.rankLabel || "1 Sao")}</span>
            </div>
          </div>
        `;

  const terminalSceneHtml = `
    <div class="boss-battle-popup__scene">
      <div class="boss-battle-popup__pet">
        ${
          currentPet
            ? `<img src="${escapeHtml(petDisplayStateImage)}" alt="${escapeHtml(petDisplayName)}" />`
            : `<span aria-hidden="true">🐾</span>`
        }
        <div class="boss-battle-popup__pet-label">
          <strong>${escapeHtml(petDisplayName)}</strong>
          <span>Lv ${escapeHtml(String(petDisplayLevel ?? "--"))}</span>
        </div>
      </div>
      <div class="boss-battle-popup__boss">
        <img data-boss-anim="popup" src="${escapeHtml(outcomeCopy.bossImage)}" alt="Boss" />
        <div class="boss-battle-popup__boss-label">
          <strong>${escapeHtml(bossStateLabel.toUpperCase())}</strong>
          <span>${escapeHtml(battleStatusLabel)}</span>
        </div>
      </div>
    </div>
  `;

  const reviewCompletePopupHtml =
    reviewModeActive && bossBattleReviewMode.completedVisible
      ? `
        <article class="boss-battle-review-complete">
          <div class="boss-battle-review-complete__panel">
            <span class="boss-battle-popup__badge">Review Complete</span>
            <h2>Đã ôn lại xong</h2>
            <p>Chỉ hiển thị lại các câu sai từ battle session hiện tại.</p>
            <div class="boss-battle-review-complete__stats">
              <div class="boss-battle-review-complete__stat">
                <strong>${escapeHtml(String(bossBattleReviewMode.reviewedCount))}</strong>
                <span>Đã ôn lại</span>
              </div>
              <div class="boss-battle-review-complete__stat">
                <strong>${escapeHtml(String(bossBattleReviewMode.correctCount))}</strong>
                <span>Đúng</span>
              </div>
            </div>
            <div class="boss-battle-review-complete__actions">
              <button type="button" class="boss-battle-popup__action boss-battle-popup__action--primary" data-action="boss-review-back-topic">
                <img src="${getBossBattleIconPath("continue")}" alt="" aria-hidden="true" />
                <span>Quay lại chủ đề</span>
              </button>
              <button type="button" class="boss-battle-popup__action" data-action="boss-review-retry">
                <img src="${getBossBattleIconPath("restart")}" alt="" aria-hidden="true" />
                <span>Làm lại review</span>
              </button>
            </div>
          </div>
        </article>
      `
      : "";

  if (bossBattleState.assetPreloading) {
    screen.classList.remove("hidden");
    screen.innerHTML = `
      <div class="boss-battle-loading">
        <div class="boss-battle-loading__orb" aria-hidden="true">✦</div>
        <div>
          <span class="boss-battle-eyebrow">Boss Battle Quiz</span>
          <h2>Đang chuẩn bị trận đấu...</h2>
          <p>Tài nguyên Boss Battle đang được nạp vào bộ nhớ.</p>
        </div>
      </div>
    `;
    clearBossBattleAnimationTimers();
    resultScreen?.classList.add("hidden");
    reviewScreen?.classList.add("hidden");
    return;
  }

  if (studentQuizState.loadingQuiz) {
    screen.classList.remove("hidden");
    screen.innerHTML = `
      <div class="boss-battle-loading">
        <div class="boss-battle-loading__orb" aria-hidden="true">✦</div>
        <div>
          <span class="boss-battle-eyebrow">Boss Battle Quiz</span>
          <h2>Đang triệu hồi trận chiến...</h2>
          <p>Bộ câu hỏi đang được chuẩn bị ngay trong Dashboard.</p>
        </div>
      </div>
    `;
    clearBossBattleAnimationTimers();
    resultScreen?.classList.add("hidden");
    reviewScreen?.classList.add("hidden");
    return;
  }

  if (bossBattleState.loadingSession) {
    screen.classList.remove("hidden");
    screen.innerHTML = `
      <div class="boss-battle-loading">
        <div class="boss-battle-loading__orb" aria-hidden="true">✦</div>
        <div>
          <span class="boss-battle-eyebrow">Boss Battle Quiz</span>
          <h2>Đang tạo Battle Session...</h2>
          <p>Dữ liệu battle đang được backend khởi tạo.</p>
        </div>
      </div>
    `;
    clearBossBattleAnimationTimers();
    resultScreen?.classList.add("hidden");
    reviewScreen?.classList.add("hidden");
    return;
  }

  if (!quiz || !bossBattleState.sessionId) {
    screen.classList.add("hidden");
    screen.innerHTML = "";
    clearBossBattleAnimationTimers();
    resultScreen?.classList.add("hidden");
    reviewScreen?.classList.add("hidden");
    return;
  }

  screen.classList.remove("hidden");
  if (reviewModeActive) {
    screen.innerHTML = `
      <div class="boss-battle-canvas boss-battle-canvas--review">
        <div class="boss-battle-effects" aria-hidden="true"></div>
        ${bossBattleExitButtonHtml}
        ${activeSidebar}
        <section class="boss-battle-board">
          ${activeHeader}
          ${reviewQuestionPanel}
          ${reviewBattleActionHtml}
          ${reviewCompletePopupHtml}
        </section>
      </div>
    `;
    resultScreen?.classList.add("hidden");
    reviewScreen?.classList.add("hidden");
    clearBossBattleAnimationTimers();
    ensureBossBattleAnimationLoop();
    refreshBossBattleVisualLayer();
    return;
  }

  if (
    !terminalLocked &&
    renderBattleStatus === "active" &&
    popupMode === "none"
  ) {
    screen.innerHTML = `
      <div class="boss-battle-canvas boss-battle-canvas--active">
        <div class="boss-battle-effects" aria-hidden="true"></div>
        ${bossBattleExitButtonHtml}
        ${activeSidebar}
        <section class="boss-battle-board">
          ${activeHeader}
          ${activeQuestionPanel}
          ${activeBattleControlsHtml}
        </section>
      </div>
    `;
  } else {
    screen.innerHTML = `
      <div class="boss-battle-canvas boss-battle-canvas--terminal boss-battle-canvas--${popupMode || renderBattleStatus}">
        <div class="boss-battle-effects" aria-hidden="true"></div>
        ${bossBattleExitButtonHtml}
        ${activeSidebar}
        <section class="boss-battle-board">
          ${activeHeader}
          <article class="boss-battle-popup boss-battle-popup--${popupMode || renderBattleStatus}">
            <div class="boss-battle-popup__content">
              <h2>${escapeHtml(
                popupMode === "victory"
                  ? "CHIẾN THẮNG!"
                  : popupMode === "defeat"
                    ? "HẾT LƯỢT!"
                    : popupMode === "completed"
                      ? "HOÀN THÀNH BÀI!"
                      : outcomeCopy.title,
              )}</h2>
              <p>${escapeHtml(
                popupMode === "victory"
                  ? "Boss đã bị đánh bại."
                  : popupMode === "defeat"
                    ? "Bạn đã hết tim."
                    : popupMode === "completed"
                      ? "Đã hoàn thành toàn bộ câu hỏi."
                      : outcomeCopy.subtitle,
              )}</p>
              ${terminalSceneHtml}
              ${terminalStatsHtml}
              <div class="boss-battle-popup__actions">
                ${getBossBattlePopupButtonSet(popupMode || renderBattleStatus)}
              </div>
            </div>
          </article>
          ${getBossBattleAchievementPopupHtml()}
        </section>
      </div>
    `;
  }

  if (terminalLocked && popupMode === "none" && !reviewModeActive) {
    syncBossBattlePopupManager();
  }

  ensureBossBattleAnimationLoop();
  refreshBossBattleVisualLayer();
}

function renderStudentResultScreen() {
  const screen = getStudentResultScreen();

  if (!screen) {
    return;
  }

  if (isStudentBossBattleScreenActive()) {
    screen.classList.add("hidden");
    screen.innerHTML = "";
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
    <div class="result-card boss-battle-result__card">
      <div class="result-card-header boss-battle-result__header">
        <div>
          <span class="quiz-panel-kicker">Kết quả</span>
          <h2>Bạn đã hoàn thành bài quiz</h2>
        </div>
        <div class="result-score-badge boss-battle-result__score">${escapeHtml(result.score)}%</div>
      </div>

      <div class="result-stats boss-battle-result__stats">
        <div class="result-stat boss-battle-result__stat">
          <strong>${escapeHtml(result.correctAnswers)}</strong>
          <span>đúng</span>
        </div>
        <div class="result-stat boss-battle-result__stat">
          <strong>${escapeHtml(result.totalQuestions)}</strong>
          <span>Tổng câu</span>
        </div>
      </div>

      <div class="result-summary boss-battle-result__summary">
        <p><b>${escapeHtml(result.correctAnswers)}</b> / <b>${escapeHtml(result.totalQuestions)}</b> câu trả lời đúng.</p>
      </div>

      <div class="result-actions boss-battle-result__actions">
        <button type="button" class="quiz-link-btn boss-battle-result__review-btn" data-action="show-wrong-review">
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

  if (isStudentBossBattleScreenActive()) {
    screen.classList.add("hidden");
    screen.innerHTML = "";
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
    <div class="wrong-review-card boss-battle-review__card">
      <div class="wrong-review-header boss-battle-review__header">
        <div>
          <span class="quiz-panel-kicker">Wrong Answer Review</span>
          <h2>Câu trả lời sai</h2>
        </div>
        <div class="wrong-review-count boss-battle-review__count">${escapeHtml(wrongQuestions.length)} câu</div>
      </div>

      ${
        wrongQuestions.length === 0
          ? `<div class="quiz-empty boss-battle-review__empty">Không có câu sai. Bài làm của bạn rất tốt.</div>`
          : `
            <div class="wrong-review-list boss-battle-review__list">
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
                    <article class="wrong-review-item boss-battle-review__item">
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
  if (isStudentBossBattleScreenActive()) {
    ensureStudentBossBattleScreenMounted();
    renderStudentQuizScreen();
    return;
  }

  ensureStudentSubjectsScreenMounted();
  renderStudentTopicCards();
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

  setStudentQuizScreen("subjects");
  studentQuizState.grade = grade || STUDENT_QUIZ_DEFAULTS.grade;
  studentQuizState.subject = subject || STUDENT_QUIZ_DEFAULTS.subject;
  studentQuizState.selectedTopicId = "";
  studentQuizState.quiz = null;
  studentQuizState.answers = [];
  resetQuizSubmissionState();
  resetBossBattleState(0);
  studentQuizState.loadedTopicsKey = "";
  studentQuizState.topicsMessage = "";
  studentQuizState.loadingTopics = true;
  studentQuizState.loadingQuiz = false;

  updateStudentQuizControls();
  renderStudentQuizFlow();

  try {
    studentQuizState.topics = await fetchStudentQuizTopics();
    studentQuizState.loadedTopicsKey = `${studentQuizState.grade}:${studentQuizState.subject}`;
    studentQuizState.topicsMessage = "";
  } catch (error) {
    studentQuizState.topics = [];
    studentQuizState.topicsMessage =
      error.message || "Không thể tải danh sách chủ đề.";
    showToast(studentQuizState.topicsMessage, "error");
  } finally {
    studentQuizState.loadingTopics = false;
    renderStudentTopicCards();
  }
}

async function refreshStudentQuizTopics() {
  const currentTopicsKey = `${studentQuizState.grade}:${studentQuizState.subject}`;

  if (!currentTopicsKey) {
    return;
  }

  try {
    studentStrengthWeaknessCache.clear();
    studentQuizState.topics = await fetchStudentQuizTopics();
    studentQuizState.loadedTopicsKey = currentTopicsKey;
    studentQuizState.topicsMessage = "";
    renderStudentTopicCards();
    void syncStudentStrengthWeakness(getCurrentAuthUser());
  } catch (error) {
    console.warn(
      "[EduKids][studentQuiz] Unable to refresh topic accuracy:",
      error,
    );
  }
}

async function loadStudentQuizByTopic(topicId) {
  const normalizedTopicId = normalizeQuizText(topicId);

  if (!normalizedTopicId) {
    return;
  }

  if (!isAiTopicLearningEnabled()) {
    showToast("AI Học theo chủ đề hiện đang tắt trong hệ thống.", "error");
    return;
  }

  setStudentQuizScreen("bossBattle");
  studentQuizState.selectedTopicId = normalizedTopicId;
  studentQuizState.loadingQuiz = true;
  studentQuizState.quiz = null;
  studentQuizState.answers = [];
  resetQuizSubmissionState();
  resetBossBattleState(0);
  void ensurePetModuleLoaded().catch(() => {});
  bossBattleState.assetPreloading = false;

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

    const quizData = response.data || null;
    const questionCount = Array.isArray(quizData?.questions)
      ? quizData.questions.length
      : 0;

    if (questionCount === 0) {
      studentQuizState.quiz = null;
      resetBossBattleState(0);
      setStudentQuizScreen("subjects");
      renderStudentQuizFlow();
      showToast("Chủ đề này hiện chưa có bộ câu hỏi luyện tập.", "error");
      return;
    }

    studentQuizState.quiz = quizData;
    studentQuizState.answers = [];
    resetBossBattleState(questionCount);
    const restored = await restoreBossBattleSessionFromStorage(quizData);
    if (!restored) {
      await createBossBattleSessionForCurrentQuiz();
    }
  } catch (error) {
    studentQuizState.quiz = null;
    resetBossBattleState(0);
    setStudentQuizScreen("subjects");
    const errorMessage = String(error?.message || "");
    if (
      errorMessage.includes("Quiz not found") ||
      errorMessage.includes("no questions") ||
      errorMessage.includes("AI topic learning is disabled") ||
      errorMessage.includes("không có bộ câu hỏi")
    ) {
      showToast("AI Học theo chủ đề hiện đang tắt trong hệ thống.", "error");
    } else {
      showToast("Không thể tạo bộ câu hỏi. Vui lòng thử lại.", "error");
    }
  } finally {
    studentQuizState.loadingQuiz = false;
    bossBattleState.assetPreloading = false;
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
    if (response.data?.profile) {
      applyLatestCurrentUser(response.data.profile);
    }
    studentQuizState.wrongQuestions = Array.isArray(
      response.data?.wrongQuestions,
    )
      ? response.data.wrongQuestions
      : [];
    studentQuizState.reviewVisible = true;
    renderStudentQuizFlow();
    studentStrengthWeaknessCache.clear();
    void refreshStudentQuizTopics();
    void syncStudentStrengthWeakness(getCurrentAuthUser());
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
  exitBossBattleToTopicSelection();
}

function exitBossBattleToTopicSelection() {
  closeBossBattlePopup();
  closeBossBattleAchievementPopup();
  resetBossBattleReviewMode();
  clearBossBattleRecoveryStorageState();
  clearBossBattleAnimationTimers();
  resetBossBattleState(0);
  setStudentQuizScreen("subjects");
  studentQuizState.selectedTopicId = "";
  studentQuizState.quiz = null;
  studentQuizState.answers = [];
  studentQuizState.pendingTopicId = "";
  resetQuizSubmissionState();
  studentQuizState.loadingQuiz = false;
  renderStudentQuizFlow();
  changePage("subjects");
}

document.addEventListener("click", (event) => {
  const loadTopicsButton = event.target.closest("#quiz-load-topics-btn");

  if (loadTopicsButton && getStudentQuizRoot()?.contains(loadTopicsButton)) {
    playClick();
    void loadStudentQuizTopics();
    return;
  }

  const topicCard = event.target.closest("[data-topic-id]");

  if (topicCard && getStudentQuizRoot()?.contains(topicCard)) {
    playClick();
    void loadStudentQuizByTopic(topicCard.dataset.topicId);
    return;
  }

  const optionButton = event.target.closest(
    "[data-question-index][data-option-label]",
  );

  if (optionButton && getStudentQuizScreen()?.contains(optionButton)) {
    const questionIndex = Number(optionButton.dataset.questionIndex);
    const selected = normalizeQuizText(
      optionButton.dataset.optionLabel,
    ).toUpperCase();

    if (Number.isNaN(questionIndex) || !selected) {
      return;
    }

    playClick();

    if (bossBattleReviewMode.active) {
      if (
        normalizeQuizText(bossBattleReviewMode.answerPhase).toLowerCase() ===
        "reveal"
      ) {
        return;
      }

      bossBattleReviewMode.selectedAnswer = selected;
      bossBattleReviewMode.answerPhase = "selected";
      bossBattleReviewMode.locked = false;
      bossBattleReviewMode.revealedQuestion = null;
      bossBattleReviewMode.revealedCorrectAnswer = "";
      bossBattleReviewMode.revealedCorrect = null;
      renderStudentQuizFlow();
      return;
    }

    if (
      bossBattleState.loadingSession ||
      bossBattleState.answering ||
      normalizeBossBattleStatus(bossBattleState.battleStatus) !== "active"
    ) {
      return;
    }

    if (
      normalizeQuizText(bossBattleState.answerPhase).toLowerCase() === "reveal"
    ) {
      return;
    }

    bossBattleState.selectedAnswer = selected;
    bossBattleState.selectedQuestionIndex = questionIndex;
    bossBattleState.answerPhase = "selected";
    bossBattleState.revealedQuestion = null;
    bossBattleState.revealedCorrectAnswer = "";
    bossBattleState.revealedCorrect = null;
    renderStudentQuizFlow();
    return;
  }

  const actionButton = event.target.closest("[data-action]");

  if (actionButton && getStudentQuizRoot()?.contains(actionButton)) {
    const action = actionButton.dataset.action;
    const shouldPlayClick =
      actionButton.closest(".boss-battle-popup") ||
      action === "battle-answer-commit" ||
      action === "battle-answer-continue" ||
      action === "boss-review-commit" ||
      action === "boss-review-continue" ||
      action === "battle-hint" ||
      action === "boss-battle-exit" ||
      action === "boss-review-back-topic" ||
      action === "boss-review-retry" ||
      action === "show-wrong-review" ||
      action === "boss-achievement-close";

    if (shouldPlayClick) {
      playClick();
    }

    if (action === "battle-answer-commit") {
      if (bossBattleState.terminalLocked) {
        return;
      }
      const questionIndex = Number(bossBattleState.selectedQuestionIndex) || 0;
      const selected = normalizeQuizText(
        bossBattleState.selectedAnswer,
      ).toUpperCase();

      if (
        !selected ||
        normalizeQuizText(bossBattleState.answerPhase).toLowerCase() ===
          "reveal"
      ) {
        return;
      }

      void submitBossBattleAnswer(questionIndex, selected).catch((error) => {
        showToast(error.message || "Không thể gửi đáp án.", "error");
      });
      return;
    }

    if (action === "battle-answer-continue") {
      continueBossBattleQuestion();
      return;
    }

    if (action === "boss-review-commit") {
      const questionIndex =
        Number(bossBattleReviewMode.currentQuestionIndex) || 0;
      const selected = normalizeQuizText(
        bossBattleReviewMode.selectedAnswer,
      ).toUpperCase();

      if (
        !selected ||
        normalizeQuizText(bossBattleReviewMode.answerPhase).toLowerCase() ===
          "reveal"
      ) {
        return;
      }

      submitBossBattleReviewAnswer(questionIndex, selected);
      return;
    }

    if (action === "boss-review-continue") {
      advanceBossBattleReviewQuestion();
      return;
    }

    if (action === "battle-hint") {
      if (bossBattleState.terminalLocked) {
        return;
      }
      void requestBossBattleHint().catch((error) => {
        showToast(error.message || "Không thể dùng gợi ý.", "error");
      });
      return;
    }

    if (action === "battle-popup-exit") {
      closeBossBattlePopup();
      goBackSubjects();
      return;
    }

    if (action === "boss-battle-exit") {
      exitBossBattleToTopicSelection();
      return;
    }

    if (action === "battle-popup-continue") {
      closeBossBattlePopup();
      goBackSubjects();
      return;
    }

    if (action === "battle-popup-review-wrong") {
      closeBossBattlePopup();
      showBossBattleWrongAnswerReview();
      return;
    }

    if (action === "battle-popup-retry") {
      const topicId = normalizeQuizText(
        bossBattleState.topicId || studentQuizState.selectedTopicId || "",
      );

      closeBossBattlePopup();

      if (topicId) {
        void loadStudentQuizByTopic(topicId);
      }
      return;
    }

    if (action === "boss-review-back-topic") {
      closeBossBattleReviewMode();
      goBackSubjects();
      return;
    }

    if (action === "boss-review-retry") {
      restartBossBattleReviewMode();
      return;
    }

    if (action === "show-wrong-review") {
      showStudentWrongAnswerReview();
      return;
    }

    if (action === "boss-achievement-close") {
      closeBossBattleAchievementPopup();
    }
  }
});

function bindStudentQuizControlsOnce() {
  if (studentQuizControlsBound) {
    return;
  }

  const appShell = getAppShell();

  if (appShell) {
    appShell.addEventListener("change", (event) => {
      const gradeSelect = event.target.closest("#quiz-grade-select");
      const subjectSelect = event.target.closest("#quiz-subject-select");

      if (!gradeSelect && !subjectSelect) {
        return;
      }

      if (gradeSelect) {
        studentQuizState.grade =
          normalizeQuizText(gradeSelect.value) || STUDENT_QUIZ_DEFAULTS.grade;
      }

      if (subjectSelect) {
        studentQuizState.subject =
          normalizeQuizText(subjectSelect.value) ||
          STUDENT_QUIZ_DEFAULTS.subject;
      }

      void loadStudentQuizTopics();
    });
  }

  studentQuizControlsBound = true;
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

  setStudentQuizScreen("subjects");

  updateStudentQuizControls();

  const currentTopicsKey = `${studentQuizState.grade}:${studentQuizState.subject}`;

  if (
    !studentQuizState.topics.length ||
    studentQuizState.loadedTopicsKey !== currentTopicsKey
  ) {
    await loadStudentQuizTopics();
  } else {
    renderStudentQuizFlow();
  }

  if (studentQuizState.pendingTopicId) {
    const pendingTopicId = studentQuizState.pendingTopicId;
    studentQuizState.pendingTopicId = "";
    await loadStudentQuizByTopic(pendingTopicId);
  }
}

const manualAssignmentState = {
  classes: [],
  classId: "",
  className: "",
  title: "",
  description: "",
  subject: "Math",
  dueDate: "",
  questions: [],
};

const assignmentAiState = {
  topics: [],
  topicsKey: "",
  topicId: "",
  topicName: "",
  grade: "4",
  questionCount: "10",
  difficulty: "Trung bình",
  notes: "",
  questions: [],
  loadingTopics: false,
  loading: false,
  error: "",
};

const classroomState = {
  classes: [],
  selectedClassId: "",
  loading: false,
};

const studentAssignmentClassState = {
  classes: [],
  selectedClassId: "",
  loading: false,
};

let manualAssignmentFormBound = false;
let teacherAssignmentsUnsubscribe = null;
let currentAssignments = [];
let currentAssignmentId = "";
let studentAssignmentSubmissionLoading = false;
const studentAssignmentDetailState = {
  visible: false,
  assignment: null,
  answers: [],
};
const teacherAssignmentSubmissionState = {
  assignments: [],
  selectedAssignmentId: "",
  submissions: [],
  submissionsByAssignmentId: new Map(),
  classes: [],
  classFilter: "",
  searchQuery: "",
  loading: false,
  error: "",
  controlsBound: false,
  classesLoaded: false,
  classesLoading: false,
  submissionsLoadingByAssignmentId: new Set(),
  assignmentsHydrationToken: 0,
};
const currentTeacherAssignmentDetail = {
  visible: false,
  loading: false,
  error: "",
  assignment: null,
  classInfo: null,
  classStudents: [],
  submissions: [],
  studentRows: [],
  selectedStudentId: "",
  selectedSubmission: null,
  selectedStudentProfile: null,
  submissionByStudentId: new Map(),
  profileByStudentId: new Map(),
  loadingStudentId: "",
  requestId: 0,
};
const teacherDashboardState = {
  loading: false,
  loaded: false,
  teacherId: "",
  data: null,
  pendingPromise: null,
};
const teacherStatsState = {
  loading: false,
  loaded: false,
  teacherId: "",
  selectedClassId: "",
  selectedRange: "7d",
  assignmentExpanded: false,
  data: null,
  pendingPromise: null,
  renderToken: 0,
};
const teacherStatsViewCache = new Map();
const isDevelopmentBuild =
  Boolean(import.meta?.env?.DEV) ||
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "::1";
let createMethod = "manual";

function getCurrentUserId() {
  const user = getCurrentAuthUser();

  return String(user?.userId || user?.uid || user?.id || "").trim();
}

function getAssignmentService() {
  return window.EduKidsAssignmentService || null;
}

function getFirestoreInstance() {
  if (
    !window.firebase?.apps?.length ||
    typeof window.firebase.app !== "function"
  ) {
    return null;
  }

  if (typeof window.firebase.firestore !== "function") {
    return null;
  }

  try {
    return window.firebase.app().firestore();
  } catch (error) {
    console.warn("Unable to initialize Firestore:", error);
    return null;
  }
}

const ADMIN_NO_RESULTS_MESSAGE = "Không tìm thấy dữ liệu phù hợp";

function normalizeAdminSearchValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getAdminSearchIndex(...parts) {
  return normalizeAdminSearchValue(parts.filter(Boolean).join(" "));
}

function normalizeTeacherManageSearchValue(value) {
  return normalizeAdminSearchValue(value);
}

function getTeacherAssignmentSearchIndex(assignment) {
  return normalizeTeacherManageSearchValue(
    [
      assignment?.title,
      assignment?.description,
      assignment?.subject,
      assignment?.topic,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function getTeacherAssignmentClassroomStudentCount(classroom) {
  if (!classroom || typeof classroom !== "object") {
    return 0;
  }

  const students = Array.isArray(classroom.students)
    ? classroom.students
    : Array.isArray(classroom.studentIds)
      ? classroom.studentIds
      : Array.isArray(classroom.members)
        ? classroom.members
        : [];

  const uniqueStudents = uniqueClassroomValues(
    students.map((student) => {
      if (student && typeof student === "object") {
        return String(
          student.id ||
            student.studentId ||
            student.userId ||
            student.uid ||
            student.username ||
            student.name ||
            "",
        ).trim();
      }

      return String(student || "").trim();
    }),
  ).filter(Boolean);

  if (uniqueStudents.length > 0) {
    return uniqueStudents.length;
  }

  const studentCount = Number(
    classroom.studentCount ?? classroom.studentsCount ?? 0,
  );

  return Number.isFinite(studentCount) ? studentCount : 0;
}

function getTeacherAssignmentClassroomById(classId) {
  const normalizedClassId = String(classId || "").trim();

  if (!normalizedClassId) {
    return null;
  }

  return Array.isArray(teacherAssignmentSubmissionState.classes)
    ? teacherAssignmentSubmissionState.classes.find(
        (classroom) => classroom.id === normalizedClassId,
      )
    : null;
}

function getTeacherAssignmentSubmittedStudentsCount(assignmentId) {
  const normalizedAssignmentId = String(assignmentId || "").trim();

  if (!normalizedAssignmentId) {
    return 0;
  }

  const submissions =
    teacherAssignmentSubmissionState.submissionsByAssignmentId.get(
      normalizedAssignmentId,
    );

  if (!Array.isArray(submissions) || submissions.length === 0) {
    return 0;
  }

  return uniqueClassroomValues(
    submissions.map((submission) => String(submission?.studentId || "").trim()),
  ).length;
}

function calculateTeacherAssignmentProgressPercent(
  submittedStudents,
  totalStudents,
) {
  const submitted = Number(submittedStudents) || 0;
  const total = Number(totalStudents) || 0;

  if (total <= 0) {
    return 0;
  }

  return Math.round((submitted / total) * 100);
}

function getTeacherAssignmentProgressClass(percent) {
  const value = Number(percent) || 0;

  if (value <= 33) {
    return "is-red";
  }

  if (value <= 67) {
    return "is-yellow";
  }

  return "is-green";
}

function getTeacherAssignmentProgressSummary(assignment) {
  const classroom = getTeacherAssignmentClassroomById(assignment?.classId);
  const totalStudents = getTeacherAssignmentClassroomStudentCount(classroom);
  const submittedStudents = getTeacherAssignmentSubmittedStudentsCount(
    assignment?.id,
  );
  const progressPercent = calculateTeacherAssignmentProgressPercent(
    submittedStudents,
    totalStudents,
  );

  return {
    submittedStudents,
    totalStudents,
    progressPercent,
    progressClass: getTeacherAssignmentProgressClass(progressPercent),
  };
}

function getTeacherAssignmentClassLabel(assignment) {
  const classroom = getTeacherAssignmentClassroomById(assignment?.classId);

  return (
    classroom?.name ||
    classroom?.className ||
    assignment?.className ||
    assignment?.classId ||
    "Lớp học"
  );
}

async function deleteTeacherAssignmentById(assignmentId) {
  const normalizedAssignmentId = String(assignmentId || "").trim();

  if (!normalizedAssignmentId) {
    throw new Error("assignmentId is required");
  }

  const firestore = getFirestoreInstance();

  if (!firestore) {
    throw new Error("Firestore is unavailable");
  }

  const batch = firestore.batch();
  const assignmentRef = firestore
    .collection("assignments")
    .doc(normalizedAssignmentId);
  const submissionsQuery = await firestore
    .collection("assignment_submissions")
    .where("assignmentId", "==", normalizedAssignmentId)
    .get();

  submissionsQuery.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  batch.delete(assignmentRef);

  await batch.commit();
}

async function handleDeleteTeacherAssignment(assignment) {
  const normalizedAssignmentId = String(assignment?.id || "").trim();

  if (!normalizedAssignmentId) {
    showToast("Không tìm thấy bài tập để xóa.", "error");
    return;
  }

  const confirmed = window.confirm(
    `Xóa bài tập "${assignment.title || "Bài tập"}"? Hành động này không thể hoàn tác.`,
  );

  if (!confirmed) {
    return;
  }

  try {
    await deleteTeacherAssignmentById(normalizedAssignmentId);
    teacherAssignmentSubmissionState.submissionsByAssignmentId.delete(
      normalizedAssignmentId,
    );
    teacherAssignmentSubmissionState.assignments =
      teacherAssignmentSubmissionState.assignments.filter(
        (item) => String(item?.id || "").trim() !== normalizedAssignmentId,
      );

    if (
      String(
        teacherAssignmentSubmissionState.selectedAssignmentId || "",
      ).trim() === normalizedAssignmentId
    ) {
      teacherAssignmentSubmissionState.selectedAssignmentId = "";
      teacherAssignmentSubmissionState.submissions = [];
    }

    showToast("Đã xóa bài tập.", "success");
    renderTeacherAssignmentSubmissionsView(
      teacherAssignmentSubmissionState.assignments,
      teacherAssignmentSubmissionState.submissions,
      teacherAssignmentSubmissionState.loading,
      teacherAssignmentSubmissionState.error,
    );

    if (currentTeacherAssignmentDetail.visible) {
      closeTeacherAssignmentDetail();
    }
  } catch (error) {
    console.warn("Không thể xóa bài tập:", error);
    showToast(error.message || "Không thể xóa bài tập.", "error");
  }
}

function getTeacherAssignmentFilteredAssignments(assignments) {
  const normalizedAssignments = Array.isArray(assignments) ? assignments : [];
  const searchQuery = normalizeTeacherManageSearchValue(
    teacherAssignmentSubmissionState.searchQuery,
  );
  const selectedClassId = String(
    teacherAssignmentSubmissionState.classFilter || "",
  ).trim();

  return normalizedAssignments.filter((assignment) => {
    if (
      selectedClassId &&
      String(assignment?.classId || "").trim() !== selectedClassId
    ) {
      return false;
    }

    if (!searchQuery) {
      return true;
    }

    return getTeacherAssignmentSearchIndex(assignment).includes(searchQuery);
  });
}

function syncTeacherAssignmentFilterControls() {
  const searchInput = document.querySelector(
    "#manage [data-teacher-assignment-search]",
  );
  const classSelect = document.querySelector(
    "#manage [data-teacher-assignment-class-filter]",
  );

  if (
    searchInput &&
    searchInput.value !== teacherAssignmentSubmissionState.searchQuery
  ) {
    searchInput.value = teacherAssignmentSubmissionState.searchQuery;
  }

  if (
    classSelect &&
    classSelect.value !== teacherAssignmentSubmissionState.classFilter
  ) {
    classSelect.value = teacherAssignmentSubmissionState.classFilter;
  }
}

function renderTeacherAssignmentClassFilterOptions() {
  const classSelect = document.querySelector(
    "#manage [data-teacher-assignment-class-filter]",
  );

  if (!classSelect) {
    return;
  }

  const classes = Array.isArray(teacherAssignmentSubmissionState.classes)
    ? teacherAssignmentSubmissionState.classes
    : [];
  const currentSelectedClassId = String(
    teacherAssignmentSubmissionState.classFilter || "",
  ).trim();
  const availableClassIds = new Set(
    classes.map((classroom) => String(classroom?.id || "").trim()),
  );
  const nextSelectedClassId =
    currentSelectedClassId && availableClassIds.has(currentSelectedClassId)
      ? currentSelectedClassId
      : "";

  teacherAssignmentSubmissionState.classFilter = nextSelectedClassId;

  classSelect.innerHTML = `
    <option value="">Tất cả lớp</option>
    ${
      classes.length > 0
        ? classes
            .map((classroom) => {
              const classId = String(classroom?.id || "").trim();
              const classLabel =
                classroom?.name || classroom?.className || classId || "Lớp học";

              return `
                <option value="${escapeHtml(classId)}">${escapeHtml(classLabel)}</option>
              `;
            })
            .join("")
        : ""
    }
  `;

  classSelect.disabled = classes.length === 0;
  classSelect.value = nextSelectedClassId;

  if (classes.length === 0) {
    classSelect.innerHTML = `
      <option value="">Tất cả lớp</option>
      <option value="" disabled>Chưa có lớp khả dụng</option>
    `;
  }
}

async function loadTeacherAssignmentClasses() {
  if (teacherAssignmentSubmissionState.classesLoading) {
    return teacherAssignmentSubmissionState.classes;
  }

  const classSelect = document.querySelector(
    "#manage [data-teacher-assignment-class-filter]",
  );

  teacherAssignmentSubmissionState.classesLoading = true;

  try {
    if (classSelect) {
      classSelect.disabled = true;
      classSelect.innerHTML = `
        <option value="">Đang tải lớp...</option>
      `;
    }

    const response = await apiRequestWithAuth("/api/classes/my", {
      method: "GET",
    });

    const classes = sortClassroomRecords(
      Array.isArray(response?.data)
        ? response.data.map(normalizeClassroomRecord).filter(Boolean)
        : [],
    );

    teacherAssignmentSubmissionState.classes = classes;
    teacherAssignmentSubmissionState.classesLoaded = true;
    renderTeacherAssignmentClassFilterOptions();
    syncTeacherAssignmentFilterControls();
    if (
      Array.isArray(teacherAssignmentSubmissionState.assignments) &&
      teacherAssignmentSubmissionState.assignments.length > 0
    ) {
      renderTeacherAssignmentSubmissionsView(
        teacherAssignmentSubmissionState.assignments,
        teacherAssignmentSubmissionState.submissions,
        teacherAssignmentSubmissionState.loading,
        teacherAssignmentSubmissionState.error,
      );
    }
    return classes;
  } catch (error) {
    console.warn("Không thể tải danh sách lớp của giáo viên:", error);
    teacherAssignmentSubmissionState.classes = [];
    teacherAssignmentSubmissionState.classesLoaded = true;
    renderTeacherAssignmentClassFilterOptions();
    syncTeacherAssignmentFilterControls();
    if (
      Array.isArray(teacherAssignmentSubmissionState.assignments) &&
      teacherAssignmentSubmissionState.assignments.length > 0
    ) {
      renderTeacherAssignmentSubmissionsView(
        teacherAssignmentSubmissionState.assignments,
        teacherAssignmentSubmissionState.submissions,
        teacherAssignmentSubmissionState.loading,
        teacherAssignmentSubmissionState.error,
      );
    }
    return [];
  } finally {
    teacherAssignmentSubmissionState.classesLoading = false;
  }
}

async function hydrateTeacherAssignmentSubmissionCache(assignments = []) {
  const normalizedAssignments = Array.isArray(assignments)
    ? assignments.filter((assignment) => String(assignment?.id || "").trim())
    : [];

  if (normalizedAssignments.length === 0) {
    teacherAssignmentSubmissionState.submissionsByAssignmentId.clear();
    return;
  }

  const requestToken =
    teacherAssignmentSubmissionState.assignmentsHydrationToken + 1;
  teacherAssignmentSubmissionState.assignmentsHydrationToken = requestToken;

  const service = getAssignmentService();

  if (!service?.fetchAssignmentSubmissions) {
    return;
  }

  const missingAssignments = normalizedAssignments.filter((assignment) => {
    const normalizedAssignmentId = String(assignment.id || "").trim();
    return (
      !teacherAssignmentSubmissionState.submissionsByAssignmentId.has(
        normalizedAssignmentId,
      ) &&
      !teacherAssignmentSubmissionState.submissionsLoadingByAssignmentId.has(
        normalizedAssignmentId,
      )
    );
  });

  if (missingAssignments.length === 0) {
    return;
  }

  await Promise.all(
    missingAssignments.map(async (assignment) => {
      const normalizedAssignmentId = String(assignment.id || "").trim();

      if (!normalizedAssignmentId) {
        return;
      }

      teacherAssignmentSubmissionState.submissionsLoadingByAssignmentId.add(
        normalizedAssignmentId,
      );

      try {
        const submissions = await service.fetchAssignmentSubmissions(
          normalizedAssignmentId,
        );

        if (
          teacherAssignmentSubmissionState.assignmentsHydrationToken !==
          requestToken
        ) {
          return;
        }

        const normalizedSubmissions = Array.isArray(submissions)
          ? submissions
              .map((submission) =>
                normalizeTeacherAssignmentSubmissionRecord(submission),
              )
              .filter(Boolean)
          : [];

        teacherAssignmentSubmissionState.submissionsByAssignmentId.set(
          normalizedAssignmentId,
          normalizedSubmissions,
        );
      } catch (error) {
        console.warn(
          "[EduKids][teacher-assignments] Không thể tải submissions cho bài tập",
          normalizedAssignmentId,
          error,
        );
        teacherAssignmentSubmissionState.submissionsByAssignmentId.set(
          normalizedAssignmentId,
          [],
        );
      } finally {
        teacherAssignmentSubmissionState.submissionsLoadingByAssignmentId.delete(
          normalizedAssignmentId,
        );
      }
    }),
  );

  if (
    teacherAssignmentSubmissionState.assignmentsHydrationToken !== requestToken
  ) {
    return;
  }

  renderTeacherAssignmentSubmissionsView(
    teacherAssignmentSubmissionState.assignments,
    teacherAssignmentSubmissionState.submissions,
    teacherAssignmentSubmissionState.loading,
    teacherAssignmentSubmissionState.error,
  );
}

function bindTeacherAssignmentFilterControlsOnce() {
  const manageRoot = document.getElementById("manage");

  if (!manageRoot || teacherAssignmentSubmissionState.controlsBound) {
    return;
  }

  manageRoot.addEventListener("input", (event) => {
    const searchInput = event.target.closest(
      "[data-teacher-assignment-search]",
    );

    if (!searchInput) {
      return;
    }

    teacherAssignmentSubmissionState.searchQuery = searchInput.value || "";
    renderTeacherAssignmentSubmissionsView(
      teacherAssignmentSubmissionState.assignments,
      teacherAssignmentSubmissionState.submissions,
      teacherAssignmentSubmissionState.loading,
      teacherAssignmentSubmissionState.error,
    );
  });

  manageRoot.addEventListener("change", (event) => {
    const classSelect = event.target.closest(
      "[data-teacher-assignment-class-filter]",
    );

    if (!classSelect) {
      return;
    }

    teacherAssignmentSubmissionState.classFilter = classSelect.value || "";
    renderTeacherAssignmentSubmissionsView(
      teacherAssignmentSubmissionState.assignments,
      teacherAssignmentSubmissionState.submissions,
      teacherAssignmentSubmissionState.loading,
      teacherAssignmentSubmissionState.error,
    );
  });

  teacherAssignmentSubmissionState.controlsBound = true;
}

function getStudentAssignmentFeedNodes() {
  const page = getAssignmentsPageRoot();

  if (!page) {
    return [];
  }

  return Array.from(
    page.querySelectorAll(
      "h1, .assignments-toolbar, .assignment-tabs, .assignment-tab",
    ),
  );
}

function setStudentAssignmentFeedVisibility(isVisible) {
  getStudentAssignmentFeedNodes().forEach((node) => {
    node.hidden = !isVisible;
  });
}

function getStudentAssignmentSelectedAnswer(questionIndex) {
  const normalizedQuestionIndex = Number(questionIndex);

  if (
    !Number.isInteger(normalizedQuestionIndex) ||
    normalizedQuestionIndex < 0
  ) {
    return "";
  }

  return (
    studentAssignmentDetailState.answers.find(
      (item) => item.questionIndex === normalizedQuestionIndex,
    )?.selected || ""
  );
}

function setStudentAssignmentSelectedAnswer(questionIndex, selected) {
  const normalizedQuestionIndex = Number(questionIndex);
  const normalizedSelected = String(selected || "")
    .trim()
    .toUpperCase();

  if (
    !Number.isInteger(normalizedQuestionIndex) ||
    normalizedQuestionIndex < 0
  ) {
    return;
  }

  const existingIndex = studentAssignmentDetailState.answers.findIndex(
    (item) => item.questionIndex === normalizedQuestionIndex,
  );

  if (existingIndex >= 0) {
    studentAssignmentDetailState.answers[existingIndex].selected =
      normalizedSelected;
  } else {
    studentAssignmentDetailState.answers.push({
      questionIndex: normalizedQuestionIndex,
      selected: normalizedSelected,
    });
  }
}

function normalizeStudentAssignmentRecord(assignment, fallbackClassId = "") {
  if (!assignment || typeof assignment !== "object") {
    return null;
  }

  const status =
    String(assignment.status || "")
      .trim()
      .toLowerCase() || "pending";
  const dueDate = assignment.dueDate === "" ? null : assignment.dueDate || null;

  return {
    id: String(
      assignment.id || assignment.assignmentId || assignment.docId || "",
    ).trim(),
    classId: String(assignment.classId || fallbackClassId || "").trim(),
    className: String(assignment.className || assignment.class || "").trim(),
    title: String(assignment.title || "").trim(),
    description: String(assignment.description || "").trim(),
    subject: String(assignment.subject || "").trim(),
    dueDate,
    status,
    createdAt: assignment.createdAt || "",
    updatedAt: assignment.updatedAt || "",
    questions: Array.isArray(assignment.questions) ? assignment.questions : [],
    submissionStatus:
      String(assignment.submissionStatus || "")
        .trim()
        .toLowerCase() || "",
    submissionId: String(assignment.submissionId || "").trim(),
    submittedAt: assignment.submittedAt || "",
    score: assignment.score ?? null,
    correctCount: Number.isFinite(Number(assignment.correctCount))
      ? Number(assignment.correctCount)
      : null,
    wrongCount: Number.isFinite(Number(assignment.wrongCount))
      ? Number(assignment.wrongCount)
      : null,
    totalQuestions: Number.isFinite(Number(assignment.totalQuestions))
      ? Number(assignment.totalQuestions)
      : Number.isFinite(Number(assignment.questionCount))
        ? Number(assignment.questionCount)
        : Array.isArray(assignment.questions)
          ? assignment.questions.length
          : null,
    gradedAt: assignment.gradedAt || "",
  };
}

function parseStudentAssignmentDueDateTimestamp(dueDate) {
  const rawDueDate = String(dueDate || "").trim();

  if (!rawDueDate) {
    return null;
  }

  const normalizedDueDate =
    rawDueDate.includes(" ") && !rawDueDate.includes("T")
      ? rawDueDate.replace(" ", "T")
      : rawDueDate;
  const parsedTime = Date.parse(normalizedDueDate);

  return Number.isFinite(parsedTime) ? parsedTime : null;
}

function isStudentAssignmentPastDue(assignment, now = Date.now()) {
  const dueTimestamp = parseStudentAssignmentDueDateTimestamp(
    assignment?.dueDate,
  );

  if (dueTimestamp === null) {
    return false;
  }

  return dueTimestamp < now;
}

function shouldHideStudentAssignmentFromFeed(assignment) {
  if (!assignment) {
    return true;
  }

  if (normalizeStudentAssignmentStatus(assignment) === "done") {
    return false;
  }

  return isStudentAssignmentPastDue(assignment);
}

function normalizeStudentAssignmentQuestionOptions(question) {
  if (!question || typeof question !== "object") {
    return [];
  }

  if (Array.isArray(question.options)) {
    return question.options
      .map((option, index) => {
        if (option && typeof option === "object") {
          return {
            label: String(option.label || String.fromCharCode(65 + index))
              .trim()
              .toUpperCase(),
            text: String(
              option.text || option.answer || option.value || "",
            ).trim(),
          };
        }

        return {
          label: String.fromCharCode(65 + index),
          text: String(option || "").trim(),
        };
      })
      .filter((option) => option.text)
      .slice(0, 4);
  }

  return [];
}

function getCurrentStudentAssignment() {
  if (currentAssignmentId) {
    const selectedAssignment =
      currentAssignments.find(
        (assignment) => assignment.id === currentAssignmentId,
      ) || null;

    if (selectedAssignment) {
      return selectedAssignment;
    }
  }

  if (window.EduKidsCurrentAssignment?.id) {
    return window.EduKidsCurrentAssignment;
  }

  return currentAssignments[0] || null;
}

function getStudentAssignmentWorkRoot() {
  return (
    document.querySelector(
      [
        "[data-student-assignment-root]",
        "[data-assignment-detail-root]",
        "[data-assignment-detail]",
        "[data-assignment-work-root]",
        "[data-assignment-work]",
        ".assignment-detail",
        ".assignment-work",
        ".student-assignment-work",
      ].join(","),
    ) || getAssignmentsPageRoot()
  );
}

function normalizeAssignmentAnswerPayload(value, questionIndex = null) {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const payload = { selected: trimmed };

    if (Number.isInteger(questionIndex) && questionIndex >= 0) {
      payload.questionIndex = questionIndex;
    }

    return payload;
  }

  if (typeof value === "object") {
    const normalized = {
      questionIndex:
        Number.isInteger(Number(value.questionIndex)) &&
        Number(value.questionIndex) >= 0
          ? Number(value.questionIndex)
          : Number.isInteger(Number(value.index)) && Number(value.index) >= 0
            ? Number(value.index)
            : Number.isInteger(questionIndex) && questionIndex >= 0
              ? questionIndex
              : null,
      selected: String(
        value.selected ??
          value.answer ??
          value.value ??
          value.choice ??
          value.label ??
          value.option ??
          "",
      ).trim(),
    };

    if (value.questionId) {
      normalized.questionId = String(value.questionId).trim();
    }

    if (!normalized.selected) {
      return null;
    }

    if (normalized.questionIndex === null) {
      delete normalized.questionIndex;
    }

    return normalized;
  }

  return normalizeAssignmentAnswerPayload(String(value), questionIndex);
}

function getAssignmentAnswersFromElement(root) {
  const answers = [];
  const seenQuestionIndexes = new Set();
  const seenQuestionIds = new Set();

  if (!root) {
    return answers;
  }

  const answerBlocks = Array.from(
    root.querySelectorAll(
      [
        "[data-question-index]",
        "[data-assignment-question]",
        "[data-assignment-question-index]",
        "[data-question-block]",
      ].join(","),
    ),
  );

  answerBlocks.forEach((block, fallbackIndex) => {
    const rawQuestionIndex = String(
      block.dataset.questionIndex ||
        block.dataset.assignmentQuestionIndex ||
        block.dataset.assignmentQuestion ||
        fallbackIndex,
    ).trim();
    const numericQuestionIndex = Number(rawQuestionIndex);
    const normalizedQuestionIndex =
      Number.isInteger(numericQuestionIndex) && numericQuestionIndex >= 0
        ? numericQuestionIndex
        : fallbackIndex;
    const questionId = String(
      block.dataset.questionId || block.dataset.assignmentQuestionId || "",
    ).trim();

    const selectedButton = block.querySelector(
      [
        "[data-option-label].is-selected",
        "[data-option-label][aria-pressed='true']",
        "[data-answer-label].is-selected",
        "[data-answer-label][aria-pressed='true']",
      ].join(","),
    );

    if (selectedButton) {
      const payload = normalizeAssignmentAnswerPayload(
        {
          questionIndex: normalizedQuestionIndex,
          selected:
            selectedButton.dataset.optionLabel ||
            selectedButton.dataset.answerLabel ||
            selectedButton.textContent ||
            "",
          questionId,
        },
        normalizedQuestionIndex,
      );

      if (payload) {
        if (questionId) {
          payload.questionId = questionId;
        }

        answers.push(payload);
        seenQuestionIndexes.add(
          String(payload.questionIndex ?? normalizedQuestionIndex),
        );
        if (questionId) {
          seenQuestionIds.add(questionId);
        }
      }
      return;
    }

    const checkedRadio = block.querySelector("input[type='radio']:checked");

    if (checkedRadio) {
      const payload = normalizeAssignmentAnswerPayload(
        {
          questionIndex: normalizedQuestionIndex,
          selected:
            checkedRadio.dataset.optionLabel ||
            checkedRadio.dataset.answerLabel ||
            checkedRadio.value ||
            checkedRadio.dataset.value ||
            "",
          questionId,
        },
        normalizedQuestionIndex,
      );

      if (payload) {
        if (questionId) {
          payload.questionId = questionId;
        }

        answers.push(payload);
        seenQuestionIndexes.add(
          String(payload.questionIndex ?? normalizedQuestionIndex),
        );
        if (questionId) {
          seenQuestionIds.add(questionId);
        }
      }
      return;
    }

    const checkedCheckbox = block.querySelector(
      "input[type='checkbox']:checked",
    );

    if (checkedCheckbox) {
      const payload = normalizeAssignmentAnswerPayload(
        {
          questionIndex: normalizedQuestionIndex,
          selected:
            checkedCheckbox.dataset.optionLabel ||
            checkedCheckbox.dataset.answerLabel ||
            checkedCheckbox.value ||
            checkedCheckbox.dataset.value ||
            "",
          questionId,
        },
        normalizedQuestionIndex,
      );

      if (payload) {
        if (questionId) {
          payload.questionId = questionId;
        }

        answers.push(payload);
        seenQuestionIndexes.add(
          String(payload.questionIndex ?? normalizedQuestionIndex),
        );
        if (questionId) {
          seenQuestionIds.add(questionId);
        }
      }
      return;
    }

    const selectField = block.querySelector("select");

    if (selectField && String(selectField.value || "").trim()) {
      const payload = normalizeAssignmentAnswerPayload(
        {
          questionIndex: normalizedQuestionIndex,
          selected: selectField.value,
          questionId,
        },
        normalizedQuestionIndex,
      );

      if (payload) {
        if (questionId) {
          payload.questionId = questionId;
        }

        answers.push(payload);
        seenQuestionIndexes.add(
          String(payload.questionIndex ?? normalizedQuestionIndex),
        );
        if (questionId) {
          seenQuestionIds.add(questionId);
        }
      }
      return;
    }

    const textField = block.querySelector(
      "textarea, input[type='text'], input:not([type])",
    );

    if (textField && String(textField.value || "").trim()) {
      const payload = normalizeAssignmentAnswerPayload(
        {
          questionIndex: normalizedQuestionIndex,
          selected: textField.value,
          questionId,
        },
        normalizedQuestionIndex,
      );

      if (payload) {
        if (questionId) {
          payload.questionId = questionId;
        }

        answers.push(payload);
        seenQuestionIndexes.add(
          String(payload.questionIndex ?? normalizedQuestionIndex),
        );
        if (questionId) {
          seenQuestionIds.add(questionId);
        }
      }
    }
  });

  if (answers.length > 0) {
    return answers;
  }

  const namedInputs = Array.from(
    root.querySelectorAll(
      "input, select, textarea, [data-assignment-answer], [data-answer]",
    ),
  );

  namedInputs.forEach((field, index) => {
    const value =
      field.dataset.assignmentAnswer ||
      field.dataset.answer ||
      field.value ||
      field.textContent ||
      "";
    const questionIndexValue =
      field.dataset.questionIndex ||
      field.dataset.assignmentQuestionIndex ||
      field.name ||
      index;
    const payload = normalizeAssignmentAnswerPayload(
      {
        questionIndex: questionIndexValue,
        selected: value,
        questionId:
          field.dataset.questionId || field.dataset.assignmentQuestionId || "",
      },
      Number(questionIndexValue),
    );

    if (payload) {
      answers.push(payload);
    }
  });

  return answers.filter((item, index, list) => {
    const key = `${item.questionId || ""}:${item.questionIndex ?? index}`;

    if (seenQuestionIds.has(item.questionId || "")) {
      return !list.slice(0, index).some((previous) => {
        const previousKey = `${previous.questionId || ""}:${previous.questionIndex ?? index}`;
        return previousKey === key;
      });
    }

    if (seenQuestionIndexes.has(String(item.questionIndex ?? index))) {
      return !list.slice(0, index).some((previous) => {
        const previousKey = `${previous.questionId || ""}:${previous.questionIndex ?? index}`;
        return previousKey === key;
      });
    }

    return true;
  });
}

function collectStudentAssignmentAnswers(
  assignment,
  root = getStudentAssignmentWorkRoot(),
) {
  const explicitAnswers =
    Array.isArray(assignment?.answers) && assignment.answers.length > 0
      ? assignment.answers
      : Array.isArray(window.EduKidsCurrentAssignment?.answers) &&
          window.EduKidsCurrentAssignment.answers.length > 0
        ? window.EduKidsCurrentAssignment.answers
        : [];

  if (explicitAnswers.length > 0) {
    return explicitAnswers
      .map((answer, index) => normalizeAssignmentAnswerPayload(answer, index))
      .filter(Boolean);
  }

  const domAnswers = getAssignmentAnswersFromElement(root);

  return domAnswers
    .map((answer, index) => normalizeAssignmentAnswerPayload(answer, index))
    .filter(Boolean);
}

function setStudentAssignmentSubmitButtonState(
  button,
  isLoading,
  originalLabel = "",
) {
  if (!button) {
    return;
  }

  if (!button.dataset.originalLabel) {
    button.dataset.originalLabel = originalLabel || button.textContent || "";
  }

  button.disabled = isLoading;
  button.textContent = isLoading
    ? "Đang nộp..."
    : button.dataset.originalLabel ||
      originalLabel ||
      button.textContent ||
      "Nộp bài";
}

function markStudentAssignmentAsSubmitted(assignmentId, submission = null) {
  const normalizedAssignmentId = String(assignmentId || "").trim();

  if (!normalizedAssignmentId) {
    return null;
  }

  currentAssignments = currentAssignments.map((assignment) => {
    if (assignment.id !== normalizedAssignmentId) {
      return assignment;
    }

    return {
      ...assignment,
      status:
        String(submission?.status || "graded")
          .trim()
          .toLowerCase() || "graded",
      submissionStatus: "graded",
      submissionId: String(submission?.id || "").trim(),
      submittedAt: submission?.submittedAt || new Date().toISOString(),
      score: submission?.score ?? null,
      correctCount: Number.isFinite(Number(submission?.correctCount))
        ? Number(submission.correctCount)
        : null,
      wrongCount: Number.isFinite(Number(submission?.wrongCount))
        ? Number(submission.wrongCount)
        : null,
      totalQuestions: Number.isFinite(Number(submission?.totalQuestions))
        ? Number(submission.totalQuestions)
        : null,
      gradedAt: submission?.gradedAt || "",
    };
  });

  const updatedAssignment =
    currentAssignments.find(
      (assignment) => assignment.id === normalizedAssignmentId,
    ) || null;

  if (updatedAssignment) {
    window.EduKidsCurrentAssignment = updatedAssignment;

    if (
      studentAssignmentDetailState.assignment &&
      String(studentAssignmentDetailState.assignment.id || "").trim() ===
        normalizedAssignmentId
    ) {
      studentAssignmentDetailState.assignment = updatedAssignment;
    }
  }

  renderStudentAssignmentTabs(currentAssignments);
  return updatedAssignment;
}

function normalizeTeacherAssignmentSubmissionRecord(submission) {
  if (!submission || typeof submission !== "object") {
    return null;
  }

  return {
    id: String(submission.id || "").trim(),
    assignmentId: String(submission.assignmentId || "").trim(),
    classId: String(submission.classId || "").trim(),
    studentId: String(submission.studentId || "").trim(),
    studentName: String(submission.studentName || "").trim(),
    submittedAt: submission.submittedAt || "",
    score: submission.score ?? null,
    correctCount: Number.isFinite(Number(submission.correctCount))
      ? Number(submission.correctCount)
      : null,
    wrongCount: Number.isFinite(Number(submission.wrongCount))
      ? Number(submission.wrongCount)
      : null,
    totalQuestions: Number.isFinite(Number(submission.totalQuestions))
      ? Number(submission.totalQuestions)
      : null,
    status:
      String(submission.status || "")
        .trim()
        .toLowerCase() || "submitted",
  };
}

function renderTeacherAssignmentSubmissionsView(
  assignments,
  submissions = [],
  loading = false,
  error = "",
) {
  const list = document.querySelector("#manage .manage-list");

  if (!list) {
    return;
  }

  const normalizedAssignments =
    getTeacherAssignmentFilteredAssignments(assignments);
  const assignmentCards =
    normalizedAssignments.length > 0
      ? normalizedAssignments
          .map((assignment) => {
            const questionCount =
              Number(assignment.totalQuestions || assignment.questionCount) ||
              (Array.isArray(assignment.questions)
                ? assignment.questions.length
                : 0);
            const progressSummary =
              getTeacherAssignmentProgressSummary(assignment);
            const progressPercent = progressSummary.progressPercent;
            const isActive =
              String(
                teacherAssignmentSubmissionState.selectedAssignmentId || "",
              ).trim() === String(assignment.id || "").trim();

            return `
            <article class="manage-card ${isActive ? "is-active" : ""}">
              <div class="manage-card-top">
                <div>
                  <h3>${escapeHtml(assignment.title || "Bài tập")}</h3>
                  <p>${escapeHtml(getTeacherAssignmentClassLabel(assignment))}</p>
                </div>
                <span class="manage-date">Ngày giao: ${escapeHtml(formatAssignmentDate(assignment.createdAt))}</span>
              </div>

              <div class="manage-card-meta">
                <span>${questionCount} câu hỏi</span>
                <strong>${escapeHtml(formatAssignmentStatusLabel(assignment.status))}</strong>
              </div>

              <div class="manage-progress">
                <div class="manage-progress-track">
                  <div class="manage-progress-fill ${escapeHtml(progressSummary.progressClass)}" style="width: ${escapeHtml(String(progressPercent))}%"></div>
                </div>
                <span class="manage-progress-label">
                  <strong>${escapeHtml(String(progressPercent))}%</strong>
                  <span>${escapeHtml(String(progressSummary.submittedStudents))}/${escapeHtml(String(progressSummary.totalStudents))} học sinh</span>
                </span>
              </div>

              <div class="manage-card-actions">
                <button
                  type="button"
                  class="manage-delete-btn"
                  data-assignment-delete-id="${escapeHtml(assignment.id)}"
                >
                  <span aria-hidden="true">🗑</span>
                  <span>Xóa bài tập</span>
                </button>
                <button
                  type="button"
                  class="manage-detail-btn"
                  data-assignment-id="${escapeHtml(assignment.id)}"
                >
                  Xem chi tiết
                </button>
              </div>
            </article>
          `;
          })
          .join("")
      : Array.isArray(assignments) && assignments.length > 0
        ? `
        <div class="manage-empty-state">
          <h3>Không tìm thấy bài tập phù hợp.</h3>
          <p>Hãy thử đổi từ khóa tìm kiếm hoặc chọn lớp khác.</p>
        </div>
      `
        : `
      <div class="manage-empty-state">
        <h3>Chưa có bài tập nào.</h3>
        <p>Bài tập sẽ được xuất hiện ở đây sau khi bạn lưu.</p>
      </div>
    `;

  list.innerHTML = assignmentCards;
  renderTeacherAssignmentClassFilterOptions();
  syncTeacherAssignmentFilterControls();

  if (currentTeacherAssignmentDetail.visible) {
    setTeacherAssignmentDetailVisibility(true);
    renderTeacherAssignmentDetail();
  } else {
    setTeacherAssignmentDetailVisibility(false);
  }
}

function normalizeTeacherSubmissionStatusKey(submission) {
  const rawStatus = String(submission?.status || "")
    .trim()
    .toLowerCase();

  if (
    rawStatus === "doing" ||
    rawStatus === "in_progress" ||
    rawStatus === "in-progress" ||
    rawStatus === "started"
  ) {
    return "doing";
  }

  if (
    rawStatus === "submitted" ||
    rawStatus === "graded" ||
    rawStatus === "done" ||
    rawStatus === "completed" ||
    rawStatus === "complete"
  ) {
    return "submitted";
  }

  return "pending";
}

function getTeacherSubmissionStatusLabel(statusKey) {
  if (statusKey === "doing") {
    return "Đang làm";
  }

  if (statusKey === "submitted") {
    return "Đã nộp";
  }

  return "Chưa nộp";
}

function getTeacherSubmissionStatusClass(statusKey) {
  if (statusKey === "doing") {
    return "doing";
  }

  if (statusKey === "submitted") {
    return "submitted";
  }

  return "pending";
}

function getTeacherSubmissionScoreText(submission) {
  if (
    submission?.score === null ||
    typeof submission?.score === "undefined" ||
    submission?.score === ""
  ) {
    return "--";
  }

  return `${String(submission.score)}/10`;
}

function normalizeTeacherQuestionChoices(question) {
  if (
    !question ||
    typeof question !== "object" ||
    !Array.isArray(question.options)
  ) {
    return [];
  }

  return question.options
    .map((option, index) => {
      const label = String.fromCharCode(65 + index);

      if (option && typeof option === "object") {
        const text = String(
          option.text || option.answer || option.value || "",
        ).trim();
        const normalizedValue = String(
          option.value || option.text || option.answer || text || "",
        ).trim();

        return {
          label,
          text,
          value: normalizedValue || text,
        };
      }

      const text = String(option || "").trim();

      return {
        label,
        text,
        value: text,
      };
    })
    .filter((choice) => choice.text)
    .slice(0, 4);
}

function normalizeTeacherQuestionCorrectLabel(question) {
  const direct = String(
    question?.correctAnswer || question?.answer || question?.correct || "",
  )
    .trim()
    .toUpperCase();

  if (!direct) {
    return "";
  }

  if (/^[A-Z]$/.test(direct)) {
    return direct;
  }

  const choices = normalizeTeacherQuestionChoices(question);
  const matched = choices.find((choice) => {
    const normalizedText = String(choice.text || "")
      .trim()
      .toUpperCase();
    const normalizedValue = String(choice.value || "")
      .trim()
      .toUpperCase();

    return normalizedText === direct || normalizedValue === direct;
  });

  return matched?.label || direct;
}

function normalizeTeacherSubmissionAnswerValue(answer) {
  if (answer === null || typeof answer === "undefined") {
    return "";
  }

  if (
    typeof answer === "string" ||
    typeof answer === "number" ||
    typeof answer === "boolean"
  ) {
    return String(answer).trim().toUpperCase();
  }

  if (typeof answer !== "object") {
    return "";
  }

  return String(
    answer.selected ??
      answer.answer ??
      answer.correctAnswer ??
      answer.value ??
      answer.text ??
      answer.label ??
      answer.option ??
      "",
  )
    .trim()
    .toUpperCase();
}

function normalizeTeacherSelectedLabel(answer, question) {
  const normalizedAnswer = normalizeTeacherSubmissionAnswerValue(answer);

  if (!normalizedAnswer) {
    return "";
  }

  if (/^[A-Z]$/.test(normalizedAnswer)) {
    return normalizedAnswer;
  }

  const choices = normalizeTeacherQuestionChoices(question);
  const matched = choices.find((choice) => {
    const normalizedText = String(choice.text || "")
      .trim()
      .toUpperCase();
    const normalizedValue = String(choice.value || "")
      .trim()
      .toUpperCase();

    return (
      normalizedText === normalizedAnswer ||
      normalizedValue === normalizedAnswer
    );
  });

  return matched?.label || normalizedAnswer;
}

function getTeacherAnswerDisplayText(answer, question) {
  const normalizedAnswer = normalizeTeacherSubmissionAnswerValue(answer);

  if (!normalizedAnswer) {
    return "--";
  }

  const choices = normalizeTeacherQuestionChoices(question);
  const matchedChoice = choices.find((choice) => {
    const normalizedText = String(choice.text || "")
      .trim()
      .toUpperCase();
    const normalizedValue = String(choice.value || "")
      .trim()
      .toUpperCase();

    return (
      normalizedText === normalizedAnswer ||
      normalizedValue === normalizedAnswer ||
      choice.label === normalizedAnswer
    );
  });

  if (matchedChoice) {
    return `${matchedChoice.label}. ${matchedChoice.text}`;
  }

  return normalizedAnswer;
}

function getTeacherSubmissionAnswerByIndex(
  submission,
  question,
  questionIndex,
) {
  const answers = Array.isArray(submission?.answers) ? submission.answers : [];

  if (answers.length === 0) {
    return null;
  }

  const directAnswer = answers[questionIndex];

  if (directAnswer) {
    return directAnswer;
  }

  const questionId = String(question?.id || question?.questionId || "").trim();

  if (questionId) {
    const matched = answers.find((answer) => {
      if (!answer || typeof answer !== "object") {
        return false;
      }

      return String(answer.questionId || answer.id || "").trim() === questionId;
    });

    if (matched) {
      return matched;
    }
  }

  const matchedIndex = answers.find((answer) => {
    if (!answer || typeof answer !== "object") {
      return false;
    }

    if (!Number.isFinite(Number(answer.questionIndex))) {
      return false;
    }

    return Number(answer.questionIndex) === questionIndex;
  });

  return matchedIndex || null;
}

function buildTeacherSubmissionQuestionReviews(assignment, submission) {
  const questions = Array.isArray(assignment?.questions)
    ? assignment.questions
    : [];

  return questions.map((question, questionIndex) => {
    const answer = getTeacherSubmissionAnswerByIndex(
      submission,
      question,
      questionIndex,
    );
    const studentLabel = normalizeTeacherSelectedLabel(answer, question);
    const correctLabel = normalizeTeacherQuestionCorrectLabel(question);
    const isCorrect = Boolean(
      studentLabel && correctLabel && studentLabel === correctLabel,
    );
    const choices = normalizeTeacherQuestionChoices(question);
    const studentAnswerText = getTeacherAnswerDisplayText(answer, question);
    const correctChoice = choices.find(
      (choice) => choice.label === correctLabel,
    );
    const correctAnswerText = correctChoice
      ? `${correctChoice.label}. ${correctChoice.text}`
      : correctLabel || "--";

    return {
      questionIndex,
      questionNumber: questionIndex + 1,
      questionText:
        String(
          question?.question || question?.text || question?.content || "--",
        ).trim() || "--",
      studentAnswerText,
      correctAnswerText,
      isCorrect,
      pointText: isCorrect ? "1 điểm" : "0 điểm",
      resultLabel: isCorrect ? "✓ Chính xác" : "✗ Sai",
      resultClass: isCorrect ? "is-correct" : "is-wrong",
    };
  });
}

function normalizeTeacherStudentProfile(student = {}) {
  return {
    id: String(student?.id || student?.studentId || "").trim(),
    name: String(
      student?.name ||
        student?.fullName ||
        student?.username ||
        student?.studentName ||
        student?.id ||
        "",
    ).trim(),
    username: String(
      student?.username || student?.name || student?.fullName || "",
    ).trim(),
    avatar: String(
      student?.avatar || student?.photoURL || student?.profilePicture || "",
    ).trim(),
  };
}

function normalizeTeacherAssignmentStudentRecord(
  student,
  submission = null,
  profile = null,
) {
  const normalizedProfile = normalizeTeacherStudentProfile(profile || student);
  const normalizedSubmission =
    normalizeTeacherAssignmentSubmissionRecord(submission);
  const statusKey = normalizedSubmission
    ? normalizeTeacherSubmissionStatusKey(normalizedSubmission)
    : "pending";

  return {
    id: String(
      student?.id ||
        student?.studentId ||
        normalizedSubmission?.studentId ||
        "",
    ).trim(),
    name:
      normalizedProfile.name ||
      normalizedSubmission?.studentName ||
      String(
        student?.name || student?.fullName || student?.username || "",
      ).trim() ||
      normalizedSubmission?.studentId ||
      "--",
    username:
      normalizedProfile.username ||
      normalizedProfile.name ||
      normalizedSubmission?.studentName ||
      "--",
    avatar: normalizedProfile.avatar || "",
    statusKey,
    statusLabel: getTeacherSubmissionStatusLabel(statusKey),
    statusClass: getTeacherSubmissionStatusClass(statusKey),
    submittedAt: normalizedSubmission?.submittedAt || "",
    score: normalizedSubmission?.score ?? null,
    correctCount: normalizedSubmission?.correctCount ?? null,
    wrongCount: normalizedSubmission?.wrongCount ?? null,
    submission: normalizedSubmission,
    profile: profile || null,
  };
}

function getTeacherAssignmentTotalStudents(classStudents, submissions) {
  const studentIds = uniqueClassroomValues([
    ...(Array.isArray(classStudents) ? classStudents : []).map(
      (student) => student?.id,
    ),
    ...(Array.isArray(submissions) ? submissions : []).map(
      (submission) => submission?.studentId,
    ),
  ]);

  return studentIds.length;
}

function getTeacherAssignmentSummaryStats(rows) {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const submittedRows = normalizedRows.filter(
    (row) => row.statusKey === "submitted",
  );
  const doingRows = normalizedRows.filter((row) => row.statusKey === "doing");
  const scoreValues = submittedRows
    .map((row) => Number(row.score))
    .filter((score) => Number.isFinite(score));
  const averageScore = scoreValues.length
    ? scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length
    : 0;

  return {
    submittedCount: submittedRows.length,
    doingCount: doingRows.length,
    averageScore,
  };
}

function getTeacherAssignmentSelectedStudentId() {
  const detail = currentTeacherAssignmentDetail;
  const assignment = detail.assignment;
  const studentRows = Array.isArray(detail.studentRows)
    ? detail.studentRows
    : [];

  if (!assignment) {
    return "";
  }

  if (
    detail.selectedStudentId &&
    studentRows.some((row) => row.id === detail.selectedStudentId)
  ) {
    return detail.selectedStudentId;
  }

  const firstSubmitted = studentRows.find(
    (row) => row.statusKey === "submitted",
  );

  if (firstSubmitted) {
    return firstSubmitted.id;
  }

  return studentRows[0]?.id || "";
}

function renderTeacherStudentSubmission(studentRow = null) {
  const detail = currentTeacherAssignmentDetail;
  const assignment = detail.assignment;
  const questionReviews = buildTeacherSubmissionQuestionReviews(
    assignment,
    studentRow?.submission || detail.selectedSubmission || null,
  );
  const selectedProfile =
    studentRow?.profile || detail.selectedStudentProfile || null;
  const avatarPath =
    selectedProfile?.avatar ||
    studentRow?.avatar ||
    (window.EduKidsProfileService?.getAvatarPathFromProfile
      ? window.EduKidsProfileService.getAvatarPathFromProfile({
          avatar: studentRow?.avatar || "",
          role: "student",
        })
      : "assets/userAvatar/boy.png");
  const badgeClass = studentRow?.statusClass || "pending";
  const submittedAt = studentRow?.submittedAt
    ? formatDateTime(studentRow.submittedAt)
    : "--";
  const scoreText = studentRow
    ? getTeacherSubmissionScoreText(studentRow)
    : "--";
  const correctCount = studentRow?.correctCount;
  const wrongCount = studentRow?.wrongCount;
  const questionCount = questionReviews.length;

  return `
    <div class="teacher-assignment-sidebar-card">
      <div class="teacher-assignment-sidebar-header">
        <div class="teacher-assignment-sidebar-profile">
          <img
            class="teacher-assignment-sidebar-avatar"
            src="${escapeHtml(avatarPath || "assets/userAvatar/boy.png")}"
            alt="${escapeHtml(studentRow?.name || "Học sinh")}"
          />
          <div>
            <h3>${escapeHtml(studentRow?.name || "--")}</h3>
            <p>${escapeHtml(studentRow?.username || studentRow?.name || "--")}</p>
          </div>
        </div>
        <span class="teacher-assignment-status-badge is-${escapeHtml(badgeClass)}">
          ${escapeHtml(studentRow?.statusLabel || "Chưa nộp")}
        </span>
      </div>

      <div class="teacher-assignment-sidebar-meta">
        <div class="teacher-assignment-sidebar-row">
          <span>Ngày nộp</span>
          <strong>${escapeHtml(submittedAt)}</strong>
        </div>
        <div class="teacher-assignment-sidebar-row">
          <span>Điểm</span>
          <strong>${escapeHtml(scoreText)}</strong>
        </div>
        <div class="teacher-assignment-sidebar-row">
          <span>Số câu đúng</span>
          <strong>${escapeHtml(Number.isFinite(Number(correctCount)) ? String(correctCount) : "0")}</strong>
        </div>
        <div class="teacher-assignment-sidebar-row">
          <span>Số câu sai</span>
          <strong>${escapeHtml(Number.isFinite(Number(wrongCount)) ? String(wrongCount) : String(questionCount > 0 ? Math.max(questionCount - Number(correctCount || 0), 0) : 0))}</strong>
        </div>
      </div>

      <div class="teacher-assignment-question-list">
        <h4>Chi tiết từng câu hỏi</h4>
        ${
          questionReviews.length > 0
            ? questionReviews
                .map(
                  (question) => `
                    <article class="teacher-assignment-question-card ${escapeHtml(question.resultClass)}">
                      <div class="teacher-assignment-question-head">
                        <strong>Câu ${question.questionNumber}</strong>
                        <span>${escapeHtml(question.pointText)}</span>
                      </div>
                      <p class="teacher-assignment-question-text">${escapeHtml(question.questionText)}</p>
                      <div class="teacher-assignment-question-row">
                        <span>Đáp án học sinh</span>
                        <strong>${escapeHtml(question.studentAnswerText)}</strong>
                      </div>
                      <div class="teacher-assignment-question-row">
                        <span>Đáp án đúng</span>
                        <strong>${escapeHtml(question.correctAnswerText)}</strong>
                      </div>
                      <div class="teacher-assignment-question-result">${escapeHtml(question.resultLabel)}</div>
                    </article>
                  `,
                )
                .join("")
            : `
              <div class="manage-empty-state">
                <h3>Chưa có câu hỏi</h3>
                <p>Bài tập này chưa có câu hỏi để hiển thị.</p>
              </div>
            `
        }
      </div>
    </div>
  `;
}

function renderTeacherAssignmentDetail() {
  const detail = currentTeacherAssignmentDetail;
  const root = getTeacherAssignmentDetailRoot();

  if (!root) {
    return;
  }

  if (!detail.visible || !detail.assignment) {
    root.hidden = true;
    root.innerHTML = "";
    setTeacherAssignmentDetailVisibility(false);
    return;
  }

  const assignment = detail.assignment;
  const studentRows = Array.isArray(detail.studentRows)
    ? detail.studentRows
    : [];
  const classStudents = Array.isArray(detail.classStudents)
    ? detail.classStudents
    : [];
  const submissions = Array.isArray(detail.submissions)
    ? detail.submissions
    : [];
  const selectedStudentId = getTeacherAssignmentSelectedStudentId();
  const selectedRow =
    studentRows.find((row) => row.id === selectedStudentId) ||
    studentRows[0] ||
    null;
  const stats = getTeacherAssignmentSummaryStats(studentRows);
  const totalStudents = getTeacherAssignmentTotalStudents(
    classStudents,
    submissions,
  );
  const unansweredCount = Math.max(
    totalStudents - stats.submittedCount - stats.doingCount,
    0,
  );
  const topicText = String(
    assignment.topic || assignment.description || assignment.subject || "",
  ).trim();
  const classLabel =
    assignment.className ||
    detail.classInfo?.name ||
    detail.classInfo?.className ||
    assignment.classId ||
    "--";
  const subjectLabel = assignment.subject || "--";
  const dateAssigned = formatAssignmentDate(assignment.createdAt);
  const dueDate = assignment.dueDate
    ? formatAssignmentDate(assignment.dueDate)
    : "--";
  const maxScore = 10;
  const averageScore = Number.isFinite(stats.averageScore)
    ? stats.averageScore.toFixed(1)
    : "0.0";

  root.hidden = false;
  root.innerHTML = `
    <div class="teacher-assignment-detail-shell">
      <div class="teacher-assignment-detail-main">
        <header class="teacher-assignment-detail-header">
          <button type="button" class="teacher-assignment-back-btn" data-teacher-assignment-back>
            ← Quay lại danh sách bài tập
          </button>

          <button type="button" class="teacher-assignment-close-btn" data-teacher-assignment-close aria-label="Đóng chi tiết bài tập">
            ×
          </button>
        </header>

        <section class="teacher-assignment-hero">
          <div class="teacher-assignment-hero-copy">
            <h1>${escapeHtml(assignment.title || "--")}</h1>
            <div class="teacher-assignment-hero-line">
              <span class="teacher-assignment-hero-pill">${escapeHtml(subjectLabel)}</span>
              <span class="teacher-assignment-hero-text">Chủ đề: ${escapeHtml(topicText || "--")}</span>
            </div>
            <div class="teacher-assignment-hero-dates">
              <div class="teacher-assignment-hero-date">
                <span>Ngày giao</span>
                <strong>${escapeHtml(dateAssigned)}</strong>
              </div>
              <div class="teacher-assignment-hero-date">
                <span>Hạn nộp</span>
                <strong>${escapeHtml(dueDate)}</strong>
              </div>
            </div>
          </div>
        </section>

        ${
          detail.error
            ? `
              <div class="manage-empty-state">
                <h3>Không thể tải đầy đủ dữ liệu</h3>
                <p>${escapeHtml(detail.error)}</p>
              </div>
            `
            : ""
        }

        <section class="teacher-assignment-stats">
          <article class="teacher-assignment-stat-card teacher-assignment-stat-card-green">
            <span>Đã nộp</span>
            <strong>${escapeHtml(String(stats.submittedCount))}</strong>
          </article>
          <article class="teacher-assignment-stat-card teacher-assignment-stat-card-blue">
            <span>Đang làm</span>
            <strong>${escapeHtml(String(stats.doingCount))}</strong>
          </article>
          <article class="teacher-assignment-stat-card teacher-assignment-stat-card-orange">
            <span>Chưa làm</span>
            <strong>${escapeHtml(String(unansweredCount))}</strong>
          </article>
          <article class="teacher-assignment-stat-card teacher-assignment-stat-card-purple">
            <span>Điểm trung bình</span>
            <strong>${escapeHtml(averageScore)}<small>/10</small></strong>
          </article>
        </section>

        <section class="teacher-assignment-info">
          <h2>Thông tin bài tập</h2>
          <div class="teacher-assignment-info-grid">
            <div class="teacher-assignment-info-item">
              <span>Mô tả</span>
              <strong>${escapeHtml(assignment.description || "--")}</strong>
            </div>
            <div class="teacher-assignment-info-item">
              <span>Khối lớp</span>
              <strong>${escapeHtml(classLabel)}</strong>
            </div>
            <div class="teacher-assignment-info-item">
              <span>Môn học</span>
              <strong>${escapeHtml(subjectLabel)}</strong>
            </div>
            <div class="teacher-assignment-info-item">
              <span>Số câu hỏi</span>
              <strong>${escapeHtml(String(Array.isArray(assignment.questions) ? assignment.questions.length : 0))} câu</strong>
            </div>
            <div class="teacher-assignment-info-item">
              <span>Điểm tối đa</span>
              <strong>${escapeHtml(String(maxScore))} điểm</strong>
            </div>
          </div>
        </section>

        <section class="teacher-assignment-students">
          <div class="teacher-assignment-section-head">
            <h2>Danh sách học sinh</h2>
          </div>

          <div class="teacher-assignment-table-wrap">
            <table class="teacher-assignment-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Học sinh</th>
                  <th>Trạng thái</th>
                  <th>Điểm</th>
                  <th>Ngày nộp</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                ${
                  studentRows.length > 0
                    ? studentRows
                        .map((row, index) => {
                          const isActive = row.id === selectedRow?.id;
                          const scoreDisplay =
                            row.statusKey === "submitted"
                              ? getTeacherSubmissionScoreText(row)
                              : "--";
                          const submittedAtText = row.submittedAt
                            ? formatDateTime(row.submittedAt)
                            : "--";

                          return `
                            <tr class="${isActive ? "is-active" : ""}" data-teacher-student-row data-student-id="${escapeHtml(row.id)}">
                              <td>${escapeHtml(String(index + 1))}</td>
                              <td>
                                <div class="teacher-assignment-student">
                                  <img
                                    src="${escapeHtml(
                                      row.avatar ||
                                        (window.EduKidsProfileService
                                          ?.getAvatarPathFromProfile
                                          ? window.EduKidsProfileService.getAvatarPathFromProfile(
                                              {
                                                role: "student",
                                                gender: "male",
                                              },
                                            )
                                          : "assets/userAvatar/boy.png"),
                                    )}"
                                    alt="${escapeHtml(row.name || "Học sinh")}"
                                  />
                                  <span>${escapeHtml(row.name || "--")}</span>
                                </div>
                              </td>
                              <td><span class="teacher-assignment-row-badge is-${escapeHtml(row.statusClass)}">${escapeHtml(row.statusLabel)}</span></td>
                              <td>${escapeHtml(scoreDisplay)}</td>
                              <td>${escapeHtml(submittedAtText)}</td>
                              <td>
                                <button
                                  type="button"
                                  class="teacher-assignment-view-btn"
                                  data-teacher-student-view
                                  data-student-id="${escapeHtml(row.id)}"
                                >
                                  Xem
                                </button>
                              </td>
                            </tr>
                          `;
                        })
                        .join("")
                    : `
                      <tr>
                        <td colspan="6">
                          <div class="manage-empty-state">
                            <h3>Chưa có học sinh</h3>
                            <p>Lớp này chưa có học sinh để hiển thị.</p>
                          </div>
                        </td>
                      </tr>
                    `
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <aside class="teacher-assignment-sidebar">
        <div class="teacher-assignment-sidebar-head">
          <h2>Chi tiết bài làm</h2>
        </div>
        ${
          currentTeacherAssignmentDetail.loading ||
          currentTeacherAssignmentDetail.loadingStudentId
            ? `
              <div class="manage-empty-state">
                <h3>Đang tải bài làm...</h3>
                <p>Vui lòng chờ trong giây lát.</p>
              </div>
            `
            : renderTeacherStudentSubmission(selectedRow)
        }
      </aside>
    </div>
  `;

  setTeacherAssignmentDetailVisibility(true);
}

async function selectTeacherAssignmentStudent(studentId) {
  const detail = currentTeacherAssignmentDetail;
  const normalizedStudentId = String(studentId || "").trim();
  const requestId = detail.requestId;
  const studentRows = Array.isArray(detail.studentRows)
    ? detail.studentRows
    : [];

  if (!detail.visible || !detail.assignment || !normalizedStudentId) {
    return;
  }

  detail.selectedStudentId = normalizedStudentId;
  detail.loadingStudentId = normalizedStudentId;
  renderTeacherAssignmentDetail();

  const cachedSubmission =
    detail.submissionByStudentId.get(normalizedStudentId) || null;
  const cachedProfile =
    detail.profileByStudentId.get(normalizedStudentId) || null;
  const [submission, profile] = await Promise.all([
    cachedSubmission?.answers?.length
      ? Promise.resolve(cachedSubmission)
      : window.EduKidsAssignmentService?.fetchAssignmentSubmissionByStudent
        ? window.EduKidsAssignmentService.fetchAssignmentSubmissionByStudent(
            detail.assignment.id,
            normalizedStudentId,
          ).catch(() => null)
        : Promise.resolve(null),
    cachedProfile
      ? Promise.resolve(cachedProfile)
      : window.EduKidsProfileService?.fetchProfileById
        ? window.EduKidsProfileService.fetchProfileById(
            normalizedStudentId,
          ).catch(() => null)
        : Promise.resolve(null),
  ]);

  if (!detail.visible || detail.requestId !== requestId) {
    return;
  }

  if (submission) {
    detail.submissionByStudentId.set(normalizedStudentId, submission);
  }

  if (profile) {
    detail.profileByStudentId.set(normalizedStudentId, profile);
  }

  const selectedSubmission =
    submission || detail.submissionByStudentId.get(normalizedStudentId) || null;
  const selectedProfile =
    profile || detail.profileByStudentId.get(normalizedStudentId) || null;
  const existingRow =
    studentRows.find((row) => row.id === normalizedStudentId) || null;
  const selectedRow = normalizeTeacherAssignmentStudentRecord(
    existingRow || {
      id: normalizedStudentId,
      name:
        selectedProfile?.name ||
        selectedProfile?.fullName ||
        selectedProfile?.username ||
        normalizedStudentId,
      username: selectedProfile?.username || "",
      avatar: selectedProfile?.avatar || "",
    },
    selectedSubmission,
    selectedProfile,
  );

  detail.selectedSubmission = selectedSubmission;
  detail.selectedStudentProfile = selectedProfile;
  detail.studentRows = studentRows.map((row) =>
    row.id === normalizedStudentId ? { ...row, ...selectedRow } : row,
  );
  detail.loadingStudentId = "";
  renderTeacherAssignmentDetail();
}

function normalizeStudentAssignmentStatus(assignment) {
  const rawSubmissionStatus = String(assignment?.submissionStatus || "")
    .trim()
    .toLowerCase();
  const rawStatus =
    rawSubmissionStatus ||
    String(assignment?.status || "")
      .trim()
      .toLowerCase();

  if (
    rawStatus === "doing" ||
    rawStatus === "in_progress" ||
    rawStatus === "in-progress" ||
    rawStatus === "started"
  ) {
    return "doing";
  }

  if (
    rawStatus === "done" ||
    rawStatus === "completed" ||
    rawStatus === "complete" ||
    rawStatus === "submitted" ||
    rawStatus === "graded" ||
    rawStatus === "finished"
  ) {
    return "done";
  }

  if (
    rawStatus === "pending" ||
    rawStatus === "active" ||
    rawStatus === "assigned" ||
    rawStatus === "todo" ||
    rawStatus === "to-do" ||
    rawStatus === "not_started" ||
    rawStatus === "not-started"
  ) {
    return "pending";
  }

  return "pending";
}

function getAssignmentDetailStatusValue(assignment) {
  const submissionStatus = String(assignment?.submissionStatus || "")
    .trim()
    .toLowerCase();

  if (submissionStatus) {
    return submissionStatus;
  }

  return (
    String(assignment?.status || "")
      .trim()
      .toLowerCase() || "pending"
  );
}

function getAssignmentDetailStatusLabel(assignment) {
  if (getCurrentRole() === "teacher") {
    return formatAssignmentStatusLabel(assignment?.status);
  }

  const statusValue = getAssignmentDetailStatusValue(assignment);

  if (statusValue === "graded") {
    return "Đã chấm";
  }

  if (statusValue === "submitted") {
    return "Đã nộp";
  }

  if (statusValue === "doing") {
    return "Đang làm";
  }

  if (statusValue === "done") {
    return "Hoàn thành";
  }

  if (statusValue === "pending" || statusValue === "active") {
    return "Chưa mở";
  }

  return statusValue || "--";
}

function getAssignmentDetailPrimaryActionLabel(assignment) {
  const role = getCurrentRole();
  const statusKey = normalizeStudentAssignmentStatus(assignment);

  if (role === "teacher") {
    return "Xem submissions";
  }

  if (statusKey === "doing") {
    return "Tiếp tục";
  }

  if (statusKey === "done") {
    return "Xem lại";
  }

  return "Làm bài";
}

function getAssignmentDetailPrimaryActionClass(assignment) {
  const role = getCurrentRole();

  if (role === "teacher") {
    return "manage-detail-btn";
  }

  return "action-btn";
}

function getAssignmentDetailScoreBadgeText(assignment) {
  const statusValue = getAssignmentDetailStatusValue(assignment);

  if (statusValue !== "graded") {
    return "";
  }

  if (
    assignment?.score === null ||
    typeof assignment?.score === "undefined" ||
    assignment?.score === ""
  ) {
    return "";
  }

  return `${String(assignment.score)} điểm`;
}

function normalizeAssignmentDetailRecord(assignment) {
  if (!assignment || typeof assignment !== "object") {
    return null;
  }

  return {
    ...assignment,
    id: String(
      assignment.id || assignment.assignmentId || assignment.docId || "",
    ).trim(),
    classId: String(assignment.classId || "").trim(),
    title: String(assignment.title || "").trim(),
    description: String(assignment.description || "").trim(),
    dueDate: assignment.dueDate === "" ? "" : assignment.dueDate || "",
    status:
      String(assignment.status || "")
        .trim()
        .toLowerCase() || "active",
    submissionStatus:
      String(assignment.submissionStatus || "")
        .trim()
        .toLowerCase() || "",
    submittedAt: assignment.submittedAt || "",
    score: assignment.score ?? null,
    correctCount: Number.isFinite(Number(assignment.correctCount))
      ? Number(assignment.correctCount)
      : null,
    wrongCount: Number.isFinite(Number(assignment.wrongCount))
      ? Number(assignment.wrongCount)
      : null,
    totalQuestions: Number.isFinite(Number(assignment.totalQuestions))
      ? Number(assignment.totalQuestions)
      : Number.isFinite(Number(assignment.questionCount))
        ? Number(assignment.questionCount)
        : Array.isArray(assignment.questions)
          ? assignment.questions.length
          : null,
    gradedAt: assignment.gradedAt || "",
    questions: Array.isArray(assignment.questions) ? assignment.questions : [],
  };
}

function formatStudentAssignmentStatusLabel(statusKey, assignment = null) {
  const rawSubmissionStatus = String(assignment?.submissionStatus || "")
    .trim()
    .toLowerCase();

  if (statusKey === "doing") {
    return "Đang làm";
  }

  if (statusKey === "done") {
    if (rawSubmissionStatus === "graded") {
      return "Đã chấm";
    }

    return "Hoàn thành";
  }

  if (statusKey === "pending") {
    return "Chưa làm";
  }

  return "--";
}

function getStudentAssignmentActionLabel(statusKey) {
  if (statusKey === "doing") {
    return "Tiếp tục";
  }

  if (statusKey === "done") {
    return "Xem lại";
  }

  return "Làm bài";
}

function getStudentAssignmentScoreBadgeText(assignment) {
  const rawSubmissionStatus = String(assignment?.submissionStatus || "")
    .trim()
    .toLowerCase();

  if (rawSubmissionStatus !== "graded") {
    return "";
  }

  if (
    assignment?.score === null ||
    typeof assignment?.score === "undefined" ||
    assignment?.score === ""
  ) {
    return "";
  }

  return `${String(assignment.score)} điểm`;
}

function getStudentAssignmentIcon(assignment) {
  const subject = String(assignment?.subject || "").toLowerCase();

  if (subject.includes("english") || subject.includes("anh")) {
    return {
      className: "english",
      label: "ABC",
    };
  }

  if (
    subject.includes("math") ||
    subject.includes("toán") ||
    subject.includes("toan")
  ) {
    return {
      className: "math",
      label: "➗",
    };
  }

  return {
    className: "math",
    label: "📘",
  };
}

function getAssignmentsPageLists() {
  const page = getAssignmentsPageRoot();

  if (!page) {
    return [];
  }

  return Array.from(page.querySelectorAll(".assignment-tab")).map((tab) => ({
    tab,
    status: String(tab.dataset.assignmentStatus || tab.id || "").trim(),
    list: tab.querySelector(".assignment-list"),
  }));
}

function renderStudentAssignmentEmptyState(list, title, description) {
  if (!list) {
    return;
  }

  list.innerHTML = `
    <div class="assignment-empty">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
    </div>
  `;
}

function renderStudentAssignmentCard(assignment) {
  const statusKey = normalizeStudentAssignmentStatus(assignment);
  const actionLabel = getStudentAssignmentActionLabel(statusKey);
  const statusLabel = formatStudentAssignmentStatusLabel(statusKey, assignment);
  const scoreBadgeText = getStudentAssignmentScoreBadgeText(assignment);
  const icon = getStudentAssignmentIcon(assignment);
  const dueDateText = assignment?.dueDate
    ? `Hạn nộp: ${formatAssignmentDate(assignment.dueDate)}`
    : "--";
  const descriptionText = assignment?.description || "--";
  const classLabel =
    assignment?.className ||
    studentAssignmentClassState.classes.find(
      (classroom) => classroom.id === assignment?.classId,
    )?.name ||
    studentAssignmentClassState.classes.find(
      (classroom) => classroom.id === assignment?.classId,
    )?.className ||
    assignment?.classId ||
    "--";

  return `
    <article
      class="assignment-item ${currentAssignmentId === assignment.id ? "is-active" : ""}"
      data-assignment-id="${escapeHtml(assignment.id)}"
      data-assignment-class-id="${escapeHtml(assignment.classId || "")}"
      data-assignment-status="${escapeHtml(statusKey)}"
    >
      <div class="assignment-left">
        <div class="subject-icon ${escapeHtml(icon.className)}">${escapeHtml(icon.label)}</div>

        <div class="assignment-info">
          <h3>${escapeHtml(assignment.title || "--")}</h3>
          <p>${escapeHtml(descriptionText)}</p>
          <small>${escapeHtml(dueDateText)}</small>
          <div class="assignment-source">
            <span>Lớp: ${escapeHtml(classLabel)}</span>
          </div>
        </div>
      </div>

      <div class="assignment-right">
        <span class="status ${escapeHtml(statusKey)}">
          ${escapeHtml(statusLabel)}
          ${scoreBadgeText ? `<small class="assignment-score-badge">${escapeHtml(scoreBadgeText)}</small>` : ""}
        </span>
        <button
          type="button"
          class="action-btn"
          data-assignment-action="${escapeHtml(statusKey)}"
        >
          ${escapeHtml(actionLabel)}
        </button>
      </div>
    </article>
  `;
}

function renderStudentAssignmentTabs(assignments) {
  const pageLists = getAssignmentsPageLists();

  if (pageLists.length === 0) {
    return;
  }

  const groupedAssignments = {
    pending: [],
    doing: [],
    done: [],
  };

  assignments.forEach((assignment) => {
    const statusKey = normalizeStudentAssignmentStatus(assignment);
    groupedAssignments[statusKey].push(assignment);
  });

  pageLists.forEach(({ status, list }) => {
    if (!list) {
      return;
    }

    const tabAssignments = groupedAssignments[status] || [];

    if (tabAssignments.length === 0) {
      renderStudentAssignmentEmptyState(
        list,
        "Chưa có bài tập",
        "Danh sách bài tập sẽ xuất hiện ở đây khi giáo viên giao bài cho lớp này.",
      );
      return;
    }

    list.innerHTML = tabAssignments.map(renderStudentAssignmentCard).join("");
  });
}

function syncCurrentStudentAssignmentSelection(assignmentId) {
  const normalizedId = String(assignmentId || "").trim();

  currentAssignmentId = normalizedId;

  const selectedAssignment =
    currentAssignments.find((assignment) => assignment.id === normalizedId) ||
    null;

  if (selectedAssignment) {
    window.EduKidsCurrentAssignment = selectedAssignment;
  } else {
    delete window.EduKidsCurrentAssignment;
  }

  renderStudentAssignmentTabs(currentAssignments);
}

function openStudentAssignmentDetail(assignmentId) {
  const normalizedId = String(assignmentId || "").trim();

  if (!normalizedId) {
    return;
  }

  const assignment =
    currentAssignments.find((item) => item.id === normalizedId) ||
    window.EduKidsCurrentAssignment ||
    null;

  if (!assignment) {
    showToast("Không thể mở chi tiết bài tập.", "error");
    return;
  }

  const previousAssignmentId = String(
    studentAssignmentDetailState.assignment?.id || "",
  ).trim();

  currentAssignmentId = normalizedId;
  studentAssignmentDetailState.visible = true;
  studentAssignmentDetailState.assignment = assignment;

  if (previousAssignmentId !== normalizedId) {
    studentAssignmentDetailState.answers = [];
  }

  window.EduKidsCurrentAssignment = assignment;
  setStudentAssignmentFeedVisibility(false);

  renderStudentAssignmentDetail(assignment);

  const root = getAssignmentDetailRoot();

  if (root && typeof root.scrollIntoView === "function") {
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function updateStudentAssignmentFeed(assignments, errors = []) {
  const normalizedAssignments = Array.isArray(assignments)
    ? assignments
        .map((assignment) => normalizeStudentAssignmentRecord(assignment))
        .filter(
          (assignment) =>
            assignment &&
            assignment.id &&
            !shouldHideStudentAssignmentFromFeed(assignment),
        )
    : [];

  currentAssignments = normalizedAssignments;
  invalidateStudentHomeAssignmentCache(getCurrentAuthUser());

  if (
    !currentAssignmentId ||
    !currentAssignments.some(
      (assignment) => assignment.id === currentAssignmentId,
    )
  ) {
    currentAssignmentId = currentAssignments[0]?.id || "";
  }

  if (currentAssignmentId) {
    const selectedAssignment = currentAssignments.find(
      (assignment) => assignment.id === currentAssignmentId,
    );

    if (selectedAssignment) {
      window.EduKidsCurrentAssignment = selectedAssignment;
    }
  } else {
    delete window.EduKidsCurrentAssignment;
  }

  renderStudentAssignmentTabs(currentAssignments);

  if (errors.length > 0) {
    const firstError = errors.find((error) => error?.message);

    if (firstError?.message) {
      showToast(firstError.message, "error");
    }
  }
}

function findAssignmentInCurrentState(assignmentId) {
  const normalizedAssignmentId = String(assignmentId || "").trim();

  if (!normalizedAssignmentId) {
    return null;
  }

  const studentAssignments = Array.isArray(currentAssignments)
    ? currentAssignments
    : [];
  const fromStudentState =
    studentAssignments.find(
      (assignment) => assignment.id === normalizedAssignmentId,
    ) || null;

  if (fromStudentState) {
    return fromStudentState;
  }

  const teacherAssignments = Array.isArray(
    teacherAssignmentSubmissionState.assignments,
  )
    ? teacherAssignmentSubmissionState.assignments
    : [];
  const fromTeacherState =
    teacherAssignments.find(
      (assignment) => assignment.id === normalizedAssignmentId,
    ) || null;

  if (fromTeacherState) {
    return fromTeacherState;
  }

  if (
    window.EduKidsCurrentAssignment &&
    String(window.EduKidsCurrentAssignment.id || "").trim() ===
      normalizedAssignmentId
  ) {
    return window.EduKidsCurrentAssignment;
  }

  return null;
}

async function loadAssignmentFromAPI(assignmentId) {
  const api = window.EduKidsApi?.requestWithAuth;
  const normalizedAssignmentId = String(assignmentId || "").trim();

  if (typeof api !== "function" || !normalizedAssignmentId) {
    return null;
  }

  const response = await api(
    `/api/assignments/${encodeURIComponent(normalizedAssignmentId)}`,
    {
      method: "GET",
    },
  );

  return response?.data || null;
}

function getAssignmentDetailContext(assignment) {
  const role = getCurrentRole();
  const statusValue = getAssignmentDetailStatusValue(assignment);

  if (role === "teacher") {
    return {
      actionLabel: "Xem submissions",
      actionClass: "manage-detail-btn",
      showSubmissionButton: true,
      statusLabel: getAssignmentDetailStatusLabel(assignment),
      scoreBadgeText: "",
      footerHint: "",
      primaryActionDisabled: false,
    };
  }

  return {
    actionLabel: getAssignmentDetailPrimaryActionLabel(assignment),
    actionClass: "action-btn",
    showSubmissionButton: false,
    statusLabel:
      statusValue === "graded"
        ? "Đã chấm"
        : statusValue === "submitted"
          ? "Đã nộp"
          : statusValue === "doing"
            ? "Đang làm"
            : statusValue === "done"
              ? "Hoàn thành"
              : "Chưa mở",
    scoreBadgeText: getAssignmentDetailScoreBadgeText(assignment),
    footerHint:
      statusValue === "graded" &&
      assignment?.score !== null &&
      typeof assignment?.score !== "undefined"
        ? `Điểm: ${String(assignment.score)}`
        : "",
    primaryActionDisabled: false,
  };
}

function renderAssignmentDetail(assignment) {
  if (getCurrentRole() === "teacher") {
    renderTeacherAssignmentDetail();
    return;
  }

  const root = getAssignmentDetailRoot();

  if (!root) {
    return;
  }

  if (!assignment) {
    root.innerHTML = "";
    root.hidden = true;
    return;
  }

  const statusValue = getAssignmentDetailStatusValue(assignment);
  const statusLabel = getAssignmentDetailStatusLabel(assignment);
  const context = getAssignmentDetailContext(assignment);
  const actionLabel = context.actionLabel;
  const scoreBadgeText = context.scoreBadgeText;
  const statusClass =
    getCurrentRole() === "teacher"
      ? String(assignment.status || "")
          .trim()
          .toLowerCase() || "active"
      : normalizeStudentAssignmentStatus(assignment);
  const dueDateText = assignment.dueDate
    ? formatAssignmentDate(assignment.dueDate)
    : "--";
  const classLabel = assignment.classId || "--";

  root.hidden = false;
  root.innerHTML = `
    <article class="assignment-item is-active assignment-detail-card" data-assignment-id="${escapeHtml(assignment.id || "")}" data-assignment-class-id="${escapeHtml(assignment.classId || "")}" data-assignment-status="${escapeHtml(statusValue)}">
      <div class="assignment-left">
        <div class="subject-icon ${escapeHtml(getStudentAssignmentIcon(assignment).className)}">${escapeHtml(getStudentAssignmentIcon(assignment).label)}</div>
        <div class="assignment-info">
          <h3>${escapeHtml(assignment.title || "--")}</h3>
          <p>${escapeHtml(assignment.description || "--")}</p>
          <small>Hạn nộp: ${escapeHtml(dueDateText)}</small>
          <div class="assignment-source">
            <span>Lớp: ${escapeHtml(classLabel)}</span>
          </div>
        </div>
      </div>
      <div class="assignment-right">
        <span class="status ${escapeHtml(statusClass)}">
          ${escapeHtml(statusLabel)}
          ${scoreBadgeText ? `<small class="assignment-score-badge">${escapeHtml(scoreBadgeText)}</small>` : ""}
        </span>
        <button
          type="button"
          class="${escapeHtml(context.actionClass)}"
          data-assignment-action="detail-primary"
          data-assignment-id="${escapeHtml(assignment.id || "")}"
          ${context.primaryActionDisabled ? "disabled" : ""}
        >
          ${escapeHtml(actionLabel)}
        </button>
      </div>
    </article>
    <div class="assignment-detail-meta">
      <div class="assignment-detail-row"><span>title</span><strong>${escapeHtml(assignment.title || "--")}</strong></div>
      <div class="assignment-detail-row"><span>description</span><strong>${escapeHtml(assignment.description || "--")}</strong></div>
      <div class="assignment-detail-row"><span>dueDate</span><strong>${escapeHtml(dueDateText)}</strong></div>
      <div class="assignment-detail-row"><span>classId</span><strong>${escapeHtml(classLabel)}</strong></div>
      <div class="assignment-detail-row"><span>status</span><strong>${escapeHtml(statusLabel)}</strong></div>
      ${context.footerHint ? `<div class="assignment-detail-row"><span>ghi chú</span><strong>${escapeHtml(context.footerHint)}</strong></div>` : ""}
    </div>
  `;
}

async function openTeacherAssignmentDetail(assignmentId) {
  const normalizedAssignmentId = String(assignmentId || "").trim();

  if (!normalizedAssignmentId) {
    return;
  }

  const detail = currentTeacherAssignmentDetail;
  const requestId = detail.requestId + 1;
  detail.requestId = requestId;
  const assignment =
    findAssignmentInCurrentState(normalizedAssignmentId) ||
    (await loadAssignmentFromAPI(normalizedAssignmentId).catch(() => null));

  if (!assignment || detail.requestId !== requestId) {
    if (!assignment) {
      showToast("Không thể tải chi tiết bài tập.", "error");
    }
    return;
  }

  detail.visible = true;
  detail.loading = true;
  detail.error = "";
  detail.assignment = normalizeAssignmentDetailRecord(assignment);
  detail.classInfo = null;
  detail.classStudents = [];
  detail.submissions = [];
  detail.studentRows = [];
  detail.selectedStudentId = "";
  detail.selectedSubmission = null;
  detail.selectedStudentProfile = null;
  detail.submissionByStudentId = new Map();
  detail.profileByStudentId = new Map();
  detail.loadingStudentId = "";
  teacherAssignmentSubmissionState.selectedAssignmentId =
    normalizedAssignmentId;
  teacherAssignmentSubmissionState.error = "";
  teacherAssignmentSubmissionState.loading = true;
  teacherAssignmentSubmissionState.submissions = [];
  teacherAssignmentSubmissionState.assignments =
    Array.isArray(teacherAssignmentSubmissionState.assignments) &&
    teacherAssignmentSubmissionState.assignments.length
      ? teacherAssignmentSubmissionState.assignments
      : [detail.assignment];

  setTeacherAssignmentDetailVisibility(true);
  renderTeacherAssignmentDetail();

  try {
    const [submissionSummary, classListResponse] = await Promise.all([
      window.EduKidsAssignmentService?.fetchAssignmentSubmissions
        ? window.EduKidsAssignmentService.fetchAssignmentSubmissions(
            normalizedAssignmentId,
          ).catch(() => [])
        : Promise.resolve([]),
      apiRequestWithAuth("/api/classes/my", { method: "GET" }).catch(() => ({
        data: [],
      })),
    ]);

    if (!detail.visible || detail.requestId !== requestId) {
      return;
    }

    const normalizedSubmissions = Array.isArray(submissionSummary)
      ? submissionSummary
          .map((submission) =>
            normalizeTeacherAssignmentSubmissionRecord(submission),
          )
          .filter((submission) => submission && submission.studentId)
      : [];

    detail.submissions = normalizedSubmissions;
    teacherAssignmentSubmissionState.submissions = normalizedSubmissions;
    teacherAssignmentSubmissionState.error = "";

    const classInfo = Array.isArray(classListResponse?.data)
      ? sortClassroomRecords(
          classListResponse.data.map(normalizeClassroomRecord).filter(Boolean),
        ).find((classroom) => classroom.id === detail.assignment.classId) ||
        null
      : null;

    detail.classInfo = classInfo;
    detail.classStudents = await getClassroomStudentCards(classInfo);
    const classStudents = Array.isArray(detail.classStudents)
      ? detail.classStudents
      : [];
    const submissions = Array.isArray(normalizedSubmissions)
      ? normalizedSubmissions
      : [];

    const rosterStudentIds = uniqueClassroomValues([
      ...classStudents.map((student) => student.id),
      ...submissions.map((submission) => submission.studentId),
    ]);

    const profileService = window.EduKidsProfileService;
    const profilePairs = await Promise.all(
      rosterStudentIds.map(async (studentId) => {
        if (profileService?.fetchProfileById) {
          const profile = await profileService
            .fetchProfileById(studentId)
            .catch(() => null);
          return [studentId, profile];
        }

        return [studentId, null];
      }),
    );

    profilePairs.forEach(([studentId, profile]) => {
      if (studentId && profile) {
        detail.profileByStudentId.set(studentId, profile);
      }
    });

    const submissionMap = new Map(
      submissions.map((submission) => [submission.studentId, submission]),
    );

    const studentRows = rosterStudentIds.map((studentId, index) => {
      const classStudent =
        classStudents.find((student) => student.id === studentId) || null;
      const submission = submissionMap.get(studentId) || null;
      const profile =
        detail.profileByStudentId.get(studentId) || classStudent || null;
      const row = normalizeTeacherAssignmentStudentRecord(
        {
          id: studentId,
          name:
            classStudent?.name ||
            submission?.studentName ||
            profile?.name ||
            profile?.fullName ||
            profile?.username ||
            studentId,
          username:
            profile?.username ||
            classStudent?.name ||
            submission?.studentName ||
            "",
          avatar: classStudent?.avatar || profile?.avatar || "",
        },
        submission,
        profile,
      );

      return {
        ...row,
        order: index,
      };
    });

    studentRows.sort((left, right) => {
      const leftRank =
        left.statusKey === "submitted" ? 0 : left.statusKey === "doing" ? 1 : 2;
      const rightRank =
        right.statusKey === "submitted"
          ? 0
          : right.statusKey === "doing"
            ? 1
            : 2;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.order - right.order;
    });

    detail.studentRows = studentRows.map((row) => {
      const selectedSubmission = submissionMap.get(row.id) || null;
      return {
        ...row,
        submission: selectedSubmission,
      };
    });

    detail.selectedStudentId = getTeacherAssignmentSelectedStudentId();
    detail.loading = false;
    teacherAssignmentSubmissionState.loading = false;

    if (detail.selectedStudentId) {
      await selectTeacherAssignmentStudent(detail.selectedStudentId);
    } else {
      renderTeacherAssignmentDetail();
    }
  } catch (error) {
    if (!detail.visible || detail.requestId !== requestId) {
      return;
    }

    detail.loading = false;
    detail.error = error.message || "Không thể tải chi tiết bài tập.";
    teacherAssignmentSubmissionState.loading = false;
    teacherAssignmentSubmissionState.error = detail.error;
    showToast(detail.error, "error");
    renderTeacherAssignmentDetail();
  }

  const root = getTeacherAssignmentDetailRoot();

  if (root && typeof root.scrollIntoView === "function") {
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function closeTeacherAssignmentDetail() {
  const detail = currentTeacherAssignmentDetail;

  detail.requestId += 1;
  detail.visible = false;
  detail.loading = false;
  detail.error = "";
  detail.assignment = null;
  detail.classInfo = null;
  detail.classStudents = [];
  detail.submissions = [];
  detail.studentRows = [];
  detail.selectedStudentId = "";
  detail.selectedSubmission = null;
  detail.selectedStudentProfile = null;
  detail.submissionByStudentId = new Map();
  detail.profileByStudentId = new Map();
  detail.loadingStudentId = "";
  teacherAssignmentSubmissionState.loading = false;
  teacherAssignmentSubmissionState.error = "";
  setTeacherAssignmentDetailVisibility(false);
  renderTeacherAssignmentDetail();
}

async function openAssignmentDetail(assignmentId) {
  return openTeacherAssignmentDetail(assignmentId);
}

async function loadAssignmentSubmissionsForDetail(assignmentId) {
  return openTeacherAssignmentDetail(assignmentId);
}

function buildStudentAssignmentsQuery() {
  const selectedClassId = String(
    studentAssignmentClassState.selectedClassId || "",
  ).trim();
  const classIds = uniqueClassroomValues(
    studentAssignmentClassState.classes.map((classroom) => classroom?.id),
  );
  const params = new URLSearchParams();

  if (selectedClassId) {
    params.set("selectedClassId", selectedClassId);
  }

  if (classIds.length > 0) {
    params.set("classIds", classIds.join(","));
  }

  const query = params.toString();

  return query
    ? `/api/assignments/student?${query}`
    : "/api/assignments/student";
}

async function loadStudentAssignmentsFromAPI() {
  const api = window.EduKidsApi?.requestWithAuth;

  if (typeof api !== "function") {
    throw new Error("Assignment API is unavailable");
  }

  const response = await api(buildStudentAssignmentsQuery(), {
    method: "GET",
  });

  return Array.isArray(response?.data) ? response.data : [];
}

async function refreshStudentAssignmentsFeed() {
  if (getCurrentRole() !== "student") {
    return;
  }

  const assignmentsRoot = getAssignmentsPageRoot();

  if (assignmentsRoot) {
    assignmentsRoot.setAttribute("aria-busy", "true");
  }

  try {
    const assignments = await loadStudentAssignmentsFromAPI();

    if (assignmentsRoot) {
      assignmentsRoot.setAttribute("aria-busy", "false");
    }

    updateStudentAssignmentFeed(assignments, []);
  } catch (error) {
    if (assignmentsRoot) {
      assignmentsRoot.setAttribute("aria-busy", "false");
    }

    currentAssignments = [];
    currentAssignmentId = "";
    delete window.EduKidsCurrentAssignment;
    renderStudentAssignmentTabs([]);
    showToast(error.message || "Không thể tải bài tập từ máy chủ.", "error");
  }
}

function renderStudentAssignmentDetail(assignment) {
  const root = getAssignmentDetailRoot();

  if (!root) {
    return;
  }

  if (!assignment) {
    root.hidden = true;
    root.innerHTML = "";
    return;
  }

  const statusKey = normalizeStudentAssignmentStatus(assignment);
  const isReadOnly = statusKey === "done";
  const questionList = Array.isArray(assignment.questions)
    ? assignment.questions
    : [];
  const actionLabel = isReadOnly ? "Xem lại" : "Nộp bài";
  const dueDateText = assignment.dueDate
    ? formatAssignmentDate(assignment.dueDate)
    : "--";
  const scoreText =
    assignment.score === null ||
    typeof assignment.score === "undefined" ||
    assignment.score === ""
      ? "--"
      : String(assignment.score);
  const correctCountText =
    Number.isFinite(Number(assignment.correctCount)) &&
    Number.isFinite(Number(assignment.totalQuestions))
      ? `${Number(assignment.correctCount)} / ${Number(assignment.totalQuestions)}`
      : "--";
  const wrongCountText = Number.isFinite(Number(assignment.wrongCount))
    ? String(Number(assignment.wrongCount))
    : "--";
  const classLabel =
    assignment.className ||
    studentAssignmentClassState.classes.find(
      (classroom) => classroom.id === assignment.classId,
    )?.name ||
    studentAssignmentClassState.classes.find(
      (classroom) => classroom.id === assignment.classId,
    )?.className ||
    assignment.classId ||
    "--";

  root.hidden = false;
  root.dataset.studentAssignmentRoot = "true";
  root.innerHTML = `
    <div class="assignment-detail-shell">
      <button type="button" class="back-btn" data-assignment-back>← Quay lại</button>

      <section class="quiz-panel">
        <div class="quiz-panel-header">
          <div>
            <span class="quiz-panel-kicker">Assignment</span>
            <h2>${escapeHtml(assignment.title || "--")}</h2>
            <p>Lớp: ${escapeHtml(classLabel)} · Hạn nộp: ${escapeHtml(dueDateText)}</p>
          </div>
          <div class="quiz-panel-progress">
            <strong>${escapeHtml(formatStudentAssignmentStatusLabel(statusKey))}</strong>
            <span>${escapeHtml(assignment.score === null || typeof assignment.score === "undefined" ? "--" : String(assignment.score))}</span>
          </div>
        </div>

        <div class="assignment-detail-meta">
          <div class="assignment-detail-row"><span>Tiêu đề</span><strong>${escapeHtml(assignment.title || "--")}</strong></div>
          <div class="assignment-detail-row"><span>Mô tả</span><strong>${escapeHtml(assignment.description || "--")}</strong></div>
          <div class="assignment-detail-row"><span>Hạn nộp</span><strong>${escapeHtml(dueDateText)}</strong></div>
          <div class="assignment-detail-row"><span>Lớp</span><strong>${escapeHtml(classLabel)}</strong></div>
          ${
            isReadOnly || Number.isFinite(Number(assignment.score))
              ? `
              <div class="assignment-detail-row"><span>Điểm</span><strong>${escapeHtml(scoreText)}</strong></div>
              <div class="assignment-detail-row"><span>Đúng</span><strong>${escapeHtml(correctCountText)}</strong></div>
              <div class="assignment-detail-row"><span>Sai</span><strong>${escapeHtml(wrongCountText)}</strong></div>
            `
              : ""
          }
        </div>

        <div class="quiz-question-list ${isReadOnly ? "is-submitted" : ""}">
          ${
            questionList.length === 0
              ? `
              <div class="quiz-empty">Bài tập này chưa có câu hỏi.</div>
            `
              : questionList
                  .map((question, questionIndex) => {
                    const selected =
                      getStudentAssignmentSelectedAnswer(questionIndex);
                    const options =
                      normalizeStudentAssignmentQuestionOptions(question);

                    return `
                    <article class="quiz-question-card" data-question-block data-assignment-question-index="${questionIndex}">
                      <div class="quiz-question-meta">Câu ${questionIndex + 1}</div>
                      <h3 class="quiz-question-text">${escapeHtml(question.question || "--")}</h3>
                      <div class="quiz-option-grid">
                        ${options
                          .map((option) => {
                            const isSelected = selected === option.label;

                            return `
                              <button
                                type="button"
                                class="quiz-option-btn ${isSelected ? "is-selected" : ""}"
                                data-option-label="${escapeHtml(option.label)}"
                                ${isReadOnly ? "disabled" : ""}
                              >
                                <span class="quiz-option-label">${escapeHtml(option.label)}</span>
                                <span class="quiz-option-text">${escapeHtml(option.text)}</span>
                              </button>
                            `;
                          })
                          .join("")}
                      </div>
                    </article>
                  `;
                  })
                  .join("")
          }
        </div>

        <div class="quiz-actions">
          <button
            type="button"
            class="quiz-submit-btn"
            data-assignment-submit
            ${studentAssignmentSubmissionLoading || isReadOnly ? "disabled" : ""}
          >
            ${actionLabel}
          </button>
        </div>
      </section>
    </div>
  `;
}

function closeStudentAssignmentDetail() {
  studentAssignmentDetailState.visible = false;
  setStudentAssignmentFeedVisibility(true);

  const root = getAssignmentDetailRoot();

  if (root) {
    root.hidden = true;
    root.innerHTML = "";
  }

  renderStudentAssignmentTabs(currentAssignments);
}

function getAssignmentSubmitButtonFromTrigger(trigger) {
  if (!trigger || typeof trigger.closest !== "function") {
    return null;
  }

  if (trigger.matches?.("button, input[type='submit']")) {
    return trigger;
  }

  return trigger.closest(
    [
      "button[data-assignment-submit]",
      "button[data-action='submit-assignment']",
      "button[data-action='submit-assignment-form']",
      "button.assignment-submit-btn",
      "button.submit-assignment-btn",
      "input[type='submit'][data-assignment-submit]",
    ].join(","),
  );
}

async function submitStudentAssignment(trigger = null) {
  const assignment = getCurrentStudentAssignment();

  if (!assignment?.id) {
    showToast("Chưa có bài tập để nộp.", "error");
    return;
  }

  if (studentAssignmentSubmissionLoading) {
    return;
  }

  if (normalizeStudentAssignmentStatus(assignment) === "done") {
    showToast("Bài tập này đã được nộp rồi.", "success");
    return;
  }

  const root = getStudentAssignmentWorkRoot();
  const submitButton = getAssignmentSubmitButtonFromTrigger(trigger);
  const originalLabel = submitButton?.textContent || "";
  const answers = collectStudentAssignmentAnswers(assignment, root);

  if (!Array.isArray(answers) || answers.length === 0) {
    showToast("Vui lòng chọn đáp án trước khi nộp.", "error");
    return;
  }

  if (root) {
    root.setAttribute("aria-busy", "true");
  }

  studentAssignmentSubmissionLoading = true;
  setStudentAssignmentSubmitButtonState(submitButton, true, originalLabel);

  try {
    const response = await apiRequestWithAuth("/api/assignments/submit", {
      method: "POST",
      body: {
        assignmentId: assignment.id,
        answers,
      },
    });

    const submissionResult = response.data || null;
    if (submissionResult?.profile) {
      applyLatestCurrentUser(submissionResult.profile);
    }
    const updatedAssignment = markStudentAssignmentAsSubmitted(
      assignment.id,
      submissionResult,
    );

    if (updatedAssignment) {
      studentAssignmentDetailState.assignment = updatedAssignment;
      window.EduKidsCurrentAssignment = updatedAssignment;
      renderStudentAssignmentDetail(updatedAssignment);
    }

    showToast("Đã nộp bài thành công.", "success");
    await refreshStudentAssignmentsFeed();

    const refreshedCurrentAssignment = getCurrentStudentAssignment();

    if (
      studentAssignmentDetailState.visible &&
      refreshedCurrentAssignment?.id &&
      String(refreshedCurrentAssignment.id) === String(assignment.id)
    ) {
      studentAssignmentDetailState.assignment = refreshedCurrentAssignment;
      window.EduKidsCurrentAssignment = refreshedCurrentAssignment;
      renderStudentAssignmentDetail(refreshedCurrentAssignment);
    }
  } catch (error) {
    showToast(error.message || "Không thể nộp bài tập.", "error");
  } finally {
    studentAssignmentSubmissionLoading = false;

    if (root) {
      root.setAttribute("aria-busy", "false");
    }

    setStudentAssignmentSubmitButtonState(submitButton, false, originalLabel);
  }
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

function normalizeClassroomRecord(classroom) {
  if (!classroom || typeof classroom !== "object") {
    return null;
  }

  return {
    id: String(classroom.id || classroom.classId || "").trim(),
    name: String(
      classroom.name || classroom.className || "Chưa đặt tên",
    ).trim(),
    className: String(classroom.className || classroom.name || "").trim(),
    classCode: String(classroom.classCode || classroom.code || "").trim(),
    teacherId: String(classroom.teacherId || "").trim(),
    teacherName: String(
      classroom.teacherName || classroom.teacherUsername || "",
    ).trim(),
    students: Array.isArray(classroom.students) ? classroom.students : [],
    studentIds: Array.isArray(classroom.studentIds) ? classroom.studentIds : [],
    members: Array.isArray(classroom.members) ? classroom.members : [],
    studentCount:
      Number(classroom.studentCount ?? classroom.studentsCount ?? 0) || 0,
    createdAt: classroom.createdAt || "",
    averageScore:
      classroom.averageScore ??
      classroom.average ??
      classroom.averagePercent ??
      classroom.avgScore ??
      "",
    completionRate:
      classroom.completionRate ??
      classroom.completion ??
      classroom.completionPercent ??
      classroom.completedPercent ??
      "",
  };
}

function sortClassroomRecords(classrooms) {
  return [...(Array.isArray(classrooms) ? classrooms : [])].sort(
    (left, right) => {
      const leftTime = Date.parse(left.createdAt || "") || 0;
      const rightTime = Date.parse(right.createdAt || "") || 0;

      return rightTime - leftTime;
    },
  );
}

function uniqueClassroomValues(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

function getClassroomListPanel() {
  return document.getElementById("classroom-list-panel");
}

function getClassroomDetailName() {
  return document.getElementById("classroom-detail-name");
}

function getClassroomDetailCode() {
  return document.getElementById("classroom-detail-code");
}

function getClassroomStatSize() {
  return document.getElementById("classroom-stat-size");
}

function getClassroomStatAverage() {
  return document.getElementById("classroom-stat-average");
}

function getClassroomStatCompletion() {
  return document.getElementById("classroom-stat-completion");
}

function getClassroomStudentList() {
  return document.getElementById("classroom-student-list");
}

function getClassroomCreateButton() {
  return document.querySelector(".classroom-create-btn");
}

function getClassroomJoinButton() {
  return document.getElementById("join-class-btn");
}

function getClassroomJoinInput() {
  return document.getElementById("join-class-code");
}

function getClassroomCopyButton() {
  return document.querySelector(".classroom-copy-btn");
}

function getClassroomDeleteButton() {
  return document.querySelector("[data-classroom-delete]");
}

function getClassroomToggleButton() {
  return document.querySelector(".classroom-toggle-btn");
}

function getJoinedClassListPanel() {
  return document.getElementById("joined-class-list");
}

function getAssignmentsPageRoot() {
  return document.getElementById("assignments");
}

function getTeacherManageRoot() {
  return document.getElementById("manage");
}

function getAssignmentDetailRoot() {
  const existingRoot = document.querySelector(
    "#assignments [data-assignment-detail-root]",
  );

  if (existingRoot) {
    return existingRoot;
  }

  const root = document.createElement("section");
  root.dataset.assignmentDetailRoot = "true";
  root.className = "assignment-detail";
  const role = getCurrentRole();

  if (role === "teacher") {
    const manageRoot = getTeacherManageRoot();
    const list = manageRoot?.querySelector(".manage-list");

    if (list?.parentElement) {
      list.parentElement.insertBefore(root, list);
      return root;
    }

    manageRoot?.prepend(root);
    return root;
  }

  const assignmentsRoot = getAssignmentsPageRoot();
  const tabs = assignmentsRoot?.querySelector(".assignment-tabs");

  if (tabs?.parentElement) {
    tabs.parentElement.insertBefore(root, tabs);
    return root;
  }

  assignmentsRoot?.prepend(root);
  return root;
}

function getTeacherAssignmentDetailRoot() {
  const existingRoot = document.querySelector(
    "#manage [data-teacher-assignment-detail-root]",
  );

  if (existingRoot) {
    return existingRoot;
  }

  const root = document.createElement("section");
  root.dataset.teacherAssignmentDetailRoot = "true";
  root.className = "teacher-assignment-detail";

  const manageRoot = getTeacherManageRoot();

  if (manageRoot) {
    manageRoot.prepend(root);
    return root;
  }

  return null;
}

function setTeacherAssignmentDetailVisibility(isVisible) {
  const manageRoot = getTeacherManageRoot();
  const detailRoot = getTeacherAssignmentDetailRoot();

  if (manageRoot) {
    manageRoot.classList.toggle("is-detail-open", Boolean(isVisible));
  }

  if (detailRoot) {
    detailRoot.hidden = !isVisible;
  }

  const header = manageRoot?.querySelector(".manage-header");
  const list = manageRoot?.querySelector(".manage-list");

  if (header) {
    header.hidden = Boolean(isVisible);
  }

  if (list) {
    list.hidden = Boolean(isVisible);
  }
}

function getStudentClassSwitcher() {
  return document.getElementById("student-class-switcher");
}

function getJoinClassActionButton() {
  return document.getElementById("join-class-action-btn");
}

function getStudentClassSwitcherButton() {
  return document.querySelector(
    "#student-class-switcher .student-class-switcher-btn",
  );
}

function getSelectedClassroom() {
  return (
    classroomState.classes.find(
      (classroom) => classroom.id === classroomState.selectedClassId,
    ) ||
    classroomState.classes[0] ||
    null
  );
}

function getClassroomStudentNames(classroom) {
  const studentIds = Array.isArray(classroom?.students)
    ? classroom.students
    : Array.isArray(classroom?.studentIds)
      ? classroom.studentIds
      : Array.isArray(classroom?.members)
        ? classroom.members
        : [];

  const displayValues = studentIds.map((student) => {
    return getClassroomStudentDisplayName(student);
  });

  return uniqueClassroomValues(displayValues).slice(0, 50);
}

function getClassroomStudentDisplayName(student) {
  if (student && typeof student === "object") {
    return (
      String(
        student.fullName || student.name || student.username || "",
      ).trim() ||
      String(
        student.userId || student.uid || student.studentId || student.id || "",
      ).trim()
    );
  }

  return String(student || "").trim();
}

function getClassroomStudentId(student) {
  if (student && typeof student === "object") {
    return String(
      student.id || student.studentId || student.userId || student.uid || "",
    ).trim();
  }

  return String(student || "").trim();
}

async function resolveClassroomStudentProfile(student) {
  const studentId = getClassroomStudentId(student);

  if (!studentId) {
    return null;
  }

  if (
    student &&
    typeof student === "object" &&
    String(student.fullName || student.name || "").trim()
  ) {
    return student;
  }

  if (classroomStudentProfileCache.has(studentId)) {
    return classroomStudentProfileCache.get(studentId);
  }

  const service = window.EduKidsProfileService;

  if (!service?.fetchProfileById) {
    return null;
  }

  try {
    const profile = await service.fetchProfileById(studentId);
    if (profile) {
      classroomStudentProfileCache.set(studentId, profile);
    }
    return profile;
  } catch (error) {
    console.warn("Không thể tải hồ sơ học sinh:", error);
    return null;
  }
}

function getClassroomStudentAvatarPath(student) {
  const fallbackAvatar = "assets/userAvatar/boy.png";

  if (!student || typeof student !== "object") {
    return fallbackAvatar;
  }

  if (window.EduKidsProfileService?.getAvatarPathFromProfile) {
    return (
      window.EduKidsProfileService.getAvatarPathFromProfile({
        ...student,
        role: "student",
      }) || fallbackAvatar
    );
  }

  const avatar = String(
    student.avatar || student.photoURL || student.profilePicture || "",
  ).trim();

  if (!avatar) {
    return fallbackAvatar;
  }

  if (avatar.startsWith("assets/")) {
    return avatar;
  }

  return `assets/userAvatar/${avatar}`;
}

async function getClassroomStudentCards(classroom) {
  const studentIds = Array.isArray(classroom?.students)
    ? classroom.students
    : Array.isArray(classroom?.studentIds)
      ? classroom.studentIds
      : Array.isArray(classroom?.members)
        ? classroom.members
        : [];

  const resolvedStudents = await Promise.all(
    studentIds.map((student) => resolveClassroomStudentProfile(student)),
  );

  return uniqueClassroomValues(
    resolvedStudents.map((student, index) => {
      const fallbackStudent = studentIds[index];
      const resolvedStudent = student || fallbackStudent;
      const studentId = getClassroomStudentId(resolvedStudent);
      const fullName =
        getClassroomStudentDisplayName(resolvedStudent) ||
        getClassroomStudentDisplayName(fallbackStudent);

      return JSON.stringify({
        id: studentId,
        avatar:
          getClassroomStudentAvatarPath(resolvedStudent) ||
          "assets/userAvatar/boy.png",
        name: fullName || studentId || "Học sinh",
      });
    }),
  )
    .map((item) => {
      try {
        return JSON.parse(item);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

function formatClassroomPercentage(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "--";
  }

  return `${numeric}%`;
}

function renderClassroomEmptyState(panel, title, description) {
  if (!panel) {
    return;
  }

  panel.innerHTML = `
    <div class="classroom-empty-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
    </div>
  `;
}

async function renderClassroomStudentList(classroom) {
  const studentList = getClassroomStudentList();

  if (!studentList) {
    return;
  }

  const studentCards = await getClassroomStudentCards(classroom);

  if (!classroom) {
    renderClassroomEmptyState(
      studentList,
      "Chưa có dữ liệu học sinh",
      "Chọn hoặc tạo một lớp để xem danh sách học sinh.",
    );
    return;
  }

  if (studentCards.length === 0) {
    renderClassroomEmptyState(
      studentList,
      "Lớp này chưa có học sinh",
      "Học sinh sẽ xuất hiện ở đây sau khi tham gia lớp.",
    );
    return;
  }

  studentList.innerHTML = `
    <div class="classroom-student-chips">
      ${studentCards
        .map((student) => {
          const avatarSrc = student.avatar || "assets/userAvatar/boy.png";

          return `
            <div class="classroom-student-chip">
              <img
                class="classroom-student-avatar"
                src="${escapeHtml(avatarSrc)}"
                alt="${escapeHtml(student.name || "Học sinh")}"
                onerror="this.onerror=null;this.src='assets/userAvatar/boy.png';"
              />
              <strong>${escapeHtml(student.name || student.id || "Học sinh")}</strong>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderClassroomDetails(classroom) {
  const nameNode = getClassroomDetailName();
  const codeNode = getClassroomDetailCode();
  const sizeNode = getClassroomStatSize();
  const averageNode = getClassroomStatAverage();
  const completionNode = getClassroomStatCompletion();
  const createButton = getClassroomCreateButton();
  const deleteButton = getClassroomDeleteButton();

  if (createButton) {
    createButton.hidden = getCurrentRole() !== "teacher";
  }

  if (deleteButton) {
    deleteButton.hidden = getCurrentRole() !== "teacher" || !classroom;
  }

  if (!classroom) {
    if (nameNode) {
      nameNode.textContent = "Chưa có lớp nào";
    }

    if (codeNode) {
      codeNode.textContent = "Mã lớp: --";
    }

    if (sizeNode) {
      sizeNode.textContent = "0";
    }

    if (averageNode) {
      averageNode.textContent = "--";
    }

    if (completionNode) {
      completionNode.textContent = "--";
    }

    renderClassroomStudentList(null);
    return;
  }

  if (nameNode) {
    nameNode.textContent =
      classroom.name || classroom.className || "Chưa đặt tên";
  }

  if (codeNode) {
    codeNode.textContent = `Mã lớp: ${classroom.classCode || "--"}`;
  }

  if (sizeNode) {
    sizeNode.textContent = String(classroom.studentCount ?? 0);
  }

  if (averageNode) {
    averageNode.textContent = formatClassroomPercentage(
      classroom.averageScore ??
        classroom.average ??
        classroom.averagePercent ??
        classroom.avgScore,
    );
  }

  if (completionNode) {
    completionNode.textContent = formatClassroomPercentage(
      classroom.completionRate ??
        classroom.completion ??
        classroom.completionPercent ??
        classroom.completedPercent,
    );
  }

  void renderClassroomStudentList(classroom);
}

function renderClassroomListPanel() {
  const panel = getClassroomListPanel();
  const joinedClassList = getJoinedClassListPanel();
  const classes = classroomState.classes;
  const selectedClassId =
    classroomState.selectedClassId || classes[0]?.id || "";
  const selectedClass =
    classes.find((classroom) => classroom.id === selectedClassId) ||
    classes[0] ||
    null;

  classroomState.selectedClassId = selectedClass?.id || "";

  if (panel) {
    if (classes.length === 0) {
      renderClassroomEmptyState(
        panel,
        "Chưa có lớp học nào",
        getCurrentRole() === "teacher"
          ? "Tạo lớp đầu tiên để bắt đầu quản lý học sinh."
          : "Nhập mã lớp để tham gia và đồng bộ dữ liệu lớp học.",
      );
    } else {
      panel.innerHTML = `
        <div class="classroom-card-list">
          ${classes
            .map((classroom) => {
              const isActive = classroom.id === classroomState.selectedClassId;
              return `
                <button
                  type="button"
                  class="classroom-card ${isActive ? "active" : ""}"
                  data-classroom-id="${escapeHtml(classroom.id)}"
                >
                  <div class="classroom-card-head">
                    <strong>${escapeHtml(classroom.name || classroom.className || "Lớp học")}</strong>
                    <span>${escapeHtml(classroom.classCode || "--")}</span>
                  </div>
                  <div class="classroom-card-meta">
                    <span>Sĩ số: ${escapeHtml(classroom.studentCount ?? 0)}</span>
                    <span>Giáo viên: ${escapeHtml(classroom.teacherName || "--")}</span>
                  </div>
                </button>
              `;
            })
            .join("")}
        </div>
      `;
    }
  }

  if (joinedClassList) {
    if (classes.length === 0) {
      joinedClassList.innerHTML = `
        <div class="joined-class-empty">Chưa có lớp nào.</div>
      `;
    } else {
      joinedClassList.innerHTML = classes
        .map(
          (classroom) => `
            <button
              type="button"
              class="joined-class-item ${classroom.id === classroomState.selectedClassId ? "active" : ""}"
              data-classroom-id="${escapeHtml(classroom.id)}"
            >
              <strong>${escapeHtml(classroom.name || classroom.className || "Lớp học")}</strong>
              <span>${escapeHtml(classroom.classCode || "--")}</span>
            </button>
          `,
        )
        .join("");
    }
  }

  renderClassroomDetails(selectedClass);
}

async function loadClassroomData(preferredClassId = "") {
  const panel = getClassroomListPanel();

  try {
    classroomState.loading = true;

    if (panel) {
      renderClassroomEmptyState(
        panel,
        "Đang tải lớp học...",
        "Hệ thống đang đồng bộ dữ liệu lớp học thật.",
      );
    }

    const response = await apiRequestWithAuth("/api/classes/my", {
      method: "GET",
    });

    const classes = sortClassroomRecords(
      Array.isArray(response?.data)
        ? response.data.map(normalizeClassroomRecord).filter(Boolean)
        : [],
    );

    classroomState.classes = classes;

    if (
      preferredClassId &&
      classes.some((item) => item.id === preferredClassId)
    ) {
      classroomState.selectedClassId = preferredClassId;
    } else if (
      classroomState.selectedClassId &&
      classes.some((item) => item.id === classroomState.selectedClassId)
    ) {
      // keep current selection
    } else {
      classroomState.selectedClassId = classes[0]?.id || "";
    }

    renderClassroomListPanel();
    return classes;
  } catch (error) {
    classroomState.classes = [];
    classroomState.selectedClassId = "";

    if (panel) {
      renderClassroomEmptyState(
        panel,
        "Không thể tải lớp học",
        error.message || "Vui lòng thử lại sau.",
      );
    }

    renderClassroomDetails(null);
    showToast(error.message || "Không thể tải lớp học.", "error");
    return [];
  } finally {
    classroomState.loading = false;
  }
}

async function refreshClassroomData(preferredClassId = "") {
  return loadClassroomData(preferredClassId);
}

async function handleCreateClassroom() {
  if (getCurrentRole() !== "teacher") {
    showToast("Chỉ giáo viên mới có thể tạo lớp.", "error");
    return;
  }

  const name = String(window.prompt("Nhập tên lớp học") || "").trim();

  if (!name) {
    return;
  }

  const description = String(
    window.prompt("Nhập mô tả lớp học (không bắt buộc)") || "",
  ).trim();

  try {
    const response = await apiRequestWithAuth("/api/classes/create", {
      method: "POST",
      body: {
        name,
        description,
      },
    });

    showToast("Đã tạo lớp thành công.", "success");
    await refreshClassroomData(
      response?.data?.id || response?.data?.classId || "",
    );
  } catch (error) {
    showToast(error.message || "Không thể tạo lớp.", "error");
  }
}

async function handleJoinClassroom() {
  const input = getClassroomJoinInput();
  const classCode = String(input?.value || "")
    .trim()
    .toUpperCase();

  if (!classCode) {
    showToast("Vui lòng nhập mã lớp.", "error");
    return;
  }

  try {
    const response = await apiRequestWithAuth("/api/classes/join", {
      method: "POST",
      body: {
        classCode,
      },
    });

    if (input) {
      input.value = "";
    }

    showToast("Tham gia lớp thành công.", "success");
    await refreshClassroomData(response?.data?.class?.id || "");
  } catch (error) {
    showToast(error.message || "Không thể tham gia lớp.", "error");
  }
}

async function copyCurrentClassroomCode() {
  const selectedClass = getSelectedClassroom();
  const classCode = String(selectedClass?.classCode || "").trim();

  if (!classCode) {
    showToast("Chưa có mã lớp để sao chép.", "error");
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(classCode);
    } else {
      const fallbackInput = document.createElement("input");
      fallbackInput.value = classCode;
      fallbackInput.setAttribute("readonly", "true");
      fallbackInput.style.position = "absolute";
      fallbackInput.style.left = "-9999px";
      document.body.appendChild(fallbackInput);
      fallbackInput.select();
      document.execCommand("copy");
      fallbackInput.remove();
    }

    showToast("Đã sao chép mã lớp.", "success");
  } catch (error) {
    showToast("Không thể sao chép mã lớp.", "error");
  }
}

async function deleteCurrentClassroom() {
  const selectedClass = getSelectedClassroom();
  const classId = String(selectedClass?.id || "").trim();

  if (!classId) {
    showToast("Chưa có lớp để xóa.", "error");
    return;
  }

  const className = selectedClass?.name || selectedClass?.className || classId;
  const confirmed = window.confirm(
    `Xóa lớp "${className}"? Hành động này không thể hoàn tác.`,
  );

  if (!confirmed) {
    return;
  }

  const firestore =
    window.firebase?.app && typeof window.firebase.firestore === "function"
      ? window.firebase.app().firestore()
      : null;

  if (!firestore) {
    showToast("Không thể xóa lớp lúc này.", "error");
    return;
  }

  try {
    await firestore.collection("classes").doc(classId).delete();
    showToast("Đã xóa lớp.", "success");
    classroomState.classes = classroomState.classes.filter(
      (item) => item.id !== classId,
    );
    classroomState.selectedClassId = classroomState.classes[0]?.id || "";
    renderClassroomListPanel();
  } catch (error) {
    console.warn("Không thể xóa lớp:", error);
    showToast(error.message || "Không thể xóa lớp.", "error");
  }
}

function bindClassroomControlsOnce() {
  const createButton = getClassroomCreateButton();
  const joinButton = getClassroomJoinButton();
  const joinInput = getClassroomJoinInput();
  const copyButton = getClassroomCopyButton();
  const deleteButton = getClassroomDeleteButton();
  const toggleButton = getClassroomToggleButton();
  const dropdown = document.querySelector(".classroom-dropdown");
  const classroomPage = document.getElementById("classroom");

  if (createButton && !createButton.dataset.bound) {
    createButton.dataset.bound = "true";
    createButton.addEventListener("click", () => {
      void handleCreateClassroom();
    });
  }

  if (joinButton && !joinButton.dataset.bound) {
    joinButton.dataset.bound = "true";
    joinButton.addEventListener("click", () => {
      void handleJoinClassroom();
    });
  }

  if (joinInput && !joinInput.dataset.bound) {
    joinInput.dataset.bound = "true";
    joinInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void handleJoinClassroom();
      }
    });
  }

  if (copyButton && !copyButton.dataset.bound) {
    copyButton.dataset.bound = "true";
    copyButton.addEventListener("click", () => {
      void copyCurrentClassroomCode();
    });
  }

  if (deleteButton && !deleteButton.dataset.bound) {
    deleteButton.dataset.bound = "true";
    deleteButton.addEventListener("click", () => {
      void deleteCurrentClassroom();
    });
  }

  if (toggleButton && dropdown && !toggleButton.dataset.bound) {
    toggleButton.dataset.bound = "true";
    toggleButton.addEventListener("click", () => {
      const isOpen = dropdown.classList.toggle("open");
      toggleButton.setAttribute("aria-expanded", String(isOpen));
      dropdown.setAttribute("aria-hidden", String(!isOpen));
    });
  }

  if (classroomPage && !classroomPage.dataset.bound) {
    classroomPage.dataset.bound = "true";
    classroomPage.addEventListener("click", (event) => {
      const classroomButton = event.target.closest("[data-classroom-id]");

      if (!classroomButton) {
        return;
      }

      const classroomId = String(
        classroomButton.dataset.classroomId || "",
      ).trim();

      if (!classroomId) {
        return;
      }

      classroomState.selectedClassId = classroomId;
      renderClassroomListPanel();
    });
  }
}

async function initializeClassroomPage() {
  bindClassroomControlsOnce();
  await loadClassroomData();
}

function getSelectedStudentAssignmentClass() {
  return (
    studentAssignmentClassState.classes.find(
      (classroom) =>
        classroom.id === studentAssignmentClassState.selectedClassId,
    ) ||
    studentAssignmentClassState.classes[0] ||
    null
  );
}

function closeStudentClassSwitcherMenu() {
  const switcher = getStudentClassSwitcher();

  if (!switcher) {
    return;
  }

  switcher.classList.remove("is-open");

  const button = getStudentClassSwitcherButton();
  if (button) {
    button.setAttribute("aria-expanded", "false");
  }
}

function renderStudentClassSwitcher() {
  const switcher = getStudentClassSwitcher();

  if (!switcher) {
    return;
  }

  const classes = studentAssignmentClassState.classes;
  const selectedClass = getSelectedStudentAssignmentClass();
  const selectedLabel = selectedClass
    ? selectedClass.name || selectedClass.className || "Lớp học"
    : "Chưa có lớp";

  switcher.innerHTML = `
    <button
      type="button"
      class="student-class-switcher-btn"
      data-student-class-toggle
      aria-expanded="${switcher.classList.contains("is-open") ? "true" : "false"}"
      ${classes.length === 0 ? "disabled" : ""}
    >
      <span>${escapeHtml(selectedLabel)}</span>
      <span aria-hidden="true">▾</span>
    </button>
    <div class="student-class-switcher-menu">
      ${
        classes.length === 0
          ? `<button type="button" disabled>Chưa có lớp đã tham gia</button>`
          : classes
              .map((classroom) => {
                const isActive =
                  classroom.id === studentAssignmentClassState.selectedClassId;
                return `
                  <button
                    type="button"
                    data-student-class-id="${escapeHtml(classroom.id)}"
                    class="${isActive ? "is-active" : ""}"
                  >
                    ${escapeHtml(classroom.name || classroom.className || "Lớp học")}
                  </button>
                `;
              })
              .join("")
      }
    </div>
  `;
}

function setStudentAssignmentActiveClass(classId) {
  const normalizedClassId = String(classId || "").trim();

  if (!normalizedClassId) {
    return;
  }

  studentAssignmentClassState.selectedClassId = normalizedClassId;
  renderStudentClassSwitcher();
  void refreshStudentAssignmentsFeed();
}

async function loadStudentAssignmentClasses(preferredClassId = "") {
  const switcher = getStudentClassSwitcher();

  try {
    studentAssignmentClassState.loading = true;

    if (switcher) {
      switcher.innerHTML = `
        <button type="button" class="student-class-switcher-btn" disabled>
          Đang tải lớp...
        </button>
      `;
    }

    const response = await apiRequestWithAuth("/api/classes/my", {
      method: "GET",
    });

    const classes = sortClassroomRecords(
      Array.isArray(response?.data)
        ? response.data.map(normalizeClassroomRecord).filter(Boolean)
        : [],
    );

    studentAssignmentClassState.classes = classes;

    if (
      preferredClassId &&
      classes.some((item) => item.id === preferredClassId)
    ) {
      studentAssignmentClassState.selectedClassId = preferredClassId;
    } else if (
      studentAssignmentClassState.selectedClassId &&
      classes.some(
        (item) => item.id === studentAssignmentClassState.selectedClassId,
      )
    ) {
      // keep current selection
    } else {
      studentAssignmentClassState.selectedClassId = classes[0]?.id || "";
    }

    renderStudentClassSwitcher();
    return classes;
  } catch (error) {
    studentAssignmentClassState.classes = [];
    studentAssignmentClassState.selectedClassId = "";

    if (switcher) {
      switcher.innerHTML = `
        <button type="button" class="student-class-switcher-btn" disabled>
          Không thể tải lớp
        </button>
      `;
    }

    showToast(error.message || "Không thể tải lớp đã tham gia.", "error");
    return [];
  } finally {
    studentAssignmentClassState.loading = false;
  }
}

async function refreshStudentAssignmentClasses(preferredClassId = "") {
  const classes = await loadStudentAssignmentClasses(preferredClassId);
  await refreshStudentAssignmentsFeed();
  return classes;
}

async function handleStudentJoinClass() {
  const classCode = String(window.prompt("Nhập mã lớp") || "")
    .trim()
    .toUpperCase();

  if (!classCode) {
    return;
  }

  try {
    const response = await apiRequestWithAuth("/api/classes/join", {
      method: "POST",
      body: {
        classCode,
      },
    });

    showToast("Tham gia lớp thành công.", "success");
    await refreshStudentAssignmentClasses(response?.data?.class?.id || "");
  } catch (error) {
    showToast(error.message || "Không thể tham gia lớp.", "error");
  }
}

function bindStudentAssignmentControlsOnce() {
  const switcher = getStudentClassSwitcher();
  const joinButton = getJoinClassActionButton();
  const assignmentsPage = getAssignmentsPageRoot();

  if (switcher && !switcher.dataset.bound) {
    switcher.dataset.bound = "true";

    switcher.addEventListener("click", (event) => {
      const toggleButton = event.target.closest("[data-student-class-toggle]");
      const classButton = event.target.closest("[data-student-class-id]");

      if (toggleButton) {
        const isOpen = switcher.classList.toggle("is-open");
        toggleButton.setAttribute("aria-expanded", String(isOpen));
        return;
      }

      if (classButton) {
        const classId = String(classButton.dataset.studentClassId || "").trim();

        if (!classId) {
          return;
        }

        setStudentAssignmentActiveClass(classId);
        closeStudentClassSwitcherMenu();
      }
    });
  }

  if (assignmentsPage && !assignmentsPage.dataset.assignmentControlsBound) {
    assignmentsPage.dataset.assignmentControlsBound = "true";

    assignmentsPage.addEventListener("click", (event) => {
      const submitTrigger = event.target.closest(
        [
          "button[data-assignment-submit]",
          "button[data-action='submit-assignment']",
          "button[data-action='submit-assignment-form']",
          "button.assignment-submit-btn",
          "button.submit-assignment-btn",
          "input[type='submit'][data-assignment-submit]",
        ].join(","),
      );
      const assignmentPrimaryAction = event.target.closest(
        "[data-assignment-action='detail-primary']",
      );
      const assignmentAction = event.target.closest("[data-assignment-action]");
      const assignmentCard = event.target.closest("[data-assignment-id]");

      if (submitTrigger) {
        event.preventDefault();
        event.stopPropagation();
        void submitStudentAssignment(submitTrigger);
        return;
      }

      if (!assignmentCard) {
        return;
      }

      const assignmentId = String(
        assignmentCard.dataset.assignmentId || "",
      ).trim();

      if (!assignmentId) {
        return;
      }

      if (assignmentPrimaryAction) {
        event.preventDefault();
        event.stopPropagation();
        if (getCurrentRole() === "student") {
          void openStudentAssignmentDetail(assignmentId);
        } else {
          void openTeacherAssignmentDetail(assignmentId);
        }
        return;
      }

      if (assignmentAction) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (getCurrentRole() === "student") {
        void openStudentAssignmentDetail(assignmentId);
      } else {
        void openTeacherAssignmentDetail(assignmentId);
      }
    });

    assignmentsPage.addEventListener("submit", (event) => {
      const submitForm = event.target.closest(
        [
          "form[data-assignment-form]",
          "form.assignment-form",
          "form[data-student-assignment-form]",
        ].join(","),
      );

      if (!submitForm) {
        return;
      }

      event.preventDefault();
      void submitStudentAssignment(
        submitForm.querySelector(
          [
            "button[data-assignment-submit]",
            "button[data-action='submit-assignment']",
            "button[data-action='submit-assignment-form']",
            "button.assignment-submit-btn",
            "button.submit-assignment-btn",
            "input[type='submit'][data-assignment-submit]",
          ].join(","),
        ),
      );
    });
  }

  if (joinButton && !joinButton.dataset.bound) {
    joinButton.dataset.bound = "true";
    joinButton.addEventListener("click", () => {
      void handleStudentJoinClass();
    });
  }

  if (!document.body.dataset.studentClassSwitcherBound) {
    document.body.dataset.studentClassSwitcherBound = "true";
    document.addEventListener("click", (event) => {
      const switcherRoot = getStudentClassSwitcher();

      if (!switcherRoot || switcherRoot.contains(event.target)) {
        return;
      }

      closeStudentClassSwitcherMenu();
    });
  }
}

async function initializeStudentAssignmentPage() {
  if (getCurrentRole() !== "student") {
    return;
  }

  studentAssignmentDetailState.visible = false;
  studentAssignmentDetailState.assignment = null;
  studentAssignmentDetailState.answers = [];
  setStudentAssignmentFeedVisibility(true);

  const detailRoot = getAssignmentDetailRoot();
  if (detailRoot) {
    detailRoot.hidden = true;
    detailRoot.innerHTML = "";
  }

  bindStudentAssignmentControlsOnce();
  await loadStudentAssignmentClasses();
  await refreshStudentAssignmentsFeed();
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

function getAssignmentEditorRoot() {
  return document.querySelector("[data-assignment-editor]");
}

function getAssignmentAiQuestionListRoot() {
  return document.querySelector("[data-ai-question-list]");
}

function getAssignmentAiStatusNode() {
  return document.querySelector("[data-ai-status]");
}

function getAssignmentAiTopicSelect() {
  return document.querySelector("[data-ai-topic-select]");
}

function getAssignmentAiGradeSelect() {
  return document.querySelector("[data-ai-grade-select]");
}

function getAssignmentAiQuestionCountSelect() {
  return document.querySelector("[data-ai-question-count-select]");
}

function getAssignmentAiDifficultySelect() {
  return document.querySelector("[data-ai-difficulty-select]");
}

function getAssignmentAiNotesTextarea() {
  return document.querySelector("[data-ai-notes]");
}

function getAssignmentAiGenerateButton() {
  return document.querySelector("[data-ai-generate-button]");
}

function getAssignmentAiAddButton() {
  return document.querySelector("[data-ai-add-question]");
}

function getAssignmentSubjectDisplayLabel(subject) {
  const normalized = String(subject || "")
    .trim()
    .toLowerCase();

  if (normalized === "math" || normalized === "toán" || normalized === "toan") {
    return "Toán";
  }

  if (
    normalized === "english" ||
    normalized === "tiếng anh" ||
    normalized === "tieng anh"
  ) {
    return "Tiếng Anh";
  }

  return String(subject || "").trim() || "--";
}

function getAssignmentGradeLabel(value) {
  const grade = String(value || "").trim();

  return grade ? `Lớp ${grade}` : "--";
}

function getAssignmentDifficultyLabel(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return "--";
  }

  return normalized;
}

function getAssignmentAiSelectedTopic() {
  const topicId = String(assignmentAiState.topicId || "").trim();

  if (!topicId) {
    return null;
  }

  return (
    assignmentAiState.topics.find(
      (topic) => String(topic?.topicId || "").trim() === topicId,
    ) || null
  );
}

function resetAssignmentAiState() {
  assignmentAiState.topics = [];
  assignmentAiState.topicsKey = "";
  assignmentAiState.topicId = "";
  assignmentAiState.topicName = "";
  assignmentAiState.grade = "4";
  assignmentAiState.questionCount = "10";
  assignmentAiState.difficulty = "Trung bình";
  assignmentAiState.notes = "";
  assignmentAiState.questions = [];
  assignmentAiState.loadingTopics = false;
  assignmentAiState.loading = false;
  assignmentAiState.error = "";
}

function createAssignmentAiQuestion(index = 1) {
  return {
    id: generateManualQuestionId(index),
    question: "",
    options: ["", "", "", ""],
    correctAnswerIndex: 0,
  };
}

function normalizeAssignmentAiQuestion(question, index = 0) {
  const options = Array.isArray(question?.options)
    ? question.options.slice(0, 4).map((option) => String(option || "").trim())
    : ["", "", "", ""];

  while (options.length < 4) {
    options.push("");
  }

  const parsedCorrectIndex = Number(
    question?.correctAnswerIndex ?? question?.correctAnswer ?? 0,
  );
  const correctAnswerIndex = Number.isInteger(parsedCorrectIndex)
    ? Math.min(Math.max(parsedCorrectIndex, 0), 3)
    : 0;

  return {
    id: String(question?.id || generateManualQuestionId(index + 1)),
    question: String(question?.question || "").trim(),
    options,
    correctAnswerIndex,
  };
}

function normalizeAssignmentAiQuestions(questions) {
  return (Array.isArray(questions) ? questions : []).map((question, index) =>
    normalizeAssignmentAiQuestion(question, index),
  );
}

function normalizeAssignmentAiQuestionsForSubmission(questions) {
  return (Array.isArray(questions) ? questions : [])
    .map((question, index) => {
      const normalizedQuestion = normalizeAssignmentAiQuestion(question, index);
      const options = normalizedQuestion.options.map((option) =>
        String(option || "").trim(),
      );

      if (options.length < 4 || options.some((option) => !option)) {
        return null;
      }

      const correctAnswerIndex = Math.min(
        Math.max(Number(normalizedQuestion.correctAnswerIndex) || 0, 0),
        3,
      );

      return {
        id: normalizedQuestion.id,
        question: normalizedQuestion.question,
        options,
        correctAnswer: options[correctAnswerIndex],
      };
    })
    .filter(Boolean);
}

function getAssignmentAiDraft() {
  const selectedTopic = getAssignmentAiSelectedTopic();
  const selectedClass = getSelectedManualAssignmentClass();
  const questionCount = Number(assignmentAiState.questionCount || 0);

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
    topicId: String(assignmentAiState.topicId || "").trim(),
    topicName: String(
      selectedTopic?.title ||
        selectedTopic?.name ||
        selectedTopic?.topicName ||
        assignmentAiState.topicName ||
        "",
    ).trim(),
    grade: String(assignmentAiState.grade || "").trim(),
    difficulty: String(assignmentAiState.difficulty || "").trim(),
    questionCount: Number.isFinite(questionCount) ? questionCount : 0,
    notes: String(assignmentAiState.notes || "").trim(),
    questions: Array.isArray(assignmentAiState.questions)
      ? assignmentAiState.questions.map((question, index) =>
          normalizeAssignmentAiQuestion(question, index),
        )
      : [],
  };
}

function validateAssignmentAiGenerationDraft(draft) {
  if (!draft.subject) {
    return "Vui lòng chọn môn học.";
  }

  if (!draft.topicId) {
    return "Vui lòng chọn chủ đề.";
  }

  if (!draft.grade) {
    return "Vui lòng chọn khối.";
  }

  if (!draft.difficulty) {
    return "Vui lòng chọn độ khó.";
  }

  if (!Number.isInteger(draft.questionCount) || draft.questionCount <= 0) {
    return "Số câu hỏi phải lớn hơn 0.";
  }

  return "";
}

function validateAssignmentMetaDraft(draft) {
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

  return "";
}

function validateAssignmentAiDraft(draft) {
  const metaValidation = validateAssignmentMetaDraft(draft);

  if (metaValidation) {
    return metaValidation;
  }

  const generationValidation = validateAssignmentAiGenerationDraft(draft);

  if (generationValidation) {
    return generationValidation;
  }

  if (!Array.isArray(draft.questions) || draft.questions.length === 0) {
    return "Vui lòng tạo ít nhất 1 câu hỏi bằng AI.";
  }

  for (let index = 0; index < draft.questions.length; index += 1) {
    const question = draft.questions[index];

    if (!question.question) {
      return `Câu ${index + 1}: vui lòng nhập nội dung câu hỏi.`;
    }

    if (
      !Array.isArray(question.options) ||
      question.options.length < 4 ||
      question.options.some((option) => !String(option || "").trim())
    ) {
      return `Câu ${index + 1}: vui lòng nhập đủ 4 đáp án.`;
    }
  }

  return "";
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

function syncAssignmentAiFields() {
  const topicSelect = getAssignmentAiTopicSelect();
  const gradeSelect = getAssignmentAiGradeSelect();
  const questionCountSelect = getAssignmentAiQuestionCountSelect();
  const difficultySelect = getAssignmentAiDifficultySelect();
  const notesTextarea = getAssignmentAiNotesTextarea();
  const generateButton = getAssignmentAiGenerateButton();

  if (topicSelect) {
    topicSelect.value = assignmentAiState.topicId || "";
    topicSelect.disabled = assignmentAiState.loadingTopics;
  }

  if (gradeSelect) {
    gradeSelect.value = assignmentAiState.grade || "4";
  }

  if (questionCountSelect) {
    questionCountSelect.value = String(assignmentAiState.questionCount || "10");
  }

  if (difficultySelect) {
    difficultySelect.value = assignmentAiState.difficulty || "Trung bình";
  }

  if (notesTextarea) {
    notesTextarea.value = assignmentAiState.notes || "";
  }

  if (generateButton) {
    generateButton.disabled = Boolean(
      assignmentAiState.loading ||
      assignmentAiState.loadingTopics ||
      !isAiAssignmentEnabled(),
    );
    generateButton.textContent = assignmentAiState.loading
      ? "AI đang tạo đề..."
      : !isAiAssignmentEnabled()
        ? "AI Tạo bài tập giáo viên đang tắt"
        : "✨ Tạo đề bằng AI";
  }
}

function getAssignmentAiTopicsKey() {
  return `${String(assignmentAiState.grade || "").trim()}:${String(
    manualAssignmentState.subject || "",
  ).trim()}`;
}

async function loadAssignmentAiTopics({ force = false } = {}) {
  const subject = normalizeSubjectLabel(manualAssignmentState.subject || "");
  const grade = String(assignmentAiState.grade || "4").trim() || "4";
  const topicsKey = `${grade}:${subject}`;

  if (
    !force &&
    assignmentAiState.topicsKey === topicsKey &&
    Array.isArray(assignmentAiState.topics) &&
    assignmentAiState.topics.length > 0
  ) {
    syncAssignmentAiFields();
    renderAssignmentPreview();
    return assignmentAiState.topics;
  }

  assignmentAiState.topicsKey = topicsKey;
  assignmentAiState.loadingTopics = true;
  assignmentAiState.error = "";
  syncAssignmentAiFields();
  renderAssignmentEditor();
  renderAssignmentPreview();

  try {
    const params = new URLSearchParams({
      grade,
      subject,
    });

    const response = await apiRequestWithAuth(
      `/api/quiz/topics?${params.toString()}`,
      {
        method: "GET",
      },
    );

    const topics = Array.isArray(response?.data)
      ? response.data
          .map((topic) => ({
            ...topic,
            topicId: String(topic?.topicId || "").trim(),
            title: String(
              topic?.title || topic?.name || topic?.topicName || "",
            ).trim(),
            description: String(topic?.description || "").trim(),
            grade: String(topic?.grade || "").trim(),
            subject: String(topic?.subject || "").trim(),
          }))
          .filter((topic) => topic.topicId)
      : [];

    assignmentAiState.topics = topics;

    if (
      assignmentAiState.topicId &&
      !topics.some((topic) => topic.topicId === assignmentAiState.topicId)
    ) {
      assignmentAiState.topicId = "";
      assignmentAiState.topicName = "";
    }

    const selectedTopic = getAssignmentAiSelectedTopic();
    if (selectedTopic) {
      assignmentAiState.topicName =
        selectedTopic.title ||
        selectedTopic.name ||
        selectedTopic.topicName ||
        "";
    }

    assignmentAiState.error = "";
  } catch (error) {
    assignmentAiState.topics = [];
    assignmentAiState.topicId = "";
    assignmentAiState.topicName = "";
    assignmentAiState.error =
      error.message || "Không thể tải danh sách chủ đề.";
    showToast(assignmentAiState.error, "error");
  } finally {
    assignmentAiState.loadingTopics = false;
    renderAssignmentEditor();
    renderAssignmentPreview();
  }

  return assignmentAiState.topics;
}

function addAssignmentAiQuestion() {
  assignmentAiState.questions = Array.isArray(assignmentAiState.questions)
    ? assignmentAiState.questions.length > 0
      ? assignmentAiState.questions.map((question, index) => ({
          ...normalizeAssignmentAiQuestion(question, index),
          id: question.id || generateManualQuestionId(index + 1),
        }))
      : []
    : [];

  assignmentAiState.questions.push(
    createAssignmentAiQuestion(assignmentAiState.questions.length + 1),
  );

  renderAssignmentEditor();
  renderAssignmentPreview();
}

function removeAssignmentAiQuestion(questionIndex) {
  if (!Array.isArray(assignmentAiState.questions)) {
    assignmentAiState.questions = [];
  }

  const nextQuestions = assignmentAiState.questions.filter(
    (_, index) => index !== questionIndex,
  );

  assignmentAiState.questions = nextQuestions.length
    ? nextQuestions.map((question, index) => ({
        ...normalizeAssignmentAiQuestion(question, index),
        id: question.id || generateManualQuestionId(index + 1),
      }))
    : [];

  renderAssignmentEditor();
  renderAssignmentPreview();
}

function setAssignmentCreateMethod(nextMethod) {
  const normalizedMethod = nextMethod === "ai" ? "ai" : "manual";

  if (createMethod === normalizedMethod) {
    return;
  }

  createMethod = normalizedMethod;
  assignmentAiState.error = "";
  syncManualAssignmentMethodCards();
  renderAssignmentEditor();
  renderAssignmentPreview();

  if (createMethod === "ai") {
    void loadAssignmentAiTopics();
  }
}

async function handleAssignmentAiGenerate() {
  const draft = getAssignmentAiDraft();
  const validationMessage = validateAssignmentAiGenerationDraft(draft);
  const profile = getCurrentAuthUser();

  if (validationMessage) {
    showToast(validationMessage, "error");
    return;
  }

  if (!isAiAssignmentEnabled()) {
    assignmentAiState.error =
      "AI Tạo bài tập giáo viên hiện đang tắt trong hệ thống.";
    showToast(assignmentAiState.error, "error");
    renderAssignmentEditor();
    renderAssignmentPreview();
    return;
  }

  assignmentAiState.loading = true;
  assignmentAiState.error = "";
  renderAssignmentEditor();
  renderAssignmentPreview();

  try {
    const response = await apiRequestWithAuth("/api/assignments/generate-ai", {
      method: "POST",
      body: {
        subject: draft.subject,
        topicId: draft.topicId,
        topicName: draft.topicName,
        grade: draft.grade,
        difficulty: draft.difficulty,
        questionCount: draft.questionCount,
        notes: draft.notes,
      },
    });

    const generatedQuestions = Array.isArray(response?.data?.questions)
      ? response.data.questions
      : [];

    if (generatedQuestions.length === 0) {
      throw new Error("AI chưa tạo được câu hỏi hợp lệ.");
    }

    assignmentAiState.questions = generatedQuestions.map((question, index) =>
      normalizeAssignmentAiQuestion(
        {
          id: question.id || generateManualQuestionId(index + 1),
          question: question.question,
          options: Array.isArray(question.options)
            ? question.options
            : ["", "", "", ""],
          correctAnswerIndex: Number(question.correctAnswer),
        },
        index,
      ),
    );

    assignmentAiState.error = "";
    showToast("Đã tạo đề AI thành công.", "success");
    void recordAiUsageLog({
      feature: "assignment_ai",
      action: "generate",
      status: "success",
      success: true,
      userId: profile?.uid || profile?.userId || profile?.id || "",
      role: profile?.role || "teacher",
      meta: {
        grade: draft.grade,
        subject: draft.subject,
        topicId: draft.topicId,
      },
    });
  } catch (error) {
    assignmentAiState.error = error.message || "Không thể tạo đề AI.";
    showToast(assignmentAiState.error, "error");
    void recordAiUsageLog({
      feature: "assignment_ai",
      action: "generate",
      status: "failed",
      success: false,
      userId: profile?.uid || profile?.userId || profile?.id || "",
      role: profile?.role || "teacher",
      message: assignmentAiState.error,
      meta: {
        grade: draft.grade,
        subject: draft.subject,
        topicId: draft.topicId,
      },
    });
  } finally {
    assignmentAiState.loading = false;
    renderAssignmentEditor();
    renderAssignmentPreview();
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

function updateManualAssignmentStateFromElement(target) {
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.matches("[data-ai-topic-select]")) {
    assignmentAiState.topicId = target.value || "";
    const selectedTopic = getAssignmentAiSelectedTopic();
    assignmentAiState.topicName =
      selectedTopic?.title ||
      selectedTopic?.name ||
      selectedTopic?.topicName ||
      "";
    return;
  }

  if (target.matches("[data-ai-grade-select]")) {
    assignmentAiState.grade = target.value || "4";
    return;
  }

  if (target.matches("[data-ai-question-count-select]")) {
    assignmentAiState.questionCount = target.value || "10";
    return;
  }

  if (target.matches("[data-ai-difficulty-select]")) {
    assignmentAiState.difficulty = target.value || "Trung bình";
    return;
  }

  if (target.matches("[data-ai-notes]")) {
    assignmentAiState.notes = target.value;
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

  const aiBlock = target.closest("[data-ai-question-block]");

  if (aiBlock) {
    const questionIndex = Number(aiBlock.dataset.questionIndex) - 1;
    const question = assignmentAiState.questions[questionIndex];

    if (!question) {
      return;
    }

    const fieldName = target.getAttribute("name");

    if (!fieldName) {
      return;
    }

    if (fieldName === "question") {
      question.question = target.value;
      return;
    }

    if (fieldName === "correctAnswerIndex") {
      question.correctAnswerIndex = Math.min(
        Math.max(Number(target.value) || 0, 0),
        3,
      );
      return;
    }

    const optionMatch = fieldName.match(/^option-(\d)$/);

    if (!optionMatch) {
      return;
    }

    const optionIndex = Number(optionMatch[1]);

    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) {
      return;
    }

    question.options[optionIndex] = target.value;
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

  if (normalized === "math" || normalized === "toán" || normalized === "toan") {
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

function formatRelativeTime(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    return "--";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) {
    return "Vừa xong";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} phút trước`;
  }

  if (diffHours < 24) {
    return `${diffHours} giờ trước`;
  }

  if (diffDays === 1) {
    return "Hôm qua";
  }

  if (diffDays < 7) {
    return `${diffDays} ngày trước`;
  }

  return date.toLocaleDateString("vi-VN");
}

function logTeacherDashboardStep(label, startTime = 0, details = "") {
  if (!isDevelopmentBuild) {
    return;
  }

  const elapsedMs =
    Number.isFinite(Number(startTime)) && startTime > 0
      ? Math.max(0, Math.round(performance.now() - startTime))
      : 0;

  const suffix = details ? `: ${details}` : "";
}

function startTeacherDashboardTimer() {
  return isDevelopmentBuild ? performance.now() : 0;
}

function getTeacherDashboardRoot() {
  return document.querySelector("#teacher-dashboard .teacher-dashboard-page");
}

function getTeacherDashboardGreetingNode() {
  return document.querySelector("[data-teacher-dashboard-greeting]");
}

function getTeacherDashboardAvatarNode() {
  return document.querySelector("[data-teacher-dashboard-avatar]");
}

function getTeacherDashboardStatNode(key) {
  return document.querySelector(`[data-teacher-dashboard-${key}]`);
}

function getTeacherDashboardActivityListNode() {
  return document.querySelector("[data-teacher-dashboard-activity-list]");
}

function getTeacherDashboardAttentionListNode() {
  return document.querySelector("[data-teacher-dashboard-attention-list]");
}

function getTeacherDashboardDateValue(record) {
  return (
    getActivityLogDateValue(record) ||
    getActivityLogDateValue({
      createdAt: record?.createdAt,
      updatedAt: record?.updatedAt,
      submittedAt: record?.submittedAt,
      gradedAt: record?.gradedAt,
      timestamp: record?.timestamp,
      time: record?.time,
      date: record?.date,
    })
  );
}

function uniqueTeacherDashboardStudents(classrooms) {
  const studentRecords = [];
  const seenIds = new Set();

  (Array.isArray(classrooms) ? classrooms : []).forEach((classroom) => {
    const students = Array.isArray(classroom?.students)
      ? classroom.students
      : Array.isArray(classroom?.studentIds)
        ? classroom.studentIds
        : Array.isArray(classroom?.members)
          ? classroom.members
          : [];

    students.forEach((student) => {
      const studentId =
        student && typeof student === "object"
          ? String(
              student.id ||
                student.studentId ||
                student.userId ||
                student.uid ||
                student.username ||
                student.name ||
                "",
            ).trim()
          : String(student || "").trim();

      if (!studentId || seenIds.has(studentId)) {
        return;
      }

      seenIds.add(studentId);
      studentRecords.push({
        id: studentId,
        classroomId: String(classroom?.id || "").trim(),
      });
    });
  });

  return studentRecords;
}

function calculateTotalStudents(classrooms) {
  return uniqueTeacherDashboardStudents(classrooms).length;
}

function calculateTotalClasses(classrooms) {
  return uniqueClassroomValues(
    (Array.isArray(classrooms) ? classrooms : [])
      .map((classroom) => String(classroom?.id || "").trim())
      .filter(Boolean),
  ).length;
}

function calculateTotalAssignments(assignments) {
  return uniqueClassroomValues(
    (Array.isArray(assignments) ? assignments : [])
      .filter(
        (assignment) =>
          normalizeTeacherDashboardAssignmentStatus(assignment?.status) !== "",
      )
      .map((assignment) => String(assignment?.id || "").trim())
      .filter(Boolean),
  ).length;
}

function calculateCompletionRate(
  assignments,
  submissionsByAssignmentId = new Map(),
  classrooms = [],
) {
  const normalizedAssignments = Array.isArray(assignments) ? assignments : [];
  let totalAssigned = 0;
  let totalCompleted = 0;

  normalizedAssignments.forEach((assignment) => {
    const classroom = getTeacherDashboardClassroomById(
      classrooms,
      assignment?.classId,
    );
    const classStudents = getTeacherAssignmentClassroomStudentCount(classroom);
    const assignedStudents = Math.max(0, classStudents);
    const submissions =
      submissionsByAssignmentId.get(String(assignment?.id || "").trim()) || [];
    const completedStudents = uniqueClassroomValues(
      submissions.map((submission) =>
        String(submission?.studentId || "").trim(),
      ),
    ).length;

    totalAssigned += assignedStudents;
    totalCompleted += Math.min(
      completedStudents,
      assignedStudents || completedStudents,
    );
  });

  if (totalAssigned <= 0) {
    return 0;
  }

  return Math.round((totalCompleted / totalAssigned) * 100);
}

function getTeacherDashboardClassroomStudentCount(classroom) {
  if (!classroom) {
    return 0;
  }

  return getTeacherAssignmentClassroomStudentCount(classroom);
}

function getTeacherDashboardClassroomById(classrooms, classId) {
  const normalizedClassId = String(classId || "").trim();

  if (!normalizedClassId) {
    return null;
  }

  return (
    (Array.isArray(classrooms) ? classrooms : []).find(
      (classroom) => String(classroom?.id || "").trim() === normalizedClassId,
    ) || null
  );
}

function normalizeTeacherDashboardAssignmentStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  if (normalized === "deleted" || normalized === "archived") {
    return "";
  }

  return normalized || "active";
}

function getTeacherDashboardSubmissionMap(submissionsByAssignmentId) {
  return submissionsByAssignmentId instanceof Map
    ? submissionsByAssignmentId
    : new Map();
}

function getTeacherDashboardAssignmentSummary(
  assignment,
  classrooms,
  submissionsByAssignmentId,
) {
  const classInfo = getTeacherDashboardClassroomById(
    classrooms,
    assignment?.classId,
  );
  const totalStudents = getTeacherDashboardClassroomStudentCount(classInfo);
  const submissions =
    getTeacherDashboardSubmissionMap(submissionsByAssignmentId).get(
      String(assignment?.id || "").trim(),
    ) || [];
  const submittedStudents = uniqueClassroomValues(
    submissions.map((submission) => String(submission?.studentId || "").trim()),
  ).length;
  const completionRate =
    totalStudents > 0
      ? Math.round((submittedStudents / totalStudents) * 100)
      : 0;

  return {
    classInfo,
    totalStudents,
    submittedStudents,
    completionRate,
  };
}

function getTeacherDashboardActivityIcon(type) {
  if (type === "submission") {
    return "📝";
  }

  if (type === "achievement") {
    return "🏅";
  }

  if (type === "assignment") {
    return "📄";
  }

  return "📚";
}

function buildTeacherDashboardActivityItems({
  profile,
  assignments = [],
  submissionsByAssignmentId = new Map(),
}) {
  const assignmentMap = new Map(
    (Array.isArray(assignments) ? assignments : []).map((assignment) => [
      String(assignment?.id || "").trim(),
      assignment,
    ]),
  );
  const activityItems = [];

  assignmentMap.forEach((assignment) => {
    const createdAt = getTeacherDashboardDateValue(assignment);

    if (!createdAt) {
      return;
    }

    activityItems.push({
      type: "assignment",
      time: createdAt,
      icon: getTeacherDashboardActivityIcon("assignment"),
      avatar: getProfileAvatar(profile),
      text: `Bạn vừa tạo bài "${assignment.title || "Bài tập"}"`,
    });
  });

  getTeacherDashboardSubmissionMap(submissionsByAssignmentId).forEach(
    (submissions, assignmentId) => {
      const assignment = assignmentMap.get(String(assignmentId || "").trim());
      if (!assignment || !Array.isArray(submissions)) {
        return;
      }

      submissions.forEach((submission) => {
        const submissionTime = getTeacherDashboardDateValue(submission);

        if (!submissionTime) {
          return;
        }

        const studentName = String(
          submission?.studentName || submission?.studentId || "Học sinh",
        ).trim();

        activityItems.push({
          type: "submission",
          time: submissionTime,
          icon: getTeacherDashboardActivityIcon("submission"),
          avatar: "assets/userAvatar/boy.png",
          text: `${studentName} đã nộp bài "${assignment.title || "Bài tập"}"`,
        });
      });
    },
  );

  return activityItems
    .filter((item) => item && item.time)
    .sort((left, right) => right.time.getTime() - left.time.getTime())
    .slice(0, 10);
}

function buildTeacherDashboardAttentionItems({
  assignments = [],
  classrooms = [],
  submissionsByAssignmentId = new Map(),
}) {
  const sortedAssignments = [...(Array.isArray(assignments) ? assignments : [])]
    .map((assignment) => {
      const summary = getTeacherDashboardAssignmentSummary(
        assignment,
        classrooms,
        submissionsByAssignmentId,
      );
      return {
        ...assignment,
        summary,
        completionRate: summary.completionRate,
      };
    })
    .filter(
      (assignment) =>
        String(assignment?.status || "active").toLowerCase() !== "deleted",
    )
    .sort((left, right) => {
      const leftRate = Number(left.completionRate) || 0;
      const rightRate = Number(right.completionRate) || 0;

      if (leftRate !== rightRate) {
        return leftRate - rightRate;
      }

      const leftTime = Date.parse(left.createdAt || left.updatedAt || "") || 0;
      const rightTime =
        Date.parse(right.createdAt || right.updatedAt || "") || 0;
      return rightTime - leftTime;
    });

  const belowNinety = sortedAssignments.filter(
    (assignment) => (Number(assignment.completionRate) || 0) < 90,
  );
  const sourceAssignments =
    belowNinety.length > 0
      ? belowNinety.slice(0, 3)
      : [...sortedAssignments]
          .sort((left, right) => {
            const leftTime =
              Date.parse(left.createdAt || left.updatedAt || "") || 0;
            const rightTime =
              Date.parse(right.createdAt || right.updatedAt || "") || 0;
            return rightTime - leftTime;
          })
          .slice(0, 3);

  return sourceAssignments.map((assignment) => {
    const summary =
      assignment.summary ||
      getTeacherDashboardAssignmentSummary(
        assignment,
        classrooms,
        submissionsByAssignmentId,
      );
    const totalStudents = summary.totalStudents || 0;
    const submittedStudents = summary.submittedStudents || 0;
    const completionRate = summary.completionRate || 0;

    return {
      id: assignment.id,
      title: assignment.title || "Bài tập",
      totalStudents,
      submittedStudents,
      completionRate,
      completionLabel:
        totalStudents > 0
          ? `${submittedStudents}/${totalStudents} học sinh hoàn thành`
          : "Chưa có dữ liệu học sinh",
      progressWidth: `${Math.max(0, Math.min(completionRate, 100))}%`,
      compact: completionRate >= 90,
    };
  });
}

async function fetchTeacherDashboardData(
  profile = null,
  { forceRefresh = false } = {},
) {
  const teacherId = String(
    profile?.uid || profile?.userId || profile?.id || getCurrentUserId() || "",
  ).trim();

  if (!teacherId) {
    return null;
  }

  if (
    teacherDashboardState.loaded &&
    teacherDashboardState.teacherId === teacherId &&
    teacherDashboardState.data &&
    !forceRefresh
  ) {
    return teacherDashboardState.data;
  }

  if (
    teacherDashboardState.loading &&
    teacherDashboardState.teacherId === teacherId &&
    teacherDashboardState.pendingPromise
  ) {
    return teacherDashboardState.pendingPromise;
  }

  teacherDashboardState.loading = true;
  teacherDashboardState.teacherId = teacherId;
  const dashboardStart = startTeacherDashboardTimer();

  const requestPromise = (async () => {
    try {
      const service = getAssignmentService();
      const [resolvedProfile, classesResponse, assignmentsResponse] =
        await Promise.all([
          window.EduKidsProfileService?.fetchCurrentProfile
            ? window.EduKidsProfileService.fetchCurrentProfile().catch(
                () => profile,
              )
            : Promise.resolve(profile),
          apiRequestWithAuth("/api/classes/my", { method: "GET" }).catch(
            () => ({ data: [] }),
          ),
          service?.getTeacherAssignments
            ? service.getTeacherAssignments(teacherId).catch(() => [])
            : Promise.resolve([]),
        ]);

      const classrooms = sortClassroomRecords(
        Array.isArray(classesResponse?.data)
          ? classesResponse.data.map(normalizeClassroomRecord).filter(Boolean)
          : [],
      );
      logTeacherDashboardStep(
        "classes loaded",
        dashboardStart,
        `${classrooms.length}`,
      );

      const studentIds = uniqueClassroomValues(
        uniqueTeacherDashboardStudents(classrooms).map((record) => record.id),
      );
      logTeacherDashboardStep(
        "students loaded",
        dashboardStart,
        `${studentIds.length}`,
      );

      const assignments = (
        Array.isArray(assignmentsResponse) ? assignmentsResponse : []
      )
        .map((assignment) => ({
          ...assignment,
          status: normalizeTeacherDashboardAssignmentStatus(assignment?.status),
        }))
        .filter((assignment) =>
          Boolean(String(assignment?.status || "").trim()),
        );
      logTeacherDashboardStep(
        "assignments loaded",
        dashboardStart,
        `${assignments.length}`,
      );

      const submissionsEntries = await Promise.all(
        assignments.map(async (assignment) => {
          const assignmentId = String(assignment?.id || "").trim();

          if (!assignmentId || !service?.fetchAssignmentSubmissions) {
            return [assignmentId, []];
          }

          const submissions = await service
            .fetchAssignmentSubmissions(assignmentId)
            .catch(() => []);
          return [assignmentId, Array.isArray(submissions) ? submissions : []];
        }),
      );
      const submissionsByAssignmentId = new Map(submissionsEntries);
      const dashboardData = {
        profile: resolvedProfile || profile || getCurrentAuthUser(),
        classrooms,
        assignments,
        submissionsByAssignmentId,
        totalStudents: calculateTotalStudents(classrooms),
        totalClasses: calculateTotalClasses(classrooms),
        totalAssignments: calculateTotalAssignments(assignments),
        completionRate: calculateCompletionRate(
          assignments,
          submissionsByAssignmentId,
          classrooms,
        ),
        activities: buildTeacherDashboardActivityItems({
          profile: resolvedProfile || profile || getCurrentAuthUser(),
          assignments,
          submissionsByAssignmentId,
        }),
        attentionItems: buildTeacherDashboardAttentionItems({
          assignments,
          classrooms,
          submissionsByAssignmentId,
        }),
      };

      logTeacherDashboardStep(
        "dashboard build completed",
        dashboardStart,
        `${dashboardData.totalStudents} students, ${dashboardData.totalClasses} classes, ${dashboardData.totalAssignments} assignments`,
      );

      teacherDashboardState.data = dashboardData;
      teacherDashboardState.loaded = true;
      return dashboardData;
    } catch (error) {
      console.warn("Không thể tải dữ liệu tổng quan giáo viên:", error);
      return null;
    } finally {
      teacherDashboardState.loading = false;
      teacherDashboardState.pendingPromise = null;
    }
  })();

  teacherDashboardState.pendingPromise = requestPromise;
  return requestPromise;
}

function renderTeacherDashboardFallback(profile = null) {
  const greetingNode = getTeacherDashboardGreetingNode();
  const avatarNode = getTeacherDashboardAvatarNode();
  const totalStudentsNode = getTeacherDashboardStatNode("total-students");
  const totalClassesNode = getTeacherDashboardStatNode("total-classes");
  const totalAssignmentsNode = getTeacherDashboardStatNode("total-assignments");
  const completionRateNode = getTeacherDashboardStatNode("completion-rate");
  const activityListNode = getTeacherDashboardActivityListNode();
  const attentionListNode = getTeacherDashboardAttentionListNode();

  if (greetingNode) {
    greetingNode.textContent = "Xin chào 👋";
  }

  if (avatarNode) {
    avatarNode.alt = "Giáo viên";
    avatarNode.src = getProfileAvatar(profile || getCurrentAuthUser());
  }

  if (totalStudentsNode) {
    totalStudentsNode.textContent = "--";
  }

  if (totalClassesNode) {
    totalClassesNode.textContent = "--";
  }

  if (totalAssignmentsNode) {
    totalAssignmentsNode.textContent = "--";
  }

  if (completionRateNode) {
    completionRateNode.textContent = "--";
  }

  if (activityListNode) {
    activityListNode.innerHTML = `
      <article class="teacher-activity-item">
        <img src="/assets/userAvatar/boy.png" alt="" />
        <div>
          <p>Đang tải hoạt động...</p>
          <span>--</span>
        </div>
      </article>
    `;
  }

  if (attentionListNode) {
    attentionListNode.innerHTML = `
      <article class="attention-card">
        <div class="attention-card-head">
          <h3>Đang tải...</h3>
          <p>--</p>
        </div>

        <div class="attention-progress">
          <div class="attention-progress-fill" style="width: 0%"></div>
        </div>

        <span>--</span>
      </article>
    `;
  }
}

function renderTeacherDashboard(profile = null) {
  if (normalizeRole(profile?.role || getCurrentRole()) !== "teacher") {
    return;
  }

  const dashboardRoot = getTeacherDashboardRoot();

  if (!dashboardRoot) {
    return;
  }

  const greetingNode = getTeacherDashboardGreetingNode();
  const avatarNode = getTeacherDashboardAvatarNode();
  const totalStudentsNode = getTeacherDashboardStatNode("total-students");
  const totalClassesNode = getTeacherDashboardStatNode("total-classes");
  const totalAssignmentsNode = getTeacherDashboardStatNode("total-assignments");
  const completionRateNode = getTeacherDashboardStatNode("completion-rate");
  const activityListNode = getTeacherDashboardActivityListNode();
  const attentionListNode = getTeacherDashboardAttentionListNode();
  const displayName = String(
    profile?.fullName || profile?.name || profile?.username || "",
  ).trim();
  const avatarSrc =
    window.EduKidsProfileService?.getAvatarPathFromProfile?.(profile) ||
    getProfileAvatar(profile);
  const dashboardData = teacherDashboardState.data;

  if (greetingNode) {
    greetingNode.textContent = displayName
      ? `Xin chào, ${displayName} 👋`
      : "Xin chào 👋";
  }

  if (avatarNode) {
    avatarNode.src = avatarSrc;
    avatarNode.alt = displayName ? displayName : "Giáo viên";
    avatarNode.onerror = function handleTeacherAvatarError() {
      avatarNode.onerror = null;
      avatarNode.src = getProfileAvatar(profile);
    };
  }

  if (totalStudentsNode) {
    totalStudentsNode.textContent = formatStatValue(
      dashboardData?.totalStudents,
    );
  }

  if (totalClassesNode) {
    totalClassesNode.textContent = formatStatValue(dashboardData?.totalClasses);
  }

  if (totalAssignmentsNode) {
    totalAssignmentsNode.textContent = formatStatValue(
      dashboardData?.totalAssignments,
    );
  }

  if (completionRateNode) {
    completionRateNode.textContent = `${formatStatValue(dashboardData?.completionRate)}%`;
  }

  if (activityListNode) {
    const activities = Array.isArray(dashboardData?.activities)
      ? dashboardData.activities
      : [];

    if (activities.length === 0) {
      activityListNode.innerHTML = `
        <article class="teacher-activity-item">
          <img src="assets/userAvatar/boy.png" alt="" />
          <div>
            <p>Chưa có hoạt động gần đây.</p>
            <span>--</span>
          </div>
        </article>
      `;
    } else {
      activityListNode.innerHTML = activities
        .map((activity) => {
          const avatarSrc = activity.avatar || "assets/userAvatar/boy.png";
          return `
            <article class="teacher-activity-item">
              <img src="${escapeHtml(avatarSrc)}" alt="" onerror="this.onerror=null;this.src='assets/userAvatar/boy.png';" />
              <div>
                <p>${escapeHtml(`${activity.icon ? `${activity.icon} ` : ""}${activity.text}`)}</p>
                <span>${escapeHtml(formatRelativeTime(activity.time))}</span>
              </div>
            </article>
          `;
        })
        .join("");
    }
  }

  if (attentionListNode) {
    const attentionItems = Array.isArray(dashboardData?.attentionItems)
      ? dashboardData.attentionItems
      : [];

    if (attentionItems.length === 0) {
      attentionListNode.innerHTML = `
        <article class="attention-card">
          <div class="attention-card-head">
            <h3>Chưa có bài tập</h3>
            <p>--</p>
          </div>

          <div class="attention-progress">
            <div class="attention-progress-fill" style="width: 0%"></div>
          </div>

          <span>Không có dữ liệu bài tập</span>
        </article>
      `;
    } else {
      attentionListNode.innerHTML = attentionItems
        .map((item, index) => {
          const isCompact = Boolean(item.compact) || index >= 2;
          return `
            <article class="attention-card ${isCompact ? "attention-card-compact" : ""}">
              <div class="attention-card-head">
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.completionLabel)}</p>
              </div>

              <div class="attention-progress">
                <div class="attention-progress-fill" style="width: ${escapeHtml(item.progressWidth)}"></div>
              </div>

              <span>${escapeHtml(`${formatStatValue(item.submittedStudents)} học sinh hoàn thành`)}</span>
            </article>
          `;
        })
        .join("");
    }
  }
}

function getFirestoreDb() {
  if (
    !window.firebase?.apps?.length ||
    typeof window.firebase.app !== "function" ||
    typeof window.firebase.firestore !== "function"
  ) {
    return null;
  }

  try {
    return window.firebase.app().firestore();
  } catch (error) {
    console.warn("Không thể khởi tạo Firestore cho thống kê giáo viên:", error);
    return null;
  }
}

function getTeacherStatsRoot() {
  return document.querySelector("#stats .teacher-stats-v2");
}

function getTeacherStatsClassSelect() {
  return document.getElementById("teacher-stats-class-select");
}

function getTeacherStatsRangeSelect() {
  return document.getElementById("teacher-stats-range-select");
}

function getTeacherStatsRefreshButton() {
  return document.getElementById("teacher-stats-refresh-btn");
}

function getTeacherStatsLineChartNode() {
  return document.getElementById("teacher-stats-line-chart");
}

function getTeacherStatsTopStudentsNode() {
  return document.getElementById("teacher-stats-top-students");
}

function getTeacherStatsSupportStudentsNode() {
  return document.getElementById("teacher-stats-support-students");
}

function getTeacherStatsAssignmentTableNode() {
  return document.getElementById("teacher-stats-assignment-table");
}

function getTeacherStatsAssignmentToggleButton() {
  return document.querySelector("[data-teacher-stats-assignment-toggle]");
}

function getTeacherStatsAiNode() {
  return document.getElementById("teacher-stats-ai-analysis");
}

function getTeacherStatsSummaryNode() {
  return document.getElementById("teacher-stats-summary");
}

function getTeacherStatsClassStudents(classroom) {
  const rawStudents = Array.isArray(classroom?.students)
    ? classroom.students
    : Array.isArray(classroom?.studentIds)
      ? classroom.studentIds
      : Array.isArray(classroom?.members)
        ? classroom.members
        : [];

  return uniqueClassroomValues(
    rawStudents.map((student) =>
      String(
        student && typeof student === "object"
          ? student.id ||
              student.studentId ||
              student.userId ||
              student.uid ||
              ""
          : student || "",
      ).trim(),
    ),
  );
}

function getTeacherStatsClassName(classroom) {
  return String(classroom?.name || classroom?.className || "Lớp học").trim();
}

function getTeacherStatsScore10(submission) {
  const directScore = Number(submission?.score);

  if (Number.isFinite(directScore)) {
    return Math.max(0, Math.min(10, directScore));
  }

  const correctCount = Number(
    submission?.correctCount || submission?.correctAnswers,
  );
  const totalQuestions = Number(
    submission?.totalQuestions || submission?.questionCount,
  );

  if (
    Number.isFinite(correctCount) &&
    Number.isFinite(totalQuestions) &&
    totalQuestions > 0
  ) {
    return Math.max(
      0,
      Math.min(10, Number(((correctCount / totalQuestions) * 10).toFixed(1))),
    );
  }

  return null;
}

function getTeacherStatsDateValue(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getTeacherStatsDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function isTeacherStatsDateInRange(date, rangeKey) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return false;
  }

  if (rangeKey === "all") {
    return true;
  }

  const daysByRange = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
  };
  const days = daysByRange[rangeKey] || 7;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return date >= start && date <= end;
}

function getTeacherStatsRangeLabel(rangeKey) {
  if (rangeKey === "30d") {
    return "30 ngày gần nhất";
  }

  if (rangeKey === "90d") {
    return "90 ngày gần nhất";
  }

  if (rangeKey === "all") {
    return "Tất cả";
  }

  return "7 ngày gần nhất";
}

function getTeacherStatsAverage(values) {
  const validValues = (Array.isArray(values) ? values : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (validValues.length === 0) {
    return null;
  }

  return Number(
    (
      validValues.reduce((sum, value) => sum + value, 0) / validValues.length
    ).toFixed(1),
  );
}

async function loadTeacherStatsStudentTopics(studentIds = []) {
  const firestore = getFirestoreDb();

  if (!firestore) {
    return new Map();
  }

  const entries = await Promise.all(
    uniqueClassroomValues(studentIds).map(async (studentId) => {
      try {
        const snapshot = await firestore
          .collection("user_progress")
          .doc(studentId)
          .collection("topics")
          .get();

        return [
          studentId,
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() || {}),
          })),
        ];
      } catch (error) {
        console.warn("Không thể tải topic progress:", error);
        return [studentId, []];
      }
    }),
  );

  return new Map(entries);
}

async function loadTeacherStatsTopicCatalog(
  topicProgressByStudentId = new Map(),
) {
  const apiRequest = window.EduKidsApi?.requestWithAuth || apiRequestWithAuth;
  if (typeof apiRequest !== "function") {
    return [];
  }

  const combos = new Map();

  Array.from(topicProgressByStudentId.values()).forEach((topics) => {
    (Array.isArray(topics) ? topics : []).forEach((topic) => {
      const grade = String(topic?.grade || "").trim();
      const subject = String(topic?.subject || "").trim();
      const topicId = String(topic?.topicId || "").trim();

      if (!grade || !subject || !topicId) {
        return;
      }

      const key = `${grade}:${subject}`;
      if (!combos.has(key)) {
        combos.set(key, { grade, subject });
      }
    });
  });

  if (combos.size === 0) {
    return [];
  }

  const results = await Promise.all(
    Array.from(combos.values()).map(async ({ grade, subject }) => {
      try {
        const response = await apiRequest(
          `/api/topics?grade=${encodeURIComponent(grade)}&subject=${encodeURIComponent(subject)}`,
          { method: "GET" },
        );
        return Array.isArray(response?.data) ? response.data : [];
      } catch (error) {
        console.warn(
          "Không thể tải danh mục chủ đề cho thống kê giáo viên:",
          error,
        );
        return [];
      }
    }),
  );

  return results.flat();
}

function getTeacherStatsRankedRows(rows, limit = 5) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const paddedRows = [];

  for (let index = 0; index < limit; index += 1) {
    const row = safeRows[index] || null;

    if (!row) {
      paddedRows.push(null);
      continue;
    }

    paddedRows.push(row);
  }

  return paddedRows;
}

function buildTeacherStatsViewModel(rawData, rangeKey = "7d") {
  if (!rawData || typeof rawData !== "object") {
    return null;
  }

  const classroom = rawData.classroom || null;
  const studentRows = Array.isArray(rawData.studentRows)
    ? rawData.studentRows
    : [];
  const studentIds = studentRows.map((student) => student.id).filter(Boolean);
  const assignments = Array.isArray(rawData.assignments)
    ? rawData.assignments
    : [];
  const submissionsByAssignmentId =
    rawData.submissionsByAssignmentId instanceof Map
      ? rawData.submissionsByAssignmentId
      : new Map();
  const topicProgressByStudentId =
    rawData.topicProgressByStudentId instanceof Map
      ? rawData.topicProgressByStudentId
      : new Map();
  const topicCatalog = Array.isArray(rawData.topicCatalog)
    ? rawData.topicCatalog
    : [];
  const allSubmissions = assignments.flatMap((assignment) =>
    Array.isArray(
      submissionsByAssignmentId.get(String(assignment.id || "").trim()),
    )
      ? submissionsByAssignmentId.get(String(assignment.id || "").trim())
      : [],
  );

  const filteredSubmissions = allSubmissions.filter((submission) => {
    const date =
      getTeacherStatsDateValue(submission?.submittedAt) ||
      getTeacherStatsDateValue(submission?.gradedAt) ||
      getTeacherStatsDateValue(submission?.createdAt);

    return isTeacherStatsDateInRange(date, rangeKey);
  });

  const timelineMap = new Map();
  filteredSubmissions.forEach((submission) => {
    const date =
      getTeacherStatsDateValue(submission?.submittedAt) ||
      getTeacherStatsDateValue(submission?.gradedAt) ||
      getTeacherStatsDateValue(submission?.createdAt);
    const score = getTeacherStatsScore10(submission);

    if (!date || !Number.isFinite(score)) {
      return;
    }

    const dateKey = getTeacherStatsDateKey(date);
    const bucket = timelineMap.get(dateKey) || [];
    bucket.push(score);
    timelineMap.set(dateKey, bucket);
  });

  const timelineEntries = Array.from(timelineMap.entries())
    .map(([dateKey, scores]) => {
      const date = new Date(`${dateKey}T00:00:00`);
      return {
        date,
        label: new Intl.DateTimeFormat("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        }).format(date),
        score: getTeacherStatsAverage(scores),
      };
    })
    .filter((entry) => Number.isFinite(Number(entry.score)))
    .sort((left, right) => left.date - right.date);

  const studentScoreMap = new Map();
  filteredSubmissions.forEach((submission) => {
    const studentId = String(submission?.studentId || "").trim();
    const score = getTeacherStatsScore10(submission);

    if (!studentId || !Number.isFinite(score)) {
      return;
    }

    const bucket = studentScoreMap.get(studentId) || [];
    bucket.push(score);
    studentScoreMap.set(studentId, bucket);
  });

  const studentAverages = studentRows
    .map((student) => {
      const scores = studentScoreMap.get(student.id) || [];
      const averageScore = getTeacherStatsAverage(scores);

      return {
        ...student,
        averageScore,
        attempts: scores.length,
      };
    })
    .filter((student) => Number.isFinite(Number(student.averageScore)));

  const topStudents = [...studentAverages]
    .sort(
      (left, right) =>
        (Number(right.averageScore) || 0) - (Number(left.averageScore) || 0),
    )
    .slice(0, 5);

  const topicBuckets = new Map();
  studentIds.forEach((studentId) => {
    const topics = topicProgressByStudentId.get(studentId) || [];

    topics
      .filter((topic) => {
        const date =
          getTeacherStatsDateValue(topic?.updatedAt) ||
          getTeacherStatsDateValue(topic?.accuracyUpdatedAt) ||
          getTeacherStatsDateValue(topic?.createdAt);
        return isTeacherStatsDateInRange(date, rangeKey);
      })
      .forEach((topic) => {
        const topicKey = String(
          topic.topicName || topic.title || topic.topicId || "",
        ).trim();
        const accuracy = Number(topic.percentage);

        if (!topicKey || !Number.isFinite(accuracy)) {
          return;
        }

        const bucket = topicBuckets.get(topicKey) || [];
        bucket.push(Math.max(0, Math.min(100, accuracy)));
        topicBuckets.set(topicKey, bucket);
      });
  });

  const weakestTopic =
    Array.from(topicBuckets.entries())
      .map(([topicName, values]) => ({
        topicName,
        percentage: getTeacherStatsAverage(values) ?? 0,
      }))
      .filter((item) => Number.isFinite(Number(item.percentage)))
      .sort(
        (left, right) => (left.percentage || 0) - (right.percentage || 0),
      )[0] || null;

  const assignmentRows = assignments
    .map((assignment) => {
      const submissions = (
        submissionsByAssignmentId.get(String(assignment.id || "").trim()) || []
      ).filter((submission) => {
        const date =
          getTeacherStatsDateValue(submission?.submittedAt) ||
          getTeacherStatsDateValue(submission?.gradedAt) ||
          getTeacherStatsDateValue(submission?.createdAt);
        return isTeacherStatsDateInRange(date, rangeKey);
      });

      const completedStudentIds = uniqueClassroomValues(
        submissions.map((submission) =>
          String(submission?.studentId || "").trim(),
        ),
      );
      const totalStudents = studentRows.length;
      const completedCount = completedStudentIds.length;
      const pendingCount = Math.max(0, totalStudents - completedCount);
      const completionRate =
        totalStudents > 0
          ? Math.round((completedCount / totalStudents) * 100)
          : 0;

      return {
        id: assignment.id,
        title: String(assignment.title || "Bài tập").trim(),
        completedCount,
        pendingCount,
        completionRate,
        createdAt: assignment.createdAt || "",
      };
    })
    .sort(
      (left, right) =>
        Date.parse(right.createdAt || "") - Date.parse(left.createdAt || ""),
    );

  const overallAverageScore = getTeacherStatsAverage(
    filteredSubmissions
      .map((submission) => getTeacherStatsScore10(submission))
      .filter((value) => Number.isFinite(value)),
  );
  const totalCompletedAssignments = assignmentRows.reduce(
    (sum, row) => sum + row.completedCount,
    0,
  );
  const totalAssignments = assignmentRows.length;
  const assignmentCompletionRate = assignmentRows.length
    ? Math.round(
        assignmentRows.reduce((sum, row) => sum + row.completionRate, 0) /
          assignmentRows.length,
      )
    : 0;
  const averageStudyMinutes = getTeacherStatsAverage(
    studentRows.map((student) =>
      Number(student.profile?.stats?.studyMinutes || 0),
    ),
  );
  const topStudentIds = new Set(topStudents.map((student) => student.id));
  const supportStudentsFiltered = studentAverages.filter(
    (student) => !topStudentIds.has(student.id),
  );
  const supportStudents = [...supportStudentsFiltered]
    .sort(
      (left, right) =>
        (Number(left.averageScore) || 0) - (Number(right.averageScore) || 0),
    )
    .slice(0, 5);
  const supportStudentCount = supportStudentsFiltered.filter(
    (student) => Number(student.averageScore) < 5,
  ).length;
  const className = getTeacherStatsClassName(classroom);

  return {
    className,
    rangeLabel: getTeacherStatsRangeLabel(rangeKey),
    totalStudents: studentRows.length,
    totalAssignments,
    overallAverageScore,
    assignmentCompletionRate,
    averageStudyMinutes,
    supportStudentCount,
    weakestTopic,
    timelineEntries,
    topStudents,
    supportStudents,
    assignmentRows,
    studentAverages,
    classStudents: studentRows,
    topicCatalog,
  };
}

function renderTeacherStatsSkeleton() {
  const lineChartNode = getTeacherStatsLineChartNode();
  const topStudentsNode = getTeacherStatsTopStudentsNode();
  const supportStudentsNode = getTeacherStatsSupportStudentsNode();
  const assignmentTableNode = getTeacherStatsAssignmentTableNode();
  const aiNode = getTeacherStatsAiNode();
  const summaryNode = getTeacherStatsSummaryNode();

  const skeleton = `<div class="teacher-stats-skeleton" style="height: 100%; min-height: 240px;"></div>`;

  if (lineChartNode) lineChartNode.innerHTML = skeleton;
  if (topStudentsNode) topStudentsNode.innerHTML = skeleton;
  if (supportStudentsNode) supportStudentsNode.innerHTML = skeleton;
  if (assignmentTableNode) assignmentTableNode.innerHTML = skeleton;
  if (aiNode) aiNode.innerHTML = skeleton;
  if (summaryNode)
    summaryNode.innerHTML = `<div class="teacher-stats-skeleton" style="min-height: 116px; width: 100%;"></div>`;
}

function renderTeacherStatsEmpty(message = "Chưa có dữ liệu thống kê.") {
  const empty = `<div class="teacher-stats-chart-empty">${escapeHtml(message)}</div>`;
  const lineChartNode = getTeacherStatsLineChartNode();
  const topStudentsNode = getTeacherStatsTopStudentsNode();
  const supportStudentsNode = getTeacherStatsSupportStudentsNode();
  const assignmentTableNode = getTeacherStatsAssignmentTableNode();
  const aiNode = getTeacherStatsAiNode();
  const summaryNode = getTeacherStatsSummaryNode();
  const assignmentToggleButton = getTeacherStatsAssignmentToggleButton();

  if (lineChartNode) lineChartNode.innerHTML = empty;
  if (topStudentsNode) topStudentsNode.innerHTML = empty;
  if (supportStudentsNode) supportStudentsNode.innerHTML = empty;
  if (assignmentTableNode) assignmentTableNode.innerHTML = empty;
  if (aiNode) {
    aiNode.innerHTML = `
      <div class="teacher-stats-chart-empty">
        <div>
          <strong>Chưa có dữ liệu</strong>
          <p>${escapeHtml(message)}</p>
        </div>
      </div>
    `;
  }
  if (summaryNode) summaryNode.innerHTML = empty;
  if (assignmentToggleButton) {
    assignmentToggleButton.hidden = true;
  }
}

function buildTeacherStatsLineChartSvg(entries) {
  const safeEntries = Array.isArray(entries) ? entries : [];

  if (safeEntries.length === 0) {
    return "";
  }

  const width = 960;
  const height = 340;
  const leftPad = 60;
  const rightPad = 24;
  const topPad = 28;
  const bottomPad = 66;
  const chartWidth = width - leftPad - rightPad;
  const chartHeight = height - topPad - bottomPad;
  const points = safeEntries.map((entry, index) => {
    const ratio =
      safeEntries.length === 1 ? 0.5 : index / (safeEntries.length - 1);
    const x = leftPad + ratio * chartWidth;
    const score = Number(entry.score) || 0;
    const y = topPad + (1 - score / 10) * chartHeight;
    return { ...entry, x, y, score };
  });

  const lines = [];
  for (let tick = 0; tick <= 5; tick += 1) {
    const value = tick * 2;
    const y = topPad + (1 - value / 10) * chartHeight;
    lines.push(`
      <line x1="${leftPad}" x2="${width - rightPad}" y1="${y}" y2="${y}" class="teacher-stats-chart-grid" />
      <text x="${leftPad - 8}" y="${y + 4}" text-anchor="end" class="teacher-stats-chart-axis-label">${value}</text>
    `);
  }

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = `
    M ${points[0].x} ${height - bottomPad}
    ${points.map((point) => `L ${point.x} ${point.y}`).join(" ")}
    L ${points[points.length - 1].x} ${height - bottomPad}
    Z
  `;

  const circles = points
    .map(
      (point) => `
        <circle cx="${point.x}" cy="${point.y}" r="6.5" class="teacher-stats-chart-point" />
        <text x="${point.x}" y="${point.y - 16}" text-anchor="middle" class="teacher-stats-chart-value">${point.score.toFixed(1)}</text>
        <text x="${point.x}" y="${height - 20}" text-anchor="middle" class="teacher-stats-chart-axis-label">${escapeHtml(point.label)}</text>
      `,
    )
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="teacher-stats-chart-svg" role="img" aria-label="Biểu đồ điểm trung bình theo thời gian">
      <defs>
        <linearGradient id="teacher-stats-line-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="rgba(37, 99, 235, 0.22)" />
          <stop offset="100%" stop-color="rgba(37, 99, 235, 0.02)" />
        </linearGradient>
      </defs>
      ${lines.join("")}
      <path d="${areaPath}" fill="url(#teacher-stats-line-gradient)" />
      <path d="${path}" fill="none" class="teacher-stats-chart-line" />
      ${circles}
    </svg>
    <div class="teacher-stats-chart-legend">
      <span><i></i> Điểm trung bình</span>
    </div>
  `;
}

function renderTeacherStatsTableRows(rows, kind = "top") {
  const safeRows = Array.isArray(rows) ? rows : [];
  const rowsWithPlaceholders = getTeacherStatsRankedRows(safeRows, 5);

  return `
    <div class="teacher-stats-table-head">
      <span>#</span>
      <span>Học sinh</span>
      <span>Điểm trung bình</span>
    </div>
    ${rowsWithPlaceholders
      .map((row, index) => {
        if (!row) {
          return `
            <div class="teacher-stats-table-row">
              <span class="teacher-stats-table-rank">${index + 1}</span>
              <span class="teacher-stats-table-name">--</span>
              <span class="teacher-stats-table-score">--</span>
            </div>
          `;
        }

        const medal =
          kind === "top" && index < 3 ? ["🥇", "🥈", "🥉"][index] : "";
        return `
          <div class="teacher-stats-table-row">
            <span class="teacher-stats-table-rank ${medal ? "is-medal" : ""}">${medal || index + 1}</span>
            <span class="teacher-stats-table-name">${escapeHtml(row.fullName || row.name || "Học sinh")}</span>
            <span class="teacher-stats-table-score">${escapeHtml(formatStatValue(row.averageScore))}</span>
          </div>
        `;
      })
      .join("")}
  `;
}

function renderTeacherStatsAssignments(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const visibleRows = teacherStatsState.assignmentExpanded
    ? safeRows
    : safeRows.slice(0, 5);
  const showToggle = safeRows.length > 5;

  if (safeRows.length === 0) {
    return `
      <div class="teacher-stats-chart-empty">
        <div>
          <strong>Chưa có bài tập</strong>
          <p>Không có bài tập phù hợp với lớp đang chọn.</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="teacher-stats-table-head teacher-stats-table-head-assignment">
      <span>Bài tập</span>
      <span>Đã làm</span>
      <span>Chưa làm</span>
      <span>Tỉ lệ hoàn thành</span>
    </div>
    ${visibleRows
      .map(
        (row) => `
          <div class="teacher-stats-table-row teacher-stats-table-row-assignment">
            <span class="teacher-stats-table-name">${escapeHtml(row.title)}</span>
            <span>${escapeHtml(String(row.completedCount))}</span>
            <span>${escapeHtml(String(row.pendingCount))}</span>
            <span class="teacher-stats-progress-label is-centered">${escapeHtml(String(row.completionRate))}%</span>
          </div>
        `,
      )
      .join("")}
    ${
      showToggle
        ? `
      <button class="teacher-stats-link-button is-purple" type="button" data-teacher-stats-assignment-toggle>
        ${teacherStatsState.assignmentExpanded ? "Thu gọn" : "Xem thêm"}
      </button>
    `
        : ""
    }
  `;
}

function renderTeacherStatsAi(viewModel) {
  if (!viewModel) {
    return `
      <div class="teacher-stats-chart-empty">
        <div>
          <strong>Chưa có dữ liệu</strong>
          <p>Hãy chọn lớp khác hoặc làm mới dữ liệu.</p>
        </div>
      </div>
    `;
  }

  const averageScore = Number.isFinite(Number(viewModel.overallAverageScore))
    ? Number(viewModel.overallAverageScore).toFixed(1)
    : "--";
  const weakestTopicName = resolveTeacherStatsTopicLabel(
    viewModel.weakestTopic,
    viewModel.topicCatalog,
  );
  const weakestTopicAccuracy = Number.isFinite(
    Number(viewModel.weakestTopic?.percentage),
  )
    ? `${Number(viewModel.weakestTopic.percentage).toFixed(0)}%`
    : "--";
  const completionRate = `${viewModel.assignmentCompletionRate || 0}%`;
  const supportStudentCount = viewModel.supportStudentCount || 0;
  const recommendationTopic =
    weakestTopicName !== "--" ? weakestTopicName : "chủ đề cần cải thiện";
  const weakerNote = viewModel.weakestTopic
    ? `Chủ đề cần cải thiện là ${weakestTopicName} (${weakestTopicAccuracy}).`
    : "Chưa có đủ dữ liệu chủ đề để phân tích.";

  return `
    <div class="teacher-stats-ai-layout">
      <div>
        <p class="teacher-stats-ai-lead">
          Trong lớp ${escapeHtml(viewModel.className)}, điểm trung bình đang ở mức <strong>${escapeHtml(averageScore)}</strong>.
        </p>

        <ul class="teacher-stats-ai-list">
          <li><span class="teacher-stats-ai-dot is-red">×</span><span>${escapeHtml(weakerNote)}</span></li>
          <li><span class="teacher-stats-ai-dot is-orange">!</span><span>Có <strong>${escapeHtml(String(supportStudentCount))}</strong> học sinh cần được hỗ trợ thêm.</span></li>
          <li><span class="teacher-stats-ai-dot is-green">✓</span><span>Tỉ lệ hoàn thành bài tập trung bình là <strong>${escapeHtml(completionRate)}</strong>.</span></li>
        </ul>

        <div class="teacher-stats-ai-suggestion">
          <strong>Đề xuất:</strong> Nên giao thêm bài luyện tập về ${escapeHtml(recommendationTopic)} và theo dõi nhóm học sinh có điểm trung bình thấp.
        </div>
      </div>

      <div class="teacher-stats-ai-illustration" aria-hidden="true">
        <svg viewBox="0 0 220 220" role="presentation">
          <defs>
            <linearGradient id="stats-robot-bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#eef4ff"/>
              <stop offset="100%" stop-color="#ffffff"/>
            </linearGradient>
          </defs>
          <circle cx="110" cy="110" r="84" fill="url(#stats-robot-bg)" />
          <ellipse cx="110" cy="158" rx="36" ry="28" fill="#dce8ff" />
          <rect x="62" y="66" width="96" height="92" rx="32" fill="#ffffff" stroke="#d8e4ff" stroke-width="4" />
          <rect x="74" y="78" width="72" height="56" rx="20" fill="#2962ff" />
          <circle cx="96" cy="100" r="9" fill="#0f172a" />
          <circle cx="124" cy="100" r="9" fill="#0f172a" />
          <path d="M92 118c6 8 30 8 36 0" fill="none" stroke="#0f172a" stroke-width="6" stroke-linecap="round" />
          <circle cx="62" cy="74" r="10" fill="#7ea7ff" />
          <circle cx="158" cy="74" r="10" fill="#7ea7ff" />
          <circle cx="44" cy="160" r="8" fill="#7ea7ff" />
          <circle cx="176" cy="160" r="8" fill="#7ea7ff" />
          <circle cx="56" cy="144" r="7" fill="#8fb2ff" />
          <circle cx="164" cy="144" r="7" fill="#8fb2ff" />
        </svg>
      </div>
  </div>
`;
}

function resolveTeacherStatsTopicLabel(topic, topicCatalog = []) {
  if (!topic || typeof topic !== "object") {
    return "--";
  }

  const explicitLabel = String(
    topic.topicName || topic.title || topic.name || topic.displayName || "",
  ).trim();

  if (explicitLabel) {
    return explicitLabel;
  }

  const topicId = String(topic.topicId || topic.id || "").trim();
  if (!topicId) {
    return "--";
  }

  const catalogItem = (Array.isArray(topicCatalog) ? topicCatalog : []).find(
    (item) => String(item?.topicId || "").trim() === topicId,
  );

  const catalogLabel = String(
    catalogItem?.title ||
      catalogItem?.name ||
      catalogItem?.topicName ||
      catalogItem?.displayName ||
      "",
  ).trim();

  return catalogLabel || topicId;
}

function renderTeacherStatsSummary(viewModel) {
  if (!viewModel) {
    return `
      <div class="teacher-stats-chart-empty">
        <div>
          <strong>Chưa có dữ liệu</strong>
          <p>Không thể tạo phần tổng quan vì chưa có dữ liệu lớp.</p>
        </div>
      </div>
    `;
  }

  const items = [
    {
      label: "Tổng số học sinh",
      value: formatStatValue(viewModel.totalStudents),
      iconClass: "is-blue",
      icon: "👥",
    },
    {
      label: "Tỉ lệ hoàn thành TB",
      value: `${formatStatValue(viewModel.assignmentCompletionRate)}%`,
      iconClass: "is-green",
      icon: "✓",
    },
    {
      label: "Điểm trung bình lớp",
      value: formatStatValue(viewModel.overallAverageScore),
      iconClass: "is-yellow",
      icon: "★",
    },
    {
      label: "Bài tập đã giao",
      value: formatStatValue(viewModel.totalAssignments),
      iconClass: "is-indigo",
      icon: "▮▮",
    },
    {
      label: "Thời gian học TB/ngày",
      value: `${formatStatValue(viewModel.averageStudyMinutes)} phút`,
      iconClass: "is-pink",
      icon: "◔",
    },
  ];

  return items
    .map(
      (item) => `
        <article class="teacher-stats-summary-item">
          <span class="teacher-stats-summary-icon ${item.iconClass}" aria-hidden="true">${item.icon}</span>
          <div class="teacher-stats-summary-copy">
            <span>${escapeHtml(item.label)}</span>
            <strong${item.label === "Thời gian học TB/ngày" ? ' class="is-small"' : ""}>${escapeHtml(item.value)}</strong>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderTeacherStatsPageState(viewModel) {
  const root = getTeacherStatsRoot();
  if (!root) {
    return;
  }

  const classSelect = getTeacherStatsClassSelect();
  const rangeSelect = getTeacherStatsRangeSelect();
  const lineChartNode = getTeacherStatsLineChartNode();
  const topStudentsNode = getTeacherStatsTopStudentsNode();
  const supportStudentsNode = getTeacherStatsSupportStudentsNode();
  const assignmentTableNode = getTeacherStatsAssignmentTableNode();
  const aiNode = getTeacherStatsAiNode();
  const summaryNode = getTeacherStatsSummaryNode();

  if (classSelect && Array.isArray(teacherStatsState.data?.classes)) {
    const classes = teacherStatsState.data.classes;
    classSelect.innerHTML = classes
      .map(
        (classroom) =>
          `<option value="${escapeHtml(classroom.id)}">${escapeHtml(getTeacherStatsClassName(classroom))}</option>`,
      )
      .join("");
    if (teacherStatsState.selectedClassId) {
      classSelect.value = teacherStatsState.selectedClassId;
    }
  }

  if (rangeSelect) {
    rangeSelect.value = teacherStatsState.selectedRange;
  }

  if (!viewModel) {
    renderTeacherStatsEmpty("Chưa có dữ liệu thống kê cho lớp này.");
    return;
  }

  if (lineChartNode) {
    lineChartNode.innerHTML = viewModel.timelineEntries.length
      ? buildTeacherStatsLineChartSvg(viewModel.timelineEntries)
      : `<div class="teacher-stats-chart-empty"><div><strong>Không có dữ liệu</strong><p>Chưa có bài làm trong khoảng thời gian này.</p></div></div>`;
  }

  if (topStudentsNode) {
    topStudentsNode.innerHTML = renderTeacherStatsTableRows(
      viewModel.topStudents,
      "top",
    );
  }

  if (supportStudentsNode) {
    supportStudentsNode.innerHTML = renderTeacherStatsTableRows(
      viewModel.supportStudents,
      "support",
    );
  }

  if (assignmentTableNode) {
    assignmentTableNode.innerHTML = renderTeacherStatsAssignments(
      viewModel.assignmentRows,
    );
  }

  if (aiNode) {
    aiNode.innerHTML = renderTeacherStatsAi(viewModel);
  }

  if (summaryNode) {
    summaryNode.innerHTML = renderTeacherStatsSummary(viewModel);
  }

  const assignmentToggleButton = getTeacherStatsAssignmentToggleButton();
  if (assignmentToggleButton) {
    assignmentToggleButton.hidden = !(
      Array.isArray(viewModel.assignmentRows) &&
      viewModel.assignmentRows.length > 5
    );
  }
}

function bindTeacherStatsControls() {
  const root = getTeacherStatsRoot();

  if (!root || root.dataset.bound === "true") {
    return;
  }

  root.dataset.bound = "true";

  const classSelect = getTeacherStatsClassSelect();
  const rangeSelect = getTeacherStatsRangeSelect();
  const refreshButton = getTeacherStatsRefreshButton();

  if (classSelect) {
    classSelect.addEventListener("change", (event) => {
      const value = String(event.target.value || "").trim();
      teacherStatsState.selectedClassId = value;
      void loadTeacherStatsData({ selectedClassId: value, forceRefresh: true });
    });
  }

  if (rangeSelect) {
    rangeSelect.addEventListener("change", (event) => {
      teacherStatsState.selectedRange =
        String(event.target.value || "7d").trim() || "7d";
      teacherStatsState.assignmentExpanded = false;
      const viewModel = buildTeacherStatsViewModel(
        teacherStatsState.data,
        teacherStatsState.selectedRange,
      );
      renderTeacherStatsPageState(viewModel);
    });
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      teacherStatsState.assignmentExpanded = false;
      void loadTeacherStatsData({
        selectedClassId: teacherStatsState.selectedClassId,
        forceRefresh: true,
      });
    });
  }

  root.addEventListener("click", (event) => {
    const button = event.target.closest(
      "[data-teacher-stats-assignment-toggle]",
    );

    if (!button) {
      return;
    }

    teacherStatsState.assignmentExpanded =
      !teacherStatsState.assignmentExpanded;
    const viewModel = buildTeacherStatsViewModel(
      teacherStatsState.data,
      teacherStatsState.selectedRange,
    );
    renderTeacherStatsPageState(viewModel);
  });
}

async function loadTeacherStatsData({
  selectedClassId = "",
  forceRefresh = false,
} = {}) {
  const teacher = getCurrentAuthUser();
  if (normalizeRole(teacher?.role) !== "teacher") {
    return null;
  }

  const teacherId = String(
    teacher?.uid || teacher?.userId || teacher?.id || "",
  ).trim();

  if (!teacherId) {
    return null;
  }

  if (
    teacherStatsState.loading &&
    teacherStatsState.teacherId === teacherId &&
    teacherStatsState.pendingPromise
  ) {
    return teacherStatsState.pendingPromise;
  }

  if (
    teacherStatsState.loaded &&
    teacherStatsState.teacherId === teacherId &&
    teacherStatsState.data &&
    !forceRefresh
  ) {
    if (selectedClassId) {
      teacherStatsState.selectedClassId = selectedClassId;
    }

    return teacherStatsState.data;
  }

  teacherStatsState.loading = true;
  teacherStatsState.teacherId = teacherId;
  const requestToken = teacherStatsState.renderToken + 1;
  teacherStatsState.renderToken = requestToken;

  const requestPromise = (async () => {
    try {
      const [classesResponse, assignmentsResponse] = await Promise.all([
        apiRequestWithAuth("/api/classes/my", { method: "GET" }).catch(() => ({
          data: [],
        })),
        getAssignmentService()?.getTeacherAssignments
          ? getAssignmentService()
              .getTeacherAssignments(teacherId)
              .catch(() => [])
          : Promise.resolve([]),
      ]);

      const classes = sortClassroomRecords(
        Array.isArray(classesResponse?.data)
          ? classesResponse.data
              .map(normalizeClassroomRecord)
              .filter(
                (classroom) =>
                  classroom &&
                  (classroom.teacherId === teacherId || !classroom.teacherId),
              )
          : [],
      );

      const initialClassId =
        selectedClassId ||
        teacherStatsState.selectedClassId ||
        classes[0]?.id ||
        "";
      const classroom =
        classes.find((item) => item.id === initialClassId) ||
        classes[0] ||
        null;

      if (!classroom) {
        const emptyData = {
          classes,
          classroom: null,
          studentRows: [],
          assignments: [],
          submissionsByAssignmentId: new Map(),
          topicProgressByStudentId: new Map(),
        };
        teacherStatsState.data = emptyData;
        teacherStatsState.loaded = true;
        teacherStatsState.selectedClassId = "";
        return emptyData;
      }

      const studentCards = await getClassroomStudentCards(classroom);
      const studentIds = uniqueClassroomValues(
        studentCards.map((student) => student.id),
      );
      const profileService = window.EduKidsProfileService;
      const studentProfiles = await Promise.all(
        studentIds.map(async (studentId) => {
          if (!profileService?.fetchProfileById) {
            return [studentId, null];
          }

          const profile = await profileService
            .fetchProfileById(studentId)
            .catch(() => null);
          return [studentId, profile];
        }),
      );

      const studentProfileById = new Map(studentProfiles);
      const studentRows = studentCards.map((card) => {
        const profile = studentProfileById.get(card.id) || null;
        return {
          id: card.id,
          fullName:
            profile?.fullName ||
            profile?.name ||
            card.name ||
            profile?.username ||
            "Học sinh",
          avatar: profile?.avatar || card.avatar || "",
          profile,
        };
      });

      const classAssignments = (
        Array.isArray(assignmentsResponse) ? assignmentsResponse : []
      )
        .filter(
          (assignment) =>
            String(assignment?.classId || "").trim() === classroom.id,
        )
        .map((assignment) => ({
          ...assignment,
          id: String(assignment.id || "").trim(),
        }))
        .filter((assignment) => Boolean(assignment.id));

      const submissionsEntries = await Promise.all(
        classAssignments.map(async (assignment) => {
          if (!getAssignmentService()?.fetchAssignmentSubmissions) {
            return [assignment.id, []];
          }

          const submissions = await getAssignmentService()
            .fetchAssignmentSubmissions(assignment.id)
            .catch(() => []);
          return [assignment.id, Array.isArray(submissions) ? submissions : []];
        }),
      );

      const topicProgressByStudentId =
        await loadTeacherStatsStudentTopics(studentIds);
      const topicCatalog = await loadTeacherStatsTopicCatalog(
        topicProgressByStudentId,
      );

      const nextData = {
        classes,
        classroom,
        studentRows,
        assignments: classAssignments,
        submissionsByAssignmentId: new Map(submissionsEntries),
        topicProgressByStudentId,
        topicCatalog,
      };

      if (teacherStatsState.renderToken !== requestToken) {
        return nextData;
      }

      teacherStatsState.data = nextData;
      teacherStatsState.loaded = true;
      teacherStatsState.selectedClassId = classroom.id;
      return nextData;
    } catch (error) {
      console.warn("Không thể tải thống kê giáo viên:", error);
      return null;
    } finally {
      teacherStatsState.loading = false;
      teacherStatsState.pendingPromise = null;
    }
  })();

  teacherStatsState.pendingPromise = requestPromise;
  const data = await requestPromise;

  if (data) {
    const viewModel = buildTeacherStatsViewModel(
      data,
      teacherStatsState.selectedRange || "7d",
    );
    renderTeacherStatsPageState(viewModel);
  } else {
    renderTeacherStatsEmpty("Không thể tải dữ liệu thống kê.");
  }

  return data;
}

async function initializeTeacherStatsPage(forceRefresh = false) {
  if (normalizeRole(getCurrentRole()) !== "teacher") {
    return;
  }

  bindTeacherStatsControls();
  renderTeacherStatsSkeleton();
  const data = await loadTeacherStatsData({
    selectedClassId: teacherStatsState.selectedClassId,
    forceRefresh,
  });

  if (!data) {
    renderTeacherStatsEmpty("Không tìm thấy dữ liệu thống kê cho giáo viên.");
  }
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

  if (
    !Array.isArray(manualAssignmentState.questions) ||
    manualAssignmentState.questions.length === 0
  ) {
    manualAssignmentState.questions = [createManualQuestion(1)];
  }

  list.innerHTML = manualAssignmentState.questions
    .map((question, index) => renderManualQuestionBlock(question, index))
    .join("");
}

function renderAssignmentAiQuestionBlock(question, index) {
  const safeQuestion = normalizeAssignmentAiQuestion(question, index);

  return `
    <article class="manual-question-card ai-question-card" data-ai-question-block data-question-index="${index + 1}">
      <div class="manual-question-card-head">
        <span class="manual-question-badge">Câu ${index + 1}</span>
        <button type="button" class="manual-question-remove" data-ai-remove-question aria-label="Xóa câu hỏi">
          ×
        </button>
      </div>

      <div class="manual-question-field">
        <label class="auth-field-label" for="ai-question-${index + 1}">Nội dung câu hỏi</label>
        <textarea
          id="ai-question-${index + 1}"
          class="auth-input manual-question-input ai-question-input"
          name="question"
          data-ai-question-input
          rows="3"
          placeholder="Nhập nội dung câu hỏi"
        >${escapeHtml(safeQuestion.question)}</textarea>
      </div>

      <div class="manual-answer-grid ai-answer-grid">
        ${["A", "B", "C", "D"]
          .map(
            (label, answerIndex) => `
              <div class="manual-answer-field">
                <label class="auth-field-label" for="ai-question-${index + 1}-option-${answerIndex}">
                  Đáp án ${label}
                </label>
                <input
                  id="ai-question-${index + 1}-option-${answerIndex}"
                  class="auth-input manual-answer-input ai-answer-input"
                  type="text"
                  name="option-${answerIndex}"
                  data-ai-question-option
                  placeholder="Nhập đáp án ${label}"
                  value="${escapeHtml(safeQuestion.options[answerIndex] || "")}"
                />
              </div>
            `,
          )
          .join("")}
      </div>

      <div class="ai-correct-answer-row">
        <label class="auth-field-label" for="ai-question-${index + 1}-correct">Đáp án đúng</label>
        <select
          id="ai-question-${index + 1}-correct"
          class="auth-input ai-correct-answer-select"
          name="correctAnswerIndex"
          data-ai-question-correct
        >
          ${["A", "B", "C", "D"]
            .map(
              (label, answerIndex) =>
                `<option value="${answerIndex}" ${safeQuestion.correctAnswerIndex === answerIndex ? "selected" : ""}>${label}</option>`,
            )
            .join("")}
        </select>
      </div>
    </article>
  `;
}

function renderAssignmentAiQuestionList() {
  const questions = Array.isArray(assignmentAiState.questions)
    ? assignmentAiState.questions
    : [];

  if (questions.length === 0) {
    return `
      <div class="ai-empty-state">
        <strong>Chưa có câu hỏi AI</strong>
        <p>Nhấn <span>“Tạo đề bằng AI”</span> để sinh câu hỏi, sau đó bạn có thể chỉnh sửa trực tiếp ở đây.</p>
      </div>
    `;
  }

  return questions
    .map((question, index) => renderAssignmentAiQuestionBlock(question, index))
    .join("");
}

function renderAssignmentEditor() {
  const editor = getAssignmentEditorRoot();

  if (!editor) {
    return;
  }

  if (createMethod === "ai") {
    const topicOptions = Array.isArray(assignmentAiState.topics)
      ? assignmentAiState.topics
          .map((topic) => {
            const topicId = String(topic?.topicId || "").trim();
            const topicName = String(
              topic?.title || topic?.name || topic?.topicName || topicId || "",
            ).trim();

            return `
          <option value="${escapeHtml(topicId)}" ${topicId && topicId === assignmentAiState.topicId ? "selected" : ""}>
            ${escapeHtml(topicName || "Chủ đề")}
          </option>
        `;
          })
          .join("")
      : "";

    editor.innerHTML = `
      <section class="manual-assignment-section manual-assignment-section-card ai-assignment-section-card">
        <div class="ai-assignment-header">
          <div>
            <h2>AI hỗ trợ tạo câu hỏi</h2>
            <p>Chọn chủ đề và cấu hình để AI sinh đề phù hợp với lớp học.</p>
          </div>
          <div class="ai-assignment-header-pill">
            ${escapeHtml(getAssignmentGradeLabel(assignmentAiState.grade))}
          </div>
        </div>

        <div class="ai-assignment-grid">
          <div class="auth-field">
            <label class="auth-field-label" for="ai-assignment-topic">Chủ đề</label>
            <select id="ai-assignment-topic" class="auth-input" data-ai-topic-select>
              <option value="">${
                assignmentAiState.loadingTopics
                  ? "Đang tải chủ đề..."
                  : "Chọn chủ đề"
              }</option>
              ${topicOptions}
            </select>
          </div>

          <div class="auth-field">
            <label class="auth-field-label" for="ai-assignment-question-count">Số câu hỏi</label>
            <select id="ai-assignment-question-count" class="auth-input" data-ai-question-count-select>
              ${[5, 10, 15, 20]
                .map(
                  (count) =>
                    `<option value="${count}" ${String(assignmentAiState.questionCount || "10") === String(count) ? "selected" : ""}>${count}</option>`,
                )
                .join("")}
            </select>
          </div>

          <div class="auth-field">
            <label class="auth-field-label" for="ai-assignment-grade">Khối</label>
            <select id="ai-assignment-grade" class="auth-input" data-ai-grade-select>
              ${["1", "2", "3", "4", "5"]
                .map(
                  (grade) =>
                    `<option value="${grade}" ${String(assignmentAiState.grade || "4") === grade ? "selected" : ""}>Lớp ${grade}</option>`,
                )
                .join("")}
            </select>
          </div>

          <div class="auth-field">
            <label class="auth-field-label" for="ai-assignment-difficulty">Độ khó</label>
            <select id="ai-assignment-difficulty" class="auth-input" data-ai-difficulty-select>
              ${["Dễ", "Trung bình", "Khó"]
                .map(
                  (difficulty) =>
                    `<option value="${difficulty}" ${assignmentAiState.difficulty === difficulty ? "selected" : ""}>${difficulty}</option>`,
                )
                .join("")}
            </select>
          </div>
        </div>

        <div class="auth-field ai-notes-field">
          <label class="auth-field-label" for="ai-assignment-notes">Ghi chú thêm</label>
          <textarea
            id="ai-assignment-notes"
            class="auth-input ai-notes-textarea"
            rows="4"
            placeholder="Ví dụ: Tạo câu hỏi có tình huống thực tế, gần gũi với học sinh."
            data-ai-notes
          >${escapeHtml(assignmentAiState.notes || "")}</textarea>
        </div>

        <div class="ai-assignment-actions">
          <button
            type="button"
            class="manual-btn manual-btn-primary ai-generate-btn ${assignmentAiState.loading ? "is-loading" : ""}"
            data-ai-generate-button
            ${assignmentAiState.loading || assignmentAiState.loadingTopics ? "disabled" : ""}
          >
            ${assignmentAiState.loading ? "AI đang tạo đề..." : "✨ Tạo đề bằng AI"}
          </button>
          ${
            assignmentAiState.error
              ? `
            <div class="ai-assignment-error" role="alert">${escapeHtml(assignmentAiState.error)}</div>
          `
              : ""
          }
        </div>
      </section>

      <section class="manual-assignment-section ai-generated-section">
        <div class="manual-section-heading">
          <h2>Câu hỏi AI đã tạo</h2>
        </div>
        <div class="manual-assignment-question-list ai-generated-question-list" data-ai-question-list>
          ${renderAssignmentAiQuestionList()}
        </div>
      </section>

      <div class="manual-assignment-actions">
        <div class="manual-assignment-actions-row">
          <button type="button" class="manual-btn manual-btn-secondary" data-ai-add-question>
            + Thêm câu
          </button>
        </div>

        <button type="submit" class="manual-btn manual-btn-primary">Tạo bài tập</button>
      </div>
    `;

    if (assignmentAiState.loadingTopics) {
      assignmentAiState.error = assignmentAiState.error || "";
    }

    syncAssignmentAiFields();
    return;
  }

  editor.innerHTML = `
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
  `;

  renderManualQuestionList();
}

function createAssignmentQuestionPreviewHtml(question, index) {
  const safeQuestion = normalizeAssignmentAiQuestion(question, index);
  const correctIndex = Math.min(
    Math.max(Number(safeQuestion.correctAnswerIndex) || 0, 0),
    3,
  );
  const letters = ["A", "B", "C", "D"];

  return `
    <section class="manual-preview-question">
      <div class="manual-preview-question-head">
        <span class="manual-preview-badge">Câu ${index + 1}</span>
        <p class="manual-preview-question-text">${escapeHtml(
          safeQuestion.question || "Chưa nhập câu hỏi",
        )}</p>
      </div>
      <div class="manual-preview-answer-list">
        ${safeQuestion.options
          .map(
            (answer, answerIndex) => `
              <div class="manual-preview-answer ${correctIndex === answerIndex ? "is-correct" : "is-wrong"}">
                <span class="manual-preview-answer-key">${letters[answerIndex]}</span>
                <span class="manual-preview-answer-text">${escapeHtml(answer || "Chưa nhập đáp án")}</span>
                ${correctIndex === answerIndex ? '<span class="manual-preview-answer-mark">✓</span>' : ""}
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function createAssignmentAiPreviewHtml(draft) {
  const selectedTopic = getAssignmentAiSelectedTopic();
  const topicName =
    draft.topicName ||
    selectedTopic?.title ||
    selectedTopic?.name ||
    selectedTopic?.topicName ||
    draft.topicId ||
    "--";
  const questionCount = Number(draft.questionCount || 0);
  const summary = `
    <div class="manual-preview-summary ai-preview-summary">
      <h3>${escapeHtml(draft.title || "Bài tập AI")}</h3>
      <p>Môn: ${escapeHtml(getAssignmentSubjectDisplayLabel(draft.subject))}</p>
      <p>Lớp giao: ${escapeHtml(draft.className || "--")}</p>
      <p>Hạn nộp: ${escapeHtml(draft.dueDate || "--")}</p>
      <p>Chủ đề: ${escapeHtml(topicName)}</p>
      <p>Khối: ${escapeHtml(getAssignmentGradeLabel(draft.grade))}</p>
      <p>Độ khó: ${escapeHtml(getAssignmentDifficultyLabel(draft.difficulty))}</p>
      <p>Số câu: ${escapeHtml(String(questionCount || "--"))}</p>
      ${draft.notes ? `<p>Ghi chú: ${escapeHtml(draft.notes)}</p>` : ""}
    </div>
  `;

  if (assignmentAiState.loading) {
    return `
      ${summary}
      <div class="ai-preview-loading">
        <span class="quiz-loading-spinner"></span>
        <p>AI đang tạo đề...</p>
      </div>
    `;
  }

  if (!Array.isArray(draft.questions) || draft.questions.length === 0) {
    return `
      ${summary}
      <div class="ai-preview-empty">
        <strong>Chưa có câu hỏi AI</strong>
        <p>Nhấn “Tạo đề bằng AI” để sinh câu hỏi và xem trước ngay tại đây.</p>
      </div>
    `;
  }

  return `
    ${summary}
    ${draft.questions
      .map((question, index) =>
        createAssignmentQuestionPreviewHtml(question, index),
      )
      .join("")}
  `;
}

function renderAssignmentPreview() {
  const panel = getManualAssignmentPreviewPanel();

  if (!panel) {
    return;
  }

  const content = panel.querySelector(".manual-preview-content");

  if (!content) {
    return;
  }

  if (createMethod === "ai") {
    content.innerHTML = createAssignmentAiPreviewHtml(getAssignmentAiDraft());
    return;
  }

  const draft = getManualAssignmentDraft();
  content.innerHTML = createManualAssignmentPreviewHtml(draft);
}

function updateAssignmentEditorAndPreview() {
  renderAssignmentEditor();
  renderAssignmentPreview();
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

            <div class="assignment-editor" data-assignment-editor></div>
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
    classSelect.innerHTML = `
      <option value="">Đang tải lớp...</option>
    `;

    const response = await apiRequestWithAuth("/api/classes/my", {
      method: "GET",
    });

    const classes = sortClassroomRecords(
      Array.isArray(response?.data)
        ? response.data.map(normalizeClassroomRecord).filter(Boolean)
        : [],
    );

    manualAssignmentState.classes = classes;

    if (!manualAssignmentState.classId && classes.length > 0) {
      manualAssignmentState.classId = classes[0].id || "";
    }

    if (
      manualAssignmentState.classId &&
      !classes.some(
        (classroom) => classroom.id === manualAssignmentState.classId,
      )
    ) {
      manualAssignmentState.classId = classes[0]?.id || "";
    }

    const selectedClass = getSelectedManualAssignmentClass();
    manualAssignmentState.className =
      selectedClass?.name || selectedClass?.className || "";

    classSelect.innerHTML =
      classes.length > 0
        ? `
          <option value="">Chọn lớp</option>
          ${classes
            .map(
              (classroom) =>
                `<option value="${escapeHtml(classroom.id)}">${escapeHtml(classroom.name || classroom.className || "Lớp học")}</option>`,
            )
            .join("")}
        `
        : `<option value="">Chưa có lớp khả dụng</option>`;

    classSelect.value = manualAssignmentState.classId || "";
    classSelect.disabled = classes.length === 0;

    syncManualAssignmentFormFields();
    syncManualAssignmentPreview();
    return classes;
  } catch (error) {
    console.warn("Không thể tải danh sách lớp cho bài tập thủ công:", error);
    classSelect.innerHTML = `
      <option value="">Không thể tải danh sách lớp.</option>
    `;
    classSelect.disabled = true;
    manualAssignmentState.classId = "";
    manualAssignmentState.className = "";
    showToast(error.message || "Không thể tải danh sách lớp.", "error");
    return [];
  }
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
  renderAssignmentPreview();
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

function ensureAssignmentService() {
  return getAssignmentService();
}

function renderManualAssignmentPreviewFromState() {
  renderAssignmentPreview();
}

async function createAssignment(payload) {
  const service = getAssignmentService();

  if (!service?.createAssignment) {
    throw new Error("Dịch vụ tạo bài tập chưa sẵn sàng.");
  }

  return service.createAssignment(payload);
}

async function refreshTeacherAssignments() {
  if (getCurrentRole() !== "teacher") {
    return;
  }

  const service = getAssignmentService();
  const list = document.querySelector("#manage .manage-list");

  if (!service?.getTeacherAssignments || !list) {
    return;
  }

  bindTeacherAssignmentFilterControlsOnce();

  const teacherId = getCurrentUserId();

  if (!teacherId) {
    list.innerHTML = `
      <div class="manage-empty-state">
        <h3>Không thể xác định giáo viên.</h3>
        <p>Vui lòng đăng nhập lại.</p>
      </div>
    `;
    return;
  }

  void loadTeacherAssignmentClasses();

  if (typeof teacherAssignmentsUnsubscribe === "function") {
    teacherAssignmentsUnsubscribe();
  }

  list.innerHTML = `
    <div class="manage-empty-state">
      <h3>Đang tải bài tập...</h3>
      <p>Vui lòng chờ trong giây lát.</p>
    </div>
  `;

  const renderAssignments = async (assignments) => {
    teacherAssignmentSubmissionState.assignments = Array.isArray(assignments)
      ? assignments
      : [];

    if (
      teacherAssignmentSubmissionState.selectedAssignmentId &&
      !teacherAssignmentSubmissionState.assignments.some(
        (assignment) =>
          assignment.id ===
          teacherAssignmentSubmissionState.selectedAssignmentId,
      )
    ) {
      teacherAssignmentSubmissionState.selectedAssignmentId = "";
      teacherAssignmentSubmissionState.submissions = [];
      teacherAssignmentSubmissionState.loading = false;
      teacherAssignmentSubmissionState.error = "";
    }

    renderTeacherAssignmentSubmissionsView(
      teacherAssignmentSubmissionState.assignments,
      teacherAssignmentSubmissionState.submissions,
      teacherAssignmentSubmissionState.loading,
      teacherAssignmentSubmissionState.error,
    );

    void hydrateTeacherAssignmentSubmissionCache(
      teacherAssignmentSubmissionState.assignments,
    );
  };

  if (typeof service.listenTeacherAssignments === "function") {
    teacherAssignmentsUnsubscribe = service.listenTeacherAssignments(
      teacherId,
      renderAssignments,
    );
    return;
  }

  try {
    const assignments = await service.getTeacherAssignments(teacherId);
    await renderAssignments(assignments);
  } catch (error) {
    console.warn("Không thể tải danh sách bài tập của giáo viên:", error);
    list.innerHTML = `
      <div class="manage-empty-state">
        <h3>Không thể tải bài tập.</h3>
        <p>Vui lòng thử lại sau.</p>
      </div>
    `;
  }
}

async function fetchAndRenderAssignmentSubmissions(assignmentId) {
  const normalizedAssignmentId = String(assignmentId || "").trim();

  if (!normalizedAssignmentId) {
    return;
  }

  const service = getAssignmentService();

  if (!service?.fetchAssignmentSubmissions) {
    showToast("Dịch vụ xem bài nộp chưa sẵn sàng.", "error");
    return;
  }

  teacherAssignmentSubmissionState.selectedAssignmentId =
    normalizedAssignmentId;
  teacherAssignmentSubmissionState.loading = true;
  teacherAssignmentSubmissionState.error = "";
  teacherAssignmentSubmissionState.submissions = [];

  renderTeacherAssignmentSubmissionsView(
    teacherAssignmentSubmissionState.assignments,
    teacherAssignmentSubmissionState.submissions,
    true,
    "",
  );

  try {
    const submissions = await service.fetchAssignmentSubmissions(
      normalizedAssignmentId,
    );

    teacherAssignmentSubmissionState.submissions = Array.isArray(submissions)
      ? submissions
      : [];
    teacherAssignmentSubmissionState.error = "";
    renderTeacherAssignmentSubmissionsView(
      teacherAssignmentSubmissionState.assignments,
      teacherAssignmentSubmissionState.submissions,
      false,
      "",
    );
  } catch (error) {
    teacherAssignmentSubmissionState.submissions = [];
    teacherAssignmentSubmissionState.error =
      error.message || "Không thể tải bài nộp.";
    renderTeacherAssignmentSubmissionsView(
      teacherAssignmentSubmissionState.assignments,
      teacherAssignmentSubmissionState.submissions,
      false,
      teacherAssignmentSubmissionState.error,
    );
    showToast(teacherAssignmentSubmissionState.error, "error");
  } finally {
    teacherAssignmentSubmissionState.loading = false;
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

  resetManualAssignmentState();
  resetAssignmentAiState();
  manualAssignmentFormBound = false;
  renderManualAssignmentShell();
  syncManualAssignmentMethodCards();
  syncManualAssignmentFormFields();
  renderAssignmentEditor();
  renderAssignmentPreview();

  await loadManualAssignmentClasses();
  syncManualAssignmentFormFields();
  renderAssignmentEditor();

  if (createMethod === "ai") {
    await loadAssignmentAiTopics();
  }

  const form = getManualAssignmentForm();

  if (!form || manualAssignmentFormBound) {
    return;
  }

  const handleDraftChange = (event) => {
    updateManualAssignmentStateFromElement(event.target);

    if (
      createMethod === "ai" &&
      (event.target.matches("[data-manual-subject]") ||
        event.target.matches("[data-ai-grade-select]"))
    ) {
      void loadAssignmentAiTopics({ force: true });
    }

    syncManualAssignmentMethodCards();
    renderAssignmentPreview();
  };

  form.addEventListener("input", handleDraftChange);
  form.addEventListener("change", handleDraftChange);

  form.addEventListener("click", (event) => {
    const methodCard = event.target.closest("[data-create-method]");

    if (methodCard) {
      setAssignmentCreateMethod(methodCard.dataset.method);
      return;
    }

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
      renderAssignmentPreview();
      return;
    }

    const aiRemoveButton = event.target.closest("[data-ai-remove-question]");

    if (aiRemoveButton) {
      const block = aiRemoveButton.closest("[data-ai-question-block]");

      if (block) {
        removeAssignmentAiQuestion(Number(block.dataset.questionIndex) - 1);
      }

      return;
    }

    const manualAddButton = event.target.closest("[data-manual-add-question]");

    if (manualAddButton) {
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
      renderAssignmentPreview();
      return;
    }

    const aiAddButton = event.target.closest("[data-ai-add-question]");

    if (aiAddButton) {
      addAssignmentAiQuestion();
      return;
    }

    const aiGenerateButton = event.target.closest("[data-ai-generate-button]");

    if (aiGenerateButton) {
      void handleAssignmentAiGenerate();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (createMethod === "ai") {
      const draft = getAssignmentAiDraft();
      const validationMessage = validateAssignmentAiDraft(draft);

      if (validationMessage) {
        showToast(validationMessage, "error");
        return;
      }

      const selectedClass = manualAssignmentState.classes.find(
        (item) => item.id === draft.classId,
      );

      try {
        await createAssignment({
          title: draft.title,
          description: draft.description,
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
          questions: normalizeAssignmentAiQuestionsForSubmission(
            draft.questions,
          ),
        });

        showToast("Đã tạo bài tập thành công.", "success");
        resetManualAssignmentState();
        resetAssignmentAiState();
        syncManualAssignmentFormFields();
        renderAssignmentEditor();
        renderAssignmentPreview();
        await loadManualAssignmentClasses();
        if (createMethod === "ai") {
          await loadAssignmentAiTopics({ force: true });
        }
        await refreshTeacherAssignments();
      } catch (error) {
        showToast(error.message || "Không thể tạo bài tập.", "error");
      }

      return;
    }

    const draft = getManualAssignmentDraft();
    const validationMessage = validateManualAssignmentDraft(draft);

    if (validationMessage) {
      showToast(validationMessage, "error");
      return;
    }

    const service = getAssignmentService();

    const selectedClass = manualAssignmentState.classes.find(
      (item) => item.id === draft.classId,
    );

    try {
      await createAssignment({
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

      showToast("Đã tạo bài tập thành công.", "success");
      resetManualAssignmentState();
      syncManualAssignmentFormFields();
      renderManualQuestionList();
      await loadManualAssignmentClasses();
      renderAssignmentPreview();
      await refreshTeacherAssignments();
    } catch (error) {
      showToast(error.message || "Không thể tạo bài tập.", "error");
    }
  });

  manualAssignmentFormBound = true;
}

async function initializeTeacherAssignmentForm() {
  return initializeManualAssignmentBuilder();
}

function getAuthContainer() {
  return getAuthRoot();
}

function setAuthMode(isAuthMode) {
  document.body.classList.toggle("auth-mode", isAuthMode);

  if (isAuthMode) {
    closeSidebar();
  }

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
  setAdminPassword("");
  window.EduKidsCurrentUser = null;
  resetPetModuleState();

  const authRoot = getAuthContainer();

  if (authRoot) {
    authRoot.removeAttribute("data-rendered-mode");
    authRoot.innerHTML = "";
  }

  bootstrapState.currentUser = null;
  bootstrapState.initializedUid = null;
  bootstrapState.authMode = "login";
  previousPage = ROLE_DEFAULT_PAGES.student;
  currentPage = ROLE_DEFAULT_PAGES.student;
  manualAssignmentFormBound = false;
  if (typeof teacherAssignmentsUnsubscribe === "function") {
    teacherAssignmentsUnsubscribe();
  }
  teacherAssignmentsUnsubscribe = null;
  manualAssignmentState.classes = [];
  classroomState.classes = [];
  classroomState.selectedClassId = "";
  classroomState.loading = false;
  studentAssignmentClassState.classes = [];
  studentAssignmentClassState.selectedClassId = "";
  studentAssignmentClassState.loading = false;
  teacherAssignmentSubmissionState.assignments = [];
  teacherAssignmentSubmissionState.selectedAssignmentId = "";
  teacherAssignmentSubmissionState.submissions = [];
  teacherAssignmentSubmissionState.submissionsByAssignmentId.clear();
  teacherAssignmentSubmissionState.classes = [];
  teacherAssignmentSubmissionState.classFilter = "";
  teacherAssignmentSubmissionState.searchQuery = "";
  teacherAssignmentSubmissionState.loading = false;
  teacherAssignmentSubmissionState.error = "";
  teacherAssignmentSubmissionState.classesLoaded = false;
  teacherAssignmentSubmissionState.classesLoading = false;
  teacherAssignmentSubmissionState.submissionsLoadingByAssignmentId.clear();
  studentAssignmentSubmissionLoading = false;
  closeTeacherAssignmentDetail();
  currentAssignments = [];
  currentAssignmentId = "";
  delete window.EduKidsCurrentAssignment;
  resetManualAssignmentState();
  setAuthMode(true);
  redirectToLoginRoute();
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

let toastHideTimer = null;

function showToast(message, type = "success") {
  if (typeof document === "undefined") {
    return;
  }

  const existingToast = document.querySelector(".toast");

  if (existingToast) {
    existingToast.remove();
  }

  if (toastHideTimer) {
    window.clearTimeout(toastHideTimer);
    toastHideTimer = null;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`.trim();
  toast.innerHTML = String(message || "");

  document.body.appendChild(toast);

  window.requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  toastHideTimer = window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => {
      toast.remove();
    }, 250);
  }, 3000);
}

function syncSidebarToggleButtons(isOpen) {
  const expanded = String(Boolean(isOpen));

  document.querySelectorAll("[data-mobile-menu-toggle]").forEach((button) => {
    button.setAttribute("aria-expanded", expanded);
  });
}

function setSidebarOpen(isOpen) {
  const nextIsOpen = Boolean(isOpen);
  document.body.classList.toggle("sidebar-open", nextIsOpen);
  syncSidebarToggleButtons(nextIsOpen);
}

function closeSidebar() {
  setSidebarOpen(false);
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

function renderAdminAuthModal() {
  return `
    <div class="auth-modal" data-admin-auth-modal hidden>
      <div class="auth-modal-backdrop" data-admin-auth-overlay></div>

      <div class="auth-modal-card" role="dialog" aria-modal="true" aria-labelledby="admin-auth-title">
        <div class="auth-modal-head">
          <div>
            <span class="auth-modal-kicker">Quản trị</span>
            <h3 id="admin-auth-title">Đăng nhập quản trị</h3>
          </div>

          <button
            type="button"
            class="auth-modal-close"
            data-admin-auth-close
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <form id="admin-auth-form" class="auth-modal-form" data-admin-auth-form novalidate>
          ${renderPasswordField({
            id: "admin-login-password",
            name: "password",
            label: "Mật khẩu quản trị",
            placeholder: "Nhập mật khẩu quản trị",
            value: "",
            autocomplete: "current-password",
          })}

          <p class="auth-modal-note">
            Nhập mật khẩu quản trị để truy cập khu vực Admin của EduKids.
          </p>

          <div class="auth-modal-feedback" data-admin-auth-feedback aria-live="polite"></div>

          <div class="auth-modal-actions">
            <button type="button" class="auth-modal-cancel" data-admin-auth-close>
              Hủy
            </button>
            <button type="submit" class="auth-modal-submit">
              Đăng nhập
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderLoginScreen() {
  const draft = authDrafts.login;

  return `
    <section class="auth-shell">
      <div class="auth-stage">
        <div class="auth-form-head">
          <div class="auth-badge">ĐĂNG NHẬP</div>
          <button
            type="button"
            class="auth-admin-button"
            data-admin-auth-open
          >
            ⚙️ Quản trị
          </button>
        </div>

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
              <button
                type="button"
                class="auth-link-button"
                data-forgot-password
              >
                Quên mật khẩu
              </button>
            </div>

            ${renderChoiceGroup({
              name: "role",
              label: "Vai trò",
              selectedValue: draft.role,
              options: [
                {
                  value: "student",
                  label: "Học sinh",
                  icon: "👤",
                },
                {
                  value: "teacher",
                  label: "Giáo viên",
                  icon: "👩‍🏫",
                },
              ],
            })}

            ${renderAuthFeedback()}

            <button
              type="submit"
              class="auth-submit-button"
            >
              Đăng nhập
            </button>

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

        ${renderAdminAuthModal()}
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
                {
                  value: "student",
                  label: "Học sinh",
                  icon: "👤",
                },
                {
                  value: "teacher",
                  label: "Giáo viên",
                  icon: "👩‍🏫",
                },
              ],
            })}

            ${renderChoiceGroup({
              name: "gender",
              label: "Giới tính",
              selectedValue: draft.gender,
              options: [
                {
                  value: "male",
                  label: "Nam",
                  icon: "♂",
                },
                {
                  value: "female",
                  label: "Nữ",
                  icon: "♀",
                },
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

            <button type="submit" class="auth-submit-button">
              Tạo tài khoản
            </button>

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

function getAdminAuthModal() {
  return getAuthRoot()?.querySelector("[data-admin-auth-modal]") || null;
}

function getAdminAuthFeedback() {
  return getAuthRoot()?.querySelector("[data-admin-auth-feedback]") || null;
}

function getAdminAuthForm() {
  return getAuthRoot()?.querySelector("[data-admin-auth-form]") || null;
}

function setAdminAuthFeedback(message, kind = "error") {
  const feedback = getAdminAuthFeedback();

  if (!feedback) {
    return;
  }

  feedback.className = `auth-modal-feedback is-visible is-${kind}`;
  feedback.textContent = message || "";
}

function clearAdminAuthFeedback() {
  const feedback = getAdminAuthFeedback();

  if (!feedback) {
    return;
  }

  feedback.className = "auth-modal-feedback";
  feedback.textContent = "";
}

function openAdminAuthModal() {
  const modal = getAdminAuthModal();
  const form = getAdminAuthForm();
  const passwordInput = form?.querySelector("#admin-login-password");

  if (!modal) {
    return;
  }

  modal.hidden = false;
  modal.classList.add("is-open");
  clearAdminAuthFeedback();

  if (passwordInput instanceof HTMLInputElement) {
    passwordInput.value = "";
    window.requestAnimationFrame(() => {
      passwordInput.focus();
    });
  }
}

function closeAdminAuthModal() {
  const modal = getAdminAuthModal();
  const form = getAdminAuthForm();

  if (!modal) {
    return;
  }

  modal.classList.remove("is-open");
  modal.hidden = true;
  clearAdminAuthFeedback();

  if (form instanceof HTMLFormElement) {
    form.reset();
  }
}

function goToAdminDashboard() {
  window.history.pushState({}, "", "/admin");
  setAdminMode(true);
  bindAdminEventsOnce();
  changeAdminPage(ADMIN_DEFAULT_PAGE);
  void syncAdminOverview({ forceRefresh: true });
}

function showLoginScreen() {
  setAdminMode(false);
  setAuthMode(true);

  const authRoot = getAuthRoot();
  if (authRoot) {
    authRoot.removeAttribute("data-rendered-mode");
  }

  renderAuthScreen("login");
}

function syncCurrentRouteState() {
  if (isAdminRoute()) {
    if (!isAdminAuthenticated()) {
      redirectToLoginRoute();
      showLoginScreen();
      return;
    }

    const desiredPath = "/admin";
    if (String(window.location.pathname || "") !== desiredPath) {
      window.history.replaceState({}, "", desiredPath);
    }

    setAdminMode(true);
    bindAdminEventsOnce();
    changeAdminPage(ADMIN_DEFAULT_PAGE);
    void syncAdminOverview();
    return;
  }

  bindStudentQuizControlsOnce();
  initializeAuth();
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
    const adminOpenButton = event.target.closest("[data-admin-auth-open]");
    if (adminOpenButton) {
      openAdminAuthModal();
      return;
    }

    const adminCloseButton = event.target.closest("[data-admin-auth-close]");
    if (adminCloseButton) {
      closeAdminAuthModal();
      return;
    }

    const adminOverlay = event.target.closest("[data-admin-auth-overlay]");
    if (adminOverlay) {
      closeAdminAuthModal();
      return;
    }

    const switchButton = event.target.closest("[data-auth-switch]");
    if (switchButton) {
      const nextMode = switchButton.dataset.authSwitch;
      if (nextMode === "login" || nextMode === "register") {
        authRoot.removeAttribute("data-rendered-mode");
        closeAdminAuthModal();
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
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    if (form.matches("[data-admin-auth-form]")) {
      event.preventDefault();
      clearAdminAuthFeedback();

      const password = form.elements.password?.value?.trim();

      if (!password) {
        setAdminAuthFeedback("Vui lòng nhập mật khẩu quản trị.", "error");
        return;
      }

      try {
        setAdminAuthFeedback("Đang xác thực quản trị...", "success");

        await apiRequest("/api/admin/login", {
          password,
        });

        setAdminAuthenticated(true);
        setAdminPassword(password);
        closeAdminAuthModal();
        goToAdminDashboard();
      } catch (error) {
        console.error("[EduKids][admin] login failed", error);
        setAdminAuthenticated(false);
        setAdminPassword("");
        setAdminAuthFeedback("Sai mật khẩu quản trị", "error");
      }
      return;
    }

    if (form.id !== "auth-form") {
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

  if (isSystemMaintenanceEnabled()) {
    setFeedbackMessage(form, getSystemMaintenanceMessage(), "error");
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

  if (!isRegistrationEnabled(role)) {
    setFeedbackMessage(
      form,
      `Đăng ký ${role === "teacher" ? "giáo viên" : "học sinh"} hiện đang bị tắt.`,
      "error",
    );
    return;
  }

  if (isSystemMaintenanceEnabled()) {
    setFeedbackMessage(form, getSystemMaintenanceMessage(), "error");
    return;
  }

  try {
    setFeedbackMessage(form, "Đang đăng ký...", "success");

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

function bindAppEventsOnce() {
  const appShell = getAppShell();
  if (!appShell || bootstrapState.appBound) {
    return;
  }

  appShell.addEventListener("click", async (event) => {
    const studentDetailRoot = document.querySelector(
      "#assignments [data-assignment-detail-root]",
    );
    const teacherDetailRoot = document.querySelector(
      "#manage [data-teacher-assignment-detail-root]",
    );
    const assignmentBackButton = event.target.closest("[data-assignment-back]");
    if (
      assignmentBackButton &&
      studentDetailRoot?.contains(assignmentBackButton)
    ) {
      event.preventDefault();
      closeStudentAssignmentDetail();
      return;
    }

    const teacherBackButton = event.target.closest(
      "[data-teacher-assignment-back]",
    );
    const teacherCloseButton = event.target.closest(
      "[data-teacher-assignment-close]",
    );
    const teacherStudentViewButton = event.target.closest(
      "[data-teacher-student-view]",
    );
    const teacherStudentRow = event.target.closest(
      "[data-teacher-student-row]",
    );

    if (
      (teacherBackButton || teacherCloseButton) &&
      teacherDetailRoot?.contains(teacherBackButton || teacherCloseButton)
    ) {
      event.preventDefault();
      closeTeacherAssignmentDetail();
      return;
    }

    if (
      teacherStudentViewButton &&
      teacherDetailRoot?.contains(teacherStudentViewButton)
    ) {
      const studentId = String(
        teacherStudentViewButton.dataset.studentId || "",
      ).trim();

      if (studentId) {
        event.preventDefault();
        await selectTeacherAssignmentStudent(studentId);
      }

      return;
    }

    if (teacherStudentRow && teacherDetailRoot?.contains(teacherStudentRow)) {
      const studentId = String(
        teacherStudentRow.dataset.studentId || "",
      ).trim();

      if (studentId) {
        event.preventDefault();
        await selectTeacherAssignmentStudent(studentId);
      }

      return;
    }

    const assignmentOptionButton = event.target.closest("[data-option-label]");

    if (
      assignmentOptionButton &&
      studentDetailRoot?.contains(assignmentOptionButton)
    ) {
      const selected = String(
        assignmentOptionButton.dataset.optionLabel || "",
      ).trim();
      const questionBlock = assignmentOptionButton.closest(
        "[data-question-block]",
      );
      const questionIndex = Number(
        questionBlock?.dataset.assignmentQuestionIndex || "",
      );

      if (
        Number.isInteger(questionIndex) &&
        selected &&
        !assignmentOptionButton.disabled
      ) {
        setStudentAssignmentSelectedAnswer(questionIndex, selected);
        const currentAssignment = studentAssignmentDetailState.assignment;

        if (currentAssignment) {
          renderStudentAssignmentDetail(currentAssignment);
        }
      }

      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const assignmentPrimaryButton = event.target.closest(
      "[data-assignment-action='detail-primary']",
    );
    if (assignmentPrimaryButton) {
      const assignmentId = String(
        assignmentPrimaryButton.dataset.assignmentId || "",
      ).trim();

      if (!assignmentId) {
        return;
      }

      event.preventDefault();

      if (getCurrentRole() === "teacher") {
        await openTeacherAssignmentDetail(assignmentId);
      } else {
        await openStudentAssignmentDetail(assignmentId);
      }
      return;
    }

    const assignmentDetailButton = event.target.closest(".manage-detail-btn");
    if (assignmentDetailButton) {
      const assignmentId = String(
        assignmentDetailButton.dataset.assignmentId || "",
      ).trim();

      if (!assignmentId) {
        return;
      }

      event.preventDefault();
      await openTeacherAssignmentDetail(assignmentId);
      return;
    }

    const assignmentDeleteButton = event.target.closest(
      "[data-assignment-delete-id]",
    );
    if (assignmentDeleteButton) {
      const assignmentId = String(
        assignmentDeleteButton.dataset.assignmentDeleteId || "",
      ).trim();
      const assignment = teacherAssignmentSubmissionState.assignments.find(
        (item) => String(item?.id || "").trim() === assignmentId,
      );

      if (!assignment) {
        showToast("Không tìm thấy bài tập để xóa.", "error");
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      await handleDeleteTeacherAssignment(assignment);
      return;
    }

    const pageTrigger = event.target.closest("[data-page]");
    if (pageTrigger?.dataset.page) {
      changePage(pageTrigger.dataset.page);
      return;
    }

    const homeStartButton = event.target.closest("[data-home-start-learning]");
    if (homeStartButton) {
      openSubject();
      return;
    }

    const weeklyProgressButton = event.target.closest(
      "[data-weekly-progress-details]",
    );
    if (weeklyProgressButton) {
      changePage("progress");
      return;
    }

    const aiCoachButton = event.target.closest("[data-open-ai-coach]");
    if (aiCoachButton) {
      changePage("ai-coach");
      return;
    }

    const aiCoachPracticeButton = event.target.closest(
      "[data-ai-coach-practice-topic]",
    );
    if (aiCoachPracticeButton) {
      const topicId = String(
        aiCoachPracticeButton.dataset.aiCoachPracticeTopic || "",
      ).trim();
      const grade = String(
        aiCoachPracticeButton.dataset.aiCoachPracticeGrade || "",
      ).trim();
      const subject = String(
        aiCoachPracticeButton.dataset.aiCoachPracticeSubject || "",
      ).trim();

      event.preventDefault();
      void openAICoachPracticeTopic(topicId, grade, subject);
      return;
    }

    const openAssignmentsButton = event.target.closest(
      "[data-open-assignments]",
    );
    if (openAssignmentsButton) {
      changePage("assignments");
      return;
    }

    const learningPathContinueButton = event.target.closest(
      "[data-learning-path-continue]",
    );
    if (learningPathContinueButton) {
      changePage("subjects");
      return;
    }

    const menuToggle = event.target.closest("[data-mobile-menu-toggle]");
    if (menuToggle) {
      const isOpen = !document.body.classList.contains("sidebar-open");
      setSidebarOpen(isOpen);
      return;
    }

    const sidebarBackdrop = event.target.closest("[data-sidebar-backdrop]");
    if (sidebarBackdrop) {
      closeSidebar();
      return;
    }

    const logoutButton = event.target.closest("[data-logout-button]");
    if (logoutButton) {
      handleLogout();
    }
  });

  window.addEventListener("edukids:pet:back", () => {
    if (currentPage !== "pet") {
      return;
    }

    hidePetModulePages();
    changePage(previousPage);
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

  if (isSystemMaintenanceEnabled() && normalizeRole(user?.role) !== "admin") {
    renderMaintenanceScreen();
    return;
  }

  const identityKey = String(
    user.uid || user.userId || user.id || user.username || user.email || "",
  ).trim();

  if (
    bootstrapState.initializedUid &&
    bootstrapState.initializedUid !== identityKey
  ) {
    resetPetModuleState();
  }

  bootstrapState.initializedUid = identityKey;
  bootstrapState.currentUser = user;

  bindAppEventsOnce();
  const routePageId = getRoutePageForPathname();
  const targetPageId = resolvePageForRole(
    routePageId || getDefaultPageForRole(user.role),
    user.role,
  );
  changePage(targetPageId);

  if (routePageId && targetPageId !== routePageId) {
    window.history.replaceState({}, "", "/");
  }

  window.EduKidsCurrentUser = user;
  void syncSidebarProfile();
  renderStudentHomeOverview(user);
  renderStudentProgressPage(user);
  void syncStudentProgress(user);
  void syncStudentHomeRecommendations(user);
  void syncStudentWeeklyProgress(user);
  void syncStudentStrengthWeakness(user);
  void syncStudentHomeAssignments(user);
  void syncStudentRecentWrongAnswers(user);
  void syncTeacherDashboard(user);
}

function initializeAuth() {
  const sessionUser = getCurrentAuthUser();
  const role = normalizeRole(sessionUser?.role);
  const appShell = getAppShell();
  const authRoot = getAuthRoot();

  if (isSystemMaintenanceEnabled() && role !== "admin") {
    renderMaintenanceScreen();
    return;
  }

  if (sessionUser && role) {
    bootstrapState.currentUser = sessionUser;
    setAuthMode(false);
    initApp(sessionUser);
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

  redirectToLoginRoute();
  renderAuthScreen("login");
}

function syncAuthState() {
  const sessionUser = getCurrentAuthUser();
  const role = normalizeRole(sessionUser?.role);

  if (isSystemMaintenanceEnabled() && role !== "admin") {
    renderMaintenanceScreen();
    return;
  }

  if (sessionUser && role) {
    bootstrapState.currentUser = sessionUser;
    setAuthMode(false);
    initApp(sessionUser);
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

  redirectToLoginRoute();
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
  window.openCreateAssignment = openCreateAssignment;
  window.openProfile = openProfile;
  window.openTeacherDashboard = openTeacherDashboard;
  window.openAdminDashboard = openAdminDashboard;
  window.goBackPage = goBackPage;
  window.openSubject = openSubject;
  window.goBackSubjects = goBackSubjects;
  window.submitStudentQuiz = submitStudentQuiz;
  window.submitStudentAssignment = submitStudentAssignment;
  window.openAssignmentDetail = openAssignmentDetail;
  window.showStudentWrongAnswerReview = showStudentWrongAnswerReview;
  window.showSubject = showSubject;
  window.createAssignment = createAssignment;
  window.initializeTeacherAssignmentForm = initializeTeacherAssignmentForm;
  window.initializeClassroomPage = initializeClassroomPage;
  window.initializeStudentAssignmentPage = initializeStudentAssignmentPage;
  window.initializeManualAssignmentBuilder = initializeManualAssignmentBuilder;
  window.refreshTeacherAssignments = refreshTeacherAssignments;
  window.getDisplayName = getDisplayName;
  window.calculateStreak = calculateStreak;
  window.calculateLevel = calculateLevel;
  window.askAI = () => {
    void handleAICoachAnalyze();
  };
  window.EduKidsApi = {
    requestAdmin: apiRequestAdmin,
    request: apiRequest,
    requestPublic: apiRequestPublic,
    requestWithAuth: apiRequestWithAuth,
  };
  window.EduKidsAuth = {
    getAccessToken,
    hasAccessToken,
    getAdminPassword,
  };
}

async function bootstrap() {
  installCompatibilityGlobals();
  const systemSettingsService = getSystemSettingsService();

  if (typeof systemSettingsService?.observeSystemSettings === "function") {
    systemSettingsState.unsubscribe =
      systemSettingsService.observeSystemSettings((settings) => {
        systemSettingsState.data = settings;
        systemSettingsState.loaded = true;
        syncSystemSettingsUi(settings);

        if (currentAdminPage === "admin-settings") {
          renderAdminSettingsPage();
        }

        if (currentAdminPage === "admin-ai") {
          renderAdminAiPage();
        }

        if (currentPage === "ai-coach") {
          renderAICoachPage();
        }

        const authRoot = getAuthRoot();
        const role = normalizeRole(getCurrentAuthUser()?.role);

        if (settings?.maintenance?.enabled && role !== "admin") {
          renderMaintenanceScreen();
          return;
        }

        if (authRoot?.dataset.renderedMode === "maintenance") {
          syncCurrentRouteState();
        }
      });

    systemSettingsState.listenerReady =
      typeof systemSettingsService.getReadyPromise === "function"
        ? systemSettingsService.getReadyPromise()
        : Promise.resolve(systemSettingsState.data);

    await systemSettingsState.listenerReady.catch(() => null);
  } else {
    await syncSystemSettings({ forceRefresh: true });
  }

  window.addEventListener("popstate", () => {
    syncCurrentRouteState();
  });
  syncCurrentRouteState();
}

void whenDomReady().then(bootstrap);
