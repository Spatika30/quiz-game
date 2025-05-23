import React, { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

function QuizCreator() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [questions, setQuestions] = useState([
        { questionText: '', imageUrl: '', answerOptions: [{ text: '', isCorrect: false }], timeLimit: 20 },
    ]);
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleQuestionChange = (index, field, value) => {
        const newQuestions = [...questions];
        newQuestions[index][field] = value;
        setQuestions(newQuestions);
    };

    const handleAnswerOptionChange = (qIndex, aIndex, field, value) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].answerOptions[aIndex][field] = value;
        setQuestions(newQuestions);
    };

    const addQuestion = () => {
        setQuestions([...questions, { questionText: '', imageUrl: '', answerOptions: [{ text: '', isCorrect: false }], timeLimit: 20 }]);
    };

    const addAnswerOption = (qIndex) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].answerOptions.push({ text: '', isCorrect: false });
        setQuestions(newQuestions);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        try {
            const res = await api.post('/quizzes', { title, description, questions });
            setMessage('Quiz created successfully!');
            navigate('/dashboard'); // Go to dashboard after creating
        } catch (err) {
            console.error(err.response?.data?.msg || err.message);
            setMessage('Failed to create quiz.');
        }
    };

    return (
        <div className="quiz-creator-container">
            <h2>Create New Quiz</h2>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="Quiz Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                />
                <textarea
                    placeholder="Quiz Description (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                ></textarea>

                {questions.map((q, qIndex) => (
                    <div key={qIndex} className="question-block">
                        <h3>Question {qIndex + 1}</h3>
                        <input
                            type="text"
                            placeholder="Question Text"
                            value={q.questionText}
                            onChange={(e) => handleQuestionChange(qIndex, 'questionText', e.target.value)}
                            required
                        />
                        <input
                            type="text"
                            placeholder="Image URL (Optional)"
                            value={q.imageUrl}
                            onChange={(e) => handleQuestionChange(qIndex, 'imageUrl', e.target.value)}
                        />
                        <label>Time Limit (seconds): </label>
                        <input
                            type="number"
                            value={q.timeLimit}
                            onChange={(e) => handleQuestionChange(qIndex, 'timeLimit', parseInt(e.target.value) || 0)}
                            min="5"
                            max="120"
                            required
                        />

                        <h4>Answer Options:</h4>
                        {q.answerOptions.map((a, aIndex) => (
                            <div key={aIndex} className="answer-option">
                                <input
                                    type="text"
                                    placeholder={`Option ${aIndex + 1} Text`}
                                    value={a.text}
                                    onChange={(e) => handleAnswerOptionChange(qIndex, aIndex, 'text', e.target.value)}
                                    required
                                />
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={a.isCorrect}
                                        onChange={(e) => handleAnswerOptionChange(qIndex, aIndex, 'isCorrect', e.target.checked)}
                                    />
                                    Correct Answer
                                </label>
                            </div>
                        ))}
                        <button type="button" onClick={() => addAnswerOption(qIndex)}>
                            Add Answer Option
                        </button>
                    </div>
                ))}
                <button type="button" onClick={addQuestion}>
                    Add New Question
                </button>
                <button type="submit">Create Quiz</button>
            </form>
            {message && <p>{message}</p>}
        </div>
    );
}

export default QuizCreator;