// backend/config/supabaseClient.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY   // use ANON_KEY only in browser code
);

module.exports = supabase;
