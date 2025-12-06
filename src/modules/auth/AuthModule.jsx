import React, { useState } from 'react';
import { api } from '../../services/api';

// --- Shared Input Field Component ---
const InputField = ({ label, type, name, value, onChange, placeholder, required = true }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {label}
        </label>
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:text-white transition-colors"
        />
    </div>
);

// ----------------------------------------------------
// --- 1. Signup Form (Updated with Error Handling) ---
// ----------------------------------------------------
const SignupForm = ({ onLoginSuccess, onNavigate }) => {
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(''); // NEW: Error state

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (errorMessage) setErrorMessage(''); // Clear error on new input
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage(''); // Reset error before submission

        try {
            await api.auth.signup(formData.name, formData.email, formData.password);
            
            onLoginSuccess(); 
        } catch (error) {
            console.error("Signup failed:", error);
            // CATCH ERROR AND SET MESSAGE
            const message = error.message || "An unexpected signup error occurred. Please try again.";
            setErrorMessage(message); 
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display Error Message */}
            {errorMessage && (
                <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-400 rounded-lg text-red-700 dark:text-red-300 text-sm">
                    {errorMessage}
                </div>
            )}
            
            <InputField
                label="Full Name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="John Doe"
            />
            <InputField
                label="Email Address"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
            />
            <InputField
                label="Password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Secure Password"
            />

            <button
                type="submit"
                disabled={isLoading}
                className={`w-full px-4 py-3 text-lg font-semibold rounded-xl transition-colors ${
                    isLoading
                        ? 'bg-indigo-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                } text-white`}
            >
                {isLoading ? 'Creating Account...' : 'Sign Up'}
            </button>
            <p className="text-center text-sm">
                Already have an account?{' '}
                <a 
                    href="#" 
                    onClick={() => onNavigate('auth', 'login')}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                    Sign In
                </a>
            </p>
        </form>
    );
};

// ----------------------------------------------------
// --- 2. Login Form (ADDED/FIXED) ---
// ----------------------------------------------------
const LoginForm = ({ onLoginSuccess, onNavigate }) => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(''); // NEW: Error state

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (errorMessage) setErrorMessage(''); // Clear error on new input
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage(''); // Reset error before submission

        try {
            await api.auth.login(formData.email, formData.password);
            onLoginSuccess();
        } catch (error) {
            console.error("Login failed:", error);
            
            // CATCH ERROR AND SET MESSAGE
            // This is where the backend's "Incorrect username or password" detail will be caught
            const message = error.message || "An unexpected login error occurred. Please try again.";
            setErrorMessage(message); 
        } finally {
            // CRITICAL FIX: Ensure loading state is always turned off, even on error
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display Error Message */}
            {errorMessage && (
                <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-400 rounded-lg text-red-700 dark:text-red-300 text-sm">
                    {errorMessage}
                </div>
            )}
            
            <InputField
                label="Email Address"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
            />
            <InputField
                label="Password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Secure Password"
            />

            <button
                type="submit"
                disabled={isLoading}
                className={`w-full px-4 py-3 text-lg font-semibold rounded-xl transition-colors ${
                    isLoading
                        ? 'bg-indigo-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                } text-white`}
            >
                {/* Display correct loading text */}
                {isLoading ? 'Signing In...' : 'Sign In'}
            </button>

            <p className="text-center text-sm">
                <a 
                    href="#" 
                    onClick={() => onNavigate('auth', 'forgot-password')}
                    className="text-gray-500 hover:text-indigo-600 dark:text-gray-400 hover:underline font-medium"
                >
                    Forgot Password?
                </a>
            </p>
            <p className="text-center text-sm">
                Don't have an account?{' '}
                <a 
                    href="#" 
                    onClick={() => onNavigate('auth', 'signup')}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                    Sign Up
                </a>
            </p>
        </form>
    );
};

// ----------------------------------------------------
// --- 3. Forgot Password Form (Placeholder) ---
// ----------------------------------------------------
const ForgotPasswordForm = ({ onNavigate }) => (
    <div className="space-y-4 text-center">
        <p className='text-gray-600 dark:text-gray-400'>
            This feature is not yet available. Please contact support to reset your password.
        </p>
        <button 
            onClick={() => onNavigate('auth', 'login')}
            className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-semibold"
        >
            Back to Sign In
        </button>
    </div>
);


// ===================================================================
// --- MAIN AuthModule COMPONENT ---
// ===================================================================

export default function AuthModule({ view, onLoginSuccess, onNavigate }) {
    
    let content;
    let title;

    switch (view) {
        case 'signup':
            content = <SignupForm onLoginSuccess={onLoginSuccess} onNavigate={onNavigate} />;
            title = 'Create Your Account';
            break;
        case 'forgot-password':
            content = <ForgotPasswordForm onNavigate={onNavigate} />;
            title = 'Forgot Password';
            break;
        case 'login':
        default:
            // Ensure 'login' is used for the default case
            content = <LoginForm onLoginSuccess={onLoginSuccess} onNavigate={onNavigate} />;
            title = 'Welcome Back';
            break;
    }

    return (
        <div className="max-w-md mx-auto p-4 md:p-8">
            <div className="text-center mb-8">
                {/* Placeholder Logo */}
                <div className="w-20 h-20 mx-auto mb-4 rounded-full shadow-lg bg-indigo-100 flex items-center justify-center text-4xl text-indigo-600 font-extrabold">
                    $R
                </div>
                <h2 className="text-3xl font-extrabold text-gray-800 dark:text-white">{title}</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Sign in to start learning and earning $READS tokens.
                </p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700">
                {content}
            </div>
        </div>
    );
}
