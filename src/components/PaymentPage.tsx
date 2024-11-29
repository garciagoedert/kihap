import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useDataStore } from '../store/useDataStore';
import ContractPurchase from './student/ContractPurchase';
import MainHeader from './MainHeader';
import Footer from './Footer';

interface PaymentData {
  studentId: number;
  name: string;
  email: string;
  timestamp: number;
}

export default function PaymentPage() {
  const { token } = useParams<{ token: string }>();
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { students } = useDataStore();

  useEffect(() => {
    if (token) {
      try {
        const decoded = JSON.parse(atob(token));
        // Validate timestamp (link expires after 24 hours)
        if (Date.now() - decoded.timestamp > 24 * 60 * 60 * 1000) {
          setError('Este link expirou. Por favor, solicite um novo link.');
          return;
        }
        setPaymentData(decoded);
      } catch (err) {
        setError('Link inválido');
      }
    }
  }, [token]);

  if (!token) return <Navigate to="/" />;
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100">
        <MainHeader />
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-800 mb-4">Erro</h1>
              <p className="text-gray-600">{error}</p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!paymentData) return null;

  const student = students.find(s => s.id === paymentData.studentId);
  if (!student) return <Navigate to="/" />;

  return (
    <div className="min-h-screen bg-gray-100">
      <MainHeader />
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Contratação de Plano
            </h1>
            <p className="text-gray-600">
              Olá {student.name}, escolha abaixo o plano que melhor se adequa às suas necessidades.
            </p>
          </div>

          <ContractPurchase
            student={student}
            onClose={() => {/* Handle close */}}
            onSuccess={() => {/* Handle success */}}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
}