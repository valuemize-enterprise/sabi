/**
 * VAPID Keys Generator
 * 
 * Generates public/private key pair for Web Push notifications.
 * Run this once and add the keys to your .env file.
 * 
 * Usage: node scripts/generate-vapid-keys.js
 */

'use strict';

let webpush;
try {
  webpush = require('web-push');
} catch (err) {
  console.error('❌ web-push not installed. Run: npm install web-push');
  process.exit(1);
}

console.log('\n🔐 Generating VAPID Keys for Web Push Notifications\n');
console.log('═══════════════════════════════════════════════════\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('✅ Keys generated successfully!\n');
console.log('Add these to your backend .env file:\n');
console.log('─────────────────────────────────────────────────\n');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:hello@cerebre.media`);
console.log('\n─────────────────────────────────────────────────\n');

console.log('⚠️  SECURITY NOTES:');
console.log('  • Keep the PRIVATE key secret - never commit to git');
console.log('  • The PUBLIC key will be exposed to the frontend');
console.log('  • Update VAPID_SUBJECT to match your email/domain\n');

console.log('📋 Next steps:');
console.log('  1. Add the keys to backend/.env');
console.log('  2. Add NEXT_PUBLIC_VAPID_KEY to frontend/.env:');
console.log(`     NEXT_PUBLIC_VAPID_KEY=${vapidKeys.publicKey}`);
console.log('  3. Run the database migration:');
console.log('     Execute migrations/create_push_subscriptions_table.sql');
console.log('  4. Restart both backend and frontend servers\n');
