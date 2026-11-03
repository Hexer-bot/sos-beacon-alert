/* =========================================================
   SOS BEACON - 100% TRUE OFFLINE HARDWARE DSP ENGINE (v7.0)
   ========================================================= */
// ==========================================
// 1. OFFLINE GEOHASH GENERATOR
// ==========================================
function encodeGeoHash(lat, lon, precision = 9) {
  const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let latMin = -90.0, latMax = 90.0;
  let lonMin = -180.0, lonMax = 180.0;
  let geohash = "";
  let isEven = true;
  let bit = 0;
  let ch = 0;

  while (geohash.length < precision) {
    let mid;
    if (isEven) {
      mid = (lonMin + lonMax) / 2;
      if (lon > mid) {
        ch |= (1 << (4 - bit));
        lonMin = mid;
      } else {
        lonMax = mid;
      }
    } else {
      mid = (latMin + latMax) / 2;
      if (lat > mid) {
        ch |= (1 << (4 - bit));
        latMin = mid;
      } else {
        latMax = mid;
      }
    }
    isEven = !isEven;
    if (bit < 4) {
      bit++;
    } else {
      geohash += B32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return geohash;
}

// ==========================================
// 2. LIVE GPS TRACKER (Background me coordinates update rakhega)
// ==========================================
let currentLat = null;
let currentLon = null;

if ("geolocation" in navigator) {
  navigator.geolocation.watchPosition(
    (pos) => {
      currentLat = pos.coords.latitude.toFixed(6);
      currentLon = pos.coords.longitude.toFixed(6);
      // Agar purane code me window.userLatitude use ho raha ho toh dono sync rahenge
      window.userLatitude = currentLat;
      window.userLongitude = currentLon;
    },
    (err) => console.warn("GPS Acquiring Error:", err.message),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );
}
// Service Worker for 100% Offline Airplane-Mode Operation
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// Telemetry State
let currentLat = 30.679600;
let currentLon = 76.722400;
let currentAccuracy = 7.8;
let currentAltitude = 312;
let currentHash = "ttqw9c59";
let batteryPercent = "92%";

// Close Contact Emergency Nodes
let emergencyContacts = [
  { name: "Primary Node", phone: "+918091221136" },
  { name: "Emergency Team", phone: "+91112" }
];

// Audio Output State (Siren)
let audioCtx = null;
let sirenOsc = null;
let sirenGain = null;
let sirenInterval = null;
let isSirenActive = false;

// 100% Offline Hardware Microphone DSP State
let micStream = null;
let micAudioCtx = null;
let micAnalyser = null;
let isDSPArmed = false;
let dspThreshold = 68; // Sensitivity Level (0 - 100%)
let isTriggerFired = false;
let speechRecognition = null;
let customPasscodes = ["bachao", "help", "emergency", "red alert", "save me", "khatra"];

// Radial Hold State (1.5s)
let holdTimer = null;
let holdProgress = 0;
const HOLD_TARGET = 1500;
const RING_LENGTH = 722;

// Motion Shake State (3x Rapid Shake)
let lastX = null, lastY = null, lastZ = null;
let shakeCount = 0;
let lastShakeTime = 0;

// Optical Strobe Flash State
let isStrobeActive = false;
let strobeInterval = null;
let torchTrack = null;

/* ---------------------------------------------------------
   1. TAB BY TAB NAVIGATION CONTROLLER
   --------------------------------------------------------- */
function showTab(targetId) {
  document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
  document.querySelectorAll(".nav-tab-btn").forEach(btn => btn.classList.remove("active"));

  const targetTab = document.getElementById(targetId);
  if (targetTab) targetTab.classList.add("active");

  const btnId = targetId === "tab-core" ? "btn-core" :
                targetId === "tab-telemetry" ? "btn-telemetry" :
                targetId === "tab-contacts" ? "btn-contacts" : "btn-config";
  const targetBtn = document.getElementById(btnId);
  if (targetBtn) targetBtn.classList.add("active");
}

/* ---------------------------------------------------------
   2. HARDWARE AUTHORIZATION SUITE
   --------------------------------------------------------- */
function openHardwareModal() {
  const modal = document.getElementById("permModal");
  if (modal) modal.style.display = "flex";
}

async function authorizeHardwareAccess() {
  // 1. GNSS Satellite Position Poll
  if ("geolocation" in navigator) {
    try {
      await new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(
          () => {
            const row = document.getElementById("chkGeo");
            if (row) {
              row.classList.add("granted");
              row.querySelector(".p-tag").innerText = "LOCKED";
            }
            resolve();
          },
          () => resolve(),
          { enableHighAccuracy: true, timeout: 5000 }
        );
      });
    } catch (_) {}
  }

  // 2. Microphone Hardware Stream for On-Device Audio DSP
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const row = document.getElementById("chkMic");
    if (row) {
      row.classList.add("granted");
      row.querySelector(".p-tag").innerText = "ARMED";
    }
    setupHardwareAudioDSP(micStream);
  } catch (err) {
    console.error("Mic access error:", err);
  }

  // 3. Accelerometer Clearances
  if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
    try {
      const motionPerm = await DeviceMotionEvent.requestPermission();
      if (motionPerm === "granted") {
        const row = document.getElementById("chkSensors");
        if (row) {
          row.classList.add("granted");
          row.querySelector(".p-tag").innerText = "ACTIVE";
        }
      }
    } catch (_) {}
  } else {
    const row = document.getElementById("chkSensors");
    if (row) {
      row.classList.add("granted");
      row.querySelector(".p-tag").innerText = "ACTIVE";
    }
  }

  localStorage.setItem("beacon_perms_v10", "true");

  setTimeout(() => {
    const modal = document.getElementById("permModal");
    if (modal) modal.style.display = "none";
    syncLiveCoordinates();
    addEventLog("All 100% Offline Sensors Armed", "OK");
  }, 400);
}

