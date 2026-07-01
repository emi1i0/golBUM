// ============================================================
//  SIMULADOR DE TIEMPOS POR NIVEL
//
//  Estima el tiempo ÓPTIMO para completar cada nivel (tocar al
//  delantero, que es cuando frena el reloj) y sugiere el tiempo
//  límite = óptimo × FACTOR.
//
//  Cómo correrlo:   node tools/sim-tiempos.mjs
//
//  Modelo:
//   - Un agente va en línea recta a máxima velocidad hacia cada
//     compañero y "corta" en cuanto entra al radio de influencia.
//   - Vallas: si dos cruces están más cerca que el cooldown de
//     estamina, el jugador debe esperar para volver a saltar
//     (se suma ese retraso real).
//   - Rivales: overhead fijo por esquivarlos (mayor si persiguen).
//
//  El FACTOR (1.3) es el margen sobre el run óptimo. Se fue bajando
//  tras playtesting (1.7 -> 1.5 -> 1.3) porque sobraba tiempo en
//  runs buenos. Con 1.3 quedan ~2s de colchón sobre el óptimo.
//  Subilo para hacer el juego más fácil, bajalo para exigir más.
// ============================================================
import * as CONF from '../src/config.js';

const FACTOR = 1.3;
const dt = 1 / 240;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function simularNivel(nivel) {
  const targets = nivel.teammates; // el último es el delantero (fin)
  const vallas = (nivel.obstacles || []).filter((o) => o.tipo === 'valla');

  const pos = { x: nivel.ballStart.x, z: nivel.ballStart.z };
  let vx = 0;
  let vz = 0; // velocidad con inercia (igual que en el juego)
  let ti = 0;
  let t = 0;
  let prevZ = pos.z;
  const cruces = []; // tiempos en que el agente cruza el z de una valla
  let guard = 0;

  while (ti < targets.length && guard < 2_000_000) {
    guard++;
    const target = targets[ti];
    const d = dist(pos, target);
    if (d <= CONF.INFLUENCE_RADIUS) {
      ti++;
      continue;
    }
    // Acelera hacia el objetivo con el mismo suavizado exponencial del juego.
    const objVx = ((target.x - pos.x) / d) * CONF.BALL_SPEED;
    const objVz = ((target.z - pos.z) / d) * CONF.BALL_SPEED;
    const k = 1 - Math.exp(-CONF.BALL_ACCEL * dt);
    vx += (objVx - vx) * k;
    vz += (objVz - vz) * k;
    pos.x += vx * dt;
    pos.z += vz * dt;
    t += dt;
    for (const v of vallas) {
      if ((prevZ - v.z) * (pos.z - v.z) < 0) cruces.push(t);
    }
    prevZ = pos.z;
  }

  // Retraso por estamina: saltos consecutivos separados >= SALTO_COOLDOWN.
  cruces.sort((a, b) => a - b);
  let delay = 0;
  let ultimoSalto = -CONF.SALTO_COOLDOWN; // el primer salto siempre está listo
  for (let c of cruces) {
    c += delay;
    const gap = c - ultimoSalto;
    if (gap < CONF.SALTO_COOLDOWN) {
      const add = CONF.SALTO_COOLDOWN - gap;
      delay += add;
      c += add;
    }
    ultimoSalto = c;
  }

  // Overhead por esquivar rivales.
  let overheadRivales = 0;
  for (const r of nivel.rivals || []) overheadRivales += r.persigue ? 0.6 : 0.3;

  const optimo = t + delay + overheadRivales;
  return { optimo, sugerido: Math.ceil(optimo * FACTOR) };
}

console.log(`\nFactor de margen: x${FACTOR}\n`);
console.log('Nivel | óptimo | sugerido | actual');
console.log('------+--------+----------+-------');
CONF.LEVELS.forEach((n, i) => {
  const r = simularNivel(n);
  const marca = r.sugerido === n.time ? '  ✓' : `  (config=${n.time})`;
  console.log(
    `  ${i + 1}   |  ${r.optimo.toFixed(2)}  |    ${r.sugerido}     |  ${n.time}${marca}  ${n.nombre}`
  );
});
console.log('');
