import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/*
  1) Firebase를 쓰려면 아래 값들을 Firebase 콘솔의 Web App 설정값으로 교체하세요.
  2) 비워두면 localStorage 데모 모드로 동작합니다.
*/
const firebaseConfig = {
  apiKey: "AIzaSyBPysuBDerQ2rMN4E_blY-jpU4Wj4JkVHo",
  authDomain: "bingo-d4a00.firebaseapp.com",
  // Firebase 콘솔 > Realtime Database에서 정확한 URL을 복사해 넣으세요.
  // 예: "https://bingo-d4a00-default-rtdb.asia-southeast1.firebasedatabase.app"
  databaseURL: "https://bingo-d4a00-default-rtdb.firebaseio.com/",
  projectId: "bingo-d4a00",
  storageBucket: "bingo-d4a00.firebasestorage.app",
  messagingSenderId: "166246860692",
  appId: "1:166246860692:web:f9e40453a441594250f181",
  measurementId: "G-4DW4SXCZR3"
};

const ROOM_PATH = "bingoRooms/main";
const LOCAL_STORAGE_KEY = "bkg-bingo-v1-state";
const OBS_SCALE_STORAGE_KEY = "bkg-bingo-obs-scale";
const LOCAL_ADMIN_PIN = "1234";
const ADMIN_EMAIL_DOMAIN = "@suweet.com";
const BINGO_TYPES = ["mission", "number", "alphabet", "reset"];
const NUMBER_BINGO_SIZES = [5, 7, 10];


const stateDefaults = {
  title: "오늘의 빙고",
  size: 5,
  contentType: "mission",
  chickenCount: 0,
  resetRewards: {
    one: 0,
    line: 0,
    all: 0
  },
  bingoCount: 0,
  completedLines: {},
  effectNonce: 0,
  lastNewLines: [],
  drawnNumbers: [],
  lastDrawnNumber: null,
  lastDrawMatched: false,
  cells: []
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  pageTitle: $("#pageTitle"),
  boardTitle: $("#boardTitle"),
  topbar: $("#topbar"),
  adminPanel: $("#adminPanel"),
  adminToggleRow: $("#adminToggleRow"),
  adminToggle: $("#adminToggle"),
  loginStatus: $("#loginStatus"),
  firebaseLoginBox: $("#firebaseLoginBox"),
  localLoginBox: $("#localLoginBox"),
  adminEmail: $("#adminEmail"),
  adminPassword: $("#adminPassword"),
  loginBtn: $("#loginBtn"),
  logoutBtn: $("#logoutBtn"),
  localPin: $("#localPin"),
  localLoginBtn: $("#localLoginBtn"),
  localLogoutBtn: $("#localLogoutBtn"),
  titleInput: $("#titleInput"),
  sizeSelect: $("#sizeSelect"),
  typeSelect: $("#typeSelect"),
  createBoardBtn: $("#createBoardBtn"),
  shuffleBtn: $("#shuffleBtn"),
  resetChecksBtn: $("#resetChecksBtn"),
  numberDrawBtn: $("#numberDrawBtn"),
  resetDrawBtn: $("#resetDrawBtn"),
  lastDrawnNumber: $("#lastDrawnNumber"),
  drawnCount: $("#drawnCount"),
  remainingDrawCount: $("#remainingDrawCount"),
  drawResultText: $("#drawResultText"),
  chickenPreview: $("#chickenPreview"),
  chickenInput: $("#chickenInput"),
  chickenMinusBtn: $("#chickenMinusBtn"),
  chickenPlusBtn: $("#chickenPlusBtn"),
  resetMenuAdmin: $("#resetMenuAdmin"),
  resetRewardOne: $("#resetRewardOne"),
  resetRewardLine: $("#resetRewardLine"),
  resetRewardAll: $("#resetRewardAll"),
  standardScoreStrip: $("#standardScoreStrip"),
  resetScoreMenu: $("#resetScoreMenu"),
  resetBingoCount: $("#resetBingoCount"),
  resetChickenCount: $("#resetChickenCount"),
  resetMenuOne: $("#resetMenuOne"),
  resetMenuLine: $("#resetMenuLine"),
  resetMenuAll: $("#resetMenuAll"),
  bulkText: $("#bulkText"),
  applyBulkBtn: $("#applyBulkBtn"),
  clearBulkBtn: $("#clearBulkBtn"),
  hardResetBtn: $("#hardResetBtn"),
  stage: $("#stage"),
  boardWrap: $("#boardWrap"),
  bingoBoard: $("#bingoBoard"),
  lineLayer: $("#lineLayer"),
  bingoOverlay: $("#bingoOverlay"),
  bingoCount: $("#bingoCount"),
  chickenCount: $("#chickenCount"),
  maxBingoCount: $("#maxBingoCount"),
  maxBingoBox: $("#maxBingoBox"),
  cellEditorHelp: $("#cellEditorHelp"),
  obsScalePanel: $("#obsScalePanel"),
  obsScaleButtons: $$(`[data-obs-scale]`)
};

