import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';

export const DashboardLayout = () => {
  const { user, logout } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navLinkClass = (path: string) => {
    const base = 'block px-4 py-2 rounded-lg transition-all duration-200 font-medium';
    return isActive(path)
      ? `${base} bg-gradient-to-r from-brand-orange-500 to-brand-orange-600 text-white dark:from-brand-orange-400 dark:to-brand-orange-500 dark:text-gray-900 shadow-brand`
      : `${base} text-gray-700 hover:bg-brand-orange-50 dark:text-gray-300 dark:hover:bg-gray-700 hover:text-brand-orange-600 dark:hover:text-brand-orange-400`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navbar */}
      <nav className="bg-white dark:bg-gray-800 shadow-md">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center space-x-3">
                <img
                  src="/logo.png"
                  alt="TheiaCast Logo"
                  className="h-8 w-8 transition-transform hover:scale-105"
                />
                <div className="flex flex-col">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-brand-orange-500 to-brand-orange-600 bg-clip-text text-transparent dark:from-brand-orange-400 dark:to-brand-orange-500">
                    TheiaCast
                  </h1>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 -mt-1">
                    Digital Signage
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Dark Mode Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDark ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              <span className="text-sm text-gray-600 dark:text-gray-400">
                Welcome, <span className="font-medium text-gray-900 dark:text-white">{user?.username}</span>
              </span>
              <button
                onClick={handleLogout}
                className="btn-secondary text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar - Fixed width */}
        <aside className="w-64 bg-white dark:bg-gray-800 shadow-md flex-shrink-0 overflow-y-auto">
          <nav className="p-4 space-y-2">
            <Link to="/" className={navLinkClass('/')}>
              📊 Dashboard
            </Link>
            <Link to="/devices" className={navLinkClass('/devices')}>
              💻 Devices
            </Link>
            <Link to="/content" className={navLinkClass('/content')}>
              🎬 Content
            </Link>
            <Link to="/playlists" className={navLinkClass('/playlists')}>
              📅 Playlists
            </Link>
            <Link to="/logs" className={navLinkClass('/logs')}>
              📝 Logs
            </Link>
            <Link to="/users" className={navLinkClass('/users')}>
              👥 Users
            </Link>
            <Link to="/license" className={navLinkClass('/license')}>
              🔑 License
            </Link>
            <Link to="/settings" className={navLinkClass('/settings')}>
              ⚙️ Settings
            </Link>
          </nav>
        </aside>

        {/* Main Content - Scrollable */}
        <main className="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-gray-900 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
