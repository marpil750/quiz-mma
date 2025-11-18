/* Game script: Wordle-like WhoAreYa UFC edition */
const MAX_ATTEMPTS = 8;
let fighters = [];
let target = null;
let attempts = 0;
let initialBlur = 14;

const imgEl = document.getElementById('fighter-image');
const inputEl = document.getElementById('guess-input');
const suggestionsEl = document.getElementById('suggestions');
const guessBtn = document.getElementById('guess-btn');
const attemptsEl = document.getElementById('attempts');
const historyEl = document.getElementById('history');
const resultEl = document.getElementById('result');

// load fighters
fetch('fighters.json').then(r=>r.json()).then(data=>{
  fighters = data.filter(f=> (f.organization||'').toLowerCase().includes('ufc')); // only UFC
  // choose daily fighter
  target = getDailyFighter(fighters);
  setupUI();
}).catch(e=>{ console.error(e); resultEl.textContent='Błąd wczytywania bazy'; });

function getDailyFighter(list){
  const today = new Date().toISOString().slice(0,10);
  const savedDate = localStorage.getItem('dailyFighterDate');
  if(savedDate === today && localStorage.getItem('dailyFighter')){
    return JSON.parse(localStorage.getItem('dailyFighter'));
  }
  const pick = list[Math.floor(Math.random()*list.length)];
  localStorage.setItem('dailyFighter', JSON.stringify(pick));
  localStorage.setItem('dailyFighterDate', today);
  return pick;
}

function setupUI(){
  attempts=0;
  imgEl.src = target.image || '';
  imgEl.style.filter = `blur(${initialBlur}px)`;
  attemptsEl.textContent = `Próby: ${attempts} / ${MAX_ATTEMPTS}`;
  inputEl.value = '';
  inputEl.focus();
  resultEl.textContent = '';
  suggestionsEl.innerHTML='';
  historyEl.innerHTML='';
}

// autocomplete suggestions
inputEl.addEventListener('input', ()=>{
  const q = inputEl.value.trim().toLowerCase();
  suggestionsEl.innerHTML='';
  if(!q) return;
  const matches = fighters.filter(f=> f.name.toLowerCase().startsWith(q)).slice(0,20);
  for(const m of matches){
    const div = document.createElement('div');
    div.className='suggestion';
    div.textContent = m.name;
    div.addEventListener('click', ()=>{ selectSuggestion(m.name); });
    suggestionsEl.appendChild(div);
  }
});

function selectSuggestion(name){
  inputEl.value = name;
  suggestionsEl.innerHTML='';
  submitGuess();
}

guessBtn.addEventListener('click', submitGuess);
inputEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ submitGuess(); } });

function submitGuess(){
  const val = inputEl.value.trim();
  if(!val) return;
  const chosen = fighters.find(f=> f.name.toLowerCase()===val.toLowerCase());
  if(!chosen){ resultEl.textContent='Zawodnik nie znaleziony w bazie'; return; }
  // count attempt
  attempts++;
  // compare name letters (wordle-like)
  renderGuessRow(chosen);
  // reduce blur slightly on wrong guess
  if(chosen.name.toLowerCase() === target.name.toLowerCase()){
    resultEl.textContent = `Brawo! To ${target.name}`;
    imgEl.style.filter='blur(0px)';
    disableInput();
    return;
  } else {
    const blurStep = Math.ceil(initialBlur / MAX_ATTEMPTS);
    const newBlur = Math.max(0, parseInt(imgEl.style.filter.replace(/[^\d]/g,'')) - blurStep);
    imgEl.style.filter = `blur(${newBlur}px)`;
    if(attempts>=MAX_ATTEMPTS){
      resultEl.textContent = `Koniec prób — to był ${target.name}`;
      imgEl.style.filter='blur(0px)';
      disableInput();
    } else {
      attemptsEl.textContent = `Próby: ${attempts} / ${MAX_ATTEMPTS}`;
    }
  }
  inputEl.value='';
  inputEl.focus();
}

