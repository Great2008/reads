import React, { useState, useEffect } from 'react';
import { Wallet, Clock, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';

// --- NEW/FIXED: Helper function to safely format the date ---
const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    try {
        // Handle both full ISO strings and potential truncated timestamps
        const date = new Date(isoString);
        if (isNaN(date.getTime())) {
            // Fallback for invalid date strings (should not happen with our backend schema, but good practice)
            return new Date(isoString.split('T')[0]).toLocaleDateString('en-US');
        }
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    } catch (e) {
        console.error("Error formatting date:", e);
        return 'Invalid Date';
    }
};

const WalletModule = ({ balance, onUpdateBalance }) => {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch both balance and history on component load
    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch balance (optional, as App.jsx likely handles it, but keeps module self-contained)
            const balanceResponse = await api.wallet.getBalance();
            // Assuming getBalance returns an object with { token_balance: N }
            onUpdateBalance(balanceResponse.token_balance);
            
            // CRITICAL: Fetch history. This must hit the /api/wallet/history route.
            const historyData = await api.wallet.getHistory();
            setHistory(historyData);

        } catch (error) {
            console.error("Failed to fetch wallet data:", error);
            // Optionally show a toast error here
        } finally {
            setIsLoading(false);
        }
    };

    fetchData();
  }, [onUpdateBalance]); // Depend on onUpdateBalance to refresh the main App state

  // --- FIXED: Render function uses the correct backend fields ---
  const renderHistoryItem = (tx) => {
      const isReward = tx.type === 'Reward';
      const icon = isReward 
          ? <TrendingUp size={16} className='text-green-500' /> 
          : <Clock size={16} className='text-gray-500'/>; // Placeholder for other types
      const amountColor = isReward ? 'text-green-600 dark:text-green-400' : 'text-gray-500';

      return (
        // Key must be unique, tx.id is a UUID string, so this is correct.
        <div key={tx.id} className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
                {icon}
                <div>
                    {/* Use lesson_title from the backend data */}
                    <p className='text-sm font-semibold dark:text-white'>{tx.lesson_title || tx.type || 'Transaction'}</p> 
                    {/* Safely format the created_at timestamp */}
                    <p className='text-xs text-gray-500'>{formatDate(tx.created_at)}</p>
                </div>
            </div>
            {/* Use tokens_earned from the backend data */}
            <span className={`font-bold ${amountColor}`}>{`+${tx.tokens_earned} TKN`}</span>
        </div>
      );
  };
    // -------------------------------------------------------------------

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
                    <Clock size={24} className="mx-auto mb-2 text-gray-400"/>
                    <p>No transactions yet.</p>
                    <p className='text-sm mt-1'>Complete a quiz with a score of 70% or more to earn your first tokens!</p>
                </div>
            )}
        </div>
      </div>

    </div>
  );
};

export default WalletModule;
