const elements = Object.fromEntries([
  "fileInput", "dropZone", "emptyUpload", "imagePreview", "imageTools", "imageQualityTitle", "imageQualityDetail",
  "rotateLeftButton", "rotateRightButton", "enhanceImage", "ocrAssessment", "foodCategory", "sampleId", "labelText",
  "textConfirmed", "auditMode", "charCount", "inputStatus", "auditButton", "ocrButton", "clearButton",
  "loadSampleButton", "ruleCount", "progressSection", "progressBar", "progressValue", "progressTitle",
  "progressDetail", "resultsSection", "findingsList", "extractedFields", "priorityValue", "priorityDetail",
  "highCount", "mediumCount", "passCount", "manualCount", "auditTimestamp", "downloadButton", "printButton",
  "toast", "modeSummary", "dualCompare", "sampleNotice", "reviewProgress", "completionBanner", "reportMeta",
  "runtimeStatus", "runtimeDot"
].map(id => [id, document.querySelector(`#${id}`)]));

let currentImageFile = null;
let sourceImage = null;
let imageRotation = 0;
let ocrWorkerPromise = null;
let currentResults = [];
let currentReport = null;
let reviewedRules = new Set();
let inputOrigin = "人工输入";

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function activeRules(mode = elements.auditMode.value) {
  return window.FOOD_LABEL_RULES.filter(rule => mode === "current" ? rule.track === "both" : true);
}

function updateModeSummary() {
  const mode = elements.auditMode.value;
  elements.ruleCount.textContent = activeRules(mode).length;
  elements.modeSummary.textContent = window.STANDARD_TRACKS[mode].caption;
}

function updateRuntimeStatus() {
  const isOnline = navigator.onLine;
  const hasOCR = Boolean(window.Tesseract);
  elements.runtimeDot.classList.toggle("warning", !isOnline || !hasOCR);
  if (!isOnline) {
    elements.runtimeStatus.textContent = "规则引擎可用 · 当前离线，请手动粘贴文字";
  } else if (!hasOCR) {
    elements.runtimeStatus.textContent = "规则引擎就绪 · OCR组件未加载";
  } else {
    elements.runtimeStatus.textContent = "15条原型检查就绪 · OCR可用";
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => elements.toast.classList.remove("show"), 2400);
}

function markResultsStale() {
  if (!elements.resultsSection.hidden) showToast("审核条件已变化，请重新预审");
  elements.resultsSection.hidden = true;
  currentResults = [];
  currentReport = null;
  reviewedRules = new Set();
}

function updateInputState(message) {
  const length = elements.labelText.value.trim().length;
  const confirmed = elements.textConfirmed.checked;
  elements.charCount.textContent = `${length} 字`;
  elements.auditButton.disabled = length < 10 || !confirmed;
  if (!length) {
    elements.inputStatus.textContent = "尚未添加标签内容";
  } else if (!confirmed) {
    elements.inputStatus.textContent = message || "文本已就绪，请校对并勾选确认";
  } else {
    elements.inputStatus.textContent = message || "关键字段已确认，可开始预审";
  }
}

function invalidateText(message) {
  elements.textConfirmed.checked = false;
  markResultsStale();
  updateInputState(message);
}

function validateFile(file) {
  if (!file) return false;
  if (!file.type.startsWith("image/")) return showToast("请选择JPG、PNG或WEBP图片"), false;
  if (file.size > 10 * 1024 * 1024) return showToast("图片超过10MB，请压缩后重试"), false;
  return true;
}

