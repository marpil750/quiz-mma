let fighters = [];
let dailyFighter = null;
let blurLevel = 15;
let maxAttempts = 8;

fetch('fighters.json')
  .then(response => response.json())
  .then(data => {
    fighters = data;
    dailyFighter = getDailyFighter();
    displayFighter(dailyFighter);
  });

function getDailyFighter() {
  const today = new Date().toISOString().slice(0,10);
  const savedDate = localStorage.getItem('dailyFighterDate');

  if (savedDate === today && localStorage.getItem('dailyFighter')) {
    return JSON.parse(localStorage.getItem('dailyFighter'));
  } else {
    const fighter = fighters[Math.floor(Math.random() * fighters.length)];
    localStorage.setItem('dailyFighter', JSON.stringify(fighter));
    localStorage.setItem('dailyFighterDate', today);
    return fighter;
  }
}

function displayFighter(fighter) {
  let attempts = 0;
  const name = fighter.name.toLowerCase();
  let hintArray = name.replace(/[a-zA-Ząęćłńóśźż]/g, '_').split('');

  const container = document.getElementById('fighter-container');
  container.innerHTML = `
    <h2>Zgadnij zawodnika!</h2>
    <img id="fighter-image" src="${fighter.image}" alt="${fighter.name}" style="max-width:200px; filter: blur(${blurLevel}px); transition: filter 0.5s;">
    <p><strong>Kraj:</strong> ${fighter.country}</p>
    <p><strong>Waga:</strong> ${fighter.division}</p>
    <p><strong>Organizacja:</strong> ${fighter.organization}</p>
    <p id="name-hint">${hintArray.join(' ')}</p>
    <input type="text" id="guess-input" maxlength="1" placeholder="Wpisz literę">
    <button id="guess-btn">Sprawdź</button>
    <p id="feedback"></p>
  `;

  document.getElementById('guess-btn').addEventListener('click', () => {
    const guess = document.getElementById('guess-input').value.trim().toLowerCase();
    if (!guess) return;

    let correctLetter = false;
    for (let i = 0; i < name.length; i++) {
      if (name[i] === guess) {
        hintArray[i] = fighter.name[i];
        correctLetter = true;
      }
    }

    if (!correctLetter) {
      attempts++;
      blurLevel = Math.max(blurLevel - 5, 0);
      document.getElementById('fighter-image').style.filter = `blur(${blurLevel}px)`;
    }

    document.getElementById('name-hint').textContent = hintArray.join(' ');

    if (hintArray.join('').toLowerCase() === name) {
      document.getElementById('feedback').textContent = "Brawo! Trafione!";
      document.getElementById('fighter-image').style.filter = 'blur(0px)';
      document.getElementById('guess-btn').disabled = true;
      document.getElementById('guess-input').disabled = true;
    } else if (attempts >= maxAttempts) {
      document.getElementById('feedback').textContent = `Przegrałeś! To był ${fighter.name}`;
      document.getElementById('fighter-image').style.filter = 'blur(0px)';
      document.getElementById('name-hint').textContent = fighter.name;
      document.getElementById('guess-btn').disabled = true;
      document.getElementById('guess-input').disabled = true;
    }

    document.getElementById('guess-input').value = '';
    document.getElementById('guess-input').focus();
  });
}
