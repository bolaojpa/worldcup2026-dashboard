require('dotenv').config({path: '.env'});
const mongoose = require('./database');
const Game = require('./models/game');

async function run() {
    try {
        // Pega os 8 primeiros jogos do banco
        const games = await Game.find().limit(8);
        for (let i = 0; i < games.length; i++) {
            const g = games[i];
            g.home_score = String(Math.floor(Math.random() * 4)); // 0 a 3 gols
            g.away_score = String(Math.floor(Math.random() * 4));
            g.finished = "TRUE";
            g.time_elapsed = "finished";
            await g.save();
            console.log(`Jogo ${g.id} simulado: ${g.home_score} - ${g.away_score}`);
        }
        console.log('✅ 8 jogos finalizados simulados com sucesso!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
