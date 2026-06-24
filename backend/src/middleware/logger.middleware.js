'use strict';

const supabase = require('../config/supabase');

function requestLogger(req, res, next) {
  req.startTime = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - req.startTime;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
    }
  });
  next();
}

async function auditLog({ actorId, actorEmail, actorRole, action, resourceType, resourceId, details, req }) {
  try {
    await supabase.from('audit_logs').insert({
      actor_id:      actorId,
      actor_email:   actorEmail,
      actor_role:    actorRole,
      action,
      resource_type: resourceType,
      resource_id:   resourceId,
      details:       details || {},
      ip_address:    req?.ip || req?.connection?.remoteAddress,
      user_agent:    req?.headers?.['user-agent'],
    });
  } catch (err) {
    console.error('[AUDIT LOG ERROR]', err.message);
  }
}

module.exports = { requestLogger, auditLog };
