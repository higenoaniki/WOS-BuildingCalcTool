// =============================
// データ
// =============================
let buildingData = [];
const STORAGE_KEY = "wos-building-calc-state-v2";
const LEGACY_STORAGE_KEY = "wos-building-calc-state-v1";
const SHARE_KEY_PREFIX = "WBC1";
let saveTimer = null;
let isRestoringState = false;
let appStore = {
  activePresetId: null,
  presets: []
};

// 建物名
const buildingNames = {
  B001:"溶鉱炉", B002:"大使館", B003:"盾兵舎",
  B004:"槍兵舎", B005:"弓兵舎", B006:"司令部",
  B007:"軍医所", B008:"戦争学園"
};

const resourceMeta = [
  {
    key: "wood",
    label: "木",
    icon: "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/item_icon_103.png"
  },
  {
    key: "meat",
    label: "肉",
    icon: "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/06/10114534/item_icon_100011.png"
  },
  {
    key: "coal",
    label: "石炭",
    icon: "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/06/10114623/item_icon_100031.png"
  },
  {
    key: "iron",
    label: "鉄",
    icon: "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/item_icon_105.png"
  },
  {
    key: "fire",
    label: "火晶",
    icon: "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/07/item_icon_100081.png"
  },
  {
    key: "refined",
    label: "錬成火晶",
    icon: "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/21122055/item_icon_100082.png"
  }
];

// =============================
// 初期ロード
// =============================
async function loadData(){
  const res = await fetch("https://script.google.com/macros/s/AKfycbwCCYnfPMJaR90xVNr_9r82Je0L61XqgJfiQkXDD2zAXVh8sAtHupAQRoY92Kjl0KnJ5Q/exec");
  buildingData = await res.json();

  initBuffUI();
  initPresetUI();
  setupPersistenceListeners();

  restoreState();
}
loadData();

// =============================
// バフUI
// =============================
function initBuffUI(){
  const jin = document.getElementById("jinman");
  const pet = document.getElementById("pet");
  const agn = document.getElementById("agnes");

  for(let i=0;i<=5;i++){
    jin.add(new Option(i===0?"なし":`Lv${i}`,i));
    pet.add(new Option(i===0?"なし":`Lv${i}`,i));
    agn.add(new Option(i===0?"なし":`Lv${i}`,i));
  }

  jin.onchange = updateBuffInfo;
  pet.onchange = updateBuffInfo;
  agn.onchange = updateBuffInfo;

  updateBuffInfo();
}

// =============================
function updateBuffInfo(){
  const jinLv = Number(jinman.value);
  const petLv = Number(pet.value);
  const agnLv = Number(agnes.value);

  const jinVal = [0,3,6,9,12,15][jinLv];
  const petVal = [0,5,7,9,12,15][petLv];
  const agnVal = [0,2,3,4,6,8][agnLv];

  jinmanInfo.innerText = jinLv>0 ? `建造+${jinVal}% / 資源-${jinVal}%` : "";
  petInfo.innerText = petLv>0 ? `建造+${petVal}%` : "";
  agnesInfo.innerText = agnLv>0 ? `-${agnVal}時間 / 回` : "";
}

function initPresetUI(){
  presetSelect.addEventListener("change",()=>{
    switchPreset(presetSelect.value);
  });

  createPresetBtn.addEventListener("click",createPresetFromCurrent);
  savePresetBtn.addEventListener("click",saveCurrentPreset);
  deletePresetBtn.addEventListener("click",deleteCurrentPreset);
  generateKeyBtn.addEventListener("click",generateShareKey);
  copyKeyBtn.addEventListener("click",copyShareKey);
  restoreKeyBtn.addEventListener("click",restoreFromShareKey);
}

// =============================
// 基礎バフ調整
// =============================
function adjustBuff(delta){
  const input = document.getElementById("baseBuff");
  let val = Number(input.value) || 0;

  val += delta;

  // 小数1桁に整形
  input.value = Math.round(val * 10) / 10;
  queueSave();
}

// =============================
// 行追加
// =============================
function addRow(rowState=null){
  const tr=document.createElement("tr");

  tr.innerHTML=`
    <td><select class="b"></select></td>
    <td><select class="s"></select></td>
    <td><select class="e"></select></td>
    <td><button onclick="removeRow(this)">×</button></td>
  `;

  tbody.appendChild(tr);
  initRow(tr,rowState);
  queueSave();
}

