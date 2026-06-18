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

const ROOMS_PATH = "bingoRooms";
const ROOM_OPTIONS = [
  { id: "room1", label: "1번 방" },
  { id: "room2", label: "2번 방" },
  { id: "room3", label: "3번 방" },
  { id: "special", label: "전용방" }
];
const ROOM_IDS = ROOM_OPTIONS.map((room) => room.id);
const ROOM_LABELS = Object.fromEntries(ROOM_OPTIONS.map((room) => [room.id, room.label]));
const MASTER_ROOM_ADMIN_CODE = "1234";
const LOCAL_STORAGE_KEY_PREFIX = "suweet-bingo-room-state-";
const ROOM_SESSION_PREFIX = "suweet-bingo-room-access-";
const OBS_SCALE_STORAGE_KEY = "bkg-bingo-obs-scale";
const LOCAL_ADMIN_PIN = "1234";
const ADMIN_EMAIL_DOMAIN = "@suweet.com";
const BINGO_TYPES = ["mission", "number", "alphabet", "reset"];
const NUMBER_BINGO_SIZES = [5, 7, 10];


const stateDefaults = {
  roomId: "",
  roomName: "",
  accessCode: "",
  createdAt: 0,
  updatedAt: 0,
  title: "오늘의 빙고",
  size: 5,
  contentType: "mission",
  chickenCount: 0,
  resetRewards: {
    one: 0,
    line: 0,
    all: 0
  },
  bountyNumbers: [],
  bounties: {},
  memoText: "",
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
  homeScreen: $("#homeScreen"),
  roomCards: $("#roomCards"),
  roomGateModal: $("#roomGateModal"),
  roomGateInput: $("#roomGateInput"),
  roomGateEnterBtn: $("#roomGateEnterBtn"),
  roomGateHomeBtn: $("#roomGateHomeBtn"),
  roomGateMessage: $("#roomGateMessage"),
  roomInfoBox: $("#roomInfoBox"),
  currentRoomName: $("#currentRoomName"),
  currentRoomCode: $("#currentRoomCode"),
  copyRoomCodeBtn: $("#copyRoomCodeBtn"),
  leaveRoomBtn: $("#leaveRoomBtn"),
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
  bountyPanel: $("#bountyPanel"),
  bountyNumberInput: $("#bountyNumberInput"),
  bountyAmountInput: $("#bountyAmountInput"),
  bountyAddBtn: $("#bountyAddBtn"),
  bountyClearBtn: $("#bountyClearBtn"),
  bountyList: $("#bountyList"),
  bountyPreview: $("#bountyPreview"),
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
  editModePanel: $("#editModePanel"),
  editModeToggleBtn: $("#editModeToggleBtn"),
  editModeStatus: $("#editModeStatus"),
  editModeHelp: $("#editModeHelp"),
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
  obsScaleButtons: $$(`[data-obs-scale]`),
  memoOpenBtn: $("#memoOpenBtn"),
  memoModal: $("#memoModal"),
  memoCloseBtn: $("#memoCloseBtn"),
  memoCancelBtn: $("#memoCancelBtn"),
  memoText: $("#memoText"),
  memoSaveBtn: $("#memoSaveBtn"),
  memoClearBtn: $("#memoClearBtn"),
  memoSaveStatus: $("#memoSaveStatus"),
  cellEditModal: $("#cellEditModal"),
  cellEditCloseBtn: $("#cellEditCloseBtn"),
  cellEditCancelBtn: $("#cellEditCancelBtn"),
  cellEditSaveBtn: $("#cellEditSaveBtn"),
  cellEditInput: $("#cellEditInput"),
  cellEditCurrent: $("#cellEditCurrent"),
  cellEditHelpText: $("#cellEditHelpText")
};

const urlParams = new URLSearchParams(location.search);
let activeRoomId = normalizeRoomId(urlParams.get("room"));
let currentState = makeInitialState(activeRoomId);
let roomSummaries = {};
let firebaseApp = null;
let db = null;
let auth = null;
let roomsRef = null;
let roomRef = null;
let isFirebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId);
let isAdmin = false;
let activeView = urlParams.get("view") || "public";
let lastRenderedEffectNonce = 0;
let titleSaveTimer = null;
let cellSaveTimers = new Map();
let obsScale = getInitialObsScale();
let isEditMode = false;
let editingCellIndex = null;

if (!["public", "obs"].includes(activeView)) activeView = "public";
if (!activeRoomId) activeView = "public";

init();

async function init() {
  setupView();
  bindEvents();
  setupFirebaseIfAvailable();
  await loadInitialState();
  render();
}

