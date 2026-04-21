// ===== BIẾN TOÀN CỤC =====
// Streak: số ngày học liên tiếp
let streak = 0;
let lastStudy = ""; // Ngày học gần nhất (để tính streak)

// ===== KHỞI TẠO FIREBASE =====
// Firebase config để kết nối với Firestore database
const firebaseConfig = {
  apiKey: "AIzaSyD-0_f1wEUCNRj4DwDBkMHhzVVYaueuYdM",
  authDomain: "edukids-fd099.firebaseapp.com",
  projectId: "edukids-fd099",
  storageBucket: "edukids-fd099.firebasestorage.app",
  messagingSenderId: "747531295565",
  appId: "1:747531295565:web:f2c0c376063c58dffa3504",
  measurementId: "G-WW6K9MXN49",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Biến lưu trữ dữ liệu người dùng và trạng thái app
let intro,
  app,
  todoInput,
  todoList,
  minutesInput,
  timer,
  progress,
  result,
  grade,
  subject,
  quiz,
  historyText,
  levelText,
  expText,
  totalExpText,
  streakText,
  mascotGuideModal;
let wrongQuestions = []; // Mảng lưu câu hỏi trả lời sai để luyện lại
let isRetryMode = false; // Cờ kiểm tra có đang luyện lại không
let userRole = "student"; // Vai trò: student hoặc teacher
let teacherAssignments = []; // Danh sách bài tập của giáo viên

// Biến cho bài tập hiện tại (khi học sinh làm bài theo mã)
let currentAssignmentCode = ""; // Mã bài tập đang làm
let currentAssignmentTeacher = ""; // Tên giáo viên tạo bài
let currentAssignmentTeacherId = ""; // ID giáo viên tạo bài

// ===== HÀM HỖ TRỢ =====
// Hàm trả về tên môn học bằng tiếng Việt
function getSubjectLabel(subject) {
  if (subject === "math") return "Toán";
  if (subject === "english") return "Tiếng Anh";
  return subject || "Không rõ";
}

function normalizeStudyDate(dateValue) {
  if (!dateValue) return null;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  date.setHours(0, 0, 0, 0);
  return date;
}

function getDayDiff(fromDate, toDate) {
  const start = normalizeStudyDate(fromDate);
  const end = normalizeStudyDate(toDate);

  if (!start || !end) return null;

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end - start) / msPerDay);
}

// ===== HỆ THỐNG LEVEL =====
// Level càng cao cần càng nhiều EXP (cấp số nhân)
// Tính level dựa trên tổng EXP (giải phương trình bậc 2)
function calculateLevel(exp) {
  // Đảm bảo exp không âm
  exp = Math.max(0, exp);

  // Giải phương trình bậc 2: n*(n+1)/2 * 100 = exp
  // n ≈ (-1 + sqrt(1 + 8*exp/100))/2
  if (exp <= 0) return 0;
  const discriminant = 1 + (8 * exp) / 100;
  const level = Math.floor((-1 + Math.sqrt(discriminant)) / 2);
  return Math.max(0, level); // Đảm bảo level không âm
}

// Tính tổng EXP cần để đạt level nhất định
function getExpForLevel(level) {
  // Tổng EXP cần để đạt level: sum_{i=1 to level} i*100 = 100 * level*(level+1)/2
  level = Math.max(0, Math.floor(level));
  return (100 * level * (level + 1)) / 2;
}

// Tính EXP cần cho level tiếp theo
function getExpForNextLevel(currentLevel) {
  // Tổng EXP cần cho level tiếp theo
  return getExpForLevel(currentLevel + 1);
}

// ===== PHẦN INTRO (MÀN HÌNH CHÀO) =====
// Hàm bắt đầu app sau khi đăng nhập
async function startApp() {
  let user = localStorage.getItem("user");

  if (!user) {
    alert("❗ Bạn cần đăng nhập trước!");
    openAuth();
    return;
  }

  let intro = document.getElementById("intro");
  let app = document.getElementById("app");

  intro.classList.add("hidden");
  app.classList.remove("hidden");
  await loadUserData();
}

// ===== PHẦN QUIZ =====
let quizData = []; // Mảng chứa dữ liệu câu hỏi hiện tại
let exp = 0; // Điểm kinh nghiệm của người dùng

