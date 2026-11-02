/**
 * 404 Not Found Middleware
 * Triggered when a requested endpoint does not match any registered route.
 */
export function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.originalUrl} - Endpoint not found`,
  });
}

/**
 * Centralized Application Error Handling Middleware
 * Translates errors into clean, consistent JSON responses.
 * Protects database credentials and prevents stack trace leakage.
 */
export function errorHandler(err, req, res, next) {
  // Safe logging without sensitive patient or clinical notes
  console.error(`❌ [Error ${req.method} ${req.path}]:`, err.message || err);

  // Mongoose Validation Error (e.g., missing required fields)
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: messages,
    });
  }

  // Mongoose CastError (e.g., malformed ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: `Invalid format for resource identifier '${err.value}'`,
    });
  }

  // MongoDB Duplicate Key Error (e.g., duplicate email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      error: `A record with this ${field} already exists.`,
    });
  }

  // Custom status code if assigned, otherwise default to 500 Internal Server Error
  const statusCode = err.status || err.statusCode || 500;
  const message =
    statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'An internal server error occurred. Please contact system support.'
      : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
