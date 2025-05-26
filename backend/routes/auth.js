const express = require('express');
const router  = express.Router();
const supabase = require('../config/supabaseClient');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, username, role = 'quizMaster' } = req.body;

  // 1. create user in Supabase Auth
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email,
    password
  });

  if (signUpErr) return res.status(400).json({ error: signUpErr.message });

  const uid = signUpData.user.id;

  // 2. insert into profiles
  const { error: profileErr } = await supabase.from('profiles').insert([
    { id: uid, username, role }
  ]);

  if (profileErr) {
    // rollback auth user to keep things consistent
    await supabase.auth.admin.deleteUser(uid);
    return res.status(400).json({ error: profileErr.message });
  }

  res.json({ message: 'Signup successful! Check your email to confirm.' });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const { data, error } =
    await supabase.auth.signInWithPassword({ email, password });

  if (error) return res.status(401).json({ error: error.message });

  // Return Supabase-issued access & refresh tokens to client
  res.json({
    access_token:  data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in:    data.session.expires_in,
    user:          data.user
  });
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const { refresh_token } = req.body;               // send from client
  await supabase.auth.signOut({ refreshToken: refresh_token });
  res.json({ message: 'Logged out' });
});

module.exports = router;
