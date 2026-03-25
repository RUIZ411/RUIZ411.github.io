import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCvz6bttOcYmSL7JY2mgljKDfWkKyrvhyg",
  authDomain: "schedule-74da4.firebaseapp.com",
  projectId: "schedule-74da4",
  storageBucket: "schedule-74da4.firebasestorage.app",
  messagingSenderId: "520094037606",
  appId: "1:520094037606:web:8f51c2746642a6a7549fa7",
  measurementId: "G-4NB6BZ5SXG"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const schedulesCollection = collection(db, "schedules");
const killCollection = collection(db, "killRecords");

const PLAYER_COUNT = 10;
const ADMIN_CODE = "suweet0305";

let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth();
let selectedScheduleId = null;
let schedulesCache = [];

let selectedKillId = null;
let killCache = [];

const categoryColors = {
  "방송": "#3b82f6",
  "방송예정": "#22c55e",
  "합방": "#06b6d4",
  "힛차": "#ef4444",
  "기타": "#a855f7"
};

window.showPage = showPage;
window.toggleDarkMode = toggleDarkMode;
window.toggleAdminLock = toggleAdminLock;
window.handleHeroImageUpload = handleHeroImageUpload;
window.resetHeroImage = resetHeroImage;
window.shuffleTeams = shuffleTeams;
window.copyTeams = copyTeams;
window.resetPlayers = resetPlayers;
window.openScheduleFormForToday = openScheduleFormForToday;
window.changeMonth = changeMonth;
window.selectCalendarDate = selectCalendarDate;
window.clearScheduleInputs = clearScheduleInputs;
window.saveScheduleFromForm = saveScheduleFromForm;
window.editScheduleById = editScheduleById;
window.deleteSelectedSchedule = deleteSelectedSchedule;
window.requireAdmin = requireAdmin;

window.saveKillRecord = saveKillRecord;
window.clearKillInputs = clearKillInputs;
window.selectKillRecord = selectKillRecord;
window.deleteSelectedKillRecord = deleteSelectedKillRecord;

function isAdminUnlocked() {
  return localStorage.getItem("adminUnlocked") === "true";
}

function updateAdminButton() {
  const btn = document.getElementById("adminToggleBtn");
  if (btn) {
    btn.textContent = isAdminUnlocked() ? "관리자 잠금" : "관리자 잠금 해제";
  }
}

function requireAdmin(actionLabel = "이 기능") {
  if (isAdminUnlocked()) return true;
  alert(`${actionLabel}은(는) 관리자 코드가 필요합니다.`);
  return false;
}

function toggleAdminLock() {
  if (isAdminUnlocked()) {
    localStorage.setItem("adminUnlocked", "false");
    updateAdminButton();
    alert("관리자 잠금이 설정되었습니다.");
    return;
  }

  const code = prompt("관리자 코드를 입력하세요.");
  if (code === null) return;

  if (code === ADMIN_CODE) {
    localStorage.setItem("adminUnlocked", "true");
    updateAdminButton();
    alert("관리자 잠금이 해제되었습니다.");
  } else {
    alert("관리자 코드가 올바르지 않습니다.");
  }
}

function applySavedTheme() {
  const savedTheme = localStorage.getItem("themeMode") || "light";

  if (savedTheme === "dark") {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }

  const btn = document.getElementById("themeToggleBtn");
  if (btn) {
    btn.textContent = document.body.classList.contains("dark") ? "라이트모드" : "다크모드";
  }
}

function toggleDarkMode() {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  localStorage.setItem("themeMode", isDark ? "dark" : "light");

  const btn = document.getElementById("themeToggleBtn");
  if (btn) {
    btn.textContent = isDark ? "라이트모드" : "다크모드";
  }
}

function loadHeroImage() {
  const savedImage = localStorage.getItem("heroImage");
  if (savedImage) {
    document.getElementById("heroImage").src = savedImage;
  }
}

function handleHeroImageUpload(event) {
  if (!requireAdmin("이미지 변경")) {
    event.target.value = "";
    return;
  }

  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const result = e.target.result;
    document.getElementById("heroImage").src = result;
    localStorage.setItem("heroImage", result);
  };
  reader.readAsDataURL(file);
}

