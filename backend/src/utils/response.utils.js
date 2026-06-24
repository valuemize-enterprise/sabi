'use strict';

function sendSuccess(res, data, message = 'OK', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

function sendError(res, statusCode, message, details = null) {
  const payload = { success: false, error: message };
  if (details) payload.details = details;
  return res.status(statusCode).json(payload);
}

function sendPaginated(res, data, total, page, limit) {
  return res.json({
    success: true,
    data,
    pagination: {
      total,
      page:       parseInt(page),
      limit:      parseInt(limit),
      totalPages: Math.ceil(total / limit),
    },
  });
}

module.exports = { sendSuccess, sendError, sendPaginated };
