/**
 * EcoSmart Feeder — ML API Tunnel Starter
 * =========================================
 * Script ini:
 *   1. Jalankan ML API Flask (python ml/api.py)
 *   2. Buka ngrok tunnel ke port 5001
 *   3. Ambil URL ngrok yang baru
 *   4. Update ML_API_URL di Render otomatis
 *   5. Trigger redeploy backend Render
 *
 * Jalankan SEKALI sebelum presentasi:
 *   node scripts/start-ml-tunnel.js
 */

const { spawn, execSync } = require("child_process");
const path = require("path");
const https = require("https");
const http = require("http");

// ── Konfigurasi ───────────────────────────────────────────────────────────────
const CONFIG = {
  RENDER_SERVICE_ID: "srv-d8d79umk1jcs738martg",
  RENDER_API_KEY: "rnd_z66138B9DDHTMloPSIrO4y5LCbGp",
  ML_PORT: 5001,
  ML_DIR: path.join(__dirname, "..", "ml"),
  NGROK_WAIT_MS: 3000, // tunggu ngrok siap
};

// ── Helper: HTTP request ──────────────────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      })
      .on("error", reject);
  });
}

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Step 1: Jalankan ML API ───────────────────────────────────────────────────
function startMLApi() {
  console.log("\n🐍 Menjalankan ML API Flask...");

  // Di Windows dengan pyenv, python adalah .bat file
  // Perlu spawn via cmd untuk resolve dengan benar
  const isWindows = process.platform === "win32";
  const ml = isWindows
    ? spawn("cmd", ["/c", "python", "api.py"], {
        cwd: CONFIG.ML_DIR,
        stdio: ["ignore", "pipe", "pipe"],
      })
    : spawn("python", ["api.py"], {
        cwd: CONFIG.ML_DIR,
        stdio: ["ignore", "pipe", "pipe"],
      });

  ml.stdout.on("data", (d) => process.stdout.write(`   [Flask] ${d}`));
  ml.stderr.on("data", (d) => process.stdout.write(`   [Flask] ${d}`));
  ml.on("close", (code) => {
    if (code !== 0) console.log(`\n❌ ML API berhenti dengan kode ${code}`);
  });

  console.log(`   PID: ${ml.pid}`);
  return ml;
}

// ── Step 2: Jalankan ngrok ────────────────────────────────────────────────────
function startNgrok() {
  console.log("\n🚇 Menjalankan ngrok tunnel...");
  const isWindows = process.platform === "win32";
  const ng = isWindows
    ? spawn("cmd", ["/c", "ngrok", "http", String(CONFIG.ML_PORT)], {
        stdio: ["ignore", "pipe", "pipe"],
      })
    : spawn("ngrok", ["http", String(CONFIG.ML_PORT)], {
        stdio: ["ignore", "pipe", "pipe"],
      });

  ng.stdout.on("data", (d) => process.stdout.write(`   [ngrok] ${d}`));
  ng.stderr.on("data", (d) => process.stdout.write(`   [ngrok] ${d}`));

  console.log(`   PID: ${ng.pid}`);
  return ng;
}

// ── Step 3: Ambil URL ngrok dari API lokal ────────────────────────────────────
async function getNgrokUrl(retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      const data = await httpGet("http://localhost:4040/api/tunnels");
      const tunnels = data.tunnels ?? [];
      const httpsTunnel = tunnels.find((t) =>
        t.public_url?.startsWith("https"),
      );
      if (httpsTunnel) return httpsTunnel.public_url;
    } catch {}
    await new Promise((r) => setTimeout(r, 1500));
    console.log(`   Menunggu ngrok siap... (${i + 1}/${retries})`);
  }
  throw new Error("ngrok tidak bisa diakses setelah beberapa percobaan");
}

