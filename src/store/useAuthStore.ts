import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
import { users } from '../data';
import { useDataStore } from './useDataStore';

interface AuthState {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  updatePassword: (newPassword: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      login: (email: string, password: string) => {
        // First, check for staff users (admin, manager, instructor)
        const staffUser = users.find(u => u.email === email && u.password === password);
        if (staffUser) {
          const { password: _, ...userWithoutPassword } = staffUser;
          set({ user: userWithoutPassword as User });
          return true;
        }

        // If no staff user found, check for student users
        const { students } = useDataStore.getState();
        const student = students.find(s => s.email === email);
        
        if (student) {
          // Default password for all students
          if (password === 'kihap') {
            // Create a user account for the student if they don't have one
            const studentUser: User = {
              id: Date.now(),
              name: student.name,
              email: student.email!,
              role: 'student',
              studentId: student.id,
              photo: student.photo,
              firstLogin: true
            };
            
            set({ user: studentUser });
            return true;
          }

          // Check for updated password after first login
          const existingUser = users.find(u => u.email === email && u.role === 'student');
          if (existingUser && existingUser.password === password) {
            const { password: _, ...userWithoutPassword } = existingUser;
            set({ user: { ...userWithoutPassword, firstLogin: false } });
            return true;
          }
        }

        return false;
      },
      logout: () => set({ user: null }),
      updatePassword: (newPassword: string) => {
        set(state => {
          if (!state.user) return state;

          const updatedUser = {
            ...state.user,
            password: newPassword,
            firstLogin: false
          };

          // Update the users array
          const userIndex = users.findIndex(u => u.email === state.user?.email);
          if (userIndex >= 0) {
            users[userIndex] = updatedUser;
          } else {
            users.push(updatedUser);
          }

          return { user: updatedUser };
        });
      }
    }),
    {
      name: 'kihap-auth-storage',
    }
  )
);