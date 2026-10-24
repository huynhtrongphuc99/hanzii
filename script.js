/* ============================================================================
 * HÁN NGỮ FLASHCARD – FULL SCRIPT (hợp nhất 700 + 4000, đã fix bug)
 * ========================================================================== */

/* ------------- CONFIG ------------- */
const USE_SERVER   = false;                         // true: dùng /api/vocabulary
const STORAGE_KEY  = "hanzii_vocabulary_data";

/* ------------- STATE ------------- */
let vocabularyData = {};
let englishMap     = {};
let toneExamples   = {};

let currentLesson   = "lesson1";
let selectedSource  = "main";
let currentCardIndex = 0;
let showFront       = true;
let showToneMarks   = true;
let reverseMode     = false;
let quickReviewMode = false;

let reviewingMode   = null;   // null | "single" | "all"
let reviewCards     = [];
let reviewCardIndex = 0;

let isSummaryMode = false;
let summaryCards  = [];
let summaryIndex  = 0;

let skipNextFocus = false;
let tocflKeyLock  = false;
let availableVoices = [];
let selectedHanLesson = null;
let selectedHanIndex  = null;

/* ------------- VOICE INIT ------------- */
function initVoices() {
  if (typeof speechSynthesis === "undefined") return;
  availableVoices = speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => {
    availableVoices = speechSynthesis.getVoices();
  };
}
initVoices();

/* ============================================================================
 * STORAGE
 * ==========================================================================*/
async function loadVocabularyData() {
  if (USE_SERVER) {
    try {
      const r = await fetch("/api/vocabulary");
      if (r.ok) return await r.json();
    } catch (e) { console.warn("Server load fail:", e); }
  }
  try {
    const r = await fetch("./vocabularyData.json", { cache: "no-cache" });
    if (r.ok) return await r.json();
    throw new Error("Không tải được vocabularyData.json");
  } catch (e) {
    console.error("❌ loadVocabularyData:", e);
    return {};
  }
}

