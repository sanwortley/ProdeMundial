import React, { createContext, useState, useEffect, useContext } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token')
      if (token) {
        try {
          // Fetch current user details from /auth/me
          const response = await api.get('/auth/me')
          setUser(response.data)
        } catch (error) {
          console.error("Token verification failed:", error)
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setUser(null)
        }
      }
      setLoading(false)
    }

    initializeAuth()
  }, [])

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password })
      const { access_token, usuario } = response.data
      
      localStorage.setItem('token', access_token)
      localStorage.setItem('user', JSON.stringify(usuario))
      
      setUser(usuario)
      return { success: true }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error de inicio de sesión'
      return { success: false, error: errorMsg }
    }
  }

  const register = async (nombre, email, password) => {
    try {
      await api.post('/auth/register', { nombre, email, password })
      // Auto login after registration
      return await login(email, password)
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error en el registro'
      return { success: false, error: errorMsg }
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe ser usado con un AuthProvider')
  }
  return context
}
