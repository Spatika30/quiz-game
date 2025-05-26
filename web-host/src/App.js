// src/App.js  (or web-host/App.js if that’s your path)
import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link
} from 'react-router-dom';

import { supabase } from './lib/supabase';

import Auth           from './components/Auth';
import QuizCreator    from './components/QuizCreator';
import HostDashboard  from './components/HostDashboard';
import GameHostView   from './components/GameHostView';

import PlayerJoinGame     from './components/PlayerJoinGame';
import PlayerGameScreen   from './components/PlayerGameScreen';
import PlayerResultsScreen from './components/PlayerResultsScreen';

import './App.css';

function App() {
  // a session contains the access token and user ID
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);     // { id, username, email }

  /* ───────────────────────────────────────────
     Load (or refresh) supabase session on mount
  ─────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSession(session);
        await fetchProfile(session.user.id);
      }
    })();

    // listen to future login / logout events
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) await fetchProfile(newSession.user.id);
      else            setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  /* ───────────────────────────────────────────
     helper: pull { username } from profiles
  ─────────────────────────────────────────── */
  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();

    if (!error) setProfile({ id: userId, email: session?.user.email, username: data.username });
  }

  /* ───────────────────────────────────────────
     callback passed to <Auth/> on success
  ─────────────────────────────────────────── */
  const handleAuthSuccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setSession(session);
      await fetchProfile(session.user.id);
    }
  };

  /* logout */
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  const loggedIn = Boolean(session);

  return (
    <Router>
      <div className="App">
        <nav>
          <h1>Kahoot Clone</h1>
          <div className="nav-links">
            {loggedIn ? (
              <>
                <span>Welcome, {profile?.username || profile?.email}!</span>
                <Link to="/dashboard">Dashboard</Link>
                <Link to="/create-quiz">Create Quiz</Link>
                <button onClick={handleLogout} className="nav-button">
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login">Login</Link>
                <Link to="/register">Register</Link>
              </>
            )}
            <Link to="/player-join" className="player-link">
              Join a Game (Player)
            </Link>
          </div>
        </nav>

        <div className="main-content">
          <Routes>
            {/* Auth */}
            <Route
              path="/login"
              element={<Auth type="login" onAuthSuccess={handleAuthSuccess} />}
            />
            <Route
              path="/register"
              element={<Auth type="register" onAuthSuccess={handleAuthSuccess} />}
            />

            {/* Host routes */}
            <Route
              path="/dashboard"
              element={
                loggedIn ? (
                  <HostDashboard userId={profile?.id} />
                ) : (
                  <p>Please login to view dashboard.</p>
                )
              }
            />
            <Route
              path="/create-quiz"
              element={
                loggedIn ? (
                  <QuizCreator />
                ) : (
                  <p>Please login to create quizzes.</p>
                )
              }
            />
            <Route
              path="/host-game/:quizId"
              element={
                loggedIn ? (
                  <GameHostView userId={profile?.id} />
                ) : (
                  <p>Please login to host games.</p>
                )
              }
            />

            {/* Player routes */}
            <Route path="/player-join"    element={<PlayerJoinGame />} />
            <Route path="/player-game"    element={<PlayerGameScreen />} />
            <Route path="/player-results" element={<PlayerResultsScreen />} />

            {/* Home */}
            <Route path="/" element={<h2>Welcome to Kahoot! Select an option from the navigation.</h2>} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
