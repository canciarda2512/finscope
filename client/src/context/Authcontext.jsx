import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import APIClient from '../services/APIClient';
import TokenManager from '../services/TokenManager';
import WebSocketClient from '../services/WebSocketClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Sayfa yüklendiğinde token varsa kullanıcıyı getir
  useEffect(() => {
    const accessToken = TokenManager.getAccessToken();
    
    if (accessToken) {
      APIClient.get('/auth/me')
        .then(res => {
          setUser(res.data.user);
        })
        .catch(() => {
          // Token geçersizse temizle
          TokenManager.clear();
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleExpiredAuth = () => {
      TokenManager.clear();
      setUser(null);
      navigate('/login');
    };

    window.addEventListener('auth:expired', handleExpiredAuth);
    return () => window.removeEventListener('auth:expired', handleExpiredAuth);
  }, [navigate]);

  const login = async (userData, accessToken, refreshToken) => {
    TokenManager.setTokens(accessToken, refreshToken);
    WebSocketClient.reconnectWithToken();
    // Set provisional user data immediately, then fetch real profile
    setUser(userData);
    navigate('/');
    try {
      const res = await APIClient.get('/auth/me');
      setUser(res.data.user);
    } catch {
      // Keep provisional data if /auth/me fails
    }
  };

  const logout = () => {
    TokenManager.clear();
    WebSocketClient.reconnectWithToken();
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
