import React, { useState, useEffect } from 'react';
import { LayoutDashboard, BookOpen, Wallet, User, Settings as SettingsIcon, Menu, X, Sun, Moon, LogOut, Shield } from 'lucide-react';

// --- SERVICE & MODULE IMPORTS ---
import { api } from './services/api';
import AuthModule from './modules/auth/AuthModule.jsx';
import Dashboard from './modules/dashboard/Dashboard.jsx';
import LearnModule from './modules/learn/LearnModule.jsx';
import WalletModule from './modules/wallet/WalletModule.jsx';
import ProfileModule from './modules/profile/ProfileModule.jsx';
import SettingsModule from './modules/settings/SettingsModule.jsx';
import AdminModule from './modules/admin/AdminModule.jsx'; // <--- IMPORT ADDED

// --- Helper Components ---

const ThemeToggle = ({ onClick, isDark }) => (
    <button 
        onClick={onClick} 
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
    >
        {isDark ? <Sun className="text-yellow-400" size={20} /> : <Moon className="text-indigo-600" size={20} />}
    </button>
);

// --- Main Application Component ---
export default function App() {
  const [user, setUser] = useState(null); // Full user profile from /user/profile
  const [tokenBalance, setTokenBalance] = useState(0); // Current wallet balance
  const [view, setView] = useState('login'); // 'login', 'dashboard', 'learn', etc.
  const [authView, setAuthView] = useState('login'); // 'login', 'signup', 'forgot-password'
  const [subView, setSubView] = useState(''); // Used by LearnModule
  const [navPayload, setNavPayload] = useState(null); // Data passed to sub-modules
  const [darkMode, setDarkMode] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches); 
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // --- Handlers ---
  const toggleTheme = () => {
    setDarkMode(prev => !prev);
  };

  const handleNavigate = (newView, newSubView = '', payload = null) => {
    setView(newView);
    setSubView(newSubView);
    setNavPayload(payload);
    setSidebarOpen(false); // Close sidebar after navigation on mobile
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setUser(null);
    setTokenBalance(0);
    setView('login');
    setAuthView('login');
    setSidebarOpen(false);
  };

  const handleLoginSuccess = async () => {
    const userData = await api.auth.me();
    if (userData) {
        setUser(userData);
        // Fetch initial balance
        const balance = await api.wallet.getBalance();
        setTokenBalance(balance);
        handleNavigate('dashboard');
    } else {
        // Should not happen if token is valid, but fallback
        handleLogout();
    }
  };


  // 1. Check for User Session and Fetch Initial Data on App Load
  useEffect(() => {
    const checkSession = async () => {
        const token = localStorage.getItem('access_token');
        if (token) {
            await handleLoginSuccess(); // Attempts to fetch user data and balance
        } 
        setIsLoading(false);
    };

    checkSession();
  }, []);

  // 2. Dark Mode Toggle Effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // 3. Update Balance on mount (in case they navigated back to dashboard)
  useEffect(() => {
      if (view === 'dashboard' && user) {
          api.wallet.getBalance().then(setTokenBalance);
      }
  }, [view, user]);


  // --- Render Auth or App Shell ---

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen text-lg dark:bg-slate-900 dark:text-white">Loading $READS...</div>;
  }
  
  if (!user || view === 'login') {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900 p-4">
            <AuthModule 
                view={authView} 
                onLoginSuccess={handleLoginSuccess} 
                onNavigate={setAuthView} 
                logoUrl="/logo-placeholder.png"
            />
        </div>
    );
  }

  // --- Navigation Items ---
  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, view: 'dashboard' },
    { name: 'Learn', icon: BookOpen, view: 'learn', subView: 'categories' },
    { name: 'Wallet', icon: Wallet, view: 'wallet' },
    { name: 'Profile', icon: User, view: 'profile' },
    { name: 'Settings', icon: SettingsIcon, view: 'settings' },
  ];
  
  // Conditionally add Admin Panel to navigation
  if (user?.is_admin) {
      navItems.push({ name: 'Admin Panel', icon: Shield, view: 'admin' });
  }


  return (
    <div className={`flex min-h-screen bg-gray-50 dark:bg-slate-900 ${darkMode ? 'dark' : ''}`}>
      
      {/* --- Sidebar (Desktop & Mobile) --- */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 md:static md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
                   w-64 bg-white dark:bg-slate-800 shadow-xl md:shadow-none p-4 flex flex-col transition-transform duration-300 border-r border-gray-200 dark:border-slate-700`}
      >
        <div className="flex justify-between items-center mb-8">
            <div className='flex items-center gap-3'>
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-lg font-extrabold">$R</div>
                <span className="font-bold text-lg dark:text-white">$READS</span>
            </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1">
            <X size={24} className='dark:text-white' />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-2">
          {navItems.map(item => (
            <button
              key={item.name}
              onClick={() => handleNavigate(item.view, item.subView)}
              className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-colors font-medium 
                         ${view === item.view 
                            ? 'bg-indigo-500 text-white shadow-md' 
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'}`
                        }
            >
              <item.icon size={18} />
              {item.name}
            </button>
          ))}
        </nav>

        {/* Footer/Logout */}
        <div className="mt-8 pt-4 border-t border-gray-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 dark:text-white">
                    <img 
                        src={user.avatar} 
                        className="w-8 h-8 rounded-full object-cover" 
                        alt="Profile" 
                    />
                    <span className='text-sm font-semibold truncate max-w-[100px]'>{user.name}</span>
                </div>
                <ThemeToggle onClick={toggleTheme} isDark={darkMode} />
            </div>

            <button
                onClick={handleLogout}
                className="w-full py-2 rounded-xl text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 font-medium"
            >
                <LogOut size={16} /> Log Out
            </button>
        </div>
      </aside>

      {/* --- Main Content Area --- */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Mobile Header (Shows on mobile) */}
        <header className="p-4 flex justify-between items-center bg-white dark:bg-slate-800 md:hidden border-b border-gray-200 dark:border-slate-700 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className='dark:text-white'><Menu /></button>
          <span className="font-bold dark:text-white">$READS</span>
          <span className='w-6 h-6'></span> {/* Placeholder for alignment */}
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 w-full">
          <div className="max-w-4xl mx-auto w-full pb-20">
            {view === 'dashboard' && <Dashboard user={user} wallet={{balance: tokenBalance}} onNavigate={handleNavigate} />}
            
            {view === 'learn' && (
              <LearnModule 
                subView={subView} 
                activeData={navPayload} 
                onNavigate={handleNavigate} 
                // Updates balance in App.jsx state after a successful quiz
                onUpdateWallet={setTokenBalance} 
              />
            )}
            
            {view === 'wallet' && <WalletModule balance={tokenBalance} onUpdateBalance={setTokenBalance} />}
            
            {view === 'profile' && <ProfileModule user={user} onLogout={handleLogout} />}
            
            {view === 'settings' && <SettingsModule darkMode={darkMode} toggleTheme={toggleTheme} />}

            {/* --- ADMIN MODULE RENDERED HERE --- */}
            {view === 'admin' && <AdminModule user={user} />}
          </div>
        </div>
      </main>
    </div>
  );
}
