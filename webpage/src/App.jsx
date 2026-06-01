import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Academic from './pages/Academic'
import Activity from './pages/Activity'
import Certificate from './pages/Certificate'
import Honor from './pages/Honor'
import HonorProfile from './pages/HonorProfile'
import PartyStudent from './pages/PartyStudent'
import PartyAdminList from './pages/PartyAdminList'
import PartyAdminEdit from './pages/PartyAdminEdit'
import PolicyQA from './pages/PolicyQA'
import Reminder from './pages/Reminder'
import TagManagement from './pages/TagManagement'
import { getSession } from './services/api'

function RequireAuth({ children }) {
  const s = getSession()
  if (!s || !s.token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route path="/academic" element={<RequireAuth><Academic /></RequireAuth>} />
      <Route path="/activity" element={<RequireAuth><Activity /></RequireAuth>} />
      <Route path="/certificate" element={<RequireAuth><Certificate /></RequireAuth>} />
      <Route path="/honor" element={<RequireAuth><Honor /></RequireAuth>} />
      <Route path="/honor/:accountId" element={<RequireAuth><HonorProfile /></RequireAuth>} />
      <Route path="/party/student" element={<RequireAuth><PartyStudent /></RequireAuth>} />
      <Route path="/party/admin/list" element={<RequireAuth><PartyAdminList /></RequireAuth>} />
      <Route path="/party/admin/edit/:accountId" element={<RequireAuth><PartyAdminEdit /></RequireAuth>} />
      <Route path="/policy-qa" element={<RequireAuth><PolicyQA /></RequireAuth>} />
      <Route path="/reminder" element={<RequireAuth><Reminder /></RequireAuth>} />
      <Route path="/tag-management" element={<RequireAuth><TagManagement /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
