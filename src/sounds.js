// ============================================================
//  SONIDOS (síntesis con Web Audio API)
//  No usamos archivos de audio: generamos cada sonido en vivo
//  con osciladores y ruido. Así funciona offline y no pesa nada.
//
//  Nota: los navegadores no dejan sonar audio hasta que el usuario
//  interactúa. Por eso llamamos a `desbloquear()` en el primer
//  click o tecla.
// ============================================================

let ctx = null;

function contexto() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return ctx;
}

// Debe llamarse ante la primera interacción del usuario.
export function desbloquear() {
  const c = contexto();
  if (c.state === 'suspended') c.resume();
}

// Helper: crea un oscilador con envolvente (ataque + caída) y lo conecta.
function tono({ freq, tipo = 'sine', duracion = 0.2, volumen = 0.3, inicio = 0, freqFinal = null }) {
  const c = contexto();
  const t0 = c.currentTime + inicio;
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqFinal !== null) {
    osc.frequency.exponentialRampToValueAtTime(freqFinal, t0 + duracion);
  }

  // Envolvente: sube rápido y decae suave.
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volumen, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duracion);

  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duracion + 0.02);
}

// Helper: ráfaga de ruido blanco (para la explosión / hinchada).
function ruido({ duracion = 0.5, volumen = 0.4, tipoFiltro = 'lowpass', freqFiltro = 1000, inicio = 0 }) {
  const c = contexto();
  const t0 = c.currentTime + inicio;
  const cantidad = Math.floor(c.sampleRate * duracion);
  const buffer = c.createBuffer(1, cantidad, c.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < cantidad; i++) datos[i] = Math.random() * 2 - 1;

  const fuente = c.createBufferSource();
  fuente.buffer = buffer;

  const filtro = c.createBiquadFilter();
  filtro.type = tipoFiltro;
  filtro.frequency.value = freqFiltro;

  const gain = c.createGain();
  gain.gain.setValueAtTime(volumen, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duracion);

  fuente.connect(filtro).connect(gain).connect(c.destination);
  fuente.start(t0);
  fuente.stop(t0 + duracion);
}

// --- Sonidos del juego ---

// Silbato del árbitro: tono agudo con un trino.
export function silbato() {
  desbloquear();
  tono({ freq: 2100, tipo: 'square', duracion: 0.12, volumen: 0.18 });
  tono({ freq: 2300, tipo: 'square', duracion: 0.18, volumen: 0.18, inicio: 0.14 });
}

// Pase: blip corto y alegre.
export function pase() {
  desbloquear();
  tono({ freq: 500, tipo: 'triangle', duracion: 0.12, volumen: 0.25, freqFinal: 900 });
}

// Salto: "boing" corto que sube de tono.
export function salto() {
  desbloquear();
  tono({ freq: 300, tipo: 'sine', duracion: 0.18, volumen: 0.22, freqFinal: 700 });
}

// Gol: arpegio ascendente + rugido de la hinchada.
export function gol() {
  desbloquear();
  const notas = [392, 523, 659, 784, 1047]; // sol - do - mi - sol - do (ascendente)
  notas.forEach((f, i) => {
    tono({ freq: f, tipo: 'sawtooth', duracion: 0.35, volumen: 0.22, inicio: i * 0.08 });
  });
  // "hinchada": ruido suave que crece.
  ruido({ duracion: 1.2, volumen: 0.25, tipoFiltro: 'bandpass', freqFiltro: 700 });
}

// Explosión: golpe grave + ráfaga de ruido.
export function explosion() {
  desbloquear();
  tono({ freq: 120, tipo: 'sine', duracion: 0.5, volumen: 0.5, freqFinal: 40 });
  ruido({ duracion: 0.6, volumen: 0.5, tipoFiltro: 'lowpass', freqFiltro: 800 });
}