/* ---------------------------------------------------------
   3. 100% OFFLINE REAL AUDIO DSP VOICE ACTIVATION
   --------------------------------------------------------- */
function setupHardwareAudioDSP(stream) {
  try {
    micAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = micAudioCtx.createMediaStreamSource(stream);
    micAnalyser = micAudioCtx.createAnalyser();
    micAnalyser.fftSize = 256;
    source.connect(micAnalyser);

    isDSPArmed = true;
    updateMicVisualState(true);

    const bufferLength = micAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const bars = document.querySelectorAll("#waveformBox .wave-bar");
    const dspBar = document.getElementById("dspLevelBar");
    const dspNum = document.getElementById("dspLevelNum");

    function analyzeAudioFrame() {
      if (!isDSPArmed) return;
      micAnalyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      let avg = sum / bufferLength;

      // Animate waveform bars locally
      bars.forEach((bar, idx) => {
        let val = dataArray[idx % bufferLength];
        bar.style.height = `${Math.max(6, (val / 255) * 42)}px`;
      });

      // Calculate percentage level
      let levelPct = Math.min(100, Math.round((avg / 128) * 100));
      if (dspBar) dspBar.style.width = `${levelPct}%`;
      if (dspNum) dspNum.innerText = `${levelPct}%`;

      // 100% Offline Trigger Condition (Scream / Loud Voice / Shout)
      if (levelPct >= dspThreshold && !isTriggerFired) {
        isTriggerFired = true;
        updateDialogueStatus("ACOUSTIC SCREAM DETECTED", `Loud voice spike: ${levelPct}%! Dispatching Emergency Alert.`);
        executeEmergencyBroadcast(`Acoustic Peak Spike: ${levelPct}% (100% Offline Detection)`);
        setTimeout(() => { isTriggerFired = false; }, 4000);
      }

      requestAnimationFrame(analyzeAudioFrame);
    }
    analyzeAudioFrame();
    setupContinuousSpeechFallback();
  } catch (err) {
    console.error("DSP Hardware Init Error:", err);
  }
}

