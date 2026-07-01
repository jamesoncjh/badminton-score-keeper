/**
 * CourtMaster Pro - Badminton Rally-Point Scoring System & Visualizer
 * Core Game Engine and UI Controller
 */

// --- AUDIO SYNTHESIS ENGINE ---
const audio = {
  ctx: null,
  enabled: true,
  
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("Web Audio API not supported in this browser.", e);
    }
  },
  
  playBuzzer() {
    this.init();
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(80, this.ctx.currentTime + 1.2);
    
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.2);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 1.2);
  },
  
  playBeep(freq = 600, duration = 0.12, type = 'sine') {
    this.init();
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },

  playPointSound(team) {
    // Elegant chime when point is scored
    const baseFreq = team === 'A' ? 523.25 : 659.25; // C5 or E5
    this.playBeep(baseFreq, 0.1, 'sine');
    setTimeout(() => this.playBeep(baseFreq * 1.5, 0.18, 'sine'), 80);
  }
};

// --- CORE GAME STATE ---
const state = {
  mode: 'singles', // 'singles' | 'doubles'
  matchFormat: 3, // best of 1, 3, 5
  targetPoints: 21,
  maxPoints: 30,
  
  teamA: {
    name: 'MAS',
    color: '#3b82f6',
    players: ['Lee Zii Jia', 'Soh Wooi Yik'],
  },
  teamB: {
    name: 'DEN',
    color: '#ef4444',
    players: ['Viktor Axelsen', 'Anders Antonsen'],
  },
  
  currentGameIndex: 0,
  gameScores: [{ a: 0, b: 0 }], // score for each game
  gameWins: { a: 0, b: 0 },
  
  courtSides: {
    left: 'A', // Team on left side of court
    right: 'B', // Team on right side of court
  },
  
  // Track player service court placement (IDs: 'A1', 'A2', 'B1', 'B2')
  playerPositions: {
    A: { even: 'A1', odd: 'A2' },
    B: { even: 'B1', odd: 'B2' }
  },
  
  currentServer: 'A1', // ID of current server
  currentReceiver: 'B1', // ID of current receiver
  
  // Timers
  matchStartTime: null,
  totalElapsedSeconds: 0,
  rallyStartTime: null,
  rallyElapsedSeconds: 0,
  isPaused: false,
  timerIntervalId: null,
  
  // Shuttles
  shuttleCount: 1,
  shuttlesPerGame: [1],
  
  // History stack for Undo/Redo
  history: [],
  redoStack: [],
  
  // Log sequence
  logs: [],
  
  // Statistics
  stats: {
    consecutivePoints: { a: 0, b: 0, currentA: 0, currentB: 0 },
    serviceWon: { a: 0, b: 0 },
    receiveWon: { a: 0, b: 0 },
    rallyTimes: [],
    scoreHistory: [] // list of {a, b} coordinates for progress charting
  }
};

// --- DOM ELEMENTS REFERENCE ---
const DOM = {
  // Screens
  setupScreen: document.getElementById('setup-screen'),
  matchScreen: document.getElementById('match-screen'),
  
  // Mode selectors
  btnSingles: document.getElementById('btn-singles'),
  btnDoubles: document.getElementById('btn-doubles'),
  
  // Setup inputs
  selectSets: document.getElementById('select-sets'),
  inputTargetPoints: document.getElementById('input-target-points'),
  inputMaxPoints: document.getElementById('input-max-points'),
  
  teamAName: document.getElementById('team-a-name'),
  playerA1Name: document.getElementById('player-a1-name'),
  playerA2Name: document.getElementById('player-a2-name'),
  colorsTeamA: document.getElementById('colors-team-a'),
  
  teamBName: document.getElementById('team-b-name'),
  playerB1Name: document.getElementById('player-b1-name'),
  playerB2Name: document.getElementById('player-b2-name'),
  colorsTeamB: document.getElementById('colors-team-b'),
  
  selectFirstServerTeam: document.getElementById('select-first-server-team'),
  selectFirstServer: document.getElementById('select-first-server'),
  selectFirstReceiver: document.getElementById('select-first-receiver'),
  btnStartMatch: document.getElementById('btn-start-match'),
  
  // Scoreboard
  scoreboardTeamAName: document.getElementById('scoreboard-team-a-name'),
  scoreboardTeamBName: document.getElementById('scoreboard-team-b-name'),
  teamAFlag: document.getElementById('team-a-flag'),
  teamBFlag: document.getElementById('team-b-flag'),
  scoreDisplayA: document.getElementById('score-display-a'),
  scoreDisplayB: document.getElementById('score-display-b'),
  setsADots: document.getElementById('sets-a-dots'),
  setsBDots: document.getElementById('sets-b-dots'),
  matchStatusLabel: document.getElementById('match-status-label'),
  matchTimer: document.getElementById('match-timer'),
  rallyTimer: document.getElementById('rally-timer'),
  shuttleCountVal: document.getElementById('shuttle-count-val'),
  
  // Controls
  btnScoreA: document.getElementById('btn-score-a'),
  btnScoreB: document.getElementById('btn-score-b'),
  btnUndo: document.getElementById('btn-undo'),
  btnRedo: document.getElementById('btn-redo'),
  btnNewShuttle: document.getElementById('btn-new-shuttle'),
  btnPauseMatch: document.getElementById('btn-pause-match'),
  btnResetMatch: document.getElementById('btn-reset-match'),
  btnSwapEnds: document.getElementById('btn-swap-ends'),
  btnCorrectPositions: document.getElementById('btn-correct-positions'),
  
  // Sidebar Tabs
  tabBtnLog: document.getElementById('tab-btn-log'),
  tabBtnStats: document.getElementById('tab-btn-stats'),
  tabContentLog: document.getElementById('tab-content-log'),
  tabContentStats: document.getElementById('tab-content-stats'),
  matchLog: document.getElementById('match-log'),
  
  // Sidebar Stats
  statTotalTime: document.getElementById('stat-total-time'),
  statAvgRally: document.getElementById('stat-avg-rally'),
  statShuttles: document.getElementById('stat-shuttles'),
  statConsecutiveA: document.getElementById('stat-consecutive-a'),
  statConsecutiveB: document.getElementById('stat-consecutive-b'),
  statServiceWonA: document.getElementById('stat-service-won-a'),
  statServiceWonB: document.getElementById('stat-service-won-b'),
  statReceiveWonA: document.getElementById('stat-receive-won-a'),
  statReceiveWonB: document.getElementById('stat-receive-won-b'),
  
  // SVG court elements
  courtSvg: document.getElementById('badminton-court'),
  playersGroup: document.getElementById('players-group'),
  serviceArrowGroup: document.getElementById('service-arrow-group'),
  courtHighlights: document.getElementById('court-highlights'),
  
  // Overlays & Modals
  intervalOverlay: document.getElementById('interval-overlay'),
  intervalTitle: document.getElementById('interval-title'),
  intervalSubtitle: document.getElementById('interval-subtitle'),
  intervalTimerVal: document.getElementById('interval-timer-val'),
  btnIntervalSkip: document.getElementById('btn-interval-skip'),
  btnIntervalAdd: document.getElementById('btn-interval-add'),
  
  winnerOverlay: document.getElementById('winner-overlay'),
  winnerTeamName: document.getElementById('winner-team-name'),
  winnerScoreSummary: document.getElementById('winner-score-summary'),
  btnWinnerRestart: document.getElementById('btn-winner-restart'),
  btnWinnerClose: document.getElementById('btn-winner-close'),
  
  correctionModal: document.getElementById('correction-modal'),
  btnCorrectA: document.getElementById('btn-correct-a'),
  btnCorrectB: document.getElementById('btn-correct-b'),
  btnCloseCorrection: document.getElementById('btn-close-correction'),
  
  themeToggle: document.getElementById('theme-toggle'),
  soundToggle: document.getElementById('sound-toggle'),
  audioActivatorBanner: document.getElementById('audio-activator-banner')
};

