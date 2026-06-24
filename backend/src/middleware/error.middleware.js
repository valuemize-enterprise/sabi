'use strict';

function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}`, err.message);
  if (process.env.NODE_ENV === 'development') console.error(err.stack);

  const status  = err.statusCode || err.status || 500;
  const message = status === 500 ? 'Internal server error' : err.message;
  res.status(status).json({ success: false, error: message });
}

module.exports = { errorHandler };
