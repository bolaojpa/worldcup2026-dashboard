const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/worldcup2026";

const INITIAL_LEAGUES = [
    {
        id: "fifa.world",
        slug: "fifa.world",
        name: "Copa do Mundo 2026",
        shortName: "Copa 2026",
        country: "Mundial",
        flag: "🏆",
        logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/4.png",
        type: "cup",
        active: true,
        order: 1
    },
    {
        id: "bra.1",
        slug: "bra.1",
        name: "Brasileirão Série A",
        shortName: "Brasileirão",
        country: "Brasil",
        flag: "🇧🇷",
        logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/85.png",
        type: "league",
        active: true,
        order: 2
    },
    {
        id: "uefa.champions",
        slug: "uefa.champions",
        name: "UEFA Champions League",
        shortName: "Champions",
        country: "Europa",
        flag: "🇪🇺",
        logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png",
        type: "champions",
        active: true,
        order: 3
    },
    {
        id: "eng.1",
        slug: "eng.1",
        name: "Premier League",
        shortName: "Premier League",
        country: "Inglaterra",
        flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
        logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png",
        type: "league",
        active: true,
        order: 4
    },
    {
        id: "esp.1",
        slug: "esp.1",
        name: "La Liga",
        shortName: "La Liga",
        country: "Espanha",
        flag: "🇪🇸",
        logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/15.png",
        type: "league",
        active: true,
        order: 5
    },
    {
        id: "ita.1",
        slug: "ita.1",
        name: "Serie A Itália",
        shortName: "Calcio Serie A",
        country: "Itália",
        flag: "🇮🇹",
        logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/12.png",
        type: "league",
        active: true,
        order: 6
    }
];

async function runMigration() {
    console.log("Starting Multi-League Migration...");
    console.log("Connecting to Database:", MONGO_URI);
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db();

        // 1. Populate leagues collection
        const leaguesCol = db.collection("leagues");
        for (const league of INITIAL_LEAGUES) {
            await leaguesCol.updateOne(
                { id: league.id },
                { $set: league },
                { upsert: true }
            );
        }
        console.log("✅ Leagues collection initialized with 6 tournaments.");

        // 2. Tag existing games with league_id: "fifa.world"
        const gamesRes = await db.collection("games").updateMany(
            { $or: [{ league_id: { $exists: false } }, { league_id: "" }] },
            { $set: { league_id: "fifa.world" } }
        );
        console.log(`✅ Tagged ${gamesRes.modifiedCount} existing games with league_id: "fifa.world".`);

        // 3. Tag existing teams with league_id: "fifa.world"
        const teamsRes = await db.collection("teams").updateMany(
            { $or: [{ league_id: { $exists: false } }, { league_id: "" }] },
            { $set: { league_id: "fifa.world" } }
        );
        console.log(`✅ Tagged ${teamsRes.modifiedCount} existing teams with league_id: "fifa.world".`);

        // 4. Tag existing groups with league_id: "fifa.world"
        const groupsRes = await db.collection("groups").updateMany(
            { $or: [{ league_id: { $exists: false } }, { league_id: "" }] },
            { $set: { league_id: "fifa.world" } }
        );
        console.log(`✅ Tagged ${groupsRes.modifiedCount} existing groups with league_id: "fifa.world".`);

        // 5. Tag existing standings with league_id: "fifa.world"
        const standingsRes = await db.collection("standings").updateMany(
            { $or: [{ league_id: { $exists: false } }, { league_id: "" }] },
            { $set: { league_id: "fifa.world" } }
        );
        console.log(`✅ Tagged ${standingsRes.modifiedCount} existing standings with league_id: "fifa.world".`);

        console.log("🎉 Migration finished successfully!");
    } catch (e) {
        console.error("Migration error:", e);
    } finally {
        await client.close();
    }
}

if (require.main === module) {
    runMigration();
}

module.exports = { runMigration, INITIAL_LEAGUES };
