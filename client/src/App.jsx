import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ChartPage from './pages/ChartPage';
import PortfolioPage from './pages/PortfolioPage'; // Orijinal sayfan
import WatchlistPage from './pages/WatchlistPage'; // Orijinal sayfan
import ScreenerPage from './pages/ScreenerPage';   // Yeni oluşturduğumuz sayfa
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MultiChartPage from './pages/MultiChartPage';

// Henüz dosyası olmayan sayfalar için basit taslaklar
const StrategyPage = () => <div className="p-20 text-white opacity-20 text-center text-2xl font-bold">Strategy Builder ...</div>;

// Korumalı rota bileşeni
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  // Auth yüklenirken boş ekran vererek sıçramayı önle
  if (loading) return <div className="bg-[#020617] min-h-screen"></div>;
  
  return isAuthenticated ? children : <Navigate to="/login" />;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="flex flex-col min-h-screen bg-[#020617]">
          {/* Navbar artık AuthProvider içinde olduğu için user verilerini çeker */}
          <Navbar />
          
          <main className="flex-grow">
            <Routes>
              {/* Herkese Açık */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Sadece Giriş Yapanlara Özel (Korumalı) */}
              <Route 
                path="/" 
                element={<ProtectedRoute><ChartPage /></ProtectedRoute>} 
              />
              <Route 
                path="/portfolio" 
                element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>} 
              />
              <Route 
                path="/watchlist" 
                element={<ProtectedRoute><WatchlistPage /></ProtectedRoute>} 
              />
              <Route 
                path="/screener" 
                element={<ProtectedRoute><ScreenerPage /></ProtectedRoute>} 
              />
              <Route 
                path="/strategy" 
                element={<ProtectedRoute><StrategyPage /></ProtectedRoute>} 
              />
              <Route 
                path="/multi-chart" 
                element={<ProtectedRoute><MultiChartPage /></ProtectedRoute>} 
              />

              {/* Hatalı linkleri ana sayfaya yolla */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
