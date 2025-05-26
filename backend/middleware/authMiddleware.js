// middleware/authMiddleware.js
const supabase = require('../config/supabaseClient');

module.exports = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.split(' ')[1];               // "Bearer <jwt>"
    if (!token) return res.status(401).json({ msg: 'No auth token' });

    // Let Supabase decode & validate the JWT
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) return res.status(401).json({ msg: 'Invalid token' });

    req.user = user;                                // make uid/e-mail available
    return next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ msg: 'Auth failure' });
  }
};
