function normalizeSubjectToken(subject) {
  return String(subject || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getSubjectLabel(subject) {
  const normalized = normalizeSubjectToken(subject);

  if (normalized === "math" || normalized === "toan") {
    return "Toán";
  }

  if (normalized === "english" || normalized === "tieng anh") {
    return "Tiếng Anh";
  }

  if (normalized === "vietnamese" || normalized === "tieng viet") {
    return "Tiếng Việt";
  }

  if (normalized === "science" || normalized === "khoa hoc") {
    return "Khoa học";
  }

  if (normalized === "history" || normalized === "lich su") {
    return "Lịch sử";
  }

  if (normalized === "geography" || normalized === "dia ly") {
    return "Địa lý";
  }

  return String(subject || "").trim();
}

function buildAssignmentAiPrompt({
  subject,
  topicName,
  grade,
  difficulty,
  questionCount,
  notes,
}) {
  const normalizedSubject = getSubjectLabel(subject);
  const normalizedTopic = String(topicName || "").trim();
  const normalizedGrade = String(grade || "").trim();
  const normalizedDifficulty = String(difficulty || "").trim();
  const normalizedQuestionCount = Number(questionCount);
  const normalizedNotes = String(notes || "").trim();

  return [
    "Bạn là giáo viên tiểu học và chuyên gia tạo bài tập trắc nghiệm.",
    `Hãy tạo đúng ${normalizedQuestionCount} câu hỏi bằng tiếng Việt cho bài tập dưới đây.`,
    "",
    `Môn học: ${normalizedSubject}`,
    `Chủ đề: ${normalizedTopic}`,
    `Khối: Lớp ${normalizedGrade}`,
    `Độ khó: ${normalizedDifficulty}`,
    `Số câu: ${normalizedQuestionCount}`,
    `Ghi chú: ${normalizedNotes || "Không có"}`,
    "",
    "Yêu cầu bắt buộc:",
    "- Chỉ trả về JSON hợp lệ, không thêm markdown, không thêm giải thích.",
    "- Mỗi câu hỏi phải có đúng 4 phương án trong mảng options.",
    "- options phải là mảng chuỗi, theo thứ tự A, B, C, D.",
    "- correctAnswer phải là chỉ số của đáp án đúng, tính từ 0 đến 3.",
    "- Câu hỏi và đáp án phải phù hợp với khối lớp, độ khó và chủ đề đã chọn.",
    "- Nội dung phải gần gũi với học sinh tiểu học và dùng tiếng Việt tự nhiên.",
    "",
    "Schema JSON cần trả về:",
    JSON.stringify(
      {
        questions: [
          {
            question: "Câu hỏi bằng tiếng Việt",
            options: [
              "Phương án A",
              "Phương án B",
              "Phương án C",
              "Phương án D",
            ],
            correctAnswer: 0,
          },
        ],
      },
      null,
      2,
    ),
  ].join("\n");
}

module.exports = {
  buildAssignmentAiPrompt,
  getSubjectLabel,
};
