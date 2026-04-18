let streak = 0;
let lastStudy = "";

// ===== FIREBASE INIT =====
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
  streakText;
let wrongQuestions = [];
let isRetryMode = false;

// ===== INTRO =====
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

// ===== QUIZ =====
let quizData = [];
let exp = 0;

function rand(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
// Tạo mã BT
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

      let infoBox = document.getElementById("assignmentInfo");

      infoBox.style.display = "block";

      infoBox.innerHTML = `
  <h3>📘 Thông tin bài tập</h3>
  <p>📚 Môn: <b>${data.subject}</b></p>
  <p>👨‍🏫 Giáo viên: <b>${data.teacher}</b></p>
  <p>🏫 Lớp: <b>${data.grade || "Không rõ"}</b></p>
  <p>📝 Số câu: <b>${data.questions.length}</b></p>
`;

      // Render lại giao diện để học sinh làm
      render();
      updateProgress();

      // Cuộn xuống phần bài tập
      document.getElementById("quiz").scrollIntoView({ behavior: "smooth" });
    } else {
      alert("❌ Mã bài tập không tồn tại!");
    }
  } catch (e) {
    console.error(e);
    alert("Lỗi kết nối khi tìm mã!");
  }
}

async function showMyAssignments() {
  const user = localStorage.getItem("user");
  const snapshot = await db
    .collection("assignments")
    .where("teacher", "==", user)
    .get();

  let html = "<h3>Kho mã bài tập của bạn:</h3>";
  snapshot.forEach((doc) => {
    const data = doc.data();
    html += `<p>Mã: <b>${doc.id}</b> - Môn: ${data.subject} (${data.questions.length} câu)</p>`;
  });

  // Hiển thị html này vào một Modal hoặc một Div trống trên trang web
  document.getElementById("assignmentList").innerHTML = html;
}

// 1. Đóng/Mở cửa sổ
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
  const text = document.getElementById("manualText").value.trim();
  const previewArea = document.getElementById("parsePreview");

  if (!text) {
    alert("Vui lòng nhập câu hỏi!");
    return null;
  }

  const lines = text.split("\n");
  let tempQuiz = [];

  lines.forEach((line) => {
    const parts = line.split("|").map((p) => p.trim());

    // Kiểm tra nếu đủ 5 thành phần (Câu hỏi + 1 đúng + 3 sai)
    if (parts.length >= 5) {
      tempQuiz.push({
        q: parts[0],
        correct: parts[1],
        opts: shuffle([parts[1], parts[2], parts[3], parts[4]]), // Trộn đáp án
      });
    }
  });

  if (tempQuiz.length > 0) {
    previewArea.style.display = "block";
    previewArea.innerHTML = `✅ Đã nhận diện được ${tempQuiz.length} câu hỏi hợp lệ.`;
    return tempQuiz;
  } else {
    alert("Sai định dạng! Hãy kiểm tra lại dấu gạch đứng |");
    return null;
  }
}

