// =======================
// 📌 HÀM LÀM VIỆC VỚI SERVER
// =======================

// Tải dữ liệu từ server API
const loadVocabularyData = async () => {
  try {
    const response = await fetch("./vocabularyData.json");
    if (!response.ok) throw new Error("Không tải được dữ liệu vocabularyData.json");
    return await response.json();
  } catch (err) {
    console.error("❌ Lỗi loadVocabularyData:", err);
    return {};
  }
};



// =======================
// 📌 BIẾN TOÀN CỤC
// =======================
let vocabularyData = {};
let englishMap = {};
let skipNextFocus = false;
let reviewAllMode = false;
// =======================
// 📌 KHỞI ĐỘNG ỨNG DỤNG
// =======================


// const { generateAudio } = require("./tts");


let currentLesson = "lesson1";
let selectedSource = "main"; // "main" = lesson-selector, "sub" = sub-lesson-selector
let showToneMarks = true;

let currentCardIndex = 0;
let showFront = true;
let tocflKeyLock = false;
let reviewingMode = null;
let reviewCards = [];
let reviewCardIndex = 0;

// chuyển đổi học giao diện 
let reverseMode = false; // false = mặc định, true = đảo

let availableVoices = [];

let selectedHanLesson = null;
let selectedHanIndex = null;
let vocabList = [
   
    // thêm các từ khác...
];
window.speechSynthesis.onvoiceschanged = () => {
    availableVoices = speechSynthesis.getVoices();
};

// Đảm bảo voices đã sẵn sàng
let zhVoice  = [];

let isSummaryMode = false;
let summaryCards = [];
let summaryIndex = 0;


// (GIỮ LẠI ĐÚNG NHƯ BẠN ĐANG CÓ Ở ĐẦU FILE)
const lessonSelect = document.getElementById("lesson-selector");
const subSelect = document.getElementById("sub-lesson-selector");
const allLessonsSelector = document.getElementById("all-lessons-selector");
const newSelect = document.getElementById("new-lessons-selector");


lessonSelect.addEventListener("change", () => {

    reviewingMode = false;
    selectedSource = "main";

    lessonSelect.classList.add("select-highlight");
    subSelect.classList.remove("select-highlight");
    allLessonsSelector.classList.remove("select-highlight");
    newSelect.classList.remove("select-highlight");

    updateCurrentLesson();

});


subSelect.addEventListener("change", () => {

    reviewingMode = false;
    selectedSource = "sub";

    subSelect.classList.add("select-highlight");
    lessonSelect.classList.remove("select-highlight");
    allLessonsSelector.classList.remove("select-highlight");
    newSelect.classList.remove("select-highlight");

    updateCurrentLesson();

});


allLessonsSelector.addEventListener("change", () => {

    reviewingMode = false;
    selectedSource = "all";

    allLessonsSelector.classList.add("select-highlight");
    lessonSelect.classList.remove("select-highlight");
    subSelect.classList.remove("select-highlight");
    newSelect.classList.remove("select-highlight");

    updateCurrentLesson();

});


newSelect.addEventListener("change", () => {

    reviewingMode = false;
    selectedSource = "new";

    newSelect.classList.add("select-highlight");
    lessonSelect.classList.remove("select-highlight");
    subSelect.classList.remove("select-highlight");
    allLessonsSelector.classList.remove("select-highlight");

    updateCurrentLesson();

});


const updateCurrentLesson = () => {

    const main = lessonSelect.value;
    const sub  = subSelect.value;
    const all  = allLessonsSelector.value;
    const newLesson = newSelect.value;

    if (selectedSource === "sub" && sub !== "") {
        currentLesson = sub;
    }
    else if (selectedSource === "all" && all !== "") {
        currentLesson = all;
    }
    else if (selectedSource === "new" && newLesson !== "") {
        currentLesson = newLesson;
    }
    else {
        currentLesson = main;
    }

    updateLessonView();

};



// let currentCardIndex = 0; // FIX lỗi số 2

async function generateTTS() {
  const text = document.getElementById("text").value;

  try {
    const res = await fetch("/tts-multi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    if (!res.ok) throw new Error("Server error");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    document.getElementById("player").src = url;
    document.getElementById("download").href = url;

  } catch (err) {
    console.error(err);
    alert("Lỗi tạo audio!");
  }
}
// function exitReviewMode() {
//   reviewingMode = false;
//   reviewCards = [];
//   reviewCardIndex = 0;
//   document.getElementById("exitReviewBtn").style.display = "none";
//   updateCard();
// }

// Thêm từ vựng hàng loạt
// =========================
// 📌 THÊM TỪ VỰNG THEO LÔ
// =========================
// 📌 Thêm nhiều từ mới vào lesson hiện tại
async function addVocabularyBatch() {
  const input = document.getElementById("vocabulary-input").value.trim();
  if (!input) {
    alert("Vui lòng nhập từ vựng.");
    return;
  }

  const lines = input.split("\n");
  const newWords = [];
  const skippedWords = [];

  // Hàm chuẩn hoá để loại bỏ khoảng trắng khi so sánh Hán tự
  const normalize = (str) => str.replace(/\s+/g, "").trim();

  lines.forEach((line) => {
    if (!line.trim()) return;

    const parts = line.split("---");
    if (parts.length !== 2) {
      alert(`❌ Dòng không hợp lệ: ${line}`);
      return;
    }

    const hanViet = parts[0].trim();
    const remaining = parts[1].trim().split(";");
    if (remaining.length !== 3) {
      alert(`❌ Dòng không hợp lệ: ${line}`);
      return;
    }

    const meaning = remaining[0].trim();
    const chineseInput = remaining[1].trim();
    const pinyin = remaining[2].trim();

    const match = chineseInput.match(/^(.+)\s\((.+)\)$/);
    let traditional, simplified;
    if (match) {
      traditional = match[1].trim();
      simplified = match[2].trim();
    } else {
      traditional = simplified = chineseInput;
    }

    const lessonWords = vocabularyData[currentLesson] || [];
    // 🔍 Chỉ so sánh Hán tự sau khi normalize
    if (
      lessonWords.some(
        (word) =>
          normalize(word.traditional || "") === normalize(traditional) ||
          normalize(word.simplified || "") === normalize(simplified)
      )
    ) {
      skippedWords.push(traditional || simplified);
    } else {
      newWords.push({
        hanViet,
        meaning,
        traditional,
        simplified,
        pinyin,
        needReview: false,
      });
    }
  });

  vocabularyData[currentLesson] = vocabularyData[currentLesson] || [];
  vocabularyData[currentLesson].push(...newWords);

  // ✅ Lưu xuống server JSON
  await saveVocabularyData(vocabularyData);

  // ✅ Render lại giao diện ngay
  updateLessonView();

  // Clear input box
  document.getElementById("vocabulary-input").value = "";

  alert(`✅ ${newWords.length} từ đã được thêm vào bài học ${currentLesson}.`);
  if (skippedWords.length > 0) {
    alert(`⚠️ Các từ bị trùng lặp và đã bỏ qua: ${skippedWords.join(", ")}`);
  }
}



const initials = [
  "zh","ch","sh",
  "b","p","m","f",
  "d","t","n","l",
  "g","k","h",
  "j","q","x",
  "r",
  "z","c","s"
];

// thêm ngay sau danh sách initials:
const finals = ["n", "ng", "r", "m"];


const toneMarks = {
  a: ["ā","á","ǎ","à"],
  o: ["ō","ó","ǒ","ò"],
  e: ["ē","é","ě","è"],
  i: ["ī","í","ǐ","ì"],
  u: ["ū","ú","ǔ","ù"],
  ü:["ǖ","ǘ","ǚ","ǜ"]
};

// hàm đổi pinyin số -> dấu
// Thay vào script.js: hàm chuyển số -> dấu (dùng cho realtime và Enter)
function _applyToneToSyllable(letters, toneNum) {
  const tone = parseInt(toneNum, 10) - 1;
  if (isNaN(tone) || tone < 0 || tone > 3) return letters;

  const toneMarks = {
    a: ["ā","á","ǎ","à"],
    o: ["ō","ó","ǒ","ò"],
    e: ["ē","é","ě","è"],
    i: ["ī","í","ǐ","ì"],
    u: ["ū","ú","ǔ","ù"],
    ü: ["ǖ","ǘ","ǚ","ǜ"]
  };

  const base = letters.toLowerCase();

  if (base.includes("iu")) {
    return base.replace("iu", "i" + toneMarks.u[tone]);
  }
  if (base.includes("ui")) {
    return base.replace("ui", "u" + toneMarks.i[tone]);
  }

  // Chỉ đặt dấu vào nguyên âm đầu tiên khớp theo thứ tự ưu tiên
  for (let v of ["a","o","e","i","u","ü"]) {
    const idx = base.indexOf(v);
    if (idx !== -1) {
      return base.slice(0, idx) + toneMarks[v][tone] + base.slice(idx + 1);
    }
  }
  return base;
}












// Dùng khi nhấn Enter / kiểm tra (checkPinyin)
function numberToTone(pinyin) {
  // nếu bạn có code khác gọi numberToTone, thay bằng hàm này để thống nhất
  return convertNumberedPinyinToMarked(pinyin.trim());
}








const normalizePinyin = (pinyin) => {
    return pinyin
        .replace(/\s+/g, "") // Loại bỏ khoảng trắng
        .replace(/ā|á|ǎ|à|a/g, "a")
        .replace(/ē|é|ě|è|e/g, "e")
        .replace(/ī|í|ǐ|ì|i/g, "i")
        .replace(/ō|ó|ǒ|ò|o/g, "o")
        .replace(/ū|ú|ǔ|ù|u/g, "u")
        .replace(/ǖ|ǘ|ǚ|ǜ|ü/g, "u")
        .replace(/ń|ň|ǹ|n/g, "n")
        .replace(/ḿ|m/g, "m");
};

// ---------- Helpers ----------
function removeToneMarks(str) {
  if (!str) return str || "";
  return String(str)
    .replace(/ā/g,"a").replace(/á/g,"a").replace(/ǎ/g,"a").replace(/à/g,"a")
    .replace(/ē/g,"e").replace(/é/g,"e").replace(/ě/g,"e").replace(/è/g,"e")
    .replace(/ī/g,"i").replace(/í/g,"i").replace(/ǐ/g,"i").replace(/ì/g,"i")
    .replace(/ō/g,"o").replace(/ó/g,"o").replace(/ǒ/g,"o").replace(/ò/g,"o")
    .replace(/ū/g,"u").replace(/ú/g,"u").replace(/ǔ/g,"u").replace(/ù/g,"u")
    .replace(/ǖ/g,"ü").replace(/ǘ/g,"ü").replace(/ǚ/g,"ü").replace(/ǜ/g,"ü");
}

// ---------- Main converter using initial/final segmentation ----------




const removePinyinTones = (pinyin, removeSpaces = false) => {
    let result = pinyin
        .replace(/ā|á|ǎ|à/g, "a")
        .replace(/ē|é|ě|è/g, "e")
        .replace(/ī|í|ǐ|ì/g, "i")
        .replace(/ō|ó|ǒ|ò/g, "o")
        .replace(/ū|ú|ǔ|ù/g, "u")
        .replace(/ǖ|ǘ|ǚ|ǜ|ü/g, "u")
        .replace(/ń|ň|ǹ/g, "n")
        .replace(/ḿ/g, "m");

    return removeSpaces ? result.replace(/\s+/g, "") : result;
};

const checkPinyin = (event) => {
  if (event.key !== "Enter") return;

  let input = document.getElementById("pinyin-input").value.trim().toLowerCase();

  let word;
  if (reviewingMode) {
    if (!reviewCards.length) return;
    word = reviewCards[reviewCardIndex];
  } else {
    const lessonWords = vocabularyData[currentLesson] || [];
    if (!lessonWords.length) return;
    word = lessonWords[currentCardIndex];
  }

  // ==========================
  // CHẾ ĐỘ ĐẢO THỨ TỰ (Nhập Hán tự)
  // ==========================
  if (reverseMode) {

    const normalizeHan = (str) =>
      (str || "")
        .replace(/\s+/g, "")
        .trim();

    input = normalizeHan(input);

    // Lấy tất cả đáp án có thể
    const answers = [
      ...(word.traditional || "").split(/[()（）]/),
      ...(word.simplified || "").split(/[()（）]/)
    ]
      .map(s => normalizeHan(s))
      .filter(Boolean);

    const matched = answers.includes(input);

    if (matched) {

      showTemporaryMessage("✔️ Đúng rồi!", "success");

      // Đọc Hán tự
      const utterance = new SpeechSynthesisUtterance(word.traditional || word.simplified);

      const zhVoice =
        availableVoices.find(v => v.lang === "zh-CN" && v.name.toLowerCase().includes("female")) ||
        availableVoices.find(v => v.lang === "zh-CN" && v.name.toLowerCase().includes("xiaoyun")) ||
        availableVoices.find(v => v.lang === "zh-CN" && v.name.toLowerCase().includes("google")) ||
        availableVoices.find(v => v.lang === "zh-CN");

      if (zhVoice) {
        utterance.voice = zhVoice;
        utterance.lang = "zh-CN";
        speechSynthesis.speak(utterance);
      }

      document.getElementById("pinyin-input").value = "";

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
        }, 1200);

      }, 200);

    } else {

      showTemporaryMessage("❌ Sai Hán tự!", "error", 3000);

    }

    return;
  }

  // ==========================
  // CHẾ ĐỘ PINYIN (Mặc định)
  // ==========================

  // Chuẩn hóa input
  input = input.replace(/\s+/g, '');
  input = numberToTone(input);

  const expectedPinyin = word.pinyin.toLowerCase().replace(/\s+/g, '');

  const matched = quickReviewMode
    ? removePinyinTones(input, true) === removePinyinTones(expectedPinyin, true)
    : input === expectedPinyin;

  if (matched) {

    showTemporaryMessage("✔️ Đúng rồi!", "success");

    // Đọc từ hiện tại
    const utterance = new SpeechSynthesisUtterance(word.traditional || word.simplified);

    const zhVoice =
      availableVoices.find(v => v.lang === "zh-CN" && v.name.toLowerCase().includes("female")) ||
      availableVoices.find(v => v.lang === "zh-CN" && v.name.toLowerCase().includes("xiaoyun")) ||
      availableVoices.find(v => v.lang === "zh-CN" && v.name.toLowerCase().includes("google")) ||
      availableVoices.find(v => v.lang === "zh-CN");

    if (zhVoice) {
      utterance.voice = zhVoice;
      utterance.lang = "zh-CN";
      speechSynthesis.speak(utterance);
    }

    document.getElementById("pinyin-input").value = "";

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
      }, 1200);

    }, 200);

  } else {

    const errors = comparePinyinDetailed(input, expectedPinyin);

    if (errors.length) {
      showTemporaryMessage(
        "❌ Sai!\n" + errors.join("\n"),
        "error",
        4000
      );
    } else {
      showTemporaryMessage(
        quickReviewMode
          ? "❌ Sai rồi! Ôn nhanh đang bật: Gõ đúng âm là đủ"
          : "❌ Sai rồi! Gõ đúng pinyin có dấu hoặc số",
        "error",
        4000
      );
    }

  }
};

