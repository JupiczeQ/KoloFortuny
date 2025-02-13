// Pomocnicza funkcja losująca wartość z przedziału
const rand = (m, M) => Math.random() * (M - m) + m;

// Globalne zmienne symulacji
let teamCandidates = [];    // Lista drużyn do losowania (kandydaci)
let winners = [];           // Wyłonione drużyny (kolejność losowania)
let currentPhase = "team";  // Faza: tylko "team" (do losowania drużyn) lub "done"
let sectors = [];           // Dane do rysowania koła
let tot = 0;                // Liczba sektorów
let arc = 0;                // Kąt pojedynczego sektora
let isSpinning = false;     // Flaga – czy koło aktualnie się kręci?
let angVel = 0;             // Aktualna prędkość obrotu
let ang = 0;                // Aktualny kąt obrotu
let isAnimatingTransfer = false;

const PI = Math.PI;
const TAU = 2 * PI;
const friction = 0.986;

const spinEl = document.getElementById('spin');
const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');
const dia = canvas.width;    // 800 pikseli
const rad = dia / 2;         // 400 pikseli

// Funkcja generująca kolor – równomiernie rozkłada barwy
function getColor(i, total) {
  return `hsl(${(i * 360 / total)}, 70%, 50%)`;
}

// Rysowanie pojedynczego sektora (używane przy losowaniu drużyny)
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
    // Gdy koło stoi w miejscu
    if (teamCandidates.length === 1 && !isAnimatingTransfer) {
      spinEl.textContent = "OSTATNIA DRUZYNA";
      spinEl.classList.add('no-triangle');
    } else {
      spinEl.textContent = 'LOSUJ';
      spinEl.classList.remove('no-triangle');
    }
  } else {
    // Podczas obrotu – pokazujemy nazwę aktualnie wskazywanego sektora
    spinEl.textContent = sector ? sector.label : '';
    spinEl.classList.remove('no-triangle');
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

// Funkcja animująca przeniesienie nazwy drużyny z przycisku SPIN do odpowiedniego wiersza tabeli
function animateTeamTransfer(teamName, callback) {
  const tbody = document.querySelector('#teamsTable tbody');
  const rows = tbody.querySelectorAll("tr");
  // Wybieramy kolejny nieobsadzony wiersz (bazując na liczbie już przydzielonych drużyn)
  const targetRow = rows[winners.length];
  // Druga komórka (indeks 1) – miejsce na nazwę drużyny
  const tdTeam = targetRow.children[1];
  const targetRect = tdTeam.getBoundingClientRect();
  const spinRect = spinEl.getBoundingClientRect();
  const startX = spinRect.left + spinRect.width / 2;
  const startY = spinRect.top + spinRect.height / 2;

  const floating = document.createElement("div");
  floating.textContent = teamName;
  floating.className = "floatingTeam";
  floating.style.left = startX + "px";
  floating.style.top = startY + "px";
  floating.style.transform = "translate(-50%, -50%)";
  document.body.appendChild(floating);

  // Wymuszenie reflow
  floating.getBoundingClientRect();

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


// Funkcja ładująca dane do koła – tylko dla losowania drużyn
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

// Funkcja obsługująca zakończenie obrotu – losujemy drużynę
function spinEnded() {
  let winningIndex = getIndex();
  let winningTeam = teamCandidates[winningIndex];
  teamCandidates.splice(winningIndex, 1);
  isAnimatingTransfer = true;
  animateTeamTransfer(winningTeam, () => {
      isAnimatingTransfer = false;
      winners.push(winningTeam);
      if (teamCandidates.length > 0) {
          loadTeamSectors();
      } else {
          // Koniec losowania – wszystkie drużyny zostały przydzielone
          currentPhase = "done";
          spinEl.textContent = "KONIEC";
          spinEl.style.background = "#ccc";
          ctx.clearRect(0, 0, dia, dia);

          // Finalna animacja: ukrycie koła oraz przycisku, wyśrodkowanie tabeli
          const wheelContainer = document.getElementById('wheelOfFortune');
          const tableContainer = document.getElementById('tableContainer');
          
          wheelContainer.classList.add('hidden');
          spinEl.classList.add('hidden');
          tableContainer.style.width = '90%';
          animateTableToCenter();
      }
  });
}

// Obsługa przycisku SPIN – uruchomienie obrotu (tylko losowanie drużyn)
spinEl.addEventListener('click', () => {
  // Jeśli trwa animacja przenoszenia nazwy drużyny, przerywamy działanie funkcji.
  if (isAnimatingTransfer) return;

  // Specjalny przypadek: gdy została już tylko ostatnia drużyna
  if (currentPhase === "team" && teamCandidates.length === 1 && !isSpinning) {
    let lastTeam = teamCandidates[0];
    teamCandidates.splice(0, 1);
    animateTeamTransfer(lastTeam, () => {
      winners.push(lastTeam);
      currentPhase = "done";
      spinEl.textContent = "KONIEC";
      spinEl.style.background = "#ccc";
      ctx.clearRect(0, 0, dia, dia);

      // Finalna animacja: ukrycie koła i przycisku, wyśrodkowanie tabeli
      const wheelContainer = document.getElementById('wheelOfFortune');
      const tableContainer = document.getElementById('tableContainer');
      
      wheelContainer.classList.add('hidden');
      spinEl.classList.add('hidden');
      tableContainer.style.width = '90%';
      animateTableToCenter();
    });
  } else if (!isSpinning && currentPhase !== "done" && tot > 0) {
    // Standardowy obrót
    isSpinning = true;
    angVel = rand(0.25, 0.45);
  }
});


// Funkcja przetwarzająca dane z pliku – tworzy tabelę z numerami startowymi od 1 do n
function loadTeams(teams) {
  winners = [];
  teamCandidates = teams.slice();
  
  // Wypełnienie tabeli: pierwsza kolumna – numer startowy, druga – nazwa drużyny (później uzupełniana)
  const tbody = document.querySelector('#teamsTable tbody');
  tbody.innerHTML = "";
  for (let i = 1; i <= teams.length; i++) {
    const tr = document.createElement("tr");
    const tdNumber = document.createElement("td");
    tdNumber.textContent = i.toString(); // Numer startowy
    const tdTeam = document.createElement("td");
    tdTeam.textContent = ""; // Nazwa drużyny zostanie dodana przy animacji
    tr.appendChild(tdNumber);
    tr.appendChild(tdTeam);
    tbody.appendChild(tr);
  }
  
  currentPhase = "team";
  loadTeamSectors();
}


// Funkcja animująca przesunięcie tabeli do środka widoku (pozostaje bez zmian)
function animateTableToCenter() {
  const tableContainer = document.getElementById('tableContainer');
  
  // Upewnij się, że wcześniej nie było ustawionego inline transformu:
  tableContainer.style.transform = "";

  // Wymuś reflow, by odczytać aktualne wymiary i pozycję
  const rect = tableContainer.getBoundingClientRect();

  // Oblicz środek widoku (zakładamy, że cały widok to viewport)
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
  
  // Ustaw przejście – inline transition
  tableContainer.style.transition = "transform 1s ease-out";
  // Ustaw przesunięcie
  tableContainer.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

  // Po zakończeniu animacji wyśrodkowania tabeli, animujemy wysunięcie województw
  tableContainer.addEventListener("transitionend", function handler() {
    tableContainer.removeEventListener("transitionend", handler);
    animateProvinces();
  });
}

// Funkcja animująca wysunięcie województw (12 obrazków) z dołu ekranu
function animateProvinces() {
  const tableRect = document.getElementById('tableContainer').getBoundingClientRect();

  // Utwórz kontener dla lewej kolumny (6 województw)
  const leftContainer = document.createElement("div");
  leftContainer.id = "provincesLeft";
  leftContainer.className = "provinceColumn";
  // Ustawiamy stałą szerokość – można zmodyfikować według potrzeb
  leftContainer.style.width = "150px";
  // Pozycjonowanie – wyśrodkowane wertykalnie względem tabeli
  leftContainer.style.top = tableRect.top + "px";
  // Pozycja pozioma: umieszczamy po lewej stronie tabeli (20px margines)
  leftContainer.style.left = (tableRect.left - 170) + "px"; 

  // Utwórz kontener dla prawej kolumny (kolejne 6 województw)
  const rightContainer = document.createElement("div");
  rightContainer.id = "provincesRight";
  rightContainer.className = "provinceColumn";
  rightContainer.style.width = "150px";
  rightContainer.style.top = tableRect.top + "px";
  // Pozycja: po prawej stronie tabeli (20px margines)
  rightContainer.style.left = (tableRect.right + 20) + "px";

  // Dodaj 6 obrazków do lewego kontenera (przyjmujemy, że pliki są nazwane 1.png–6.png)
  for (let i = 1; i <= 6; i++) {
    const img = document.createElement("img");
    img.src = `HerbyWoj/${i}.png`;
    img.alt = `Województwo ${i}`;
    img.className = "provinceImage";
    leftContainer.appendChild(img);
  }

  // Dodaj 6 obrazków do prawego kontenera (pliki 7.png–12.png)
  for (let i = 7; i <= 12; i++) {
    const img = document.createElement("img");
    img.src = `HerbyWoj/${i}.png`;
    img.alt = `Województwo ${i}`;
    img.className = "provinceImage";
    rightContainer.appendChild(img);
  }

  // Początkowo umieszczamy kontenery poza ekranem (na dole)
  leftContainer.style.transform = "translateY(100vh)";
  rightContainer.style.transform = "translateY(100vh)";

  // Dodajemy kontenery do dokumentu (np. do body)
  document.body.appendChild(leftContainer);
  document.body.appendChild(rightContainer);

  // Wymuś reflow, aby przeglądarka odczytała początkowe pozycje
  leftContainer.getBoundingClientRect();
  rightContainer.getBoundingClientRect();

  // Ustaw transition (możesz modyfikować czas/trwanie)
  leftContainer.style.transition = "transform 1s ease-out";
  rightContainer.style.transition = "transform 1s ease-out";

  // Ustaw docelową pozycję (transform: none – kontenery przesuną się do swoich pozycji)
  leftContainer.style.transform = "translateY(0)";
  rightContainer.style.transform = "translateY(0)";
}

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