async function saveVocabularyData(data) {
  if (USE_SERVER) {
    try {
      const r = await fetch("/api/vocabulary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (r.ok) { console.log("✔️ Saved to server"); return; }
      throw new Error("PUT failed");
    } catch (e) { console.warn("Server save fail, fallback localStorage:", e); }
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log("✔️ Saved to localStorage");
  } catch (e) { console.error("❌ saveVocabularyData:", e); }
}

async function loadEnglishMap() {
  try {
    const r = await fetch("./english-map.json", { cache: "no-cache" });
    if (r.ok) { englishMap = await r.json(); console.log("✅ English Map loaded"); }
  } catch (e) { console.warn("English map load fail:", e); }
}

async function loadToneExamples() {
  if (USE_SERVER) {
    try {
      const r = await fetch("/api/vocabulary");
      if (r.ok) { const d = await r.json(); toneExamples = d.toneExamples || {}; return; }
    } catch (e) { /* ignore */ }
  }
  try {
    const r = await fetch("./lesson2.json", { cache: "no-cache" });
    if (r.ok) { const d = await r.json(); toneExamples = d.toneExamples || {}; }
  } catch (e) { console.warn("Tone examples load fail:", e); }
}

/* ============================================================================
 * PINYIN UTILITIES
 * ==========================================================================*/
function removeToneMarks(str) {
  if (!str) return "";
  return String(str)
    .replace(/[āáǎà]/g, "a").replace(/[ēéěè]/g, "e")
    .replace(/[īíǐì]/g, "i").replace(/[ōóǒò]/g, "o")
    .replace(/[ūúǔù]/g, "u").replace(/[ǖǘǚǜ]/g, "ü");
}

function normalizePinyin(p) {
  if (!p) return "";
  return removeToneMarks(String(p)).replace(/\s+/g, "").toLowerCase();
}

function normalizeHan(s) { return (s || "").replace(/\s+/g, "").trim(); }

function splitPinyin(pinyin) {
  if (!pinyin) return [];
  if (pinyin.includes(" ")) return pinyin.split(" ");
  return pinyin.match(/[a-zü]+[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]?/gi) || [pinyin];
}

function getToneNumberFromSyllable(syl) {
  const m = {
    ā:1,á:2,ǎ:3,à:4, ē:1,é:2,ě:3,è:4, ī:1,í:2,ǐ:3,ì:4,
    ō:1,ó:2,ǒ:3,ò:4, ū:1,ú:2,ǔ:3,ù:4, ǖ:1,ǘ:2,ǚ:3,ǜ:4
  };
  for (const c of syl) if (m[c]) return m[c];
  return 0;
}

function convertNumberedPinyinToMarked(input) {
  if (input === undefined || input === null) return "";
  const s = String(input);
  if (!/[1-5]/.test(s)) return s;

  const normalized = s.replace(/u:/gi, "ü").replace(/\bv\b/gi, "ü");
  const toneMap = {
    a: ['ā','á','ǎ','à'], o: ['ō','ó','ǒ','ò'], e: ['ē','é','ě','è'],
    i: ['ī','í','ǐ','ì'], u: ['ū','ú','ǔ','ù'], 'ü': ['ǖ','ǘ','ǚ','ǜ']
  };
  const initials = ["zh","ch","sh","b","p","m","f","d","t","n","l","g","k","h","j","q","x","r","z","c","s","y","w"];
  const isLetter = ch => /[A-Za-züÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(ch);
  const isDigitTone = ch => /[1-5]/.test(ch);

  const tokens = [];
  let i = 0, L = normalized.length;
  while (i < L) {
    const ch = normalized[i];
    if (isDigitTone(ch)) { tokens.push({ type: 'digit', text: ch }); i++; continue; }
    if (!isLetter(ch)) {
      let j = i + 1;
      while (j < L && !isLetter(normalized[j]) && !isDigitTone(normalized[j])) j++;
      tokens.push({ type: 'other', text: normalized.slice(i, j) });
      i = j; continue;
    }
    const start = i;
    let matchedInitial = "";
    for (const ini of initials) {
      if (normalized.slice(start, start + ini.length).toLowerCase() === ini) { matchedInitial = ini; break; }
    }
    let j = start + (matchedInitial ? matchedInitial.length : 1);
    while (j < L) {
      if (isDigitTone(normalized[j])) break;
      if (!isLetter(normalized[j])) break;
      let foundIni = false;
      for (const ini of initials) {
        if (normalized.slice(j, j + ini.length).toLowerCase() === ini) { foundIni = true; break; }
      }
      if (foundIni) break;
      j++;
    }
    tokens.push({ type: 'syll', text: normalized.slice(start, j) });
    i = j;
  }

  const outParts = [];
  for (let k = 0; k < tokens.length; k++) {
    const tk = tokens[k];
    if (tk.type === 'syll') {
      const next = tokens[k + 1];
      if (next && next.type === 'digit') {
        const toneNum = next.text;
        const baseSyl = removeToneMarks(tk.text).toLowerCase();
        let initial = '';
        for (const ini of initials) {
          if (baseSyl.startsWith(ini)) { initial = ini; break; }
        }
        const finalPart = baseSyl.slice(initial.length);
        const tIdx = parseInt(toneNum, 10) - 1;
        if (isNaN(tIdx) || tIdx < 0 || tIdx > 3) {
          outParts.push(tk.text);
        } else {
          let placed = false;
          if (finalPart.includes('iu')) {
            const idx = finalPart.lastIndexOf('u');
            outParts.push(initial + finalPart.slice(0, idx) + toneMap['u'][tIdx] + finalPart.slice(idx + 1));
            placed = true;
          } else if (finalPart.includes('ui')) {
            const idx = finalPart.lastIndexOf('i');
            outParts.push(initial + finalPart.slice(0, idx) + toneMap['i'][tIdx] + finalPart.slice(idx + 1));
            placed = true;
          } else {
            for (const v of ['a','o','e','i','u','ü']) {
              const pos = finalPart.indexOf(v);
              if (pos !== -1) {
                outParts.push(initial + finalPart.slice(0, pos) + toneMap[v][tIdx] + finalPart.slice(pos + 1));
                placed = true; break;
              }
            }
          }
          if (!placed) outParts.push(tk.text);
        }
        k++;
      } else { outParts.push(tk.text); }
    } else { outParts.push(tk.text); }
  }
  return outParts.join('');
}

function numberToTone(p) { return convertNumberedPinyinToMarked(String(p).trim()); }

function getPinyinIcons(pinyin) {
  if (!pinyin) return "";
  const p = pinyin.trim().toLowerCase();
  let icons = "";
  if (['p','f','t','k','q','c','ch'].some(x => p.startsWith(x))) icons += "🌬️";
  if (['zh','ch','sh','r'].some(x => p.startsWith(x)))       icons += "🌊";
  return icons;
}

function comparePinyinDetailed(input, expected) {
  const inArr = splitPinyin(input), expArr = splitPinyin(expected), errs = [];
  const n = Math.max(inArr.length, expArr.length);
  for (let i = 0; i < n; i++) {
    const a = inArr[i] || "", b = expArr[i] || "";
    if (!a || !b) errs.push(`Âm ${i+1}: thiếu dữ liệu (bạn: "${a}", chuẩn: "${b}")`);
    else if (normalizePinyin(a) !== normalizePinyin(b))
      errs.push(`Âm ${i+1} sai: bạn gõ "${a}", đúng là "${b}"`);
  }
  return errs;
}

function comparePinyinSyllableBySyllable(input, expected) {
  const inArr = splitPinyin(input), expArr = splitPinyin(expected), errs = [];
  for (let i = 0; i < Math.max(inArr.length, expArr.length); i++) {
    const a = inArr[i] || "", b = expArr[i] || "";
    if (normalizePinyin(a) !== normalizePinyin(b))
      errs.push({ index: i, input: a, expected: b });
  }
  return errs;
}

/* ============================================================================
 * UI MESSAGE
 * ==========================================================================*/
function showTemporaryMessage(message, type = "info", duration = 1500) {
  const div = document.createElement("div");
  div.className = "temp-message " + type;
  div.innerHTML = message;
  document.body.appendChild(div);
  setTimeout(() => {
    div.style.opacity = 0;
    setTimeout(() => div.remove(), 300);
  }, duration);
}

/* ============================================================================
 * LESSON SELECTORS
 * ==========================================================================*/
const lessonSelect = document.getElementById("lesson-selector");
const subSelect    = document.getElementById("sub-lesson-selector");
const allSelect    = document.getElementById("all-lessons-selector");
const newSelect    = document.getElementById("new-lessons-selector");

function wireSelector(el, source) {
  if (!el) return;
  el.addEventListener("change", () => {
    reviewingMode = null;
    selectedSource = source;
    [lessonSelect, subSelect, allSelect, newSelect].forEach(s => s && s.classList.remove("select-highlight"));
    el.classList.add("select-highlight");
    updateCurrentLesson();
  });
}
wireSelector(lessonSelect, "main");
wireSelector(subSelect,    "sub");
wireSelector(allSelect,    "all");
wireSelector(newSelect,    "new");

function updateCurrentLesson() {
  const main = lessonSelect?.value || "lesson1";
  const sub  = subSelect?.value    || "";
  const all  = allSelect?.value    || "";
  const nw   = newSelect?.value    || "";

  if (selectedSource === "sub" && sub) currentLesson = sub;
  else if (selectedSource === "all" && all) currentLesson = all;
  else if (selectedSource === "new" && nw)  currentLesson = nw;
  else currentLesson = main;

  currentCardIndex = 0;
  showFront = true;
  updateLessonView();
}

function loadLessonsToSelector() {
  const sel = document.getElementById("lesson-selector");
  if (!sel) return;
  for (const lesson in vocabularyData) {
    if (lesson.startsWith("_")) continue;
    if (!sel.querySelector(`option[value="${lesson}"]`)) {
      const opt = document.createElement("option");
      opt.value = lesson; opt.textContent = lesson;
      sel.appendChild(opt);
    }
  }
}

/* ============================================================================
 * CARD RENDERING
 * ==========================================================================*/
function getCurrentWord() {
  if (isSummaryMode) return summaryCards[summaryIndex];
  if (reviewingMode) return reviewCards[reviewCardIndex];
  const words = vocabularyData[currentLesson] || [];
  return words[currentCardIndex];
}

function updateCard() {
  const card = document.getElementById("card-content");
  if (!card) return;
  const words = vocabularyData[currentLesson] || [];
  if (!words.length) { card.textContent = "Không có từ vựng!"; updateWordPosition(); return; }
  const word = words[currentCardIndex] || words[0];
  if (!word) return;

  const color = word.needReview ? "red" : "black";
  const targetHan = word.traditional || word.simplified || "";
  const engData = englishMap[targetHan];

  let prefix = "";
  if (word.lyHop)          prefix += "🔹 ";
  if (word.needReview)     prefix += "🔴 ";
  if (word.tocflFlag)      prefix += "🔔 ";
  if (word.tocflTopicFlag) prefix += "🍞 ";
  prefix += getPinyinIcons(word.pinyin);

  if (!reverseMode) {
    if (showFront) {
      const chars = targetHan.split("");
      const syllables = splitPinyin(word.pinyin || "");
      const display = chars.map((ch, i) => {
        const tone = getToneNumberFromSyllable(syllables[i] || "");
        const roman = showToneMarks ? (["","I","II","III","IV"][tone] || "") : "";
        return `<div style="display:inline-block;text-align:center;margin:0 8px;">
          <div style="font-size:40px;color:red;">${roman}</div>
          <div style="font-size:150px;font-weight:bold;color:${color};">${ch}</div>
        </div>`;
      }).join("");
      const engSection = engData ? `
        <hr style="border:none;border-top:2px solid #ddd;margin:15px 0;width:80%;">
        <div style="font-size:45px;color:#007BFF;font-style:italic;">${engData.english}</div>
        <hr style="border:none;border-top:2px solid #ddd;margin:15px 0;width:80%;">` : "";
      card.innerHTML = `${prefix}<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;">
        <div>${display}</div>${engSection}</div>`;
    } else {
      const ipaText = engData ? `<span style="color:#2ecc71;font-size:28px;font-weight:bold;margin-left:12px;">[${engData.ipa}]</span>` : "";
      card.innerHTML = `${prefix}<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;">
        <div style="font-size:36px;margin-bottom:20px;color:#333;">${word.hanViet || ""} --- ${word.meaning || ""}${ipaText}</div>
        <div style="font-size:55px;font-weight:500;color:#444;">${word.pinyin || ""}</div></div>`;
    }
  } else {
    if (showFront) {
      card.innerHTML = `${prefix}<div style="font-size:45px;font-weight:bold;">${word.meaning || ""}</div>`;
    } else {
      const ipaText = engData ? `<span style="color:#2ecc71;font-size:28px;font-weight:bold;margin-left:12px;">[${engData.ipa}]</span>` : "";
      card.innerHTML = `${prefix}<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;">
        <div style="font-size:120px;margin-bottom:10px;">${targetHan}</div>
        <div style="font-size:32px;">${word.hanViet || ""} --- ${word.meaning || ""}${ipaText}</div>
        <div style="font-size:45px;margin-top:10px;">${word.pinyin || ""}</div></div>`;
    }
  }
  const inp = document.getElementById("pinyin-input");
  if (inp) { inp.value = ""; if (!skipNextFocus) inp.focus(); }
  skipNextFocus = false;
  updateWordPosition();
}

function updateReviewCard() {
  const card = document.getElementById("card-content");
  if (!card) return;
  if (!reviewCards.length) { card.textContent = "Không có từ cần ôn tập!"; updateWordPosition(); return; }
  const word = reviewCards[reviewCardIndex];
  if (!word) return;
  const han = word.traditional === word.simplified
    ? (word.traditional || "")
    : `${word.traditional || ""} (${word.simplified || ""})`;
  const color = word.needReview ? "red" : "black";
  let prefix = "";
  if (word.lyHop) prefix += "🔹 ";
  if (word.needReview) prefix += "🔴 ";
  if (word.tocflFlag) prefix += "🔔 ";
  if (word.tocflTopicFlag) prefix += "🍞 ";

  card.innerHTML = showFront
    ? `${prefix}<span style="color:${color};font-size:120px;font-weight:bold;">${han}</span>`
    : `<div style="font-size:40px;">${word.hanViet || ""} --- ${word.meaning || ""}<br>${word.pinyin || ""}</div>`;
  const inp = document.getElementById("pinyin-input");
  if (inp) { inp.value = ""; inp.focus(); }
  updateWordPosition();
}

function updateSummaryCard() {
  const card = document.getElementById("card-content");
  if (!card) return;
  const word = summaryCards[summaryIndex];
  if (!word) { card.innerHTML = "Không có từ!"; return; }
  const han = word.traditional === word.simplified
    ? (word.traditional || "")
    : `${word.traditional || ""} (${word.simplified || ""})`;
  const color = word.needReview ? "red" : "black";
  const prefix = word.lyHop ? "🔹 " : "";
  card.innerHTML = showFront
    ? `${prefix}<span style="color:${color};font-size:120px;font-weight:bold;">${han}</span>`
    : `<div style="font-size:36px;">${word.hanViet || ""} --- ${word.meaning || ""}<br>${word.pinyin || ""}</div>`;
  const inp = document.getElementById("pinyin-input");
  if (inp) { inp.value = ""; inp.focus(); }
  updateWordPosition();
}

function updateLessonView() {
  if (currentCardIndex == null) currentCardIndex = 0;
  showFront = true;
  updateCard();
  const list = document.getElementById("vocabulary-list");
  if (!list) return;
  list.innerHTML = "";
  const words = vocabularyData[currentLesson] || [];
  words.forEach((word, index) => {
    const div = document.createElement("div");
    div.className = "word-item";
    div.innerHTML = `
      <b>${word.traditional || ""} (${word.simplified || ""})</b>
      - ${word.hanViet || ""} - ${word.meaning || ""} - <i>${word.pinyin || ""}</i>
      <button onclick="deleteWord('${currentLesson.replace(/'/g, "\\'")}', ${index})">❌ Xoá</button>
      <button onclick="editWordPrompt(${index})">✏️ Sửa</button>`;
    list.appendChild(div);
  });
}

function updateWordPosition() {
  const counter = document.getElementById("word-counter");
  if (!counter) return;
  if (isSummaryMode) counter.textContent = `${summaryIndex + 1} / ${summaryCards.length}`;
  else if (reviewingMode) counter.textContent = `${reviewCardIndex + 1} / ${reviewCards.length}`;
  else {
    const words = vocabularyData[currentLesson] || [];
    counter.textContent = `${words.length ? currentCardIndex + 1 : 0} / ${words.length}`;
  }
}

function toggleCard() {
  showFront = !showFront;
  if (isSummaryMode) updateSummaryCard();
  else if (reviewingMode) updateReviewCard();
  else updateCard();
}

function nextCard() {
  if (isSummaryMode) { summaryIndex = (summaryIndex + 1) % summaryCards.length; showFront = true; updateSummaryCard(); return; }
  if (reviewingMode) {
    if (reviewCardIndex >= reviewCards.length - 1) {
      alert("🎉 Bạn đã hoàn thành ôn tập!");
      exitReviewMode();
    } else { reviewCardIndex++; showFront = true; updateReviewCard(); }
    return;
  }
  const words = vocabularyData[currentLesson] || [];
  if (!words.length) return;
  if (currentCardIndex >= words.length - 1) {
    alert("🎉 Bạn đã học xong bài này!");
    currentCardIndex = 0;
  } else currentCardIndex++;
  showFront = true;
  updateCard();
}

function prevCard() {
  if (isSummaryMode) { summaryIndex = (summaryIndex - 1 + summaryCards.length) % summaryCards.length; showFront = true; updateSummaryCard(); return; }
  if (reviewingMode) { reviewCardIndex = (reviewCardIndex - 1 + reviewCards.length) % reviewCards.length; showFront = true; updateReviewCard(); return; }
  const words = vocabularyData[currentLesson] || [];
  if (!words.length) return;
  currentCardIndex = (currentCardIndex - 1 + words.length) % words.length;
  showFront = true;
  updateCard();
}

function shuffleCards() {
  if (reviewingMode) { reviewCards.sort(() => Math.random() - 0.5); reviewCardIndex = 0; showFront = true; updateReviewCard(); }
  else {
    const words = vocabularyData[currentLesson];
    if (!words) return;
    words.sort(() => Math.random() - 0.5);
    currentCardIndex = 0; showFront = true;
    updateLessonView();
  }
}

function toggleCardOrder() {
  reverseMode = !reverseMode;
  showTemporaryMessage(reverseMode ? "🔄 Nghĩa → Hán" : "🔄 Hán → Nghĩa", "info");
  showFront = true;
  updateCard();
}

function toggleQuickReview() {
  quickReviewMode = !quickReviewMode;
  showToneMarks = quickReviewMode;
  const btn = document.getElementById("quick-review-toggle");
  if (btn) btn.style.backgroundColor = quickReviewMode ? "#f7d560" : "";
  showTemporaryMessage(quickReviewMode
    ? '<span style="font-size:40px;">🔒</span>'
    : '<span style="font-size:40px;">🔓</span>', "info");
  updateCard();
}

document.getElementById("quick-review-toggle")?.addEventListener("click", toggleQuickReview);

/* ============================================================================
 * CHECK PINYIN
 * ==========================================================================*/
function checkPinyin(event) {
  if (event && event.key && event.key !== "Enter") return;
  const inputEl = document.getElementById("pinyin-input");
  if (!inputEl) return;

  let input = inputEl.value.trim().toLowerCase();
  const word = getCurrentWord();
  if (!word) return;

  /* Đảo chiều: nhập Hán tự */
  if (reverseMode) {
    input = normalizeHan(input);
    const answers = [
      ...(word.traditional || "").split(/[()（）]/),
      ...(word.simplified || "").split(/[()（）]/)
    ].map(normalizeHan).filter(Boolean);
    if (answers.includes(input)) {
      showTemporaryMessage("✔️ Đúng rồi!", "success");
      speakChinese(word.traditional || word.simplified);
      inputEl.value = "";
      setTimeout(() => { toggleCard(); setTimeout(afterCorrect, 1000); }, 200);
    } else {
      showTemporaryMessage("❌ Sai Hán tự!", "error", 3000);
    }
    return;
  }

  /* Mặc định: pinyin */
  input = input.replace(/\s+/g, "");
  input = numberToTone(input);
  const expected = (word.pinyin || "").toLowerCase().replace(/\s+/g, "");
  const matched = quickReviewMode
    ? removeToneMarks(input) === removeToneMarks(expected)
    : input === expected;

  if (matched) {
    showTemporaryMessage("✔️ Đúng rồi!", "success");
    speakChinese(word.traditional || word.simplified);
    inputEl.value = "";
    setTimeout(() => { toggleCard(); setTimeout(afterCorrect, 1000); }, 200);
  } else {
    const errs = comparePinyinDetailed(input, expected);
    if (errs.length) showTemporaryMessage("❌ Sai!\n" + errs.join("\n"), "error", 4000);
    else showTemporaryMessage("❌ Sai rồi! Gõ đúng pinyin có dấu hoặc số", "error", 3000);
  }
}

function afterCorrect() {
  showFront = true;
  if (isSummaryMode) { summaryIndex = (summaryIndex + 1) % summaryCards.length; updateSummaryCard(); }
  else if (reviewingMode) { reviewCardIndex = (reviewCardIndex + 1) % reviewCards.length; updateReviewCard(); }
  else {
    const words = vocabularyData[currentLesson] || [];
    currentCardIndex = (currentCardIndex + 1) % Math.max(words.length, 1);
    updateCard();
  }
}

/* ============================================================================
 * TTS
 * ==========================================================================*/
function getZhVoice() {
  const voices = speechSynthesis.getVoices();
  return voices.find(v => v.name.includes("Google") && v.lang === "zh-CN")
      || voices.find(v => v.lang === "zh-CN" && v.name.toLowerCase().includes("female"))
      || voices.find(v => v.lang === "zh-CN")
      || voices.find(v => v.lang.startsWith("zh"))
      || null;
}

function speakChinese(text) {
  return new Promise(resolve => {
    if (!text) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const v = getZhVoice();
    if (v) u.voice = v;
    u.lang = "zh-CN"; u.rate = 0.9;
    u.onend = resolve; u.onerror = resolve;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  });
}

function readChinese(text) {
  if (!text) return;
  const u = new SpeechSynthesisUtterance(text);
  const v = getZhVoice();
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

function readChineseWithHighlight(chars, pinyins, spans) {
  return (async () => {
    for (let i = 0; i < chars.length; i++) {
      spans.forEach(s => s.style.background = "");
      spans[i].style.background = "yellow";
      const u = new SpeechSynthesisUtterance(chars[i]);
      const v = getZhVoice();
      if (v) u.voice = v;
      u.rate = 0.6;
      await new Promise(r => { u.onend = r; speechSynthesis.speak(u); });
      await new Promise(r => setTimeout(r, 400));
    }
    spans.forEach(s => s.style.background = "");
  })();
}

async function readCard() {
  const word = getCurrentWord();
  if (!word) return;
  const han = word.traditional || word.simplified;
  const eng = englishMap[han];
  speechSynthesis.cancel();

  if (showFront) {
    await speakChinese(han);
    await new Promise(r => setTimeout(r, 400));
    if (eng?.english) {
      const u = new SpeechSynthesisUtterance(eng.english);
      const v = availableVoices.find(x => x.lang === "en-US" && x.name.toLowerCase().includes("google"))
             || availableVoices.find(x => x.lang === "en-US" && x.name.toLowerCase().includes("zira"))
             || availableVoices.find(x => x.lang === "en-US")
             || availableVoices.find(x => x.lang.startsWith("en"));
      if (v) u.voice = v;
      u.lang = "en-US"; u.rate = 0.82;
      speechSynthesis.speak(u);
    }
  } else {
    const u = new SpeechSynthesisUtterance(`${word.hanViet || ""} --- ${word.meaning || ""}`);
    const v = availableVoices.find(x => x.lang === "vi-VN");
    if (v) u.voice = v;
    u.lang = "vi-VN"; u.rate = 1;
    speechSynthesis.speak(u);
  }
}

async function readEnglishCard() {
  const word = getCurrentWord();
  if (!word) return;
  const eng = englishMap[word.traditional || word.simplified];
  if (!eng?.english) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(eng.english);
  const v = availableVoices.find(x => x.lang === "en-US" && x.name.toLowerCase().includes("google"))
         || availableVoices.find(x => x.lang === "en-US")
         || availableVoices.find(x => x.lang.startsWith("en"));
  if (v) u.voice = v;
  u.lang = "en-US"; u.rate = 0.82;
  speechSynthesis.speak(u);
}

async function generateTTS() {
  const text = document.getElementById("text")?.value;
  if (!text) return;
  try {
    const r = await fetch("/tts-multi", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!r.ok) throw new Error("Server error");
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const player = document.getElementById("player");
    if (player) player.src = url;
    const dl = document.getElementById("download");
    if (dl) dl.href = url;
  } catch (e) { console.error(e); alert("Lỗi tạo audio!"); }
}

function ttsSpeak() {
  const text = document.getElementById("ttsInput")?.value.trim();
  if (!text) return;
  speakChinese(text);
  if (window.pinyinPro) {
    document.getElementById("ttsPinyin").innerText =
      window.pinyinPro.pinyin(text, { toneType: "tone-mark" });
  }
  fetch("https://translate.argosopentech.com/translate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text, source: "zh", target: "vi", format: "text" })
  }).then(r => r.json())
    .then(d => { document.getElementById("ttsVietnamese").innerText = d.translatedText; })
    .catch(() => { document.getElementById("ttsVietnamese").innerText = "⚠️ Không dịch được"; });
}
document.getElementById("ttsSpeak")?.addEventListener("click", ttsSpeak);

/* ============================================================================
 * FLAGS
 * ==========================================================================*/
function markWordForReview() {
  const word = getCurrentWord();
  if (!word) return;
  word.needReview = !word.needReview;
  // Sync về bản gốc nếu đang ôn
  if (reviewingMode || isSummaryMode) {
    const words = vocabularyData[currentLesson] || [];
    const i = words.findIndex(w =>
      w.traditional === word.traditional && w.simplified === word.simplified &&
      w.hanViet === word.hanViet && w.pinyin === word.pinyin
    );
    if (i !== -1) words[i].needReview = word.needReview;
  }
  saveVocabularyData(vocabularyData);
  if (isSummaryMode) updateSummaryCard();
  else if (reviewingMode) updateReviewCard();
  else updateCard();
}

function toggleLyHopMark() {
  skipNextFocus = true;
  const word = getCurrentWord();
  if (!word) return;
  word.lyHop = !word.lyHop;
  if (reviewingMode || isSummaryMode) {
    const words = vocabularyData[currentLesson] || [];
    const i = words.findIndex(w =>
      w.traditional === word.traditional && w.simplified === word.simplified &&
      w.hanViet === word.hanViet && w.pinyin === word.pinyin
    );
    if (i !== -1) words[i].lyHop = word.lyHop;
  }
  saveVocabularyData(vocabularyData);
  updateCard();
}

function toggleTocflMark() {
  const word = getCurrentWord();
  if (!word) return;
  if (typeof word.tocflFlag === "undefined") word.tocflFlag = false;
  word.tocflFlag = !word.tocflFlag;
  if (!vocabularyData["tocfl"]) vocabularyData["tocfl"] = [];
  if (word.tocflFlag) {
    if (!vocabularyData["tocfl"].some(w =>
      w.traditional === word.traditional && w.simplified === word.simplified && w.pinyin === word.pinyin
    )) vocabularyData["tocfl"].push({ ...word });
  } else {
    vocabularyData["tocfl"] = vocabularyData["tocfl"].filter(w =>
      !(w.traditional === word.traditional && w.simplified === word.simplified && w.pinyin === word.pinyin)
    );
  }
  saveVocabularyData(vocabularyData);
  updateCard();
  alert(word.tocflFlag ? "🔔 Đã thêm vào tocfl" : "❌ Đã gỡ khỏi tocfl");
}

function addWordToTocflTopic() {
  const words = vocabularyData[currentLesson] || [];
  const word = words[currentCardIndex];
  if (!word) return;
  if (!vocabularyData["tocfl-topic"]) vocabularyData["tocfl-topic"] = [];
  const exists = vocabularyData["tocfl-topic"].some(w =>
    w.traditional === word.traditional && w.simplified === word.simplified
  );
  if (!exists) {
    vocabularyData["tocfl-topic"].push({ ...word, tocflTopicFlag: true });
    saveVocabularyData(vocabularyData);
    alert(`✔️ Đã thêm "${word.traditional}" vào tocfl-topic`);
  } else alert("⚠️ Đã có trong tocfl-topic");
}

function isMarked(w) {
  const v = w && w.needReview;
  return v === true || v === "true" || v === 1 || v === "1";
}

function collectMarkedFromAllLessons(data) {
  const out = [];
  for (const lesson of Object.values(data)) {
    let words = Array.isArray(lesson) ? lesson : (Array.isArray(lesson?.words) ? lesson.words : []);
    out.push(...words.filter(isMarked));
  }
  return out;
}

/* ============================================================================
 * REVIEW MODE
 * ==========================================================================*/
function startReviewMode() {
  const words = vocabularyData[currentLesson] || [];
  reviewCards = words.filter(w => w.needReview);
  if (!reviewCards.length) { alert("⚠️ Không có từ nào được đánh dấu."); return; }
  reviewingMode = "single";
  reviewCardIndex = 0; showFront = true;
  const rb = document.getElementById("reviewBtn"); if (rb) rb.style.display = "none";
  const rab = document.getElementById("reviewAllBtn"); if (rab) rab.style.display = "none";
  const ex = document.getElementById("exitReviewBtn"); if (ex) ex.style.display = "inline-block";
  updateReviewCard();
}

function startReviewAll() {
  reviewCards = collectMarkedFromAllLessons(vocabularyData);
  if (!reviewCards.length) { alert("⚠️ Không có từ nào được đánh dấu."); return; }
  reviewingMode = "all";
  reviewCardIndex = 0; showFront = true;
  const rb = document.getElementById("reviewBtn"); if (rb) rb.style.display = "none";
  const rab = document.getElementById("reviewAllBtn"); if (rab) rab.style.display = "none";
  const ex = document.getElementById("exitReviewBtn"); if (ex) ex.style.display = "inline-block";
  updateReviewCard();
}

function exitReviewMode() {
  reviewingMode = null;
  reviewCards = []; reviewCardIndex = 0; showFront = true;
  resetControls();
  updateCard();
}

function resetControls() {
  const rb = document.getElementById("reviewBtn");
  const rab = document.getElementById("reviewAllBtn");
  const ex = document.getElementById("exitReviewBtn");
  const exS = document.getElementById("exitSummaryBtn");
  if (rb) rb.style.display = "inline-block";
  if (rab) rab.style.display = "inline-block";
  if (ex) ex.style.display = "none";
  if (exS) exS.style.display = "none";
}

function checkReviewStatus() {
  const words = vocabularyData[currentLesson] || [];
  const marked = words.filter(w => w.needReview);
  if (!marked.length) { alert("🎉 Chúc mừng! Bạn đã hoàn thành bài học."); return; }
  const html = marked.map((w, i) =>
    `<p><strong>${i+1}. ${w.traditional} (${w.simplified}) - ${w.hanViet}</strong><br>Pinyin: ${w.pinyin}<br>Nghĩa: ${w.meaning}</p>`
  ).join("");
  const el = document.getElementById("review-list");
  const modal = document.getElementById("review-modal");
  if (el) el.innerHTML = html;
  if (modal) modal.style.display = "block";
}

async function copyReviewList() {
  const words = (vocabularyData[currentLesson] || []).filter(w => w.needReview);
  if (!words.length) { alert("⚠️ Không có từ đánh dấu."); return; }
  const text = words.map(w => w.traditional || w.simplified || "").filter(Boolean).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    alert(`✅ Đã copy ${words.length} từ!`);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.left = "-9999px";
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand("copy"); alert(`✅ Đã copy ${words.length} từ!`); }
    catch { alert("❌ Không copy được."); }
    ta.remove();
  }
}

