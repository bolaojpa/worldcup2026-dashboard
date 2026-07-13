/**
 * World Cup 2026 — Auto Live Updater
 * 
 * Automatically fetches live match data from Varzesh3 API and updates MongoDB.
 * Replaces manual score entry with real-time automated updates.
 * 
 * Features:
 * - Live scores updated every 3 seconds
 * - Goal scorers with English names (from player database)
 * - Penalty goals detected (eventType 3)
 * - Group standings auto-calculated after each match
 * - Persian → English player name translation via player-names.json
 * 
 * Usage:
 *   node scripts/auto-updater.js
 * 
 * Requirements:
 *   - MongoDB running with the worldcup2026 database seeded
 *   - data/player-names.json (player ID → English name mapping)
 *   - data/team-name-map.json (Persian → English team names)
 */

require("dotenv").config();
const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");
const { advanceRoundOf32Winners, advanceKnockoutWinners } = require("../services/knockoutBracket");
const { fetchESPNMatches, syncMatches } = require("../services/espnSync");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/worldcup2026";
const DB_NAME = process.env.DB_NAME || undefined;
const MATCH_COLLECTION = process.env.MATCH_COLLECTION || "games";
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || "3000");

// Removed Varzesh3 scraper functions, using modular ESPN sync instead.

async function updateStandings(db) {
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

// ── Main ─────────────────────────────────────────────────────────────────────

async function fullSync() {
  console.log("[auto-updater] Full sync starting...");
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = DB_NAME ? client.db(DB_NAME) : client.db();
    const events = await fetchESPNMatches("20260611-20260720");
    const updated = await syncMatches(events, db, MATCH_COLLECTION);
    const advancements = await advanceKnockoutWinners(db, MATCH_COLLECTION);
    await updateStandings(db);
    const advanced = advancements.filter(result => result.advanced).length;
    console.log(`[auto-updater] Full sync done: ${updated} matches updated, ${advanced} winners advanced, standings recalculated`);
  } finally { await client.close(); }
}

let lastFinishedCount = 0;
async function poll() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = DB_NAME ? client.db(DB_NAME) : client.db();
    
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0].replace(/-/g, '');
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0].replace(/-/g, '');
    const rangeEvents = await fetchESPNMatches(`${yesterday}-${tomorrow}`);
    
    const updated = await syncMatches(rangeEvents, db, MATCH_COLLECTION);
    const advancements = await advanceKnockoutWinners(db, MATCH_COLLECTION);
    for (const result of advancements) {
      if (result.advanced) {
        console.log(`[auto-updater] Team ${result.winnerTeamId || result.loserTeamId} advanced to match ${result.nextMatchId} as ${result.type}`);
      }
    }

    const count = await db.collection(MATCH_COLLECTION).countDocuments({ finished: "TRUE" });
    if (count !== lastFinishedCount) {
      lastFinishedCount = count;
      await updateStandings(db);
      console.log(`[auto-updater] Standings updated (${count} finished matches)`);
    }
  } catch (err) {
    console.error("[auto-updater] Poll error:", err.message);
  } finally { await client.close(); }
}

console.log(`[auto-updater] Starting — polling every ${POLL_INTERVAL}ms`);
fullSync().then(() => {
  setInterval(poll, POLL_INTERVAL);
});