let currentState = makeInitialState();
let firebaseApp = null;
let db = null;
let auth = null;
let roomRef = null;
let isFirebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId);
let isAdmin = false;
let activeView = new URLSearchParams(location.search).get("view") || "public";
let lastRenderedEffectNonce = 0;
let titleSaveTimer = null;
let cellSaveTimers = new Map();
let obsScale = getInitialObsScale();

if (!["public", "obs"].includes(activeView)) activeView = "public";

init();

async function init() {
  setupView();
  bindEvents();
  setupFirebaseIfAvailable();
  await loadInitialState();
  render();
}

function setupView() {
  document.body.classList.add(`view-${activeView}`);
  $$('[data-view-link]').forEach((link) => {
    link.classList.toggle("active", link.dataset.viewLink === activeView);
  });

  if (activeView !== "obs") {
    els.adminPanel.hidden = false;
    els.adminToggleRow.hidden = false;
    els.cellEditorHelp.hidden = false;
  } else if (els.obsScalePanel) {
    els.obsScalePanel.hidden = false;
  }

  applyObsScale(obsScale);
}

function setupFirebaseIfAvailable() {
  if (!isFirebaseEnabled) {
    els.localLoginBox.hidden = false;
    els.firebaseLoginBox.hidden = true;
    setLoginStatus("로컬 모드", "warn");
    return;
  }

  firebaseApp = initializeApp(firebaseConfig);
  db = getDatabase(firebaseApp);
  auth = getAuth(firebaseApp);
  roomRef = ref(db, ROOM_PATH);

  els.firebaseLoginBox.hidden = false;
  els.localLoginBox.hidden = true;

  onAuthStateChanged(auth, (user) => {
    isAdmin = Boolean(user);
    setLoginStatus(isAdmin ? "관리자 로그인됨" : "보기 전용", isAdmin ? "ok" : "warn");
    renderAdminLock();
  });

  onValue(roomRef, (snapshot) => {
    if (!snapshot.exists()) return;
    currentState = normalizeState(snapshot.val());
    render();
  }, (error) => {
    console.error("Firebase 실시간 수신 실패", error);
    setLoginStatus("DB 연결 오류", "warn");
  });
}

async function loadInitialState() {
  if (isFirebaseEnabled) {
    try {
      const snapshot = await get(roomRef);
      if (snapshot.exists()) {
        currentState = normalizeState(snapshot.val());
      } else {
        currentState = makeInitialState();
        // 방이 없을 때는 로그인한 관리자만 생성 가능. 미로그인 상태면 화면에 기본값만 표시됩니다.
        if (auth.currentUser) await saveWholeState(currentState);
      }
    } catch (error) {
      console.error("Firebase DB 초기 불러오기 실패", error);
      currentState = makeInitialState();
      setLoginStatus("DB 연결 오류", "warn");
    }
    return;
  }

  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  currentState = saved ? normalizeState(JSON.parse(saved)) : makeInitialState();
}

