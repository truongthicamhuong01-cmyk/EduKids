// ===== IMPORT MODULES =====
// Load biến môi trường từ file .env
require("dotenv").config();

// Import thư viện cần thiết
const fetch = require("node-fetch"); // Để gọi API Gemini
const express = require("express"); // Framework web server
const cors = require("cors"); // Cho phép cross-origin requests

// ===== KHỞI TẠO EXPRESS APP =====
const app = express();
const path = require("path");

// ===== MIDDLEWARE =====
// Serve static files từ thư mục public (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "public")));

// Cho phép CORS để frontend có thể gọi API
app.use(cors());

// Parse JSON body từ requests
app.use(express.json());

// ===== API ROUTES =====
// Route POST /ai: Gọi Gemini AI để tạo câu hỏi quiz
app.post("/ai", async (req, res) => {
  console.log("👉 Có request tới /ai");

  try {
    // Lấy prompt từ frontend
    let userPrompt = req.body.prompt;

    // Gọi Gemini API với prompt
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=" +
        process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: userPrompt,
                },
              ],
            },
          ],
        }),
      },
    );

    // Parse response từ Gemini
    const data = await response.json();

    console.log("Gemini trả về:", JSON.stringify(data, null, 2));

    // ❌ Xử lý lỗi API
    if (data.error) {
      console.log("❌ Gemini lỗi:", data.error.message);

      return res.json({
        text: null,
        error: data.error.message,
      });
    }

    // ❌ Xử lý trường hợp không có text
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log("RAW AI:", text);
    console.log("FULL RESPONSE:", JSON.stringify(data, null, 2));

    if (!text) {
      return res.status(500).json({
        error: "AI không trả text",
        raw: data, // 🔥 debug luôn
      });
    }

    // ✅ Trả về text cho frontend
    res.json({ text });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    res.status(500).json({ error: "Server lỗi" });
  }
});

// ===== KHỞI ĐỘNG SERVER =====
// Lấy port từ biến môi trường hoặc mặc định 3000
const PORT = process.env.PORT || 3000;

// Khởi động server và lắng nghe trên port
app.listen(PORT, () => {
  console.log("🔥 Server chạy trên port", PORT);
});
