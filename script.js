/* Quiz WHOAREYA-like — wpisujesz IMIĘ + NAZWISKO
   - porównania literowe (zielony/żółty/czerwony)
   - porównanie cech: organization/country/division
   - blur image maleje po błędach
   - 8 prób
   - daily fighter (ten sam dla wszystkich tego dnia, zapisany w localStorage)
*/

/* KONFIG */
const MAX_ATTEMPTS = 8;
const INITIAL_BLUR = 12; // px
const BLUR_STEP = Math.ceil(INITIAL_BLUR / MAX_ATTEMPTS); // ile zmniejszamy przy błędzie

/* STAN */
let fighters = [];
let target = null;
let attempts = 0;
let currentBlur = INITIAL_BLUR;

/* PRZYDATNE SELECTORY */
const imgEl = document.getElementById('fighter-image');
const countryEl = document.getElementById('country');
const divisionEl = document.getElementById('division');
const orgEl = document.getElementById('organization');
const attemptsLeftEl = document.getElementById('attempts-left');
const historyEl = document.getElementById('history');
const feedbackEl = document.getElementById('result-message');
const guessInput = document.getElementById('guess-input');
const guessBtn = document.getElementById('guess-btn');

/* NORMALIZACJA (usuwa diakrytyczne znaki do porównań) */
function normalize(str){
  return str
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu,'')
    .toLowerCase()
    .replace(/\s+/g,' ') // multiple spaces -> single
    .trim();
}

/* Ładowanie JSON */
fetch('fighters.json')
  .then(r => r.json())
  .then(data => {
    fighters = data;
    target = getDailyFighter();
    initUI();
  })
  .catch(err => {
    feedbackEl.textContent = 'Błąd wczytywania danych: ' + err;
  });

/* DAILY FIGHTER — ten sam dla wszystkich użytkowników danego dnia */
function getDailyFighter(){
  const today = (new Date()).toISOString().slice(0,10);
  const savedDate = localStorage.getItem('dailyFighterDate');
  const saved = localStorage.getItem('dailyFighter');
  if(savedDate === today && saved){
    return JSON.parse(saved);
  } else {
    const pick = fighters[Math.floor(Math.random()*fighters.length)];
    localStorage.setItem('dailyFighter', JSON.stringify(pick));
    localStorage.setItem('dailyFighterDate', today);
    return pick;
  }
}

/* UI start */
function initUI(){
  attempts = 0;
  currentBlur = INITIAL_BLUR;
  feedbackEl.textContent = '';
  historyEl.innerHTML = '';
  guessInput.value = '';
  guessInput.disabled = false;
  guessBtn.disabled = false;

  // ustaw meta (pokazujemy atrybuty tylko jako "pola do porównania" – na początku nie podajemy wyników)
  countryEl.textContent = 'Kraj: ?';
  divisionEl.textContent = 'Waga: ?';
  orgEl.textContent = 'Organizacja: ?';

  // zdjęcie
  imgEl.src = target.image;
  imgEl.alt = target.name;
  imgEl.style.filter = `blur(${currentBlur}px)`;

  updateAttemptsLeft();
}

/* Aktualizacja tekstu prób */
function updateAttemptsLeft(){
  attemptsLeftEl.textContent = `Próby: ${attempts} / ${MAX_ATTEMPTS}`;
}

/* Główna logika sprawdzenia jednej próby */
function handleGuess(raw){
  if(!raw) return;
  if(attempts >= MAX_ATTEMPTS) return;

  const guess = normalize(raw);
  const targetName = normalize(target.name);

  // 1) Literowe porównanie — Wordle-like dla CAŁEGO wpisu (spacje zachowujemy w wizualizacji)
  const guessChars = guess.split('');
  const targetChars = targetName.split('');

  // Przygotuj strukturę oceny
  let resultTiles = new Array(guessChars.length).fill('red');

  // Do algorytmu Wordle: najpierw zaznacz greens, potem yells (zliczając pozostałe litery)
  const targetRemaining = [];
  for(let i=0;i<targetChars.length;i++){
    if(guessChars[i] && guessChars[i] === targetChars[i]){
      resultTiles[i] = 'green';
    } else {
      targetRemaining.push(targetChars[i]);
    }
  }
  // zaznacz yellow gdzie litera występuje gdzieś indziej (i usuń z targetRemaining)
  for(let i=0;i<guessChars.length;i++){
    if(resultTiles[i] === 'green') continue;
    const idx = targetRemaining.indexOf(guessChars[i]);
    if(idx !== -1){
      resultTiles[i] = 'yellow';
      targetRemaining.splice(idx,1);
    } else {
      resultTiles[i] = 'red';
    }
  }

  // 2) Cecha: organization / country / division
  const traitResults = {
    organization: traitCompare(normalize(target.organization), normalize(rawTrait(target.organization, raw))),
    country: traitCompare(normalize(target.country), normalize(rawTrait(target.country, raw))),
    division: divisionCompare(normalize(target.division), normalize(rawTrait(target.division, raw)))
  };

  // Rysuj wynik w historii
  renderHistoryRow(raw, guessChars, resultTiles, traitResults);

  // jeśli zgadł dokładnie całe imię+nazwisko (po normalizacji)
  attempts++;
  if(guess === targetName){
    // wygrana
    feedbackEl.textContent = `Brawo! Trafiłeś — to ${target.name}.`;
    revealTarget();
    disableInput();
    return;
  } else {
    // nie trafione
    // zmniejsz blur
    currentBlur = Math.max(0, currentBlur - BLUR_STEP);
    imgEl.style.filter = `blur(${currentBlur}px)`;

    if(attempts >= MAX_ATTEMPTS){
      feedbackEl.textContent = `Koniec prób — to był: ${target.name}`;
      revealTarget();
      disableInput();
    } else {
      feedbackEl.textContent = `Źle — prób: ${attempts} z ${MAX_ATTEMPTS}.`;
    }
  }

  updateAttemptsLeft();
}

