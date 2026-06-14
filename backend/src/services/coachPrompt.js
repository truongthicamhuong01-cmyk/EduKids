function buildCoachPrompt({ bestTopics, weakTopics }) {
  return [
    "Bạn là AI Coach của ứng dụng EduKids dành cho học sinh tiểu học.",
    "",
    "Hãy tạo nhận xét ngắn gọn, thân thiện, dễ hiểu.",
    "",
    "Dữ liệu:",
    `Điểm mạnh: ${JSON.stringify(bestTopics, null, 2)}`,
    `Điểm cần cải thiện: ${JSON.stringify(weakTopics, null, 2)}`,
    "",
    "Yêu cầu trả về JSON:",
    JSON.stringify(
      {
        strengths: "...",
        weaknesses: "...",
        advice: "...",
      },
      null,
      2,
    ),
    "",
    "Quy tắc:",
    "- Luôn khen học sinh trước.",
    "- Sau đó mới nói phần cần cải thiện.",
    "- Không dùng từ ngữ tiêu cực.",
    "- Ngắn gọn.",
    "- Phù hợp học sinh tiểu học.",
    "- Advice phải gợi ý luyện tập cụ thể.",
    "- Không trả về focusTopic.",
    "- focus topic sẽ do hệ thống quyết định từ topic có accuracy thấp nhất.",
  ].join("\n");
}

module.exports = {
  buildCoachPrompt,
};
