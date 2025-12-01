import React, { useState, useEffect } from 'react';
import { Wallet, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';

const WalletModule = ({ balance, onUpdateBalance }) => {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch both balance and history on component load
    const fetchData = async () => {
        setIsLoading(true);
        // We rely on App.jsx to fetch the initial balance, but fetch it here too for completeness
        const currentBalance = await api.wallet.getBalance();
        onUpdateBalance(currentBalance);
        
        const historyData = await api.wallet.getHistory();
        setHistory(historyData);
        setIsLoading(false);
    };

    fetchData();
  }, [onUpdateBalance]); // Depend on onUpdateBalance to refresh the main App state

  const renderHistoryItem = (tx) => {
      const isReward = tx.type === 'Reward';
      const icon = isReward ? <TrendingUp size={16}/> : <Clock size={16}/>;
      const amountColor = isReward ? 'text-green-600 dark:text-green-400' : 'text-gray-500';

      return (
        <div key={tx.id} className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isReward ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    {icon}
                </div>
                <div>
                    <p className="font-bold text-sm dark:text-white">{tx.title}</p>
                    <p className="text-xs text-gray-500">{tx.date}</p>
                </div>
            </div>
            <span className={`font-bold ${amountColor}`}>
                {isReward ? `+${tx.amount}` : tx.amount} TKN
            </span>
        </div>
      )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-3xl font-bold dark:text-white">My Wallet</h2>
      
      {/* Balance Card */}
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <p className="text-slate-400 text-xs uppercase tracking-widest mb-2">Current Token Balance</p>
        <h3 className="text-4xl font-bold">{balance} <span className="text-yellow-400 text-xl">TKN</span></h3>
        <p className='text-sm text-slate-400 mt-1'>Rewards are earned by completing quizzes.</p>
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
          <Wallet size={120} />
        </div>
      </div>

      {/* History Section */}
      <div>
        <h3 className="font-bold text-xl mb-4 dark:text-white">Recent Transactions</h3>
        <div className="space-y-3">
            {isLoading ? (
                <p className='text-center text-gray-500 dark:text-gray-400'>Loading history...</p>
            ) : history.length > 0 ? (
                history.map(renderHistoryItem)
            ) : (
                <div className="p-6 text-center bg-white dark:bg-slate-800 rounded-xl text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-slate-700">
                    <p>No transactions yet. Start learning to earn your first tokens!</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default WalletModule;
