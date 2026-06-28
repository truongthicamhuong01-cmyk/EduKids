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

function buildQuizPrompt({ grade, subject, topic, versionId, versionNumber }) {
  const topicName = topic.title || topic.name || topic.topicName || topic.topicId;
  const topicDescription = topic.description || "";
  const versionLabel = versionId ? `Phiên bản: ${versionId}` : "";
  const versionHint = versionNumber
    ? `Hãy tạo bộ câu hỏi khác biệt rõ rệt so với các phiên bản trước, nhấn mạnh đây là phiên bản số ${versionNumber}.`
    : "Hãy tạo bộ câu hỏi khác biệt rõ rệt so với các phiên bản trước.";

  return [
    "Bạn là chuyên gia tạo bài kiểm tra cho học sinh tiểu học.",
    "Hãy tạo đúng 1 bài quiz bằng tiếng Việt cho chủ đề sau.",
    "",
    `Khối lớp: ${grade}`,
    `Môn học: ${getSubjectLabel(subject)}`,
    `topicId: ${topic.topicId}`,
    `Tên chủ đề: ${topicName}`,
    versionLabel,
    topicDescription ? `Mô tả chủ đề: ${topicDescription}` : null,
    "",
    "Yêu cầu bắt buộc:",
    "- Chỉ trả về JSON hợp lệ.",
    "- Không được có bất kỳ text nào ngoài JSON.",
    "- Quiz phải có đúng 10 câu hỏi.",
    "- Mỗi câu có đúng 4 lựa chọn A, B, C, D.",
    "- Mỗi lựa chọn phải có đủ 3 trường: label, text, correct.",
    "- label chỉ được là A, B, C, D.",
    "- Mỗi câu chỉ được có đúng 1 lựa chọn correct = true.",
    "- Nội dung câu hỏi và đáp án phải phù hợp với khối lớp, môn học và chủ đề.",
    "- Không dùng markdown, không dùng code fence, không giải thích thêm.",
    `- ${versionHint}`,
    "",
    "Schema JSON phải trả về:",
    JSON.stringify(
      {
        grade: String(grade),
        subject: String(subject),
        topicId: String(topic.topicId),
        topicName,
        questions: [
          {
            question: "Câu hỏi bằng tiếng Việt",
            options: [
              { label: "A", text: "Lựa chọn A", correct: false },
              { label: "B", text: "Lựa chọn B", correct: true },
              { label: "C", text: "Lựa chọn C", correct: false },
              { label: "D", text: "Lựa chọn D", correct: false },
            ],
          },
        ],
      },
      null,
      2
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

module.exports = {
  buildQuizPrompt,
};