function comparePinyinDetailed(input, expected) {
  const inputArr = splitPinyin(input);
  const expectedArr = splitPinyin(expected);
  const errors = [];

  const maxLen = Math.max(inputArr.length, expectedArr.length);
  for (let i = 0; i < maxLen; i++) {
    const inp = inputArr[i] || "";
    const exp = expectedArr[i] || "";
    if (!inp || !exp) {
      errors.push(`Âm ${i+1}: thiếu dữ liệu (bạn: "${inp}", chuẩn: "${exp}")`);
    } else if (inp !== exp) {
      errors.push(`Âm ${i+1} sai: bạn gõ "${inp}", đúng là "${exp}"`);
    }
  }
  return errors;
}





function showTemporaryMessage(message, type = "info") {
    const msgDiv = document.createElement("div");
    msgDiv.className = "temp-message " + type;

    msgDiv.innerHTML = message; // dùng HTML để có thể chỉnh size icon

    // Áp dụng style riêng cho message (có thể tách ra file CSS nếu thích)
    msgDiv.style.position = "fixed";
    msgDiv.style.top = "20px";
    msgDiv.style.left = "50%";
    msgDiv.style.transform = "translateX(-50%)";
    msgDiv.style.padding = "10px 16px";
    msgDiv.style.borderRadius = "8px";
    msgDiv.style.backgroundColor = "#f0f0f0";
    msgDiv.style.color = "#000";
    msgDiv.style.fontSize = "16px";
    msgDiv.style.zIndex = 9999;
    msgDiv.style.boxShadow = "0 4px 10px rgba(0,0,0,0.1)";
    msgDiv.style.transition = "opacity 0.3s";
    msgDiv.style.opacity = 1;

    document.body.appendChild(msgDiv);

    // Tự động ẩn sau 2 giây
    setTimeout(() => {
        msgDiv.style.opacity = 0;
        setTimeout(() => msgDiv.remove(), 300); // xóa sau khi mờ đi
    }, 500);
}




// Cập nhật flash card hiển thị




// Xáo trộn từ vựng
const shuffleCards = () => {
    if (reviewingMode) {
        if (!reviewCards.length) return;
        reviewCards = reviewCards.sort(() => Math.random() - 0.5);
        reviewCardIndex = 0;
        showFront = true;
        updateReviewCard();
    } else {
        const lessonWords = vocabularyData[currentLesson] || [];
        if (!lessonWords.length) return;
        vocabularyData[currentLesson] = lessonWords.sort(() => Math.random() - 0.5);
        currentCardIndex = 0;
        showFront = true;
        updateCard();
    }
};


// Chuyển đến thẻ kế tiếp
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
            updateCard(); // trở lại flashcard chính
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


function toggleCard ()  {
    showFront = !showFront;

    if (isSummaryMode) {
        updateSummaryCard();
} else if (reviewingMode) {
    updateReviewCard();
} else {
    updateCard();
}

};




let quickReviewMode = false;
const quickBtn = document.getElementById("quick-review-toggle");

function toggleQuickReview() {
    quickReviewMode = !quickReviewMode;
    showToneMarks = quickReviewMode;   // ✅ đồng bộ hiện/ẩn số la mã

    if (quickReviewMode) {
        quickBtn.style.backgroundColor = "#f7d560";
        showTemporaryMessage('<span style="font-size: 50px;">🔒</span> ', "info");
    } else {
        quickBtn.style.backgroundColor = "";
        showTemporaryMessage('<span style="font-size: 50px;">🔓</span> ', "info");
    }

    updateCard(); // ✅ refresh flashcard ngay
}


if (quickBtn) {
    quickBtn.addEventListener("click", toggleQuickReview);
}



document.addEventListener("keyup", (event) => {
  if (event.key === "/") {
    tocflKeyLock = false; // nhả phím -> mở khóa
  }
});







// Đánh dấu từ cần học lại
const markWordForReview = () => {
    if (reviewingMode) {
        const word = reviewCards[reviewCardIndex];
        word.needReview = !word.needReview;

        // ✅ Tìm lại từ gốc trong vocabularyData và cập nhật
        const lessonWords = vocabularyData[currentLesson] || [];
        const indexInLesson = lessonWords.findIndex(
            w =>
                w.traditional === word.traditional &&
                w.simplified === word.simplified &&
                w.hanViet === word.hanViet &&
                w.pinyin === word.pinyin
        );

        if (indexInLesson !== -1) {
            lessonWords[indexInLesson].needReview = word.needReview;
        }

        saveVocabularyData(vocabularyData);

        // ❌ KHÔNG cập nhật lại reviewCards tại đây
        updateReviewCard();
    } else {
        const lessonWords = vocabularyData[currentLesson] || [];
        if (!lessonWords.length) return;

        const word = lessonWords[currentCardIndex];
        word.needReview = !word.needReview;
        saveVocabularyData(vocabularyData);
        updateCard();
    }
}




// Kiểm tra trạng thái học lại của bài  
const checkReviewStatus = () => {  
    const lessonWords = vocabularyData[currentLesson] || [];  
    const wordsToReview = lessonWords.filter((word) => word.needReview);  

    if (wordsToReview.length > 0) {  
        let reviewList = wordsToReview  
            .map((word, index) =>   
                `<p><strong>${index + 1}. ${word.traditional} (${word.simplified}) - ${word.hanViet}</strong><br>` +  
                `Pinyin: ${word.pinyin}<br>` +  
                `Nghĩa: ${word.meaning} `  
                // `<button onclick="openNoteModal(${index})">Ghi chú</button></p>`  
            )  
            .join("");  
    
        // Hiển thị danh sách trong modal  
        document.getElementById("review-list").innerHTML = reviewList;  
        document.getElementById("review-modal").style.display = "block";  
    } else {  
        alert("🎉 Chúc mừng! Bạn đã hoàn thành bài học.");  
    }  

    // Đóng modal khi nhấn nút X  
    document.querySelector(".close").onclick = function () {  
        document.getElementById("review-modal").style.display = "none";  
    };  
    
    // Đóng modal khi nhấn bên ngoài nội dung  
    window.onclick = function (event) {  
        let modal = document.getElementById("review-modal");  
        if (event.target == modal) {  
            modal.style.display = "none";  
        }  
    };  

    // Reset bài học nếu cần  
    currentCardIndex = 0;  
    showFront = true;  
    updateCard();  
};  



// Hàm để mở modal ghi chú  
const openNoteModal = (index) => {  
    const lessonWords = vocabularyData[currentLesson] || [];  
    const word = lessonWords.filter((word) => word.needReview)[index]; // Lấy từ cần học lại theo index  

    // Tạo modal ghi chú  
    const noteModalHTML = `  
        <div class="note-modal">  
            <h4>Ghi chú cho từ: ${word.traditional} (${word.simplified})</h4>  
            <textarea id="note-input" placeholder="Nhập ghi chú...">${word.note || ""}</textarea>  
            <button onclick="saveNote(${index})">Lưu ghi chú</button>  
            <button onclick="closeNoteModal()">Đóng</button>  
        </div>  
    `;  
    document.body.insertAdjacentHTML('beforeend', noteModalHTML);  
};  

// Hàm để đóng modal ghi chú  
function closeNoteModal() {
  document.getElementById("noteModal").style.display = "none";
}




// Hàm để lưu ghi chú  
const saveNote = (index) => {  
    const lessonWords = vocabularyData[currentLesson] || [];  
    const word = lessonWords.filter((word) => word.needReview)[index];  
    const noteInput = document.getElementById("note-input").value.trim();  

    // Lưu ghi chú vào từ  
    if (noteInput) {  
        word.note = noteInput; // Thêm thuộc tính ghi chú vào từ  
        saveVocabularyData(vocabularyData); // Lưu lại dữ liệu vào localStorage  
        alert("Ghi chú đã được lưu thành công!");  
    } else {  
        alert("Vui lòng nhập ghi chú trước khi lưu.");  
    }  

    closeNoteModal(); // Đóng modal ghi chú  
}  




function showNote() {
    let word, index;

    if (reviewingMode) {
        word = reviewCards[reviewCardIndex];
        index = (vocabularyData[currentLesson] || []).findIndex(w =>
            w.traditional === word.traditional &&
            w.simplified === word.simplified &&
            w.hanViet === word.hanViet &&
            w.pinyin === word.pinyin
        );
    } else {
        const lessonWords = vocabularyData[currentLesson] || [];
        index = currentCardIndex;
        word = lessonWords[index];
    }

    if (!word) {
        alert("Không tìm thấy từ để ghi chú.");
        return;
    }

    // Mở modal có input sẵn (nếu đã có note)
    // document.getElementById("noteInput").value = word.note || "";?
    document.getElementById("noteText").value = word.note || "";
    document.getElementById("noteModal").style.display = "block";

    // Khi nhấn lưu trong modal
    document.getElementById("saveNoteBtn").onclick = async () => {
        // const newNote = document.getElementById("noteInput").value.trim();?
       const newNote = document.getElementById("noteText").value.trim();
        vocabularyData[currentLesson][index].note = newNote;

        await saveVocabularyData(vocabularyData);
        document.getElementById("noteModal").style.display = "none";

        alert("✔️ Ghi chú đã lưu thành công!");
    };
}



function closeNote() {
    const noteSection = document.getElementById("note-section");
    noteSection.style.display = "none";
}

function editNote() {
    let word;
    if (reviewingMode) {
        word = reviewCards[reviewCardIndex];
    } else {
        const lessonWords = vocabularyData[currentLesson] || [];
        word = lessonWords[currentCardIndex];
    }

    if (!word) {
        alert("Không có từ nào để chỉnh sửa ghi chú.");
        return;
    }

    const current = word.note || "";
    const newNote = prompt("Chỉnh sửa ghi chú:", current);

    if (newNote !== null) {
        word.note = newNote.trim();

        // Cập nhật dữ liệu gốc nếu đang trong ôn tập
        if (reviewingMode) {
            const lessonWords = vocabularyData[currentLesson] || [];
            const index = lessonWords.findIndex(w =>
                w.traditional === word.traditional &&
                w.simplified === word.simplified &&
                w.hanViet === word.hanViet &&
                w.pinyin === word.pinyin
            );
            if (index !== -1) {
                lessonWords[index].note = word.note;
            }
        }

        saveVocabularyData(vocabularyData);
        document.getElementById("note-display").textContent = word.note;
        alert("✔️ Ghi chú đã được lưu.");
    }
}