function removeRow(button){
  const tr = button.closest("tr");
  if(tr){
    tr.remove();
  }

  if(tbody.children.length === 0){
    addRow();
    return;
  }

  queueSave();
}

// =============================
function initRow(tr,rowState){
  const b=tr.querySelector(".b");
  const s=tr.querySelector(".s");
  const e=tr.querySelector(".e");

  b.add(new Option("選択",""));

  const ids=[...new Set(buildingData.map(x=>x.building_id))];

  ids.forEach(id=>{
    b.add(new Option(buildingNames[id]||id,id));
  });

  b.onchange=()=>{
    if(b.value){
      setLv(b.value,s,e);
    }else{
      s.innerHTML="";
      e.innerHTML="";
    }
    queueSave();
  };

  s.onchange=()=>{
    filterEnd(s,e);
    if(e.selectedOptions[0]?.style.display === "none"){
      const visibleEnd=[...e.options].find(o=>o.style.display!=="none");
      if(visibleEnd){
        e.value=visibleEnd.value;
      }
    }
    queueSave();
  };

  e.onchange=queueSave;

  if(rowState?.buildingId){
    b.value=rowState.buildingId;
    if(b.value){
      setLv(b.value,s,e,rowState.startLevel,rowState.endLevel);
    }
  }
}

// =============================
function setLv(id,s,e,startLevel,endLevel){
  const rows=buildingData
    .filter(r=>r.building_id===id)
    .sort((a,b)=>a.level_index-b.level_index);

  s.innerHTML="";
  e.innerHTML="";

  rows.forEach(r=>{
    s.add(new Option(r.level_code,r.level_index));
    e.add(new Option(r.level_code,r.level_index));
  });

  if(startLevel!==undefined){
    s.value=String(startLevel);
  }

  filterEnd(s,e);

  const targetEnd=String(endLevel ?? "");
  const hasEnd=[...e.options].some(o=>o.value===targetEnd && o.style.display!=="none");

  if(hasEnd){
    e.value=targetEnd;
    return;
  }

  const firstVisible=[...e.options].find(o=>o.style.display!=="none");
  if(firstVisible){
    e.value=firstVisible.value;
  }
}

// =============================
function filterEnd(s,e){
  const start=Number(s.value);

  [...e.options].forEach(o=>{
    o.style.display = (Number(o.value)>start) ? "" : "none";
  });
}

// =============================
function getBuff(){
  const base=Number(baseBuff.value) || 0;

  const jinLv=Number(jinman.value);
  const petLv=Number(pet.value);

  const jinVal=[0,3,6,9,12,15][jinLv];
  const petVal=[0,5,7,9,12,15][petLv];

  const subVal=Number(sub.value);
  const lordVal=lord.checked?20:0;
  const govVal=gov.checked?10:0;

  return {
    time: base + jinVal + petVal + subVal + lordVal + govVal,
    cost: jinVal
  };
}

// =============================
function getAgnes(){
  return [0,7200,10800,14400,21600,28800][agnes.value];
}

// =============================
function calc(){
  const buff=getBuff();
  const agnes=getAgnes();

  let totalTime=0;

  let res={
    meat:0,wood:0,coal:0,iron:0,
    fire:0,refined:0
  };

  document.querySelectorAll("#tbody tr").forEach(tr=>{
    const id=tr.querySelector(".b").value;
    const s=Number(tr.querySelector(".s").value);
    const e=Number(tr.querySelector(".e").value);

    if(!id || !s || !e) return;

    const rows=buildingData.filter(r=>
      r.building_id===id &&
      r.level_index>s &&
      r.level_index<=e
    );

    rows.forEach(r=>{
      let t=Number(r.time_sec);

      t=t/(1+buff.time/100);
      t-=agnes;
      if(t<0)t=0;

      totalTime+=t;

      const rate=1-buff.cost/100;

      res.meat+=r.meat*rate;
      res.wood+=r.wood*rate;
      res.coal+=r.coal*rate;
      res.iron+=r.iron*rate;
      res.fire+=r.fire_crystal;
      res.refined+=r.refined_fire_crystal||0;
    });
  });

  const timeText=formatTime(totalTime);

  result.innerText="合計時間 "+timeText;

  detail.innerHTML = resourceMeta.map(r => {
    const value = (r.key === "fire" || r.key === "refined")
      ? res[r.key].toLocaleString()
      : formatM(res[r.key]);

    return `
      <div class="resource-row">
        <img class="resource-icon" src="${r.icon}" alt="${r.label}">
        <span>${r.label}：${value}</span>
      </div>
    `;
  }).join("");

  copyText.value =
`【建造時間】
${timeText}

【必要資源】
肉 ${formatM(res.meat)}
木 ${formatM(res.wood)}
石炭 ${formatM(res.coal)}
鉄 ${formatM(res.iron)}
火晶 ${res.fire.toLocaleString()}
錬成火晶 ${res.refined.toLocaleString()}`;
}

