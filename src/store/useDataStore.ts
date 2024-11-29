import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Lead, Student, Unit, User, Class, Message, Task, LeadStatus, Notification, ContractTemplate, OnlineContent, LiveClass, ContentEngagement, Badge, StudentBadge, PhysicalTest } from '../types';
import { users as initialUsers, units as initialUnits, students as initialStudents, beltBadges } from '../data';

interface DataState {
  // State
  leads: Lead[];
  students: Student[];
  units: Unit[];
  users: User[];
  classes: Class[];
  messages: Message[];
  tasks: Task[];
  notifications: Notification[];
  contractTemplates: ContractTemplate[];
  onlineContent: OnlineContent[];
  liveClasses: LiveClass[];
  contentEngagements: ContentEngagement[];
  badges: Badge[];
  studentBadges: StudentBadge[];
  physicalTests: PhysicalTest[];
  version: number;

  // Actions
  addLead: (lead: Omit<Lead, 'id' | 'status' | 'createdAt' | 'history'>) => number;
  updateLead: (lead: Lead) => void;
  deleteLead: (id: number) => void;
  updateLeadStatus: (id: number, status: LeadStatus, userId: number) => void;
  addLeadHistory: (leadId: number, history: Omit<LeadHistory, 'id' | 'leadId' | 'createdAt'>) => void;
  addLeadNote: (leadId: number, note: string, userId: number) => void;
  addLeadContact: (leadId: number, description: string, nextContactDate: string | undefined, userId: number) => void;
  addUnit: (unit: Omit<Unit, 'id'>) => void;
  updateUnit: (unit: Unit) => void;
  deleteUnit: (id: number) => void;
  addStudent: (student: Omit<Student, 'id'>) => void;
  updateStudent: (student: Student) => void;
  updateStudentBelt: (studentId: number, newBelt: string, updatedBy: number) => void;
  deleteStudent: (id: number) => void;
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (user: User) => void;
  deleteUser: (id: number) => void;
  addBadge: (badge: Omit<Badge, 'id'>) => void;
  awardBadge: (studentId: number, badgeId: number, awardedBy: number) => void;
  sendMessage: (message: Omit<Message, 'id' | 'type'>) => void;
  markMessageAsRead: (id: number) => void;
  addContent: (content: Omit<OnlineContent, 'id' | 'createdAt' | 'updatedAt' | 'uploadStatus' | 'uploadProgress'>) => number;
  updateContent: (content: OnlineContent) => void;
  deleteContent: (id: number) => void;
  updateContentUploadStatus: (id: number, status: OnlineContent['uploadStatus'], progress?: number) => void;
  publishContent: (id: number) => void;
  unpublishContent: (id: number) => void;
  trackContentProgress: (contentId: number, studentId: number, progress: number) => void;
  markContentComplete: (contentId: number, studentId: number) => void;
  toggleContentFavorite: (contentId: number, studentId: number) => void;
  addContentComment: (contentId: number, studentId: number, comment: string) => void;
}

type LeadHistory = {
  id: number;
  leadId: number;
  type: 'status_change' | 'note' | 'contact';
  description: string;
  oldStatus?: LeadStatus;
  newStatus?: LeadStatus;
  createdAt: string;
  createdBy: number;
};

