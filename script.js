// ==========================================================================
// 📌 1. BỘ NẠP & LƯU DỮ LIỆU TĨNH CHUẨN HOÁ (OFFLINE & LOCALHOST CAPABLE)
// ==========================================================================

// Tải dữ liệu từ vựng chính từ file static JSON
const loadVocabularyData = async () => {
  try {
    const response = await fetch("./vocabularyData.json", {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error("Không tải được dữ liệu vocabularyData.json");
    return await response.json();
  } catch (err) {
    console.error("❌ Lỗi loadVocabularyData:", err);
    return {};
  }
};

// Tải dữ liệu tiếng Anh bổ sung (English Map)
const loadEnglishMap = async () => {
  try {
    const response = await fetch("./english-map.json", {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
    });
    if (response.ok) {
      englishMap = await response.json();
      console.log("✅ Đã nạp English Map thành công");
    }
  } catch (err) {
    console.warn("ℹ️ Lỗi kết nối khi nạp english-map.json:", err.message);
  }
};

// Tải dữ liệu ví dụ Tone Trainer
const loadToneExamples = async () => {
  try {
    const res = await fetch("./lesson2.json", {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) return;
    const data = await res.json();
    toneExamples = data.toneExamples || {};
    console.log("✅ Đã load toneExamples thành công");
  } catch (err) {
    console.warn("ℹ️ Không nạp được toneExamples từ file tĩnh:", err.message);
  }
};

// Hàm lưu dữ liệu: Tự động phát hiện môi trường Express Server hoặc LocalStorage
async function saveVocabularyData(data) {
  try {
    // Thử gửi PUT request nếu đang chạy qua Server Node.js (Localhost)
    const response = await fetch("/api/vocabulary", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      console.log("✔️ Đã lưu dữ liệu vĩnh viễn qua Server Node.js!");
      return;
    }
  } catch (e) {
    // Fallback sang LocalStorage nếu chạy trên GitHub Pages tĩnh
  }

  try {
    localStorage.setItem("hanzii_vocabulary_data", JSON.stringify(data));
    console.log("✔️ Đã lưu dữ liệu tạm thời vào LocalStorage trình duyệt");
  } catch (err) {
    console.error("❌ Lỗi khi lưu vào LocalStorage:", err);
  }
}


// ==========================================================================
// 📌 2. BIẾN TOÀN CỤC & TRẠNG THÁI ỨNG DỤNG
// ==========================================================================
let vocabularyData = {};
let englishMap = {};
let toneExamples = {};
let skipNextFocus = false;

let currentLesson = "lesson1";
let selectedSource = "main"; // "main", "sub", "all", "new"
let showToneMarks = true;

let currentCardIndex = 0;
let showFront = true;
let tocflKeyLock = false;
let reviewingMode = null; // null, "single", "all"
let reviewCards = [];
let reviewCardIndex = 0;

let reverseMode = false;      // false = Hán -> Nghĩa, true = Nghĩa -> Hán
let quickReviewMode = false;  // Ôn nhanh (bỏ qua dấu)
let availableVoices = [];

let selectedHanLesson = null;
let selectedHanIndex = null;

let isSummaryMode = false;
let summaryCards = [];
let summaryIndex = 0;

window.speechSynthesis.onvoiceschanged = () => {
  availableVoices = speechSynthesis.getVoices();
};


// ==========================================================================
// 📌 3. LẮNG NGHE SỰ KIỆN CHỌN BÀI HỌC (LESSON SELECTORS)
// ==========================================================================
const lessonSelect = document.getElementById("lesson-selector");
const subSelect = document.getElementById("sub-lesson-selector");
const allLessonsSelector = document.getElementById("all-lessons-selector");
const newSelect = document.getElementById("new-lessons-selector");

if (lessonSelect) {
  lessonSelect.addEventListener("change", () => {
    reviewingMode = false;
    selectedSource = "main";
    lessonSelect.classList.add("select-highlight");
    if (subSelect) subSelect.classList.remove("select-highlight");
    if (allLessonsSelector) allLessonsSelector.classList.remove("select-highlight");
    if (newSelect) newSelect.classList.remove("select-highlight");
    updateCurrentLesson();
  });
}

if (subSelect) {
  subSelect.addEventListener("change", () => {
    reviewingMode = false;
    selectedSource = "sub";
    subSelect.classList.add("select-highlight");
    if (lessonSelect) lessonSelect.classList.remove("select-highlight");
    if (allLessonsSelector) allLessonsSelector.classList.remove("select-highlight");
    if (newSelect) newSelect.classList.remove("select-highlight");
    updateCurrentLesson();
  });
}

if (allLessonsSelector) {
  allLessonsSelector.addEventListener("change", () => {
    reviewingMode = false;
    selectedSource = "all";
    allLessonsSelector.classList.add("select-highlight");
    if (lessonSelect) lessonSelect.classList.remove("select-highlight");
    if (subSelect) subSelect.classList.remove("select-highlight");
    if (newSelect) newSelect.classList.remove("select-highlight");
    updateCurrentLesson();
  });
}

if (newSelect) {
  newSelect.addEventListener("change", () => {
    reviewingMode = false;
    selectedSource = "new";
    newSelect.classList.add("select-highlight");
    if (lessonSelect) lessonSelect.classList.remove("select-highlight");
    if (subSelect) subSelect.classList.remove("select-highlight");
    if (allLessonsSelector) allLessonsSelector.classList.remove("select-highlight");
    updateCurrentLesson();
  });
}

const updateCurrentLesson = () => {
  const main = lessonSelect ? lessonSelect.value : "lesson1";
  const sub  = subSelect ? subSelect.value : "";
  const all  = allLessonsSelector ? allLessonsSelector.value : "";
  const newLesson = newSelect ? newSelect.value : "";

  if (selectedSource === "sub" && sub !== "") {
    currentLesson = sub;
  } else if (selectedSource === "all" && all !== "") {
    currentLesson = all;
  } else if (selectedSource === "new" && newLesson !== "") {
    currentLesson = newLesson;
  } else {
    currentLesson = main;
  }

  currentCardIndex = 0;
  updateLessonView();
};


// ==========================================================================
// 📌 4. THUẬT TOÁN BIẾN ĐỔI PINYIN & KIỂM TRA ĐÁP ÁN (CHECK PINYIN)
// ==========================================================================
function removeToneMarks(str) {
  if (!str) return "";
  return String(str)
    .replace(/[āáǎà]/g,"a").replace(/[ēéěè]/g,"e")
    .replace(/[īíǐì]/g,"i").replace(/[ōóǒò]/g,"o")
    .replace(/[ūúǔù]/g,"u").replace(/[ǖǘǚǜ]/g,"ü");
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
  const isLetter = (ch) => /[A-Za-züÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(ch);
  const isDigitTone = (ch) => /[1-5]/.test(ch);

  const tokens = [];
  let i = 0, L = normalized.length;

  while (i < L) {
    const ch = normalized[i];
    if (isDigitTone(ch)) {
      tokens.push({type: 'digit', text: ch});
      i++;
      continue;
    }
    if (!isLetter(ch)) {
      let j = i + 1;
      while (j < L && !isLetter(normalized[j]) && !isDigitTone(normalized[j])) j++;
      tokens.push({type: 'other', text: normalized.slice(i, j)});
      i = j;
      continue;
    }

    const start = i;
    let matchedInitial = "";
    for (const ini of initials) {
      if (normalized.slice(start, start + ini.length).toLowerCase() === ini) {
        matchedInitial = ini;
        break;
      }
    }
    let j = start + (matchedInitial ? matchedInitial.length : 1);

    while (j < L) {
      if (isDigitTone(normalized[j]) || !isLetter(normalized[j])) break;
      let foundIni = false;
      for (const ini of initials) {
        if (normalized.slice(j, j + ini.length).toLowerCase() === ini) {
          foundIni = true;
          break;
        }
      }
      if (foundIni) break;
      j++;
    }

    tokens.push({type: 'syll', text: normalized.slice(start, j)});
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
          if (baseSyl.startsWith(ini)) {
            initial = ini;
            break;
          }
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
            const priority = ['a','o','e','i','u','ü'];
            for (const v of priority) {
              const pos = finalPart.indexOf(v);
              if (pos !== -1) {
                outParts.push(initial + finalPart.slice(0, pos) + toneMap[v][tIdx] + finalPart.slice(pos + 1));
                placed = true;
                break;
              }
            }
          }
          if (!placed) outParts.push(tk.text);
        }
        k++;
      } else {
        outParts.push(tk.text);
      }
    } else {
      outParts.push(tk.text);
    }
  }

  return outParts.join('');
}