function startSummaryReview() {
  const main = document.getElementById("multi-main-select");
  const sub = document.getElementById("multi-sub-select");
  const lessons = [
    ...Array.from(main?.selectedOptions || []).map(o => o.value),
    ...Array.from(sub?.selectedOptions || []).map(o => o.value)
  ];
  if (!lessons.length) { alert("Vui lòng chọn ít nhất 1 bài."); return; }
  summaryCards = lessons.flatMap(l => vocabularyData[l] || []);
  if (!summaryCards.length) { alert("Không có từ trong các bài đã chọn."); return; }
  isSummaryMode = true; summaryIndex = 0; showFront = true;
  const ex = document.getElementById("exitSummaryBtn"); if (ex) ex.style.display = "inline-block";
  closeSummaryModal();
  updateSummaryCard();
}

function exitSummaryReview() {
  isSummaryMode = false; summaryCards = []; summaryIndex = 0; showFront = true;
  const ex = document.getElementById("exitSummaryBtn"); if (ex) ex.style.display = "none";
  updateCard();
}

function closeSummaryModal() {
  const m = document.getElementById("summaryModal"); if (m) m.style.display = "none";
}
function closeReviewAllModal() {
  const m = document.getElementById("reviewAllModal"); if (m) m.style.display = "none";
}

