// Pomocnicza funkcja losująca wartość z przedziału
const rand = (m, M) => Math.random() * (M - m) + m;

// Globalne zmienne symulacji
let teamCandidates = [];    // Lista drużyn do losowania (kandydaci)
let availableNumbers = [];  // Dostępne numery startowe
let winners = [];           // Zwycięzcy: obiekty { team, number }
let currentPhase = "team";  // Aktualna faza: "team" lub "number" (lub "done")
let sectors = [];           // Dane do rysowania koła (w zależności od fazy)
let tot = 0;                // Liczba sektorów
let arc = 0;                // Kąt pojedynczego sektora
let isSpinning = false;     // Flaga – czy koło aktualnie się kręci?
let angVel = 0;             // Aktualna prędkość obrotu
let ang = 0;                // Aktualny kąt obrotu
let isAnimatingTransfer = false;

const PI = Math.PI;
const TAU = 2 * PI;
const friction = 0.991;

const spinEl = document.getElementById('spin');
const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');
const dia = canvas.width;    // 800 pikseli
const rad = dia / 2;         // 400 pikseli

// Funkcja generująca kolor – równomiernie rozkłada barwy
function getColor(i, total) {
  return `hsl(${(i * 360 / total)}, 70%, 50%)`;
}

// Rysowanie pojedynczego sektora (używane zarówno przy losowaniu drużyny, jak i numeru)
function drawSector(sector, i) {
  const startAngle = arc * i;
  ctx.save();
  
  // Rysowanie wypełnionego wycinka
  ctx.beginPath();
  ctx.fillStyle = sector.color;
  ctx.moveTo(rad, rad);
  ctx.arc(rad, rad, rad, startAngle, startAngle + arc);
  ctx.lineTo(rad, rad);
  ctx.fill();
  
  // Podział nazwy drużyny na słowa
  let words = sector.label.split(/\s+/);
  
  // Ustawienie początkowego rozmiaru czcionki
  let fontSize = 30;
  ctx.font = `bold ${fontSize}px sans-serif`;
  
  // Maksymalna dostępna szerokość – przyjmujemy, że tekst ma zmieścić się w promieniu minus margines
  const maxTextWidth = rad - 20;
  
  // Obliczenie maksymalnej szerokości pojedynczego słowa
  let maxWordWidth = 0;
  words.forEach(word => {
    const w = ctx.measureText(word).width;
    if (w > maxWordWidth) maxWordWidth = w;
  });
  
  // Zmniejszanie rozmiaru czcionki, aż najdłuższe słowo zmieści się w dostępnej szerokości
  while (maxWordWidth > maxTextWidth && fontSize > 10) {
    fontSize--;
    ctx.font = `bold ${fontSize}px sans-serif`;
    maxWordWidth = 0;
    words.forEach(word => {
      const w = ctx.measureText(word).width;
      if (w > maxWordWidth) maxWordWidth = w;
    });
  }
  
  // Ustalanie odstępu między liniami
  const lineHeight = fontSize * 1.2;
  const totalHeight = words.length * lineHeight;
  // Wyznaczamy punkt startowy, aby blok tekstu był wycentrowany pionowo
  const startY = - totalHeight / 2 + lineHeight / 2;
  
  // Przesuwamy układ współrzędnych – środek koła
  ctx.translate(rad, rad);
  // Obracamy tak, aby tekst był wyśrodkowany w danym sektorze
  ctx.rotate(startAngle + arc / 2);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  
  // Rysowanie każdej linii (słowa) osobno
  for (let j = 0; j < words.length; j++) {
    ctx.fillText(words[j], rad - 10, startY + j * lineHeight);
  }
  
  ctx.restore();
}


// Ustawienie transformacji obracającej koło
function rotate() {
  ctx.canvas.style.transform = `rotate(${ang - PI / 2}rad)`;
  const sector = sectors[getIndex()];
  
  if (!angVel) {
    // Jeśli koło nie obraca się:
    if (currentPhase === "team" && teamCandidates.length === 1 && !isAnimatingTransfer) {
      // Gdy pozostała tylko ostatnia drużyna, ustaw inny napis
      spinEl.textContent = "OSTATNIA DRUŻYNA";
      spinEl.classList.add('no-triangle');
    } else {
      spinEl.textContent = 'LOSUJ';
    }
  } else {
    // Podczas obrotu wyświetlamy nazwę aktualnie wskazywanego sektora
    spinEl.textContent = sector ? sector.label : '';
  }
  
  spinEl.style.background = sector ? sector.color : '#fff';
}

// Obliczenie indeksu sektora, który „wskazuje” zwycięzcę
function getIndex() {
  return Math.floor(tot - (ang / TAU) * tot) % tot;
}

