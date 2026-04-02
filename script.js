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
