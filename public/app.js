const API_BASE = '/get';

const state = {
    matches: [],
    groups: [],
    teams: [],
    stadiums: [],
    activeFilter: 'today',
    visibleMatchesCount: 15
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
    setupDetailsView();
    await fetchAllData();
    renderAll();
    spinner.style.display = 'none';

    // Auto-refresh a cada 10 segundos para ver os placares mudarem se estiverem rodando
    setInterval(async () => {
        await fetchAllData(true);
        // Se a tela de detalhes não estiver aberta, atualiza a lista de partidas
        if (document.getElementById('match-details-view').style.display !== 'block') {
            renderMatches();
        } else {
            // Se estiver aberta, atualiza a tela de detalhes
            if (state.activeDetailsMatchId) {
                showMatchDetails(state.activeDetailsMatchId);
            }
        }
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

            // Hide details view when shifting tabs
            document.getElementById('match-details-view').style.display = 'none';
            document.getElementById('matches-tab').style.display = 'block';
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
            state.visibleMatchesCount = 15; // Reset pagination
            
            // Hide details view when changing filter
            document.getElementById('match-details-view').style.display = 'none';
            document.getElementById('matches-tab').style.display = 'block';

            renderMatches();
        });
    });
}

function setupDetailsView() {
    const backBtn = document.getElementById('back-to-list-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            document.getElementById('match-details-view').style.display = 'none';
            document.getElementById('matches-tab').style.display = 'block';
        });
    }
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