// ── Step 4: Update ML_API_URL di Render ───────────────────────────────────────
async function updateRenderEnv(ngrokUrl) {
  console.log(`\n🔄 Mengupdate ML_API_URL di Render → ${ngrokUrl}`);

  // Ambil env vars yang ada sekarang
  const getRes = await httpsRequest({
    hostname: "api.render.com",
    path: `/v1/services/${CONFIG.RENDER_SERVICE_ID}/env-vars`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${CONFIG.RENDER_API_KEY}`,
      Accept: "application/json",
    },
  });

  if (getRes.status !== 200) {
    throw new Error(
      `Gagal ambil env vars Render: ${getRes.status} ${JSON.stringify(getRes.body)}`,
    );
  }

  // Susun env vars baru — update ML_API_URL, pertahankan yang lain
  const existing = getRes.body ?? [];
  const updated = existing.map((e) => ({
    key: e.envVar?.key ?? e.key,
    value: e.envVar?.value ?? e.value,
  }));

  const idx = updated.findIndex((e) => e.key === "ML_API_URL");
  if (idx >= 0) {
    updated[idx].value = ngrokUrl;
  } else {
    updated.push({ key: "ML_API_URL", value: ngrokUrl });
  }

  // PUT env vars baru
  const putRes = await httpsRequest(
    {
      hostname: "api.render.com",
      path: `/v1/services/${CONFIG.RENDER_SERVICE_ID}/env-vars`,
      method: "PUT",
      headers: {
        Authorization: `Bearer ${CONFIG.RENDER_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    },
    updated,
  );

  if (putRes.status !== 200) {
    throw new Error(
      `Gagal update env vars: ${putRes.status} ${JSON.stringify(putRes.body)}`,
    );
  }

  console.log("   ✅ ML_API_URL berhasil diupdate");
}

// ── Step 5: Trigger redeploy Render ──────────────────────────────────────────
async function triggerRedeploy() {
  console.log("\n🚀 Trigger redeploy backend Render...");

  const res = await httpsRequest(
    {
      hostname: "api.render.com",
      path: `/v1/services/${CONFIG.RENDER_SERVICE_ID}/deploys`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONFIG.RENDER_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    },
    { clearCache: "do_not_clear" },
  );

  if (res.status === 201) {
    console.log("   ✅ Redeploy berhasil di-trigger");
    console.log("   ⏳ Backend akan siap dalam ~2-3 menit");
  } else {
    console.log(`   ⚠️  Status: ${res.status} — ${JSON.stringify(res.body)}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║   EcoSmart ML Tunnel Starter           ║");
  console.log("╚════════════════════════════════════════╝");

  // Jalankan ML API dan ngrok
  const mlProcess = startMLApi();
  await new Promise((r) => setTimeout(r, 2000)); // beri waktu Flask startup
  const ngrokProcess = startNgrok();
  await new Promise((r) => setTimeout(r, CONFIG.NGROK_WAIT_MS));

  try {
    // Ambil URL ngrok
    const ngrokUrl = await getNgrokUrl();
    console.log(`\n✅ ngrok URL: ${ngrokUrl}`);

    // Update Render dan trigger redeploy
    await updateRenderEnv(ngrokUrl);
    await triggerRedeploy();

    console.log("\n══════════════════════════════════════════");
    console.log("✅ Semua siap! Ringkasan:");
    console.log(`   ML API  : http://localhost:${CONFIG.ML_PORT}`);
    console.log(`   ngrok   : ${ngrokUrl}`);
    console.log(`   Render  : https://rpl-kelompok-12.onrender.com`);
    console.log("\n⚠️  Jangan tutup terminal ini selama presentasi!");
    console.log("   Tekan Ctrl+C untuk berhenti.\n");
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    mlProcess.kill();
    ngrokProcess.kill();
    process.exit(1);
  }

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    console.log("\n\n🛑 Menghentikan ML API dan ngrok...");
    mlProcess.kill();
    ngrokProcess.kill();
    process.exit(0);
  });
}

main();
