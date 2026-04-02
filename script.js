const app = {
  map: null,
  currentMarker: null,
  destinationMarker: null,
  routeLine: null,
  currentPosition: [42.8746, 74.5698], // Bishkek
  voiceEnabled: true,
  highContrast: false,
  largeText: false,
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
  accessStatus: document.getElementById("accessStatus"),

  startGuideBtn: document.getElementById("startGuideBtn"),
  speakAboutBtn: document.getElementById("speakAboutBtn"),

  camera: document.getElementById("camera"),
  overlay: document.getElementById("overlay"),
  alertBox: document.getElementById("alertBox"),
  cameraModeText: document.getElementById("cameraModeText"),

  startCameraBtn: document.getElementById("startCameraBtn"),
  detectBtn: document.getElementById("detectBtn"),
  ocrBtn: document.getElementById("ocrBtn"),
  demoHazardBtn: document.getElementById("demoHazardBtn"),

  destinationInput: document.getElementById("destinationInput"),
  voiceInputBtn: document.getElementById("voiceInputBtn"),
  buildRouteBtn: document.getElementById("buildRouteBtn"),
  routeSummary: document.getElementById("routeSummary"),
  routeSteps: document.getElementById("routeSteps"),

  busNumberInput: document.getElementById("busNumberInput"),
  simulateBusBtn: document.getElementById("simulateBusBtn"),
  nextStopBtn: document.getElementById("nextStopBtn"),
  busProgress: document.getElementById("busProgress"),
  busStatus: document.getElementById("busStatus"),

  toggleVoiceBtn: document.getElementById("toggleVoiceBtn"),
  toggleContrastBtn: document.getElementById("toggleContrastBtn"),
  toggleTextBtn: document.getElementById("toggleTextBtn"),
};

