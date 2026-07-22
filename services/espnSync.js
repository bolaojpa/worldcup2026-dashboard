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

async function fetchESPNMatches(datesRange = "", leagueSlug = "fifa.world") {
    try {
        let defaultDates = datesRange;
        if (!defaultDates) {
            if (leagueSlug === "bra.1") {
                defaultDates = "20260401-20261215";
            } else if (leagueSlug !== "fifa.world") {
                defaultDates = "20260801-20270601";
            }
        }
        let url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueSlug}/scoreboard?limit=500`;
        if (defaultDates) {
            url += `&dates=${defaultDates}`;
        }
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) return [];
        const data = await res.json();
        return data.events || [];
    } catch (e) {
        console.error(`[espn-sync] Error fetching ESPN scoreboard for ${leagueSlug}:`, e.message);
        return [];
    }
}

async function syncMatches(espnEvents, db, matchCollection = "games", leagueSlug = "fifa.world") {
  const teamsCol = db.collection("teams");
  const matchesCol = db.collection(matchCollection);
  
  const dbTeams = await teamsCol.find({ league_id: leagueSlug }).toArray();
  const dbGames = await matchesCol.find({ league_id: leagueSlug }).toArray();
  
  let updated = 0;
  
  for (const event of espnEvents) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    
    const homeCompetitor = comp.competitors?.find(c => c.homeAway === 'home');
    const awayCompetitor = comp.competitors?.find(c => c.homeAway === 'away');
    if (!homeCompetitor || !awayCompetitor) continue;
    
    const homeName = homeCompetitor.team?.displayName || homeCompetitor.team?.name || "Home";
    const awayName = awayCompetitor.team?.displayName || awayCompetitor.team?.name || "Away";
    
    // Ensure teams exist in database for this league
    let dbHome = dbTeams.find(t => 
        (t.espn_id && t.espn_id === homeCompetitor.team?.id) ||
        normalizeTeamName(t.name_en) === normalizeTeamName(homeName)
    );
    if (!dbHome) {
        const nextIdStr = String((await teamsCol.countDocuments()) + 1);
        const newTeam = {
            id: nextIdStr,
            name_en: homeName,
            flag: homeCompetitor.team?.logo || "https://a.espncdn.com/i/teamlogos/default-team-logo.png",
            fifa_code: homeCompetitor.team?.abbreviation || homeName.substring(0, 3).toUpperCase(),
            league_id: leagueSlug,
            espn_id: homeCompetitor.team?.id
        };
        await teamsCol.insertOne(newTeam);
        dbHome = newTeam;
        dbTeams.push(newTeam);
    }
    
    let dbAway = dbTeams.find(t => 
        (t.espn_id && t.espn_id === awayCompetitor.team?.id) ||
        normalizeTeamName(t.name_en) === normalizeTeamName(awayName)
    );
    if (!dbAway) {
        const nextIdStr = String((await teamsCol.countDocuments()) + 1);
        const newTeam = {
            id: nextIdStr,
            name_en: awayName,
            flag: awayCompetitor.team?.logo || "https://a.espncdn.com/i/teamlogos/default-team-logo.png",
            fifa_code: awayCompetitor.team?.abbreviation || awayName.substring(0, 3).toUpperCase(),
            league_id: leagueSlug,
            espn_id: awayCompetitor.team?.id
        };
        await teamsCol.insertOne(newTeam);
        dbAway = newTeam;
        dbTeams.push(newTeam);
    }
    
    // Find matching game in DB
    let matchedGame = dbGames.find(g => {
        if (g.espn_id && g.espn_id === event.id) return true;
        return (g.home_team_id === dbHome.id && g.away_team_id === dbAway.id);
    });
    
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
    
    const updateDoc = {
        espn_id: event.id,
        home_team_id: dbHome.id,
        away_team_id: dbAway.id,
        home_score: String(homeScore),
        away_score: String(awayScore),
        time_elapsed: timeElapsed,
        finished: isFinished ? "TRUE" : "FALSE",
        home_scorers: homeGoals.length ? `{${homeGoals.join(",")}}` : "null",
        away_scorers: awayGoals.length ? `{${awayGoals.join(",")}}` : "null",
        home_penalty_score: homePenaltyScore,
        away_penalty_score: awayPenaltyScore,
        cards: cards,
        league_id: leagueSlug
    };

    // If game doesn't exist, insert it
    if (!matchedGame) {
        const nextGameIdStr = String((await matchesCol.countDocuments()) + 1);
        const matchday = event.season?.slug || event.week || 1;
        const newGame = {
            id: nextGameIdStr,
            local_date: event.date,
            stadium_id: "1",
            type: event.season?.type === 3 ? "knockout_16" : "group",
            group: String(matchday),
            matchday: String(matchday),
            ...updateDoc
        };
        await matchesCol.insertOne(newGame);
        dbGames.push(newGame);
        updated++;
        continue;
    }
    
    if (isLive || isFinished) {
        try {
            const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueSlug}/summary?event=${event.id}`;
            const sumRes = await fetch(summaryUrl, { signal: AbortSignal.timeout(8000) });
            if (sumRes.ok) {
                const summaryData = await sumRes.json();
                
                // Parse Scout
                const statistics = summaryData.boxscore?.teams;
                if (statistics && Array.isArray(statistics) && statistics.length === 2) {
                    const homeStats = statistics.find(s => String(s.team?.id) === String(homeCompetitor.team?.id))?.statistics || [];
                    const awayStats = statistics.find(s => String(s.team?.id) === String(awayCompetitor.team?.id))?.statistics || [];
                    
                    const scoutObj = {};
                    homeStats.forEach(hs => {
                        const as = awayStats.find(a => a.name === hs.name);
                        scoutObj[hs.name] = {
                            home: hs.displayValue,
                            away: as ? as.displayValue : "0"
                        };
                    });
                    updateDoc.scout = scoutObj;
                }

                // Parse Lineups
                const rosters = summaryData.rosters;
                const lineups = { home: [], away: [] };
                if (rosters && Array.isArray(rosters)) {
                    rosters.forEach(r => {
                        const side = String(r.team?.id) === String(homeCompetitor.team?.id) ? 'home' : 'away';
                        if (r.roster && Array.isArray(r.roster)) {
                            r.roster.forEach(player => {
                                lineups[side].push({
                                    name: player.athlete?.displayName || player.athlete?.shortName || "Jogador",
                                    jersey: player.jersey || "",
                                    position: player.position?.abbreviation || "",
                                    starter: player.starter === true,
                                    substitute: player.substitute === true
                                });
                            });
                        }
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
