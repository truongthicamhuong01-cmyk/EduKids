require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const classRoutes = require("./routes/classRoutes");
const coachRoutes = require("./routes/coachRoutes");
const battleSessionRoutes = require("./routes/battleSessionRoutes");
const learningPathRoutes = require("./routes/learningPathRoutes");
const petRoutes = require("./routes/petRoutes");
const shopRoutes = require("./routes/shopRoutes");
const quizRoutes = require("./routes/quizRoutes");
const userRoutes = require("./routes/userRoutes");
const verifyToken = require("./middleware/verifyToken");
const { db } = require("./firebase");
const { buildErrorResponse } = require("./utils/petResponse");

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  req.requestId = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "EduKids API is running",
  });
});

app.get("/api/ping", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is awake",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/battle-sessions", battleSessionRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/coach", coachRoutes);
app.use("/learning-path", learningPathRoutes);
app.use("/api/learning-path", learningPathRoutes);
app.use("/api/pet", petRoutes);
app.use("/api/shop", shopRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/users", userRoutes);

app.get("/api/me", verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    data: req.user,
  });
});

app.use((req, res) => {
  const { payload } = buildErrorResponse({
    statusCode: 404,
    errorCode: "ROUTE_NOT_FOUND",
    message: "Route not found",
    details: {
      path: req.originalUrl,
    },
    requestId: req.requestId || req.headers["x-request-id"] || "",
  });

  return res.status(404).json(payload);
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const { payload } = buildErrorResponse({
    statusCode,
    errorCode: err.errorCode || "INTERNAL_ERROR",
    message: err.message || "Internal server error",
    details: err.details || null,
    requestId: req.requestId || req.headers["x-request-id"] || "",
  });

  return res.status(statusCode).json(payload);
});

app.listen(port, () => {
  console.log(`EduKids API running on port ${port}`);
  dumpFirestoreStructure();
});

async function dumpFirestoreCollection(name) {
  const snapshot = await db.collection(name).get();
  console.log(`[EduKids][firestore] ${name}: count=${snapshot.size}`);

  snapshot.docs.forEach((doc) => {
    const data = doc.data() || {};

    console.log(
      `[EduKids][firestore] ${name}/${doc.id}`,
      JSON.stringify({
        id: doc.id,
        classId: data.classId || "",
        teacherId: data.teacherId || "",
        studentIds: data.studentIds || data.students || data.members || [],
        assignmentIds: data.assignmentIds || [],
        createdAt: data.createdAt || "",
        updatedAt: data.updatedAt || "",
        ...data,
      }),
    );
  });
}

async function dumpFirestoreStructure() {
  try {
    await dumpFirestoreCollection("classes");
    await dumpFirestoreCollection("assignments");
    await dumpFirestoreCollection("users");
  } catch (error) {
    console.warn(
      "[EduKids][firestore] Unable to dump firestore structure:",
      error,
    );
  }
}
