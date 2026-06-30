require('dotenv').config({path: '.env'});
const { MongoClient } = require('mongodb');
const { advanceRoundOf32Winners } = require('./services/knockoutBracket');

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
        console.log('✅ Connected to local MongoDB');

        console.log('📥 Fetching matches from the production API (https://worldcup26.ir/get/games)...');
        const res = await fetch('https://worldcup26.ir/get/games');
        const data = await res.json();
        const onlineGames = data.games || [];
        console.log(`Found ${onlineGames.length} games on the live server.`);

        const gamesCollection = db.collection('games');
        let updatedCount = 0;

        for (const og of onlineGames) {
            const updateFields = {
                home_score: String(og.home_score ?? "0"),
                away_score: String(og.away_score ?? "0"),
                home_scorers: og.home_scorers || "null",
                away_scorers: og.away_scorers || "null",
                finished: og.finished || "FALSE",
                time_elapsed: og.time_elapsed || "notstarted",
                home_team_id: String(og.home_team_id ?? "0"),
                away_team_id: String(og.away_team_id ?? "0")
            };
            
            if (og.home_penalty_score !== undefined && og.home_penalty_score !== null) updateFields.home_penalty_score = String(og.home_penalty_score);
            if (og.away_penalty_score !== undefined && og.away_penalty_score !== null) updateFields.away_penalty_score = String(og.away_penalty_score);
            if (og.winner_team_id !== undefined && og.winner_team_id !== null) updateFields.winner_team_id = String(og.winner_team_id);

            const result = await gamesCollection.updateOne(
                { id: String(og.id) },
                { $set: updateFields }
            );
            if (result.modifiedCount > 0 || result.matchedCount > 0) {
                updatedCount++;
            }
        }
        
        console.log(`Successfully synced ${updatedCount} matches to local database.`);

        console.log('Recalculating standings...');
        await updateStandings(db);

        console.log('Advancing knockout stages...');
        const advancements = await advanceRoundOf32Winners(db, 'games');
        console.log(`Advanced ${advancements.filter(a => a.advanced).length} matches.`);

        console.log('🎉 Sync completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Sync failed:', err);
        process.exit(1);
    }
}

run();