function setupView() {
  const isHome = !activeRoomId;
  document.body.classList.toggle("view-home", isHome);
  document.body.classList.add(`view-${activeView}`);

  if (els.homeScreen) els.homeScreen.hidden = !isHome;
  const layout = document.querySelector(".layout");
  if (layout) layout.hidden = isHome;

  $$('[data-view-link]').forEach((link) => {
    const viewName = link.dataset.viewLink;
    link.classList.toggle("active", !isHome && viewName === activeView);
    if (!isHome && activeRoomId) {
      link.href = `?room=${encodeURIComponent(activeRoomId)}&view=${encodeURIComponent(viewName)}`;
    } else {
      link.href = "#";
    }
  });

  if (els.memoOpenBtn) els.memoOpenBtn.hidden = isHome || activeView === "obs";

  if (isHome) {
    if (els.adminPanel) els.adminPanel.hidden = true;
    if (els.adminToggleRow) els.adminToggleRow.hidden = true;
    if (els.cellEditorHelp) els.cellEditorHelp.hidden = true;
    if (els.obsScalePanel) els.obsScalePanel.hidden = true;
    if (els.pageTitle) els.pageTitle.textContent = "빙고 방 선택";
    return;
  }

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
    if (els.localLoginBox) els.localLoginBox.hidden = true;
    if (els.firebaseLoginBox) els.firebaseLoginBox.hidden = true;
    if (els.roomInfoBox) els.roomInfoBox.hidden = !activeRoomId;
    setLoginStatus(activeRoomId ? "방 코드 필요" : "로컬 모드", "warn");
    return;
  }

  firebaseApp = initializeApp(firebaseConfig);
  db = getDatabase(firebaseApp);
  auth = getAuth(firebaseApp);
  roomsRef = ref(db, ROOMS_PATH);
  if (activeRoomId) roomRef = ref(db, `${ROOMS_PATH}/${activeRoomId}`);

  if (els.firebaseLoginBox) els.firebaseLoginBox.hidden = true;
  if (els.localLoginBox) els.localLoginBox.hidden = true;
  if (els.roomInfoBox) els.roomInfoBox.hidden = !activeRoomId;

  onValue(roomsRef, (snapshot) => {
    roomSummaries = snapshot.exists() ? snapshot.val() : {};
    renderRoomCards();
  });

  if (!activeRoomId || !roomRef) return;

  onValue(roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      alert("아직 생성되지 않은 방입니다. 방 선택 화면으로 이동합니다.");
      location.href = "./";
      return;
    }
    currentState = normalizeState(snapshot.val());
    syncRoomAccessFromQuery();
    updateRoomAccessState();
    render();
  }, (error) => {
    console.error("Firebase 실시간 수신 실패", error);
    setLoginStatus("DB 연결 오류", "warn");
  });
}

async function loadInitialState() {
  if (!activeRoomId) {
    currentState = makeInitialState();
    renderRoomCards();
    return;
  }

  if (isFirebaseEnabled) {
    try {
      const snapshot = await get(roomRef);
      if (snapshot.exists()) {
        currentState = normalizeState(snapshot.val());
        syncRoomAccessFromQuery();
      } else {
        currentState = makeInitialState(activeRoomId);
      }
      updateRoomAccessState();
    } catch (error) {
      console.error("Firebase DB 초기 불러오기 실패", error);
      currentState = makeInitialState(activeRoomId);
      setLoginStatus("DB 연결 오류", "warn");
    }
    return;
  }

  const saved = localStorage.getItem(getLocalStorageKey(activeRoomId));
  currentState = saved ? normalizeState(JSON.parse(saved)) : makeInitialState(activeRoomId);
  syncRoomAccessFromQuery();
  updateRoomAccessState();
}


function normalizeRoomId(value) {
  const roomId = String(value || "").trim();
  return ROOM_IDS.includes(roomId) ? roomId : null;
}

function getRoomLabel(roomId) {
  return ROOM_LABELS[roomId] || "빙고 방";
}

function getLocalStorageKey(roomId = activeRoomId) {
  return `${LOCAL_STORAGE_KEY_PREFIX}${roomId || "main"}`;
}

function getRoomSessionKey(roomId = activeRoomId) {
  return `${ROOM_SESSION_PREFIX}${roomId || "main"}`;
}

function generateRoomCode() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

function getStoredRoomCode(roomId = activeRoomId) {
  return sessionStorage.getItem(getRoomSessionKey(roomId)) || localStorage.getItem(getRoomSessionKey(roomId)) || "";
}

function storeRoomCode(roomId, code) {
  sessionStorage.setItem(getRoomSessionKey(roomId), String(code));
}

function clearRoomCode(roomId = activeRoomId) {
  sessionStorage.removeItem(getRoomSessionKey(roomId));
  localStorage.removeItem(getRoomSessionKey(roomId));
}

function isRoomUnlocked() {
  if (!activeRoomId) return false;
  const code = String(currentState.accessCode || "");
  return Boolean(code && getStoredRoomCode(activeRoomId) === code);
}

function syncRoomAccessFromQuery() {
  if (!activeRoomId) return;
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  if (code && String(code) === String(currentState.accessCode || "")) {
    storeRoomCode(activeRoomId, code);
    params.delete("code");
    const nextQuery = params.toString();
    history.replaceState(null, "", `${location.pathname}${nextQuery ? `?${nextQuery}` : ""}`);
  }
}

