const asyncHandler = require("../utils/asyncHandler");
const { normalizeString } = require("../utils/validators");

const login = asyncHandler(async (req, res) => {
  const password = normalizeString(req.body.password);
  const adminPassword = normalizeString(process.env.ADMIN_PASSWORD);

  if (!adminPassword) {
    return res.status(500).json({
      success: false,
      message: "ADMIN_PASSWORD is not configured",
    });
  }

  if (!password || password !== adminPassword) {
    return res.status(401).json({
      success: false,
      message: "Sai mật khẩu quản trị",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Đăng nhập quản trị thành công",
    data: {
      authenticated: true,
    },
  });
});

module.exports = {
  login,
};