// --- INITIALIZATION ---
function initApp() {
  setupEventListeners();
  loadSavedMatch();
  checkAudioAutoPlay();
}

function setupEventListeners() {
  // Theme and sound toggles
  DOM.themeToggle.addEventListener('click', toggleTheme);
  DOM.soundToggle.addEventListener('click', toggleSound);
  DOM.audioActivatorBanner.addEventListener('click', () => {
    audio.init();
    DOM.audioActivatorBanner.classList.add('hidden');
  });

  // Match Mode toggles (singles/doubles)
  DOM.btnSingles.addEventListener('click', () => setMode('singles'));
  DOM.btnDoubles.addEventListener('click', () => setMode('doubles'));

  // Jersey Color Picking
  setupColorPickers();

  // Setup Screen Submit
  DOM.btnStartMatch.addEventListener('click', startMatch);

  // Score Controls
  // Left button scores for whichever team is physically on the left side of the screen
  DOM.btnScoreA.addEventListener('click', () => scorePoint(state.courtSides.left));
  DOM.btnScoreB.addEventListener('click', () => scorePoint(state.courtSides.right));
  
  // Console controls
  DOM.btnUndo.addEventListener('click', undoAction);
  DOM.btnRedo.addEventListener('click', redoAction);
  DOM.btnNewShuttle.addEventListener('click', recordNewShuttle);
  DOM.btnPauseMatch.addEventListener('click', togglePauseMatch);
  DOM.btnResetMatch.addEventListener('click', confirmResetMatch);
  DOM.btnSwapEnds.addEventListener('click', manualSwapSides);
  DOM.btnCorrectPositions.addEventListener('click', openCorrectionModal);

  // Sidebar tab toggling
  DOM.tabBtnLog.addEventListener('click', () => switchTab('log'));
  DOM.tabBtnStats.addEventListener('click', () => switchTab('stats'));

  // Interval Overlay Controls
  DOM.btnIntervalSkip.addEventListener('click', skipInterval);
  DOM.btnIntervalAdd.addEventListener('click', extendInterval);

  // Winner overlay controls
  DOM.btnWinnerRestart.addEventListener('click', restartToSetup);
  DOM.btnWinnerClose.addEventListener('click', () => DOM.winnerOverlay.classList.add('hidden'));

  // Positions correction controls
  DOM.btnCorrectA.addEventListener('click', () => manualSwapPositions('A'));
  DOM.btnCorrectB.addEventListener('click', () => manualSwapPositions('B'));
  DOM.btnCloseCorrection.addEventListener('click', () => DOM.correctionModal.classList.add('hidden'));

  // Dynamic doubles server/receiver setup drop-downs
  DOM.selectFirstServerTeam.addEventListener('change', updateSetupSelectors);
}

// --- SETUP SCREEN LOGIC ---
function setMode(mode) {
  state.mode = mode;
  if (mode === 'singles') {
    DOM.btnSingles.classList.add('active');
    DOM.btnDoubles.classList.remove('active');
    document.querySelectorAll('.doubles-only').forEach(el => el.classList.add('hidden'));
  } else {
    DOM.btnSingles.classList.remove('active');
    DOM.btnDoubles.classList.add('active');
    document.querySelectorAll('.doubles-only').forEach(el => el.classList.remove('hidden'));
  }
  updateSetupSelectors();
}

function setupColorPickers() {
  DOM.colorsTeamA.addEventListener('click', (e) => {
    if (e.target.classList.contains('color-dot')) {
      DOM.colorsTeamA.querySelectorAll('.color-dot').forEach(el => el.classList.remove('active'));
      e.target.classList.add('active');
      state.teamA.color = e.target.getAttribute('data-color');
    }
  });
  DOM.colorsTeamB.addEventListener('click', (e) => {
    if (e.target.classList.contains('color-dot')) {
      DOM.colorsTeamB.querySelectorAll('.color-dot').forEach(el => el.classList.remove('active'));
      e.target.classList.add('active');
      state.teamB.color = e.target.getAttribute('data-color');
    }
  });
}

function updateSetupSelectors() {
  const servingTeam = DOM.selectFirstServerTeam.value;
  const serverSelect = DOM.selectFirstServer;
  const receiverSelect = DOM.selectFirstReceiver;

  serverSelect.innerHTML = '';
  receiverSelect.innerHTML = '';

  const nameA1 = DOM.playerA1Name.value || 'Player A1';
  const nameA2 = DOM.playerA2Name.value || 'Player A2';
  const nameB1 = DOM.playerB1Name.value || 'Player B1';
  const nameB2 = DOM.playerB2Name.value || 'Player B2';

  if (servingTeam === 'A') {
    serverSelect.innerHTML = `
      <option value="A1">${nameA1}</option>
      <option value="A2">${nameA2}</option>
    `;
    receiverSelect.innerHTML = `
      <option value="B1">${nameB1}</option>
      <option value="B2">${nameB2}</option>
    `;
  } else {
    serverSelect.innerHTML = `
      <option value="B1">${nameB1}</option>
      <option value="B2">${nameB2}</option>
    `;
    receiverSelect.innerHTML = `
      <option value="A1">${nameA1}</option>
      <option value="A2">${nameA2}</option>
    `;
  }
}

