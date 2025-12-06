import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ArrowLeft, CheckCircle, XCircle, Award, RefreshCw } from 'lucide-react';

// --- Helper Components ---

const LoadingState = ({ message = "Loading quiz questions..." }) => (
    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        <RefreshCw size={24} className="mx-auto mb-3 animate-spin text-indigo-500" />
        <p>{message}</p>
    </div>
);

const CompletedState = ({ lessonTitle, onNavigate }) => (
    <div className="space-y-6 animate-fade-in p-8 bg-green-50 dark:bg-slate-800 rounded-2xl shadow-lg border-l-4 border-green-500">
        <CheckCircle size={48} className="text-green-600 mx-auto" />
        <h3 className="text-2xl font-bold text-center dark:text-white">Quiz Completed!</h3>
        <p className="text-center text-gray-600 dark:text-gray-400">
            You have already successfully completed the quiz for **{lessonTitle}** and earned your reward.
        </p>
        <button 
            onClick={() => onNavigate('learn', 'categories')}
            className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-semibold"
        >
            Explore More Lessons
        </button>
    </div>
);

const ResultSummary = ({ result, lessonTitle, onNavigate }) => {
    const passed = result.score >= 70;
    const Icon = passed ? Award : XCircle;

    return (
        <div className="space-y-6 animate-fade-in p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg">
            <div className="text-center">
                <Icon size={48} className={`mx-auto mb-3 ${passed ? 'text-green-500' : 'text-red-500'}`} />
                <h3 className="text-3xl font-bold dark:text-white">{passed ? "Congratulations!" : "Quiz Failed"}</h3>
                <p className="text-gray-600 dark:text-gray-400">Results for: **{lessonTitle}**</p>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center border-b pb-4">
                <StatCard label="Score" value={`${result.score}%`} color={passed ? 'text-green-500' : 'text-red-500'} />
                <StatCard label="Correct" value={result.correct} color="text-indigo-500" />
                <StatCard label="Tokens" value={`+${result.tokens_awarded}`} color="text-yellow-500" />
            </div>

            <button 
                onClick={() => onNavigate('learn', 'categories')}
                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-semibold"
            >
                Continue Learning
            </button>
        </div>
    );
};

const StatCard = ({ label, value, color }) => (
    <div className="p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
);


// ===================================================================
// --- MAIN QuizView COMPONENT ---
// ===================================================================

