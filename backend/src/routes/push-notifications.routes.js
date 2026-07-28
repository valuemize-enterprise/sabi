/**
 * ═══════════════════════════════════════════════════════════════
 * Push Notification Routes
 * ═══════════════════════════════════════════════════════════════
 * API endpoints for managing PWA push notification subscriptions
 */

'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const pushService = require('../services/push-notification.service');

// ── Get VAPID public key ────────────────────────────────────────
// Public endpoint - needed for frontend to subscribe

router.get('/vapid-public-key', (req, res) => {
  const publicKey = pushService.getVapidPublicKey();
  
  if (!publicKey) {
    return res.status(503).json({
      success: false,
      message: 'Push notifications not configured',
    });
  }

  res.json({
    success: true,
    publicKey,
  });
});

// ── Subscribe to push notifications ─────────────────────────────

router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription data',
      });
    }

    const result = await pushService.saveSubscription(userId, subscription);

    if (result.success) {
      res.json({
        success: true,
        message: 'Subscription saved successfully',
        data: result.data,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to save subscription',
        error: result.error,
      });
    }
  } catch (error) {
    console.error('[push-routes] Subscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// ── Unsubscribe from push notifications ─────────────────────────

router.post('/unsubscribe', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Endpoint is required',
      });
    }

    const result = await pushService.removeSubscription(userId, endpoint);

    if (result.success) {
      res.json({
        success: true,
        message: 'Unsubscribed successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to unsubscribe',
        error: result.error,
      });
    }
  } catch (error) {
    console.error('[push-routes] Unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// ── Get user's subscriptions ────────────────────────────────────

router.get('/subscriptions', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const subscriptions = await pushService.getUserSubscriptions(userId);

    res.json({
      success: true,
      data: subscriptions,
      count: subscriptions.length,
    });
  } catch (error) {
    console.error('[push-routes] Get subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// ── Test notification (dev only) ────────────────────────────────

if (process.env.NODE_ENV !== 'production') {
  router.post('/test', authenticate, async (req, res) => {
    try {
      const userId = req.user.id;
      const { title, body, url } = req.body;

      const result = await pushService.sendNotification(userId, {
        title: title || 'Test Notification',
        body: body || 'This is a test notification from Sabi Intelligence Suite',
        url: url || '/dashboard',
        data: { test: true, timestamp: Date.now() },
      });

      res.json({
        success: result.success,
        message: result.success ? 'Test notification sent' : 'Failed to send notification',
        details: result,
      });
    } catch (error) {
      console.error('[push-routes] Test notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });
}

module.exports = router;
