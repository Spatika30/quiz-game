// web-host/components/Auth.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

function Auth({ type, onAuthSuccess }) {
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (type === 'register') {
        /* 1 · create auth user */
        const { data: signUp, error: signUpErr } =
          await supabase.auth.signUp({ email, password });

        if (signUpErr) throw signUpErr;

        /* 2 · if email confirm is required, signUp.session will be null */
        const user = signUp.user;
        const token = signUp.session?.access_token ?? null;

        /* 3 · insert profile row (id = auth user id) */
        const { error: profErr } = await supabase.from('profiles').insert([
          { id: user.id, username, role: 'quizMaster' }
        ]);
        if (profErr) throw profErr;

        /* 4 · notify parent and route */
        onAuthSuccess(token, { id: user.id, email: user.email });
        alert('Check your email to confirm your account.');
        navigate('/dashboard');
      } else {
        /* LOGIN */
        const { data, error: loginErr } =
          await supabase.auth.signInWithPassword({ email, password });

        if (loginErr) throw loginErr;

        const token = data.session.access_token;
        onAuthSuccess(token, data.user);
        navigate('/dashboard');
      }
    } catch (err) {
      console.error(err.message);
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <h2>{type === 'register' ? 'Register' : 'Login'}</h2>

      <form onSubmit={handleSubmit}>
        {type === 'register' && (
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit">
          {type === 'register' ? 'Register' : 'Login'}
        </button>
      </form>

      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

export default Auth;
