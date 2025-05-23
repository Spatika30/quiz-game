const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
    socketId: { // Current socket ID for real-time communication
        type: String,
        required: true,
    },
    nickname: {
        type: String,
        required: true,
    },
    score: {
        type: Number,
        default: 0,
    },
    // You could store answers submitted by player per question here
    // answers: [{ questionId: String, submittedOptionId: String, isCorrect: Boolean }]
});

const GameSessionSchema = new mongoose.Schema({
    quizId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz',
        required: true,
    },
    gamePin: { // Unique PIN for players to join
        type: String,
        required: true,
        unique: true,
    },
    hostId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: ['lobby', 'inProgress', 'finished'],
        default: 'lobby',
    },
    players: [PlayerSchema],
    currentQuestionIndex: {
        type: Number,
        default: -1, // -1 means game not started, 0 is first question
    },
    questionStartTime: { // To calculate time taken for answers
        type: Date,
    },
    results: [ // Simplified storage for final scores
        {
            nickname: String,
            finalScore: Number,
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('GameSession', GameSessionSchema);