// compare and render row
function renderGuessRow(chosen){
  const row = document.createElement('div');
  // name tiles
  const nameWrap = document.createElement('div');
  // show underscores for target name length
  const targetName = target.name;
  // letter-by-letter coloring (green if same letter same pos, yellow if exists elsewhere, red otherwise)
  const guess = chosen.name;
  const g = guess.toLowerCase();
  const t = targetName.toLowerCase();
  // build counts for yellow logic
  const tCounts = {};
  for(let i=0;i<t.length;i++){
    const ch = t[i];
    if(ch===' ') continue;
    tCounts[ch] = (tCounts[ch]||0)+1;
  }
  // first pass greens
  const colors = new Array(g.length).fill('red');
  for(let i=0;i<g.length;i++){
    if(g[i]===t[i]){
      colors[i]='green';
      tCounts[g[i]] = (tCounts[g[i]]||0)-1;
    }
  }
  // second pass yellows
  for(let i=0;i<g.length;i++){
    if(colors[i]==='green') continue;
    if(tCounts[g[i]]>0){
      colors[i]='yellow';
      tCounts[g[i]]--;
    }
  }
  for(let i=0;i<g.length;i++){
    const span = document.createElement('span');
    span.className='tile ' + colors[i];
    span.textContent = g[i].toUpperCase();
    nameWrap.appendChild(span);
  }
  row.appendChild(nameWrap);

  // badges: weight, age, nationality
  const badges = document.createElement('div');
  badges.style.marginTop='8px';

  // weight comparison: we attempt to map classes to rough order using keywords
  const wcOrder = ['fly','bantam','feather','light','welter','middle','lightheavy','heavy'];
  function normalizeWC(s){
    if(!s) return '';
    return s.toLowerCase().replace(/[^a-z0-9]/g,'');
  }
  const tgtWC = normalizeWC(target.division || '');
  const chosenWC = normalizeWC(chosen.division || '');
  let wcBadge = document.createElement('span');
  wcBadge.className='badge';
  if(tgtWC && chosenWC && tgtWC===chosenWC){
    wcBadge.classList.add('match');
    wcBadge.textContent = 'Waga: ' + chosen.division;
  } else if(tgtWC && chosenWC){
    // compare by finding index in wcOrder
    const ti = wcOrder.findIndex(k=>tgtWC.includes(k));
    const ci = wcOrder.findIndex(k=>chosenWC.includes(k));
    if(ti!==-1 && ci!==-1){
      if(ci>ti){ wcBadge.classList.add('down'); wcBadge.textContent = 'Waga: ' + chosen.division + ' ↓'; }
      else if(ci<ti){ wcBadge.classList.add('up'); wcBadge.textContent = 'Waga: ' + chosen.division + ' ↑'; }
      else { wcBadge.classList.add('badge'); wcBadge.textContent = 'Waga: ' + chosen.division; }
    } else {
      wcBadge.textContent = 'Waga: ' + chosen.division;
    }
  } else {
    wcBadge.textContent = 'Waga: ' + chosen.division;
  }
  badges.appendChild(wcBadge);

  // age comparison
  const ageBadge = document.createElement('span');
  ageBadge.className='badge';
  const tgtAge = parseInt(target.age) || null;
  const chAge = parseInt(chosen.age) || null;
  if(tgtAge && chAge){
    if(chAge===tgtAge){ ageBadge.classList.add('match'); ageBadge.textContent = 'Wiek: ' + chAge; }
    else if(chAge>tgtAge){ ageBadge.classList.add('down'); ageBadge.textContent = 'Wiek: ' + chAge + ' ↓'; }
    else { ageBadge.classList.add('up'); ageBadge.textContent = 'Wiek: ' + chAge + ' ↑'; }
  } else {
    ageBadge.textContent = 'Wiek: ' + (chosen.age || '');
  }
  badges.appendChild(ageBadge);

  // nationality (exact match -> green)
  const natBadge = document.createElement('span');
  natBadge.className='badge';
  const tgtNat = (target.nationality||'').toLowerCase();
  const chNat = (chosen.nationality||'').toLowerCase();
  if(tgtNat && chNat && tgtNat===chNat){
    natBadge.classList.add('match'); natBadge.textContent = 'Narodowość: ' + chosen.nationality;
  } else {
    natBadge.textContent = 'Narodowość: ' + chosen.nationality;
  }
  badges.appendChild(natBadge);

  row.appendChild(badges);
  historyEl.prepend(row);
}

function disableInput(){
  inputEl.disabled = true;
  guessBtn.disabled = true;
}
