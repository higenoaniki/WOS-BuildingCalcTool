// =============================
// データ
// =============================
let buildingData = [];

// 建物名
const buildingNames = {
  B001:"溶鉱炉", B002:"大使館", B003:"盾兵舎",
  B004:"槍兵舎", B005:"弓兵舎", B006:"司令部",
  B007:"軍医所", B008:"戦争学園"
};

// =============================
// 初期ロード
// =============================
async function loadData(){
  const res = await fetch("https://script.google.com/macros/s/AKfycbwCCYnfPMJaR90xVNr_9r82Je0L61XqgJfiQkXDD2zAXVh8sAtHupAQRoY92Kjl0KnJ5Q/exec");
  buildingData = await res.json();

  initBuffUI();
  addRow();
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

// =============================
// 基礎バフ調整
// =============================
function adjustBuff(delta){
  const input = document.getElementById("baseBuff");
  let val = Number(input.value) || 0;

  val += delta;

  // 小数1桁に整形
  input.value = Math.round(val * 10) / 10;
}

// =============================
// 行追加
// =============================
function addRow(){
  const tr=document.createElement("tr");

  tr.innerHTML=`
    <td><select class="b"></select></td>
    <td><select class="s"></select></td>
    <td><select class="e"></select></td>
    <td><button onclick="this.closest('tr').remove()">×</button></td>
  `;

  tbody.appendChild(tr);
  initRow(tr);
}

// =============================
function initRow(tr){
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
  };

  s.onchange=()=>filterEnd(s,e);
}

// =============================
function setLv(id,s,e){
  const rows=buildingData
    .filter(r=>r.building_id===id)
    .sort((a,b)=>a.level_index-b.level_index);

  s.innerHTML="";
  e.innerHTML="";

  rows.forEach(r=>{
    s.add(new Option(r.level_code,r.level_index));
    e.add(new Option(r.level_code,r.level_index));
  });

  filterEnd(s,e);
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

  detail.innerHTML=
`肉：${formatM(res.meat)}
木：${formatM(res.wood)}
石炭：${formatM(res.coal)}
鉄：${formatM(res.iron)}
火晶：${res.fire.toLocaleString()}
錬成火晶：${res.refined.toLocaleString()}`;

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