function updateRoomAccessState() {
  isAdmin = isRoomUnlocked();
  if (!isAdmin) {
    isEditMode = false;
    closeCellEditModal();
  }
  setLoginStatus(isAdmin ? "방 입장 완료" : "입장 코드 필요", isAdmin ? "ok" : "warn");
  renderRoomGate();
}

function renderRoomGate() {
  if (!els.roomGateModal || !activeRoomId || activeView === "obs") {
    if (els.roomGateModal) els.roomGateModal.hidden = true;
    return;
  }
  els.roomGateModal.hidden = isAdmin;
  if (!isAdmin) {
    if (els.roomGateMessage) els.roomGateMessage.textContent = `${getRoomLabel(activeRoomId)} 입장 코드를 입력해 주세요.`;
    setTimeout(() => els.roomGateInput?.focus(), 0);
  }
}

function enterCurrentRoomByCode() {
  if (!activeRoomId) return;
  const code = String(els.roomGateInput?.value || "").trim();
  if (!/^\d{5}$/.test(code)) {
    alert("5자리 숫자 코드를 입력해 주세요.");
    return;
  }
  if (code !== String(currentState.accessCode || "")) {
    alert("입장 코드가 맞지 않습니다.");
    return;
  }
  storeRoomCode(activeRoomId, code);
  updateRoomAccessState();
  render();
}

async function createOrResetRoom(roomId) {
  const room = ROOM_OPTIONS.find((item) => item.id === roomId);
  if (!room) return;

  const alreadyExists = Boolean(roomSummaries?.[roomId]?.accessCode);
  const adminCode = prompt(`${room.label}을 ${alreadyExists ? "초기화/재생성" : "생성"}하려면 관리자 코드를 입력해 주세요.`);
  if (adminCode == null) return;
  if (adminCode !== MASTER_ROOM_ADMIN_CODE) {
    alert("관리자 코드가 맞지 않습니다.");
    return;
  }
  if (alreadyExists && !confirm(`${room.label}이 이미 있습니다. 새 입장 코드로 초기화할까요? 기존 빙고 데이터가 초기화됩니다.`)) return;

  const code = generateRoomCode();
  const fresh = makeInitialState(roomId);
  fresh.roomId = roomId;
  fresh.roomName = room.label;
  fresh.accessCode = code;
  fresh.createdAt = Date.now();
  fresh.updatedAt = Date.now();

  try {
    if (isFirebaseEnabled && db) {
      await set(ref(db, `${ROOMS_PATH}/${roomId}`), prepareStateForStorage(fresh));
    } else {
      localStorage.setItem(getLocalStorageKey(roomId), JSON.stringify(fresh));
    }
    storeRoomCode(roomId, code);
    alert(`${room.label} 생성 완료!\n입장 코드: ${code}\n이 코드를 접속할 인원에게 알려주세요.`);
    location.href = `?room=${encodeURIComponent(roomId)}&view=public`;
  } catch (error) {
    console.error("방 생성 실패", error);
    alert("방 생성에 실패했습니다. Firebase Rules 또는 DB 연결을 확인해 주세요.");
  }
}

function promptEnterRoom(roomId, view = "public") {
  const room = roomSummaries?.[roomId];
  const label = getRoomLabel(roomId);
  if (!room?.accessCode) {
    alert("아직 생성되지 않은 방입니다. 먼저 방 생성을 해주세요.");
    return;
  }
  const cached = getStoredRoomCode(roomId);
  if (cached && cached === String(room.accessCode)) {
    location.href = `?room=${encodeURIComponent(roomId)}&view=${encodeURIComponent(view)}`;
    return;
  }
  const code = prompt(`${label} 입장 코드 5자리를 입력해 주세요.`);
  if (code == null) return;
  if (String(code).trim() !== String(room.accessCode)) {
    alert("입장 코드가 맞지 않습니다.");
    return;
  }
  storeRoomCode(roomId, String(code).trim());
  location.href = `?room=${encodeURIComponent(roomId)}&view=${encodeURIComponent(view)}`;
}

