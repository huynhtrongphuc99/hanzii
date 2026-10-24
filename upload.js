const fs = require('fs');

const lessonFile = './lesson2.json';
const apiUrl = 'http://localhost:3000/api/vocabulary/lesson2';

(async () => {
  try {
    const raw = fs.readFileSync(lessonFile, 'utf8');
    const words = JSON.parse(raw);

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(words)
    });

    const result = await res.json();
    console.log("✅ Upload thành công:", result);
  } catch (err) {
    console.error("❌ Lỗi upload:", err.message);
  }
})();