// --- MATCH FLOW ACTIONS ---
function startMatch() {
  audio.init();

  // Read configurations
  state.matchFormat = parseInt(DOM.selectSets.value);
  state.targetPoints = parseInt(DOM.inputTargetPoints.value);
  state.maxPoints = parseInt(DOM.inputMaxPoints.value);

  state.teamA.name = DOM.teamAName.value.trim() || 'Team A';
  state.teamA.players = [DOM.playerA1Name.value.trim() || 'Player A1'];
  if (state.mode === 'doubles') {
    state.teamA.players.push(DOM.playerA2Name.value.trim() || 'Player A2');
  }

  state.teamB.name = DOM.teamBName.value.trim() || 'Team B';
  state.teamB.players = [DOM.playerB1Name.value.trim() || 'Player B1'];
  if (state.mode === 'doubles') {
    state.teamB.players.push(DOM.playerB2Name.value.trim() || 'Player B2');
  }

  // Setup sides: A starts Left, B starts Right
  state.courtSides = { left: 'A', right: 'B' };

  // Set initial player position mappings (even = standing in even service court)
  if (state.mode === 'singles') {
    state.playerPositions.A = { even: 'A1', odd: null };
    state.playerPositions.B = { even: 'B1', odd: null };
    
    const servingTeam = DOM.selectFirstServerTeam.value;
    state.currentServer = servingTeam === 'A' ? 'A1' : 'B1';
    state.currentReceiver = servingTeam === 'A' ? 'B1' : 'A1';
  } else {
    const servingTeam = DOM.selectFirstServerTeam.value;
    const serverVal = DOM.selectFirstServer.value;
    const receiverVal = DOM.selectFirstReceiver.value;

    state.currentServer = serverVal;
    state.currentReceiver = receiverVal;

    // The chosen server starts in Even (Right) court, partner in Odd (Left)
    if (servingTeam === 'A') {
      const serverIndex = serverVal === 'A1' ? 0 : 1;
      const partnerVal = serverVal === 'A1' ? 'A2' : 'A1';
      state.playerPositions.A = { even: serverVal, odd: partnerVal };

      const rxIndex = receiverVal === 'B1' ? 0 : 1;
      const rxPartnerVal = receiverVal === 'B1' ? 'B2' : 'B1';
      state.playerPositions.B = { even: receiverVal, odd: rxPartnerVal };
    } else {
      const serverIndex = serverVal === 'B1' ? 0 : 1;
      const partnerVal = serverVal === 'B1' ? 'B2' : 'B1';
      state.playerPositions.B = { even: serverVal, odd: partnerVal };

      const rxIndex = receiverVal === 'A1' ? 0 : 1;
      const rxPartnerVal = receiverVal === 'A1' ? 'A2' : 'A1';
      state.playerPositions.A = { even: receiverVal, odd: rxPartnerVal };
    }
  }

  // Initialize scores and histories
  state.currentGameIndex = 0;
  state.gameScores = [{ a: 0, b: 0 }];
  state.gameWins = { a: 0, b: 0 };
  state.shuttleCount = 1;
  state.shuttlesPerGame = [1];
  
  // Reset logs and stats
  state.logs = [];
  state.history = [];
  state.redoStack = [];
  state.stats = {
    consecutivePoints: { a: 0, b: 0, currentA: 0, currentB: 0 },
    serviceWon: { a: 0, b: 0 },
    receiveWon: { a: 0, b: 0 },
    rallyTimes: [],
    scoreHistory: [{ a: 0, b: 0 }]
  };

  // Start timers
  state.matchStartTime = Date.now();
  state.rallyStartTime = Date.now();
  state.totalElapsedSeconds = 0;
  state.rallyElapsedSeconds = 0;
  state.isPaused = false;

  clearInterval(state.timerIntervalId);
  state.timerIntervalId = setInterval(tickTimers, 1000);

  // Transition screens
  DOM.setupScreen.classList.remove('active');
  DOM.matchScreen.classList.add('active');

  logEvent('Match started!', 'system');
  saveMatchToStorage();
  updateUI();
  audio.playBeep(880, 0.2);
}

// --- CORE SCORING LOGIC ---
function scorePoint(winnerTeam) {
  if (state.isPaused) return;

  const loserTeam = winnerTeam === 'A' ? 'B' : 'A';
  saveToHistory();

  const game = state.gameScores[state.currentGameIndex];
  game[winnerTeam.toLowerCase()]++;

  const winnerScore = game[winnerTeam.toLowerCase()];
  const loserScore = game[loserTeam.toLowerCase()];

  // Check server team
  const servingTeam = state.currentServer.startsWith('A') ? 'A' : 'B';
  const isServicePoint = servingTeam === winnerTeam;

  // Track stats
  if (isServicePoint) {
    state.stats.serviceWon[winnerTeam.toLowerCase()]++;
  } else {
    state.stats.receiveWon[winnerTeam.toLowerCase()]++;
  }

  // Consecutive points tracking
  if (winnerTeam === 'A') {
    state.stats.consecutivePoints.currentA++;
    state.stats.consecutivePoints.currentB = 0;
    state.stats.consecutivePoints.a = Math.max(state.stats.consecutivePoints.a, state.stats.consecutivePoints.currentA);
  } else {
    state.stats.consecutivePoints.currentB++;
    state.stats.consecutivePoints.currentA = 0;
    state.stats.consecutivePoints.b = Math.max(state.stats.consecutivePoints.b, state.stats.consecutivePoints.currentB);
  }

  // Track score history for charting
  state.stats.scoreHistory.push({ a: game.a, b: game.b });

  // Rally time stats
  if (state.rallyStartTime) {
    const duration = (Date.now() - state.rallyStartTime) / 1000;
    state.stats.rallyTimes.push(duration);
  }
  state.rallyStartTime = Date.now();
  state.rallyElapsedSeconds = 0;

  // Clear redo stack on new action
  state.redoStack = [];

  audio.playPointSound(winnerTeam);

  // Log action
  const winnerName = getPlayerName(state.currentServer);
  const eventMsg = `${winnerTeam === 'A' ? state.teamA.name : state.teamB.name} scores. Score is now ${game.a} - ${game.b}.`;
  logEvent(eventMsg, winnerTeam.toLowerCase());

  // Check Game End
  const gameTarget = state.targetPoints;
  const maxPoints = state.maxPoints;
  const wonGame = (winnerScore >= gameTarget && (winnerScore - loserScore) >= 2) || (winnerScore === maxPoints);

  if (wonGame) {
    handleGameEnd(winnerTeam);
  } else {
    // Standard position and server/receiver updates
    updatePositionsAndService(winnerTeam, isServicePoint);

    // Automatic Court End Swapping in deciding set at 11 points
    const isDecidingGame = (state.currentGameIndex === state.matchFormat - 1) || 
                         (state.matchFormat === 3 && state.currentGameIndex === 2) ||
                         (state.matchFormat === 1 && state.currentGameIndex === 0);
                         
    if (isDecidingGame && winnerScore === 11 && loserScore < 11) {
      triggerSideSwapInterval();
    } else if (winnerScore === 11 && loserScore < 11) {
      // 11-point interval warning
      triggerInterval('Technical Interval (60s)', 60);
    }
  }

  saveMatchToStorage();
  updateUI();
}

