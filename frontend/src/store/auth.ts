// Auth Store - Zustand with persistence
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  role: string;
  authorityId?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean | null; // null = checking, true/false = done
  isLoading: boolean;
  error: string | null;
  
  // Actions
  checkAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; name: string; phone?: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: null,
      isLoading: false,
      error: null,

      checkAuth: async () => {
        const token = get().accessToken;
        if (!token) {
          set({ isAuthenticated: false, isLoading: false });
          return;
        }

        set({ isLoading: true });
        try {
          const response = await api.get('/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          set({ 
            user: response.data.data.user, 
            isAuthenticated: true, 
            isLoading: false,
            error: null
          });
        } catch {
          // Token invalid/expired
          set({ 
            user: null, 
            accessToken: null, 
            isAuthenticated: false, 
            isLoading: false 
          });
        }
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/login', { email, password });
          const { user, token } = response.data.data;
          
          // Set token in api
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          set({ 
            user, 
            accessToken: token, 
            isAuthenticated: true, 
            isLoading: false 
          });
        } catch (error: any) {
          const message = error.response?.data?.error?.message || 'Login gagal';
          set({ error: message, isLoading: false, isAuthenticated: false });
          throw error;
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/register', data);
          const { user, token } = response.data.data;
          
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          set({ 
            user, 
            accessToken: token, 
            isAuthenticated: true, 
            isLoading: false 
          });
        } catch (error: any) {
          const message = error.response?.data?.error?.message || 'Registrasi gagal';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {
          // Ignore logout errors
        }
        
        delete api.defaults.headers.common['Authorization'];
        set({ 
          user: null, 
          accessToken: null, 
          isAuthenticated: false,
          error: null 
        });
      },

      updateProfile: async (data) => {
        const token = get().accessToken;
        if (!token) throw new Error('Not authenticated');
        
        set({ isLoading: true });
        try {
          const response = await api.patch('/auth/me', data, {
            headers: { Authorization: `Bearer ${token}` }
          });
          set({ user: response.data.data.user, isLoading: false });
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      changePassword: async (currentPassword, newPassword) => {
        const token = get().accessToken;
        if (!token) throw new Error('Not authenticated');
        
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/change-password', { currentPassword, newPassword }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          // Ganti password mencabut semua token lama (tokenVersion naik) —
          // simpan token baru supaya sesi berjalan tidak ikut mati.
          const newToken = response.data.data.token as string;
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          set({ accessToken: newToken, isLoading: false });
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      clearError: () => set({ error: null })
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user
      })
    }
  )
);

// Initialize auth on app start
if (typeof window !== 'undefined') {
  useAuthStore.getState().checkAuth();
}