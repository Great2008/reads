import React, { useState, useEffect, useCallback } from 'react';
import { 
    Users, Plus, ShieldOff, Trash2, Video, List, CheckCircle, AlertCircle, 
    Award, Settings, Zap, ArrowLeft, XCircle, RefreshCw, Shield // <-- Added Shield for promotion icon
} from 'lucide-react';
// Assuming 'api' is correctly imported and contains 'learn' and 'admin' endpoints
import { api } from '../../services/api'; 

// ====================================================================\
// --- 0. Feedback Components ---\
// ====================================================================\

// Simple Toast component for non-intrusive feedback
const Toast = ({ message, type, onClose }) => {
    const colorMap = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        info: 'bg-indigo-600',
    };
    const IconMap = {
        success: CheckCircle,
        error: AlertCircle,
        info: List,
    };
    const Icon = IconMap[type] || List;
    const color = colorMap[type] || 'bg-gray-600';

    if (!message) return null;

    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [message, onClose]);


    return (
        <div className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-2xl text-white ${color} flex items-center gap-3 z-50 transition-all duration-300 transform translate-y-0 opacity-100`}>
            <Icon size={20} />
            <span className="text-sm font-medium">{message}</span>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20">
                <XCircle size={16} />
            </button>
        </div>
    );
};

// ====================================================================\
// --- 1. Lesson Creation Form ---\
// ====================================================================\

const LessonCreateForm = ({ onToast }) => {
    const [formData, setFormData] = useState({
        category: '',
        title: '',
        content: '',
        video_url: '',
        order_index: 0,
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'order_index' ? parseInt(value) || 0 : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            await api.admin.createLesson(formData);
            onToast({ message: 'Lesson created successfully!', type: 'success' });
            // Reset form
            setFormData({ category: '', title: '', content: '', video_url: '', order_index: 0 });
        } catch (error) {
            onToast({ message: 'Failed to create lesson.', type: 'error' });
            console.error('Lesson creation failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-slate-700">
            <h3 className="text-2xl font-bold dark:text-white border-b pb-3">Create New Lesson</h3>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='col-span-1'>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                    <input type="text" name="category" value={formData.category} onChange={handleChange} required
                        className="w-full mt-1 p-3 border border-gray-300 dark:border-slate-700 rounded-lg dark:bg-slate-700 dark:text-white"
                        placeholder="e.g., JAMB Mathematics"
                    />
                </div>
                <div className='col-span-1'>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Order Index</label>
                    <input type="number" name="order_index" value={formData.order_index} onChange={handleChange} required
                        className="w-full mt-1 p-3 border border-gray-300 dark:border-slate-700 rounded-lg dark:bg-slate-700 dark:text-white"
                        placeholder="0"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                <input type="text" name="title" value={formData.title} onChange={handleChange} required
                    className="w-full mt-1 p-3 border border-gray-300 dark:border-slate-700 rounded-lg dark:bg-slate-700 dark:text-white"
                    placeholder="Lesson Title"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Video URL (Optional)</label>
                <input type="url" name="video_url" value={formData.video_url} onChange={handleChange}
                    className="w-full mt-1 p-3 border border-gray-300 dark:border-slate-700 rounded-lg dark:bg-slate-700 dark:text-white"
                    placeholder="https://www.youtube.com/watch?v=..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Content (Markdown/HTML)</label>
                <textarea name="content" value={formData.content} onChange={handleChange} required
                    rows="10"
                    className="w-full mt-1 p-3 border border-gray-300 dark:border-slate-700 rounded-lg dark:bg-slate-700 dark:text-white"
                    placeholder="Enter the lesson content here..."
                />
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 flex items-center justify-center"
            >
                {isLoading ? <RefreshCw size={20} className="animate-spin mr-2" /> : <Plus size={20} className="mr-2" />}
                {isLoading ? 'Creating Lesson...' : 'Create Lesson'}
            </button>
        </form>
    );
};

// ====================================================================\
// --- 2. Quiz Creation Form ---\
// ====================================================================\

const QuizCreationForm = ({ lessonId, lessonTitle, onComplete, onToast }) => {
    const initialQuestion = { question: '', options: ['', '', '', ''], correct_option: 'A' };
    const [questions, setQuestions] = useState([initialQuestion]);
    const [isLoading, setIsLoading] = useState(false);

    const handleQuestionChange = (index, field, value) => {
        const newQuestions = [...questions];
        newQuestions[index][field] = value;
        setQuestions(newQuestions);
    };

    const handleOptionChange = (qIndex, oIndex, value) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].options[oIndex] = value;
        setQuestions(newQuestions);
    };

    const addQuestion = () => {
        setQuestions([...questions, initialQuestion]);
    };

    const removeQuestion = (index) => {
        if (questions.length > 1) {
            setQuestions(questions.filter((_, i) => i !== index));
        } else {
            onToast({ message: "Quiz must have at least one question.", type: 'error' });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        const quizData = {
            lesson_id: lessonId,
            questions: questions.map((q, qIndex) => ({
                ...q,
                // Map the correct option letter back to the actual option text if needed
                // Backend expects the letter ('A', 'B', etc.)
                correct_option: ['A', 'B', 'C', 'D'][['A', 'B', 'C', 'D'].indexOf(q.correct_option)], 
            })),
        };

        try {
            // Using the existing createQuiz endpoint from api.js
            await api.admin.createQuiz(quizData); 
            onToast({ message: `Quiz for "${lessonTitle}" created successfully!`, type: 'success' });
            onComplete(); // Go back to lesson list
        } catch (error) {
            onToast({ message: `Failed to create quiz: ${error.message}`, type: 'error' });
            console.error('Quiz creation failed:', error);
        } finally {
            setIsLoading(false);
        }
    };
    
    // Helper function to get the option letter
    const getOptionLetter = (index) => String.fromCharCode(65 + index); // 65 is 'A'

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-2xl font-bold dark:text-white">Create Quiz for: <span className='text-indigo-600'>{lessonTitle}</span></h3>
            <p className='text-sm text-gray-600 dark:text-gray-400'>Lesson ID: {lessonId}</p>

            {questions.map((q, qIndex) => (
                <div key={qIndex} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-slate-700 space-y-4">
                    <div className='flex justify-between items-center'>
                        <h4 className="text-xl font-semibold dark:text-white">Question {qIndex + 1}</h4>
                        {questions.length > 1 && (
                            <button 
                                type="button" 
                                onClick={() => removeQuestion(qIndex)} 
                                className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                <Trash2 size={20} />
                            </button>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Question Text</label>
                        <textarea value={q.question} onChange={(e) => handleQuestionChange(qIndex, 'question', e.target.value)} required
                            rows="3"
                            className="w-full mt-1 p-3 border border-gray-300 dark:border-slate-700 rounded-lg dark:bg-slate-700 dark:text-white"
                            placeholder="Enter the question text"
                        />
                    </div>
                    
                    <div className='grid grid-cols-2 gap-4'>
                        {q.options.map((option, oIndex) => (
                            <div key={oIndex}>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Option {getOptionLetter(oIndex)}
                                </label>
                                <input type="text" value={option} onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)} required
                                    className="w-full mt-1 p-3 border border-gray-300 dark:border-slate-700 rounded-lg dark:bg-slate-700 dark:text-white"
                                />
                            </div>
                        ))}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Correct Answer</label>
                        <select value={q.correct_option} onChange={(e) => handleQuestionChange(qIndex, 'correct_option', e.target.value)}
                            className="w-full mt-1 p-3 border border-gray-300 dark:border-slate-700 rounded-lg dark:bg-slate-700 dark:text-white"
                        >
                            {['A', 'B', 'C', 'D'].map((letter) => (
                                <option key={letter} value={letter}>{letter}</option>
                            ))}
                        </select>
                    </div>

                </div>
            ))}

            <div className='flex justify-between items-center'>
                <button 
                    type="button" 
                    onClick={addQuestion}
                    className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors dark:bg-slate-700 dark:text-indigo-400 dark:hover:bg-slate-600"
                >
                    <Plus size={16} className="inline-block mr-1"/> Add Question
                </button>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="py-3 px-6 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-colors disabled:bg-green-400 flex items-center justify-center"
                >
                    {isLoading ? <RefreshCw size={20} className="animate-spin mr-2" /> : <CheckCircle size={20} className="mr-2" />}
                    {isLoading ? 'Uploading Quiz...' : 'Save Quiz'}
                </button>
            </div>
        </form>
    );
};

// ====================================================================\
// --- 3. User Management Component (CORRECTED) ---\
// ====================================================================\

const UserManagement = ({ currentAdminId, onToast }) => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState({});

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            // Note: api.admin.getAllUsers is used here as it's defined in api.js
            const data = await api.admin.getAllUsers(); 
            // Sort by admin status first (admins on top)
            const sortedData = [...data].sort((a, b) => {
                if (a.is_admin === b.is_admin) return 0;
                return a.is_admin ? -1 : 1;
            });
            setUsers(sortedData);
        } catch (error) {
            onToast({ message: 'Failed to fetch user list.', type: 'error' });
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, [onToast]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // ✅ CRITICAL FIX: Correctly calls the unified api.admin.promoteUser(userId, newStatus)
    const handleToggleAdminStatus = useCallback(async (userId, currentStatus) => {
        // Prevent admin from modifying their own status
        if (userId === currentAdminId) {
            onToast({ message: "You cannot change your own admin status.", type: 'error' });
            return;
        }

        setActionLoading(prev => ({ ...prev, [userId]: true }));
        try {
            // Determine the target status (the opposite of the current status)
            const newStatus = !currentStatus; 
            
            // Call the unified API method with the new status
            await api.admin.promoteUser(userId, newStatus); 

            onToast({ message: `User successfully ${newStatus ? 'promoted' : 'demoted'}!`, type: 'success' });
            
            // Refresh the list locally to show the change immediately
            setUsers(prevUsers => prevUsers.map(u => 
                u.id === userId ? { ...u, is_admin: newStatus } : u
            ));

        } catch (error) {
            // This will now show the detailed error from the backend (e.g., "User not found")
            onToast({ message: `Failed to change status: ${error.message}`, type: 'error' });
            fetchUsers(); 
        } finally {
            setActionLoading(prev => ({ ...prev, [userId]: false }));
        }
    }, [onToast, currentAdminId, fetchUsers]);


    if (isLoading) {
        return <div className="text-center p-8 dark:text-white">Loading Users... <RefreshCw size={20} className="animate-spin inline-block ml-2" /></div>;
    }

    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold dark:text-white border-b pb-3">User Management ({users.length} Total)</h3>
            
            {/* User List Header */}
            <div className="grid grid-cols-5 font-semibold text-sm text-gray-500 dark:text-gray-400 border-b pb-2 px-6">
                <p className='col-span-2'>User Name</p>
                <p className='hidden md:block col-span-2'>Email</p>
                <p className='col-span-1 text-center'>Actions</p>
            </div>

            {/* User List */}
            <div className="space-y-3">
                {users.map((user) => (
                    <div 
                        key={user.id} 
                        className={`grid grid-cols-5 items-center p-4 rounded-xl shadow-sm transition-all ${user.is_admin ? 'bg-indigo-50 dark:bg-slate-700' : 'bg-white dark:bg-slate-800'}`}
                    >
                        {/* Name */}
                        <div className="flex items-center gap-3 col-span-2">
                            <img 
                                src={`https://api.dicebear.com/8.x/initials/svg?seed=${user.name}`} 
                                className="w-8 h-8 rounded-full" 
                                alt={user.name} 
                            />
                            <div>
                                <p className="font-medium dark:text-white">{user.name}</p>
                                {/* Admin Status on small screens */}
                                <p className="text-xs mt-0.5 md:hidden">
                                    {user.is_admin ? (
                                        <span className="text-green-600">Admin</span>
                                    ) : (
                                        <span className="text-gray-500">User</span>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Email */}
                        <p className="text-sm text-gray-700 dark:text-gray-400 hidden md:block col-span-2">{user.email}</p> 

                        {/* Actions */}
                        <div className="col-span-1 flex justify-center">
                            {user.is_admin && (
                                <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-medium px-3 py-1 rounded-full mr-2 dark:bg-green-900 dark:text-green-300">
                                    Admin
                                </span>
                            )}
                            <button
                                onClick={() => handleToggleAdminStatus(user.id, user.is_admin)}
                                disabled={actionLoading[user.id] || user.id === currentAdminId}
                                title={user.is_admin ? 'Demote User' : 'Promote User'}
                                className={`p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                    ${user.is_admin 
                                        ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-800 dark:text-red-300 dark:hover:bg-red-700' 
                                        : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200 dark:bg-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-700'
                                    }`
                                }
                            >
                                {actionLoading[user.id] ? (
                                    <RefreshCw size={20} className="animate-spin" />
                                ) : user.is_admin ? (
                                    <ShieldOff size={20} />
                                ) : (
                                    <Shield size={20} />
                                )}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ====================================================================\
// --- 4. Lesson and Quiz Management Component ---\
// ====================================================================\

const LessonQuizManager = ({ onSelectLesson, onToast }) => {
    const [lessons, setLessons] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchLessons = useCallback(async () => {
        setIsLoading(true);
        try {
            // Assuming a new API call to fetch all lessons for admin view
            const data = await api.admin.getAllLessons(); 
            setLessons(data);
        } catch (error) {
            onToast({ message: 'Failed to fetch lessons list.', type: 'error' });
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, [onToast]);

    useEffect(() => {
        fetchLessons();
    }, [fetchLessons]);

    const handleDeleteLesson = async (lessonId) => {
        if (!window.confirm('Are you sure you want to delete this lesson and its associated quizzes/progress?')) return;

        setIsDeleting(true);
        try {
            await api.admin.deleteLesson(lessonId);
            onToast({ message: 'Lesson deleted successfully!', type: 'success' });
            fetchLessons(); // Refresh list
        } catch (error) {
            onToast({ message: 'Failed to delete lesson. It might be in use.', type: 'error' });
            console.error(error);
        } finally {
             setIsDeleting(false);
        }
    };

    // Sort lessons by category and then by order_index
    const sortedLessons = [...lessons].sort((a, b) => {
        if (a.category < b.category) return -1;
        if (a.category > b.category) return 1;
        return a.order_index - b.order_index;
    });

    if (isLoading) {
        return <div className="text-center p-8 dark:text-white">Loading Lessons... <RefreshCw size={20} className="animate-spin inline-block ml-2" /></div>;
    }

    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold dark:text-white border-b pb-3">Manage Lessons & Quizzes ({lessons.length} Total)</h3>
            
            {sortedLessons.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 p-8 bg-white dark:bg-slate-800 rounded-xl">No lessons available. Please add a lesson first.</p>
            ) : (
                <div className="space-y-3">
                    {sortedLessons.map((lesson) => (
                        <div 
                            key={lesson.id} 
                            className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700"
                        >
                            <div className="flex items-center gap-4">
                                <Video size={20} className="text-indigo-600 dark:text-indigo-400" />
                                <div>
                                    <p className="font-semibold dark:text-white">{lesson.title}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{lesson.category} | Index: {lesson.order_index}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onSelectLesson({ id: lesson.id, title: lesson.title })}
                                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    Manage Quiz
                                </button>
                                <button
                                    onClick={() => handleDeleteLesson(lesson.id)}
                                    title="Delete Lesson and Quiz Data"
                                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors disabled:opacity-50"
                                    disabled={isDeleting}
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ====================================================================\
// --- 5. Main Admin Module Component ---\
// ====================================================================\

const AdminModule = ({ user }) => {
    // Check if the user object is available and if they are an admin
    const isAdmin = user && user.is_admin; 
    
    // State for navigation/views within the admin module
    const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'lessons', 'users', 'quizzes'
    
    // State for the Lesson Quiz Manager sub-view
    const [quizLesson, setQuizLesson] = useState(null); // { id: string, title: string }
    
    // State for toast notifications
    const [toast, setToast] = useState({ message: '', type: 'info' });
    const showToast = useCallback((newToast) => setToast(newToast), []);
    
    const handleSelectLesson = useCallback((lessonData) => {
        setQuizLesson(lessonData);
        setActiveTab('quizzes');
    }, []);

    const handleBackToList = useCallback(() => {
        setQuizLesson(null);
        setActiveTab('quizzes'); // Go back to the lesson list view
    }, []);
    
    
    // If user is not an admin, display access denied message
    if (!isAdmin) {
        return (
            <div className="p-10 text-center text-red-500 dark:text-red-400 space-y-4">
                <ShieldOff size={48} className="mx-auto" />
                <h2 className="text-2xl font-bold">Access Denied</h2>
                <p>You must be an administrator to access this module.</p>
            </div>
        );
    }
    
    const renderAdminDashboard = () => (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold dark:text-white border-b pb-3">Admin Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg border-t-4 border-indigo-500 dark:border-indigo-600">
                    <Users size={24} className="text-indigo-600 mb-2"/>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
                    {/* Hardcoded count, should be fetched if needed */}
                    <p className="text-3xl font-bold dark:text-white">...</p>
                    <button onClick={() => setActiveTab('users')} className="mt-3 text-sm text-indigo-600 hover:underline">Manage Users</button>
                </div>
                <div className="p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg border-t-4 border-green-500 dark:border-green-600">
                    <Video size={24} className="text-green-600 mb-2"/>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Lessons</p>
                    {/* Hardcoded count, should be fetched if needed */}
                    <p className="text-3xl font-bold dark:text-white">...</p>
                    <button onClick={() => setActiveTab('quizzes')} className="mt-3 text-sm text-green-600 hover:underline">Manage Content</button>
                </div>
                <div className="p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg border-t-4 border-yellow-500 dark:border-yellow-600">
                    <Award size={24} className="text-yellow-600 mb-2"/>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tokens Awarded</p>
                    {/* Hardcoded count, should be fetched if needed */}
                    <p className="text-3xl font-bold dark:text-white">...</p>
                    <button onClick={() => setActiveTab('lessons')} className="mt-3 text-sm text-yellow-600 hover:underline">Create New Lesson</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in">
            <h1 className="text-4xl font-extrabold dark:text-white border-b pb-4">Admin Dashboard</h1>

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 dark:border-slate-700">
                <AdminTab name="Dashboard" icon={Settings} active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setQuizLesson(null); }} />
                <AdminTab name="Manage Content" icon={Video} active={activeTab === 'quizzes'} onClick={() => { setActiveTab('quizzes'); }} />
                <AdminTab name="Add Lesson" icon={Plus} active={activeTab === 'lessons'} onClick={() => { setActiveTab('lessons'); setQuizLesson(null); }} />
                <AdminTab name="User Management" icon={Users} active={activeTab === 'users'} onClick={() => { setActiveTab('users'); setQuizLesson(null); }} />
            </div>

            {/* Tab Content */}
            <div className='py-4'>
                {/* 1. Dashboard */}
                {activeTab === 'dashboard' && renderAdminDashboard()}

                {/* 1. Quiz/Lesson Manager Tab */}
                {activeTab === 'quizzes' && (
                    <div>
                        {quizLesson ? (
                            <>
                                <button 
                                    onClick={handleBackToList} 
                                    className="flex items-center text-indigo-600 hover:text-indigo-700 text-sm font-medium mb-4 dark:text-indigo-400 dark:hover:text-indigo-300"
                                >
                                    <ArrowLeft size={16} className="mr-1" /> Back to Lesson List
                                </button>
                                <QuizCreationForm 
                                    lessonId={quizLesson.id} 
                                    lessonTitle={quizLesson.title} 
                                    onComplete={handleBackToList} 
                                    onToast={showToast}
                                />
                            </>
                        ) : (
                            <LessonQuizManager 
                                onSelectLesson={handleSelectLesson} 
                                onToast={showToast}
                            />
                        )}
                    </div>
                )}
                
                {/* 2. Add Lesson Tab */}
                {activeTab === 'lessons' && <LessonCreateForm onToast={showToast} />}
                
                {/* 3. User Management Tab */}
                {activeTab === 'users' && <UserManagement currentAdminId={user.id} onToast={showToast} />}
                
                {/* 4. Categories Tab (Not implemented, hidden) */}
                {/* {activeTab === 'categories' && <CategoryList />} */}
            </div>
            
            {/* Global Toast Notification */}
            <Toast {...toast} onClose={() => setToast({ message: '', type: 'info' })} />
        </div>
    );
}

// ====================================================================\
// --- 6. Helper Components ---\
// ====================================================================\

// Tab component for navigation
const AdminTab = ({ name, icon: Icon, active, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center px-4 py-3 text-sm font-medium transition-colors border-b-2
            ${active 
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`
        }
    >
        <Icon size={18} className="mr-2" />
        {name}
    </button>
);


export default AdminModule;
