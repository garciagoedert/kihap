import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
import { initialUsers } from '../data';
import { useDataStore } from './useDataStore';

interface AuthState {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  updatePassword: (newPassword: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      login: (email: string, password: string) => {
        // First, check for staff users (admin, manager, instructor)
        const dataStore = useDataStore.getState();
        const users = dataStore.users.length > 0 ? dataStore.users : initialUsers;
        const staffUser = users.find(u => u.email === email && u.password === password);
        
        if (staffUser) {
          const { password: _, ...userWithoutPassword } = staffUser;
          set({ user: userWithoutPassword as User });
          return true;
        }

        // If no staff user found, check for student users
        const { students } = dataStore;
        const student = students.find(s => s.email === email);
        
        if (student) {
          // Default password for all students
          if (password === 'kihap') {
            // Create a user account for the student if they don't have one
            const studentUser: User = {
              id: student.id,
              name: student.name,
              email: student.email,
              role: 'student',
              unitId: student.unitId,
              active: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            set({ user: studentUser });
            return true;
          }

          // Check for updated password after first login
          const existingUser = users.find(u => u.email === email && u.role === 'student');
          if (existingUser && existingUser.password === password) {
            const { password: _, ...userWithoutPassword } = existingUser;
            set({ user: userWithoutPassword });
            return true;
          }
        }

        return false;
      },
      logout: () => set({ user: null }),
      updatePassword: (newPassword: string) => {
        set(state => {
          if (!state.user) return state;

          const updatedUser: User = {
            ...state.user,
            password: newPassword,
            updatedAt: new Date().toISOString()
          };

          // Update the user in the data store
          const dataStore = useDataStore.getState();
          dataStore.updateUser(updatedUser);

          return { user: updatedUser };
        });
      }
    }),
    {
      name: 'kihap-auth-storage',
    }
  )
);
