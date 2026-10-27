
const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const speakBtn = document.getElementById("speakBtn");
const captureBtn = document.getElementById("captureBtn");

const statusText = document.getElementById("status");
const message = document.getElementById("message");
const placeholder = document.getElementById("placeholder");
const resultsList = document.getElementById("resultsList");
const objectCount = document.getElementById("objectCount");

let model = null;
let stream = null;
let running = false;
let busy = false;
let predictions = [];
let lastSpoken = "";

const names = {
  person: "persona",
  bottle: "botella",
  cup: "taza",
  chair: "silla",
  cell_phone: "celular",
  laptop: "computadora portátil",
  book: "libro",
  backpack: "mochila",
  handbag: "bolso",
  dog: "perro",
  cat: "gato",
  bird: "pájaro",
  car: "automóvil",
  bicycle: "bicicleta",
  motorcycle: "motocicleta",
  bus: "autobús",
  truck: "camión",
  banana: "plátano",
  apple: "manzana",
  orange: "naranja",
  pizza: "pizza",
  keyboard: "teclado",
  mouse: "ratón",
  remote: "control remoto",
  tv: "televisor",
  clock: "reloj",
  scissors: "tijeras",
  umbrella: "paraguas",
  suitcase: "maleta",
  potted_plant: "planta en maceta",
  teddy_bear: "oso de peluche",
  sports_ball: "pelota"
};

function labelFor(className) {
  return names[className] || className.replace(/_/g, " ");
}

async function loadAI() {
  try {
    statusText.textContent = "Cargando IA...";
    message.textContent =
      "Descargando el modelo de reconocimiento. Espera un momento.";

    model = await cocoSsd.load();

    statusText.textContent = "IA preparada";
    message.textContent =
      "Sistema listo. Pulsa Activar cámara para comenzar.";
    startBtn.disabled = false;
  } catch (error) {
    console.error(error);
    statusText.textContent = "Error";
    message.textContent =
      "No se pudo cargar la IA. Revisa tu conexión a internet y recarga.";
    startBtn.disabled = true;
  }
}

async function startCamera() {
  if (!model) {
    message.textContent = "Espera a que la IA termine de cargar.";
    return;
  }

  try {
    startBtn.disabled = true;
    message.textContent = "Solicitando permiso para la cámara...";

    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    });

    video.srcObject = stream;
    await video.play();

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    running = true;
    placeholder.hidden = true;
    stopBtn.disabled = false;
    speakBtn.disabled = false;
    captureBtn.disabled = false;

    statusText.textContent = "Cámara activa";
    message.textContent = "Analizando lo que ve la cámara...";
    detectLoop();
  } catch (error) {
    console.error(error);
    statusText.textContent = "Cámara no disponible";
    message.textContent =
      "No se pudo abrir la cámara. Revisa los permisos del navegador.";
    startBtn.disabled = false;
  }
}

async function detectLoop() {
  if (!running || busy || video.readyState < 2) {
    if (running) requestAnimationFrame(detectLoop);
    return;
  }

  busy = true;

  try {
    // La IA analiza el fotograma actual.
    const found = await model.detect(video);

    predictions = found.filter(item => item.score >= 0.50);

    // Limpiar los recuadros anteriores.
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar un recuadro por cada objeto detectado.
    for (const item of predictions) {
      const [x, y, w, h] = item.bbox;
      const label = labelFor(item.class);

      ctx.strokeStyle = "#55f5dc";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      const text = `${label} ${Math.round(item.score * 100)}%`;
      ctx.font = "bold 15px Arial";

      const textWidth = ctx.measureText(text).width;
      const labelY = Math.max(0, y - 27);

      ctx.fillStyle = "#55f5dc";
      ctx.fillRect(x, labelY, textWidth + 14, 25);

      ctx.fillStyle = "#08121d";
      ctx.fillText(text, x + 7, labelY + 17);
    }

    updateResults();
  } catch (error) {
    console.error("Error al analizar:", error);
  } finally {
    busy = false;
  }

  // Continuar analizando mientras la cámara esté activa.
  if (running) {
    setTimeout(detectLoop, 150);
  }
}

function updateResults() {
  const count = predictions.length;
  objectCount.textContent =
    `${count} ${count === 1 ? "objeto" : "objetos"}`;

  if (count === 0) {
    resultsList.innerHTML =
      '<p class="empty">No se reconocen objetos por ahora. Prueba con más luz.</p>';
    return;
  }

  // Mostrar los resultados sin insertar texto externo como HTML.
  resultsList.replaceChildren();

  predictions.forEach(item => {
    const row = document.createElement("div");
    row.className = "result-item";

    const name = document.createElement("strong");
    name.textContent = labelFor(item.class);

    const confidence = document.createElement("small");
    confidence.textContent =
      `${Math.round(item.score * 100)}% de confianza`;

    row.append(name, confidence);
    resultsList.appendChild(row);
  });
}

function speakResults() {
  if (!predictions.length) {
    message.textContent = "Todavía no hay objetos que leer.";
    return;
  }

  if (!("speechSynthesis" in window)) {
    message.textContent =
      "Este navegador no admite la función de voz.";
    return;
  }

  window.speechSynthesis.cancel();

  const uniqueNames = [...new Set(
    predictions.map(item => labelFor(item.class))
  )];

  const phrase = "La cámara reconoce: " + uniqueNames.join(", ");
  lastSpoken = phrase;

  const utterance = new SpeechSynthesisUtterance(phrase);
  utterance.lang = "es-ES";
  utterance.rate = 0.95;

  window.speechSynthesis.speak(utterance);
}

function captureImage() {
  if (!stream || video.readyState < 2) return;

  // Crear una imagen combinando cámara y recuadros.
  const output = document.createElement("canvas");
  output.width = video.videoWidth;
  output.height = video.videoHeight;

  const outputCtx = output.getContext("2d");
  outputCtx.drawImage(video, 0, 0, output.width, output.height);
  outputCtx.drawImage(canvas, 0, 0);

  const link = document.createElement("a");
  link.download = "ojos-ia-captura.png";
  link.href = output.toDataURL("image/png");
  link.click();

  message.textContent = "Captura preparada para guardar.";
}

function stopCamera() {
  running = false;

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  video.srcObject = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  predictions = [];

  placeholder.hidden = false;
  stopBtn.disabled = true;
  speakBtn.disabled = true;
  captureBtn.disabled = true;
  startBtn.disabled = !model;

  statusText.textContent = model ? "IA preparada" : "Cargando IA";
  message.textContent = "Cámara detenida.";
  objectCount.textContent = "0 objetos";
  resultsList.replaceChildren();

  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = "Todavía no hay objetos detectados.";
  resultsList.appendChild(empty);

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);
speakBtn.addEventListener("click", speakResults);
captureBtn.addEventListener("click", captureImage);

// Iniciar la carga de la inteligencia artificial.
startBtn.disabled = true;
loadAI();
