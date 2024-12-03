export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  source: string;
  notes: string;
  unitId: string;
  value: number;
  history: LeadHistory[];
  createdAt: Date;
  updatedAt: Date;
}

export type LeadHistory = {
  id: string;
  leadId: string;
  type: 'status_change' | 'note' | 'contact';
  description: string;
  oldStatus?: LeadStatus;
  newStatus?: LeadStatus;
  createdAt: string;
  createdBy: string;
};

export type LeadStatus = 'novo' | 'contato' | 'visitou' | 'matriculado' | 'desistente';

export interface Unit {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  active: boolean;
  subunits?: SubUnit[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SubUnit {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  active: boolean;
  parentUnitId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'instructor' | 'student';
  unitId: string;
  subUnitId?: string;
  active: boolean;
  photo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  belt: string;
  unitId: string;
  subUnitId?: string;
  instructorId: string;
  instructor: Instructor;
  active: boolean;
  contract: Contract;
  badges: StudentBadge[];
  physicalTests: PhysicalTest[];
  storeId: string;
  store: Store;
  photo?: string;
  favoriteContent?: string[];
  completedContent?: string[];
  birthDate: string;
  cpf: string;
  trainingDays: string[];
  trainingSchedule: string;
  emergencyContact: string;
  emergencyPhone: string;
  age: number;
  registrationDate: string;
  lastAttendance: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Instructor {
  id: string;
  name: string;
  email: string;
  phone: string;
  belt: string;
  unitId: string;
  subUnitId?: string;
  active: boolean;
  students: Student[];
  commissionRate: number;
  commissions: Commission[];
  totalCommission: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Class {
  id: string;
  name: string;
  description: string;
  schedule: string;
  instructorId: string;
  unitId: string;
  subUnitId?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  read: boolean;
  type: 'user';
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'completed';
  assignedTo: string;
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  userId: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractTemplate {
  id: string;
  name: string;
  content: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Contract {
  id: string;
  studentId: string;
  templateId: string;
  content: string;
  status: 'draft' | 'active' | 'expired' | 'cancelled';
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnlineContent {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'document' | 'quiz' | 'image';
  url: string;
  active: boolean;
  uploadStatus?: 'pending' | 'uploading' | 'completed' | 'error';
  uploadProgress?: number;
  isPublished?: boolean;
  thumbnailUrl?: string;
  category?: string;
  tags?: string[];
  targetStudentIds?: string[];
  targetBelts?: string[];
  unitId?: string;
  subUnitId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LiveClass {
  id: string;
  title: string;
  description: string;
  instructorId: string;
  startTime: Date;
  endTime: Date;
  url: string;
  active: boolean;
  type: 'live';
  status: 'scheduled' | 'live' | 'ended';
  duration: number;
  scheduledFor: string;
  thumbnailUrl?: string;
  category?: string;
  tags?: string[];
  targetStudentIds?: string[];
  targetBelts?: string[];
  unitId?: string;
  subUnitId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentEngagement {
  id: string;
  studentId: string;
  contentId: string;
  type: 'view' | 'complete' | 'like' | 'comment';
  progress: number;
  completed: boolean;
  comment?: string;
  timestamp: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  image?: string;
  criteria?: string;
  active: boolean;
  category: 'belt' | 'achievement' | 'special';
  type?: 'belt' | 'achievement';
  beltLevel?: string;
  color: string;
  icon: string;
  unitId?: number;
  createdBy?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentBadge {
  id: string;
  studentId: string;
  badgeId: string;
  awardedAt: string;
  awardedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PhysicalTest {
  id: string;
  studentId: string;
  type: string;
  result: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  date: Date;
  status: 'present' | 'absent' | 'late';
  createdAt: Date;
  updatedAt: Date;
}

// KIHAP Store Types
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  storeId: string;
  stock: number;
  active: boolean;
  promotion?: Promotion;
  createdAt: Date;
  updatedAt: Date;
}

export interface Promotion {
  id: string;
  productId: string;
  type: 'percentage' | 'fixed';
  value: number;
  startDate: Date;
  endDate: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Store {
  id: string;
  name: string;
  city: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Sale {
  id: string;
  productId: string;
  product: Product;
  storeId: string;
  store: Store;
  studentId: string;
  student: Student;
  instructorId: string;
  instructor: Instructor;
  quantity: number;
  totalPrice: number;
  commission: number;
  status: 'pending' | 'paid' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface Commission {
  id: string;
  saleId: string;
  sale: Sale;
  instructorId: string;
  instructor: Instructor;
  amount: number;
  status: 'pending' | 'paid';
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
