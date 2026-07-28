const STORAGE_KEY = "jerrychuDrawBoardGithubV3";
const PAGE_PARAMS = new URLSearchParams(location.search);
const IS_BROADCAST_VIEW = PAGE_PARAMS.get("view") === "broadcast";
const BROADCAST_LAYOUT = PAGE_PARAMS.get("layout") === "mini" ? "mini" : "full";
const BROADCAST_CHUNK_SIZE = 20;
const BROADCAST_FAST_POLL_MS = 650;
const BROADCAST_IDLE_POLL_MS = 1200;
const BROADCAST_PULSE_POLL_MS = 350;
const BROADCAST_PULSE_IDLE_MS = 900;
let broadcastPollTimer = null;
let broadcastPublishTimer = null;
let broadcastPublishing = false;
let broadcastPublishQueued = false;
let broadcastFastMode = true;
let broadcastPollRunning = false;
let broadcastMetaHash = "";
let broadcastChunkHashes = [];
let lastBroadcastRevision = "";
let lastBroadcastResultId = "";
let broadcastResultTimer = null;
let operatorResultTimer = null;
let randomStatusTimer = null;
let broadcastPulseTimer = null;
let broadcastPulseRunning = false;
let lastBroadcastPulseId = "";
const defaultSettings = {
  title:"제리츄 뽑기판", subtitle:"오늘의 행운을 뽑아보세요!", total:100, columns:10, loseText:"아쉽습니다!",
  prizes:[{rank:"1등",prize:"최고 상품",count:1,color:"#72beff"},{rank:"2등",prize:"행운 상품",count:3,color:"#9f8fff"},{rank:"3등",prize:"소소한 상품",count:6,color:"#ff88bf"}],
  sound:{enabled:true,volume:0.8,operatorEnabled:false,first:true,win:true,lose:true},
  integration:{enabled:false,execUrl:"",token:"",pollSeconds:5,bjId:"",maxDraws:100,kinds:{BALLOON_GIFTED:true,CHALLENGE_MISSION_GIFTED:true,BATTLE_MISSION_GIFTED:true},ruleMode:"ratio",ratio:{balloons:500,draws:1},ranges:[{min:500,max:999,draws:1},{min:1000,max:1999,draws:3},{min:2000,max:null,draws:7}],exacts:[{count:500,draws:1},{count:1000,draws:3},{count:2000,draws:7}]}
};
let state=loadState(); let pendingIndex=null; let pollTimer=null; let syncing=false;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function newState(){return{settings:structuredClone(defaultSettings),board:[],history:[],queue:[],importedEventIds:[],session:{active:false,startRow:1,startedAt:"",endedAt:"",sessionId:"",excludedCount:0,lastError:""},broadcast:{key:"",bjId:""},lastResult:null}}
function normalizeState(saved){const base=newState();return{settings:{...base.settings,...(saved.settings||{}),sound:{...base.settings.sound,...(saved.settings?.sound||{})},integration:{...base.settings.integration,...(saved.settings?.integration||{}),kinds:{...base.settings.integration.kinds,...(saved.settings?.integration?.kinds||{})},ratio:{...base.settings.integration.ratio,...(saved.settings?.integration?.ratio||{})},ranges:saved.settings?.integration?.ranges||base.settings.integration.ranges,exacts:saved.settings?.integration?.exacts||base.settings.integration.exacts}},board:Array.isArray(saved.board)?saved.board:[],history:Array.isArray(saved.history)?saved.history:[],queue:Array.isArray(saved.queue)?saved.queue:[],importedEventIds:Array.isArray(saved.importedEventIds)?saved.importedEventIds:[],session:{...base.session,...(saved.session||{})},broadcast:{...base.broadcast,...(saved.broadcast||{})},lastResult:saved.lastResult||null}}
function loadState(){try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));return saved?normalizeState(saved):newState()}catch{return newState()}}
function saveState(){if(!IS_BROADCAST_VIEW)localStorage.setItem(STORAGE_KEY,JSON.stringify(state));if(!IS_BROADCAST_VIEW)scheduleBroadcastPublish()}
function esc(v=""){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function formatNumber(n){return String(n)}
function shuffle(a){const c=[...a];for(let i=c.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[c[i],c[j]]=[c[j],c[i]]}return c}
function currentTarget(){return state.queue.find(q=>q.remaining>0)||null}
function buildBoard(){const s=state.settings,items=[];s.prizes.forEach((p,pi)=>{for(let i=0;i<Number(p.count);i++)items.push({type:"win",prizeIndex:pi,rank:p.rank,prize:p.prize,color:p.color,opened:false,openedAt:null,participant:""})});const loseCount=Math.max(0,Number(s.total)-items.length);for(let i=0;i<loseCount;i++)items.push({type:"lose",rank:"꽝",prize:s.loseText,color:"#9ba7b8",opened:false,openedAt:null,participant:""});state.board=shuffle(items);state.history=[];saveState();renderAll()}
function renderAll(){renderHeader();renderPrizeList();renderBoard();renderHistory();renderQueue();renderSession();renderSyncStatus();renderBroadcastTopbar();renderBroadcastPrizeStrip();renderBroadcastSidePanel();renderRandomControls()}
function renderHeader(){const total=state.board.length||Number(state.settings.total)||0,opened=state.board.filter(x=>x.opened).length,remaining=state.board.length?total-opened:0,wins=state.board.filter(x=>x.type==="win"&&!x.opened).length,progress=total?Math.round(opened/total*100):0;$("#displayTitle").textContent=state.settings.title;$("#displaySubtitle").textContent=state.settings.subtitle;$("#totalCount").textContent=total;$("#remainingCount").textContent=remaining;$("#winningRemaining").textContent=wins;$("#progressText").textContent=`${progress}%`;$("#progressBar").style.width=`${progress}%`;document.title=state.settings.title}
function renderPrizeList(){const list=$("#prizeList");list.innerHTML="";state.settings.prizes.forEach((p,i)=>{const total=Number(p.count)||0,opened=state.board.filter(x=>x.opened&&x.type==="win"&&x.prizeIndex===i).length,remaining=state.board.length?Math.max(0,total-opened):total;const el=document.createElement("div");el.className="prize-item";el.innerHTML=`<div class="prize-rank" style="--rank-color:${esc(p.color)}">${esc(p.rank)}</div><div class="prize-info"><strong>${esc(p.prize)}</strong><span>총 ${total}개</span></div><div class="prize-count">${remaining}개</div>`;list.appendChild(el)});const wt=state.settings.prizes.reduce((a,p)=>a+(Number(p.count)||0),0),lt=Math.max(0,state.settings.total-wt),lo=state.board.filter(x=>x.opened&&x.type==="lose").length,lr=state.board.length?Math.max(0,lt-lo):lt;list.insertAdjacentHTML("beforeend",`<div class="prize-item lose-summary"><div class="prize-rank" style="--rank-color:#9ba7b8">꽝</div><div class="prize-info"><strong>${esc(state.settings.loseText)}</strong><span>나머지 칸 자동 배치</span></div><div class="prize-count">${lr}개</div></div>`)}
function renderBoard(){const b=$("#drawBoard"),e=$("#boardEmpty");b.innerHTML="";if(!state.board.length){b.classList.add("hidden");e.classList.remove("hidden");return}b.classList.remove("hidden");e.classList.add("hidden");const columns=Math.max(1,Number(state.settings.columns)||10),rows=Math.max(1,Math.ceil(state.board.length/columns));b.style.setProperty("--board-columns",columns);b.style.setProperty("--board-rows",rows);state.board.forEach((item,i)=>{const btn=document.createElement("button");btn.className="draw-tile";if(item.opened){btn.classList.add("opened");btn.disabled=true;btn.style.setProperty("--tile-color",item.color||"#72beff");if(item.type==="lose")btn.classList.add("lose");const openedLabel=IS_BROADCAST_VIEW?esc(item.rank||(item.type==="lose"?"꽝":"당첨")):(item.type==="win"?`${esc(item.rank)}<br>${esc(item.prize)}`:esc(item.prize));btn.innerHTML=`<span class="tile-number">${openedLabel}</span>`}else{btn.innerHTML=`<span class="tile-number">${formatNumber(i+1)}</span>`;if(!IS_BROADCAST_VIEW)btn.addEventListener("click",()=>drawDirect(i));else btn.disabled=true}b.appendChild(btn)})}
function renderRandomControls(){const remaining=state.board.filter(x=>!x.opened).length;[["#randomDraw1Btn",1],["#randomDraw5Btn",5],["#randomDraw11Btn",11]].forEach(([selector,count])=>{const btn=$(selector);if(!btn)return;btn.disabled=!state.board.length||remaining<1;btn.title=remaining<count?`남은 ${remaining}개만 추첨됩니다.`:`남은 칸에서 ${count}개를 랜덤 추첨합니다.`})}
function renderHistory(){const h=$("#recentHistory");if(!state.history.length){h.innerHTML=`<div class="empty-state">아직 뽑기 기록이 없어요.</div>`;return}h.innerHTML=state.history.slice().reverse().slice(0,20).map(x=>`<div class="history-item"><strong>${esc(x.participant)} · ${esc(x.result)}</strong><span>${esc(x.number)}번 · ${esc(x.time)}</span></div>`).join("")}
function renderQueue(){state.queue=state.queue.filter(q=>q.remaining>0);const cur=currentTarget(),card=$("#currentTargetCard"),actions=$("#currentTargetActions"),list=$("#drawQueueList");$("#queueCountBadge").textContent=`${state.queue.length}명`;if(cur){card.classList.remove("empty-target");card.innerHTML=`<div class="target-avatar"><img src="assets/mascot-character.png" alt="캐릭터"></div><div class="target-info"><span>${cur.source==="soop"?`별풍선 ${Number(cur.balloonCount||0).toLocaleString()}개`:"수동 등록"}</span><strong>${esc(cur.nickname)} · 남은 ${cur.remaining}회</strong><small>${esc(cur.memo||cur.kindLabel||"번호를 선택하면 자동으로 1회 차감됩니다.")}</small></div>`;actions.classList.remove("hidden");$("#participantName").value=cur.nickname}else{card.classList.add("empty-target");card.innerHTML=`<div class="target-avatar"><img src="assets/mascot-character.png" alt="캐릭터"></div><div class="target-info"><span>대기 중</span><strong>등록된 뽑기 대상이 없습니다.</strong><small>직접 이름을 입력하거나 SOOP 연동으로 불러오세요.</small></div>`;actions.classList.add("hidden")}
if(!state.queue.length){list.innerHTML=`<div class="empty-state">대기 중인 후원이 없습니다.</div>`}else list.innerHTML=state.queue.map((q,i)=>`<div class="queue-item ${i===0?"active":""}"><div class="queue-index">${i+1}</div><div class="queue-name"><strong>${esc(q.nickname)}</strong><span>${q.source==="soop"?`${Number(q.balloonCount||0).toLocaleString()}개 · ${esc(q.kindLabel||"")}`:esc(q.memo||"수동 등록")}</span></div><div class="queue-draws">${q.remaining}회</div></div>`).join("");saveState()}
function openConfirm(i){drawDirect(i)}
function getDrawParticipant(){return $("#participantName")?.value.trim()||"이름 없음"}
function applyDrawAtIndex(i,name){const item=state.board[i];if(!item||item.opened)return null;item.opened=true;item.openedAt=new Date().toISOString();item.participant=name;const time=new Intl.DateTimeFormat("ko-KR",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date());state.history.push({number:formatNumber(i+1),participant:name,result:item.type==="win"?`${item.rank} · ${item.prize}`:item.prize,type:item.type,time});return{item,index:i,result:{id:crypto.randomUUID(),at:new Date().toISOString(),index:i,participant:name,type:item.type,prizeIndex:item.prizeIndex,rank:item.rank,prize:item.prize,color:item.color}}}
function getBestDrawEntry(entries){const wins=entries.filter(x=>x.item.type==="win");if(!wins.length)return entries[entries.length-1]||null;return wins.slice().sort((a,b)=>(Number(a.item.prizeIndex)||0)-(Number(b.item.prizeIndex)||0))[0]}
function scheduleOperatorResultClose(ms=650){clearTimeout(operatorResultTimer);operatorResultTimer=setTimeout(()=>closeModal("resultModal"),Math.max(250,ms))}
function drawDirect(i){const name=getDrawParticipant(),entry=applyDrawAtIndex(i,name);if(!entry)return;state.lastResult=entry.result;publishBroadcastPulse(state.lastResult);saveState();scheduleBroadcastPublish(true);renderAll();showResult(entry.item,entry.index,name);scheduleOperatorResultClose(650)}
function performDraw(){if(pendingIndex===null)return;const i=pendingIndex;pendingIndex=null;closeModal("confirmModal");drawDirect(i)}
function setRandomDrawStatus(message){const el=$("#randomDrawStatus");if(!el)return;clearTimeout(randomStatusTimer);el.textContent=message;el.classList.add("show");randomStatusTimer=setTimeout(()=>{el.classList.remove("show");el.textContent=""},1800)}
function randomDraw(count){if(!state.board.length){setRandomDrawStatus("먼저 뽑기판을 만들어 주세요.");return}const unopened=state.board.map((x,i)=>x.opened?null:i).filter(i=>i!==null);if(!unopened.length){setRandomDrawStatus("남은 번호가 없습니다.");return}const selected=shuffle(unopened).slice(0,Math.min(Math.max(1,Number(count)||1),unopened.length));const name=getDrawParticipant(),entries=selected.map(i=>applyDrawAtIndex(i,name)).filter(Boolean);if(!entries.length)return;const highlight=getBestDrawEntry(entries);const batchResults=entries.map(entry=>({index:entry.index,number:formatNumber(entry.index+1),type:entry.item.type,prizeIndex:entry.item.prizeIndex,rank:entry.item.rank,prize:entry.item.prize,color:entry.item.color,participant:name}));state.lastResult={...highlight.result,batchCount:entries.length,batchResults};publishBroadcastPulse(state.lastResult);saveState();scheduleBroadcastPublish(true);renderAll();const wins=entries.filter(x=>x.item.type==="win").length,loses=entries.length-wins;if(entries.length===1){showResult(highlight.item,highlight.index,name);scheduleOperatorResultClose(650)}else{playResultSound(highlight.item);setRandomDrawStatus(`${entries.length}개 추첨 완료 · 당첨 ${wins}개 / 꽝 ${loses}개`)}}
const SOUND_PATHS={first:"assets/sounds/first-prize.wav",win:"assets/sounds/win.wav",lose:"assets/sounds/lose.wav"};
const soundPlayers=Object.create(null);
function getSoundPlayer(key){if(!SOUND_PATHS[key])return null;if(!soundPlayers[key]){const audio=new Audio(SOUND_PATHS[key]);audio.preload="auto";soundPlayers[key]=audio}return soundPlayers[key]}
function preloadSoundEffects(){Object.keys(SOUND_PATHS).forEach(getSoundPlayer)}
function isFirstPrizeResult(item){if(item.type!=="win")return false;if(Number(item.prizeIndex)===0)return true;const first=state.settings.prizes?.[0];return Boolean(first&&String(item.rank||"")===String(first.rank||""))}
function playSoundEffect(key,force=false){const cfg={...defaultSettings.sound,...(state.settings.sound||{})};if(force&&$("#soundVolume"))cfg.volume=Math.max(0,Math.min(1,(Number($("#soundVolume").value)||0)/100));if(!force){if(!cfg.enabled)return;if(!IS_BROADCAST_VIEW&&!cfg.operatorEnabled)return;if(cfg[key]===false)return}const audio=getSoundPlayer(key);if(!audio)return;try{audio.pause();audio.currentTime=0;audio.volume=Math.max(0,Math.min(1,Number(cfg.volume)||0));const promise=audio.play();if(promise&&typeof promise.catch==="function")promise.catch(err=>console.warn("효과음 자동 재생이 차단되었습니다.",err))}catch(err){console.warn("효과음 재생 실패",err)}}
function playResultSound(item){if(item.type==="lose")playSoundEffect("lose");else if(isFirstPrizeResult(item))playSoundEffect("first");else playSoundEffect("win")}
function updateSoundVolumeLabel(){const value=Math.max(0,Math.min(100,Number($("#soundVolume")?.value)||0));const label=$("#soundVolumeValue");if(label)label.textContent=`${value}%`}
function setSoundTestStatus(message,isError=false){const el=$("#soundTestStatus");if(!el)return;el.textContent=message;el.className=`sound-test-status${isError?" error":" ok"}`}
function testSoundEffect(key){try{playSoundEffect(key,true);setSoundTestStatus(`${key==="first"?"1등":key==="win"?"일반 당첨":"꽝"} 효과음을 재생했습니다.`)}catch(e){setSoundTestStatus(`효과음 재생 실패: ${e.message}`,true)}}
function getDraftSoundSettings(){return{enabled:$("#soundEnabled")?.checked!==false,volume:Math.max(0,Math.min(1,(Number($("#soundVolume")?.value)||0)/100)),operatorEnabled:Boolean($("#soundOperatorEnabled")?.checked),first:$("#soundFirstEnabled")?.checked!==false,win:$("#soundWinEnabled")?.checked!==false,lose:$("#soundLoseEnabled")?.checked!==false}}
function showResult(item,i,name){const c=$("#resultModalCard");c.classList.toggle("lose-result",item.type==="lose");if(item.type==="win"){$("#resultEmoji").textContent=isFirstPrizeResult(item)?"🎉":"✨";$("#resultRank").textContent=item.rank;$("#resultRank").style.background=item.color||"#9f8fff";$("#resultPrize").textContent=item.prize;$("#resultMessage").textContent=isFirstPrizeResult(item)?"대박입니다!":"축하합니다!"}else{$("#resultEmoji").textContent="💫";$("#resultRank").textContent="꽝";$("#resultRank").style.background="#9ba7b8";$("#resultPrize").textContent=item.prize;$("#resultMessage").textContent="다음 기회에는 꼭 당첨될 거예요!"}$("#resultMeta").textContent=`${name} · ${formatNumber(i+1)}번`;playResultSound(item);openModal("resultModal")}
function showBatchResultSummary(result){
  const results=Array.isArray(result?.batchResults)?result.batchResults:[];
  if(results.length<2)return false;
  const wins=results.filter(x=>x.type==="win").length,loses=results.length-wins;
  $("#batchResultTitle").textContent=`랜덤 ${results.length}개 추첨 결과`;
  $("#batchResultSummary").textContent=`당첨 ${wins}개 · 꽝 ${loses}개`;
  $("#batchResultGrid").innerHTML=results.map(x=>`<div class="batch-result-item ${x.type==="win"?"win":"lose"}" style="--batch-color:${esc(x.color||"#9ba7b8")}"><span class="batch-number">${esc(x.number||formatNumber((Number(x.index)||0)+1))}번</span><strong>${x.type==="win"?esc(x.rank||"당첨"):"꽝"}</strong><small>${esc(x.prize||"")}</small></div>`).join("");
  const best=results.find(x=>x.type==="win")||results[0];
  playResultSound({type:best.type,prizeIndex:best.prizeIndex,rank:best.rank,prize:best.prize,color:best.color});
  openModal("batchResultModal");
  clearTimeout(broadcastResultTimer);
  broadcastResultTimer=setTimeout(()=>closeModal("batchResultModal"),3000);
  return true;
}
function addQueueEntry({nickname,draws,source="manual",balloonCount=0,eventId="",kind="MANUAL",memo=""}){draws=Math.max(0,Math.floor(Number(draws)||0));if(!nickname||draws<1)return false;if(eventId&&(state.importedEventIds.includes(eventId)||state.queue.some(q=>q.eventId===eventId)))return false;state.queue.push({id:crypto.randomUUID(),nickname,remaining:draws,total:draws,used:0,source,balloonCount,eventId,kind,kindLabel:kindToLabel(kind),memo,createdAt:new Date().toISOString()});if(eventId){state.importedEventIds.push(eventId);state.importedEventIds=state.importedEventIds.slice(-3000)}saveState();renderQueue();return true}
function kindToLabel(k){return({BALLOON_GIFTED:"일반 후원",CHALLENGE_MISSION_GIFTED:"도전미션",BATTLE_MISSION_GIFTED:"배틀미션",MANUAL:"수동"})[k]||k||"후원"}
function calculateDraws(count,settings=state.settings.integration){count=Math.max(0,Number(count)||0);let n=0;if(settings.ruleMode==="ratio"){const b=Math.max(1,Number(settings.ratio.balloons)||1),d=Math.max(0,Number(settings.ratio.draws)||0);n=Math.floor(count/b)*d}else if(settings.ruleMode==="range"){const r=(settings.ranges||[]).find(x=>count>=Number(x.min||0)&&(x.max===null||x.max===""||count<=Number(x.max)));n=r?Number(r.draws)||0:0}else{const r=(settings.exacts||[]).find(x=>count===Number(x.count));n=r?Number(r.draws)||0:0}return Math.max(0,Math.min(Number(settings.maxDraws)||999,Math.floor(n)))}
function eventAllowed(ev,s=state.settings.integration){if(s.bjId&&String(ev.bjId||"").toLowerCase()!==String(s.bjId).toLowerCase())return false;return s.kinds?.[ev.kind]!==false}
function formatSessionDate(value){if(!value)return"-";const d=new Date(value);if(Number.isNaN(d.getTime()))return"-";return new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(d)}
function renderSession(){const s=state.session||{},dot=$("#sessionStatusDot"),title=$("#sessionStatusTitle"),desc=$("#sessionStatusDescription"),started=$("#sessionStartedAt"),base=$("#sessionBaseRow"),startBtn=$("#startSessionBtn"),endBtn=$("#endSessionBtn");dot.className="session-status-dot ";if(s.active){dot.classList.add("active");title.textContent="뽑기 진행 중 · 새 후원 수신 중";desc.textContent="시작 버튼을 누른 시점 이후에 저장된 후원만 대기열에 자동 등록됩니다.";started.textContent=`시작 시각: ${formatSessionDate(s.startedAt)}`;base.textContent=`수신 기준 행: ${Number(s.startRow)||1} 이후`;startBtn.disabled=true;endBtn.disabled=false}else if(s.endedAt){dot.classList.add("ended");title.textContent="후원 수신 종료";desc.textContent="새 후원 수신은 중지되었습니다. 이미 등록된 대기열은 계속 뽑을 수 있습니다.";started.textContent=`최근 시작: ${formatSessionDate(s.startedAt)}`;base.textContent=`종료 시각: ${formatSessionDate(s.endedAt)}`;startBtn.disabled=false;endBtn.disabled=true}else{dot.classList.add("standby");title.textContent="뽑기 시작 대기";desc.textContent="뽑기판을 만든 뒤 시작 버튼을 누르면, 그 시점 이전 후원은 제외되고 이후 후원만 읽어옵니다.";started.textContent="시작 시각: -";base.textContent="수신 기준: -";startBtn.disabled=false;endBtn.disabled=true}const syncBtn=$("#syncNowBtn");if(syncBtn)syncBtn.disabled=!s.active}
function renderSyncStatus(mode){const s=state.settings.integration,session=state.session||{},d=$("#syncStatusDot"),t=$("#syncStatusText");d.className="status-dot ";if(!s.enabled){d.classList.add("off");t.textContent="사용 안 함";return}if(!session.active){d.classList.add("off");t.textContent="시작 대기";return}if(mode==="syncing"||syncing){d.classList.add("syncing");t.textContent="확인 중"}else if(mode==="error"){d.classList.add("error");t.textContent="연결 오류"}else{d.classList.add("ok");t.textContent="후원 수신 중"}}
function apiUrl(action,extra={}){const base=state.settings.integration.execUrl.trim();if(!base)return"";const u=new URL(base);u.searchParams.set("action",action);u.searchParams.set("token",state.settings.integration.token||"");Object.entries(extra).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=="")u.searchParams.set(k,v)});u.searchParams.set("_",Date.now());return u.toString()}
async function fetchJson(url){const r=await fetch(url,{method:"GET",cache:"no-store",redirect:"follow"});if(!r.ok)throw new Error(`HTTP ${r.status}`);const text=await r.text();try{return JSON.parse(text)}catch{throw new Error("JSON 응답이 아닙니다.")}}
async function postFormJson(url,fields){const body=new URLSearchParams();Object.entries(fields||{}).forEach(([k,v])=>{if(v!==undefined&&v!==null)body.set(k,String(v))});const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:body.toString(),cache:"no-store",redirect:"follow"});if(!r.ok)throw new Error(`HTTP ${r.status}`);const text=await r.text();try{return JSON.parse(text)}catch{throw new Error("JSON 응답이 아닙니다.")}}
function isUnsupportedActionResponse(data){return Boolean(data&&data.ok===false&&String(data.message||"").includes("지원하지 않는 action"))}
async function testConnection(useDraft=true){const el=$("#connectionTestResult");try{if(useDraft){const draft=getDraftIntegration();if(!draft.execUrl)throw new Error("Apps Script 주소를 입력해 주세요.");const u=new URL(draft.execUrl);u.searchParams.set("action","drawPing");u.searchParams.set("token",draft.token||"");u.searchParams.set("bjId",draft.bjId||"");u.searchParams.set("_",Date.now());el.textContent="연결 확인 중...";el.className="connection-result";const data=await fetchJson(u.toString());if(!data.ok)throw new Error(data.message||"연결 실패")}else{const data=await fetchJson(apiUrl("drawPing"));if(!data.ok)throw new Error(data.message||"연결 실패")}el.textContent="Apps Script 연결 확인 완료";el.className="connection-result ok";return true}catch(e){el.textContent=`연결 실패: ${e.message}`;el.className="connection-result error";return false}}
async function syncGifts(){const s=state.settings.integration,session=state.session||{};if(syncing||!s.enabled||!s.execUrl||!session.active)return;syncing=true;renderSyncStatus("syncing");try{const data=await fetchJson(apiUrl("drawEvents",{bjId:s.bjId||"",afterRow:Number(session.startRow)||1,sessionId:session.sessionId||""}));if(!data.ok)throw new Error(data.message||"수신 실패");for(const ev of (data.events||[])){const eventId=String(ev.eventId||"");if(!eventId)continue;if(state.importedEventIds.includes(eventId)){await acknowledgeEvent(eventId,"queued");continue}if(!eventAllowed(ev,s)){await acknowledgeEvent(eventId,"ignored");state.importedEventIds.push(eventId);continue}const draws=calculateDraws(ev.count,s);if(draws>0){addQueueEntry({nickname:ev.nickname||ev.userId||"익명",draws,source:"soop",balloonCount:ev.count,eventId,kind:ev.kind,memo:`${kindToLabel(ev.kind)} · 자동 지급 ${draws}회`})}else{state.importedEventIds.push(eventId)}await acknowledgeEvent(eventId,draws>0?"queued":"no_draw")}state.importedEventIds=[...new Set(state.importedEventIds)].slice(-3000);state.session.lastError="";saveState();renderAll();renderSyncStatus()}catch(e){console.error(e);state.session.lastError=e.message||String(e);saveState();renderSyncStatus("error")}finally{syncing=false}}
async function acknowledgeEvent(eventId,status){try{const d=await fetchJson(apiUrl("drawAck",{eventId,status}));return d.ok}catch{return false}}
function restartPolling(){clearInterval(pollTimer);pollTimer=null;if(state.settings.integration.enabled&&state.session?.active){const sec=Math.max(3,Number(state.settings.integration.pollSeconds)||5);pollTimer=setInterval(syncGifts,sec*1000);setTimeout(syncGifts,400)}}
async function startDrawSession(){const integration=state.settings.integration;if(state.session?.active)return;if(!state.board.length){alert("먼저 관리 설정에서 새 뽑기판을 생성해 주세요.");return}if(!integration.enabled){alert("관리 설정 → SOOP 연동에서 자동 연동을 켜고 저장해 주세요.");return}if(!integration.execUrl||!integration.token){alert("Apps Script 주소와 연동 토큰을 먼저 저장해 주세요.");return}if(state.queue.length&&!confirm(`현재 대기열 ${state.queue.length}명을 비우고 새 뽑기를 시작할까요?`))return;const btn=$("#startSessionBtn");btn.disabled=true;btn.textContent="시작 준비 중...";try{const data=await fetchJson(apiUrl("drawStart",{bjId:integration.bjId||""}));if(!data.ok)throw new Error(data.message||"뽑기 시작 실패");state.queue=[];state.session={active:true,startRow:Number(data.startRow)||1,startedAt:data.startedAt||new Date().toISOString(),endedAt:"",sessionId:data.sessionId||crypto.randomUUID(),excludedCount:Number(data.excludedCount)||0,lastError:""};saveState();renderAll();restartPolling();alert(`뽑기를 시작했습니다.\n이제부터 들어오는 후원만 수신합니다.${state.session.excludedCount?`\n시작 전 대기 후원 ${state.session.excludedCount}건은 제외했습니다.`:""}`)}catch(e){alert(`뽑기 시작 실패: ${e.message}`);renderSyncStatus("error")}finally{btn.textContent="▶ 뽑기 시작";renderSession()}}
function endDrawSession(){if(!state.session?.active)return;if(!confirm("새 후원 수신을 종료할까요? 이미 대기열에 등록된 대상은 계속 뽑을 수 있습니다."))return;state.session.active=false;state.session.endedAt=new Date().toISOString();saveState();restartPolling();renderAll()}
function openModal(id){document.getElementById(id).classList.remove("hidden");document.body.style.overflow="hidden"}function closeModal(id){document.getElementById(id).classList.add("hidden");if($$(".modal-backdrop:not(.hidden)").length===0)document.body.style.overflow=""}
function renderSettings(){const s=state.settings,i=s.integration,sound={...defaultSettings.sound,...(s.sound||{})};$("#settingTitle").value=s.title;$("#settingSubtitle").value=s.subtitle;$("#settingTotal").value=s.total;$("#settingColumns").value=s.columns;$("#settingLoseText").value=s.loseText;renderPrizeEditor(s.prizes);$("#soopEnabled").checked=i.enabled;$("#soopExecUrl").value=i.execUrl;$("#soopToken").value=i.token;$("#soopPollSeconds").value=String(i.pollSeconds);$("#soopBjId").value=i.bjId;$("#soopMaxDraws").value=i.maxDraws;$("#kindBalloon").checked=i.kinds.BALLOON_GIFTED!==false;$("#kindChallenge").checked=i.kinds.CHALLENGE_MISSION_GIFTED!==false;$("#kindBattle").checked=i.kinds.BATTLE_MISSION_GIFTED!==false;const radio=$(`input[name="ruleMode"][value="${i.ruleMode}"]`);if(radio)radio.checked=true;$("#ratioBalloons").value=i.ratio.balloons;$("#ratioDraws").value=i.ratio.draws;renderRangeRules(i.ranges);renderExactRules(i.exacts);$("#soundEnabled").checked=sound.enabled!==false;$("#soundVolume").value=Math.round(Math.max(0,Math.min(1,Number(sound.volume)||0))*100);$("#soundOperatorEnabled").checked=Boolean(sound.operatorEnabled);$("#soundFirstEnabled").checked=sound.first!==false;$("#soundWinEnabled").checked=sound.win!==false;$("#soundLoseEnabled").checked=sound.lose!==false;updateSoundVolumeLabel();setSoundTestStatus("테스트 버튼으로 각 효과음을 미리 들어볼 수 있습니다.");updateRulePanels();updateSettingsSummary();updateTestDrawResult()}
function renderPrizeEditor(prizes){const ed=$("#prizeEditor");ed.innerHTML="";prizes.forEach(p=>{const row=document.createElement("div");row.className="prize-edit-row";row.innerHTML=`<label><span>등수</span><input class="edit-rank" type="text" maxlength="12" value="${esc(p.rank)}"></label><label><span>상품명 / 당첨 문구</span><input class="edit-prize" type="text" maxlength="40" value="${esc(p.prize)}"></label><label><span>개수</span><input class="edit-count" type="number" min="0" max="300" value="${Number(p.count)||0}"></label><label><span>색상</span><input class="edit-color color-input" type="color" value="${esc(p.color||"#9f8fff")}"></label><div class="delete-cell"><button class="icon-btn delete-prize">×</button></div>`;ed.appendChild(row)});$$(".prize-editor input").forEach(x=>x.addEventListener("input",updateSettingsSummary));$$(".delete-prize").forEach(x=>x.addEventListener("click",e=>{e.currentTarget.closest(".prize-edit-row").remove();updateSettingsSummary()}))}
function getEditorPrizes(){return $$(".prize-edit-row").map(r=>({rank:r.querySelector(".edit-rank").value.trim()||"당첨",prize:r.querySelector(".edit-prize").value.trim()||"상품",count:Math.max(0,Number(r.querySelector(".edit-count").value)||0),color:r.querySelector(".edit-color").value||"#9f8fff"}))}
function renderRangeRules(rules){const e=$("#rangeRuleEditor");e.innerHTML="";(rules||[]).forEach(r=>e.insertAdjacentHTML("beforeend",`<div class="range-rule-row"><input class="range-min" type="number" min="0" value="${Number(r.min)||0}"><span>~</span><input class="range-max" type="number" min="0" placeholder="제한 없음" value="${r.max??""}"><span>→</span><input class="range-draws" type="number" min="0" value="${Number(r.draws)||0}"><button class="rule-delete">×</button></div>`));bindRuleDeletes()}
function renderExactRules(rules){const e=$("#exactRuleEditor");e.innerHTML="";(rules||[]).forEach(r=>e.insertAdjacentHTML("beforeend",`<div class="exact-rule-row"><input class="exact-count" type="number" min="0" value="${Number(r.count)||0}"><span>개 →</span><input class="exact-draws" type="number" min="0" value="${Number(r.draws)||0}"><button class="rule-delete">×</button></div>`));bindRuleDeletes()}
function bindRuleDeletes(){$$(".rule-delete").forEach(x=>x.onclick=e=>{e.currentTarget.parentElement.remove();updateTestDrawResult()});$$('.rule-editor input').forEach(x=>x.oninput=updateTestDrawResult)}
function getDraftIntegration(){const mode=$('input[name="ruleMode"]:checked')?.value||"ratio";return{enabled:$("#soopEnabled").checked,execUrl:$("#soopExecUrl").value.trim(),token:$("#soopToken").value.trim(),pollSeconds:Math.max(3,Number($("#soopPollSeconds").value)||5),bjId:$("#soopBjId").value.trim(),maxDraws:Math.max(1,Number($("#soopMaxDraws").value)||100),kinds:{BALLOON_GIFTED:$("#kindBalloon").checked,CHALLENGE_MISSION_GIFTED:$("#kindChallenge").checked,BATTLE_MISSION_GIFTED:$("#kindBattle").checked},ruleMode:mode,ratio:{balloons:Math.max(1,Number($("#ratioBalloons").value)||1),draws:Math.max(0,Number($("#ratioDraws").value)||0)},ranges:$$(".range-rule-row").map(r=>({min:Math.max(0,Number(r.querySelector(".range-min").value)||0),max:r.querySelector(".range-max").value===""?null:Math.max(0,Number(r.querySelector(".range-max").value)||0),draws:Math.max(0,Number(r.querySelector(".range-draws").value)||0)})),exacts:$$(".exact-rule-row").map(r=>({count:Math.max(0,Number(r.querySelector(".exact-count").value)||0),draws:Math.max(0,Number(r.querySelector(".exact-draws").value)||0)}))}}
function getDraftSettings(){return{title:$("#settingTitle").value.trim()||"제리츄 뽑기판",subtitle:$("#settingSubtitle").value.trim()||"오늘의 행운을 뽑아보세요!",total:Math.max(1,Math.min(300,Number($("#settingTotal").value)||100)),columns:Math.max(2,Math.min(20,Number($("#settingColumns").value)||10)),loseText:$("#settingLoseText").value.trim()||"아쉽습니다!",prizes:getEditorPrizes(),sound:getDraftSoundSettings(),integration:getDraftIntegration()}}
function validateSettings(s){const w=s.prizes.reduce((a,p)=>a+p.count,0);if(!s.prizes.length)return"당첨 항목을 한 개 이상 추가해 주세요.";if(w>s.total)return`당첨 수량이 전체 칸 수보다 ${w-s.total}개 많습니다.`;if(s.integration.enabled&&!s.integration.execUrl)return"송출 연동을 사용할 경우 Apps Script 주소를 입력해 주세요.";return""}
function updateSettingsSummary(){const s=getDraftSettings(),w=s.prizes.reduce((a,p)=>a+p.count,0),err=validateSettings(s);$("#summaryTotal").textContent=s.total;$("#summaryWin").textContent=w;$("#summaryLose").textContent=Math.max(0,s.total-w);$("#settingError").textContent=err;$("#settingError").classList.toggle("hidden",!err);$("#generateBoardBtn").disabled=Boolean(err)}
function saveSettingsOnly(){const s=getDraftSettings(),err=validateSettings(s);if(err){updateSettingsSummary();return}state.settings=s;saveState();renderAll();restartPolling();closeModal("settingsModal")}
function generateFromSettings(){const s=getDraftSettings(),err=validateSettings(s);if(err){updateSettingsSummary();return}if(state.board.some(x=>x.opened)&&!confirm("새 뽑기판을 만들면 현재 진행 기록과 열린 칸이 모두 초기화됩니다. 계속할까요?"))return;state.settings=s;buildBoard();restartPolling();closeModal("settingsModal")}
function addPrizeRow(){const p=getEditorPrizes(),n=p.length+1,pal=["#72beff","#9f8fff","#ff88bf","#83e5f0","#ffc46b","#78d0a0"];p.push({rank:`${n}등`,prize:"새 상품",count:1,color:pal[(n-1)%pal.length]});renderPrizeEditor(p);updateSettingsSummary()}
function updateRulePanels(){const m=$('input[name="ruleMode"]:checked')?.value||"ratio";$("#ratioRulePanel").classList.toggle("hidden",m!=="ratio");$("#rangeRulePanel").classList.toggle("hidden",m!=="range");$("#exactRulePanel").classList.toggle("hidden",m!=="exact");updateTestDrawResult()}
function updateTestDrawResult(){try{$("#testDrawResult").textContent=`${calculateDraws($("#testBalloonCount").value,getDraftIntegration())}회`}catch{$("#testDrawResult").textContent="0회"}}
function renderPreview(){const g=$("#previewGrid");if(!state.board.length){g.innerHTML=`<div class="empty-state">생성된 뽑기판이 없습니다.</div>`;return}g.innerHTML=state.board.map((x,i)=>`<div class="preview-item ${x.type==="lose"?"lose-preview":""}" style="--preview-color:${esc(x.color||"#9f8fff")}"><b>${formatNumber(i+1)}번 ${x.opened?"· 공개됨":""}</b>${x.type==="win"?`${esc(x.rank)} · ${esc(x.prize)}`:esc(x.prize)}</div>`).join("")}
function exportCsv(){if(!state.board.length)return;const rows=[["번호","결과","상품/문구","공개 여부","참가자","공개 시각"]];state.board.forEach((x,i)=>rows.push([formatNumber(i+1),x.type==="win"?x.rank:"꽝",x.prize,x.opened?"공개":"미공개",x.participant||"",x.openedAt||""]));const csv="\uFEFF"+rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n"),blob=new Blob([csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="제리츄_뽑기판_결과.csv";a.click();URL.revokeObjectURL(url)}
function resetProgress(){if(!state.board.length||!confirm("뽑기 결과 배치는 유지하고, 열린 칸과 기록만 초기화할까요?"))return;state.board=state.board.map(x=>({...x,opened:false,openedAt:null,participant:""}));state.history=[];saveState();renderAll()}
async function copyWinnerHistory(){
  const winners=(Array.isArray(state.history)?state.history:[]).filter(x=>x.type==="win");
  if(!winners.length){alert("복사할 당첨 기록이 없습니다.");return}
  const groups=[];
  const groupMap=new Map();
  winners.forEach(x=>{
    const boardIndex=Math.max(0,(Number(x.number)||1)-1);
    const boardItem=state.board[boardIndex];
    let rank=boardItem?.type==="win"?(boardItem.rank||"당첨"):"";
    let prize=boardItem?.type==="win"?(boardItem.prize||""):"";
    if(!rank){
      const parts=String(x.result||"").split(" · ");
      rank=parts.shift()||"당첨";
      prize=parts.join(" · ");
    }
    const key=`${rank}\u0000${prize}`;
    if(!groupMap.has(key)){
      const group={rank,prize,items:[]};
      groupMap.set(key,group);
      groups.push(group);
    }
    groupMap.get(key).items.push({participant:x.participant||"이름 없음",number:x.number||"-"});
  });
  const lines=[`[${state.settings.title||"제리츄 뽑기판"} 당첨자]`,""];
  groups.forEach((group,index)=>{
    lines.push(`${group.rank}${group.prize?` | ${group.prize}`:""}`);
    group.items.forEach(item=>lines.push(`- ${item.participant} (${item.number}번)`));
    if(index<groups.length-1)lines.push("");
  });
  lines.push("",`총 당첨 ${winners.length}건`);
  const copiedText=lines.join("\n");
  try{
    await navigator.clipboard.writeText(copiedText);
  }catch{
    const textarea=document.createElement("textarea");
    textarea.value=copiedText;
    textarea.style.position="fixed";
    textarea.style.opacity="0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  const button=$("#copyWinnersBtn");
  if(button){
    const original=button.textContent;
    button.textContent="복사 완료 ✓";
    button.classList.add("copied");
    setTimeout(()=>{button.textContent=original;button.classList.remove("copied")},1400);
  }
}
function clearHistory(){if(!confirm("최근 결과 기록만 지울까요? 열린 칸은 그대로 유지됩니다."))return;state.history=[];saveState();renderHistory()}

function simpleHash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return String(h>>>0)}
function publicBroadcastSnapshot(){
  const cur=currentTarget();
  const opened=state.board.filter(x=>x.opened).length;
  const total=state.board.length||Number(state.settings.total)||0;
  return{
    settings:{title:state.settings.title,subtitle:state.settings.subtitle,total,columns:state.settings.columns,loseText:state.settings.loseText,prizes:state.settings.prizes,sound:state.settings.sound},
    board:state.board.map((x,i)=>x.opened?{i,opened:true,type:x.type,prizeIndex:x.prizeIndex,rank:x.rank,prize:x.prize,color:x.color,participant:x.participant||""}:null),
    history:state.history.slice(-10),
    queue:state.queue.filter(q=>q.remaining>0).slice(0,8).map(q=>({nickname:q.nickname,remaining:q.remaining,total:q.total,source:q.source,balloonCount:q.balloonCount||0,kindLabel:q.kindLabel||"",memo:q.memo||""})),
    session:{active:!!state.session?.active,startedAt:state.session?.startedAt||"",endedAt:state.session?.endedAt||""},
    lastResult:state.lastResult||null,
    stats:{remaining:Math.max(0,total-opened),winningRemaining:state.board.filter(x=>x.type==="win"&&!x.opened).length,progress:total?Math.round(opened/total*100):0},
    currentTarget:cur?{nickname:cur.nickname,remaining:cur.remaining,source:cur.source,balloonCount:cur.balloonCount||0,kindLabel:cur.kindLabel||"",memo:cur.memo||""}:null,
    updatedAt:new Date().toISOString()
  }
}
function scheduleBroadcastPublish(force=false){
  if(IS_BROADCAST_VIEW||!state.broadcast?.key||!state.settings.integration?.execUrl||!state.settings.integration?.token)return;
  if(broadcastPublishing){broadcastPublishQueued=true;return}
  clearTimeout(broadcastPublishTimer);
  broadcastPublishTimer=setTimeout(()=>publishBroadcastState(force),force?10:25)
}
async function publishBroadcastState(force=false){
  if(IS_BROADCAST_VIEW||!state.broadcast?.key)return;
  if(broadcastPublishing){broadcastPublishQueued=true;return}
  broadcastPublishing=true;
  broadcastPublishQueued=false;
  try{
    const snap=publicBroadcastSnapshot();
    const snapshotJson=JSON.stringify(snap);
    const snapshotHash=simpleHash(snapshotJson);
    if(!force&&snapshotHash===broadcastMetaHash)return;
    const s=state.settings.integration||{};
    const revision=`${Date.now()}-${crypto.randomUUID()}`;
    if(broadcastFastMode){
      const data=await postFormJson(s.execUrl,{
        action:"drawBroadcastFastPush",token:s.token||"",bjId:state.broadcast.bjId||s.bjId||"",key:state.broadcast.key,
        revision,snapshot:snapshotJson
      });
      if(isUnsupportedActionResponse(data)){
        broadcastFastMode=false;
        await publishBroadcastStateLegacy(snap,true)
      }else if(!data.ok){
        throw new Error(data.message||"고속 송출 상태 저장 실패")
      }else{
        lastBroadcastRevision=data.revision||revision;
      }
    }else{
      await publishBroadcastStateLegacy(snap,force)
    }
    broadcastMetaHash=snapshotHash;
  }catch(e){
    console.error("broadcast publish",e)
  }finally{
    broadcastPublishing=false;
    if(broadcastPublishQueued){broadcastPublishQueued=false;scheduleBroadcastPublish(true)}
  }
}
async function publishBroadcastStateLegacy(snap,force=false){
  const meta={settings:snap.settings,history:snap.history,queue:snap.queue,session:snap.session,lastResult:snap.lastResult,stats:snap.stats,currentTarget:snap.currentTarget,updatedAt:snap.updatedAt};
  const metaJson=JSON.stringify(meta),metaHash=simpleHash(metaJson),bjId=state.broadcast.bjId||state.settings.integration.bjId||"";
  if(force||metaHash!==broadcastMetaHash){
    const r=await fetchJson(apiUrl("drawBroadcastMeta",{bjId,key:state.broadcast.key,meta:metaJson}));
    if(!r.ok)throw new Error(r.message||"송출 상태 저장 실패")
  }
  const chunkCount=Math.max(1,Math.ceil(snap.board.length/BROADCAST_CHUNK_SIZE));
  const jobs=[];
  for(let i=0;i<chunkCount;i++){
    const chunkJson=JSON.stringify(snap.board.slice(i*BROADCAST_CHUNK_SIZE,(i+1)*BROADCAST_CHUNK_SIZE));
    const h=simpleHash(chunkJson);
    if(force||broadcastChunkHashes[i]!==h){
      jobs.push(fetchJson(apiUrl("drawBroadcastChunk",{bjId,key:state.broadcast.key,chunkIndex:i,chunk:chunkJson})).then(r=>{
        if(!r.ok)throw new Error(r.message||"송출 보드 저장 실패");
        broadcastChunkHashes[i]=h
      }))
    }
  }
  await Promise.all(jobs)
}
async function copyBroadcastUrl(layout="full"){
  const s=state.settings.integration||{};
  if(!s.execUrl||!s.token){alert("관리 설정 → SOOP 연동에서 Apps Script 주소와 연동 토큰을 먼저 저장해 주세요.");return}
  const btn=layout==="mini"?$("#copyMiniBroadcastUrlBtn"):$("#copyBroadcastUrlBtn");
  btn.disabled=true;const originalText=btn.textContent;btn.textContent="주소 준비 중...";
  try{
    const data=await fetchJson(apiUrl("drawBroadcastKey",{bjId:s.bjId||""}));
    if(!data.ok)throw new Error(data.message||"송출 키 생성 실패");
    state.broadcast={key:data.key,bjId:data.bjId};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
    broadcastMetaHash="";broadcastChunkHashes=[];
    await publishBroadcastState(true);
    const url=new URL(location.href);url.search="";url.hash="";
    url.searchParams.set("view","broadcast");
    if(layout==="mini")url.searchParams.set("layout","mini");
    url.searchParams.set("api",s.execUrl);
    url.searchParams.set("bjId",data.bjId);
    url.searchParams.set("key",data.key);
    const text=url.toString();
    try{await navigator.clipboard.writeText(text)}catch{const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove()}
    alert(`${layout==="mini"?"미니":"전체"} 송출용 주소를 복사했습니다.\nOBS 브라우저 소스의 URL에 붙여넣어 주세요.`)
  }catch(e){alert(`송출 주소 생성 실패: ${e.message}`)}finally{btn.disabled=false;btn.textContent=originalText}
}
function publishBroadcastPulse(result){
  if(IS_BROADCAST_VIEW||!result||!state.broadcast?.key)return;
  const s=state.settings.integration||{};
  if(!s.execUrl||!s.token)return;
  const body=new URLSearchParams({
    action:"drawBroadcastPulsePush",
    token:s.token||"",
    bjId:state.broadcast.bjId||s.bjId||"",
    key:state.broadcast.key,
    pulse:JSON.stringify({id:result.id,at:result.at,result})
  });
  fetch(s.execUrl,{method:"POST",body,keepalive:true}).catch(e=>console.warn("broadcast pulse push",e));
}
function scheduleNextBroadcastPulse(delay){
  clearTimeout(broadcastPulseTimer);
  broadcastPulseTimer=setTimeout(loadBroadcastPulse,Math.max(250,Number(delay)||BROADCAST_PULSE_POLL_MS));
}
function applyBroadcastPulse(pulse){
  const result=pulse?.result||pulse;
  if(!result?.id||result.id===lastBroadcastPulseId||result.id===lastBroadcastResultId)return;
  const age=Date.now()-new Date(result.at||pulse?.at||0).getTime();
  lastBroadcastPulseId=result.id;
  lastBroadcastResultId=result.id;
  if(age<0||age>12000)return;
  const batchResults=Array.isArray(result.batchResults)?result.batchResults:[];
  if(batchResults.length>1){
    batchResults.forEach(x=>{const index=Math.max(0,Number(x.index)||0);if(Array.isArray(state.board)&&state.board[index])state.board[index]={opened:true,type:x.type,prizeIndex:x.prizeIndex,rank:x.rank,prize:x.prize,color:x.color,participant:x.participant||result.participant||""}});
    renderBoard();
    renderBroadcastPrizeStrip();
    showBatchResultSummary(result);
    return;
  }
  const index=Math.max(0,Number(result.index)||0);
  if(Array.isArray(state.board)&&state.board[index]){
    state.board[index]={opened:true,type:result.type,prizeIndex:result.prizeIndex,rank:result.rank,prize:result.prize,color:result.color,participant:result.participant||""};
    renderBoard();
    renderBroadcastPrizeStrip();
  }
  showResult({type:result.type,prizeIndex:result.prizeIndex,rank:result.rank,prize:result.prize,color:result.color},index,result.participant||"이름 없음");
  clearTimeout(broadcastResultTimer);
  broadcastResultTimer=setTimeout(()=>closeModal("resultModal"),850);
}
async function loadBroadcastPulse(){
  if(!IS_BROADCAST_VIEW||broadcastPulseRunning)return;
  broadcastPulseRunning=true;
  let delay=state.session?.active?BROADCAST_PULSE_POLL_MS:BROADCAST_PULSE_IDLE_MS;
  try{
    const url=publicApiUrl("drawBroadcastPulseRead",{since:lastBroadcastPulseId});
    if(!url)return;
    const data=await fetchJson(url);
    if(data?.ok&&data.pulse&&!data.unchanged)applyBroadcastPulse(data.pulse);
  }catch(e){
    console.warn("broadcast pulse read",e);
    delay=1200;
  }finally{
    broadcastPulseRunning=false;
    scheduleNextBroadcastPulse(delay);
  }
}
function renderBroadcastPrizeStrip(){
  const strip=$("#broadcastPrizeStrip");if(!strip)return;
  if(!IS_BROADCAST_VIEW){strip.innerHTML="";return}
  const prizes=Array.isArray(state.settings.prizes)?state.settings.prizes:[];
  const maxPerRow=5;
  const rows=[];
  for(let start=0;start<prizes.length;start+=maxPerRow){
    const row=prizes.slice(start,start+maxPerRow).map((p,offset)=>{
      const i=start+offset;
      const total=Math.max(0,Number(p.count)||0);
      const opened=state.board.filter(x=>x.opened&&x.type==="win"&&Number(x.prizeIndex)===i).length;
      const remaining=state.board.length?Math.max(0,total-opened):total;
      return `<div class="broadcast-prize-chip ${remaining<=0?"soldout":""}" style="--chip-color:${esc(p.color||"#72beff")}"><div class="chip-top"><span class="chip-rank">${esc(p.rank)}</span><strong class="chip-count">${remaining}개</strong></div><em class="chip-prize">${esc(p.prize||"")}</em></div>`;
    }).join("");
    rows.push(`<div class="broadcast-prize-row">${row}</div>`);
  }
  strip.innerHTML=rows.join("");
  strip.classList.toggle("multi-row",rows.length>1);
}
function renderBroadcastSidePanel(){
  const panel=$("#broadcastSidePanel"),list=$("#broadcastPrizePanelList");
  if(panel)panel.classList.add("hidden");
  if(list)list.innerHTML="";
}

function renderBroadcastTopbar(){
  const title=$("#broadcastTitle");if(!title)return;
  title.textContent=state.settings.title||"제리츄 뽑기판";
  const cur=currentTarget();
  $("#broadcastCurrentTarget").textContent=cur?`${cur.nickname} · 남은 ${cur.remaining}회`:"대기 중";
  $("#broadcastCurrentMeta").textContent=cur?(cur.source==="soop"?`별풍선 ${Number(cur.balloonCount||0).toLocaleString()}개 · ${cur.kindLabel||"SOOP 후원"}`:(cur.memo||"수동 등록")):"후원 대기열을 기다리고 있습니다.";
  $("#broadcastQueueCount").textContent=`${state.queue.filter(q=>q.remaining>0).length}명`;
  const total=state.board.length||Number(state.settings.total)||0,opened=state.board.filter(x=>x.opened).length;
  $("#broadcastRemaining").textContent=Math.max(0,total-opened);
}
function publicApiUrl(action,extra={}){
  const base=PAGE_PARAMS.get("api")||"";if(!base)return"";
  const u=new URL(base);u.searchParams.set("action",action);u.searchParams.set("bjId",PAGE_PARAMS.get("bjId")||"");u.searchParams.set("key",PAGE_PARAMS.get("key")||"");
  Object.entries(extra).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=="")u.searchParams.set(k,v)});u.searchParams.set("_",Date.now());return u.toString()
}
function applyBroadcastData(data){
  const meta=data.meta||{},settings=meta.settings||{},boardData=Array.isArray(data.board)?data.board:[];
  const total=Math.max(0,Number(settings.total)||boardData.length||0);
  state.settings={...state.settings,...settings,integration:state.settings.integration};
  state.board=Array.from({length:total},(_,i)=>{
    const x=boardData[i];return x&&x.opened?{opened:true,type:x.type,prizeIndex:x.prizeIndex,rank:x.rank,prize:x.prize,color:x.color,participant:x.participant||""}:{opened:false,type:"hidden",rank:"",prize:"",color:"#9ba7b8",participant:""}
  });
  state.history=Array.isArray(meta.history)?meta.history:[];
  state.queue=(Array.isArray(meta.queue)?meta.queue:[]).map((q,i)=>({...q,id:`broadcast-${i}`,used:0}));
  state.session={...state.session,...(meta.session||{})};
  state.lastResult=meta.lastResult||null;
  renderAll();
  const conn=$("#broadcastConnectionText");conn.textContent="실시간 연결";conn.className="ok";
  const result=meta.lastResult;
  if(result?.id&&result.id!==lastBroadcastResultId){
    const age=Date.now()-new Date(result.at||0).getTime();
    lastBroadcastResultId=result.id;
    if(age>=0&&age<12000){
      if(Array.isArray(result.batchResults)&&result.batchResults.length>1){
        showBatchResultSummary(result);
      }else{
        showResult({type:result.type,prizeIndex:result.prizeIndex,rank:result.rank,prize:result.prize,color:result.color},Number(result.index)||0,result.participant||"이름 없음");
        clearTimeout(broadcastResultTimer);broadcastResultTimer=setTimeout(()=>closeModal("resultModal"),850)
      }
    }
  }
}
function applyBroadcastSnapshot(snapshot){
  const safe=snapshot&&typeof snapshot==="object"?snapshot:{};
  const {board,...meta}=safe;
  applyBroadcastData({meta,board:Array.isArray(board)?board:[]})
}
function scheduleNextBroadcastPoll(delay){
  clearTimeout(broadcastPollTimer);
  broadcastPollTimer=setTimeout(loadBroadcastState,Math.max(250,Number(delay)||BROADCAST_FAST_POLL_MS))
}
async function loadBroadcastState(){
  if(broadcastPollRunning)return;
  broadcastPollRunning=true;
  const conn=$("#broadcastConnectionText");
  let nextDelay=state.session?.active?BROADCAST_FAST_POLL_MS:BROADCAST_IDLE_POLL_MS;
  try{
    if(broadcastFastMode){
      const url=publicApiUrl("drawBroadcastFastRead",{since:lastBroadcastRevision});
      if(!url)throw new Error("송출 주소 설정이 없습니다.");
      const data=await fetchJson(url);
      if(isUnsupportedActionResponse(data)){
        broadcastFastMode=false
      }else if(!data.ok){
        throw new Error(data.message||"고속 송출 상태 조회 실패")
      }else{
        if(data.revision)lastBroadcastRevision=data.revision;
        if(!data.unchanged&&data.snapshot)applyBroadcastSnapshot(data.snapshot);
        if(conn){conn.textContent="실시간 연결";conn.className="ok"}
        nextDelay=state.session?.active?BROADCAST_FAST_POLL_MS:BROADCAST_IDLE_POLL_MS;
        return
      }
    }
    const url=publicApiUrl("drawBroadcastRead");if(!url)throw new Error("송출 주소 설정이 없습니다.");
    const data=await fetchJson(url);if(!data.ok)throw new Error(data.message||"송출 상태 조회 실패");applyBroadcastData(data);
    nextDelay=1200
  }catch(e){
    console.error(e);
    nextDelay=1600;
    if(conn){conn.textContent="연결 오류";conn.className="error"}
  }finally{
    broadcastPollRunning=false;
    scheduleNextBroadcastPoll(nextDelay)
  }
}
function initializeBroadcastView(){
  document.body.classList.add("broadcast-mode");
  if(BROADCAST_LAYOUT==="mini")document.body.classList.add("broadcast-mini");
  document.title=`제리츄 뽑기판 · ${BROADCAST_LAYOUT==="mini"?"미니 ":""}송출 화면`;
  $("#broadcastTopbar")?.classList.remove("hidden");
  renderAll();
  clearTimeout(broadcastPollTimer);
  loadBroadcastState();
  loadBroadcastPulse()
}

