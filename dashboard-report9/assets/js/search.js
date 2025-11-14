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

const allDamages = getMergedDamages(); // 最初に1回取得

const monthOptions = [...new Set(allDamages.map(d => d.inspectionTime.substr(0,7)))]
  .sort((a,b) => a < b ? 1 : a > b ? -1 : 0);
monthOptions.forEach(m => { 
  const [year, month] = m.split('-');
  const formatted = `${year}年${parseInt(month,10)}月`;
  const o = document.createElement('option');
  o.value = m;       
  o.textContent = formatted; 
  monthFilter.appendChild(o); 
});

// ★ 修正箇所： 「大」「中」「小」の順序でソートするロジックを追加
const severityOrder = { "大": 1, "中": 2, "小": 3 };
const severityOptions = [...new Set(allDamages.map(d => d.severity))]
  .sort((a, b) => (severityOrder[a] || 99) - (severityOrder[b] || 99)); // 指定順にソート

severityOptions.forEach(s => {
  const o = document.createElement('option');
  o.textContent = s;
  severityFilter.appendChild(o);
});
// --- 修正ここまで ---

[...new Set(allDamages.map(d => d.type))].forEach(t => { 
  const o = document.createElement('option'); 
  o.textContent = t; 
  typeFilter.appendChild(o); 
});

// ===== 詳細表示関数 =====
function showDetail(d) {
  // ★ 1. パネル表示 (マップのコンテナサイズが変わる)
  document.getElementById("damage-card").classList.remove("hidden");
  document.getElementById("no-selection").classList.add("hidden");
  
  // ★ 2. invalidateSize() を flyTo の前に実行
  if (map.invalidateSize) {
      map.invalidateSize();
  }

  document.getElementById("type").textContent = d.type;
  document.getElementById("severity").textContent = d.severity;
  document.getElementById("date").textContent = d.inspectionTime;
  document.getElementById("gps").textContent = d.gps;
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

  // ===== 報告書作成ボタン =====
  const btn = document.getElementById("toReportBtn");
  btn.classList.remove("hidden");
  btn.onclick = () => {
    localStorage.setItem("selectedDamage", JSON.stringify(d));
    window.location.href = "report.html";
  };

  // ===== マップで表示ボタン =====
  const toMap = document.getElementById('toMapBtn');
  if (toMap) {
    toMap.classList.remove("hidden");
    toMap.onclick = () => {
      localStorage.setItem('selectedDamage', JSON.stringify(d));
      window.location.href = 'index.html';
    };
  }

  // ===== 削除ボタン =====
  const deleteBtn = document.getElementById('deleteDamageBtn');
  if (deleteBtn) {
    deleteBtn.classList.remove("hidden");
    deleteBtn.onclick = async () => {
        if (confirm('この損傷データを削除しますか？\n（マップや検索結果に表示されなくなります）')) {
            await saveOverride(d.id, { deleted: true });
            
            document.getElementById("damage-card").classList.add("hidden");
            document.getElementById("no-selection").classList.remove("hidden");
            
            btn.classList.add("hidden");
            toMap.classList.add("hidden");
            deleteBtn.classList.add("hidden");

            // ★ パネルを閉じたときにも invalidateSize が必要
            if (map.invalidateSize) {
                map.invalidateSize();
            }
            
            updateDisplay(); 
        }
    };
  }

  // ★ 3. flyTo を実行
  // (invalidateSize により、新しいマップの中心に正しく移動する)
  const targetZoom = Math.max(map.getZoom(), 16);
  if (map.flyTo) {
    map.flyTo([d.lat, d.lng], targetZoom, { duration: 0.5 });
  } else {
    map.setView([d.lat, d.lng], targetZoom);
  }
  
  // ★ 4. 削除： 補正パン (panBy) のロジックは不要

  // 既存の選択マーカー強調を解除
  if (selectedMarker && selectedMarker.setStyle) {
    selectedMarker.setStyle({ radius: 8, weight: 2 });
  }
  // 対象マーカーを強調
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

  const matched = getMergedDamages().filter(d =>
    (month === '全て' || d.inspectionTime.substr(0,7) === month) &&
    (severity === '全て' || d.severity === severity) &&
    (type === '全て' || d.type === type) &&
    (status === '全て' || d.status === status)
  );
  if (resultCount) resultCount.textContent = `(${matched.length}件)`;
  matched.forEach(d => {
    const color = d.severity === '大' ? '#ef4444' : d.severity === '中' ? '#f59e0b' : '#10b981';
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
    div.textContent = `${d.type} / ${d.severity} / ${d.inspectionTime} / ${getStatusLabel(d.status)}`;
    div.setAttribute('data-damage-id', String(d.id));
    div.onclick = () => {
      showDetail(d);
    };
    resultList.appendChild(div);
    if (selectedDamage && selectedDamage.id === d.id) {
      if (selectedResultDiv) selectedResultDiv.classList.remove('selected');
      div.classList.add('selected');
      selectedResultDiv = div;
    }
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
const availableMonths = new Set(monthOptions.map(m => m.value));
if (monthFilter.value !== '全て' && !availableMonths.has(monthFilter.value)) {
  monthFilter.value = '全て';
}
if(localStorage.getItem("filterSeverity")) severityFilter.value = localStorage.getItem("filterSeverity");
if(localStorage.getItem("filterType")) typeFilter.value = localStorage.getItem("filterType");
if(localStorage.getItem("filterStatus")) statusFilter.value = localStorage.getItem("filterStatus");

// 初回表示
updateDisplay();
if (selectedDamage) {
  const initial = getMergedDamages().find(x => x.id === selectedDamage.id);
  if (initial) {
    const div = document.querySelector(`[data-damage-id="${selectedDamage.id}"]`);
    if (div) {
      div.classList.add('selected');
      selectedResultDiv = div;
      showDetail(initial);
      try { div.scrollIntoView({ block: 'nearest' }); } catch(_) {}
    }
  }
}

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
if (localStorage.getItem('sidebarCollapsed') === '1') {
  sidebar.classList.add('sidebar-collapsed');
  document.querySelectorAll('.sidebar-text').forEach(e => e.classList.add('hidden-text'));
}
toggle.addEventListener("click", () => {
  const collapsed = sidebar.classList.toggle("sidebar-collapsed");
  document.querySelectorAll(".sidebar-text").forEach(e => e.classList.toggle("hidden-text"));
  localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
  
  // ★ サイドバー開閉時にも invalidateSize が必要
  // CSSアニメーション(width 0.3s)の完了を待つ
  setTimeout(() => {
      if (map.invalidateSize) {
          map.invalidateSize();
      }
  }, 350); // 300ms (CSS) + 50ms バッファ
});