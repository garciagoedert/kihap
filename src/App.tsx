import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import UnitDashboard from './components/UnitDashboard';
import UnitManagement from './components/UnitManagement';
import UserManagement from './components/UserManagement';
import ClassManagement from './components/ClassManagement';
import CRMBoard from './components/CRMBoard';
import ChatDashboard from './components/chat/ChatDashboard';
import Tasks from './components/Tasks';
import Chat from './components/Chat';
import Home from './components/Home';
import LeadRegistration from './components/LeadRegistration';
import LocationLanding from './components/LocationLanding';
import ProgramLanding from './components/ProgramLanding';
import CharacterPage from './components/CharacterPage';
import UserProfile from './components/UserProfile';
import AdminDashboard from './components/admin/AdminDashboard';
import StudentPortal from './components/student/StudentPortal';
import PrivacyAndCopyright from './components/PrivacyAndCopyright';
import PaymentPage from './components/PaymentPage';
import OnlineContentManagement from './components/OnlineContentManagement';
import BadgeManagement from './components/BadgeManagement';
import LeadChatWrapper from './components/chat/LeadChatWrapper';
import About from './components/About';
import Metodologia from './components/Metodologia';
import KihapEmAcao from './components/KihapEmAcao';
import { useAuthStore } from './store/useAuthStore';
import { checkAndResetStorage } from './utils/storage';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    // Verificar e resetar o storage se necessário
    checkAndResetStorage();
  }, []);

  return (
    <Router>
      <ScrollToTop />
      <div className="relative">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/sobre" element={<About />} />
          <Route path="/metodologia" element={<Metodologia />} />
          <Route path="/kihap-em-acao" element={<KihapEmAcao />} />
          <Route path="/cadastro" element={<LeadRegistration />} />
          <Route path="/unidade/:location" element={<LocationLanding />} />
          <Route path="/programa/:program" element={<ProgramLanding />} />
          <Route path="/personagem/:characterId" element={<CharacterPage />} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
          <Route path="/privacidade-e-direitos" element={<PrivacyAndCopyright />} />
          <Route path="/payment/:token" element={<PaymentPage />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard/*"
            element={
              user ? (
                <div className="min-h-screen bg-gray-100 relative">
                  <Header />
                  <Routes>
                    <Route index element={user.role === 'admin' ? <Dashboard /> : <Navigate to={`/unit/${user.unitId}`} />} />
                    <Route path="unit/:unitId" element={<UnitDashboard />} />
                    <Route path="units/manage" element={user.role === 'admin' ? <UnitManagement /> : <Navigate to="/" />} />
                    <Route path="users/manage" element={user.role === 'admin' ? <UserManagement /> : <Navigate to="/" />} />
                    <Route path="classes" element={user.role === 'admin' || user.role === 'instructor' ? <ClassManagement /> : <Navigate to="/" />} />
                    <Route path="crm" element={user.role === 'admin' || user.role === 'manager' ? <CRMBoard /> : <Navigate to="/" />} />
                    <Route path="messages" element={user.role === 'admin' || user.role === 'manager' ? <ChatDashboard /> : <Navigate to="/" />} />
                    <Route path="tasks" element={<Tasks />} />
                    <Route path="profile" element={<UserProfile />} />
                    <Route path="admin/*" element={user.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />} />
                    <Route path="online" element={<OnlineContentManagement />} />
                    <Route path="badges" element={<BadgeManagement />} />
                  </Routes>
                  <Chat />
                </div>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route path="/portal" element={<StudentPortal />} />

          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <LeadChatWrapper />
      </div>
    </Router>
  );
}

export default App;
