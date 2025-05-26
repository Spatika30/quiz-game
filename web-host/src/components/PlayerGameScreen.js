import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

/* Use env var or fallback to localhost */
const socket = io(
  (process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001/api').replace('/api', '')
);

function PlayerGameScreen() {
  const { state } = useLocation();
  const navigate  = useNavigate();

  const { gamePin, nickname, quizTitle } = state || {};

  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [countdown,       setCountdown]       = useState(0);
  const [hasAnswered,     setHasAnswered]     = useState(false);
  const [answerFeedback,  setAnswerFeedback]  = useState(null);
  const [currentScore,    setCurrentScore]    = useState(0);

  const countdownIntervalRef = useRef(null);

  const optionColors = ['#E44A59', '#3D4A9B', '#489B3D', '#B58E00'];

  /* ───────────────────────────────────────────
     Lifecycle + socket listeners
  ─────────────────────────────────────────── */
  useEffect(() => {
    if (!gamePin || !nickname) {
      navigate('/player-join');
      return;
    }

    socket.on('game:question', (q) => {
      setCurrentQuestion(q);
      setCountdown(q.timeLimit);
      setHasAnswered(false);
      setAnswerFeedback(null);

      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            if (!hasAnswered) setAnswerFeedback({ isCorrect: false, pointsEarned: 0, currentScore });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on('answerResult', ({ isCorrect, pointsEarned, currentScore: newScore }) => {
      setAnswerFeedback({ isCorrect, pointsEarned, currentScore: newScore });
      setCurrentScore(newScore);
      clearInterval(countdownIntervalRef.current);
    });

    socket.on('game:endGame', (results) => {
      clearInterval(countdownIntervalRef.current);
      navigate('/player-results', { state: { finalResults: results, nickname, finalScore: currentScore } });
    });

    socket.on('gameError',             () => navigate('/player-join'));
    socket.on('gameEndedUnexpectedly', () => navigate('/player-join'));

    return () => {
      clearInterval(countdownIntervalRef.current);
      socket.off();
    };
  }, [gamePin, nickname, navigate, currentScore, hasAnswered]);

  /* ───────────────────────────────────────────
     Submit answer
  ─────────────────────────────────────────── */
  const submitAnswer = (optionId) => {
    if (hasAnswered || countdown <= 0) return;
    setHasAnswered(true);

    socket.emit('player:submitAnswer', {
      gamePin,
      questionIndex: currentQuestion.questionIndex,
      selectedOptionId: optionId
    });

    clearInterval(countdownIntervalRef.current);
  };

  /* ───────────────────────────────────────────
     Render
  ─────────────────────────────────────────── */
  if (!currentQuestion) {
    return (
      <div className="player-waiting-screen">
        <h2>Joined Game: {quizTitle}</h2>
        <p>PIN: {gamePin}</p>
        <p>Nickname: {nickname}</p>
        <p>Waiting for host…</p>
        <p className="current-score">Score: {currentScore}</p>
      </div>
    );
  }

  return (
    <div className="player-game-screen">
      <div className="game-header">
        <span className="countdown">{countdown}</span>
        <span className="score">Score: {currentScore}</span>
      </div>

      <div className="question-display">
        <p className="question-text">{currentQuestion.questionText}</p>
        {currentQuestion.imageUrl && <img src={currentQuestion.imageUrl} alt="Question" className="question-image" />}
      </div>

      <div className="answer-options-grid">
        {currentQuestion.answerOptions.map((opt, i) => (
          <button
            key={opt.id || opt._id}                     
            className="answer-option-button"
            style={{ backgroundColor: optionColors[i % optionColors.length] }}
            onClick={() => submitAnswer(opt.id || opt._id)}
            disabled={hasAnswered || countdown <= 0}
          >
            {opt.text}
          </button>
        ))}
      </div>

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
