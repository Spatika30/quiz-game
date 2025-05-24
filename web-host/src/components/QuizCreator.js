import React, { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

function QuizCreator() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [questions, setQuestions] = useState([
        {
            questionText: '',
            imageUrl: '',
            questionType: 'multiple-choice', // Default to multiple-choice
            answerOptions: [{ text: '', isCorrect: false }],
            trueFalseAnswer: false, // For True/False
            blankAnswer: '', // For Fill-in-the-Blank
            matchingPairs: [{ term: '', definition: '' }], // For Match the Following
            timeLimit: 20
        },
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
                questionType: 'multiple-choice', // Default new questions to multiple-choice
                answerOptions: [{ text: '', isCorrect: false }],
                trueFalseAnswer: false,
                blankAnswer: '',
                matchingPairs: [{ term: '', definition: '' }],
                timeLimit: 20
            },
        ]);
    };

    const addAnswerOption = (qIndex) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].answerOptions.push({ text: '', isCorrect: false });
        setQuestions(newQuestions);
    };

    const addMatchingPair = (qIndex) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].matchingPairs.push({ term: '', definition: '' });
        setQuestions(newQuestions);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');

        // Basic validation for at least one correct answer for multiple-choice questions
        for (const q of questions) {
            if (q.questionType === 'multiple-choice') {
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

                        <div className="question-type-selector">
                            <label>Question Type: </label>
                            <select
                                value={q.questionType}
                                onChange={(e) => handleQuestionChange(qIndex, 'questionType', e.target.value)}
                            >
                                <option value="multiple-choice">Multiple Choice</option>
                                <option value="true-false">True/False</option>
                                <option value="fill-in-the-blank">Fill-in-the-Blank</option>
                                <option value="match-the-following">Match the Following</option>
                            </select>
                        </div>

                        {q.questionType === 'multiple-choice' && (
                            <>
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
                            </>
                        )}

                        {q.questionType === 'true-false' && (
                            <div className="true-false-options">
                                <h4>Correct Answer:</h4>
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
                        )}

                        {q.questionType === 'fill-in-the-blank' && (
                            <div className="fill-in-the-blank-options">
                                <h4>Correct Answer:</h4>
                                <input
                                    type="text"
                                    placeholder="Enter the correct word or phrase"
                                    value={q.blankAnswer}
                                    onChange={(e) => handleQuestionChange(qIndex, 'blankAnswer', e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        {q.questionType === 'match-the-following' && (
                            <div className="match-the-following-options">
                                <h4>Matching Pairs:</h4>
                                {q.matchingPairs.map((pair, pIndex) => (
                                    <div key={pIndex} className="matching-pair">
                                        <input
                                            type="text"
                                            placeholder="Term"
                                            value={pair.term}
                                            onChange={(e) => handleMatchingPairChange(qIndex, pIndex, 'term', e.target.value)}
                                            required
                                        />
                                        <input
                                            type="text"
                                            placeholder="Definition"
                                            value={pair.definition}
                                            onChange={(e) => handleMatchingPairChange(qIndex, pIndex, 'definition', e.target.value)}
                                            required
                                        />
                                    </div>
                                ))}
                                <button type="button" onClick={() => addMatchingPair(qIndex)}>
                                    Add Matching Pair
                                </button>
                            </div>
                        )}
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
