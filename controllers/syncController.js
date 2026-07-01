const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const { advanceRoundOf32Winners } = require('../services/knockoutBracket');

// Configurações do Banco
const MONGO_URI = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/worldcup2026';
const MATCH_COLLECTION = process.env.MATCH_COLLECTION || 'games';
const TEAM_MAP = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/team-name-map.json'), 'utf8'));
let playerDb = {};
try { playerDb = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/player-names.json'), 'utf8')); } catch {}

// Funções Auxiliares do Atualizador (Extraídas do auto-updater.js)
function getPlayerName(id, faName) {
    const sid = String(id);
    if (playerDb[sid]) return playerDb[sid];
    if (sid && faName && !playerDb[sid]) {
        playerDb[sid] = faName;
        try { fs.writeFileSync(path.join(__dirname, '../data/player-names.json'), JSON.stringify(playerDb, null, 2)); } catch {}
    }
    return faName;
}

function mapStatus(status, liveTime, isLive) {
    if (status === 2 && !liveTime) return "Intervalo";
    if (isLive) return liveTime || "Live";
    if (status === 7) return "finished";
    return "notstarted";
}

async function fetchVarzesh3Today() {
    const res = await fetch("https://web-api.varzesh3.com/v2.0/livescore/today", { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    const matches = [];
    for (const league of data) {
        if (league.id !== 28) continue;
        for (const dg of league.dates || []) {
            for (const m of dg.matches || []) matches.push(m);
        }
    }
    return matches;
}

async function fetchEvents(matchId) {
    try {
        const res = await fetch(
            `https://web-api.varzesh3.com/v2.0/livescore/football/matches/${matchId}/events`,
            { signal: AbortSignal.timeout(2000) }
        );
        const events = await res.json();
        const homeGoals = [], awayGoals = [];
        for (const e of events) {
            if (e.eventType === 1 || e.eventType === 3) {
                const id = e.strikerId || e.kickerId || "";
                const name = getPlayerName(id, e.strickerName || e.kickerName || "Goal");
                const time = e.time || "";
                const pen = e.eventType === 3 ? "(p)" : "";
                homeGoals.push(...(e.side === 0 ? [`"${name} ${time}'${pen}"`] : []));
                awayGoals.push(...(e.side === 1 ? [`"${name} ${time}'${pen}"`] : []));
            }
        }
        return {
            home_scorers: homeGoals.length ? `{${homeGoals.join(",")}}` : "null",
            away_scorers: awayGoals.length ? `{${awayGoals.join(",")}}` : "null",
        };
    } catch { return null; }
}

async function syncMatches(v3Matches, db) {
    const teams = await db.collection("teams").find({}).toArray();
    const teamByFa = {};
    for (const t of teams) teamByFa[t.name_fa] = t.id;
    for (const [fa, en] of Object.entries(TEAM_MAP)) {
        const team = teams.find(t => t.name_en === en);
        if (team) teamByFa[fa] = team.id;
    }

    const matches = db.collection(MATCH_COLLECTION);
    let updated = 0;

    for (const m of v3Matches) {
        const homeTeamId = teamByFa[m.host?.name];
        const awayTeamId = teamByFa[m.guest?.name];
        if (!homeTeamId || !awayTeamId) continue;

        const match = await matches.findOne({
            home_team_id: homeTeamId,
            away_team_id: awayTeamId,
            finished: { $nin: ["TRUE", true] }
        }, { sort: { date: -1 } });
        if (!match) continue;

        const newData = {
            home_score: String(m.goals?.host ?? match.home_score),
            away_score: String(m.goals?.guest ?? match.away_score),
            time_elapsed: mapStatus(m.status, m.liveTime, m.isLive),
            finished: m.status === 7 ? "TRUE" : match.finished,
        };
        if (m.status === 7 && (m.winner === 0 || m.winner === 1)) {
            newData.winner_team_id = m.winner === 0 ? homeTeamId : awayTeamId;
        }

        if (m.isLive || m.status === 7) {
            const scorers = await fetchEvents(m.id);
            if (scorers) {
                newData.home_scorers = scorers.home_scorers;
                newData.away_scorers = scorers.away_scorers;
            }
        }

        if (match.home_score !== newData.home_score || match.away_score !== newData.away_score ||
            match.time_elapsed !== newData.time_elapsed || match.finished !== newData.finished ||
            match.home_scorers !== newData.home_scorers) {
            await matches.updateOne({ _id: match._id }, { $set: newData });
            updated++;
        }
    }
    return updated;
}

// Rota de Sincronização
router.get('/sync-live-games', async (req, res) => {
    const { secret } = req.query;
    const SYNC_SECRET = process.env.SYNC_SECRET || 'fallback_secret_token_123';
    
    if (secret !== SYNC_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Invalid secret token' });
    }

    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db();
        const todayMatches = await fetchVarzesh3Today();
        const updatedCount = await syncMatches(todayMatches, db);
        await advanceRoundOf32Winners(db, MATCH_COLLECTION);
        
        return res.status(200).json({ 
            success: true, 
            message: `Sync completed. ${updatedCount} matches updated.`,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Error executing live sync:', err);
        return res.status(500).json({ error: 'Sync failed', details: err.message });
    } finally {
        await client.close();
    }
});

module.exports = app => app.use('/api', router);
