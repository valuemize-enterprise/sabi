'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getSubscriptionStatus,
  isPushSupported,
} from '@/lib/pushNotifications';

interface PushNotificationSetupProps {
  /** Auth token for API calls */
  token?: string;
  /** Show as banner (default) or inline component */
  variant?: 'banner' | 'inline';
  /** Auto-hide banner after user dismisses */
  dismissible?: boolean;
}

export function PushNotificationSetup({
  token,
  variant = 'banner',
  dismissible = true,
}: PushNotificationSetupProps) {
  const [status, setStatus] = useState<{
    supported: boolean;
    permission: NotificationPermission;
    subscribed: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if user previously dismissed
    const dismissed = localStorage.getItem('push-notification-banner-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }

    // Check subscription status
    checkStatus();
  }, []);

  const checkStatus = async () => {
    const currentStatus = await getSubscriptionStatus();
    setStatus(currentStatus);
  };

  const handleSubscribe = async () => {
    if (!token) {
      console.error('No auth token provided');
      return;
    }

    setIsLoading(true);
    try {
      const success = await subscribeToPushNotifications(token);
      if (success) {
        await checkStatus();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!token) {
      console.error('No auth token provided');
      return;
    }

    setIsLoading(true);
    try {
      const success = await unsubscribeFromPushNotifications(token);
      if (success) {
        await checkStatus();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    if (dismissible) {
      localStorage.setItem('push-notification-banner-dismissed', 'true');
    }
  };

  // Don't show if not supported
  if (!status || !isPushSupported()) {
    return null;
  }

  // Don't show if dismissed (for banner)
  if (variant === 'banner' && isDismissed) {
    return null;
  }

  // Don't show banner if already subscribed or denied
  if (variant === 'banner' && (status.subscribed || status.permission === 'denied')) {
    return null;
  }

  // Inline variant - always show status
  if (variant === 'inline') {
    return (
      <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${status.subscribed ? 'bg-green-500/10' : 'bg-gray-500/10'}`}>
            {status.subscribed ? (
              <Bell className="w-5 h-5 text-green-400" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-white mb-1">
              Push Notifications
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              {status.subscribed
                ? 'You will receive notifications for important updates'
                : status.permission === 'denied'
                ? 'Notifications are blocked. Enable them in your browser settings.'
                : 'Get notified about important updates and activities'}
            </p>
            
            {status.permission !== 'denied' && (
              <button
                onClick={status.subscribed ? handleUnsubscribe : handleSubscribe}
                disabled={isLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  status.subscribed
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isLoading
                  ? 'Loading...'
                  : status.subscribed
                  ? 'Turn Off Notifications'
                  : 'Enable Notifications'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Banner variant
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white/10 rounded-lg">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white mb-1">
              Stay Updated
            </h3>
            <p className="text-xs text-white/90 mb-3">
              Enable notifications to get real-time updates about your tasks, goals, and team activities
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSubscribe}
                disabled={isLoading}
                className="px-4 py-2 bg-white text-blue-600 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Enabling...' : 'Enable'}
              </button>
              {dismissible && (
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors"
                >
                  Maybe Later
                </button>
              )}
            </div>
          </div>
          {dismissible && (
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