// Rysowanie całego koła
function drawWheel() {
  ctx.clearRect(0, 0, dia, dia);
  sectors.forEach(drawSector);
  rotate();
}

// Pętla animacji
function frame() {
  if (angVel) {
    angVel *= friction;
    if (angVel < 0.002) {
      angVel = 0;
      if (isSpinning) {
        spinEnded();
        isSpinning = false;
      }
    }
    ang += angVel;
    ang %= TAU;
    rotate();
  }
}

function engine() {
  frame();
  requestAnimationFrame(engine);
}

// Funkcja animująca przeniesienie nazwy drużyny z centralnego przycisku do tabeli
function animateTeamTransfer(teamName, callback) {
  const tbody = document.querySelector('#teamsTable tbody');
  const tr = document.createElement("tr");
  const tdTeam = document.createElement("td");
  tdTeam.textContent = ""; // początkowo puste
  const tdNumber = document.createElement("td");
  tdNumber.textContent = "";
  tr.appendChild(tdTeam);
  tr.appendChild(tdNumber);
  tbody.appendChild(tr);

  // Pozycja docelowa – środek komórki z nazwą drużyny
  const targetRect = tdTeam.getBoundingClientRect();
  // Pozycja startowa – środek przycisku SPIN
  const spinRect = spinEl.getBoundingClientRect();
  const startX = spinRect.left + spinRect.width / 2;
  const startY = spinRect.top + spinRect.height / 2;

  // Tworzymy pływający element
  const floating = document.createElement("div");
  floating.textContent = teamName;
  floating.className = "floatingTeam";
  floating.style.left = startX + "px";
  floating.style.top = startY + "px";
  floating.style.transform = "translate(-50%, -50%)";
  document.body.appendChild(floating);

  // Wymuszamy reflow
  floating.getBoundingClientRect();

  // Pozycja docelowa
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;
  floating.style.left = targetX + "px";
  floating.style.top = targetY + "px";

  floating.addEventListener("transitionend", function() {
      document.body.removeChild(floating);
      tdTeam.textContent = teamName;
      if (callback) callback();
  }, { once: true });
}

// Funkcja animująca przeniesienie numeru startowego do tabeli
function animateNumberTransfer(number, callback) {
  const tbody = document.querySelector('#teamsTable tbody');
  const lastRow = tbody.lastElementChild;
  if (!lastRow) {
    if (callback) callback();
    return;
  }
  const tdNumber = lastRow.children[1];
  // Pozycja docelowa – środek komórki dla numeru
  const targetRect = tdNumber.getBoundingClientRect();
  // Pozycja startowa – środek przycisku SPIN
  const spinRect = spinEl.getBoundingClientRect();
  const startX = spinRect.left + spinRect.width / 2;
  const startY = spinRect.top + spinRect.height / 2;

  const floating = document.createElement("div");
  floating.textContent = number;
  floating.className = "floatingNumber";
  floating.style.left = startX + "px";
  floating.style.top = startY + "px";
  floating.style.transform = "translate(-50%, -50%)";
  document.body.appendChild(floating);

  // Wymuszamy reflow
  floating.getBoundingClientRect();

  // Pozycja docelowa
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;
  floating.style.left = targetX + "px";
  floating.style.top = targetY + "px";

  floating.addEventListener("transitionend", function() {
      document.body.removeChild(floating);
      tdNumber.textContent = number;
      if (callback) callback();
  }, { once: true });
}

// Funkcje ładujące dane do koła dla obu faz
function loadTeamSectors() {
  tot = teamCandidates.length;
  arc = tot > 0 ? TAU / tot : 0;
  sectors = teamCandidates.map((team, index) => ({
    color: getColor(index, tot),
    label: team
  }));
  ang = 0;
  angVel = 0;
  drawWheel();
}

function loadNumberSectors() {
  tot = availableNumbers.length;
  arc = tot > 0 ? TAU / tot : 0;
  sectors = availableNumbers.map((num, index) => ({
    color: getColor(index, tot),
    label: num.toString()
  }));
  ang = 0;
  angVel = 0;
  drawWheel();
}