// =============================
function copyResult(){
  copyText.select();
  navigator.clipboard.writeText(copyText.value);
  alert("コピーしました");
}

// =============================
function formatTime(sec){
  const d=Math.floor(sec/86400);
  const h=Math.floor((sec%86400)/3600);
  const m=Math.floor((sec%3600)/60);

  return `${d?d+"日":""}${h?h+"時間":""}${m?m+"分":""}`;
}

function formatM(n){
  return (n/1000000).toFixed(2)+"M";
}

function setupPersistenceListeners(){
  const ids=["baseBuff","jinman","pet","sub","lord","gov","agnes","presetName"];
  ids.forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;

    el.addEventListener("change",queueSave);
    el.addEventListener("input",queueSave);
  });
}

function queueSave(){
  if(isRestoringState) return;
  clearTimeout(saveTimer);
  saveTimer=setTimeout(saveCurrentPreset,150);
}

function getCurrentState(){
  const rows=[...document.querySelectorAll("#tbody tr")].map(tr=>({
    buildingId: tr.querySelector(".b").value,
    startLevel: tr.querySelector(".s").value,
    endLevel: tr.querySelector(".e").value
  }));

  return {
    rows,
    buffs:{
      baseBuff: baseBuff.value,
      jinman: jinman.value,
      pet: pet.value,
      sub: sub.value,
      lord: lord.checked,
      gov: gov.checked,
      agnes: agnes.value
    }
  };
}

function applyState(state){
  const buffs=state?.buffs || {};
  baseBuff.value = buffs.baseBuff ?? baseBuff.value;
  jinman.value = buffs.jinman ?? jinman.value;
  pet.value = buffs.pet ?? pet.value;
  sub.value = buffs.sub ?? sub.value;
  lord.checked = Boolean(buffs.lord);
  gov.checked = Boolean(buffs.gov);
  agnes.value = buffs.agnes ?? agnes.value;
  updateBuffInfo();

  tbody.innerHTML="";
  const rows=Array.isArray(state?.rows) ? state.rows : [];
  if(rows.length===0){
    addRow();
  }else{
    rows.forEach(r=>addRow(r));
  }
}

function saveStore(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(appStore));
}

function createPreset(name,state){
  const now = Date.now();
  return {
    id: `preset-${now}-${Math.random().toString(36).slice(2,7)}`,
    name: name || `構成 ${appStore.presets.length+1}`,
    updatedAt: now,
    state
  };
}

function renderPresetOptions(){
  presetSelect.innerHTML="";

  appStore.presets.forEach((p,index)=>{
    const displayName = (p.name || "").trim() || `構成 ${index+1}`;
    const option = new Option(displayName,p.id);
    presetSelect.add(option);
  });

  if(appStore.activePresetId){
    presetSelect.value = appStore.activePresetId;
  }

  const active = appStore.presets.find(p=>p.id===appStore.activePresetId);
  presetName.value = active?.name || "";
}

function ensureDefaultPreset(){
  if(appStore.presets.length>0) return;
  const preset=createPreset("構成 1",getCurrentState());
  appStore.presets=[preset];
  appStore.activePresetId=preset.id;
}