function renderRoomCards() {
  if (!els.roomCards) return;
  els.roomCards.innerHTML = "";
  ROOM_OPTIONS.forEach((room) => {
    const data = roomSummaries?.[room.id] || {};
    const exists = Boolean(data.accessCode);
    const card = document.createElement("article");
    card.className = `room-card ${exists ? "is-created" : "is-empty"}`;

    const info = document.createElement("div");
    info.className = "room-card-info";
    const typeLabel = exists ? getContentTypeLabel(data.contentType) : "비어 있음";
    info.innerHTML = `
      <p class="eyebrow">${exists ? "READY" : "EMPTY"}</p>
      <h3>${escapeHtml(room.label)}</h3>
      <p>${exists ? `${escapeHtml(data.title || "오늘의 빙고")} · ${typeLabel}` : "관리자 코드로 방을 생성하세요."}</p>
    `;

    const actions = document.createElement("div");
    actions.className = "room-card-actions";

    const createBtn = document.createElement("button");
    createBtn.type = "button";
    createBtn.className = exists ? "ghost-btn" : "primary-btn";
    createBtn.textContent = exists ? "초기화/코드 재발급" : "방 생성";
    createBtn.addEventListener("click", () => createOrResetRoom(room.id));

    const enterBtn = document.createElement("button");
    enterBtn.type = "button";
    enterBtn.className = "primary-btn";
    enterBtn.textContent = "입장";
    enterBtn.disabled = !exists;
    enterBtn.addEventListener("click", () => promptEnterRoom(room.id, "public"));

    const obsBtn = document.createElement("button");
    obsBtn.type = "button";
    obsBtn.className = "ghost-btn";
    obsBtn.textContent = "송출용";
    obsBtn.disabled = !exists;
    obsBtn.addEventListener("click", () => promptEnterRoom(room.id, "obs"));

    actions.append(createBtn, enterBtn, obsBtn);
    card.append(info, actions);
    els.roomCards.append(card);
  });
}

function getContentTypeLabel(type) {
  return ({ mission: "미션", number: "숫자", alphabet: "알파벳", reset: "리셋" })[type] || "미션";
}

function bindEvents() {
  els.roomGateEnterBtn?.addEventListener("click", enterCurrentRoomByCode);
  els.roomGateInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      enterCurrentRoomByCode();
    }
  });
  els.roomGateHomeBtn?.addEventListener("click", () => {
    location.href = "./";
  });
  els.copyRoomCodeBtn?.addEventListener("click", async () => {
    const code = currentState.accessCode || "";
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      alert("입장 코드를 복사했어요.");
    } catch {
      prompt("입장 코드를 복사하세요.", code);
    }
  });
  els.leaveRoomBtn?.addEventListener("click", () => {
    clearRoomCode(activeRoomId);
    location.href = "./";
  });

  els.adminToggle?.addEventListener("click", () => {
    const collapsed = document.body.classList.toggle("admin-collapsed");
    els.adminToggle.textContent = collapsed ? "관리자 패널 열기" : "관리자 패널 접기";
  });

  els.memoOpenBtn?.addEventListener("click", openMemoModal);
  els.memoCloseBtn?.addEventListener("click", closeMemoModal);
  els.memoCancelBtn?.addEventListener("click", closeMemoModal);
  els.memoModal?.addEventListener("click", (event) => {
    if (event.target?.hasAttribute?.("data-memo-close")) closeMemoModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (els.cellEditModal && !els.cellEditModal.hidden) closeCellEditModal();
      if (els.memoModal && !els.memoModal.hidden) closeMemoModal();
    }

    if (event.key === "Enter" && els.cellEditModal && !els.cellEditModal.hidden && document.activeElement === els.cellEditInput) {
      event.preventDefault();
      saveCellEdit();
    }
  });

  els.editModeToggleBtn?.addEventListener("click", () => {
    if (!isAdmin) {
      alert("관리자 로그인 후 수정 모드를 사용할 수 있어요.");
      return;
    }
    isEditMode = !isEditMode;
    if (!isEditMode) closeCellEditModal();
    renderEditModeState();
    renderBoard();
  });

  els.cellEditCloseBtn?.addEventListener("click", closeCellEditModal);
  els.cellEditCancelBtn?.addEventListener("click", closeCellEditModal);
  els.cellEditModal?.addEventListener("click", (event) => {
    if (event.target?.hasAttribute?.("data-cell-edit-close")) closeCellEditModal();
  });
  els.cellEditSaveBtn?.addEventListener("click", saveCellEdit);

  els.memoText?.addEventListener("input", () => {
    if (!isAdmin) return;
    if (els.memoSaveStatus) els.memoSaveStatus.textContent = "저장하지 않은 변경사항이 있어요.";
  });

  els.memoSaveBtn?.addEventListener("click", () => {
    if (!isAdmin) {
      alert("관리자로 로그인해야 메모를 저장할 수 있어요.");
      return;
    }
    commitState((draft) => {
      draft.memoText = els.memoText?.value || "";
    });
    if (els.memoSaveStatus) els.memoSaveStatus.textContent = "메모가 저장됐어요.";
  });

  els.memoClearBtn?.addEventListener("click", () => {
    if (!isAdmin) {
      alert("관리자로 로그인해야 메모를 비울 수 있어요.");
      return;
    }
    if (!confirm("메모 내용을 비울까요?")) return;
    commitState((draft) => {
      draft.memoText = "";
    });
    if (els.memoText) els.memoText.value = "";
    if (els.memoSaveStatus) els.memoSaveStatus.textContent = "메모가 비워졌어요.";
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
    isEditMode = false;
    closeCellEditModal();
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
    updateBountyPanelState();
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

  els.bountyAddBtn?.addEventListener("click", addOrUpdateBounty);

  els.bountyClearBtn?.addEventListener("click", () => {
    if (!confirm("현상금을 모두 비울까요?")) return;
    commitState((draft) => {
      draft.bounties = {};
      draft.bountyNumbers = [];
    });
  });

  [els.bountyNumberInput, els.bountyAmountInput].forEach((input) => {
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addOrUpdateBounty();
      }
    });
  });

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
      const fresh = makeInitialState(activeRoomId);
      fresh.accessCode = draft.accessCode;
      fresh.roomId = draft.roomId || activeRoomId || "";
      fresh.roomName = draft.roomName || getRoomLabel(activeRoomId);
      fresh.createdAt = draft.createdAt || Date.now();
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


