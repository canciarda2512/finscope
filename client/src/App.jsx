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

// "/" → LandingPage (misafir) veya ChartPage (giriş yapmış)
const HomeRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="bg-[#020617] min-h-screen" />;
  return isAuthenticated ? <ChartPage /> : <LandingPage />;
};

// Korumalı rota: giriş yapılmamışsa login'e yönlendir
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="bg-[#020617] min-h-screen" />;
  return isAuthenticated ? children : <Navigate to="/login" />;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <div className="flex flex-col min-h-screen bg-[#020617]">
            <Navbar />
            <main className="flex-grow">
              <Routes>
                {/* Ana sayfa: misafir → Landing, kullanıcı → Chart */}
                <Route path="/" element={<HomeRoute />} />

                {/* Herkese açık (misafir + kullanıcı) */}
                <Route path="/login"    element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/chart"    element={<ChartPage />} />

                {/* Korumalı sayfalar */}
                <Route path="/portfolio"  element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>} />
                <Route path="/watchlist"  element={<ProtectedRoute><WatchlistPage /></ProtectedRoute>} />
                <Route path="/screener"   element={<ProtectedRoute><ScreenerPage /></ProtectedRoute>} />
                <Route path="/strategy"   element={<ProtectedRoute><StrategyPage /></ProtectedRoute>} />
                <Route path="/multi-chart" element={<ProtectedRoute><MultiChartPage /></ProtectedRoute>} />
                <Route path="/profile"    element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </main>
          </div>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
