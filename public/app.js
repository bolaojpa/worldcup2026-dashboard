const API_BASE = '/get';

const teamTranslations = {
    "Mexico": "México",
    "South Africa": "África do Sul",
    "South Korea": "Coreia do Sul",
    "Czech Republic": "República Tcheca",
    "Canada": "Canadá",
    "Bosnia and Herzegovina": "Bósnia e Herzegovina",
    "Qatar": "Catar",
    "Switzerland": "Suíça",
    "Brazil": "Brasil",
    "Morocco": "Marrocos",
    "Haiti": "Haiti",
    "Scotland": "Escócia",
    "United States": "Estados Unidos",
    "Paraguay": "Paraguai",
    "Australia": "Austrália",
    "Turkey": "Turquia",
    "Germany": "Alemanha",
    "Curaçao": "Curaçao",
    "Ivory Coast": "Costa do Marfim",
    "Ecuador": "Equador",
    "Netherlands": "Holanda",
    "Japan": "Japão",
    "Sweden": "Suécia",
    "Tunisia": "Tunísia",
    "Belgium": "Bélgica",
    "Egypt": "Egito",
    "Iran": "Irã",
    "New Zealand": "Nova Zelândia",
    "Spain": "Espanha",
    "Cape Verde": "Cabo Verde",
    "Saudi Arabia": "Arábia Saudita",
    "Uruguay": "Uruguai",
    "France": "França",
    "Senegal": "Senegal",
    "Iraq": "Iraque",
    "Norway": "Noruega",
    "Argentina": "Argentina",
    "Algeria": "Argélia",
    "Austria": "Áustria",
    "Jordan": "Jordânia",
    "Portugal": "Portugal",
    "Democratic Republic of the Congo": "RD Congo",
    "Uzbekistan": "Uzbequistão",
    "Colombia": "Colômbia",
    "England": "Inglaterra",
    "Croatia": "Croácia",
    "Ghana": "Gana",
    "Panama": "Panamá"
};

function translateTeamName(name) {
    if (!name) return name;
    if (teamTranslations[name]) {
        return teamTranslations[name];
    }
    let translated = name;
    translated = translated.replace(/Winner Match (\d+)/gi, 'Vencedor Jogo $1');
    translated = translated.replace(/Winner Group (\w)/gi, 'Vencedor Grupo $1');
    translated = translated.replace(/Runner-up Group (\w)/gi, '2º Colocado Grupo $1');
    translated = translated.replace(/3rd Group ([\w\/]+)/gi, '3º Colocado Grupo $1');
    return translated;
}

const state = {
    matches: [],
    groups: [],
    teams: [],
    stadiums: [],
    activeFilter: 'today',
    visibleMatchesCount: 15,
    selectedGroupFilter: null
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

// Retorna o tempo do jogo vindo da API
function getLiveTimeText(match) {
    if (!match.time_elapsed || match.time_elapsed === 'notstarted') return '';
    
    const cleanElapsed = (match.time_elapsed || "").trim().toLowerCase();
    if (cleanElapsed === 'live') {
        return 'AO VIVO';
    }
    if (cleanElapsed === 'intervalo') {
        return 'Intervalo';
    }
    return match.time_elapsed; // Retorna exatamente o tempo da API (ex: "45+'", "67'")
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
    setupHamburger();
    setupTabs();
    setupFilters();
    setupDetailsView();
    handleResponsiveLayout();
    window.addEventListener('resize', handleResponsiveLayout);
    await fetchAllData();
    renderAll();
    spinner.style.display = 'none';

    // Auto-refresh a cada 10 segundos para ver os placares mudarem se estiverem rodando
    setInterval(async () => {
        await fetchAllData(true);
        renderMatches();
        renderGroups();
        renderBracket();

        // Se a tela de detalhes (modal) estiver aberta, atualiza a tela de detalhes
        if (state.activeDetailsMatchId) {
            showMatchDetails(state.activeDetailsMatchId);
        }
    }, 10000);
}

function handleResponsiveLayout() {
    const navTabs = document.getElementById('nav-tabs');
    const header = document.querySelector('.glass-header');
    if (!navTabs || !header) return;

    if (window.innerWidth <= 768) {
        if (navTabs.parentNode !== document.body) {
            document.body.appendChild(navTabs);
        }
    } else {
        if (navTabs.parentNode !== header) {
            header.appendChild(navTabs);
        }
    }
}

function setupHamburger() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const navTabs = document.getElementById('nav-tabs');
    if (hamburgerBtn && navTabs) {
        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navTabs.classList.toggle('open');
        });
        
        // Fechar ao clicar no botão 'X' de fechar a lateral
        const closeBtn = navTabs.querySelector('.drawer-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                navTabs.classList.remove('open');
            });
        }
        
        // Fechar ao clicar em qualquer aba
        const tabBtns = navTabs.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                navTabs.classList.remove('open');
            });
        });

        // Fechar ao clicar fora
        document.addEventListener('click', (e) => {
            if (!navTabs.contains(e.target) && e.target !== hamburgerBtn) {
                navTabs.classList.remove('open');
            }
        });
    }
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
    const mobileSelect = document.getElementById('mobile-filter-select');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeFilter = btn.dataset.filter;
            state.selectedGroupFilter = null; // Reseta filtro de grupo específico ao trocar de filtro
            state.visibleMatchesCount = 15; // Reset pagination

            if (mobileSelect) mobileSelect.value = btn.dataset.filter;

            renderMatches();
        });
    });

    if (mobileSelect) {
        mobileSelect.addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            state.activeFilter = selectedValue;
            state.selectedGroupFilter = null;
            state.visibleMatchesCount = 15;

            // Sincronizar botões desktop
            filterBtns.forEach(btn => {
                if (btn.dataset.filter === selectedValue) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            renderMatches();
        });
    }
}