/* Wire review buttons */
document.getElementById("reviewBtn")?.addEventListener("click", startReviewMode);
document.getElementById("reviewAllBtn")?.addEventListener("click", startReviewAll);
document.getElementById("exitReviewBtn")?.addEventListener("click", exitReviewMode);
document.getElementById("copyReviewBtn")?.addEventListener("click", copyReviewList);
document.getElementById("summary-review-btn")?.addEventListener("click", () => {
  const modal = document.getElementById("summaryModal"); if (!modal) return;
  modal.style.display = "block";
  const main = document.getElementById("multi-main-select");
  const sub = document.getElementById("multi-sub-select");
  if (main) main.innerHTML = "";
  if (sub) sub.innerHTML = "";
  document.querySelectorAll("#lesson-selector option").forEach(o => {
    const n = document.createElement("option"); n.value = o.value; n.textContent = o.textContent;
    main?.appendChild(n);
  });
  document.querySelectorAll("#sub-lesson-selector option").forEach(o => {
    const n = document.createElement("option"); n.value = o.value; n.textContent = o.textContent;
    sub?.appendChild(n);
  });
});
document.getElementById("startSummaryBtn")?.addEventListener("click", startSummaryReview);
document.getElementById("exitSummaryBtn")?.addEventListener("click", exitSummaryReview);

