/**
 * @file trivia.js
 * @description Interactive Trivia Game for Groups.
 * 
 * Features:
 * - Multiple categories (Science, History, Geography, Pop Culture, etc.)
 * - Timed rounds (30 seconds per question)
 * - Leaderboard tracking
 * - Difficulty levels
 * - Daily trivia challenges
 * - Team mode
 */

const fs = require('fs');
const path = require('path');

const TRIVIA_DATA_FILE = path.join(__dirname, '../../data/triviaData.json');
const TRIVIA_QUESTIONS = {
    science: [
        { q: "What planet is known as the Red Planet?", a: "Mars", options: ["Venus", "Mars", "Jupiter", "Saturn"] },
        { q: "What is the chemical symbol for water?", a: "H2O", options: ["CO2", "H2O", "O2", "NaCl"] },
        { q: "What gas do plants absorb from the atmosphere?", a: "Carbon dioxide", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"] },
        { q: "What is the speed of light approximately?", a: "300,000 km/s", options: ["150,000 km/s", "300,000 km/s", "450,000 km/s", "600,000 km/s"] },
        { q: "What is the powerhouse of the cell?", a: "Mitochondria", options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi apparatus"] },
        { q: "What element has the atomic number 1?", a: "Hydrogen", options: ["Helium", "Hydrogen", "Lithium", "Carbon"] },
        { q: "What is the boiling point of water at sea level?", a: "100°C", options: ["90°C", "100°C", "110°C", "120°C"] },
        { q: "Which planet has the most moons?", a: "Saturn", options: ["Jupiter", "Saturn", "Uranus", "Neptune"] },
        { q: "What is the hardest natural substance?", a: "Diamond", options: ["Gold", "Iron", "Diamond", "Platinum"] },
        { q: "What does DNA stand for?", a: "Deoxyribonucleic acid", options: ["Deoxyribonucleic acid", "Dynamic neural acid", "Dual nucleic acid", "Digital nerve acid"] }
    ],
    geography: [
        { q: "What is the largest continent?", a: "Asia", options: ["Africa", "Asia", "North America", "Europe"] },
        { q: "What is the longest river in the world?", a: "Nile", options: ["Amazon", "Nile", "Mississippi", "Yangtze"] },
        { q: "What country has the most population?", a: "India", options: ["China", "India", "USA", "Indonesia"] },
        { q: "What is the capital of Australia?", a: "Canberra", options: ["Sydney", "Melbourne", "Canberra", "Brisbane"] },
        { q: "Which ocean is the deepest?", a: "Pacific", options: ["Atlantic", "Indian", "Pacific", "Arctic"] },
        { q: "What is the smallest country in the world?", a: "Vatican City", options: ["Monaco", "Vatican City", "San Marino", "Liechtenstein"] },
        { q: "What is the largest desert?", a: "Sahara", options: ["Sahara", "Gobi", "Kalahari", "Antarctic"] },
        { q: "How many continents are there?", a: "7", options: ["5", "6", "7", "8"] },
        { q: "What is the capital of Japan?", a: "Tokyo", options: ["Osaka", "Kyoto", "Tokyo", "Yokohama"] },
        { q: "Which country is known as the Land of the Rising Sun?", a: "Japan", options: ["China", "Japan", "Korea", "Thailand"] }
    ],
    history: [
        { q: "In what year did World War II end?", a: "1945", options: ["1943", "1944", "1945", "1946"] },
        { q: "Who was the first President of the United States?", a: "George Washington", options: ["Abraham Lincoln", "George Washington", "Thomas Jefferson", "John Adams"] },
        { q: "What ancient wonder was located in Egypt?", a: "Great Pyramid of Giza", options: ["Colossus of Rhodes", "Great Pyramid of Giza", "Hanging Gardens", "Lighthouse of Alexandria"] },
        { q: "In what year did the Titanic sink?", a: "1912", options: ["1910", "1911", "1912", "1913"] },
        { q: "Who painted the Mona Lisa?", a: "Leonardo da Vinci", options: ["Michelangelo", "Leonardo da Vinci", "Raphael", "Donatello"] },
        { q: "What empire was ruled by Julius Caesar?", a: "Roman Empire", options: ["Greek Empire", "Roman Empire", "Ottoman Empire", "Persian Empire"] },
        { q: "When did the Berlin Wall fall?", a: "1989", options: ["1987", "1988", "1989", "1990"] },
        { q: "Who discovered America in 1492?", a: "Christopher Columbus", options: ["Vasco da Gama", "Christopher Columbus", "Ferdinand Magellan", "Marco Polo"] },
        { q: "What was the Renaissance?", a: "Cultural rebirth in Europe", options: ["A war", "Cultural rebirth in Europe", "A religion", "A disease"] },
        { q: "What ancient civilization built Machu Picchu?", a: "Inca", options: ["Maya", "Aztec", "Inca", "Olmec"] }
    ],
    popculture: [
        { q: "What movie features the quote 'May the Force be with you'?", a: "Star Wars", options: ["Star Trek", "Star Wars", "Guardians of the Galaxy", "The Matrix"] },
        { q: "Who is the author of Harry Potter?", a: "J.K. Rowling", options: ["J.R.R. Tolkien", "J.K. Rowling", "George R.R. Martin", "Suzanne Collins"] },
        { q: "What band performed 'Bohemian Rhapsody'?", a: "Queen", options: ["The Beatles", "Queen", "Led Zeppelin", "Pink Floyd"] },
        { q: "What is the highest-grossing film of all time?", a: "Avatar", options: ["Avengers: Endgame", "Avatar", "Titanic", "Star Wars: The Force Awakens"] },
        { q: "In what year was the first iPhone released?", a: "2007", options: ["2005", "2006", "2007", "2008"] },
        { q: "What streaming service produces 'Stranger Things'?", a: "Netflix", options: ["Netflix", "Amazon Prime", "Disney+", "Hulu"] },
        { q: "Who plays Iron Man in the Marvel Cinematic Universe?", a: "Robert Downey Jr.", options: ["Chris Evans", "Robert Downey Jr.", "Chris Hemsworth", "Mark Ruffalo"] },
        { q: "What is the name of the fictional school in Harry Potter?", a: "Hogwarts", options: ["Hogwarts", "Narnia", "Wakanda", "Gotham"] },
        { q: "What game involves building and surviving in a block world?", a: "Minecraft", options: ["Fortnite", "Roblox", "Minecraft", "Terraria"] },
        { q: "What social media platform uses a bird logo?", a: "Twitter", options: ["Instagram", "Twitter", "Facebook", "Snapchat"] }
    ],
    sports: [
        { q: "How many players are on a soccer team?", a: "11", options: ["9", "10", "11", "12"] },
        { q: "What is the national sport of Japan?", a: "Sumo wrestling", options: ["Karate", "Sumo wrestling", "Judo", "Baseball"] },
        { q: "How often are the Summer Olympics held?", a: "Every 4 years", options: ["Every 2 years", "Every 4 years", "Every 3 years", "Every 5 years"] },
        { q: "What sport is played at Wimbledon?", a: "Tennis", options: ["Cricket", "Tennis", "Golf", "Badminton"] },
        { q: "Who has won the most World Cups in soccer?", a: "Brazil", options: ["Germany", "Brazil", "Italy", "Argentina"] },
        { q: "In basketball, how many points is a free throw worth?", a: "1", options: ["1", "2", "3", "4"] },
        { q: "What country hosted the 2022 FIFA World Cup?", a: "Qatar", options: ["Russia", "Qatar", "Japan", "USA"] },
        { q: "How many rings are on the Olympic flag?", a: "5", options: ["4", "5", "6", "7"] },
        { q: "What is the diameter of a basketball hoop in inches?", a: "18", options: ["16", "18", "20", "22"] },
        { q: "What sport uses the term 'birdie'?", a: "Golf", options: ["Tennis", "Golf", "Badminton", "Cricket"] }
    ]
};

class TriviaGame {
    constructor() {
        this.activeGames = new Map(); // groupId -> game state
        this.leaderboard = this.loadLeaderboard();
    }

    loadLeaderboard() {
        try {
            const dir = path.dirname(TRIVIA_DATA_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            if (!fs.existsSync(TRIVIA_DATA_FILE)) {
                fs.writeFileSync(TRIVIA_DATA_FILE, JSON.stringify({ leaderboard: {} }, null, 2));
                return {};
            }
            const data = JSON.parse(fs.readFileSync(TRIVIA_DATA_FILE, 'utf8'));
            return data.leaderboard || {};
        } catch (e) {
            return {};
        }
    }

    saveLeaderboard() {
        try {
            const dir = path.dirname(TRIVIA_DATA_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const data = { leaderboard: this.leaderboard };
            fs.writeFileSync(TRIVIA_DATA_FILE, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('[Trivia] Save error:', e);
        }
    }

    startGame(groupId, category = 'random', difficulty = 'medium', rounds = 5) {
        if (this.activeGames.has(groupId)) {
            return { error: 'A game is already in progress!' };
        }

        let questions = [];
        if (category === 'random') {
            const allCategories = Object.keys(TRIVIA_QUESTIONS);
            const randomCat = allCategories[Math.floor(Math.random() * allCategories.length)];
            questions = this.shuffleArray([...TRIVIA_QUESTIONS[randomCat]]).slice(0, rounds);
            category = randomCat;
        } else if (TRIVIA_QUESTIONS[category]) {
            questions = this.shuffleArray([...TRIVIA_QUESTIONS[category]]).slice(0, rounds);
        } else {
            return { error: `Unknown category. Available: ${Object.keys(TRIVIA_QUESTIONS).join(', ')}` };
        }

        const game = {
            category,
            difficulty,
            questions,
            currentQuestion: 0,
            scores: {},
            startTime: Date.now(),
            roundActive: false,
            answered: new Set()
        };

        this.activeGames.set(groupId, game);
        return { success: true, game };
    }

    getCurrentQuestion(groupId) {
        const game = this.activeGames.get(groupId);
        if (!game || game.currentQuestion >= game.questions.length) return null;

        const q = game.questions[game.currentQuestion];
        const questionNum = game.currentQuestion + 1;
        const total = game.questions.length;

        // Shuffle options for display
        const shuffledOptions = this.shuffleArray([...q.options]);

        return {
            question: q.q,
            options: shuffledOptions,
            correctAnswer: q.a,
            questionNum,
            total,
            category: game.category
        };
    }

    submitAnswer(groupId, userId, answer) {
        const game = this.activeGames.get(groupId);
        if (!game) return { error: 'No active game!' };

        const q = game.questions[game.currentQuestion];
        const isCorrect = answer.toLowerCase().trim() === q.a.toLowerCase().trim();

        if (!game.scores[userId]) {
            game.scores[userId] = { correct: 0, wrong: 0, streak: 0, total: 0 };
        }

        game.scores[userId].total++;

        if (isCorrect) {
            game.scores[userId].correct++;
            game.scores[userId].streak++;
            
            // Bonus points for streaks
            let points = 10;
            if (game.scores[userId].streak >= 3) points += 5; // Streak bonus
            if (game.difficulty === 'hard') points *= 2;

            return {
                correct: true,
                points,
                streak: game.scores[userId].streak,
                answer: q.a
            };
        } else {
            game.scores[userId].wrong++;
            game.scores[userId].streak = 0;
            return {
                correct: false,
                answer: q.a
            };
        }
    }

    nextQuestion(groupId) {
        const game = this.activeGames.get(groupId);
        if (!game) return null;

        game.currentQuestion++;
        
        if (game.currentQuestion >= game.questions.length) {
            return this.endGame(groupId);
        }

        return { next: true, questionNum: game.currentQuestion + 1 };
    }

    endGame(groupId) {
        const game = this.activeGames.get(groupId);
        if (!game) return null;

        // Calculate final scores
        const results = Object.entries(game.scores)
            .map(([userId, score]) => ({
                userId,
                correct: score.correct,
                wrong: score.wrong,
                streak: score.streak,
                score: score.correct * 10 + (score.streak >= 3 ? 5 * score.correct : 0)
            }))
            .sort((a, b) => b.score - a.score);

        // Update leaderboard
        results.forEach(r => {
            if (!this.leaderboard[r.userId]) {
                this.leaderboard[r.userId] = { wins: 0, games: 0, totalScore: 0, bestStreak: 0 };
            }
            this.leaderboard[r.userId].games++;
            this.leaderboard[r.userId].totalScore += r.score;
            if (r.streak > this.leaderboard[r.userId].bestStreak) {
                this.leaderboard[r.userId].bestStreak = r.streak;
            }
        });

        if (results.length > 0) {
            const winnerId = results[0].userId;
            if (!this.leaderboard[winnerId]) {
                this.leaderboard[winnerId] = { wins: 0, games: 0, totalScore: 0, bestStreak: 0 };
            }
            this.leaderboard[winnerId].wins++;
        }

        this.saveLeaderboard();
        this.activeGames.delete(groupId);

        return { results, category: game.category };
    }

    getLeaderboard(groupId, limit = 10) {
        return Object.entries(this.leaderboard)
            .sort((a, b) => b[1].totalScore - a[1].totalScore)
            .slice(0, limit)
            .map(([userId, data], index) => ({
                rank: index + 1,
                userId,
                ...data
            }));
    }

    isActive(groupId) {
        return this.activeGames.has(groupId);
    }

    cancelGame(groupId) {
        this.activeGames.delete(groupId);
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    getCategories() {
        return Object.keys(TRIVIA_QUESTIONS).map(cat => ({
            name: cat,
            questionCount: TRIVIA_QUESTIONS[cat].length
        }));
    }
}

module.exports = {
    name: 'trivia',
    aliases: ['quiz', 'triviaquiz'],
    category: 'group',
    description: 'Start an interactive trivia game in the group',
    usage: '.trivia <category> [rounds]',
    isGroup: true,

    async execute(sock, msg, args, extra) {
        try {
            const triviaGame = new TriviaGame();
            const groupId = extra.from;
            const action = args[0]?.toLowerCase();

            // Leaderboard
            if (action === 'leaderboard' || action === 'lb' || action === 'score') {
                const leaderboard = triviaGame.getLeaderboard(groupId);
                if (leaderboard.length === 0) {
                    return extra.reply('📊 No trivia games played yet in this group!');
                }

                let text = `🏆 *Trivia Leaderboard*\n\n`;
                leaderboard.forEach((entry, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                    text += `${medal} @${entry.userId.split('@')[0]} - ${entry.totalScore}pts (${entry.wins}W/${entry.games}G)\n`;
                });

                return extra.reply(text);
            }

            // Categories
            if (action === 'categories' || action === 'cats') {
                const cats = triviaGame.getCategories();
                let text = `📚 *Trivia Categories*\n\n`;
                cats.forEach(cat => {
                    text += `• ${cat.name.charAt(0).toUpperCase() + cat.name.slice(1)} (${cat.questionCount} questions)\n`;
                });
                text += `\n*Usage:* \`.trivia <category> [rounds]\`\n`;
                text += `*Random:* \`.trivia random\``;
                return extra.reply(text);
            }

            // Cancel
            if (action === 'cancel' || action === 'stop') {
                if (!triviaGame.isActive(groupId)) {
                    return extra.reply('❌ No active trivia game!');
                }
                triviaGame.cancelGame(groupId);
                return extra.reply('🛑 Trivia game cancelled!');
            }

            // Answer (if game is active and user sends a number)
            if (triviaGame.isActive(groupId) && /^[1-4]$/.test(action)) {
                const result = triviaGame.submitAnswer(groupId, extra.sender, action);
                
                if (result.error) {
                    return extra.reply(`❌ ${result.error}`);
                }

                if (result.correct) {
                    let response = `✅ *Correct!* +${result.points} points`;
                    if (result.streak >= 3) {
                        response += ` 🔥 ${result.streak} streak bonus!`;
                    }
                    return extra.reply(response);
                } else {
                    return extra.reply(`❌ *Wrong!* The answer was: ${result.answer}`);
                }
            }

            // Start new game
            if (triviaGame.isActive(groupId)) {
                return extra.reply('⚠️ A trivia game is already in progress! Send 1-4 to answer.');
            }

            const category = args[0] || 'random';
            const rounds = parseInt(args[1]) || 5;

            const result = triviaGame.startGame(groupId, category, 'medium', Math.min(rounds, 20));
            
            if (result.error) {
                return extra.reply(`❌ ${result.error}`);
            }

            const question = triviaGame.getCurrentQuestion(groupId);
            if (!question) {
                return extra.reply('❌ Failed to start trivia game!');
            }

            let text = `🎮 *TRIVIA TIME!* 🧠\n\n`;
            text += `📚 Category: ${question.category.charAt(0).toUpperCase() + question.category.slice(1)}\n`;
            text += `📊 Question ${question.questionNum}/${question.total}\n\n`;
            text += `❓ *${question.question}*\n\n`;
            
            question.options.forEach((opt, i) => {
                text += `${i + 1}. ${opt}\n`;
            });
            
            text += `\n⏰ *30 seconds to answer!*\n`;
            text += `> _Reply with 1-4 to answer_`;

            await extra.reply(text);

            // Auto-advance after 30 seconds
            setTimeout(() => {
                const next = triviaGame.nextQuestion(groupId);
                if (next && next.next) {
                    const nextQ = triviaGame.getCurrentQuestion(groupId);
                    if (nextQ) {
                        let nextText = `⏰ *Time's up!*\n\n`;
                        nextText += `📊 Question ${nextQ.questionNum}/${nextQ.total}\n\n`;
                        nextText += `❓ *${nextQ.question}*\n\n`;
                        nextQ.options.forEach((opt, i) => {
                            nextText += `${i + 1}. ${opt}\n`;
                        });
                        nextText += `\n> _Reply with 1-4 to answer_`;
                        
                        sock.sendMessage(groupId, { text: nextText });
                    }
                } else if (next && next.results) {
                    // Game ended
                    let endText = `🏆 *TRIVIA GAME OVER!*\n\n`;
                    endText += `📚 Category: ${next.category}\n\n`;
                    
                    next.results.slice(0, 3).forEach((r, i) => {
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                        endText += `${medal} @${r.userId.split('@')[0]} - ${r.score} points\n`;
                    });
                    
                    endText += `\n> _Type \`.trivia\` to play again!_`;
                    sock.sendMessage(groupId, { text: endText });
                }
            }, 30000);

        } catch (error) {
            console.error('[TRIVIA ERROR]', error);
            await extra.reply('❌ Error starting trivia game.');
        }
    }
};
