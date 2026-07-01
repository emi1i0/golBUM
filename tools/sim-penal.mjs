// ============================================================
//  SIMULADOR DEL PENAL
//
//  El evento final: al tocar al delantero, hay que convertir un
//  penal. Una MIRA barre el arco, un ARQUERO patrulla y se estira,
//  y el jugador patea (ESPACIO) hacia donde está la mira. El arquero
//  reacciona y se lanza; si llega, ataja. Hay varios intentos hasta
//  que se acaba el tiempo del penal.
//
//  Este simulador modela un "jugador AI" (con error humano) y corre
//  miles de penales por nivel para verificar que:
//    - el penal sea GANABLE con juego decente (no un muro de suerte),
//    - la dificultad CREZCA por nivel de forma pareja,
//    - un jugador flojo la pase peor que uno bueno (que haya skill).
//
//  Cómo correrlo:   node tools/sim-penal.mjs
//
//  Modelo de un intento:
//   - El arquero arranca casi centrado (leve vaivén) y REACCIONA: tras
//     `reaccion`, se lanza hacia el tiro a `keeperVel` durante el vuelo.
//     Cubre `maxMov = keeperVel * (flightTime - reaccion)` a cada lado.
//   - La ZONA SEGURA es la franja del arco que el arquero NO alcanza:
//     |shot| > maxMov + saveReach (desde donde está). Cuanto más rápido
//     el arquero, más angosta esa franja => hay que pegarle más al palo.
//   - El AI apunta al CENTRO de la franja segura y patea cuando la mira
//     pasa por ahí. Un retardo de reacción humano corre la mira mientras
//     "aprieta" => mira más rápida = más error. Skill = precisión.
//   - Si el tiro se va del arco (|x| > medio ancho) => afuera.
// ============================================================
import * as CONF from '../src/config.js';

const W = CONF.GOAL_WIDTH / 2; // medio ancho del arco (centro de los postes en ±W)
// Gol LIMPIO: la pelota (radio BALL_RADIUS) pasa por dentro del poste (radio POSTE_RADIO).
//  |x| <= CLEAR  => gol (si el arquero no llega)
//  CLEAR < |x| < W => PALO (la pelota pega en el poste, no es gol)
//  |x| >= W       => AFUERA
const CLEAR = W - CONF.POSTE_RADIO - CONF.BALL_RADIUS;

// Ruido gaussiano (Box-Muller).
function gauss(sigma) {
  const u = 1 - Math.random();
  const v = Math.random();
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Perfiles de jugador: el skill es la PRECISIÓN (latencia de reacción =>
// cuánto se corre la mira al apretar). Ambos apuntan al centro de la franja
// segura; el flojo reacciona más tarde y con más varianza => más error.
//  timingSigma: error de timing (segundos). El error de posición del tiro es
//  velMira × timingSigma => mira más rápida castiga más al impreciso.
//  reaccionHumana: cuánto tarda en apretar (solo consume tiempo del penal).
const PERFILES = {
  bueno: { timingSigma: 0.02, reaccionHumana: 0.12 },
  flojo: { timingSigma: 0.06, reaccionHumana: 0.18 },
};

// Arquero: casi centrado (vaivén mínimo). No se pre-compromete a un lado;
// su fuerza es la reacción al tiro, no adivinar.
function arqueroEn(t, fase) {
  return 0.5 * Math.sin(2 * t + fase);
}

// Simula UN penal completo (modelo por INTENTOS). Devuelve { gol, intentos, tiempo }.
//  Cada intento: el jugador lleva la mira a una esquina (tarda ~aimWait) y patea
//  con error de timing ∝ velocidad de la mira; el arquero reacciona desde donde
//  está. Si no es gol, resetea y reintenta hasta agotar el tiempo del penal.
function simularPenal(cfg, perfil) {
  const p = PERFILES[perfil];
  const maxMov = cfg.keeperVel * Math.max(0, CONF.PENAL.flightTime - CONF.PENAL.reaccion);
  const aimWait = W / cfg.reticuleVel; // ~ tiempo medio en llevar la mira al objetivo
  const faseArq = Math.random() * Math.PI * 2;
  let t = 0;
  let intentos = 0;

  while (true) {
    t += aimWait; // el jugador espera a que la mira llegue a la esquina
    if (t > cfg.tiempo) break;
    intentos++;

    const kx0 = arqueroEn(t, faseArq); // arquero al momento del tiro
    // Apuntar al centro de la franja convertible [safeLow, CLEAR] del lado opuesto
    // al leve leaning del arquero. safeLow = lo que el arquero alcanza desde el centro.
    const lado = kx0 >= 0 ? -1 : 1;
    const safeLow = maxMov + CONF.PENAL.saveReach;
    let objetivoMag = (safeLow + CLEAR) / 2;
    if (objetivoMag > CLEAR - 0.05) objetivoMag = CLEAR - 0.05; // sin franja: al borde del palo
    const objetivo = lado * objetivoMag;

    const shotX = objetivo + cfg.reticuleVel * gauss(p.timingSigma);
    t += p.reaccionHumana + CONF.PENAL.flightTime;

    const ax = Math.abs(shotX);
    let resultado; // 'gol' | 'atajado' | 'palo' | 'afuera'
    if (ax >= W) {
      resultado = 'afuera';
    } else if (ax > CLEAR) {
      resultado = 'palo';
    } else {
      const kxFinal = kx0 + Math.max(-maxMov, Math.min(maxMov, shotX - kx0));
      resultado = Math.abs(kxFinal - shotX) < CONF.PENAL.saveReach ? 'atajado' : 'gol';
    }

    if (resultado === 'gol') {
      return { gol: true, intentos, tiempo: Math.min(t, cfg.tiempo) };
    }
    t += CONF.PENAL.resetDelay;
    if (t > cfg.tiempo) break;
  }
  return { gol: false, intentos, tiempo: cfg.tiempo };
}

// Corre N penales y agrega estadísticas.
function correr(cfg, perfil, n = 20000) {
  let goles = 0;
  let sumInt = 0; // intentos de TODOS los penales (para ver si hay reintentos)
  let sumT = 0;
  for (let i = 0; i < n; i++) {
    const r = simularPenal(cfg, perfil);
    sumInt += r.intentos;
    if (r.gol) {
      goles++;
      sumT += r.tiempo;
    }
  }
  return {
    prob: goles / n,
    intProm: sumInt / n,
    tProm: goles ? sumT / goles : 0,
  };
}

console.log('\n=== SIMULADOR DE PENAL (20k tiros por celda) ===\n');
console.log('Nivel | tiempo | mira | arquero || P(gol) bueno  int  t  | P(gol) flojo  int  t');
console.log('------+--------+------+---------++---------------------------+--------------------');
for (let i = 0; i < CONF.LEVELS.length; i++) {
  const cfg = CONF.penalDeNivel(i);
  const b = correr(cfg, 'bueno');
  const f = correr(cfg, 'flojo');
  const pct = (x) => `${(x * 100).toFixed(0)}%`.padStart(4);
  console.log(
    `  ${i + 1}   |  ${cfg.tiempo.toFixed(1)}   | ${cfg.reticuleVel.toFixed(1)} |  ${cfg.keeperVel.toFixed(1)}    ||   ${pct(b.prob)}  ${b.intProm.toFixed(1)}  ${b.tProm.toFixed(1)}s |   ${pct(f.prob)}  ${f.intProm.toFixed(1)}  ${f.tProm.toFixed(1)}s`
  );
}
console.log('');