const QuizView = ({ lessonData, onNavigate, onUpdateWallet }) => {
    const { lessonId, lessonTitle, category } = lessonData;

    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({}); // { questionId: 'A', questionId2: 'C' }
    const [submissionResult, setSubmissionResult] = useState(null);
    const [status, setStatus] = useState('loading'); // 'loading', 'questions', 'completed', 'results', 'error'
    const [errorMessage, setErrorMessage] = useState(''); // State to hold specific error message

    useEffect(() => {
        const fetchQuiz = async () => {
            setStatus('loading');
            setErrorMessage('');
            try {
                const data = await api.learn.getQuizQuestions(lessonId);
                setQuestions(data);
                setStatus('questions');
            } catch (err) {
                const message = err.message || 'An unknown API error occurred.';
                console.error("Quiz fetch error:", message);
                
                // 💥 CRITICAL FIX: Check for the exact custom error message thrown by Api.js
                // The message is 'QuizAlreadyCompleted'
                if (message === 'QuizAlreadyCompleted') {
                    setStatus('completed');
                } else {
                    setErrorMessage(message); // Capture the actual error message
                    setStatus('error');
                }
            }
        };

        if (!submissionResult) {
            fetchQuiz();
        }
    }, [lessonId, submissionResult]);


    const handleAnswerChange = (questionId, selectedOption) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: selectedOption
        }));
    };

    const handleSubmit = async () => {
        setStatus('loading');
        setErrorMessage('');
        
        const submissionBody = {
            lesson_id: lessonId,
            answers: Object.entries(answers).map(([question_id, selected]) => ({
                question_id: question_id,
                selected: selected
            }))
        };
        
        try {
            const result = await api.learn.submitQuiz(lessonId, submissionBody.answers);
            
            // Update wallet balance if tokens were awarded
            if (result.tokens_awarded > 0) {
                onUpdateWallet(result.tokens_awarded); 
            }

            setSubmissionResult(result);
            setStatus('results');

        } catch (err) {
            const message = err.message || 'An unknown API error occurred during submission.';
            console.error("Quiz submission failed:", message);
            setErrorMessage(message); 
            setStatus('error'); // Re-set status to error on submission fail
        }
    };

    // --- RENDER LOGIC ---

    if (status === 'loading') {
        return <LoadingState message="Fetching quiz questions..." />;
    }

    if (status === 'completed') {
        // This handles the correct 409 response gracefully
        return <CompletedState lessonTitle={lessonTitle} onNavigate={onNavigate} />;
    }
    
    if (status === 'results' && submissionResult) {
        return <ResultSummary result={submissionResult} lessonTitle={lessonTitle} onNavigate={onNavigate} />;
    }

    if (status === 'error') {
        return (
            <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-xl shadow-lg border-l-4 border-red-500">
                <XCircle size={24} className="mx-auto mb-3 text-red-500" />
                <p className='font-bold text-red-600 dark:text-red-400'>Quiz Load Error</p>
                {/* Now displays the exact API error message */}
                <p className='text-sm text-gray-500 dark:text-gray-400 mt-2'>{errorMessage}</p>
                <button 
                    onClick={() => { setStatus('loading'); setErrorMessage(''); }} 
                    className="mt-4 text-indigo-600 hover:underline"
                >
                    <RefreshCw size={16} className="inline mr-1" /> Retry
                </button>
                <div className='mt-4'>
                    <button onClick={() => onNavigate('learn', 'detail', lessonId)} className="flex items-center mx-auto text-sm text-gray-500 hover:text-indigo-600">
                         <ArrowLeft size={16} className="mr-1" /> Back to Lesson
                    </button>
                </div>
            </div>
        );
    }

    // Default view: Display Questions
    return (
        <div className="space-y-6 animate-fade-in">
            <button onClick={() => onNavigate('learn', 'detail', lessonId)} className="flex items-center text-indigo-600 hover:text-indigo-700 text-sm font-medium mb-4 dark:text-indigo-400 dark:hover:text-indigo-300">
                <ArrowLeft size={16} className="mr-1" /> Back to Lesson
            </button>
            <h2 className="text-3xl font-bold dark:text-white">Quiz: {lessonTitle}</h2>
            <p className="text-gray-600 dark:text-gray-400">Test your knowledge on {category}. You must score 70% or more to earn tokens.</p>

            <div className="space-y-8">
                {questions.map((q, index) => (
                    <div key={q.id} className="p-6 bg-white dark:bg-slate-800 rounded-xl shadow-md border border-gray-100 dark:border-slate-700">
                        <p className="font-semibold text-lg dark:text-white mb-4">
                            {index + 1}. {q.question}
                        </p>
                        
                        <div className="space-y-3">
                            {/* Assuming options is an array of strings in the format: ["A. Option text", "B. Option text"] */}
                            {q.options.map(option => {
                                const optionKey = option.split('. ')[0]; // Extracts 'A', 'B', 'C', or 'D'
                                const isSelected = answers[q.id] === optionKey;
                                
                                return (
                                    <button
                                        key={option}
                                        onClick={() => handleAnswerChange(q.id, optionKey)}
                                        className={`w-full text-left p-4 rounded-lg border transition-all duration-200 
                                            ${isSelected 
                                                ? 'bg-indigo-500 text-white border-indigo-500 shadow-md' 
                                                : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 dark:text-gray-200 hover:bg-indigo-100 dark:hover:bg-slate-600'
                                            }`
                                        }
                                    >
                                        {option}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="pt-6 flex justify-end">
                <button
                    onClick={handleSubmit}
                    disabled={Object.keys(answers).length !== questions.length}
                    className={`px-8 py-3 text-lg font-semibold text-white rounded-full shadow-lg transition duration-200
                        ${Object.keys(answers).length === questions.length 
                            ? 'bg-green-500 hover:bg-green-600 transform hover:scale-105'
                            : 'bg-gray-400 cursor-not-allowed'
                        }`
                    }
                >
                    Submit Quiz ({Object.keys(answers).length}/{questions.length})
                </button>
            </div>
        </div>
    );
};

export default QuizView;