// Função para garantir que o estado tenha os dados iniciais necessários
const ensureInitialData = (state: Partial<DataState>): DataState => {
  return {
    leads: state.leads || [],
    students: state.students || [],
    units: state.units?.length ? state.units : initialUnits,
    users: state.users?.length ? state.users : initialUsers,
    classes: state.classes || [],
    messages: state.messages || [],
    tasks: state.tasks || [],
    notifications: state.notifications || [],
    contractTemplates: state.contractTemplates || [],
    onlineContent: state.onlineContent || [],
    liveClasses: state.liveClasses || [],
    contentEngagements: state.contentEngagements || [],
    badges: state.badges?.length ? state.badges : beltBadges,
    studentBadges: state.studentBadges || [],
    physicalTests: state.physicalTests || [],
    version: state.version || 1,
  } as DataState;
};

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      // Initial State
      leads: [],
      students: [],
      units: initialUnits,
      users: initialUsers,
      classes: [],
      messages: [],
      tasks: [],
      notifications: [],
      contractTemplates: [],
      onlineContent: [],
      liveClasses: [],
      contentEngagements: [],
      badges: beltBadges,
      studentBadges: [],
      physicalTests: [],
      version: 1,

      // Actions
      addLead: (lead) => {
        const newLead = {
          ...lead,
          id: Date.now(),
          status: 'novo' as const,
          createdAt: new Date().toISOString(),
          history: []
        };

        set((state) => ({
          leads: [...state.leads, newLead]
        }));

        return newLead.id;
      },

      updateLead: (lead) => {
        set((state) => ({
          leads: state.leads.map((l) => l.id === lead.id ? lead : l)
        }));
      },

      deleteLead: (id) => {
        set((state) => ({
          leads: state.leads.filter((l) => l.id !== id)
        }));
      },

      updateLeadStatus: (id, status, userId) => {
        set((state) => {
          const lead = state.leads.find((l) => l.id === id);
          if (!lead) return state;

          const history: LeadHistory = {
            id: Date.now(),
            leadId: id,
            type: 'status_change',
            description: `Status alterado de ${lead.status} para ${status}`,
            oldStatus: lead.status,
            newStatus: status,
            createdAt: new Date().toISOString(),
            createdBy: userId
          };

          return {
            ...state,
            leads: state.leads.map((l) => 
              l.id === id 
                ? { 
                    ...l, 
                    status,
                    history: [...(l.history || []), history]
                  } 
                : l
            )
          };
        });
      },

      addLeadHistory: (leadId, history) => {
        set((state) => {
          const newHistory: LeadHistory = {
            id: Date.now(),
            leadId,
            ...history,
            createdAt: new Date().toISOString()
          };

          return {
            ...state,
            leads: state.leads.map((l) =>
              l.id === leadId
                ? { ...l, history: [...(l.history || []), newHistory] }
                : l
            )
          };
        });
      },

      addLeadNote: (leadId, note, userId) => {
        set((state) => {
          const newHistory: LeadHistory = {
            id: Date.now(),
            leadId,
            type: 'note',
            description: note,
            createdAt: new Date().toISOString(),
            createdBy: userId
          };

          return {
            ...state,
            leads: state.leads.map((l) =>
              l.id === leadId
                ? { 
                    ...l, 
                    notes: l.notes ? `${l.notes}\n${note}` : note,
                    history: [...(l.history || []), newHistory]
                  }
                : l
            )
          };
        });
      },

      addLeadContact: (leadId, description, nextContactDate, userId) => {
        set((state) => {
          const newHistory: LeadHistory = {
            id: Date.now(),
            leadId,
            type: 'contact',
            description,
            createdAt: new Date().toISOString(),
            createdBy: userId
          };

          return {
            ...state,
            leads: state.leads.map((l) =>
              l.id === leadId
                ? { 
                    ...l, 
                    lastContact: new Date().toISOString(),
                    nextContactDate,
                    history: [...(l.history || []), newHistory]
                  }
                : l
            )
          };
        });
      },

      addStudent: (student) => {
        const newStudent = {
          ...student,
          id: Date.now(),
        };

        set((state) => ({
          students: [...state.students, newStudent]
        }));

        // Conceder badge da faixa inicial
        const store = get();
        const beltBadge = store.badges.find((b) => b.type === 'belt' && b.beltLevel === student.belt);
        if (beltBadge) {
          store.awardBadge(newStudent.id, beltBadge.id, 1);
        }
      },

      updateStudent: (student) => {
        set((state) => ({
          students: state.students.map((s) => s.id === student.id ? student : s)
        }));
      },

      updateStudentBelt: (studentId, newBelt, updatedBy) => {
        set((state) => ({
          students: state.students.map((s) => 
            s.id === studentId 
              ? { ...s, belt: newBelt }
              : s
          )
        }));

        const store = get();
        const beltBadge = store.badges.find((b) => b.type === 'belt' && b.beltLevel === newBelt);
        if (beltBadge) {
          store.awardBadge(studentId, beltBadge.id, updatedBy);
        }
      },

      deleteStudent: (id) => {
        set((state) => ({
          students: state.students.filter((s) => s.id !== id)
        }));
      },

      addBadge: (badge) => {
        const newBadge = {
          ...badge,
          id: Date.now()
        };

        set((state) => ({
          badges: [...state.badges, newBadge]
        }));
      },

      awardBadge: (studentId, badgeId, awardedBy) => {
        const store = get();
        const existingBadge = store.studentBadges.find(
          (sb) => sb.studentId === studentId && sb.badgeId === badgeId
        );

        if (!existingBadge) {
          const newStudentBadge = {
            id: Date.now(),
            studentId,
            badgeId,
            awardedAt: new Date().toISOString(),
            awardedBy
          };

          set((state) => ({
            studentBadges: [...state.studentBadges, newStudentBadge]
          }));
        }
      },

      addUnit: (unit) => {
        const newUnit = {
          ...unit,
          id: Date.now(),
        };

        set((state) => ({
          units: [...state.units, newUnit]
        }));
      },

      updateUnit: (unit) => {
        set((state) => ({
          units: state.units.map((u) => u.id === unit.id ? unit : u)
        }));
      },

      deleteUnit: (id) => {
        set((state) => ({
          units: state.units.filter((u) => u.id !== id)
        }));
      },

      addUser: (user) => {
        const newUser = {
          ...user,
          id: Date.now(),
        };

        set((state) => ({
          users: [...state.users, newUser]
        }));
      },

      updateUser: (user) => {
        set((state) => ({
          users: state.users.map((u) => u.id === user.id ? user : u)
        }));
      },

      deleteUser: (id) => {
        set((state) => ({
          users: state.users.filter((u) => u.id !== id)
        }));
      },

      sendMessage: (message) => {
        const newMessage = {
          ...message,
          id: Date.now(),
          type: 'user' as const
        };

        set((state) => ({
          messages: [...state.messages, newMessage]
        }));
      },

      markMessageAsRead: (id) => {
        set((state) => ({
          messages: state.messages.map((m) => 
            m.id === id ? { ...m, read: true } : m
          )
        }));
      },

      addContent: (content) => {
        const newContent = {
          ...content,
          id: Date.now(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          uploadStatus: 'pending' as const,
          uploadProgress: 0
        };

        set((state) => ({
          onlineContent: [...state.onlineContent, newContent]
        }));

        return newContent.id;
      },

      updateContent: (content) => {
        set((state) => ({
          onlineContent: state.onlineContent.map((c) => 
            c.id === content.id 
              ? { ...content, updatedAt: new Date().toISOString() }
              : c
          )
        }));
      },

      deleteContent: (id) => {
        set((state) => ({
          onlineContent: state.onlineContent.filter((c) => c.id !== id)
        }));
      },

      updateContentUploadStatus: (id, status, progress) => {
        set((state) => ({
          onlineContent: state.onlineContent.map((c) =>
            c.id === id
              ? {
                  ...c,
                  uploadStatus: status,
                  uploadProgress: progress !== undefined ? progress : c.uploadProgress,
                  updatedAt: new Date().toISOString()
                }
              : c
          )
        }));
      },

      publishContent: (id) => {
        set((state) => ({
          onlineContent: state.onlineContent.map((c) =>
            c.id === id
              ? { ...c, isPublished: true, updatedAt: new Date().toISOString() }
              : c
          )
        }));
      },

      unpublishContent: (id) => {
        set((state) => ({
          onlineContent: state.onlineContent.map((c) =>
            c.id === id
              ? { ...c, isPublished: false, updatedAt: new Date().toISOString() }
              : c
          )
        }));
      },

      trackContentProgress: (contentId, studentId, progress) => {
        const timestamp = new Date().toISOString();
        
        set((state) => {
          const existingEngagement = state.contentEngagements.find(
            (e) => e.contentId === contentId && 
                 e.studentId === studentId && 
                 e.type === 'view'
          );

          if (existingEngagement) {
            return {
              ...state,
              contentEngagements: state.contentEngagements.map((e) =>
                e.id === existingEngagement.id
                  ? { ...e, progress, timestamp }
                  : e
              )
            };
          }

          return {
            ...state,
            contentEngagements: [...state.contentEngagements, {
              id: Date.now(),
              contentId,
              studentId,
              type: 'view',
              progress,
              timestamp
            }]
          };
        });
      },

      markContentComplete: (contentId, studentId) => {
        const timestamp = new Date().toISOString();
        
        set((state) => {
          const existingEngagement = state.contentEngagements.find(
            (e) => e.contentId === contentId && 
                 e.studentId === studentId && 
                 e.type === 'complete'
          );

          if (existingEngagement) return state;

          return {
            ...state,
            contentEngagements: [...state.contentEngagements, {
              id: Date.now(),
              contentId,
              studentId,
              type: 'complete',
              timestamp
            }]
          };
        });
      },

      toggleContentFavorite: (contentId, studentId) => {
        const timestamp = new Date().toISOString();
        
        set((state) => {
          const existingEngagement = state.contentEngagements.find(
            (e) => e.contentId === contentId && 
                 e.studentId === studentId && 
                 e.type === 'like'
          );

          if (existingEngagement) {
            return {
              ...state,
              contentEngagements: state.contentEngagements.filter(
                (e) => e.id !== existingEngagement.id
              )
            };
          }

          return {
            ...state,
            contentEngagements: [...state.contentEngagements, {
              id: Date.now(),
              contentId,
              studentId,
              type: 'like',
              timestamp
            }]
          };
        });
      },

      addContentComment: (contentId, studentId, comment) => {
        const timestamp = new Date().toISOString();
        
        set((state) => ({
          contentEngagements: [...state.contentEngagements, {
            id: Date.now(),
            contentId,
            studentId,
            type: 'comment',
            comment,
            timestamp
          }]
        }));
      }
    }),
    {
      name: 'kihap-data-storage',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          return ensureInitialData(state);
        }
        return state;
      }
    }
  )
);
