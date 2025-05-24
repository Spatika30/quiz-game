import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

// IMPORTANT: Ensure this URL matches your backend server's port.
// If you changed it to 5001, make sure it's 'http://localhost:5001'
const socket = io('http://localhost:5001');

function PlayerJoinGame() {
    const [gamePin, setGamePin] = useState('');
    const [nickname, setNickname] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        socket.on('connect', () => {
            console.log('Player Web Client: Connected to socket server');
        });

        socket.on('joinedGame', ({ gamePin, nickname, quizTitle }) => {
            console.log(`Player Web Client: Joined game ${gamePin} as ${nickname} for quiz ${quizTitle}`);
            // Use navigate with state to pass game details to the next screen
            navigate('/player-game', { state: { gamePin, nickname, quizTitle } });
        });

        socket.on('joinError', (msg) => {
            setError(msg);
        });

        socket.on('gameEndedUnexpectedly', (msg) => {
            setError(msg);
            alert(`Game Ended: ${msg}. Please join a new game.`);
            setGamePin(''); // Clear inputs
            setNickname('');
            navigate('/player-join'); // Go back to join screen
        });

        return () => {
            // Clean up socket listeners when component unmounts
            socket.off('connect');
            socket.off('joinedGame');
            socket.off('joinError');
            socket.off('gameEndedUnexpectedly');
        };
    }, [navigate]); // navigate is a stable function reference from React Router

    const handleJoinGame = () => {
        setError(''); // Clear previous errors
        if (gamePin.length === 6 && nickname.trim() !== '') {
            socket.emit('player:joinGame', { gamePin, nickname });
        } else {
            setError('Please enter a 6-digit game PIN and a nickname.');
        }
    };

    return (
        <div className="player-join-container">
            <h2>Join a Game</h2>
            <input
                type="text"
                placeholder="Game PIN"
                maxLength={6}
                value={gamePin}
                onChange={(e) => setGamePin(e.target.value)}
                required // HTML5 validation
            />
            <input
                type="text"
                placeholder="Your Nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required // HTML5 validation
            />
            <button onClick={handleJoinGame}>Join Game</button>
            {error && <p className="error-message">{error}</p>}
        </div>
    );
}

export default PlayerJoinGame;