function speak(text, urgent = false) {
  if (!app.voiceEnabled  !("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ru-RU";
  utterance.rate = urgent ? 1.02 : 0.96;
  utterance.pitch = 1;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

function updateText(el, text) {
  if (el) el.textContent = text;
}

function setAlert(message, tone = "normal") {
  const tones = {
    normal: "GuideMe: ",
    warning: "Внимание: ",
    danger: "Опасность: ",
    success: "Готово: ",
  };

  els.alertBox.textContent = `${tones[tone]  ""}${message}`;
}
function cooldownAlert(key, message, ms = 5000, tone = "warning") {
  const now = Date.now();
  if (!app.lastAlerts[key]  now - app.lastAlerts[key] > ms) {
    app.lastAlerts[key] = now;
    setAlert(message, tone);
    speak(message, tone === "danger");
  }
}

function initMap() {
  app.map = L.map("map").setView(app.currentPosition, 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(app.map);

  app.currentMarker = L.marker(app.currentPosition)
    .addTo(app.map)
    .bindPopup("Вы здесь");

  L.circle(app.currentPosition, {
    radius: 35,
    color: "#6ee7ff",
    fillColor: "#6ee7ff",
    fillOpacity: 0.2,
  }).addTo(app.map);
}

function updateCurrentMarker(lat, lon) {
  app.currentPosition = [lat, lon];

  if (!app.currentMarker) {
    app.currentMarker = L.marker(app.currentPosition).addTo(app.map);
  }

  app.currentMarker.setLatLng(app.currentPosition);
  app.currentMarker.bindPopup("Вы здесь");
  app.map.setView(app.currentPosition, 15);

  updateText(els.gpsStatus, "Геолокация активна");
}

function getLocation() {
  if (!navigator.geolocation) {
    updateText(els.gpsStatus, "GPS не поддерживается");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      updateCurrentMarker(pos.coords.latitude, pos.coords.longitude);
      speak("Ваше местоположение определено.");
    },
    () => {
      updateText(els.gpsStatus, "Используется центр Бишкека");
      speak("Не удалось получить GPS. Использую центр Бишкека.");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

async function geocodePlace(query) {
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query + ", Bishkek, Kyrgyzstan")}`;

  const response = await fetch(url, {
    headers: {
      "Accept-Language": "ru",
    },
  });

  if (!response.ok) throw new Error("Ошибка геокодирования");

  const data = await response.json();
  if (!data.length) throw new Error("Место не найдено");

  return [parseFloat(data[0].lat), parseFloat(data[0].lon), data[0].display_name];
}

async function buildRoute() {
  const destination = els.destinationInput.value.trim();
  if (!destination) {
    setAlert("Введите место назначения.", "warning");
    speak("Введите место назначения.");
    return;
  }

  try {
    updateText(els.routeSummary, "Поиск точки назначения...");
    const [destLat, destLon, displayName] = await geocodePlace(destination);

    if (app.destinationMarker) {
      app.map.removeLayer(app.destinationMarker);
    }

    app.destinationMarker = L.marker([destLat, destLon])
      .addTo(app.map)
      .bindPopup("Пункт назначения");

    const osrmUrl =
      `https://router.project-osrm.org/route/v1/foot/${app.currentPosition[1]},${app.currentPosition[0]};${destLon},${destLat}?overview=full&geometries=geojson&steps=true`;

    const routeRes = await fetch(osrmUrl);
    if (!routeRes.ok) throw new Error("Ошибка сервиса маршрута");

    const routeData = await routeRes.json();
    if (!routeData.routes  !routeData.routes.length) {
      throw new Error("Маршрут не найден");
    }

    const route = routeData.routes[0];
    const coords = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);

    if (app.routeLine) {
      app.map.removeLayer(app.routeLine);
    }

    app.routeLine = L.polyline(coords, {
      color: "#6ee7ff",
      weight: 6,
      opacity: 0.85,
    }).addTo(app.map);

    app.map.fitBounds(app.routeLine.getBounds(), { padding: [30, 30] });

    const km = (route.distance / 1000).toFixed(2);
    const min = Math.round(route.duration / 60);

    const summary = Маршрут построен до: ${displayName}. Расстояние: ${km} км. Время пешком: ${min} мин. Режим: безопасный пешеходный маршрут.;
    updateText(els.routeSummary, summary);
const steps = route.legs[0].steps  [];
    renderSteps(steps);

    speak(`Маршрут построен. ${min} минут пешком. Озвучиваю первые шаги.`);
    speakFirstSteps(steps);

  } catch (error) {
    updateText(els.routeSummary, "Не удалось построить маршрут.");
    setAlert(error.message  "Ошибка построения маршрута.", "danger");
  }
}

function maneuverToText(step, index) {
  const type = step.maneuver?.type  "";
  const modifier = step.maneuver?.modifier  "";
  const road = step.name ?  по улице ${step.name} : "";
  const distance = Math.round(step.distance  0);

  const dirMap = {
    left: "налево",
    right: "направо",
    straight: "прямо",
    slight left: "слегка налево",
    slight right: "слегка направо",
    sharp left: "резко налево",
    sharp right: "резко направо",
    uturn: "развернитесь",
  };

  const dir = dirMap[modifier]  "";

  if (type === "depart") {
    return Шаг ${index + 1}. Начните движение${road}. Пройдите примерно ${distance} метров.;
  }

  if (type === "turn") {
    return Шаг ${index + 1}. Поверните ${dir || "по маршруту"}${road}. Затем пройдите ${distance} метров.;
  }

  if (type === "continue" || type === "new name"  type === "notification") {
    return `Шаг ${index + 1}. Идите прямо${road}. Расстояние: ${distance} метров.`;
  }

  if (type === "merge"  type === "fork") {
    return Шаг ${index + 1}. Держитесь ${dir || "по маршруту"}${road}.;
  }

  if (type === "roundabout") {
    return Шаг ${index + 1}. На круговом движении следуйте по маршруту${road}.;
  }

  if (type === "arrive") {
    return Шаг ${index + 1}. Вы прибыли в пункт назначения.;
  }

  return Шаг ${index + 1}. Продолжайте движение${road}.;
}

function renderSteps(steps) {
  els.routeSteps.innerHTML = "";

  if (!steps.length) {
    els.routeSteps.innerHTML = "<li>Инструкции маршрута недоступны.</li>";
    return;
  }

  steps.forEach((step, index) => {
    const li = document.createElement("li");
    let text = maneuverToText(step, index);

    if (index === 1 || index === 3  index === 5) {
      text += " Будьте внимательны к пешеходам и машинам рядом.";
    }

    li.textContent = text;
    els.routeSteps.appendChild(li);
  });
}

function speakFirstSteps(steps) {
  const first = steps.slice(0, 3).map((step, index) => maneuverToText(step, index));
  if (first.length) speak(first.join(" "));
}

async function startCamera() {
  try {
    if (!navigator.mediaDevices  !navigator.mediaDevices.getUserMedia) {
      throw new Error("Камера не поддерживается этим браузером.");
    }

    app.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    els.camera.srcObject = app.cameraStream;
    updateText(els.aiStatus, "Камера активна");
    updateText(els.cameraModeText, "Камера включена");
    setAlert("Камера активирована.", "success");
    speak("Камера активирована.");
if (!app.model) {
      updateText(els.aiStatus, "Загрузка AI-модели...");
      app.model = await cocoSsd.load();
      updateText(els.aiStatus, "AI готов");
      setAlert("AI-модель загружена. Можно анализировать обстановку.", "success");
      speak("Модель искусственного интеллекта готова.");
    }
  } catch (error) {
    updateText(els.aiStatus, "Ошибка камеры");
    setAlert(error.message  "Не удалось включить камеру.", "danger");
  }
}

function drawDetections(predictions) {
  const canvas = els.overlay;
  const ctx = canvas.getContext("2d");

  canvas.width = els.camera.videoWidth  els.camera.clientWidth;
  canvas.height = els.camera.videoHeight  els.camera.clientHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 3;
  ctx.font = "16px Manrope";

  predictions.forEach((pred) => {
    const [x, y, width, height] = pred.bbox;
    ctx.strokeStyle = "#6ee7ff";
    ctx.fillStyle = "rgba(110, 231, 255, 0.18)";
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);

    const label = `${pred.class} ${(pred.score * 100).toFixed(0)}%`;
    const textWidth = ctx.measureText(label).width + 14;

    ctx.fillStyle = "#08111f";
    ctx.fillRect(x, Math.max(0, y - 28), textWidth, 24);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, x + 7, Math.max(16, y - 10));
  });
}

