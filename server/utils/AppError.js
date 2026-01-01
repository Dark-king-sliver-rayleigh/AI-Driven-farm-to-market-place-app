/**
 * Custom Application Error class
 * Provides structured error handling with consistent format
 */
class AppError extends Error {
  constructor(message, statusCode, errorCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  // Factory methods for common errors
  static unauthorized(message = 'Not authorized') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Access denied') {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(resource = 'Resource') {
    return new AppError(`${resource} not found`, 404, 'NOT_FOUND');
  }

  static badRequest(message, details = null) {
    return new AppError(message, 400, 'VALIDATION_ERROR', details);
  }

  static invalidTransition(from, to, allowed = []) {
    return new AppError(
      `Invalid status transition from ${from} to ${to}`,
      400,
      'INVALID_TRANSITION',
      { currentStatus: from, requestedStatus: to, allowedTransitions: allowed }
    );
  }

  static insufficientStock(productName, available, requested) {
    return new AppError(
      `Insufficient stock for '${productName}'`,
      400,
      'INSUFFICIENT_STOCK',
      { available, requested }
    );
  }

  static conflict(message, details = null) {
    return new AppError(message, 409, 'CONFLICT', details);
  }

  static serverError(message = 'Internal server error') {
    return new AppError(message, 500, 'SERVER_ERROR');
  }
}

module.exports = AppError;
