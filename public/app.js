const API_BASE = '/get';
const PLACEHOLDER_FLAG = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='12' viewBox='0 0 18 12'%3E%3Crect width='18' height='12' rx='2' fill='rgba(255,255,255,0.08)'/%3E%3C/svg%3E";
const PLACEHOLDER_AVATAR = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2364748b'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

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
    selectedGroupFilter: null,
    espnTeams: [],
    squadsCache: {},
    activeModalTab: 'summary'
};

const teamColorMap = {
    'Argentina': ['#74acdf', '#ffffff', '#ffd700'],
    'Brasil': ['#ffd700', '#009c3b', '#ffffff'],
    'França': ['#002395', '#ffffff', '#ed2939'],
    'Marrocos': ['#c1272d', '#006233'],
    'Espanha': ['#c1272d', '#f1bf00'],
    'Bélgica': ['#000000', '#ffd700', '#ff0000'],
    'Noruega': ['#ba0c2f', '#ffffff', '#00205b'],
    'Inglaterra': ['#ffffff', '#cf142b'],
    'Suíça': ['#da291c', '#ffffff'],
    'Colômbia': ['#fcd116', '#003893', '#ce1126'],
    'Alemanha': ['#000000', '#dd0000', '#ffcf00'],
    'Portugal': ['#006600', '#ff0000', '#ffff00'],
    'Uruguai': ['#5bc2e7', '#ffffff', '#fcd116'],
    'Itália': ['#008c45', '#f4f9ff', '#cd212a'],
    'EUA': ['#3c3b6e', '#ffffff', '#b22234']
};