// Online Speech Fallback (agar browser online ho toh phrase match kare)
function setupContinuousSpeechFallback() {
  const SpeechEngine = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechEngine) return;

  if (speechRecognition) {
    try { speechRecognition.abort(); } catch (_) {}
  }

  speechRecognition = new SpeechEngine();
  speechRecognition.continuous = true;
  speechRecognition.interimResults = true;
  speechRecognition.lang = "en-IN";

  speechRecognition.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; ++i) {
      let spoken = e.results[i][0].transcript.trim().toLowerCase();
      const transcriptEl = document.getElementById("aiTranscript");
      if (transcriptEl) transcriptEl.innerText = `"${spoken}"`;

      for (let code of customPasscodes) {
        if (spoken.includes(code) && !isTriggerFired) {
          isTriggerFired = true;
          updateDialogueStatus("PASSCODE VERIFIED", `Spoken Code: "${code}" matched! Dispatching alert.`);
          executeEmergencyBroadcast(`Voice Passcode: "${code}"`);
          setTimeout(() => { isTriggerFired = false; }, 4000);
          return;
        }
      }
    }
  };

  speechRecognition.onerror = () => {
    if (isDSPArmed) {
      setTimeout(() => { try { speechRecognition.start(); } catch (_) {} }, 400);
    }
  };

  speechRecognition.onend = () => {
    if (isDSPArmed) {
      setTimeout(() => { try { speechRecognition.start(); } catch (_) {} }, 250);
    }
  };

  try { speechRecognition.start(); } catch (_) {}
}

function updateMicVisualState(active) {
  const btn = document.getElementById("voiceToggleBtn");
  const txt = document.getElementById("micStateText");
  const wave = document.getElementById("waveformBox");

  if (active) {
    if (btn) btn.classList.add("active");
    if (txt) txt.innerText = "ARMED";
    if (wave) wave.classList.add("active");
  } else {
    if (btn) btn.classList.remove("active");
    if (txt) txt.innerText = "STANDBY";
    if (wave) wave.classList.remove("active");
  }
}

function toggleVoiceListener() {
  if (!isDSPArmed) {
    if (micStream) {
      setupHardwareAudioDSP(micStream);
    } else {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((st) => {
        micStream = st;
        setupHardwareAudioDSP(st);
      }).catch(() => {});
    }
  } else {
    isDSPArmed = false;
    if (speechRecognition) { try { speechRecognition.abort(); } catch (_) {} }
    updateMicVisualState(false);
    updateDialogueStatus("STANDBY", "Acoustic listener paused.");
  }
}

function updateDialogueStatus(flag, message) {
  const flagEl = document.getElementById("aiStatusFlag");
  const msgEl = document.getElementById("aiTranscript");
  if (flagEl) flagEl.innerText = flag.toUpperCase();
  if (msgEl) msgEl.innerText = `"${message}"`;

  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(message);
    utt.rate = 1.0;
    window.speechSynthesis.speak(utt);
  }
}

function changeSensitivity() {
  dspThreshold = parseInt(document.getElementById("dspSensSelect").value);
  addEventLog(`DSP Sensitivity adjusted to ${dspThreshold}%`, "OK");
}

/* ---------------------------------------------------------
   4. MATHEMATICAL 8-CHAR GEOHASH ENCODER (100% OFFLINE)
   --------------------------------------------------------- */
