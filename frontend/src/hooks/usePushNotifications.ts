'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getSubscriptionStatus,
  isPushSupported,
  hasPermission,
} from '@/lib/pushNotifications';

interface UsePushNotificationsOptions {
  /** Auth token for API calls */
  token?: string;
  /** Auto-subscribe on mount if permission granted */
  autoSubscribe?: boolean;
}

interface UsePushNotificationsReturn {
  /** Whether push notifications are supported */
  isSupported: boolean;
  /** Current notification permission status */
  permission: NotificationPermission;
  /** Whether user is subscribed to push notifications */
  isSubscribed: boolean;
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Subscribe to push notifications */
  subscribe: () => Promise<boolean>;
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<boolean>;
  /** Refresh subscription status */
  refresh: () => Promise<void>;
}

export function usePushNotifications(
  options: UsePushNotificationsOptions = {}
): UsePushNotificationsReturn {
  const { token, autoSubscribe = false } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    const status = await getSubscriptionStatus();
    setIsSupported(status.supported);
    setPermission(status.permission);
    setIsSubscribed(status.subscribed);
  }, []);

  useEffect(() => {
    // Check if push is supported
    setIsSupported(isPushSupported());
    
    // Initial status check
    refresh();
  }, [refresh]);

  useEffect(() => {
    // Auto-subscribe if enabled and permission granted
    if (autoSubscribe && token && hasPermission() && !isSubscribed && !isLoading) {
      subscribe();
    }
  }, [autoSubscribe, token, isSubscribed, isLoading]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!token) {
      console.error('[usePushNotifications] No token provided');
      return false;
    }

    if (isLoading) {
      console.warn('[usePushNotifications] Operation already in progress');
      return false;
    }

    setIsLoading(true);
    try {
      const success = await subscribeToPushNotifications(token);
      if (success) {
        await refresh();
      }
      return success;
    } catch (error) {
      console.error('[usePushNotifications] Subscribe failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [token, isLoading, refresh]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!token) {
      console.error('[usePushNotifications] No token provided');
      return false;
    }

    if (isLoading) {
      console.warn('[usePushNotifications] Operation already in progress');
      return false;
    }

    setIsLoading(true);
    try {
      const success = await unsubscribeFromPushNotifications(token);
      if (success) {
        await refresh();
      }
      return success;
    } catch (error) {
      console.error('[usePushNotifications] Unsubscribe failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [token, isLoading, refresh]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    refresh,
  };
}