function createPreparedCanvas(forOCR = false) {
  if (!sourceImage) return null;
  const sourceWidth = sourceImage.naturalWidth;
  const sourceHeight = sourceImage.naturalHeight;
  const sourceLongSide = Math.max(sourceWidth, sourceHeight);
  const targetLongSide = forOCR ? Math.min(2800, Math.max(sourceLongSide, 2000)) : Math.min(sourceLongSide, 1600);
  const scale = Math.min(2.5, targetLongSide / sourceLongSide);
  const drawWidth = Math.round(sourceWidth * scale);
  const drawHeight = Math.round(sourceHeight * scale);
  const swapsSides = Math.abs(imageRotation % 180) === 90;
  const canvas = document.createElement("canvas");
  canvas.width = swapsSides ? drawHeight : drawWidth;
  canvas.height = swapsSides ? drawWidth : drawHeight;
  const context = canvas.getContext("2d", { willReadFrequently: forOCR });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(imageRotation * Math.PI / 180);
  context.filter = elements.enhanceImage.checked ? "grayscale(1) contrast(1.38) brightness(1.04)" : "none";
  context.drawImage(sourceImage, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  return canvas;
}

function updateImagePreview() {
  const canvas = createPreparedCanvas(false);
  if (!canvas) return;
  elements.imagePreview.src = canvas.toDataURL("image/jpeg", 0.9);
  elements.imagePreview.hidden = false;
  elements.emptyUpload.hidden = true;
}

function updateImageQuality() {
  if (!sourceImage) return;
  const width = sourceImage.naturalWidth;
  const height = sourceImage.naturalHeight;
  const shortSide = Math.min(width, height);
  elements.imageQualityTitle.textContent = `${width} × ${height} 像素 · ${elements.enhanceImage.checked ? "已开启小字增强" : "使用原图"}`;
  if (shortSide < 700) {
    elements.imageQualityDetail.textContent = "分辨率偏低：小字可能缺失，建议重新拍近一些或只拍标签文字区域。";
    elements.imageTools.classList.add("warning");
  } else {
    elements.imageQualityDetail.textContent = "尺寸可用于尝试识别；反光、弯曲和倾斜仍可能造成漏字。";
    elements.imageTools.classList.remove("warning");
  }
}

function setImageToolsDisabled(disabled) {
  elements.rotateLeftButton.disabled = disabled;
  elements.rotateRightButton.disabled = disabled;
  elements.enhanceImage.disabled = disabled;
}

function rotateImage(delta) {
  if (!sourceImage) return;
  imageRotation = (imageRotation + delta + 360) % 360;
  updateImagePreview();
  updateImageQuality();
  elements.ocrAssessment.hidden = true;
  invalidateText(`图片已旋转${imageRotation}°，请重新识别文字`);
}

function assessOcrText(text) {
  const keywords = ["名称", "配料", "净含量", "生产", "保质期", "营养", "能量", "蛋白质", "脂肪", "碳水化合物", "钠"];
  const hits = keywords.filter(keyword => text.includes(keyword)).length;
  const usefulCharacters = (text.match(/[\u4e00-\u9fffA-Za-z0-9]/g) || []).length;
  const needsRetry = usefulCharacters < 50 || hits < 2;
  elements.ocrAssessment.hidden = false;
  elements.ocrAssessment.className = `ocr-assessment ${needsRetry ? "warning" : "good"}`;
  elements.ocrAssessment.innerHTML = needsRetry
    ? `<strong>识别结果可能不完整</strong><span>仅捕捉到${hits}类标签关键词。请检查图片方向，尝试切换“小字增强”后重新识别，或重新拍摄文字区域。</span>`
    : `<strong>已捕捉到${hits}类标签关键词</strong><span>这只是完整性提示，不代表识别准确；请逐项对照原图校对。</span>`;
}

async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = window.Tesseract.createWorker("chi_sim+eng", window.Tesseract.OEM?.LSTM_ONLY ?? 1, {
      logger: event => event.status === "recognizing text" && setProgress(Math.round(event.progress * 100), "正在识别增强后的标签文字……")
    }).then(async worker => {
      await worker.setParameters({
        tessedit_pageseg_mode: window.Tesseract.PSM?.SPARSE_TEXT ?? 11,
        preserve_interword_spaces: "1"
      });
      return worker;
    }).catch(error => {
      ocrWorkerPromise = null;
      throw error;
    });
  }
  return ocrWorkerPromise;
}

