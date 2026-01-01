const API_BASE = 'http://localhost:5000/api';

/**
 * Auth API service
 * Handles all authentication-related API calls
 */
export const authAPI = {
  /**
   * Register a new user
   * @param {Object} data - { name, phone, password, role }
   */
  async register(data) {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Registration failed');
    }
    return result;
  },

  /**
   * Login user
   * @param {Object} data - { phone, password }
   */
  async login(data) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Login failed');
    }
    return result;
  },

  /**
   * Get current user info
   * @param {string} token - JWT token
   */
  async getMe(token) {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json' 
      },
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Failed to get user');
    }
    return result;
  },
};

/**
 * Token management
 * Uses sessionStorage for tab-isolated sessions
 * Each tab maintains its own independent login session
 */
export const tokenStorage = {
  get() {
    return sessionStorage.getItem('authToken');
  },
  set(token) {
    sessionStorage.setItem('authToken', token);
  },
  remove() {
    sessionStorage.removeItem('authToken');
  },
};

/**
 * User data management
 * Uses sessionStorage for tab-isolated sessions
 */
export const userStorage = {
  get() {
    const data = sessionStorage.getItem('authUser');
    return data ? JSON.parse(data) : null;
  },
  set(user) {
    sessionStorage.setItem('authUser', JSON.stringify(user));
  },
  remove() {
    sessionStorage.removeItem('authUser');
  },
};

