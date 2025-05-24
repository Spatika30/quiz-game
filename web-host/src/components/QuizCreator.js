import React, { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import './QuizCreator.css'; // Import the CSS file

function QuizCreator() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [questions, setQuestions] = useState([
        {
            questionText: '',
            imageUrl: '',
            questionType: 'multiple-choice',
            answerOptions: [{ text: '', isCorrect: false }],
            trueFalseAnswer: false,
            blankAnswer: '',
            matchingPairs: [{ term: '', definition: '' }],
            timeLimit: 20
        },
    ]);
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleQuestionChange = (index, field, value) => {
        const newQuestions = [...questions];
        // Special handling for timeLimit to ensure it's a number
        if (field === 'timeLimit') {
            newQuestions[index][field] = parseInt(value) || 0;
        } else {
            newQuestions[index][field] = value;
        }
        setQuestions(newQuestions);
    };

    const handleAnswerOptionChange = (qIndex, aIndex, field, value) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].answerOptions[aIndex][field] = value;
        setQuestions(newQuestions);
    };

    const handleMatchingPairChange = (qIndex, pIndex, field, value) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].matchingPairs[pIndex][field] = value;
        setQuestions(newQuestions);
    };

    const addQuestion = () => {
        setQuestions([
            ...questions,
            {
                questionText: '',
                imageUrl: '',
                questionType: 'multiple-choice',
                answerOptions: [{ text: '', isCorrect: false }],
                trueFalseAnswer: false,
                blankAnswer: '',
                matchingPairs: [{ term: '', definition: '' }],
                timeLimit: 20
            },
        ]);
    };

    const removeQuestion = (indexToRemove) => {
        setQuestions(questions.filter((_, index) => index !== indexToRemove));
    };

    const addAnswerOption = (qIndex) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].answerOptions.push({ text: '', isCorrect: false });
        setQuestions(newQuestions);
    };

    const removeAnswerOption = (qIndex, aIndexToRemove) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].answerOptions = newQuestions[qIndex].answerOptions.filter((_, index) => index !== aIndexToRemove);
        setQuestions(newQuestions);
    };

    const addMatchingPair = (qIndex) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].matchingPairs.push({ term: '', definition: '' });
        setQuestions(newQuestions);
    };

    const removeMatchingPair = (qIndex, pIndexToRemove) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].matchingPairs = newQuestions[qIndex].matchingPairs.filter((_, index) => index !== pIndexToRemove);
        setQuestions(newQuestions);
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');

        // Basic validation for at least one correct answer for multiple-choice questions
        for (const q of questions) {
            if (!q.questionText.trim()) {
                setMessage('All questions must have text.');
                return;
            }
            if (q.questionType === 'multiple-choice') {
                if (q.answerOptions.length < 2) {
                    setMessage(`Question "${q.questionText}" (Multiple Choice) needs at least two answer options.`);
                    return;
                }
                const hasCorrectAnswer = q.answerOptions.some(option => option.isCorrect);
                if (!hasCorrectAnswer) {
                    setMessage(`Question "${q.questionText}" (Multiple Choice) must have at least one correct answer.`);
                    return;
                }
            } else if (q.questionType === 'true-false' && typeof q.trueFalseAnswer !== 'boolean') {
                setMessage(`Question "${q.questionText}" (True/False) must have a correct answer selected.`);
                return;
            } else if (q.questionType === 'fill-in-the-blank' && !q.blankAnswer.trim()) {
                setMessage(`Question "${q.questionText}" (Fill-in-the-Blank) must have a correct answer.`);
                return;
            } else if (q.questionType === 'match-the-following') {
                if (q.matchingPairs.length === 0 || q.matchingPairs.some(pair => !pair.term.trim() || !pair.definition.trim())) {
                    setMessage(`Question "${q.questionText}" (Match the Following) must have at least one complete matching pair.`);
                    return;
                }
            }
        }

        try {
            const res = await api.post('/quizzes', { title, description, questions });
            setMessage('Quiz created successfully!');
            navigate('/dashboard');
        } catch (err) {
            console.error(err.response?.data?.msg || err.message);
            setMessage('Failed to create quiz. Check console for details.');
        }
    };

    return (
        <div className="quiz-creator-container">
            <h2 className="form-title">Create New Quiz</h2>
            <form onSubmit={handleSubmit} className="quiz-form">
                <div className="form-group">
                    <label htmlFor="quizTitle">Quiz Title:</label>
                    <input
                        id="quizTitle"
                        type="text"
                        placeholder="e.g., General Knowledge Quiz"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="quizDescription">Description (Optional):</label>
                    <textarea
                        id="quizDescription"
                        placeholder="A short description of your quiz..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="form-textarea"
                    ></textarea>
                </div>

                {questions.map((q, qIndex) => (
                    <div key={qIndex} className="question-block">
                        <div className="question-header">
                            <h3>Question {qIndex + 1}</h3>
                            {questions.length > 1 && (
                                <button type="button" onClick={() => removeQuestion(qIndex)} className="btn-remove-question">
                                    Remove Question
                                </button>
                            )}
                        </div>

                        <div className="form-group">
                            <label htmlFor={`questionText-${qIndex}`}>Question Text:</label>
                            <input
                                id={`questionText-${qIndex}`}
                                type="text"
                                placeholder="Enter your question here"
                                value={q.questionText}
                                onChange={(e) => handleQuestionChange(qIndex, 'questionText', e.target.value)}
                                required
                                className="form-input"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor={`imageUrl-${qIndex}`}>Image URL (Optional):</label>
                            <input
                                id={`imageUrl-${qIndex}`}
                                type="text"
                                placeholder="Paste image URL (e.g., from Unsplash)"
                                value={q.imageUrl}
                                onChange={(e) => handleQuestionChange(qIndex, 'imageUrl', e.target.value)}
                                className="form-input"
                            />
                            {q.imageUrl && <img src={q.imageUrl} alt="Question Preview" className="image-preview" />}
                        </div>

                        <div className="form-group time-limit-group">
                            <label htmlFor={`timeLimit-${qIndex}`}>Time Limit (seconds):</label>
                            <input
                                id={`timeLimit-${qIndex}`}
                                type="number"
                                value={q.timeLimit}
                                onChange={(e) => handleQuestionChange(qIndex, 'timeLimit', e.target.value)}
                                min="5"
                                max="120"
                                required
                                className="form-input time-limit-input"
                            />
                        </div>

                        <div className="form-group question-type-selector">
                            <label htmlFor={`questionType-${qIndex}`}>Question Type:</label>
                            <select
                                id={`questionType-${qIndex}`}
                                value={q.questionType}
                                onChange={(e) => handleQuestionChange(qIndex, 'questionType', e.target.value)}
                                className="form-select"
                            >
                                <option value="multiple-choice">Multiple Choice</option>
                                <option value="true-false">True/False</option>
                                <option value="fill-in-the-blank">Fill-in-the-Blank</option>
                                <option value="match-the-following">Match the Following</option>
                            </select>
                        </div>

                        {q.questionType === 'multiple-choice' && (
                            <div className="answer-options-section">
                                <h4>Answer Options:</h4>
                                {q.answerOptions.map((a, aIndex) => (
                                    <div key={aIndex} className="answer-option-item">
                                        <input
                                            type="text"
                                            placeholder={`Option ${aIndex + 1} Text`}
                                            value={a.text}
                                            onChange={(e) => handleAnswerOptionChange(qIndex, aIndex, 'text', e.target.value)}
                                            required
                                            className="form-input"
                                        />
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={a.isCorrect}
                                                onChange={(e) => handleAnswerOptionChange(qIndex, aIndex, 'isCorrect', e.target.checked)}
                                            />
                                            Correct
                                        </label>
                                        {q.answerOptions.length > 1 && (
                                            <button type="button" onClick={() => removeAnswerOption(qIndex, aIndex)} className="btn-remove-option">
                                                &times;
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button type="button" onClick={() => addAnswerOption(qIndex)} className="btn-secondary">
                                    Add Answer Option
                                </button>
                            </div>
                        )}

                        {q.questionType === 'true-false' && (
                            <div className="true-false-options-section">
                                <h4>Correct Answer:</h4>
                                <div className="radio-group">
                                    <label>
                                        <input
                                            type="radio"
                                            name={`trueFalse-${qIndex}`}
                                            value="true"
                                            checked={q.trueFalseAnswer === true}
                                            onChange={() => handleQuestionChange(qIndex, 'trueFalseAnswer', true)}
                                        />
                                        True
                                    </label>
                                    <label>
                                        <input
                                            type="radio"
                                            name={`trueFalse-${qIndex}`}
                                            value="false"
                                            checked={q.trueFalseAnswer === false}
                                            onChange={() => handleQuestionChange(qIndex, 'trueFalseAnswer', false)}
                                        />
                                        False
                                    </label>
                                </div>
                            </div>
                        )}

                        {q.questionType === 'fill-in-the-blank' && (
                            <div className="fill-in-the-blank-section">
                                <h4>Correct Answer:</h4>
                                <input
                                    type="text"
                                    placeholder="Enter the correct word or phrase"
                                    value={q.blankAnswer}
                                    onChange={(e) => handleQuestionChange(qIndex, 'blankAnswer', e.target.value)}
                                    required
                                    className="form-input"
                                />
                            </div>
                        )}

                        {q.questionType === 'match-the-following' && (
                            <div className="matching-pairs-section">
                                <h4>Matching Pairs:</h4>
                                {q.matchingPairs.map((pair, pIndex) => (
                                    <div key={pIndex} className="matching-pair-item">
                                        <input
                                            type="text"
                                            placeholder="Term"
                                            value={pair.term}
                                            onChange={(e) => handleMatchingPairChange(qIndex, pIndex, 'term', e.target.value)}
                                            required
                                            className="form-input"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Definition"
                                            value={pair.definition}
                                            onChange={(e) => handleMatchingPairChange(qIndex, pIndex, 'definition', e.target.value)}
                                            required
                                            className="form-input"
                                        />
                                        {q.matchingPairs.length > 1 && (
                                            <button type="button" onClick={() => removeMatchingPair(qIndex, pIndex)} className="btn-remove-option">
                                                &times;
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button type="button" onClick={() => addMatchingPair(qIndex)} className="btn-secondary">
                                    Add Matching Pair
                                </button>
                            </div>
                        )}
                    </div>
                ))}

                <button type="button" onClick={addQuestion} className="btn-primary add-question-btn">
                    Add New Question
                </button>
                <button type="submit" className="btn-submit">Create Quiz</button>
            </form>
            {message && <p className={`form-message ${message.includes('successfully') ? 'success' : 'error'}`}>{message}</p>}
        </div>
    );
}

export default QuizCreator;
