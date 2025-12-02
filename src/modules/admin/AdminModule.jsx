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
            await api.admin.createQuiz(quizData);
            onToast({ message: `Quiz for "${lessonTitle}" created successfully!`, type: 'success' });
            onComplete(); // Go back to lesson list
        } catch (error) {
            onToast({ message: 'Failed to create quiz.', type: 'error' });
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
                                className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
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

                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Options</label>
                        {q.options.map((option, oIndex) => (
                            <div key={oIndex} className="flex items-center gap-2">
                                <span className='font-bold w-4 text-gray-700 dark:text-gray-300'>{getOptionLetter(oIndex)}.</span>
                                <input type="text" value={option} onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)} required
                                    className="flex-grow p-3 border border-gray-300 dark:border-slate-700 rounded-lg dark:bg-slate-700 dark:text-white"
                                    placeholder={`Option ${getOptionLetter(oIndex)}`}
                                />
                                <input
                                    type="radio"
                                    name={`correct_option_${qIndex}`}
                                    value={getOptionLetter(oIndex)}
                                    checked={q.correct_option === getOptionLetter(oIndex)}
                                    onChange={(e) => handleQuestionChange(qIndex, 'correct_option', e.target.value)}
                                    className="w-5 h-5 text-green-600 border-gray-300 focus:ring-green-500"
                                    title="Mark as correct answer"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <div className='flex justify-between'>
                <button
                    type="button"
                    onClick={addQuestion}
                    className="flex items-center px-4 py-2 bg-indigo-100 text-indigo-600 font-semibold rounded-lg hover:bg-indigo-200 transition-colors"
                >
                    <Plus size={20} className="mr-2" />
                    Add Question
                </button>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="py-3 px-6 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-colors disabled:bg-green-400 flex items-center justify-center"
                >
                    {isLoading ? <RefreshCw size={20} className="animate-spin mr-2" /> : <CheckCircle size={20} className="mr-2" />}
                    {isLoading ? 'Submitting Quiz...' : 'Finalize Quiz'}
                </button>
            </div>
        </form>
    );
};


// ====================================================================\
// --- 3. Lesson/Quiz Manager (List) ---\
// ====================================================================\