function showMatchDetails(matchId) {
    state.activeDetailsMatchId = matchId; // Salva o ID ativo para auto-refresh
    const match = state.matches.find(m => m.id == matchId);
    if (!match) return;

    document.getElementById('matches-tab').style.display = 'none';
    document.getElementById('match-details-view').style.display = 'block';

    const stageTitle = match.type === 'group' ? 'Fase de Grupos' : (phaseTranslations[match.type] || 'Mata-Mata');
    document.getElementById('details-stage-title').innerText = stageTitle;

    const homeTeam = getTeamDetails(match.home_team_id, match.home_team_id === "0");
    const awayTeam = getTeamDetails(match.away_team_id, match.away_team_id === "0");
    
    if (match.home_team_label && match.home_team_id === "0") homeTeam.name_en = match.home_team_label;
    if (match.away_team_label && match.away_team_id === "0") awayTeam.name_en = match.away_team_label;

    // Date
    const dateObj = parseLocalDateToBrasilia(match.local_date, match.stadium_id);
    const dateStr = isNaN(dateObj.getTime()) ? match.local_date : dateObj.toLocaleString('pt-BR', { 
        weekday: 'long',
        day: '2-digit', 
        month: 'long', 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
    });

    const stadium = state.stadiums.find(s => s.id == match.stadium_id) || { name_en: 'Estádio Desconhecido', city_en: 'N/A', capacity: 0 };

    // Status Badge
    let statusHtml = '';
    if (match.finished === "TRUE") {
        statusHtml = `<span class="badge finished">Finalizado</span>`;
    } else if (match.time_elapsed === "Intervalo") {
        statusHtml = `<span class="badge halftime-badge"><i class="fa-solid fa-mug-hot"></i> Intervalo</span>`;
    } else if (match.time_elapsed !== "notstarted") {
        statusHtml = `<span class="badge live-badge"><span class="pulse-dot"></span> AO VIVO - ${match.time_elapsed}</span>`;
    } else {
        statusHtml = `<span class="badge upcoming">Não Iniciado</span>`;
    }

    // Scorers
    const homeScorers = parseScorers(match.home_scorers);
    const awayScorers = parseScorers(match.away_scorers);
    
    let scorersHtml = '';
    if (homeScorers.length > 0 || awayScorers.length > 0) {
        const homeList = homeScorers.map(s => `<div>${s} ⚽</div>`).join('');
        const awayList = awayScorers.map(s => `<div>⚽ ${s}</div>`).join('');
        scorersHtml = `
            <div class="details-scorers-card">
                <div class="scorers-list home-scorers-list">${homeList}</div>
                <div class="scorers-icon"><i class="fa-solid fa-futbol"></i></div>
                <div class="scorers-list away-scorers-list">${awayList}</div>
            </div>
        `;
    }

    const infoHtml = `
        <div class="details-info-section">
            <div class="info-row">
                <i class="fa-regular fa-calendar-days"></i>
                <div class="info-row-content">
                    <span class="info-row-label">Horário de Brasília</span>
                    <span class="info-row-value" style="text-transform: capitalize;">${dateStr}</span>
                </div>
            </div>
            <div class="info-row">
                <i class="fa-solid fa-location-dot"></i>
                <div class="info-row-content">
                    <span class="info-row-label">Estádio & Localização</span>
                    <span class="info-row-value">${stadium.name_en} (${stadium.city_en})</span>
                </div>
            </div>
            <div class="info-row">
                <i class="fa-solid fa-sitemap"></i>
                <div class="info-row-content">
                    <span class="info-row-label">Fase da Competição</span>
                    <span class="info-row-value">${match.type === 'group' ? `Fase de Grupos · Rodada ${match.matchday}` : (phaseTranslations[match.type] || 'Mata-Mata')}</span>
                </div>
            </div>
        </div>
    `;

    document.getElementById('match-details-content').innerHTML = `
        <div class="match-details-card">
            <div class="details-stage-info">${match.type === 'group' ? `Grupo ${match.group || ''}` : (phaseTranslations[match.type] || 'Mata-Mata')}</div>
            <div class="details-teams">
                <div class="details-team">
                    <img src="${homeTeam.flag}" alt="${homeTeam.name_en}" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/2/2f/Flag_of_the_United_Nations.svg'">
                    <span class="details-team-name">${homeTeam.name_en}</span>
                    <span class="details-team-code">${homeTeam.fifa_code || ''}</span>
                </div>
                <div class="details-score-area">
                    <div class="details-score">
                        ${match.time_elapsed === 'notstarted' ? 'VS' : `${match.home_score} - ${match.away_score}`}
                    </div>
                    <div class="details-status-badge">
                        ${statusHtml}
                    </div>
                </div>
                <div class="details-team">
                    <img src="${awayTeam.flag}" alt="${awayTeam.name_en}" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/2/2f/Flag_of_the_United_Nations.svg'">
                    <span class="details-team-name">${awayTeam.name_en}</span>
                    <span class="details-team-code">${awayTeam.fifa_code || ''}</span>
                </div>
            </div>
        </div>
        ${scorersHtml}
        ${infoHtml}
    `;
}

