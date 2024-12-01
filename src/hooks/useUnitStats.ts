import { useDataStore } from '../store/useDataStore';

export function useUnitStats(unitId: string) {
  const { students } = useDataStore();
  
  return {
    getStats: () => {
      const now = new Date();
      
      // Get students for this unit
      const unitStudents = students.filter(s => s.unitId === unitId);
      
      // Get active contract students (contract status is active and not expired)
      const activeContractStudents = unitStudents.filter(student => {
        if (student.contract?.status !== 'active') return false;
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
      const totalContractsValue = 0; // Removido cálculo de valor pois não existe no tipo Contract

      return {
        totalStudents,
        beltDistribution,
        activeContracts,
        totalContractsValue
      };
    }
  };
}
