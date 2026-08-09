let isRefreshing = false;

export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    // When the new service worker takes control, reload once so the latest
    // deploy is picked up automatically — no user action needed.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (isRefreshing) return;
      isRefreshing = true;
      window.location.reload();
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered successfully:', registration.scope);

          // Check for updates periodically
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed') {
                  // Ask the new worker to activate immediately (skip waiting)
                  // so the controllerchange handler above can reload the app
                  // with the latest code.
                  if (navigator.serviceWorker.controller) {
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                  }
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    });
  }
}

export function unregisterServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error('Service Worker unregistration failed:', error);
      });
  }
}
