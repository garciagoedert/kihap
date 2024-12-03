export type User = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'instructor' | 'student';
  unitId?: string;
  active: boolean;
  createdAt: string;
  password?: string;
  updatedAt?: string;
};

export type Unit = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  active: boolean;
  phone?: string;
  subunits?: SubUnit[];
};

export type SubUnit = {
  id: string;
  name: string;
  unitId: string;
  active: boolean;
  address?: string;
  phone?: string;
  email?: string;
  parentUnitId?: string;
};

export type Student = {
  id: string;
  userId: string;
  unitId: string;
  subUnitId?: string;
  name: string;
  email: string;
  phone: string;
  belt: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  birthDate?: string;
  cpf?: string;
  trainingDays?: string[];
  trainingSchedule?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  photo?: string;
  age?: number;
  registrationDate?: string;
  lastAttendance?: string;
  instructorId?: string;
  instructor?: Instructor;
  storeId?: string;
  store?: Store;
  badges?: StudentBadge[];
  physicalTests?: PhysicalTest[];
  contract?: Contract;
  favoriteContent?: string[];
  completedContent?: string[];
};

export type Instructor = {
  id: string;
  userId: string;
  unitId: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  belt?: string;
  commissionRate?: number;
};

export type Store = {
  id: string;
  name: string;
  unitId: string;
  active: boolean;
  city?: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  storeId: string;
  active: boolean;
  image?: string;
  stock?: number;
};

export type Sale = {
  id: string;
  productId: string;
  studentId: string;
  storeId: string;
  price: number;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
  totalPrice?: number;
  product?: Product;
  student?: Student;
};

export type Commission = {
  id: string;
  saleId: string;
  instructorId: string;
  amount: number;
  status: 'pending' | 'paid';
  createdAt: string;
  instructor?: Instructor;
  sale?: Sale;
};

export type Badge = {
  id: string;
  name: string;
  description: string;
  image: string;
  unitId: string;
  active: boolean;
  type?: string;
  beltLevel?: string;
  category?: string;
  color?: string;
  icon?: string;
  criteria?: string;
};

export type StudentBadge = {
  id: string;
  studentId: string;
  badgeId: string;
  awardedAt: string;
  awardedBy?: string;
};

export type PhysicalTest = {
  id: string;
  studentId: string;
  type: string;
  result: number;
  date: string;
};

export type Contract = {
  id: string;
  studentId: string;
  type: string;
  startDate: string;
  endDate: string;
  value: number;
  status: 'active' | 'inactive' | 'cancelled';
  content?: string;
};

export type OnlineContent = {
  id: string;
  title: string;
  description: string;
  url: string;
  type: 'video' | 'document' | 'link';
  unitId: string;
  active: boolean;
  createdAt?: string;
  uploadStatus?: string;
  uploadProgress?: number;
  isPublished?: boolean;
  targetStudentIds?: string[];
  targetBelts?: string[];
  category?: string;
  tags?: string[];
  thumbnailUrl?: string;
  duration?: number;
};

export type LiveClass = {
  id: string;
  title: string;
  description: string;
  date: string;
  instructorId: string;
  unitId: string;
  url?: string;
  active: boolean;
  type?: string;
  status?: string;
  targetStudentIds?: string[];
  targetBelts?: string[];
  duration?: number;
  scheduledFor?: string;
};

export type LeadStatus = 'new' | 'contacted' | 'interested' | 'scheduled' | 'converted' | 'lost' | 'novo' | 'contato' | 'visitou' | 'matriculado' | 'desistente';

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  source: string;
  unitId: string;
  createdAt: string;
  notes?: string;
  history?: LeadHistory[];
  value?: number;
};

export type LeadHistory = {
  id: string;
  leadId: string;
  type: 'status_change' | 'note' | 'contact';
  description: string;
  oldStatus?: LeadStatus;
  newStatus?: LeadStatus;
  createdBy: string;
  createdAt: string;
  nextContactDate?: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: 'pending' | 'completed';
  assignedTo: string;
  createdBy: string;
  unitId: string;
};

export type Notification = {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error';
  userId: string;
  read: boolean;
  createdAt: string;
};

export type ContractTemplate = {
  id: string;
  name: string;
  content: string;
  unitId: string;
  active: boolean;
};

export type KihapEvent = {
  id: string;
  name: string;
  description: string;
  date: string;
  location: string;
  unitId: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type EventCheckin = {
  id: string;
  eventId: string;
  studentId: string;
  checkinTime: string;
  createdAt: string;
  updatedAt?: string;
  student?: Student;
  event?: KihapEvent;
};
