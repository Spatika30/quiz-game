import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function PlayerResultsScreen() {
    const location = useLocation();
    const navigate = useNavigate();
    // Destructure finalResults, nickname, and finalScore from the state
    const { finalResults, nickname, finalScore } = location.state || {};

    // Redirect if no results data is present (e.g., direct access or refresh)
    if (!finalResults) {
        navigate('/player-join');
        return null; // Don't render anything if redirecting
    }

    return (
        <div className="player-results-container">
            <h2>Game Over!</h2>
            <p className="your-score">Your Final Score: {finalScore} points</p>

            <h3>Leaderboard</h3>
            <ol className="leaderboard-list">
                {/* Map through the results to display each player's score */}
                {finalResults.map((result, index) => (
                    <li key={index} className={`leaderboard-item ${result.nickname === nickname ? 'your-result' : ''}`}>
                        <span className="rank">#{index + 1}</span>
                        <span className="player-nickname">{result.nickname}</span>
                        <span className="player-score">{result.finalScore} pts</span>
                    </li>
                ))}
            </ol>
            {/* Buttons to navigate to new game or back to host dashboard */}
            <button onClick={() => navigate('/player-join')}>Join New Game</button>
            <button onClick={() => navigate('/')}>Back to Host Dashboard</button>
        </div>
    );
}

export default PlayerResultsScreen;