import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/Authcontext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import ChartPage from './pages/ChartPage';
import LandingPage from './pages/LandingPage';
import PortfolioPage from './pages/PortfolioPage';
import WatchlistPage from './pages/WatchlistPage';
import ScreenerPage from './pages/ScreenerPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MultiChartPage from './pages/MultiChartPage';
import StrategyPage from './pages/StrategyPage';
import ProfilePage from './pages/ProfilePage';

// "/" shows LandingPage for guests, ChartPage for logged-in users
const HomeRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }} />;
  return isAuthenticated ? <ChartPage /> : <LandingPage />;
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }} />;
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const GuestOnly = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }} />;
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
              <Route path="/" element={<HomeRoute />} />

              {/* Public chart route */}
              <Route path="/chart" element={<ChartPage />} />

              {/* Auth pages */}
              <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
              <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />

              {/* Protected */}
              <Route path="/portfolio" element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>} />
              <Route path="/watchlist" element={<ProtectedRoute><WatchlistPage /></ProtectedRoute>} />
              <Route path="/screener" element={<ProtectedRoute><ScreenerPage /></ProtectedRoute>} />
              <Route path="/strategy" element={<ProtectedRoute><StrategyPage /></ProtectedRoute>} />
              <Route path="/multi-chart" element={<ProtectedRoute><MultiChartPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}
