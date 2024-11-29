import { useDataStore } from '../store/useDataStore';
import type { Period } from '../types';

export function useUnitStats(unitId: number, period: Period = 'all') {
  const { students } = useDataStore();
  
  return {
    getStats: () => {
      const now = new Date();
      
      // Get students for this unit
      const unitStudents = students.filter(s => s.unitId === unitId);
      
      // Get active contract students (contract is active and not expired)
      const activeContractStudents = unitStudents.filter(student => {
        if (!student.contract?.active) return false;
        try {
          const endDate = new Date(student.contract.endDate);
          return endDate >= now;
        } catch {
          return false;
        }
      });

      // Calculate total students (all students in the unit)
      const totalStudents = unitStudents.length;

      // Calculate belt distribution (for all students)
      const beltDistribution = unitStudents.reduce((acc, student) => {
        acc[student.belt] = (acc[student.belt] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Count active contracts
      const activeContracts = activeContractStudents.length;

      // Calculate total contract value (only from active contracts)
      const totalContractsValue = activeContractStudents.reduce((total, student) => {
        return total + (student.contract?.value || 0);
      }, 0);

      return {
        totalStudents,
        beltDistribution,
        activeContracts,
        totalContractsValue
      };
    }
  };
}