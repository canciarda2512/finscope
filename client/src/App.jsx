import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/Authcontext';
import { ThemeProvider } from './context/ThemeContext';
import { PortfolioProvider } from './context/PortfolioContext';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import PageSkeleton from './components/PageSkeleton';

const ChartPage = lazy(() => import('./pages/ChartPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage'));
const ScreenerPage = lazy(() => import('./pages/ScreenerPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const MultiChartPage = lazy(() => import('./pages/MultiChartPage'));
const StrategyPage = lazy(() => import('./pages/StrategyPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

// "/" shows LandingPage for guests, ChartPage for logged-in users
const HomeRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageSkeleton />;
  return isAuthenticated ? <ChartPage /> : <LandingPage />;
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageSkeleton />;
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const GuestOnly = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageSkeleton />;
  return isAuthenticated ? <Navigate to="/" /> : children;
};

export default function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <PortfolioProvider>
        <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <Navbar />
          <main className="flex-grow flex flex-col">
            <ErrorBoundary>
              <Suspense fallback={<PageSkeleton />}>
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
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
        </PortfolioProvider>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}
