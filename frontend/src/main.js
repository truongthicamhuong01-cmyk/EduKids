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

const ROLE_DEFAULT_PAGES = {
  student: "student-home",
  teacher: "teacher-dashboard",
};

const ROLE_ALLOWED_PAGES = {
  student: new Set([
    "student-home",
    "ai-coach",
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
    "manage",
    "stats",
    "teacher-profile",
  ]),
};

let previousPage = ROLE_DEFAULT_PAGES.student;
let currentPage = ROLE_DEFAULT_PAGES.student;

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
  return ROLE_DEFAULT_PAGES[normalizeRole(role)] || ROLE_DEFAULT_PAGES.student;
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

function getSidebarAvatarPath(profile) {
  if (window.EduKidsProfileService?.getAvatarPathFromProfile) {
    return window.EduKidsProfileService.getAvatarPathFromProfile(profile);
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
    roleLabel: role === "teacher" ? "Giáo viên" : "Học sinh",
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
  } catch (error) {
    console.warn("Không thể đồng bộ sidebar user:", error);
    renderSidebarProfileCards(profile);
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

function changePage(pageId) {
  const role = getCurrentRole();
  const targetPageId = resolvePageForRole(pageId, role);

  previousPage = currentPage;
  currentPage = targetPageId;

  showPage(targetPageId);
  applyRoleVisibility(role);

  if (role === "teacher" && targetPageId !== "manage" && currentTeacherAssignmentDetail.visible) {
    closeTeacherAssignmentDetail();
  }

  const profilePageType = getProfilePageType(targetPageId);

  if (
    profilePageType &&
    typeof ensureProfileLoaded === "function"
  ) {
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

function goBackPage() {
  changePage(previousPage);
}

const profileState = {
  current: null,
  loading: false,
  error: null,
};

function getProfilePageRoot(pageType) {
  if (!pageType) {
    return null;
  }

  return document.querySelector(`[data-profile-page="${pageType}"]`);
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

  if (profile?.role === "teacher") {
    return `assets/userAvatar/${profile?.gender === "female" ? "femaleteacher.png" : "maleteacher.png"}`;
  }

  return `assets/userAvatar/${profile?.gender === "female" ? "girl.png" : "boy.png"}`;
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
    timeStyle: "short",
  }).format(date);
}

function formatStatValue(value) {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? String(numeric) : "--";
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
  if (birthdate) birthdate.textContent = formatDateTime(profile?.createdAt);
  if (email) email.textContent = profile?.email || "--";

  const stats = profile?.stats || {};
  if (totalClasses) {
    totalClasses.textContent = formatStatValue(stats.totalClasses);
  }
  if (assignmentsCreated) {
    assignmentsCreated.textContent = formatStatValue(stats.assignmentsCreated);
  }
  if (studentsManaged) {
    studentsManaged.textContent = formatStatValue(stats.studentsManaged);
  }
  if (averageScore) {
    averageScore.textContent = formatStatValue(stats.averageScore);
  }

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
  renderSidebarProfileCards(profile);
}

function renderProfileView(profile) {
  const profileType = profile?.role === "teacher" ? "teacher" : "student";

  profileState.current = profile;

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

document.addEventListener("click", (event) => {
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
};

let studentQuizControlsBound = false;

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

      return `
        <button
          type="button"
          class="topic-card ${isActive ? "is-active" : ""}"
          data-topic-id="${escapeHtml(topic.topicId)}"
          data-topic-name="${escapeHtml(topic.name)}"
        >
          <img class="topic-card-image" src="${escapeHtml(getStudentTopicImage(topic))}" alt="${escapeHtml(topic.name)}" />
          <span class="topic-card-grade">Lớp ${escapeHtml(topic.grade)}</span>
          <h3 class="topic-card-title">${escapeHtml(topic.name)}</h3>
          <p class="topic-card-description">${escapeHtml(topic.description || "Chọn để mở quiz để luyện.")}</p>
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
          <h2>Đang tải bài học...</h2>
        </div>
      </div>
      <div class="quiz-loading-card">
        <span class="quiz-loading-spinner"></span>
        <p>Đang tải bài học...</p>
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
    showToast(studentQuizState.topicsMessage, "error");
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
    showToast("Không thể tạo bộ câu hỏi. Vui lòng thử lại.", "error");
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

function bindStudentQuizControlsOnce() {
  if (studentQuizControlsBound) {
    return;
  }

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
let createMethod = "manual";

function getCurrentUserId() {
  const user = getCurrentAuthUser();

  return String(user?.userId || user?.uid || user?.id || "").trim();
}

function getAssignmentService() {
  return window.EduKidsAssignmentService || null;
}

function getFirestoreInstance() {
  if (!window.firebase?.apps?.length || typeof window.firebase.app !== "function") {
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

function normalizeTeacherManageSearchValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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

  const studentCount = Number(classroom.studentCount ?? classroom.studentsCount ?? 0);

  return Number.isFinite(studentCount) ? studentCount : 0;
}

function getTeacherAssignmentClassroomById(classId) {
  const normalizedClassId = String(classId || "").trim();

  if (!normalizedClassId) {
    return null;
  }

  return (
    Array.isArray(teacherAssignmentSubmissionState.classes)
      ? teacherAssignmentSubmissionState.classes.find(
          (classroom) => classroom.id === normalizedClassId,
        )
      : null
  );
}

function getTeacherAssignmentSubmittedStudentsCount(assignmentId) {
  const normalizedAssignmentId = String(assignmentId || "").trim();

  if (!normalizedAssignmentId) {
    return 0;
  }

  const submissions = teacherAssignmentSubmissionState.submissionsByAssignmentId.get(
    normalizedAssignmentId,
  );

  if (!Array.isArray(submissions) || submissions.length === 0) {
    return 0;
  }

  return uniqueClassroomValues(
    submissions.map((submission) => String(submission?.studentId || "").trim()),
  ).length;
}

function calculateTeacherAssignmentProgressPercent(submittedStudents, totalStudents) {
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
  const submittedStudents = getTeacherAssignmentSubmittedStudentsCount(assignment?.id);
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
  const assignmentRef = firestore.collection("assignments").doc(normalizedAssignmentId);
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
    teacherAssignmentSubmissionState.submissionsByAssignmentId.delete(normalizedAssignmentId);
    teacherAssignmentSubmissionState.assignments = teacherAssignmentSubmissionState.assignments.filter(
      (item) => String(item?.id || "").trim() !== normalizedAssignmentId,
    );

    if (
      String(teacherAssignmentSubmissionState.selectedAssignmentId || "").trim() ===
      normalizedAssignmentId
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
  const selectedClassId = String(teacherAssignmentSubmissionState.classFilter || "").trim();

  return normalizedAssignments.filter((assignment) => {
    if (selectedClassId && String(assignment?.classId || "").trim() !== selectedClassId) {
      return false;
    }

    if (!searchQuery) {
      return true;
    }

    return getTeacherAssignmentSearchIndex(assignment).includes(searchQuery);
  });
}

function syncTeacherAssignmentFilterControls() {
  const searchInput = document.querySelector("#manage [data-teacher-assignment-search]");
  const classSelect = document.querySelector("#manage [data-teacher-assignment-class-filter]");

  if (searchInput && searchInput.value !== teacherAssignmentSubmissionState.searchQuery) {
    searchInput.value = teacherAssignmentSubmissionState.searchQuery;
  }

  if (classSelect && classSelect.value !== teacherAssignmentSubmissionState.classFilter) {
    classSelect.value = teacherAssignmentSubmissionState.classFilter;
  }
}

function renderTeacherAssignmentClassFilterOptions() {
  const classSelect = document.querySelector("#manage [data-teacher-assignment-class-filter]");

  if (!classSelect) {
    return;
  }

  const classes = Array.isArray(teacherAssignmentSubmissionState.classes)
    ? teacherAssignmentSubmissionState.classes
    : [];
  const currentSelectedClassId = String(teacherAssignmentSubmissionState.classFilter || "").trim();
  const availableClassIds = new Set(classes.map((classroom) => String(classroom?.id || "").trim()));
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
              const classLabel = classroom?.name || classroom?.className || classId || "Lớp học";

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

  const classSelect = document.querySelector("#manage [data-teacher-assignment-class-filter]");

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
    if (Array.isArray(teacherAssignmentSubmissionState.assignments) && teacherAssignmentSubmissionState.assignments.length > 0) {
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
    if (Array.isArray(teacherAssignmentSubmissionState.assignments) && teacherAssignmentSubmissionState.assignments.length > 0) {
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

  const requestToken = teacherAssignmentSubmissionState.assignmentsHydrationToken + 1;
  teacherAssignmentSubmissionState.assignmentsHydrationToken = requestToken;

  const service = getAssignmentService();

  if (!service?.fetchAssignmentSubmissions) {
    return;
  }

  const missingAssignments = normalizedAssignments.filter((assignment) => {
    const normalizedAssignmentId = String(assignment.id || "").trim();
    return (
      !teacherAssignmentSubmissionState.submissionsByAssignmentId.has(normalizedAssignmentId) &&
      !teacherAssignmentSubmissionState.submissionsLoadingByAssignmentId.has(normalizedAssignmentId)
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
        const submissions = await service.fetchAssignmentSubmissions(normalizedAssignmentId);

        if (teacherAssignmentSubmissionState.assignmentsHydrationToken !== requestToken) {
          return;
        }

        const normalizedSubmissions = Array.isArray(submissions)
          ? submissions
              .map((submission) => normalizeTeacherAssignmentSubmissionRecord(submission))
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

  if (teacherAssignmentSubmissionState.assignmentsHydrationToken !== requestToken) {
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
    const searchInput = event.target.closest("[data-teacher-assignment-search]");

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
    const classSelect = event.target.closest("[data-teacher-assignment-class-filter]");

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
    page.querySelectorAll("h1, .assignments-toolbar, .assignment-tabs, .assignment-tab"),
  );
}

function setStudentAssignmentFeedVisibility(isVisible) {
  getStudentAssignmentFeedNodes().forEach((node) => {
    node.hidden = !isVisible;
  });
}

function getStudentAssignmentSelectedAnswer(questionIndex) {
  const normalizedQuestionIndex = Number(questionIndex);

  if (!Number.isInteger(normalizedQuestionIndex) || normalizedQuestionIndex < 0) {
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
  const normalizedSelected = String(selected || "").trim().toUpperCase();

  if (!Number.isInteger(normalizedQuestionIndex) || normalizedQuestionIndex < 0) {
    return;
  }

  const existingIndex = studentAssignmentDetailState.answers.findIndex(
    (item) => item.questionIndex === normalizedQuestionIndex,
  );

  if (existingIndex >= 0) {
    studentAssignmentDetailState.answers[existingIndex].selected = normalizedSelected;
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

  const status = String(assignment.status || "").trim().toLowerCase() || "pending";
  const dueDate = assignment.dueDate === "" ? null : assignment.dueDate || null;

  return {
    id: String(
      assignment.id ||
        assignment.assignmentId ||
        assignment.docId ||
        "",
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
      String(assignment.submissionStatus || "").trim().toLowerCase() || "",
    submissionId: String(assignment.submissionId || "").trim(),
    submittedAt: assignment.submittedAt || "",
    score: assignment.score ?? null,
    correctCount: Number.isFinite(Number(assignment.correctCount)) ? Number(assignment.correctCount) : null,
    wrongCount: Number.isFinite(Number(assignment.wrongCount)) ? Number(assignment.wrongCount) : null,
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

function normalizeStudentAssignmentQuestionOptions(question) {
  if (!question || typeof question !== "object") {
    return [];
  }

  if (Array.isArray(question.options)) {
    return question.options
      .map((option, index) => {
        if (option && typeof option === "object") {
          return {
            label: String(option.label || String.fromCharCode(65 + index)).trim().toUpperCase(),
            text: String(option.text || option.answer || option.value || "").trim(),
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
      currentAssignments.find((assignment) => assignment.id === currentAssignmentId) ||
      null;

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
        Number.isInteger(Number(value.questionIndex)) && Number(value.questionIndex) >= 0
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
    const normalizedQuestionIndex = Number.isInteger(numericQuestionIndex) && numericQuestionIndex >= 0
      ? numericQuestionIndex
      : fallbackIndex;
    const questionId = String(
      block.dataset.questionId ||
        block.dataset.assignmentQuestionId ||
        "",
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
        seenQuestionIndexes.add(String(payload.questionIndex ?? normalizedQuestionIndex));
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
        seenQuestionIndexes.add(String(payload.questionIndex ?? normalizedQuestionIndex));
        if (questionId) {
          seenQuestionIds.add(questionId);
        }
      }
      return;
    }

    const checkedCheckbox = block.querySelector("input[type='checkbox']:checked");

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
        seenQuestionIndexes.add(String(payload.questionIndex ?? normalizedQuestionIndex));
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
        seenQuestionIndexes.add(String(payload.questionIndex ?? normalizedQuestionIndex));
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
        seenQuestionIndexes.add(String(payload.questionIndex ?? normalizedQuestionIndex));
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
        questionId: field.dataset.questionId || field.dataset.assignmentQuestionId || "",
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

function collectStudentAssignmentAnswers(assignment, root = getStudentAssignmentWorkRoot()) {
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

function setStudentAssignmentSubmitButtonState(button, isLoading, originalLabel = "") {
  if (!button) {
    return;
  }

  if (!button.dataset.originalLabel) {
    button.dataset.originalLabel = originalLabel || button.textContent || "";
  }

  button.disabled = isLoading;
  button.textContent = isLoading
    ? "Đang nộp..."
    : button.dataset.originalLabel || originalLabel || button.textContent || "Nộp bài";
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
      status: String(submission?.status || "graded").trim().toLowerCase() || "graded",
      submissionStatus: "graded",
      submissionId: String(submission?.id || "").trim(),
      submittedAt: submission?.submittedAt || new Date().toISOString(),
      score: submission?.score ?? null,
      correctCount: Number.isFinite(Number(submission?.correctCount)) ? Number(submission.correctCount) : null,
      wrongCount: Number.isFinite(Number(submission?.wrongCount)) ? Number(submission.wrongCount) : null,
      totalQuestions: Number.isFinite(Number(submission?.totalQuestions)) ? Number(submission.totalQuestions) : null,
      gradedAt: submission?.gradedAt || "",
    };
  });

  const updatedAssignment =
    currentAssignments.find((assignment) => assignment.id === normalizedAssignmentId) || null;

  if (updatedAssignment) {
    window.EduKidsCurrentAssignment = updatedAssignment;

    if (
      studentAssignmentDetailState.assignment &&
      String(studentAssignmentDetailState.assignment.id || "").trim() === normalizedAssignmentId
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
    status: String(submission.status || "").trim().toLowerCase() || "submitted",
  };
}

function renderTeacherAssignmentSubmissionsView(assignments, submissions = [], loading = false, error = "") {
  const list = document.querySelector("#manage .manage-list");

  if (!list) {
    return;
  }

  const normalizedAssignments = getTeacherAssignmentFilteredAssignments(assignments);
  const assignmentCards = normalizedAssignments.length > 0
    ? normalizedAssignments
        .map((assignment) => {
          const questionCount =
            Number(assignment.totalQuestions || assignment.questionCount) ||
            (Array.isArray(assignment.questions)
              ? assignment.questions.length
              : 0);
          const progressSummary = getTeacherAssignmentProgressSummary(assignment);
          const progressPercent = progressSummary.progressPercent;
          const isActive =
            String(teacherAssignmentSubmissionState.selectedAssignmentId || "").trim() ===
            String(assignment.id || "").trim();

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
  const rawStatus = String(submission?.status || "").trim().toLowerCase();

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
  if (submission?.score === null || typeof submission?.score === "undefined" || submission?.score === "") {
    return "--";
  }

  return `${String(submission.score)}/10`;
}

function normalizeTeacherQuestionChoices(question) {
  if (!question || typeof question !== "object" || !Array.isArray(question.options)) {
    return [];
  }

  return question.options
    .map((option, index) => {
      const label = String.fromCharCode(65 + index);

      if (option && typeof option === "object") {
        const text = String(option.text || option.answer || option.value || "").trim();
        const normalizedValue = String(option.value || option.text || option.answer || text || "").trim();

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
    question?.correctAnswer ||
      question?.answer ||
      question?.correct ||
      "",
  ).trim().toUpperCase();

  if (!direct) {
    return "";
  }

  if (/^[A-Z]$/.test(direct)) {
    return direct;
  }

  const choices = normalizeTeacherQuestionChoices(question);
  const matched = choices.find((choice) => {
    const normalizedText = String(choice.text || "").trim().toUpperCase();
    const normalizedValue = String(choice.value || "").trim().toUpperCase();

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
    const normalizedText = String(choice.text || "").trim().toUpperCase();
    const normalizedValue = String(choice.value || "").trim().toUpperCase();

    return normalizedText === normalizedAnswer || normalizedValue === normalizedAnswer;
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
    const normalizedText = String(choice.text || "").trim().toUpperCase();
    const normalizedValue = String(choice.value || "").trim().toUpperCase();

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

function getTeacherSubmissionAnswerByIndex(submission, question, questionIndex) {
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
  const questions = Array.isArray(assignment?.questions) ? assignment.questions : [];

  return questions.map((question, questionIndex) => {
    const answer = getTeacherSubmissionAnswerByIndex(submission, question, questionIndex);
    const studentLabel = normalizeTeacherSelectedLabel(answer, question);
    const correctLabel = normalizeTeacherQuestionCorrectLabel(question);
    const isCorrect = Boolean(studentLabel && correctLabel && studentLabel === correctLabel);
    const choices = normalizeTeacherQuestionChoices(question);
    const studentAnswerText = getTeacherAnswerDisplayText(answer, question);
    const correctChoice = choices.find((choice) => choice.label === correctLabel);
    const correctAnswerText = correctChoice
      ? `${correctChoice.label}. ${correctChoice.text}`
      : correctLabel || "--";

    return {
      questionIndex,
      questionNumber: questionIndex + 1,
      questionText: String(question?.question || question?.text || question?.content || "--").trim() || "--",
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
    username: String(student?.username || student?.name || student?.fullName || "").trim(),
    avatar: String(student?.avatar || student?.photoURL || student?.profilePicture || "").trim(),
  };
}

function normalizeTeacherAssignmentStudentRecord(student, submission = null, profile = null) {
  const normalizedProfile = normalizeTeacherStudentProfile(profile || student);
  const normalizedSubmission = normalizeTeacherAssignmentSubmissionRecord(submission);
  const statusKey = normalizedSubmission
    ? normalizeTeacherSubmissionStatusKey(normalizedSubmission)
    : "pending";

  return {
    id: String(student?.id || student?.studentId || normalizedSubmission?.studentId || "").trim(),
    name:
      normalizedProfile.name ||
      normalizedSubmission?.studentName ||
      String(student?.name || student?.fullName || student?.username || "").trim() ||
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
    ...((Array.isArray(classStudents) ? classStudents : []).map((student) => student?.id)),
    ...((Array.isArray(submissions) ? submissions : []).map((submission) => submission?.studentId)),
  ]);

  return studentIds.length;
}

function getTeacherAssignmentSummaryStats(rows) {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const submittedRows = normalizedRows.filter((row) => row.statusKey === "submitted");
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
  const studentRows = Array.isArray(detail.studentRows) ? detail.studentRows : [];

  if (!assignment) {
    return "";
  }

  if (
    detail.selectedStudentId &&
    studentRows.some((row) => row.id === detail.selectedStudentId)
  ) {
    return detail.selectedStudentId;
  }

  const firstSubmitted = studentRows.find((row) => row.statusKey === "submitted");

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
  const selectedProfile = studentRow?.profile || detail.selectedStudentProfile || null;
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
  const scoreText = studentRow ? getTeacherSubmissionScoreText(studentRow) : "--";
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
  const studentRows = Array.isArray(detail.studentRows) ? detail.studentRows : [];
  const classStudents = Array.isArray(detail.classStudents) ? detail.classStudents : [];
  const submissions = Array.isArray(detail.submissions) ? detail.submissions : [];
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
  const unansweredCount = Math.max(totalStudents - stats.submittedCount - stats.doingCount, 0);
  const topicText = String(
    assignment.topic ||
      assignment.description ||
      assignment.subject ||
      "",
  ).trim();
  const classLabel =
    assignment.className ||
    detail.classInfo?.name ||
    detail.classInfo?.className ||
    assignment.classId ||
    "--";
  const subjectLabel = assignment.subject || "--";
  const dateAssigned = formatAssignmentDate(assignment.createdAt);
  const dueDate = assignment.dueDate ? formatAssignmentDate(assignment.dueDate) : "--";
  const maxScore = 10;
  const averageScore = Number.isFinite(stats.averageScore) ? stats.averageScore.toFixed(1) : "0.0";

  console.log("[TeacherAssignmentDetail]", {
    assignment,
    questions: assignment?.questions,
    submissions,
    students: studentRows,
    classes: classStudents,
  });

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
                          const scoreDisplay = row.statusKey === "submitted"
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
                                        (window.EduKidsProfileService?.getAvatarPathFromProfile
                                          ? window.EduKidsProfileService.getAvatarPathFromProfile({
                                              role: "student",
                                              gender: "male",
                                            })
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
  const studentRows = Array.isArray(detail.studentRows) ? detail.studentRows : [];

  if (!detail.visible || !detail.assignment || !normalizedStudentId) {
    return;
  }

  detail.selectedStudentId = normalizedStudentId;
  detail.loadingStudentId = normalizedStudentId;
  renderTeacherAssignmentDetail();

  const cachedSubmission = detail.submissionByStudentId.get(normalizedStudentId) || null;
  const cachedProfile = detail.profileByStudentId.get(normalizedStudentId) || null;
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
        ? window.EduKidsProfileService.fetchProfileById(normalizedStudentId).catch(() => null)
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

  const selectedSubmission = submission || detail.submissionByStudentId.get(normalizedStudentId) || null;
  const selectedProfile = profile || detail.profileByStudentId.get(normalizedStudentId) || null;
  const existingRow = studentRows.find((row) => row.id === normalizedStudentId) || null;
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
  const rawSubmissionStatus = String(assignment?.submissionStatus || "").trim().toLowerCase();
  const rawStatus = rawSubmissionStatus || String(assignment?.status || "").trim().toLowerCase();

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
  const submissionStatus = String(assignment?.submissionStatus || "").trim().toLowerCase();

  if (submissionStatus) {
    return submissionStatus;
  }

  return String(assignment?.status || "").trim().toLowerCase() || "pending";
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

  if (assignment?.score === null || typeof assignment?.score === "undefined" || assignment?.score === "") {
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
    id: String(assignment.id || assignment.assignmentId || assignment.docId || "").trim(),
    classId: String(assignment.classId || "").trim(),
    title: String(assignment.title || "").trim(),
    description: String(assignment.description || "").trim(),
    dueDate: assignment.dueDate === "" ? "" : assignment.dueDate || "",
    status: String(assignment.status || "").trim().toLowerCase() || "active",
    submissionStatus:
      String(assignment.submissionStatus || "").trim().toLowerCase() || "",
    submittedAt: assignment.submittedAt || "",
    score: assignment.score ?? null,
    correctCount: Number.isFinite(Number(assignment.correctCount)) ? Number(assignment.correctCount) : null,
    wrongCount: Number.isFinite(Number(assignment.wrongCount)) ? Number(assignment.wrongCount) : null,
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
  const rawSubmissionStatus = String(assignment?.submissionStatus || "").trim().toLowerCase();

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
  const rawSubmissionStatus = String(assignment?.submissionStatus || "").trim().toLowerCase();

  if (rawSubmissionStatus !== "graded") {
    return "";
  }

  if (assignment?.score === null || typeof assignment?.score === "undefined" || assignment?.score === "") {
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

  console.log("[EduKids][student-assignment] open detail", normalizedId);

  const assignment =
    currentAssignments.find((item) => item.id === normalizedId) ||
    window.EduKidsCurrentAssignment ||
    null;

  if (!assignment) {
    showToast("Không thể mở chi tiết bài tập.", "error");
    return;
  }

  const previousAssignmentId = String(studentAssignmentDetailState.assignment?.id || "").trim();

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
        .filter((assignment) => assignment && assignment.id)
    : [];

  currentAssignments = normalizedAssignments;

  if (
    !currentAssignmentId ||
    !currentAssignments.some((assignment) => assignment.id === currentAssignmentId)
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

  const studentAssignments = Array.isArray(currentAssignments) ? currentAssignments : [];
  const fromStudentState =
    studentAssignments.find((assignment) => assignment.id === normalizedAssignmentId) ||
    null;

  if (fromStudentState) {
    return fromStudentState;
  }

  const teacherAssignments = Array.isArray(teacherAssignmentSubmissionState.assignments)
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
    String(window.EduKidsCurrentAssignment.id || "").trim() === normalizedAssignmentId
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
      statusValue === "graded" && assignment?.score !== null && typeof assignment?.score !== "undefined"
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
      ? String(assignment.status || "").trim().toLowerCase() || "active"
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
  teacherAssignmentSubmissionState.selectedAssignmentId = normalizedAssignmentId;
  teacherAssignmentSubmissionState.error = "";
  teacherAssignmentSubmissionState.loading = true;
  teacherAssignmentSubmissionState.submissions = [];
  teacherAssignmentSubmissionState.assignments = Array.isArray(teacherAssignmentSubmissionState.assignments) &&
    teacherAssignmentSubmissionState.assignments.length
    ? teacherAssignmentSubmissionState.assignments
    : [detail.assignment];

  setTeacherAssignmentDetailVisibility(true);
  renderTeacherAssignmentDetail();

  try {
    const [submissionSummary, classListResponse] = await Promise.all([
      window.EduKidsAssignmentService?.fetchAssignmentSubmissions
        ? window.EduKidsAssignmentService.fetchAssignmentSubmissions(normalizedAssignmentId).catch(() => [])
        : Promise.resolve([]),
      apiRequestWithAuth("/api/classes/my", { method: "GET" }).catch(() => ({ data: [] })),
    ]);

    if (!detail.visible || detail.requestId !== requestId) {
      return;
    }

    const normalizedSubmissions = Array.isArray(submissionSummary)
      ? submissionSummary
          .map((submission) => normalizeTeacherAssignmentSubmissionRecord(submission))
          .filter((submission) => submission && submission.studentId)
      : [];

    detail.submissions = normalizedSubmissions;
    teacherAssignmentSubmissionState.submissions = normalizedSubmissions;
    teacherAssignmentSubmissionState.error = "";

    const classInfo = Array.isArray(classListResponse?.data)
      ? sortClassroomRecords(classListResponse.data.map(normalizeClassroomRecord).filter(Boolean)).find(
          (classroom) => classroom.id === detail.assignment.classId,
        ) || null
      : null;

    detail.classInfo = classInfo;
    detail.classStudents = getClassroomStudentCards(classInfo);
    const classStudents = Array.isArray(detail.classStudents) ? detail.classStudents : [];
    const submissions = Array.isArray(normalizedSubmissions) ? normalizedSubmissions : [];

    const rosterStudentIds = uniqueClassroomValues([
      ...classStudents.map((student) => student.id),
      ...submissions.map((submission) => submission.studentId),
    ]);

    const profileService = window.EduKidsProfileService;
    const profilePairs = await Promise.all(
      rosterStudentIds.map(async (studentId) => {
        if (profileService?.fetchProfileById) {
          const profile = await profileService.fetchProfileById(studentId).catch(() => null);
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
      const profile = detail.profileByStudentId.get(studentId) || classStudent || null;
      const row = normalizeTeacherAssignmentStudentRecord(
        {
          id: studentId,
          name: classStudent?.name || submission?.studentName || profile?.name || profile?.fullName || profile?.username || studentId,
          username: profile?.username || classStudent?.name || submission?.studentName || "",
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
      const leftRank = left.statusKey === "submitted" ? 0 : left.statusKey === "doing" ? 1 : 2;
      const rightRank = right.statusKey === "submitted" ? 0 : right.statusKey === "doing" ? 1 : 2;

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
  const selectedClassId = String(studentAssignmentClassState.selectedClassId || "").trim();
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

  return query ? `/api/assignments/student?${query}` : "/api/assignments/student";
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
    showToast(
      error.message || "Không thể tải bài tập từ máy chủ.",
      "error",
    );
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
  const questionList = Array.isArray(assignment.questions) ? assignment.questions : [];
  const actionLabel = isReadOnly ? "Xem lại" : "Nộp bài";
  const dueDateText = assignment.dueDate ? formatAssignmentDate(assignment.dueDate) : "--";
  const scoreText =
    assignment.score === null || typeof assignment.score === "undefined" || assignment.score === ""
      ? "--"
      : String(assignment.score);
  const correctCountText =
    Number.isFinite(Number(assignment.correctCount)) && Number.isFinite(Number(assignment.totalQuestions))
      ? `${Number(assignment.correctCount)} / ${Number(assignment.totalQuestions)}`
      : "--";
  const wrongCountText =
    Number.isFinite(Number(assignment.wrongCount))
      ? String(Number(assignment.wrongCount))
      : "--";
  const classLabel =
    assignment.className ||
    studentAssignmentClassState.classes.find((classroom) => classroom.id === assignment.classId)?.name ||
    studentAssignmentClassState.classes.find((classroom) => classroom.id === assignment.classId)?.className ||
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
          ${isReadOnly || Number.isFinite(Number(assignment.score))
            ? `
              <div class="assignment-detail-row"><span>Điểm</span><strong>${escapeHtml(scoreText)}</strong></div>
              <div class="assignment-detail-row"><span>Đúng</span><strong>${escapeHtml(correctCountText)}</strong></div>
              <div class="assignment-detail-row"><span>Sai</span><strong>${escapeHtml(wrongCountText)}</strong></div>
            `
            : ""}
        </div>

        <div class="quiz-question-list ${isReadOnly ? "is-submitted" : ""}">
          ${questionList.length === 0
            ? `
              <div class="quiz-empty">Bài tập này chưa có câu hỏi.</div>
            `
            : questionList
                .map((question, questionIndex) => {
                  const selected = getStudentAssignmentSelectedAnswer(questionIndex);
                  const options = normalizeStudentAssignmentQuestionOptions(question);

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
                .join("")}
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
    const updatedAssignment = markStudentAssignmentAsSubmitted(assignment.id, submissionResult);

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
    name: String(classroom.name || classroom.className || "Chưa đặt tên").trim(),
    className: String(classroom.className || classroom.name || "").trim(),
    classCode: String(classroom.classCode || classroom.code || "").trim(),
    teacherId: String(classroom.teacherId || "").trim(),
    teacherName: String(classroom.teacherName || classroom.teacherUsername || "").trim(),
    students: Array.isArray(classroom.students) ? classroom.students : [],
    studentIds: Array.isArray(classroom.studentIds) ? classroom.studentIds : [],
    members: Array.isArray(classroom.members) ? classroom.members : [],
    studentCount: Number(classroom.studentCount ?? classroom.studentsCount ?? 0) || 0,
    createdAt: classroom.createdAt || "",
    averageScore: classroom.averageScore ?? classroom.average ?? classroom.averagePercent ?? classroom.avgScore ?? "",
    completionRate:
      classroom.completionRate ??
      classroom.completion ??
      classroom.completionPercent ??
      classroom.completedPercent ??
      "",
  };
}

function sortClassroomRecords(classrooms) {
  return [...(Array.isArray(classrooms) ? classrooms : [])].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt || "") || 0;
    const rightTime = Date.parse(right.createdAt || "") || 0;

    return rightTime - leftTime;
  });
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
  return document.querySelector("#student-class-switcher .student-class-switcher-btn");
}

function getSelectedClassroom() {
  return (
    classroomState.classes.find(
      (classroom) => classroom.id === classroomState.selectedClassId,
    ) || classroomState.classes[0] || null
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
      String(student.fullName || student.name || student.username || "").trim() ||
      String(student.userId || student.uid || student.studentId || student.id || "").trim()
    );
  }

  return String(student || "").trim();
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

  const avatar = String(student.avatar || student.photoURL || student.profilePicture || "").trim();

  if (!avatar) {
    return fallbackAvatar;
  }

  if (avatar.startsWith("assets/")) {
    return avatar;
  }

  return `assets/userAvatar/${avatar}`;
}

function getClassroomStudentCards(classroom) {
  const studentIds = Array.isArray(classroom?.students)
    ? classroom.students
    : Array.isArray(classroom?.studentIds)
      ? classroom.studentIds
      : Array.isArray(classroom?.members)
        ? classroom.members
        : [];

  return uniqueClassroomValues(studentIds.map((student) => {
    if (student && typeof student === "object") {
      return JSON.stringify({
        id: String(
          student.id ||
            student.studentId ||
            student.userId ||
            student.uid ||
            "",
        ).trim(),
        avatar: getClassroomStudentAvatarPath(student),
        name: getClassroomStudentDisplayName(student),
      });
    }

    return JSON.stringify({
      id: String(student || "").trim(),
      avatar: "assets/userAvatar/boy.png",
      name: String(student || "").trim(),
    });
  }))
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

function renderClassroomStudentList(classroom) {
  const studentList = getClassroomStudentList();

  if (!studentList) {
    return;
  }

  const studentCards = getClassroomStudentCards(classroom);

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
    nameNode.textContent = classroom.name || classroom.className || "Chưa đặt tên";
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

  renderClassroomStudentList(classroom);
}

function renderClassroomListPanel() {
  const panel = getClassroomListPanel();
  const joinedClassList = getJoinedClassListPanel();
  const classes = classroomState.classes;
  const selectedClassId = classroomState.selectedClassId || classes[0]?.id || "";
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

    if (preferredClassId && classes.some((item) => item.id === preferredClassId)) {
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

  const name = String(
    window.prompt("Nhập tên lớp học") || "",
  ).trim();

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
    await refreshClassroomData(response?.data?.id || response?.data?.classId || "");
  } catch (error) {
    showToast(error.message || "Không thể tạo lớp.", "error");
  }
}

async function handleJoinClassroom() {
  const input = getClassroomJoinInput();
  const classCode = String(input?.value || "").trim().toUpperCase();

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

  const firestore = window.firebase?.app && typeof window.firebase.firestore === "function"
    ? window.firebase.app().firestore()
    : null;

  if (!firestore) {
    showToast("Không thể xóa lớp lúc này.", "error");
    return;
  }

  try {
    await firestore.collection("classes").doc(classId).delete();
    showToast("Đã xóa lớp.", "success");
    classroomState.classes = classroomState.classes.filter((item) => item.id !== classId);
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

      const classroomId = String(classroomButton.dataset.classroomId || "").trim();

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
      (classroom) => classroom.id === studentAssignmentClassState.selectedClassId,
    ) || studentAssignmentClassState.classes[0] || null
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
                const isActive = classroom.id === studentAssignmentClassState.selectedClassId;
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

    if (preferredClassId && classes.some((item) => item.id === preferredClassId)) {
      studentAssignmentClassState.selectedClassId = preferredClassId;
    } else if (
      studentAssignmentClassState.selectedClassId &&
      classes.some((item) => item.id === studentAssignmentClassState.selectedClassId)
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
  const classCode = String(
    window.prompt("Nhập mã lớp") || "",
  )
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
      void submitStudentAssignment(submitForm.querySelector(
        [
          "button[data-assignment-submit]",
          "button[data-action='submit-assignment']",
          "button[data-action='submit-assignment-form']",
          "button.assignment-submit-btn",
          "button.submit-assignment-btn",
          "input[type='submit'][data-assignment-submit]",
        ].join(","),
      ));
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

  if (!Array.isArray(manualAssignmentState.questions) || manualAssignmentState.questions.length === 0) {
    manualAssignmentState.questions = [createManualQuestion(1)];
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
      !classes.some((classroom) => classroom.id === manualAssignmentState.classId)
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

function ensureAssignmentService() {
  return getAssignmentService();
}

function renderManualAssignmentPreviewFromState() {
  syncManualAssignmentPreview();
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
          assignment.id === teacherAssignmentSubmissionState.selectedAssignmentId,
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

  teacherAssignmentSubmissionState.selectedAssignmentId = normalizedAssignmentId;
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
  manualAssignmentFormBound = false;
  renderManualAssignmentShell();
  renderManualQuestionList();
  syncManualAssignmentMethodCards();
  syncManualAssignmentFormFields();
  syncManualAssignmentPreview();

  await loadManualAssignmentClasses();
  syncManualAssignmentFormFields();

  const form = getManualAssignmentForm();

  if (!form || manualAssignmentFormBound) {
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
        (_, index) => !block || index !== Number(block.dataset.questionIndex) - 1,
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
      syncManualAssignmentPreview();
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
    if (assignmentBackButton && studentDetailRoot?.contains(assignmentBackButton)) {
      event.preventDefault();
      closeStudentAssignmentDetail();
      return;
    }

    const teacherBackButton = event.target.closest("[data-teacher-assignment-back]");
    const teacherCloseButton = event.target.closest("[data-teacher-assignment-close]");
    const teacherStudentViewButton = event.target.closest("[data-teacher-student-view]");
    const teacherStudentRow = event.target.closest("[data-teacher-student-row]");

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
      const studentId = String(teacherStudentViewButton.dataset.studentId || "").trim();

      if (studentId) {
        event.preventDefault();
        await selectTeacherAssignmentStudent(studentId);
      }

      return;
    }

    if (teacherStudentRow && teacherDetailRoot?.contains(teacherStudentRow)) {
      const studentId = String(teacherStudentRow.dataset.studentId || "").trim();

      if (studentId) {
        event.preventDefault();
        await selectTeacherAssignmentStudent(studentId);
      }

      return;
    }

    const assignmentOptionButton = event.target.closest(
      "[data-option-label]",
    );

    if (assignmentOptionButton && studentDetailRoot?.contains(assignmentOptionButton)) {
      const selected = String(assignmentOptionButton.dataset.optionLabel || "").trim();
      const questionBlock = assignmentOptionButton.closest("[data-question-block]");
      const questionIndex = Number(
        questionBlock?.dataset.assignmentQuestionIndex || "",
      );

      if (Number.isInteger(questionIndex) && selected && !assignmentOptionButton.disabled) {
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

    const assignmentDeleteButton = event.target.closest("[data-assignment-delete-id]");
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

  bootstrapState.initializedUid = identityKey;
  bootstrapState.currentUser = user;

  bindAppEventsOnce();
  changePage(getDefaultPageForRole(user.role));
  window.EduKidsCurrentUser = user;
  void syncSidebarProfile();
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
  window.openCreateAssignment = openCreateAssignment;
  window.openProfile = openProfile;
  window.openTeacherDashboard = openTeacherDashboard;
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
  bindStudentQuizControlsOnce();
  initializeAuth();
}

void whenDomReady().then(bootstrap);