// Hàm sinh số ngẫu nhiên
function rand(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

// Hàm xáo trộn mảng
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
// Tạo mã bài tập duy nhất (BT-xxxxxx)
async function generateCode() {
  let code;
  let exists = true;

  while (exists) {
    code = "BT-" + Math.random().toString(36).substring(2, 8).toUpperCase();

    let doc = await db.collection("assignments").doc(code).get();
    exists = doc.exists;
  }

  return code;
}

// Hàm để giáo viên tạo mã bài tập từ quiz đang có
async function shareAssignment() {
  if (quizData.length === 0) {
    alert("Hãy tạo bài tập trước khi chia sẻ!");
    return;
  }

  const assignmentCode = await generateCode();
  const user = localStorage.getItem("user");

  try {
    await db.collection("assignments").doc(assignmentCode).set({
      teacher: user,
      subject: subject.value,
      questions: quizData,
      createdAt: new Date().toISOString(),
    });

    // Hiển thị mã cho giáo viên
    alert("🎉 Đã lưu vào kho! Mã bài tập của bạn là: " + assignmentCode);
    console.log("Mã bài tập mới:", assignmentCode);
  } catch (e) {
    console.error(e);
    alert("Lỗi khi lưu mã bài tập!");
  }
}

// Hàm học sinh tải bài tập từ mã
async function loadAssignment() {
  const code = document
    .getElementById("assignmentInput")
    .value.trim()
    .toUpperCase();
  if (!code) return;

  try {
    const doc = await db.collection("assignments").doc(code).get();

    if (doc.exists) {
      const data = doc.data();
      quizData = data.questions; // Gán dữ liệu câu hỏi từ mã vào quizData
      currentAssignmentCode = code;
      currentAssignmentTeacher = data.teacherName || data.teacher;
      currentAssignmentTeacherId = data.teacherId || data.teacher;

      let infoBox = document.getElementById("assignmentInfo");

      infoBox.style.display = "block";

      infoBox.innerHTML = `
  <h3>📘 Thông tin bài tập</h3>
  <p>🏷️ Tên bài tập: <b>${data.title || data.assignmentName || "Không có tên"}</b></p>
  <p>📚 Môn: <b>${getSubjectLabel(data.subject)}</b></p>
  <p>👨‍🏫 Giáo viên: <b>${currentAssignmentTeacher || data.teacher}</b></p>
  <p>🏫 Lớp: <b>${data.grade || "Không rõ"}</b></p>
  <p>📝 Số câu: <b>${data.questions.length}</b></p>
`;

      // Render lại giao diện để học sinh làm
      render();
      updateProgress();

      // Scroll tới câu hỏi đầu tiên
      setTimeout(() => {
        const firstQuestion = document.querySelector("#quiz .question");
        if (firstQuestion) {
          firstQuestion.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    } else {
      alert("❌ Mã bài tập không tồn tại!");
    }
  } catch (e) {
    console.error(e);
    alert("Lỗi kết nối khi tìm mã!");
  }
}

// Hiển thị danh sách bài tập của giáo viên
async function showMyAssignments() {
  await loadTeacherAssignments();
}

// Tải danh sách bài tập của giáo viên từ Firebase
async function loadTeacherAssignments() {
  const user = localStorage.getItem("user");
  const snapshot = await db
    .collection("assignments")
    .where("teacherId", "==", user)
    .get();

  teacherAssignments = [];
  let html = "<h3>Kho mã bài tập của bạn:</h3>";

  snapshot.forEach((doc) => {
    const data = doc.data();
    teacherAssignments.push({ id: doc.id, ...data });
  });

  if (teacherAssignments.length === 0) {
    html += "<p>Chưa có bài tập nào.</p>";
    document.getElementById("assignmentList").innerHTML = html;
    document.getElementById("assignmentDetails").innerHTML = "";
    document.getElementById("studentScoreSelection").style.display = "none";
    document.getElementById("studentScores").innerHTML = "";
    return;
  }

  html += `<div style="display: grid; gap: 10px;">`;
  teacherAssignments.forEach((assignment) => {
    html += `
      <div style="padding: 12px; border-radius: 16px; background: #eef2ff; border: 1px solid #c7d2fe;">
        <strong>${assignment.id}</strong>
        <p style="margin: 6px 0;">Tên: ${assignment.title || assignment.assignmentName || "Chưa đặt tên"}</p>
        <p style="margin: 6px 0;">Môn: ${getSubjectLabel(assignment.subject)} • Lớp: ${assignment.grade || "?"} • ${assignment.questions.length} câu</p>
        <button onclick="viewTeacherAssignment('${assignment.id}')" style="width: auto; padding: 8px 14px; font-size: 14px;">
          Xem bài tập
        </button>
      </div>
    `;
  });
  html += `</div>`;

  document.getElementById("assignmentList").innerHTML = html;
  document.getElementById("studentScoreSelection").style.display = "none";
  document.getElementById("studentScores").innerHTML = "";
  document.getElementById("assignmentDetails").innerHTML = "";
}

// Xem chi tiết bài tập của giáo viên
function viewTeacherAssignment(code) {
  const assignment = teacherAssignments.find((item) => item.id === code);
  const detailsBox = document.getElementById("assignmentDetails");

  if (!assignment) {
    detailsBox.innerHTML = "<p>Không tìm thấy bài tập.</p>";
    return;
  }

  let html = `
    <h4>Chi tiết bài tập ${assignment.id}</h4>
    <p>Tên bài tập: <strong>${assignment.title || assignment.assignmentName || "Không có tên"}</strong></p>
    <p>Môn: <strong>${getSubjectLabel(assignment.subject)}</strong></p>
    <p>Lớp: <strong>${assignment.grade || "Không rõ"}</strong></p>
    <p>Số câu: <strong>${assignment.questions.length}</strong></p>
    <div style="margin-top: 10px; max-height: 220px; overflow-y: auto; padding: 10px; background: #f8fafc; border-radius: 14px; border: 1px solid #dbeafe;">
  `;

  assignment.questions.forEach((q, idx) => {
    html += `
      <div style="margin-bottom: 12px;">
        <div><strong>${idx + 1}. ${q.q}</strong></div>
        <div style="margin-top: 6px;">Đáp án đúng: <strong>${q.correct}</strong></div>
      </div>
    `;
  });

  html += `</div>`;
  detailsBox.innerHTML = html;
}

// Hiển thị điểm số học sinh
async function showStudentScores() {
  await loadTeacherAssignments();
  if (teacherAssignments.length === 0) {
    document.getElementById("studentScores").innerHTML = "";
    return;
  }

  // Ẩn kho mã bài tập
  document.getElementById("assignmentList").innerHTML = "";
  document.getElementById("assignmentDetails").innerHTML = "";

  const select = document.getElementById("assignmentFilterSelect");
  select.innerHTML = "";
  teacherAssignments.forEach((assignment) => {
    const option = document.createElement("option");
    option.value = assignment.id;
    option.innerText = `${assignment.id} - ${assignment.title || assignment.assignmentName || "Chưa đặt tên"} (${getSubjectLabel(assignment.subject)})`;
    select.appendChild(option);
  });

  document.getElementById("studentScoreSelection").style.display = "block";
  showStudentScoresByAssignment();
}

// Hiển thị điểm số học sinh theo bài tập cụ thể
async function showStudentScoresByAssignment() {
  const assignmentCode = document.getElementById(
    "assignmentFilterSelect",
  ).value;
  const scoresBox = document.getElementById("studentScores");

  if (!assignmentCode) {
    scoresBox.innerHTML = "Chưa chọn bài tập.";
    return;
  }

  // Tìm bài tập để lấy số câu hỏi
  const assignment = teacherAssignments.find((a) => a.id === assignmentCode);
  const totalQuestions = assignment ? assignment.questions.length : 10;

  scoresBox.innerHTML = "Đang tải điểm học sinh...";

  try {
    const snapshot = await db.collection("users").get();
    let rows = "";

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.role && data.role !== "student") return;

      const studentAttempts = (data.history || []).filter(
        (item) => item.assignmentCode === assignmentCode,
      );
      if (studentAttempts.length === 0) return;

      const lastScore = studentAttempts.slice(-1)[0];
      const attemptsText =
        studentAttempts.length > 1 ? `${studentAttempts.length} lần` : "1 lần";

      rows += `
        <tr>
          <td>${doc.id}</td>
          <td>${data.exp || 0}</td>
          <td>${data.streak || 0}</td>
          <td>${lastScore.score}/${totalQuestions}</td>
          <td>${attemptsText}</td>
        </tr>
      `;
    });

    if (!rows) {
      scoresBox.innerHTML = `
        <h3>📊 Điểm học sinh</h3>
        <p>Chưa có học sinh nào làm bài tập ${assignmentCode}.</p>
      `;
      return;
    }

    scoresBox.innerHTML = `
      <h3>📊 Điểm học sinh - Bài tập ${assignmentCode}</h3>
      <div class="student-score-table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Học sinh</th>
              <th>EXP</th>
              <th>Streak</th>
              <th>Điểm</th>
              <th>Lần làm</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    console.error(e);
    scoresBox.innerHTML = "Không thể tải điểm học sinh.";
  }
}

// ===== HÀM MODAL GIÁO VIÊN =====
// 1. Đóng/Mở cửa sổ tạo bài tập
function openTeacherModal() {
  document.getElementById("teacherModal").style.display = "block";
}

function closeTeacherModal() {
  document.getElementById("teacherModal").style.display = "none";

  document.getElementById("previewBox").style.display = "none";
  document.getElementById("previewBox").innerHTML = "";
  document.getElementById("parsePreview").innerHTML = "";
  document.getElementById("codeBox").style.display = "none";
}

// Xem trước bài tập thủ công
function previewManual() {
  const questions = parseManualInput();
  const box = document.getElementById("previewBox");

  if (!questions) {
    box.style.display = "none";
    return;
  }

  box.style.display = "block";
  box.innerHTML = "";

  questions.forEach((q, i) => {
    let div = document.createElement("div");
    div.style.marginBottom = "10px";

    let html = `<b>${i + 1}. ${q.q}</b><br/>`;

    q.opts.forEach((o) => {
      let isCorrect = o === q.correct;

      html += `
        <div style="
          padding:5px;
          border-radius:6px;
          margin-top:4px;
          background:${isCorrect ? "#bbf7d0" : "#fef9c3"};
        ">
          ${o} ${isCorrect ? "✅" : ""}
        </div>
      `;
    });

    div.innerHTML = html;
    box.appendChild(div);
  });
}

// Hàm chuyển văn bản thô thành mảng câu hỏi
function parseManualInput() {
  const question = document.getElementById("questionText").value.trim();
  const correct = document.getElementById("optionCorrect").value.trim();
  const wrong1 = document.getElementById("optionWrong1").value.trim();
  const wrong2 = document.getElementById("optionWrong2").value.trim();
  const wrong3 = document.getElementById("optionWrong3").value.trim();
  const previewArea = document.getElementById("parsePreview");

  if (!question || !correct || !wrong1 || !wrong2 || !wrong3) {
    alert("Vui lòng nhập đầy đủ câu hỏi và 4 lựa chọn.");
    return null;
  }

  let tempQuiz = [
    {
      q: question,
      correct: correct,
      opts: shuffle([correct, wrong1, wrong2, wrong3]),
    },
  ];

  previewArea.style.display = "block";
  previewArea.innerHTML = `✅ Đã tạo 1 câu hỏi với 4 lựa chọn.`;
  return tempQuiz;
}

// Hàm lưu bài tập thủ công vào Firebase
async function saveManualToCloud() {
  const gvName = document.getElementById("gvName").value.trim();
  const gvTitle = document.getElementById("gvTitle").value.trim();
  const gvGrade = document.getElementById("gvGrade").value;
  const questions = parseManualInput(); // Lấy dữ liệu đã xử lý
  const gvSubject = document.getElementById("gvSubject").value;

  if (!gvName) {
    alert("Vui lòng nhập tên giáo viên!");
    return;
  }

  if (!gvTitle) {
    alert("Vui lòng đặt tên bài tập!");
    return;
  }

  if (!questions) return;

  const assignmentCode = await generateCode();

  try {
    await db
      .collection("assignments")
      .doc(assignmentCode)
      .set({
        teacher: gvName,
        teacherId: localStorage.getItem("user"),
        teacherName: gvName,
        title: gvTitle,
        grade: gvGrade,
        subject: gvSubject,
        questions: questions,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

    document.getElementById("assignmentCodeText").innerText = assignmentCode;
    document.getElementById("codeBox").style.display = "block";

    // Reset form
    document.getElementById("questionText").value = "";
    document.getElementById("optionCorrect").value = "";
    document.getElementById("optionWrong1").value = "";
    document.getElementById("optionWrong2").value = "";
    document.getElementById("optionWrong3").value = "";
  } catch (e) {
    console.error(e);
    alert("Lỗi khi kết nối Firebase!");
  }
}

// Sao chép mã bài tập vào clipboard
function copyCode() {
  const code = document.getElementById("assignmentCodeText").innerText;

  navigator.clipboard
    .writeText(code)
    .then(() => {
      alert("📋 Đã copy mã: " + code);
    })
    .catch(() => {
      alert("❌ Không copy được!");
    });
}

// ===== AI QUIZ =====
// Tạo quiz bằng AI (Gemini)
async function genAIQuiz(subjectType = "math") {
  try {
    let level = grade.value; // lấy lớp
    let promptText;

    if (subjectType === "english") {
      if (level == "1") {
        promptText = `Tạo 10 câu hỏi trắc nghiệm tiếng Anh đơn giản cho học sinh lớp 1-2.

YÊU CẦU:
- Chủ đề: từ vựng cơ bản về con vật, đồ vật, màu sắc, chào hỏi
- Dạng câu hỏi: chọn nghĩa đúng hoặc chọn từ tiếng Anh đúng, điền từ vào chỗ trống đơn giản
- Mỗi câu có: question, options (4 đáp án), correct_answer
- correct_answer phải nằm trong options
- KHÔNG markdown
- KHÔNG \`\`\`json
- CHỈ JSON
- options phải là string
- correct_answer phải là string
`;
      } else {
        promptText = `Tạo 10 câu hỏi trắc nghiệm tiếng Anh cho học sinh lớp 3-5.

YÊU CẦU:
- Chủ đề: từ vựng trường học, gia đình, nghề nghiệp, đồ ăn, câu giao tiếp cơ bản
- Dạng câu hỏi: chọn nghĩa đúng, chọn từ đúng, hoặc điền từ đơn giản theo ngữ cảnh ngắn
- Mỗi câu có: question, options (4 đáp án), correct_answer
- correct_answer phải nằm trong options
- KHÔNG markdown
- KHÔNG \`\`\`json
- CHỈ JSON
- options phải là string
- correct_answer phải là string
`;
      }
    } else if (level == "1") {
      // Lớp 1-2: toán cơ bản
      promptText = `Tạo 10 câu hỏi trắc nghiệm toán đơn giản cho học sinh lớp 1-2.

YÊU CẦU:
- Chủ đề: cộng, trừ, nhân cơ bản (số nhỏ hơn 20), hình học cơ bản (hình vuông, hình tròn, hình tam giác)
- Mỗi câu có: question, options (4 đáp án), correct_answer
- correct_answer phải nằm trong options
- KHÔNG markdown
- KHÔNG \`\`\`json
- CHỈ JSON
- options phải là string
- correct_answer phải là string
`;
    } else {
      // Lớp 3-5: toán nâng cao
      promptText = `Tạo 10 câu hỏi trắc nghiệm toán cho học sinh lớp 3-5.

YÊU CẦU:
- Chủ đề: nhân, chia, phân số, hình học cơ bản, bài toán có lời, tìm x đơn giản 
- Mỗi câu có: question, options (4 đáp án), correct_answer
- correct_answer phải nằm trong options
- KHÔNG markdown
- KHÔNG \`\`\`json
- CHỈ JSON
- options phải là string
- correct_answer phải là string
`;
    }

    let res = await fetch("/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: promptText,
      }),
    });

    let data = await res.json();

    if (!data.text) {
      console.log("❌ AI LỖI", data);
      return subjectType === "english" ? genEng() : genMath();
    }

    let text = data.text;

    // CLEAN
    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    // CẮT JSON CHUẨN
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return subjectType === "english" ? genEng() : genMath();

    let quiz;

    try {
      quiz = JSON.parse(match[0]);
    } catch (e) {
      console.log("❌ JSON lỗi:", text);
      return subjectType === "english" ? genEng() : genMath();
    }

    // FORMAT + VALIDATE
    quiz = quiz.map((q) => ({
      q: q.question,
      correct: String(q.correct_answer).trim(),
      opts: q.options.map((o) => String(o).trim()),
    }));

    console.log("✅ AI quiz generated:", quiz.length, "questions");
    return quiz;
  } catch (e) {
    console.error(e);
    return subjectType === "english" ? genEng() : genMath();
  }
}

