import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/Authcontext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import ChartPage from './pages/ChartPage';
import PortfolioPage from './pages/PortfolioPage';
import WatchlistPage from './pages/WatchlistPage';
import ScreenerPage from './pages/ScreenerPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MultiChartPage from './pages/MultiChartPage';
import StrategyPage from './pages/StrategyPage';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="bg-[#0a0e1a] min-h-screen" />;
  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Redirect away from auth pages if already logged in
const GuestOnly = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="bg-[#0a0e1a] min-h-screen" />;
  return isAuthenticated ? <Navigate to="/" /> : children;
};

export default function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <Navbar />
          <main className="flex-grow flex flex-col">
            <Routes>
              {/* Chart is public — guests can view charts and indicators */}
              <Route path="/" element={<ChartPage />} />

              {/* Auth pages — redirect to chart if already logged in */}
              <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
              <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />

              {/* Protected — requires login */}
              <Route path="/portfolio" element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>} />
              <Route path="/watchlist" element={<ProtectedRoute><WatchlistPage /></ProtectedRoute>} />
              <Route path="/screener" element={<ProtectedRoute><ScreenerPage /></ProtectedRoute>} />
              <Route path="/strategy" element={<ProtectedRoute><StrategyPage /></ProtectedRoute>} />
              <Route path="/multi-chart" element={<ProtectedRoute><MultiChartPage /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}
