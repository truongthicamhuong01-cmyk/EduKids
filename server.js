require("dotenv").config();
const fetch = require("node-fetch");
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/ai", async (req, res) => {
  console.log("👉 Có request tới /ai");
  try {
    let userPrompt = req.body.prompt;

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
    const data = await response.json();

    console.log("Gemini trả về:", JSON.stringify(data, null, 2));

    // ❌ nếu API lỗi
    if (data.error) {
      console.log("❌ Gemini lỗi:", data.error.message);

      return res.json({
        text: null,
        error: data.error.message,
      });
    }

    // ❌ nếu không có dữ liệu
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log("RAW AI:", text);
    console.log("FULL RESPONSE:", JSON.stringify(data, null, 2));

    if (!text) {
      return res.status(500).json({
        error: "AI không trả text",
        raw: data, // 🔥 debug luôn
      });
    }

    res.json({ text });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    res.status(500).json({ error: "Server lỗi" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🔥 Server chạy");
});
