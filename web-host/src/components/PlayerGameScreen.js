import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

// IMPORTANT: Ensure this URL matches your backend server's port.
// If you changed it to 5001, make sure it's 'http://localhost:5001'
const socket = io('http://localhost:5001');

function PlayerGameScreen() {
    const location = useLocation(); // To get state passed from navigate
    const navigate = useNavigate();
    const { gamePin, nickname, quizTitle } = location.state || {}; // Destructure state

    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [countdown, setCountdown] = useState(0);
    const [hasAnswered, setHasAnswered] = useState(false);
    const [answerFeedback, setAnswerFeedback] = useState(null); // { isCorrect: bool, pointsEarned: num, currentScore: num }
    const [currentScore, setCurrentScore] = useState(0); // Player's live score
    const countdownIntervalRef = useRef(null); // Ref for the interval timer

    // Kahoot-like colors for answer options
    const optionColors = ['#E44A59', '#3D4A9B', '#489B3D', '#B58E00']; // Red, Blue, Green, Yellow

    useEffect(() => {
        // Redirect if game state is missing (e.g., direct access or refresh without state)
        if (!gamePin || !nickname) {
            navigate('/player-join');
            return;
        }

        // Socket listener for new questions
        socket.on('game:question', (questionData) => {
            console.log('Player Web: Received new question:', questionData.questionIndex);
            setCurrentQuestion(questionData);
            setCountdown(questionData.timeLimit);
            setHasAnswered(false); // Reset for new question
            setAnswerFeedback(null); // Clear previous feedback

            // Clear any existing countdown and start a new one
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(countdownIntervalRef.current);
                        if (!hasAnswered) {
                            // If time runs out and no answer, provide 'incorrect' feedback
                            setAnswerFeedback({ isCorrect: false, pointsEarned: 0, currentScore });
                        }
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        });

        // Socket listener for answer results from the server
        socket.on('answerResult', ({ isCorrect, pointsEarned, currentScore: updatedScore }) => {
            setAnswerFeedback({ isCorrect, pointsEarned, currentScore: updatedScore });
            setCurrentScore(updatedScore); // Update player's score
            clearInterval(countdownIntervalRef.current); // Stop countdown once answer result is received
        });

        // Socket listener for global score updates (optional, for player-side leaderboard)
        socket.on('game:scoreUpdate', (updatedPlayers) => {
            // You could use this to show a live mini-leaderboard on the player screen
            // For now, we mainly update individual currentScore via 'answerResult'
        });

        // Socket listener for game end
        socket.on('game:endGame', (finalResults) => {
            console.log('Player Web: Game ended. Final results:', finalResults);
            clearInterval(countdownIntervalRef.current);
            navigate('/player-results', { state: { finalResults, nickname, finalScore: currentScore } });
        });

        // Socket listener for general game errors
        socket.on('gameError', (msg) => {
            alert(`Game Error: ${msg}`);
            clearInterval(countdownIntervalRef.current); // Stop countdown
            navigate('/player-join'); // Go back to join screen on error
        });

        // Socket listener for unexpected game endings (e.g., host disconnected)
        socket.on('gameEndedUnexpectedly', (msg) => {
            alert(`Game Ended: ${msg}`);
            clearInterval(countdownIntervalRef.current); // Stop countdown
            navigate('/player-join'); // Go back to join screen
        });

        // Cleanup function for useEffect:
        return () => {
            clearInterval(countdownIntervalRef.current); // Clear any running countdown
            socket.off('game:question');
            socket.off('answerResult');
            socket.off('game:scoreUpdate');
            socket.off('game:endGame');
            socket.off('gameError');
            socket.off('gameEndedUnexpectedly');
        };
    }, [gamePin, nickname, navigate, currentScore, hasAnswered]); // Dependencies for useEffect

    const submitAnswer = (selectedOptionId) => {
        // Prevent multiple answers or answering after time limit expires
        if (hasAnswered || countdown <= 0) return;

        setHasAnswered(true); // Mark as answered
        socket.emit('player:submitAnswer', {
            gamePin,
            questionIndex: currentQuestion.questionIndex,
            selectedOptionId: selectedOptionId,
        });
        clearInterval(countdownIntervalRef.current); // Stop countdown immediately on answer
    };

    // Render loading or waiting screen if no current question data yet
    if (!currentQuestion) {
        return (
            <div className="player-waiting-screen">
                <h2>Joined Game: {quizTitle}</h2>
                <p>Game PIN: {gamePin}</p>
                <p>Nickname: {nickname}</p>
                <p>Waiting for the host to start the game...</p>
                <p className="current-score">Your Score: {currentScore}</p>
            </div>
        );
    }

    // Main game screen render
    return (
        <div className="player-game-screen">
            <div className="game-header">
                <span className="countdown">{countdown}</span>
                <span className="score">Score: {currentScore}</span>
            </div>

            <div className="question-display">
                <p className="question-text">{currentQuestion.questionText}</p>
                {currentQuestion.imageUrl && (
                    <img src={currentQuestion.imageUrl} alt="Question" className="question-image" />
                )}
            </div>

            <div className="answer-options-grid">
                {currentQuestion.answerOptions.map((option, index) => (
                    <button
                        key={option._id} // Use the unique _id from MongoDB for key
                        className="answer-option-button"
                        style={{ backgroundColor: optionColors[index % optionColors.length] }}
                        onClick={() => submitAnswer(option._id)}
                        disabled={hasAnswered || countdown <= 0} // Disable if answered or time is up
                    >
                        {option.text}
                    </button>
                ))}
            </div>

            {/* Display feedback overlay after answering */}
            {answerFeedback && (
                <div className={`feedback-overlay ${answerFeedback.isCorrect ? 'correct' : 'incorrect'}`}>
                    <h3>{answerFeedback.isCorrect ? 'Correct!' : 'Incorrect!'}</h3>
                    <p>{answerFeedback.pointsEarned} Points</p>
                </div>
            )}
        </div>
    );
}

export default PlayerGameScreen;