function bindEvents() {
  els.adminToggle?.addEventListener("click", () => {
    const collapsed = document.body.classList.toggle("admin-collapsed");
    els.adminToggle.textContent = collapsed ? "관리자 패널 열기" : "관리자 패널 접기";
  });

  els.obsScaleButtons?.forEach((button) => {
    button.addEventListener("click", () => {
      const scale = Number(button.dataset.obsScale || 1);
      applyObsScale(scale);
      localStorage.setItem(OBS_SCALE_STORAGE_KEY, String(scale));
    });
  });

  els.loginBtn?.addEventListener("click", async () => {
    try {
      const email = makeLoginEmail(els.adminEmail.value);
      if (!email) {
        alert("아이디를 입력해 주세요.");
        return;
      }
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, els.adminPassword.value);
    } catch (error) {
      alert(`로그인 실패: ${error.message}`);
    }
  });

  els.logoutBtn?.addEventListener("click", async () => {
    if (auth) await signOut(auth);
  });

  els.localLoginBtn?.addEventListener("click", () => {
    if (els.localPin.value === LOCAL_ADMIN_PIN) {
      isAdmin = true;
      setLoginStatus("관리자 열림", "ok");
      renderAdminLock();
      render();
      return;
    }
    alert("PIN이 맞지 않습니다. app.js에서 LOCAL_ADMIN_PIN 값을 바꿀 수 있어요.");
  });

  els.localLogoutBtn?.addEventListener("click", () => {
    isAdmin = false;
    setLoginStatus("로컬 모드", "warn");
    renderAdminLock();
    render();
  });

  els.titleInput.addEventListener("input", () => {
    clearTimeout(titleSaveTimer);
    titleSaveTimer = setTimeout(() => {
      commitState((draft) => {
        draft.title = els.titleInput.value.trim() || "오늘의 빙고";
      });
    }, 350);
  });

  els.typeSelect.addEventListener("change", () => {
    syncSizeSelectForType(els.typeSelect.value);
    updateNumberDrawControls();
    updateResetMenuAdminState();
  });

  els.sizeSelect.addEventListener("change", () => {
    const validSize = getValidSizeForType(els.typeSelect.value, Number(els.sizeSelect.value));
    els.sizeSelect.value = String(validSize);
  });

  els.createBoardBtn.addEventListener("click", () => {
    const contentType = els.typeSelect.value;
    const size = getValidSizeForType(contentType, Number(els.sizeSelect.value));
    commitState((draft) => {
      draft.size = size;
      draft.contentType = contentType;
      draft.cells = buildCells(size, contentType);
      draft.completedLines = {};
      draft.bingoCount = 0;
      draft.drawnNumbers = [];
      draft.lastDrawnNumber = null;
      draft.lastDrawMatched = false;
      draft.effectNonce += 1;
      draft.lastNewLines = [];
    });
  });

  els.shuffleBtn.addEventListener("click", () => {
    commitState((draft) => {
      const texts = shuffleArray(draft.cells.map((cell) => cell.text));
      draft.cells = draft.cells.map((cell, index) => ({ ...cell, text: texts[index] }));
      if (draft.contentType === "number") {
        draft.drawnNumbers = [];
        draft.lastDrawnNumber = null;
        draft.lastDrawMatched = false;
      }
    });
  });

  els.resetChecksBtn.addEventListener("click", () => {
    commitState((draft) => {
      draft.cells = draft.cells.map((cell) => ({ ...cell, cleared: false }));
      draft.completedLines = {};
      draft.bingoCount = 0;
      draft.drawnNumbers = [];
      draft.lastDrawnNumber = null;
      draft.lastDrawMatched = false;
      draft.lastNewLines = [];
      draft.effectNonce += 1;
    });
  });

  els.numberDrawBtn?.addEventListener("click", drawRandomNumber);
  els.resetDrawBtn?.addEventListener("click", resetNumberDrawHistory);

  els.chickenMinusBtn.addEventListener("click", () => updateChicken(-1));
  els.chickenPlusBtn.addEventListener("click", () => updateChicken(1));
  els.chickenInput.addEventListener("change", () => {
    const value = Math.max(0, Number(els.chickenInput.value || 0));
    commitState((draft) => {
      draft.chickenCount = value;
    });
  });

  [
    [els.resetRewardOne, "one"],
    [els.resetRewardLine, "line"],
    [els.resetRewardAll, "all"]
  ].forEach(([input, key]) => {
    input?.addEventListener("change", () => {
      const value = Math.max(0, Number(input.value || 0));
      commitState((draft) => {
        draft.resetRewards = normalizeResetRewards(draft.resetRewards);
        draft.resetRewards[key] = value;
      });
    });
  });

  els.applyBulkBtn.addEventListener("click", () => {
    const lines = els.bulkText.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      alert("적용할 내용이 없습니다.");
      return;
    }

    commitState((draft) => {
      draft.cells = draft.cells.map((cell, index) => ({
        ...cell,
        text: lines[index] ?? cell.text
      }));
    });
  });

  els.clearBulkBtn.addEventListener("click", () => {
    els.bulkText.value = "";
  });

  els.hardResetBtn.addEventListener("click", () => {
    if (!confirm("전체 초기화할까요? 빙고판과 치킨 수가 모두 초기화됩니다.")) return;
    commitState((draft) => {
      const fresh = makeInitialState();
      Object.assign(draft, fresh);
    });
  });
}

