import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import LeadsOverviewPage from './pages/dashboard/LeadsOverviewPage.jsx';
import QualifiedLeadsPage from './pages/dashboard/QualifiedLeadsPage.jsx';
import LiveChatsPage from './pages/dashboard/LiveChatsPage.jsx';
import SettingsPage from './pages/dashboard/SettingsPage.jsx';
import WhatsAppLinkPage from './pages/dashboard/WhatsAppLinkPage.jsx';
import KnowledgePage from './pages/dashboard/KnowledgePage.jsx';
import BotPlaygroundPage from './pages/dashboard/BotPlaygroundPage.jsx';
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard">
            <Route index element={<LeadsOverviewPage />} />
            <Route path="qualified" element={<QualifiedLeadsPage />} />
            <Route path="chats" element={<LiveChatsPage />} />
            <Route path="whatsapp" element={<WhatsAppLinkPage />} />
            <Route path="knowledge" element={<KnowledgePage />} />
            <Route path="playground" element={<BotPlaygroundPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="/settings/ai-voice" element={<Navigate to="/dashboard/settings" replace />} />
        </Route>
      </Route>
      <Route path="/dashboard/ai" element={<Navigate to="/dashboard/settings" replace />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
