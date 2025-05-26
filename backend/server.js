// backend/server.js
const express  = require('express');
const http     = require('http');
const socketIo = require('socket.io');
const cors     = require('cors');
require('dotenv').config();

// Supabase client (replaces connectDB & Mongoose)
const supabase = require('./config/supabaseClient');

const app    = express();
const server = http.createServer(app);
const io     = socketIo(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:19006'],
    methods: ['GET', 'POST']
  }
});

// ──────────────────────────────────────────────
// Middleware & REST routes
// ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

app.use('/api/auth',   require('./routes/auth'));       // already converted
app.use('/api/quizzes', require('./routes/quizManage')); // convert later

// ──────────────────────────────────────────────
// In-memory game state (same as before)
// ──────────────────────────────────────────────
const activeGames = {};   // { gamePin: { … } }

// Helper: fetch quiz from Supabase
async function fetchQuizById (quizId) {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .single();
  if (error) throw error;
  return data;
}

// Helper: does a gamePin already exist?
async function gamePinExists (pin) {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('id')
    .eq('game_pin', pin)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

// Helper: create a game_sessions row
async function createGameSession ({ quizId, hostId, gamePin }) {
  const { data, error } = await supabase.from('game_sessions').insert([{
    quiz_id: quizId,
    host_id: hostId,
    game_pin: gamePin,
    status: 'lobby'
  }]).select().single();
  if (error) throw error;
  return data;           // contains id, etc.
}

// Helper: finish (update) game session
async function finishGameSession (sessionId, finalResults) {
  await supabase
    .from('game_sessions')
    .update({ status: 'finished', results: finalResults })
    .eq('id', sessionId);
}

// ──────────────────────────────────────────────
// Socket.IO logic  (unchanged except DB calls)
// ──────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // ---------- HOST EVENTS ----------
  socket.on('host:createGame', async ({ quizId, hostId }) => {
    try {
      // 1) Load the quiz from Supabase
      const quiz = await fetchQuizById(quizId);

      // 2) Generate a unique 6-digit PIN that’s not in DB
      let gamePin, exists;
      do {
        gamePin = Math.floor(100000 + Math.random() * 900000).toString();
        exists  = await gamePinExists(gamePin);
      } while (exists);

      // 3) Persist session to DB
      const newSession = await createGameSession({ quizId, hostId, gamePin });

      // 4) Cache in memory
      activeGames[gamePin] = {
        quiz,
        hostId,
        hostSocketId: socket.id,
        players: [],
        currentQuestionIndex: -1,
        gameSessionId: newSession.id,
        status: 'lobby'
      };

      socket.join(gamePin);
      socket.emit('gameCreated', { gamePin, quizTitle: quiz.title });
      console.log(`Game created with PIN: ${gamePin} by host ${hostId}`);
    } catch (err) {
      console.error('Error creating game:', err);
      socket.emit('gameError', err.message || 'Failed to create game.');
    }
  });

  socket.on('host:startGame', (gamePin) => {
    const game = activeGames[gamePin];
    if (game && game.hostSocketId === socket.id && game.status === 'lobby') {
      game.status = 'inProgress';
      game.currentQuestionIndex = 0;
      game.questionStartTime = Date.now();

      const currentQ = game.quiz.questions[0];
      io.to(gamePin).emit('game:question', {
        questionIndex: 0,
        questionText: currentQ.questionText,
        imageUrl: currentQ.imageUrl,
        answerOptions: currentQ.answerOptions.map(o => ({ text: o.text, _id: o._id })),
        timeLimit: currentQ.timeLimit
      });
    } else socket.emit('gameError', 'Cannot start game or not authorized.');
  });

  socket.on('host:nextQuestion', async (gamePin) => {
    const game = activeGames[gamePin];
    if (!game || game.hostSocketId !== socket.id || game.status !== 'inProgress')
      return socket.emit('gameError', 'Cannot move to next question or not authorized.');

    game.currentQuestionIndex += 1;

    if (game.currentQuestionIndex < game.quiz.questions.length) {
      game.questionStartTime = Date.now();
      const currentQ = game.quiz.questions[game.currentQuestionIndex];
      io.to(gamePin).emit('game:question', {
        questionIndex: game.currentQuestionIndex,
        questionText: currentQ.questionText,
        imageUrl: currentQ.imageUrl,
        answerOptions: currentQ.answerOptions.map(o => ({ text: o.text, _id: o._id })),
        timeLimit: currentQ.timeLimit
      });
    } else {
      // End of quiz
      game.status = 'finished';
      const finalResults = game.players
        .sort((a, b) => b.score - a.score)
        .map(p => ({ nickname: p.nickname, finalScore: p.score }));

      await finishGameSession(game.gameSessionId, finalResults);

      io.to(gamePin).emit('game:endGame', finalResults);
      console.log(`Game ${gamePin} finished.`);
      delete activeGames[gamePin];
    }
  });

  // ---------- PLAYER EVENTS ----------
  socket.on('player:joinGame', ({ gamePin, nickname }) => {
    const game = activeGames[gamePin];
    if (!game || game.status !== 'lobby')
      return socket.emit('joinError', 'Game not found or not in lobby.');

    if (game.players.some(p => p.nickname === nickname))
      return socket.emit('joinError', 'Nickname already taken.');

    const player = { socketId: socket.id, nickname, score: 0 };
    game.players.push(player);
    socket.join(gamePin);

    socket.emit('joinedGame', { gamePin, nickname, quizTitle: game.quiz.title });
    io.to(game.hostSocketId).emit('playerJoined',
      { players: game.players.map(p => ({ nickname: p.nickname, score: p.score })) });
  });

  socket.on('player:submitAnswer', ({ gamePin, questionIndex, selectedOptionId }) => {
    const game = activeGames[gamePin];
    if (!game || game.status !== 'inProgress' || game.currentQuestionIndex !== questionIndex)
      return socket.emit('gameError', 'Invalid game state for answering.');

    const player = game.players.find(p => p.socketId === socket.id);
    if (!player) return;

    const currentQ     = game.quiz.questions[questionIndex];
    const selectedOpt  = currentQ.answerOptions.find(o => o._id.toString() === selectedOptionId);

    let isCorrect = false, pointsEarned = 0;
    if (selectedOpt?.isCorrect) {
      isCorrect = true;
      const timeTaken = (Date.now() - game.questionStartTime) / 1000;
      const maxPoints = 1000, pps = maxPoints / currentQ.timeLimit;
      pointsEarned    = Math.max(0, Math.floor(maxPoints - timeTaken * pps));
      player.score   += pointsEarned;
    }

    socket.emit('answerResult', { isCorrect, pointsEarned, currentScore: player.score });
    io.to(game.hostSocketId).emit('playerAnswered', {
      nickname: player.nickname, isCorrect, score: player.score, questionIndex
    });
    io.to(gamePin).emit('game:scoreUpdate',
      game.players.map(p => ({ nickname: p.nickname, score: p.score })));
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // Same cleanup logic as before …
    for (const gamePin in activeGames) {
      const game = activeGames[gamePin];
      if (game.hostSocketId === socket.id) {
        io.to(gamePin).emit('gameEndedUnexpectedly', 'Host disconnected.');
        delete activeGames[gamePin];
        break;
      }
      const idx = game.players.findIndex(p => p.socketId === socket.id);
      if (idx !== -1) {
        const [left] = game.players.splice(idx, 1);
        io.to(game.hostSocketId).emit('playerLeft',
          { players: game.players.map(p => ({ nickname: p.nickname, score: p.score })) });
        break;
      }
    }
  });
});

// ──────────────────────────────────────────────
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server on :${PORT}`));
