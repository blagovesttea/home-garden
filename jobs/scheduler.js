require("dotenv").config();
const cron = require("node-cron");
const { spawn } = require("child_process");

/**
 * Стартира node скрипт и чака да приключи
 */
function runScript(scriptPath) {
  return new Promise((resolve) => {
    console.log(`▶️ Running ${scriptPath} ...`);

    const p = spawn(process.execPath, [scriptPath], {
      stdio: "inherit",
      shell: true,
    });

    p.on("close", (code) => {
      console.log(`✅ ${scriptPath} finished with code:`, code);
      resolve(code);
    });
  });
}

/**
 * Pipeline:
 * 1) runBot.js
 * 2) bgCheck.js
 */
async function runAll() {
  console.log("⏱️ Scheduler cycle started");

  await runScript("jobs/runBot.js");
  await runScript("jobs/bgCheck.js");

  console.log("🎯 Scheduler cycle completed");
}

// 🔥 Стартира веднага при пускане
runAll();

// 🕘 Всеки ден в 09:00
cron.schedule("0 9 * * *", runAll);

console.log("✅ Scheduler started.");
console.log("🚀 First run executed immediately.");
console.log("🕘 Next runs: every day at 09:00.");
