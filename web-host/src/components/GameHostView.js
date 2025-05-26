import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io   from 'socket.io-client';
import api  from '../api';

// If you’ve set REACT_APP_BACKEND_URL in .env, use it; else fallback
const socket = io(process.env.REACT_APP_BACKEND_URL?.replace('/api', '') || 'http://localhost:5001');

function GameHostView({ userId }) {
  const { quizId }   = useParams();
  const navigate     = useNavigate();

  const [gamePin,  setGamePin]  = useState(null);
  const [quiz,     setQuiz]     = useState(null);
  const [players,  setPlayers]  = useState([]);
  const [status,   setStatus]   = useState('loading');  // loading | readyToCreate | lobby | inProgress | finished | error
  const [currentQuestion,       setCurrentQuestion]       = useState(null);
  const [currentQuestionIndex,  setCurrentQuestionIndex]  = useState(-1);
  const [questionCountdown,     setQuestionCountdown]     = useState(0);
  const countdownIntervalRef = useRef(null);
  const [answersReceived, setAnswersReceived] = useState([]);   // [{ nickname, isCorrect }]
  const [finalResults,    setFinalResults]    = useState([]);

  /* ───────────────────────────────────────────
     Load quiz + wire socket events
  ─────────────────────────────────────────── */
  useEffect(() => {
    if (!userId) {
      navigate('/login');
      return;
    }

    /* fetch quiz row (now via Supabase-backed Express route) */
    (async () => {
      try {
        const res = await api.get(`/quizzes/${quizId}`);
        setQuiz(res.data);
        setStatus('readyToCreate');
      } catch (err) {
        console.error('Error fetching quiz:', err);
        setStatus('error');
      }
    })();

    /* socket event handlers */
    socket.on('connect', () => console.log('Socket connected (Host)'));

    socket.on('gameCreated', ({ gamePin }) => {
      setGamePin(gamePin);
      setStatus('lobby');
    });

    socket.on('playerJoined', ({ players }) => setPlayers(players));

    socket.on('game:question', ({ questionIndex, questionText, imageUrl, answerOptions, timeLimit }) => {
      setCurrentQuestionIndex(questionIndex);
      setCurrentQuestion({ questionText, imageUrl, answerOptions });
      setQuestionCountdown(timeLimit);
      setAnswersReceived([]);
      setStatus('inProgress');

      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = setInterval(() => {
        setQuestionCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on('playerAnswered', ({ nickname, isCorrect, score, questionIndex }) => {
      if (questionIndex === currentQuestionIndex) {
        setAnswersReceived((prev) => [...prev, { nickname, isCorrect }]);
        setPlayers((prev) =>
          prev.map((p) => (p.nickname === nickname ? { ...p, score } : p))
        );
      }
    });

    socket.on('game:scoreUpdate', (updatedPlayers) =>
      setPlayers(updatedPlayers.sort((a, b) => b.score - a.score))
    );

    socket.on('game:endGame', (results) => {
      setStatus('finished');
      setFinalResults(results);
      clearInterval(countdownIntervalRef.current);
    });

    socket.on('gameError', (msg) => {
      alert(`Game Error: ${msg}`);
      setStatus('error');
      navigate('/dashboard');
    });

    socket.on('gameEndedUnexpectedly', (msg) => {
      alert(`Game Ended: ${msg}`);
      setStatus('error');
      navigate('/dashboard');
    });

    return () => {
      socket.off();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [quizId, userId, currentQuestionIndex, navigate]);

  /* ───────────────────────────────────────────
     Host actions
  ─────────────────────────────────────────── */
  const createGame = () => {
    if (quiz && userId) socket.emit('host:createGame', { quizId: quiz.id, hostId: userId });
  };

  const startGame  = () => gamePin && status === 'lobby'      && socket.emit('host:startGame',  gamePin);
  const nextQuestion = () => gamePin && status === 'inProgress' && socket.emit('host:nextQuestion', gamePin);

  /* ───────────────────────────────────────────
     Render
  ─────────────────────────────────────────── */
  if (status === 'loading')  return <p>Loading quiz…</p>;
  if (status === 'error')    return <p>Error — please try again.</p>;

  return (
    <div className="game-host-view">
      <h2>Host Game: {quiz?.title}</h2>

      {status === 'readyToCreate' && (
        <button onClick={createGame}>Create Game PIN</button>
      )}

      {gamePin && status === 'lobby' && (
        <div className="lobby-view">
          <h3>
            Game PIN:&nbsp;
            <span style={{ color: 'blue', fontSize: '2em' }}>{gamePin}</span>
          </h3>
          <h4>Players ({players.length}):</h4>
          <ul>{players.map((p) => <li key={p.nickname}>{p.nickname}</li>)}</ul>
          {players.length ? <button onClick={startGame}>Start Game</button> : <p>Waiting for players…</p>}
        </div>
      )}

      {status === 'inProgress' && currentQuestion && (
        <div className="game-in-progress">
          <h3>Question {currentQuestionIndex + 1} / {quiz.questions.length}</h3>
          <p style={{ fontSize: '2em' }}>{questionCountdown}s</p>
          <h4>{currentQuestion.questionText}</h4>
          {currentQuestion.imageUrl && <img src={currentQuestion.imageUrl} alt="Question" style={{ maxWidth: 300 }} />}
          <div className="host-answer-options">
            {quiz.questions[currentQuestionIndex].answerOptions.map((opt) => (
              <div key={opt._id} className={opt.isCorrect ? 'correct-option' : ''}>
                {opt.text} {opt.isCorrect && '(Correct)'}
              </div>
            ))}
          </div>

          <h4>Players Answered ({answersReceived.length} / {players.length}):</h4>
          <ul>
            {answersReceived.map((a, i) => (
              <li key={i} style={{ color: a.isCorrect ? 'green' : 'red' }}>
                {a.nickname} ({a.isCorrect ? 'Correct' : 'Incorrect'})
              </li>
            ))}
          </ul>

          <h4>Leaderboard</h4>
          <ol>{players.map((p) => <li key={p.socketId}>{p.nickname}: {p.score}</li>)}</ol>

          <button onClick={nextQuestion}>Next Question / End Game</button>
        </div>
      )}

      {status === 'finished' && finalResults.length > 0 && (
        <div className="game-finished-view">
          <h3>Game Over! Final Results</h3>
          <ol>{finalResults.map((r, i) => <li key={i}>{r.nickname}: {r.finalScore}</li>)}</ol>
          <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      )}
    </div>
  );
}

export default GameHostView;