function loadImage(file) {
  if (!validateFile(file)) return;
  currentImageFile = file;
  sourceImage = null;
  imageRotation = 0;
  inputOrigin = "图片OCR（待人工校对）";
  elements.imageTools.hidden = true;
  elements.ocrAssessment.hidden = true;
  invalidateText("图片已上传，正在准备识别");
  const reader = new FileReader();
  reader.onload = event => {
    const image = new Image();
    image.onload = () => {
      sourceImage = image;
      elements.imageTools.hidden = false;
      elements.ocrButton.disabled = false;
      updateImagePreview();
      updateImageQuality();
      runOCR();
    };
    image.onerror = () => {
      elements.inputStatus.textContent = "图片无法读取，请换一张JPG、PNG或WEBP图片";
      showToast("图片读取失败，请重新选择");
    };
    image.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

async function runOCR() {
  if (!currentImageFile) return showToast("请先上传一张标签图片");
  if (!window.Tesseract) {
    elements.inputStatus.textContent = "OCR组件未加载，可直接粘贴文字继续";
    updateRuntimeStatus();
    return showToast("网络无法加载OCR，仍可手动输入");
  }
  elements.ocrButton.disabled = true;
  setImageToolsDisabled(true);
  elements.auditButton.disabled = true;
  elements.progressSection.hidden = false;
  elements.progressTitle.textContent = "正在识别标签文字";
  elements.progressDetail.textContent = "首次识别需加载中文模型，请稍候……";
  try {
    const preparedImage = createPreparedCanvas(true);
    const worker = await getOcrWorker();
    const result = await worker.recognize(preparedImage);
    elements.labelText.value = result.data.text.trim();
    inputOrigin = `图片OCR（${elements.enhanceImage.checked ? "自动增强" : "原图"}，旋转${imageRotation}°，待人工校对）`;
    assessOcrText(elements.labelText.value);
    invalidateText("OCR完成，请对照原图校对并勾选确认");
    showToast("识别完成，请先校对关键字段");
  } catch (error) {
    elements.inputStatus.textContent = "识别失败，可手动粘贴文字继续";
    showToast("OCR识别失败，请改用手动输入");
  } finally {
    elements.ocrButton.disabled = false;
    setImageToolsDisabled(false);
    window.setTimeout(() => { elements.progressSection.hidden = true; }, 500);
  }
}

function setProgress(value, detail) {
  const safeValue = Math.max(0, Math.min(100, value));
  elements.progressBar.style.width = `${safeValue}%`;
  elements.progressValue.textContent = `${safeValue}%`;
  if (detail) elements.progressDetail.textContent = detail;
}

function extractField(text, labels) {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}[：:]?\\s*([^\\n]+)`, "i"));
    if (match) return match[1].trim();
  }
  return "未识别";
}

function extractFields(text) {
  return [
    ["文本来源", inputOrigin],
    ["产品类别", elements.foodCategory.value],
    ["食品名称", extractField(text, ["产品名称", "食品名称", "品名"])],
    ["配料表", extractField(text, ["配料表", "配料"])],
    ["净含量", extractField(text, ["净含量"])],
    ["生产者", extractField(text, ["生产者", "生产商", "制造商"])],
    ["保质期", extractField(text, ["保质期"])],
    ["执行标准", extractField(text, ["产品标准代号", "执行标准"])],
    ["许可证", extractField(text, ["食品生产许可证编号", "生产许可证编号", "许可证编号"])]
  ];
}

function runRules(text) {
  return activeRules().map(rule => {
    const passed = rule.test(text);
    return { ...rule, status: passed ? "pass" : rule.failSeverity, message: passed ? rule.passMessage : rule.failMessage };
  });
}

const resultLabel = status => ({ high: "高风险", medium: "需关注", manual: "人工复核", pass: "文本检查通过" })[status];
const resultIcon = status => ({ high: "!", medium: "!", manual: "?", pass: "✓" })[status];
const trackLabel = track => track === "new" ? "2027换版" : "共轨检查";

function renderFindings(filter = "all") {
  const list = filter === "risk" ? currentResults.filter(item => item.status !== "pass") : currentResults;
  elements.findingsList.innerHTML = list.length ? list.map(item => `
    <article class="finding ${item.status}" data-status="${item.status}">
      <span class="finding-icon" aria-hidden="true">${resultIcon(item.status)}</span>
      <div class="finding-main">
        <div class="finding-title-row"><h4>${item.id} · ${escapeHtml(item.title)}</h4><span class="track-tag ${item.track}">${trackLabel(item.track)}</span></div>
        <p>${escapeHtml(item.message)}</p>
        <details class="evidence-details">
          <summary>查看依据与自动化边界</summary>
          <p><strong>参考来源：</strong><a href="${item.basis.url}" target="_blank" rel="noopener">${escapeHtml(item.basis.label)}</a></p>
          <p><strong>边界：</strong>${escapeHtml(item.boundary)}</p>
          <p class="verification-note">规则条件与具体条款号仍需指导老师逐条确认。</p>
        </details>
      </div>
      <div class="finding-actions">
        <span class="severity">${resultLabel(item.status)}</span>
        ${item.status === "pass" ? '<span class="review-not-needed">无需标记</span>' : `<button class="review-button ${reviewedRules.has(item.id) ? "done" : ""}" data-rule-id="${item.id}" type="button">${reviewedRules.has(item.id) ? "已复核" : "标记复核"}</button>`}
      </div>
    </article>
  `).join("") : `<div class="empty-results">当前筛选下没有项目。</div>`;

  document.querySelectorAll(".review-button").forEach(button => button.addEventListener("click", () => {
    const id = button.dataset.ruleId;
    reviewedRules.has(id) ? reviewedRules.delete(id) : reviewedRules.add(id);
    renderFindings(document.querySelector(".filter.active").dataset.filter);
    updateReviewProgress();
  }));
}

function updateReviewProgress() {
  const riskIds = currentResults.filter(item => item.status !== "pass").map(item => item.id);
  const done = riskIds.filter(id => reviewedRules.has(id)).length;
  elements.reviewProgress.textContent = riskIds.length ? `${done}/${riskIds.length}个风险或关注项已人工复核` : "无文本风险项，仍需核对原图与适用性";
  const completed = riskIds.length > 0 && done === riskIds.length;
  elements.completionBanner.classList.toggle("complete", completed);
  elements.completionBanner.textContent = completed
    ? "待处理项已全部标记复核；这仍不是最终合规结论。"
    : (riskIds.length ? `机器预审完成，还有${riskIds.length - done}项等待人工复核。` : "文本层面未发现风险，仍需人工核对版面、例外和类别适用性。");
}

function renderDualCompare() {
  const currentIssues = currentResults.filter(item => item.track === "both" && item.status !== "pass").length;
  const newIssues = currentResults.filter(item => item.track === "new" && item.status !== "pass").length;
  elements.dualCompare.hidden = elements.auditMode.value !== "dual";
  elements.dualCompare.innerHTML = `
    <div><span>现行要求</span><strong>${currentIssues}项需处理</strong><small>基于12条共轨原型检查</small></div>
    <div class="compare-arrow" aria-hidden="true">→</div>
    <div><span>2027换版准备</span><strong>${newIssues}项需准备</strong><small>新增关注：致敏提示、饱和脂肪与糖、盐油糖提示语</small></div>
  `;
  elements.sampleNotice.hidden = inputOrigin !== "团队自编演示样本";
}

function createReportId(date) {
  const pad = value => String(value).padStart(2, "0");
  return `SZ-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function renderReportMeta(report) {
  const rows = [
    ["记录编号", report.id],
    ["样本编号", report.sampleId || "未填写"],
    ["产品类别", report.foodCategory],
    ["审核基准", report.modeTitle],
    ["规则版本", "原型规则集 v0.3 · 待教师逐条校核"],
    ["文本来源", report.inputOrigin]
  ];
  elements.reportMeta.innerHTML = rows.map(([name, value]) => `<div><dt>${name}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
}

function renderReport(text) {
  reviewedRules = new Set();
  currentResults = runRules(text);
  const counts = currentResults.reduce((acc, item) => (acc[item.status] += 1, acc), { high: 0, medium: 0, manual: 0, pass: 0 });
  const pending = counts.high + counts.medium + counts.manual;
  const createdAt = new Date();
  currentReport = {
    id: createReportId(createdAt),
    sampleId: elements.sampleId.value.trim(),
    foodCategory: elements.foodCategory.value,
    mode: elements.auditMode.value,
    modeTitle: window.STANDARD_TRACKS[elements.auditMode.value].title,
    inputOrigin,
    createdAt: createdAt.toISOString(),
    text,
    fields: extractFields(text),
    counts
  };
  elements.priorityValue.textContent = pending ? `${pending}项待处理或复核` : "未发现文本层面风险";
  elements.priorityDetail.textContent = counts.high ? "先核对关键缺项，再处理提醒项" : "不生成缺乏验证依据的“合规分数”";
  elements.highCount.textContent = counts.high;
  elements.mediumCount.textContent = counts.medium;
  elements.passCount.textContent = counts.pass;
  elements.manualCount.textContent = counts.manual;
  elements.auditTimestamp.textContent = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(createdAt);
  elements.extractedFields.innerHTML = currentReport.fields.map(([name, value]) => `<div><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  renderReportMeta(currentReport);
  renderFindings();
  renderDualCompare();
  updateReviewProgress();
  elements.resultsSection.hidden = false;
  elements.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function downloadReport() {
  if (!currentReport) return showToast("请先完成一次预审");
  const payload = {
    notice: "本记录为原型系统的风险提示，不是认证、行政认定、法定检验或法律意见。",
    ruleVerificationStatus: "15条原型规则仍待指导老师逐条校核具体条款号、适用范围和例外。",
    ...currentReport,
    reviewedRuleIds: [...reviewedRules],
    findings: currentResults.map(item => ({
      id: item.id,
      title: item.title,
      track: trackLabel(item.track),
      status: resultLabel(item.status),
      message: item.message,
      basis: item.basis,
      automationBoundary: item.boundary,
      reviewed: reviewedRules.has(item.id)
    }))
  };
  const link = document.createElement("a");
  link.href = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload, null, 2))}`;
  link.download = `食标智审-${currentReport.id}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast("审核记录已下载，可补录到测试台账");
}

async function simulateAudit() {
  const text = elements.labelText.value.trim();
  if (text.length < 10 || !elements.textConfirmed.checked) return showToast("请先校对文本并勾选确认");
  elements.auditButton.disabled = true;
  elements.progressSection.hidden = false;
  elements.resultsSection.hidden = true;
  const stages = [
    [18, "正在解析标签字段", "识别名称、配料、生产与营养信息……"],
    [48, "正在区分适用轨道", "拆分现行要求与2027换版关注项……"],
    [76, "正在执行原型规则", "保留规则编号、来源和自动化边界……"],
    [100, "预审完成", "请对风险与关注项逐条人工复核。"]
  ];
  for (const [value, title, detail] of stages) {
    elements.progressTitle.textContent = title;
    setProgress(value, detail);
    await new Promise(resolve => window.setTimeout(resolve, 220));
  }
  renderReport(text);
  elements.progressSection.hidden = true;
  updateInputState();
}

elements.fileInput.addEventListener("change", event => loadImage(event.target.files[0]));
elements.rotateLeftButton.addEventListener("click", () => rotateImage(-90));
elements.rotateRightButton.addEventListener("click", () => rotateImage(90));
elements.enhanceImage.addEventListener("change", () => {
  updateImagePreview();
  updateImageQuality();
  elements.ocrAssessment.hidden = true;
  invalidateText(`已切换为${elements.enhanceImage.checked ? "小字增强" : "原图"}模式，请重新识别文字`);
});
elements.labelText.addEventListener("input", () => {
  inputOrigin = currentImageFile ? "图片OCR后人工修改" : "人工输入或已校对文本";
  invalidateText("文本已修改，请重新校对并勾选确认");
});
elements.textConfirmed.addEventListener("change", () => updateInputState());
elements.auditMode.addEventListener("change", () => { updateModeSummary(); markResultsStale(); });
elements.foodCategory.addEventListener("change", markResultsStale);
elements.sampleId.addEventListener("input", markResultsStale);
elements.auditButton.addEventListener("click", simulateAudit);
elements.ocrButton.addEventListener("click", runOCR);
elements.downloadButton.addEventListener("click", downloadReport);
elements.printButton.addEventListener("click", () => window.print());
elements.loadSampleButton.addEventListener("click", () => {
  inputOrigin = "团队自编演示样本";
  currentImageFile = null;
  sourceImage = null;
  imageRotation = 0;
  elements.fileInput.value = "";
  elements.imagePreview.src = "";
  elements.imagePreview.hidden = true;
  elements.emptyUpload.hidden = false;
  elements.imageTools.hidden = true;
  elements.ocrAssessment.hidden = true;
  elements.ocrButton.disabled = true;
  elements.foodCategory.value = "豆制品";
  elements.sampleId.value = "DEMO-001";
  elements.labelText.value = window.DEMO_LABEL_TEXT;
  invalidateText("演示样本已载入，请先勾选校对确认；不计入真实测试结果");
  showToast("已载入非真实演示样本");
});
elements.clearButton.addEventListener("click", () => {
  elements.labelText.value = "";
  elements.sampleId.value = "";
  elements.foodCategory.value = "通用预包装食品";
  elements.textConfirmed.checked = false;
  elements.fileInput.value = "";
  elements.imagePreview.src = "";
  elements.imagePreview.hidden = true;
  elements.emptyUpload.hidden = false;
  elements.ocrButton.disabled = true;
  currentImageFile = null;
  sourceImage = null;
  imageRotation = 0;
  elements.enhanceImage.checked = true;
  elements.imageTools.hidden = true;
  elements.imageTools.classList.remove("warning");
  elements.ocrAssessment.hidden = true;
  inputOrigin = "人工输入";
  markResultsStale();
  updateInputState();
});
["dragenter", "dragover"].forEach(name => elements.dropZone.addEventListener(name, event => { event.preventDefault(); elements.dropZone.classList.add("dragging"); }));
["dragleave", "drop"].forEach(name => elements.dropZone.addEventListener(name, event => { event.preventDefault(); elements.dropZone.classList.remove("dragging"); }));
elements.dropZone.addEventListener("drop", event => loadImage(event.dataTransfer.files[0]));
document.querySelectorAll(".filter").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".filter").forEach(item => item.classList.remove("active"));
  button.classList.add("active");
  renderFindings(button.dataset.filter);
}));
window.addEventListener("online", updateRuntimeStatus);
window.addEventListener("offline", updateRuntimeStatus);
window.addEventListener("load", updateRuntimeStatus);
updateModeSummary();
updateInputState();
updateRuntimeStatus();
