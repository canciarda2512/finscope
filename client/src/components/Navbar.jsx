import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  TrendingUp, 
  User, 
  LogOut, 
  Bell, 
  Search, 
  LayoutDashboard 
} from 'lucide-react';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();

  // Aktif link stili (Tailwind ile dinamik kontrol)
  const navLinkClass = ({ isActive }) => 
    `text-sm font-medium transition-all pb-2 border-b-2 flex items-center gap-2 ${
      isActive 
        ? 'text-blue-500 border-blue-500' 
        : 'text-slate-400 border-transparent hover:text-slate-200'
    }`;

  return (
    <nav className="bg-[#0f172a] border-b border-slate-800 px-6 py-3 flex items-center justify-between sticky top-0 z-[100] shadow-md">
      
      {/* SOL: Logo ve Navigasyon Linkleri */}
      <div className="flex items-center gap-10">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20">
            <TrendingUp size={20} className="text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tighter italic">FinScope</span>
        </Link>

        {/* ORTA MENÜ: Sadece giriş yapılmışsa gösterilir */}
        <div className="hidden lg:flex gap-6 items-center mt-1">
          {isAuthenticated && (
            <>
              <NavLink to="/" className={navLinkClass}>
                Chart
              </NavLink>
              <NavLink to="/portfolio" className={navLinkClass}>
                Portfolio
              </NavLink>
              <NavLink to="/watchlist" className={navLinkClass}>
                Watchlist
              </NavLink>
              <NavLink to="/screener" className={navLinkClass}>
                Screener
              </NavLink>
              <NavLink to="/strategy" className={navLinkClass}>
                Strategy
              </NavLink>
              <NavLink to="/multi-chart" className={navLinkClass}>
                Multi-chart
              </NavLink>
            </>
          )}
        </div>
      </div>

      {/* SAĞ TARAF: Araçlar ve Profil */}
      <div className="flex items-center gap-5">
        {/* Arama ve Bildirim İkonları */}
        <div className="hidden md:flex items-center gap-4 text-slate-400 mr-2 border-r border-slate-700 pr-5">
          <Search size={18} className="hover:text-white cursor-pointer transition-colors" />
          <Bell size={18} className="hover:text-white cursor-pointer transition-colors" />
        </div>

        {isAuthenticated ? (
          <div className="flex items-center gap-4">
            {/* Kullanıcı Rozeti */}
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full shadow-inner">
              <User size={14} className="text-blue-400" />
              <span className="text-slate-200 text-xs font-semibold">
                @{user?.username || 'user'}
              </span>
            </div>
            
            {/* Çıkış Butonu */}
            <button 
              onClick={logout}
              title="Sign Out"
              className="p-2 text-slate-500 hover:text-red-400 transition-all transform hover:scale-110"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Link to="/login" className="text-slate-300 hover:text-white px-4 py-1.5 text-sm transition font-medium">
              Login
            </Link>
            <Link to="/register" className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-1.5 rounded-lg text-sm font-bold transition shadow-lg shadow-blue-900/30">
              Register
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}