function getAllowedSizesForType(contentType) {
  return contentType === "number" ? NUMBER_BINGO_SIZES : [5];
}

function getValidSizeForType(contentType, size) {
  const allowed = getAllowedSizesForType(contentType);
  const numericSize = Number(size);
  return allowed.includes(numericSize) ? numericSize : allowed[0];
}

function syncSizeSelectForType(contentType, requestedSize = Number(els.sizeSelect?.value || currentState.size)) {
  if (!els.sizeSelect) return;
  const allowed = getAllowedSizesForType(contentType);
  const nextSize = getValidSizeForType(contentType, requestedSize);

  els.sizeSelect.innerHTML = allowed
    .map((size) => `<option value="${size}">${size} × ${size}</option>`)
    .join("");
  els.sizeSelect.value = String(nextSize);
}

function makeLoginEmail(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.includes("@") ? raw : `${raw}${ADMIN_EMAIL_DOMAIN}`;
}

function updateChicken(delta) {
  commitState((draft) => {
    draft.chickenCount = Math.max(0, Number(draft.chickenCount || 0) + delta);
  });
}

function normalizeResetRewards(value) {
  return {
    one: Math.max(0, Number(value?.one || 0)),
    line: Math.max(0, Number(value?.line || 0)),
    all: Math.max(0, Number(value?.all || 0))
  };
}

function updateResetMenuAdminState() {
  const selectedType = els.typeSelect?.value || currentState.contentType;
  const isReset = selectedType === "reset" || currentState.contentType === "reset";

  if (els.resetMenuAdmin) {
    els.resetMenuAdmin.classList.toggle("is-muted", !isReset);
  }

  [els.resetRewardOne, els.resetRewardLine, els.resetRewardAll].forEach((input) => {
    if (!input) return;
    input.disabled = !isAdmin || activeView === "obs";
  });
}

function updateNumberDrawControls() {
  const selectedType = els.typeSelect?.value || currentState.contentType;
  const isNumberMode = currentState.contentType === "number" || selectedType === "number";
  const drawn = normalizeDrawnNumbers(currentState.drawnNumbers);
  const remaining = Math.max(0, 100 - drawn.length);

  if (els.lastDrawnNumber) els.lastDrawnNumber.textContent = currentState.lastDrawnNumber ?? "-";
  if (els.drawnCount) els.drawnCount.textContent = String(drawn.length);
  if (els.remainingDrawCount) els.remainingDrawCount.textContent = String(remaining);

  if (els.numberDrawBtn) {
    els.numberDrawBtn.disabled = !isAdmin || activeView === "obs" || currentState.contentType !== "number" || remaining <= 0;
  }
  if (els.resetDrawBtn) {
    els.resetDrawBtn.disabled = !isAdmin || activeView === "obs" || currentState.contentType !== "number" || drawn.length === 0;
  }

  if (!els.drawResultText) return;
  if (currentState.contentType !== "number") {
    els.drawResultText.textContent = selectedType === "number"
      ? "빙고판 생성을 누르면 1~100 숫자판과 추첨 버튼을 사용할 수 있어요."
      : "내용 타입이 숫자일 때 사용할 수 있어요.";
    return;
  }

  if (currentState.lastDrawnNumber == null) {
    els.drawResultText.textContent = "1~100 중 중복 없이 추첨하고, 빙고판에 있는 숫자는 자동으로 지워져요.";
    return;
  }

  els.drawResultText.textContent = currentState.lastDrawMatched
    ? `${currentState.lastDrawnNumber}번 추첨! 빙고판의 같은 숫자를 지웠어요.`
    : `${currentState.lastDrawnNumber}번 추첨! 현재 빙고판에는 없는 숫자예요.`;
}