function setupDetailsView() {
    const modal = document.getElementById('match-details-modal');
    const closeBtn = document.getElementById('close-modal-btn');
    if (closeBtn && modal) {
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
            state.activeDetailsMatchId = null; // Limpa ID ativo
        };

        closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }
}

async function fetchAllData(silent = false) {
    if (!silent) spinner.style.display = 'flex';
    try {
        const cacheBuster = Math.floor(Date.now() / 15000);
        const [mRes, gRes, tRes, sRes] = await Promise.all([
            fetch(`${API_BASE}/games?t=${cacheBuster}`),
            fetch(`${API_BASE}/groups?t=${cacheBuster}`),
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
        state.teams.forEach(team => {
            if (team.name_en) {
                team.name_en = translateTeamName(team.name_en);
            }
        });
        state.stadiums = Array.isArray(sData) ? sData : (sData.stadiums || []);
        
    } catch (err) {
        console.error('Error fetching data:', err);
    } finally {
        if (!silent) spinner.style.display = 'none';
    }
}

function getTeamDetails(teamIdOrLabel, isLabel = false) {
    if (isLabel || teamIdOrLabel === "0") {
        return { name_en: teamIdOrLabel === "0" ? "A Definir" : translateTeamName(teamIdOrLabel), flag: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Flag_of_the_United_Nations.svg' };
    }
    return state.teams.find(t => t.id == teamIdOrLabel) || { name_en: "A Definir", flag: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Flag_of_the_United_Nations.svg' };
}

function renderAll() {
    renderMatches();
    renderGroups();
    renderTeams();
    renderStadiums();
    renderBracket();
}

function determineWinner(match) {
    if (match.finished !== "TRUE") return { isHomeWinner: false, isAwayWinner: false, isDraw: false };

    const homeScoreNum = parseInt(match.home_score) || 0;
    const awayScoreNum = parseInt(match.away_score) || 0;
    const homePenNum = parseInt(match.home_penalty_score) || 0;
    const awayPenNum = parseInt(match.away_penalty_score) || 0;
    
    // 1. Verificar winner_team_id
    if (match.winner_team_id && match.winner_team_id !== "0" && match.winner_team_id !== "null") {
        if (match.winner_team_id == match.home_team_id) {
            return { isHomeWinner: true, isAwayWinner: false, isDraw: false };
        }
        if (match.winner_team_id == match.away_team_id) {
            return { isHomeWinner: false, isAwayWinner: true, isDraw: false };
        }
    }

    // 2. Verificar pênaltis
    if (homePenNum !== 0 || awayPenNum !== 0) {
        if (homePenNum > awayPenNum) {
            return { isHomeWinner: true, isAwayWinner: false, isDraw: false };
        }
        if (awayPenNum > homePenNum) {
            return { isHomeWinner: false, isAwayWinner: true, isDraw: false };
        }
    }

    // 3. Verificar tempo normal
    if (homeScoreNum > awayScoreNum) {
        return { isHomeWinner: true, isAwayWinner: false, isDraw: false };
    }
    if (awayScoreNum > homeScoreNum) {
        return { isHomeWinner: false, isAwayWinner: true, isDraw: false };
    }

    return { isHomeWinner: false, isAwayWinner: false, isDraw: true };
}

function showMatchDetails(matchId) {
    state.activeDetailsMatchId = matchId; // Salva o ID ativo para auto-refresh
    const match = state.matches.find(m => m.id == matchId);
    if (!match) return;

    const stageTitle = match.type === 'group' ? (match.group ? `Fase de Grupos - Grupo ${match.group}` : 'Fase de Grupos') : (phaseTranslations[match.type] || 'Mata-Mata');
    const modalTitleEl = document.getElementById('modal-stage-title');
    if (modalTitleEl) modalTitleEl.innerText = stageTitle;

    const homeTeam = getTeamDetails(match.home_team_id, match.home_team_id === "0");
    const awayTeam = getTeamDetails(match.away_team_id, match.away_team_id === "0");
    
    if (match.home_team_label && match.home_team_id === "0") homeTeam.name_en = translateTeamName(match.home_team_label);
    if (match.away_team_label && match.away_team_id === "0") awayTeam.name_en = translateTeamName(match.away_team_label);

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
    } else {
        const elapsedText = getLiveTimeText(match);
        if (elapsedText === 'Intervalo') {
            statusHtml = `<span class="badge halftime-badge"><i class="fa-solid fa-mug-hot"></i> Intervalo</span>`;
        } else if (elapsedText === 'AO VIVO') {
            statusHtml = `<span class="badge live-badge"><span class="pulse-dot"></span> AO VIVO</span>`;
        } else if (elapsedText) {
            statusHtml = `<span class="badge live-badge"><span class="pulse-dot"></span> AO VIVO - ${elapsedText}</span>`;
        } else {
            statusHtml = `<span class="badge upcoming">Não Iniciado</span>`;
        }
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

    const displayHomeScore = match.time_elapsed === 'notstarted' ? '' : (match.home_score || 0);
    const displayAwayScore = match.time_elapsed === 'notstarted' ? '' : (match.away_score || 0);
    const hasPenalties = match.home_penalty_score && match.home_penalty_score !== 'null' && match.home_penalty_score !== '';

    document.getElementById('match-details-content').innerHTML = `
        <div class="match-details-card">
            <div class="details-stage-info">${match.type === 'group' ? `Grupo ${match.group || ''}` : (phaseTranslations[match.type] || 'Mata-Mata')}</div>
            <div class="details-teams">
                <div class="details-team">
                    <img src="${homeTeam.flag}" alt="${homeTeam.name_en}" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/2/2f/Flag_of_the_United_Nations.svg'">
                    <span class="details-team-mobile-fallback">${homeTeam.fifa_code || homeTeam.name_en}</span>
                </div>
                <div class="details-score-area">
                    <div class="details-score">
                        ${match.time_elapsed === 'notstarted' ? 'VS' : `${displayHomeScore} - ${displayAwayScore}`}
                    </div>
                    ${hasPenalties ? `<div class="details-penalties" style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.25rem;">Pênaltis: ${match.home_penalty_score} - ${match.away_penalty_score}</div>` : ''}
                </div>
                <div class="details-team">
                    <img src="${awayTeam.flag}" alt="${awayTeam.name_en}" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/2/2f/Flag_of_the_United_Nations.svg'">
                    <span class="details-team-mobile-fallback">${awayTeam.fifa_code || awayTeam.name_en}</span>
                </div>
            </div>
            <div class="details-status-badge">
                ${statusHtml}
            </div>
        </div>
        ${scorersHtml}
        ${infoHtml}
    `;

    const modal = document.getElementById('match-details-modal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
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
        filteredMatches = state.matches.filter(m => 
            m.finished !== "TRUE" && 
            m.finished !== true && 
            m.time_elapsed !== "notstarted" && 
            m.time_elapsed !== "finished" && 
            m.time_elapsed !== "Finished"
        );
    } else if (state.activeFilter === 'finished') {
        filteredMatches = state.matches.filter(m => m.finished === "TRUE");
    } else if (state.activeFilter === 'group') {
        if (state.selectedGroupFilter) {
            filteredMatches = state.matches.filter(m => m.type === "group" && m.group === state.selectedGroupFilter);
        } else {
            filteredMatches = state.matches.filter(m => m.type === "group");
        }
    } else if (state.activeFilter === 'knockout') {
        filteredMatches = state.matches.filter(m => m.type !== "group");
    }

    // Render info header if filtered by a specific group
    if (state.activeFilter === 'group' && state.selectedGroupFilter) {
        const infoHeader = document.createElement('div');
        infoHeader.style.padding = '0.75rem 1.25rem';
        infoHeader.style.background = 'rgba(56, 189, 248, 0.08)';
        infoHeader.style.border = '1px solid rgba(56, 189, 248, 0.15)';
        infoHeader.style.borderRadius = '8px';
        infoHeader.style.marginBottom = '1.25rem';
        infoHeader.style.display = 'flex';
        infoHeader.style.justifyContent = 'space-between';
        infoHeader.style.alignItems = 'center';
        infoHeader.style.fontSize = '0.9rem';
        infoHeader.style.width = '100%';
        infoHeader.style.boxSizing = 'border-box';
        infoHeader.innerHTML = `
            <span>Mostrando apenas jogos do <strong style="color:var(--accent-color)">Grupo ${state.selectedGroupFilter}</strong></span>
            <button style="background:none; border:none; color:var(--accent-color); cursor:pointer; font-weight:bold; font-size:0.85rem; padding:0; display:flex; align-items:center; gap:0.25rem;" onclick="clearGroupFilter()"><i class="fa-solid fa-xmark"></i> Limpar Filtro</button>
        `;
        container.appendChild(infoHeader);
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
            
            if (match.home_team_label && match.home_team_id === "0") homeTeam.name_en = translateTeamName(match.home_team_label);
            if (match.away_team_label && match.away_team_id === "0") awayTeam.name_en = translateTeamName(match.away_team_label);

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
                statusHtml = `<span class="badge finished">FIM</span>`;
            } else {
                const elapsedText = getLiveTimeText(match);
                if (elapsedText === 'Intervalo') {
                    statusHtml = `<span class="badge halftime-badge"><i class="fa-solid fa-mug-hot"></i> INT</span>`;
                } else if (elapsedText) {
                    statusHtml = `<span class="badge live-badge"><span class="pulse-dot"></span> ${elapsedText}</span>`;
                } else if (diffMins > 0 && diffMins <= 60) {
                    // Contagem regressiva se começar em menos de 1h
                    statusHtml = `<span class="badge upcoming-soon"><i class="fa-solid fa-hourglass-start"></i> ${diffMins} min</span>`;
                } else if (isSoon) {
                    statusHtml = `<span class="badge upcoming-soon" title="${soonText}"><i class="fa-solid fa-hourglass-start"></i> ${timeStr}</span>`;
                } else {
                    statusHtml = `<span class="badge upcoming"><i class="fa-regular fa-clock"></i> ${timeStr}</span>`;
                }
            }

            const hasStarted = match.time_elapsed !== "notstarted";
            const homeScore = !hasStarted ? '' : ((match.home_score === null || match.home_score === 'null' || match.home_score === undefined) ? '0' : match.home_score);
            const awayScore = !hasStarted ? '' : ((match.away_score === null || match.away_score === 'null' || match.away_score === undefined) ? '0' : match.away_score);

            // Determinar o vencedor se o jogo terminou
            const { isHomeWinner, isAwayWinner } = determineWinner(match);

            const homeClass = isHomeWinner ? 'winner' : (isAwayWinner ? 'loser' : '');
            const awayClass = isAwayWinner ? 'winner' : (isHomeWinner ? 'loser' : '');

            const matchItem = document.createElement('div');
            matchItem.className = 'match-list-item';
            matchItem.addEventListener('click', () => showMatchDetails(match.id));

            matchItem.innerHTML = `
                <div class="match-list-meta">
                    <span class="phase" title="${stageText}">${stageText}</span>
                </div>
                <div class="match-list-teams">
                    <div class="match-list-team ${homeClass}">
                        <div class="match-team-info">
                            <img src="${homeTeam.flag}" alt="${homeTeam.name_en}" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/2/2f/Flag_of_the_United_Nations.svg'">
                            <span class="team-name-desktop">${homeTeam.name_en}</span>
                            <span class="team-name-mobile">${homeTeam.fifa_code || "TBD"}</span>
                        </div>
                        <div class="match-list-score">${homeScore}</div>
                    </div>
                    <div class="match-list-team ${awayClass}">
                        <div class="match-team-info">
                            <img src="${awayTeam.flag}" alt="${awayTeam.name_en}" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/2/2f/Flag_of_the_United_Nations.svg'">
                            <span class="team-name-desktop">${awayTeam.name_en}</span>
                            <span class="team-name-mobile">${awayTeam.fifa_code || "TBD"}</span>
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

function showGroupMatches(groupName) {
    state.selectedGroupFilter = groupName;
    state.activeFilter = 'group';
    
    // Altera a aba ativa superior para "Jogos"
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    const matchesTabBtn = document.querySelector('[data-tab="matches"]');
    if (matchesTabBtn) matchesTabBtn.classList.add('active');
    document.getElementById('matches-tab').classList.add('active');

    // Altera o filtro ativo na aba "Jogos" para "Fase de Grupos"
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === 'group') {
            btn.classList.add('active');
        }
    });

    // Sincronizar select de filtro mobile se houver
    const mobileSelect = document.getElementById('mobile-filter-select');
    if (mobileSelect) mobileSelect.value = 'group';

    // Certifica-se de que a listagem de jogos seja exibida e os detalhes ocultos
    document.getElementById('match-details-view').style.display = 'none';
    document.getElementById('matches-list-view').style.display = 'block';

    renderMatches();
}

window.clearGroupFilter = () => {
    state.selectedGroupFilter = null;
    renderMatches();
};

function renderGroups() {
    const container = document.getElementById('groups-grid');
    container.innerHTML = '';
    
    state.groups.forEach(group => {
        const card = document.createElement('div');
        card.className = 'glass-card';
        card.style.cursor = 'pointer';
        card.title = `Clique para ver os jogos do Grupo ${group.name}`;
        card.addEventListener('click', () => showGroupMatches(group.name));
        
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
            <h3 style="margin-bottom: 0.5rem; color: var(--accent-color); display: flex; justify-content: space-between; align-items: center;">
                Grupo ${group.name}
                <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: normal;"><i class="fa-solid fa-calendar-days"></i> Ver Jogos</span>
            </h3>
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

window.showFlagTooltip = (el, name, position = 'top') => {
    let tooltip = document.getElementById('flag-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'flag-tooltip';
        tooltip.style.position = 'absolute';
        tooltip.style.background = 'rgba(15, 23, 42, 0.95)';
        tooltip.style.border = '1px solid var(--accent-color)';
        tooltip.style.borderRadius = '4px';
        tooltip.style.color = '#fff';
        tooltip.style.padding = '0.25rem 0.5rem';
        tooltip.style.fontSize = '0.75rem';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.zIndex = '9999';
        tooltip.style.boxShadow = '0 4px 10px rgba(0,0,0,0.5)';
        tooltip.style.transition = 'opacity 0.2s';
        tooltip.style.fontWeight = 'bold';
        document.body.appendChild(tooltip);
    }

    tooltip.innerText = name;
    tooltip.style.opacity = '1';
    
    const rect = el.getBoundingClientRect();
    tooltip.style.left = `${rect.left + window.scrollX + (rect.width/2) - (tooltip.offsetWidth/2)}px`;
    
    if (position === 'top') {
        tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 8}px`;
    } else {
        tooltip.style.top = `${rect.bottom + window.scrollY + 8}px`;
    }

    if (window.tooltipTimeout) clearTimeout(window.tooltipTimeout);
    window.tooltipTimeout = setTimeout(() => {
        tooltip.style.opacity = '0';
    }, 2000);
};

// Fechar tooltip ao clicar fora
document.addEventListener('click', () => {
    const tooltip = document.getElementById('flag-tooltip');
    if (tooltip) tooltip.style.opacity = '0';
});

function renderBracketMatch(matchId, label) {
    const match = state.matches.find(m => m.id == matchId);
    if (!match) {
        return `
            <div class="bracket-match-card placeholder">
                <div class="bracket-match-header">J${matchId}</div>
                <div class="bracket-team-row">
                    <div class="flag-placeholder"></div>
                    <span style="font-size:0.75rem; color:var(--text-secondary)">?</span>
                </div>
                <div class="bracket-team-row">
                    <div class="flag-placeholder"></div>
                    <span style="font-size:0.75rem; color:var(--text-secondary)">?</span>
                </div>
            </div>
        `;
    }

    const homeTeam = getTeamDetails(match.home_team_id, match.home_team_id === "0");
    const awayTeam = getTeamDetails(match.away_team_id, match.away_team_id === "0");

    if (match.home_team_label && match.home_team_id === "0") homeTeam.name_en = translateTeamName(match.home_team_label);
    if (match.away_team_label && match.away_team_id === "0") awayTeam.name_en = translateTeamName(match.away_team_label);

    const { isHomeWinner, isAwayWinner } = determineWinner(match);

    const homeClass = isHomeWinner ? 'winner' : (isAwayWinner ? 'loser' : '');
    const awayClass = isAwayWinner ? 'winner' : (isHomeWinner ? 'loser' : '');

    const homeScore = match.finished === "TRUE" || match.time_elapsed !== "notstarted" ? match.home_score : "";
    const awayScore = match.finished === "TRUE" || match.time_elapsed !== "notstarted" ? match.away_score : "";

    const homePen = match.home_penalty_score && match.home_penalty_score !== 'null' && match.home_penalty_score !== '' ? `(${match.home_penalty_score})` : '';
    const awayPen = match.away_penalty_score && match.away_penalty_score !== 'null' && match.away_penalty_score !== '' ? `(${match.away_penalty_score})` : '';

    // Convert local date time to Brasília Time (UTC-3)
    const dateObj = parseLocalDateToBrasilia(match.local_date, match.stadium_id);
    const timeStr = isNaN(dateObj.getTime()) ? (match.local_date.split(" ")[1] || "") : dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    const statusText = match.finished === "TRUE" ? "Fim" : (match.time_elapsed !== "notstarted" ? "Ao Vivo" : timeStr);

    const isHomePlaceholder = !match.home_team_id || match.home_team_id === "0";
    const isAwayPlaceholder = !match.away_team_id || match.away_team_id === "0";

    const homeFlagHtml = isHomePlaceholder
        ? `<div class="flag-placeholder bracket-flag" onclick="event.stopPropagation(); showFlagTooltip(this, '${homeTeam.name_en}', 'top')"></div>`
        : `<img src="${homeTeam.flag}" class="bracket-flag" onclick="event.stopPropagation(); showFlagTooltip(this, '${homeTeam.name_en}', 'top')" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/2/2f/Flag_of_the_United_Nations.svg'">`;

    const awayFlagHtml = isAwayPlaceholder
        ? `<div class="flag-placeholder bracket-flag" onclick="event.stopPropagation(); showFlagTooltip(this, '${awayTeam.name_en}', 'bottom')"></div>`
        : `<img src="${awayTeam.flag}" class="bracket-flag" onclick="event.stopPropagation(); showFlagTooltip(this, '${awayTeam.name_en}', 'bottom')" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/2/2f/Flag_of_the_United_Nations.svg'">`;

    return `
        <div class="bracket-match-card" onclick="showMatchDetails('${match.id}')">
            <div class="bracket-match-header">
                <span>J${match.id}</span>
                <span style="color:var(--accent-color); font-weight:800">${statusText}</span>
            </div>
            <div class="bracket-team-row ${homeClass}">
                <div class="bracket-team-info">
                    ${homeFlagHtml}
                </div>
                <div class="bracket-team-score">
                    ${homeScore} <span class="penalties">${homePen}</span>
                </div>
            </div>
            <div class="bracket-team-row ${awayClass}">
                <div class="bracket-team-info">
                    ${awayFlagHtml}
                </div>
                <div class="bracket-team-score">
                    ${awayScore} <span class="penalties">${awayPen}</span>
                </div>
            </div>
        </div>
    `;
}

function renderBracket() {
    const container = document.getElementById('bracket-container');
    if (!container) return;
    container.innerHTML = '';

    const columnsData = [
        {
            class: 'r32-left',
            title: '16 avos (Esquerda)',
            matches: [
                { id: 74, label: '32 avos' },
                { id: 77, label: '32 avos' },
                { id: 73, label: '32 avos' },
                { id: 75, label: '32 avos' },
                { id: 83, label: '32 avos' },
                { id: 84, label: '32 avos' },
                { id: 81, label: '32 avos' },
                { id: 82, label: '32 avos' }
            ]
        },
        {
            class: 'r16-left',
            title: 'Oitavas',
            matches: [
                { id: 89, label: 'Oitavas' },
                { id: 90, label: 'Oitavas' },
                { id: 93, label: 'Oitavas' },
                { id: 94, label: 'Oitavas' }
            ]
        },
        {
            class: 'qf-left',
            title: 'Quartas',
            matches: [
                { id: 97, label: 'Quartas' },
                { id: 98, label: 'Quartas' }
            ]
        },
        {
            class: 'center-column',
            title: 'Finais',
            isCenter: true,
            matches: [
                { id: 101, label: 'Semifinal 1' },
                { id: 104, label: 'Grande Final' },
                { id: 103, label: 'Disputa 3º Lugar' },
                { id: 102, label: 'Semifinal 2' }
            ]
        },
        {
            class: 'qf-right',
            title: 'Quartas',
            matches: [
                { id: 99, label: 'Quartas' },
                { id: 100, label: 'Quartas' }
            ]
        },
        {
            class: 'r16-right',
            title: 'Oitavas',
            matches: [
                { id: 91, label: 'Oitavas' },
                { id: 92, label: 'Oitavas' },
                { id: 95, label: 'Oitavas' },
                { id: 96, label: 'Oitavas' }
            ]
        },
        {
            class: 'r32-right',
            title: '16 avos (Direita)',
            matches: [
                { id: 76, label: '32 avos' },
                { id: 78, label: '32 avos' },
                { id: 79, label: '32 avos' },
                { id: 80, label: '32 avos' },
                { id: 86, label: '32 avos' },
                { id: 88, label: '32 avos' },
                { id: 85, label: '32 avos' },
                { id: 87, label: '32 avos' }
            ]
        }
    ];

    columnsData.forEach(col => {
        const colDiv = document.createElement('div');
        colDiv.className = `bracket-column ${col.class}`;
        
        if (col.isCenter) {
            const semi1 = col.matches.find(m => m.id === 101);
            const finalMatch = col.matches.find(m => m.id === 104);
            const thirdPlace = col.matches.find(m => m.id === 103);
            const semi2 = col.matches.find(m => m.id === 102);

            colDiv.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:1rem; align-items:center;">
                    <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-secondary); font-weight:800; margin-bottom:-0.5rem">Semifinais</div>
                    <div style="display:flex; gap:1.5rem;">
                        ${renderBracketMatch(semi1.id, semi1.label)}
                        ${renderBracketMatch(semi2.id, semi2.label)}
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:0.5rem; align-items:center; border: 1.5px solid rgba(56, 189, 248, 0.3); border-radius: 12px; padding: 1rem; background: rgba(56, 189, 248, 0.03);">
                    <div style="font-size:0.85rem; text-transform:uppercase; color:var(--accent-color); font-weight:800; letter-spacing:1px"><i class="fa-solid fa-trophy"></i> Final</div>
                    ${renderBracketMatch(finalMatch.id, finalMatch.label)}
                </div>
                <div style="display:flex; flex-direction:column; gap:0.5rem; align-items:center; border: 1px dashed rgba(255,255,255,0.15); border-radius: 10px; padding: 0.75rem; background: rgba(255,255,255,0.01);">
                    <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-secondary); font-weight:800">Decisão 3º Lugar</div>
                    ${renderBracketMatch(thirdPlace.id, thirdPlace.label)}
                </div>
            `;
        } else {
            col.matches.forEach(m => {
                const cardHtml = renderBracketMatch(m.id, m.label);
                colDiv.innerHTML += cardHtml;
            });
        }
        container.appendChild(colDiv);
    });
}

document.addEventListener('DOMContentLoaded', init);
