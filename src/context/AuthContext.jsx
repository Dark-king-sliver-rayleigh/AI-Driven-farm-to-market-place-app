import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, tokenStorage, userStorage } from '../services/authService';

const AuthContext = createContext(null);

/**
 * AuthProvider - Manages authentication state
 * Provides login, register, logout functions and user state
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing token on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = tokenStorage.get();
      const storedUser = userStorage.get();
      
      if (token && storedUser) {
        try {
          // Verify token is still valid
          const response = await authAPI.getMe(token);
          setUser(response.user);
        } catch (err) {
          // Token invalid, clear storage
          tokenStorage.remove();
          userStorage.remove();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  /**
   * Register new user
   */
  const register = async (name, phone, password, role) => {
    try {
      setError(null);
      const response = await authAPI.register({ name, phone, password, role });
      tokenStorage.set(response.token);
      userStorage.set(response.user);
      setUser(response.user);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Login user
   */
  const login = async (phone, password) => {
    try {
      setError(null);
      const response = await authAPI.login({ phone, password });
      tokenStorage.set(response.token);
      userStorage.set(response.user);
      setUser(response.user);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Logout user
   */
  const logout = () => {
    tokenStorage.remove();
    userStorage.remove();
    setUser(null);
  };

  /**
   * Update user data (e.g., after profile update)
   */
  const updateUser = (newUserData) => {
    setUser(prevUser => ({ ...prevUser, ...newUserData }));
    userStorage.set({ ...user, ...newUserData });
  };

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    register,
    login,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
