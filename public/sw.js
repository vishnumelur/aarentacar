self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'New notification', body: event.data.text() };
  }
  const { title, body, url } = payload;
  event.waitUntil(
    self.registration.showNotification(title || 'AA Rent A Car', {
      body: body || '',
      icon: '/icons/driver-192.png',
      badge: '/icons/driver-192.png',
      data: { url: url || '/driver' },
      tag: 'aa-driver',
      renotify: true,
      requireInteraction: false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/driver';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client && client.url.includes(target)) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});