function triggerGoalCelebration(teamName, scoreText, teamColors) {
    // 1. Confetti effect on Canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'celebration-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '10000';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const resizeHandler = () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeHandler);

    const particles = [];
    const colors = teamColors && teamColors.length ? teamColors : ['#38bdf8', '#ffffff'];

    // Generate particles
    for (let i = 0; i < 150; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height - height,
            r: Math.random() * 6 + 4,
            d: Math.random() * height,
            color: colors[Math.floor(Math.random() * colors.length)],
            tilt: Math.random() * 10 - 5,
            tiltAngleIncremental: Math.random() * 0.07 + 0.02,
            tiltAngle: 0,
            speed: Math.random() * 3 + 2
        });
    }

    let animationId;
    function draw() {
        ctx.clearRect(0, 0, width, height);

        let active = false;
        particles.forEach(p => {
            p.tiltAngle += p.tiltAngleIncremental;
            p.y += p.speed;
            p.x += Math.sin(p.tiltAngle) * 0.5;

            ctx.beginPath();
            ctx.lineWidth = p.r;
            ctx.strokeStyle = p.color;
            ctx.moveTo(p.x + p.r + p.tilt, p.y);
            ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
            ctx.stroke();

            if (p.y < height) {
                active = true;
            }
        });

        if (active) {
            animationId = requestAnimationFrame(draw);
        } else {
            cleanup();
        }
    }

    function cleanup() {
        cancelAnimationFrame(animationId);
        window.removeEventListener('resize', resizeHandler);
        if (canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
        }
    }

    draw();

    // 3. Goal Banner Overlay
    const banner = document.createElement('div');
    banner.className = 'goal-celebration-banner';
    banner.innerHTML = `
        <div class="goal-label">GOOOOL!</div>
        <div class="goal-team">${teamName.toUpperCase()}</div>
        <div class="goal-score-popup">${scoreText}</div>
    `;
    document.body.appendChild(banner);

    // Fade out banner and confetti after 5 seconds
    setTimeout(() => {
        banner.classList.add('fade-out');
        setTimeout(() => {
            if (banner.parentNode) banner.parentNode.removeChild(banner);
            cleanup();
        }, 1000);
    }, 5000);
}



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
    setupSquadView();
    handleResponsiveLayout();
    window.addEventListener('resize', handleResponsiveLayout);
    await fetchAllData();
    fetchEspnTeams(); // Carrega os IDs da ESPN em segundo plano
    renderAll();
    spinner.style.display = 'none';

    // Auto-refresh a cada 10 segundos para ver os placares mudarem se estiverem rodando
    setInterval(async () => {
        await fetchAllData(true);
        renderMatches();
        renderGroups();
        renderBracket();

        // Se a tela de detalhes (modal) estiver aberta, atualiza a tela de detalhes (somente para jogos ao vivo)
        if (state.activeDetailsMatchId) {
            const activeMatch = state.matches.find(m => m.id == state.activeDetailsMatchId);
            if (activeMatch) {
                const isFinished = activeMatch.finished === "TRUE" || activeMatch.finished === true || activeMatch.time_elapsed === "finished";
                if (!isFinished) {
                    showMatchDetails(state.activeDetailsMatchId, false);
                }
            }
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
    const backdrop = document.getElementById('menu-backdrop');
    
    if (hamburgerBtn && navTabs) {
        const toggleMenu = (open) => {
            if (open) {
                navTabs.classList.add('open');
                if (backdrop) backdrop.classList.add('open');
                document.body.classList.add('menu-open');
            } else {
                navTabs.classList.remove('open');
                if (backdrop) backdrop.classList.remove('open');
                document.body.classList.remove('menu-open');
            }
        };

        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = navTabs.classList.contains('open');
            toggleMenu(!isOpen);
        });
        
        // Fechar ao clicar no botão 'X' de fechar a lateral
        const closeBtn = navTabs.querySelector('.drawer-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleMenu(false);
            });
        }

        // Fechar ao clicar no backdrop
        if (backdrop) {
            backdrop.addEventListener('click', () => {
                toggleMenu(false);
            });
        }
        
        // Fechar ao clicar em qualquer aba
        const tabBtns = navTabs.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                toggleMenu(false);
            });
        });

        // Fechar ao clicar fora
        document.addEventListener('click', (e) => {
            if (!navTabs.contains(e.target) && e.target !== hamburgerBtn) {
                toggleMenu(false);
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

    // Force synchronization of initial state with UI (prevents browser persistence mismatch)
    if (mobileSelect) {
        mobileSelect.value = state.activeFilter;
    }
    filterBtns.forEach(btn => {
        if (btn.dataset.filter === state.activeFilter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
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

    // Configurar navegação de abas no modal de detalhes
    const tabs = document.querySelectorAll('.modal-tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const targetTab = tab.getAttribute('data-modal-tab');
            state.activeModalTab = targetTab;
            
            const contents = document.querySelectorAll('.modal-tab-content');
            contents.forEach(c => {
                if (c.id === `modal-tab-${targetTab}`) {
                    c.classList.add('active');
                } else {
                    c.classList.remove('active');
                }
            });
        });
    });
}

async function fetchEspnTeams() {
    try {
        const res = await fetch("/get/espn/teams");
        const data = await res.json();
        state.espnTeams = data.sports?.[0]?.leagues?.[0]?.teams || [];
    } catch (e) {
        console.error("Erro ao carregar seleções da ESPN:", e);
    }
}

function setupSquadView() {
    const modal = document.getElementById('team-squad-modal');
    const closeBtn = document.getElementById('close-squad-btn');
    if (closeBtn && modal) {
        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
        };

        closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }
}

async function showTeamSquad(teamId) {
    const team = state.teams.find(t => t.id == teamId);
    if (!team) return;

    const modal = document.getElementById('team-squad-modal');
    const titleEl = document.getElementById('squad-modal-title');
    const contentEl = document.getElementById('team-squad-content');

    if (!modal || !titleEl || !contentEl) return;

    titleEl.innerHTML = `
        <img src="${team.flag}" style="width: 32px; height: 22px; border-radius: 2px; object-fit: cover;" onerror="this.src=PLACEHOLDER_FLAG">
        Convocados — ${translateTeamName(team.name_en)}
    `;
    contentEl.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 200px;">
            <div class="spinner"></div>
        </div>
    `;

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 50);

    try {
        if (state.squadsCache[teamId]) {
            renderSquad(state.squadsCache[teamId], contentEl);
            return;
        }

        if (!state.espnTeams || state.espnTeams.length === 0) {
            await fetchEspnTeams();
        }

        let queryName = (team.name_en_original || team.name_en).toLowerCase();
        const overrides = {
            "czech republic": "czechia",
            "bosnia and herzegovina": "bosnia-herzegovina",
            "turkey": "türkiye",
            "democratic republic of the congo": "congo dr"
        };
        if (overrides[queryName]) {
            queryName = overrides[queryName];
        }

        const espnTeam = state.espnTeams.find(et => {
            const name = (et.team?.displayName || et.team?.name || "").toLowerCase();
            return name === queryName;
        });

        if (!espnTeam) {
            contentEl.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 2rem;">Elenco não encontrado na API da ESPN.</div>`;
            return;
        }

        const rosterUrl = `/get/espn/roster/${espnTeam.team.id}`;
        const resRoster = await fetch(rosterUrl);
        const rosterData = await resRoster.json();

        const athletes = rosterData.athletes || [];
        if (athletes.length === 0) {
            contentEl.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 2rem;">Nenhum jogador convocado encontrado para esta seleção.</div>`;
            return;
        }

        state.squadsCache[teamId] = athletes;
        renderSquad(athletes, contentEl);

    } catch (err) {
        console.error("Erro ao buscar elenco:", err);
        contentEl.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 2rem;">Erro ao carregar o elenco. Tente novamente mais tarde.</div>`;
    }
}

