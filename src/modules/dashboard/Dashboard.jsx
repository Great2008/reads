import React, { useState, useEffect } from 'react';
import { PlayCircle, Wallet, Award, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';

const Dashboard = ({ user, wallet, onNavigate }) => {
  const [stats, setStats] = useState({ lessons_completed: 0, quizzes_taken: 0 });

  // Fetch user stats when the component mounts
  useEffect(() => {
    api.profile.getStats().then(setStats);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* --- Welcome Banner --- */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <img 
              src={user.avatar} 
              className="w-14 h-14 rounded-full border-2 border-white/30 object-cover" 
              alt="Profile" 
            />
            <div>
              <p className="text-indigo-100 text-sm">Welcome back,</p>
              <h2 className="text-2xl font-bold">{user.name}</h2>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/20 backdrop-blur rounded-xl p-3 flex-1">
              <p className="text-xs uppercase opacity-75 mb-1">Balance</p>
              <p className="text-xl font-bold">{wallet.balance} <span className="text-sm">TKN</span></p>
            </div>
            <div className="bg-white/20 backdrop-blur rounded-xl p-3 flex-1">
              <p className="text-xs uppercase opacity-75 mb-1">Lessons Done</p>
              <p className="text-xl font-bold">{stats.lessons_completed}</p>
            </div>
            <div className="bg-white/20 backdrop-blur rounded-xl p-3 flex-1">
              <p className="text-xs uppercase opacity-75 mb-1">Quizzes Taken</p>
              <p className="text-xl font-bold">{stats.quizzes_taken}</p>
            </div>
          </div>
        </div>
        {/* Decorative Background Element */}
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
      </div>

      {/* --- Quick Actions --- */}
      <h3 className="text-xl font-bold text-gray-800 dark:text-white pt-4">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-4">
        {/* Start Learning Card */}
        <button 
          onClick={() => onNavigate('learn', 'categories')} 
          className="p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all text-left group border border-gray-100 dark:border-slate-700"
        >
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <PlayCircle size={24} />
          </div>
          <h3 className="font-bold text-gray-800 dark:text-white">Start Learning</h3>
          <p className="text-xs text-gray-500 mt-1">Explore new subjects and lessons.</p>
        </button>

        {/* Check Wallet Card */}
        <button 
          onClick={() => onNavigate('wallet')} 
          className="p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all text-left group border border-gray-100 dark:border-slate-700"
        >
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Wallet size={24} />
          </div>
          <h3 className="font-bold text-gray-800 dark:text-white">My Wallet</h3>
          <p className="text-xs text-gray-500 mt-1">View your tokens and reward history.</p>
        </button>
      </div>

      {/* --- Latest Rewards --- */}
      <div className="pt-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Latest Rewards</h3>
        
        {/* Placeholder for fetching latest rewards. We'll use a mocked card for now */}
        <div className="p-4 bg-yellow-50 dark:bg-slate-700 rounded-2xl border-l-4 border-yellow-400 flex justify-between items-center shadow-sm">
            <div className='flex items-center gap-3'>
                <Award size={20} className='text-yellow-600'/>
                <div>
                    <p className='text-sm font-semibold dark:text-white'>Introduction to Algebra Quiz</p>
                    <p className='text-xs text-gray-500'>May 28, 2024</p>
                </div>
            </div>
            <span className='font-bold text-green-600 dark:text-green-400'>+20 TKN</span>
        </div>
        
        <button onClick={() => onNavigate('wallet')} className='mt-3 text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1'>
            View All History <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
