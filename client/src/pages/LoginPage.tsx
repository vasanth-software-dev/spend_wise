import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/index.js';
import { loginThunk, googleDevLoginThunk, clearAuthError } from '../store/slices/authSlice.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { GoogleButton } from '../components/ui/GoogleButton.js';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const { isAuthenticated, loading, error } = useAppSelector((state) => state.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Check for error in URL from OAuth redirect
  const oauthError = searchParams.get('error');

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
    if (!email || !password) return;
    dispatch(loginThunk({ email, password }));
  };

  const handleGoogleLogin = () => {
    setIsGoogleLoading(true);
    // Initiates Socialite Google OAuth flow via backend
    window.location.href = '/api/v1/auth/google';
  };

  const handleGoogleDemoLogin = () => {
    dispatch(
      googleDevLoginThunk({
        email: 'vasanth.kumar@gmail.com',
        name: 'Vasanth Kumar',
      })
    );
  };

  const handleFillDemo = () => {
    setEmail('vasanth@spendwise.dev');
    setPassword('SpendWise@123');
  };

  const displayError = oauthError || error;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Logo */}
        <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center text-white shadow-md font-extrabold text-2xl">
          ₹
        </div>
        <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          SpendWise
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          "Understand where your money goes."
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-10 shadow-premium border border-slate-200/80 dark:border-slate-800 rounded-3xl">
          {displayError && (
            <div className="p-3 mb-5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium">
              {displayError}
            </div>
          )}

          {/* Quick Demo Credentials Fill Button */}
          <div className="mb-6 p-3 rounded-2xl bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900/60 flex items-center justify-between">
            <div className="text-xs">
              <span className="font-bold text-brand-900 dark:text-brand-300 block">
                Instant Demo Access
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                Test demo credentials or 1-click Google
              </span>
            </div>
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Sparkles className="w-3.5 h-3.5 text-brand-600" />}
                onClick={handleFillDemo}
                className="text-xs bg-white dark:bg-slate-800"
              >
                Fill Form
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGoogleDemoLogin}
                className="text-xs bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400"
              >
                1-Click Gmail
              </Button>
            </div>
          </div>

          {/* Socialite Google Sign In */}
          <div className="space-y-3">
            <GoogleButton
              onClick={handleGoogleLogin}
              isLoading={isGoogleLoading}
              text="Continue with Google"
            />
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 font-medium tracking-wider">
                or continue with email
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full shadow-sm"
                isLoading={loading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-bold text-brand-600 dark:text-brand-400 hover:underline"
              >
                Create one now
              </Link>
            </p>
          </div>
        </div>

        {/* Security badge */}
        <div className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Zero passwords, UPI PINs, or bank credentials collected</span>
        </div>
      </div>
    </div>
  );
};
