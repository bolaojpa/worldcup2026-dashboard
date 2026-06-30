const API_BASE = '/get';

const state = {
    matches: [],
    groups: [],
    teams: [],
    stadiums: [],
    activeFilter: 'all'
};

// Elements
const spinner = document.getElementById('loading-spinner');
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Mapeamento de fusos horários de cada estádio para converter para Brasília de forma precisa
const stadiumOffsets = {
    "1": "-06:00", // Estadio Azteca (CST)
    "2": "-06:00", // Estadio Akron (CST)
    "3": "-06:00", // Estadio BBVA (CST)
    "4": "-05:00", // AT&T Stadium (CDT)
    "5": "-05:00", // NRG Stadium (CDT)
    "6": "-05:00", // Kansas City (CDT)
    "7": "-04:00", // Atlanta (EDT)
    "8": "-04:00", // Miami (EDT)
    "9": "-04:00", // Boston (EDT)
    "10": "-04:00", // Philadelphia (EDT)
    "11": "-04:00", // New York (EDT)
    "12": "-04:00", // Toronto (EDT)
    "13": "-07:00", // Vancouver (PDT)
    "14": "-07:00", // Seattle (PDT)
    "15": "-07:00", // San Francisco (PDT)
    "16": "-07:00"  // Los Angeles (PDT)
};

// Converte a hora local do estádio para um objeto Date real com offset correto
function parseLocalDateToBrasilia(localDateStr, stadiumId) {
    try {
        if (!localDateStr) return new Date();
        const parts = localDateStr.trim().split(' ');
        if (parts.length !== 2) return new Date(localDateStr);
        
        const dateParts = parts[0].split('/'); // MM/DD/YYYY
        if (dateParts.length !== 3) return new Date(localDateStr);
        
        const month = dateParts[0];
        const day = dateParts[1];
        const year = dateParts[2];
        const time = parts[1];
        
        const offset = stadiumOffsets[stadiumId] || "-03:00"; 
        
        const isoStr = `${year}-${month}-${day}T${time}:00${offset}`;
        return new Date(isoStr);
    } catch (e) {
        console.error('Erro ao converter data:', e);
        return new Date(localDateStr);
    }
}

// Tradução das fases da copa
const phaseTranslations = {
    'group': 'Fase de Grupos',
    'r32': '16 avos de Final',
    'r16': 'Oitavas de Final',
    'qf': 'Quartas de Final',
    'sf': 'Semifinal',
    'third': 'Disputa de 3º Lugar',
    'final': 'Final'
};

// Função para parsear a lista de goleadores (Postgres array format)
function parseScorers(scorers) {
    if (!scorers || scorers === 'null' || scorers === 'undefined') return [];
    try {
        let clean = scorers.trim();
        if (clean.startsWith('{')) clean = clean.substring(1);
        if (clean.endsWith('}')) clean = clean.slice(0, -1);
        if (!clean) return [];
        
        const list = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < clean.length; i++) {
            const char = clean[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                list.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
            } else {
                current += char;
            }
        }
        if (current) {
            list.push(current.trim().replace(/^"|"$/g, ''));
        }
        return list;
    } catch (e) {
        console.error(e);
        return [];
    }
}

// Init
async function init() {
    setupTabs();
    setupFilters();
    await fetchAllData();
    renderAll();
    spinner.style.display = 'none';

    // Auto-refresh a cada 10 segundos para ver os placares mudarem se estiverem rodando
    setInterval(async () => {
        await fetchAllData(true);
        renderMatches();
        renderGroups();
    }, 10000);
}

function setupTabs() {
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
        });
    });
}

function setupFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeFilter = btn.dataset.filter;
            renderMatches();
        });
    });
}

async function fetchAllData(silent = false) {
    if (!silent) spinner.style.display = 'flex';
    try {
        const [mRes, gRes, tRes, sRes] = await Promise.all([
            fetch(`${API_BASE}/games`),
            fetch(`${API_BASE}/groups`),
            fetch(`${API_BASE}/teams`),
            fetch(`${API_BASE}/stadiums`)
        ]);

        const mData = await mRes.json();
        const gData = await gRes.json();
        const tData = await tRes.json();
        const sData = await sRes.json();

        state.matches = mData.games || [];
        state.groups = gData.groups || [];
        state.teams = Array.isArray(tData) ? tData : (tData.teams || []);
        state.stadiums = Array.isArray(sData) ? sData : (sData.stadiums || []);
        
    } catch (err) {
        console.error('Error fetching data:', err);
    } finally {
        if (!silent) spinner.style.display = 'none';
    }
}