/* ============================================================================
 * CRUD
 * ==========================================================================*/
async function addVocabularyBatch() {
  const input = document.getElementById("vocabulary-input")?.value.trim();
  if (!input) { alert("Vui lòng nhập từ vựng."); return; }
  const lines = input.split("\n");
  const newWords = [], skipped = [];
  lines.forEach(line => {
    if (!line.trim()) return;
    const parts = line.split("---");
    if (parts.length !== 2) { alert(`❌ Dòng không hợp lệ: ${line}`); return; }
    const hanViet = parts[0].trim();
    const rest = parts[1].trim().split(";");
    if (rest.length !== 3) { alert(`❌ Dòng không hợp lệ: ${line}`); return; }
    const meaning = rest[0].trim();
    const chineseInput = rest[1].trim();
    const pinyin = rest[2].trim();
    const m = chineseInput.match(/^(.+)\s*\((.+)\)$/);
    let traditional, simplified;
    if (m) { traditional = m[1].trim(); simplified = m[2].trim(); }
    else { traditional = simplified = chineseInput; }
    const words = vocabularyData[currentLesson] || [];
    if (words.some(w =>
      normalizeHan(w.traditional || "") === normalizeHan(traditional) ||
      normalizeHan(w.simplified || "") === normalizeHan(simplified)
    )) skipped.push(traditional || simplified);
    else newWords.push({ hanViet, meaning, traditional, simplified, pinyin, needReview: false });
  });
  vocabularyData[currentLesson] = vocabularyData[currentLesson] || [];
  vocabularyData[currentLesson].push(...newWords);
  await saveVocabularyData(vocabularyData);
  updateLessonView();
  document.getElementById("vocabulary-input").value = "";
  alert(`✅ Đã thêm ${newWords.length} từ.`);
  if (skipped.length) alert(`⚠️ Trùng: ${skipped.join(", ")}`);
}

function addWord(lessonId, newWord) {
  if (!vocabularyData[lessonId]) vocabularyData[lessonId] = [];
  vocabularyData[lessonId].push(newWord);
  saveVocabularyData(vocabularyData);
  updateLessonView();
}

function editWord(lessonId, index, updated) {
  if (vocabularyData[lessonId]?.[index]) {
    vocabularyData[lessonId][index] = updated;
    saveVocabularyData(vocabularyData);
    updateLessonView();
  }
}

