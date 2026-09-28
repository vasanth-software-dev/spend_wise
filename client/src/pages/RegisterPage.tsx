import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/index.js';
import { registerThunk, clearAuthError } from '../store/slices/authSlice.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { GoogleButton } from '../components/ui/GoogleButton.js';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isAuthenticated, loading, error } = useAppSelector((state) => state.auth);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
    return () => {
      dispatch(clearAuthError());
    };
  }, [isAuthenticated, navigate, dispatch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    dispatch(registerThunk({ name, email, password, currency: 'INR' }));
  };

  const handleGoogleSignUp = () => {
    setIsGoogleLoading(true);
    window.location.href = '/api/v1/auth/google';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b13] flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center text-white shadow-glow-emerald font-extrabold text-2xl tracking-tighter">
          ₹
        </div>
        <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Create SpendWise Account
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Understand where your money goes with intelligent UPI tracking.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 relative z-10">
        <div className="bg-white dark:bg-[#0d1322] py-8 px-6 sm:px-10 shadow-fintech-lg border border-slate-200/90 dark:border-white/10 rounded-3xl">
          {error && (
            <div className="p-3 mb-5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold animate-in fade-in">
              {error}
            </div>
          )}

          {/* Socialite Google Sign Up */}
          <div className="space-y-3">
            <GoogleButton
              onClick={handleGoogleSignUp}
              isLoading={isGoogleLoading}
              text="Sign up with Google"
            />
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-[#0d1322] px-3 text-slate-400 font-semibold tracking-wider text-[10px]">
                or sign up with email
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              placeholder="Vasanth Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="vasanth@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full shadow-2xs font-bold"
                isLoading={loading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Create Account
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-bold text-brand-600 dark:text-brand-400 hover:underline ml-1"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Local zero-cost development enabled</span>
        </div>
      </div>
    </div>
  );
};