function loadStore(){
  const stateText=localStorage.getItem(STORAGE_KEY);
  if(stateText){
    try{
      const parsed=JSON.parse(stateText);
      if(Array.isArray(parsed?.presets)){
        appStore = {
          activePresetId: parsed.activePresetId || parsed.presets[0]?.id || null,
          presets: parsed.presets
        };
        return;
      }
    }catch{}
  }

  const legacyText = localStorage.getItem(LEGACY_STORAGE_KEY);
  if(legacyText){
    try{
      const legacyState=JSON.parse(legacyText);
      const migrated=createPreset("構成 1",legacyState);
      appStore={activePresetId:migrated.id,presets:[migrated]};
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      saveStore();
      return;
    }catch{}
  }

  appStore = {
    activePresetId: null,
    presets: []
  };
}

function saveCurrentPreset(){
  if(isRestoringState) return;

  const active=appStore.presets.find(p=>p.id===appStore.activePresetId);
  if(!active) return;

  active.name = presetName.value.trim();
  active.updatedAt = Date.now();
  active.state = getCurrentState();

  renderPresetOptions();
  saveStore();
}

function restoreState(){
  loadStore();

  isRestoringState=true;
  if(tbody.children.length===0){
    addRow();
  }
  ensureDefaultPreset();
  renderPresetOptions();

  const active=appStore.presets.find(p=>p.id===appStore.activePresetId) || appStore.presets[0];
  if(active){
    appStore.activePresetId=active.id;
    applyState(active.state);
  }
  renderPresetOptions();

  isRestoringState=false;
  saveStore();
  calc();
}

function switchPreset(presetId){
  const preset=appStore.presets.find(p=>p.id===presetId);
  if(!preset) return;

  isRestoringState=true;
  appStore.activePresetId=presetId;
  applyState(preset.state);
  renderPresetOptions();
  isRestoringState=false;
  saveStore();
  calc();
}

function createPresetFromCurrent(){
  const nextName = `構成 ${appStore.presets.length+1}`;
  const preset=createPreset(nextName,getCurrentState());
  appStore.presets.push(preset);
  appStore.activePresetId=preset.id;
  renderPresetOptions();
  saveStore();
}

function deleteCurrentPreset(){
  if(appStore.presets.length<=1){
    alert("最低1つの構成は必要です");
    return;
  }

  const index=appStore.presets.findIndex(p=>p.id===appStore.activePresetId);
  if(index<0) return;

  appStore.presets.splice(index,1);
  appStore.activePresetId=appStore.presets[Math.max(0,index-1)].id;
  switchPreset(appStore.activePresetId);
}

function encodeSharePayload(payload){
  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g,"-")
    .replace(/\//g,"_")
    .replace(/=+$/,"");
}

function decodeSharePayload(encoded){
  const normalized=encoded.replace(/-/g,"+").replace(/_/g,"/");
  const padded=normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const json=decodeURIComponent(escape(atob(padded)));
  return JSON.parse(json);
}

function generateShareKey(){
  saveCurrentPreset();
  const active=appStore.presets.find(p=>p.id===appStore.activePresetId);
  if(!active) return;

  const payload={
    version: 1,
    name: active.name,
    state: active.state
  };

  shareKey.value = `${SHARE_KEY_PREFIX}.${encodeSharePayload(payload)}`;
}

function copyShareKey(){
  if(!shareKey.value){
    generateShareKey();
  }

  if(!shareKey.value) return;
  navigator.clipboard.writeText(shareKey.value);
  alert("復元キーをコピーしました");
}

function restoreFromShareKey(){
  const text = restoreKey.value.trim();
  if(!text){
    alert("復元キーを入力してください");
    return;
  }

  if(!text.startsWith(`${SHARE_KEY_PREFIX}.`)){
    alert("復元キーの形式が正しくありません");
    return;
  }

  try{
    const encoded=text.slice(SHARE_KEY_PREFIX.length+1);
    const payload=decodeSharePayload(encoded);
    if(!payload?.state){
      throw new Error("invalid payload");
    }

    const imported=createPreset(`${payload.name || "共有構成"} (取込)`,payload.state);
    appStore.presets.push(imported);
    appStore.activePresetId=imported.id;
    switchPreset(imported.id);
    restoreKey.value="";
    alert("復元キーから構成を追加しました");
  }catch{
    alert("復元キーの読み取りに失敗しました");
  }
}