// Hiển thị danh sách từ vựng
const showVocabulary = () => {
    const vocabularyList = document.getElementById("vocabulary-list");

    if (vocabularyList.style.display === "none" || !vocabularyList.style.display) {
        vocabularyList.style.display = "block";
        vocabularyList.innerHTML = "";

        const lessonWords = vocabularyData[currentLesson] || [];
        if (!lessonWords.length) {
            vocabularyList.innerHTML = "<li>Không có từ vựng trong bài học này!</li>";
            return;
        }

        lessonWords.forEach((word, index) => {
            const chineseDisplay =
                word.traditional === word.simplified
                    ? word.traditional
                    : `${word.traditional} (${word.simplified})`;

            const listItem = document.createElement("li");
listItem.innerHTML = `
    <strong>${index + 1}. ${chineseDisplay}</strong> <br>
    ${word.hanViet} --- ${word.meaning} <br>
    <em>${word.pinyin}</em>
    <button onclick="deleteWord(${index})">Xoá</button>
    <button onclick="editWord(${index})">Chỉnh</button>
`;


            vocabularyList.appendChild(listItem);
        });

        // ✅ Thêm nút "Xoá toàn bộ"
        const deleteAllBtn = document.createElement("button");
        deleteAllBtn.textContent = "🗑 Xoá toàn bộ từ trong bài này";
        deleteAllBtn.style.marginTop = "10px";
        deleteAllBtn.onclick = () => {
            if (confirm(`Bạn có chắc muốn xoá tất cả từ trong ${currentLesson}?`)) {
                vocabularyData[currentLesson] = [];
                saveVocabularyData(vocabularyData);
                showVocabulary(); // Cập nhật lại danh sách sau khi xoá
            }
        };
        vocabularyList.appendChild(deleteAllBtn);

    } else {
        vocabularyList.style.display = "none";
    }
};


// Hiển thị ghi chú
const showTips = async () => {
  let word;
  const lessonWords = vocabularyData[currentLesson] || [];

  if (reviewingMode) {
    if (!reviewCards.length) {
      alert("⚠️ Không có từ trong chế độ ôn tập.");
      return;
    }
    word = reviewCards[reviewCardIndex];
  } else {
    word = lessonWords[currentCardIndex];
  }

  if (!word) {
    alert("⚠️ Không có từ để hiển thị.");
    return;
  }

  const target = word.traditional || word.simplified;

  // 1️⃣ Nếu từ hiện tại đã có note → hiển thị bằng popup
  if (word.note) {
    const hintPopup = document.getElementById("hintPopup");
    const hintOverlay = document.getElementById("hintOverlay");
    const hintText = document.getElementById("hintText");

    hintText.innerText = `Ghi chú: ${word.note}`;
    hintPopup.classList.add("show");
    hintOverlay.classList.add("show");
    return;
  }

  // 2️⃣ Nếu chưa có note → dò trong dữ liệu
  let foundNote = null;

  // Tìm note cho nguyên từ
  for (const [lesson, words] of Object.entries(vocabularyData)) {
    if (!Array.isArray(words)) continue;
    const w = words.find(
      (item) =>
        (item.traditional === target || item.simplified === target) &&
        item.note
    );
    if (w) {
      foundNote = w.note;
      break;
    }
  }

  if (foundNote) {
    if (
      confirm(
        `📌 Tìm thấy note cho "${target}" ở bài khác.\nBạn có muốn copy vào từ hiện tại không?`
      )
    ) {
      word.note = foundNote;
      await saveVocabularyData(vocabularyData);
      alert("✔️ Đã copy note!");
    }
    return;
  }

  // 3️⃣ Nếu không có note cho nguyên từ → kiểm tra từng ký tự
  const chars = target.split("");
  let charNotes = [];
  let missingChars = [];

  for (const ch of chars) {
    let noteFound = null;
    for (const [lesson, words] of Object.entries(vocabularyData)) {
      if (!Array.isArray(words)) continue;
      const w = words.find(
        (item) =>
          (item.traditional === ch || item.simplified === ch) && item.note
      );
      if (w) {
        noteFound = w.note;
        break;
      }
    }
    if (noteFound) {
      charNotes.push({ source: ch, note: noteFound });
    } else {
      missingChars.push(ch); // ký tự không có note
    }
  }

  if (charNotes.length === 0) {
    // ❌ Không tìm thấy bất kỳ note nào → cho nhập thủ công
    if (confirm(`❌ Không có note cho "${target}". Bạn có muốn tự thêm không?`)) {
      const newNote = prompt("Nhập ghi chú cho từ này:");
      if (newNote && newNote.trim()) {
        word.note = newNote.trim();
        await saveVocabularyData(vocabularyData);
        alert("✔️ Ghi chú đã được thêm!");
      }
    }
    return;
  }

  // Báo những ký tự không có note
  if (missingChars.length > 0) {
    alert(`⚠️ Các ký tự sau chưa có note: ${missingChars.join("、")}`);
  }

  if (charNotes.length === 1) {
    const ch = charNotes[0];
    if (confirm(`📌 Có note cho "${ch.source}". Bạn có muốn copy không?`)) {
      word.note = ch.note;
      await saveVocabularyData(vocabularyData);
      alert("✔️ Đã copy note!");
    }
    return;
  }

  // Nếu nhiều ký tự có note → cho người dùng chọn
  let options = charNotes.map((c, i) => `${i + 1}=${c.source}`).join(", ");
  let choice = prompt(
    `📌 Có note cho các ký tự sau: ${options}\nNhập số để chọn (vd: 1 hoặc 2 hoặc 1,2 để chọn nhiều):`
  );

  if (!choice) return;

  let indexes = choice
    .split(",")
    .map((c) => parseInt(c.trim(), 10) - 1)
    .filter((i) => i >= 0 && i < charNotes.length);

  if (indexes.length === 0) {
    alert("⚠️ Lựa chọn không hợp lệ.");
    return;
  }

  let combinedNote = indexes.map((i) => charNotes[i].note).join("\n\n");
  word.note = combinedNote;
  await saveVocabularyData(vocabularyData);
  alert("✔️ Đã copy note từ ký tự vào từ hiện tại!");
};



// Hàm đóng pop-up
const closeHintPopup = () => {
    document.getElementById("hintPopup").classList.remove("show");
    document.getElementById("hintOverlay").classList.remove("show");
};


document.getElementById("checkDuplicatesBtn").addEventListener("click", function () {
    const lessonWords = vocabularyData[currentLesson] || [];
    const wordMap = {};
    const duplicates = [];

    // Gom nhóm từ giống nhau (theo traditional + simplified)
    lessonWords.forEach((item, index) => {
        const key = `${item.traditional}_${item.simplified}`;
        if (!wordMap[key]) {
            wordMap[key] = { indexes: [], word: item };
        }
        wordMap[key].indexes.push(index + 1); // +1 để hiển thị STT từ 1
    });

    // Lọc ra những từ xuất hiện nhiều hơn 1 lần
    Object.values(wordMap).forEach(({ indexes, word }) => {
        if (indexes.length > 1) {
            duplicates.push({ indexes, word });
        }
    });

    if (duplicates.length === 0) {
        alert("✅ Không có từ trùng trong bài học.");
        return;
    }

    // Tạo popup: chỉ hiển thị danh sách trùng và nút XÓA TẤT CẢ
    let popupContent = `<h3>Các từ bị trùng</h3><ul>`;
    duplicates.forEach(({ indexes, word }) => {
        const stt = indexes.join(", ");
        const display = word.traditional === word.simplified
            ? word.traditional
            : `${word.traditional} (${word.simplified})`;

        popupContent += `
            <li>
                <strong>${display}</strong> --- ${word.hanViet} --- ${word.meaning} (${word.pinyin})
                <br><small>Vị trí trùng: ${stt}</small>
            </li>
        `;
    });

    popupContent += `</ul>
        <button onclick="deleteAllDuplicates()" >🗑️ )</button>
        <button onclick="closeDuplicatePopup()">Đóng</button>`;

    document.getElementById("duplicatePopupContent").innerHTML = popupContent;
    document.getElementById("duplicatePopup").classList.add("show");
    document.getElementById("duplicateOverlay").classList.add("show");
});


const deleteDuplicate = (index) => {
    if (!confirm("Bạn có chắc muốn xóa từ này?")) return;

    vocabularyData[currentLesson].splice(index, 1);
    saveVocabularyData(vocabularyData);
    alert("Đã xóa từ trùng.");
    document.getElementById("duplicatePopup").classList.remove("show");
    document.getElementById("duplicateOverlay").classList.remove("show");
    updateLessonView();
};

// Hiển thị modal "Ôn lại toàn bộ"
// Giả sử bạn đã có một danh sách lưu từ vựng đã đánh dấu
let markedWords = []; // Thêm logic lưu từ vựng đánh dấu học lại nếu chưa có

// document.getElementById('review-all-btn').addEventListener('click', function () {
//     const allWordsToReview = []; // Mảng lưu toàn bộ từ cần ôn lại

//     // Duyệt qua tất cả bài học từ lesson1 đến lesson15
//     for (const lesson in vocabularyData) {
//         if (!lesson.startsWith("lesson")) continue; // Bỏ qua các bài học không phải dạng "lesson"
        
//         const lessonNumber = parseInt(lesson.replace("lesson", ""), 10);
//         if (lessonNumber < 1 || lessonNumber > 15) continue; // Chỉ lấy từ bài 1 đến bài 15

//         const lessonWords = vocabularyData[lesson] || [];
//         const wordsToReview = lessonWords.filter(word => word.needReview === true); // Lọc từ cần học lại
//         allWordsToReview.push(...wordsToReview); // Gộp vào mảng chính
//     }

//     if (allWordsToReview.length === 0) {
//         alert("Không có từ nào được đánh dấu cần học lại từ bài 1 đến 15.");
//         return;
//     }

//     // Hiển thị danh sách từ cần học lại
//     const reviewContent = allWordsToReview
//         .map((word, index) => 
//             `<p><strong>${index + 1}. ${word.traditional} (${word.simplified})</strong> - ${word.hanViet}<br>
//              Pinyin: ${word.pinyin}<br>
//              Nghĩa: ${word.meaning}</p>`
//         )
//         .join("");

//     // Tạo modal hiển thị
//     const reviewModal = document.createElement('div');
//     reviewModal.className = 'modal';
//     reviewModal.innerHTML = `
//         <div class="modal-content">
//             <h2>Ôn lại toàn bộ (Bài 1 đến 15)</h2>
//             <div>${reviewContent}</div>
//             <button id="close-review-btn">Đóng</button>
//         </div>
//     `;
//     document.body.appendChild(reviewModal);
//     reviewModal.style.display = 'block';

//     // Sự kiện đóng modal
//     document.getElementById('close-review-btn').addEventListener('click', function () {
//         reviewModal.style.display = 'none';
//         reviewModal.remove();
//     });
// });



// Đóng modal
function closeReviewAllModal() {
    document.getElementById("reviewAllModal").style.display = "none";
}

// Đóng modal
function closeReviewAllModal() {
    document.getElementById("reviewAllModal").style.display = "none";
}

// Hàm xóa tất cả từ trùng
function deleteAllDuplicates() {
    if (!confirm("Bạn có chắc muốn xoá tất cả các từ trùng?")) return;

    const lessonWords = vocabularyData[currentLesson] || [];
    const seen = {};
    const unique = [];

    // Duyệt ngược để giữ lại bản cuối cùng (vừa nhập)
    for (let i = lessonWords.length - 1; i >= 0; i--) {
        const item = lessonWords[i];
        const key = `${item.traditional}_${item.simplified}`;
        if (!seen[key]) {
            seen[key] = true;
            unique.unshift(item); // Thêm lại vào đầu để giữ đúng thứ tự
        }
    }

    vocabularyData[currentLesson] = unique;
    saveVocabularyData(vocabularyData);
    alert("Đã xoá tất cả từ trùng (giữ lại từ mới nhất).");
    closeDuplicatePopup();
    updateLessonView();
}




// Bắt đầu chế độ ôn tập


// Thoát chế độ ôn tập
function exitReviewMode() {
  reviewingMode = false;
  reviewCards = [];
  reviewCardIndex = 0;
  showFront = true;

  document.getElementById("exitReviewBtn").style.display = "none";

  updateCard(); // ✅ trở lại flashcard bài học thường
}

// Cập nhật flashcard trong chế độ ôn tập
function updateReviewCard() {
  const cardContent = document.getElementById("card-content");

  if (!reviewCards.length) {
    cardContent.textContent = "Không có từ cần ôn tập!";
    return;
  }

  const word = reviewCards[reviewCardIndex];

  // prefix icon
  let prefix = "";
  if (word.lyHop) prefix += "🔹 ";
  if (word.needReview) prefix += "🔴 ";
  if (word.tocflFlag) prefix += "🔔 ";
  if (word.tocflTopicFlag) prefix += "🍞 ";

  const color = word.needReview ? "red" : "black";

  if (showFront) {
    // Mặt trước: hiển thị chữ Hán
    const chineseDisplay =
      word.traditional === word.simplified
        ? word.traditional
        : `${word.traditional} (${word.simplified})`;

    cardContent.innerHTML = `${prefix}<span style="color:${color}; font-size:120px; font-weight:bold;">${chineseDisplay}</span>`;
  } else {
    // Mặt sau: hiển thị nghĩa
    cardContent.innerHTML = `${prefix}<div>${word.hanViet} --- ${word.meaning}<br>${word.pinyin}</div>`;
  }

  document.getElementById("pinyin-input").value = "";
  document.getElementById("pinyin-input").focus();

  updateWordPosition();
}


