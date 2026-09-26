import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAppDispatch } from '../store/index.js';
import { checkAuthThunk } from '../store/slices/authSlice.js';
import { setAccessToken } from '../services/api.js';
import { GoogleIcon } from '../components/ui/GoogleButton.js';
import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const AuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setErrorMessage(decodeURIComponent(error));
      return;
    }

    if (token) {
      setStatus('loading');
      setAccessToken(token);

      // Refresh auth profile in store
      dispatch(checkAuthThunk())
        .unwrap()
        .then(() => {
          setStatus('success');
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 600);
        })
        .catch((err) => {
          console.error('Callback auth refresh error:', err);
          setStatus('error');
          setErrorMessage(typeof err === 'string' ? err : 'Failed to finalize Google session');
        });
    } else {
      // In case no token in URL, try checking cookie
      dispatch(checkAuthThunk())
        .unwrap()
        .then(() => {
          setStatus('success');
          navigate('/dashboard', { replace: true });
        })
        .catch(() => {
          setStatus('error');
          setErrorMessage('No authentication token received from Google OAuth.');
        });
    }
  }, [searchParams, dispatch, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 py-10 px-8 rounded-3xl shadow-premium border border-slate-200/80 dark:border-slate-800 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6 shadow-sm border border-slate-200/60 dark:border-slate-700">
          <GoogleIcon className="w-8 h-8" />
        </div>

        {status === 'loading' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Authenticating with Google...
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Securing your session and setting up your SpendWise workspace.
            </p>
            <div className="pt-4 flex justify-center">
              <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Welcome to SpendWise!
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sign-in verified. Redirecting to your dashboard...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Google Authentication Failed
            </h2>
            <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 p-3 rounded-xl border border-rose-200 dark:border-rose-900">
              {errorMessage || 'An error occurred during Google sign in.'}
            </p>
            <div className="pt-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Return to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
