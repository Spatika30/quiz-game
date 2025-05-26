// controllers/quizController.js
const supabase = require('../config/supabaseClient');

/**
 * POST /api/quizzes
 * body: { title, questions: [ { questionText, imageUrl, answerOptions, timeLimit }, ... ] }
 */
exports.createQuiz = async (req, res) => {
  const { title, questions } = req.body;

  const { data: quiz, error } = await supabase
    .from('quizzes')
    .insert([{ title, questions, owner_id: req.user.id }])
    .select()
    .single();

  if (error) return res.status(400).json({ msg: error.message });
  return res.status(201).json(quiz);
};

/**
 * GET /api/quizzes
 * Returns quizzes owned by the logged-in user.
 */
exports.getQuizzes = async (req, res) => {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('owner_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ msg: error.message });
  return res.json(data);
};

/**
 * GET /api/quizzes/:id
 * Returns a single quiz if the caller owns it.
 */
exports.getQuizById = async (req, res) => {
  const { id } = req.params;

  const { data: quiz, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return res.status(404).json({ msg: 'Quiz not found' });
  if (quiz.owner_id !== req.user.id)
    return res.status(403).json({ msg: 'Not your quiz' });

  return res.json(quiz);
};
