import React, { useState, useEffect } from 'react';
import { Users, BookOpen, Plus, ShieldOff, Trash2, Video, List, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

// --- Component 1: Permission Denied ---
const PermissionDenied = () => (
    <div className="text-center p-12 bg-red-50 dark:bg-red-950 rounded-2xl shadow-xl space-y-4 animate-fade-in">
        <ShieldOff size={48} className="text-red-600 dark:text-red-400 mx-auto" />
        <h2 className="text-2xl font-bold text-red-700 dark:text-red-300">Access Denied</h2>
        <p className="text-gray-600 dark:text-gray-400">
            You do not have administrative privileges to view this panel.
        </p>
    </div>
);

// --- Component 2: User Management (REAL API) ---
const UserManagement = ({ currentAdminId }) => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            // 💥 REAL API CALL
            const data = await api.admin.getUsers();
            setUsers(data);
            setError(null);
        } catch (err) {
            setError("Failed to fetch users.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handlePromotion = async (userToUpdate, isAdmin) => {
        if (!window.confirm(`Are you sure you want to ${isAdmin ? 'PROMOTE' : 'DEMOTE'} ${userToUpdate.name}?`)) return;

        try {
            // 💥 REAL API CALL
            await api.admin.promoteUser(userToUpdate.id, isAdmin);
            // Update local state immediately
            setUsers(users.map(u => u.id === userToUpdate.id ? { ...u, is_admin: isAdmin } : u));
        } catch (error) {
            alert(`Operation failed: ${error.message}`);
        }
    };

    if (isLoading) return <p className="text-center dark:text-white p-8">Loading users from database...</p>;
    if (error) return <p className="text-center text-red-500 p-8">{error}</p>;

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold dark:text-white">All System Users ({users.length})</h3>
                <button onClick={fetchUsers} className="text-sm text-indigo-600 hover:underline">Refresh List</button>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden border border-gray-100 dark:border-slate-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className="bg-gray-50 dark:bg-slate-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Role</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.is_admin ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'}`}>
                                        {user.is_admin ? 'Admin' : 'Learner'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button 
                                        onClick={() => handlePromotion(user, !user.is_admin)}
                                        disabled={user.id === currentAdminId} 
                                        className={`text-xs px-3 py-1 rounded border transition-colors ${
                                            user.is_admin 
                                            ? 'border-red-200 text-red-600 hover:bg-red-50' 
                                            : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {user.is_admin ? 'Demote' : 'Promote'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Component 3: Lesson Creator (REAL FORM) ---
const LessonCreator = () => {
    const [formData, setFormData] = useState({
        category: 'General', title: '', content: '', video_url: '', order_index: 0
    });
    const [status, setStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [categories, setCategories] = useState(['General', 'JAMB', 'WAEC', 'Science', 'Mathematics']);

    // Fetch existing categories to populate the dropdown
    useEffect(() => {
        api.learn.getCategories().then(cats => {
            if (cats && cats.length > 0) {
                const catNames = cats.map(c => c.name);
                // Merge default categories with those from DB, remove duplicates
                setCategories([...new Set([...categories, ...catNames])]);
            }
        });
    }, []);

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData({ 
            ...formData, 
            [name]: type === 'number' ? parseInt(value, 10) : value 
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setStatus('Publishing...');
        
        try {
            // 💥 REAL API CALL
            await api.admin.createLesson(formData);
            setStatus('success');
            // Reset form but keep category
            setFormData({ ...formData, title: '', content: '', video_url: '', order_index: formData.order_index + 1 });
            
            // Clear success message after 3s
            setTimeout(() => setStatus(''), 3000);
        } catch (error) {
            setStatus(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow border border-gray-100 dark:border-slate-700 animate-fade-in">
            <h3 className="text-lg font-bold dark:text-white mb-4 flex items-center gap-2">
                <Plus size={20} className="text-indigo-500"/> Create New Lesson
            </h3>
            
            {status === 'success' && (
                <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg flex items-center gap-2">
                    <CheckCircle size={18} /> Lesson published successfully!
                </div>
            )}
            
            {status.startsWith('Error') && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg flex items-center gap-2">
                    <AlertCircle size={18} /> {status}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                        <input
                            type="text" name="title" required
                            value={formData.title} onChange={handleChange}
                            className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            placeholder="e.g. Introduction to Calculus"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                        <div className="flex gap-2">
                            <select 
                                name="category" 
                                value={formData.category} 
                                onChange={handleChange}
                                className="flex-1 p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            >
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            {/* Simple way to add new category: just type it into an input if we wanted, 
                                but for MVP, select is safer. To add new, user can use "Other" or we add an input toggle.
                                For now, let's keep it simple. */}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Select an existing category or type a new one below.</p>
                         <input
                            type="text" 
                            placeholder="Or type new category..."
                            className="mt-2 w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm"
                            onChange={(e) => e.target.value && setFormData({...formData, category: e.target.value})}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content (Markdown Supported)</label>
                    <textarea 
                        name="content" required
                        value={formData.content} onChange={handleChange}
                        className="w-full p-2 h-32 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white font-mono text-sm"
                        placeholder="# Lesson Header\n\nContent goes here..."
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Video URL (Optional)</label>
                    <div className="relative">
                        <Video size={18} className="absolute left-3 top-2.5 text-gray-400" />
                        <input
                            type="text" name="video_url"
                            value={formData.video_url} onChange={handleChange}
                            className="w-full pl-10 p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            placeholder="https://youtube.com/..."
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sort Order</label>
                    <input
                        type="number" name="order_index"
                        value={formData.order_index} onChange={handleChange}
                        className="w-24 p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                </div>

                <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                    {isLoading ? 'Publishing...' : 'Publish Lesson'}
                </button>
            </form>
        </div>
    );
};

// --- Component 4: Category List (View Only) ---
const CategoryList = () => {
    const [categories, setCategories] = useState([]);
    
    useEffect(() => {
        api.learn.getCategories().then(setCategories);
    }, []);

    return (
        <div className="space-y-4 animate-fade-in">
             <h3 className="text-xl font-bold dark:text-white">Existing Categories</h3>
             <p className="text-sm text-gray-500">
                Categories are created automatically when you add a lesson with a new category name.
             </p>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {categories.map(cat => (
                    <div key={cat.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-100 dark:border-slate-700 text-center">
                        <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center font-bold ${cat.color} mb-2`}>
                            {cat.name[0]}
                        </div>
                        <h4 className="font-bold dark:text-white">{cat.name}</h4>
                        <span className="text-xs text-gray-500">{cat.count} Lessons</span>
                    </div>
                ))}
             </div>
        </div>
    );
}

// --- Main Admin Module ---
export default function AdminModule({ user }) {
    const [activeTab, setActiveTab] = useState('lessons');

    // Security Check
    if (!user || !user.is_admin) {
        return <PermissionDenied />;
    }

    const TabButton = ({ name, icon: Icon, label }) => (
        <button
            onClick={() => setActiveTab(name)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium border-b-2 ${
                activeTab === name
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
        >
            <Icon size={18} />
            {label}
        </button>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold dark:text-white">Admin Dashboard</h1>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
                <TabButton name="lessons" icon={Plus} label="Add Lesson" />
                <TabButton name="categories" icon={List} label="Categories" />
                <TabButton name="users" icon={Users} label="Manage Users" />
            </div>

            {/* Content Area */}
            <div className="pt-4">
                {activeTab === 'lessons' && <LessonCreator />}
                {activeTab === 'categories' && <CategoryList />}
                {activeTab === 'users' && <UserManagement currentAdminId={user.id} />}
            </div>
        </div>
    );
}
