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

// --- 1. Signup Form ---
const SignupForm = ({ onLoginSuccess, onNavigate }) => {
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // This calls the API, which now handles error alerting
            await api.auth.signup(formData.name, formData.email, formData.password);
            
            // --- CRITICAL SUCCESS STATE ---
            onLoginSuccess(); 
            // -----------------------------
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="********"
            />
            <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 mt-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
                {isLoading ? 'Creating Account...' : 'Sign Up'}
            </button>
            <button
                type="button"
                onClick={() => onNavigate('login')}
                className="w-full text-sm text-gray-500 hover:underline mt-4"
            >
                Already have an account? Log In
            </button>
        </form>
    );
};

// --- 2. Login Form ---
const LoginForm = ({ onLoginSuccess, onNavigate }) => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            await api.auth.login(formData.email, formData.password);
            onLoginSuccess();
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="********"
            />
            <div className="flex justify-end">
                 <button
                    type="button"
                    onClick={() => onNavigate('forgot-password')}
                    className="text-xs text-indigo-600 hover:text-indigo-700"
                >
                    Forgot Password?
                </button>
            </div>
            <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 mt-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
                {isLoading ? 'Signing In...' : 'Log In'}
            </button>
            <button
                type="button"
                onClick={() => onNavigate('signup')}
                className="w-full text-sm text-gray-500 hover:underline mt-4"
            >
                Don't have an account? Sign Up
            </button>
        </form>
    );
};

// --- 3. Forgot Password Form (Stub) ---
const ForgotPasswordForm = ({ onNavigate }) => (
    <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
            Enter your email address and we will send you a link to reset your password.
        </p>
        <InputField
            label="Email Address"
            type="email"
            name="email"
            placeholder="you@example.com"
            onChange={() => {}}
            value=""
        />
        <button
            type="button"
            className="w-full py-3 mt-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors"
        >
            Reset Password
        </button>
        <div className="text-center pt-2">
            <button
                type="button"
                onClick={() => onNavigate('login')}
                className="text-xs text-gray-500 hover:underline"
            >
                Back to Login
            </button>
        </div>
    </div>
);


// --- Main Auth Module Component ---
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
