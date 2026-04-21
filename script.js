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
const recordsCollection = collection(db, "killRecords");

const ADMIN_CODE = "suweet0305";
const MIN_TEAM_PLAYERS = 10;
const MAX_TEAM_PLAYERS = 12;
const TEAM_MODE_5V5 = 10;
const TEAM_MODE_6V6 = 12;

const MIN_RECORD_TEAM_SIZE = 4;
const MAX_RECORD_TEAM_SIZE = 8;
const RELATION_BASE_MEMBER = "수힛";

const MAP_GROUPS = {
  "쟁탈": ["네팔", "리장 타워", "부산", "오아시스", "일리오스"],
  "호위": ["66번 국도", "지브롤터", "도라도", "쓰레기촌"],
  "혼합": ["눔바니", "아이헨발데", "왕의 길", "할리우드"],
  "밀기": ["뉴 퀸 스트리트", "콜로세오"]
};

let currentTeamMode = TEAM_MODE_5V5;
let selectedMapsByGroup = createDefaultMapSelection();

let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth();
let selectedScheduleId = null;
let schedulesCache = [];

let selectedRecordId = null;
let recordsCache = [];

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
window.setTeamMode = setTeamMode;
window.togglePairLock = togglePairLock;

window.toggleMapSelection = toggleMapSelection;
window.drawMap = drawMap;
window.copyMap = copyMap;
window.resetMap = resetMap;

window.openScheduleFormForToday = openScheduleFormForToday;
window.changeMonth = changeMonth;
window.selectCalendarDate = selectCalendarDate;
window.clearScheduleInputs = clearScheduleInputs;
window.saveScheduleFromForm = saveScheduleFromForm;
window.editScheduleById = editScheduleById;
window.deleteSelectedSchedule = deleteSelectedSchedule;
window.requireAdmin = requireAdmin;

window.saveRecord = saveRecord;
window.clearRecordInputs = clearRecordInputs;
window.selectRecord = selectRecord;
window.deleteSelectedRecord = deleteSelectedRecord;

window.renderDetailPage = renderDetailPage;
window.renderMemberRelationStats = renderMemberRelationStats;
window.clearMemberRelationStats = clearMemberRelationStats;

/* =========================
   공통 기본
========================= */

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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeJs(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll('"', '\\"');
}

/* =========================
   메인 이미지
========================= */

function loadHeroImage() {
  const savedImage = localStorage.getItem("heroImage");
  if (savedImage) {
    const heroImage = document.getElementById("heroImage");
    if (heroImage) heroImage.src = savedImage;
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
    const heroImage = document.getElementById("heroImage");
    if (heroImage) heroImage.src = result;
    localStorage.setItem("heroImage", result);
  };
  reader.readAsDataURL(file);
}

function resetHeroImage() {
  if (!requireAdmin("이미지 초기화")) return;

  const defaultImage =
    "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80";

  const heroImage = document.getElementById("heroImage");
  if (heroImage) heroImage.src = defaultImage;
  localStorage.removeItem("heroImage");

  const input = document.getElementById("heroImageInput");
  if (input) input.value = "";
}

/* =========================
   페이지 이동
========================= */

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"));

  const targetPage = document.getElementById(pageId);
  if (!targetPage) return;

  targetPage.classList.add("active");

  if (pageId === "schedulePage") {
    renderCalendar();
  }

  if (pageId === "detailPage") {
    renderDetailPage();
  }

  if (pageId === "teamPage") {
    applyTeamModeUI();
    renderMapBoard();
  }
}

/* =========================
   팀 섞기
========================= */

function getTeamInput(index) {
  return document.getElementById(`player${index}`);
}

function getLockButton(evenIndex) {
  return document.getElementById(`lock${evenIndex}`);
}

function getInputs() {
  const inputs = [];
  for (let i = 1; i <= MAX_TEAM_PLAYERS; i++) {
    const input = getTeamInput(i);
    if (input) inputs.push(input);
  }
  return inputs;
}

function savePlayers() {
  const values = [];
  for (let i = 1; i <= MAX_TEAM_PLAYERS; i++) {
    const input = getTeamInput(i);
    values.push(input ? input.value.trim() : "");
  }
  localStorage.setItem("players", JSON.stringify(values));
}

function loadPlayers() {
  const saved = JSON.parse(localStorage.getItem("players") || "[]");

  for (let i = 1; i <= MAX_TEAM_PLAYERS; i++) {
    const input = getTeamInput(i);
    if (!input) continue;

    input.value = saved[i - 1] || "";
    input.addEventListener("input", savePlayers);
  }
}

function saveTeamMode() {
  localStorage.setItem("teamMode", String(currentTeamMode));
}

function loadTeamMode() {
  const saved = Number(localStorage.getItem("teamMode"));
  if (saved === TEAM_MODE_5V5 || saved === TEAM_MODE_6V6) {
    currentTeamMode = saved;
  } else {
    currentTeamMode = TEAM_MODE_5V5;
  }
}

function setLockButtonState(evenIndex, locked) {
  const btn = getLockButton(evenIndex);
  if (!btn) return;

  btn.dataset.locked = locked ? "true" : "false";
  btn.textContent = locked ? "🔒" : "🔓";
  btn.setAttribute("aria-pressed", locked ? "true" : "false");
}

function isPairLocked(evenIndex) {
  const btn = getLockButton(evenIndex);
  return btn ? btn.dataset.locked === "true" : false;
}

function saveLocks() {
  const lockState = {};
  for (let i = 2; i <= MAX_TEAM_PLAYERS; i += 2) {
    lockState[i] = isPairLocked(i);
  }
  localStorage.setItem("teamPairLocks", JSON.stringify(lockState));
}

