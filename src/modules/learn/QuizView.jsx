import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { CheckCircle, ArrowLeft } from 'lucide-react'; 
// ... other imports

const QuizView = ({ lessonData, onNavigate, onUpdateWallet }) => {
    // 1. New Status State (Use 'loading', 'ready', 'completed', 'error')
    const [loading, setLoading] = useState(true);
    const [quizStatus, setQuizStatus] = useState('loading');
    const [questions, setQuestions] = useState([]);
    // ... other states (e.g., currentQuestionIndex, answers)

    // Function to fetch the quiz questions
    const fetchQuiz = async () => {
        setLoading(true);
        setQuizStatus('loading');
        try {
            const fetchedQuestions = await api.learn.getQuizQuestions(lessonData.lessonId);
            setQuestions(fetchedQuestions);
            setQuizStatus('ready'); // Ready to start the quiz
        } catch (error) {
            // 2. 💥 CRITICAL FIX: Check the specific error message
            if (error.message === 'QuizAlreadyCompleted') {
                setQuizStatus('completed'); // Set status to completed
            } else {
                console.error("Error loading quiz:", error);
                setQuizStatus('error'); // Fallback for 404, 500, etc.
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuiz();
    }, [lessonData.lessonId]);

    // 3. Render Logic based on Status

    if (loading) {
        return <p className='text-center dark:text-gray-400 p-12'>Loading Quiz...</p>;
    }
    
    // RENDER: Quiz Completed View
    if (quizStatus === 'completed') {
        return (
            <div className="text-center p-12 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700">
                <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold dark:text-white">Quiz Completed!</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    You have already earned your reward for this lesson.
                </p>
                <button 
                    onClick={() => onNavigate('learn', 'list', { name: lessonData.category })} 
                    className="mt-6 px-6 py-2 text-white bg-indigo-600 rounded-full shadow-lg hover:bg-indigo-700 transition"
                >
                    <ArrowLeft size={20} className='inline-block mr-2' /> Back to Lessons
                </button>
            </div>
        );
    }

    // RENDER: Quiz Load Error View (for 404 or 500)
    if (quizStatus === 'error') {
        return (
            <div className="text-center p-12 bg-red-50 dark:bg-slate-800 rounded-2xl border-2 border-red-300">
                <h3 className="text-xl font-bold text-red-600 dark:text-red-400">Quiz Load Error</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    An unexpected error occurred. Please check the lesson data or try again.
                </p>
            </div>
        );
    }

    // RENDER: Quiz Ready View (Display the questions, assuming questions.length > 0)
    if (quizStatus === 'ready') {
        return (
            // Your existing JSX for displaying the quiz questions and submission form goes here
            <div className='p-4'>
                <h3 className='text-2xl font-bold dark:text-white'>Quiz for {lessonData.lessonTitle}</h3>
                {/* ... display question, options, etc. */}
            </div>
        );
    }

    return null; // Should not happen
};

export default QuizView;