function resetHeroImage() {
  if (!requireAdmin("이미지 초기화")) return;

  const defaultImage =
    "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80";

  document.getElementById("heroImage").src = defaultImage;
  localStorage.removeItem("heroImage");

  const input = document.getElementById("heroImageInput");
  if (input) input.value = "";
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");

  if (pageId === "schedulePage") {
    renderCalendar();
  }
}

function getInputs() {
  return [
    document.getElementById("player1"),
    document.getElementById("player2"),
    document.getElementById("player3"),
    document.getElementById("player4"),
    document.getElementById("player5"),
    document.getElementById("player6"),
    document.getElementById("player7"),
    document.getElementById("player8"),
    document.getElementById("player9"),
    document.getElementById("player10")
  ];
}

function savePlayers() {
  const values = getInputs().map((input) => input.value.trim());
  localStorage.setItem("players", JSON.stringify(values));
}

function loadPlayers() {
  const saved = JSON.parse(localStorage.getItem("players") || "[]");
  const inputs = getInputs();

  for (let i = 0; i < inputs.length; i++) {
    inputs[i].value = saved[i] || "";
    inputs[i].addEventListener("input", savePlayers);
  }
}

function resetPlayers() {
  if (!requireAdmin("멤버 초기화")) return;
  if (!confirm("저장된 멤버를 초기화할까요?")) return;

  localStorage.removeItem("players");
  localStorage.removeItem("lastTeams");

  getInputs().forEach((input) => {
    input.value = "";
  });

  document.getElementById("team1").innerHTML = "";
  document.getElementById("team2").innerHTML = "";
  document.getElementById("teamMessage").textContent = "멤버가 초기화되었습니다.";
}

function getPlayers() {
  return getInputs().map((input) => input.value.trim());
}

function makeTeams(players) {
  const team1 = [];
  const team2 = [];

  for (let i = 0; i < players.length; i += 2) {
    const a = players[i];
    const b = players[i + 1];

    if (Math.random() < 0.5) {
      team1.push(a);
      team2.push(b);
    } else {
      team1.push(b);
      team2.push(a);
    }
  }

  return { team1, team2 };
}

function displayTeam(id, team) {
  const ul = document.getElementById(id);
  ul.innerHTML = "";

  team.forEach((name) => {
    const li = document.createElement("li");
    li.textContent = name;
    ul.appendChild(li);
  });
}

function countChangedLines(current, previous) {
  if (!previous) return 5;

  let changed = 0;
  for (let i = 0; i < 5; i++) {
    if (
      current.team1[i] !== previous.team1[i] ||
      current.team2[i] !== previous.team2[i]
    ) {
      changed++;
    }
  }

  return changed;
}

function shuffleTeams() {
  if (!requireAdmin("팀 섞기")) return;

  const players = getPlayers();

  if (players.length !== PLAYER_COUNT || players.some((name) => name === "")) {
    alert("10명의 이름을 모두 입력해야 합니다.");
    return;
  }

  const previousResult = JSON.parse(localStorage.getItem("lastTeams") || "null");
  let result = null;
  let attempts = 0;

  do {
    result = makeTeams(players);
    attempts++;
  } while (
    previousResult &&
    countChangedLines(result, previousResult) < 2 &&
    attempts < 50
  );

  displayTeam("team1", result.team1);
  displayTeam("team2", result.team2);
  localStorage.setItem("lastTeams", JSON.stringify(result));

  if (!previousResult) {
    document.getElementById("teamMessage").textContent = "팀이 섞였습니다.";
  } else {
    document.getElementById("teamMessage").textContent =
      `직전 결과와 ${countChangedLines(result, previousResult)}라인 다르게 섞었습니다.`;
  }
}

