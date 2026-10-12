// Report Store - Zustand for report state management
import { create } from 'zustand';

export interface Report {
  id: string;
  trackingCode: string;
  title: string;
  description: string;
  damageType: string;
  severity: string;
  status: string;
  latitude: number;
  longitude: number;
  address: string;
  images: string[];
  aiAnalysis: any;
  aiConfidence: number | null;
  qrCode: string | null;
  authorityName: string;
  authorityContact: string | null;
  submittedAt: string;
  verifiedAt: string | null;
  routedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  updates: ReportUpdate[];
}

export interface ReportUpdate {
  id: string;
  reportId: string;
  authorId: string;
  status: string;
  message: string;
  images: string[];
  createdAt: string;
  author?: { name: string };
}

interface ReportState {
  reports: Report[];
  currentReport: Report | null;
  isLoading: boolean;
  error: string | null;
  pagination: { page: number; limit: number; total: number; totalPages: number } | null;
  
  // Actions
  setReports: (reports: Report[], pagination?: any) => void;
  addReport: (report: Report) => void;
  updateReport: (id: string, data: Partial<Report>) => void;
  removeReport: (id: string) => void;
  setCurrentReport: (report: Report | null) => void;
  addUpdate: (reportId: string, update: ReportUpdate) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useReportStore = create<ReportState>((set) => ({
  reports: [],
  currentReport: null,
  isLoading: false,
  error: null,
  pagination: null,

  setReports: (reports, pagination) => set({ reports, pagination }),
  addReport: (report) => set((state) => ({ reports: [report, ...state.reports] })),
  updateReport: (id, data) => set((state) => ({
    reports: state.reports.map(r => r.id === id ? { ...r, ...data } : r),
    currentReport: state.currentReport?.id === id ? { ...state.currentReport, ...data } : state.currentReport
  })),
  removeReport: (id) => set((state) => ({
    reports: state.reports.filter(r => r.id !== id),
    currentReport: state.currentReport?.id === id ? null : state.currentReport
  })),
  setCurrentReport: (report) => set({ currentReport: report }),
  addUpdate: (reportId, update) => set((state) => ({
    reports: state.reports.map(r => 
      r.id === reportId ? { ...r, updates: [update, ...r.updates] } : r
    ),
    currentReport: state.currentReport?.id === reportId 
      ? { ...state.currentReport, updates: [update, ...state.currentReport.updates] } 
      : state.currentReport
  })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));