function renderMatches() {
    const container = document.getElementById('matches-list');
    container.innerHTML = '';

    const paginationArea = document.getElementById('pagination-area');
    paginationArea.innerHTML = '';
    
    let filteredMatches = state.matches;

    // Filters
    if (state.activeFilter === 'today') {
        const todayStr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        filteredMatches = state.matches.filter(m => {
            const dateObj = parseLocalDateToBrasilia(m.local_date, m.stadium_id);
            const matchDateStr = dateObj.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            return matchDateStr === todayStr;
        });
    } else if (state.activeFilter === 'live') {
        filteredMatches = state.matches.filter(m => m.finished !== "TRUE" && m.time_elapsed !== "notstarted");
    } else if (state.activeFilter === 'finished') {
        filteredMatches = state.matches.filter(m => m.finished === "TRUE");
    } else if (state.activeFilter === 'group') {
        filteredMatches = state.matches.filter(m => m.type === "group");
    } else if (state.activeFilter === 'knockout') {
        filteredMatches = state.matches.filter(m => m.type !== "group");
    }

    if (filteredMatches.length === 0) {
        if (state.activeFilter === 'today') {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 3rem 0; font-size: 1.05rem;">Nenhum jogo agendado para hoje.<br><span style="font-size: 0.9rem; opacity: 0.8; display: block; margin-top: 0.5rem">Vá em "Todos os Jogos" para conferir a tabela completa!</span></div>`;
        } else {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 3rem 0;">Nenhum jogo encontrado com este filtro.</div>`;
        }
        return;
    }

    // Sort chronologically by date/time
    filteredMatches.sort((a, b) => {
        return parseLocalDateToBrasilia(a.local_date, a.stadium_id) - parseLocalDateToBrasilia(b.local_date, b.stadium_id);
    });

    // Handle Pagination for non-live and non-today views
    const shouldPaginate = ['all', 'finished', 'group'].includes(state.activeFilter);
    const totalCount = filteredMatches.length;
    let matchesToShow = filteredMatches;
    
    if (shouldPaginate) {
        matchesToShow = filteredMatches.slice(0, state.visibleMatchesCount);
        
        if (totalCount > state.visibleMatchesCount) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.className = 'load-more-btn';
            loadMoreBtn.innerText = `Carregar Mais (${totalCount - state.visibleMatchesCount} restantes)`;
            loadMoreBtn.addEventListener('click', () => {
                state.visibleMatchesCount += 15;
                renderMatches();
            });
            paginationArea.appendChild(loadMoreBtn);
        }
    }

    // Grouping
    const groups = [];
    let currentGroup = null;

    matchesToShow.forEach(match => {
        let groupKey = '';
        if (state.activeFilter === 'knockout') {
            groupKey = phaseTranslations[match.type] || 'Mata-Mata';
        } else {
            const dateObj = parseLocalDateToBrasilia(match.local_date, match.stadium_id);
            const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' }).substring(0, 3).toUpperCase().replace(/\./g, '');
            const day = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', timeZone: 'America/Sao_Paulo' });
            const month = dateObj.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'America/Sao_Paulo' }).substring(0, 3).toUpperCase().replace(/\./g, '');
            groupKey = `${weekday} ${day} ${month}`;
        }
        
        if (!currentGroup || currentGroup.header !== groupKey) {
            currentGroup = { header: groupKey, matches: [] };
            groups.push(currentGroup);
        }
        currentGroup.matches.push(match);
    });

    // Render grouped matches
    groups.forEach(group => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'date-group';
        
        groupDiv.innerHTML = `
            <div class="date-group-header">
                <h3>${group.header}</h3>
                <span class="date-group-count">${group.matches.length} ${group.matches.length === 1 ? 'jogo' : 'jogos'}</span>
            </div>
        `;

        group.matches.forEach(match => {
            const homeTeam = getTeamDetails(match.home_team_id, match.home_team_id === "0");
            const awayTeam = getTeamDetails(match.away_team_id, match.away_team_id === "0");
            
            if (match.home_team_label && match.home_team_id === "0") homeTeam.name_en = match.home_team_label;
            if (match.away_team_label && match.away_team_id === "0") awayTeam.name_en = match.away_team_label;

            const dateObj = parseLocalDateToBrasilia(match.local_date, match.stadium_id);
            const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
            
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

            const stageText = match.type === 'group' ? (match.group ? `Grupo ${match.group}` : 'Grupo') : (phaseTranslations[match.type] || 'Mata-Mata');

            // Status Badge
            let statusHtml = '';
            if (match.finished === "TRUE") {
                statusHtml = `<span class="badge finished">FT</span>`;
            } else if (match.time_elapsed === "Intervalo") {
                statusHtml = `<span class="badge halftime-badge"><i class="fa-solid fa-mug-hot"></i> INT</span>`;
            } else if (match.time_elapsed !== "notstarted") {
                statusHtml = `<span class="badge live-badge"><span class="pulse-dot"></span> ${match.time_elapsed}</span>`;
            } else if (isSoon) {
                statusHtml = `<span class="badge upcoming-soon" title="${soonText}"><i class="fa-solid fa-hourglass-start"></i> ${timeStr}</span>`;
            } else {
                statusHtml = `<span class="badge upcoming"><i class="fa-regular fa-clock"></i> ${timeStr}</span>`;
            }

            const hasStarted = match.time_elapsed !== "notstarted";
            const homeScore = !hasStarted ? '' : ((match.home_score === null || match.home_score === 'null' || match.home_score === undefined) ? '0' : match.home_score);
            const awayScore = !hasStarted ? '' : ((match.away_score === null || match.away_score === 'null' || match.away_score === undefined) ? '0' : match.away_score);

            const matchItem = document.createElement('div');
            matchItem.className = 'match-list-item';
            matchItem.addEventListener('click', () => showMatchDetails(match.id));

            matchItem.innerHTML = `
                <div class="match-list-meta">
                    <span class="phase" title="${stageText}">${stageText}</span>
                    <span class="time">${timeStr}</span>
                </div>
                <div class="match-list-teams">
                    <div class="match-list-team">
                        <div class="match-team-info">
                            <img src="${homeTeam.flag}" alt="${homeTeam.name_en}" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/2/2f/Flag_of_the_United_Nations.svg'">
                            <span>${homeTeam.name_en}</span>
                        </div>
                        <div class="match-list-score">${homeScore}</div>
                    </div>
                    <div class="match-list-team">
                        <div class="match-team-info">
                            <img src="${awayTeam.flag}" alt="${awayTeam.name_en}" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/2/2f/Flag_of_the_United_Nations.svg'">
                            <span>${awayTeam.name_en}</span>
                        </div>
                        <div class="match-list-score">${awayScore}</div>
                    </div>
                </div>
                <div class="match-list-status">
                    ${statusHtml}
                </div>
            `;
            groupDiv.appendChild(matchItem);
        });
        container.appendChild(groupDiv);
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
                    <td><strong>${t.pts || 0}</strong></td>
                    <td>${t.mp || 0}</td>
                    <td>${t.w || 0}</td>
                    <td>${t.d || 0}</td>
                    <td>${t.l || 0}</td>
                    <td>${t.gf || 0}</td>
                    <td>${t.ga || 0}</td>
                    <td>${t.gd || 0}</td>
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
                        <th>J</th>
                        <th>V</th>
                        <th>E</th>
                        <th>D</th>
                        <th>GP</th>
                        <th>GC</th>
                        <th>SG</th>
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

    // Group teams by group name
    const grouped = {};
    state.teams.forEach(team => {
        const gName = team.groups || 'Outros';
        if (!grouped[gName]) grouped[gName] = [];
        grouped[gName].push(team);
    });

    // Sort group names (A-L)
    const sortedGroups = Object.keys(grouped).sort();

    sortedGroups.forEach(gName => {
        const groupSection = document.createElement('div');
        groupSection.style.gridColumn = '1/-1';
        groupSection.style.marginTop = '1.5rem';
        groupSection.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
        groupSection.style.paddingBottom = '0.5rem';
        groupSection.innerHTML = `<h3 style="font-weight: 800; letter-spacing: 1px; color: var(--accent-color)">GRUPO ${gName}</h3>`;
        container.appendChild(groupSection);

        grouped[gName].forEach(team => {
            const card = document.createElement('div');
            card.className = 'glass-card';
            card.style.display = 'flex';
            card.style.alignItems = 'center';
            card.style.gap = '1rem';
            card.style.padding = '1rem';
            card.style.transition = 'transform 0.2s ease, border-color 0.2s ease';
            
            card.innerHTML = `
                <img src="${team.flag}" style="width: 50px; height: 35px; border-radius: 4px; object-fit: cover; border: 1px solid var(--glass-border); box-shadow: 0 2px 5px rgba(0,0,0,0.3);" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/2/2f/Flag_of_the_United_Nations.svg'">
                <div>
                    <h4 style="font-weight: 800; font-size: 1rem; margin-bottom: 0.15rem;">${team.name_en}</h4>
                    <span style="font-size: 0.75rem; color: var(--text-secondary)">Código FIFA: <strong>${team.fifa_code}</strong></span>
                </div>
            `;
            container.appendChild(card);
        });
    });
}

