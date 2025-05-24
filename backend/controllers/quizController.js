const Quiz = require('../models/quiz');

exports.createQuiz = async (req, res) => {
    const { title, description, questions } = req.body;
    try {
        const newQuiz = new Quiz({
            title,
            description,
            questions,
            creator: req.user.id, // From auth middleware
        });
        const quiz = await newQuiz.save();
        res.status(201).json(quiz);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.getQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ creator: req.user.id }).sort({ createdAt: -1 });
        res.json(quizzes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.getQuizById = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }
        // Optional: Add authorization check if only creator can view their quiz details
        if (quiz.creator.toString() !== req.user.id) {
             return res.status(403).json({ msg: 'Not authorized to view this quiz' });
        }
        res.json(quiz);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Quiz not found' });
        }
        res.status(500).send('Server Error');
    }
};

// ... add updateQuiz, deleteQuiz as needed