/* Pomocnicze: pobiera trait z wpisu użytkownika (próbujemy wyciągnąć słowa pasujące do kraj/organizacja/waga)
   - Uproszczona heurystyka: sprawdzamy czy w surowym wpisie (raw) występują nazwy organizacji/krajów/wag (lista z JSON) */
function rawTrait(originalTrait, rawInput){
  // dla prostoty zwracamy rawInput — ale traitCompare porównuje normalizację i sprawdza występowanie słowa.
  // (tutaj można dodać bardziej zaawansowaną ekstrakcję)
  return rawInput;
}

/* Porównanie cechy - jeżeli występuje dokładny match słowa z rawInput -> green.
   Jeżeli nie, zwracamy red. (Proste i skuteczne.) */
function traitCompare(targetTraitNorm, rawInputNorm){
  // Sprawdzimy czy targetTraitNorm występuje w rawInputNorm (np. wpis "conor mcgregor ireland ufc")
  if(rawInputNorm.includes(targetTraitNorm)) return 'green';
  // inaczej red
  return 'red';
}

/* Porównanie wagi: jeśli dokładny match -> green.
   Jeśli słowo wagowe występuje (np 'waga lekka' vs 'lekka' lub 'lekko-półśrednia') -> yellow
*/
function divisionCompare(targetDivNorm, rawInputNorm){
  if(rawInputNorm.includes(targetDivNorm)) return 'green';

  // proste grupowanie wag: szukamy podstawowego słowa (musza, kogucia, piórkowa, lekka, półśrednia, średnia, półciężka, ciężka)
  const groups = ['musza','koguca','piórkowa','pior kowa','lekka','lekkopolsrednia','lekko','półśrednia','polsrednia','średnia','srednia','półciężka','polciezka','ciężka','ciezka'];
  // ujednolicenie: usuń znaki diakrytyczne
  const g = targetDivNorm;
  for(const key of groups){
    if(g.includes(key)) {
      // czy wpis użytkownika zawiera któryś z tych kluczowych słów?
      for(const key2 of groups){
        if(rawInputNorm.includes(key2)){
          // jeśli trafił na jakiś, to daj yellow (podobna kategoria)
          return 'yellow';
        }
      }
    }
  }
  return 'red';
}

/* Rysowanie w historii */
function renderHistoryRow(rawText, guessChars, resultTiles, traitResults){
  const row = document.createElement('div');
  row.className = 'guess-row';

  // tiles (wyświetlamy literki zgadniętego stringu w oryginalnej formie użytkownika, ale kolorujemy wg normalizacji)
  const tilesWrap = document.createElement('div');
  tilesWrap.className = 'tiles';

  for(let i=0;i<guessChars.length;i++){
    const t = document.createElement('div');
    t.className = 'tile ' + resultTiles[i];
    t.textContent = guessChars[i] === ' ' ? ' ' : guessChars[i].toUpperCase();
    tilesWrap.appendChild(t);
  }
  row.appendChild(tilesWrap);

  // Badges (traits)
  const badges = document.createElement('div');
  badges.className = 'badges';

  const orgBadge = document.createElement('div');
  orgBadge.className = 'badge ' + (traitResults.organization === 'green' ? 'green' : traitResults.organization === 'yellow' ? 'yellow' : 'red');
  orgBadge.textContent = `Org: ${target.organization}`;
  badges.appendChild(orgBadge);

  const countryBadge = document.createElement('div');
  countryBadge.className = 'badge ' + (traitResults.country === 'green' ? 'green' : traitResults.country === 'yellow' ? 'yellow' : 'red');
  countryBadge.textContent = `Kraj: ${target.country}`;
  badges.appendChild(countryBadge);

  const divBadge = document.createElement('div');
  divBadge.className = 'badge ' + (traitResults.division === 'green' ? 'green' : traitResults.division === 'yellow' ? 'yellow' : 'red');
  divBadge.textContent = `Waga: ${target.division}`;
  badges.appendChild(divBadge);

  row.appendChild(badges);
  historyEl.prepend(row);
}

/* Pokazanie pełnego zdjęcia i odsłonięcie atrybutów */
function revealTarget(){
  imgEl.style.filter = 'blur(0px)';
  countryEl.textContent = `Kraj: ${target.country}`;
  divisionEl.textContent = `Waga: ${target.division}`;
  orgEl.textContent = `Organizacja: ${target.organization}`;
}

/* Wyłącz input po zakończeniu */
function disableInput(){
  guessInput.disabled = true;
  guessBtn.disabled = true;
}

/* Obsługa guzika */
guessBtn.addEventListener('click', () => {
  const val = guessInput.value.trim();
  if(!val) return;
  handleGuess(val);
  guessInput.value = '';
  guessInput.focus();
});
guessInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter') {
    guessBtn.click();
  }
});
