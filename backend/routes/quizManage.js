// routes/quizManage.js
const express = require('express');
const router  = express.Router();

const auth = require('../middleware/authMiddleware');      // new middleware
const {
  createQuiz,
  getQuizzes,
  getQuizById
} = require('../controllers/quizController');

router.post('/',   auth, createQuiz);
router.get('/',    auth, getQuizzes);
router.get('/:id', auth, getQuizById);

module.exports = router;
