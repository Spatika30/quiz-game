import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import Auth from './components/Auth';
import QuizCreator from './components/QuizCreator';
import HostDashboard from './components/HostDashboard';
import GameHostView from './components/GameHostView';

// Import the new player components
import PlayerJoinGame from './components/PlayerJoinGame';
import PlayerGameScreen from './components/PlayerGameScreen';
import PlayerResultsScreen from './components/PlayerResultsScreen';

import './App.css'; // Your main CSS file for styling

function App() {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user'))); // Store user data

    // Effect to check for stored token and user on component mount
    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedUser = JSON.parse(localStorage.getItem('user'));
        if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(storedUser);
        }
    }, []);

    // Function to handle successful authentication (login/register)
    const handleAuthSuccess = (newToken, newUser) => {
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
    };

    // Function to handle user logout
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
        // Optionally navigate to home or login page after logout
        // navigate('/'); // Requires using useNavigate hook directly in App component
    };

    return (
        <Router>
            <div className="App">
                <nav>
                    <h1>Kahoot Clone</h1>
                    <div className="nav-links">
                        {/* Conditional rendering for authenticated vs. unauthenticated users */}
                        {token ? (
                            <>
                                <span>Welcome, {user?.username}!</span> {/* Display username if logged in */}
                                <Link to="/dashboard">Dashboard</Link>
                                <Link to="/create-quiz">Create Quiz</Link>
                                <button onClick={handleLogout} className="nav-button">Logout</button>
                            </>
                        ) : (
                            <>
                                <Link to="/login">Login</Link>
                                <Link to="/register">Register</Link>
                            </>
                        )}
                        {/* Link for players to join a game */}
                        <Link to="/player-join" className="player-link">Join a Game (Player)</Link>
                    </div>
                </nav>

                <div className="main-content">
                    <Routes>
                        {/* Authentication Routes */}
                        <Route path="/login" element={<Auth type="login" onAuthSuccess={handleAuthSuccess} />} />
                        <Route path="/register" element={<Auth type="register" onAuthSuccess={handleAuthSuccess} />} />

                        {/* Host/Quiz Master Routes (protected by token check) */}
                        <Route path="/dashboard" element={token ? <HostDashboard userId={user?.id} /> : <p>Please login to view dashboard.</p>} />
                        <Route path="/create-quiz" element={token ? <QuizCreator /> : <p>Please login to create quizzes.</p>} />
                        <Route path="/host-game/:quizId" element={token ? <GameHostView userId={user?.id} /> : <p>Please login to host games.</p>} />

                        {/* Player Routes */}
                        <Route path="/player-join" element={<PlayerJoinGame />} />
                        {/* Player Game Screen will receive state via navigation */}
                        <Route path="/player-game" element={<PlayerGameScreen />} />
                        {/* Player Results Screen will receive state via navigation */}
                        <Route path="/player-results" element={<PlayerResultsScreen />} />

                        {/* Default/Home Route */}
                        <Route path="/" element={<h2>Welcome to Kahoot! Select an option from the navigation.</h2>} />
                    </Routes>
                </div>
            </div>
        </Router>
    );
}

export default App;