function detectTrafficLightColor(prediction) {
  try {
    const tempCanvas = document.createElement("canvas");
    const ctx = tempCanvas.getContext("2d");

    tempCanvas.width = els.camera.videoWidth;
    tempCanvas.height = els.camera.videoHeight;
    ctx.drawImage(els.camera, 0, 0, tempCanvas.width, tempCanvas.height);

    const [x, y, width, height] = prediction.bbox.map(Math.round);
    if (width < 8  height < 8) return null;

    const imageData = ctx.getImageData(x, y, width, height).data;

    let redScore = 0;
    let greenScore = 0;

    for (let i = 0; i < imageData.length; i += 16) {
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];

      if (r > g + 35 && r > b + 35) redScore++;
      if (g > r + 20 && g > b + 20) greenScore++;
    }

    if (redScore > greenScore * 1.15 && redScore > 8) return "красный";
    if (greenScore > redScore * 1.15 && greenScore > 8) return "зеленый";

    return "неопределен";
  } catch {
    return null;
  }
}

async function detectEnvironment() {
  if (!app.model) {
    setAlert("Сначала включите камеру и дождитесь загрузки AI.", "warning");
    return;
  }

  if (!els.camera.videoWidth) {
    setAlert("Видео с камеры ещё не готово.", "warning");
    return;
  }

  const predictions = await app.model.detect(els.camera);
  const relevant = predictions.filter(
    (p) =>
      p.score > 0.58 &&
      ["person", "car", "bus", "truck", "bicycle", "motorcycle", "traffic light", "stop sign"].includes(p.class)
  );

  drawDetections(relevant);

  if (!relevant.length) {
    setAlert("Опасных объектов рядом не найдено.", "success");
    speak("Путь впереди относительно свободен.");
    return;
  }

  const names = [];
  let strongest = null;
relevant.forEach((p) => {
    if (!strongest  p.score > strongest.score) strongest = p;
    names.push(p.class);

    if (p.class === "person") {
      cooldownAlert("person", "Впереди человек.", 3500, "warning");
    }

    if (p.class === "car"  p.class === "truck"  p.class === "motorcycle") {
      cooldownAlert("car", "Осторожно, впереди машина.", 3500, "danger");
    }

    if (p.class === "bus") {
      cooldownAlert("bus", "Впереди автобус.", 3500, "warning");
    }

    if (p.class === "bicycle") {
      cooldownAlert("bike", "Рядом велосипед.", 3500, "warning");
    }

    if (p.class === "traffic light") {
      const color = detectTrafficLightColor(p);
      if (color && color !== "неопределен") {
        cooldownAlert("traffic", `Светофор ${color}.`, 4000, color === "красный" ? "danger" : "success");
      } else {
        cooldownAlert("traffic", "Впереди светофор.", 4000, "warning");
      }
    }
  });

  if (strongest) {
    const mainClass = classToRussian(strongest.class);
    setAlert(`Обнаружено: ${mainClass}. Проверяйте пространство перед собой.`, "warning");
  }
}