function numberToTone(pinyin) {
  return convertNumberedPinyinToMarked(String(pinyin).trim());
}

function splitPinyin(pinyin) {
  if (!pinyin) return [];
  if (pinyin.includes(" ")) return pinyin.split(" ");
  return pinyin.match(/[a-zü]+[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]?/gi) || [pinyin];
}

function getToneNumberFromSyllable(syllable) {
  const toneMap = {
    ā: 1, á: 2, ǎ: 3, à: 4, ē: 1, é: 2, ě: 3, è: 4,
    ī: 1, í: 2, ǐ: 3, ì: 4, ō: 1, ó: 2, ǒ: 3, ò: 4,
    ū: 1, ú: 2, ǔ: 3, ù: 4, ǖ: 1, ǘ: 2, ǚ: 3, ǜ: 4
  };
  for (let ch of syllable) if (toneMap[ch]) return toneMap[ch];
  return 0;
}

function getPinyinIcons(pinyin) {
  if (!pinyin) return '';
  const cleanPinyin = pinyin.trim().toLowerCase();
  let icons = '';
  const aspiratedConsonants = ['p', 'f', 't', 'k', 'q', 'c', 'ch'];
  const retroflexConsonants = ['zh', 'ch', 'sh', 'r'];

  if (aspiratedConsonants.some(char => cleanPinyin.startsWith(char))) icons += '🌬️';
  if (retroflexConsonants.some(char => cleanPinyin.startsWith(char))) icons += '🌊';
  return icons;
}