function loadLocks() {
  const saved = JSON.parse(localStorage.getItem("teamPairLocks") || "{}");
  for (let i = 2; i <= MAX_TEAM_PLAYERS; i += 2) {
    setLockButtonState(i, !!saved[i]);
  }
}

function togglePairLock(evenIndex) {
  if (!requireAdmin("팀 고정 설정")) return;

  const btn = getLockButton(evenIndex);
  if (!btn) return;

  setLockButtonState(evenIndex, !isPairLocked(evenIndex));
  saveLocks();
}

function setTeamMode(playerCount) {
  if (playerCount !== TEAM_MODE_5V5 && playerCount !== TEAM_MODE_6V6) return;

  currentTeamMode = playerCount;
  saveTeamMode();
  applyTeamModeUI();

  const teamMessage = document.getElementById("teamMessage");
  if (teamMessage) {
    teamMessage.textContent =
      currentTeamMode === TEAM_MODE_5V5
        ? "5 vs 5 모드로 설정되었습니다. 플레이어 1~10을 사용합니다."
        : "6 vs 6 모드로 설정되었습니다. 플레이어 1~12를 사용합니다.";
  }
}

function applyTeamModeUI() {
  const mode5Btn = document.getElementById("mode5Btn");
  const mode6Btn = document.getElementById("mode6Btn");

  if (mode5Btn) mode5Btn.classList.toggle("active", currentTeamMode === TEAM_MODE_5V5);
  if (mode6Btn) mode6Btn.classList.toggle("active", currentTeamMode === TEAM_MODE_6V6);

  const is5v5 = currentTeamMode === TEAM_MODE_5V5;

  const player11 = getTeamInput(11);
  const player12 = getTeamInput(12);
  const lock12 = getLockButton(12);

  if (player11) {
    player11.disabled = is5v5;
    player11.closest(".player-row")?.classList.toggle("disabled", is5v5);
  }

  if (player12) {
    player12.disabled = is5v5;
    player12.closest(".player-row")?.classList.toggle("disabled", is5v5);
  }

  if (lock12) {
    lock12.style.display = is5v5 ? "none" : "";
  }

  const modeInfo = document.getElementById("teamModeInfo");
  if (modeInfo) {
    modeInfo.textContent =
      currentTeamMode === TEAM_MODE_5V5
        ? "현재 5 vs 5 모드입니다. 총 10명을 입력합니다."
        : "현재 6 vs 6 모드입니다. 총 12명을 입력합니다.";
  }
}

function resetPlayers() {
  if (!requireAdmin("멤버 초기화")) return;
  if (!confirm("저장된 멤버와 팀 결과를 초기화할까요?")) return;

  localStorage.removeItem("players");
  localStorage.removeItem("lastTeams");
  localStorage.removeItem("teamPairLocks");

  getInputs().forEach((input) => {
    input.value = "";
  });

  for (let i = 2; i <= MAX_TEAM_PLAYERS; i += 2) {
    setLockButtonState(i, false);
  }

  const team1 = document.getElementById("team1");
  const team2 = document.getElementById("team2");
  const teamMessage = document.getElementById("teamMessage");

  if (team1) team1.innerHTML = "";
  if (team2) team2.innerHTML = "";
  if (teamMessage) teamMessage.textContent = "멤버와 팀 고정 상태가 초기화되었습니다.";

  savePlayers();
  saveLocks();
}

function getPlayers() {
  const players = [];
  for (let i = 1; i <= currentTeamMode; i++) {
    const input = getTeamInput(i);
    players.push(input ? input.value.trim() : "");
  }
  return players;
}

function validatePlayers(players) {
  if (players.length < MIN_TEAM_PLAYERS || players.length > MAX_TEAM_PLAYERS) {
    alert("플레이어 수를 확인해주세요.");
    return false;
  }

  if (players.some((name) => name === "")) {
    alert(`${currentTeamMode === TEAM_MODE_5V5 ? "5 vs 5" : "6 vs 6"} 모드에 필요한 플레이어를 모두 입력해주세요.`);
    return false;
  }

  const uniqueCount = new Set(players).size;
  if (uniqueCount !== players.length) {
    alert("중복된 플레이어 이름이 있습니다. 확인해주세요.");
    return false;
  }

  return true;
}

function buildPairData() {
  const pairs = [];

  for (let i = 1; i <= currentTeamMode; i += 2) {
    const a = getTeamInput(i)?.value.trim() || "";
    const b = getTeamInput(i + 1)?.value.trim() || "";

    pairs.push({
      oddIndex: i,
      evenIndex: i + 1,
      a,
      b,
      locked: isPairLocked(i + 1)
    });
  }

  return pairs;
}

function shuffleArray(array) {
  const arr = [...array];

  for (let i = arr.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[randomIndex]] = [arr[randomIndex], arr[i]];
  }

  return arr;
}

function makeTeamsFromPairs() {
  const pairs = buildPairData();

  const lockedPairs = pairs.filter((pair) => pair.locked);
  const unlockedPairs = pairs.filter((pair) => !pair.locked);

  if (lockedPairs.length % 2 !== 0) {
    return {
      error: "팀 고정된 페어 수가 홀수입니다. 팀을 정확히 반으로 나누려면 팀 고정 페어 수를 짝수로 맞춰주세요."
    };
  }

  const shuffledLocked = shuffleArray(lockedPairs);
  const shuffledUnlocked = shuffleArray(unlockedPairs);

  const team1 = [];
  const team2 = [];

  const lockedPerTeam = lockedPairs.length / 2;

  shuffledLocked.forEach((pair, index) => {
    const target = index < lockedPerTeam ? team1 : team2;
    target.push(pair.a, pair.b);
  });

  shuffledUnlocked.forEach((pair) => {
    if (Math.random() < 0.5) {
      team1.push(pair.a);
      team2.push(pair.b);
    } else {
      team1.push(pair.b);
      team2.push(pair.a);
    }
  });

  return { team1, team2 };
}