// ✅ Cập nhật flashcard trong chế độ ôn tập
function updateReviewCard() {
    const cardContent = document.getElementById("card-content");

    if (!reviewCards.length) {
        cardContent.textContent = "Không có từ cần ôn tập!";
        return;
    }

    const word = reviewCards[reviewCardIndex];
    const chineseDisplay =
        word.traditional === word.simplified
            ? word.traditional
            : `${word.traditional} (${word.simplified})`;

    // ✅ prefix biểu tượng
let prefix = "";
if (word.lyHop) prefix += "🔹 ";
if (word.needReview) prefix += "🔴 ";
if (word.tocflFlag) prefix += "🔔 ";
if (word.tocflTopicFlag) prefix += "🍞 ";



    const color = word.needReview ? "red" : "black";

    cardContent.innerHTML = showFront
        ? `${prefix}<span style="color: ${color}">${chineseDisplay}</span>`
        : `<div>${word.hanViet} --- ${word.meaning}<br>${word.pinyin}</div>`;

    document.getElementById("pinyin-input").value = "";
    document.getElementById("pinyin-input").focus();

    updateWordPosition(); // thêm vào cuối
}


function getToneNumberFromSyllable(syllable) {
  const toneMap = {
    ā: 1, á: 2, ǎ: 3, à: 4,
    ē: 1, é: 2, ě: 3, è: 4,
    ī: 1, í: 2, ǐ: 3, ì: 4,
    ō: 1, ó: 2, ǒ: 3, ò: 4,
    ū: 1, ú: 2, ǔ: 3, ù: 4,
    ǖ: 1, ǘ: 2, ǚ: 3, ǜ: 4
  };
  for (let ch of syllable) if (toneMap[ch]) return toneMap[ch];
  return 0;
}


function splitPinyin(pinyin) {
  // cắt theo khoảng trắng nếu có
  if (pinyin.includes(" ")) return pinyin.split(" ");

  // nếu không có khoảng trắng (ghép liền) → tự động tách theo thanh điệu
  return pinyin.match(/[a-zü]+[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]?/gi) || [pinyin];
}
function updateCard() {
  const lessonWords = vocabularyData[currentLesson] || [];
  const cardContent = document.getElementById("card-content");

  if (!lessonWords.length) {
    cardContent.textContent = "Không có từ vựng!";
    return;
  }

  const word = lessonWords[currentCardIndex];
  const color = word.needReview ? "red" : "black";
  const targetHan = word.traditional || word.simplified;
  const engData = englishMap[targetHan];

  let prefix = "";
  if (word.lyHop)          prefix += "🔹 ";
  if (word.needReview)     prefix += "🔴 ";
  if (word.tocflFlag)      prefix += "🔔 ";
  if (word.tocflTopicFlag) prefix += "🍞 ";
  prefix += getPinyinIcons(word.pinyin);

  if (!reverseMode) {
    if (showFront) {
      // --- MẶT TRƯỚC: Hán tự ở trên, Tiếng Anh ở dưới (giữa 2 gạch ngang) ---
      const chars = targetHan.split("");
      const syllables = splitPinyin(word.pinyin);
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
      // --- MẶT SAU: Nghĩa Việt + IPA tiếng Anh (IPA đã thu nhỏ) ---
      let ipaText = engData ? `<span style="color:#2ecc71; font-size: 28px; font-weight:bold; margin-left:12px;"> [${engData.ipa}]</span>` : "";
      
      cardContent.innerHTML = `
        ${prefix}
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
          <div style="font-size: 36px; margin-bottom: 20px; color: #333;">
            ${word.hanViet} --- ${word.meaning}${ipaText}
          </div>
          <div style="font-size: 55px; font-weight: 500; color: #444;">
            ${word.pinyin}
          </div>
        </div>
      `;
    }
  } else {
    // Chế độ đảo ngược (Nghĩa -> Hán)
    if (showFront) {
      cardContent.innerHTML = `${prefix}<div style="font-size:45px; font-weight:bold;">${word.meaning}</div>`;
    } else {
      let ipaText = engData ? `<span style="color:#2ecc71; font-size: 28px; font-weight:bold; margin-left:12px;"> [${engData.ipa}]</span>` : "";
      cardContent.innerHTML = `
        ${prefix}
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
          <div style="font-size:120px; margin-bottom: 10px;">${targetHan}</div>
          <div style="font-size: 32px;">${word.hanViet} --- ${word.meaning}${ipaText}</div>
          <div style="font-size: 45px; margin-top: 10px;">${word.pinyin}</div>
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
function toggleCardOrder() {
  reverseMode = !reverseMode;

  if (reverseMode) {
    showTemporaryMessage("🔄 Nghĩa → Hán", "info");
  } else {
    showTemporaryMessage("🔄 Hán → Nghĩa", "info");
  }

  showFront = true; // reset về mặt trước
  updateCard();
}




// Hàm dành riêng cho "Ôn tập All"
function updateReviewAllCard() {
    const cardContent = document.getElementById("card-content");

    if (!reviewCards.length) {
        cardContent.textContent = "Không có từ cần ôn tập (All)!";
        return;
    }

    const word = reviewCards[reviewCardIndex];
    const chineseDisplay =
        word.traditional === word.simplified
            ? word.traditional
            : `${word.traditional} (${word.simplified})`;

    // ✅ prefix biểu tượng
    let prefix = "";
    if (word.lyHop) prefix += "🔹 ";
    if (word.needReview) prefix += "🔴 ";
    if (word.tocflFlag) prefix += "🔔 ";
    if (word.tocflTopicFlag) prefix += "🍞 ";

    const color = word.needReview ? "red" : "black";

    cardContent.innerHTML = showFront
        ? `${prefix}<span style="color: ${color}">${chineseDisplay}</span>`
        : `<div>${word.hanViet} --- ${word.meaning}<br>${word.pinyin}</div>`;

    // reset input
    document.getElementById("pinyin-input").value = "";
    document.getElementById("pinyin-input").focus();

    // ✅ cập nhật vị trí từ trong tổng hợp
    updateWordPosition();
}



function deleteCurrentLessonWords() {
    if (!confirm(`Bạn có chắc muốn xoá tất cả từ trong ${currentLesson}?`)) return;

    vocabularyData[currentLesson] = [];
    saveVocabularyData(vocabularyData);
    alert(`Đã xoá toàn bộ từ trong ${currentLesson}.`);
    updateLessonView();
}

// Cập nhật bài học
// 📌 Cập nhật lại giao diện khi dữ liệu thay đổi
function updateLessonView ()  {
  // Nếu chưa có card index thì reset về 0
  if (currentCardIndex == null) {
    currentCardIndex = 0;
  }
  showFront = true;

  // --- Phần 1: cập nhật flashcard ---
  updateCard();

  // --- Phần 2: render danh sách từ vựng ---
  const container = document.getElementById("vocabulary-list");
  if (!container) return; // Nếu chưa có khung hiển thị thì bỏ qua

  container.innerHTML = ""; // clear cũ

  const lessonWords = vocabularyData[currentLesson] || [];
  lessonWords.forEach((word, index) => {
    const div = document.createElement("div");
    div.className = "word-item";

    div.innerHTML = `
      <b>${word.traditional} (${word.simplified})</b> 
      - ${word.hanViet} 
      - ${word.meaning} 
      - <i>${word.pinyin}</i>
      <button onclick="deleteWord(${index})">❌ Xóa</button>
    `;

    container.appendChild(div);
  });
};

// Khởi tạo sự kiện phím tắt
// Khởi tạo sự kiện phím tắt
// let tocflKeyLock = false; // khóa cho "/"

document.addEventListener("keydown", (event) => {
    // Không xử lý phím tắt khi đang nhập trong ô ghi chú
    if (event.target.closest(".note")) return;

    switch (event.key) {

        // ← Card trước
        case "ArrowLeft":
            event.preventDefault();
            prevCard();
            break;

        // → Card tiếp theo
        case "ArrowRight":
            event.preventDefault();
            nextCard();
            break;

        // Space → lật card
        case " ":
            event.preventDefault();
            toggleCard();
            break;

        // ↓ → đọc theo chế độ hiện tại
        // Mặt trước: Trung → Anh
        // Mặt sau: Việt
        case "ArrowDown":
            event.preventDefault();
            readCard();
            break;

        // ↑ → đánh dấu ôn tập
        case "ArrowUp":
            event.preventDefault();
            markWordForReview();
            break;

        // Ctrl
        case "Control":

            // Ctrl trái → CHỈ đọc tiếng Anh
            if (event.location === 1) {
                event.preventDefault();
                readEnglishCard();
            }

            // Ctrl phải → hiện Tips
            else if (event.location === 2) {
                event.preventDefault();
                showTips();
            }

            break;

        // Shift
        case "Shift":
            if (event.location === 2) {
                // Shift phải → xoá từ hiện tại
                deleteCurrentWord();
            }

            break;

        // ' → copy sang tocfl-topic
        case "'":
            event.preventDefault();
            addWordToTocflTopic();
            break;

        default:
            break;
    }
});


// Khi nhả "/" thì reset khóa
document.addEventListener("keyup", (event) => {
  if (event.key === "/") {
    tocflKeyLock = false;
  }
});



// 🔊 Hàm đọc tiếng Trung (dùng chung)
function speakChinese(text) {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);

    let zhVoice =
      availableVoices.find(v => v.lang === "zh-CN" && v.name.toLowerCase().includes("female")) ||
      availableVoices.find(v => v.lang === "zh-CN" && v.name.toLowerCase().includes("xiaoyun")) ||
      availableVoices.find(v => v.lang === "zh-CN" && v.name.toLowerCase().includes("google")) ||
      availableVoices.find(v => v.lang === "zh-CN");

    if (zhVoice) utterance.voice = zhVoice;
    utterance.lang = "zh-CN";
    utterance.rate = 0.9;

    utterance.onend = resolve;
    utterance.onerror = resolve;

    // đảm bảo clear queue trước khi đọc mới
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  });
}


// 🔊 Chỉ đọc tiếng Anh của flashcard hiện tại
// ============================================================
// 🔊 CHỈ ĐỌC TIẾNG ANH
// Ctrl trái
// ============================================================

const readEnglishCard = async () => {
    let word;

    // --------------------------------
    // Lấy từ hiện tại
    // --------------------------------
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

    // --------------------------------
    // Lấy tiếng Trung
    // --------------------------------
    const targetHan =
        word.traditional ||
        word.simplified;

    // --------------------------------
    // Lấy tiếng Anh
    // --------------------------------
    const engData = englishMap[targetHan];

    if (!engData?.english) return;

    // --------------------------------
    // Hủy âm thanh đang phát
    // --------------------------------
    speechSynthesis.cancel();

    // --------------------------------
    // Tạo giọng đọc tiếng Anh
    // --------------------------------
    const utterance =
        new SpeechSynthesisUtterance(
            engData.english
        );

    // --------------------------------
    // Chọn voice tiếng Anh
    // --------------------------------
    const enVoice =

        availableVoices.find(v =>
            v.lang === "en-US" &&
            v.name
                .toLowerCase()
                .includes("google")
        ) ||

        availableVoices.find(v =>
            v.lang === "en-US" &&
            v.name
                .toLowerCase()
                .includes("zira")
        ) ||

        availableVoices.find(v =>
            v.lang === "en-US"
        ) ||

        availableVoices.find(v =>
            v.lang.startsWith("en")
        );

    if (enVoice) {
        utterance.voice = enVoice;
    }

    // --------------------------------
    // Cài đặt giọng đọc
    // --------------------------------
    utterance.lang = "en-US";
    utterance.rate = 0.82;
    utterance.pitch = 1;
    utterance.volume = 1;

    // --------------------------------
    // Đọc tiếng Anh
    // --------------------------------
    speechSynthesis.speak(utterance);
};


// ============================================================
// 🔊 ĐỌC FLASHCARD
//
// Mặt trước:
//    → Tiếng Trung
//    → đợi 400ms
//    → Tiếng Anh
//
// Mặt sau:
//    → Tiếng Việt
//
// Phím ↓ gọi hàm này
// ============================================================


// Phát âm nội dung flashcard
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

    // 🔥 tránh audio chồng nhau
    speechSynthesis.cancel();

    if (showFront) {

        // =========================
        // 1️⃣ ĐỌC TIẾNG TRUNG
        // =========================
        await speakChinese(targetHan);

        // pause nhẹ cho tự nhiên
        await new Promise(resolve => setTimeout(resolve, 400));

        // =========================
        // 2️⃣ ĐỌC TIẾNG ANH
        // =========================
        if (engData?.english) {

            const utterance = new SpeechSynthesisUtterance(
                engData.english
            );

            // ⭐ voice ngon hơn
            const enVoice =
                availableVoices.find(v =>
                    v.lang === "en-US" &&
                    v.name.toLowerCase().includes("google")
                ) ||

                availableVoices.find(v =>
                    v.lang === "en-US" &&
                    v.name.toLowerCase().includes("zira")
                ) ||

                availableVoices.find(v =>
                    v.lang === "en-US"
                ) ||

                availableVoices.find(v =>
                    v.lang.startsWith("en")
                );

            if (enVoice) {
                utterance.voice = enVoice;
            }

            utterance.lang = "en-US";

            // ⭐ QUAN TRỌNG
            utterance.rate = 0.82;

            utterance.pitch = 1;
            utterance.volume = 1;

            speechSynthesis.speak(utterance);
        }

    } else {

        // =========================
        // MẶT SAU → ĐỌC TIẾNG VIỆT
        // =========================
        const utterance = new SpeechSynthesisUtterance(
            `${word.hanViet} --- ${word.meaning}`
        );

        const viVoice =
            availableVoices.find(v => v.lang === "vi-VN");

        if (viVoice) {
            utterance.voice = viVoice;
        }

        utterance.lang = "vi-VN";

        utterance.rate = 1;

        speechSynthesis.speak(utterance);
    }
};
/* ---------- Pinyin converter: replace any older versions with this block ---------- */

function removeToneMarks(str) {
  if (!str) return "";
  return String(str)
    .replace(/[āáǎà]/g,"a")
    .replace(/[ēéěè]/g,"e")
    .replace(/[īíǐì]/g,"i")
    .replace(/[ōóǒò]/g,"o")
    .replace(/[ūúǔù]/g,"u")
    .replace(/[ǖǘǚǜ]/g,"ü");
}

function convertNumberedPinyinToMarked(input) {
  if (input === undefined || input === null) return "";
  const s = String(input);
  if (!/[1-5]/.test(s)) return s;

  const normalized = s.replace(/u:/gi, "ü").replace(/\bv\b/gi, "ü");

  const toneMap = {
    a: ['ā','á','ǎ','à'],
    o: ['ō','ó','ǒ','ò'],
    e: ['ē','é','ě','è'],
    i: ['ī','í','ǐ','ì'],
    u: ['ū','ú','ǔ','ù'],
    'ü': ['ǖ','ǘ','ǚ','ǜ']
  };

  const initials = ["zh","ch","sh","b","p","m","f","d","t","n","l","g","k","h","j","q","x","r","z","c","s","y","w"];
  const finals = ["n", "ng", "m", "r"];

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
      if (isDigitTone(normalized[j])) break;
      if (!isLetter(normalized[j])) break;

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

        // Gộp final trước số vào cùng âm tiết hiện tại
        for (const fin of finals) {
          if (tk.text.toLowerCase().endsWith(fin) && tk.text.length > fin.length + 1) {
            // đã là final -> giữ nguyên
            break;
          }
        }

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
        k++; // skip digit
      } else {
        outParts.push(tk.text);
      }
    } else if (tk.type === 'digit') {
      outParts.push(tk.text);
    } else {
      outParts.push(tk.text);
    }
  }

  return outParts.join('');
}


// Optional small wrappers to keep compatibility if other code calls them:
function _convertWithParser(s) { return convertNumberedPinyinToMarked(s); }
function numberToTone(s) { return convertNumberedPinyinToMarked(String(s).replace(/\s+/g,'')); }

/* ---------- End converter block ---------- */





// lấy toàn bộ hán tự 
// document.getElementById("getTraditionalListBtn").addEventListener("click", function () {
//     const filterMode = document.getElementById("traditionalFilter").value;

//     // Chọn nguồn dữ liệu đúng theo trạng thái ôn tập
//     const lessonWords = reviewingMode
//         ? reviewCards
//         : (currentLesson === "__virtual__"
//             ? vocabularyData["__virtual__"] || []
//             : vocabularyData[currentLesson] || []);

//     let filteredWords = lessonWords;

//     if (filterMode === "lyHop") {
//         filteredWords = lessonWords.filter(w => w.lyHop);
//     } else if (filterMode === "needReview") {
//         filteredWords = lessonWords.filter(w => w.needReview);
//     }

//     if (filteredWords.length === 0) {
//         alert("Không có từ nào phù hợp với bộ lọc.");
//         return;
//     }

//     const traditionalList = filteredWords
//         .map(item => item.traditional)
//         .filter(t => t)
//         .sort()
//         .join(" , ");

//     const content = `
//         <h3>Danh sách Hán tự (traditional)</h3>
//         <p style="word-break: break-all;">${traditionalList}</p>
//     `;

//     document.getElementById("traditionalListContent").innerHTML = content;
//     document.getElementById("traditionalListPopup").classList.add("show");
//     document.getElementById("traditionalOverlay").classList.add("show");
// });



function closeTraditionalListPopup() {
    document.getElementById("traditionalListPopup").classList.remove("show");
    document.getElementById("traditionalOverlay").classList.remove("show");
}



// Gọi hàm khi trang tải
// loadLessonsToSelector();
const loadLessonsToSelector = () => {
    const lessonSelector = document.getElementById("lesson-selector");

    for (const lesson in vocabularyData) {
        if (!document.querySelector(`#lesson-selector option[value="${lesson}"]`)) {
            const option = document.createElement("option");
            option.value = lesson;
            option.textContent = lesson;
            lessonSelector.appendChild(option);
        }
    }
};






window.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("pinyin-input");
    if (input) {
        input.addEventListener("input", (e) => {
            const raw = e.target.value;
            const converted = convertNumberedPinyinToMarked(raw);
            if (raw !== converted) {
                e.target.value = converted;
            }
        });
    }
    updateLessonView(); // đảm bảo gọi sau khi DOM sẵn sàng

});
const jumpInput = document.getElementById("jump-to-index");
if (jumpInput) {
jumpInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const value = parseInt(jumpInput.value, 10);
    if (isNaN(value) || value < 1) return;

    if (reviewingMode) {
        if (value <= reviewCards.length) {
            reviewCardIndex = value - 1;
            updateReviewCard();
        } else {
            alert("Vị trí vượt quá số từ ôn tập.");
        }
    } else {
        const lessonWords = vocabularyData[currentLesson] || [];
        if (value <= lessonWords.length) {
            currentCardIndex = value - 1;
            updateCard();
        } else {
            alert("Vị trí vượt quá số từ của bài học.");
        }
    }

    updateWordPosition();

    // ✅ Reset input để lần sau dùng lại được
    jumpInput.value = "";
});

}









