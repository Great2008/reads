import React, { useState, useEffect, useCallback } from 'react';
import { 
    Users, Plus, ShieldOff, Trash2, Video, List, CheckCircle, AlertCircle, 
    Award, Settings, Zap, ArrowLeft, XCircle, RefreshCw
} from 'lucide-react';
// Assuming 'api' is correctly imported and contains 'learn' and 'admin' endpoints
import { api } from '../../services/api'; 

// ====================================================================
// --- 0. Feedback Components ---
// ====================================================================

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
            <span className="font-medium">{message}</span>
            <button onClick={onClose} className="ml-4 font-bold p-1 rounded-full hover:bg-white/20 transition-colors">
                <XCircle size={18} />
            </button>
        </div>
    );
};

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


// ====================================================================
// --- 2. Quiz Creation / Management Form Component ---
// ====================================================================

const QuizCreationForm = ({ lessonId, lessonTitle, onComplete, onToast }) => {
    const initialQuestion = {
        question: '',
        options: ['', '', '', ''],
        correct_answer: '', // 'A', 'B', 'C', or 'D'
    };

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
        }
    };
    
    // Feature: Delete Quiz (Assuming api.admin.deleteQuiz exists)
    const handleDeleteQuiz = async () => {
        if (!lessonId) return;

        // Note: Using window.confirm is generally discouraged in iframes, but this is a critical administrative action.
        if (!window.confirm(`Are you sure you want to permanently DELETE the existing quiz for "${lessonTitle}"? This action is irreversible.`)) {
            return;
        }

        setIsLoading(true);
        onToast('Deleting Quiz...', 'info');
        try {
            // 💥 REAL API CALL (Assuming api.admin.deleteQuiz is available)
            // If this is not implemented on your API, this will fail.
            await api.admin.deleteQuiz(lessonId); 
            onToast(`Quiz for "${lessonTitle}" deleted successfully.`, 'success');
            onComplete(); 
        } catch (error) {
            console.error("Failed to delete quiz:", error);
            onToast('Failed to delete quiz. Check API implementation and permissions.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Feature: Upload Quiz
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        onToast('Uploading Quiz...', 'info');

        // Basic validation
        const isValid = questions.every(q => 
            q.question && q.options.every(opt => opt.trim() !== '') && ['A', 'B', 'C', 'D'].includes(q.correct_answer)
        );

        if (!isValid) {
            setIsLoading(false);
            onToast('Please complete all fields (question, 4 options, and correct answer) for every question.', 'error');
            return;
        }

        try {
            const quizQuestions = questions.map((q) => ({
                question: q.question,
                options: q.options,
                correct_answer: q.correct_answer,
            }));

            // 💥 REAL API CALL (Using corrected casing: uploadQuiz)
            await api.admin.uploadQuiz(lessonId, quizQuestions);
            onToast(`Quiz uploaded successfully for "${lessonTitle}"!`, 'success');
            onComplete(); // Navigate back to the list
        } catch (error) {
            console.error("Quiz upload failed:", error);
            onToast('Failed to upload quiz. Check API implementation and permissions.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const optionChars = ['A', 'B', 'C', 'D'];

    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Quiz for: {lessonTitle}</h3>
            <p className="text-gray-600 dark:text-gray-400">Define the questions, options, and the single correct letter (A, B, C, or D). This will overwrite any existing quiz data.</p>
            
            <button
                onClick={handleDeleteQuiz}
                disabled={isLoading}
                className="w-full py-2 px-4 border border-red-500 text-red-500 rounded-xl hover:bg-red-50 transition-colors dark:hover:bg-red-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
                <Trash2 size={18} /> Delete Existing Quiz
            </button>

            <form onSubmit={handleSubmit} className="space-y-8">
                {questions.map((q, qIndex) => (
                    <div key={qIndex} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-slate-700">
                        <div className="flex justify-between items-start mb-4">
                            <h4 className="text-xl font-semibold dark:text-white">Question {qIndex + 1}</h4>
                            {questions.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeQuestion(qIndex)}
                                    className="text-red-500 hover:text-red-700 transition-colors"
                                >
                                    <XCircle size={20} />
                                </button>
                            )}
                        </div>

                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Enter question text here..."
                                value={q.question}
                                onChange={(e) => handleQuestionChange(qIndex, 'question', e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
                                required
                            />

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                {q.options.map((opt, oIndex) => (
                                    <div key={oIndex} className="flex items-center gap-2">
                                        <span className="font-bold w-4 text-gray-600 dark:text-gray-300">{optionChars[oIndex]}.</span>
                                        <input
                                            type="text"
                                            placeholder={`Option ${optionChars[oIndex]}`}
                                            value={opt}
                                            onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                                            className="flex-grow p-2 border border-gray-300 rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                            required
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 flex items-center gap-3 bg-indigo-50 dark:bg-slate-700 p-3 rounded-lg">
                                <label className="font-medium text-gray-700 dark:text-gray-300">Correct Answer:</label>
                                <select
                                    value={q.correct_answer}
                                    onChange={(e) => handleQuestionChange(qIndex, 'correct_answer', e.target.value)}
                                    className="p-2 border border-gray-300 rounded-lg dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                    required
                                >
                                    <option value="" disabled>Select</option>
                                    {optionChars.map(char => (
                                        <option key={char} value={char}>{char}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                ))}
                
                <button
                    type="button"
                    onClick={addQuestion}
                    className="w-full py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors flex items-center justify-center gap-2 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
                >
                    <Plus size={20} /> Add Another Question
                </button>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-8"
                >
                    {isLoading ? 'Uploading Quiz...' : <><Zap size={20} /> Upload/Update Quiz</>}
                </button>
            </form>
        </div>
    );
};


// ====================================================================
// --- 3. Content Management List Component ---
// ====================================================================

const LessonQuizManager = ({ onSelectLesson, onToast }) => {
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [lessons, setLessons] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchCategories = useCallback(async () => {
        try {
            // 💥 REAL API CALL
            const data = await api.learn.getCategories();
            setCategories(data);
            if (data.length > 0 && !selectedCategory) {
                setSelectedCategory(data[0].name);
            }
        } catch (e) {
            console.error("Failed to load categories:", e);
            onToast('Failed to load categories.', 'error');
        }
    }, [onToast, selectedCategory]);
    
    const fetchLessons = useCallback(async (categoryName) => {
        if (!categoryName) return;
        setIsLoading(true);
        try {
            // 💥 REAL API CALL
            const data = await api.learn.getLessons(categoryName);
            setLessons(data);
        } catch (e) {
            console.error("Failed to load lessons:", e);
            onToast(`Failed to load lessons for ${categoryName}.`, 'error');
            setLessons([]);
        } finally {
            setIsLoading(false);
        }
    }, [onToast]);
    
    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    useEffect(() => {
        if (selectedCategory) {
            fetchLessons(selectedCategory);
        }
    }, [selectedCategory, fetchLessons]);
    
    // Feature: Lesson Delete Handler
    const handleDeleteLesson = async (lessonId, lessonTitle) => {
        // Note: Using window.confirm is generally discouraged in iframes, but this is a critical administrative action.
        if (!window.confirm(`Are you sure you want to permanently delete the lesson: "${lessonTitle}"? This will also delete the associated quiz.`)) {
            return;
        }

        setIsLoading(true);
        onToast('Deleting lesson...', 'info');
        try {
            // 💥 REAL API CALL (Using corrected casing: deleteLesson)
            await api.admin.deleteLesson(lessonId);
            onToast(`Lesson "${lessonTitle}" deleted successfully.`, 'success');
            // Refresh the lesson list
            await fetchLessons(selectedCategory); 
            // Also refresh categories in case count changed
            await fetchCategories(); 
        } catch (error) {
            console.error("Failed to delete lesson:", error);
            // This is likely the error the user was encountering
            onToast('Failed to delete lesson. Please check API implementation of `api.admin.deleteLesson`.', 'error');
        } finally {
            setIsLoading(false);
        }
    };


    if (isLoading && !selectedCategory) {
        return <p className="p-8 text-center dark:text-white">Loading Categories and Lessons...</p>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2"><Settings size={24} className="text-indigo-500" /> Content Management</h2>
            <p className="text-gray-600 dark:text-gray-400">Select a lesson below to delete it or manage its associated quiz questions.</p>
            
            <div className="flex flex-wrap gap-2 border-b pb-3 border-gray-200 dark:border-slate-700">
                {categories.map(cat => (
                    <button
                        key={cat.name}
                        onClick={() => setSelectedCategory(cat.name)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                            selectedCategory === cat.name
                                ? 'bg-indigo-600 text-white shadow-lg'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600'
                        }`}
                    >
                        {cat.name} ({cat.count || 0})
                    </button>
                ))}
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold dark:text-white">Lessons in: {selectedCategory || '...'}</h3>
                    <button
                         onClick={() => fetchLessons(selectedCategory)}
                         disabled={isLoading}
                         className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 disabled:opacity-50"
                         title="Refresh Lessons"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                <div className="space-y-3">
                    {isLoading ? (
                         <div className="text-center text-gray-500 dark:text-gray-400">Loading lessons...</div>
                    ) : lessons.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400">No lessons found in this category. Use the "Add Lesson" tab to create one.</p>
                    ) : (
                        lessons.map(lesson => (
                            <div
                                key={lesson.id}
                                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border border-gray-200 rounded-xl dark:border-slate-700 transition-shadow hover:shadow-md"
                            >
                                <div className='text-left mb-2 sm:mb-0'>
                                    <p className="font-medium dark:text-white">{lesson.title}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">ID: {lesson.id.substring(0, 10)}...</p>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    {/* Quiz Management Button */}
                                    <button
                                        onClick={() => onSelectLesson(lesson.id, lesson.title, 'quiz_form')}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-full dark:hover:bg-blue-900/50 transition-colors"
                                        title="Manage Quiz Questions"
                                        disabled={isLoading}
                                    >
                                        <Award size={20} />
                                    </button>
                                    {/* Lesson Delete Button */}
                                    <button
                                        onClick={() => handleDeleteLesson(lesson.id, lesson.title)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-full dark:hover:bg-red-900/50 transition-colors"
                                        title={`Delete ${lesson.title}`}
                                        disabled={isLoading}
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};


// ====================================================================
// --- 4. User Management (REAL API) ---
// ====================================================================

const UserManagement = ({ currentAdminId, onToast }) => {
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
            setError("Failed to fetch users. Check API implementation.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handlePromotion = async (userToUpdate, isAdmin) => {
        // Note: Using window.confirm is generally discouraged in iframes, but this is a critical administrative action.
        if (!window.confirm(`Are you sure you want to ${isAdmin ? 'PROMOTE' : 'DEMOTE'} ${userToUpdate.name}?`)) return;

        try {
            // 💥 REAL API CALL
            await api.admin.promoteUser(userToUpdate.id, isAdmin);
            // Update local state immediately
            setUsers(users.map(u => u.id === userToUpdate.id ? { ...u, is_admin: isAdmin } : u));
            onToast(`${userToUpdate.name} ${isAdmin ? 'promoted to Admin' : 'demoted to Learner'}.`, 'success');
        } catch (error) {
            onToast(`Operation failed: ${error.message}`, 'error');
        }
    };

    if (isLoading) return <p className="text-center dark:text-white p-8">Loading users from database...</p>;
    if (error) return <p className="text-center text-red-500 p-8">{error}</p>;

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold dark:text-white">All System Users ({users.length})</h3>
                <button 
                    onClick={fetchUsers} 
                    className="flex items-center gap-1 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                >
                    <RefreshCw size={14} /> Refresh List
                </button>
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
                                            ? 'border-red-200 text-red-600 hover:bg-red-50 dark:text-red-300 dark:border-red-600 dark:hover:bg-red-900/20' 
                                            : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:border-indigo-600 dark:hover:bg-indigo-900/20'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                        title={user.id === currentAdminId ? "Cannot change your own role" : `Click to ${user.is_admin ? 'Demote' : 'Promote'}`}
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

// ====================================================================
// --- 5. Lesson Creator (REAL FORM) ---
// ====================================================================
const LessonCreator = ({ onToast }) => {
    const [formData, setFormData] = useState({
        category: 'General', title: '', content: '', video_url: '', order_index: 0
    });
    const [isLoading, setIsLoading] = useState(false);
    // Use a small set of initial categories as a fallback
    const [categories, setCategories] = useState(['General', 'JAMB', 'WAEC', 'Science', 'Mathematics']);

    const fetchCategories = useCallback(() => {
        // 💥 REAL API CALL
        api.learn.getCategories().then(cats => {
            if (cats && cats.length > 0) {
                const catNames = cats.map(c => c.name);
                // Merge default categories with those from DB, remove duplicates
                setCategories(prev => [...new Set([...prev, ...catNames])]);
            }
        }).catch(e => console.error("Failed to fetch categories in creator:", e));
    }, []);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

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
        onToast('Publishing lesson...', 'info');
        
        try {
            // 💥 REAL API CALL
            await api.admin.createLesson(formData);
            onToast('Lesson published successfully!', 'success');
            // Reset form but keep category
            setFormData(prev => ({ ...prev, title: '', content: '', video_url: '', order_index: prev.order_index + 1 }));
            // Refresh categories list just in case a new one was created
            fetchCategories(); 
        } catch (error) {
            onToast(`Error publishing lesson: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow border border-gray-100 dark:border-slate-700 animate-fade-in">
            <h3 className="text-lg font-bold dark:text-white mb-4 flex items-center gap-2">
                <Plus size={20} className="text-indigo-500"/> Create New Lesson
            </h3>
            
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
                        <select 
                            name="category" 
                            value={formData.category} 
                            onChange={handleChange}
                            className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        >
                            {[...new Set(categories)].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                         <input
                            type="text" 
                            placeholder="Or type new category..."
                            className="mt-2 w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm"
                            onChange={(e) => setFormData(prev => ({...prev, category: e.target.value || 'General'}))}
                        />
                        <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Select an existing category or type a new one.</p>
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

// ====================================================================
// --- 6. Category List (View Only) ---
// ====================================================================
const CategoryList = () => {
    const [categories, setCategories] = useState([]);
    
    useEffect(() => {
        // 💥 REAL API CALL
        api.learn.getCategories().then(setCategories).catch(e => console.error("Failed to load categories:", e));
    }, []);

    return (
        <div className="space-y-4 animate-fade-in">
             <h3 className="text-xl font-bold dark:text-white">Existing Categories</h3>
             <p className="text-sm text-gray-500 dark:text-gray-400">
                Categories are created automatically when you add a lesson with a new category name.
             </p>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {categories.map(cat => (
                    <div key={cat.id || cat.name} className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-100 dark:border-slate-700 text-center">
                        <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center font-bold bg-indigo-100 text-indigo-700 mb-2 dark:bg-indigo-900 dark:text-indigo-300`}>
                            {cat.name[0]}
                        </div>
                        <h4 className="font-bold dark:text-white">{cat.name}</h4>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{cat.count || 0} Lessons</span>
                    </div>
                ))}
             </div>
        </div>
    );
}

// ====================================================================
// --- Main Admin Module ---
// ====================================================================

export default function AdminModule({ user }) {
    const [activeTab, setActiveTab] = useState('manage'); // Default to content management
    const [subView, setSubView] = useState('list'); // 'list' or 'quiz_form'
    const [activeLesson, setActiveLesson] = useState(null); // { id, title }
    const [toast, setToast] = useState({ message: '', type: 'info' });

    // Security Check
    if (!user || !user.is_admin) {
        return <PermissionDenied />;
    }
    
    // Helper to show toasts
    const showToast = (message, type) => setToast({ message, type });

    const handleSelectLesson = (id, title, targetSubView) => {
        setActiveLesson({ id, title });
        setSubView(targetSubView);
    };

    const handleBackToList = () => {
        setActiveLesson(null);
        setSubView('list');
    };

    const TabButton = ({ name, icon: Icon, label }) => (
        <button
            onClick={() => {
                setActiveTab(name);
                // Reset sub-view state when changing main tabs
                setSubView('list'); 
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium border-b-2 ${
                activeTab === name
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
        >
            <Icon size={18} />
            {label}
        </button>
    );

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6 animate-fade-in bg-white dark:bg-slate-900 min-h-screen">
            <header className="mb-8">
                <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">Admin Dashboard</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Manage all system content and user permissions.</p>
            </header>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
                <TabButton name="manage" icon={Settings} label="Manage Content" />
                <TabButton name="lessons" icon={Plus} label="Add Lesson" />
                <TabButton name="categories" icon={List} label="Categories" />
                <TabButton name="users" icon={Users} label="Manage Users" />
            </div>

            {/* Content Area */}
            <div className="pt-4">
                {/* 1. Content Management Tab: Handles Lesson Delete & Quiz Upload/Delete */}
                {activeTab === 'manage' && (
                    <div className="space-y-6">
                        {subView === 'quiz_form' && activeLesson ? (
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
                {activeTab === 'lessons' && <LessonCreator onToast={showToast} />}
                
                {/* 3. Categories Tab */}
                {activeTab === 'categories' && <CategoryList />}
                
                {/* 4. User Management Tab */}
                {activeTab === 'users' && <UserManagement currentAdminId={user.id} onToast={showToast} />}
            </div>
            {/* Global Toast Notification */}
            <Toast {...toast} onClose={() => setToast({ message: '', type: 'info' })} />
        </div>
    );
}