function updatePositionsAndService(winnerTeam, isServicePoint) {
  const game = state.gameScores[state.currentGameIndex];
  const newWinnerScore = game[winnerTeam.toLowerCase()];

  if (state.mode === 'singles') {
    // Singles rules
    const serverID = winnerTeam === 'A' ? 'A1' : 'B1';
    const receiverID = winnerTeam === 'A' ? 'B1' : 'A1';

    state.currentServer = serverID;
    state.currentReceiver = receiverID;

    // Position of player depends on their score
    if (newWinnerScore % 2 === 0) {
      state.playerPositions[winnerTeam] = { even: serverID, odd: null };
    } else {
      state.playerPositions[winnerTeam] = { even: null, odd: serverID };
    }
    // Set receiver diagonally opposite
    const opponentTeam = winnerTeam === 'A' ? 'B' : 'A';
    const opponentScore = game[opponentTeam.toLowerCase()];
    if (newWinnerScore % 2 === 0) {
      state.playerPositions[opponentTeam] = { even: receiverID, odd: null };
    } else {
      state.playerPositions[opponentTeam] = { even: null, odd: receiverID };
    }
  } else {
    // Doubles rules
    if (isServicePoint) {
      // Winner is serving side: Server switches service court
      const team = winnerTeam;
      const temp = state.playerPositions[team].even;
      state.playerPositions[team].even = state.playerPositions[team].odd;
      state.playerPositions[team].odd = temp;

      // Same server. Set receiver diagonally opposite server's new court
      const isServerEven = state.playerPositions[team].even === state.currentServer;
      const opponentTeam = team === 'A' ? 'B' : 'A';
      state.currentReceiver = isServerEven ? state.playerPositions[opponentTeam].even : state.playerPositions[opponentTeam].odd;
    } else {
      // Winner is receiving side: No position change
      const team = winnerTeam;
      const opponentTeam = team === 'A' ? 'B' : 'A';
      const isEven = newWinnerScore % 2 === 0;

      // Server is the player standing in winner's Even/Odd court depending on new score
      state.currentServer = isEven ? state.playerPositions[team].even : state.playerPositions[team].odd;
      // Receiver is opponent player in diagonal court
      state.currentReceiver = isEven ? state.playerPositions[opponentTeam].even : state.playerPositions[opponentTeam].odd;
    }
  }
}

function handleGameEnd(winnerTeam) {
  state.gameWins[winnerTeam.toLowerCase()]++;
  
  const totalWins = state.gameWins[winnerTeam.toLowerCase()];
  const neededWins = Math.ceil(state.matchFormat / 2);
  
  logEvent(`Game ${state.currentGameIndex + 1} completed. ${winnerTeam === 'A' ? state.teamA.name : state.teamB.name} wins the game!`, 'system');

  if (totalWins === neededWins) {
    // Match completed
    state.isPaused = true;
    clearInterval(state.timerIntervalId);
    
    DOM.winnerTeamName.textContent = winnerTeam === 'A' ? state.teamA.name : state.teamB.name;
    
    // Build scores summary (e.g. 21-18, 15-21, 21-15)
    const summary = state.gameScores.map(score => `${score.a}-${score.b}`).join(', ');
    DOM.winnerScoreSummary.textContent = summary;
    
    setTimeout(() => {
      DOM.winnerOverlay.classList.remove('hidden');
      audio.playBuzzer();
    }, 1000);
  } else {
    // Move to next game
    state.currentGameIndex++;
    state.gameScores.push({ a: 0, b: 0 });
    state.shuttlesPerGame.push(1); // start with 1 shuttle in new game
    
    // Automatically swap sides between games
    swapSides();
    
    // Set server receiver for game startup based on BWF rules:
    // The side that wins the previous game serves first in the next game.
    // They can choose who serves/receives, but defaults to current positions
    // In our system, the server is determined by score (0-0 is even -> Right/Even player serves).
    const nextServerTeam = winnerTeam;
    const opponentTeam = nextServerTeam === 'A' ? 'B' : 'A';
    
    // Keep positions unchanged, but assign server based on even score rules (0-0 is even)
    state.currentServer = state.playerPositions[nextServerTeam].even;
    state.currentReceiver = state.playerPositions[opponentTeam].even;
    
    triggerInterval(`Game Interval (120s)`, 120);
  }
}

// --- TIMERS LOGIC ---
let intervalTimerId = null;
let intervalSecondsLeft = 0;

function tickTimers() {
  if (state.isPaused) return;

  // Match Timer
  state.totalElapsedSeconds++;
  const m = Math.floor(state.totalElapsedSeconds / 60).toString().padStart(2, '0');
  const s = (state.totalElapsedSeconds % 60).toString().padStart(2, '0');
  DOM.matchTimer.textContent = `${m}:${s}`;

  // Rally Timer
  state.rallyElapsedSeconds++;
  DOM.rallyTimer.textContent = `⏱️ ${state.rallyElapsedSeconds}s`;
}

