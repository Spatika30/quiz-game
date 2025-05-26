import React, { useState, useEffect } from 'react';
import api   from '../api';
import { Link } from 'react-router-dom';

function HostDashboard({ userId }) {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    async function fetchQuizzes() {
      try {
        setLoading(true);
        const res = await api.get('/quizzes');        // token auto-injected by api.js
        setQuizzes(res.data);
      } catch (err) {
        console.error('Error fetching quizzes:', err);
        setError('Failed to load quizzes.');
      } finally {
        setLoading(false);
      }
    }
    if (userId) fetchQuizzes();
  }, [userId]);

  if (loading) return <p>Loading quizzes…</p>;
  if (error)   return <p className="error-message">{error}</p>;

  return (
    <div className="host-dashboard-container">
      <h2>Your Quizzes</h2>

      {quizzes.length === 0 ? (
        <p>No quizzes yet. <Link to="/create-quiz">Create one!</Link></p>
      ) : (
        <div className="quiz-list">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="quiz-card">
              <h3>{quiz.title}</h3>
              {quiz.description && <p>{quiz.description}</p>}
              <p>Questions: {quiz.questions.length}</p>
              <Link to={`/host-game/${quiz.id}`}>Host Game</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HostDashboard;
