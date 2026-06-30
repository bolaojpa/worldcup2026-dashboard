require('dotenv').config({path: '.env'});
const { MongoClient } = require('mongodb');
const { advanceRoundOf32Winners } = require('./services/knockoutBracket');
const fs = require('fs');

async function updateStandings(db) {
  const MATCH_COLLECTION = 'games';
  const matches = await db.collection(MATCH_COLLECTION).find({ finished: "TRUE", type: "group" }).toArray();
  const teams = await db.collection("teams").find({}).toArray();

  const stats = {};
  for (const t of teams) {
    stats[t.id] = { team_id: t.id, mp: 0, w: 0, d: 0, l: 0, pts: 0, gf: 0, ga: 0, gd: 0 };
  }

  for (const m of matches) {
    const h = parseInt(m.home_score) || 0;
    const a = parseInt(m.away_score) || 0;
    const home = stats[m.home_team_id];
    const away = stats[m.away_team_id];
    if (!home || !away) continue;

    home.mp++; away.mp++;
    home.gf += h; home.ga += a;
    away.gf += a; away.ga += h;

    if (h > a) { home.w++; home.pts += 3; away.l++; }
    else if (h < a) { away.w++; away.pts += 3; home.l++; }
    else { home.d++; away.d++; home.pts++; away.pts++; }

    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;
  }

  const groups = await db.collection("groups").find({}).toArray();
  for (const g of groups) {
    const updatedTeams = g.teams.map(t => {
      const s = stats[t.team_id];
      if (!s) return t;
      return { team_id: t.team_id, mp: String(s.mp), w: String(s.w), d: String(s.d), l: String(s.l), pts: String(s.pts), gf: String(s.gf), ga: String(s.ga), gd: String(s.gd) };
    });
    updatedTeams.sort((a, b) => (parseInt(b.pts) - parseInt(a.pts)) || (parseInt(b.gd) - parseInt(a.gd)) || (parseInt(b.gf) - parseInt(a.gf)));
    await db.collection("groups").updateOne({ _id: g._id }, { $set: { teams: updatedTeams } });
  }
}

async function run() {
    const MONGO_URI = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/worldcup2026";
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db();
        console.log('Atualizando classificações dos grupos...');
        await updateStandings(db);
        
        console.log('Avançando times para 16 avos de final...');
        const advancements = await advanceRoundOf32Winners(db, 'games');
        console.log('Avanços gerados:', advancements.filter(a => a.advanced).length);
        
        console.log('Tudo concluído!');
    } finally {
        await client.close();
    }
}

run();
