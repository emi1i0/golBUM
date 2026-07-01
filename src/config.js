// ============================================================
//  CONFIGURACIÓN DEL JUEGO
//  Todos los "números mágicos" viven acá para que puedas
//  tunear el juego sin tocar la lógica.
// ============================================================

// --- Cancha ---
export const FIELD_HALF_X = 22;   // ancho de la cancha (mitad, hacia cada lado)
export const FIELD_HALF_Z = 45;   // largo de la cancha (mitad, hacia cada extremo)

// --- Arco (está en el extremo -Z) ---
export const GOAL_Z = -42;        // posición del arco sobre el eje Z
export const GOAL_WIDTH = 16;     // ancho entre los postes (de centro a centro de poste)
export const GOAL_HEIGHT = 6;     // alto del arco
export const POSTE_RADIO = 0.3;   // radio de los postes (para la detección de gol/palo)

// --- Pelota ---
export const BALL_RADIUS = 1;
export const BALL_SPEED = 20;     // velocidad MÁXIMA al controlarla (unidades/seg)
// Inercia: qué tan rápido la pelota alcanza/pierde velocidad.
// Más alto = más responsiva; más bajo = más "patinadora".
export const BALL_ACCEL = 8;      // aceleración al apretar una tecla
export const BALL_FRICTION = 3;   // frenado al soltar (baja => se desliza más)
export const JUMP_SPEED = 14;     // impulso vertical del salto (alto)
export const GRAVITY = 55;        // gravedad alta => salto "seco", arco corto y contundente
export const SALTO_COOLDOWN = 1.3; // segundos que tarda en recargarse la estamina de salto

// --- Cámara (offset relativo a la pelota: arriba y atrás) ---
export const CAMERA_OFFSET = { x: 0, y: 15, z: 19 };
export const CAMERA_LERP = 0.07;  // 0 = no sigue, 1 = pegada. Suavidad del seguimiento.

// --- Jugadores / pases ---
export const INFLUENCE_RADIUS = 3.5; // qué tan cerca hay que estar para "tocar" al compañero

// --- Penal (el evento final: tocás al delantero y hay que convertir) ---
//  Al llegar al delantero, la escena pasa a modo penal: la pelota va al punto,
//  una MIRA barre el arco y un ARQUERO se estira para atajar. Apretás ESPACIO
//  para patear hacia donde está la mira. Tenés varios intentos hasta que se
//  acabe el `tiempo` del penal.
export const PENAL = {
  spot: { x: 0, z: GOAL_Z + 11 }, // punto de penal (frente al arco)
  flightTime: 0.5,   // segundos que tarda el disparo en llegar a la línea
  netDepth: 2.6,     // cuánto entra la pelota a la red en un gol (profundidad)
  saveReach: 2.4,    // alcance del arquero (medio cuerpo + estirada) para atajar
  reaccion: 0.15,    // demora de reacción del arquero antes de lanzarse
  reticuleBase: 7,   // velocidad de barrido de la mira (unidades/seg), nivel 1
  keeperBase: 6,     // velocidad del arquero al estirarse (unidades/seg), nivel 1
  tiempoBase: 9,     // segundos para convertir el penal (varios intentos), nivel 1
  resetDelay: 0.6,   // pausa tras una atajada antes de rearmar el próximo tiro
};

// Dificultad del penal según el índice de nivel (0..). El arquero y la mira se
// aceleran y baja el tiempo. Afinado con `node tools/sim-penal.mjs`.
export function penalDeNivel(i) {
  return {
    keeperVel: PENAL.keeperBase + i * 0.7,     // arquero más rápido (achica el ángulo)
    reticuleVel: PENAL.reticuleBase + i * 0.8, // mira más veloz => timing más difícil
    tiempo: Math.max(6, PENAL.tiempoBase - i * 0.5),
  };
}

