import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { Student, User, Unit, Lead, Task, Notification, OnlineContent, LiveClass, Badge, StudentBadge, PhysicalTest, SubUnit, LeadStatus } from '../types';
import { initialUsers, initialUnits, initialOnlineContent, initialLiveClasses, beltBadges } from '../data';

// Extrair todas as subunidades das unidades iniciais
const initialSubunits: SubUnit[] = initialUnits.reduce((acc: SubUnit[], unit) => {
  if (unit.subunits) {
    return [...acc, ...unit.subunits];
  }
  return acc;
}, []);

interface DataState {
  students: Student[];
  users: User[];
  units: Unit[];
  leads: Lead[];
  tasks: Task[];
  notifications: Notification[];
  onlineContent: OnlineContent[];
  liveClasses: LiveClass[];
  badges: Badge[];
  studentBadges: StudentBadge[];
  physicalTests: PhysicalTest[];
  subunits: SubUnit[];
  kihapEvents: any[];
  eventCheckins: any[];
  messages: any[];
  supabase: typeof supabase;
  updateStudent: (student: Student) => void;
  addStudent: (student: Omit<Student, 'id' | 'createdAt'>) => void;
  deleteStudent: (studentId: string) => void;
  updateUser: (user: User) => void;
  updateUnit: (unit: Unit) => void;
  updateLead: (lead: Lead) => void;
  addLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'status' | 'history'>) => void;
  deleteLead: (leadId: string) => void;
  updateLeadStatus: (leadId: string, status: LeadStatus) => void;
  updateTask: (task: Task) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  markNotificationAsRead: (notificationId: string) => void;
  updateOnlineContent: (content: OnlineContent) => void;
  updateLiveClass: (liveClass: LiveClass) => void;
  updateBadge: (badge: Badge) => void;
  updateStudentBadge: (studentBadge: StudentBadge) => void;
  updatePhysicalTest: (physicalTest: PhysicalTest) => void;
  updateSubunit: (subunit: SubUnit) => void;
  addSubUnit: (subunit: Omit<SubUnit, 'id'>) => void;
  deleteSubUnit: (subunitId: string) => void;
  updateKihapEvent: (event: any) => void;
  updateEventCheckin: (checkin: any) => void;
  sendMessage: (message: any) => void;
  markMessageAsRead: (messageId: string) => void;
}

export const useDataStore = create<DataState>()(
  persist(
    (set) => ({
      students: [],
      users: initialUsers,
      units: initialUnits,
      leads: [],
      tasks: [],
      notifications: [],
      onlineContent: initialOnlineContent,
      liveClasses: initialLiveClasses,
      badges: beltBadges,
      studentBadges: [],
      physicalTests: [],
      subunits: initialSubunits,
      kihapEvents: [],
      eventCheckins: [],
      messages: [],
      supabase,

      updateStudent: (student) =>
        set((state) => ({
          students: state.students.map((s) =>
            s.id === student.id ? { ...s, ...student } : s
          ),
        })),

      addStudent: (student) =>
        set((state) => ({
          students: [...state.students, { ...student, id: crypto.randomUUID(), createdAt: new Date().toISOString() }],
        })),

      deleteStudent: (studentId) =>
        set((state) => ({
          students: state.students.filter((s) => s.id !== studentId),
        })),

      updateUser: (user) =>
        set((state) => ({
          users: state.users.map((u) => (u.id === user.id ? { ...u, ...user } : u)),
        })),

      updateUnit: (unit) =>
        set((state) => ({
          units: state.units.map((u) => (u.id === unit.id ? { ...u, ...unit } : u)),
        })),

      updateLead: (lead) =>
        set((state) => ({
          leads: state.leads.map((l) => (l.id === lead.id ? { ...l, ...lead } : l)),
        })),

      addLead: (lead) =>
        set((state) => ({
          leads: [...state.leads, { ...lead, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'novo' as LeadStatus, history: [] }],
        })),

      deleteLead: (leadId) =>
        set((state) => ({
          leads: state.leads.filter((l) => l.id !== leadId),
        })),

      updateLeadStatus: (leadId, status) =>
        set((state) => ({
          leads: state.leads.map((l) =>
            l.id === leadId ? { ...l, status } : l
          ),
        })),

      updateTask: (task) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === task.id ? { ...t, ...task } : t)),
        })),

      addNotification: (notification) =>
        set((state) => ({
          notifications: [
            ...state.notifications,
            {
              ...notification,
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      markNotificationAsRead: (notificationId) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          ),
        })),

      updateOnlineContent: (content) =>
        set((state) => ({
          onlineContent: state.onlineContent.map((c) =>
            c.id === content.id ? { ...c, ...content } : c
          ),
        })),

      updateLiveClass: (liveClass) =>
        set((state) => ({
          liveClasses: state.liveClasses.map((c) =>
            c.id === liveClass.id ? { ...c, ...liveClass } : c
          ),
        })),

      updateBadge: (badge) =>
        set((state) => ({
          badges: state.badges.map((b) =>
            b.id === badge.id ? { ...b, ...badge } : b
          ),
        })),

      updateStudentBadge: (studentBadge) =>
        set((state) => ({
          studentBadges: state.studentBadges.map((sb) =>
            sb.id === studentBadge.id ? { ...sb, ...studentBadge } : sb
          ),
        })),

      updatePhysicalTest: (physicalTest) =>
        set((state) => ({
          physicalTests: state.physicalTests.map((pt) =>
            pt.id === physicalTest.id ? { ...pt, ...physicalTest } : pt
          ),
        })),

      updateSubunit: (subunit) =>
        set((state) => ({
          subunits: state.subunits.map((su) =>
            su.id === subunit.id ? { ...su, ...subunit } : su
          ),
        })),

      addSubUnit: (subunit) =>
        set((state) => ({
          subunits: [...state.subunits, { ...subunit, id: crypto.randomUUID() }],
        })),

      deleteSubUnit: (subunitId) =>
        set((state) => ({
          subunits: state.subunits.filter((su) => su.id !== subunitId),
        })),

      updateKihapEvent: (event) =>
        set((state) => ({
          kihapEvents: state.kihapEvents.map((e) =>
            e.id === event.id ? { ...e, ...event } : e
          ),
        })),

      updateEventCheckin: (checkin) =>
        set((state) => ({
          eventCheckins: state.eventCheckins.map((c) =>
            c.id === checkin.id ? { ...c, ...checkin } : c
          ),
        })),

      sendMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, { ...message, id: crypto.randomUUID() }],
        })),

      markMessageAsRead: (messageId) =>
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === messageId ? { ...m, read: true } : m
          ),
        })),
    }),
    {
      name: 'kihap-data-storage',
    }
  )
);