//BỘ ĐẾM 
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




function editWord(index) {
    const lessonWords = vocabularyData[currentLesson] || [];
    const word = lessonWords[index];
    if (!word) return;

    const currentValue = `${word.hanViet} --- ${word.meaning}; ${word.traditional === word.simplified ? word.traditional : word.traditional + " (" + word.simplified + ")"}; ${word.pinyin}`;

    const newInput = prompt("Chỉnh sửa từ (định dạng: Hán Việt --- Nghĩa; Hán Tự; Pinyin):", currentValue);
    if (!newInput || !newInput.includes("---") || !newInput.includes(";")) {
        alert("Định dạng không hợp lệ.");
        return;
    }

    const parts = newInput.split("---");
    const hanViet = parts[0].trim();
    const rest = parts[1].trim().split(";");

    if (rest.length !== 3) {
        alert("Định dạng không hợp lệ (phải có 3 phần sau dấu ---).");
        return;
    }

    const meaning = rest[0].trim();
    const chineseInput = rest[1].trim();
    const pinyin = rest[2].trim();

    const match = chineseInput.match(/^(.+)\s*\((.+)\)$/);
    let traditional, simplified;
    if (match) {
        traditional = match[1].trim();
        simplified = match[2].trim();
    } else {
        traditional = simplified = chineseInput;
    }

    // Cập nhật lại từ vựng
    vocabularyData[currentLesson][index] = {
        hanViet,
        meaning,
        traditional,
        simplified,
        pinyin,
        needReview: word.needReview || false,
        note: word.note || ""
    };

    saveVocabularyData(vocabularyData);
    showVocabulary(); // cập nhật danh sách
    alert("✔️ Đã cập nhật từ vựng.");
}





document.getElementById("edit-current-word-btn").addEventListener("click", () => {
  let word;
  let index;
  const lessonWords = vocabularyData[currentLesson] || [];

  if (reviewingMode) {
    // Đang ở chế độ ôn tập
    word = reviewCards[reviewCardIndex];

    index = lessonWords.findIndex(w =>
      w.traditional === word.traditional &&
      w.simplified === word.simplified &&
      w.hanViet === word.hanViet &&
      w.pinyin === word.pinyin
    );
  } else {
    // Đang ở chế độ học bình thường
    index = currentCardIndex;
    word = lessonWords[index];
  }

  if (!word) {
    alert("❌ Không có từ để chỉnh.");
    return;
  }

  // ==========================
  // Đưa dữ liệu hiện tại vào form
  // ==========================
  document.getElementById("edit-hantu-input").value =
    word.traditional === word.simplified
      ? (word.traditional || "")
      : `${word.traditional || ""} (${word.simplified || ""})`;

  document.getElementById("edit-hanviet-input").value = word.hanViet || "";
  document.getElementById("edit-meaning-input").value = word.meaning || "";
  document.getElementById("edit-pinyin-input").value = word.pinyin || "";

  // Hiện modal
  document.getElementById("editWordModal").style.display = "block";

  // ==========================
  // Nút Lưu
  // ==========================
  document.getElementById("saveEditBtn").onclick = async () => {

    const newHanTu = document.getElementById("edit-hantu-input").value.trim();
    const newHanViet = document.getElementById("edit-hanviet-input").value.trim();
    const newMeaning = document.getElementById("edit-meaning-input").value.trim();
    const newPinyin = document.getElementById("edit-pinyin-input").value.trim();

    let traditional = "";
    let simplified = "";

    // Hỗ trợ nhập:
    // 機會
    // hoặc
    // 機會 (机会)
    const match = newHanTu.match(/^(.+?)\s*\((.+?)\)$/);

    if (match) {
      traditional = match[1].trim();
      simplified = match[2].trim();
    } else {
      traditional = newHanTu;
      simplified = newHanTu;
    }

    // ==========================
    // Cập nhật dữ liệu
    // ==========================
    word.traditional = traditional;
    word.simplified = simplified;
    word.hanViet = newHanViet;
    word.meaning = newMeaning;
    word.pinyin = newPinyin;

    // Đồng bộ dữ liệu ôn tập
    if (reviewingMode) {
      reviewCards[reviewCardIndex] = word;
    }

    try {
      // Lưu file JSON
      await saveVocabularyData(vocabularyData);

      // Cập nhật giao diện
      if (reviewingMode) {
        updateReviewCard();
      } else {
        updateCard();
      }

      closeEditModal();
      alert("✔️ Đã lưu thay đổi.");

    } catch (error) {
      console.error("Lỗi khi lưu:", error);
      alert("❌ Không thể lưu dữ liệu.");
    }
  };
});




function closeEditModal() {
  document.getElementById("editWordModal").style.display = "none";
}





document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('note-area');
  const addBtn = document.getElementById('add-note-btn');
  if (!container || !addBtn) return;

  let notes = JSON.parse(localStorage.getItem('sticky_notes') || '[]');

  const saveNotes = async () => {
  try {
    vocabularyData["_stickyNotes"] = notes; // gắn vào dữ liệu chính
    await saveVocabularyData(vocabularyData); // push lên server JSON
    console.log("✅ Sticky notes đã được lưu vào JSON trên server");
  } catch (err) {
    console.error("❌ Lỗi khi lưu sticky notes:", err);
  }
};


const createNote = (id, content = '', minimized = false) => {
  const note = document.createElement('div');
  note.className = 'note';
  note.dataset.id = id;

  const header = document.createElement('div');
  header.className = 'note-header';

  // 🔹 Nút đóng
  const closeBtn = document.createElement('button');
  closeBtn.textContent = "✖";
  closeBtn.className = "close";
  closeBtn.onclick = () => {
    notes = notes.filter(n => n.id !== id);
    saveNotes();
    note.remove();
  };

  // 🔹 Nút thu gọn
  const minimizeBtn = document.createElement('button');
  minimizeBtn.textContent = "—";
  minimizeBtn.className = "minimize";
  minimizeBtn.onclick = () => {
    const isHidden = getComputedStyle(textarea).display === 'none';
    textarea.style.display = isHidden ? 'block' : 'none';

    const idx = notes.findIndex(n => n.id === id);
    if (idx !== -1) {
      notes[idx].minimized = !isHidden;
      saveNotes();
    }
  };

  header.appendChild(closeBtn);
  header.appendChild(minimizeBtn);

  const textarea = document.createElement('textarea');
  textarea.value = content;
  textarea.style.display = minimized ? 'none' : 'block';

  textarea.oninput = () => {
    const idx = notes.findIndex(n => n.id === id);
    if (idx !== -1) {
      notes[idx].content = textarea.value;
      notes[idx].minimized = getComputedStyle(textarea).display === 'none';
      saveNotes();
    }
  };

  note.appendChild(header);
  note.appendChild(textarea);
  container.appendChild(note);
};


  // Khi nhấn "+ New Note"
  addBtn.onclick = () => {
    const id = Date.now();
    const newNote = { id, content: '', minimized: false };
    notes.push(newNote);
    createNote(newNote.id, newNote.content, newNote.minimized);
    saveNotes();
  };

  // Khởi tạo lại các ghi chú đã lưu
  notes.forEach(n => createNote(n.id, n.content, n.minimized || false));
});





