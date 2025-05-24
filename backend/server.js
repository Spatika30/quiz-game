const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/db');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: ["http://localhost:3000", "http://localhost:19006"],
        methods: ["GET", "POST"]
    }
});

// Connect Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/quizzes', require('./routes/quizManage'));

const activeGames = {};

// Socket.IO Logic
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // --- Host Events ---
    socket.on('host:createGame', async ({ quizId, hostId }) => {
        try {
            const Quiz = require('./models/quiz');
            const GameSession = require('./models/GameSession');

            const quiz = await Quiz.findById(quizId);
            if (!quiz) {
                socket.emit('gameError', 'Quiz not found.');
                return;
            }

            let gamePin;
            let existingGame;
            do {
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
                quiz: quiz.toObject(), // Convert Mongoose document to plain object to avoid issues with modification later
                hostId: hostId,
                hostSocketId: socket.id,
                players: [],
                currentQuestionIndex: -1,
                gameSessionId: newGameSession._id,
                // Track answers for current question to prevent multiple submissions per player
                answeredPlayers: new Set()
            };

            socket.join(gamePin);
            socket.emit('gameCreated', { gamePin, quizTitle: quiz.title });
            console.log(`Game created with PIN: ${gamePin} by host ${hostId}`);

        } catch (error) {
            console.error('Error creating game:', error);
            socket.emit('gameError', 'Failed to create game.');
        }
    });

    const sendQuestionToPlayers = (game, gamePin) => {
        const currentQuestion = game.quiz.questions[game.currentQuestionIndex];
        const questionDataForPlayers = {
            questionIndex: game.currentQuestionIndex,
            questionText: currentQuestion.questionText,
            imageUrl: currentQuestion.imageUrl,
            questionType: currentQuestion.questionType, // Send the question type

            // Conditionally add answer options based on type
            timeLimit: currentQuestion.timeLimit
        };

        if (currentQuestion.questionType === 'multiple-choice') {
            questionDataForPlayers.answerOptions = currentQuestion.answerOptions.map(opt => ({ text: opt.text, _id: opt._id }));
        }
        // For True/False, Fill-in-the-Blank, and Match the Following,
        // players generally don't need "options" in the same way (they provide their own input or select from a fixed set)
        // so we don't send `answerOptions` or `matchingPairs` for these types.
        // The client-side (player app) will render input fields based on `questionType`.

        io.to(gamePin).emit('game:question', questionDataForPlayers);
        game.answeredPlayers.clear(); // Reset for the new question
        console.log(`Game ${gamePin}: Sending question ${game.currentQuestionIndex} (Type: ${currentQuestion.questionType})`);
    };


    socket.on('host:startGame', (gamePin) => {
        const game = activeGames[gamePin];
        if (game && game.hostSocketId === socket.id && game.status === 'lobby') {
            game.status = 'inProgress';
            game.currentQuestionIndex = 0;
            game.questionStartTime = Date.now(); // Mark question start time

            sendQuestionToPlayers(game, gamePin);
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
                sendQuestionToPlayers(game, gamePin);
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
            const existingPlayer = game.players.find(p => p.nickname === nickname);
            if (existingPlayer) {
                socket.emit('joinError', 'Nickname already taken. Please choose another.');
                return;
            }

            const player = { socketId: socket.id, nickname, score: 0 };
            game.players.push(player);
            socket.join(gamePin);

            socket.emit('joinedGame', { gamePin, nickname, quizTitle: game.quiz.title });
            io.to(game.hostSocketId).emit('playerJoined', { players: game.players.map(p => ({ nickname: p.nickname, score: p.score })) });
            console.log(`Player ${nickname} joined game ${gamePin}`);
        } else {
            socket.emit('joinError', 'Game not found or not in lobby.');
        }
    });

    socket.on('player:submitAnswer', ({ gamePin, questionIndex, answer }) => { // `answer` will be dynamic
        const game = activeGames[gamePin];
        const player = game?.players.find(p => p.socketId === socket.id);

        // Prevent multiple submissions for the same question
        if (!game || !player || game.status !== 'inProgress' || game.currentQuestionIndex !== questionIndex || game.answeredPlayers.has(socket.id)) {
            socket.emit('gameError', 'Invalid game state or already submitted answer.');
            return;
        }

        const currentQuestion = game.quiz.questions[questionIndex];
        let isCorrect = false;
        let pointsEarned = 0;

        switch (currentQuestion.questionType) {
            case 'multiple-choice':
                // `answer` is `selectedOptionId`
                const selectedOption = currentQuestion.answerOptions.find(opt => opt._id.toString() === answer.selectedOptionId);
                if (selectedOption && selectedOption.isCorrect) {
                    isCorrect = true;
                }
                break;
            case 'true-false':
                // `answer` is `selectedBoolean` (true/false)
                if (currentQuestion.trueFalseAnswer === answer.selectedBoolean) {
                    isCorrect = true;
                }
                break;
            case 'fill-in-the-blank':
                // `answer` is `submittedText`
                // Perform case-insensitive and trim comparison
                if (currentQuestion.blankAnswer.trim().toLowerCase() === answer.submittedText.trim().toLowerCase()) {
                    isCorrect = true;
                }
                break;
            case 'match-the-following':
                // `answer` is an array of `{ termId: 'playerSelectedDefinitionId' }`
                // This is more complex and requires careful matching.
                // For simplicity, let's assume `answer` is an array like `[{ term: 'PlayerTerm', definition: 'PlayerDefinition' }]`
                // Or, more robustly, a map of submitted term-to-definition pairings.
                // Here's a basic check assuming `answer.submittedPairs` is an array of `{ term: 'termValue', definition: 'definitionValue' }`
                // You'd ideally match IDs or ensure exact text matches for all pairs.
                isCorrect = true; // Assume correct until proven wrong
                if (answer.submittedPairs && answer.submittedPairs.length === currentQuestion.matchingPairs.length) {
                    for (const playerPair of answer.submittedPairs) {
                        const correctPair = currentQuestion.matchingPairs.find(
                            cp => cp.term.trim().toLowerCase() === playerPair.term.trim().toLowerCase()
                        );
                        if (!correctPair || correctPair.definition.trim().toLowerCase() !== playerPair.definition.trim().toLowerCase()) {
                            isCorrect = false;
                            break;
                        }
                    }
                } else {
                    isCorrect = false; // Mismatched number of pairs
                }
                break;
            default:
                console.warn(`Unknown question type: ${currentQuestion.questionType}`);
                break;
        }

        if (isCorrect) {
            const timeTaken = (Date.now() - game.questionStartTime) / 1000;
            const maxPoints = 1000;
            const timeLimit = currentQuestion.timeLimit;
            const pointsPerSecond = maxPoints / timeLimit;
            pointsEarned = Math.max(0, Math.floor(maxPoints - (timeTaken * pointsPerSecond)));
            player.score += pointsEarned;
        }

        game.answeredPlayers.add(socket.id); // Mark player as having answered

        socket.emit('answerResult', { isCorrect, pointsEarned, currentScore: player.score });
        io.to(game.hostSocketId).emit('playerAnswered', {
            nickname: player.nickname,
            isCorrect,
            score: player.score,
            questionIndex
        });
        io.to(gamePin).emit('game:scoreUpdate', game.players.map(p => ({ nickname: p.nickname, score: p.score })));

        console.log(`Player ${player.nickname} submitted answer for Q${questionIndex} (Type: ${currentQuestion.questionType}). Correct: ${isCorrect}, Score: ${player.score}`);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        for (const gamePin in activeGames) {
            const game = activeGames[gamePin];
            if (game.hostSocketId === socket.id) {
                console.log(`Host of game ${gamePin} disconnected. Ending game.`);
                io.to(gamePin).emit('gameEndedUnexpectedly', 'Host disconnected.');
                delete activeGames[gamePin];
                break;
            }
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