function displayTeam(id, team) {
  const ul = document.getElementById(id);
  if (!ul) return;

  ul.innerHTML = "";

  team.forEach((name) => {
    const li = document.createElement("li");
    li.textContent = name;
    ul.appendChild(li);
  });
}

function countChangedLines(current, previous) {
  if (!previous) return Math.max(current.team1.length, current.team2.length);

  const maxLength = Math.max(
    current.team1.length,
    current.team2.length,
    previous.team1.length,
    previous.team2.length
  );

  let changed = 0;

  for (let i = 0; i < maxLength; i++) {
    const cur1 = current.team1[i] || "";
    const cur2 = current.team2[i] || "";
    const prev1 = previous.team1[i] || "";
    const prev2 = previous.team2[i] || "";

    if (cur1 !== prev1 || cur2 !== prev2) {
      changed++;
    }
  }

  return changed;
}

function isExactlySameLines(current, previous) {
  if (!previous) return false;
  if (!Array.isArray(previous.team1) || !Array.isArray(previous.team2)) return false;
  if (current.team1.length !== previous.team1.length) return false;
  if (current.team2.length !== previous.team2.length) return false;

  for (let i = 0; i < current.team1.length; i++) {
    if (current.team1[i] !== previous.team1[i]) return false;
  }

  for (let i = 0; i < current.team2.length; i++) {
    if (current.team2[i] !== previous.team2[i]) return false;
  }

  return true;
}

function shuffleTeams() {
  if (!requireAdmin("팀 섞기")) return;

  const players = getPlayers();
  if (!validatePlayers(players)) return;

  const previousResult = JSON.parse(localStorage.getItem("lastTeams") || "null");
  let result = null;
  let attempts = 0;

  do {
    result = makeTeamsFromPairs();
    attempts++;

    if (result.error) {
      alert(result.error);
      return;
    }
  } while (
    attempts < 300 &&
    (
      isExactlySameLines(result, previousResult) ||
      (previousResult && countChangedLines(result, previousResult) < 2)
    )
  );

  if (
    previousResult &&
    (
      isExactlySameLines(result, previousResult) ||
      countChangedLines(result, previousResult) < 2
    )
  ) {
    const teamMessage = document.getElementById("teamMessage");
    if (teamMessage) {
      teamMessage.textContent = "조건을 만족하는 새 팀 구성을 찾지 못했습니다. 한 번 더 섞어주세요.";
    }
    return;
  }

  displayTeam("team1", result.team1);
  displayTeam("team2", result.team2);

  localStorage.setItem("lastTeams", JSON.stringify(result));

  const lockedPairCount = buildPairData().filter((pair) => pair.locked).length;
  const teamMessage = document.getElementById("teamMessage");

  if (!teamMessage) return;

  if (!previousResult) {
    teamMessage.textContent =
      `${players.length}명 기준으로 팀이 섞였습니다.` +
      (lockedPairCount > 0 ? ` 팀 고정 페어 ${lockedPairCount}개가 반영되었습니다.` : "");
  } else {
    teamMessage.textContent =
      `직전 결과와 완전히 같은 줄 없이, ${countChangedLines(result, previousResult)}라인 다르게 섞었습니다.` +
      (lockedPairCount > 0 ? ` 팀 고정 페어 ${lockedPairCount}개 반영.` : "");
  }
}

function copyTeams() {
  if (!requireAdmin("팀 복사")) return;

  const team1Items = Array.from(document.querySelectorAll("#team1 li")).map((li) => li.textContent.trim());
  const team2Items = Array.from(document.querySelectorAll("#team2 li")).map((li) => li.textContent.trim());

  if (team1Items.length === 0 && team2Items.length === 0) {
    alert("먼저 팀을 섞어주세요.");
    return;
  }

  let text = "블루\t레드\n";
  const maxLength = Math.max(team1Items.length, team2Items.length);

  for (let i = 0; i < maxLength; i++) {
    text += `${team1Items[i] || ""}\t${team2Items[i] || ""}\n`;
  }

  navigator.clipboard.writeText(text)
    .then(() => {
      const teamMessage = document.getElementById("teamMessage");
      if (teamMessage) teamMessage.textContent = "블루 / 레드 형식으로 복사되었습니다.";
    })
    .catch(() => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);

      const teamMessage = document.getElementById("teamMessage");
      if (teamMessage) teamMessage.textContent = "블루 / 레드 형식으로 복사되었습니다.";
    });
}

/* =========================
   맵 선택 / 추첨
========================= */

function createDefaultMapSelection() {
  const result = {};
  Object.keys(MAP_GROUPS).forEach((groupName) => {
    result[groupName] = [...MAP_GROUPS[groupName]];
  });
  return result;
}

function saveMapSelectionState() {
  localStorage.setItem("selectedMapsByGroup", JSON.stringify(selectedMapsByGroup));
}

function loadMapSelectionState() {
  const saved = JSON.parse(localStorage.getItem("selectedMapsByGroup") || "null");

  if (!saved || typeof saved !== "object") {
    selectedMapsByGroup = createDefaultMapSelection();
    return;
  }

  const normalized = createDefaultMapSelection();

  Object.keys(MAP_GROUPS).forEach((groupName) => {
    if (Array.isArray(saved[groupName])) {
      normalized[groupName] = saved[groupName].filter((mapName) =>
        MAP_GROUPS[groupName].includes(mapName)
      );
    }
  });

  selectedMapsByGroup = normalized;
}

