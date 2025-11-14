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

// ===== パネル要素参照 =====
const statusPanel = document.getElementById('status-panel');
const statusMeta = document.getElementById('status-meta');
const responseDateInput = document.getElementById('responseDate');
const responseDetailsInput = document.getElementById('responseDetails');
const responseNotesInput = document.getElementById('responseNotes');
const saveStatusBtn = document.getElementById('saveStatus');
const closeStatusBtn = document.getElementById('closeStatus');
const toSearchBtn = document.getElementById('toSearch');
const deleteDamageBtn = document.getElementById('deleteDamage');
let currentDamageId = null;
let currentStatus = 'pending';
let selectedMarker = null;


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
    statusMeta.textContent = `#${d.id} ${d.type} / ${d.severity} / ${d.inspectionTime}`;
	responseDateInput.value = d.responseDate || '';
	responseDetailsInput.value = d.responseDetails || '';
	responseNotesInput.value = d.responseNotes || '';
	setStatusButtons(currentStatus);

	// ★ 1. パネル表示 (マップのコンテナサイズが変わる)
    statusPanel.style.display = 'flex'; 

    // ★ 復元： 画像表示ロジック
    const imgEl = document.getElementById('status-image');
    if (imgEl) {
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
    }

    // ★ 2. invalidateSize() を flyTo の前に実行
    // これで Leaflet はコンテナサイズが変更されたことを認識する
    if (map.invalidateSize) {
        map.invalidateSize();
    }

	// マーカー強調
	if (selectedMarker && selectedMarker.setStyle) {
		selectedMarker.setStyle({ radius: 8, weight: 2 });
	}
	const mk = markers[d.id];
	if (mk && mk.setStyle) {
		mk.setStyle({ radius: 12, weight: 4 });
		selectedMarker = mk;
	}
  
    // ★ 3. flyTo を実行
    // (invalidateSize により、新しいマップの中心に正しく移動する)
    const targetZoom = Math.max(map.getZoom(), 16);
    if (map.flyTo) {
        map.flyTo([d.lat, d.lng], targetZoom, { duration: 0.5 });
    } else {
        map.setView([d.lat, d.lng], targetZoom);
    }
  
    // ★ 削除： 補正パン (panBy) のロジックは不要
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
		saveStatusBtn.addEventListener('click', async () => {
			if (currentDamageId == null) return;
			let dateToSave = responseDateInput.value;
			if (currentStatus === 'completed' && !dateToSave) {
				dateToSave = formatToday();
				responseDateInput.value = dateToSave;
			}
            
            // ★ 修正: saveOverride を削除し、damages 配列を直接変更 (リロードで戻る)
            const damageToUpdate = damages.find(d => d.id === currentDamageId);
            if (damageToUpdate) {
                Object.assign(damageToUpdate, {
                    status: currentStatus,
                    responseDate: currentStatus === 'completed' ? dateToSave : '',
                    responseDetails: responseDetailsInput.value,
                    responseNotes: responseNotesInput.value,
                });
            }
			// await saveOverride(...) // ★ 削除
			updateMarkers();
		});
	}
	if (closeStatusBtn) {
		closeStatusBtn.addEventListener('click', () => {
			statusPanel.style.display = 'none';
            // ★ パネルを閉じたときにも invalidateSize が必要
            if (map.invalidateSize) {
                map.invalidateSize();
            }
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
    if (deleteDamageBtn) {
        deleteDamageBtn.addEventListener('click', async () => {
            if (currentDamageId == null) return;
            // ★ 修正: 確認メッセージを変更
            if (confirm('この損傷データを削除しますか？\n（この操作はリロードすると元に戻ります）')) {
                // ★ 修正: saveOverride を削除し、damages 配列のオブジェクトに deleted フラグを立てる
                const damageToMarkDeleted = damages.find(d => d.id === currentDamageId);
                if (damageToMarkDeleted) {
                    damageToMarkDeleted.deleted = true; 
                }
                // await saveOverride(currentDamageId, { deleted: true }); // ★ 削除
                
                statusPanel.style.display = 'none';
                // ★ パネルを閉じたときにも invalidateSize が必要
                if (map.invalidateSize) {
                    map.invalidateSize();
                }
                updateMarkers();
            }
        });
    }
}

// ★ 修正: getMergedDamages() -> damages.filter(...)
const allDamages = damages.filter(d => !(d.deleted === true)); // 最初に一回だけ取得

const monthOptions = [...new Set(allDamages.map(d => (d.inspectionTime || '').substr(0,7)))]
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

// ===== マーカーを更新する関数 =====
function updateMarkers() {
  // 既存マーカーを削除
  Object.values(markers).forEach(m => map.removeLayer(m));
  markers = {};

  const month = monthFilter.value;
  const severity = severityFilter.value;
  const type = typeFilter.value;
  const status = statusFilter.value;

  // ★ 修正: getMergedDamages() -> damages.filter(...)
  const latest = damages.filter(d => !(d.deleted === true)); // フィルターのたびに最新を取得
  latest.filter(d =>
    (month === '全て' || (d.inspectionTime || '').substr(0,7) === month) &&
    (severity === '全て' || d.severity === severity) &&
    (type === '全て' || d.type === type) &&
    (status === '全て' || d.status === status)
  ).forEach(d => {
    const color = d.severity === '大' ? '#ef4444' : d.severity === '中' ? '#f59e0b' : '#10b981';
    const marker = L.circleMarker([d.lat, d.lng], {
      radius: 8,
      color,
      fillColor: color,
      fillOpacity: 0.8,
      weight: 2
    }).addTo(map);
    marker.on('click', () => {
        // ★ 修正: getMergedDamages() -> damages
		const current = damages.find(x => x.id === d.id) || d;
		openStatusPanel(current);
	});
    markers[d.id] = marker;
  });
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

// ===== リセットボタン機能 =====
const resetBtn = document.getElementById('reset-filters');
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    if (monthFilter) monthFilter.value = '全て';
    if (severityFilter) severityFilter.value = '全て';
    if (typeFilter) typeFilter.value = '全て';
    if (statusFilter) statusFilter.value = '全て';

    localStorage.setItem("filterMonth", '全て');
    localStorage.setItem("filterSeverity", '全て');
    localStorage.setItem("filterType", '全て');
    localStorage.setItem("filterStatus", '全て');

    if (typeof selectedMarker !== 'undefined' && selectedMarker && selectedMarker.setStyle) {
      selectedMarker.setStyle({ radius: 8, weight: 2 });
      selectedMarker = null;
    }
    const infoPanel = document.getElementById("status-panel");
    if (infoPanel) {
        infoPanel.style.display = "none";
        // ★ パネルを閉じたときにも invalidateSize が必要
        if (map.invalidateSize) {
            map.invalidateSize();
        }
    }

    if (typeof map !== 'undefined' && map.setView) {
      map.setView([35.5732, 139.3704], 13);
    }
    updateMarkers();
  });
}


// ===== 保存されたフィルターを復元 =====
if(localStorage.getItem("filterMonth")) monthFilter.value = localStorage.getItem("filterMonth");
const availableMonths = new Set(monthOptions.map(m => m.value));
if (monthFilter.value !== '全て' && !availableMonths.has(monthFilter.value)) {
  monthFilter.value = '全て';
}
if(localStorage.getItem("filterSeverity")) severityFilter.value = localStorage.getItem("filterSeverity");
if(localStorage.getItem("filterType")) typeFilter.value = localStorage.getItem("filterType");
if(localStorage.getItem("filterStatus")) statusFilter.value = localStorage.getItem("filterStatus");

// ===== 初期マーカー表示 =====
updateMarkers();

// 選択済み損傷がある場合、マーカー更新後にパネルを開く
if (selectedDamage) {
    // ★ 修正: getMergedDamages() -> damages
	const d = damages.find(x => x.id === selectedDamage.id);
	if (d) {
	    openStatusPanel(d);
	}
}

// ===== サイドバー折りたたみ =====
const sidebar = document.getElementById("sidebar");
const toggle = document.getElementById("toggleSidebar");
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