function openMemoModal() {
  if (!els.memoModal) return;
  els.memoModal.hidden = false;
  document.body.classList.add("memo-open");
  renderMemoState(true);
  setTimeout(() => els.memoText?.focus(), 0);
}

function closeMemoModal() {
  if (!els.memoModal) return;
  els.memoModal.hidden = true;
  document.body.classList.remove("memo-open");
}

function renderMemoState(forceSync = false) {
  if (!els.memoText) return;
  const memo = String(currentState.memoText || "");
  const isEditingMemo = document.activeElement === els.memoText && !forceSync;
  if (!isEditingMemo) els.memoText.value = memo;
  els.memoText.readOnly = !isAdmin;
  if (els.memoSaveBtn) els.memoSaveBtn.disabled = !isAdmin;
  if (els.memoClearBtn) els.memoClearBtn.disabled = !isAdmin || !memo.trim();
  if (els.memoSaveStatus) {
    els.memoSaveStatus.textContent = isAdmin
      ? (memo.trim() ? "메모가 Firebase에 저장되어 있어요." : "저장된 메모가 없습니다.")
      : "보기 전용입니다. 저장하려면 관리자 로그인이 필요해요.";
  }
}

function renderEditModeState() {
  if (!isAdmin || activeView === "obs") {
    isEditMode = false;
    closeCellEditModal();
  }

  document.body.classList.toggle("cell-edit-mode", isEditMode);

  if (els.editModeStatus) {
    els.editModeStatus.textContent = isEditMode ? "ON" : "OFF";
    els.editModeStatus.classList.toggle("ok", isEditMode);
    els.editModeStatus.classList.toggle("warn", !isEditMode);
  }

  if (els.editModeToggleBtn) {
    els.editModeToggleBtn.textContent = isEditMode ? "수정 모드 끄기" : "수정 모드 켜기";
    els.editModeToggleBtn.classList.toggle("is-on", isEditMode);
    els.editModeToggleBtn.disabled = !isAdmin || activeView === "obs";
  }

  if (els.editModeHelp) {
    els.editModeHelp.textContent = isEditMode
      ? "수정 모드 ON: 왼쪽 빙고칸을 클릭하면 내용 수정창이 열립니다."
      : "수정 모드를 켜면 왼쪽 빙고칸을 클릭해서 내용을 직접 바꿀 수 있어요.";
  }

  if (els.cellEditorHelp) {
    els.cellEditorHelp.textContent = isEditMode
      ? "현재 칸 수정 모드입니다. 칸을 클릭하면 내용을 바꿀 수 있어요."
      : "관리자로 로그인하면 왼쪽 빙고칸을 클릭해서 바로 지움/복구할 수 있어요.";
  }
}

function openCellEditModal(index) {
  if (!isAdmin) {
    alert("관리자 로그인 후 수정할 수 있습니다.");
    return;
  }

  const cell = currentState.cells[index];
  if (!cell || !els.cellEditModal) return;

  editingCellIndex = index;
  if (els.cellEditCurrent) els.cellEditCurrent.textContent = cell.text || "-";
  if (els.cellEditInput) {
    els.cellEditInput.value = cell.text || "";
    els.cellEditInput.maxLength = currentState.contentType === "mission" ? 60 : 3;
    els.cellEditInput.inputMode = currentState.contentType === "number" ? "numeric" : "text";
  }
  if (els.cellEditHelpText) els.cellEditHelpText.textContent = getCellEditHelpText();

  els.cellEditModal.hidden = false;
  document.body.classList.add("memo-open");
  setTimeout(() => {
    els.cellEditInput?.focus();
    els.cellEditInput?.select();
  }, 0);
}

function closeCellEditModal() {
  if (!els.cellEditModal) return;
  els.cellEditModal.hidden = true;
  editingCellIndex = null;
  if (!els.memoModal || els.memoModal.hidden) document.body.classList.remove("memo-open");
}