// 📌 HÀM XỬ LÝ KIỂM TRA PINYIN / HÁN TỰ
const checkPinyin = (event) => {
  if (event && event.key !== "Enter") return;

  const inputEl = document.getElementById("pinyin-input");
  if (!inputEl) return;
  let input = inputEl.value.trim().toLowerCase();

  let word;
  if (reviewingMode) {
    if (!reviewCards.length) return;
    word = reviewCards[reviewCardIndex];
  } else {
    const lessonWords = vocabularyData[currentLesson] || [];
    if (!lessonWords.length) return;
    word = lessonWords[currentCardIndex];
  }

  if (!word) return;

  // Mode nhập Hán tự (Reverse Mode)
  if (reverseMode) {
    const normalizeHan = (str) => (str || "").replace(/\s+/g, "").trim();
    input = normalizeHan(input);
    const answers = [
      ...(word.traditional || "").split(/[()（）]/),
      ...(word.simplified || "").split(/[()（）]/)
    ].map(s => normalizeHan(s)).filter(Boolean);

    if (answers.includes(input)) {
      showTemporaryMessage("✔️ Đúng rồi!", "success");
      speakChinese(word.traditional || word.simplified);
      inputEl.value = "";
      setTimeout(() => {
        toggleCard();
        setTimeout(() => {
          showFront = true;
          if (reviewingMode) {
            reviewCardIndex = (reviewCardIndex + 1) % reviewCards.length;
            updateReviewCard();
          } else {
            currentCardIndex++;
            updateCard();
          }
        }, 1000);
      }, 200);
    } else {
      showTemporaryMessage("❌ Sai Hán tự!", "error", 3000);
    }
    return;
  }

  // Mode nhập Pinyin
  input = input.replace(/\s+/g, '');
  input = numberToTone(input);
  const expectedPinyin = (word.pinyin || "").toLowerCase().replace(/\s+/g, '');

  const matched = quickReviewMode
    ? removeToneMarks(input) === removeToneMarks(expectedPinyin)
    : input === expectedPinyin;

  if (matched) {
    showTemporaryMessage("✔️ Đúng rồi!", "success");
    speakChinese(word.traditional || word.simplified);
    inputEl.value = "";
    setTimeout(() => {
      toggleCard();
      setTimeout(() => {
        showFront = true;
        if (reviewingMode) {
          reviewCardIndex = (reviewCardIndex + 1) % reviewCards.length;
          updateReviewCard();
        } else {
          currentCardIndex++;
          updateCard();
        }
      }, 1000);
    }, 200);
  } else {
    showTemporaryMessage(
      quickReviewMode ? "❌ Sai! Ôn nhanh: gõ đúng âm là đủ" : "❌ Sai rồi! Gõ đúng Pinyin có dấu/số",
      "error", 3000
    );
  }
};