function isMapSelected(groupName, mapName) {
  return (selectedMapsByGroup[groupName] || []).includes(mapName);
}

function toggleMapSelection(groupName, mapName) {
  if (!requireAdmin("맵 선택")) return;
  if (!MAP_GROUPS[groupName] || !MAP_GROUPS[groupName].includes(mapName)) return;

  const current = selectedMapsByGroup[groupName] || [];
  const exists = current.includes(mapName);

  if (exists) {
    selectedMapsByGroup[groupName] = current.filter((name) => name !== mapName);
  } else {
    selectedMapsByGroup[groupName] = [...current, mapName];
  }

  saveMapSelectionState();
  renderMapBoard();
}

function renderMapBoard() {
  const board = document.getElementById("mapBoard");
  if (!board) return;

  board.innerHTML = Object.keys(MAP_GROUPS)
    .map((groupName) => {
      const maps = MAP_GROUPS[groupName];
      const selectedCount = (selectedMapsByGroup[groupName] || []).length;

      return `
        <div class="map-group-card">
          <div class="map-group-header">
            <span class="map-group-title">${escapeHtml(groupName)}</span>
            <span class="map-group-count">(${selectedCount})</span>
          </div>
          <div class="map-chip-list">
            ${maps.map((mapName) => {
              const selected = isMapSelected(groupName, mapName);
              return `
                <button
                  type="button"
                  class="map-chip${selected ? " selected" : ""}"
                  onclick="toggleMapSelection('${escapeJs(groupName)}','${escapeJs(mapName)}')"
                >
                  ${escapeHtml(mapName)}
                </button>
              `;
            }).join("")}
          </div>
        </div>
      `;
    })
    .join("");
}

function getAvailableMapsFlat() {
  const result = [];

  Object.keys(selectedMapsByGroup).forEach((groupName) => {
    (selectedMapsByGroup[groupName] || []).forEach((mapName) => {
      result.push({ groupName, mapName });
    });
  });

  return result;
}

function drawMap() {
  if (!requireAdmin("맵 추첨")) return;

  const availableMaps = getAvailableMapsFlat();

  if (availableMaps.length === 0) {
    alert("최소 1개 이상의 맵을 선택해주세요.");
    return;
  }

  const randomIndex = Math.floor(Math.random() * availableMaps.length);
  const selected = availableMaps[randomIndex];

  localStorage.setItem("selectedMap", selected.mapName);

  const mapMessage = document.getElementById("mapMessage");
  const mapResult = document.getElementById("mapResult");

  if (mapMessage) {
    mapMessage.textContent = `추첨 맵: ${selected.mapName}`;
  }

  if (mapResult) {
    mapResult.textContent = selected.mapName;
  }
}

function copyMap() {
  if (!requireAdmin("맵 복사")) return;

  const text =
    document.getElementById("mapResult")?.textContent?.trim() ||
    document.getElementById("mapMessage")?.textContent?.replace("추첨 맵: ", "").replace(" (복사됨)", "").trim() ||
    "";

  if (!text || text === "-" || text === "맵 추첨 버튼을 눌러주세요.") {
    alert("먼저 맵을 추첨해주세요.");
    return;
  }

  navigator.clipboard.writeText(text)
    .then(() => {
      const mapMessage = document.getElementById("mapMessage");
      if (mapMessage) mapMessage.textContent = `추첨 맵: ${text} (복사됨)`;
    })
    .catch(() => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);

      const mapMessage = document.getElementById("mapMessage");
      if (mapMessage) mapMessage.textContent = `추첨 맵: ${text} (복사됨)`;
    });
}

function resetMap() {
  if (!requireAdmin("맵 초기화")) return;

  selectedMapsByGroup = createDefaultMapSelection();
  saveMapSelectionState();
  localStorage.removeItem("selectedMap");

  const mapMessage = document.getElementById("mapMessage");
  const mapResult = document.getElementById("mapResult");

  if (mapMessage) mapMessage.textContent = "맵 추첨 버튼을 눌러주세요.";
  if (mapResult) mapResult.textContent = "-";

  renderMapBoard();
}

function loadSavedMap() {
  const savedMap = localStorage.getItem("selectedMap");
  const mapMessage = document.getElementById("mapMessage");
  const mapResult = document.getElementById("mapResult");

  if (savedMap && mapMessage) {
    mapMessage.textContent = `추첨 맵: ${savedMap}`;
  }

  if (savedMap && mapResult) {
    mapResult.textContent = savedMap;
  }
}

/* =========================
   스케줄
========================= */

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
      const message = document.getElementById("scheduleMessage");
      if (message) {
        message.textContent = "Firebase 연결 오류가 발생했습니다.";
      }
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

  const hitchaCount = document.getElementById("hitchaCount");
  if (hitchaCount) {
    hitchaCount.textContent = `이번달 힛차 ${count}회`;
  }
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

  if (!label || !daysContainer) return;

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
          <span>${escapeHtml(event.text || "")}</span>
          <span class="event-time">${escapeHtml(event.time || "")}</span>
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
  const scheduleDate = document.getElementById("scheduleDate");
  const scheduleMessage = document.getElementById("scheduleMessage");

  if (scheduleDate) scheduleDate.value = dateKey;
  selectedScheduleId = null;

  if (scheduleMessage) {
    scheduleMessage.textContent = `${dateKey} 날짜로 입력할 수 있습니다.`;
  }
}

