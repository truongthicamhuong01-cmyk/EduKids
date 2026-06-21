class ApiError extends Error {
  constructor(statusCode, message, errorCode = "INTERNAL_ERROR", details = null) {
    super(message);
    this.statusCode = statusCode;
    this.name = "ApiError";
    this.errorCode = errorCode;
    this.details = details;
  }
}

module.exports = ApiError;