// ==========================================================================
// 📌 5. QUẢN LÝ FLASHCARD & RENDER GIAO DIỆN
// ==========================================================================
function updateCard() {
  const lessonWords = vocabularyData[currentLesson] || [];
  const cardContent = document.getElementById("card-content");
  if (!cardContent) return;

  if (!lessonWords.length) {
    cardContent.textContent = "Không có từ vựng!";
    return;
  }

  const word = lessonWords[currentCardIndex] || lessonWords[0];
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
      let display = chars.map((ch, i) => {
        const syll = syllables[i] || "";
        const tone = getToneNumberFromSyllable(syll);
        const roman = showToneMarks ? (["", "I", "II", "III", "IV"][tone] || "") : "";
        return `
          <div style="display:inline-block; text-align:center; margin:0 8px;">
            <div style="font-size:40px; color:red;">${roman}</div>
            <div style="font-size:150px; font-weight:bold; color:${color};">${ch}</div>
          </div>
        `;
      }).join("");

      let engSection = engData ? `
        <hr style="border:none; border-top:2px solid #ddd; margin: 15px 0; width: 80%;">
        <div style="font-size:45px; color:#007BFF; font-style: italic;">${engData.english}</div>
        <hr style="border:none; border-top:2px solid #ddd; margin: 15px 0; width: 80%;">
      ` : "";

      cardContent.innerHTML = `
        ${prefix}
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
          <div>${display}</div>
          ${engSection}
        </div>
      `;
    } else {
      let ipaText = engData ? `<span style="color:#2ecc71; font-size: 28px; font-weight:bold; margin-left:12px;"> [${engData.ipa}]</span>` : "";
      cardContent.innerHTML = `
        ${prefix}
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
          <div style="font-size: 36px; margin-bottom: 20px; color: #333;">
            ${word.hanViet || ""} --- ${word.meaning || ""}${ipaText}
          </div>
          <div style="font-size: 55px; font-weight: 500; color: #444;">
            ${word.pinyin || ""}
          </div>
        </div>
      `;
    }
  } else {
    if (showFront) {
      cardContent.innerHTML = `${prefix}<div style="font-size:45px; font-weight:bold;">${word.meaning || ""}</div>`;
    } else {
      let ipaText = engData ? `<span style="color:#2ecc71; font-size: 28px; font-weight:bold; margin-left:12px;"> [${engData.ipa}]</span>` : "";
      cardContent.innerHTML = `
        ${prefix}
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
          <div style="font-size:120px; margin-bottom: 10px;">${targetHan}</div>
          <div style="font-size: 32px;">${word.hanViet || ""} --- ${word.meaning || ""}${ipaText}</div>
          <div style="font-size: 45px; margin-top: 10px;">${word.pinyin || ""}</div>
        </div>
      `;
    }
  }

  const inp = document.getElementById("pinyin-input");
  if (inp) {
    inp.value = "";
    if (!skipNextFocus) inp.focus();
  }
  skipNextFocus = false;
  updateWordPosition();
}

function updateLessonView() {
  if (currentCardIndex == null) currentCardIndex = 0;
  showFront = true;
  updateCard();

  const container = document.getElementById("vocabulary-list");
  if (!container) return;

  container.innerHTML = "";
  const lessonWords = vocabularyData[currentLesson] || [];

  lessonWords.forEach((word, index) => {
    const div = document.createElement("div");
    div.className = "word-item";
    div.innerHTML = `
      <b>${word.traditional || ""} (${word.simplified || ""})</b> 
      - ${word.hanViet || ""} 
      - ${word.meaning || ""} 
      - <i>${word.pinyin || ""}</i>
      <button onclick="deleteWord('${currentLesson}', ${index})">❌ Xóa</button>
      <button onclick="editWord(${index})">✏️ Chỉnh</button>
    `;
    container.appendChild(div);
  });
}