// Funkcja obsługująca zakończenie obrotu – zależnie od fazy
function spinEnded() {
  if (currentPhase === "team") {
    // Faza losowania drużyny
    let winningIndex = getIndex();
    let winningTeam = teamCandidates[winningIndex];
    teamCandidates.splice(winningIndex, 1);
    isAnimatingTransfer = true;
    animateTeamTransfer(winningTeam, () => {
      isAnimatingTransfer = false;
      winners.push({ team: winningTeam, number: null });
      currentPhase = "number";
      loadNumberSectors();
    });
  } else if (currentPhase === "number") {
    // Faza losowania numeru startowego
    let winningIndex = getIndex();
    let winningNumber = availableNumbers[winningIndex];
    availableNumbers.splice(winningIndex, 1);
    animateNumberTransfer(winningNumber, () => {
      winners[winners.length - 1].number = winningNumber;
      if (teamCandidates.length > 0) {
        currentPhase = "team";  
        loadTeamSectors();
      } else {
        // Koniec losowania – ostatnia drużyna została przypisana
        currentPhase = "done";
        spinEl.textContent = "KONIEC";
        spinEl.style.background = "#ccc";
        ctx.clearRect(0, 0, dia, dia);
      }
    });
  }
}

// Funkcja przetwarzająca dane z pliku – przyjmuje tablicę nazw drużyn
function loadTeams(teams) {
  winners = [];
  teamCandidates = teams.slice();
  availableNumbers = [];
  for (let i = 1; i <= teams.length; i++) {
    availableNumbers.push(i);
  }
  currentPhase = "team";
  loadTeamSectors();
  // Tabela na starcie pozostaje pusta
}

function animateTableToCenter() {
  const tableContainer = document.getElementById('tableContainer');
  
  // Upewnij się, że wcześniej nie było ustawionego inline transformu:
  tableContainer.style.transform = "";

  // Wymuś reflow, by odczytać aktualne wymiary i pozycję
  const rect = tableContainer.getBoundingClientRect();

  // Oblicz środek widoku (zakładamy, że cały widok to container, czyli viewport)
  const viewportCenterX = window.innerWidth / 2;
  const viewportCenterY = window.innerHeight / 2;
  
  // Oblicz docelowy lewy górny róg, aby tabela była wycentrowana
  const targetX = viewportCenterX - rect.width / 2;
  const targetY = viewportCenterY - rect.height / 2;
  
  // Aktualna pozycja (współrzędne elementu względem widoku)
  const currentX = rect.left;
  const currentY = rect.top;
  
  // Oblicz różnicę
  const deltaX = targetX - currentX;
  const deltaY = targetY - currentY;
  
  // Ustaw przejście – jest już zdefiniowane w CSS, ale tu upewniamy się, że inline styl zostanie zmieniony
  tableContainer.style.transition = "transform 1s ease-out";
  // Ustaw przesunięcie
  tableContainer.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
}

// Obsługa przycisku SPIN – uruchomienie obrotu (dla obu faz)
spinEl.addEventListener('click', () => {
  // Specjalny przypadek – gdy zostaje ostatnia drużyna
  if (currentPhase === "team" && teamCandidates.length === 1) {
    let lastTeam = teamCandidates[0];
    teamCandidates.splice(0, 1);
    animateTeamTransfer(lastTeam, () => {
      winners.push({ team: lastTeam, number: null });
      // Automatyczne przypisanie ostatniego numeru
      let lastNumber = availableNumbers[0];
      availableNumbers.splice(0, 1);
      animateNumberTransfer(lastNumber, () => {
        winners[winners.length - 1].number = lastNumber;
        // Finalna animacja odpala się dopiero po zakończeniu obu animacji:
        currentPhase = "done";
        spinEl.textContent = "KONIEC";
        spinEl.style.background = "#ccc";
        ctx.clearRect(0, 0, dia, dia);

        // Pobieramy referencje do elementów
        const wheelContainer = document.getElementById('wheelOfFortune');
        const tableContainer = document.getElementById('tableContainer');
        const container = document.getElementById('container');
        
        // Dodajemy klasy powodujące finalne animacje
        wheelContainer.classList.add('hidden');  // Koło z przyciskiem znika płynnie
        spinEl.classList.add('hidden');            // Ukrywamy przycisk
        //container.classList.add('centered');       // Kontener zostaje wyśrodkowany
        tableContainer.style.width = '90%';  // lub inna wartość
        animateTableToCenter();
      });
    });
  } else if (!isSpinning && currentPhase !== "done" && tot > 0) {
    // Standardowy obrót (gdy nie mamy ostatniej drużyny)
    isSpinning = true;
    angVel = rand(0.25, 0.45);
  }
});


// Obsługa wczytywania pliku z nazwami drużyn
const fileInput = document.getElementById('teamFile');
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const content = event.target.result;
    const teams = content.split('\n').map(line => line.trim()).filter(line => line !== '');
    if (teams.length > 0) {
      loadTeams(teams);
      document.getElementById('controls').style.display = 'none';
    } else {
      alert("Plik nie zawiera żadnych nazw drużyn.");
    }
  };
  reader.readAsText(file);
});

// Uruchomienie pętli animacji
engine();
