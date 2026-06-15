import { API_BASE_URL } from "../config.js";

(() => {
  function getFirestore() {
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
      const app = window.firebase.app();
      return app.firestore();
    } catch (error) {
      console.warn("Unable to initialize Firestore for profile service:", error);
      return null;
    }
  }

  function request(path, { method = "GET", body } = {}) {
    const headers = {
      "Content-Type": "application/json",
    };

    const token =
      localStorage.getItem("authToken") || localStorage.getItem("token") || "";

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        throw new Error(data.message || `Request failed: ${response.status}`);
      }

      return data;
    });
  }

  function getAvatarPathFromProfile(profile) {
    const avatarValue = String(
      profile?.avatar || profile?.photoURL || profile?.profilePicture || "",
    ).trim();

    if (avatarValue) {
      const avatar = avatarValue;

      if (avatar.startsWith("assets/")) {
        return avatar;
      }

      return `assets/userAvatar/${avatar}`;
    }
    return "";
  }

  async function fetchProfileById(userId) {
    const normalizedUserId = String(userId || "").trim();

    if (!normalizedUserId) {
      return null;
    }

    const firestore = getFirestore();

    if (!firestore) {
      return null;
    }

    const snapshot = await firestore.collection("users").doc(normalizedUserId).get();

    if (!snapshot.exists) {
      return null;
    }

    return normalizeProfile({
      id: snapshot.id,
      uid: snapshot.id,
      ...(snapshot.data() || {}),
    });
  }

  function normalizeProfile(profile) {
    if (!profile || typeof profile !== "object") {
      return null;
    }

    const stats = profile.stats && typeof profile.stats === "object" ? { ...profile.stats } : {};
    const classTags = Array.isArray(profile.classTags) ? profile.classTags : [];
    const classTagNames = Array.isArray(profile.classTagNames) ? profile.classTagNames : [];

    return {
      ...profile,
      uid: profile.uid || profile.userId || profile.id || "",
      userCode: profile.userCode || "",
      name: profile.name || profile.fullName || "",
      fullName: profile.fullName || profile.name || "",
      username: profile.username || "",
      gender: profile.gender || "",
      role: profile.role || "",
      avatar: getAvatarPathFromProfile(profile),
      school: profile.school || "",
      className: profile.className || "",
      hobby: profile.hobby || "",
      dream: profile.dream || "",
      phone: profile.phone || "",
      address: profile.address || "",
      note: profile.note || "",
      createdAt: profile.createdAt || "",
      updatedAt: profile.updatedAt || profile.createdAt || "",
      stats,
      subjects: Array.isArray(profile.subjects) ? profile.subjects : [],
      classTags,
      classTagNames,
      activityLogs: Array.isArray(profile.activityLogs) ? profile.activityLogs : [],
    };
  }

  async function fetchCurrentProfile() {
    const data = await request("/api/users/me");
    return normalizeProfile(data.data);
  }

  async function updateCurrentProfile(payload) {
    const data = await request("/api/users/me", {
      method: "PUT",
      body: payload,
    });

    return normalizeProfile(data.data);
  }

  async function fetchMyClasses() {
    const data = await request("/api/classes/my");
    return Array.isArray(data.data) ? data.data : [];
  }

  window.EduKidsProfileService = {
    fetchCurrentProfile,
    fetchMyClasses,
    fetchProfileById,
    getAvatarPathFromProfile,
    normalizeProfile,
    updateCurrentProfile,
  };
})();