function getTeamDetails(teamIdOrLabel, isLabel = false) {
    if (isLabel || teamIdOrLabel === "0") {
        return { name_en: teamIdOrLabel === "0" ? "A Definir" : teamIdOrLabel, flag: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Flag_of_the_United_Nations.svg' };
    }
    return state.teams.find(t => t.id == teamIdOrLabel) || { name_en: "A Definir", flag: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Flag_of_the_United_Nations.svg' };
}

function renderAll() {
    renderMatches();
    renderGroups();
    renderTeams();
    renderStadiums();
}

function renderMatches() {
    const container = document.getElementById('matches-grid');
    container.innerHTML = '';
    
    let filteredMatches = state.matches;
    if (state.activeFilter === 'live') {
        filteredMatches = state.matches.filter(m => m.finished !== "TRUE" && m.time_elapsed !== "notstarted");
    } else if (state.activeFilter === 'finished') {
        filteredMatches = state.matches.filter(m => m.finished === "TRUE");
    } else if (state.activeFilter === 'group') {
        filteredMatches = state.matches.filter(m => m.type === "group");
    } else if (state.activeFilter === 'knockout') {
        filteredMatches = state.matches.filter(m => m.type !== "group");
    }

    if (filteredMatches.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 3rem 0;">Nenhum jogo encontrado com este filtro.</div>`;
        return;
    }
    
    filteredMatches.forEach(match => {
        const homeTeam = getTeamDetails(match.home_team_id, match.home_team_id === "0");
        const awayTeam = getTeamDetails(match.away_team_id, match.away_team_id === "0");
        
        if (match.home_team_label && match.home_team_id === "0") homeTeam.name_en = match.home_team_label;
        if (match.away_team_label && match.away_team_id === "0") awayTeam.name_en = match.away_team_label;

        // Conversão de fuso horário automática para o Horário de Brasília considerando o estádio
        const dateObj = parseLocalDateToBrasilia(match.local_date, match.stadium_id);
        const dateStr = isNaN(dateObj.getTime()) ? match.local_date : dateObj.toLocaleString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo'
        });
        
        // Verifica se a partida começará nas próximas 3 horas para exibir contagem regressiva
        const diffMs = dateObj.getTime() - Date.now();
        const diffMins = Math.floor(diffMs / 60000);
        const isSoon = diffMs > 0 && diffMins <= 180;
        let soonText = '';
        if (isSoon) {
            if (diffMins < 60) {
                soonText = `Começa em ${diffMins} min`;
            } else {
                const hours = Math.floor(diffMins / 60);
                const mins = diffMins % 60;
                soonText = `Começa em ${hours}h ${mins}m`;
            }
        }
        
        // Find Stadium
        const stadium = state.stadiums.find(s => s.id == match.stadium_id) || { name_en: 'Estádio Desconhecido' };
        
        // Phase string
        const phase = phaseTranslations[match.type] || (match.group ? `Grupo ${match.group}` : 'Mata-Mata');
        
        // Scorers
        const homeScorers = parseScorers(match.home_scorers);
        const awayScorers = parseScorers(match.away_scorers);
        
        const homeScorersHtml = homeScorers.map(s => `<div>⚽ ${s}</div>`).join('');
        const awayScorersHtml = awayScorers.map(s => `<div>⚽ ${s}</div>`).join('');
        
        // Check if the match has started (either live or finished)
        const hasStarted = match.time_elapsed !== "notstarted";

        // Penalties (only show if started, knockout, and actually have numeric/non-null scores)
        const isPenalty = hasStarted && 
                          match.home_penalty_score !== null && 
                          match.home_penalty_score !== 'null' && 
                          match.home_penalty_score !== undefined && 
                          match.away_penalty_score !== null && 
                          match.away_penalty_score !== 'null' && 
                          match.away_penalty_score !== undefined;
        const penaltyHtml = isPenalty ? `<div class="penalty-score">(Pên: ${match.home_penalty_score} - ${match.away_penalty_score})</div>` : '';

        // Dynamically compute the score text or VS
        let scoreHtml = '';
        if (!hasStarted) {
            scoreHtml = `<div class="score-vs" style="font-size: 1.1rem; font-weight: 600; color: var(--text-secondary); opacity: 0.8; letter-spacing: 2px;">VS</div>`;
        } else {
            const homeScore = (match.home_score === null || match.home_score === 'null' || match.home_score === undefined) ? '0' : match.home_score;
            const awayScore = (match.away_score === null || match.away_score === 'null' || match.away_score === undefined) ? '0' : match.away_score;
            scoreHtml = `<div class="score">${homeScore} - ${awayScore}</div>`;
        }
        
        // Status Badge
        let statusHtml = '';
        if (match.finished === "TRUE") {
            statusHtml = `<span class="badge finished">Finalizado</span>`;
        } else if (match.time_elapsed === "Intervalo") {
            statusHtml = `<span class="badge halftime-badge"><i class="fa-solid fa-mug-hot"></i> Intervalo</span>`;
        } else if (match.time_elapsed !== "notstarted") {
            statusHtml = `<span class="badge live-badge"><span class="pulse-dot"></span> AO VIVO - ${match.time_elapsed}</span>`;
        } else if (isSoon) {
            const timePart = dateStr.split(',')[1] ? dateStr.split(',')[1].trim() : dateStr.split(' ')[1];
            statusHtml = `<span class="badge upcoming-soon" title="Horário de Brasília: ${dateStr}"><i class="fa-solid fa-hourglass-start"></i> ${soonText} (${timePart})</span>`;
        } else {
            statusHtml = `<span class="badge upcoming"><i class="fa-regular fa-clock"></i> ${dateStr}</span>`;
        }

        const card = document.createElement('div');
        card.className = 'glass-card';
        card.innerHTML = `
            <div class="match-header">
                <span class="badge phase">${phase}</span>
                <span class="badge matchday">Rodada ${match.matchday || ''}</span>
            </div>
            <div class="match-teams-grid">
                <img class="team-flag home-flag" src="${homeTeam.flag}" alt="${homeTeam.name_en}" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/2/2f/Flag_of_the_United_Nations.svg'">
                
                <div class="score-container">
                    ${scoreHtml}
                    ${penaltyHtml}
                </div>
                
                <img class="team-flag away-flag" src="${awayTeam.flag}" alt="${awayTeam.name_en}" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/2/2f/Flag_of_the_United_Nations.svg'">
                
                <span class="team-name home-name">${homeTeam.name_en}</span>
                <span></span>
                <span class="team-name away-name">${awayTeam.name_en}</span>
            </div>
            <div class="match-scorers">
                <div class="scorers home-scorers">${homeScorersHtml}</div>
                <div class="scorers away-scorers">${awayScorersHtml}</div>
            </div>
            <div class="match-footer">
                <div class="stadium-info" title="${stadium.name_en}">
                    <i class="fa-solid fa-location-dot"></i> ${stadium.name_en}
                </div>
                <div class="status-info">
                    ${statusHtml}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderGroups() {
    const container = document.getElementById('groups-grid');
    container.innerHTML = '';
    
    state.groups.forEach(group => {
        const card = document.createElement('div');
        card.className = 'glass-card';
        
        let tableRows = '';
        group.teams.forEach((t, index) => {
            const team = getTeamDetails(t.team_id);
            tableRows += `
                <tr>
                    <td>
                        <span style="color:var(--text-secondary); width:15px; display:inline-block">${index+1}</span>
                        <img src="${team.flag}" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/2/2f/Flag_of_the_United_Nations.svg'">
                        ${team.name_en}
                    </td>
                    <td>${t.pts || 0}</td>
                    <td>${t.gf || 0}</td>
                    <td>${t.ga || 0}</td>
                </tr>
            `;
        });

        card.innerHTML = `
            <h3 style="margin-bottom: 1rem; color: var(--accent-color)">Grupo ${group.group}</h3>
            <table class="group-table">
                <thead>
                    <tr>
                        <th>Seleção</th>
                        <th>Pts</th>
                        <th>GP</th>
                        <th>GC</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        `;
        container.appendChild(card);
    });
}

function renderTeams() {
    const container = document.getElementById('teams-grid');
    container.innerHTML = '';
    
    state.teams.forEach(team => {
        const card = document.createElement('div');
        card.className = 'glass-card';
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.gap = '1rem';
        
        card.innerHTML = `
            <img src="${team.flag}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid var(--glass-border);" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/2/2f/Flag_of_the_United_Nations.svg'">
            <div>
                <h3 style="margin-bottom: 0.2rem;">${team.name_en}</h3>
                <span style="font-size: 0.85rem; color: var(--text-secondary)">Grupo ${team.groups} | Código: ${team.fifa_code}</span>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderStadiums() {
    const container = document.getElementById('stadiums-grid');
    container.innerHTML = '';
    
    state.stadiums.forEach(stadium => {
        const card = document.createElement('div');
        card.className = 'glass-card';
        card.innerHTML = `
            <h3 style="color: var(--accent-color); margin-bottom: 0.5rem">${stadium.name_en}</h3>
            <div style="font-size: 0.9rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 0.3rem">
                <span><i class="fa-solid fa-location-dot"></i> ${stadium.city_en}, ${stadium.country_en}</span>
                <span><i class="fa-solid fa-users"></i> Capacidade: ${stadium.capacity ? stadium.capacity.toLocaleString() : 'N/A'}</span>
                <span><i class="fa-solid fa-futbol"></i> Nome FIFA: ${stadium.fifa_name}</span>
            </div>
        `;
        container.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', init);