const updateWordPosition = () => {
  const counter = document.getElementById("word-counter");
  if (!counter) return;

  if (isSummaryMode) {
    counter.textContent = `${summaryIndex + 1} / ${summaryCards.length}`;
  } else if (reviewingMode) {
    counter.textContent = `${reviewCardIndex + 1} / ${reviewCards.length}`;
  } else {
    const lessonWords = vocabularyData[currentLesson] || [];
    counter.textContent = `${lessonWords.length ? currentCardIndex + 1 : 0} / ${lessonWords.length}`;
  }
};

function toggleCard() {
  showFront = !showFront;
  if (isSummaryMode) updateSummaryCard();
  else if (reviewingMode) updateReviewCard();
  else updateCard();
}

const nextCard = () => {
  if (isSummaryMode) {
    summaryIndex = (summaryIndex + 1) % summaryCards.length;
    showFront = true;
    updateSummaryCard();
    return;
  }

  if (reviewingMode) {
    if (reviewCardIndex >= reviewCards.length - 1) {
      alert("🎉 Bạn đã hoàn thành ôn tập!");
      reviewingMode = false;
      reviewCardIndex = 0;
      reviewCards = [];
      updateCard();
    } else {
      reviewCardIndex++;
      showFront = true;
      updateReviewCard();
    }
    return;
  }

  const lessonWords = vocabularyData[currentLesson] || [];
  if (currentCardIndex >= lessonWords.length - 1) {
    alert("🎉 Bạn đã học xong bài này!");
    currentCardIndex = 0;
  } else {
    currentCardIndex++;
  }
  showFront = true;
  updateCard();
};

const prevCard = () => {
  if (isSummaryMode) {
    summaryIndex = (summaryIndex - 1 + summaryCards.length) % summaryCards.length;
    showFront = true;
    updateSummaryCard();
    return;
  }

  if (reviewingMode) {
    reviewCardIndex = (reviewCardIndex - 1 + reviewCards.length) % reviewCards.length;
    showFront = true;
    updateReviewCard();
    return;
  }

  const lessonWords = vocabularyData[currentLesson] || [];
  currentCardIndex = (currentCardIndex - 1 + lessonWords.length) % lessonWords.length;
  showFront = true;
  updateCard();
};


// ==========================================================================
// 📌 6. CHẾ ĐỘ ÔN TẬP NÂNG CAO & SUMMARY MODE
// ==========================================================================

// Bắt đầu Ôn tập đơn bài
const reviewBtn = document.getElementById("reviewBtn");
if (reviewBtn) {
  reviewBtn.addEventListener("click", () => {
    const lessonWords = vocabularyData[currentLesson] || [];
    reviewCards = lessonWords.filter(word => word.needReview);

    if (!reviewCards.length) {
      alert("⚠️ Không có từ nào được đánh dấu trong bài này.");
      return;
    }

    reviewingMode = "single";
    reviewCardIndex = 0;
    showFront = true;
    updateReviewCard();
  });
}

// Bắt đầu Ôn tập All bài
const reviewAllBtn = document.getElementById("reviewAllBtn");
if (reviewAllBtn) {
  reviewAllBtn.addEventListener("click", () => {
    let allWords = [];
    for (const lesson of Object.values(vocabularyData)) {
      if (Array.isArray(lesson)) allWords = allWords.concat(lesson);
      else if (lesson && Array.isArray(lesson.words)) allWords = allWords.concat(lesson.words);
    }

    reviewCards = allWords.filter(word => word.needReview);
    if (!reviewCards.length) {
      alert("⚠️ Không có từ nào được đánh dấu trong toàn bộ danh sách.");
      return;
    }

    reviewingMode = "all";
    reviewCardIndex = 0;
    showFront = true;
    updateReviewCard();
  });
}

