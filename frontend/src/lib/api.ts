// API Client - Axios instance with interceptors
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 90000, // 90s — LLM can take up to 60s
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token from store if available
    if (typeof window !== 'undefined') {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        try {
          const { state } = JSON.parse(authStorage);
          if (state?.accessToken) {
            config.headers.Authorization = `Bearer ${state.accessToken}`;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 - token expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh token
        const refreshResponse = await axios.post(
          `${API_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        
        const newToken = refreshResponse.data.data.token;
        
        // Update stored token
        if (typeof window !== 'undefined') {
          const authStorage = localStorage.getItem('auth-storage');
          if (authStorage) {
            const parsed = JSON.parse(authStorage);
            parsed.state.accessToken = newToken;
            localStorage.setItem('auth-storage', JSON.stringify(parsed));
          }
        }
        
        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        // Refresh failed - minta backend hapus cookie auth_token (httpOnly,
        // tidak bisa dihapus dari JS) lalu clear auth dan redirect
        await axios.post(`${API_URL}/auth/logout`, {}, { withCredentials: true }).catch(() => undefined);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth-storage');
          window.location.href = '/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

// API helper functions
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: { email: string; name: string; phone?: string; password: string }) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateProfile: (data: any) => api.patch('/auth/me', data),
  changePassword: (currentPassword: string, newPassword: string) => api.post('/auth/change-password', { currentPassword, newPassword }),
  getCsrfToken: () => api.get('/auth/csrf-token'),
};

export const reportApi = {
  create: (data: any) => api.post('/reports', data),
  getMy: (params?: any) => api.get('/reports/my', { params }),
  getAssigned: (params?: any) => api.get('/reports/assigned', { params }),
  getById: (id: string) => api.get(`/reports/${id}`),
  getByTrackingCode: (trackingCode: string) => api.get(`/reports/track/${trackingCode}`),
  updateStatus: (id: string, data: any) => api.patch(`/reports/${id}/status`, data),
  assign: (id: string, assigneeId: string) => api.post(`/reports/${id}/assign`, { assigneeId }),
  addProgress: (id: string, data: any) => api.post(`/reports/${id}/progress`, data),
  getNearbyAuthorities: (data: any) => api.post('/reports/authorities/nearby', data),
  analyzeImage: (data: any) => api.post('/reports/analyze-image', data),
};

export const chatApi = {
  createSession: (title?: string) => api.post('/chat/sessions', { title }),
  getSessions: (params?: any) => api.get('/chat/sessions', { params }),
  getSession: (sessionId: string, params?: any) => api.get(`/chat/sessions/${sessionId}`, { params }),
  sendMessage: (sessionId: string, data: any) => api.post(`/chat/sessions/${sessionId}/messages`, data),
  analyzeImage: (data: any) => api.post('/chat/analyze-image', data),
  submitReport: (sessionId: string, data: any) => api.post(`/chat/sessions/${sessionId}/submit-report`, data),
  getConfig: () => api.get('/chat/config'),
  getMemoryStats: () => api.get('/chat/memory/stats'),
  deleteSession: (sessionId: string) => api.delete(`/chat/sessions/${sessionId}`),
};

export const authorityApi = {
  getNearby: (data: any) => api.post('/authorities/nearby', data),
  getInRadius: (data: any) => api.post('/authorities/in-radius', data),
  getById: (id: string) => api.get(`/authorities/${id}`),
  getByType: (type: string) => api.get(`/authorities/type/${type}`),
  search: (q: string) => api.get('/authorities/search', { params: { q } }),
  getTypes: () => api.get('/authorities/types'),
  getBoundary: (lat: number, lng: number) => api.post('/authorities/boundary', { latitude: lat, longitude: lng }),
  getContactLinks: (id: string, message?: string, reportUrl?: string) => 
    api.get(`/authorities/${id}/contact-links`, { params: { message, reportUrl } }),
};

export const publicApi = {
  trackReport: (trackingCode: string) => api.get(`/public/track/${trackingCode}`),
  getNearbyAuthorities: (data: any) => api.post('/public/authorities/nearby', data),
  getAuthority: (id: string) => api.get(`/public/authorities/${id}`),
  getAuthoritiesByType: (type: string) => api.get(`/public/authorities/type/${type}`),
  searchKnowledge: (q: string, limit?: number) => api.get('/public/knowledge/search', { params: { q, limit } }),
  getCategories: () => api.get('/public/knowledge/categories'),
  getCategoryDocs: (category: string) => api.get(`/public/knowledge/category/${category}`),
  health: () => api.get('/public/health'),
  info: () => api.get('/public/info'),
};

export const adminApi = {
  getDashboard: (params?: any) => api.get('/admin/dashboard', { params }),
  getUsers: (params?: any) => api.get('/admin/users', { params }),
  getUser: (id: string) => api.get(`/admin/users/${id}`),
  updateUserRole: (id: string, role: string, authorityId?: string) => api.patch(`/admin/users/${id}/role`, { role, authorityId }),
  getReports: (params?: any) => api.get('/admin/reports', { params }),
  updateReportStatus: (id: string, data: any) => api.patch(`/admin/reports/${id}/status`, data),
  getAIMetrics: (window?: string) => api.get('/admin/observability/metrics', { params: { window } }),
  getTraces: (params?: any) => api.get('/admin/observability/traces', { params }),
  getGuardrailStats: () => api.get('/admin/observability/guardrails'),
  getObservabilityStats: () => api.get('/admin/observability/stats'),
  exportTraces: (sessionId?: string) => api.get('/admin/observability/export', { params: { sessionId }, responseType: 'blob' }),
  getMemoryStats: (userId?: string) => api.get('/admin/memory/stats', { params: { userId } }),
  getConfigs: () => api.get('/admin/config'),
  setConfig: (data: any) => api.post('/admin/config', data),
  deleteConfig: (key: string) => api.delete(`/admin/config/${key}`),
  seedAuthorities: () => api.post('/admin/maintenance/seed-authorities'),
  cleanupSessions: () => api.post('/admin/maintenance/cleanup-old-sessions'),
  cleanupTraces: () => api.post('/admin/maintenance/cleanup-old-traces'),
};

export const wsApi = {
  getStats: () => api.get('/ws/stats'),
  broadcastReportUpdate: (reportId: string, update: any) => api.post('/ws/broadcast/report', { reportId, update }),
  broadcastNotification: (userId: string, notification: any) => api.post('/ws/broadcast/notification', { userId, notification }),
};

export default api;