function renderSquad(athletes, container) {
    const positionsMap = {
        "Goalkeeper": "Goleiros",
        "Defender": "Defensores",
        "Midfielder": "Meio-campistas",
        "Forward": "Atacantes"
    };

    const grouped = {
        "Goleiros": [],
        "Defensores": [],
        "Meio-campistas": [],
        "Atacantes": [],
        "Outros": []
    };

    athletes.forEach(ath => {
        const rawPos = ath.position?.name || "";
        let mappedPos = "Outros";
        for (const [key, val] of Object.entries(positionsMap)) {
            if (rawPos.toLowerCase().includes(key.toLowerCase())) {
                mappedPos = val;
                break;
            }
        }
        grouped[mappedPos].push(ath);
    });

    let html = "";
    const order = ["Goleiros", "Defensores", "Meio-campistas", "Atacantes", "Outros"];

    order.forEach(pos => {
        const list = grouped[pos];
        if (list.length === 0) return;

        list.sort((a, b) => {
            const numA = parseInt(a.jersey || "999");
            const numB = parseInt(b.jersey || "999");
            return numA - numB;
        });

        html += `
            <div class="squad-position-section">
                <div class="squad-position-title">${pos}</div>
                <div class="squad-players-grid">
        `;

        list.forEach(p => {
            const name = p.displayName || p.fullName || "Jogador";
            const jersey = p.jersey || "-";
            const detailPos = p.position?.displayName || p.position?.name || "";
            
            html += `
                <div class="squad-player-row">
                    <div class="player-jersey-badge">${jersey}</div>
                    <div class="player-info-container">
                        <span class="player-name">${name}</span>
                        <span class="player-pos-detail">${detailPos}</span>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
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

        if (mRes.ok) {
            const mData = await mRes.json();
            if (mData && mData.games) {
                // Compare matches to trigger sound effects
                if (state.matches && state.matches.length > 0) {
                    mData.games.forEach(newMatch => {
                        const oldMatch = state.matches.find(m => m.id === newMatch.id);
                        if (oldMatch) {
                            // 1. Goal Sound Trigger
                            const oldHome = parseInt(oldMatch.home_score) || 0;
                            const oldAway = parseInt(oldMatch.away_score) || 0;
                            const newHome = parseInt(newMatch.home_score) || 0;
                            const newAway = parseInt(newMatch.away_score) || 0;

                            const isLive = newMatch.time_elapsed !== 'notstarted' && newMatch.time_elapsed !== 'finished';
                            const wasLive = oldMatch.time_elapsed !== 'notstarted' && oldMatch.time_elapsed !== 'finished';

                            if (isLive || wasLive) {
                                if (newHome > oldHome) {
                                    const team = state.teams.find(t => t.id === newMatch.home_team_id);
                                    const teamName = team ? team.name_en : 'Casa';
                                    const colors = teamColorMap[teamName] || ['#38bdf8', '#ffffff'];
                                    triggerGoalCelebration(teamName, `Gol! ${newMatch.home_score} - ${newMatch.away_score}`, colors);
                                } else if (newAway > oldAway) {
                                    const team = state.teams.find(t => t.id === newMatch.away_team_id);
                                    const teamName = team ? team.name_en : 'Fora';
                                    const colors = teamColorMap[teamName] || ['#38bdf8', '#ffffff'];
                                    triggerGoalCelebration(teamName, `Gol! ${newMatch.home_score} - ${newMatch.away_score}`, colors);
                                }
                            }
                        }
                    });
                }
                state.matches = mData.games;
            }
        } else {
            console.warn('Failed to fetch matches:', mRes.status);
        }

        if (gRes.ok) {
            const gData = await gRes.json();
            if (gData && gData.groups) {
                state.groups = gData.groups;
            }
        } else {
            console.warn('Failed to fetch groups:', gRes.status);
        }

        if (tRes.ok) {
            const tData = await tRes.json();
            const fetchedTeams = Array.isArray(tData) ? tData : (tData.teams || []);
            if (fetchedTeams.length > 0) {
                state.teams = fetchedTeams;
                state.teams.forEach(team => {
                    if (team.name_en) {
                        team.name_en_original = team.name_en;
                        team.name_en = translateTeamName(team.name_en);
                    }
                });
            }
        } else {
            console.warn('Failed to fetch teams:', tRes.status);
        }

        if (sRes.ok) {
            const sData = await sRes.json();
            const fetchedStadiums = Array.isArray(sData) ? sData : (sData.stadiums || []);
            if (fetchedStadiums.length > 0) {
                state.stadiums = fetchedStadiums;
            }
        } else {
            console.warn('Failed to fetch stadiums:', sRes.status);
        }
        
    } catch (err) {
        console.error('Error fetching data:', err);
    } finally {
        if (!silent) spinner.style.display = 'none';
    }
}

function getTeamDetails(teamIdOrLabel, isLabel = false) {
    if (isLabel || teamIdOrLabel === "0") {
        return { name_en: teamIdOrLabel === "0" ? "A Definir" : translateTeamName(teamIdOrLabel), flag: PLACEHOLDER_FLAG };
    }
    return state.teams.find(t => t.id == teamIdOrLabel) || { name_en: "A Definir", flag: PLACEHOLDER_FLAG };
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

function showMatchDetails(matchId, isOpening = false) {
    state.activeDetailsMatchId = matchId; // Salva o ID ativo para auto-refresh
    const match = state.matches.find(m => m.id == matchId);
    if (!match) return;

    // Se for abertura (isOpening === true), reseta para aba 'Resumo'
    if (isOpening) {
        state.activeModalTab = 'summary';
    }

    const currentActiveTab = state.activeModalTab || 'summary';
    const tabBtns = document.querySelectorAll('.modal-tab-btn');
    tabBtns.forEach(t => {
        if (t.getAttribute('data-modal-tab') === currentActiveTab) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });

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
            const diffMs = !isNaN(dateObj.getTime()) ? (dateObj.getTime() - Date.now()) : null;
            const diffMins = diffMs !== null ? Math.floor(diffMs / 60000) : 999;
            if (diffMins <= 10) {
                statusHtml = `<span class="badge upcoming-soon"><i class="fa-solid fa-hourglass-start"></i> EM INSTANTES</span>`;
            } else if (diffMins <= 120) {
                statusHtml = `<span class="badge upcoming-soon"><i class="fa-solid fa-hourglass-start"></i> DAQUI A POUCO</span>`;
            } else {
                statusHtml = `<span class="badge upcoming">Não Iniciado</span>`;
            }
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

    // Informações da partida
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

    // Cartões disciplinários
    let cardsHtml = '';
    if (match.cards && match.cards.length > 0) {
        const cardsList = match.cards.map(c => {
            const sideText = c.team === 'home' ? 'Casa' : 'Fora';
            const badgeClass = c.type === 'red' ? 'red' : 'yellow';
            const cardName = c.type === 'red' ? 'Cartão Vermelho' : 'Cartão Amarelo';
            return `
                <div class="card-event-item">
                    <span class="card-badge ${badgeClass}" title="${cardName}"></span>
                    <span style="font-weight:600; color:#fff;">${c.player}</span> 
                    <span style="color:var(--text-secondary); font-size:0.8rem;">(${sideText} · ${c.minute}')</span>
                </div>
            `;
        }).join('');
        cardsHtml = `
            <div class="scout-title"><i class="fa-solid fa-clone"></i> Cartões Disciplinares</div>
            <div class="cards-timeline">${cardsList}</div>
        `;
    }

    // Estatísticas da partida (Scout)
    let scoutHtml = '';
    if (match.scout && Object.keys(match.scout).length > 0) {
        const scoutRows = Object.entries(match.scout).map(([statName, valObj]) => {
            const homeValStr = valObj.home || '0';
            const awayValStr = valObj.away || '0';
            
            const homeNum = parseFloat(homeValStr) || 0;
            const awayNum = parseFloat(awayValStr) || 0;
            const total = homeNum + awayNum || 1;
            const homePct = (homeNum / total) * 100;
            const awayPct = (awayNum / total) * 100;
            
            const formattedName = statName
                .replace(/([A-Z])/g, ' $1')
                .replace('Committed', '')
                .replace('won', 'Ganhos ')
                .replace('yellow', 'Cartões Amarelos')
                .replace('red', 'Cartões Vermelhos')
                .trim();
            
            return `
                <div class="stat-row">
                    <div class="stat-label-row">
                        <span>${homeValStr}</span>
                        <span class="stat-name">${formattedName}</span>
                        <span>${awayValStr}</span>
                    </div>
                    <div class="stat-bar-wrapper">
                        <div class="stat-bar-fill home" style="width: ${homePct}%"></div>
                        <div class="stat-bar-fill away" style="width: ${awayPct}%"></div>
                    </div>
                </div>
            `;
        }).join('');
        
        scoutHtml = `
            <div class="scout-title"><i class="fa-solid fa-chart-bar"></i> Estatísticas da Partida (Scout)</div>
            <div class="scout-container">${scoutRows}</div>
        `;
    }

    // Escalações (Lineups)
    let lineupsHtml = '';
    if (match.lineups) {
        const renderRoster = (teamLineup, teamName) => {
            const startersList = (teamLineup.starters || []).map(p => {
                return `
                    <div class="lineup-player-row">
                        <span class="lineup-jersey-number">${p.number}</span>
                        <div class="lineup-player-meta">
                            <span class="lineup-player-name-text">${p.name}</span>
                            <span class="lineup-player-position-text">${p.position}</span>
                        </div>
                    </div>
                `;
            }).join('');
            
            const subsList = (teamLineup.substitutes || []).map(p => {
                return `
                    <div class="lineup-player-row">
                        <span class="lineup-jersey-number">${p.number}</span>
                        <div class="lineup-player-meta">
                            <span class="lineup-player-name-text">${p.name}</span>
                            <span class="lineup-player-position-text">${p.position}</span>
                        </div>
                    </div>
                `;
            }).join('');
            
            return `
                <div class="lineups-team-column">
                    <div class="lineup-team-header">
                        <span class="lineup-team-name">${teamName}</span>
                        ${teamLineup.formation ? `<span class="lineup-formation-badge">${teamLineup.formation}</span>` : ''}
                    </div>
                    <div class="lineup-section-title">Titulares</div>
                    <div class="lineup-players-list">${startersList}</div>
                    ${subsList.length > 0 ? `
                        <div class="lineup-section-title">Reservas</div>
                        <div class="lineup-players-list">${subsList}</div>
                    ` : ''}
                </div>
            `;
        };
        
        lineupsHtml = `
            <div class="lineups-view-container">
                ${renderRoster(match.lineups.home, translateTeamName(homeTeam.name_en))}
                ${renderRoster(match.lineups.away, translateTeamName(awayTeam.name_en))}
            </div>
        `;
    } else {
        lineupsHtml = `
            <div style="text-align:center; color:var(--text-secondary); padding: 3rem 0;">
                <i class="fa-solid fa-shirt" style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                <div>Escalações indisponíveis para esta partida.</div>
            </div>
        `;
    }

    const displayHomeScore = match.time_elapsed === 'notstarted' ? '' : (match.home_score || 0);
    const displayAwayScore = match.time_elapsed === 'notstarted' ? '' : (match.away_score || 0);
    const hasPenalties = match.home_penalty_score !== undefined && match.home_penalty_score !== null && match.home_penalty_score !== 'null' && match.home_penalty_score !== '';

    document.getElementById('match-details-content').innerHTML = `
        <div class="match-details-card">
            <div class="details-stage-info">${match.type === 'group' ? `Grupo ${match.group || ''}` : (phaseTranslations[match.type] || 'Mata-Mata')}</div>
            <div class="details-teams">
                <div class="details-team">
                    <img src="${homeTeam.flag}" alt="${homeTeam.name_en}" onerror="this.src=PLACEHOLDER_FLAG">
                    <span class="details-team-mobile-fallback">${homeTeam.fifa_code || homeTeam.name_en}</span>
                </div>
                <div class="details-score-area">
                    <div class="details-score">
                        ${match.time_elapsed === 'notstarted' ? 'VS' : `${displayHomeScore} - ${displayAwayScore}`}
                    </div>
                    ${hasPenalties ? `<div class="details-penalties" style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.25rem;">Pênaltis: ${match.home_penalty_score} - ${match.away_penalty_score}</div>` : ''}
                </div>
                <div class="details-team">
                    <img src="${awayTeam.flag}" alt="${awayTeam.name_en}" onerror="this.src=PLACEHOLDER_FLAG">
                    <span class="details-team-mobile-fallback">${awayTeam.fifa_code || awayTeam.name_en}</span>
                </div>
            </div>
            <div class="details-status-badge">
                ${statusHtml}
            </div>
        </div>
        
        <!-- Tab 1: Resumo -->
        <div class="modal-tab-content ${currentActiveTab === 'summary' ? 'active' : ''}" id="modal-tab-summary">
            ${scorersHtml}
            ${cardsHtml}
            ${scoutHtml}
            ${!scorersHtml && !cardsHtml && !scoutHtml ? `
                <div style="text-align:center; color:var(--text-secondary); padding: 3rem 0;">
                    <i class="fa-solid fa-hourglass" style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                    <div>A partida ainda não começou. Detalhes aparecerão assim que a bola rolar!</div>
                </div>
            ` : ''}
        </div>
        
        <!-- Tab 2: Escalações -->
        <div class="modal-tab-content ${currentActiveTab === 'lineups' ? 'active' : ''}" id="modal-tab-lineups">
            ${lineupsHtml}
        </div>
        
        <!-- Tab 3: Informações -->
        <div class="modal-tab-content ${currentActiveTab === 'info' ? 'active' : ''}" id="modal-tab-info">
            ${infoHtml}
        </div>
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
        const dateObj = parseLocalDateToBrasilia(match.local_date, match.stadium_id);
        const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' }).substring(0, 3).toUpperCase().replace(/\./g, '');
        const day = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', timeZone: 'America/Sao_Paulo' });
        const month = dateObj.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'America/Sao_Paulo' }).substring(0, 3).toUpperCase().replace(/\./g, '');
        const groupKey = `${weekday} ${day} ${month}`;
        
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

            // Determinar rótulos da fase e grupo conforme o tipo de partida
            let mainLabel = '';
            let subLabel = '';
            if (match.type === 'group') {
                mainLabel = match.group ? `Grupo ${match.group}` : 'Grupo';
                subLabel = 'Fase de Grupos';
            } else {
                mainLabel = 'Mata-Mata';
                subLabel = phaseTranslations[match.type] || 'Fase Final';
            }

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

            const hasHomePen = match.home_penalty_score !== undefined && match.home_penalty_score !== null && match.home_penalty_score !== 'null' && match.home_penalty_score !== '';
            const hasAwayPen = match.away_penalty_score !== undefined && match.away_penalty_score !== null && match.away_penalty_score !== 'null' && match.away_penalty_score !== '';
            const homePen = hasHomePen ? `(${match.home_penalty_score})` : '';
            const awayPen = hasAwayPen ? `(${match.away_penalty_score})` : '';

            // Determinar o vencedor se o jogo terminou
            const { isHomeWinner, isAwayWinner } = determineWinner(match);

            const homeClass = isHomeWinner ? 'winner' : (isAwayWinner ? 'loser' : '');
            const awayClass = isAwayWinner ? 'winner' : (isHomeWinner ? 'loser' : '');

            const matchItem = document.createElement('div');
            matchItem.className = 'match-list-item';
            matchItem.addEventListener('click', () => showMatchDetails(match.id, true));

            matchItem.innerHTML = `
                <div class="match-list-meta">
                    <span class="phase-main" title="${mainLabel}">${mainLabel}</span>
                    <span class="phase-sub" title="${subLabel}">${subLabel}</span>
                    <span class="match-time"><i class="fa-regular fa-clock"></i> ${timeStr}</span>
                </div>
                <div class="match-list-teams">
                    <div class="match-list-team ${homeClass}">
                        <div class="match-team-info">
                            <img src="${homeTeam.flag}" alt="${homeTeam.name_en}" onerror="this.src=PLACEHOLDER_FLAG">
                            <span class="team-name-desktop">${homeTeam.name_en}</span>
                            <span class="team-name-mobile">${homeTeam.fifa_code || "TBD"}</span>
                        </div>
                        <div class="match-list-score">
                            ${homeScore}
                            ${homePen ? `<span class="penalties-suffix">${homePen}</span>` : ''}
                        </div>
                    </div>
                    <div class="match-list-team ${awayClass}">
                        <div class="match-team-info">
                            <img src="${awayTeam.flag}" alt="${awayTeam.name_en}" onerror="this.src=PLACEHOLDER_FLAG">
                            <span class="team-name-desktop">${awayTeam.name_en}</span>
                            <span class="team-name-mobile">${awayTeam.fifa_code || "TBD"}</span>
                        </div>
                        <div class="match-list-score">
                            ${awayScore}
                            ${awayPen ? `<span class="penalties-suffix">${awayPen}</span>` : ''}
                        </div>
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
                        <img src="${team.flag}" onerror="this.src=PLACEHOLDER_FLAG">
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
            card.onclick = () => showTeamSquad(team.id);
            
            card.innerHTML = `
                <img src="${team.flag}" style="width: 50px; height: 35px; border-radius: 4px; object-fit: cover; border: 1px solid var(--glass-border); box-shadow: 0 2px 5px rgba(0,0,0,0.3);" onerror="this.src=PLACEHOLDER_FLAG">
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

    const hasHomePen = match.home_penalty_score !== undefined && match.home_penalty_score !== null && match.home_penalty_score !== 'null' && match.home_penalty_score !== '';
    const hasAwayPen = match.away_penalty_score !== undefined && match.away_penalty_score !== null && match.away_penalty_score !== 'null' && match.away_penalty_score !== '';
    const homePen = hasHomePen ? `(${match.home_penalty_score})` : '';
    const awayPen = hasAwayPen ? `(${match.away_penalty_score})` : '';

    // Convert local date time to Brasília Time (UTC-3)
    const dateObj = parseLocalDateToBrasilia(match.local_date, match.stadium_id);
    const timeStr = isNaN(dateObj.getTime()) ? (match.local_date.split(" ")[1] || "") : dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    const statusText = match.finished === "TRUE" ? "Fim" : (match.time_elapsed !== "notstarted" ? '<span class="pulse-dot"></span>' : timeStr);

    let dateStr = "";
    if (!isNaN(dateObj.getTime())) {
        dateStr = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
    } else {
        const dateParts = (match.local_date || "").split(" ")[0].split("/");
        if (dateParts.length === 3) {
            dateStr = `${dateParts[1]}/${dateParts[0]}`;
        }
    }

    const isHomePlaceholder = !match.home_team_id || match.home_team_id === "0";
    const isAwayPlaceholder = !match.away_team_id || match.away_team_id === "0";

    const homeFlagHtml = isHomePlaceholder
        ? `<div class="flag-placeholder bracket-flag" onclick="event.stopPropagation(); showFlagTooltip(this, '${homeTeam.name_en}', 'top')"></div>`
        : `<img src="${homeTeam.flag}" class="bracket-flag" onclick="event.stopPropagation(); showFlagTooltip(this, '${homeTeam.name_en}', 'top')" onerror="this.src=PLACEHOLDER_FLAG">`;

    const awayFlagHtml = isAwayPlaceholder
        ? `<div class="flag-placeholder bracket-flag" onclick="event.stopPropagation(); showFlagTooltip(this, '${awayTeam.name_en}', 'bottom')"></div>`
        : `<img src="${awayTeam.flag}" class="bracket-flag" onclick="event.stopPropagation(); showFlagTooltip(this, '${awayTeam.name_en}', 'bottom')" onerror="this.src=PLACEHOLDER_FLAG">`;

    return `
        <div class="bracket-match-card" onclick="showMatchDetails('${match.id}', true)">
            <div class="bracket-match-header">
                <span style="color:var(--text-secondary); font-size:0.75rem;">${dateStr}</span>
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
                <div style="display:flex; flex-direction:column; gap:0.5rem; align-items:center; border: 1.5px solid rgba(56, 189, 248, 0.3); border-radius: 12px; padding: 1rem; background: rgba(56, 189, 248, 0.03);">
                    <div style="font-size:0.85rem; text-transform:uppercase; color:var(--accent-color); font-weight:800; letter-spacing:1px"><i class="fa-solid fa-trophy"></i> Final</div>
                    ${renderBracketMatch(finalMatch.id, finalMatch.label)}
                </div>
                <div style="display:flex; flex-direction:column; gap:1rem; align-items:center;">
                    <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-secondary); font-weight:800; margin-top:-0.8rem; margin-bottom:0.4rem;">Semifinais</div>
                    <div class="semifinals-row" style="display:flex; gap:1.5rem; position:relative;">
                        <!-- Top Flow to Final SVG -->
                        <svg style="position:absolute; bottom:100%; left:0; width:214px; height:70px; pointer-events:none; z-index:1;">
                            <path d="M 47.5 70 L 47.5 20 L 166.5 20 L 166.5 70 M 107 20 L 107 2" stroke="rgba(255, 255, 255, 0.15)" stroke-width="1.5" fill="none" />
                        </svg>
                        
                        <!-- Bottom Flow to 3rd Place SVG -->
                        <svg style="position:absolute; top:100%; left:0; width:214px; height:40px; pointer-events:none; z-index:1;">
                            <path d="M 47.5 0 L 47.5 20 L 166.5 20 L 166.5 0 M 107 20 L 107 38" stroke="rgba(255, 255, 255, 0.15)" stroke-width="1.5" fill="none" />
                        </svg>

                        ${renderBracketMatch(semi1.id, semi1.label)}
                        ${renderBracketMatch(semi2.id, semi2.label)}
                    </div>
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