function updateReviewCard() {
  const cardContent = document.getElementById("card-content");
  if (!reviewCards.length) {
    if (cardContent) cardContent.textContent = "Không có từ cần ôn tập!";
    return;
  }

  const word = reviewCards[reviewCardIndex];
  const chineseDisplay = word.traditional === word.simplified ? word.traditional : `${word.traditional} (${word.simplified})`;
  const color = word.needReview ? "red" : "black";

  if (cardContent) {
    cardContent.innerHTML = showFront
      ? `<span style="color: ${color}; font-size:120px; font-weight:bold;">${chineseDisplay}</span>`
      : `<div>${word.hanViet || ""} --- ${word.meaning || ""}<br>${word.pinyin || ""}</div>`;
  }
  updateWordPosition();
}

// Summary Modal Logic
const startSummaryBtn = document.getElementById("startSummaryBtn");
if (startSummaryBtn) {
  startSummaryBtn.addEventListener("click", () => {
    const mainSelect = document.getElementById("multi-main-select");
    const subSelect = document.getElementById("multi-sub-select");

    const selectedLessons = [
      ...Array.from(mainSelect ? mainSelect.selectedOptions : []).map(opt => opt.value),
      ...Array.from(subSelect ? subSelect.selectedOptions : []).map(opt => opt.value),
    ];

    if (selectedLessons.length === 0) {
      alert("Vui lòng chọn ít nhất 1 bài.");
      return;
    }

    summaryCards = selectedLessons.flatMap(lesson => vocabularyData[lesson] || []);
    if (summaryCards.length === 0) {
      alert("Không có từ trong các bài đã chọn.");
      return;
    }

    isSummaryMode = true;
    summaryIndex = 0;
    showFront = true;
    const modal = document.getElementById("summaryModal");
    if (modal) modal.style.display = "none";
    updateSummaryCard();
  });
}

function updateSummaryCard() {
  const word = summaryCards[summaryIndex];
  const cardContent = document.getElementById("card-content");
  if (!word || !cardContent) return;

  const chinese = word.traditional === word.simplified ? word.traditional : `${word.traditional} (${word.simplified})`;
  const prefix = word.lyHop ? "🔹 " : "";
  const color = word.needReview ? "red" : "black";

  cardContent.innerHTML = showFront
    ? `${prefix}<span style="color: ${color}; font-size:120px;">${chinese}</span>`
    : `<div>${word.hanViet || ""} --- ${word.meaning || ""}<br>${word.pinyin || ""}</div>`;

  updateWordPosition();
}


// ==========================================================================
// 📌 7. ÂM THANH (TTS NÂNG CAO) & PHÁT ÂM
// ==========================================================================
function speakChinese(text) {
  return new Promise((resolve) => {
    if (!text) return resolve();
    const utterance = new SpeechSynthesisUtterance(text);
    let zhVoice = availableVoices.find(v => v.lang === "zh-CN" && v.name.toLowerCase().includes("female")) ||
                  availableVoices.find(v => v.lang === "zh-CN");

    if (zhVoice) utterance.voice = zhVoice;
    utterance.lang = "zh-CN";
    utterance.rate = 0.9;
    utterance.onend = resolve;
    utterance.onerror = resolve;

    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  });
}

const readCard = async () => {
  let word;
  if (isSummaryMode) {
    if (!summaryCards.length) return;
    word = summaryCards[summaryIndex];
  } else if (reviewingMode) {
    if (!reviewCards.length) return;
    word = reviewCards[reviewCardIndex];
  } else {
    const lessonWords = vocabularyData[currentLesson] || [];
    if (!lessonWords.length) return;
    word = lessonWords[currentCardIndex];
  }

  if (!word) return;

  const targetHan = word.traditional || word.simplified;
  const engData = englishMap[targetHan];
  speechSynthesis.cancel();

  if (showFront) {
    await speakChinese(targetHan);
    await new Promise(resolve => setTimeout(resolve, 400));

    if (engData?.english) {
      const utterance = new SpeechSynthesisUtterance(engData.english);
      const enVoice = availableVoices.find(v => v.lang === "en-US");
      if (enVoice) utterance.voice = enVoice;
      utterance.lang = "en-US";
      utterance.rate = 0.82;
      speechSynthesis.speak(utterance);
    }
  } else {
    const utterance = new SpeechSynthesisUtterance(`${word.hanViet || ""} --- ${word.meaning || ""}`);
    const viVoice = availableVoices.find(v => v.lang === "vi-VN");
    if (viVoice) utterance.voice = viVoice;
    utterance.lang = "vi-VN";
    speechSynthesis.speak(utterance);
  }
};