function classToRussian(className) {
  const map = {
    person: "человек",
    car: "машина",
    bus: "автобус",
    truck: "грузовик",
    bicycle: "велосипед",
    motorcycle: "мотоцикл",
    "traffic light": "светофор",
    "stop sign": "знак стоп",
  };

  return map[className]  className;
}

async function recognizeBusNumber() {
  if (!els.camera.videoWidth) {
    setAlert("Сначала включите камеру.", "warning");
    return;
  }

  setAlert("Идёт распознавание номера автобуса...", "normal");
  speak("Пробую считать номер автобуса.");

  try {
    const tempCanvas = document.createElement("canvas");
    const ctx = tempCanvas.getContext("2d");
    tempCanvas.width = els.camera.videoWidth;
    tempCanvas.height = els.camera.videoHeight;
    ctx.drawImage(els.camera, 0, 0, tempCanvas.width, tempCanvas.height);

    const result = await Tesseract.recognize(tempCanvas, "eng", {
      logger: () => {},
    });

    const text = (result.data.text  "").replace(/\s+/g, " ").trim();
    const digits = text.match(/\d{1,4}/g);

    if (digits && digits.length) {
      const busNum = digits[0];
      setAlert(`Обнаружен номер автобуса: ${busNum}`, "success");
      speak(`Номер автобуса ${busNum}.`);
      els.busNumberInput.value = busNum;
    } else {
      setAlert("Номер автобуса не распознан. Поднесите камеру ближе.", "warning");
      speak("Не удалось распознать номер автобуса.");
    }
  } catch (error) {
    setAlert("Ошибка OCR. Попробуйте ещё раз.", "danger");
  }
}

function startVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition  window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setAlert("Голосовой ввод не поддерживается в этом браузере.", "warning");
    speak("Голосовой ввод не поддерживается.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "ru-RU";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  setAlert("Слушаю вас...", "normal");
  recognition.start();

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    els.destinationInput.value = text;
    setAlert(Вы сказали: ${text}, "success");
    speak(Принято. Пункт назначения: ${text});
  };

  recognition.onerror = () => {
    setAlert("Не удалось распознать голос.", "warning");
  };
}

function toggleVoice() {
  app.voiceEnabled = !app.voiceEnabled;
  updateText(els.voiceStatus, app.voiceEnabled ? "Включен" : "Выключен");
  setAlert(Голосовой режим ${app.voiceEnabled ? "включён" : "выключен"}., "success");
}