async function deleteRange() {
  const start = parseInt(document.getElementById("deleteStart").value, 10);
  const end = parseInt(document.getElementById("deleteEnd").value, 10);

  if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
    alert("⚠️ Vui lòng nhập khoảng hợp lệ (ví dụ: 10 đến 20).");
    return;
  }

  const lessonWords = vocabularyData[currentLesson] || [];
  const total = lessonWords.length;

  if (start > total || end > total) {
    alert(`⚠️ Khoảng bạn nhập vượt quá số lượng từ hiện có (${total} từ).`);
    return;
  }

  if (!confirm(`Bạn có chắc muốn xoá các từ từ vị trí ${start} đến ${end} trong bài ${currentLesson}?`)) {
    return;
  }

  // ✅ Xóa từ end → start để không bị lệch index
  for (let i = end - 1; i >= start - 1; i--) {
    lessonWords.splice(i, 1);
  }

  // ✅ Lưu xuống file JSON
  await saveVocabularyData(vocabularyData);

  alert(`✔️ Đã xoá ${end - start + 1} từ trong bài học ${currentLesson}.`);

  // ✅ Cập nhật lại giao diện
  if (typeof showVocabulary === "function") showVocabulary();
  if (typeof updateLessonView === "function") updateLessonView();
}



// --- Tìm Hán tự ---
// Lắng nghe Enter trong ô searchHanInput
// --- LISTENER ENTER ---
const searchHanInput = document.getElementById('searchHanInput');
if (searchHanInput) {
  searchHanInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const kw = searchHanInput.value.trim();
      if (kw) openHanSearchPopup(kw);
    }
  });
}

// --- POPUP CLOSE ---
function closeHanSearchPopup() {
  const el = document.getElementById('hanSearchPopup');
  if (el) el.style.display = 'none';
}

// --- TÌM KIẾM HÁN TỰ (ĐÃ FIX) ---
function openHanSearchPopup(keyword) {
  if (!keyword || !keyword.trim()) return;

  const norm = (s) => (s || "").replace(/\s+/g, "");
  const kw = norm(keyword);
  const results = [];

  if (!vocabularyData || typeof vocabularyData !== "object") {
    alert("Chưa có dữ liệu từ vựng.");
    return;
  }

  // 🔍 Tìm kiếm trong tất cả bài học
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
    resultsDiv.innerHTML = results
      .map(
        (r) => `
      <div class="search-result-item">
        <button class="goto-btn" data-lesson="${r.lessonId}" data-index="${r.idx}">Đi</button>
        <span class="result-text">
          <strong>${r.word.traditional}</strong>
          ${
            r.word.simplified && r.word.simplified !== r.word.traditional
              ? ` (${r.word.simplified})`
              : ""
          }
          — ${r.word.hanViet} — ${r.word.pinyin}
          <span class="lesson-label">[${r.lessonId} #${r.idx + 1}]</span>
        </span>
      </div>
    `
      )
      .join("");

    // 🖱️ Gắn sự kiện cho nút "Đi"
    resultsDiv.querySelectorAll(".goto-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const lesson = btn.getAttribute("data-lesson");
        const idx = parseInt(btn.getAttribute("data-index"), 10);

        currentLesson = lesson;
        currentCardIndex = idx;
        showFront = true;
        updateLessonView(); // hoặc updateCard()

        closeHanSearchPopup();
      });
    });
  }

  popup.style.display = "block";
}





function closeHanSearchPopup() {
    document.getElementById("hanSearchPopup").style.display = "none";
}



function markLyHopOnce() {
    const word = reviewingMode ? reviewCards[reviewCardIndex] : vocabularyData[currentLesson][currentCardIndex];
    if (!word) return;

    if (word.lyHop) {
        alert("🔹 Từ này đã được đánh dấu là động từ ly hợp.");
        return;
    }

    word.lyHop = true;

    // Ghi lại trong dữ liệu gốc nếu đang ở chế độ ôn tập
    if (reviewingMode) {
        const lessonWords = vocabularyData[currentLesson] || [];
        const index = lessonWords.findIndex(w =>
            w.traditional === word.traditional &&
            w.simplified === word.simplified &&
            w.hanViet === word.hanViet &&
            w.pinyin === word.pinyin
        );
        if (index !== -1) {
            lessonWords[index].lyHop = true;
        }
    }

    saveVocabularyData(vocabularyData);
    updateCard();
    alert("✅ Đã đánh dấu là động từ ly hợp.");
}

function toggleLyHopMark() {
    skipNextFocus = true;
    const word = reviewingMode ? reviewCards[reviewCardIndex] : vocabularyData[currentLesson][currentCardIndex];
    if (!word) return;

    word.lyHop = !word.lyHop;

    if (reviewingMode) {
        const lessonWords = vocabularyData[currentLesson] || [];
        const index = lessonWords.findIndex(w =>
            w.traditional === word.traditional &&
            w.simplified === word.simplified &&
            w.hanViet === word.hanViet &&
            w.pinyin === word.pinyin
        );
        if (index !== -1) {
            lessonWords[index].lyHop = word.lyHop;
        }
    }

    saveVocabularyData(vocabularyData);
    updateCard();
}




document.getElementById("goToWordBtn").addEventListener("click", () => {
  if (selectedHanLesson && selectedHanIndex !== null) {
    // đổi bài học & chỉ số
    currentLesson = selectedHanLesson;
    currentCardIndex = selectedHanIndex;

    // đồng bộ select UI
    const lessonSel = document.getElementById("lesson-selector");
    if (lessonSel) lessonSel.value = currentLesson;

    const subLessonSel = document.getElementById("sub-lesson-selector");
    if (subLessonSel) subLessonSel.value = currentLesson;

    const allSel = document.getElementById("all-lessons-selector");
    if (allSel) allSel.value = currentLesson;

    // hiển thị đúng từ
    if (typeof updateLessonView === "function") updateLessonView();
    if (typeof showCard === "function") showCard(currentCardIndex);

    closeHanSearchPopup();
  } else {
    alert("⚠️ Vui lòng chọn một từ trong kết quả trước khi nhấn Đi.");
  }
});









document.getElementById("summary-review-btn").addEventListener("click", () => {
  const modal = document.getElementById("summaryModal");
  modal.style.display = "block";

  const mainSelect = document.getElementById("multi-main-select");
  const subSelect = document.getElementById("multi-sub-select");
  mainSelect.innerHTML = "";
  subSelect.innerHTML = "";

  // Tạo options từ select gốc
  Array.from(document.getElementById("lesson-selector").options).forEach(opt => {
    const newOpt = document.createElement("option");
    newOpt.value = opt.value;
    newOpt.textContent = opt.textContent;
    mainSelect.appendChild(newOpt);
  });

  Array.from(document.getElementById("sub-lesson-selector").options).forEach(opt => {
    const newOpt = document.createElement("option");
    newOpt.value = opt.value;
    newOpt.textContent = opt.textContent;
    subSelect.appendChild(newOpt);
  });
});
function closeSummaryModal() {
  document.getElementById("summaryModal").style.display = "none";
}
document.getElementById("startSummaryBtn").addEventListener("click", () => {
  const mainSelect = document.getElementById("multi-main-select");
  const subSelect = document.getElementById("multi-sub-select");

  const selectedLessons = [
    ...Array.from(mainSelect.selectedOptions).map(opt => opt.value),
    ...Array.from(subSelect.selectedOptions).map(opt => opt.value),
  ];

  if (selectedLessons.length === 0) {
    alert("Vui lòng chọn ít nhất 1 bài.");
    return;
  }

  // Tổng hợp từ
  summaryCards = selectedLessons.flatMap(lesson => vocabularyData[lesson] || []);
  if (summaryCards.length === 0) {
    alert("Không có từ trong các bài đã chọn.");
    return;
  }

  isSummaryMode = true;
  summaryIndex = 0;
  showFront = true;
  document.getElementById("exitSummaryBtn").style.display = "inline-block";
  closeSummaryModal();
  updateSummaryCard();
});
document.getElementById("exitSummaryBtn").addEventListener("click", () => {
  isSummaryMode = false;
  summaryCards = [];
  summaryIndex = 0;
  showFront = true;
  updateCard();
  document.getElementById("exitSummaryBtn").style.display = "none";
});
function updateSummaryCard() {
  const word = summaryCards[summaryIndex];
  const cardContent = document.getElementById("card-content");

  if (!word) {
    cardContent.innerHTML = "Không có từ!";
    return;
  }

  const chinese = word.traditional === word.simplified ? word.traditional : `${word.traditional} (${word.simplified})`;
  const prefix = word.lyHop ? "🔹 " : "";
  const color = word.needReview ? "red" : "black";

  cardContent.innerHTML = showFront
    ? `${prefix}<span style="color: ${color}">${chinese}</span>`
    : `<div>${word.hanViet} --- ${word.meaning}<br>${word.pinyin}</div>`;

  document.getElementById("pinyin-input").value = "";
  document.getElementById("pinyin-input").focus();
  updateWordPosition();
}



// Copy Hán tự khi nhấn đúp chuột vào flashcard
const flashcard = document.getElementById("flashcard");

flashcard.addEventListener("click", (e) => {
    // Nếu sự kiện đến từ bàn phím thì bỏ qua
    if (e.pointerType && e.pointerType !== "mouse") return;
    if (e.detail === 0) return; // detail=0 khi kích hoạt từ bàn phím

    let word;
    if (reviewingMode) {
        word = reviewCards[reviewCardIndex];
    } else if (isSummaryMode) {
        word = summaryCards[summaryIndex];
    } else {
        const lessonWords = vocabularyData[currentLesson] || [];
        word = lessonWords[currentCardIndex];
    }

    if (!word) return;

    const hanTu = word.traditional || word.simplified;

    navigator.clipboard.writeText(hanTu).then(() => {
        showTemporaryMessage(`📋 Đã copy: ${hanTu}`, "success");
    }).catch(err => {
        console.error("❌ Lỗi copy:", err);
    });
});


// ==========================================================================
// 📌 BỘ NẠP DỮ LIỆU TĨNH CẤU HÌNH CHO GITHUB PAGES
// ==========================================================================

/**
 * Tải file dữ liệu tiếng Anh bổ sung (English Map)
 */
