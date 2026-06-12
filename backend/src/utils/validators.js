function isValidRole(role) {
  return role === "student" || role === "teacher";
}

function isValidGender(gender) {
  return gender === "male" || gender === "female";
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

module.exports = {
  isValidRole,
  isValidGender,
  normalizeString,
};

