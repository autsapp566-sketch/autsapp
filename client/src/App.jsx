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
import TeamPage from './pages/dashboard/TeamPage.jsx';
import PermissionRoute from './components/PermissionRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard">
            <Route index element={<PermissionRoute to="/dashboard"><LeadsOverviewPage /></PermissionRoute>} />
            <Route path="qualified" element={<PermissionRoute to="/dashboard/qualified"><QualifiedLeadsPage /></PermissionRoute>} />
            <Route path="chats" element={<PermissionRoute to="/dashboard/chats"><LiveChatsPage /></PermissionRoute>} />
            <Route path="whatsapp" element={<PermissionRoute to="/dashboard/whatsapp"><WhatsAppLinkPage /></PermissionRoute>} />
            <Route path="knowledge" element={<PermissionRoute to="/dashboard/knowledge"><KnowledgePage /></PermissionRoute>} />
            <Route path="playground" element={<PermissionRoute to="/dashboard/playground"><BotPlaygroundPage /></PermissionRoute>} />
            <Route path="team" element={<PermissionRoute to="/dashboard/team"><TeamPage /></PermissionRoute>} />
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
