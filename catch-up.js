require('dotenv').config({path: '.env'});
const mongoose = require('./database');
const Game = require('./models/game');
const autoUpdater = require('./scripts/auto-updater'); // We might not need this, but let's just update DB directly

async function catchUp() {
    try {
        console.log('Preenchendo Fase de Grupos (Jogos 1 a 72)...');
        const games = await Game.find({ type: 'group' });
        
        for (let g of games) {
            if (g.finished !== 'TRUE') {
                g.home_score = String(Math.floor(Math.random() * 4));
                g.away_score = String(Math.floor(Math.random() * 4));
                
                // Determina os scorers aleatoriamente baseados no placar
                g.home_scorers = g.home_score !== '0' ? `{"Jogador Casa 15'"}` : 'null';
                g.away_scorers = g.away_score !== '0' ? `{"Jogador Fora 30'"}` : 'null';
                
                g.finished = 'TRUE';
                g.time_elapsed = 'finished';
                await g.save();
            }
        }
        console.log('Todos os 72 jogos da fase de grupos finalizados!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

catchUp();