const loadEnglishMap = async () => {
  try {
    // Đọc trực tiếp file tĩnh english-map.json bằng đường dẫn tương đối ./
    const response = await fetch("./english-map.json", {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    if (response.ok) {
      englishMap = await response.json();
      console.log("✅ Đã nạp English Map thành công");
    } else {
      console.warn(`⚠️ Không tìm thấy file ./english-map.json (Lỗi HTTP ${response.status})`);
    }
  } catch (err) {
    console.warn("ℹ️ Lỗi kết nối khi nạp english-map.json:", err.message);
  }
};

// ==========================================================================
// 📌 KHỞI ĐỘNG ỨNG DỤNG (STATIC ASYNC INIT)
// ==========================================================================
(async () => {
  try {
    console.log("🚀 Đang khởi động ứng dụng trên GitHub Pages...");

    // 1. Nạp dữ liệu từ vựng chính từ file static JSON (vocabularyData.json)
    vocabularyData = await loadVocabularyData();
    
    // Kiểm tra tính hợp lệ của dữ liệu từ vựng
    if (vocabularyData && Object.keys(vocabularyData).length > 0) {
      console.log("✅ Dữ liệu từ vựng đã nạp thành công:", vocabularyData);
    } else {
      console.warn("⚠️ Dữ liệu từ vựng nhận được bị rỗng hoặc chưa khớp cấu trúc.");
    }

    // 2. Nạp dữ liệu tiếng Anh bổ sung (English Map)
    await loadEnglishMap(); 

    // 3. Cập nhật giao diện khi dữ liệu đã sẵn sàng
    if (typeof updateLessonView === 'function') {
      updateLessonView();
    } else {
      console.error("❌ Không tìm thấy hàm updateLessonView() để hiển thị giao diện.");
    }
    
  } catch (error) {
    console.error("❌ Lỗi nghiêm trọng khi khởi động ứng dụng:", error);
    // Vẫn gọi hiển thị để tránh treo giao diện nếu xảy ra ngoại lệ
    if (typeof updateLessonView === 'function') {
      updateLessonView();
    }
  }
})();

// ✅ Đánh dấu từ hiện tại vào danh sách "tocfl"
// ✅ Đánh dấu từ hiện tại vào danh sách "tocfl"
function toggleTocflMark() {
    const lessonWords = vocabularyData[currentLesson] || [];
    let word;

    if (reviewingMode) {
        word = reviewCards[reviewCardIndex];
    } else if (isSummaryMode) {
        word = summaryCards[summaryIndex];
    } else {
        word = lessonWords[currentCardIndex];
    }

    if (!word) return;

    // ✅ nếu chưa có cờ thì mặc định false
    if (typeof word.tocflFlag === "undefined") {
        word.tocflFlag = false;
    }

    // ✅ đảo trạng thái
    word.tocflFlag = !word.tocflFlag;

    // Khởi tạo danh sách tocfl nếu chưa có
    if (!vocabularyData["tocfl"]) {
        vocabularyData["tocfl"] = [];
    }

    if (word.tocflFlag) {
        // thêm nếu chưa có trong tocfl
        if (!vocabularyData["tocfl"].some(w =>
            w.traditional === word.traditional &&
            w.simplified === word.simplified &&
            w.pinyin === word.pinyin
        )) {
            vocabularyData["tocfl"].push({ ...word }); // clone để tránh tham chiếu
        }
    } else {
        // gỡ khỏi tocfl
        vocabularyData["tocfl"] = vocabularyData["tocfl"].filter(w =>
            !(w.traditional === word.traditional &&
              w.simplified === word.simplified &&
              w.pinyin === word.pinyin)
        );
    }

    saveVocabularyData(vocabularyData);
    updateCard();

    alert(word.tocflFlag ? "🔔 Đã thêm vào ALL" : "❌ Đã gỡ khỏi ALL");
}







async function generateTTS() {
  const text = document.getElementById("text").value;

  const res = await fetch("/tts-multi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  document.getElementById("player").src = url;
  document.getElementById("download").href = url;
}



// ✅ Copy từ hiện tại sang "tocfl-topic"
function addWordToTocflTopic() {
  const lessonWords = vocabularyData[currentLesson] || [];
  if (!lessonWords.length) return;

  const word = lessonWords[currentCardIndex];

  // Tạo danh sách nếu chưa có
  vocabularyData["tocfl-topic"] = vocabularyData["tocfl-topic"] || [];

  // Kiểm tra trùng
  const exists = vocabularyData["tocfl-topic"].some(
    w => w.traditional === word.traditional && w.simplified === word.simplified
  );
  if (!exists) {
    // copy word và thêm flag
    vocabularyData["tocfl-topic"].push({ ...word, tocflTopicFlag: true });
    saveVocabularyData(vocabularyData);
    alert(`✔️ Đã thêm "${word.traditional}" vào tocfl-topic`);
  } else {
    alert(`⚠️ "${word.traditional}" đã có trong tocfl-topic`);
  }
}



// ===============================
// 📌 CÁC HÀM CRUD VỚI VOCABULARY
// ===============================

// Thêm từ mới vào 1 lesson
function addWord(lessonId, newWord) {
  if (!vocabularyData[lessonId]) {
    vocabularyData[lessonId] = [];
  }
  vocabularyData[lessonId].push(newWord);

  saveVocabularyData(vocabularyData).then(() => {
    console.log(`✅ Đã thêm từ vào ${lessonId}`);
    location.reload();
  });
}

// Chỉnh sửa từ trong 1 lesson
function editWord(lessonId, wordIndex, updatedWord) {
  if (vocabularyData[lessonId] && vocabularyData[lessonId][wordIndex]) {
    vocabularyData[lessonId][wordIndex] = updatedWord;

    saveVocabularyData(vocabularyData).then(() => {
      console.log(`✏️ Đã chỉnh sửa từ trong ${lessonId}`);
      location.reload();
    });
  }
}

// Xóa từ trong 1 lesson
function deleteWord(lessonId, wordIndex) {
  if (vocabularyData[lessonId]) {
    vocabularyData[lessonId].splice(wordIndex, 1);

    saveVocabularyData(vocabularyData).then(() => {
      console.log(`🗑️ Đã xóa từ khỏi ${lessonId}`);
      location.reload();
    });
  }
}



// ===============================

// 📌 Lưu dữ liệu xuống server JSON
// Hàm lưu dữ liệu từ client lên server
async function saveVocabularyData(data) {
  try {
    const response = await fetch("/api/vocabulary", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error("❌ Không thể lưu dữ liệu lên server");

    const result = await response.json();
    console.log("✔️ Dữ liệu đã lưu thành công:", result.message);
  } catch (err) {
    console.error("❌ Lỗi saveVocabularyData:", err);
  }
}


 
// ✅ Bắt đầu chế độ ôn tập khi nhấn nút Ôn tập
// ========================================
// ÔN TẬP + COPY NHANH
// ========================================

// ✅ Bắt đầu chế độ ôn tập khi nhấn nút Ôn tập
document.getElementById("reviewBtn").addEventListener("click", () => {

    const lessonWords = vocabularyData[currentLesson] || [];

    // Chỉ lấy những từ đã được đánh dấu cần ôn
    reviewCards = lessonWords.filter(word => word.needReview);

    if (!reviewCards.length) {
        alert("⚠️ Không có từ nào được đánh dấu trong bài này.");
        return;
    }

    reviewingMode = "single";   // ✅ gắn chế độ rõ ràng
    reviewCardIndex = 0;
    showFront = true;

    document.getElementById("reviewBtn").style.display = "none";
    document.getElementById("exitReviewBtn").style.display = "inline-block";

    updateReviewCard();
});


// ========================================
// 📋 COPY NHANH
// ========================================

document.getElementById("copyReviewBtn").addEventListener("click", async () => {

    const lessonWords = vocabularyData[currentLesson] || [];

    // Chỉ lấy những từ đã được đánh dấu
    const wordsToCopy = lessonWords.filter(word => word.needReview);

    if (!wordsToCopy.length) {
        alert("⚠️ Không có từ nào được đánh dấu trong bài này.");
        return;
    }

    // Chỉ lấy Hán tự Phồn thể
    const text = wordsToCopy
        .map(word => word.traditional || word.simplified || "")
        .filter(word => word)
        .join("\n");

    try {

        // Copy vào clipboard
        await navigator.clipboard.writeText(text);

        alert(`✅ Đã copy ${wordsToCopy.length} từ!`);

    } catch (error) {

        // ========================================
        // FALLBACK NẾU CLIPBOARD API KHÔNG HOẠT ĐỘNG
        // ========================================

        const textarea = document.createElement("textarea");

        textarea.value = text;

        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";

        document.body.appendChild(textarea);

        textarea.focus();
        textarea.select();

        try {

            document.execCommand("copy");

            alert(`✅ Đã copy ${wordsToCopy.length} từ!`);

        } catch (copyError) {

            alert("❌ Không thể tự động copy.");

            console.error("Copy lỗi:", copyError);
        }

        textarea.remove();
    }
});

// ✅ Thoát chế độ ôn tập
document.getElementById("exitReviewBtn").addEventListener("click", () => {
  reviewingMode = null;
  reviewCards = [];
  reviewCardIndex = 0;
  showFront = true;

  updateCard();
  resetControls(); // 👉 đảm bảo về trạng thái ban đầu
});






function toggleNoteArea() {
  document.getElementById("note-area").classList.toggle("minimize");
}

document.getElementById("add-note-btn").addEventListener("click", () => {
  const noteList = document.getElementById("note-list");
  const li = document.createElement("li");

  // input note text
  const span = document.createElement("span");
  span.className = "note-text";
  span.textContent = "📝 Ghi chú mới";

  // action buttons
  const actions = document.createElement("div");
  actions.className = "note-actions";

  const editBtn = document.createElement("button");
  editBtn.textContent = "✏️";
  editBtn.onclick = () => {
    const newText = prompt("Chỉnh sửa ghi chú:", span.textContent);
    if (newText !== null) span.textContent = newText;
  };

  const delBtn = document.createElement("button");
  delBtn.textContent = "🗑️";
  delBtn.onclick = () => {
    if (confirm("Xóa ghi chú này?")) li.remove();
  };

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  li.appendChild(span);
  li.appendChild(actions);
  noteList.appendChild(li);
});


// =======================
// 🎧 TONE TRAINER
// =======================
let toneExamples = {}; // sẽ load từ server

// 🔄 Load dữ liệu ban đầu từ server
async function loadToneExamples() {
  try {
    const res = await fetch("/api/vocabulary");
    const data = await res.json();
    toneExamples = data.toneExamples || {};
    console.log("✅ Đã load toneExamples:", toneExamples);
  } catch (err) {
    console.error("❌ Lỗi load toneExamples:", err);
  }
}

// 🎧 Khởi động tone trainer
function initToneTrainer() {
  const toneInput = document.getElementById("toneInput");
  const spans = [
    document.getElementById("tone1"),
    document.getElementById("tone2"),
    document.getElementById("tone3"),
    document.getElementById("tone4")
  ];

  toneInput.addEventListener("keyup", async (e) => {
    if (e.key !== "Enter") return;

    const raw = toneInput.value.trim().toLowerCase();
    if (!raw) return;

    const base = removeToneMarks(raw);

    // 🔢 Tạo 4 pinyin có dấu
    const tonePinyins = [
      convertNumberedPinyinToMarked(base + "1"),
      convertNumberedPinyinToMarked(base + "2"),
      convertNumberedPinyinToMarked(base + "3"),
      convertNumberedPinyinToMarked(base + "4"),
    ];

    spans.forEach((span, i) => span.textContent = tonePinyins[i] || "-");

    // 📖 Nếu có Hán tự trong dữ liệu thì đọc
    if (toneExamples[base]) {
      const chars = toneExamples[base];
      
      if (toneExamples[base]) {
  const chars = toneExamples[base];
  await readChineseWithHighlight(chars, tonePinyins, spans);
}
    } else {
      const add = confirm(`❌ Chưa có ví dụ cho "${base}". Bạn có muốn thêm không?`);
      if (add) {
        const charsInput = prompt("Nhập 4 Hán tự cách nhau bằng khoảng trắng:");
        if (!charsInput) return;
        const parts = charsInput.trim().split(/\s+/);
        if (parts.length !== 4) {
          alert("⚠️ Cần nhập đúng 4 Hán tự.");
          return;
        }

        // 📤 Gửi lên server
        fetch("/addToneExample", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinyin: base, chars: parts })
        })
        .then(res => res.json())
        .then(data => {
          console.log("✅ Đã lưu:", data);
          // 🔄 Đồng bộ lại toneExamples từ server
          return fetch("/api/vocabulary");
        })
        .then(res => res.json())
        .then(newData => {
          if (newData.toneExamples) {
            toneExamples = newData.toneExamples;
            console.log("🔄 Đồng bộ lại toneExamples:", toneExamples);
            readChinese(parts.join(" "));
          }
        })
        .catch(err => console.error("❌ Lỗi khi lưu:", err));
      }
    }
  });
}


async function readChineseWithHighlight(chars, pinyins, spans) {
  for (let i = 0; i < chars.length; i++) {
    // reset highlight
    spans.forEach(span => span.style.background = "");
    spans[i].style.background = "yellow";

    const utterance = new SpeechSynthesisUtterance(chars[i]);
    const voice = getZhVoice();
    if (voice) utterance.voice = voice;

    utterance.rate = 0.6; // đọc chậm cho dễ nghe

    console.log(`🔊 Đang đọc: ${chars[i]} (${pinyins[i]}) bằng ${voice?.name}`);

    // chờ utterance đọc xong
    await new Promise(resolve => {
      utterance.onend = () => resolve();
      speechSynthesis.speak(utterance);
    });

    // nghỉ 0.4s giữa các chữ
    await new Promise(r => setTimeout(r, 400));
  }

  // clear highlight sau khi đọc xong
  spans.forEach(span => span.style.background = "");
}




function getZhVoice() {
  const voices = speechSynthesis.getVoices();

  // Ưu tiên Google 普通话
  let voice = voices.find(v => v.name.includes("Google") && v.lang === "zh-CN");

  // Nếu không có thì lấy bất kỳ voice zh nào
  if (!voice) {
    voice = voices.find(v => v.lang.startsWith("zh"));
  }

  return voice || null;
}




// 🔊 Đọc tiếng Trung
function readChinese(text) {
  console.log("🔊 Đang yêu cầu đọc:", text);

  const utterance = new SpeechSynthesisUtterance(text);
  const voice = getZhVoice();
  if (voice) {
    utterance.voice = voice;
    console.log("🎯 Đang dùng voice:", voice.name, voice.lang);
  } else {
    console.warn("⚠️ Không tìm thấy voice tiếng Trung, fallback mặc định!");
  }

  speechSynthesis.speak(utterance);
}


// 🚀 Khởi động khi DOM sẵn sàng
window.addEventListener("DOMContentLoaded", async () => {
  await loadToneExamples();
  initToneTrainer();
});



// Hàm để lấy icon dựa trên phiên âm
function getPinyinIcons(pinyin) {
  if (!pinyin) return '';

  const cleanPinyin = pinyin.trim().toLowerCase();
  let icons = '';

  // Danh sách các âm cần bật hơi
  const aspiratedConsonants = ['p', 'f', 't', 'k', 'q', 'c', 'ch'];
  // Danh sách các âm cần cong lưỡi
  const retroflexConsonants = ['zh', 'ch', 'sh', 'r'];

  // Thêm icon bật hơi nếu pinyin bắt đầu bằng một trong các âm này
  if (aspiratedConsonants.some(char => cleanPinyin.startsWith(char))) {
    icons += '🌬️';
  }

  // Thêm icon cong lưỡi nếu pinyin bắt đầu bằng một trong các âm này
  if (retroflexConsonants.some(char => cleanPinyin.startsWith(char))) {
    icons += '🌊';
  }

  return icons;
}









// ✅ Gom toàn bộ từ đã đánh dấu từ tất cả các bài
function isMarked(word) {
  const v = word && word.needReview;
  return v === true || v === "true" || v === 1 || v === "1";
}

function collectMarkedFromAllLessons(data) {
  const result = [];

  for (const lesson of Object.values(data)) {
    let words = [];

    if (Array.isArray(lesson)) {
      words = lesson;                // dạng mảng trực tiếp
    } else if (lesson && Array.isArray(lesson.words)) {
      words = lesson.words;          // dạng object có .words
    }

    if (words.length) {
      const markedWords = words.filter(isMarked);
      result.push(...markedWords);
    }
  }

  // 👉 Xuất ra console để kiểm tra
  window.allMarked = result;
  console.log("Danh sách từ được đánh dấu từ tất cả bài:", result);

  return result;
}


document.getElementById("reviewAllBtn").addEventListener("click", () => {
  let allWords = [];

  for (const lesson of Object.values(vocabularyData)) {
    if (Array.isArray(lesson)) {
      allWords = allWords.concat(lesson);
    } else if (lesson && Array.isArray(lesson.words)) {
      allWords = allWords.concat(lesson.words);
    }
  }

  // 👉 log toàn bộ danh sách trước khi lọc
  console.log("📌 Toàn bộ từ gom lại từ tất cả bài:", allWords);

  reviewCards = allWords.filter(word => word.needReview);

  // 👉 log lại sau khi lọc
  console.log("✅ Danh sách từ được đánh dấu:", reviewCards);

  if (!reviewCards.length) {
    alert("⚠️ Không có từ nào được đánh dấu trong toàn bộ danh sách.");
    return;
  }

  reviewingMode = "all";
  reviewCardIndex = 0;
  showFront = true;

  document.getElementById("reviewBtn").style.display = "none";
  document.getElementById("reviewAllBtn").style.display = "none";
  document.getElementById("exitReviewBtn").style.display = "inline-block";

  updateReviewCard();
});




function resetControls() {
  reviewBtn.style.display = "inline-block";   // hiện Ôn tập
  reviewAllBtn.style.display = "none";        // ẩn Ôn tập All
  exitReviewBtn.style.display = "none";       // ẩn Thoát
  exitSummaryBtn.style.display = "none";      // ẩn Thoát tổng hợp
}

exitReviewBtn.addEventListener("click", () => {
  reviewingMode = false;
  reviewCards = [];
  reviewCardIndex = 0;
  updateCard();

  resetControls();
});

// ✅ Khi nhấn Bắt đầu ôn tập tổng hợp
// startSummaryBtn.addEventListener("click", () => {
//   reviewBtn.style.display = "none";
//   reviewAllBtn.style.display = "inline-block";
//   exitSummaryBtn.style.display = "inline-block";
//   exitReviewBtn.style.display = "none";
// });


// ✅ Khi nhấn Thoát tổng hợp
exitReviewBtn.addEventListener("click", () => {
  reviewingMode = null;   // ✅ thoát khỏi mọi chế độ
  reviewCards = [];
  reviewCardIndex = 0;
  showFront = true;

  updateCard();
  resetControls();
});

// 👉 Gọi reset 1 lần khi load
resetControls();






function resetControls() {
  document.getElementById("reviewBtn").style.display = "inline-block";   // hiện Ôn tập
  document.getElementById("reviewAllBtn").style.display = "inline-block"; // hiện Ôn tập All
  document.getElementById("exitReviewBtn").style.display = "none";       // ẩn Thoát
}






function normalizeHan(str) {
    return (str || "")
        .replace(/\s+/g, "")   // bỏ tất cả khoảng trắng
        .trim();
}
async function optimizeVocabularyData() {
  let addedNotes = 0;

  // Lấy danh sách tất cả từ kèm vị trí
  let allWords = [];
  for (let lessonKey of Object.keys(vocabularyData)) {
    let words = vocabularyData[lessonKey];
    if (!Array.isArray(words)) continue; // ✅ bỏ qua nếu không phải mảng

    words.forEach((w, idx) => {
      allWords.push({ ...w, lessonKey, idx });
    });
  }

  // Duyệt từ cuối lên
  for (let i = allWords.length - 1; i >= 0; i--) {
    let word = allWords[i];
    if (word.note) continue; // đã có note thì bỏ qua

    let targetHan = normalizeHan(word.traditional || word.simplified);

    // Tìm note gần nhất ở phía trước
    for (let j = i - 1; j >= 0; j--) {
      let candidate = allWords[j];
      let candidateHan = normalizeHan(candidate.traditional || candidate.simplified);

      if (targetHan && candidateHan && targetHan === candidateHan && candidate.note) {
        // Copy note
        vocabularyData[word.lessonKey][word.idx].note = candidate.note;
        addedNotes++;
        break;
      }
    }
  }

  if (addedNotes > 0) {
    await saveVocabularyData(vocabularyData);
    alert(`✅ Đã tối ưu dữ liệu: thêm ${addedNotes} ghi chú.`);
  } else {
    alert("ℹ️ Không có ghi chú nào cần bổ sung.");
  }
}


document.getElementById("optimizeDataBtn").addEventListener("click", optimizeVocabularyData);




// xóa từ hiện tại 
// -----------------------------
// XÓA TỪ HIỆN TẠI (không refresh UI ngay)
async function deleteCurrentWord() {
  const lessonWords = vocabularyData[currentLesson] || [];
  if (!lessonWords.length) {
    alert("❌ Không có từ để xoá.");
    return;
  }

  const word = lessonWords[currentCardIndex];
  if (!word) {
    alert("⚠️ Không tìm thấy từ hiện tại.");
    return;
  }

  // Xác nhận xoá
  const confirmDelete = confirm(
    `Bạn có chắc muốn xoá từ: "${word.traditional || word.simplified}" (${word.hanViet || ""}) ?`
  );
  if (!confirmDelete) return;

  // Thực hiện xoá
  lessonWords.splice(currentCardIndex, 1);

  // Lùi con trỏ về từ trước (nếu có)
  if (currentCardIndex > 0) {
    currentCardIndex--;
  }

  // Lưu lại dữ liệu
  await saveVocabularyData(vocabularyData);

  // Cập nhật giao diện flashcard
  if (lessonWords.length > 0) {
    updateCard(); // hoặc updateLessonView() nếu bạn dùng hàm đó
  } else {
    alert("📭 Đã xoá hết từ trong bài này!");
  }

  alert("✅ Đã xoá từ thành công!");
}


// Gắn sự kiện cho nút (nếu nút đã có id delete-current-word-btn trong index.html)
const delBtn = document.getElementById("delete-current-word-btn");
if (delBtn) {
  delBtn.addEventListener("click", deleteCurrentWord);
}




document.getElementById("delete-current-word-btn").addEventListener("click", deleteCurrentWord);







function comparePinyinSyllableBySyllable(input, expected) {
  const inputParts = splitPinyin(input.toLowerCase().trim());
  const expectedParts = splitPinyin(expected.toLowerCase().trim());

  const errors = [];

  for (let i = 0; i < Math.max(inputParts.length, expectedParts.length); i++) {
    const inp = inputParts[i] || "";
    const exp = expectedParts[i] || "";

    if (normalizePinyin(inp) !== normalizePinyin(exp)) {
      errors.push({ index: i, input: inp, expected: exp });
    }
  }

  return errors; // nếu rỗng nghĩa là đúng, còn nếu có phần tử thì đó là các lỗi
}







// so sánh từ vựng 
// ======================================================
// Ô SO SÁNH CHỮ HÁN
// ======================================================

document.addEventListener("DOMContentLoaded", () => {

    // --------------------------------------------------
    // Tạo nút bật / tắt
    // --------------------------------------------------

    const compareToggleBtn = document.createElement("button");

    compareToggleBtn.id = "hanzi-compare-toggle";
    compareToggleBtn.textContent = "🔍 So sánh chữ";

    Object.assign(compareToggleBtn.style, {
        position: "fixed",
        right: "20px",
        top: "250px",
        zIndex: "9999",
        padding: "8px 14px",
        border: "none",
        borderRadius: "5px",
        background: "#2196F3",
        color: "#fff",
        cursor: "pointer",
        fontSize: "14px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
    });

    document.body.appendChild(compareToggleBtn);


    // --------------------------------------------------
    // Tạo khung so sánh
    // --------------------------------------------------

    const compareBox = document.createElement("div");

    compareBox.id = "hanzi-compare-box";

    Object.assign(compareBox.style, {
        position: "fixed",
        right: "20px",
        top: "295px",
        width: "400px",
        minHeight: "300px",
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: "8px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
        zIndex: "9998",
        padding: "15px",
        boxSizing: "border-box",
        display: "none"
    });


    // --------------------------------------------------
    // Tiêu đề
    // --------------------------------------------------

    const title = document.createElement("div");

    title.textContent = "Ô SO SÁNH CHỮ HÁN";

    Object.assign(title.style, {
        fontSize: "16px",
        fontWeight: "bold",
        marginBottom: "10px",
        color: "#444",
        textAlign: "center"
    });

    compareBox.appendChild(title);


    // --------------------------------------------------
    // Input
    // --------------------------------------------------

    const compareInput = document.createElement("input");

    compareInput.type = "text";
    compareInput.id = "hanzi-compare-input";
    compareInput.placeholder = "Nhập chữ cần so sánh...";

    Object.assign(compareInput.style, {
        width: "100%",
        height: "42px",
        padding: "8px 10px",
        boxSizing: "border-box",
        border: "1px solid #ccc",
        borderRadius: "5px",
        fontSize: "18px",
        outline: "none"
    });

    compareBox.appendChild(compareInput);


    // --------------------------------------------------
    // Khu vực hiển thị chữ
    // --------------------------------------------------

    const compareDisplay = document.createElement("div");

    compareDisplay.id = "hanzi-compare-display";

    Object.assign(compareDisplay.style, {
        width: "100%",
        minHeight: "190px",
        marginTop: "15px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "15px",
        overflowY: "auto",
        boxSizing: "border-box"
    });

    compareBox.appendChild(compareDisplay);


    // --------------------------------------------------
    // Nút Xóa
    // --------------------------------------------------

    const clearBtn = document.createElement("button");

    clearBtn.textContent = "✕ Xóa";

    Object.assign(clearBtn.style, {
        display: "block",
        margin: "10px auto 0",
        padding: "6px 18px",
        border: "none",
        borderRadius: "5px",
        background: "#f44336",
        color: "#fff",
        cursor: "pointer",
        fontSize: "14px"
    });

    compareBox.appendChild(clearBtn);


    // --------------------------------------------------
    // Đưa khung vào trang
    // --------------------------------------------------

    document.body.appendChild(compareBox);


    // --------------------------------------------------
    // Nhập chữ → hiển thị ngay lập tức
    // --------------------------------------------------

    compareInput.addEventListener("input", () => {

        const text = compareInput.value;

        compareDisplay.innerHTML = "";

        if (!text.trim()) {
            return;
        }

        // Mỗi ký tự được hiển thị riêng
        [...text].forEach(char => {

            const charElement = document.createElement("span");

            charElement.textContent = char;

            Object.assign(charElement.style, {
                fontSize: "110px",
                lineHeight: "1.1",
                fontFamily: "Arial, 'Noto Sans TC', 'Microsoft JhengHei', sans-serif",
                fontWeight: "normal",
                color: "#000",
                display: "inline-block",
                textAlign: "center"
            });

            compareDisplay.appendChild(charElement);
        });
    });


    // --------------------------------------------------
    // Nút Xóa
    // --------------------------------------------------

    clearBtn.addEventListener("click", () => {

        compareInput.value = "";
        compareDisplay.innerHTML = "";

        compareInput.focus();
    });


    // --------------------------------------------------
    // Bật / tắt khung
    // --------------------------------------------------

    compareToggleBtn.addEventListener("click", () => {

        if (compareBox.style.display === "none") {

            compareBox.style.display = "block";
            compareToggleBtn.textContent = "✕ Đóng so sánh";

        } else {

            compareBox.style.display = "none";
            compareToggleBtn.textContent = "🔍 So sánh chữ";
        }
    });

});

// 📌 Sắp xếp theo Hán tự (chỉ lấy ký tự đầu tiên)
function sortByHanCharacter() {
  if (!vocabularyData[currentLesson]) return;

  // Hàm lấy ký tự đầu tiên (ưu tiên traditional)
  const getFirstChar = (word) => {
    const text = word.traditional || word.simplified || "";
    return text.trim().charAt(0) || "";
  };

  // Sắp xếp ổn định theo ký tự đầu tiên
  vocabularyData[currentLesson].sort((a, b) => {
    const charA = getFirstChar(a);
    const charB = getFirstChar(b);
    return charA.localeCompare(charB, "zh-Hans");
  });

  // Lưu lại JSON chỉ cho lesson hiện tại
  saveVocabularyData(vocabularyData);

  // Render lại UI
  updateLessonView();

  alert(`✅ Đã sắp xếp theo Hán tự và lưu cho bài học: ${currentLesson}`);
}

// Gắn sự kiện cho nút
document.getElementById("sortByHanBtn").addEventListener("click", sortByHanCharacter);


window.addEventListener('DOMContentLoaded', () => {
  if (typeof renderQuickLinks === 'function') renderQuickLinks();
});


document.getElementById("ttsSpeak").addEventListener("click", async () => {
  const text = document.getElementById("ttsInput").value.trim();
  if (!text) return;

  // 1) đọc tiếng Trung
  speakChinese(text);

  // 2) tạo pinyin
  const pinyin = window.pinyinPro.pinyin(text, {
    toneType: 'tone-mark'
  });
  document.getElementById("ttsPinyin").innerText = pinyin;

  // 3) dịch sang tiếng Việt
  try {
   const res = await fetch("https://translate.argosopentech.com/translate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    q: text,
    source: "zh",
    target: "vi",
    format: "text"
  })
});

    const data = await res.json();
    document.getElementById("ttsVietnamese").innerText = data.translatedText;
  } catch (e) {
    document.getElementById("ttsVietnamese").innerText = "⚠️ Không dịch được (mất mạng hoặc server bận)";
  }
});


