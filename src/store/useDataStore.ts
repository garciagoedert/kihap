import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Lead, Student, Unit, User, Class, Message, Task, LeadStatus, Notification, ContractTemplate, OnlineContent, LiveClass, ContentEngagement, Badge, StudentBadge, PhysicalTest, LeadHistory, SubUnit } from '../types';
import { initialUsers, initialUnits, beltBadges, initialOnlineContent, initialLiveClasses } from '../data';

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
  addLead: (lead: Omit<Lead, 'id' | 'status' | 'createdAt' | 'history'>) => string;
  updateLead: (lead: Lead) => void;
  deleteLead: (id: string) => void;
  updateLeadStatus: (id: string, status: LeadStatus, userId: string) => void;
  addLeadHistory: (leadId: string, history: Omit<LeadHistory, 'id' | 'leadId' | 'createdAt'>) => void;
  addLeadNote: (leadId: string, note: string, userId: string) => void;
  addLeadContact: (leadId: string, description: string, nextContactDate: string | undefined, userId: string) => void;
  addUnit: (unit: Omit<Unit, 'id'>) => void;
  updateUnit: (unit: Unit) => void;
  deleteUnit: (id: string) => void;
  addSubUnit: (unitId: string, subUnit: Omit<SubUnit, 'id' | 'parentUnitId'>) => void;
  updateSubUnit: (unitId: string, subUnit: SubUnit) => void;
  deleteSubUnit: (unitId: string, subUnitId: string) => void;
  addStudent: (student: Omit<Student, 'id'>) => void;
  updateStudent: (student: Student) => void;
  updateStudentBelt: (studentId: string, newBelt: string, updatedBy: string) => void;
  deleteStudent: (id: string) => void;
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (user: User) => void;
  deleteUser: (id: string) => void;
  addBadge: (badge: Omit<Badge, 'id'>) => void;
  updateBadge: (badge: Badge) => void;
  awardBadge: (studentId: string, badgeId: string, awardedBy: string, comment?: string) => void;
  sendMessage: (message: Omit<Message, 'id' | 'type'>) => void;
  markMessageAsRead: (id: string) => void;
  addContent: (content: Omit<OnlineContent, 'id' | 'createdAt' | 'updatedAt' | 'uploadStatus' | 'uploadProgress'>) => string;
  updateContent: (content: OnlineContent) => void;
  deleteContent: (id: string) => void;
  updateContentUploadStatus: (id: string, status: OnlineContent['uploadStatus'], progress?: number) => void;
  publishContent: (id: string) => void;
  unpublishContent: (id: string) => void;
  trackContentProgress: (contentId: string, studentId: string, progress: number) => void;
  markContentComplete: (contentId: string, studentId: string) => void;
  toggleContentFavorite: (contentId: string, studentId: string) => void;
  addContentComment: (contentId: string, studentId: string, comment: string) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

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
    onlineContent: state.onlineContent?.length ? state.onlineContent : initialOnlineContent,
    liveClasses: state.liveClasses?.length ? state.liveClasses : initialLiveClasses,
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
      onlineContent: initialOnlineContent,
      liveClasses: initialLiveClasses,
      contentEngagements: [],
      badges: beltBadges,
      studentBadges: [],
      physicalTests: [],
      version: 1,

      // Actions
      addLead: (lead) => {
        const newLead: Lead = {
          ...lead,
          id: Date.now().toString(),
          status: 'novo',
          createdAt: new Date(),
          updatedAt: new Date(),
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
            id: Date.now().toString(),
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
            id: Date.now().toString(),
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
            id: Date.now().toString(),
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
            id: Date.now().toString(),
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
          id: Date.now().toString(),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        set((state) => ({
          students: [...state.students, newStudent]
        }));

        // Conceder badge da faixa inicial
        const store = get();
        const beltBadge = store.badges.find((b) => b.type === 'belt' && b.beltLevel === student.belt);
        if (beltBadge) {
          store.awardBadge(newStudent.id, beltBadge.id, "1");
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
          id: Date.now().toString(),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        set((state) => ({
          badges: [...state.badges, newBadge]
        }));
      },

      updateBadge: (badge) => {
        set((state) => ({
          badges: state.badges.map((b) => 
            b.id === badge.id 
              ? { ...badge, updatedAt: new Date() }
              : b
          )
        }));
      },

      awardBadge: (studentId, badgeId, awardedBy, comment) => {
        const store = get();
        const existingBadge = store.studentBadges.find(
          (sb) => sb.studentId === studentId && sb.badgeId === badgeId
        );

        if (!existingBadge) {
          const newStudentBadge = {
            id: Date.now().toString(),
            studentId,
            badgeId,
            awardedAt: new Date().toISOString(),
            awardedBy,
            comment,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          set((state) => ({
            studentBadges: [...state.studentBadges, newStudentBadge]
          }));
        }
      },

      addUnit: (unit) => {
        const newUnit = {
          ...unit,
          id: Date.now().toString(),
          createdAt: new Date(),
          updatedAt: new Date()
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

      addSubUnit: (unitId, subUnit) => {
        const newSubUnit: SubUnit = {
          ...subUnit,
          id: Date.now().toString(),
          parentUnitId: unitId,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        set((state) => ({
          units: state.units.map((unit) => 
            unit.id === unitId
              ? {
                  ...unit,
                  subunits: [...(unit.subunits || []), newSubUnit],
                  updatedAt: new Date()
                }
              : unit
          )
        }));
      },

      updateSubUnit: (unitId, subUnit) => {
        set((state) => ({
          units: state.units.map((unit) => 
            unit.id === unitId
              ? {
                  ...unit,
                  subunits: unit.subunits?.map((sub) =>
                    sub.id === subUnit.id
                      ? { ...subUnit, updatedAt: new Date() }
                      : sub
                  ),
                  updatedAt: new Date()
                }
              : unit
          )
        }));
      },

      deleteSubUnit: (unitId, subUnitId) => {
        set((state) => ({
          units: state.units.map((unit) => 
            unit.id === unitId
              ? {
                  ...unit,
                  subunits: unit.subunits?.filter((sub) => sub.id !== subUnitId),
                  updatedAt: new Date()
                }
              : unit
          )
        }));
      },

      addUser: (user) => {
        const newUser = {
          ...user,
          id: Date.now().toString(),
          createdAt: new Date(),
          updatedAt: new Date()
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
          id: Date.now().toString(),
          type: 'user' as const,
          createdAt: new Date(),
          updatedAt: new Date()
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
          id: Date.now().toString(),
          createdAt: new Date(),
          updatedAt: new Date(),
          uploadStatus: 'pending' as const,
          uploadProgress: 0,
          isPublished: false
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
              ? { ...content, updatedAt: new Date() }
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
                  updatedAt: new Date()
                }
              : c
          )
        }));
      },

      publishContent: (id) => {
        set((state) => ({
          onlineContent: state.onlineContent.map((c) =>
            c.id === id
              ? { ...c, isPublished: true, updatedAt: new Date() }
              : c
          )
        }));
      },

      unpublishContent: (id) => {
        set((state) => ({
          onlineContent: state.onlineContent.map((c) =>
            c.id === id
              ? { ...c, isPublished: false, updatedAt: new Date() }
              : c
          )
        }));
      },

      trackContentProgress: (contentId, studentId, progress) => {
        const timestamp = new Date();
        
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
                  ? { 
                      ...e, 
                      progress, 
                      timestamp: timestamp.toISOString(),
                      updatedAt: timestamp
                    }
                  : e
              )
            };
          }

          return {
            ...state,
            contentEngagements: [...state.contentEngagements, {
              id: Date.now().toString(),
              contentId,
              studentId,
              type: 'view',
              progress,
              completed: false,
              timestamp: timestamp.toISOString(),
              createdAt: timestamp,
              updatedAt: timestamp
            }]
          };
        });
      },

      markContentComplete: (contentId, studentId) => {
        const timestamp = new Date();
        
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
              id: Date.now().toString(),
              contentId,
              studentId,
              type: 'complete',
              progress: 100,
              completed: true,
              timestamp: timestamp.toISOString(),
              createdAt: timestamp,
              updatedAt: timestamp
            }]
          };
        });
      },

      toggleContentFavorite: (contentId, studentId) => {
        const timestamp = new Date();
        
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
              id: Date.now().toString(),
              contentId,
              studentId,
              type: 'like',
              progress: 0,
              completed: false,
              timestamp: timestamp.toISOString(),
              createdAt: timestamp,
              updatedAt: timestamp
            }]
          };
        });
      },

      addContentComment: (contentId, studentId, comment) => {
        const timestamp = new Date();
        
        set((state) => ({
          contentEngagements: [...state.contentEngagements, {
            id: Date.now().toString(),
            contentId,
            studentId,
            type: 'comment',
            progress: 0,
            completed: false,
            comment,
            timestamp: timestamp.toISOString(),
            createdAt: timestamp,
            updatedAt: timestamp
          }]
        }));
      },

      addNotification: (notification) => {
        const newNotification = {
          ...notification,
          id: Date.now().toString(),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        set((state) => ({
          ...state,
          notifications: [...state.notifications, newNotification]
        }));
      }
    }),
    {
      name: 'kihap-data-storage',
      version: 2,
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
