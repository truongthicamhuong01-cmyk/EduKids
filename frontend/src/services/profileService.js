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

    const role = profile?.role === "teacher" ? "teacher" : "student";
    const gender = profile?.gender === "female" ? "female" : "male";

    if (role === "teacher") {
      return `assets/userAvatar/${gender === "female" ? "femaleteacher.png" : "maleteacher.png"}`;
    }

    return `assets/userAvatar/${gender === "female" ? "girl.png" : "boy.png"}`;
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
    fetchProfileById,
    getAvatarPathFromProfile,
    normalizeProfile,
    updateCurrentProfile,
  };
})();
