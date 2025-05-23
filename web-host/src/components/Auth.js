import React, { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

function Auth({ type, onAuthSuccess }) {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const url = type === 'register' ? '/auth/register' : '/auth/login';
            const payload = type === 'register' ? { username, email, password } : { email, password };
            const res = await api.post(url, payload);
            onAuthSuccess(res.data.token, res.data.user);
            navigate('/dashboard');
        } catch (err) {
            console.error(err.response?.data?.msg || err.message);
            setError(err.response?.data?.msg || 'Authentication failed');
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
                <button type="submit">{type === 'register' ? 'Register' : 'Login'}</button>
            </form>
            {error && <p className="error-message">{error}</p>}
        </div>
    );
}

export default Auth;