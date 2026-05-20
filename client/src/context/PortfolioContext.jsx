import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './Authcontext';
import APIClient from '../services/APIClient';

const PortfolioContext = createContext();

export function PortfolioProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPortfolio = useCallback(async (showLoading = false) => {
    if (!isAuthenticated) return;
    if (showLoading) setLoading(true);

    try {
      const res = await APIClient.get('/portfolio');
      setPortfolio(res.data);
    } catch (err) {
      console.error('Portfolio fetch error:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setPortfolio(null);
      setLoading(false);
      return;
    }

    fetchPortfolio(true);
    const id = setInterval(() => fetchPortfolio(false), 30000);
    return () => clearInterval(id);
  }, [isAuthenticated, fetchPortfolio]);

  // Allow components to trigger a refresh after trades
  const refresh = useCallback(() => fetchPortfolio(false), [fetchPortfolio]);

  return (
    <PortfolioContext.Provider value={{ portfolio, loading, refresh }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export const usePortfolio = () => useContext(PortfolioContext);
