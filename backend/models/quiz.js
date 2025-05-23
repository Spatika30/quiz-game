const mongoose = require('mongoose');

const QuizSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    questions: [
        {
            questionText: {
                type: String,
                required: true,
                trim: true,
            },
            imageUrl: { // Optional image for question
                type: String,
            },
            answerOptions: [
                {
                    text: {
                        type: String,
                        required: true,
                        trim: true,
                    },
                    isCorrect: {
                        type: Boolean,
                        required: true,
                        default: false,
                    },
                },
            ],
            timeLimit: { // Time in seconds
                type: Number,
                default: 20,
            },
        },
    ],
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Quiz', QuizSchema);