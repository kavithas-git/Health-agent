/**
 * Centralized error handling middleware for Express.
 * Catches all unhandled errors and returns a consistent JSON response.
 */
const errorHandler = (err, req, res, _next) => {
  console.error('[ERROR]', {
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Handle specific error types
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body.',
    });
  }

  if (err.code === '23505') {
    // PostgreSQL unique constraint violation
    return res.status(409).json({
      success: false,
      message: 'A record with that information already exists.',
    });
  }

  if (err.code === '23503') {
    // PostgreSQL foreign key violation
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist.',
    });
  }

  const statusCode = err.statusCode || 500;
  const message =
    statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'An internal server error occurred.'
      : err.message || 'An internal server error occurred.';

  res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = errorHandler;
