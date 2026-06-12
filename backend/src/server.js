require("dotenv").config();

const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const classRoutes = require("./routes/classRoutes");
const quizRoutes = require("./routes/quizRoutes");
const userRoutes = require("./routes/userRoutes");
const verifyToken = require("./middleware/verifyToken");
const { db } = require("./firebase");

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

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "EduKids API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/users", userRoutes);

app.get("/api/me", verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    data: req.user,
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

app.listen(port, () => {
  console.log(`EduKids API running on port ${port}`);
  void dumpFirestoreStructure();
});

async function dumpFirestoreCollection(name) {
  const snapshot = await db.collection(name).get();
  console.log(`[EduKids][firestore] ${name}: count=${snapshot.size}`);

  snapshot.docs.forEach((doc) => {
    const data = doc.data() || {};

    console.log(`[EduKids][firestore] ${name}/${doc.id}`, JSON.stringify({
      id: doc.id,
      classId: data.classId || "",
      teacherId: data.teacherId || "",
      studentIds: data.studentIds || data.students || data.members || [],
      assignmentIds: data.assignmentIds || [],
      createdAt: data.createdAt || "",
      updatedAt: data.updatedAt || "",
      ...data,
    }));
  });
}

async function dumpFirestoreStructure() {
  try {
    await dumpFirestoreCollection("classes");
    await dumpFirestoreCollection("assignments");
    await dumpFirestoreCollection("users");
  } catch (error) {
    console.warn("[EduKids][firestore] Unable to dump firestore structure:", error);
  }
}