async function callGeminiWithRetry(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.message.includes("503")) {
        await new Promise((r) => setTimeout(r, 2000 * (i + 1))); // tăng dần
      } else {
        throw err;
      }
    }
  }
  throw new Error("Gemini quá tải, thử lại sau");
}

// Tạo quiz toán thủ công (fallback khi AI lỗi)
function genMath() {
  let res = [];
  let level = grade.value; // lấy lớp

  let max = 10;
  if (level == "3") max = 100; // lớp 3-5 khó hơn
  if (level == "3") {
    // AI thích nghi theo lịch sử
    if (history.length > 0) {
      let last = history[history.length - 1].score;

      if (last >= 8) max = 100;
      else if (last >= 5) max = 50;
    }
  }

  while (res.length < 10) {
    let a = rand(1, max);
    let b = rand(1, max);

    let type = rand(1, 2);
    let q, c;

    if (type == 1) {
      q = `🐱 ${a} + ${b} = ?`;
      c = a + b;
    } else {
      q = `🐶 ${a} × ${b} = ?`;
      c = a * b;
    }

    res.push({
      q,
      correct: c,
      opts: shuffle([c, c + 1, c - 1, c + 2]),
    });
  }

  return res;
}

// Tạo quiz tiếng Anh thủ công (fallback khi AI lỗi)
function genEng() {
  let level = grade.value;

  let easy = [
    ["cat", "con mèo"],
    ["dog", "con chó"],
    ["apple", "quả táo"],
    ["car", "xe"],
    ["table", "cái bàn"],
    ["chair", "cái ghế"],
    ["mango", "quả xoài"],
    ["hello", "xin chào"],
    ["water", "nước"],
    ["fire", "lửa"],
  ];

  let hard = [
    ["teacher", "giáo viên"],
    ["school", "trường học"],
    ["beautiful", "đẹp"],
    ["library", "thư viện"],
    ["hospital", "bệnh viện"],
    ["restaurant", "nhà hàng"],
    ["difficult", "khó"],
    ["important", "quan trọng"],
    ["elephant", "con voi"],
    ["friend", "bạn bè"],
  ];

  let data = level == "1" ? easy : easy.concat(hard);

  return data.map((x, i) => {
    // tạo 3 đáp án sai
    let wrong = data
      .filter((_, idx) => idx !== i)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    let question, correct, options;

    if (Math.random() > 0.5) {
      // 👉 Anh → Việt
      question = `🌈 " ${x[0]} " nghĩa là gì?`;
      correct = x[1];
      options = shuffle([x[1], ...wrong.map((w) => w[1])]);
    } else {
      // 👉 Việt → Anh
      question = `👉 Từ nào nghĩa là " ${x[1]} " ?`;
      correct = x[0];
      options = shuffle([x[0], ...wrong.map((w) => w[0])]);
    }

    return {
      q: question,
      correct: correct,
      opts: options,
    };
  });
}