function drawRandomNumber() {
  if (currentState.contentType !== "number") {
    alert("숫자 타입 빙고판에서만 사용할 수 있습니다.");
    return;
  }

  commitState((draft) => {
    const drawn = new Set(normalizeDrawnNumbers(draft.drawnNumbers));
    if (drawn.size >= 100) {
      alert("1~100 숫자를 모두 추첨했습니다.");
      return;
    }

    const pool = Array.from({ length: 100 }, (_, index) => index + 1).filter((number) => !drawn.has(number));
    const picked = pool[Math.floor(Math.random() * pool.length)];
    drawn.add(picked);

    const matchedCell = draft.cells.find((cell) => String(cell.text).trim() === String(picked));
    if (matchedCell) matchedCell.cleared = true;

    draft.drawnNumbers = Array.from(drawn);
    draft.lastDrawnNumber = picked;
    draft.lastDrawMatched = Boolean(matchedCell);
  });
}

function resetNumberDrawHistory() {
  commitState((draft) => {
    draft.drawnNumbers = [];
    draft.lastDrawnNumber = null;
    draft.lastDrawMatched = false;
  });
}

function normalizeDrawnNumbers(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .map((number) => Number(number))
    .filter((number) => Number.isInteger(number) && number >= 1 && number <= 100)));
}

function normalizeLastDrawnNumber(value) {
  if (value == null) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 100 ? number : null;
}

function render() {
  currentState = normalizeState(currentState);

  if (els.pageTitle) els.pageTitle.textContent = getViewTitle();
  if (els.boardTitle) els.boardTitle.textContent = currentState.title;
  if (els.titleInput) els.titleInput.value = currentState.title;
  if (els.typeSelect) els.typeSelect.value = currentState.contentType;
  syncSizeSelectForType(currentState.contentType, currentState.size);
  const isResetBingo = currentState.contentType === "reset";
  const isNumberBingo = currentState.contentType === "number";
  const resetRewards = normalizeResetRewards(currentState.resetRewards);
  document.body.classList.toggle("is-reset-bingo", isResetBingo);
  document.body.classList.toggle("is-number-bingo", isNumberBingo);

  if (els.chickenInput) els.chickenInput.value = String(currentState.chickenCount);
  if (els.chickenPreview) els.chickenPreview.textContent = currentState.chickenCount;
  if (els.bingoCount) els.bingoCount.textContent = currentState.bingoCount;
  if (els.chickenCount) els.chickenCount.textContent = currentState.chickenCount;
  if (els.resetBingoCount) els.resetBingoCount.textContent = currentState.bingoCount;
  if (els.resetChickenCount) els.resetChickenCount.textContent = currentState.chickenCount;
  if (els.resetRewardOne) els.resetRewardOne.value = String(resetRewards.one);
  if (els.resetRewardLine) els.resetRewardLine.value = String(resetRewards.line);
  if (els.resetRewardAll) els.resetRewardAll.value = String(resetRewards.all);
  if (els.resetMenuOne) els.resetMenuOne.textContent = String(resetRewards.one);
  if (els.resetMenuLine) els.resetMenuLine.textContent = String(resetRewards.line);
  if (els.resetMenuAll) els.resetMenuAll.textContent = String(resetRewards.all);
  if (els.standardScoreStrip) els.standardScoreStrip.hidden = isResetBingo;
  if (els.resetScoreMenu) els.resetScoreMenu.hidden = !isResetBingo;
  if (els.maxBingoCount) els.maxBingoCount.textContent = currentState.size * 2 + 2;
  if (els.bingoBoard) els.bingoBoard.style.setProperty("--cell-size", currentState.size);

  renderAdminLock();
  updateNumberDrawControls();
  updateResetMenuAdminState();
  renderBoard();
  renderLines();
  maybePlayBingoEffect();
}