// ==========================================================================
// 📌 8. TÌM KIẾM HÁN TỰ & SO SÁNH CHỮ HÁN
// ==========================================================================

// Tìm kiếm Hán tự toàn diện
const searchHanInput = document.getElementById('searchHanInput');
if (searchHanInput) {
  searchHanInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const kw = searchHanInput.value.trim();
      if (kw) openHanSearchPopup(kw);
    }
  });
}

function openHanSearchPopup(keyword) {
  if (!keyword || !keyword.trim()) return;

  const norm = (s) => (s || "").replace(/\s+/g, "");
  const kw = norm(keyword);
  const results = [];

  Object.keys(vocabularyData).forEach((lessonId) => {
    const list = Array.isArray(vocabularyData[lessonId]) ? vocabularyData[lessonId] : [];
    list.forEach((word, idx) => {
      const trad = norm(word.traditional);
      const simp = norm(word.simplified);
      if ((trad && trad.includes(kw)) || (simp && simp.includes(kw))) {
        results.push({ lessonId, idx, word });
      }
    });
  });

  const popup = document.getElementById("hanSearchPopup");
  const resultsDiv = document.getElementById("hanSearchResults");
  if (!popup || !resultsDiv) return;

  if (results.length === 0) {
    resultsDiv.innerHTML = "<p>❌ Không tìm thấy từ nào.</p>";
  } else {
    resultsDiv.innerHTML = results.map((r) => `
      <div class="search-result-item" style="margin-bottom:8px;">
        <button class="goto-btn" data-lesson="${r.lessonId}" data-index="${r.idx}">Đi</button>
        <span><strong>${r.word.traditional}</strong> (${r.word.simplified}) — ${r.word.hanViet} — ${r.word.pinyin} [${r.lessonId}]</span>
      </div>
    `).join("");

    resultsDiv.querySelectorAll(".goto-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentLesson = btn.getAttribute("data-lesson");
        currentCardIndex = parseInt(btn.getAttribute("data-index"), 10);
        showFront = true;
        updateLessonView();
        popup.style.display = "none";
      });
    });
  }
  popup.style.display = "block";
}