function triggerInterval(title, duration) {
  state.isPaused = true;
  intervalSecondsLeft = duration;
  
  DOM.intervalTitle.textContent = title;
  DOM.intervalSubtitle.textContent = `Get ready for the next phase.`;
  DOM.intervalTimerVal.textContent = intervalSecondsLeft;
  DOM.intervalOverlay.classList.remove('hidden');

  logEvent(`Interval triggered: ${title}`, 'interval');
  
  audio.playBeep(440, 0.4);

  clearInterval(intervalTimerId);
  intervalTimerId = setInterval(() => {
    intervalSecondsLeft--;
    DOM.intervalTimerVal.textContent = intervalSecondsLeft;
    
    // Play sound at 3, 2, 1
    if (intervalSecondsLeft > 0 && intervalSecondsLeft <= 3) {
      audio.playBeep(600, 0.08);
    }

    if (intervalSecondsLeft <= 0) {
      skipInterval();
    }
  }, 1000);
}

function triggerSideSwapInterval() {
  swapSides();
  logEvent('Deciding game: Teams swapped court sides at 11 points.', 'system');
  triggerInterval('Court Swap Interval (60s)', 60);
}

function skipInterval() {
  clearInterval(intervalTimerId);
  DOM.intervalOverlay.classList.add('hidden');
  state.isPaused = false;
  state.rallyStartTime = Date.now();
  state.rallyElapsedSeconds = 0;
  
  audio.playBuzzer();
  logEvent('Interval finished. Match resumed.', 'system');
  updateUI();
}

function extendInterval() {
  intervalSecondsLeft += 30;
  DOM.intervalTimerVal.textContent = intervalSecondsLeft;
  logEvent('Interval extended by 30 seconds.', 'system');
}

function togglePauseMatch() {
  state.isPaused = !state.isPaused;
  if (state.isPaused) {
    DOM.btnPauseMatch.textContent = '▶️ Resume';
    DOM.btnPauseMatch.classList.add('active');
    logEvent('Match paused.', 'system');
  } else {
    DOM.btnPauseMatch.textContent = '⏸️ Pause';
    DOM.btnPauseMatch.classList.remove('active');
    state.rallyStartTime = Date.now();
    logEvent('Match resumed.', 'system');
  }
}

// --- UNDO / REDO ---
function saveToHistory() {
  const clonedState = JSON.stringify({
    currentGameIndex: state.currentGameIndex,
    gameScores: state.gameScores,
    gameWins: state.gameWins,
    courtSides: state.courtSides,
    playerPositions: state.playerPositions,
    currentServer: state.currentServer,
    currentReceiver: state.currentReceiver,
    shuttleCount: state.shuttleCount,
    shuttlesPerGame: state.shuttlesPerGame,
    stats: state.stats,
    logs: state.logs,
    totalElapsedSeconds: state.totalElapsedSeconds
  });
  state.history.push(clonedState);
  if (state.history.length > 50) state.history.shift(); // limit history depth
}

function undoAction() {
  if (state.history.length === 0) return;

  // Clone current state onto redo stack
  const currentState = JSON.stringify({
    currentGameIndex: state.currentGameIndex,
    gameScores: state.gameScores,
    gameWins: state.gameWins,
    courtSides: state.courtSides,
    playerPositions: state.playerPositions,
    currentServer: state.currentServer,
    currentReceiver: state.currentReceiver,
    shuttleCount: state.shuttleCount,
    shuttlesPerGame: state.shuttlesPerGame,
    stats: state.stats,
    logs: state.logs,
    totalElapsedSeconds: state.totalElapsedSeconds
  });
  state.redoStack.push(currentState);

  // Restore previous state
  const previousState = JSON.parse(state.history.pop());
  Object.assign(state, previousState);

  state.rallyStartTime = Date.now();
  state.rallyElapsedSeconds = 0;

  audio.playBeep(350, 0.15);
  logEvent('Undo executed.', 'system');
  
  saveMatchToStorage();
  updateUI();
}

function redoAction() {
  if (state.redoStack.length === 0) return;

  saveToHistory();

  const nextState = JSON.parse(state.redoStack.pop());
  Object.assign(state, nextState);

  state.rallyStartTime = Date.now();
  state.rallyElapsedSeconds = 0;

  audio.playBeep(450, 0.15);
  logEvent('Redo executed.', 'system');

  saveMatchToStorage();
  updateUI();
}

// --- SHUTTLE LOGIC ---
function recordNewShuttle() {
  state.shuttleCount++;
  state.shuttlesPerGame[state.currentGameIndex] = (state.shuttlesPerGame[state.currentGameIndex] || 0) + 1;
  
  audio.playBeep(523.25, 0.08);
  logEvent(`New shuttle requested. Total shuttles used: ${state.shuttleCount}.`, 'system');
  
  saveMatchToStorage();
  updateUI();
}

// --- COURT & SIDE SWAPPING ---
function swapSides() {
  const temp = state.courtSides.left;
  state.courtSides.left = state.courtSides.right;
  state.courtSides.right = temp;
}

function manualSwapSides() {
  saveToHistory();
  swapSides();
  logEvent('Manual swap of court sides.', 'system');
  saveMatchToStorage();
  updateUI();
}

// --- POSITIONS CORRECTION DIALOG ---
function openCorrectionModal() {
  DOM.correctionModal.classList.remove('hidden');
}

function manualSwapPositions(team) {
  saveToHistory();
  
  const temp = state.playerPositions[team].even;
  state.playerPositions[team].even = state.playerPositions[team].odd;
  state.playerPositions[team].odd = temp;

  // Recalculate receiver automatically based on server position
  const serverTeam = state.currentServer.startsWith('A') ? 'A' : 'B';
  const serverPos = state.playerPositions[serverTeam].even === state.currentServer ? 'even' : 'odd';
  
  const opponentTeam = serverTeam === 'A' ? 'B' : 'A';
  state.currentReceiver = serverPos === 'even' ? state.playerPositions[opponentTeam].even : state.playerPositions[opponentTeam].odd;

  logEvent(`Manual player swap on Team ${team}. Server/Receiver updated.`, 'system');
  
  saveMatchToStorage();
  updateUI();
}

// --- HELPER LOGGERS & ACCESSORS ---
function getPlayerName(playerId) {
  if (!playerId) return '';
  const team = playerId.startsWith('A') ? 'teamA' : 'teamB';
  const index = playerId.endsWith('1') ? 0 : 1;
  return state[team].players[index] || '';
}