function getViewTitle() {
  if (activeView === "obs") return "송출용";
  return "빙고 관리";
}

function getTextLengthClass(value) {
  const length = Array.from(String(value || "").replace(/\s+/g, "")).length;
  if (length <= 4) return "text-short";
  if (length <= 8) return "text-medium";
  if (length <= 13) return "text-long";
  return "text-xlong";
}

function getNumberDigitClass(value) {
  const digits = String(value || "").replace(/\D/g, "").length;
  if (digits <= 1) return "number-digit-1";
  if (digits === 2) return "number-digit-2";
  return "number-digit-3";
}

function renderAdminLock() {
  const locked = activeView !== "obs" && !isAdmin;
  $$('[data-admin-only]').forEach((item) => {
    item.style.opacity = locked ? ".45" : "1";
    item.style.pointerEvents = locked ? "none" : "auto";
  });

  const shouldDisable = activeView !== "obs" && !isAdmin;
  [
    els.titleInput,
    els.typeSelect,
    els.createBoardBtn,
    els.shuffleBtn,
    els.resetChecksBtn,
    els.numberDrawBtn,
    els.resetDrawBtn,
    els.chickenInput,
    els.chickenMinusBtn,
    els.chickenPlusBtn,
    els.resetRewardOne,
    els.resetRewardLine,
    els.resetRewardAll,
    els.bulkText,
    els.applyBulkBtn,
    els.clearBulkBtn,
    els.hardResetBtn
  ].forEach((el) => {
    if (el) el.disabled = shouldDisable;
  });

  if (els.sizeSelect) {
    els.sizeSelect.disabled = shouldDisable || getAllowedSizesForType(els.typeSelect?.value || currentState.contentType).length === 1;
  }
}

function renderBoard() {
  if (!els.bingoBoard) return;
  els.bingoBoard.innerHTML = "";
  const completedCellIndexes = new Set(
    Object.values(currentState.completedLines || {}).flatMap((line) => line.cells)
  );

  currentState.cells.forEach((cell, index) => {
    const cellEl = document.createElement("div");
    const numberDigitClass = currentState.contentType === "number" ? getNumberDigitClass(cell.text) : "";
    cellEl.className = `cell ${getTextLengthClass(cell.text)} ${numberDigitClass}`.trim();
    cellEl.dataset.index = String(index);
    cellEl.classList.toggle("cleared", Boolean(cell.cleared));
    cellEl.classList.toggle("line-completed", completedCellIndexes.has(index));

    const text = document.createElement("div");
    text.className = "cell-text";
    text.textContent = cell.text;
    cellEl.append(text);

    if (activeView !== "obs" && isAdmin) {
      cellEl.classList.add("admin-clickable");
      cellEl.title = cell.cleared ? "클릭하면 복구됩니다." : "클릭하면 지워집니다.";
      cellEl.addEventListener("click", () => toggleCell(index));
    }

    els.bingoBoard.append(cellEl);
  });
}

function renderLines() {
  if (!els.lineLayer) return;
  els.lineLayer.innerHTML = "";
  const lines = Object.values(currentState.completedLines || {});
  const newLineIds = new Set(currentState.lastNewLines || []);

  lines.forEach((line) => {
    const coords = getLineCoords(line, currentState.size);
    const svgLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    svgLine.setAttribute("x1", coords.x1);
    svgLine.setAttribute("y1", coords.y1);
    svgLine.setAttribute("x2", coords.x2);
    svgLine.setAttribute("y2", coords.y2);
    svgLine.classList.add("bingo-line");
    if (newLineIds.has(line.id)) svgLine.classList.add("new");
    els.lineLayer.append(svgLine);
  });
}

