const gTTS = require("gtts");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

function splitText(input) {
  return input
    .split(".")
    .map(s => s.trim())
    .filter(Boolean)
 .map(p => {
  const [cn, vi] = p.split("-").map(s => s?.trim() || "");
  return { cn, vi }; // 🔥 THIẾU DÒNG NÀY
});

}

function createTTS(text, lang, file) {
  return new Promise((resolve, reject) => {
    const tts = new gTTS(text, lang);
    tts.save(file, err => {
      if (err) reject(err);
      else resolve();
    });
  });
}


async function generateAudio(input, outputFile) {
  const pairs = splitText(input);

  let files = [];

  for (let i = 0; i < pairs.length; i++) {
    const { cn, vi } = pairs[i];

    const cnFile = `cn_${i}.mp3`;
    const viFile = `vi_${i}.mp3`;

    await createTTS(cn, "zh-cn", cnFile);
    await createTTS(vi, "vi", viFile);

    files.push(cnFile, viFile);
  }

  return new Promise((resolve, reject) => {
    let command = ffmpeg();

    files.forEach(f => command.input(f));

const speed =2.0// 👉 chỉnh tốc độ tại đây (1.0 = bình thường)

command
  .audioFilters(`atempo=${speed}`)
  .on("end", () => resolve(outputFile))
  .on("error", reject)
  .mergeToFile(outputFile);
  });
}

module.exports = { generateAudio };