function getPlayerId(team, name) {
  const players = state[`team${team}`].players;
  if (players[0] === name) return `${team}1`;
  if (players[1] === name) return `${team}2`;
  return `${team}1`;
}

function logEvent(msg, type = 'system') {
  state.logs.push({
    text: msg,
    type: type,
    gameIndex: state.currentGameIndex,
    timestamp: Date.now()
  });
}

// --- UI UPDATER ---
function updateUI() {
  const currentGame = state.gameScores[state.currentGameIndex];
  
  // Format digits
  DOM.scoreDisplayA.textContent = currentGame.a.toString().padStart(2, '0');
  DOM.scoreDisplayB.textContent = currentGame.b.toString().padStart(2, '0');
  DOM.shuttleCountVal.textContent = state.shuttleCount;

  // Update names dynamically matching current court sides layout
  const leftTeamId = state.courtSides.left;
  const rightTeamId = state.courtSides.right;

  DOM.scoreboardTeamAName.textContent = state[`team${leftTeamId}`].name;
  DOM.scoreboardTeamBName.textContent = state[`team${rightTeamId}`].name;

  // Set colors for scoreboard flags
  DOM.teamAFlag.style.backgroundColor = state[`team${leftTeamId}`].color;
  DOM.teamBFlag.style.backgroundColor = state[`team${rightTeamId}`].color;

  // Render Set wins dots
  renderSetDots('A', leftTeamId);
  renderSetDots('B', rightTeamId);

  // Match status text
  DOM.matchStatusLabel.textContent = `Game ${state.currentGameIndex + 1}`;

  // Score buttons text
  DOM.btnScoreA.textContent = `Point ${state[`team${leftTeamId}`].name} (+1)`;
  DOM.btnScoreB.textContent = `Point ${state[`team${rightTeamId}`].name} (+1)`;
  
  // Undo/Redo button states
  DOM.btnUndo.disabled = state.history.length === 0;
  DOM.btnRedo.disabled = state.redoStack.length === 0;

  // Render match logs tab
  renderLogs();

  // Render stats tab
  renderStats();

  // Render court visualizer
  drawCourt();
}

function renderSetDots(sideElementKey, teamId) {
  const container = sideElementKey === 'A' ? DOM.setsADots : DOM.setsBDots;
  container.innerHTML = '';
  
  const neededWins = Math.ceil(state.matchFormat / 2);
  const wins = state.gameWins[teamId.toLowerCase()];

  for (let i = 0; i < neededWins; i++) {
    const dot = document.createElement('span');
    dot.className = 'set-dot' + (i < wins ? ' won' : '');
    container.appendChild(dot);
  }
}

function renderLogs() {
  DOM.matchLog.innerHTML = '';
  // Show in reverse chronological order
  [...state.logs].reverse().forEach(log => {
    const entry = document.createElement('div');
    entry.className = `log-entry ${log.type}`;
    entry.textContent = log.text;
    DOM.matchLog.appendChild(entry);
  });
}

function switchTab(tab) {
  if (tab === 'log') {
    DOM.tabBtnLog.classList.add('active');
    DOM.tabBtnStats.classList.remove('active');
    DOM.tabContentLog.classList.add('active');
    DOM.tabContentStats.classList.remove('active');
  } else {
    DOM.tabBtnLog.classList.remove('active');
    DOM.tabBtnStats.classList.add('active');
    DOM.tabContentLog.classList.remove('active');
    DOM.tabContentStats.classList.add('active');
    renderStatsChart();
  }
}

function renderStats() {
  // Simple summary calculations
  const totalRallies = state.stats.rallyTimes.length;
  const avgRally = totalRallies > 0 
    ? (state.stats.rallyTimes.reduce((a,b) => a+b, 0) / totalRallies).toFixed(1) 
    : '0.0';

  DOM.statTotalTime.textContent = DOM.matchTimer.textContent;
  DOM.statAvgRally.textContent = `${avgRally}s`;
  DOM.statShuttles.textContent = state.shuttleCount;

  DOM.statConsecutiveA.textContent = state.stats.consecutivePoints.a;
  DOM.statConsecutiveB.textContent = state.stats.consecutivePoints.b;

  DOM.statServiceWonA.textContent = state.stats.serviceWon.a;
  DOM.statServiceWonB.textContent = state.stats.serviceWon.b;

  DOM.statReceiveWonA.textContent = state.stats.receiveWon.a;
  DOM.statReceiveWonB.textContent = state.stats.receiveWon.b;
}

function renderStatsChart() {
  const chartPathA = document.getElementById('chart-path-a');
  const chartPathB = document.getElementById('chart-path-b');
  if (!chartPathA || !chartPathB) return;

  const points = state.stats.scoreHistory;
  if (points.length < 2) {
    chartPathA.setAttribute('d', '');
    chartPathB.setAttribute('d', '');
    return;
  }

  // Draw chart in 200x100 space
  const maxVal = Math.max(state.targetPoints, ...points.map(p => Math.max(p.a, p.b)));
  const widthStep = 200 / (points.length - 1);
  const scaleY = 100 / maxVal;

  let pathA = '';
  let pathB = '';

  points.forEach((pt, index) => {
    const x = index * widthStep;
    const yA = 100 - (pt.a * scaleY);
    const yB = 100 - (pt.b * scaleY);

    if (index === 0) {
      pathA = `M ${x} ${yA}`;
      pathB = `M ${x} ${yB}`;
    } else {
      pathA += ` L ${x} ${yA}`;
      pathB += ` L ${x} ${yB}`;
    }
  });

  chartPathA.setAttribute('d', pathA);
  chartPathB.setAttribute('d', pathB);
  chartPathA.setAttribute('stroke', state.teamA.color);
  chartPathB.setAttribute('stroke', state.teamB.color);
}

