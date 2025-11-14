// ダッシュボード描画
(function(){
  const root = document.getElementById('dashboard-root');
  if(!root) return;

  // ストア相当のユーティリティ
  // 変更: utils.js の getMergedDamages() を使用
  const mergedDamages = damages; // ★ 修正: getMergedDamages() -> damages

  const getDamagesBySeverity = (sev) => mergedDamages.filter(d => d.severity === sev);
  const getDamagesByType = (type) => mergedDamages.filter(d => d.type === type);

  const high = getDamagesBySeverity('大');
  const mid = getDamagesBySeverity('中');
  const low = getDamagesBySeverity('小');

  const stats = [
    { label: '総損傷数', value: mergedDamages.length, icon: 'activity', color: 'bg-blue-500', description: '全損傷の合計' },
    { label: '高緊急度 (大)', value: high.length, icon: 'alert', color: 'bg-red-500', description: '即時対応が必要' },
    { label: '中緊急度 (中)', value: mid.length, icon: 'trend', color: 'bg-orange-500', description: '計画的な対応が必要' },
    { label: '低緊急度 (小)', value: low.length, icon: 'users', color: 'bg-green-500', description: '監視継続' },
    // 対応率
    { label: '対応率', value: (()=>{
        const completed = mergedDamages.filter(d => d.status === 'completed').length;
        const rate = mergedDamages.length ? Math.round((completed / mergedDamages.length) * 100) : 0;
        return rate + '%';
      })(), icon: 'check', color: 'bg-emerald-600', description: '完了/総件数' },
  ];

  const typeList = [
    { type: '縦状亀裂', color: 'bg-blue-100 text-blue-800' },
    { type: 'ポットホール', color: 'bg-red-100 text-red-800' },
    { type: '横状亀裂', color: 'bg-orange-100 text-orange-800' },
    { type: '網状亀裂', color: 'bg-purple-100 text-purple-800' },
  ].map(t => ({ ...t, count: getDamagesByType(t.type).length }));

  const recent = [...mergedDamages]
    .sort((a,b) => new Date(b.inspectionTime).getTime() - new Date(a.inspectionTime).getTime())
    .slice(0,5);

  const monthlyData = mergedDamages.reduce((acc, d) => {
    const m = d.inspectionTime.substring(0,7);
    acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {});
  const monthlyTrend = Object.entries(monthlyData)
    .sort((a,b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }));
  const maxMonthly = Math.max(...monthlyTrend.map(d => d.count), 1);

  function h(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstChild; }

  // ヘッダー
  root.appendChild(h(`
    <div>
      <h1 class="text-3xl font-bold text-gray-100">道路管理ダッシュボード</h1>
      <p class="text-gray-300 mt-2">道路損傷の状況と統計情報を表示します。</p>
    </div>
  `));

  // Stats
  const statsGrid = h(`<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"></div>`);
  stats.forEach(stat => {
    statsGrid.appendChild(h(`
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between mb-4">
          <div class="${stat.color} p-3 rounded-lg"></div>
        </div>
        <div>
          <p class="text-gray-600 text-sm mb-1">${stat.label}</p>
          <p class="text-2xl font-bold text-gray-900">${stat.value}</p>
          <p class="text-xs text-gray-500 mt-1">${stat.description}</p>
        </div>
      </div>
    `));
  });
  root.appendChild(statsGrid);

  // Charts and Analysis
  const chartsGrid = h(`<div class="grid grid-cols-1 lg:grid-cols-2 gap-6"></div>`);
  // Type distribution
  const typeCard = h(`<div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6"></div>`);
  typeCard.appendChild(h(`<h2 class="text-xl font-bold text-gray-900 mb-4">損傷種別分布</h2>`));
  
  // 視覚的な分布表示（バーグラフ風）
  const total = typeList.reduce((sum, item) => sum + item.count, 0);
  const colors = ['bg-blue-500', 'bg-red-500', 'bg-orange-500', 'bg-purple-500'];
  
  typeList.forEach((item, index) => {
    if (item.count > 0) {
      const percentage = ((item.count / total) * 100).toFixed(1);
      const barWidth = Math.max((item.count / total) * 100, 5); // 最小5%の幅
      
      typeCard.appendChild(h(`
        <div class="mb-4">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <div class="w-4 h-4 rounded ${colors[index]}"></div>
              <span class="font-medium text-gray-900">${item.type}</span>
            </div>
            <div class="text-right">
              <span class="text-lg font-bold text-gray-900">${item.count}件</span>
              <span class="text-sm text-gray-500 ml-2">${percentage}%</span>
            </div>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-3">
            <div class="${colors[index]} h-3 rounded-full transition-all duration-500" style="width: ${barWidth}%"></div>
          </div>
        </div>
      `));
    }
  });
  
  chartsGrid.appendChild(typeCard);

  // Monthly trend
  const trendCard = h(`<div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6"></div>`);
  trendCard.appendChild(h(`<h2 class="text-xl font-bold text-gray-900 mb-4">月別損傷発生推移</h2>`));
  const trendListEl = h(`<div class="space-y-3"></div>`);
  monthlyTrend.forEach(item => {
    const width = Math.round((item.count / maxMonthly) * 100);
    trendListEl.appendChild(h(`
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600">${item.month}</span>
        <div class="flex items-center gap-3">
          <div class="w-32 bg-gray-200 rounded-full h-2">
            <div class="bg-blue-500 h-2 rounded-full" style="width:${width}%"></div>
          </div>
          <span class="text-sm font-medium text-gray-900 w-8 text-right">${item.count}</span>
        </div>
      </div>
    `));
  });
  trendCard.appendChild(trendListEl);
  chartsGrid.appendChild(trendCard);
  root.appendChild(chartsGrid);

  // Recent
  const recentCard = h(`<div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6"></div>`);
  recentCard.appendChild(h(`<h2 class="text-xl font-bold text-gray-900 mb-4">最近の損傷報告</h2>`));
  const recentList = h(`<div class="space-y-4"></div>`);
  recent.forEach(d => {
    const sevBadge = d.severity === '大' ? 'bg-red-100 text-red-800' : d.severity === '中' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800';
    const card = h(`
      <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100" data-damage-id="${d.id}">
        <div class="flex-1">
          <div class="flex items-center gap-3 mb-2">
            <span class="px-2 py-1 text-xs font-medium rounded-full ${sevBadge}">${d.severity}</span>
            <span class="font-medium text-gray-900">${d.type}</span>
          </div>
          <div class="flex items-center gap-4 text-sm text-gray-600">
            <div class="flex items-center gap-1">${d.inspectionTime}</div>
            <div class="flex items-center gap-1">${d.patrolTeam || ''}</div>
          </div>
        </div>
        <div class="text-right">
          <p class="text-sm text-gray-600">${d.vehicle || ''}</p>
          <p class="text-xs text-gray-500">${d.weather || ''}</p>
        </div>
      </div>
    `);
    card.addEventListener('click', () => {
      localStorage.setItem('selectedDamage', JSON.stringify(d));
      window.location.href = 'search.html';
    });
    recentList.appendChild(card);
  });
  recentCard.appendChild(recentList);
  root.appendChild(recentCard);

  // 対応状況 内訳
  const statusCounts = (() => {
    const init = { 'pending': 0, 'in-progress': 0, 'completed': 0, 'cancelled': 0 };
    return mergedDamages.reduce((acc, d) => { acc[d.status] = (acc[d.status]||0) + 1; return acc; }, init);
  })();
  const statusCard = h(`<div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6"></div>`);
  statusCard.appendChild(h(`<h2 class="text-xl font-bold text-gray-900 mb-4">対応状況内訳</h2>`));
  const statusGrid = h(`<div class="grid grid-cols-2 md:grid-cols-4 gap-4"></div>`);
  const STATUS_OPTIONS = [
    { key: 'pending', label: '未対応', badge: 'bg-gray-100 text-gray-800' },
    { key: 'in-progress', label: '対応中', badge: 'bg-blue-100 text-blue-800' },
    { key: 'completed', label: '対応完了', badge: 'bg-green-100 text-green-800' },
    { key: 'cancelled', label: '対応不要', badge: 'bg-red-100 text-red-800' },
  ];
  STATUS_OPTIONS.forEach(s => {
    statusGrid.appendChild(h(`
      <div class="p-4 rounded-lg border border-gray-200">
        <div class="text-sm text-gray-600 mb-1">${s.label}</div>
        <div class="text-2xl font-bold text-gray-900">${statusCounts[s.key] || 0}</div>
        <div class="mt-2 inline-block text-xs px-2 py-1 rounded ${s.badge}">${s.label}</div>
      </div>
    `));
  });
  statusCard.appendChild(statusGrid);
  root.appendChild(statusCard);

  // Urgent
  const urgentCard = h(`<div class="bg-red-50 border border-red-200 rounded-xl p-6"></div>`);
  urgentCard.appendChild(h(`<h2 class="text-xl font-bold text-red-900 mb-4">緊急対応が必要な損傷 (大)</h2>`));
  const urgentGrid = h(`<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>`);
  high.forEach(d => {
    const tile = h(`
      <div class="bg-white rounded-lg p-4 border border-red-200 cursor-pointer hover:bg-red-50" data-damage-id="${d.id}">
        <div class="flex items-center justify-between mb-2">
          <span class="font-medium text-gray-900">${d.type}</span>
          <span class="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">大</span>
        </div>
        <p class="text-sm text-gray-600 mb-2">${d.voiceText || ''}</p>
        <div class="flex items-center justify-between text-xs text-gray-500">
          <span>${d.inspectionTime}</span>
          <span>${d.patrolTeam || ''}</span>
        </div>
      </div>
    `);
    tile.addEventListener('click', () => {
      localStorage.setItem('selectedDamage', JSON.stringify(d));
      window.location.href = 'search.html';
    });
    urgentGrid.appendChild(tile);
  });
  urgentCard.appendChild(urgentGrid);
  root.appendChild(urgentCard);

  // サイドバー折りたたみ保存/復元
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('toggleSidebar');
  if (localStorage.getItem('sidebarCollapsed') === '1') {
    sidebar.classList.add('sidebar-collapsed');
    document.querySelectorAll('.sidebar-text').forEach(e => e.classList.add('hidden-text'));
  }
  toggle.addEventListener('click', () => {
    const collapsed = sidebar.classList.toggle('sidebar-collapsed');
    document.querySelectorAll('.sidebar-text').forEach(e => e.classList.toggle('hidden-text'));
    localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
  });
})();