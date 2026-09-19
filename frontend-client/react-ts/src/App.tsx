import { Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Claims'
import Projects from './pages/Policies'
import Login from './pages/Login'
import Register from './pages/Register'
import ProtectedRoute from './ProtectedRoute'
import Footer from './Footer'
import './App.css'

function App() {
  return (
    <>
      <div className="app-content">
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <Tasks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <Projects />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </div>
      <Footer />
    </>
  )
}

export default App
