/**
 * ═══════════════════════════════════════════════════════════════
 * Push Notification Service — PWA Push Notifications
 * ═══════════════════════════════════════════════════════════════
 * Handles web push notifications for the PWA app.
 * Uses the Web Push Protocol to send notifications to subscribed devices.
 *
 * Setup:
 *   1. Run: npm install web-push
 *   2. Generate VAPID keys: node scripts/generate-vapid-keys.js
 *   3. Add to .env:
 *      VAPID_PUBLIC_KEY=...
 *      VAPID_PRIVATE_KEY=...
 *      VAPID_SUBJECT=mailto:hello@cerebre.media
 */

'use strict';

const supabase = require('../config/supabase');

let webpush;
try {
  webpush = require('web-push');
} catch (err) {
  console.warn('[push-notification] web-push not installed. Run: npm install web-push');
}

// ── Configuration ───────────────────────────────────────────────

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hello@cerebre.media';

if (webpush && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  console.log('[push-notification] Web push configured successfully');
} else if (!webpush) {
  console.warn('[push-notification] Service disabled - web-push not installed');
} else {
  console.warn('[push-notification] Service disabled - VAPID keys not configured');
}

// ── Database Operations ─────────────────────────────────────────

/**
 * Save a push subscription for a user
 */
async function saveSubscription(userId, subscription) {
  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        subscription: subscription,
        endpoint: subscription.endpoint,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,endpoint'
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('[push-notification] Failed to save subscription:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get all subscriptions for a user
 */
async function getUserSubscriptions(userId) {
  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[push-notification] Failed to get subscriptions:', error.message);
    return [];
  }
}

/**
 * Remove a subscription
 */
async function removeSubscription(userId, endpoint) {
  try {
    const { error } = await supabase
      .from('push_subscriptions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('endpoint', endpoint);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('[push-notification] Failed to remove subscription:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Mark subscription as invalid (for cleanup after failed sends)
 */
async function markSubscriptionInvalid(endpoint) {
  try {
    await supabase
      .from('push_subscriptions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('endpoint', endpoint);
  } catch (error) {
    console.error('[push-notification] Failed to mark subscription invalid:', error);
  }
}

// ── Push Notification Sending ───────────────────────────────────

/**
 * Send a push notification to a user
 */
async function sendNotification(userId, payload) {
  if (!webpush || !VAPID_PUBLIC_KEY) {
    console.log('[push-notification] Service disabled, skipping notification');
    return { success: false, error: 'Push service not configured' };
  }

  try {
    const subscriptions = await getUserSubscriptions(userId);
    
    if (subscriptions.length === 0) {
      console.log(`[push-notification] No subscriptions for user ${userId}`);
      return { success: false, error: 'No subscriptions found' };
    }

    const notificationPayload = JSON.stringify({
      title: payload.title || 'Sabi Intelligence Suite',
      body: payload.body || 'You have a new notification',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      url: payload.url || '/',
      data: payload.data || {},
      timestamp: Date.now(),
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(sub.subscription, notificationPayload);
          return { success: true, endpoint: sub.endpoint };
        } catch (error) {
          // Handle subscription errors (expired, unsubscribed, etc.)
          if (error.statusCode === 404 || error.statusCode === 410) {
            await markSubscriptionInvalid(sub.endpoint);
          }
          throw error;
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[push-notification] Sent to user ${userId}: ${successful} success, ${failed} failed`);

    return {
      success: successful > 0,
      sent: successful,
      failed: failed,
    };
  } catch (error) {
    console.error('[push-notification] Failed to send notification:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send notification to multiple users
 */
async function sendBulkNotifications(userIds, payload) {
  if (!webpush || !VAPID_PUBLIC_KEY) {
    console.log('[push-notification] Service disabled, skipping notifications');
    return { success: false, error: 'Push service not configured' };
  }

  const results = await Promise.allSettled(
    userIds.map(userId => sendNotification(userId, payload))
  );

  const summary = results.reduce((acc, result) => {
    if (result.status === 'fulfilled' && result.value.success) {
      acc.successful++;
      acc.sent += result.value.sent || 0;
    } else {
      acc.failed++;
    }
    return acc;
  }, { successful: 0, failed: 0, sent: 0 });

  console.log(`[push-notification] Bulk send: ${summary.sent} notifications to ${summary.successful} users`);

  return {
    success: true,
    ...summary,
  };
}

// ── Notification Triggers ───────────────────────────────────────
// These are event-specific helpers that can be called from your routes

/**
 * Notify user about a new deliverable
 */
async function notifyDeliverableSubmitted(deliverable, brand) {
  const { data: admins } = await supabase
    .from('staff_brand_assignments')
    .select('staff_id')
    .eq('brand_id', brand.id)
    .contains('roles_on_brand', ['brand_admin']);

  if (!admins || admins.length === 0) return;

  const userIds = admins.map(a => a.staff_id);

  return sendBulkNotifications(userIds, {
    title: 'New Deliverable Submitted',
    body: `${deliverable.title} was submitted for ${brand.name}`,
    url: `/brands/${brand.id}/deliverables`,
    data: { type: 'deliverable', deliverableId: deliverable.id, brandId: brand.id },
  });
}

/**
 * Notify user about goal status change
 */
async function notifyGoalStatusChanged(goal, brand, newStatus) {
  // Notify brand team members
  const { data: teamMembers } = await supabase
    .from('staff_brand_assignments')
    .select('staff_id')
    .eq('brand_id', brand.id);

  if (!teamMembers || teamMembers.length === 0) return;

  const userIds = teamMembers.map(tm => tm.staff_id);

  return sendBulkNotifications(userIds, {
    title: 'Goal Status Updated',
    body: `${goal.title} is now ${newStatus}`,
    url: `/brands/${brand.id}/goals`,
    data: { type: 'goal', goalId: goal.id, brandId: brand.id, status: newStatus },
  });
}

/**
 * Notify user about leave request status
 */
async function notifyLeaveRequestStatus(leave, user, status) {
  return sendNotification(user.id, {
    title: 'Leave Request Update',
    body: `Your leave request has been ${status}`,
    url: '/my-profile',
    data: { type: 'leave', leaveId: leave.id, status },
  });
}

/**
 * Notify user about task assignment
 */
async function notifyTaskAssigned(task, brand, assigneeId) {
  return sendNotification(assigneeId, {
    title: 'New Task Assigned',
    body: `You've been assigned: ${task.title}`,
    url: `/brands/${brand.id}/tasks`,
    data: { type: 'task', taskId: task.id, brandId: brand.id },
  });
}

/**
 * Notify team about new team member
 */
async function notifyNewTeamMember(brand, newMember) {
  const { data: teamMembers } = await supabase
    .from('staff_brand_assignments')
    .select('staff_id')
    .eq('brand_id', brand.id)
    .neq('staff_id', newMember.id);

  if (!teamMembers || teamMembers.length === 0) return;

  const userIds = teamMembers.map(tm => tm.staff_id);

  return sendBulkNotifications(userIds, {
    title: 'New Team Member',
    body: `${newMember.full_name} joined the ${brand.name} team`,
    url: `/brands/${brand.id}/team`,
    data: { type: 'team', brandId: brand.id, userId: newMember.id },
  });
}

/**
 * Notify user about client feedback
 */
async function notifyClientFeedback(brand, feedback) {
  const { data: admins } = await supabase
    .from('staff_brand_assignments')
    .select('staff_id')
    .eq('brand_id', brand.id)
    .contains('roles_on_brand', ['brand_admin']);

  if (!admins || admins.length === 0) return;

  const userIds = admins.map(a => a.staff_id);

  return sendBulkNotifications(userIds, {
    title: 'New Client Feedback',
    body: `New feedback received for ${brand.name}`,
    url: `/brands/${brand.id}/satisfaction`,
    data: { type: 'feedback', brandId: brand.id },
  });
}

/**
 * Notify about report completion
 */
async function notifyReportReady(report, recipientId) {
  return sendNotification(recipientId, {
    title: 'Report Ready',
    body: `${report.title} is ready to view`,
    url: `/reports/${report.id}`,
    data: { type: 'report', reportId: report.id },
  });
}

/**
 * Notify about deadline approaching
 */
async function notifyDeadlineApproaching(item, userId, hoursRemaining) {
  return sendNotification(userId, {
    title: 'Deadline Reminder',
    body: `${item.title} is due in ${hoursRemaining} hours`,
    url: item.url || '/dashboard',
    data: { type: 'deadline', itemId: item.id, hours: hoursRemaining },
  });
}

// ── Exports ─────────────────────────────────────────────────────

module.exports = {
  // Subscription management
  saveSubscription,
  getUserSubscriptions,
  removeSubscription,
  getVapidPublicKey: () => VAPID_PUBLIC_KEY,
  
  // Sending
  sendNotification,
  sendBulkNotifications,
  
  // Event triggers
  notifyDeliverableSubmitted,
  notifyGoalStatusChanged,
  notifyLeaveRequestStatus,
  notifyTaskAssigned,
  notifyNewTeamMember,
  notifyClientFeedback,
  notifyReportReady,
  notifyDeadlineApproaching,
};
