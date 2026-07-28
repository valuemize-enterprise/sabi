/**
 * Push Notification Manager
 * Handles PWA push notification subscriptions and permissions
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get current notification permission status
 */
export function getPermissionStatus(): NotificationPermission {
  if (!isPushSupported()) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Check if user has already granted permission
 */
export function hasPermission(): boolean {
  return getPermissionStatus() === 'granted';
}

/**
 * Request notification permission from user
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported');
  }

  const permission = await Notification.requestPermission();
  console.log('[push] Permission:', permission);
  return permission;
}

/**
 * Get VAPID public key from backend
 */
async function getVapidPublicKey(): Promise<string> {
  const response = await fetch(`${API_BASE}/api/push-notifications/vapid-public-key`);
  
  if (!response.ok) {
    throw new Error('Failed to get VAPID public key');
  }

  const data = await response.json();
  return data.publicKey;
}

/**
 * Convert VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(token: string): Promise<boolean> {
  try {
    if (!isPushSupported()) {
      console.warn('[push] Push notifications not supported');
      return false;
    }

    // Check permission
    let permission = getPermissionStatus();
    if (permission === 'denied') {
      console.warn('[push] Notification permission denied');
      return false;
    }

    if (permission !== 'granted') {
      permission = await requestPermission();
      if (permission !== 'granted') {
        console.warn('[push] User denied notification permission');
        return false;
      }
    }

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;
    
    // Get existing subscription
    let subscription = await registration.pushManager.getSubscription();
    
    // If already subscribed, update on backend
    if (subscription) {
      console.log('[push] Already subscribed, updating backend...');
    } else {
      // Get VAPID public key
      const vapidPublicKey = await getVapidPublicKey();
      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

      // Subscribe to push manager
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as BufferSource,
      });
      
      console.log('[push] New subscription created');
    }

    // Send subscription to backend
    const response = await fetch(`${API_BASE}/api/push-notifications/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save subscription on backend');
    }

    const data = await response.json();
    console.log('[push] Subscription saved:', data);
    
    return true;
  } catch (error) {
    console.error('[push] Subscription failed:', error);
    return false;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(token: string): Promise<boolean> {
  try {
    if (!isPushSupported()) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      console.log('[push] No subscription found');
      return true;
    }

    const endpoint = subscription.endpoint;

    // Unsubscribe from push manager
    const unsubscribed = await subscription.unsubscribe();
    
    if (!unsubscribed) {
      console.warn('[push] Failed to unsubscribe from push manager');
      return false;
    }

    // Remove from backend
    const response = await fetch(`${API_BASE}/api/push-notifications/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ endpoint }),
    });

    if (!response.ok) {
      console.warn('[push] Failed to remove subscription from backend');
    }

    console.log('[push] Unsubscribed successfully');
    return true;
  } catch (error) {
    console.error('[push] Unsubscribe failed:', error);
    return false;
  }
}

/**
 * Get current subscription status
 */
export async function getSubscriptionStatus(): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}> {
  const supported = isPushSupported();
  const permission = getPermissionStatus();
  let subscribed = false;

  if (supported && permission === 'granted') {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      subscribed = !!subscription;
    } catch (error) {
      console.error('[push] Failed to check subscription status:', error);
    }
  }

  return { supported, permission, subscribed };
}

/**
 * Send test notification (dev only)
 */
export async function sendTestNotification(
  token: string,
  title?: string,
  body?: string,
  url?: string
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/push-notifications/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ title, body, url }),
    });

    if (!response.ok) {
      throw new Error('Failed to send test notification');
    }

    const data = await response.json();
    console.log('[push] Test notification sent:', data);
    return data.success;
  } catch (error) {
    console.error('[push] Test notification failed:', error);
    return false;
  }
}

/**
 * Show a local notification (for testing)
 */
export async function showLocalNotification(
  title: string,
  options?: NotificationOptions
): Promise<void> {
  if (!isPushSupported() || !hasPermission()) {
    console.warn('[push] Cannot show notification - no permission');
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    ...options,
  });
}