function editWordPrompt(index) {
  const words = vocabularyData[currentLesson] || [];
  const word = words[index];
  if (!word) return;
  const cur = `${word.hanViet} --- ${word.meaning}; ${word.traditional === word.simplified ? word.traditional : word.traditional + " (" + word.simplified + ")"}; ${word.pinyin}`;
  const nv = prompt("Chỉnh sửa (HánViệt --- Nghĩa; Hán tự; Pinyin):", cur);
  if (!nv || !nv.includes("---") || !nv.includes(";")) { alert("Định dạng không hợp lệ."); return; }
  const parts = nv.split("---");
  const hanViet = parts[0].trim();
  const rest = parts[1].trim().split(";");
  if (rest.length !== 3) { alert("Định dạng không hợp lệ."); return; }
  const meaning = rest[0].trim();
  const chineseInput = rest[1].trim();
  const pinyin = rest[2].trim();
  const m = chineseInput.match(/^(.+)\s*\((.+)\)$/);
  let traditional, simplified;
  if (m) { traditional = m[1].trim(); simplified = m[2].trim(); }
  else { traditional = simplified = chineseInput; }
  vocabularyData[currentLesson][index] = {
    hanViet, meaning, traditional, simplified, pinyin,
    needReview: word.needReview || false, note: word.note || ""
  };
  saveVocabularyData(vocabularyData);
  updateLessonView();
  alert("✔️ Đã cập nhật.");
}

function deleteWord(lessonId, index) {
  if (!vocabularyData[lessonId]) return;
  vocabularyData[lessonId].splice(index, 1);
  saveVocabularyData(vocabularyData);
  if (lessonId === currentLesson) {
    if (currentCardIndex >= (vocabularyData[lessonId]?.length || 0))
      currentCardIndex = Math.max(0, (vocabularyData[lessonId]?.length || 1) - 1);
    updateLessonView();
  }
}

function deleteCurrentWord() {
  const words = vocabularyData[currentLesson] || [];
  const word = words[currentCardIndex];
  if (!word) { alert("❌ Không có từ để xoá."); return; }
  if (!confirm(`Xoá từ "${word.traditional || word.simplified}" (${word.hanViet})?`)) return;
  words.splice(currentCardIndex, 1);
  if (currentCardIndex > 0) currentCardIndex--;
  saveVocabularyData(vocabularyData);
  if (words.length > 0) updateLessonView();
  else alert("📭 Đã xoá hết từ trong bài!");
}
document.getElementById("delete-current-word-btn")?.addEventListener("click", deleteCurrentWord);

function deleteCurrentLessonWords() {
  if (!confirm(`Xoá toàn bộ từ trong ${currentLesson}?`)) return;
  vocabularyData[currentLesson] = [];
  saveVocabularyData(vocabularyData);
  updateLessonView();
}

function deleteRange() {
  const start = parseInt(document.getElementById("deleteStart")?.value, 10);
  const end   = parseInt(document.getElementById("deleteEnd")?.value, 10);
  if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
    alert("⚠️ Nhập khoảng hợp lệ."); return;
  }
  const words = vocabularyData[currentLesson] || [];
  if (start > words.length || end > words.length) {
    alert(`⚠️ Vượt quá ${words.length} từ.`); return;
  }
  if (!confirm(`Xoá ${start}–${end} trong ${currentLesson}?`)) return;
  for (let i = end - 1; i >= start - 1; i--) words.splice(i, 1);
  saveVocabularyData(vocabularyData);
  updateLessonView();
  alert(`✔️ Đã xoá ${end - start + 1} từ.`);
}

function showVocabulary() {
  const list = document.getElementById("vocabulary-list");
  if (!list) return;
  list.classList.toggle("show");
}

function checkDuplicates() {
  const words = vocabularyData[currentLesson] || [];
  const map = {};
  words.forEach((w, i) => {
    const k = `${w.traditional}_${w.simplified}`;
    (map[k] = map[k] || { indexes: [], word: w }).indexes.push(i + 1);
  });
  const dup = Object.values(map).filter(x => x.indexes.length > 1);
  if (!dup.length) { alert("✅ Không có từ trùng."); return; }
  let html = "<h3>Từ trùng</h3><ul>";
  dup.forEach(({ indexes, word }) => {
    const disp = word.traditional === word.simplified
      ? word.traditional : `${word.traditional} (${word.simplified})`;
    html += `<li><strong>${disp}</strong> --- ${word.hanViet} --- ${word.meaning} (${word.pinyin})<br>
      <small>Vị trí: ${indexes.join(", ")}</small></li>`;
  });
  html += `</ul><button onclick="deleteAllDuplicates()">🗑 Xoá tất cả</button>
           <button onclick="closeDuplicatePopup()">Đóng</button>`;
  const c = document.getElementById("duplicatePopupContent");
  if (c) c.innerHTML = html;
  document.getElementById("duplicatePopup")?.classList.add("show");
  document.getElementById("duplicateOverlay")?.classList.add("show");
}
document.getElementById("checkDuplicatesBtn")?.addEventListener("click", checkDuplicates);

function deleteAllDuplicates() {
  if (!confirm("Xoá tất cả từ trùng (giữ bản cuối)?")) return;
  const words = vocabularyData[currentLesson] || [];
  const seen = {}, unique = [];
  for (let i = words.length - 1; i >= 0; i--) {
    const k = `${words[i].traditional}_${words[i].simplified}`;
    if (!seen[k]) { seen[k] = true; unique.unshift(words[i]); }
  }
  vocabularyData[currentLesson] = unique;
  saveVocabularyData(vocabularyData);
  closeDuplicatePopup();
  updateLessonView();
  alert("✔️ Đã xoá trùng.");
}

function closeDuplicatePopup() {
  document.getElementById("duplicatePopup")?.classList.remove("show");
  document.getElementById("duplicateOverlay")?.classList.remove("show");
}

function optimizeVocabularyData() {
  let added = 0;
  let allWords = [];
  for (const k of Object.keys(vocabularyData)) {
    if (!Array.isArray(vocabularyData[k])) continue;
    vocabularyData[k].forEach((w, i) => allWords.push({ ...w, lessonKey: k, idx: i }));
  }
  for (let i = allWords.length - 1; i >= 0; i--) {
    const w = allWords[i];
    if (w.note) continue;
    const target = normalizeHan(w.traditional || w.simplified);
    for (let j = i - 1; j >= 0; j--) {
      const c = allWords[j];
      if (normalizeHan(c.traditional || c.simplified) === target && c.note) {
        vocabularyData[w.lessonKey][w.idx].note = c.note;
        added++; break;
      }
    }
  }
  if (added) { saveVocabularyData(vocabularyData); alert(`✅ Đã thêm ${added} ghi chú.`); }
  else alert("ℹ️ Không có gì để bổ sung.");
}
document.getElementById("optimizeDataBtn")?.addEventListener("click", optimizeVocabularyData);

function sortByHanCharacter() {
  if (!vocabularyData[currentLesson]) return;
  const first = w => (w.traditional || w.simplified || "").trim().charAt(0) || "";
  vocabularyData[currentLesson].sort((a, b) => first(a).localeCompare(first(b), "zh-Hans"));
  saveVocabularyData(vocabularyData);
  updateLessonView();
  alert(`✅ Đã sắp xếp ${currentLesson}.`);
}
document.getElementById("sortByHanBtn")?.addEventListener("click", sortByHanCharacter);

function openEditModal() {
  const word = getCurrentWord();
  if (!word) { alert("❌ Không có từ để sửa."); return; }
  document.getElementById("edit-hantu-input").value =
    word.traditional === word.simplified ? (word.traditional || "")
    : `${word.traditional || ""} (${word.simplified || ""})`;
  document.getElementById("edit-hanviet-input").value = word.hanViet || "";
  document.getElementById("edit-meaning-input").value = word.meaning || "";
  document.getElementById("edit-pinyin-input").value = word.pinyin || "";
  document.getElementById("editWordModal").style.display = "block";

  const saveBtn = document.getElementById("saveEditBtn");
  saveBtn.onclick = async () => {
    const hanTu = document.getElementById("edit-hantu-input").value.trim();
    const hanViet = document.getElementById("edit-hanviet-input").value.trim();
    const meaning = document.getElementById("edit-meaning-input").value.trim();
    const pinyin  = document.getElementById("edit-pinyin-input").value.trim();
    const m = hanTu.match(/^(.+?)\s*\((.+?)\)$/);
    let traditional, simplified;
    if (m) { traditional = m[1].trim(); simplified = m[2].trim(); }
    else { traditional = simplified = hanTu; }
    Object.assign(word, { traditional, simplified, hanViet, meaning, pinyin });
    await saveVocabularyData(vocabularyData);
    closeEditModal();
    if (reviewingMode) updateReviewCard();
    else if (isSummaryMode) updateSummaryCard();
    else updateCard();
    alert("✔️ Đã lưu.");
  };
}
document.getElementById("edit-current-word-btn")?.addEventListener("click", openEditModal);