function toggleContrast() {
  app.highContrast = !app.highContrast;
  document.body.classList.toggle("high-contrast", app.highContrast);
  updateText(els.accessStatus, app.highContrast ? "Высокий контраст" : "Стандартный");
  speak(app.highContrast ? "Высокий контраст включён." : "Высокий контраст выключен.");
}
function toggleTextSize() {
  app.largeText = !app.largeText;
  document.body.classList.toggle("large-text", app.largeText);
  speak(app.largeText ? "Крупный текст включён." : "Крупный текст выключен.");
}

function demoHazard() {
  const messages = [
    "Впереди человек.",
    "Осторожно, справа машина.",
    "Впереди автобусная остановка.",
    "На перекрёстке впереди светофор.",
    "Будьте осторожны, рядом велосипед."
  ];

  const msg = messages[Math.floor(Math.random() * messages.length)];
  setAlert(msg, msg.includes("Осторожно") ? "danger" : "warning");
  speak(msg, msg.includes("Осторожно"));
}

function startBusSimulation() {
  clearInterval(app.busTimer);
  app.busProgress = 0;
  els.busProgress.style.width = "0%";

  const busNumber = els.busNumberInput.value.trim() || "212";
  els.busStatus.textContent = Автобус ${busNumber} ещё далеко.;
  speak(Запущен поиск автобуса ${busNumber}.);

  app.busTimer = setInterval(() => {
    app.busProgress += 10;
    els.busProgress.style.width = ${app.busProgress}%;

    if (app.busProgress === 20) {
      els.busStatus.textContent = Автобус ${busNumber} найден на линии.;
      speak(Автобус ${busNumber} найден.);
    }

    if (app.busProgress === 50) {
      els.busStatus.textContent = Автобус ${busNumber} приближается к остановке.;
      speak(Автобус ${busNumber} приближается.);
    }

    if (app.busProgress === 80) {
      els.busStatus.textContent = Автобус ${busNumber} почти у вашей остановки. Подготовьтесь.;
      speak(Автобус почти у остановки. Подготовьтесь.);
    }

    if (app.busProgress >= 100) {
      clearInterval(app.busTimer);
      els.busProgress.style.width = "100%";
      els.busStatus.textContent = Автобус ${busNumber} прибыл. Можно садиться.;
      speak(Автобус ${busNumber} прибыл. Можно садиться.);
    }
  }, 1000);
}

function nextStopDemo() {
  els.busStatus.textContent = "Следующая остановка — ваша. Подготовьтесь к выходу.";
  speak("Следующая остановка ваша. Подготовьтесь к выходу.");
}

function speakAbout() {
  speak("GuideMe — это сайт помощник для незрячих людей. Он анализирует дорогу с камеры, предупреждает о людях, машинах и светофорах, строит пешеходный маршрут и помогает с автобусами.");
}

function startGuide() {
  speak("GuideMe запускается. Сначала определяю ваше местоположение.");
  getLocation();
  setAlert("GuideMe запущен. Можно включить камеру или построить маршрут.", "success");
}

function attachEvents() {
  els.startGuideBtn.addEventListener("click", startGuide);
  els.speakAboutBtn.addEventListener("click", speakAbout);

  els.startCameraBtn.addEventListener("click", startCamera);
  els.detectBtn.addEventListener("click", detectEnvironment);
  els.ocrBtn.addEventListener("click", recognizeBusNumber);
  els.demoHazardBtn.addEventListener("click", demoHazard);

  els.voiceInputBtn.addEventListener("click", startVoiceInput);
  els.buildRouteBtn.addEventListener("click", buildRoute);

  els.simulateBusBtn.addEventListener("click", startBusSimulation);
  els.nextStopBtn.addEventListener("click", nextStopDemo);

  els.toggleVoiceBtn.addEventListener("click", toggleVoice);
  els.toggleContrastBtn.addEventListener("click", toggleContrast);
  els.toggleTextBtn.addEventListener("click", toggleTextSize);

  els.destinationInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") buildRoute();
  });
}

function boot() {
  initMap();
  getLocation();
  attachEvents();
  setAlert("Сайт готов к работе. Нажмите «Запустить GuideMe».", "success");
}

document.addEventListener("DOMContentLoaded", boot);