// Trình So sánh chữ Hán Pop-up Realtime
document.addEventListener("DOMContentLoaded", () => {
  const compareToggleBtn = document.createElement("button");
  compareToggleBtn.id = "hanzi-compare-toggle";
  compareToggleBtn.textContent = "🔍 So sánh chữ";
  Object.assign(compareToggleBtn.style, {
    position: "fixed", right: "20px", top: "250px", zIndex: "9999",
    padding: "8px 14px", border: "none", borderRadius: "5px", background: "#2196F3", color: "#fff", cursor: "pointer"
  });
  document.body.appendChild(compareToggleBtn);

  const compareBox = document.createElement("div");
  compareBox.id = "hanzi-compare-box";
  Object.assign(compareBox.style, {
    position: "fixed", right: "20px", top: "295px", width: "380px", minHeight: "250px",
    background: "#fff", border: "1px solid #ddd", borderRadius: "8px", zIndex: "9998", padding: "15px", display: "none"
  });

  const compareInput = document.createElement("input");
  compareInput.placeholder = "Nhập chữ Hán cần so sánh...";
  Object.assign(compareInput.style, { width: "100%", height: "36px", marginBottom: "10px" });

  const compareDisplay = document.createElement("div");
  Object.assign(compareDisplay.style, { display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" });

  compareBox.appendChild(compareInput);
  compareBox.appendChild(compareDisplay);
  document.body.appendChild(compareBox);

  compareInput.addEventListener("input", () => {
    compareDisplay.innerHTML = "";
    [...compareInput.value.trim()].forEach(char => {
      const el = document.createElement("span");
      el.textContent = char;
      el.style.fontSize = "90px";
      compareDisplay.appendChild(el);
    });
  });

  compareToggleBtn.addEventListener("click", () => {
    compareBox.style.display = compareBox.style.display === "none" ? "block" : "none";
  });
});


// ==========================================================================
// 📌 9. BÀN PHÍM PHÍM TẮT MỞ RỘNG (SHORTKEYS) & HELPER
// ==========================================================================
document.addEventListener("keydown", (event) => {
  if (event.target.closest(".note") || event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") return;

  switch (event.key) {
    case "ArrowLeft": event.preventDefault(); prevCard(); break;
    case "ArrowRight": event.preventDefault(); nextCard(); break;
    case " ": event.preventDefault(); toggleCard(); break;
    case "ArrowDown": event.preventDefault(); readCard(); break;
    case "ArrowUp": event.preventDefault(); markWordForReview(); break;
    case "'": event.preventDefault(); addWordToTocflTopic(); break;
    default: break;
  }
});

const markWordForReview = () => {
  const lessonWords = vocabularyData[currentLesson] || [];
  if (!lessonWords.length) return;
  const word = lessonWords[currentCardIndex];
  word.needReview = !word.needReview;
  saveVocabularyData(vocabularyData);
  updateCard();
};

function toggleTocflMark() {
  const lessonWords = vocabularyData[currentLesson] || [];
  if (!lessonWords.length) return;
  const word = lessonWords[currentCardIndex];
  word.tocflFlag = !word.tocflFlag;
  saveVocabularyData(vocabularyData);
  updateCard();
  showTemporaryMessage(word.tocflFlag ? "🔔 Đã gắn cờ TOCFL" : "❌ Đã gỡ cờ TOCFL", "info");
}

function toggleLyHopMark() {
  const lessonWords = vocabularyData[currentLesson] || [];
  if (!lessonWords.length) return;
  const word = lessonWords[currentCardIndex];
  word.lyHop = !word.lyHop;
  saveVocabularyData(vocabularyData);
  updateCard();
  showTemporaryMessage(word.lyHop ? "🔹 Đã đánh dấu Ly Hợp" : "❌ Bỏ đánh dấu Ly Hợp", "info");
}

function addWordToTocflTopic() {
  const lessonWords = vocabularyData[currentLesson] || [];
  if (!lessonWords.length) return;
  const word = lessonWords[currentCardIndex];
  vocabularyData["tocfl-topic"] = vocabularyData["tocfl-topic"] || [];
  vocabularyData["tocfl-topic"].push({ ...word, tocflTopicFlag: true });
  saveVocabularyData(vocabularyData);
  showTemporaryMessage(`🍞 Đã thêm "${word.traditional}" vào tocfl-topic`, "success");
}

function showTemporaryMessage(message, type = "info", duration = 1500) {
  const msgDiv = document.createElement("div");
  msgDiv.className = "temp-message " + type;
  msgDiv.innerHTML = message;
  Object.assign(msgDiv.style, {
    position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)",
    padding: "10px 16px", borderRadius: "8px", backgroundColor: "#f0f0f0",
    color: "#000", fontSize: "16px", zIndex: "9999", boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
  });

  document.body.appendChild(msgDiv);
  setTimeout(() => {
    msgDiv.style.opacity = 0;
    setTimeout(() => msgDiv.remove(), 300);
  }, duration);
}


// ==========================================================================
// 📌 10. KHỞI ĐỘNG ỨNG DỤNG DUY NHẤT (SINGLETON ASYNC INIT)
// ==========================================================================
(async () => {
  try {
    console.log("🚀 Đang khởi động ứng dụng Hanzii...");

    const localData = localStorage.getItem("hanzii_vocabulary_data");
    if (localData) {
      vocabularyData = JSON.parse(localData);
    } else {
      vocabularyData = await loadVocabularyData();
    }

    await loadEnglishMap();
    await loadToneExamples();

    // Lắng nghe phím Enter trong ô input Pinyin
    const input = document.getElementById("pinyin-input");
    if (input) {
      input.addEventListener("input", (e) => {
        const raw = e.target.value;
        const converted = convertNumberedPinyinToMarked(raw);
        if (raw !== converted) e.target.value = converted;
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          checkPinyin(e);
        }
      });
    }

    if (typeof updateLessonView === 'function') {
      updateLessonView();
    }
    console.log("✅ Ứng dụng Hanzii đã khởi động thành công!");

  } catch (error) {
    console.error("❌ Lỗi khởi động ứng dụng:", error);
    if (typeof updateLessonView === 'function') {
      updateLessonView();
    }
  }
})();