function copyTeams() {
  if (!requireAdmin("팀 복사")) return;

  const team1Items = Array.from(document.querySelectorAll("#team1 li")).map((li) =>
    li.textContent.trim()
  );
  const team2Items = Array.from(document.querySelectorAll("#team2 li")).map((li) =>
    li.textContent.trim()
  );

  if (team1Items.length !== 5 || team2Items.length !== 5) {
    alert("먼저 팀을 섞어주세요.");
    return;
  }

  let text = "블루\t레드\n";
  for (let i = 0; i < 5; i++) {
    text += `${team1Items[i]}\t${team2Items[i]}\n`;
  }

  navigator.clipboard.writeText(text)
    .then(() => {
      document.getElementById("teamMessage").textContent =
        "블루 / 레드 형식으로 복사되었습니다.";
    })
    .catch(() => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);

      document.getElementById("teamMessage").textContent =
        "블루 / 레드 형식으로 복사되었습니다.";
    });
}

function getSchedules() {
  return schedulesCache;
}

function startScheduleSync() {
  onSnapshot(
    schedulesCollection,
    (snapshot) => {
      schedulesCache = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      renderCalendar();
      updateHitchaCount();
    },
    (error) => {
      console.error(error);
      document.getElementById("scheduleMessage").textContent =
        "Firebase 연결 오류가 발생했습니다.";
    }
  );
}

function updateHitchaCount() {
  const schedules = getSchedules();
  const targetMonth = String(calendarMonth + 1).padStart(2, "0");
  const targetYear = String(calendarYear);

  const count = schedules.filter(
    (item) =>
      item.category === "힛차" &&
      item.date &&
      item.date.startsWith(`${targetYear}-${targetMonth}-`)
  ).length;

  document.getElementById("hitchaCount").textContent = `이번달 힛차 ${count}회`;
}

function formatDateKey(year, month, day) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function getSchedulesForDate(dateKey) {
  return getSchedules().filter((item) => item.date === dateKey);
}

function changeMonth(delta) {
  calendarMonth += delta;

  if (calendarMonth < 0) {
    calendarMonth = 11;
    calendarYear -= 1;
  }

  if (calendarMonth > 11) {
    calendarMonth = 0;
    calendarYear += 1;
  }

  renderCalendar();
}

