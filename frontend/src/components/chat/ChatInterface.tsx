// Chat Components - Main chat interface for reporting
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore } from '@/store/chat';
import { useAuthStore } from '@/store/auth';
import { chatApi } from '@/lib/api';
import { Button, Input, Textarea, Card, Badge, Avatar, Spinner } from '@/components/ui';
import { ImageUpload } from './ImageUpload';
import { LocationPicker } from './LocationPicker';
import { MessageBubble } from './MessageBubble';
import { AuthorityCard } from './AuthorityCard';
import { AnalysisCard } from './AnalysisCard';
import { ReportPreview } from './ReportPreview';
import { Send, Mic, Paperclip, MapPin, Camera, Bot, User, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function ChatInterface() {
  const [showImagePicker, setShowImagePicker] = useState(false);
  const { user, isAuthenticated } = useAuthStore();
  const { 
    sessions, 
    currentSessionId, 
    messages, 
    isLoading, 
    isSending,
    setCurrentSession,
    setMessages,
    addMessage,
    addSession,
    setSending,
    setError,
    clearError
  } = useChatStore();
  
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draftReport, setDraftReport] = useState<any>(null);
  const [showReportPreview, setShowReportPreview] = useState(false);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load session messages when session changes
  useEffect(() => {
    if (currentSessionId) {
      loadSessionMessages(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId, setMessages]);

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const response = await chatApi.getSession(sessionId);
      const msgs = response.data.data.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        metadata: m.metadata,
        createdAt: m.createdAt
      }));
      setMessages(msgs);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && images.length === 0 && !location) return;
    if (!currentSessionId) {
      // Create new session
      try {
        const response = await chatApi.createSession('Laporan Baru');
        const newSessionId = response.data.data.session.id;
        addSession(response.data.data.session);
        setCurrentSession(newSessionId);
        // Send message after session created
        await sendMessage(newSessionId);
      } catch (error) {
        toast.error('Gagal membuat sesi baru');
      }
    } else {
      await sendMessage(currentSessionId);
    }
  };

  const sendMessage = async (sessionId: string) => {
    const messageContent = input.trim();
    const messageImages = [...images];
    const messageLocation = location;
    
    // Clear input immediately for better UX
    setInput('');
    setImages([]);
    setLocation(null);
    setSending(true);
    clearError();

    // Add user message optimistically
    const tempId = `temp-${Date.now()}`;
    const userMessage = {
      id: tempId,
      role: 'USER' as const,
      content: messageContent || '📷 Foto kerusakan jalan',
      metadata: { images: messageImages, location: messageLocation ?? undefined },
      createdAt: new Date().toISOString()
    };
    addMessage(userMessage);

    try {
      const response = await chatApi.sendMessage(sessionId, {
        message: messageContent,
        images: messageImages,
        location: messageLocation
      });
      
      // Remove temp message, add real response
      // (In real app, you'd update the temp message with server response)
      const aiResponse = response.data.data;
      
      // Add AI response
      const aiMessage = {
        id: `ai-${Date.now()}`,
        role: 'ASSISTANT' as const,
        content: aiResponse.message,
        metadata: {
          aiAnalysis: aiResponse.aiAnalysis,
          authorities: aiResponse.authorities,
          toolCalls: aiResponse.metadata?.toolCalls
        },
        createdAt: new Date().toISOString()
      };
      addMessage(aiMessage);
      
      // Check if AI returned a draft report
      if (aiResponse.metadata?.toolCalls?.some((tc: any) => tc.name === 'create_report')) {
        // Report was created, show preview
        setShowReportPreview(true);
      }
      
    } catch (error: any) {
      console.error('Send message error:', error);
      const errorMsg = error.response?.data?.error?.message || 'Gagal mengirim pesan';
      toast.error(errorMsg);
      
      // Add error message
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: 'SYSTEM' as const,
        content: `❌ ${errorMsg}`,
        metadata: {},
        createdAt: new Date().toISOString()
      };
      addMessage(errorMessage);
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = (newImages: string[]) => {
    setImages(prev => [...prev, ...newImages].slice(0, 5));
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleLocationSelect = (loc: { latitude: number; longitude: number }) => {
    setLocation(loc);
    setShowLocationPicker(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);
      setAudioChunks([]);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          setAudioChunks(prev => [...prev, e.data]);
        }
      };
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        // TODO: Send audio to speech-to-text API
        // For now, just stop recording
        stream.getTracks().forEach(t => t.stop());
      };
      
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      toast.error('Tidak bisa mengakses mikrofon');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const createNewSession = async () => {
    try {
      const response = await chatApi.createSession('Laporan Baru');
      const session = response.data.data.session;
      addSession(session);
      setCurrentSession(session.id);
    } catch (error) {
      toast.error('Gagal membuat sesi baru');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="w-full max-w-md p-8 text-center">
          <Bot className="w-16 h-16 mx-auto text-primary-600 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Masuk untuk Melapor</h2>
          <p className="text-secondary-600 dark:text-secondary-300 mb-6">
            Silakan login atau daftar untuk mulai melaporkan kerusakan jalan
          </p>
          <div className="flex flex-col gap-3">
            <Button className="w-full" onClick={() => window.location.href = '/login'}>
              Login
            </Button>
            <Button variant="outline" className="w-full" onClick={() => window.location.href = '/register'}>
              Daftar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-white dark:bg-secondary-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-secondary-200 dark:border-secondary-700 px-4 py-3 bg-white/80 dark:bg-secondary-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={createNewSession}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Laporan Baru</span>
          </Button>
          <h1 className="font-semibold text-secondary-900 dark:text-white">
            {sessions.find(s => s.id === currentSessionId)?.title || 'Lapor Jalan'}
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Avatar 
            src={user?.avatar} 
            alt={user?.name} 
            fallback={user?.name?.charAt(0)} 
            size="sm" 
          />
          <span className="text-sm text-secondary-600 dark:text-secondary-300 hidden sm:block">
            {user?.name}
          </span>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center text-secondary-500 dark:text-secondary-400">
            <Bot className="w-16 h-16 mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Mulai Laporan Baru</h3>
            <p className="text-sm max-w-xs">
              Kirim foto kerusakan jalan, AI akan menganalisis dan menentukan instansi yang bertanggung jawab
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center text-xs text-secondary-400">
              <span className="px-3 py-1 bg-secondary-100 dark:bg-secondary-800 rounded-full">📸 Foto lubang/retak</span>
              <span className="px-3 py-1 bg-secondary-100 dark:bg-secondary-800 rounded-full">📍 Lokasi GPS</span>
              <span className="px-3 py-1 bg-secondary-100 dark:bg-secondary-800 rounded-full">🤖 Analisis AI</span>
              <span className="px-3 py-1 bg-secondary-100 dark:bg-secondary-800 rounded-full">📋 Ke instansi</span>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble 
                key={message.id} 
                message={message} 
                isOwn={message.role === 'USER'}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* Typing indicator */}
        {isSending && (
          <div className="flex items-center gap-2 text-secondary-500 dark:text-secondary-400 animate-pulse">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">AI sedang mengetik...</span>
          </div>
        )}
      </main>

      {/* Image Preview Bar */}
      {images.length > 0 && (
        <div className="px-4 py-2 border-t border-secondary-200 dark:border-secondary-700 bg-white/50 dark:bg-secondary-900/50">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden">
                <img src={img} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                  aria-label="Hapus foto"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location Bar */}
      {location && (
        <div className="px-4 py-2 border-t border-secondary-200 dark:border-secondary-700 bg-primary-50 dark:bg-primary-900/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary-700 dark:text-primary-300">
            <MapPin className="w-4 h-4" />
            <span className="text-sm font-medium">Lokasi dipilih</span>
            <Badge variant="primary" className="text-xs">
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowLocationPicker(true)}>
            Ubah
          </Button>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-secondary-200 dark:border-secondary-700 bg-white/80 dark:bg-secondary-900/80 backdrop-blur-sm">
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowImagePicker(true)}
            aria-label="Tambah foto"
            disabled={images.length >= 5}
          >
            <Camera className="w-5 h-5" />
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowLocationPicker(true)}
            aria-label="Tambah lokasi"
          >
            <MapPin className="w-5 h-5" />
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={isRecording ? stopRecording : startRecording}
            aria-label={isRecording ? 'Hentikan rekam' : 'Rekam suara'}
            className={isRecording ? 'text-danger-500 animate-pulse' : ''}
          >
            <Mic className="w-5 h-5" />
          </Button>
          
          <div className="flex-1 relative">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? 'Mendengarkan...' : 'Ketik pesan atau kirim foto lokasi...'}
              rows={1}
              className="pr-12 min-h-[44px] max-h-[120px]"
              disabled={isSending}
            />
          </div>
          
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() && images.length === 0 && !location || isSending}
            aria-label="Kirim pesan"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
        
        <p className="text-xs text-secondary-400 dark:text-secondary-500 mt-2 text-center">
          Enter untuk kirim • Shift+Enter untuk baris baru • Maks 5 foto
        </p>
      </form>

      {/* Modals */}
      {showImagePicker && (
        <ImageUpload 
          onUpload={handleImageUpload} 
          onClose={() => setShowImagePicker(false)}
          maxFiles={5 - images.length}
          existingImages={images}
        />
      )}
      
      {showLocationPicker && (
        <LocationPicker 
          onSelect={handleLocationSelect} 
          onClose={() => setShowLocationPicker(false)}
          initialLocation={location}
        />
      )}
      
      {showReportPreview && draftReport && (
        <ReportPreview 
          report={draftReport} 
          onClose={() => setShowReportPreview(false)}
          onSubmit={() => {
            // Submit final report
            setShowReportPreview(false);
            toast.success('Laporan berhasil dikirim!');
          }}
        />
      )}
    </div>
  );
}

export default ChatInterface;