const LessonQuizManager = ({ onSelectLesson, onToast }) => {
    const [lessons, setLessons] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchLessons = useCallback(async () => {
        setIsLoading(true);
        try {
            // This endpoint is assumed to return all lessons, possibly including a `has_quiz` flag
            const data = await api.admin.getAllLessons(); 
            setLessons(data);
        } catch (error) {
            onToast({ message: 'Failed to fetch lessons.', type: 'error' });
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
        
        try {
            await api.admin.deleteLesson(lessonId);
            onToast({ message: 'Lesson deleted successfully!', type: 'success' });
            fetchLessons(); // Refresh list
        } catch (error) {
            onToast({ message: 'Failed to delete lesson. It might be in use.', type: 'error' });
            console.error(error);
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
            <h3 className="text-2xl font-bold dark:text-white">Manage Quizzes</h3>
            
            {sortedLessons.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 p-8 bg-white dark:bg-slate-800 rounded-xl">No lessons available. Please add a lesson first.</p>
            ) : (
                <div className="space-y-3">
                    {sortedLessons.map((lesson) => (
                        <div key={lesson.id} className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-shadow">
                            <div className='flex flex-col'>
                                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{lesson.category}</p>
                                <p className="font-semibold dark:text-white">{lesson.title}</p>
                            </div>
                            <div className='flex items-center space-x-3'>
                                {/* Quiz Status Indicator */}
                                {lesson.has_quiz ? (
                                    <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-medium px-3 py-1 rounded-full dark:bg-green-900 dark:text-green-300">
                                        <CheckCircle size={14} /> Quiz Ready
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 text-xs font-medium px-3 py-1 rounded-full dark:bg-yellow-900 dark:text-yellow-300">
                                        <AlertCircle size={14} /> No Quiz
                                    </span>
                                )}

                                {/* Create Quiz Button */}
                                <button
                                    onClick={() => onSelectLesson(lesson)}
                                    title="Create or Manage Quiz"
                                    className="p-2 bg-indigo-100 text-indigo-600 rounded-full hover:bg-indigo-200 transition-colors"
                                >
                                    <Zap size={20} />
                                </button>
                                
                                {/* Delete Lesson Button */}
                                <button
                                    onClick={() => handleDeleteLesson(lesson.id)}
                                    title="Delete Lesson"
                                    className="p-2 text-red-500 rounded-full hover:bg-red-100 transition-colors"
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
// --- 4. User Management Component ---\
// ====================================================================\

const UserManagement = ({ currentAdminId, onToast }) => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionLoading, setActionLoading] = useState({}); // To track loading state per user

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.admin.getAllUsers();
            // Sort by creation date descending to show newest first, then admin status
            const sortedData = data.sort((a, b) => {
                if (a.is_admin === b.is_admin) {
                    return new Date(b.created_at) - new Date(a.created_at);
                }
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
    
    // NEW: Handle Admin Status Change
    const handleToggleAdminStatus = useCallback(async (userId, currentStatus) => {
        // Prevent admin from modifying their own status
        if (userId === currentAdminId) {
            onToast({ message: "You cannot change your own admin status.", type: 'error' });
            return;
        }

        setActionLoading(prev => ({ ...prev, [userId]: true }));
        try {
            // Determine action: if currentStatus is true, we demote; if false, we promote
            const action = currentStatus ? 'demoteUser' : 'promoteUser';
            await api.admin[action](userId);
            
            onToast({ 
                message: `User successfully ${currentStatus ? 'demoted' : 'promoted'}!`, 
                type: 'success' 
            });
            fetchUsers(); // Refresh the user list
        } catch (error) {
            onToast({ message: `Failed to ${currentStatus ? 'demote' : 'promote'} user.`, type: 'error' });
            console.error(error);
        } finally {
            setActionLoading(prev => ({ ...prev, [userId]: false }));
        }
    }, [currentAdminId, onToast, fetchUsers]);


    // Placeholder for other actions (Ban/Delete)
    const handleBanUser = (userId) => {
        onToast({ message: `Ban functionality for ${userId} is not yet implemented.`, type: 'info' });
        // Logic would go here: api.admin.banUser(userId)
    };

    const handleDeleteUser = (userId) => {
        if (!window.confirm(`Are you sure you want to permanently delete user ${userId}?`)) return;
        onToast({ message: `Delete functionality for ${userId} is not yet implemented.`, type: 'info' });
        // Logic would go here: api.admin.deleteUser(userId)
    };


    const filteredUsers = users.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return <div className="text-center p-8 dark:text-white">Loading Users... <RefreshCw size={20} className="animate-spin inline-block ml-2" /></div>;
    }

    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold dark:text-white">User Management</h3>

            <input 
                type="text" 
                placeholder="Search by name, email, or ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-slate-700 rounded-lg dark:bg-slate-700 dark:text-white shadow-sm"
            />

            <div className='hidden md:grid grid-cols-5 gap-4 p-4 font-bold text-sm text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-slate-700'>
                <p>Name</p>
                <p>Email</p>
                <p>Admin</p>
                <p>Member Since</p>
                <p className="text-right">Actions</p>
            </div>

            <div className="space-y-3">
                {filteredUsers.map((user) => (
                    <div key={user.id} className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm items-center hover:shadow-md transition-shadow">
                        {/* Name Column (Col 1/2 on mobile) */}
                        <div className="md:col-span-1 col-span-2">
                            <p className="font-semibold dark:text-white">{user.name}</p>
                            <p className='text-xs text-gray-500 md:hidden'>{user.email}</p>
                        </div>
                        
                        {/* Email Column (Col 2/5 on desktop, hidden on mobile) */}
                        <p className="text-sm text-gray-600 dark:text-gray-400 hidden md:block">{user.email}</p>
                        
                        {/* Admin Status (Col 3/5) */}
                        <p className="text-sm md:col-span-1 col-span-1">
                            {user.is_admin ? (
                                <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-medium px-3 py-1 rounded-full dark:bg-green-900 dark:text-green-300">
                                    Admin
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 text-xs font-medium px-3 py-1 rounded-full dark:bg-gray-700 dark:text-gray-300">
                                    User
                                </span>
                            )}
                        </p>

                        {/* Member Since (Col 4/5) */}
                        <p className="text-sm text-gray-500 dark:text-gray-400 hidden md:block">
                            {new Date(user.created_at).toLocaleDateString()}
                        </p>
                        
                        {/* Actions (Col 5/5) */}
                        <div className="md:col-span-1 col-span-2 flex justify-end space-x-2">
                            
                            {/* NEW: Promote/Demote Button */}
                            {user.id !== currentAdminId && (
                                <button
                                    onClick={() => handleToggleAdminStatus(user.id, user.is_admin)}
                                    disabled={actionLoading[user.id]}
                                    title={user.is_admin ? "Demote from Admin" : "Promote to Admin"}
                                    className={`p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                        user.is_admin 
                                            ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400 dark:hover:bg-red-900'
                                            : 'bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-400 dark:hover:bg-green-900'
                                    }`}
                                >
                                    {actionLoading[user.id] ? (
                                        <RefreshCw size={20} className="animate-spin" />
                                    ) : user.is_admin ? (
                                        <ShieldOff size={20} />
                                    ) : (
                                        <Shield size={20} />
                                    )}
                                </button>
                            )}
                            
                            {/* Ban/Unban Button Placeholder */}
                            {/* <button
                                onClick={() => handleBanUser(user.id)}
                                title="Ban User"
                                className="p-2 text-yellow-500 rounded-full hover:bg-yellow-100 transition-colors"
                                disabled={user.id === currentAdminId}
                            >
                                <ShieldOff size={20} />
                            </button> */}
                            
                            {/* Delete Button Placeholder */}
                            <button
                                onClick={() => handleDeleteUser(user.id)}
                                title="Delete User"
                                className="p-2 text-red-500 rounded-full hover:bg-red-100 transition-colors"
                                disabled={user.id === currentAdminId}
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    </div>
                ))}
                {filteredUsers.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 p-8">No users match your search criteria.</p>}
            </div>
        </div>
    );
};


// ====================================================================\
// --- 5. Main Admin Module Export ---\
// ====================================================================\

export default function AdminModule({ user }) {
    const [activeTab, setActiveTab] = useState('users'); // Default to users tab
    const [activeLesson, setActiveLesson] = useState(null); // For Quiz Creation state
    const [toast, setToast] = useState({ message: '', type: 'info' });

    const showToast = useCallback((t) => {
        setToast(t);
    }, []);

    const handleSelectLesson = (lesson) => {
        setActiveLesson(lesson);
    };
    
    const handleBackToList = () => {
        setActiveLesson(null);
    };
    
    const tabs = [
        { id: 'users', label: 'User Management', Icon: Users },
        { id: 'lessons', label: 'Add Lesson', Icon: Plus },
        { id: 'quizzes', label: 'Manage Quizzes', Icon: Zap },
        // { id: 'categories', label: 'Categories', Icon: List }, // Removing unused tab
    ];
    
    // Check if the current user is an admin before rendering
    if (!user || !user.is_admin) {
        return (
            <div className="p-8 text-center text-red-500 dark:text-red-400 space-y-4">
                <ShieldOff size={48} className="mx-auto" />
                <h2 className="text-2xl font-bold">Access Denied</h2>
                <p>You must be an administrator to access this module.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <h1 className="text-4xl font-extrabold dark:text-white border-b pb-4">Admin Dashboard</h1>

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setActiveTab(tab.id);
                            setActiveLesson(null); // Reset lesson context when switching tabs
                        }}
                        className={`flex items-center px-4 py-2 -mb-px text-sm font-medium border-b-2 transition-colors duration-200 ${
                            activeTab === tab.id
                                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                                : 'border-transparent text-gray-500 hover:text-indigo-600 hover:border-gray-300 dark:text-gray-400 dark:hover:text-indigo-400'
                        }`}
                    >
                        <tab.Icon size={20} className="mr-2" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className='p-2 md:p-4'>
                {/* 1. Manage Quizzes Tab (Lesson List or Quiz Form) */}
                {activeTab === 'quizzes' && (
                    <div className="space-y-6">
                        {activeLesson ? (
                            <>
                                <button
                                    onClick={handleBackToList}
                                    className="flex items-center text-indigo-600 hover:text-indigo-700 text-sm font-medium dark:text-indigo-400 dark:hover:text-indigo-300"
                                >
                                    <ArrowLeft size={16} className="mr-1" /> Back to Lesson List
                                </button>
                                <QuizCreationForm 
                                    lessonId={activeLesson.id} 
                                    lessonTitle={activeLesson.title} 
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

// NOTE on API calls:
// The UserManagement component now assumes the existence of:
// - api.admin.getAllUsers() -> returns List of User objects (including is_admin)
// - api.admin.promoteUser(userId) -> calls PATCH /api/admin/users/{user_id}/promote
// - api.admin.demoteUser(userId) -> calls PATCH /api/admin/users/{user_id}/demote