function closeEditModal() {
  const m = document.getElementById("editWordModal"); if (m) m.style.display = "none";
}

/* ============================================================================
 * NOTES
 * ==========================================================================*/
function showNote() {
  const word = getCurrentWord();
  if (!word) { alert("Không tìm thấy từ."); return; }
  document.getElementById("noteText").value = word.note || "";
  document.getElementById("noteModal").style.display = "block";
  document.getElementById("saveNoteBtn").onclick = async () => {
    word.note = document.getElementById("noteText").value.trim();
    await saveVocabularyData(vocabularyData);
    document.getElementById("noteModal").style.display = "none";
    alert("✔️ Đã lưu ghi chú.");
  };
}

function editNote() {
  const word = getCurrentWord();
  if (!word) return;
  const nn = prompt("Chỉnh sửa ghi chú:", word.note || "");
  if (nn !== null) {
    word.note = nn.trim();
    saveVocabularyData(vocabularyData);
    alert("✔️ Đã lưu.");
  }
}

function closeNote() {
  const m = document.getElementById("noteModal"); if (m) m.style.display = "none";
}

function toggleNoteArea() {
  document.getElementById("note-area")?.classList.toggle("minimize");
}

function showTips() {
  const word = getCurrentWord();
  if (!word) { alert("⚠️ Không có từ."); return; }
  const target = word.traditional || word.simplified;
  if (word.note) {
    const t = document.getElementById("hintText");
    if (t) t.innerText = `Ghi chú: ${word.note}`;
    document.getElementById("hintPopup")?.classList.add("show");
    document.getElementById("hintOverlay")?.classList.add("show");
    return;
  }
  // Tìm note ở bài khác
  let found = null;
  for (const [, words] of Object.entries(vocabularyData)) {
    if (!Array.isArray(words)) continue;
    const w = words.find(it => (it.traditional === target || it.simplified === target) && it.note);
    if (w) { found = w.note; break; }
  }
  if (found && confirm(`📌 Có note cho "${target}". Copy vào?`)) {
    word.note = found;
    saveVocabularyData(vocabularyData);
    alert("✔️ Đã copy.");
    return;
  }
  if (confirm(`❌ Không có note. Tự thêm?`)) {
    const nn = prompt("Nhập ghi chú:");
    if (nn) { word.note = nn.trim(); saveVocabularyData(vocabularyData); alert("✔️ Đã lưu."); }
  }
}

function closeHintPopup() {
  document.getElementById("hintPopup")?.classList.remove("show");
  document.getElementById("hintOverlay")?.classList.remove("show");
}

/* Sticky notes */
function initStickyNotes() {
  const container = document.getElementById("note-area");
  const addBtn = document.getElementById("add-note-btn");
  if (!container || !addBtn) return;
  let notes = JSON.parse(localStorage.getItem("sticky_notes") || "[]");
  const save = () => {
    localStorage.setItem("sticky_notes", JSON.stringify(notes));
    vocabularyData["_stickyNotes"] = notes;
    saveVocabularyData(vocabularyData);
  };
  const createNote = (id, content = "", minimized = false) => {
    const note = document.createElement("div");
    note.className = "note"; note.dataset.id = id;
    const header = document.createElement("div"); header.className = "note-header";
    const close = document.createElement("button"); close.textContent = "✖";
    close.onclick = () => { notes = notes.filter(n => n.id !== id); save(); note.remove(); };
    const min = document.createElement("button"); min.textContent = "---";
    const ta = document.createElement("textarea");
    ta.value = content;
    ta.style.display = minimized ? "none" : "block";
    min.onclick = () => {
      const hidden = getComputedStyle(ta).display === "none";
      ta.style.display = hidden ? "block" : "none";
      const idx = notes.findIndex(n => n.id === id);
      if (idx !== -1) { notes[idx].minimized = !hidden; save(); }
    };
    ta.oninput = () => {
      const idx = notes.findIndex(n => n.id === id);
      if (idx !== -1) { notes[idx].content = ta.value; save(); }
    };
    header.appendChild(close); header.appendChild(min);
    note.appendChild(header); note.appendChild(ta);
    container.appendChild(note);
  };
  addBtn.onclick = () => {
    const id = Date.now();
    const nn = { id, content: "", minimized: false };
    notes.push(nn); createNote(id, "", false); save();
  };
  notes.forEach(n => createNote(n.id, n.content, n.minimized));
}

/* ============================================================================
 * SEARCH & COMPARE
 * ==========================================================================*/
function openHanSearchPopup(keyword) {
  if (!keyword || !keyword.trim()) return;
  const kw = normalizeHan(keyword);
  const results = [];
  Object.keys(vocabularyData).forEach(lessonId => {
    const list = Array.isArray(vocabularyData[lessonId]) ? vocabularyData[lessonId] : [];
    list.forEach((word, idx) => {
      if (normalizeHan(word.traditional).includes(kw) || normalizeHan(word.simplified).includes(kw))
        results.push({ lessonId, idx, word });
    });
  });
  const resultsDiv = document.getElementById("hanSearchResults");
  const popup = document.getElementById("hanSearchPopup");
  if (!resultsDiv || !popup) return;

  if (!results.length) resultsDiv.innerHTML = "<p>❌ Không tìm thấy.</p>";
  else {
    resultsDiv.innerHTML = results.map(r => `
      <div class="search-result-item">
        <button class="goto-btn" data-lesson="${r.lessonId}" data-index="${r.idx}">Đi</button>
        <span class="result-text">
          <strong>${r.word.traditional}</strong>
          ${r.word.simplified && r.word.simplified !== r.word.traditional ? ` (${r.word.simplified})` : ""}
          --- ${r.word.hanViet} --- ${r.word.pinyin}
          <span class="lesson-label">[${r.lessonId} #${r.idx + 1}]</span>
        </span>
      </div>`).join("");
    resultsDiv.querySelectorAll(".goto-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const lesson = btn.getAttribute("data-lesson");
        const idx = parseInt(btn.getAttribute("data-index"), 10);
        currentLesson = lesson;
        currentCardIndex = idx;
        showFront = true;
        if (lessonSelect) lessonSelect.value = lesson;
        updateLessonView();
        closeHanSearchPopup();
      });
    });
  }
  popup.style.display = "block";
}

function closeHanSearchPopup() {
  const p = document.getElementById("hanSearchPopup"); if (p) p.style.display = "none";
}

document.getElementById("searchHanInput")?.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    const kw = e.target.value.trim();
    if (kw) openHanSearchPopup(kw);
  }
});

function openTraditionalList() {
  const words = vocabularyData[currentLesson] || [];
  const list = words.map(w => w.traditional).filter(Boolean).sort().join(" , ");
  const c = document.getElementById("traditionalListContent");
  if (c) c.innerHTML = `<h3>Danh sách Hán tự</h3><p style="word-break:break-all;">${list}</p>`;
  document.getElementById("traditionalListPopup")?.classList.add("show");
  document.getElementById("traditionalOverlay")?.classList.add("show");
}
document.getElementById("getTraditionalListBtn")?.addEventListener("click", openTraditionalList);

function closeTraditionalListPopup() {
  document.getElementById("traditionalListPopup")?.classList.remove("show");
  document.getElementById("traditionalOverlay")?.classList.remove("show");
}

