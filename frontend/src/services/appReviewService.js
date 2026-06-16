(() => {
  function getFirestore() {
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
      console.warn("Unable to initialize Firestore for app reviews:", error);
      return null;
    }
  }

  function getReviewCollection() {
    const firestore = getFirestore();
    return firestore ? firestore.collection("app_reviews") : null;
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeRole(role) {
    return String(role || "").trim() === "teacher" ? "teacher" : "student";
  }

  function getDefaultAvatarByRole(role) {
    return normalizeRole(role) === "teacher"
      ? "/assets/userAvatar/maleteacher.png"
      : "/assets/userAvatar/boy.png";
  }

  function isAdminAvatar(value) {
    const normalized = normalizeText(value).toLowerCase();
    return (
      normalized.endsWith("/assets/useravatar/admin.png") ||
      normalized.endsWith("assets/useravatar/admin.png") ||
      normalized.includes("admin.png")
    );
  }

  function resolveProfileAvatar(profile) {
    const source = profile && typeof profile === "object" ? profile : {};
    const candidate = normalizeText(
      source.photoURL ||
        source.avatar ||
        source.profileAvatar ||
        source.profilePicture ||
        "",
    );

    if (candidate && !isAdminAvatar(candidate)) {
      return candidate;
    }

    return getDefaultAvatarByRole(source.role);
  }

  function normalizeAvatarValue(value, role) {
    const candidate = normalizeText(value);

    if (!candidate || isAdminAvatar(candidate)) {
      return getDefaultAvatarByRole(role);
    }

    return candidate;
  }

  function getReviewDateMs(createdAt) {
    if (!createdAt) {
      return 0;
    }

    if (typeof createdAt === "number" && Number.isFinite(createdAt)) {
      return createdAt;
    }

    if (createdAt instanceof Date) {
      return createdAt.getTime();
    }

    if (typeof createdAt.toDate === "function") {
      const date = createdAt.toDate();
      return date instanceof Date ? date.getTime() : 0;
    }

    const parsed = new Date(createdAt);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  function normalizeReview(doc) {
    if (!doc || typeof doc !== "object") {
      return null;
    }

    const rating = Number.parseInt(doc.rating, 10);
    const safeRating = Number.isFinite(rating) ? Math.max(0, Math.min(5, rating)) : 0;
    const role = normalizeRole(doc.role);

    return {
      id: normalizeText(doc.id || doc.reviewId),
      userId: normalizeText(doc.userId),
      userName: normalizeText(doc.userName),
      userAvatar: normalizeAvatarValue(doc.userAvatar || doc.avatar, role),
      role,
      rating: safeRating,
      comment: normalizeText(doc.comment),
      createdAt: doc.createdAt || null,
    };
  }

  function buildReviewPayload(profile, rating, comment) {
    const normalizedProfile = profile && typeof profile === "object" ? profile : {};
    const normalizedRating = Number.parseInt(rating, 10);
    const normalizedComment = normalizeText(comment);
    const role = normalizeRole(normalizedProfile.role);
    const userId = normalizeText(
      normalizedProfile.uid || normalizedProfile.userId || normalizedProfile.id,
    );
    const userName = normalizeText(
      normalizedProfile.fullName ||
        normalizedProfile.name ||
        normalizedProfile.username ||
        "Người dùng",
    );
    const userAvatar = resolveProfileAvatar(normalizedProfile);

    if (!userId) {
      throw new Error("Không thể xác định người dùng hiện tại.");
    }

    if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      throw new Error("Vui lòng chọn số sao từ 1 đến 5.");
    }

    if (!normalizedComment) {
      throw new Error("Vui lòng nhập nhận xét.");
    }

    if (normalizedComment.length > 1000) {
      throw new Error("Nhận xét không được vượt quá 1000 ký tự.");
    }

    return {
      userId,
      userName,
      userAvatar,
      role,
      rating: normalizedRating,
      comment: normalizedComment,
    };
  }

  async function submitReview({ profile, rating, comment }) {
    const collection = getReviewCollection();

    if (!collection) {
      throw new Error("Firestore hiện không khả dụng.");
    }

    const payload = buildReviewPayload(profile, rating, comment);
    const docRef = collection.doc();
    const timestamp = window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date();

    await docRef.set({
      id: docRef.id,
      ...payload,
      createdAt: timestamp,
    });

    return normalizeReview({
      id: docRef.id,
      ...payload,
      createdAt: new Date(),
    });
  }

  async function fetchReviews() {
    const collection = getReviewCollection();

    if (!collection) {
      return [];
    }

    const snapshot = await collection.get();
    const reviews = snapshot.docs
      .map((doc) =>
        normalizeReview({
          id: doc.id,
          ...(doc.data() || {}),
        }),
      )
      .filter(Boolean);

    const repairTasks = snapshot.docs
      .map((doc) => {
        const data = doc.data() || {};
        const role = normalizeRole(data.role);
        const normalizedAvatar = normalizeAvatarValue(data.userAvatar || data.avatar, role);
        const needsRepair =
          !data.userAvatar || isAdminAvatar(data.userAvatar) || isAdminAvatar(data.avatar);

        if (!needsRepair) {
          return null;
        }

        return doc.ref.set(
          {
            userAvatar: normalizedAvatar,
            avatar: normalizedAvatar,
          },
          { merge: true },
        );
      })
      .filter(Boolean);

    if (repairTasks.length > 0) {
      await Promise.allSettled(repairTasks);
    }

    reviews.sort((a, b) => getReviewDateMs(b.createdAt) - getReviewDateMs(a.createdAt));
    return reviews;
  }

  async function deleteReview(reviewId) {
    const normalizedId = normalizeText(reviewId);
    const collection = getReviewCollection();

    if (!collection) {
      throw new Error("Firestore hiện không khả dụng.");
    }

    if (!normalizedId) {
      throw new Error("Thiếu mã đánh giá.");
    }

    await collection.doc(normalizedId).delete();
  }

  window.EduKidsAppReviewService = {
    deleteReview,
    fetchReviews,
    getDefaultAvatarByRole,
    getReviewDateMs,
    normalizeReview,
    resolveProfileAvatar,
    submitReview,
  };
})();
