// ===== 共通ユーティリティ =====

const SAVED_KEY = 'damagesStatusOverrides';

/**
 * Firestoreへの非同期保存を模倣する関数
 * @param {number} id - 損傷ID
 * @param {object} payload - 保存するデータ（例: {status: 'completed', deleted: true}）
 * @returns {Promise<void>}
 */
async function saveOverride(id, payload) {
  // Firebase SDK を使う場合、ここで
  // const db = getFirestore();
  // const docRef = doc(db, 'damages', String(id));
  // await setDoc(docRef, payload, { merge: true });
  // といった非同期処理を行う

  // 現在は localStorage で模倣
  console.log(`[Firebase MOCK] Saving ID ${id}:`, payload);
  const key = SAVED_KEY;
  const next = { ...(JSON.parse(localStorage.getItem(key) || '{}')) };
  next[id] = { ...(next[id]||{}), ...payload };
  localStorage.setItem(key, JSON.stringify(next));
  
  // 非同期を模倣するためにわずかな遅延を返す (オプション)
  // await new Promise(resolve => setTimeout(resolve, 100));
}

/**
 * データベースのデータ（damages.js）とローカルの変更（localStorage）をマージし、
 * 削除済みのものを除外して返す
 * @returns {Array<object>} マージ済み・フィルター済みの損傷データ配列
 */
function getMergedDamages() {
  // Firebase SDK を使う場合、
  // 1. damages.js の代わりに onSnapshot で Firestore から最新データを取得
  // 2. localStorage の代わりにローカルの変更を保持（または Firestore に即時反映）
  
  // 現在のロジック（damages.js + localStorage）
	const currentOverrides = JSON.parse(localStorage.getItem(SAVED_KEY) || '{}');
	// 削除フラグ（deleted: true）が立っているものを除外
	return damages.map(d => ({ ...d, ...(currentOverrides[d.id] || {}) }))
                .filter(d => !(d.deleted === true));
}

/**
 * ステータスのキーから日本語ラベルを取得
 * @param {string} status - ステータスキー
 * @returns {string} 日本語ラベル
 */
function getStatusLabel(status) {
  const labels = {
    'pending': '未対応',
    'in-progress': '対応中', 
    'completed': '対応完了',
    'cancelled': '対応不要'
  };
  return labels[status] || '未対応';
}