function initHanziCompare() {
  const toggle = document.createElement("button");
  toggle.id = "hanzi-compare-toggle";
  toggle.textContent = "🔍 So sánh chữ";
  Object.assign(toggle.style, {
    position: "fixed", right: "20px", top: "250px", zIndex: 9999,
    padding: "8px 14px", border: "none", borderRadius: "5px",
    background: "#2196F3", color: "#fff", cursor: "pointer", fontSize: "14px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
  });
  document.body.appendChild(toggle);

  const box = document.createElement("div");
  box.id = "hanzi-compare-box";
  Object.assign(box.style, {
    position: "fixed", right: "20px", top: "295px", width: "400px",
    minHeight: "300px", background: "#fff", border: "1px solid #ddd",
    borderRadius: "8px", boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
    zIndex: 9998, padding: "15px", boxSizing: "border-box", display: "none"
  });
  box.innerHTML = `<div style="font-size:16px;font-weight:bold;margin-bottom:10px;color:#444;text-align:center;">Ô SO SÁNH CHỮ HÁN</div>`;

  const input = document.createElement("input");
  input.type = "text"; input.placeholder = "Nhập chữ cần so sánh...";
  Object.assign(input.style, {
    width: "100%", height: "42px", padding: "8px 10px", boxSizing: "border-box",
    border: "1px solid #ccc", borderRadius: "5px", fontSize: "18px", outline: "none"
  });
  box.appendChild(input);

  const disp = document.createElement("div");
  Object.assign(disp.style, {
    width: "100%", minHeight: "190px", marginTop: "15px",
    display: "flex", justifyContent: "center", alignItems: "center",
    flexWrap: "wrap", gap: "15px", overflowY: "auto", boxSizing: "border-box"
  });
  box.appendChild(disp);

  const clear = document.createElement("button");
  clear.textContent = "✕ Xóa";
  Object.assign(clear.style, {
    display: "block", margin: "10px auto 0", padding: "6px 18px",
    border: "none", borderRadius: "5px", background: "#f44336",
    color: "#fff", cursor: "pointer", fontSize: "14px"
  });
  box.appendChild(clear);
  document.body.appendChild(box);

  input.addEventListener("input", () => {
    disp.innerHTML = "";
    if (!input.value.trim()) return;
    [...input.value].forEach(ch => {
      const el = document.createElement("span");
      el.textContent = ch;
      Object.assign(el.style, {
        fontSize: "110px", lineHeight: "1.1",
        fontFamily: "Arial, 'Noto Sans TC', 'Microsoft JhengHei', sans-serif",
        color: "#000", display: "inline-block", textAlign: "center"
      });
      disp.appendChild(el);
    });
  });
  clear.onclick = () => { input.value = ""; disp.innerHTML = ""; input.focus(); };
  toggle.onclick = () => {
    const showing = box.style.display === "block";
    box.style.display = showing ? "none" : "block";
    toggle.textContent = showing ? "🔍 So sánh chữ" : "✕ Đóng so sánh";
  };
}

/* ============================================================================
 * TONE TRAINER
 * ==========================================================================*/
function initToneTrainer() {
  const toneInput = document.getElementById("toneInput");
  if (!toneInput) return;
  const spans = ["tone1","tone2","tone3","tone4"].map(id => document.getElementById(id));
  toneInput.addEventListener("keyup", async e => {
    if (e.key !== "Enter") return;
    const raw = toneInput.value.trim().toLowerCase();
    if (!raw) return;
    const base = removeToneMarks(raw);
    const pinyins = [1,2,3,4].map(n => convertNumberedPinyinToMarked(base + n));
    spans.forEach((s, i) => { if (s) s.textContent = pinyins[i] || "-"; });
    const chars = toneExamples[base];
    if (chars) await readChineseWithHighlight(chars, pinyins, spans);
    else alert(`❌ Chưa có ví dụ cho "${base}".`);
  });
}

/* ============================================================================
 * KEYBOARD SHORTCUTS
 * ==========================================================================*/
document.addEventListener("keydown", event => {
  if (event.target.closest(".note") || event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") {
    // cho phép Enter trong ô pinyin (đã có listener riêng)
    return;
  }
  switch (event.key) {
    case "ArrowLeft":  event.preventDefault(); prevCard(); break;
    case "ArrowRight": event.preventDefault(); nextCard(); break;
    case " ":          event.preventDefault(); toggleCard(); break;
    case "ArrowDown":  event.preventDefault(); readCard(); break;
    case "ArrowUp":    event.preventDefault(); markWordForReview(); break;
    case "Control":
      if (event.location === 1) { event.preventDefault(); readEnglishCard(); }
      else if (event.location === 2) { event.preventDefault(); showTips(); }
      break;
    case "Shift":
      if (event.location === 2) { event.preventDefault(); deleteCurrentWord(); }
      break;
    case "'": event.preventDefault(); addWordToTocflTopic(); break;
    default: break;
  }
});

document.addEventListener("keyup", event => {
  if (event.key === "/") tocflKeyLock = false;
});

/* ============================================================================
 * INIT
 * ==========================================================================*/
async function init() {
  try {
    console.log("🚀 Khởi động ứng dụng...");
    // Ưu tiên localStorage (giữ chỉnh sửa người dùng), nếu không thì tải file
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      try { vocabularyData = JSON.parse(local); }
      catch { vocabularyData = await loadVocabularyData(); }
    } else {
      vocabularyData = await loadVocabularyData();
    }
    await loadEnglishMap();
    await loadToneExamples();

    loadLessonsToSelector();

    // Enter trong ô pinyin
    const input = document.getElementById("pinyin-input");
    if (input) {
      input.addEventListener("input", e => {
        const raw = e.target.value;
        const conv = convertNumberedPinyinToMarked(raw);
        if (raw !== conv) e.target.value = conv;
      });
      input.addEventListener("keydown", e => {
        if (e.key === "Enter") checkPinyin(e);
      });
    }

    // jump-to-index
    const jump = document.getElementById("jump-to-index");
    if (jump) {
      jump.addEventListener("keydown", e => {
        if (e.key !== "Enter") return;
        const val = parseInt(jump.value, 10);
        if (isNaN(val) || val < 1) return;
        if (reviewingMode) {
          if (val <= reviewCards.length) { reviewCardIndex = val - 1; updateReviewCard(); }
        } else {
          const words = vocabularyData[currentLesson] || [];
          if (val <= words.length) { currentCardIndex = val - 1; updateCard(); }
        }
        jump.value = "";
      });
    }

    // Click flashcard copy Hán tự
    const flashcard = document.getElementById("flashcard");
    if (flashcard) {
      flashcard.addEventListener("click", e => {
        if (e.pointerType && e.pointerType !== "mouse") return;
        if (e.detail === 0) return;
        const word = getCurrentWord();
        if (!word) return;
        const han = word.traditional || word.simplified;
        navigator.clipboard.writeText(han)
          .then(() => showTemporaryMessage(`📋 Đã copy: ${han}`, "success"))
          .catch(err => console.error(err));
      });
    }

    updateLessonView();
    resetControls();
    initToneTrainer();
    initStickyNotes();
    initHanziCompare();
    console.log("✅ Khởi động thành công!");
  } catch (err) {
    console.error("❌ Lỗi khởi động:", err);
    updateLessonView();
  }
}
init();

/* ============================================================================
 * EXPORT cho inline handlers
 * ==========================================================================*/
Object.assign(window, {
  deleteWord, editWord, editWordPrompt, deleteCurrentWord, deleteCurrentLessonWords,
  deleteRange, addVocabularyBatch, closeEditModal, closeNote, closeSummaryModal,
  closeReviewAllModal, closeDuplicatePopup, deleteAllDuplicates, deleteDuplicate: (i) => deleteWord(currentLesson, i),
  showVocabulary, checkReviewStatus, closeHanSearchPopup, closeHintPopup,
  closeTraditionalListPopup, toggleCardOrder, shuffleCards, toggleNoteArea,
  toggleQuickReview, showTips, startSummaryReview, addWordToTocflTopic,
  toggleTocflMark, toggleLyHopMark, markWordForReview, readCard, readEnglishCard,
  optimizeVocabularyData, sortByHanCharacter, openTraditionalList
});