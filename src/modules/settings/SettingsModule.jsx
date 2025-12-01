import React from 'react';
import { Moon, Sun, ShieldCheck } from 'lucide-react';

const SettingsModule = ({ darkMode, toggleTheme }) => (
  <div className="space-y-6 animate-fade-in">
    <h2 className="text-3xl font-bold dark:text-white">Settings</h2>
    
    {/* Theme Toggle */}
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 flex justify-between items-center border border-gray-100 dark:border-slate-700">
      <div className="flex items-center gap-4">
        {darkMode 
            ? <Moon size={24} className="text-indigo-500" /> 
            : <Sun size={24} className="text-orange-500" />
        }
        <div>
            <span className="font-bold dark:text-white">Dark Mode</span>
            <p className='text-sm text-gray-500'>Switch between light and dark themes.</p>
        </div>
      </div>
      <button 
        onClick={toggleTheme} 
        className={`w-14 h-8 rounded-full p-1 transition-colors ${darkMode ? 'bg-indigo-600' : 'bg-gray-300'}`}
      >
        <div 
            className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${darkMode ? 'translate-x-6' : ''}`} 
        />
      </button>
    </div>

    {/* Version Info */}
    <div className='pt-8 text-center text-gray-400 text-sm space-y-2'>
        <ShieldCheck size={20} className='mx-auto text-green-500'/>
        <p>Application Version 1.0.0 (MVP)</p>
        <p>Backend powered by Python/FastAPI.</p>
    </div>
  </div>
);

export default SettingsModule;