function maybePlayBingoEffect() {
  const hasNewLine = currentState.effectNonce !== lastRenderedEffectNonce && (currentState.lastNewLines || []).length > 0;
  if (!hasNewLine) return;

  lastRenderedEffectNonce = currentState.effectNonce;
  if (!els.bingoOverlay) return;
  els.bingoOverlay.hidden = false;
  els.bingoOverlay.style.animation = "none";
  void els.bingoOverlay.offsetWidth;
  els.bingoOverlay.style.animation = "";

  window.setTimeout(() => {
    els.bingoOverlay.hidden = true;
  }, 1700);
}

function scheduleCellTextSave(index, value) {
  clearTimeout(cellSaveTimers.get(index));
  const timer = setTimeout(() => {
    commitState((draft) => {
      if (!draft.cells[index]) return;
      draft.cells[index].text = value.trim() || `미션 ${index + 1}`;
    });
  }, 320);
  cellSaveTimers.set(index, timer);
}

function toggleCell(index) {
  commitState((draft) => {
    if (!draft.cells[index]) return;
    draft.cells[index].cleared = !draft.cells[index].cleared;
  });
}

async function commitState(mutator) {
  if (!isAdmin) {
    alert("관리자 로그인 후 수정할 수 있습니다.");
    return;
  }

  const before = normalizeState(currentState);
  const draft = structuredClone(before);
  mutator(draft);

  const after = applyBingoCalculation(draft, before.completedLines || {});
  await saveWholeState(after);
}

async function saveWholeState(nextState) {
  currentState = normalizeState(nextState);

  // Firebase 저장이 실패하더라도 화면에서 버튼 반응이 바로 보이도록 먼저 렌더링합니다.
  render();

  if (isFirebaseEnabled) {
    if (!auth.currentUser) {
      alert("Firebase 모드에서는 관리자 로그인 후 저장할 수 있습니다.");
      return;
    }

    try {
      await set(roomRef, currentState);
    } catch (error) {
      console.error("Firebase 저장 실패", error);
      alert("Firebase 저장에 실패했습니다. Realtime Database URL, Database 생성 여부, Rules 권한을 확인해 주세요. 화면에는 임시로 반영됐지만 새로고침하면 사라질 수 있습니다.");
    }
    return;
  }

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentState));
}

function makeInitialState() {
  const base = structuredClone(stateDefaults);
  base.cells = buildCells(base.size, base.contentType);
  return applyBingoCalculation(base, {});
}

function normalizeState(raw) {
  const contentType = BINGO_TYPES.includes(raw?.contentType) ? raw.contentType : "mission";
  const size = getValidSizeForType(contentType, Number(raw?.size));
  const cells = Array.isArray(raw?.cells) && raw.cells.length === size * size
    ? raw.cells.map((cell, index) => ({
        id: cell.id || `cell_${index}`,
        index,
        text: String(cell.text ?? `미션 ${index + 1}`),
        cleared: Boolean(cell.cleared)
      }))
    : buildCells(size, contentType);

  return applyBingoCalculation({
    ...stateDefaults,
    ...raw,
    title: String(raw?.title || "오늘의 빙고"),
    size,
    contentType,
    chickenCount: Math.max(0, Number(raw?.chickenCount || 0)),
    resetRewards: normalizeResetRewards(raw?.resetRewards),
    effectNonce: Number(raw?.effectNonce || 0),
    lastNewLines: Array.isArray(raw?.lastNewLines) ? raw.lastNewLines : [],
    drawnNumbers: normalizeDrawnNumbers(raw?.drawnNumbers),
    lastDrawnNumber: normalizeLastDrawnNumber(raw?.lastDrawnNumber),
    lastDrawMatched: Boolean(raw?.lastDrawMatched),
    cells
  }, raw?.completedLines || {});
}

function buildCells(size, contentType) {
  const validSize = getValidSizeForType(contentType, size);
  const count = validSize * validSize;
  const presetTexts = contentType === "number"
    ? makeRandomNumberTexts(count)
    : (contentType === "alphabet" || contentType === "reset")
      ? makeRandomAlphabetTexts(count)
      : null;

  return Array.from({ length: count }, (_, index) => ({
    id: `cell_${index}`,
    index,
    text: presetTexts ? presetTexts[index] : makeCellText(index, contentType),
    cleared: false
  }));
}

