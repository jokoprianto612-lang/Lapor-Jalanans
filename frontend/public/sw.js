// Service Worker for Lapor Jalan PWA
// Provides offline support, caching, and background sync

const CACHE_NAME = 'lapor-jalan-v1';
const STATIC_CACHE = 'lapor-jalan-static-v1';
const DYNAMIC_CACHE = 'lapor-jalan-dynamic-v1';
const IMAGE_CACHE = 'lapor-jalan-images-v1';

// Files to cache immediately
const STATIC_ASSETS = [
  '/',
  '/chat',
  '/login',
  '/register',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Cache first - for static assets
  cacheFirst: async (request) => {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      return new Response('Offline', { status: 503 });
    }
  },
  
  // Network first - for API calls
  networkFirst: async (request) => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      return new Response(JSON.stringify({ error: 'Offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },
  
  // Stale while revalidate - for images
  staleWhileRevalidate: async (request) => {
    const cached = await caches.match(request);
    
    const fetchPromise = fetch(request).then(response => {
      if (response.ok) {
        const cache = caches.open(IMAGE_CACHE);
        cache.then(c => c.put(request, response.clone()));
      }
      return response;
    }).catch(() => cached);
    
    return cached || fetchPromise;
  }
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== IMAGE_CACHE)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - handle requests with appropriate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip cross-origin requests (except for API)
  if (url.origin !== location.origin && !url.pathname.startsWith('/api/')) return;
  
  // Determine strategy based on request type
  if (url.pathname.startsWith('/api/')) {
    // API calls - network first
    event.respondWith(CACHE_STRATEGIES.networkFirst(request));
  } else if (request.destination === 'image') {
    // Images - stale while revalidate
    event.respondWith(CACHE_STRATEGIES.staleWhileRevalidate(request));
  } else if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json'
  ) {
    // Static assets - cache first
    event.respondWith(CACHE_STRATEGIES.cacheFirst(request));
  } else {
    // HTML pages - network first with offline fallback
    event.respondWith(
      CACHE_STRATEGIES.networkFirst(request).catch(() => caches.match('/'))
    );
  }
});

// Background sync for offline reports
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(syncReports());
  }
});

// Sync pending reports when online
async function syncReports() {
  try {
    const db = await openDB();
    const pendingReports = await getPendingReports(db);
    
    for (const report of pendingReports) {
      try {
        const response = await fetch('/api/v1/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report.data)
        });
        
        if (response.ok) {
          await deletePendingReport(db, report.id);
          // Notify user
          self.registration.showNotification('Laporan Terkirim', {
            body: `Laporan "${report.data.title}" berhasil dikirim saat online`,
            icon: '/icons/icon-192x192.png',
            tag: `report-${report.id}`
          });
        }
      } catch (error) {
        console.error('Failed to sync report:', error);
      }
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

// IndexedDB helpers for offline storage
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('LaporJalanDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingReports')) {
        db.createObjectStore('pendingReports', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('offlineData')) {
        db.createObjectStore('offlineData');
      }
    };
  });
}

function getPendingReports(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pendingReports', 'readonly');
    const store = transaction.objectStore('pendingReports');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deletePendingReport(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pendingReports', 'readwrite');
    const store = transaction.objectStore('pendingReports');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options = {
    body: data.message,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/chat',
      reportId: data.reportId
    },
    actions: [
      { action: 'view', title: 'Lihat Detail' },
      { action: 'dismiss', title: 'Tutup' }
    ],
    tag: `notification-${data.reportId || Date.now()}`,
    renotify: true
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Lapor Jalan', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view' || !event.action) {
    const url = event.notification.data?.url || '/chat';
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
    );
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-updates') {
    event.waitUntil(checkForUpdates());
  }
});

async function checkForUpdates() {
  try {
    const response = await fetch('/api/v1/public/health');
    if (response.ok) {
      // Check for new version
      const registration = await self.registration.update();
      if (registration.installing) {
        // New version available
        self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ type: 'UPDATE_AVAILABLE' }));
        });
      }
    }
  } catch {
    // Ignore errors
  }
}

// Message handling from main thread
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data?.type === 'STORE_OFFLINE_REPORT') {
    storeOfflineReport(event.data.report);
  }
  
  if (event.data?.type === 'GET_CACHED_REPORTS') {
    getCachedReports().then(reports => {
      event.ports[0].postMessage({ reports });
    });
  }
});

// Store report for offline sync
async function storeOfflineReport(reportData) {
  try {
    const db = await openDB();
    const transaction = db.transaction('pendingReports', 'readwrite');
    const store = transaction.objectStore('pendingReports');
    
    await store.add({
      data: reportData,
      timestamp: Date.now(),
      synced: false
    });
    
    // Register background sync
    if ('sync' in self.registration) {
      await self.registration.sync.register('sync-reports');
    }
  } catch (error) {
    console.error('Failed to store offline report:', error);
  }
}

// Get cached reports for offline viewing
async function getCachedReports() {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const requests = await cache.keys();
    
    const reports = [];
    for (const request of requests) {
      if (request.url.includes('/reports/my')) {
        const response = await cache.match(request);
        const data = await response.json();
        reports.push(data);
      }
    }
    
    return reports;
  } catch {
    return [];
  }
}