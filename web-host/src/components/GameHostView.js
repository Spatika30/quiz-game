import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // ADD useNavigate here
import io from 'socket.io-client';
import api from '../api';

const socket = io('http://localhost:5001'); // Connect to your backend socket

function GameHostView({ userId }) {
    const { quizId } = useParams();
    const navigate = useNavigate(); // Initialize useNavigate hook here
    const [gamePin, setGamePin] = useState(null);
    const [quiz, setQuiz] = useState(null);
    const [players, setPlayers] = useState([]);
    const [status, setStatus] = useState('loading'); // loading, lobby, inProgress, finished
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
    const [questionCountdown, setQuestionCountdown] = useState(0);
    const countdownIntervalRef = useRef(null);
    const [answersReceived, setAnswersReceived] = useState([]); // To track who answered what
    const [finalResults, setFinalResults] = useState([]);

    useEffect(() => {
        if (!userId) {
            // If user is not logged in, navigate to login or home
            navigate('/login'); // Or navigate('/')
            return;
        }

        const fetchQuiz = async () => {
            try {
                const res = await api.get(`/quizzes/${quizId}`);
                setQuiz(res.data);
                setStatus('readyToCreate');
            } catch (err) {
                console.error('Error fetching quiz:', err);
                setStatus('error');
            }
        };
        fetchQuiz();

        // Socket listeners
        socket.on('connect', () => {
            console.log('Connected to socket server (Host)');
        });

        socket.on('gameCreated', ({ gamePin, quizTitle }) => {
            setGamePin(gamePin);
            setStatus('lobby');
            console.log(`Game ${gamePin} created for quiz: ${quizTitle}`);
        });

        socket.on('playerJoined', ({ players }) => {
            setPlayers(players);
            console.log('Players in lobby:', players);
        });

        socket.on('game:question', ({ questionIndex, questionText, imageUrl, answerOptions, timeLimit }) => {
            setCurrentQuestionIndex(questionIndex);
            setCurrentQuestion({ questionText, imageUrl, answerOptions });
            setQuestionCountdown(timeLimit);
            setAnswersReceived([]); // Reset answers for new question
            setStatus('inProgress');

            // Start countdown
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = setInterval(() => {
                setQuestionCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(countdownIntervalRef.current);
                        // Optional: automatically move to next question if host doesn't click
                        // setTimeout(() => socket.emit('host:nextQuestion', gamePin), 2000);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        });

        socket.on('playerAnswered', ({ nickname, isCorrect, score, questionIndex }) => {
            if (questionIndex === currentQuestionIndex) { // Ensure it's for the current question
                setAnswersReceived(prev => [...prev, { nickname, isCorrect }]);
                setPlayers(prevPlayers => prevPlayers.map(p =>
                    p.nickname === nickname ? { ...p, score: score } : p
                ));
            }
        });

        socket.on('game:scoreUpdate', (updatedPlayers) => {
            setPlayers(updatedPlayers.sort((a, b) => b.score - a.score)); // Sort for leaderboard
        });

        socket.on('game:endGame', (results) => {
            setStatus('finished');
            setFinalResults(results);
            clearInterval(countdownIntervalRef.current);
            console.log('Game ended. Final Results:', results);
        });

        socket.on('gameError', (msg) => {
            console.error('Game Error:', msg);
            alert(`Game Error: ${msg}`);
            // Potentially reset game state or navigate away
            setStatus('error');
            // If the user isn't logged in, navigating away is a good idea
            navigate('/dashboard'); // Or back to login
        });

        socket.on('gameEndedUnexpectedly', (msg) => {
            alert(`Game Ended: ${msg}`);
            setGamePin(null);
            setQuiz(null);
            setPlayers([]);
            setStatus('error');
            setCurrentQuestion(null);
            setCurrentQuestionIndex(-1);
            clearInterval(countdownIntervalRef.current);
            navigate('/dashboard'); // Go back to dashboard on unexpected end
        });

        return () => {
            socket.off('connect');
            socket.off('gameCreated');
            socket.off('playerJoined');
            socket.off('game:question');
            socket.off('playerAnswered');
            socket.off('game:scoreUpdate');
            socket.off('game:endGame');
            socket.off('gameError');
            socket.off('gameEndedUnexpectedly');
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        };
    }, [quizId, userId, currentQuestionIndex, navigate]); // Add navigate to dependencies

    const createGame = () => {
        if (quiz && userId) {
            socket.emit('host:createGame', { quizId: quiz._id, hostId: userId });
        } else {
            alert('Quiz data or user ID missing.');
        }
    };

    const startGame = () => {
        if (gamePin && status === 'lobby') {
            socket.emit('host:startGame', gamePin);
        }
    };

    const nextQuestion = () => {
        if (gamePin && status === 'inProgress') {
            socket.emit('host:nextQuestion', gamePin);
        }
    };

    if (status === 'loading') {
        return <p>Loading quiz data...</p>;
    }
    if (status === 'error') {
        return <p>Error loading or starting game. Please try again.</p>;
    }

    return (
        <div className="game-host-view">
            <h2>Host Game: {quiz?.title}</h2>

            {status === 'readyToCreate' && (
                <button onClick={createGame}>Create Game PIN</button>
            )}

            {gamePin && status === 'lobby' && (
                <div className="lobby-view">
                    <h3>Game PIN: <span style={{ color: 'blue', fontSize: '2em' }}>{gamePin}</span></h3>
                    <p>Players join at your app with this PIN.</p>
                    <h4>Players in Lobby ({players.length}):</h4>
                    <ul>
                        {players.map((p, index) => (
                            <li key={index}>{p.nickname}</li>
                        ))}
                    </ul>
                    {players.length > 0 ? (
                        <button onClick={startGame}>Start Game</button>
                    ) : (
                        <p>Waiting for players...</p>
                    )}
                </div>
            )}

            {status === 'inProgress' && currentQuestion && (
                <div className="game-in-progress">
                    <h3>Question {currentQuestionIndex + 1} / {quiz.questions.length}</h3>
                    <p style={{ fontSize: '2em' }}>{questionCountdown}s</p>
                    <h4>{currentQuestion.questionText}</h4>
                    {currentQuestion.imageUrl && <img src={currentQuestion.imageUrl} alt="Question" style={{ maxWidth: '300px' }} />}
                    <div className="host-answer-options">
                        {/* Host typically sees the correct answer or summary of answers received */}
                        {quiz.questions[currentQuestionIndex].answerOptions.map((option, index) => (
                            <div key={option._id} className={option.isCorrect ? 'correct-option' : ''}>
                                {option.text} {option.isCorrect && '(Correct)'}
                            </div>
                        ))}
                    </div>

                    <h4>Players Answered ({answersReceived.length} / {players.length}):</h4>
                    <ul>
                        {answersReceived.map((ans, idx) => (
                            <li key={idx} style={{ color: ans.isCorrect ? 'green' : 'red' }}>
                                {ans.nickname} ({ans.isCorrect ? 'Correct' : 'Incorrect'})
                            </li>
                        ))}
                    </ul>

                    <h4>Live Leaderboard:</h4>
                    <ol>
                        {players.map((p) => (
                            <li key={p.socketId}>{p.nickname}: {p.score}</li>
                        ))}
                    </ol>

                    <button onClick={nextQuestion}>Next Question / End Game</button>
                </div>
            )}

            {status === 'finished' && finalResults.length > 0 && (
                <div className="game-finished-view">
                    <h3>Game Over! Final Leaderboard</h3>
                    <ol>
                        {finalResults.map((result, index) => (
                            <li key={index}>
                                {result.nickname}: {result.finalScore} points
                            </li>
                        ))}
                    </ol>
                    <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
                </div>
            )}
        </div>
    );
}

export default GameHostView;