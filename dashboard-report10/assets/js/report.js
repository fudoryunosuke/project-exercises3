window.addEventListener("DOMContentLoaded", () => {
  const damage = JSON.parse(localStorage.getItem("selectedDamage"));
  if (!damage) {
    alert("損傷情報が選択されていません。検索ページから選択してください。");
    window.location.href = "search.html";
    return;
  }

  // 削除: toConfidence 関数

  // 基本情報
  document.getElementById("r-type").textContent = damage.type || '';
  document.getElementById("r-severity").textContent = damage.severity || ''; // 「大/中/小」が入る
  document.getElementById("r-date").textContent = damage.inspectionTime || '';
  document.getElementById("r-gps").textContent = damage.gps || '';
  // 削除: document.getElementById("r-size").textContent = toConfidence(damage.size);

  // 追加情報
  document.getElementById("r-patrolTeam").textContent = damage.patrolTeam || '';
  document.getElementById("r-vehicle").textContent = damage.vehicle || '';
  document.getElementById("r-weather").textContent = damage.weather || '';

  // ボイスメモ
  document.getElementById("r-voiceText").textContent = damage.voiceText || '';

  // 画像
  const rImage = document.getElementById("r-image");
  function toBase64(url) {
    return fetch(url)
      .then(resp => resp.blob())
      .then(blob => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }));
  }
  if (damage.image) {
    toBase64(damage.image).then(base64 => rImage.src = base64)
      .catch(() => { rImage.alt = "画像の読み込みに失敗しました"; });
  } else {
    rImage.src = "assets/images/placeholder.png";
  }

  // PDF生成
  document.getElementById("pdfBtn").onclick = () => {
    document.getElementById("reportDate").textContent = new Date().toLocaleDateString();  
    const report = document.getElementById("reportContent");
    html2canvas(report, { scale: 3, useCORS: true }).then(canvas => {
      const imgData = canvas.toDataURL("image/png");
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const pdfWidth = pageWidth - 2 * margin;
      const pdfHeight = pageHeight - 2 * margin;
      pdf.addImage(imgData, "PNG", margin, margin, pdfWidth, pdfHeight);
      const safeTs = (damage.inspectionTime || '').replace(/[:\s]/g, '_');
      pdf.save(`road_damage_report_${safeTs}.pdf`);
    });
  };

  // 戻る
  document.getElementById("backBtn").onclick = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "search.html";
  };
});