import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ChatMessage, ChatThread } from '../types';

interface ChatState {
  messages: ChatMessage[];
  threads: ChatThread[];
  activeThread: number | null;
  version: number;
  
  // Actions
  sendMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  markAsRead: (threadId: number) => void;
  createThread: (leadId: number) => number;
  assignThread: (threadId: number, staffId: number) => void;
  updateThreadStatus: (threadId: number, status: ChatThread['status']) => void;
  setActiveThread: (threadId: number | null) => void;
}

const initialState = {
  messages: [],
  threads: [],
  activeThread: null,
  version: 1
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      ...initialState,

      sendMessage: (message) => {
        const newMessage = {
          ...message,
          id: Date.now(),
          timestamp: new Date().toISOString()
        };

        set(state => {
          const thread = state.threads.find(t => t.id === message.threadId);
          if (!thread) return state;

          const updatedThreads = state.threads.map(t => 
            t.id === message.threadId
              ? {
                  ...t,
                  lastMessage: newMessage,
                  unreadCount: t.unreadCount + (message.type === 'lead' ? 1 : 0),
                  updatedAt: new Date().toISOString()
                }
              : t
          );

          return {
            ...state,
            messages: [...state.messages, newMessage],
            threads: updatedThreads
          };
        });
      },

      markAsRead: (threadId) => {
        set(state => ({
          threads: state.threads.map(thread =>
            thread.id === threadId
              ? { ...thread, unreadCount: 0 }
              : thread
          ),
          messages: state.messages.map(message =>
            message.threadId === threadId
              ? { ...message, read: true }
              : message
          )
        }));
      },

      createThread: (leadId) => {
        const thread = {
          id: Date.now(),
          leadId,
          unreadCount: 0,
          status: 'active' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        set(state => ({
          threads: [...state.threads, thread]
        }));

        return thread.id;
      },

      assignThread: (threadId, staffId) => {
        set(state => ({
          threads: state.threads.map(thread =>
            thread.id === threadId
              ? { ...thread, assignedTo: staffId }
              : thread
          )
        }));
      },

      updateThreadStatus: (threadId, status) => {
        set(state => ({
          threads: state.threads.map(thread =>
            thread.id === threadId
              ? { ...thread, status }
              : thread
          )
        }));
      },

      setActiveThread: (threadId) => {
        set({ activeThread: threadId });
        if (threadId) {
          get().markAsRead(threadId);
        }
      }
    }),
    {
      name: 'kihap-chat-storage',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          return {
            ...initialState,
            ...persistedState,
            version: 1
          };
        }
        return persistedState;
      }
    }
  )
);