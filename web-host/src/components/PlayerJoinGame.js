import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

/* Use env var or fallback */
const socket = io(
  (process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001/api').replace('/api', '')
);

function PlayerJoinGame() {
  const [gamePin,  setGamePin]  = useState('');
  const [nickname, setNickname] = useState('');
  const [error,    setError]    = useState('');
  const navigate = useNavigate();

  /* ───────────────────────────────────────────
     Socket listeners
  ─────────────────────────────────────────── */
  useEffect(() => {
    socket.on('connect', () => console.log('Player client: socket connected'));

    socket.on('joinedGame', ({ gamePin, nickname, quizTitle }) => {
      navigate('/player-game', { state: { gamePin, nickname, quizTitle } });
    });

    socket.on('joinError', setError);

    socket.on('gameEndedUnexpectedly', (msg) => {
      alert(`Game Ended: ${msg}`);
      setError(msg);
      setGamePin('');
      setNickname('');
      navigate('/player-join');
    });

    return () => socket.off();
  }, [navigate]);

  /* ───────────────────────────────────────────
     Join button
  ─────────────────────────────────────────── */
  const handleJoinGame = () => {
    setError('');
    if (gamePin.length === 6 && nickname.trim()) {
      socket.emit('player:joinGame', { gamePin, nickname });
    } else {
      setError('Please enter a 6-digit PIN and a nickname.');
    }
  };

  /* ───────────────────────────────────────────
     Render
  ─────────────────────────────────────────── */
  return (
    <div className="player-join-container">
      <h2>Join a Game</h2>

      <input
        type="text"
        placeholder="Game PIN"
        maxLength={6}
        value={gamePin}
        onChange={(e) => setGamePin(e.target.value)}
        required
      />

      <input
        type="text"
        placeholder="Your Nickname"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        required
      />

      <button onClick={handleJoinGame}>Join Game</button>

      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

export default PlayerJoinGame;