function saveCellEdit() {
  if (editingCellIndex == null) return;
  if (!isAdmin) {
    alert("관리자 로그인 후 수정할 수 있습니다.");
    return;
  }

  const result = normalizeEditedCellText(els.cellEditInput?.value || "", currentState.contentType);
  if (!result.ok) {
    alert(result.message);
    return;
  }

  const duplicate = currentState.cells.some((cell, index) => {
    if (index === editingCellIndex) return false;
    return String(cell.text).trim().toUpperCase() === result.value.toUpperCase();
  });

  if (duplicate && ["number", "alphabet", "reset"].includes(currentState.contentType)) {
    const proceed = confirm("이미 같은 값이 빙고판에 있습니다. 그래도 수정할까요?");
    if (!proceed) return;
  }

  const indexToSave = editingCellIndex;
  commitState((draft) => {
    if (!draft.cells[indexToSave]) return;
    draft.cells[indexToSave].text = result.value;
  });
  closeCellEditModal();
}

function getCellEditHelpText() {
  if (currentState.contentType === "number") return "숫자 빙고는 1~100 숫자만 입력할 수 있어요.";
  if (currentState.contentType === "alphabet" || currentState.contentType === "reset") return "알파벳/리셋 빙고는 A~Z 한 글자만 입력할 수 있어요.";
  return "미션 빙고는 자유롭게 내용을 입력할 수 있어요. 긴 문구는 자동으로 줄바꿈됩니다.";
}

function normalizeEditedCellText(value, contentType) {
  const raw = String(value || "").trim();

  if (contentType === "number") {
    const number = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isInteger(number) || number < 1 || number > 100) {
      return { ok: false, message: "숫자 빙고는 1~100 사이의 숫자만 입력할 수 있어요." };
    }
    return { ok: true, value: String(number) };
  }

  if (contentType === "alphabet" || contentType === "reset") {
    const letter = raw.toUpperCase();
    if (!/^[A-Z]$/.test(letter)) {
      return { ok: false, message: "알파벳/리셋 빙고는 A~Z 한 글자만 입력할 수 있어요." };
    }
    return { ok: true, value: letter };
  }

  if (!raw) return { ok: false, message: "빈 내용으로는 수정할 수 없어요." };
  return { ok: true, value: raw };
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

function updateBountyPanelState() {
  const bounties = normalizeBounties(currentState.bounties, currentState.bountyNumbers);
  const entries = sortBountyEntries(Object.entries(bounties));

  if (els.bountyPanel) {
    els.bountyPanel.classList.remove("is-muted");
  }

  [els.bountyNumberInput, els.bountyAmountInput].forEach((input) => {
    if (input) input.disabled = !isAdmin || activeView === "obs";
  });

  if (els.bountyAddBtn) els.bountyAddBtn.disabled = !isAdmin || activeView === "obs";
  if (els.bountyClearBtn) els.bountyClearBtn.disabled = !isAdmin || activeView === "obs" || entries.length === 0;
  if (els.bountyPreview) els.bountyPreview.textContent = String(entries.length);

  if (els.bountyList) {
    els.bountyList.innerHTML = "";

    if (entries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "bounty-empty";
      empty.textContent = "등록된 현상금이 없습니다.";
      els.bountyList.append(empty);
    } else {
      entries.forEach(([target, amount]) => {
        const item = document.createElement("div");
        item.className = "bounty-item";

        const label = document.createElement("span");
        label.innerHTML = `<strong>${escapeHtml(target)}</strong> <b>${formatBountyAmount(amount)}</b>개`;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "bounty-remove";
        removeBtn.textContent = "삭제";
        removeBtn.disabled = !isAdmin || activeView === "obs";
        removeBtn.addEventListener("click", () => removeBounty(target));

        item.append(label, removeBtn);
        els.bountyList.append(item);
      });
    }
  }
}

function addOrUpdateBounty() {
  const target = normalizeBountyTarget(els.bountyNumberInput?.value || "");
  const amount = Number(els.bountyAmountInput?.value || 0);

  if (!target) {
    alert("현상금을 걸 대상 칸 내용을 입력해 주세요.");
    els.bountyNumberInput?.focus();
    return;
  }

  if (!Number.isInteger(amount) || amount < 0) {
    alert("현상금 개수는 0 이상의 정수로 입력해 주세요.");
    els.bountyAmountInput?.focus();
    return;
  }

  const existsInBoard = currentState.cells.some((cell) => normalizeBountyTarget(cell.text) === target);
  if (!existsInBoard) {
    const proceed = confirm("현재 빙고판에 같은 내용의 칸이 없습니다. 그래도 현상금으로 등록할까요?");
    if (!proceed) return;
  }

  commitState((draft) => {
    const next = normalizeBounties(draft.bounties, draft.bountyNumbers);
    if (amount === 0) {
      delete next[target];
    } else {
      next[target] = amount;
    }
    draft.bounties = next;
    draft.bountyNumbers = Object.keys(next);
  });

  if (els.bountyNumberInput) els.bountyNumberInput.value = "";
  if (els.bountyAmountInput) els.bountyAmountInput.value = "";
  els.bountyNumberInput?.focus();
}

function removeBounty(target) {
  commitState((draft) => {
    const normalizedTarget = normalizeBountyTarget(target);
    const next = normalizeBounties(draft.bounties, draft.bountyNumbers);
    delete next[normalizedTarget];
    draft.bounties = next;
    draft.bountyNumbers = Object.keys(next);
  });
}

