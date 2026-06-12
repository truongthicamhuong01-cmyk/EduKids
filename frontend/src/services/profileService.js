import { API_BASE_URL } from "../config.js";

(() => {
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
    if (profile?.avatar) {
      const avatar = String(profile.avatar).trim();

      if (avatar.startsWith("assets/")) {
        return avatar;
      }

      return `assets/userAvatar/${avatar}`;
    }

    const role = profile?.role === "teacher" ? "teacher" : "student";
    const gender = profile?.gender === "female" ? "female" : "male";

    if (role === "teacher") {
      return `assets/userAvatar/${gender === "female" ? "femaleteacher.png" : "maleteacher.png"}`;
    }

    return `assets/userAvatar/${gender === "female" ? "girl.png" : "boy.png"}`;
  }

  function normalizeProfile(profile) {
    if (!profile || typeof profile !== "object") {
      return null;
    }

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
      stats: profile.stats || {
        level: 1,
        streak: 0,
        completedQuestions: 0,
        studyMinutes: 0,
      },
      subjects: Array.isArray(profile.subjects) ? profile.subjects : [],
      classTags: Array.isArray(profile.classTags) ? profile.classTags : [],
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

  window.EduKidsProfileService = {
    fetchCurrentProfile,
    getAvatarPathFromProfile,
    normalizeProfile,
    updateCurrentProfile,
  };
})();
