const app = {
  map: null,
  currentMarker: null,
  currentPosition: [42.8746, 74.5698],
  voiceEnabled: true,
  cameraStream: null,
  model: null,
  lastSpoken: "",
};

const els = {
  aiStatus: document.getElementById("aiStatus"),
  gpsStatus: document.getElementById("gpsStatus"),

  camera: document.getElementById("camera"),
  alertBox: document.getElementById("alertBox"),

  startGuideBtn: document.getElementById("startGuideBtn"),
  startCameraBtn: document.getElementById("startCameraBtn"),
  buildRouteBtn: document.getElementById("buildRouteBtn"),

  destinationInput: document.getElementById("destinationInput"),
  routeSummary: document.getElementById("routeSummary"),
  routeSteps: document.getElementById("routeSteps"),
};

// 🔊 ГОЛОС
function speak(text) {
  if (!app.voiceEnabled || !("speechSynthesis" in window)) return;

  if (text === app.lastSpoken) return; // не повторяет одно и то же
  app.lastSpoken = text;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ru-RU";
  utterance.rate = 0.95;

  window.speechSynthesis.speak(utterance);
}

// 📢 УВЕДОМЛЕНИЕ
function setAlert(text) {
  els.alertBox.textContent = text;
  speak(text);
}

// 🗺 КАРТА
function initMap() {
  app.map = L.map("map").setView(app.currentPosition, 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
  }).addTo(app.map);

  app.currentMarker = L.marker(app.currentPosition).addTo(app.map);
}

// 📍 ГЕОЛОКАЦИЯ
function getLocation() {
  if (!navigator.geolocation) {
    setAlert("Геолокация не поддерживается");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      app.currentPosition = [lat, lon];
      app.currentMarker.setLatLng(app.currentPosition);

      setAlert("Ваше местоположение определено");
    },
    () => {
      setAlert("Используется центр города");
    }
  );
}

// 📷 КАМЕРА (ЗАДНЯЯ)
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" }
      }
    });

    els.camera.srcObject = stream;
    app.cameraStream = stream;

    setAlert("Камера включена");

    if (!app.model) {
      setAlert("Загрузка искусственного интеллекта...");
      app.model = await cocoSsd.load();
      setAlert("Искусственный интеллект готов");
    }

    startAutoDetection();

  } catch {
    setAlert("Ошибка доступа к камере");
  }
}

// 🚦 ОПРЕДЕЛЕНИЕ ЦВЕТА
function detectTrafficLightColor() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = els.camera.videoWidth;
  canvas.height = els.camera.videoHeight;

  ctx.drawImage(els.camera, 0, 0);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  let red = 0;
  let green = 0;

  for (let i = 0; i < data.length; i += 30) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (r > g && r > b) red++;
    if (g > r && g > b) green++;
  }

  if (red > green) return "красный";
  if (green > red) return "зелёный";
  return null;
}

// 👁 AI ПРОВЕРКА
async function detectEnvironment() {
  if (!app.model || !els.camera.videoWidth) return;

  const predictions = await app.model.detect(els.camera);

  let message = "";

  predictions.forEach((p) => {
    if (p.score < 0.6) return;

    if (p.class === "person") {
      message = "Впереди человек";
    }

    if (p.class === "car") {
      message = "Осторожно, машина";
    }

    if (p.class === "bus") {
      message = "Впереди автобус";
    }

    if (p.class === "traffic light") {
      const color = detectTrafficLightColor();

      if (color) {
        message = `Светофор ${color}`;
      } else {
        message = "Впереди светофор";
      }
    }
  });

  if (message) setAlert(message);
}

// 🔄 АВТО РАСПОЗНАВАНИЕ
function startAutoDetection() {
  setInterval(() => {
    detectEnvironment();
  }, 2500); // каждые 2.5 сек
}

// 🚶 МАРШРУТ (демо)
function buildRoute() {
  const destination = els.destinationInput.value.trim();

  if (!destination) {
    setAlert("Введите место назначения");
    return;
  }

  els.routeSummary.textContent = `Маршрут до: ${destination}`;

  els.routeSteps.innerHTML = `
    <li>Идите прямо 10 шагов</li>
    <li>Поверните направо</li>
    <li>Продолжайте движение</li>
    <li>Вы прибыли</li>
  `;

  speak("Маршрут построен. Идите прямо");
}

// 🎮 СОБЫТИЯ
function initEvents() {
  els.startGuideBtn.onclick = () => {
    getLocation();
    setAlert("GuideMe запущен");
  };

  els.startCameraBtn.onclick = startCamera;
  els.buildRouteBtn.onclick = buildRoute;
}

// 🚀 СТАРТ
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  initEvents();
});
