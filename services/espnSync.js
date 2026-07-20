function normalizeTeamName(name) {
    if (!name) return "";
    let n = name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9\s]/g, " ") // replace special chars with spaces
        .replace(/\s+/g, " ") // collapse multiple spaces
        .trim();
        
    const aliases = {
        "usa": "united states",
        "us": "united states",
        "czechia": "czech republic",
        "bosnia herzegovina": "bosnia and herzegovina",
        "south korea": "korea republic",
        "korea republic": "south korea",
        "north korea": "korea dpr",
        "korea dpr": "north korea"
    };
    
    if (aliases[n]) return aliases[n];
    return n;
}

async function fetchESPNMatches(datesRange = "20260611-20260720") {
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=150&dates=${datesRange}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
        if (!res.ok) return [];
        const data = await res.json();
        return data.events || [];
    } catch (e) {
        console.error("[espn-sync] Error fetching ESPN scoreboard:", e.message);
        return [];
    }
}

async function syncMatches(espnEvents, db, matchCollection = "games") {
  const dbTeams = await db.collection("teams").find({}).toArray();
  const dbGames = await db.collection(matchCollection).find({}).toArray();
  const matchesCol = db.collection(matchCollection);
  
  let updated = 0;
  
  for (const event of espnEvents) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    
    const homeCompetitor = comp.competitors?.find(c => c.homeAway === 'home');
    const awayCompetitor = comp.competitors?.find(c => c.homeAway === 'away');
    if (!homeCompetitor || !awayCompetitor) continue;
    
    const homeName = homeCompetitor.team?.displayName;
    const awayName = awayCompetitor.team?.displayName;
    
    // Find matching game in DB by matching home and away names
    const matchedGame = dbGames.find(g => {
        const dbHome = dbTeams.find(t => t.id === g.home_team_id);
        const dbAway = dbTeams.find(t => t.id === g.away_team_id);
        if (!dbHome || !dbAway) return false;
        
        return (normalizeTeamName(dbHome.name_en) === normalizeTeamName(homeName) &&
                normalizeTeamName(dbAway.name_en) === normalizeTeamName(awayName));
    });
    
    if (!matchedGame) {
        continue;
    }
    
    const isFinished = event.status?.type?.completed === true || event.status?.type?.state === 'post';
    const isLive = event.status?.type?.state === 'in';
    
    const homeScore = parseInt(homeCompetitor.score) || 0;
    const awayScore = parseInt(awayCompetitor.score) || 0;
    
    let timeElapsed = "notstarted";
    if (isFinished) {
        timeElapsed = "finished";
    } else if (isLive) {
        const period = event.status?.period;
        const displayClock = event.status?.displayClock || "";
        if (period === 2 && event.status?.clock === 0) {
            timeElapsed = "Intervalo";
        } else {
            timeElapsed = displayClock.replace("'", "");
        }
    }
    
    const homeGoals = [];
    const awayGoals = [];
    const cards = [];
    
    const details = comp.details || [];
    for (const d of details) {
        const player = d.athletesInvolved?.[0]?.displayName || "Jogador";
        const time = d.clock?.displayValue || "";
        const isHome = String(d.team?.id) === String(homeCompetitor.team?.id);
        
        if (d.scoringPlay) {
            const pen = d.penaltyKick ? " (p)" : (d.ownGoal ? " (g.contra)" : "");
            const entry = `"${player} ${time}${pen}"`;
            if (isHome) homeGoals.push(entry);
            else awayGoals.push(entry);
        } else if (d.yellowCard || d.redCard) {
            cards.push({
                team: isHome ? "home" : "away",
                player: player,
                type: d.redCard ? "red" : "yellow",
                minute: time.replace("'", "")
            });
        }
    }
    
    let homePenaltyScore = "null";
    let awayPenaltyScore = "null";
    const shootoutPlay = comp.shootout;
    if (shootoutPlay) {
        homePenaltyScore = String(homeCompetitor.shootoutScore || "0");
        awayPenaltyScore = String(awayCompetitor.shootoutScore || "0");
    }

    // Formatar redes de transmissão brasileiras (TV Globo, SporTV, CazéTV)
    const homeStr = (homeName || "").toLowerCase();
    const awayStr = (awayName || "").toLowerCase();
    const isBrazilGame = homeStr.includes("brazil") || homeStr.includes("brasil") || awayStr.includes("brazil") || awayStr.includes("brasil");
    const isKnockout = matchedGame.type !== "group";
    
    let broadcastStr = "";
    if (isBrazilGame || isKnockout) {
        broadcastStr = "TV Globo, SporTV, CazéTV";
    } else {
        broadcastStr = "SporTV, CazéTV";
    }
    
    const updateDoc = {
        home_score: String(homeScore),
        away_score: String(awayScore),
        time_elapsed: timeElapsed,
        finished: isFinished ? "TRUE" : "FALSE",
        home_scorers: homeGoals.length ? `{${homeGoals.join(",")}}` : "null",
        away_scorers: awayGoals.length ? `{${awayGoals.join(",")}}` : "null",
        home_penalty_score: homePenaltyScore,
        away_penalty_score: awayPenaltyScore,
        cards: cards,
        broadcast: broadcastStr
    };
    
    if (isLive || isFinished) {
        try {
            const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${event.id}`;
            const summaryRes = await fetch(summaryUrl, { signal: AbortSignal.timeout(6000) });
            if (summaryRes.ok) {
                const summaryData = await summaryRes.json();
                
                // Extract statistics (Scout)
                const scout = {};
                if (summaryData.boxscore?.teams) {
                    summaryData.boxscore.teams.forEach(t => {
                        const side = t.homeAway === 'home' ? 'home' : 'away';
                        t.statistics?.forEach(s => {
                            if (!scout[s.name]) scout[s.name] = {};
                            scout[s.name][side] = s.displayValue;
                        });
                    });
                }
                updateDoc.scout = scout;
                
                // Extract rosters (Lineups)
                const lineups = { home: { starters: [], substitutes: [], formation: "" }, away: { starters: [], substitutes: [], formation: "" } };
                if (summaryData.rosters) {
                    const rosterKeys = Object.keys(summaryData.rosters);
                    rosterKeys.forEach(k => {
                        const r = summaryData.rosters[k];
                        const side = r.homeAway === 'home' ? 'home' : 'away';
                        lineups[side].formation = r.formation || "";
                        r.roster?.forEach(p => {
                            const playerInfo = {
                                id: p.athlete?.id || "",
                                name: p.athlete?.displayName || "",
                                number: p.jersey || p.uniform || "",
                                position: p.position?.abbreviation || "",
                                photo: p.athlete?.id ? `https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/${p.athlete.id}.png&w=96&h=96` : ""
                            };
                            if (p.starter) {
                                lineups[side].starters.push(playerInfo);
                            } else {
                                lineups[side].substitutes.push(playerInfo);
                            }
                        });
                    });
                }
                updateDoc.lineups = lineups;
            }
        } catch (err) {
            console.error(`[espn-sync] Error fetching summary for match ${event.id}:`, err.message);
        }
    }
    
    // Check if anything has changed before updating
    const hasChanged = 
        matchedGame.home_score !== updateDoc.home_score ||
        matchedGame.away_score !== updateDoc.away_score ||
        matchedGame.time_elapsed !== updateDoc.time_elapsed ||
        matchedGame.finished !== updateDoc.finished ||
        matchedGame.home_scorers !== updateDoc.home_scorers ||
        matchedGame.away_scorers !== updateDoc.away_scorers ||
        matchedGame.home_penalty_score !== updateDoc.home_penalty_score ||
        matchedGame.away_penalty_score !== updateDoc.away_penalty_score ||
        matchedGame.broadcast !== updateDoc.broadcast ||
        JSON.stringify(matchedGame.cards) !== JSON.stringify(updateDoc.cards) ||
        JSON.stringify(matchedGame.scout) !== JSON.stringify(updateDoc.scout) ||
        JSON.stringify(matchedGame.lineups) !== JSON.stringify(updateDoc.lineups);
        
    if (hasChanged) {
        await matchesCol.updateOne(
            { _id: matchedGame._id },
            { $set: updateDoc }
        );
        updated++;
    }
  }
  
  return updated;
}

module.exports = {
    fetchESPNMatches,
    syncMatches,
    normalizeTeamName
};
