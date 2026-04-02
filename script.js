let map, directionsService, directionsRenderer, model;
const aiStatus = document.getElementById('ai-status');

// 1. ГОЛОСОВОЕ УПРАВЛЕНИЕ
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'ru-RU';

function speak(text) {
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'ru-RU';
    window.speechSynthesis.speak(speech);
    aiStatus.innerText = text;
}

// 2. ЗРЕНИЕ ИИ (Глаза GuideMe)
async function initGuideMeVision() {
    model = await cocoSsd.load();
    detectFrame();
}

async function detectFrame() {
    const video = document.getElementById('video');
    if (model && video.readyState === 4) {
        const predictions = await model.detect(video);
        predictions.forEach(p => {
            // Реагируем только на важные объекты
            if (p.score > 0.6 && ['car', 'person', 'bus', 'bicycle', 'traffic light'].includes(p.class)) {
                navigator.vibrate([200, 100, 200]);
                const labels = { 'car': 'машина', 'person': 'человек', 'bus': 'автобус', 'bicycle': 'велосипед', 'traffic light': 'светофор' };
                speak("Впереди " + (labels[p.class] || "объект"));
            }
        });
    }
    requestAnimationFrame(detectFrame);
}

// 3. ПЕШЕХОДНАЯ НАВИГАЦИЯ
function initMap() {
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        polylineOptions: { strokeColor: "#FFD700", strokeWeight: 10 }
    });
    
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 42.87, lng: 74.6 }, zoom: 17, disableDefaultUI: true
    });
    directionsRenderer.setMap(map);
}

function findPedestrianPath(destination) {
    navigator.geolocation.getCurrentPosition(pos => {
        const request = {
            origin: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            destination: destination,
            travelMode: google.maps.TravelMode.WALKING // СТРОГО ПЕШЕХОДНЫЙ МАРШРУТ
        };

        directionsService.route(request, (res, status) => {
            if (status === 'OK') {
                directionsRenderer.setDirections(res);
                const info = res.routes[0].legs[0];
                speak(`Путь в ${destination} найден. Идти ${info.duration.text}. Я буду вести вас.`);
            } else {
                speak("Извините, пешеходный путь не найден.");
            }
        });
    });
}

// 4. УПРАВЛЕНИЕ КНОПКАМИ
document.getElementById('btn-ai').onclick = () => {
    navigator.vibrate(50);
    speak("Куда вы хотите пойти?");
    recognition.start();
};

recognition.onresult = (e) => {
    const address = e.results[0][0].transcript;
    findPedestrianPath(address);
};

// ЗАПУСК ПРИЛОЖЕНИЯ
window.onload = async () => {
    initMap();
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    document.getElementById('video').srcObject = stream;
    await initGuideMeVision();
};
