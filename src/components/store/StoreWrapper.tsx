import React from 'react';
import { useStoreStore } from '../../store/useStoreStore';
import Store from './Store';
import { Student, Instructor } from '../../types';
import { Navigate } from 'react-router-dom';

interface StoreWrapperProps {
  student: Student;
}

const StoreWrapper: React.FC<StoreWrapperProps> = ({ student }) => {
  const { stores, products, addSale } = useStoreStore();

  // Mapear a cidade da unidade do aluno para a loja correspondente
  const getStoreForStudent = () => {
    // Se o aluno não tem unidade, usar a loja online
    if (!student.unitId) {
      return stores.find(s => s.city === 'Online');
    }

    // Encontrar a loja baseada na cidade da unidade do aluno
    const store = stores.find(s => {
      switch (s.city) {
        case 'Florianópolis':
          return student.unitId === '1'; // ID da unidade de Florianópolis
        case 'Dourados (Jardim América)':
          return student.unitId === '2'; // ID da unidade de Dourados
        case 'Brasília':
          return student.unitId === '3'; // ID da unidade de Brasília
        case 'Online':
          return false; // A loja online é usada apenas quando não há correspondência
        default:
          return false;
      }
    });

    // Se não encontrar uma loja específica, usar a loja online
    return store || stores.find(s => s.city === 'Online');
  };

  const store = getStoreForStudent();

  if (!store) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-gray-600">Nenhuma loja encontrada para sua unidade.</p>
      </div>
    );
  }

  const storeProducts = products.filter(p => p.storeId === store.id);

  // Criar um objeto instrutor com valores padrão caso não exista
  const mockInstructor: Instructor = {
    id: student.instructorId || '0',
    name: student.instructor?.name || 'Instrutor Padrão',
    email: student.instructor?.email || 'instrutor@kihap.com.br',
    phone: student.instructor?.phone || '(00) 00000-0000',
    belt: student.instructor?.belt || 'preta',
    unitId: student.instructor?.unitId || student.unitId || '0',
    active: true,
    students: [],
    commissionRate: student.instructor?.commissionRate || 10,
    commissions: [],
    totalCommission: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const handlePurchase = async (sale: Parameters<typeof addSale>[0]) => {
    addSale(sale);
  };

  return (
    <Store
      store={store}
      products={storeProducts}
      currentStudent={student}
      instructor={mockInstructor}
      onPurchase={handlePurchase}
    />
  );
};

export default StoreWrapper;
