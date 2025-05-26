// controllers/authController.js
const supabase = require('../config/supabaseClient');

/**
 * POST /api/auth/register
 * body: { username, email, password, role? }
 */
exports.registerUser = async (req, res) => {
  const { username, email, password, role = 'quizMaster' } = req.body;

  // 1. Create the auth user (hashing handled by Supabase)
  const { data: signUpData, error: signUpErr } =
    await supabase.auth.signUp({ email, password });

  if (signUpErr) return res.status(400).json({ msg: signUpErr.message });

  const uid = signUpData.user.id;

  // 2. Insert extra fields into the public.profiles table
  const { error: profileErr } = await supabase.from('profiles').insert([
    { id: uid, username, role }
  ]);

  if (profileErr) {
    // roll back the auth user so you don’t orphan a record
    await supabase.auth.admin.deleteUser(uid);
    return res.status(400).json({ msg: profileErr.message });
  }

  return res.status(201).json({
    msg: 'Signup successful – check your email to confirm your account.'
  });
};

/**
 * POST /api/auth/login
 * body: { email, password }
 */
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  const { data, error } =
    await supabase.auth.signInWithPassword({ email, password });

  if (error) return res.status(400).json({ msg: error.message });

  // You can stick with Supabase’s JWT or wrap it as you like
  res.json({
    token: data.session.access_token,
    user: {
      id:   data.user.id,
      email: data.user.email
    }
  });
};
