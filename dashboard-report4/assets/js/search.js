// ===== 道路損傷検索マップ（search.html用） =====
const selectedDamage = JSON.parse(localStorage.getItem("selectedDamage") || 'null');
const mapCenter = selectedDamage ? [selectedDamage.lat, selectedDamage.lng] : [35.5732, 139.3704];

const map = L.map('map').setView(mapCenter, 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let markers = {};
let selectedMarker = null;
let selectedResultDiv = null;
const monthFilter = document.getElementById("month-filter");
const severityFilter = document.getElementById("severity-filter");
const typeFilter = document.getElementById("type-filter");
const statusFilter = document.getElementById("status-filter");
const resultList = document.getElementById("result-list");
const resultCount = document.getElementById("result-count");
const resetBtn = document.getElementById("reset-filters");

// ===== フィルター選択肢自動生成（年月を整形・降順ソート） =====
// 対応状況のローカル上書きをマージ
const SAVED_KEY = 'damagesStatusOverrides';
const overrides = JSON.parse(localStorage.getItem(SAVED_KEY) || '{}');
const mergedDamages = damages.map(d => ({ ...d, ...(overrides[d.id] || {}) }));

const monthOptions = [...new Set(mergedDamages.map(d => d.date.substr(0,7)))]
  .sort((a,b) => a < b ? 1 : a > b ? -1 : 0);
monthOptions.forEach(m => { 
  const [year, month] = m.split('-');
  const formatted = `${year}年${parseInt(month,10)}月`;
  const o = document.createElement('option');
  o.value = m;       
  o.textContent = formatted; 
  monthFilter.appendChild(o); 
});
[...new Set(mergedDamages.map(d => d.severity))].forEach(s => { 
  const o = document.createElement('option'); 
  o.textContent = s; 
  severityFilter.appendChild(o); 
});
[...new Set(mergedDamages.map(d => d.type))].forEach(t => { 
  const o = document.createElement('option'); 
  o.textContent = t; 
  typeFilter.appendChild(o); 
});

// ===== ステータスラベル取得 =====
function getStatusLabel(status) {
  const labels = {
    'pending': '未対応',
    'in-progress': '対応中', 
    'completed': '対応完了',
    'cancelled': '対応不要'
  };
  return labels[status] || '未対応';
}

function toConfidence(value) {
  if (typeof value === 'number') {
    const v = Math.max(0, Math.min(1, value));
    return v.toFixed(1);
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (!isNaN(parseFloat(t))) {
      const num = parseFloat(t);
      const v = Math.max(0, Math.min(1, num));
      return v.toFixed(1);
    }
    if (t === '大') return '0.9';
    if (t === '中') return '0.6';
    if (t === '小') return '0.3';
  }
  return '';
}

// ===== 詳細表示関数 =====
function showDetail(d) {
  document.getElementById("damage-card").classList.remove("hidden");
  document.getElementById("no-selection").classList.add("hidden");
  document.getElementById("type").textContent = d.type;
  document.getElementById("severity").textContent = d.severity;
  document.getElementById("date").textContent = d.date;
  document.getElementById("gps").textContent = d.gps;
  document.getElementById("size").textContent = toConfidence(d.size);
  document.getElementById('patrolTeam').textContent = d.patrolTeam || '';
  document.getElementById('vehicle').textContent = d.vehicle || '';
  document.getElementById('weather').textContent = d.weather || '';

  // 画像表示（フォールバック付き）
  const imgEl = document.getElementById('damage-image');
  if (d.image) {
    imgEl.style.display = 'block';
    imgEl.alt = d.type || '損傷画像';
    imgEl.onerror = () => { imgEl.src = 'assets/images/placeholder.png'; };
    imgEl.src = d.image;
  } else {
    imgEl.style.display = 'block';
    imgEl.alt = '画像なし';
    imgEl.src = 'assets/images/placeholder.png';
  }

  const voice = document.getElementById("voice");
  if(d.voice) { voice.src = d.voice; voice.style.display = 'block'; }
  else { voice.style.display = 'none'; }

  document.getElementById("voice-text").textContent = d.voiceText;

  // ===== 報告書作成ボタン追加 =====
  const btn = document.getElementById("toReportBtn");
  btn.classList.remove("hidden");  // hidden を外す
  btn.onclick = () => {
    localStorage.setItem("selectedDamage", JSON.stringify(d));
    window.location.href = "report.html";
  };

  // ===== マップで表示ボタン =====
  const toMap = document.getElementById('toMapBtn');
  if (toMap) {
    toMap.classList.remove('hidden');
    toMap.onclick = () => {
      localStorage.setItem('selectedDamage', JSON.stringify(d));
      window.location.href = 'index.html';
    };
  }

  // 中心へ移動し、少しズーム
  map.setView([d.lat, d.lng], Math.max(map.getZoom(), 14));

  // 既存の選択マーカー強調を解除
  if (selectedMarker && selectedMarker.setStyle) {
    selectedMarker.setStyle({ radius: 8, weight: 2 });
  }
  // 対象マーカーを強調（半径アップ/ウェイト強化）
  const mk = markers[d.id];
  if (mk && mk.setStyle) {
    mk.setStyle({ radius: 11, weight: 4 });
    selectedMarker = mk;
  }

  // リスト側の選択ハイライトを更新
  if (selectedResultDiv) selectedResultDiv.classList.remove('selected');
  const div = document.querySelector(`[data-damage-id="${d.id}"]`);
  if (div) { div.classList.add('selected'); selectedResultDiv = div; }
}

// ===== マーカー表示 & 検索結果リスト =====
function updateDisplay() {
  Object.values(markers).forEach(m => map.removeLayer(m));
  markers = {};
  resultList.innerHTML = '';

  const month = monthFilter.value;
  const severity = severityFilter.value;
  const type = typeFilter.value;
  const status = statusFilter.value;

  const matched = mergedDamages.filter(d =>
    (month === '全て' || d.date.substr(0,7) === month) &&
    (severity === '全て' || d.severity === severity) &&
    (type === '全て' || d.type === type) &&
    (status === '全て' || d.status === status)
  );
  if (resultCount) resultCount.textContent = `(${matched.length}件)`;
  matched.forEach(d => {
    const color = d.severity === '高度' ? '#ef4444' : d.severity === '中度' ? '#f59e0b' : '#10b981';
    const marker = L.circleMarker([d.lat, d.lng], {
      radius: 8,
      color,
      fillColor: color,
      fillOpacity: 0.8,
      weight: 2
    }).addTo(map);
    marker.on('click', () => showDetail(d));
    markers[d.id] = marker;

    const div = document.createElement('div');
    div.className = 'result-item';
    div.textContent = `${d.type} / ${d.severity} / ${d.date} / ${getStatusLabel(d.status)}`;
    div.setAttribute('data-damage-id', String(d.id));
    div.onclick = () => { showDetail(d); map.setView([d.lat,d.lng],14); };
    resultList.appendChild(div);
  });
}

// ===== イベント =====
[monthFilter, severityFilter, typeFilter, statusFilter].forEach(el => {
  el.addEventListener("change", () => {
    localStorage.setItem("filterMonth", monthFilter.value);
    localStorage.setItem("filterSeverity", severityFilter.value);
    localStorage.setItem("filterType", typeFilter.value);
    localStorage.setItem("filterStatus", statusFilter.value);
    updateDisplay();
  });
});

// 保存されたフィルター復元
if(localStorage.getItem("filterMonth")) monthFilter.value = localStorage.getItem("filterMonth");
if(localStorage.getItem("filterSeverity")) severityFilter.value = localStorage.getItem("filterSeverity");
if(localStorage.getItem("filterType")) typeFilter.value = localStorage.getItem("filterType");
if(localStorage.getItem("filterStatus")) statusFilter.value = localStorage.getItem("filterStatus");

// 初回表示
if(selectedDamage) showDetail(selectedDamage);
updateDisplay();

// ===== サイドバー折りたたみ =====
const sidebar = document.getElementById("sidebar");
const toggle = document.getElementById("toggleSidebar");
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    monthFilter.value = '全て';
    severityFilter.value = '全て';
    typeFilter.value = '全て';
    statusFilter.value = '全て';
    localStorage.setItem("filterMonth", '全て');
    localStorage.setItem("filterSeverity", '全て');
    localStorage.setItem("filterType", '全て');
    localStorage.setItem("filterStatus", '全て');
    updateDisplay();
  });
}
// 保存されたサイドバー状態を復元
if (localStorage.getItem('sidebarCollapsed') === '1') {
  sidebar.classList.add('sidebar-collapsed');
  document.querySelectorAll('.sidebar-text').forEach(e => e.classList.add('hidden-text'));
}
toggle.addEventListener("click", () => {
  const collapsed = sidebar.classList.toggle("sidebar-collapsed");
  document.querySelectorAll(".sidebar-text").forEach(e => e.classList.toggle("hidden-text"));
  localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
});

