const express = require('express');
const http = require('http'); // Required for Socket.IO
const socketIo = require('socket.io');
const connectDB = require('./config/db');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app); // Create HTTP server with express app
const io = socketIo(server, {
    cors: {
        origin: ["http://localhost:3000", "http://localhost:19006"], // React and React Native dev servers
        methods: ["GET", "POST"]
    }
});

// Connect Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json()); // Body parser

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/quizzes', require('./routes/quizManage'));

// Temporary in-memory game states (for simplicity in this example)
// In a real app, this would be more robustly managed with GameSession model and DB queries
const activeGames = {}; // { gamePin: { quiz: {}, hostSocketId: '', players: [{ socketId: '', nickname: '', score: 0 }], currentQuestionIndex: -1 } }

// Socket.IO Logic
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // --- Host Events ---
    socket.on('host:createGame', async ({ quizId, hostId }) => {
        try {
            const Quiz = require('./models/quiz'); // Require inside to avoid circular dependency
            const GameSession = require('./models/GameSession');

            const quiz = await Quiz.findById(quizId);
            if (!quiz) {
                socket.emit('gameError', 'Quiz not found.');
                return;
            }

            let gamePin;
            let existingGame;
            do {
                // Generate a 6-digit random PIN
                gamePin = Math.floor(100000 + Math.random() * 900000).toString();
                existingGame = await GameSession.findOne({ gamePin });
            } while (existingGame);

            const newGameSession = new GameSession({
                quizId,
                gamePin,
                hostId,
                status: 'lobby',
            });
            await newGameSession.save();

            activeGames[gamePin] = {
                quiz: quiz,
                hostId: hostId,
                hostSocketId: socket.id,
                players: [],
                currentQuestionIndex: -1,
                gameSessionId: newGameSession._id // Store DB session ID
            };

            socket.join(gamePin); // Host joins the game room
            socket.emit('gameCreated', { gamePin, quizTitle: quiz.title });
            console.log(`Game created with PIN: ${gamePin} by host ${hostId}`);

        } catch (error) {
            console.error('Error creating game:', error);
            socket.emit('gameError', 'Failed to create game.');
        }
    });

    socket.on('host:startGame', (gamePin) => {
        const game = activeGames[gamePin];
        if (game && game.hostSocketId === socket.id && game.status === 'lobby') {
            game.status = 'inProgress';
            game.currentQuestionIndex = 0;
            game.questionStartTime = Date.now(); // Mark question start time

            const currentQuestion = game.quiz.questions[game.currentQuestionIndex];
            io.to(gamePin).emit('game:question', {
                questionIndex: game.currentQuestionIndex,
                questionText: currentQuestion.questionText,
                imageUrl: currentQuestion.imageUrl,
                answerOptions: currentQuestion.answerOptions.map(opt => ({ text: opt.text, _id: opt._id })), // Don't send isCorrect
                timeLimit: currentQuestion.timeLimit
            });
            console.log(`Game ${gamePin} started. Sending question ${game.currentQuestionIndex}`);
        } else {
            socket.emit('gameError', 'Cannot start game or not authorized.');
        }
    });

    socket.on('host:nextQuestion', (gamePin) => {
        const game = activeGames[gamePin];
        if (game && game.hostSocketId === socket.id && game.status === 'inProgress') {
            game.currentQuestionIndex++;

            if (game.currentQuestionIndex < game.quiz.questions.length) {
                game.questionStartTime = Date.now();
                const currentQuestion = game.quiz.questions[game.currentQuestionIndex];
                io.to(gamePin).emit('game:question', {
                    questionIndex: game.currentQuestionIndex,
                    questionText: currentQuestion.questionText,
                    imageUrl: currentQuestion.imageUrl,
                    answerOptions: currentQuestion.answerOptions.map(opt => ({ text: opt.text, _id: opt._id })),
                    timeLimit: currentQuestion.timeLimit
                });
                console.log(`Game ${gamePin}: Moving to question ${game.currentQuestionIndex}`);
            } else {
                // End of quiz
                game.status = 'finished';
                // Calculate final results
                const finalResults = game.players.sort((a, b) => b.score - a.score).map(p => ({
                    nickname: p.nickname,
                    finalScore: p.score
                }));

                // Save results to DB
                (async () => {
                    const GameSession = require('./models/GameSession');
                    const session = await GameSession.findById(game.gameSessionId);
                    if (session) {
                        session.status = 'finished';
                        session.results = finalResults;
                        await session.save();
                    }
                })();


                io.to(gamePin).emit('game:endGame', finalResults);
                console.log(`Game ${gamePin} finished. Final results sent.`);
                delete activeGames[gamePin]; // Clean up in-memory game
            }
        } else {
            socket.emit('gameError', 'Cannot move to next question or not authorized.');
        }
    });

    // --- Player Events ---
    socket.on('player:joinGame', async ({ gamePin, nickname }) => {
        const game = activeGames[gamePin];
        if (game && game.status === 'lobby') {
            // Check if nickname already exists in this game
            const existingPlayer = game.players.find(p => p.nickname === nickname);
            if (existingPlayer) {
                socket.emit('joinError', 'Nickname already taken. Please choose another.');
                return;
            }

            const player = { socketId: socket.id, nickname, score: 0 };
            game.players.push(player);
            socket.join(gamePin); // Player joins the game room

            socket.emit('joinedGame', { gamePin, nickname, quizTitle: game.quiz.title });
            io.to(game.hostSocketId).emit('playerJoined', { players: game.players.map(p => ({ nickname: p.nickname, score: p.score })) });
            console.log(`Player ${nickname} joined game ${gamePin}`);
        } else {
            socket.emit('joinError', 'Game not found or not in lobby.');
        }
    });

    socket.on('player:submitAnswer', ({ gamePin, questionIndex, selectedOptionId }) => {
        const game = activeGames[gamePin];
        if (game && game.status === 'inProgress' && game.currentQuestionIndex === questionIndex) {
            const player = game.players.find(p => p.socketId === socket.id);
            if (player) {
                const currentQuestion = game.quiz.questions[questionIndex];
                const selectedOption = currentQuestion.answerOptions.find(opt => opt._id.toString() === selectedOptionId);

                let isCorrect = false;
                let pointsEarned = 0;

                if (selectedOption && selectedOption.isCorrect) {
                    isCorrect = true;
                    // Calculate points based on time taken (Kahoot-style)
                    const timeTaken = (Date.now() - game.questionStartTime) / 1000; // in seconds
                    const maxPoints = 1000; // Max points for quick answer
                    const timeLimit = currentQuestion.timeLimit;
                    const pointsPerSecond = maxPoints / timeLimit;
                    pointsEarned = Math.max(0, Math.floor(maxPoints - (timeTaken * pointsPerSecond)));
                    player.score += pointsEarned;
                }

                socket.emit('answerResult', { isCorrect, pointsEarned, currentScore: player.score });
                io.to(game.hostSocketId).emit('playerAnswered', {
                    nickname: player.nickname,
                    isCorrect,
                    score: player.score,
                    questionIndex
                });
                io.to(gamePin).emit('game:scoreUpdate', game.players.map(p => ({ nickname: p.nickname, score: p.score })));

                console.log(`Player ${player.nickname} submitted answer for Q${questionIndex}. Correct: ${isCorrect}, Score: ${player.score}`);
            }
        } else {
            socket.emit('gameError', 'Invalid game state for answering.');
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Handle player/host disconnection:
        // Iterate through activeGames to find if this socket was a player or host
        for (const gamePin in activeGames) {
            const game = activeGames[gamePin];
            // If host disconnected
            if (game.hostSocketId === socket.id) {
                console.log(`Host of game ${gamePin} disconnected. Ending game.`);
                io.to(gamePin).emit('gameEndedUnexpectedly', 'Host disconnected.');
                delete activeGames[gamePin];
                break;
            }
            // If player disconnected
            const playerIndex = game.players.findIndex(p => p.socketId === socket.id);
            if (playerIndex !== -1) {
                const disconnectedPlayer = game.players.splice(playerIndex, 1)[0];
                console.log(`Player ${disconnectedPlayer.nickname} left game ${gamePin}.`);
                io.to(game.hostSocketId).emit('playerLeft', { players: game.players.map(p => ({ nickname: p.nickname, score: p.score })) });
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));