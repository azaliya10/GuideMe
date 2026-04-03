const app = {
  map: null,
  currentMarker: null,
  destinationMarker: null,
  routeLine: null,
  currentPosition: [42.8746, 74.5698],
  voiceEnabled: true,
  cameraStream: null,
  model: null,
  lastAlerts: {},
  busProgress: 0,
  busTimer: null,
};

const els = {
  aiStatus: document.getElementById("aiStatus"),
  gpsStatus: document.getElementById("gpsStatus"),
  voiceStatus: document.getElementById("voiceStatus"),

  camera: document.getElementById("camera"),
  overlay: document.getElementById("overlay"),
  alertBox: document.getElementById("alertBox"),

  startGuideBtn: document.getElementById("startGuideBtn"),
  startCameraBtn: document.getElementById("startCameraBtn"),
  detectBtn: document.getElementById("detectBtn"),

  destinationInput: document.getElementById("destinationInput"),
  buildRouteBtn: document.getElementById("buildRouteBtn"),
  routeSummary: document.getElementById("routeSummary"),
  routeSteps: document.getElementById("routeSteps"),

  simulateBusBtn: document.getElementById("simulateBusBtn"),
  busProgress: document.getElementById("busProgress"),
  busStatus: document.getElementById("busStatus"),
};

// 🎤 VOICE
function speak(text) {
  if (!app.voiceEnabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ru-RU";
  window.speechSynthesis.speak(utterance);
}

// 🔔 ALERT
function setAlert(message) {
  els.alertBox.textContent = message;
  speak(message);
}

// 🗺 MAP
function initMap() {
  app.map = L.map("map").setView(app.currentPosition, 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
  }).addTo(app.map);

  app.currentMarker = L.marker(app.currentPosition).addTo(app.map);
}

// 📍 GEO
function getLocation() {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      app.currentPosition = [lat, lon];
      app.currentMarker.setLatLng(app.currentPosition);

      setAlert("Location detected");
    },
    () => setAlert("Using default location")
  );
}

// 🧠 CAMERA + AI
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
    });

    els.camera.srcObject = stream;
    app.cameraStream = stream;

    setAlert("Camera started");

    if (!app.model) {
      app.model = await cocoSsd.load();
      setAlert("AI ready");
    }
  } catch {
    setAlert("Camera error");
  }
}

// 👁 DETECT
async function detectEnvironment() {
  if (!app.model) return setAlert("Start camera first");

  const predictions = await app.model.detect(els.camera);

  predictions.forEach((p) => {
    if (p.class === "person") {
      setAlert("Впереди человек");
    }
    if (p.class === "car") {
      setAlert("Осторожно машина");
    }
    if (p.class === "bus") {
      setAlert("Впереди автобус");
    }
  });
}

// 🚶 ROUTE
async function buildRoute() {
  const destination = els.destinationInput.value;
  if (!destination) return setAlert("Enter destination");

  setAlert("Building route...");

  els.routeSummary.textContent = `Route to ${destination}`;
  els.routeSteps.innerHTML = `
    <li>Идите прямо 10 шагов</li>
    <li>Поверните направо</li>
    <li>Вы прибыли</li>
  `;

  speak("Маршрут построен. Идите прямо");
}

// 🚌 BUS
function startBusSimulation() {
  app.busProgress = 0;

  app.busTimer = setInterval(() => {
    app.busProgress += 20;
    els.busProgress.style.width = app.busProgress + "%";

    if (app.busProgress === 100) {
      clearInterval(app.busTimer);
      els.busStatus.textContent = "Автобус прибыл";
      speak("Автобус прибыл");
    }
  }, 1000);
}

// 🎮 EVENTS
function initEvents() {
  els.startGuideBtn.onclick = () => {
    getLocation();
    setAlert("Guide started");
  };

  els.startCameraBtn.onclick = startCamera;
  els.detectBtn.onclick = detectEnvironment;
  els.buildRouteBtn.onclick = buildRoute;
  els.simulateBusBtn.onclick = startBusSimulation;
}

// 🚀 START
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  initEvents();
});