function normalizeBounties(value, legacyNumbers = []) {
  const result = {};

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      const target = normalizeBountyTarget(entry?.target ?? entry?.number ?? entry?.text ?? "");
      const amount = Number(entry?.amount ?? entry?.count ?? 0);
      if (target && Number.isInteger(amount) && amount > 0) result[target] = amount;
    });
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([rawKey, rawValue]) => {
      let target = "";
      let amount = 0;

      if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
        target = normalizeBountyTarget(rawValue.target ?? rawValue.number ?? rawValue.text ?? decodeBountyStorageKey(rawKey));
        amount = Number(rawValue.amount ?? rawValue.count ?? 0);
      } else {
        target = normalizeBountyTarget(decodeBountyStorageKey(rawKey));
        amount = Number(rawValue);
      }

      if (target && Number.isInteger(amount) && amount > 0) result[target] = amount;
    });
  }

  normalizeBountyNumbers(legacyNumbers).forEach((target) => {
    if (!result[target]) result[target] = 1;
  });

  return Object.fromEntries(sortBountyEntries(Object.entries(result)));
}

function normalizeBountyNumbers(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(normalizeBounties(value));
  }

  const source = Array.isArray(value) ? value.join("\n") : String(value || "");
  return Array.from(new Set(source
    .split(/[\n,]+/g)
    .map((target) => normalizeBountyTarget(target))
    .filter(Boolean)));
}


function normalizeBountyTarget(value) {
  const raw = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return "";

  if (/^\d+$/.test(raw)) {
    return String(Number(raw));
  }

  if (/^[a-z]$/i.test(raw)) {
    return raw.toUpperCase();
  }

  return raw;
}

function sortBountyEntries(entries) {
  return [...entries].sort(([a], [b]) => {
    const aNumber = /^\d+$/.test(a) ? Number(a) : null;
    const bNumber = /^\d+$/.test(b) ? Number(b) : null;

    if (aNumber != null && bNumber != null) return aNumber - bNumber;
    if (aNumber != null) return -1;
    if (bNumber != null) return 1;
    return String(a).localeCompare(String(b), "ko-KR", { numeric: true });
  });
}

