// ===== 道路損傷マップ（index.html用） =====

// 選択された損傷があればその位置を中心に、それ以外は相模原市中心
const selectedDamage = JSON.parse(localStorage.getItem("selectedDamage") || 'null');
const mapCenter = selectedDamage ? [selectedDamage.lat, selectedDamage.lng] : [35.5732, 139.3704];

// ===== Leaflet マップ初期化 =====
const map = L.map('map').setView(mapCenter, 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// ===== マーカー管理 =====
let markers = {};
const monthFilter = document.getElementById("month-filter");
const severityFilter = document.getElementById("severity-filter");
const typeFilter = document.getElementById("type-filter");
const statusFilter = document.getElementById("status-filter");

// ===== フィルター選択肢自動生成（年月を整形・降順ソート） =====
// 対応状況のローカル上書きをマージ
const SAVED_KEY = 'damagesStatusOverrides';
const overrides = JSON.parse(localStorage.getItem(SAVED_KEY) || '{}');
const mergedDamages = damages.map(d => ({ ...d, ...(overrides[d.id] || {}) }));

// ===== パネル要素参照 =====
const statusPanel = document.getElementById('status-panel');
const statusMeta = document.getElementById('status-meta');
const responseDateInput = document.getElementById('responseDate');
const responseDetailsInput = document.getElementById('responseDetails');
const responseNotesInput = document.getElementById('responseNotes');
const saveStatusBtn = document.getElementById('saveStatus');
const closeStatusBtn = document.getElementById('closeStatus');
const toSearchBtn = document.getElementById('toSearch');
let currentDamageId = null;
let currentStatus = 'pending';
let selectedMarker = null;

function saveOverride(id, payload){
	const key = 'damagesStatusOverrides';
	const next = { ...(JSON.parse(localStorage.getItem(key) || '{}')) };
	next[id] = { ...(next[id]||{}), ...payload };
	localStorage.setItem(key, JSON.stringify(next));
}

function setStatusButtons(status){
	const buttons = document.querySelectorAll('#status-panel .status-btn');
	buttons.forEach(btn => {
		const active = btn.getAttribute('data-status') === status;
		btn.style.border = active ? '2px solid currentColor' : '1px solid #374151';
		btn.style.background = active ? '#1f2937' : '#111827';
		btn.style.color = active ? '#facc15' : '#f9fafb';
	});
	if (status === 'completed') {
		responseDateInput.removeAttribute('disabled');
	} else {
		responseDateInput.setAttribute('disabled','');
		responseDateInput.value = '';
	}
}

function formatToday(){
	const d = new Date();
	const m = ('0' + (d.getMonth()+1)).slice(-2);
	const day = ('0' + d.getDate()).slice(-2);
	return `${d.getFullYear()}-${m}-${day}`;
}

function openStatusPanel(d){
	currentDamageId = d.id;
	currentStatus = d.status || 'pending';
	statusMeta.textContent = `#${d.id} ${d.type} / ${d.severity} / ${d.date}`;
	responseDateInput.value = d.responseDate || '';
	responseDetailsInput.value = d.responseDetails || '';
	responseNotesInput.value = d.responseNotes || '';
	setStatusButtons(currentStatus);
	statusPanel.style.display = 'flex';
	// マーカー強調
	if (selectedMarker && selectedMarker.setStyle) {
		selectedMarker.setStyle({ radius: 8, weight: 2 });
	}
	const mk = markers[d.id];
	if (mk && mk.setStyle) {
		mk.setStyle({ radius: 12, weight: 4 });
		selectedMarker = mk;
	}
}

// ステータスボタンイベント
if (statusPanel) {
	statusPanel.querySelectorAll('.status-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			currentStatus = btn.getAttribute('data-status');
			setStatusButtons(currentStatus);
		});
	});
	if (saveStatusBtn) {
		saveStatusBtn.addEventListener('click', () => {
			if (currentDamageId == null) return;
			// completed かつ 日付未入力なら今日を自動セット
			let dateToSave = responseDateInput.value;
			if (currentStatus === 'completed' && !dateToSave) {
				dateToSave = formatToday();
				responseDateInput.value = dateToSave; // 画面にも反映
			}
			saveOverride(currentDamageId, {
				status: currentStatus,
				responseDate: currentStatus === 'completed' ? dateToSave : '',
				responseDetails: responseDetailsInput.value,
				responseNotes: responseNotesInput.value,
			});
			updateMarkers();
		});
	}
	if (closeStatusBtn) {
		closeStatusBtn.addEventListener('click', () => {
			statusPanel.style.display = 'none';
		});
	}
	if (toSearchBtn) {
		toSearchBtn.addEventListener('click', () => {
			if (currentDamageId == null) return;
			const d = damages.find(x => x.id === currentDamageId);
			if (d) {
				localStorage.setItem('selectedDamage', JSON.stringify(d));
				window.location.href = 'search.html';
			}
		});
	}
}

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

// ===== マーカーを更新する関数 =====
function updateMarkers() {
  // 既存マーカーを削除
  Object.values(markers).forEach(m => map.removeLayer(m));
  markers = {};

  const month = monthFilter.value;
  const severity = severityFilter.value;
  const type = typeFilter.value;
  const status = statusFilter.value;

  // フィルターに一致する損傷のみ表示
  mergedDamages.filter(d =>
    (month === '全て' || d.date.substr(0,7) === month) &&
    (severity === '全て' || d.severity === severity) &&
    (type === '全て' || d.type === type) &&
    (status === '全て' || d.status === status)
  ).forEach(d => {
    const color = d.severity === '高度' ? '#ef4444' : d.severity === '中度' ? '#f59e0b' : '#10b981';
    const marker = L.circleMarker([d.lat, d.lng], {
      radius: 8,
      color,
      fillColor: color,
      fillOpacity: 0.8,
      weight: 2
    }).addTo(map);
    // ポップアップは出さない
    marker.on('click', () => openStatusPanel(d));
    markers[d.id] = marker;
  });
}

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

// ===== 詳細ページへ遷移（検索へ） =====
function selectDamage(id) {
  const d = damages.find(x => x.id === id);
  if (d) {
    localStorage.setItem("selectedDamage", JSON.stringify(d));
    window.location.href = "search.html";
  }
}

// ===== フィルター変更イベント（既存） =====
[monthFilter, severityFilter, typeFilter, statusFilter].forEach(el => {
  el.addEventListener("change", () => {
    localStorage.setItem("filterMonth", monthFilter.value);
    localStorage.setItem("filterSeverity", severityFilter.value);
    localStorage.setItem("filterType", typeFilter.value);
    localStorage.setItem("filterStatus", statusFilter.value);
    updateMarkers();
  });
});

// ===== 保存されたフィルターを復元 =====
if(localStorage.getItem("filterMonth")) monthFilter.value = localStorage.getItem("filterMonth");
if(localStorage.getItem("filterSeverity")) severityFilter.value = localStorage.getItem("filterSeverity");
if(localStorage.getItem("filterType")) typeFilter.value = localStorage.getItem("filterType");
if(localStorage.getItem("filterStatus")) statusFilter.value = localStorage.getItem("filterStatus");

// ===== 初期マーカー表示 =====
updateMarkers();

// 選択済み損傷がある場合、マーカー更新後にパネルを開く
if (selectedDamage) {
	const d = mergedDamages.find(x => x.id === selectedDamage.id) || selectedDamage;
	openStatusPanel(d);
}

// ===== サイドバー折りたたみ =====
const sidebar = document.getElementById("sidebar");
const toggle = document.getElementById("toggleSidebar");
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