function renderStadiums() {
    const container = document.getElementById('stadiums-grid');
    container.innerHTML = '';

    // Calculate Stats
    const totalStadiums = state.stadiums.length;
    const totalCapacity = state.stadiums.reduce((acc, curr) => acc + (parseInt(curr.capacity) || 0), 0);
    const countryDistribution = {};
    state.stadiums.forEach(s => {
        const country = s.country_en || 'Desconhecido';
        countryDistribution[country] = (countryDistribution[country] || 0) + 1;
    });

    // Render Stats Card
    const statsCard = document.createElement('div');
    statsCard.className = 'glass-card';
    statsCard.style.gridColumn = '1/-1';
    statsCard.style.background = 'linear-gradient(135deg, rgba(56, 189, 248, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)';
    statsCard.style.border = '1px solid rgba(56, 189, 248, 0.2)';
    statsCard.style.padding = '1.5rem 2rem';
    statsCard.style.display = 'grid';
    statsCard.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
    statsCard.style.gap = '1.5rem';
    statsCard.style.marginBottom = '1rem';

    statsCard.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <span style="font-size:0.75rem; text-transform:uppercase; color:var(--text-secondary); font-weight:800; letter-spacing:1px">Total de Sedes</span>
            <span style="font-size:1.8rem; font-weight:800; color:var(--accent-color)">${totalStadiums} Estádios</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <span style="font-size:0.75rem; text-transform:uppercase; color:var(--text-secondary); font-weight:800; letter-spacing:1px">Capacidade Total</span>
            <span style="font-size:1.8rem; font-weight:800; color:#fff">${totalCapacity.toLocaleString('pt-BR')} assentos</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <span style="font-size:0.75rem; text-transform:uppercase; color:var(--text-secondary); font-weight:800; letter-spacing:1px">Distribuição</span>
            <span style="font-size:1rem; font-weight:600; color:var(--text-primary); margin-top:0.3rem">
                🇺🇸 EUA: ${countryDistribution['United States'] || 0} | 🇲🇽 MEX: ${countryDistribution['Mexico'] || 0} | 🇨🇦 CAN: ${countryDistribution['Canada'] || 0}
            </span>
        </div>
    `;
    container.appendChild(statsCard);

    // Render individual stadiums
    state.stadiums.forEach(stadium => {
        const card = document.createElement('div');
        card.className = 'glass-card';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.justifyContent = 'space-between';
        card.style.transition = 'transform 0.2s ease, border-color 0.2s ease';
        
        const flagEmoji = stadium.country_en === 'United States' ? '🇺🇸' : (stadium.country_en === 'Mexico' ? '🇲🇽' : '🇨🇦');

        card.innerHTML = `
            <div>
                <h3 style="color: var(--accent-color); font-weight: 800; font-size: 1.15rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                    ${stadium.name_en}
                    <span style="font-size:1.2rem" title="${stadium.country_en}">${flagEmoji}</span>
                </h3>
                <div style="font-size: 0.85rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 0.5rem">
                    <span><i class="fa-solid fa-location-dot" style="width:16px; color:var(--accent-color)"></i> Local: <strong>${stadium.city_en}</strong></span>
                    <span><i class="fa-solid fa-users" style="width:16px; color:var(--accent-color)"></i> Capacidade: <strong>${stadium.capacity ? stadium.capacity.toLocaleString('pt-BR') : 'N/A'}</strong></span>
                    <span><i class="fa-solid fa-futbol" style="width:16px; color:var(--accent-color)"></i> Nome FIFA: <strong>${stadium.fifa_name}</strong></span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', init);