// --- DYNAMIC SVG COURT RENDERER ---
function drawCourt() {
  DOM.playersGroup.innerHTML = '';
  DOM.serviceArrowGroup.innerHTML = '';
  DOM.courtHighlights.innerHTML = '';

  const leftTeamId = state.courtSides.left;  // e.g. 'A'
  const rightTeamId = state.courtSides.right; // e.g. 'B'

  // Service highlights coordinates mapping
  // Even is bottom-left (Team A on Left) / top-right (Team B on Right)
  // Odd is top-left (Team A on Left) / bottom-right (Team B on Right)
  const serviceBoxesCoords = {
    left: {
      even: { x: state.mode === 'singles' ? 80 : 140, y: 300, w: state.mode === 'singles' ? 240 : 180, h: state.mode === 'singles' ? 190 : 220 },
      odd:  { x: state.mode === 'singles' ? 80 : 140, y: state.mode === 'singles' ? 110 : 80,  w: state.mode === 'singles' ? 240 : 180, h: state.mode === 'singles' ? 190 : 220 }
    },
    right: {
      even: { x: 680, y: state.mode === 'singles' ? 110 : 80,  w: state.mode === 'singles' ? 240 : 180, h: state.mode === 'singles' ? 190 : 220 },
      odd:  { x: 680, y: 300, w: state.mode === 'singles' ? 240 : 180, h: state.mode === 'singles' ? 190 : 220 }
    }
  };

  // Find server & receiver physical positions
  let serverCoords = null;
  let receiverCoords = null;

  // Track players positions
  const sides = ['left', 'right'];
  sides.forEach(side => {
    const teamId = side === 'left' ? leftTeamId : rightTeamId;
    const isSingles = state.mode === 'singles';
    const teamColor = state[`team${teamId}`].color;

    // Draw Even Box Player
    const evenPlayerId = state.playerPositions[teamId].even;
    const isEvenServer = state.currentServer === evenPlayerId;
    const isEvenReceiver = state.currentReceiver === evenPlayerId;
    
    if (evenPlayerId) {
      // Coordinates
      const x = side === 'left' ? 220 : 780;
      const y = side === 'left' ? 400 : 200; // Left-Even is bottom (400), Right-Even is top (200)
      
      drawPlayerAvatar(x, y, evenPlayerId, teamId, teamColor, isEvenServer, isEvenReceiver);
      if (isEvenServer) serverCoords = { x, y, side, box: 'even' };
      if (isEvenReceiver) receiverCoords = { x, y, side, box: 'even' };
    }

    // Draw Odd Box Player
    const oddPlayerId = state.playerPositions[teamId].odd;
    const isOddServer = state.currentServer === oddPlayerId;
    const isOddReceiver = state.currentReceiver === oddPlayerId;
    
    if (oddPlayerId) {
      const x = side === 'left' ? 220 : 780;
      const y = side === 'left' ? 200 : 400; // Left-Odd is top (200), Right-Odd is bottom (400)
      
      drawPlayerAvatar(x, y, oddPlayerId, teamId, teamColor, isOddServer, isOddReceiver);
      if (isOddServer) serverCoords = { x, y, side, box: 'odd' };
      if (isOddReceiver) receiverCoords = { x, y, side, box: 'odd' };
    }
    
    // Draw the static singles player in standard waiting box if they are not serving/receiving (only relevant at start)
    if (isSingles && !serverCoords && teamId === (state.currentServer.startsWith('A') ? 'A' : 'B')) {
      // Just put them in even court
      const x = side === 'left' ? 220 : 780;
      const y = side === 'left' ? 400 : 200;
      drawPlayerAvatar(x, y, `${teamId}1`, teamId, teamColor, true, false);
      serverCoords = { x, y, side, box: 'even' };
    }
    if (isSingles && !receiverCoords && teamId === (state.currentReceiver.startsWith('A') ? 'A' : 'B')) {
      const x = side === 'left' ? 220 : 780;
      const y = side === 'left' ? 200 : 400; // opposite box
      drawPlayerAvatar(x, y, `${teamId}1`, teamId, teamColor, false, true);
      receiverCoords = { x, y, side, box: 'odd' };
    }
  });

  // Render active service and receiving box highlights
  if (serverCoords) {
    const box = serviceBoxesCoords[serverCoords.side][serverCoords.box];
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', box.x);
    rect.setAttribute('y', box.y);
    rect.setAttribute('width', box.w);
    rect.setAttribute('height', box.h);
    rect.setAttribute('class', 'service-zone-highlight');
    DOM.courtHighlights.appendChild(rect);
  }

  if (receiverCoords) {
    const box = serviceBoxesCoords[receiverCoords.side][receiverCoords.box];
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', box.x);
    rect.setAttribute('y', box.y);
    rect.setAttribute('width', box.w);
    rect.setAttribute('height', box.h);
    rect.setAttribute('class', 'receive-zone-highlight');
    DOM.courtHighlights.appendChild(rect);
  }

  // Draw Service Direction Arrow
  if (serverCoords && receiverCoords) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const startX = serverCoords.x;
    const startY = serverCoords.y;
    const endX = receiverCoords.x;
    const endY = receiverCoords.y;
    
    // Add arrow def marker if not already present
    if (!document.getElementById('arrowhead')) {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', 'arrowhead');
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', '8');
      marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '6');
      marker.setAttribute('markerHeight', '6');
      marker.setAttribute('orient', 'auto-start-reverse');
      
      const markerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      markerPath.setAttribute('d', 'M 0 1 L 10 5 L 0 9 z');
      markerPath.setAttribute('fill', 'var(--accent-orange)');
      marker.appendChild(markerPath);
      defs.appendChild(marker);
      DOM.courtSvg.appendChild(defs);
    }

    // Direct diagonal line path
    // Slightly offset start/end so it doesn't touch the player circles directly
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.sqrt(dx*dx + dy*dy);
    const startOffset = 25; // radius of player circle + space
    const endOffset = 30;
    
    const x1 = startX + (dx / len) * startOffset;
    const y1 = startY + (dy / len) * startOffset;
    const x2 = endX - (dx / len) * endOffset;
    const y2 = endY - (dy / len) * endOffset;

    path.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
    path.setAttribute('class', 'service-arrow');
    path.setAttribute('marker-end', 'url(#arrowhead)');
    DOM.serviceArrowGroup.appendChild(path);
  }
}

