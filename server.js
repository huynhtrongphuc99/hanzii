const express = require("express");
const fs = require("fs");
const cors = require("cors");
const path = require("path");
const { generateAudio } = require("./tts"); // 🔥 QUAN TRỌNG

const app = express();
const PORT = 3000;
const dataFile = path.join(__dirname, "vocabularyData.json");

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files (HTML, JS...)
app.use(express.static(__dirname));

// ================= DATA =================

const readData = () => {
  if (fs.existsSync(dataFile)) {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  }
  return {};
};

const writeData = (data) => {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), "utf8");
};

// ================= API =================

// GET all data
app.get("/api/vocabulary", (req, res) => {
  res.json(readData());
});

// UPDATE all data
app.put("/api/vocabulary", (req, res) => {
  try {
    const updatedData = req.body;

    const dataSize =
      Buffer.byteLength(JSON.stringify(updatedData), "utf8") / 1024;

    console.log(`📦 Nhận dữ liệu ~ ${dataSize.toFixed(2)} KB`);

    writeData(updatedData);

    res.status(200).send({ message: "✅ Data updated successfully!" });
  } catch (err) {
    console.error("❌ Error saving data:", err);
    res.status(500).send({ message: "Failed to save data." });
  }
});

// ADD tone example
app.post("/addToneExample", (req, res) => {
  try {
    const { pinyin, chars } = req.body;

    if (!pinyin || !chars || chars.length !== 4) {
      return res.status(400).json({ error: "❌ Dữ liệu không hợp lệ" });
    }

    const data = readData();

    if (!data.toneExamples) data.toneExamples = {};

    data.toneExamples[pinyin] = chars;

    writeData(data);

    console.log(`✅ Đã thêm toneExample: ${pinyin} → ${chars.join(" ")}`);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Lỗi khi thêm toneExample:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================= TTS =================

app.post("/tts-multi", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).send("❌ No text provided");
    }

    console.log("📥 INPUT:", text);

    const file = path.join(__dirname, "final.mp3");

    await generateAudio(text, file);

    res.download(file);
  } catch (err) {
    console.error("❌ TTS ERROR:", err);
    res.status(500).send(err.message);
  }
});

// ================= START =================

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});