// Hàm lưu vào Firebase
async function saveManualToCloud() {
  const gvName = document.getElementById("gvName").value.trim();
  const gvGrade = document.getElementById("gvGrade").value;
  const questions = parseManualInput(); // Lấy dữ liệu đã xử lý
  const gvSubject = document.getElementById("gvSubject").value;

  if (!gvName) {
    alert("Vui lòng nhập tên giáo viên!");
    return;
  }

  if (!questions) return;

  const assignmentCode = await generateCode();

  try {
    await db.collection("assignments").doc(assignmentCode).set({
      teacher: gvName,
      grade: gvGrade,
      subject: gvSubject,
      questions: questions,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    document.getElementById("assignmentCodeText").innerText = assignmentCode;
    document.getElementById("codeBox").style.display = "block";

    // Reset form
    document.getElementById("manualText").value = "";
  } catch (e) {
    console.error(e);
    alert("Lỗi khi kết nối Firebase!");
  }
}

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
async function genAIQuiz() {
  try {
    let res = await fetch("/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: `Tạo 10 câu hỏi trắc nghiệm toán cho học sinh tiểu học.

YÊU CẦU:
- Mỗi câu có: question, options (4 đáp án), correct_answer
- correct_answer phải nằm trong options
- KHÔNG markdown
- KHÔNG \`\`\`json
- CHỈ JSON
- options phải là string
- correct_answer phải là string
`,
      }),
    });

    let data = await res.json();

    if (!data.text) {
      console.log("❌ AI LỖI", data);
      return genMath();
    }

    let text = data.text;

    // CLEAN
    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    // CẮT JSON CHUẨN
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return genMath();

    let quiz;

    try {
      quiz = JSON.parse(match[0]);
    } catch (e) {
      console.log("❌ JSON lỗi:", text);
      return genMath();
    }

    // FORMAT + VALIDATE
    quiz = quiz.map((q) => ({
      q: q.question,
      correct: String(q.correct_answer).trim(),
      opts: q.options.map((o) => String(o).trim()),
    }));

    return quiz;
  } catch (e) {
    console.error(e);
    return genMath();
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

function retryWrong() {
  if (!wrongQuestions || wrongQuestions.length === 0) {
    alert("Không có lỗi sai!");
    return;
  }

  isRetryMode = true;

  // 🔥 clone sâu tránh bị mất dữ liệu
  quizData = JSON.parse(JSON.stringify(wrongQuestions));

  render();
  updateProgress();
}

async function startQuiz() {
  isRetryMode = false;

  if (subject.value == "math") {
    quizData = await genAIQuiz();
  } else {
    quizData = genEng();
  }

  render();
  updateProgress();
}

let history = [];

function render() {
  quiz.innerHTML = "";
  quizData.forEach((q, i) => {
    let div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<p>${i + 1}. ${q.q}</p>`;
    q.opts.forEach((o) => {
      let btn = document.createElement("div");
      btn.className = "option";
      btn.innerText = o;
      btn.onclick = () => {
        q.user = o;
        updateProgress();

        div
          .querySelectorAll(".option")
          .forEach((x) => x.classList.remove("selected"));
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

function submitQuiz() {
  let s = 0;
  wrongQuestions = [];

  for (let q of quizData) {
    if (!q.user) {
      alert("❗ Bạn chưa làm hết!");
      return;
    }
  }

  for (let q of quizData) {
    if (String(q.user).trim() === String(q.correct).trim()) s++;
    else wrongQuestions.push(q);
  }

  result.innerText = `🔥 ${s}/${quizData.length}`;
  updateAI(s);
  if (!isRetryMode) {
    history.push({
      score: s,
      date: new Date().toLocaleDateString(),
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
function updateHistory() {
  let chart = document.getElementById("chart");
  chart.innerHTML = "";

  if (history.length == 0) {
    chart.innerHTML = "Chưa có dữ liệu";
    return;
  }

  let max = 10;

  history.forEach((item) => {
    let bar = document.createElement("div");
    bar.className = "bar";

    let score = item.score;
    let date = item.date;

    // chiều cao
    let height = (score / max) * 100;
    bar.style.height = height + "%";

    // 🎨 màu theo điểm
    if (score >= 8) {
      bar.style.background = "#22c55e"; // xanh
    } else if (score >= 5) {
      bar.style.background = "#facc15"; // vàng
    } else {
      bar.style.background = "#ef4444"; // đỏ
    }

    // ⭐ nếu điểm cao
    let label = document.createElement("span");
    label.innerText = score >= 8 ? "⭐" : score;

    // 📅 ngày
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

function updateProgress() {
  let done = quizData.filter((q) => q.user).length;
  progress.innerText = `Đã làm: ${done}/${quizData.length}`;
}

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
  let user = localStorage.getItem("user");

  db.collection("users").doc(user).set(
    {
      exp: exp,
    },
    { merge: true },
  );
  let level = Math.floor(exp / 100);
  let current = exp % 100;

  expText.innerText = `Level ${level} (${current}/100 EXP)`;

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

// ===== TODO =====
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

// ===== TIMER =====
let time = 1500,
  intv;
function format(t) {
  let m = Math.floor(t / 60),
    s = t % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}
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
function pauseTimer() {
  clearInterval(intv);
}
function resetTimer() {
  clearInterval(intv);
  time = 1500;
  timer.innerText = "25:00";
}

// ===== STREAK =====
async function checkStudy() {
  let t = new Date().toDateString();
  let user = localStorage.getItem("user");
  let doc = await db.collection("users").doc(user).get();

  let data = doc.data();
  let last = data.lastStudy || "";
  let s = data.streak || 0;
  if (last != t) {
    s++;
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

// Đọc Tiếng Anh
function speak(word) {
  speechSynthesis.cancel(); // 🔥 DỌN HÀNG ĐỢI (quan trọng)

  let msg = new SpeechSynthesisUtterance(word);
  msg.lang = "en-US";
  msg.rate = 0.9;

  speechSynthesis.speak(msg);
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
  streakText = document.getElementById("streakText");
  intro = document.getElementById("intro");
  app = document.getElementById("app");

  let currentUser = localStorage.getItem("user");

  // load dữ liệu
  if (currentUser) {
    await renderTodo();
    await checkStudy();
  }
  updateHistory();
  updateUserUI();
});

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

// ===== LOGIN =====
async function handleLogin() {
  // 🔥 reset sạch UI
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
      localStorage.setItem("user", user);

      console.log("USER:", localStorage.getItem("user"));
      alert("✅ Đăng nhập thành công!");
      closeAuth();
      updateUserUI();

      // 🔥 LOAD LẠI DATA THEO USER
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
// ===== REGISTER =====
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

  try {
    await db.collection("users").doc(user).set({
      password: pass,
      exp: 0,
      history: [],
      todo: [],
      streak: 0,
      lastStudy: "",
    });

    alert("🎉 Tạo tài khoản thành công!");
    showLogin();
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    alert("❌ Không kết nối được Firebase!");
  }
}

function updateUserUI() {
  let user = localStorage.getItem("user");
  let box = document.getElementById("userBox");

  if (user) {
    let subjectValue = document.getElementById("subject")?.value || "math";
    let avatar = subjectValue === "math" ? "🐻" : "🐱";

    box.innerHTML = `
      <div class="user-avatar">${avatar}</div>
      <div class="user-name">${user}</div>
      <button class="logout-btn" onclick="logout()">🚪</button>
    `;
  } else {
    box.innerHTML = `
      <button onclick="openAuth()" class="login-btn">🔐</button>
    `;
  }
}

function logout() {
  localStorage.removeItem("user");
  alert("👋 Đã đăng xuất");
  updateUserUI();

  // reset toàn bộ
  exp = 0;
  history = [];
  streak = 0;
  wrongQuestions = [];
  quizData = [];

  document.getElementById("expText").innerText = "";
  document.getElementById("expBar").style.width = "0%";
  document.getElementById("streakText").innerText = "";
  document.getElementById("chart").innerHTML = "";

  // quay về intro
  document.getElementById("app").classList.add("hidden");
  document.getElementById("intro").classList.remove("hidden");
}
function getUserKey(key) {
  let user = localStorage.getItem("user");
  return key + "_" + user;
}
async function loadUserData() {
  let user = localStorage.getItem("user");
  if (!user) return;

  let doc = await db.collection("users").doc(user).get();

  if (doc.exists) {
    let data = doc.data();

    exp = data.exp || 0;
    history = data.history || [];
    streak = data.streak || 0;
    lastStudy = data.lastStudy || "";

    // 🔥 update UI ngay
    updateHistory();

    let level = Math.floor(exp / 100);
    let current = exp % 100;

    expText.innerText = `Level ${level} (${current}/100 EXP)`;
    document.getElementById("expBar").style.width = current + "%";

    streakText.innerText = "🔥 " + streak;

    await renderTodo();
  }
}
