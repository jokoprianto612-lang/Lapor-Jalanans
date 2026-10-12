// Service Worker Registration Hook
'use client';

import { useEffect, useState } from 'react';

export function useSWRegistration() {
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        
        setSwRegistration(registration);
        console.log('[SW] Registered:', registration.scope);
        
        // Handle controller change
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });

        // Check if already controlling
        if (registration.active && !registration.installing) {
          setOfflineReady(true);
        } else {
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated') {
                  setOfflineReady(true);
                }
              });
            }
          });
        }

        // Listen for messages from SW
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'UPDATE_AVAILABLE') {
            setUpdateAvailable(true);
          }
        });

      } catch (error) {
        console.error('[SW] Registration failed:', error);
      }
    };

    registerSW();

    // Check for updates periodically
    const interval = setInterval(() => {
      if (swRegistration) {
        swRegistration.update().catch(console.error);
      }
    }, 60 * 60 * 1000); // Every hour

    return () => {
      clearInterval(interval);
    };
  }, [swRegistration]);

  const update = async () => {
    if (swRegistration) {
      await swRegistration.update();
    }
  };

  const unregister = async () => {
    if (swRegistration) {
      await swRegistration.unregister();
      setSwRegistration(null);
    }
  };

  return {
    swRegistration,
    updateAvailable,
    offlineReady,
    update,
    unregister
  };
}

// Hook for offline report storage
export function useOfflineReports() {
  const [db, setDb] = useState<IDBDatabase | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return;

    const request = indexedDB.open('LaporJalanDB', 1);
    
    request.onerror = () => console.error('[OfflineDB] Failed to open');
    request.onsuccess = () => setDb(request.result);
    
    request.onupgradeneeded = (event) => {
      const database = event.target as unknown as IDBDatabase;
      if (!database.objectStoreNames.contains('pendingReports')) {
        database.createObjectStore('pendingReports', { keyPath: 'id', autoIncrement: true });
      }
      if (!database.objectStoreNames.contains('cachedReports')) {
        database.createObjectStore('cachedReports', { keyPath: 'trackingCode' });
      }
    };
  }, []);

  const savePendingReport = (reportData: any): Promise<number> => {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('DB not ready'));
      
      const transaction = db.transaction('pendingReports', 'readwrite');
      const store = transaction.objectStore('pendingReports');
      
      const request = store.add({
        data: reportData,
        timestamp: Date.now(),
        synced: false
      });
      
      request.onsuccess = () => resolve(request.result as unknown as number);
      request.onerror = () => reject(request.error);
    });
  };

  const getPendingReports = (): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      if (!db) return resolve([]);
      
      const transaction = db.transaction('pendingReports', 'readonly');
      const store = transaction.objectStore('pendingReports');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const markReportSynced = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!db) return resolve();
      
      const transaction = db.transaction('pendingReports', 'readwrite');
      const store = transaction.objectStore('pendingReports');
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const report = getRequest.result;
        if (report) {
          report.synced = true;
          const putRequest = store.put(report);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  };

  const cacheReport = (trackingCode: string, reportData: any): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!db) return resolve();
      
      const transaction = db.transaction('cachedReports', 'readwrite');
      const store = transaction.objectStore('cachedReports');
      
      const request = store.put({
        trackingCode,
        data: reportData,
        cachedAt: Date.now()
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  };

  const getCachedReport = (trackingCode: string): Promise<any | null> => {
    return new Promise((resolve, reject) => {
      if (!db) return resolve(null);
      
      const transaction = db.transaction('cachedReports', 'readonly');
      const store = transaction.objectStore('cachedReports');
      const request = store.get(trackingCode);
      
      request.onsuccess = () => resolve(request.result?.data || null);
      request.onerror = () => reject(request.error);
    });
  };

  const getAllCachedReports = (): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      if (!db) return resolve([]);
      
      const transaction = db.transaction('cachedReports', 'readonly');
      const store = transaction.objectStore('cachedReports');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result.map(r => r.data));
      request.onerror = () => reject(request.error);
    });
  };

  return {
    db,
    savePendingReport,
    getPendingReports,
    markReportSynced,
    cacheReport,
    getCachedReport,
    getAllCachedReports
  };
}

// Hook for online/offline status
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);
    
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    
    // Initial check
    updateStatus();
    
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  return isOnline;
}