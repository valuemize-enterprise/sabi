'use strict';

const jwt = require('jsonwebtoken');

function generateAgencyToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

function generateClientToken(client) {
  return jwt.sign(
    { clientId: client.id, email: client.email, brandId: client.brand_id },
    process.env.JWT_CLIENT_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

function generateSuperAdminToken(admin) {
  return jwt.sign(
    { email: admin.email, role: 'super_admin' },
    process.env.JWT_SA_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

module.exports = { generateAgencyToken, generateClientToken, generateSuperAdminToken };
