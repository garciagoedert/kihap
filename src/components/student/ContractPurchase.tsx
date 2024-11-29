import React, { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { DollarSign, Calendar, CheckCircle2, X } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Student } from '../../types';

interface ContractPurchaseProps {
  student: Student;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ContractPurchase({ student, onClose, onSuccess }: ContractPurchaseProps) {
  const { contractTemplates, updateStudent } = useDataStore();
  const [selectedTemplate, setSelectedTemplate] = useState(contractTemplates[0]?.id || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Filter templates by student's unit
  const availableTemplates = contractTemplates.filter(template => 
    template.active && template.unitIds.includes(student.unitId)
  );

  const handlePurchase = async () => {
    setIsProcessing(true);
    
    try {
      const template = contractTemplates.find(t => t.id === selectedTemplate);
      if (!template) throw new Error('Template not found');

      const startDate = new Date();
      const endDate = addMonths(startDate, template.duration);

      // Update student contract
      const updatedStudent = {
        ...student,
        contract: {
          active: true,
          planName: template.name,
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
          value: template.value
        }
      };

      // Here you would integrate with a payment gateway
      // For now, we'll simulate a successful payment
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Update student data
      updateStudent(updatedStudent);
      
      setShowSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error processing purchase:', error);
      alert('Erro ao processar pagamento. Por favor, tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 text-center">
          <div className="mb-4">
            <CheckCircle2 className="mx-auto text-green-500" size={48} />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            Contrato Ativado com Sucesso!
          </h3>
          <p className="text-gray-600">
            Seu contrato foi ativado e você já pode aproveitar todos os benefícios.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">Contratar Plano</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {availableTemplates.length === 0 ? (
            <p className="text-center text-gray-600">
              Nenhum plano disponível para sua unidade no momento.
            </p>
          ) : (
            <>
              <div className="space-y-4">
                {availableTemplates.map(template => (
                  <label
                    key={template.id}
                    className={`block p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      selectedTemplate === template.id
                        ? 'border-[#1d528d] bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="radio"
                        name="contract"
                        value={template.id}
                        checked={selectedTemplate === template.id}
                        onChange={() => setSelectedTemplate(template.id)}
                        className="text-[#1d528d] focus:ring-[#1d528d]"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800">
                          {template.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {template.description}
                        </p>
                        <div className="mt-2 flex items-center gap-4 text-sm text-gray-700">
                          <div className="flex items-center gap-1">
                            <Calendar size={16} />
                            <span>{template.duration} meses</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign size={16} />
                            <span>
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL'
                              }).format(template.value)}/mês
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <button
                onClick={handlePurchase}
                disabled={!selectedTemplate || isProcessing}
                className="w-full bg-[#1d528d] text-white py-3 px-4 rounded-md hover:bg-[#164070] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    Processando...
                  </>
                ) : (
                  <>
                    <DollarSign size={20} />
                    Contratar Plano
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}