function openScheduleFormForToday() {
  if (!requireAdmin("일정 등록")) return;

  const today = new Date();

  const scheduleDate = document.getElementById("scheduleDate");
  const scheduleTime = document.getElementById("scheduleTime");
  const scheduleText = document.getElementById("scheduleText");
  const scheduleCategory = document.getElementById("scheduleCategory");

  if (scheduleDate) {
    scheduleDate.value = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
  }
  if (scheduleTime) scheduleTime.value = "";
  if (scheduleText) scheduleText.value = "";
  if (scheduleCategory) scheduleCategory.value = "방송";

  selectedScheduleId = null;
}

function clearScheduleInputs() {
  const scheduleDate = document.getElementById("scheduleDate");
  const scheduleTime = document.getElementById("scheduleTime");
  const scheduleText = document.getElementById("scheduleText");
  const scheduleCategory = document.getElementById("scheduleCategory");
  const scheduleMessage = document.getElementById("scheduleMessage");

  if (scheduleDate) scheduleDate.value = "";
  if (scheduleTime) scheduleTime.value = "";
  if (scheduleText) scheduleText.value = "";
  if (scheduleCategory) scheduleCategory.value = "방송";

  selectedScheduleId = null;

  if (scheduleMessage) {
    scheduleMessage.textContent = "입력값을 초기화했습니다.";
  }
}