function makeCellText(index, contentType) {
  if (contentType === "number") return String(index + 1);
  if (contentType === "alphabet") return String.fromCharCode(65 + (index % 26));
  if (contentType === "reset") return makeRandomAlphabetTexts(25)[index] || "A";
  return `미션 ${index + 1}`;
}

function makeRandomNumberTexts(count) {
  return shuffleArray(Array.from({ length: 100 }, (_, index) => String(index + 1))).slice(0, count);
}

function makeRandomAlphabetTexts(count) {
  return shuffleArray(Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))).slice(0, count);
}

function excelColumnName(number) {
  let name = "";
  while (number > 0) {
    const mod = (number - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    number = Math.floor((number - mod) / 26);
  }
  return name;
}

function applyBingoCalculation(draft, previousCompletedLines) {
  const completedLines = computeCompletedLines(draft.cells, draft.size);
  const newLines = Object.keys(completedLines).filter((lineId) => !previousCompletedLines[lineId]);

  draft.completedLines = completedLines;
  draft.bingoCount = Object.keys(completedLines).length;

  if (newLines.length > 0) {
    draft.lastNewLines = newLines;
    draft.effectNonce = Number(draft.effectNonce || 0) + 1;
  } else {
    draft.lastNewLines = [];
  }

  return draft;
}

function computeCompletedLines(cells, size) {
  const completed = {};
  const isCleared = (index) => Boolean(cells[index]?.cleared);

  for (let row = 0; row < size; row += 1) {
    const indexes = Array.from({ length: size }, (_, col) => row * size + col);
    if (indexes.every(isCleared)) {
      completed[`row_${row}`] = { id: `row_${row}`, type: "row", index: row, cells: indexes };
    }
  }

  for (let col = 0; col < size; col += 1) {
    const indexes = Array.from({ length: size }, (_, row) => row * size + col);
    if (indexes.every(isCleared)) {
      completed[`col_${col}`] = { id: `col_${col}`, type: "col", index: col, cells: indexes };
    }
  }

  const diagA = Array.from({ length: size }, (_, index) => index * size + index);
  if (diagA.every(isCleared)) {
    completed.diag_0 = { id: "diag_0", type: "diag", index: 0, cells: diagA };
  }

  const diagB = Array.from({ length: size }, (_, index) => index * size + (size - 1 - index));
  if (diagB.every(isCleared)) {
    completed.diag_1 = { id: "diag_1", type: "diag", index: 1, cells: diagB };
  }

  return completed;
}

function getLineCoords(line, size) {
  const gap = 3;
  const step = 100 / size;

  if (line.type === "row") {
    const y = step * (line.index + 0.5);
    return { x1: gap, y1: y, x2: 100 - gap, y2: y };
  }

  if (line.type === "col") {
    const x = step * (line.index + 0.5);
    return { x1: x, y1: gap, x2: x, y2: 100 - gap };
  }

  if (line.id === "diag_0") return { x1: gap, y1: gap, x2: 100 - gap, y2: 100 - gap };
  return { x1: 100 - gap, y1: gap, x2: gap, y2: 100 - gap };
}

function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getInitialObsScale() {
  const params = new URLSearchParams(location.search);
  const fromQuery = Number(params.get("scale"));
  const fromStorage = Number(localStorage.getItem(OBS_SCALE_STORAGE_KEY));
  const value = Number.isFinite(fromQuery) && fromQuery > 0 ? fromQuery : fromStorage;
  return normalizeObsScale(value || 1);
}

function normalizeObsScale(value) {
  const allowed = [1, 0.8, 0.67, 0.5];
  const number = Number(value);
  return allowed.find((scale) => Math.abs(scale - number) < 0.01) || 1;
}

function applyObsScale(value) {
  obsScale = normalizeObsScale(value);
  document.documentElement.style.setProperty("--obs-scale", String(obsScale));
  els.obsScaleButtons?.forEach((button) => {
    const scale = Number(button.dataset.obsScale || 1);
    button.classList.toggle("active", Math.abs(scale - obsScale) < 0.01);
  });
}

function setLoginStatus(text, mode) {
  els.loginStatus.textContent = text;
  els.loginStatus.classList.remove("ok", "warn");
  if (mode) els.loginStatus.classList.add(mode);
}
