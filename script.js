let map, model, userMarker;
const aiStatus = document.getElementById('ai-status');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// 1. ГОЛОСОВОЙ ПОМОЩНИК
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'ru-RU';

function speak(text) {
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'ru-RU';
    window.speechSynthesis.speak(speech);
    aiStatus.innerText = text;
}

// 2. БЕСПЛАТНАЯ КАРТА
function initMap() {
    map = L.map('map', { zoomControl: false }).setView([42.8747, 74.6122], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    userMarker = L.circleMarker([42.8747, 74.6122], { radius: 10, color: '#FFD700', fillColor: '#007AFF', fillOpacity: 1 }).addTo(map);
}

// 3. ЗРЕНИЕ И СВЕТОФОР
async function initVision() {
    model = await cocoSsd.load();
    detectLoop();
}

async function detectLoop() {
    if (model && video.readyState === 4) {
        const predictions = await model.detect(video);
        
        predictions.forEach(p => {
            if (p.score > 0.6) {
                // Если ИИ увидел светофор
                if (p.class === 'traffic light') {
                    const color = analyzeTrafficLightColor(p.bbox);
                    if (color === 'red') {
                        navigator.vibrate([400, 100, 400]);
                        speak("Впереди светофор. Горит красный. Остановитесь.");
                    } else if (color === 'green') {
                        speak("Светофор зеленый. Можно переходить.");
                    }
                } 
                // Другие объекты
                else if (['car', 'bus'].includes(p.class)) {
                    navigator.vibrate(500);
                    speak("Осторожно, машина.");
                } else if (p.class === 'person') {
                    navigator.vibrate(100);
                    speak("Впереди пешеход.");
                }
            }
        });
    }
    requestAnimationFrame(detectLoop);
}

// Функция анализа цвета внутри рамки светофора
function analyzeTrafficLightColor(bbox) {
    const [x, y, width, height] = bbox;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Берем пиксели из области, где ИИ нашел светофор
    const imageData = ctx.getImageData(x, y, width, height).data;
    let redCount = 0;
    let greenCount = 0;

    for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i+1];
        const b = imageData[i+2];

        if (r > 150 && g < 100 && b < 100) redCount++;
        if (g > 150 && r < 100 && b < 150) greenCount++;
    }

    if (redCount > greenCount && redCount > 20) return 'red';
    if (greenCount > redCount && greenCount > 20) return 'green';
    return 'unknown';
}

// 4. ПЕШЕХОДНАЯ НАВИГАЦИЯ
async function findPath(destination) {
    speak("Ищу путь в " + destination);
    const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${destination},Бишкек`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();

    if (geoData.length > 0) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const start = [pos.coords.longitude, pos.coords.latitude];
            const end = [geoData[0].lon, geoData[0].lat];
            const routeUrl = `https://router.project-osrm.org/route/v1/foot/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`;
            const routeRes = await fetch(routeUrl);
            const routeData = await routeRes.json();

            if (routeData.routes.length > 0) {
                if (window.routeLine) map.removeLayer(window.routeLine);
                window.routeLine = L.geoJSON(routeData.routes[0].geometry, { style: { color: '#FFD700', weight: 8 } }).addTo(map);
                map.fitBounds(window.routeLine.getBounds());
                speak("Путь найден. Следуйте по маршруту.");
            }
        });
    } else {
        speak("Место не найдено.");
    }
}

// УПРАВЛЕНИЕ
document.getElementById('btn-ai').onclick = () => {
    navigator.vibrate(50);
    speak("Куда вы хотите пойти?");
    recognition.start();
};

recognition.onresult = (e) => findPath(e.results[0][0].transcript);

window.onload = async () => {
    initMap();
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = stream;
    await initVision();
};