function encodeBountyStorageKey(target) {
  const normalized = normalizeBountyTarget(target);
  return encodeURIComponent(normalized)
    .replace(/\./g, "%2E")
    .replace(/!/g, "%21")
    .replace(/~/g, "%7E")
    .replace(/\*/g, "%2A")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

function decodeBountyStorageKey(key) {
  const value = String(key ?? "");
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function encodeBountiesForStorage(value) {
  const normalized = normalizeBounties(value);
  const result = {};
  sortBountyEntries(Object.entries(normalized)).forEach(([target, amount]) => {
    const key = encodeBountyStorageKey(target);
    if (!key) return;
    result[key] = {
      target,
      amount: Number(amount)
    };
  });
  return result;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatBountyAmount(value) {
  const number = Math.max(0, Number(value || 0));
  return Number.isFinite(number) ? number.toLocaleString("ko-KR") : "0";
}

function getBountyAmountClass(value) {
  const length = String(Math.max(0, Number(value || 0))).length;
  if (length <= 3) return "bounty-amount-short";
  if (length <= 5) return "bounty-amount-medium";
  return "bounty-amount-long";
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
  if (!activeRoomId) {
    renderRoomCards();
    if (els.pageTitle) els.pageTitle.textContent = "빙고 방 선택";
    return;
  }

  currentState = normalizeState(currentState);
  updateRoomAccessState();

  if (els.pageTitle) els.pageTitle.textContent = getViewTitle();
  if (els.currentRoomName) els.currentRoomName.textContent = currentState.roomName || getRoomLabel(activeRoomId);
  if (els.currentRoomCode) els.currentRoomCode.textContent = isAdmin ? (currentState.accessCode || "-") : "입장 후 표시";
  if (els.roomInfoBox) els.roomInfoBox.hidden = false;
  if (els.boardTitle) els.boardTitle.textContent = currentState.title;
  if (els.titleInput) els.titleInput.value = currentState.title;
  if (els.typeSelect) els.typeSelect.value = currentState.contentType;
  syncSizeSelectForType(currentState.contentType, currentState.size);
  const isResetBingo = currentState.contentType === "reset";
  const isNumberBingo = currentState.contentType === "number";
  const isLetterBingo = currentState.contentType === "alphabet" || currentState.contentType === "reset";
  const resetRewards = normalizeResetRewards(currentState.resetRewards);
  document.body.classList.toggle("is-reset-bingo", isResetBingo);
  document.body.classList.toggle("is-number-bingo", isNumberBingo);
  document.body.classList.toggle("is-letter-bingo", isLetterBingo);

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
  renderMemoState();
  if (els.bingoBoard) els.bingoBoard.style.setProperty("--cell-size", currentState.size);

  renderAdminLock();
  renderEditModeState();
  updateNumberDrawControls();
  updateBountyPanelState();
  updateResetMenuAdminState();
  renderBoard();
  renderLines();
  maybePlayBingoEffect();
}

function getViewTitle() {
  const roomName = currentState.roomName || getRoomLabel(activeRoomId);
  if (activeView === "obs") return `${roomName} 송출용`;
  return roomName;
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
    els.bountyNumberInput,
    els.bountyAmountInput,
    els.bountyAddBtn,
    els.bountyClearBtn,
    els.chickenInput,
    els.chickenMinusBtn,
    els.chickenPlusBtn,
    els.resetRewardOne,
    els.resetRewardLine,
    els.resetRewardAll,
    els.bulkText,
    els.applyBulkBtn,
    els.clearBulkBtn,
    els.hardResetBtn,
    els.editModeToggleBtn
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
  const bounties = normalizeBounties(currentState.bounties, currentState.bountyNumbers);

  currentState.cells.forEach((cell, index) => {
    const cellEl = document.createElement("div");
    const numberDigitClass = currentState.contentType === "number" ? getNumberDigitClass(cell.text) : "";
    cellEl.className = `cell ${getTextLengthClass(cell.text)} ${numberDigitClass}`.trim();
    cellEl.dataset.index = String(index);
    cellEl.classList.toggle("cleared", Boolean(cell.cleared));
    cellEl.classList.toggle("line-completed", completedCellIndexes.has(index));
    const bountyTarget = normalizeBountyTarget(cell.text);
    const bountyAmount = bountyTarget ? bounties[bountyTarget] : null;
    const hasBounty = Number.isFinite(Number(bountyAmount)) && Number(bountyAmount) > 0;
    cellEl.classList.toggle("bounty", hasBounty);

    const text = document.createElement("div");
    text.className = "cell-text";
    text.textContent = cell.text;
    cellEl.append(text);

    if (hasBounty) {
      const amount = document.createElement("div");
      amount.className = `bounty-amount ${getBountyAmountClass(bountyAmount)}`;
      amount.textContent = formatBountyAmount(bountyAmount);
      cellEl.append(amount);
    }

    if (activeView !== "obs" && isAdmin) {
      cellEl.classList.add("admin-clickable");
      cellEl.classList.toggle("edit-clickable", isEditMode);
      cellEl.title = isEditMode
        ? "수정 모드: 클릭하면 내용을 바꿉니다."
        : (cell.cleared ? "클릭하면 복구됩니다." : "클릭하면 지워집니다.");
      cellEl.addEventListener("click", () => {
        if (isEditMode) {
          openCellEditModal(index);
          return;
        }
        toggleCell(index);
      });
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
    if (!roomRef) {
      alert("방이 선택되지 않아 저장할 수 없습니다.");
      return;
    }

    try {
      currentState.updatedAt = Date.now();
      await set(roomRef, prepareStateForStorage(currentState));
    } catch (error) {
      console.error("Firebase 저장 실패", error);
      alert("Firebase 저장에 실패했습니다. Realtime Database URL, Database 생성 여부, Rules 권한을 확인해 주세요. 화면에는 임시로 반영됐지만 새로고침하면 사라질 수 있습니다.");
    }
    return;
  }

  localStorage.setItem(getLocalStorageKey(activeRoomId), JSON.stringify(currentState));
}

function prepareStateForStorage(state) {
  return {
    ...state,
    roomId: state.roomId || activeRoomId || "",
    roomName: state.roomName || getRoomLabel(activeRoomId),
    accessCode: state.accessCode || currentState.accessCode || "",
    updatedAt: Date.now(),
    bounties: encodeBountiesForStorage(state.bounties),
    bountyNumbers: Object.keys(normalizeBounties(state.bounties))
  };
}

function makeInitialState(roomId = activeRoomId) {
  const base = structuredClone(stateDefaults);
  base.roomId = roomId || "";
  base.roomName = roomId ? getRoomLabel(roomId) : "";
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
    roomId: String(raw?.roomId || activeRoomId || ""),
    roomName: String(raw?.roomName || getRoomLabel(activeRoomId)),
    accessCode: String(raw?.accessCode || ""),
    createdAt: Number(raw?.createdAt || 0),
    updatedAt: Number(raw?.updatedAt || 0),
    title: String(raw?.title || "오늘의 빙고"),
    size,
    contentType,
    chickenCount: Math.max(0, Number(raw?.chickenCount || 0)),
    resetRewards: normalizeResetRewards(raw?.resetRewards),
    bounties: normalizeBounties(raw?.bounties, raw?.bountyNumbers),
    effectNonce: Number(raw?.effectNonce || 0),
    lastNewLines: Array.isArray(raw?.lastNewLines) ? raw.lastNewLines : [],
    drawnNumbers: normalizeDrawnNumbers(raw?.drawnNumbers),
    bountyNumbers: Object.keys(normalizeBounties(raw?.bounties, raw?.bountyNumbers)),
    memoText: String(raw?.memoText || ""),
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