$("#confirmDrawBtn").onclick=performDraw;$("#randomDraw1Btn").onclick=()=>randomDraw(1);$("#randomDraw5Btn").onclick=()=>randomDraw(5);$("#randomDraw11Btn").onclick=()=>randomDraw(11);$("#copyBroadcastUrlBtn").onclick=()=>copyBroadcastUrl("full");$("#copyMiniBroadcastUrlBtn").onclick=()=>copyBroadcastUrl("mini");$("#startSessionBtn").onclick=startDrawSession;$("#endSessionBtn").onclick=endDrawSession;$("#settingsBtn").onclick=()=>{renderSettings();updateSettingsFooter($(".settings-tab.active")?.dataset.tab||"boardSettings");openModal("settingsModal")};$("#emptySettingsBtn").onclick=()=>{renderSettings();updateSettingsFooter($(".settings-tab.active")?.dataset.tab||"boardSettings");openModal("settingsModal")};$("#previewBtn").onclick=()=>{renderPreview();openModal("previewModal")};$("#resetProgressBtn").onclick=resetProgress;$("#copyWinnersBtn").onclick=copyWinnerHistory;$("#clearHistoryBtn").onclick=clearHistory;$("#addPrizeBtn").onclick=addPrizeRow;$("#saveSettingsBtn").onclick=saveSettingsOnly;$("#generateBoardBtn").onclick=generateFromSettings;$("#exportCsvBtn").onclick=exportCsv;$("#syncNowBtn").onclick=()=>{if(!state.session?.active){alert("먼저 뽑기 시작 버튼을 눌러 주세요.");return}syncGifts()};$("#testConnectionBtn").onclick=()=>testConnection(true);
$("#manualQueueBtn").onclick=()=>openModal("manualQueueModal");$("#manualQueueAddBtn").onclick=()=>{const n=$("#manualNickname").value.trim(),d=$("#manualDraws").value,m=$("#manualMemo").value.trim();if(addQueueEntry({nickname:n,draws:d,memo:m})){closeModal("manualQueueModal");$("#manualNickname").value="";$("#manualDraws").value=1;$("#manualMemo").value=""}};
$("#targetMinusBtn").onclick=()=>{const c=currentTarget();if(c){c.remaining=Math.max(0,c.remaining-1);saveState();renderQueue()}};$("#targetPlusBtn").onclick=()=>{const c=currentTarget();if(c){c.remaining++;c.total++;saveState();renderQueue()}};$("#targetSkipBtn").onclick=()=>{const c=currentTarget();if(c){state.queue=state.queue.filter(x=>x.id!==c.id);state.queue.push(c);saveState();renderQueue()}};$("#targetRemoveBtn").onclick=()=>{const c=currentTarget();if(c&&confirm(`${c.nickname} 님을 대기열에서 삭제할까요?`)){state.queue=state.queue.filter(x=>x.id!==c.id);saveState();renderQueue()}};
function updateSettingsFooter(tabId){const scroll=$(".settings-scroll"),save=$("#saveSettingsBtn"),generate=$("#generateBoardBtn");if(scroll)scroll.scrollTop=0;if(tabId==="soopSettings"){save.textContent="연동 설정 저장";generate.classList.add("hidden")}else if(tabId==="soundSettings"){save.textContent="효과음 설정 저장";generate.classList.add("hidden")}else{save.textContent="설정만 저장";generate.classList.remove("hidden")}}
$$(".settings-tab").forEach(t=>t.onclick=()=>{$$(".settings-tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");$$(".settings-tab-panel").forEach(x=>x.classList.add("hidden"));document.getElementById(t.dataset.tab).classList.remove("hidden");updateSettingsFooter(t.dataset.tab)});
$$('input[name="ruleMode"]').forEach(x=>x.onchange=updateRulePanels);$("#addRangeRuleBtn").onclick=()=>{$("#rangeRuleEditor").insertAdjacentHTML("beforeend",`<div class="range-rule-row"><input class="range-min" type="number" min="0" value="0"><span>~</span><input class="range-max" type="number" min="0" placeholder="제한 없음"><span>→</span><input class="range-draws" type="number" min="0" value="1"><button class="rule-delete">×</button></div>`);bindRuleDeletes()};$("#addExactRuleBtn").onclick=()=>{$("#exactRuleEditor").insertAdjacentHTML("beforeend",`<div class="exact-rule-row"><input class="exact-count" type="number" min="0" value="500"><span>개 →</span><input class="exact-draws" type="number" min="0" value="1"><button class="rule-delete">×</button></div>`);bindRuleDeletes()};
$("#testBalloonCount").oninput=updateTestDrawResult;["ratioBalloons","ratioDraws","soopMaxDraws"].forEach(id=>$("#"+id).oninput=updateTestDrawResult);$("#testAddQueueBtn").onclick=()=>{const count=Number($("#testBalloonCount").value)||0,draws=calculateDraws(count,getDraftIntegration());if(draws>0)addQueueEntry({nickname:"연동 테스트",draws,source:"manual",balloonCount:count,memo:`별풍선 ${count.toLocaleString()}개 계산 테스트`})};$("#soundVolume").oninput=updateSoundVolumeLabel;$$('[data-sound-test]').forEach(button=>button.onclick=()=>testSoundEffect(button.dataset.soundTest));
["settingTotal","settingColumns","settingLoseText","settingTitle","settingSubtitle","soopEnabled","soopExecUrl"].forEach(id=>$("#"+id).addEventListener("input",updateSettingsSummary));$$("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));$$(".modal-backdrop").forEach(m=>m.onclick=e=>{if(e.target===m)closeModal(m.id)});document.addEventListener("keydown",e=>{if(e.key==="Escape")$$(".modal-backdrop:not(.hidden)").forEach(m=>closeModal(m.id))});
preloadSoundEffects();if(IS_BROADCAST_VIEW){initializeBroadcastView()}else{state.settings.integration.enabled=false;state.session.active=false;state.queue=[];localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderAll();setTimeout(()=>scheduleBroadcastPublish(true),700)}
