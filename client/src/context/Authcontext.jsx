import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import APIClient from '../services/APIClient';
import TokenManager from '../services/TokenManager';

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

  const login = (userData, accessToken, refreshToken) => {
    TokenManager.setTokens(accessToken, refreshToken);
    setUser(userData);
    navigate('/');
  };

  const logout = () => {
    TokenManager.clear();
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