async function saveScheduleFromForm() {
  if (!requireAdmin("일정 저장")) return;

  const date = document.getElementById("scheduleDate")?.value || "";
  const time = document.getElementById("scheduleTime")?.value || "";
  const text = document.getElementById("scheduleText")?.value.trim() || "";
  const category = document.getElementById("scheduleCategory")?.value || "방송";

  if (!date || !text) {
    alert("날짜와 내용을 입력해주세요.");
    return;
  }

  const payload = { date, time, text, category };

  try {
    const scheduleMessage = document.getElementById("scheduleMessage");

    if (selectedScheduleId) {
      await updateDoc(doc(db, "schedules", selectedScheduleId), payload);
      if (scheduleMessage) scheduleMessage.textContent = "일정을 수정했습니다.";
    } else {
      await addDoc(schedulesCollection, payload);
      if (scheduleMessage) scheduleMessage.textContent = "일정을 추가했습니다.";
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

  const scheduleDate = document.getElementById("scheduleDate");
  const scheduleTime = document.getElementById("scheduleTime");
  const scheduleText = document.getElementById("scheduleText");
  const scheduleCategory = document.getElementById("scheduleCategory");
  const scheduleMessage = document.getElementById("scheduleMessage");

  if (scheduleDate) scheduleDate.value = item.date || "";
  if (scheduleTime) scheduleTime.value = item.time || "";
  if (scheduleText) scheduleText.value = item.text || "";
  if (scheduleCategory) scheduleCategory.value = item.category || "기타";

  if (scheduleMessage) {
    scheduleMessage.textContent = "선택한 일정이 입력창에 불러와졌습니다. 수정 후 저장을 눌러주세요.";
  }
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

    const scheduleMessage = document.getElementById("scheduleMessage");
    if (scheduleMessage) {
      scheduleMessage.textContent = "선택한 일정을 삭제했습니다.";
    }
  } catch (error) {
    console.error(error);
    alert("일정 삭제 중 오류가 발생했습니다.");
  }
}

/* =========================
   전적 기록
========================= */

function getTeamInputs(prefix) {
  const inputs = [];
  for (let i = 1; i <= MAX_RECORD_TEAM_SIZE; i++) {
    const el = document.getElementById(`${prefix}${i}`);
    if (el) inputs.push(el);
  }
  return inputs;
}

function getFilledTeamMembers(prefix) {
  return getTeamInputs(prefix)
    .map((input) => input.value.trim())
    .filter((name) => name !== "");
}

function fillTeamInputs(prefix, members = []) {
  const inputs = getTeamInputs(prefix);
  inputs.forEach((input, index) => {
    input.value = members[index] || "";
  });
}

function startRecordSync() {
  const q = query(recordsCollection, orderBy("createdAt", "desc"));

  onSnapshot(
    q,
    (snapshot) => {
      recordsCache = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      renderRecords();
      updateRecordSummary();
      renderDetailPage();
    },
    (error) => {
      console.error(error);
      const recordMessage = document.getElementById("recordMessage");
      if (recordMessage) {
        recordMessage.textContent = "전적을 불러오는 중 오류가 발생했습니다.";
      }
    }
  );
}

function updateRecordSummary() {
  const totalGames = recordsCache.length;

  const killRecords = recordsCache.filter((item) => item.type === "킬내기");
  const mixedRecords = recordsCache.filter(
    (item) => item.type === "랜드" || item.type === "공장" || item.type === "GKL"
  );

  const killWins = killRecords.filter((item) => item.result === "승리").length;
  const mixedWins = mixedRecords.filter((item) => item.result === "승리").length;

  const killLosses = killRecords.filter((item) => item.result === "패배").length;
  const mixedLosses = mixedRecords.filter((item) => item.result === "패배").length;

  const overallWins = recordsCache.filter((item) => item.result === "승리").length;

  const killWinRate =
    killRecords.length > 0 ? ((killWins / killRecords.length) * 100).toFixed(2) : "0.00";

  const overallWinRate =
    totalGames > 0 ? ((overallWins / totalGames) * 100).toFixed(2) : "0.00";

  const totalGamesEl = document.getElementById("recordTotalGames");
  const winBreakdownEl = document.getElementById("recordWinBreakdown");
  const lossBreakdownEl = document.getElementById("recordLossBreakdown");
  const killWinRateEl = document.getElementById("recordKillWinRate");
  const overallWinRateEl = document.getElementById("recordOverallWinRate");

  if (totalGamesEl) totalGamesEl.textContent = totalGames;
  if (winBreakdownEl) winBreakdownEl.textContent = `${killWins} / ${mixedWins}`;
  if (lossBreakdownEl) lossBreakdownEl.textContent = `${killLosses} / ${mixedLosses}`;
  if (killWinRateEl) killWinRateEl.textContent = `${killWinRate}%`;
  if (overallWinRateEl) overallWinRateEl.textContent = `${overallWinRate}%`;
}

function renderMembersHtml(members) {
  if (!Array.isArray(members) || members.length === 0) {
    return `<div>-</div>`;
  }

  return members.map((member) => `<div>${escapeHtml(member)}</div>`).join("");
}

function renderRecords() {
  const list = document.getElementById("recordList");
  if (!list) return;

  list.innerHTML = "";

  if (recordsCache.length === 0) {
    list.innerHTML = `<div class="message">아직 저장된 전적이 없습니다.</div>`;
    return;
  }

  recordsCache.forEach((item) => {
    const div = document.createElement("div");
    div.className = "record-item" + (selectedRecordId === item.id ? " selected" : "");
    div.onclick = () => selectRecord(item.id);

    const myTeam = Array.isArray(item.myTeam) ? item.myTeam : [];
    const enemyTeam = Array.isArray(item.enemyTeam) ? item.enemyTeam : [];

    div.innerHTML = `
      <div class="record-item-top">
        <div>
          <div class="record-date">${escapeHtml(item.date || "-")}</div>
        </div>
        <div class="record-badges">
          <span class="record-badge">${escapeHtml(item.type || "-")}</span>
          <span class="record-badge ${item.result === "승리" ? "record-result-win" : "record-result-lose"}">
            ${escapeHtml(item.result || "-")}
          </span>
        </div>
      </div>

      <div class="record-meta-grid">
        <div class="record-block">
          <div class="record-block-title">우리 팀 (${myTeam.length}명)</div>
          <div class="record-members">
            ${renderMembersHtml(myTeam)}
          </div>
        </div>

        <div class="record-block">
          <div class="record-block-title">상대 팀 (${enemyTeam.length}명)</div>
          <div class="record-members">
            ${renderMembersHtml(enemyTeam)}
          </div>
        </div>

        <div class="record-block">
          <div class="record-block-title">맞밸런스</div>
          <div class="record-single-value">${escapeHtml(item.balance || "-")}</div>
        </div>

        <div class="record-block">
          <div class="record-block-title">순수킬</div>
          <div class="record-single-value">${Number(item.pureKills || 0)}</div>
        </div>
      </div>
    `;

    list.appendChild(div);
  });
}

function selectRecord(id) {
  selectedRecordId = id;

  const item = recordsCache.find((v) => v.id === id);
  if (!item) return;

  const recordDate = document.getElementById("recordDate");
  const recordType = document.getElementById("recordType");
  const recordResult = document.getElementById("recordResult");
  const recordBalance = document.getElementById("recordBalance");
  const recordPureKills = document.getElementById("recordPureKills");
  const recordMessage = document.getElementById("recordMessage");

  if (recordDate) recordDate.value = item.date || "";
  if (recordType) recordType.value = item.type || "킬내기";
  if (recordResult) recordResult.value = item.result || "승리";
  if (recordBalance) recordBalance.value = item.balance || "";
  if (recordPureKills) recordPureKills.value = item.pureKills ?? "";

  fillTeamInputs("myTeam", item.myTeam || []);
  fillTeamInputs("enemyTeam", item.enemyTeam || []);

  if (recordMessage) {
    recordMessage.textContent = "선택한 전적이 입력창에 불러와졌습니다. 삭제할 수 있습니다.";
  }

  renderRecords();
}

function clearRecordInputs() {
  const recordDate = document.getElementById("recordDate");
  const recordType = document.getElementById("recordType");
  const recordResult = document.getElementById("recordResult");
  const recordBalance = document.getElementById("recordBalance");
  const recordPureKills = document.getElementById("recordPureKills");
  const recordMessage = document.getElementById("recordMessage");

  if (recordDate) recordDate.value = "";
  if (recordType) recordType.value = "킬내기";
  if (recordResult) recordResult.value = "승리";
  if (recordBalance) recordBalance.value = "";
  if (recordPureKills) recordPureKills.value = "";

  fillTeamInputs("myTeam", []);
  fillTeamInputs("enemyTeam", []);

  selectedRecordId = null;
  setDefaultRecordDate();

  if (recordMessage) {
    recordMessage.textContent = "입력값을 초기화했습니다.";
  }

  renderRecords();
}

async function saveRecord() {
  if (!requireAdmin("전적 저장")) return;

  const date = document.getElementById("recordDate")?.value || "";
  const type = document.getElementById("recordType")?.value || "킬내기";
  const result = document.getElementById("recordResult")?.value || "승리";
  const balance = document.getElementById("recordBalance")?.value.trim() || "";
  const pureKills = document.getElementById("recordPureKills")?.value ?? "";

  const myTeam = getFilledTeamMembers("myTeam");
  const enemyTeam = getFilledTeamMembers("enemyTeam");

  if (!date) {
    alert("날짜를 입력해주세요.");
    return;
  }

  if (pureKills === "" || Number.isNaN(Number(pureKills))) {
    alert("순수킬을 숫자로 입력해주세요.");
    return;
  }

  if (myTeam.length < MIN_RECORD_TEAM_SIZE || myTeam.length > MAX_RECORD_TEAM_SIZE) {
    alert(`우리 팀은 ${MIN_RECORD_TEAM_SIZE}명 이상 ${MAX_RECORD_TEAM_SIZE}명 이하로 입력해주세요.`);
    return;
  }

  if (enemyTeam.length < MIN_RECORD_TEAM_SIZE || enemyTeam.length > MAX_RECORD_TEAM_SIZE) {
    alert(`상대 팀은 ${MIN_RECORD_TEAM_SIZE}명 이상 ${MAX_RECORD_TEAM_SIZE}명 이하로 입력해주세요.`);
    return;
  }

  if (myTeam.length !== enemyTeam.length) {
    alert("우리 팀과 상대 팀의 인원 수는 같아야 합니다.");
    return;
  }

  try {
    await addDoc(recordsCollection, {
      date,
      type,
      result,
      balance,
      pureKills: Number(pureKills),
      myTeam,
      enemyTeam,
      createdAt: Date.now()
    });

    const recordMessage = document.getElementById("recordMessage");
    if (recordMessage) {
      recordMessage.textContent = "전적을 저장했습니다.";
    }

    clearRecordInputs();
  } catch (error) {
    console.error(error);
    alert("전적 저장 중 오류가 발생했습니다.");
  }
}

async function deleteSelectedRecord() {
  if (!requireAdmin("전적 삭제")) return;

  if (!selectedRecordId) {
    alert("먼저 삭제할 전적을 하나 선택해주세요.");
    return;
  }

  if (!confirm("선택한 전적을 삭제할까요?")) return;

  try {
    await deleteDoc(doc(db, "killRecords", selectedRecordId));
    selectedRecordId = null;
    clearRecordInputs();

    const recordMessage = document.getElementById("recordMessage");
    if (recordMessage) {
      recordMessage.textContent = "선택한 전적을 삭제했습니다.";
    }
  } catch (error) {
    console.error(error);
    alert("전적 삭제 중 오류가 발생했습니다.");
  }
}

function setDefaultRecordDate() {
  const recordDate = document.getElementById("recordDate");
  if (!recordDate) return;

  const today = new Date();
  recordDate.value =
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

/* =========================
   전적 상세
========================= */

function normalizeMembers(members) {
  if (!Array.isArray(members)) return [];
  return members
    .map((v) => String(v || "").trim())
    .filter((v) => v !== "");
}

function calcRate(wins, total) {
  if (!total) return "0.00%";
  return ((wins / total) * 100).toFixed(2) + "%";
}

function summarizeRecordList(list) {
  const wins = list.filter((item) => item.result === "승리").length;
  const losses = list.filter((item) => item.result === "패배").length;
  const total = wins + losses;

  return {
    wins,
    losses,
    total,
    rate: calcRate(wins, total)
  };
}

function makeStatsTable(headers, rows) {
  if (!rows.length) {
    return `<div class="empty-stats">표시할 데이터가 없습니다.</div>`;
  }

  const thead = `
    <thead>
      <tr>
        ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}
      </tr>
    </thead>
  `;

  const tbody = `
    <tbody>
      ${rows.map((row) => `
        <tr>
          ${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}
        </tr>
      `).join("")}
    </tbody>
  `;

  return `<div class="stats-table-wrap"><table class="stats-table">${thead}${tbody}</table></div>`;
}

function renderBalanceStats() {
  const target = document.getElementById("detailBalanceTable");
  if (!target) return;

  const killOnlyRecords = recordsCache.filter((item) => item.type === "킬내기");

  if (!killOnlyRecords.length) {
    target.innerHTML = `<div class="empty-stats">킬내기 전적이 없습니다.</div>`;
    return;
  }

  const balanceGroups = {};

  killOnlyRecords.forEach((item) => {
    const key = (item.balance || "미입력").trim() || "미입력";
    if (!balanceGroups[key]) balanceGroups[key] = [];
    balanceGroups[key].push(item);
  });

  const rows = Object.keys(balanceGroups)
    .sort((a, b) => a.localeCompare(b, "ko"))
    .map((key) => {
      const stat = summarizeRecordList(balanceGroups[key]);
      return [key, `${stat.wins}승 ${stat.losses}패`, stat.rate];
    });

  target.innerHTML = makeStatsTable(["밸런스", "전적", "승률"], rows);
}

function isThisMonth(dateStr) {
  if (!dateStr) return false;

  const date = new Date(dateStr);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function renderMonthStats() {
  const target = document.getElementById("detailMonthTable");
  if (!target) return;

  const monthRecords = recordsCache.filter((item) => isThisMonth(item.date));

  const kill = summarizeRecordList(monthRecords.filter((item) => item.type === "킬내기"));
  const land = summarizeRecordList(monthRecords.filter((item) => item.type === "랜드"));
  const gkl = summarizeRecordList(monthRecords.filter((item) => item.type === "GKL"));
  const factory = summarizeRecordList(monthRecords.filter((item) => item.type === "공장"));

  const rows = [
    ["킬내기", `${kill.wins}승 ${kill.losses}패`, kill.rate],
    ["랜드", `${land.wins}승 ${land.losses}패`, land.rate],
    ["GKL", `${gkl.wins}승 ${gkl.losses}패`, gkl.rate],
    ["공장", `${factory.wins}승 ${factory.losses}패`, factory.rate]
  ];

  target.innerHTML = makeStatsTable(["이번 달 항목", "전적", "승률"], rows);
}

function renderMapStats() {
  const target = document.getElementById("detailMapTable");
  if (!target) return;

  const rows = ["킬내기", "랜드", "GKL", "공장"].map((type) => {
    const stat = summarizeRecordList(recordsCache.filter((item) => item.type === type));
    return [type, `${stat.wins}승 ${stat.losses}패`, stat.rate];
  });

  target.innerHTML = makeStatsTable(["종류", "전적", "승률"], rows);
}

function renderDetailPage() {
  const balanceEl = document.getElementById("detailBalanceTable");
  const monthEl = document.getElementById("detailMonthTable");
  const mapEl = document.getElementById("detailMapTable");
  const relationEl = document.getElementById("memberRelationTable");

  if (!balanceEl || !monthEl || !mapEl || !relationEl) return;

  renderBalanceStats();
  renderMonthStats();
  renderMapStats();

  const input = document.getElementById("memberRelationInput");
  if (input && input.value.trim()) {
    renderMemberRelationStats();
  } else {
    relationEl.innerHTML = `<div class="empty-stats">비교할 멤버를 검색해 주세요.</div>`;
  }
}

function clearMemberRelationStats() {
  const input = document.getElementById("memberRelationInput");
  if (input) input.value = "";

  const summary = document.getElementById("memberRelationSummary");
  const table = document.getElementById("memberRelationTable");

  if (summary) {
    summary.textContent = "비교할 멤버 이름을 입력해 주세요. (수힛 기준)";
  }

  if (table) {
    table.innerHTML = `<div class="empty-stats">비교할 멤버를 검색해 주세요.</div>`;
  }
}

function getBasePerspectiveResult(record) {
  const myTeam = normalizeMembers(record.myTeam);
  const enemyTeam = normalizeMembers(record.enemyTeam);

  const baseInMy = myTeam.includes(RELATION_BASE_MEMBER);
  const baseInEnemy = enemyTeam.includes(RELATION_BASE_MEMBER);

  if (!baseInMy && !baseInEnemy) return null;

  const myTeamWon = record.result === "승리";

  if (baseInMy) {
    return myTeamWon ? "승리" : "패배";
  }

  return myTeamWon ? "패배" : "승리";
}

function renderMemberRelationStats() {
  const input = document.getElementById("memberRelationInput");
  const targetName = input ? input.value.trim() : "";

  if (!targetName) {
    clearMemberRelationStats();
    return;
  }

  if (targetName === RELATION_BASE_MEMBER) {
    const summary = document.getElementById("memberRelationSummary");
    const table = document.getElementById("memberRelationTable");

    if (summary) {
      summary.textContent =
        `기준 멤버는 이미 ${RELATION_BASE_MEMBER}로 고정되어 있습니다. 비교할 다른 멤버를 입력해 주세요.`;
    }

    if (table) {
      table.innerHTML =
        `<div class="empty-stats">${RELATION_BASE_MEMBER}이 아닌 다른 멤버를 입력해 주세요.</div>`;
    }
    return;
  }

  let sameWins = 0;
  let sameLosses = 0;
  let enemyWins = 0;
  let enemyLosses = 0;
  let relatedMatchCount = 0;

  recordsCache.forEach((record) => {
    const myTeam = normalizeMembers(record.myTeam);
    const enemyTeam = normalizeMembers(record.enemyTeam);

    const baseInMy = myTeam.includes(RELATION_BASE_MEMBER);
    const baseInEnemy = enemyTeam.includes(RELATION_BASE_MEMBER);
    const targetInMy = myTeam.includes(targetName);
    const targetInEnemy = enemyTeam.includes(targetName);

    if (!(baseInMy || baseInEnemy)) return;
    if (!(targetInMy || targetInEnemy)) return;

    const baseResult = getBasePerspectiveResult(record);
    if (!baseResult) return;

    relatedMatchCount++;

    const sameTeam =
      (baseInMy && targetInMy) ||
      (baseInEnemy && targetInEnemy);

    const versusTeam =
      (baseInMy && targetInEnemy) ||
      (baseInEnemy && targetInMy);

    if (sameTeam) {
      if (baseResult === "승리") sameWins++;
      else sameLosses++;
    }

    if (versusTeam) {
      if (baseResult === "승리") enemyWins++;
      else enemyLosses++;
    }
  });

  const summary = document.getElementById("memberRelationSummary");
  const table = document.getElementById("memberRelationTable");

  if (!relatedMatchCount) {
    if (summary) {
      summary.textContent = `${RELATION_BASE_MEMBER} 기준으로 ${targetName}와 함께 계산할 전적이 없습니다.`;
    }

    if (table) {
      table.innerHTML = `<div class="empty-stats">관계 데이터를 찾지 못했습니다.</div>`;
    }
    return;
  }

  const sameTotal = sameWins + sameLosses;
  const enemyTotal = enemyWins + enemyLosses;

  if (summary) {
    summary.textContent = `${RELATION_BASE_MEMBER} 기준 / 비교 멤버: ${targetName}`;
  }

  const rows = [[
    targetName,
    `${sameTotal}경기`,
    `${sameWins}승 ${sameLosses}패`,
    calcRate(sameWins, sameTotal),
    `${enemyTotal}경기`,
    `${enemyWins}승 ${enemyLosses}패`,
    calcRate(enemyWins, enemyTotal)
  ]];

  if (table) {
    table.innerHTML =
      makeStatsTable(
        ["멤버", "같은 팀 경기", "같은 팀 전적", "같은 팀 승률", "적팀 경기", "적팀 전적", "적팀 승률"],
        rows
      );
  }
}

/* =========================
   초기화
========================= */

applySavedTheme();
updateAdminButton();
loadHeroImage();

loadTeamMode();
loadPlayers();
loadLocks();
applyTeamModeUI();

loadMapSelectionState();
renderMapBoard();
loadSavedMap();

setDefaultRecordDate();
startScheduleSync();
startRecordSync();
clearMemberRelationStats();
