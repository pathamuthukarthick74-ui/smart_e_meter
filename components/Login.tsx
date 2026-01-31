
import React, { useState } from 'react';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulating authentication delay
    setTimeout(() => {
      onLogin({
        id: '1',
        email: email,
        name: email.split('@')[0].toUpperCase(),
      });
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950 px-4">
      <div className="w-full max-w-md glass p-8 rounded-2xl shadow-2xl space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-full mb-4">
            <i className="fas fa-bolt text-2xl text-white"></i>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">EcoPulse</h1>
          <p className="mt-2 text-slate-400">Secure energy monitoring portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
              placeholder="admin@ecopulse.io"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <i className="fas fa-circle-notch fa-spin"></i>
            ) : (
              <>
                <span>Sign In</span>
                <i className="fas fa-arrow-right text-xs"></i>
              </>
            )}
          </button>
        </form>

        <div className="text-center text-sm text-slate-500">
          <p>IoT Hardware Connected: <span className="text-emerald-500">Online</span></p>
        </div>
      </div>
    </div>
  );
};

export default Login;
