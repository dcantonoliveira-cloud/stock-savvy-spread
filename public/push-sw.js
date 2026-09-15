// Service worker mínimo só pra push notification — sem cache, sem listener de "fetch",
// então não intercepta nem serve nada sozinho. Convive com o SW do vite-plugin-pwa
// (escopo /assessora): o navegador sempre usa o escopo mais específico por página.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'Rondello', message: 'Você tem uma notificação nova.' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // payload não veio em JSON — usa os valores padrão
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.message,
      icon: '/app-icon-192.png',
      badge: '/app-icon-192.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
