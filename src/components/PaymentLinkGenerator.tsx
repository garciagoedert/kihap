import React, { useState } from 'react';
import { Link2, Copy, Check, X } from 'lucide-react';
import { Student } from '../types';

interface PaymentLinkGeneratorProps {
  student: Student;
  onClose: () => void;
}

export default function PaymentLinkGenerator({ student, onClose }: PaymentLinkGeneratorProps) {
  const [copied, setCopied] = useState(false);
  
  // Generate a unique payment link for the student
  const paymentLink = `${window.location.origin}/payment/${btoa(JSON.stringify({
    studentId: student.id,
    name: student.name,
    email: student.email,
    timestamp: Date.now()
  }))}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(paymentLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">Link de Pagamento</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Link gerado para {student.name}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={paymentLink}
                readOnly
                className="flex-1 rounded-md border-gray-300 bg-gray-50 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              />
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 bg-[#1d528d] text-white px-4 py-2 rounded-md hover:bg-[#164070] transition-colors"
              >
                {copied ? <Check size={20} /> : <Copy size={20} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>

          <div className="bg-blue-50 text-blue-800 p-4 rounded-md text-sm">
            <p className="flex items-center gap-2">
              <Link2 size={20} />
              <span>
                Envie este link para o aluno para que ele possa contratar um plano diretamente.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}