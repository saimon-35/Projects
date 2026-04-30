import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on app initialization
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Validate token and get user info
      fetch(import.meta.env.VITE_API_URL + '/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
        .then(response => response.json())
        .then(data => {
          if (data.user) {
            setUser(data.user);
          } else {
            // Invalid token, remove it
            localStorage.removeItem('token');
          }
        })
        .catch(() => {
          // Error occurred, remove token
          localStorage.removeItem('token');
        })
        .finally(() => {
          setLoading(false);
        });
    } 
    else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const response = await fetch(import.meta.env.VITE_API_URL + '/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    
    if (response.ok) {
      localStorage.setItem('token', data.token);
      setUser(data.user);
      return { success: true };
    } else {
      return { success: false, error: data.error };
    }
  };

  const register = async (username, email, password) => {
    const response = await fetch(import.meta.env.VITE_API_URL + '/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await response.json();
    
    if (response.ok) {
      localStorage.setItem('token', data.token);
      setUser(data.user);
      return { success: true };
    } else {
      return { success: false, error: data.error };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}