function renderCalendar() {
  const label = document.getElementById("calendarLabel");
  const daysContainer = document.getElementById("calendarDays");

  label.textContent = `${calendarYear}년 ${calendarMonth + 1}월`;
  daysContainer.innerHTML = "";
  updateHitchaCount();

  const firstDay = new Date(calendarYear, calendarMonth, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const prevMonthDays = new Date(calendarYear, calendarMonth, 0).getDate();
  const today = new Date();

  const cells = [];

  for (let i = 0; i < startWeekday; i++) {
    cells.push({
      day: prevMonthDays - startWeekday + i + 1,
      other: true,
      monthOffset: -1
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, other: false, monthOffset: 0 });
  }

  while (cells.length < 35) {
    cells.push({
      day: cells.length - (startWeekday + daysInMonth) + 1,
      other: true,
      monthOffset: 1
    });
  }

  cells.forEach((cell) => {
    let cellYear = calendarYear;
    let cellMonth = calendarMonth + cell.monthOffset;

    if (cellMonth < 0) {
      cellMonth = 11;
      cellYear -= 1;
    }

    if (cellMonth > 11) {
      cellMonth = 0;
      cellYear += 1;
    }

    const dateKey = formatDateKey(cellYear, cellMonth, cell.day);
    const events = getSchedulesForDate(dateKey);

    const dayCell = document.createElement("div");
    dayCell.className = "day-cell" + (cell.other ? " other-month" : "");

    if (
      cellYear === today.getFullYear() &&
      cellMonth === today.getMonth() &&
      cell.day === today.getDate()
    ) {
      dayCell.className += " today";
    }

    dayCell.onclick = () => selectCalendarDate(dateKey);

    const eventHtml = events
      .slice(0, 3)
      .map((event) => `
        <div class="event-item" onclick="event.stopPropagation(); window.editScheduleById('${event.id}')">
          <span class="event-bullet" style="background:${categoryColors[event.category] || "#a855f7"}"></span>
          <span>${event.text || ""}</span>
          <span class="event-time">${event.time || ""}</span>
        </div>
      `)
      .join("");

    const moreHtml =
      events.length > 3
        ? `<div class="event-item" style="color:#94a3b8;">+${events.length - 3}개 더보기</div>`
        : "";

    dayCell.innerHTML = `
      <div class="day-number">${cell.day}일</div>
      <div class="event-list">${eventHtml}${moreHtml}</div>
    `;

    daysContainer.appendChild(dayCell);
  });
}

function selectCalendarDate(dateKey) {
  document.getElementById("scheduleDate").value = dateKey;
  selectedScheduleId = null;
  document.getElementById("scheduleMessage").textContent =
    `${dateKey} 날짜로 입력할 수 있습니다.`;
}

function openScheduleFormForToday() {
  if (!requireAdmin("일정 등록")) return;

  const today = new Date();

  document.getElementById("scheduleDate").value =
    formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
  document.getElementById("scheduleTime").value = "";
  document.getElementById("scheduleText").value = "";
  document.getElementById("scheduleCategory").value = "방송";
  selectedScheduleId = null;
}

function clearScheduleInputs() {
  document.getElementById("scheduleDate").value = "";
  document.getElementById("scheduleTime").value = "";
  document.getElementById("scheduleText").value = "";
  document.getElementById("scheduleCategory").value = "방송";
  selectedScheduleId = null;
  document.getElementById("scheduleMessage").textContent = "입력값을 초기화했습니다.";
}

async function saveScheduleFromForm() {
  if (!requireAdmin("일정 저장")) return;

  const date = document.getElementById("scheduleDate").value;
  const time = document.getElementById("scheduleTime").value;
  const text = document.getElementById("scheduleText").value.trim();
  const category = document.getElementById("scheduleCategory").value;

  if (!date || !text) {
    alert("날짜와 내용을 입력해주세요.");
    return;
  }

  const payload = { date, time, text, category };

  try {
    if (selectedScheduleId) {
      await updateDoc(doc(db, "schedules", selectedScheduleId), payload);
      document.getElementById("scheduleMessage").textContent = "일정을 수정했습니다.";
    } else {
      await addDoc(schedulesCollection, payload);
      document.getElementById("scheduleMessage").textContent = "일정을 추가했습니다.";
    }

    clearScheduleInputs();
  } catch (error) {
    console.error(error);
    alert("일정 저장 중 오류가 발생했습니다.");
  }
}

function editScheduleById(id) {
  if (!requireAdmin("일정 수정")) return;

  const item = getSchedules().find((v) => v.id === id);
  if (!item) return;

  selectedScheduleId = id;
  document.getElementById("scheduleDate").value = item.date || "";
  document.getElementById("scheduleTime").value = item.time || "";
  document.getElementById("scheduleText").value = item.text || "";
  document.getElementById("scheduleCategory").value = item.category || "기타";
  document.getElementById("scheduleMessage").textContent =
    "선택한 일정이 입력창에 불러와졌습니다. 수정 후 저장을 눌러주세요.";
}

async function deleteSelectedSchedule() {
  if (!requireAdmin("일정 삭제")) return;

  if (!selectedScheduleId) {
    alert("먼저 수정할 일정 하나를 선택해주세요.");
    return;
  }

  if (!confirm("선택한 일정을 삭제할까요?")) return;

  try {
    await deleteDoc(doc(db, "schedules", selectedScheduleId));
    clearScheduleInputs();
    document.getElementById("scheduleMessage").textContent =
      "선택한 일정을 삭제했습니다.";
  } catch (error) {
    console.error(error);
    alert("일정 삭제 중 오류가 발생했습니다.");
  }
}

function startKillSync() {
  const q = query(killCollection, orderBy("createdAt", "desc"));

  onSnapshot(
    q,
    (snapshot) => {
      killCache = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      renderKillRecords();
      updateKillSummary();
    },
    (error) => {
      console.error(error);
      document.getElementById("killMessage").textContent =
        "킬내기 전적을 불러오는 중 오류가 발생했습니다.";
    }
  );
}

function updateKillSummary() {
  const totalGames = killCache.length;
  const totalKills = killCache.reduce((sum, item) => sum + Number(item.kills || 0), 0);
  const bestKills = killCache.reduce(
    (max, item) => Math.max(max, Number(item.kills || 0)),
    0
  );
  const averageKills = totalGames > 0 ? (totalKills / totalGames).toFixed(1) : "0";

  document.getElementById("killTotalGames").textContent = totalGames;
  document.getElementById("killTotalKills").textContent = totalKills;
  document.getElementById("killAverageKills").textContent = averageKills;
  document.getElementById("killBestKills").textContent = bestKills;
}

function renderKillRecords() {
  const list = document.getElementById("killList");
  list.innerHTML = "";

  if (killCache.length === 0) {
    list.innerHTML = `<div class="message">아직 저장된 전적이 없습니다.</div>`;
    return;
  }

  killCache.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "kill-item" + (selectedKillId === item.id ? " selected" : "");
    div.onclick = () => selectKillRecord(item.id);

    div.innerHTML = `
      <div class="kill-left">
        <div class="kill-name">${escapeHtml(item.name || "-")}</div>
        <div class="kill-meta">날짜: ${escapeHtml(item.date || "-")}</div>
        <div class="kill-memo">메모: ${escapeHtml(item.memo || "-")}</div>
      </div>
      <div class="kill-right">
        <div class="kill-count">${Number(item.kills || 0)}킬</div>
        <div class="kill-rank">${index + 1}번째 기록</div>
      </div>
    `;

    list.appendChild(div);
  });
}

