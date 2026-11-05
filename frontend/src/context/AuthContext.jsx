import { createContext, useContext, useState } from 'react'
import { decodeJwt } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    try {
      const stored = sessionStorage.getItem('finshield_auth')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  function signin(token) {
    const claims = decodeJwt(token)
    const data = { token, claims }
    try { sessionStorage.setItem('finshield_auth', JSON.stringify(data)) } catch (_) {}
    setAuth(data)
  }

  function signout() {
    try { sessionStorage.removeItem('finshield_auth') } catch (_) {}
    setAuth(null)
  }

  return (
    <AuthContext.Provider value={{ auth, signin, signout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
