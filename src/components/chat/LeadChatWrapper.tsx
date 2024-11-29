import React from 'react';
import { useLocation } from 'react-router-dom';
import LeadChat from './LeadChat';

export default function LeadChatWrapper() {
  const { pathname } = useLocation();

  // Não mostrar o chat no portal do aluno ou no dashboard
  if (pathname.startsWith('/portal') || pathname.startsWith('/dashboard')) {
    return null;
  }

  return <LeadChat />;
}