function selectKillRecord(id) {
  selectedKillId = id;

  const item = killCache.find((v) => v.id === id);
  if (!item) return;

  document.getElementById("killName").value = item.name || "";
  document.getElementById("killCount").value = Number(item.kills || 0);
  document.getElementById("killDate").value = item.date || "";
  document.getElementById("killMemo").value = item.memo || "";
  document.getElementById("killMessage").textContent =
    "선택한 전적이 입력창에 불러와졌습니다. 삭제하거나 새 전적 입력 후 저장할 수 있습니다.";

  renderKillRecords();
}

function clearKillInputs() {
  document.getElementById("killName").value = "";
  document.getElementById("killCount").value = "";
  document.getElementById("killMemo").value = "";

  const today = new Date();
  document.getElementById("killDate").value =
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  selectedKillId = null;
  document.getElementById("killMessage").textContent = "입력값을 초기화했습니다.";
  renderKillRecords();
}

async function saveKillRecord() {
  if (!requireAdmin("킬내기 저장")) return;

  const name = document.getElementById("killName").value.trim();
  const kills = document.getElementById("killCount").value;
  const date = document.getElementById("killDate").value;
  const memo = document.getElementById("killMemo").value.trim();

  if (!name) {
    alert("닉네임을 입력해주세요.");
    return;
  }

  if (kills === "" || Number(kills) < 0) {
    alert("킬 수를 올바르게 입력해주세요.");
    return;
  }

  if (!date) {
    alert("날짜를 입력해주세요.");
    return;
  }

  try {
    await addDoc(killCollection, {
      name,
      kills: Number(kills),
      date,
      memo,
      createdAt: Date.now()
    });

    document.getElementById("killMessage").textContent = "전적을 저장했습니다.";
    clearKillInputs();
  } catch (error) {
    console.error(error);
    alert("전적 저장 중 오류가 발생했습니다.");
  }
}

async function deleteSelectedKillRecord() {
  if (!requireAdmin("전적 삭제")) return;

  if (!selectedKillId) {
    alert("먼저 삭제할 전적을 하나 선택해주세요.");
    return;
  }

  if (!confirm("선택한 전적을 삭제할까요?")) return;

  try {
    await deleteDoc(doc(db, "killRecords", selectedKillId));
    selectedKillId = null;
    clearKillInputs();
    document.getElementById("killMessage").textContent = "선택한 전적을 삭제했습니다.";
  } catch (error) {
    console.error(error);
    alert("전적 삭제 중 오류가 발생했습니다.");
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setDefaultKillDate() {
  const today = new Date();
  document.getElementById("killDate").value =
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

applySavedTheme();
updateAdminButton();
loadHeroImage();
loadPlayers();
setDefaultKillDate();
startScheduleSync();
startKillSync();