// ============================================================
//  NIVELES
//  Cada nivel define:
//    - time:       tiempo límite en segundos
//    - ballStart:  dónde arranca la pelota
//    - teammates:  compañeros EN ORDEN (el ÚLTIMO es el DELANTERO)
//    - obstacles:  obstáculos SÓLIDOS que hay que SALTAR (barra espaciadora).
//                  Tocarlos en el piso = explota la pelota.
//                    · 'valla': barra que cruza TODA la cancha (solo se pasa saltando).
//                    · 'cono':  obstáculo puntual (podés esquivarlo o saltarlo).
//    - rivals:     defensores que se MUEVEN. Tocarlos = explota la pelota.
//                    · patrulla: { eje: 'x'|'z', rango, velocidad } (vaivén con sin()).
//                    · persecución: { persigue: true, velocidad } (va hacia la pelota).
//  La dificultad crece: más pases, obstáculos y rivales, menos tiempo.
// ============================================================
export const LEVELS = [
  {
    nombre: 'Calentando',
    time: 5, // óptimo ~3.4s × 1.3
    ballStart: { x: 0, z: 38 },
    teammates: [
      { x: 5, z: 20 },
      { x: -6, z: 0 },
      { x: 0, z: -28 }, // delantero
    ],
    obstacles: [
      { tipo: 'valla', z: 30 }, // primera valla para aprender a saltar
    ],
    rivals: [],
  },
  {
    nombre: 'Jugada de laboratorio',
    time: 8, // óptimo ~6.0s × 1.3
    ballStart: { x: 0, z: 40 },
    teammates: [
      { x: -10, z: 28 },
      { x: 11, z: 14 },
      { x: -12, z: -2 },
      { x: 10, z: -16 },
      { x: -2, z: -31 }, // delantero
    ],
    obstacles: [
      { tipo: 'valla', z: 21 },
      { tipo: 'cono', x: 0, z: 6 },
      { tipo: 'valla', z: -9 },
    ],
    rivals: [
      { x: -2, z: 22, eje: 'x', rango: 10, velocidad: 2 },
      { x: 0, z: -20, eje: 'x', rango: 12, velocidad: 2.4 },
    ],
  },
  {
    nombre: 'Zigzag imposible',
    time: 10, // óptimo ~7.5s × 1.3
    ballStart: { x: 0, z: 40 },
    teammates: [
      { x: 14, z: 26 },
      { x: -15, z: 12 },
      { x: 15, z: -4 },
      { x: -14, z: -18 },
      { x: 2, z: -32 }, // delantero
    ],
    obstacles: [
      { tipo: 'valla', z: 33 },
      { tipo: 'cono', x: 0, z: 19 },
      { tipo: 'valla', z: 4 },
      { tipo: 'cono', x: 0, z: -11 },
    ],
    rivals: [
      { x: 0, z: 18, eje: 'x', rango: 14, velocidad: 2.8 },
      { x: 0, z: -2, eje: 'z', rango: 8, velocidad: 3 },
      { x: 0, z: -24, eje: 'x', rango: 14, velocidad: 3.4 },
    ],
  },
  {
    nombre: 'Marcaje personal',
    time: 10, // óptimo ~7.0s × 1.3
    ballStart: { x: 0, z: 40 },
    teammates: [
      { x: 10, z: 26 },
      { x: -11, z: 10 },
      { x: 11, z: -8 },
      { x: -8, z: -22 },
      { x: 0, z: -32 }, // delantero
    ],
    obstacles: [
      { tipo: 'valla', z: 32 },
      { tipo: 'valla', z: -2 },
    ],
    rivals: [
      // Tres que te PERSIGUEN: marcaje encima.
      { x: 6, z: 16, persigue: true, velocidad: 9 },
      { x: 0, z: 2, persigue: true, velocidad: 10.5 },
      { x: -6, z: -14, persigue: true, velocidad: 10 },
    ],
  },
  {
    nombre: 'Final infernal',
    time: 11, // óptimo ~8.4s × 1.3
    ballStart: { x: 0, z: 40 },
    teammates: [
      { x: 13, z: 27 },
      { x: -14, z: 13 },
      { x: 14, z: -3 },
      { x: -13, z: -17 },
      { x: 3, z: -31 }, // delantero
    ],
    obstacles: [
      { tipo: 'valla', z: 34 },
      { tipo: 'cono', x: 0, z: 21 },
      { tipo: 'valla', z: 8 },
      { tipo: 'valla', z: -14 },
    ],
    rivals: [
      { x: 0, z: 20, eje: 'x', rango: 16, velocidad: 3.2 }, // patrulla
      { x: 6, z: 0, persigue: true, velocidad: 11 },        // persigue
      { x: 8, z: 10, persigue: true, velocidad: 12 },       // persigue (nuevo marcaje)
      { x: -6, z: -24, persigue: true, velocidad: 12 },     // persigue rápido
    ],
  },
  {
    nombre: 'Infierno total',
    time: 13, // óptimo ~9.5s × 1.3
    ballStart: { x: 0, z: 40 },
    teammates: [
      { x: -15, z: 28 },
      { x: 15, z: 15 },
      { x: -15, z: 1 },
      { x: 14, z: -13 },
      { x: -9, z: -23 },
      { x: 2, z: -32 }, // delantero
    ],
    obstacles: [
      { tipo: 'valla', z: 34 },
      { tipo: 'cono', x: 0, z: 22 },
      { tipo: 'valla', z: 8 },
      { tipo: 'valla', z: -9 },
      { tipo: 'cono', x: 0, z: -18 },
    ],
    rivals: [
      { x: 0, z: 24, eje: 'x', rango: 16, velocidad: 3.6 }, // patrulla ancha
      { x: 8, z: 8, persigue: true, velocidad: 11 },
      { x: -8, z: -5, persigue: true, velocidad: 12 },
      { x: 6, z: -24, persigue: true, velocidad: 13 },      // el más rápido
    ],
  },
];