function drawPlayerAvatar(x, y, id, teamId, color, isServer, isReceiver) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', `player-avatar team-${teamId.toLowerCase()} ${isServer ? 'active-server' : ''}`);
  
  // Outer circle
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', x);
  circle.setAttribute('cy', y);
  circle.setAttribute('r', 20);
  g.appendChild(circle);

  // Initials Text
  const initials = getPlayerInitials(getPlayerName(id));
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', x);
  text.setAttribute('y', y);
  text.setAttribute('class', 'player-label');
  text.textContent = initials;
  g.appendChild(text);

  // Name Plate Overlay under player
  const nameG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const name = getPlayerName(id);
  const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  nameText.setAttribute('x', x);
  nameText.setAttribute('y', y + 34);
  nameText.setAttribute('class', 'court-player-name-bg');
  
  // Draw small background bar for name readability
  const nameBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  nameBg.setAttribute('x', x - 55);
  nameBg.setAttribute('y', y + 24);
  nameBg.setAttribute('width', 110);
  nameBg.setAttribute('height', 16);
  nameBg.setAttribute('class', 'court-player-name-bg');
  
  const actualText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  actualText.setAttribute('x', x);
  actualText.setAttribute('y', y + 32);
  actualText.setAttribute('class', 'player-card-label');
  actualText.textContent = name;

  nameG.appendChild(nameBg);
  nameG.appendChild(actualText);
  g.appendChild(nameG);

  // Badges (Server / Receiver)
  if (isServer) {
    const badgeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const badgeCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    badgeCircle.setAttribute('cx', x - 14);
    badgeCircle.setAttribute('cy', y - 14);
    badgeCircle.setAttribute('r', 8);
    badgeCircle.setAttribute('fill', 'var(--accent-orange)');
    badgeCircle.setAttribute('stroke', '#ffffff');
    badgeCircle.setAttribute('stroke-width', '1.5');
    
    const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    badgeText.setAttribute('x', x - 14);
    badgeText.setAttribute('y', y - 14);
    badgeText.setAttribute('class', 'player-label');
    badgeText.setAttribute('font-size', '9');
    badgeText.textContent = 'S';
    
    badgeG.appendChild(badgeCircle);
    badgeG.appendChild(badgeText);
    g.appendChild(badgeG);
  } else if (isReceiver) {
    const badgeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const badgeCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    badgeCircle.setAttribute('cx', x + 14);
    badgeCircle.setAttribute('cy', y - 14);
    badgeCircle.setAttribute('r', 8);
    badgeCircle.setAttribute('fill', 'var(--accent-cyan)');
    badgeCircle.setAttribute('stroke', '#ffffff');
    badgeCircle.setAttribute('stroke-width', '1.5');
    
    const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    badgeText.setAttribute('x', x + 14);
    badgeText.setAttribute('y', y - 14);
    badgeText.setAttribute('class', 'player-label');
    badgeText.setAttribute('font-size', '9');
    badgeText.textContent = 'R';
    
    badgeG.appendChild(badgeCircle);
    badgeG.appendChild(badgeText);
    g.appendChild(badgeG);
  }

  DOM.playersGroup.appendChild(g);
}

function getPlayerInitials(name) {
  if (!name) return '';
  const parts = name.split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// --- UTILITIES: RESET / PERSISTENCE / THEME ---
function confirmResetMatch() {
  if (confirm('Are you sure you want to reset this match and clear all progress?')) {
    restartToSetup();
  }
}

function restartToSetup() {
  clearInterval(state.timerIntervalId);
  clearInterval(intervalTimerId);
  
  localStorage.removeItem('courtmaster_saved_match');

  DOM.winnerOverlay.classList.add('hidden');
  DOM.matchScreen.classList.remove('active');
  DOM.setupScreen.classList.add('active');
  
  audio.playBeep(400, 0.2);
}

function saveMatchToStorage() {
  const matchData = {
    mode: state.mode,
    matchFormat: state.matchFormat,
    targetPoints: state.targetPoints,
    maxPoints: state.maxPoints,
    teamA: state.teamA,
    teamB: state.teamB,
    currentGameIndex: state.currentGameIndex,
    gameScores: state.gameScores,
    gameWins: state.gameWins,
    courtSides: state.courtSides,
    playerPositions: state.playerPositions,
    currentServer: state.currentServer,
    currentReceiver: state.currentReceiver,
    shuttleCount: state.shuttleCount,
    shuttlesPerGame: state.shuttlesPerGame,
    totalElapsedSeconds: state.totalElapsedSeconds,
    logs: state.logs,
    stats: state.stats,
    history: state.history
  };
  localStorage.setItem('courtmaster_saved_match', JSON.stringify(matchData));
}

function loadSavedMatch() {
  const dataStr = localStorage.getItem('courtmaster_saved_match');
  if (!dataStr) return;

  try {
    const data = JSON.parse(dataStr);
    
    // Check if valid data
    if (!data.gameScores || data.gameScores.length === 0) return;

    Object.assign(state, data);

    // Reconstruct setup screen values to match state
    setMode(state.mode);
    DOM.selectSets.value = state.matchFormat;
    DOM.inputTargetPoints.value = state.targetPoints;
    DOM.inputMaxPoints.value = state.maxPoints;

    DOM.teamAName.value = state.teamA.name;
    DOM.playerA1Name.value = state.teamA.players[0] || '';
    DOM.playerA2Name.value = state.teamA.players[1] || '';

    DOM.teamBName.value = state.teamB.name;
    DOM.playerB1Name.value = state.teamB.players[0] || '';
    DOM.playerB2Name.value = state.teamB.players[1] || '';

    // Re-active match screen
    DOM.setupScreen.classList.remove('active');
    DOM.matchScreen.classList.add('active');

    // Restart timer interval
    state.rallyStartTime = Date.now();
    state.rallyElapsedSeconds = 0;
    state.isPaused = false;
    clearInterval(state.timerIntervalId);
    state.timerIntervalId = setInterval(tickTimers, 1000);

    updateUI();
    logEvent('Resumed match from local save.', 'system');
  } catch (e) {
    console.error("Error loading saved match from localStorage", e);
  }
}

function toggleTheme() {
  document.body.classList.toggle('light-theme');
  audio.playBeep(700, 0.08);
}

function toggleSound() {
  audio.enabled = !audio.enabled;
  DOM.soundToggle.textContent = audio.enabled ? '🔊' : '🔇';
  DOM.soundToggle.classList.toggle('active', audio.enabled);
  if (audio.enabled) {
    audio.playBeep(600, 0.08);
  }
}

function checkAudioAutoPlay() {
  // Check if browser allows audio contexts or flags muted initially
  const context = new (window.AudioContext || window.webkitAudioContext)();
  if (context.state === 'suspended') {
    DOM.audioActivatorBanner.classList.remove('hidden');
  }
  context.close();
}

// Start application
window.addEventListener('DOMContentLoaded', initApp);
