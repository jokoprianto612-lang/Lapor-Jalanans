// Chat Store - Zustand for chat state management
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  metadata?: {
    images?: string[];
    location?: { latitude: number; longitude: number };
    aiAnalysis?: any;
    authorities?: any[];
    toolCalls?: any[];
    reportId?: string;
    trackingCode?: string;
  };
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messageCount: number;
  lastMessage?: { role: string; content: string };
  createdAt: string;
  updatedAt: string;
}

interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  
  // Actions
  setSessions: (sessions: ChatSession[]) => void;
  addSession: (session: ChatSession) => void;
  updateSession: (id: string, data: Partial<ChatSession>) => void;
  removeSession: (id: string) => void;
  setCurrentSession: (sessionId: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, data: Partial<ChatMessage>) => void;
  setLoading: (loading: boolean) => void;
  setSending: (sending: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      sessions: [],
      currentSessionId: null,
      messages: [],
      isLoading: false,
      isSending: false,
      error: null,

      setSessions: (sessions) => set({ sessions }),
      addSession: (session) => set((state) => ({ 
        sessions: [session, ...state.sessions] 
      })),
      updateSession: (id, data) => set((state) => ({
        sessions: state.sessions.map(s => s.id === id ? { ...s, ...data } : s)
      })),
      removeSession: (id) => set((state) => ({
        sessions: state.sessions.filter(s => s.id !== id),
        currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
        messages: state.currentSessionId === id ? [] : state.messages
      })),
      setCurrentSession: (sessionId) => set({ currentSessionId: sessionId, messages: [] }),
      setMessages: (messages) => set({ messages }),
      addMessage: (message) => set((state) => ({ 
        messages: [...state.messages, message] 
      })),
      updateMessage: (id, data) => set((state) => ({
        messages: state.messages.map(m => m.id === id ? { ...m, ...data } : m)
      })),
      setLoading: (isLoading) => set({ isLoading }),
      setSending: (isSending) => set({ isSending }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
      reset: () => set({ 
        sessions: [], 
        currentSessionId: null, 
        messages: [], 
        isLoading: false, 
        isSending: false, 
        error: null 
      })
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId
      })
    }
  )
);