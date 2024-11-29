// Chat types
export interface ChatMessage {
  id: number;
  threadId: number;
  senderId: string; // Can be lead ID or staff ID
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
  type: 'lead' | 'staff';
}

export interface ChatThread {
  id: number;
  leadId: number;
  lastMessage?: ChatMessage;
  unreadCount: number;
  status: 'active' | 'archived' | 'resolved';
  assignedTo?: number; // Staff ID
  createdAt: string;
  updatedAt: string;
}

// Lead types
export interface LeadHistory {
  id: number;
  leadId: number;
  type: 'status_change' | 'note' | 'contact';
  description: string;
  oldStatus?: LeadStatus;
  newStatus?: LeadStatus;
  createdAt: string;
  createdBy: number;
}

export interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  source?: 'form' | 'manual' | 'chat';
  notes?: string;
  value: number;
  status: LeadStatus;
  createdAt: string;
  history?: LeadHistory[];
  lastContact?: string;
  nextContactDate?: string;
  interests?: string[];
  unitId: number;
  assignedTo?: number;
}

export type LeadStatus = 'novo' | 'contato' | 'visitou' | 'matriculado' | 'desistente';

// Add missing types
export interface Student {
  id: number;
  name: string;
  belt: string;
  age: number;
  registrationDate: string;
  lastAttendance: string;
  unitId: number;
  birthDate: string;
  cpf: string;
  rg?: string;
  phone: string;
  email?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  bloodType?: string;
  weight?: string;
  height?: string;
  healthIssues?: string;
  medications?: string;
  guardianName?: string;
  guardianCPF?: string;
  guardianPhone?: string;
  trainingDays?: string[];
  trainingSchedule?: string;
  paymentDay?: number;
  active: boolean;
  favoriteContent?: number[]; // IDs dos conteúdos favoritados
  completedContent?: number[]; // IDs dos conteúdos completados
  contentProgress?: { [key: number]: number }; // Progresso por conteúdo
  photo?: string;
  observations?: string;
  contract?: {
    endDate: string;
    active: boolean;
    planName?: string;
    startDate?: string;
    value?: number;
  };
}

export interface AttendanceRecord {
  id: number;
  studentId: number;
  date: string;
  present: boolean;
  unitId: number;
}

export interface Unit {
  id: number;
  name: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  manager: string;
  isFixed?: boolean;
}

export interface User {
  id: number;
  name: string;
  email: string;
  password?: string; //In a real application, this should be hashed
  role: string;
  unitId?: number;
  photo?: string;
  firstLogin?: boolean;
  studentId?: number;
}

// Online Content types
export interface OnlineContent {
  id: number;
  title: string;
  description: string;
  type: 'video' | 'image' | 'document';
  url?: string;
  thumbnailUrl?: string;
  youtubeUrl?: string;
  category?: string;
  tags?: string[];
  targetStudentIds?: number[];
  targetBelts?: string[];
  unitId?: number;
  createdAt: string;
  updatedAt: string;
  isPublished: boolean;
  uploadStatus?: 'pending' | 'uploading' | 'processing' | 'complete' | 'error';
  uploadProgress?: number;
  authorId: number;
  status?: 'draft' | 'published' | 'archived';
  createdBy?: number;
  fileSize?: number;
  fileName?: string;
}

export interface ContentEngagement {
  id: number;
  contentId: number;
  studentId: number;
  type: 'view' | 'like' | 'comment' | 'complete';
  timestamp: string;
  comment?: string;
  progress?: number;
}

export interface LiveClass {
  id: number;
  title: string;
  description: string;
  type: 'live';
  instructorId: number;
  scheduledFor: string;
  duration: number;
  status: 'scheduled' | 'live' | 'ended';
  url?: string;
  thumbnailUrl?: string;
  category?: string;
  tags?: string[];
  targetStudentIds?: number[];
  targetBelts?: string[];
  unitId?: number;
  createdAt: string;
  updatedAt: string;
  isPublished: boolean;
  authorId: number;
}

export interface Badge {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  criteria: string;
  unitId?: number;
  type?: 'belt' | 'achievement';
  beltLevel?: string;
  icon?: string;
  color?: string;
  category?: string;
}

export interface StudentBadge {
  id: number;
  studentId: number;
  badgeId: number;
  awardedAt: string;
  awardedBy: number;
}

export interface PhysicalTest {
  id: number;
  studentId: number;
  date: string;
  type: string;
  result: number;
  notes?: string;
  evaluatorId: number;
}

// Class Management
export interface Class {
  id: number;
  title: string;
  description: string;
  instructor: string;
  schedule: string;
  duration: number;
  maxCapacity: number;
  unitId: number;
  createdAt: string;
  updatedAt: string;
}

// Messaging
export interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  timestamp: string;
  read: boolean;
  type: 'system' | 'user';
}

// Task Management
export interface Task {
  id: number;
  title: string;
  description: string;
  assignedTo: number;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

// Notifications
export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  createdAt: string;
}

// Contract Templates
export interface ContractTemplate {
  id: number;
  name: string;
  content: string;
  variables: string[];
  unitId?: number;
  createdAt: string;
  updatedAt: string;
}