// Luyện lại các câu trả lời sai
function retryWrong() {
  if (!wrongQuestions || wrongQuestions.length === 0) {
    alert("Không có lỗi sai!");
    return;
  }

  isRetryMode = true;

  // clone sâu tránh bị mất dữ liệu
  quizData = JSON.parse(JSON.stringify(wrongQuestions));

  render();
  updateProgress();
  // Scroll tới câu hỏi đầu tiên
  setTimeout(() => {
    const firstQuestion = document.querySelector("#quiz .question");
    if (firstQuestion) {
      firstQuestion.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 100);
}

// Bắt đầu làm quiz
async function startQuiz() {
  isRetryMode = false;

  const subjectType = subject.value;
  console.log("Starting AI quiz:", subjectType);
  quizData = await genAIQuiz(subjectType);
  console.log("Quiz data set:", quizData.length, "questions");

  render();
  updateProgress();
  // Scroll tới câu hỏi đầu tiên
  setTimeout(() => {
    const firstQuestion = document.querySelector("#quiz .question");
    if (firstQuestion) {
      firstQuestion.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 100);
}

// Render giao diện quiz
let history = []; // Lịch sử làm bài

function render() {
  quiz.innerHTML = "";

  quizData.forEach((q, i) => {
    let div = document.createElement("div");

    // thêm class "question" để submit xử lý
    div.className = "card question";

    div.innerHTML = `<p>${i + 1}. ${q.q}</p>`;

    q.opts.forEach((o) => {
      let btn = document.createElement("div");
      btn.className = "option";
      btn.innerText = o;

      btn.onclick = () => {
        // lưu đáp án user
        q.user = o;

        updateProgress();

        // ❗ xóa selected của các option khác
        div
          .querySelectorAll(".option")
          .forEach((x) => x.classList.remove("selected"));

        // ✅ thêm selected cho option hiện tại
        btn.classList.add("selected");

        // 🔊 phát âm nếu là tiếng Anh
        if (/^[a-zA-Z ]+$/.test(o)) {
          speak(o);
        }
      };

      div.appendChild(btn);
    });

    quiz.appendChild(div);
  });
}

// Nộp bài và chấm điểm
function submitQuiz() {
  let s = 0;
  wrongQuestions = [];

  // ❗ kiểm tra đã làm hết chưa
  for (let q of quizData) {
    if (!q.user) {
      alert("❗ Bạn chưa làm hết!");
      return;
    }
  }

  // ✅ chấm điểm
  for (let q of quizData) {
    if (String(q.user).trim() === String(q.correct).trim()) s++;
    else wrongQuestions.push(q);
  }

  result.innerText = `🔥 ${s}/${quizData.length}`;
  updateAI(s);

  // 🔥 HIỂN THỊ ĐÚNG SAI + KHÓA CLICK
  document.querySelectorAll(".question").forEach((qDiv, i) => {
    let q = quizData[i];
    let options = qDiv.querySelectorAll(".option");

    options.forEach((opt) => {
      let text = opt.innerText;

      // ✅ đáp án đúng → xanh
      if (String(text).trim() === String(q.correct).trim()) {
        opt.classList.add("correct");
      }

      // ❌ đáp án user chọn sai → đỏ
      if (
        String(text).trim() === String(q.user).trim() &&
        String(q.user).trim() !== String(q.correct).trim()
      ) {
        opt.classList.add("wrong");
      }

      // 🔒 khóa không cho click nữa
      opt.onclick = null;
    });
  });

  // lưu history như cũ
  if (!isRetryMode) {
    history.push({
      score: s,
      date: new Date().toLocaleDateString(),
      assignmentCode: currentAssignmentCode,
      teacher: currentAssignmentTeacher,
      teacherId: currentAssignmentTeacherId,
    });

    let user = localStorage.getItem("user");

    db.collection("users").doc(user).set(
      {
        history: history,
      },
      { merge: true },
    );

    updateHistory();
  }
}

// Cập nhật biểu đồ lịch sử
function updateHistory() {
  let chart = document.getElementById("chart");
  chart.innerHTML = "";

  if (history.length == 0) {
    chart.innerHTML = "Chưa có dữ liệu";
    return;
  }

  let max = 10;
  let recentHistory = history.slice(-4);

  recentHistory.forEach((item) => {
    let bar = document.createElement("div");
    bar.className = "bar";

    let score = item.score;
    let date = item.date;

    // chiều cao
    let height = (score / max) * 100;
    bar.style.height = height + "%";

    // màu theo điểm
    if (score >= 8) {
      bar.style.background = "#22c55e"; // xanh
    } else if (score >= 5) {
      bar.style.background = "#facc15"; // vàng
    } else {
      bar.style.background = "#ef4444"; // đỏ
    }

    // nếu điểm cao
    let label = document.createElement("span");
    label.innerText = score >= 8 ? "⭐" : score;

    // ngày
    let dateText = document.createElement("div");
    dateText.innerText = date;
    dateText.style.fontSize = "10px";
    dateText.style.textAlign = "center";
    dateText.style.marginTop = "4px";

    bar.appendChild(label);
    chart.appendChild(bar);
    chart.appendChild(dateText);
  });
  let status = document.getElementById("progressStatus");

  if (history.length >= 2) {
    let last = history[history.length - 1].score;
    let prev = history[history.length - 2].score;

    if (last > prev) {
      status.innerText = "📈 Bạn đang tiến bộ 👍";
      status.style.color = "#22c55e";
    } else if (last < prev) {
      status.innerText = "📉 Cần cố gắng hơn 💪";
      status.style.color = "#ef4444";
    } else {
      status.innerText = "😐 Đang giữ phong độ";
      status.style.color = "#f59e0b";
    }
  } else {
    status.innerText = "Hãy làm thêm bài để xem tiến bộ nhé!";
  }
}

// Cập nhật tiến trình làm bài
function updateProgress() {
  let done = quizData.filter((q) => q.user).length;
  progress.innerText = `Đã làm: ${done}/${quizData.length}`;
}

// Cập nhật EXP và level sau khi làm bài
function updateAI(score) {
  let total = quizData.length;
  let percent = (score / total) * 100;

  if (percent >= 80) {
    levelText.innerText = "Giỏi";
  } else if (percent >= 50) {
    levelText.innerText = "Trung Bình";
  } else {
    levelText.innerText = "Yếu";
  }
  exp += score * 10;
  exp = Math.max(0, exp); // Đảm bảo EXP không âm
  let user = localStorage.getItem("user");

  db.collection("users").doc(user).set(
    {
      exp: exp,
    },
    { merge: true },
  );
  let level = calculateLevel(exp);
  let expForCurrentLevel = getExpForLevel(level);
  let expForNextLevel = getExpForNextLevel(level);
  let current = exp - expForCurrentLevel;
  let needed = expForNextLevel - expForCurrentLevel;

  expText.innerText = `Level ${level} (${current}/${needed} EXP)`;
  totalExpText.innerText = `Tổng EXP: ${exp}`;

  // cập nhật thanh
  let bar = document.getElementById("expBar");
  bar.style.width = current + "%";

  let badge = document.getElementById("badge");

  if (score == 10) {
    badge.innerText = "🏆 Thiên tài!";
  } else if (score >= 8) {
    badge.innerText = "⭐ Xuất sắc!";
  } else if (score >= 5) {
    badge.innerText = "👍 Khá tốt!";
  } else {
    badge.innerText = "💪 Cố gắng thêm!";
  }
}

// ===== PHẦN TODO =====
// Thêm công việc vào danh sách
async function addTodo() {
  let todoInput = document.getElementById("todoInput");
  let t = todoInput.value;

  if (!t) return;

  let user = localStorage.getItem("user");

  let doc = await db.collection("users").doc(user).get();
  let list = [];
  if (doc.exists && doc.data().todo) {
    list = doc.data().todo;
  }

  list.push({
    text: t,
    done: false,
  });

  await db.collection("users").doc(user).set(
    {
      todo: list,
    },
    { merge: true },
  );

  renderTodo();

  todoInput.value = "";
}

// Render danh sách todo
async function renderTodo() {
  let todoList = document.getElementById("todoList");
  let user = localStorage.getItem("user");
  let doc = await db.collection("users").doc(user).get();
  let list = doc.data().todo || [];

  todoList.innerHTML = "";

  list.forEach((t, i) => {
    let div = document.createElement("div");

    let checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = t.done;

    let text = document.createElement("span");
    text.innerText = t.text;

    checkbox.onchange = async () => {
      list[i].done = checkbox.checked;
      await db.collection("users").doc(user).set(
        {
          todo: list,
        },
        { merge: true },
      );
      text.style.textDecoration = checkbox.checked ? "line-through" : "none";
    };
    let delBtn = document.createElement("button");
    delBtn.innerText = "❌";
    delBtn.className = "btn-delete";
    delBtn.onclick = async () => {
      // 1. Xóa phần tử khỏi mảng cục bộ
      list.splice(i, 1);

      // 2. Cập nhật mảng mới đã xóa lên Firebase
      try {
        await db.collection("users").doc(user).set(
          {
            todo: list,
          },
          { merge: true },
        );

        // 3. Vẽ lại giao diện sau khi đã lưu thành công
        renderTodo();
      } catch (e) {
        console.error("Lỗi khi xóa todo:", e);
        alert("Không thể xóa, vui lòng thử lại!");
      }
    };
    div.appendChild(delBtn);
    div.appendChild(checkbox);
    div.appendChild(text);
    todoList.appendChild(div);
  });
}

// ===== PHẦN TIMER (POMODORO) =====
let time = 1500, // Thời gian mặc định 25 phút
  intv; // Interval cho timer

// Định dạng thời gian thành mm:ss
function format(t) {
  let m = Math.floor(t / 60),
    s = t % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

// Bắt đầu timer
function startTimer() {
  let minutesInput = document.getElementById("minutesInput");
  let timer = document.getElementById("timer");

  if (minutesInput.value) time = minutesInput.value * 60;

  clearInterval(intv);

  intv = setInterval(() => {
    timer.innerText = format(time);
    time--;

    if (time < 0) {
      clearInterval(intv);
      alert("Xong!");
    }
  }, 1000);
}

// Dừng timer
function pauseTimer() {
  clearInterval(intv);
}

// Đặt lại timer
function resetTimer() {
  clearInterval(intv);
  time = 1500;
  timer.innerText = "25:00";
}

// ===== PHẦN STREAK =====
// Kiểm tra và cập nhật streak học tập
async function checkStudy() {
  let t = new Date().toDateString();
  let user = localStorage.getItem("user");
  let doc = await db.collection("users").doc(user).get();

  let data = doc.data();
  let last = data.lastStudy || "";
  let s = data.streak || 0;

  if (last !== t) {
    const dayDiff = getDayDiff(last, t);

    if (dayDiff === null) {
      s = 1;
    } else if (dayDiff >= 2) {
      s = 1;
    } else {
      s++;
    }

    await db.collection("users").doc(user).set(
      {
        streak: s,
        lastStudy: t,
      },
      { merge: true },
    );
  }
  streakText.innerText = "🔥 " + s;
}

// Phát âm từ tiếng Anh
function speak(word) {
  speechSynthesis.cancel(); // DỌN HÀNG ĐỢI (quan trọng)

  let msg = new SpeechSynthesisUtterance(word);
  msg.lang = "en-US";
  msg.rate = 0.9;

  speechSynthesis.speak(msg);
}
// ===== KHỞI TẠO KHI TRANG LOAD =====
// Mở cửa sổ hướng dẫn khi người dùng bấm vào mascot
function openMascotGuide() {
  if (!mascotGuideModal) return;
  mascotGuideModal.classList.add("show");
  mascotGuideModal.setAttribute("aria-hidden", "false");
}

// Đóng cửa sổ hướng dẫn và trả modal về trạng thái ẩn
function closeMascotGuide() {
  if (!mascotGuideModal) return;
  mascotGuideModal.classList.remove("show");
  mascotGuideModal.setAttribute("aria-hidden", "true");
}

// Gắn các sự kiện mở/đóng cho mascot và modal hướng dẫn
function setupMascotGuide() {
  const mascot = document.getElementById("mascot");
  const mascotSpeech = document.getElementById("mascotSpeech");
  mascotGuideModal = document.getElementById("mascotGuideModal");
  const closeGuideButton = document.getElementById("closeGuideButton");

  if (!mascot || !mascotGuideModal) return;

  // Cập nhật lời thoại để người dùng biết mascot có thể bấm được
  if (mascotSpeech) {
    mascotSpeech.innerText = "Bấm mình để xem hướng dẫn nhé!";
  }

  // Mở bằng chuột hoặc cảm ứng
  mascot.addEventListener("click", openMascotGuide);
  mascot.addEventListener("keydown", function (event) {
    // Hỗ trợ bàn phím để tăng khả năng truy cập
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMascotGuide();
    }
  });

  mascotGuideModal.addEventListener("click", function (event) {
    // Chỉ đóng khi người dùng bấm vào lớp nền mờ bên ngoài
    if (event.target.dataset.closeGuide === "true") {
      closeMascotGuide();
    }
  });

  if (closeGuideButton) {
    // Nút đóng trong modal
    closeGuideButton.addEventListener("click", closeMascotGuide);
  }

  document.addEventListener("keydown", function (event) {
    // Cho phép nhấn Esc để đóng nhanh modal
    if (event.key === "Escape") {
      closeMascotGuide();
    }
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  // lấy phần tử
  todoInput = document.getElementById("todoInput");
  todoList = document.getElementById("todoList");
  minutesInput = document.getElementById("minutesInput");
  timer = document.getElementById("timer");
  progress = document.getElementById("progress");
  result = document.getElementById("result");
  grade = document.getElementById("grade");
  subject = document.getElementById("subject");
  quiz = document.getElementById("quiz");
  historyText = document.getElementById("historyText");
  levelText = document.getElementById("levelText");
  expText = document.getElementById("expText");
  totalExpText = document.getElementById("totalExpText");
  streakText = document.getElementById("streakText");
  intro = document.getElementById("intro");
  app = document.getElementById("app");
  setupMascotGuide(); // Khởi tạo tính năng hướng dẫn của mascot

  let currentUser = localStorage.getItem("user");
  userRole = localStorage.getItem("role") || "student";

  // load dữ liệu
  if (currentUser) {
    await renderTodo();
    await checkStudy();
  }
  updateHistory();
  updateUserUI();
  applyRoleUI();
});

// ===== HÀM MODAL AUTH =====
// mở modal (mặc định login)
function openAuth() {
  document.getElementById("authModal").classList.add("show");
  showLogin();
}

function closeAuth() {
  document.getElementById("authModal").classList.remove("show");
}

// chuyển sang REGISTER
function showRegister() {
  document.getElementById("loginBox").classList.add("hidden");
  document.getElementById("registerBox").classList.remove("hidden");
}

// chuyển về LOGIN
function showLogin() {
  document.getElementById("registerBox").classList.add("hidden");
  document.getElementById("loginBox").classList.remove("hidden");
}

// ===== XỬ LÝ ĐĂNG NHẬP =====
async function handleLogin() {
  // reset sạch UI
  quiz.innerHTML = "";
  result.innerText = "";
  progress.innerText = "Đã làm: 0/0";
  document.getElementById("chart").innerHTML = "";
  let user = document.getElementById("loginUser").value.trim();
  let pass = document.getElementById("loginPass").value.trim();

  if (!user || !pass) {
    alert("❗ Nhập đầy đủ thông tin");
    return;
  }
  try {
    let doc = await db.collection("users").doc(user).get();

    if (doc.exists && doc.data().password === pass) {
      userRole = doc.data().role || "student";
      localStorage.setItem("user", user);
      localStorage.setItem("role", userRole);

      console.log("USER:", localStorage.getItem("user"));
      alert("✅ Đăng nhập thành công!");
      closeAuth();
      updateUserUI();

      // LOAD LẠI DATA THEO USER
      // ===== RESET STATE =====
      exp = 0;
      history = [];
      streak = 0;
      wrongQuestions = [];
      quizData = [];
      isRetryMode = false;

      // reset timer
      time = 1500;
      clearInterval(intv);
      document.getElementById("timer").innerText = "25:00";

      // ===== RESET UI =====
      result.innerText = "";
      progress.innerText = "Đã làm: 0/0";
      quiz.innerHTML = "";
      document.getElementById("chart").innerHTML = "";
      document.getElementById("badge").innerText = "";

      await loadUserData();
      await startApp();
    } else {
      alert("❌ Sai tài khoản hoặc mật khẩu!");
    }
  } catch (e) {
    alert("⚠️ Không kết nối được server!");
    console.error(e);
  }
}

// ===== XỬ LÝ ĐĂNG KÝ =====
async function handleRegister() {
  let user = document.getElementById("regUser").value.trim();
  let pass = document.getElementById("regPass").value.trim();
  let confirm = document.getElementById("regConfirm").value.trim();

  if (!user || !pass || !confirm) {
    alert("❗ Nhập đầy đủ thông tin");
    return;
  }

  if (pass !== confirm) {
    alert("❌ Mật khẩu xác nhận KHÔNG khớp!");
    return;
  }

  const role = document.getElementById("regRole")?.value || "student";

  try {
    await db.collection("users").doc(user).set({
      password: pass,
      exp: 0,
      history: [],
      todo: [],
      streak: 0,
      lastStudy: "",
      role,
    });

    alert("🎉 Tạo tài khoản thành công!");
    showLogin();
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    alert("❌ Không kết nối được Firebase!");
  }
}

// ===== HÀM GIAO DIỆN =====
// Áp dụng UI theo vai trò (teacher/student)
function applyRoleUI() {
  document.querySelectorAll(".teacher-only").forEach((el) => {
    el.style.display = userRole === "teacher" ? "block" : "none";
  });
  document.querySelectorAll(".student-only").forEach((el) => {
    el.style.display = userRole === "student" ? "block" : "none";
  });
}

// Cập nhật thông tin user trên header
function updateUserUI() {
  let user = localStorage.getItem("user");
  let box = document.getElementById("userBox");

  if (user) {
    let avatar =
      userRole === "teacher"
        ? "👩‍🏫"
        : document.getElementById("subject")?.value === "math"
          ? "🐻"
          : "🐱";
    let roleTag = userRole === "teacher" ? "Giáo viên" : "Học sinh";

    box.innerHTML = `
      <div class="user-avatar">${avatar}</div>
      <div>
        <div class="user-name">${user}</div>
        <div style="font-size: 12px; color: #475569">${roleTag}</div>
      </div>
      <button class="logout-btn" onclick="logout()">🚪</button>
    `;
  } else {
    box.innerHTML = `
      <button onclick="openAuth()" class="login-btn">🔐</button>
    `;
  }
  applyRoleUI();
  const startAppButton = document.getElementById("startAppButton");
  if (startAppButton) {
    startAppButton.innerText =
      userRole === "teacher" ? "Bắt đầu" : "Bắt đầu học";
  }
}

// Đăng xuất
function logout() {
  localStorage.removeItem("user");
  localStorage.removeItem("role");
  userRole = "student";
  alert("👋 Đã đăng xuất");
  updateUserUI();

  // reset toàn bộ
  exp = 0;
  history = [];
  streak = 0;
  wrongQuestions = [];
  quizData = [];

  document.getElementById("expText").innerText = "";
  document.getElementById("totalExpText").innerText = "";
  document.getElementById("expBar").style.width = "0%";
  document.getElementById("streakText").innerText = "";
  document.getElementById("chart").innerHTML = "";

  // quay về intro
  document.getElementById("app").classList.add("hidden");
  document.getElementById("intro").classList.remove("hidden");
}

// Lấy key cho localStorage theo user
function getUserKey(key) {
  let user = localStorage.getItem("user");
  return key + "_" + user;
}

// Tải dữ liệu user từ Firebase
async function loadUserData() {
  let user = localStorage.getItem("user");
  if (!user) return;

  let doc = await db.collection("users").doc(user).get();

  if (doc.exists) {
    let data = doc.data();

    exp = data.exp || 0;
    exp = Math.max(0, exp); // Đảm bảo EXP không âm
    history = data.history || [];
    streak = data.streak || 0;
    lastStudy = data.lastStudy || "";
    userRole = data.role || "student";
    localStorage.setItem("role", userRole);

    const startAppButton = document.getElementById("startAppButton");
    if (startAppButton) {
      startAppButton.innerText =
        userRole === "teacher" ? "Bắt đầu" : "Bắt đầu học";
    }

    // 🔥 update UI ngay
    updateHistory();

    let level = calculateLevel(exp);
    let expForCurrentLevel = getExpForLevel(level);
    let expForNextLevel = getExpForNextLevel(level);
    let current = exp - expForCurrentLevel;
    let needed = expForNextLevel - expForCurrentLevel;

    expText.innerText = `Level ${level} (${current}/${needed} EXP)`;
    totalExpText.innerText = `Tổng EXP: ${exp}`;
    document.getElementById("expBar").style.width =
      needed > 0 ? (current / needed) * 100 + "%" : "100%";

    streakText.innerText = "🔥 " + streak;

    await renderTodo();
  }
}
