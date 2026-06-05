import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'

// Pages
import Login from './pages/Login'
import Register from './pages/Register'
import MyGroups from './pages/MyGroups'
import CreateGroup from './pages/CreateGroup'
import JoinGroup from './pages/JoinGroup'
import GroupDashboard from './pages/GroupDashboard'
import Predictions from './pages/Predictions'
import Ranking from './pages/Ranking'
import GroupSettings from './pages/GroupSettings'
import Rules from './pages/Rules'
import Fantasy from './pages/Fantasy'

// Components
import Navbar from './components/Navbar'
import BottomNav from './components/BottomNav'

const Layout = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen pb-16 md:pb-0 bg-soccer-dark">
      <Navbar />
      <main className="flex-1 bg-gradient-pitch min-h-[calc(100vh-60px)]">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route path="/my-groups" element={
            <ProtectedRoute>
              <Layout><MyGroups /></Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/create-group" element={
            <ProtectedRoute>
              <Layout><CreateGroup /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/join-group" element={
            <ProtectedRoute>
              <Layout><JoinGroup /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/rules" element={
            <ProtectedRoute>
              <Layout><Rules /></Layout>
            </ProtectedRoute>
          } />

          {/* Invitation Direct Link (Self handles auth routing on mount) */}
          <Route path="/unirse/:code" element={
            <Layout><JoinGroup /></Layout>
          } />

          <Route path="/groups/:groupId" element={
            <ProtectedRoute>
              <Layout><GroupDashboard /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/groups/:groupId/predictions" element={
            <ProtectedRoute>
              <Layout><Predictions /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/groups/:groupId/ranking" element={
            <ProtectedRoute>
              <Layout><Ranking /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/groups/:groupId/settings" element={
            <ProtectedRoute>
              <Layout><GroupSettings /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/groups/:groupId/fantasy" element={
            <ProtectedRoute>
              <Layout><Fantasy /></Layout>
            </ProtectedRoute>
          } />

          {/* Default Fallback */}
          <Route path="*" element={<Navigate to="/my-groups" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