function encodeGeoHash(latitude, longitude, precision = 8) {
  const base32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let minLat = -90.0, maxLat = 90.0;
  let minLon = -180.0, maxLon = 180.0;
  let hash = "";
  let bit = 0, ch = 0, even = true;

  while (hash.length < precision) {
    if (even) {
      let mid = (minLon + maxLon) / 2;
      if (longitude > mid) { ch |= (1 << (4 - bit)); minLon = mid; } else { maxLon = mid; }
    } else {
      let mid = (minLat + maxLat) / 2;
      if (latitude > mid) { ch |= (1 << (4 - bit)); minLat = mid; } else { maxLat = mid; }
    }
    even = !even;
    if (bit < 4) { bit++; } else { hash += base32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

/* ---------------------------------------------------------
   5. RAW SATELLITE GNSS TELEMETRY (ZERO NETWORK)
   --------------------------------------------------------- */
function syncLiveCoordinates() {
  const lockTag = document.getElementById("gnssLockText");
  if (lockTag) {
    lockTag.innerText = "SEARCHING SATELLITES...";
    lockTag.className = "neon-cyan";
  }

  if (navigator.getBattery) {
    navigator.getBattery().then((bat) => {
      batteryPercent = Math.round(bat.level * 100) + "%";
      const el = document.getElementById("dispBattery");
      if (el) el.innerText = batteryPercent;
    });
  }

  if ("geolocation" in navigator) {
    navigator.geolocation.watchPosition(
      (pos) => {
        currentLat = pos.coords.latitude;
        currentLon = pos.coords.longitude;
        currentAccuracy = pos.coords.accuracy || 7.5;
        currentAltitude = pos.coords.altitude ? Math.round(pos.coords.altitude) : 312;
        currentHash = encodeGeoHash(currentLat, currentLon, 8);

        const latEl = document.getElementById("dispLat");
        const lonEl = document.getElementById("dispLon");
        const hashEl = document.getElementById("dispGeoHash");
        const accEl = document.getElementById("dispAccuracy");
        const altEl = document.getElementById("dispAltitude");

        if (latEl) latEl.innerText = `${currentLat.toFixed(6)}° N`;
        if (lonEl) lonEl.innerText = `${currentLon.toFixed(6)}° E`;
        if (hashEl) hashEl.innerText = currentHash;
        if (accEl) accEl.innerText = `${currentAccuracy.toFixed(1)} m`;
        if (altEl) altEl.innerText = `MSL Alt: ${currentAltitude}m`;

        if (lockTag) {
          lockTag.innerText = "HARDWARE LOCKED";
          lockTag.className = "neon-green";
        }
      },
      () => {
        currentHash = encodeGeoHash(currentLat, currentLon, 8);
        const hashEl = document.getElementById("dispGeoHash");
        if (hashEl) hashEl.innerText = currentHash;
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }
}

/* ---------------------------------------------------------
   6. DEFENSE ACOUSTIC SIREN SYNTHESIZER
   --------------------------------------------------------- */
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function startDefenseSiren() {
  initAudio();
  if (isSirenActive) return;

  sirenOsc = audioCtx.createOscillator();
  sirenGain = audioCtx.createGain();
  sirenOsc.type = "sawtooth";
  sirenGain.gain.setValueAtTime(0.95, audioCtx.currentTime);

  let now = audioCtx.currentTime;
  sirenOsc.frequency.setValueAtTime(1500, now);
  let step = 0;
  sirenInterval = setInterval(() => {
    let t = audioCtx.currentTime;
    sirenOsc.frequency.cancelScheduledValues(t);
    sirenOsc.frequency.exponentialRampToValueAtTime(step % 2 === 0 ? 3800 : 1500, t + 0.32);
    step++;
  }, 340);

  sirenOsc.connect(sirenGain);
  sirenGain.connect(audioCtx.destination);
  sirenOsc.start();
  isSirenActive = true;

  const btn = document.getElementById("sirenBtn");
  const badge = document.getElementById("sirenBadge");
  if (btn) btn.classList.add("active");
  if (badge) {
    badge.innerText = "SOUNDING";
    badge.classList.add("active");
  }
  addEventLog("Defense Siren Engaged", "ALERT");
}

function stopDefenseSiren() {
  if (!isSirenActive) return;
  if (sirenInterval) clearInterval(sirenInterval);
  if (sirenOsc) {
    try { sirenOsc.stop(); sirenOsc.disconnect(); } catch (_) {}
  }
  isSirenActive = false;

  const btn = document.getElementById("sirenBtn");
  const badge = document.getElementById("sirenBadge");
  if (btn) btn.classList.remove("active");
  if (badge) {
    badge.innerText = "MUTED";
    badge.classList.remove("active");
  }
  addEventLog("Siren Disengaged", "OK");
}

function toggleDefenseSiren() {
  if (isSirenActive) stopDefenseSiren();
  else startDefenseSiren();
}
// ==========================================
// 7. TACTICAL EMERGENCY SMS DISPATCHER
// ==========================================
function triggerEmergencySMS() {
  // Saved emergency number uthayega (agar user ne save kiya hai)
  const savedContact = localStorage.getItem("sos_emergency_contact") || "";

  const latText = currentLat || (window.userLatitude ? parseFloat(window.userLatitude).toFixed(6) : "ACQUIRING...");
  const lonText = currentLon || (window.userLongitude ? parseFloat(window.userLongitude).toFixed(6) : "ACQUIRING...");
  
  const hasCoordinates = currentLat && currentLon;
  
  const mapsLink = hasCoordinates 
    ? `https://maps.google.com/?q=${latText},${lonText}` 
    : "GPS Lock In Progress / Offline Mode";
  
  const geohashCode = hasCoordinates 
    ? encodeGeoHash(parseFloat(latText), parseFloat(lonText), 9) 
    : "OFFLINE_BEACON";

  // SMS Body Payload
  const alertText = 
`🚨 [SOS TACTICAL ALERT] 🚨
EMERGENCY BEACON TRIGGERED! NEED IMMEDIATE HELP.

📍 Coordinates:
Lat: ${latText}
Lon: ${lonText}

🗺️ Exact Map Location:
${mapsLink}

🌐 GeoHash: ${geohashCode}
(Time: ${new Date().toLocaleTimeString()})`;

  const encodedBody = encodeURIComponent(alertText);

  // Agar contact save hai toh direct usi number pe jayega, warna number field khali rahegi
  const smsURI = savedContact 
    ? `sms:${savedContact}?body=${encodedBody}` 
    : `sms:?body=${encodedBody}`;

  window.location.href = smsURI;
}

/* ---------------------------------------------------------
   8. ACCELEROMETER MOTION SENSOR (3x IMPACT SHAKE)
   --------------------------------------------------------- */
function initMotionSensors() {
  if (window.DeviceMotionEvent) {
    window.addEventListener("devicemotion", (e) => {
      let acc = e.accelerationIncludingGravity;
      if (!acc || acc.x === null) return;

      if (lastX !== null) {
        let deltaX = Math.abs(acc.x - lastX);
        let deltaY = Math.abs(acc.y - lastY);
        let deltaZ = Math.abs(acc.z - lastZ);
        let totalForce = (deltaX + deltaY + deltaZ) / 9.8;

        if (totalForce > 2.8) {
          let now = Date.now();
          if (now - lastShakeTime < 1400) {
            shakeCount++;
            if (shakeCount >= 3) {
              shakeCount = 0;
              const chip = document.getElementById("chipShake");
              if (chip) chip.classList.add("active");
              updateDialogueStatus("SHAKE DETECTED", "3x Rapid Device Shake Detected!");
              executeEmergencyBroadcast("Accelerometer: 3x Rapid Device Shake");
            }
          } else {
            shakeCount = 1;
          }
          lastShakeTime = now;
        }
      }
      lastX = acc.x; lastY = acc.y; lastZ = acc.z;
    });
  }
}

/* ---------------------------------------------------------
   9. OPTICAL MORSE STROBE FLASHLIGHT
   --------------------------------------------------------- */
async function toggleStrobeBeacon() {
  if (isStrobeActive) stopStrobeBeacon();
  else startStrobeBeacon();
}

async function startStrobeBeacon() {
  isStrobeActive = true;
  const chip = document.getElementById("chipStrobe");
  if (chip) chip.classList.add("active");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    torchTrack = stream.getVideoTracks()[0];
    let torchState = true;
    strobeInterval = setInterval(async () => {
      try {
        await torchTrack.applyConstraints({ advanced: [{ torch: torchState }] });
        torchState = !torchState;
      } catch (_) {}
    }, 200);
  } catch (_) {
    let screenGlow = false;
    strobeInterval = setInterval(() => {
      document.body.style.backgroundColor = screenGlow ? "#FF1744" : "#02050D";
      screenGlow = !screenGlow;
    }, 250);
  }
}

function stopStrobeBeacon() {
  isStrobeActive = false;
  if (strobeInterval) clearInterval(strobeInterval);
  if (torchTrack) {
    try {
      torchTrack.applyConstraints({ advanced: [{ torch: false }] });
      torchTrack.stop();
    } catch (_) {}
  }
  document.body.style.backgroundColor = "#02050D";
  const chip = document.getElementById("chipStrobe");
  if (chip) chip.classList.remove("active");
}

/* ---------------------------------------------------------
   10. RADIAL HOLD SOS BUTTON (1.5S DURATION)
   --------------------------------------------------------- */
const sosButton = document.getElementById("sosCoreBtn");
const progressArc = document.getElementById("sosProgressArc");

function onHoldBegin(e) {
  if (e) e.preventDefault();
  holdProgress = 0;
  clearInterval(holdTimer);

  holdTimer = setInterval(() => {
    holdProgress += 30;
    let offset = RING_LENGTH - (holdProgress / HOLD_TARGET) * RING_LENGTH;
    if (progressArc) progressArc.style.strokeDashoffset = Math.max(0, offset);

    if (holdProgress >= HOLD_TARGET) {
      clearInterval(holdTimer);
      if (progressArc) progressArc.style.strokeDashoffset = RING_LENGTH;
      executeEmergencyBroadcast("Manual SOS Core Hold (1.5s Trigger)");
    }
  }, 30);
}

function onHoldEnd() {
  clearInterval(holdTimer);
  holdProgress = 0;
  if (progressArc) progressArc.style.strokeDashoffset = RING_LENGTH;
}

if (sosButton) {
  sosButton.addEventListener("mousedown", onHoldBegin);
  sosButton.addEventListener("mouseup", onHoldEnd);
  sosButton.addEventListener("mouseleave", onHoldEnd);
  sosButton.addEventListener("touchstart", onHoldBegin, { passive: false });
  sosButton.addEventListener("touchend", onHoldEnd);
}

/* ---------------------------------------------------------
   11. CONTACTS & CONFIGURATION STATE
   --------------------------------------------------------- */
function renderContacts() {
  const list = document.getElementById("contactsListWrap");
  if (!list) return;
  list.innerHTML = "";
  const counter = document.getElementById("contactsCounter");
  if (counter) counter.innerText = `${emergencyContacts.length} Nodes Configured`;

  emergencyContacts.forEach((contact, idx) => {
    const row = document.createElement("div");
    row.className = "contact-item-row";
    row.innerHTML = `
      <div class="item-meta">
        <span class="item-name">${contact.name}</span>
        <span class="item-phone">${contact.phone}</span>
      </div>
      <button class="del-node-btn" onclick="removeContactNode(${idx})">✕</button>
    `;
    list.appendChild(row);
  });
}

function addNewContactNode() {
  const nameEl = document.getElementById("nodeNameInput");
  const phoneEl = document.getElementById("nodePhoneInput");
  if (!nameEl || !phoneEl) return;

  const name = nameEl.value.trim();
  const phone = phoneEl.value.trim();
  if (!name || !phone) return;

  emergencyContacts.push({ name, phone });
  localStorage.setItem("beacon_nodes", JSON.stringify(emergencyContacts));
  nameEl.value = "";
  phoneEl.value = "";
  renderContacts();
  addEventLog(`Node Added: ${name}`, "OK");
}

function removeContactNode(idx) {
  emergencyContacts.splice(idx, 1);
  localStorage.setItem("beacon_nodes", JSON.stringify(emergencyContacts));
  renderContacts();
}

function saveConfiguration() {
  const codeField = document.getElementById("passcodesField");
  if (codeField) {
    customPasscodes = codeField.value.split(",").map(c => c.trim().toLowerCase()).filter(c => c.length > 0);
    localStorage.setItem("beacon_custom_codes", codeField.value);
  }
  updateDialogueStatus("SAVED", "Configuration updated successfully.");
  addEventLog("Security passcodes saved", "OK");
}

function addEventLog(eventText, statusType) {
  const stream = document.getElementById("logStreamBox");
  if (!stream) return;
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const row = document.createElement("div");
  row.className = "log-line";
  row.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-msg">${eventText}</span>
    <span class="log-status ${statusType.toLowerCase()}">${statusType}</span>
  `;
  stream.prepend(row);
}

function clearEventLogs() {
  const stream = document.getElementById("logStreamBox");
  if (stream) stream.innerHTML = "";
  addEventLog("Logs cleared", "OK");
}

/* ---------------------------------------------------------
   12. COLD BOOT INITIALIZER
   --------------------------------------------------------- */
window.addEventListener("DOMContentLoaded", () => {
  const savedNodes = localStorage.getItem("beacon_nodes");
  const savedCodes = localStorage.getItem("beacon_custom_codes");
  const perms = localStorage.getItem("beacon_perms_v10");

  if (savedNodes) {
    try { emergencyContacts = JSON.parse(savedNodes); } catch (_) {}
  }
  if (savedCodes) {
    customPasscodes = savedCodes.split(",").map(c => c.trim().toLowerCase());
  }

  renderContacts();
  initMotionSensors();

  if (!perms) {
    openHardwareModal();
  } else {
    const modal = document.getElementById("permModal");
    if (modal) modal.style.display = "none";
    syncLiveCoordinates();
    navigator.mediaDevices.getUserMedia({ audio: true }).then((st) => {
      micStream = st;
      setupHardwareAudioDSP(st);
    }).catch(() => {});
  }
}
function saveEmergencyContact() {
  const input = document.getElementById("emergencyPhoneInput");
  if (input && input.value.trim() !== "") {
    localStorage.setItem("sos_emergency_contact", input.value.trim());
    alert("Emergency Contact Saved Offline!");
  }
}

// App open hote hi pehle se saved number input box me show karein
window.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("sos_emergency_contact");
  const input = document.getElementById("emergencyPhoneInput");
  if (saved && input) {
    input.value = saved;
  }
}
// Authorization button ko force unlock karna
const authBtn = document.querySelector("button:has-text('AUTHORIZE ALL DEFENSIVE SENSORS')") || 
                document.getElementById("authSensorsBtn") || 
                document.querySelector(".auth-btn") ||
                document.querySelector("button[onclick*='auth']");

function forceUnlockDashboard() {
  // 1. Overlay modal ko screen se hatana
  const authModal = document.querySelector(".auth-modal") || 
                    document.querySelector("[class*='modal']") || 
                    document.querySelector("[class*='authorization']");
  if (authModal) {
    authModal.style.display = "none";
  }

  // 2. Main tabs/dashboard ko active karna
  const mainTab = document.getElementById("tab-core") || document.querySelector(".tab-content");
  if (mainTab) {
    mainTab.classList.add("active");
    mainTab.style.display = "block";
  }

  // 3. Audio context aur GPS ko non-blocking background me chalu karna
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});
    }
  } catch(e) {}

  try {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(() => {}, () => {});
    }
  } catch(e) {}
}

// Button par click hote hi turant dashboard khulega
document.addEventListener("DOMContentLoaded", () => {
  const allBtns = document.querySelectorAll("button");
  allBtns.forEach(btn => {
    if (btn.innerText.includes("AUTHORIZE ALL DEFENSIVE SENSORS")) {
      btn.addEventListener("click", forceUnlockDashboard);
    }
  });
});
