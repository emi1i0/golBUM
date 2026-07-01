// ============================================================
//  GolBUM — El pase contrarreloj
//  Juego arcade en tercera persona hecho con Three.js.
//
//  FLUJO: controlás la pelota con WASD, tenés que llegar a cada
//  compañero en orden (pases) antes de que se acabe el tiempo.
//  Al tocar al DELANTERO, la pelota sale disparada sola al arco
//  => GOL EXPLOSIVO. Si el tiempo llega a 0 antes => EXPLOSIÓN.
// ============================================================

import * as THREE from 'three';
import * as CONF from './config.js';
import { ParticleBurst } from './particles.js';
import * as Sonido from './sounds.js';

// ------------------------------------------------------------
//  MUNDO: escena, cámara, renderer, luces
// ------------------------------------------------------------
const canvas = document.querySelector('#escena');

const escena = new THREE.Scene();
escena.background = new THREE.Color(0x88c6ff); // cielo celeste
escena.fog = new THREE.Fog(0x88c6ff, 60, 140); // difumina lo lejano

const camara = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Luz ambiente suave + un "sol" que proyecta sombras.
escena.add(new THREE.AmbientLight(0xffffff, 0.6));
const sol = new THREE.DirectionalLight(0xffffff, 1.8);
sol.position.set(20, 40, 20);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
sol.shadow.camera.left = -60;
sol.shadow.camera.right = 60;
sol.shadow.camera.top = 60;
sol.shadow.camera.bottom = -60;
sol.shadow.camera.far = 120;
escena.add(sol);

// ------------------------------------------------------------
//  TEXTURAS PROCEDURALES (dibujadas en un <canvas> en memoria)
// ------------------------------------------------------------

// Césped con franjas de "cortado de pasto".
function crearTexturaCancha() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 512;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#2f9e44' : '#37b24d';
    ctx.fillRect(0, i * 32, 64, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  return tex;
}

// Pelota blanca con manchas negras (para que se note al rodar).
function crearTexturaPelota() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#111111';
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const r = 8 + Math.random() * 10;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

// ------------------------------------------------------------
//  CANCHA + LÍNEAS
// ------------------------------------------------------------
const cancha = new THREE.Mesh(
  new THREE.PlaneGeometry(CONF.FIELD_HALF_X * 2, CONF.FIELD_HALF_Z * 2),
  new THREE.MeshStandardMaterial({ map: crearTexturaCancha() })
);
cancha.rotation.x = -Math.PI / 2; // acostamos el plano sobre XZ
cancha.receiveShadow = true;
escena.add(cancha);

// Helper: una barra blanca finita apoyada en el piso (para las líneas).
function barraBlanca(ancho, largo, x, z) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(ancho, largo),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.02, z); // apenas arriba del césped para que no parpadee
  escena.add(m);
  return m;
}

const G = 0.25; // grosor de las líneas
// Perímetro
barraBlanca(CONF.FIELD_HALF_X * 2, G, 0, CONF.FIELD_HALF_Z - 1);
barraBlanca(CONF.FIELD_HALF_X * 2, G, 0, -CONF.FIELD_HALF_Z + 1);
barraBlanca(G, CONF.FIELD_HALF_Z * 2, CONF.FIELD_HALF_X - 1, 0);
barraBlanca(G, CONF.FIELD_HALF_Z * 2, -CONF.FIELD_HALF_X + 1, 0);
// Línea de mitad de cancha
barraBlanca(CONF.FIELD_HALF_X * 2, G, 0, 0);
// Círculo central
const circulo = new THREE.Mesh(
  new THREE.RingGeometry(6, 6 + G, 48),
  new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
);
circulo.rotation.x = -Math.PI / 2;
circulo.position.y = 0.02;
escena.add(circulo);
// Área penal (frente al arco, en -Z)
const areaZ = CONF.GOAL_Z + 12;
barraBlanca(24, G, 0, areaZ); // frente del área
barraBlanca(G, 12, -12, CONF.GOAL_Z + 6); // lado izq
barraBlanca(G, 12, 12, CONF.GOAL_Z + 6); // lado der

// ------------------------------------------------------------
//  ARCO + RED
// ------------------------------------------------------------
const grupoArco = new THREE.Group();
const matPoste = new THREE.MeshStandardMaterial({ color: 0xffffff });
const radioPoste = 0.3;
const medioAncho = CONF.GOAL_WIDTH / 2;

// Postes verticales
for (const signo of [-1, 1]) {
  const poste = new THREE.Mesh(
    new THREE.CylinderGeometry(radioPoste, radioPoste, CONF.GOAL_HEIGHT, 12),
    matPoste
  );
  poste.position.set(signo * medioAncho, CONF.GOAL_HEIGHT / 2, CONF.GOAL_Z);
  poste.castShadow = true;
  grupoArco.add(poste);
}
// Travesaño horizontal
const travesano = new THREE.Mesh(
  new THREE.CylinderGeometry(radioPoste, radioPoste, CONF.GOAL_WIDTH, 12),
  matPoste
);
travesano.rotation.z = Math.PI / 2;
travesano.position.set(0, CONF.GOAL_HEIGHT, CONF.GOAL_Z);
travesano.castShadow = true;
grupoArco.add(travesano);

// Red: planos con wireframe para simular la malla.
const matRed = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  wireframe: true,
  transparent: true,
  opacity: 0.35,
});
const profundidadRed = 4;
// red del fondo
const redFondo = new THREE.Mesh(
  new THREE.PlaneGeometry(CONF.GOAL_WIDTH, CONF.GOAL_HEIGHT, 12, 6),
  matRed
);
redFondo.position.set(0, CONF.GOAL_HEIGHT / 2, CONF.GOAL_Z - profundidadRed);
grupoArco.add(redFondo);
// red de arriba (techo inclinado)
const redTecho = new THREE.Mesh(
  new THREE.PlaneGeometry(CONF.GOAL_WIDTH, profundidadRed, 12, 4),
  matRed
);
redTecho.rotation.x = -Math.PI / 2;
redTecho.position.set(0, CONF.GOAL_HEIGHT, CONF.GOAL_Z - profundidadRed / 2);
grupoArco.add(redTecho);
// redes laterales
for (const signo of [-1, 1]) {
  const lado = new THREE.Mesh(
    new THREE.PlaneGeometry(profundidadRed, CONF.GOAL_HEIGHT, 4, 6),
    matRed
  );
  lado.rotation.y = Math.PI / 2;
  lado.position.set(signo * medioAncho, CONF.GOAL_HEIGHT / 2, CONF.GOAL_Z - profundidadRed / 2);
  grupoArco.add(lado);
}
escena.add(grupoArco);

// ------------------------------------------------------------
//  PELOTA
// ------------------------------------------------------------
const pelota = new THREE.Mesh(
  new THREE.SphereGeometry(CONF.BALL_RADIUS, 32, 32),
  new THREE.MeshStandardMaterial({ map: crearTexturaPelota(), roughness: 0.5 })
);
pelota.castShadow = true;
escena.add(pelota);

// ------------------------------------------------------------
//  COMPAÑEROS (cápsulas). El último es el delantero.
//  Se reconstruyen en cada nivel porque cambian de posición.
// ------------------------------------------------------------
let companeros = [];

function construirCompaneros(lista) {
  // Sacar y liberar los compañeros del nivel anterior.
  companeros.forEach((c) => {
    escena.remove(c.mesh, c.anillo);
    c.mesh.geometry.dispose();
    c.mesh.material.dispose();
    c.anillo.geometry.dispose();
    c.anillo.material.dispose();
  });

  companeros = lista.map((p, i) => {
    const esDelantero = i === lista.length - 1;
    const colorBase = esDelantero ? 0xff6b35 : 0x4f9dff;

    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.7, 1.6, 6, 16),
      new THREE.MeshStandardMaterial({ color: colorBase })
    );
    mesh.position.set(p.x, 1.5, p.z);
    mesh.castShadow = true;
    escena.add(mesh);

    // Anillo indicador en el piso (se prende para el objetivo actual).
    const anillo = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.2, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffe14d,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
      })
    );
    anillo.rotation.x = -Math.PI / 2;
    anillo.position.set(p.x, 0.03, p.z);
    escena.add(anillo);

    return {
      mesh,
      anillo,
      pos: new THREE.Vector3(p.x, 1.5, p.z),
      esDelantero,
      alcanzado: false,
      colorBase,
    };
  });
}

// ------------------------------------------------------------
//  OBSTÁCULOS SÓLIDOS (conos y vallas). Hay que SALTARLOS.
//  Se reconstruyen en cada nivel.
// ------------------------------------------------------------
let obstaculos = [];

function construirObstaculos(lista = []) {
  obstaculos.forEach((o) => {
    escena.remove(o.mesh);
    o.mesh.geometry.dispose();
    o.mesh.material.dispose();
  });

  obstaculos = lista.map((def) => {
    let mesh, forma, radio, hx, hz;
    let tope; // altura que la parte de abajo de la pelota debe superar para pasar

    if (def.tipo === 'valla') {
      // Valla que cruza TODA la cancha: solo se pasa saltando.
      const anchoValla = (CONF.FIELD_HALF_X - 1) * 2;
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(anchoValla, 1.2, 0.6),
        new THREE.MeshStandardMaterial({ color: 0xffd400 })
      );
      mesh.position.set(0, 0.6, def.z); // siempre centrada (ocupa todo el ancho)
      forma = 'caja';
      hx = anchoValla / 2;
      hz = 0.3;
      tope = 1.2;
      def = { ...def, x: 0 };
    } else {
      // Cono naranja.
      mesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.8, 1.3, 16),
        new THREE.MeshStandardMaterial({ color: 0xff7b00 })
      );
      mesh.position.set(def.x, 0.65, def.z);
      forma = 'radial';
      radio = 0.8;
      tope = 1.3;
    }
    mesh.castShadow = true;
    escena.add(mesh);

    return { mesh, x: def.x, z: def.z, forma, radio, hx, hz, tope };
  });
}

// ------------------------------------------------------------
//  RIVALES (defensores que se mueven). Tocarlos = explota la pelota.
// ------------------------------------------------------------
let rivales = [];

function construirRivales(lista = []) {
  rivales.forEach((r) => {
    escena.remove(r.mesh);
    r.mesh.geometry.dispose();
    r.mesh.material.dispose();
  });

  rivales = lista.map((def) => {
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.8, 1.8, 6, 16),
      new THREE.MeshStandardMaterial({ color: 0xd11a2a })
    );
    mesh.position.set(def.x, 1.6, def.z);
    mesh.castShadow = true;
    escena.add(mesh);

    return {
      mesh,
      base: { x: def.x, z: def.z },
      persigue: def.persigue || false,
      eje: def.eje || 'x',
      rango: def.rango || 8,
      velocidad: def.velocidad || 2,
      fase: Math.random() * Math.PI * 2, // arrancan desfasados
    };
  });
}

// ------------------------------------------------------------
//  HUD (referencias al DOM)
// ------------------------------------------------------------
const hud = {
  temporizador: document.querySelector('#temporizador'),
  nivel: document.querySelector('#nivel'),
  progreso: document.querySelector('#progreso'),
  estaminaFill: document.querySelector('#estamina-fill'),
  flash: document.querySelector('#flash'),
  pantallaFin: document.querySelector('#pantalla-fin'),
  finTitulo: document.querySelector('#fin-titulo'),
  finSubtitulo: document.querySelector('#fin-subtitulo'),
  botonReiniciar: document.querySelector('#boton-reiniciar'),
};

// ------------------------------------------------------------
//  ESTADO DEL JUEGO
// ------------------------------------------------------------
let estado; // 'jugando' | 'disparando' | 'ganado' | 'perdido'
let nivelActual = 0; // índice dentro de CONF.LEVELS
let tiempoRestante;
let objetivoActual; // índice del compañero al que hay que llegar
let bursts = []; // explosiones de partículas activas
let dirTiro = new THREE.Vector3(); // dirección del tiro final
let tiempoExplosion = 0; // cronómetro de la animación de explosión
let tiempoVictoria = 0; // demora antes de mostrar el cartel de gol
let velX = 0; // velocidad horizontal en X (inercia)
let velZ = 0; // velocidad horizontal en Z (inercia)
let velY = 0; // velocidad vertical de la pelota (para el salto)
let enElSuelo = true; // ¿la pelota está tocando el piso?
let estamina = 1; // 0..1, recarga del salto (1 = lista para saltar)
let saltoArmado = true; // hay que soltar ESPACIO y volver a apretar (nada de mantener)

// Arranca (o reinicia) el nivel indicado por `nivelActual`.
function empezarNivel() {
  const nivel = CONF.LEVELS[nivelActual];

  estado = 'jugando';
  tiempoRestante = nivel.time;
  objetivoActual = 0;
  tiempoExplosion = 0;
  tiempoVictoria = 0;

  // Construir los compañeros, obstáculos y rivales de ESTE nivel.
  construirCompaneros(nivel.teammates);
  construirObstaculos(nivel.obstacles);
  construirRivales(nivel.rivals);

  // Pelota a su lugar inicial
  pelota.visible = true;
  pelota.position.set(nivel.ballStart.x, CONF.BALL_RADIUS, nivel.ballStart.z);
  pelota.scale.set(1, 1, 1);
  pelota.rotation.set(0, 0, 0);
  pelota.material.emissive?.setHex(0x000000);
  velX = 0;
  velZ = 0;
  velY = 0;
  enElSuelo = true;
  estamina = 1;
  saltoArmado = true;

  // Limpiar partículas
  bursts.forEach((b) => b.dispose());
  bursts = [];

  // HUD
  hud.flash.style.opacity = 0;
  hud.pantallaFin.classList.add('oculto');
  hud.pantallaFin.classList.remove('victoria', 'derrota');
  actualizarHUD();

  // Cámara pegada de entrada (sin transición al arrancar el nivel)
  colocarCamaraInstantanea();

  // ¡Pitazo inicial!
  Sonido.silbato();
}

// Reintentar el mismo nivel (tras perder).
function reintentar() {
  empezarNivel();
}

// Pasar al siguiente nivel, o volver al primero si ya era el último.
function avanzarNivel() {
  nivelActual = (nivelActual + 1) % CONF.LEVELS.length;
  empezarNivel();
}

function actualizarHUD() {
  hud.temporizador.textContent = Math.ceil(Math.max(0, tiempoRestante));
  hud.temporizador.classList.toggle('urgente', tiempoRestante <= 3);
  hud.nivel.textContent = `Nivel ${nivelActual + 1}: ${CONF.LEVELS[nivelActual].nombre}`;
  const total = companeros.length;
  hud.progreso.textContent = `Pase ${Math.min(objetivoActual + 1, total)} / ${total}`;
}

// ------------------------------------------------------------
//  INPUT (teclado)
// ------------------------------------------------------------
const teclas = new Set();
window.addEventListener('keydown', (e) => teclas.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => {
  teclas.delete(e.key.toLowerCase());
  // Al soltar ESPACIO, el salto queda "armado" para el próximo apretón.
  if (e.key === ' ') saltoArmado = true;
});

// El botón de fin de juego: si ganaste avanza de nivel, si perdiste reintenta.
hud.botonReiniciar.addEventListener('click', () => {
  Sonido.desbloquear();
  if (estado === 'ganado') avanzarNivel();
  else reintentar();
});

// Desbloquear el audio en la primera tecla (política de los navegadores).
window.addEventListener('keydown', () => Sonido.desbloquear(), { once: true });

// Evitamos que las flechas y el espacio hagan scroll de la página.
window.addEventListener('keydown', (e) => {
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
    e.preventDefault();
  }
});

// Devuelve el vector de movimiento (en XZ) según las teclas apretadas.
function leerDireccion() {
  const dir = new THREE.Vector3();
  if (teclas.has('w') || teclas.has('arrowup')) dir.z -= 1;    // hacia el arco
  if (teclas.has('s') || teclas.has('arrowdown')) dir.z += 1;
  if (teclas.has('a') || teclas.has('arrowleft')) dir.x -= 1;
  if (teclas.has('d') || teclas.has('arrowright')) dir.x += 1;
  if (dir.lengthSq() > 0) dir.normalize();
  return dir;
}

// ------------------------------------------------------------
//  MOVIMIENTO Y ROTACIÓN DE LA PELOTA
// ------------------------------------------------------------
// Hace rodar la pelota de forma realista según cuánto se movió.
function rodar(dx, dz) {
  const dist = Math.hypot(dx, dz);
  if (dist === 0) return;
  // El eje de giro es perpendicular al movimiento y horizontal.
  const eje = new THREE.Vector3(dz, 0, -dx).normalize();
  pelota.rotateOnWorldAxis(eje, dist / CONF.BALL_RADIUS);
}

function moverPelota(desplazamiento) {
  pelota.position.x += desplazamiento.x;
  pelota.position.z += desplazamiento.z;
  // No dejar que se salga de la cancha.
  const lim = CONF.BALL_RADIUS;
  pelota.position.x = THREE.MathUtils.clamp(
    pelota.position.x,
    -CONF.FIELD_HALF_X + 1 + lim,
    CONF.FIELD_HALF_X - 1 - lim
  );
  pelota.position.z = THREE.MathUtils.clamp(
    pelota.position.z,
    -CONF.FIELD_HALF_Z + 1 + lim,
    CONF.FIELD_HALF_Z - 1 - lim
  );
  rodar(desplazamiento.x, desplazamiento.z);
}

// ------------------------------------------------------------
//  CÁMARA (seguimiento suave)
// ------------------------------------------------------------
let sacudida = 0; // intensidad del "camera shake" (para el gol)

function posicionDeseadaCamara() {
  return new THREE.Vector3(
    pelota.position.x + CONF.CAMERA_OFFSET.x,
    CONF.CAMERA_OFFSET.y,
    pelota.position.z + CONF.CAMERA_OFFSET.z
  );
}

function colocarCamaraInstantanea() {
  camara.position.copy(posicionDeseadaCamara());
  camara.lookAt(pelota.position);
}

function actualizarCamara() {
  camara.position.lerp(posicionDeseadaCamara(), CONF.CAMERA_LERP);
  if (sacudida > 0) {
    camara.position.x += (Math.random() - 0.5) * sacudida;
    camara.position.y += (Math.random() - 0.5) * sacudida;
    sacudida *= 0.9; // se va calmando
  }
  camara.lookAt(pelota.position);
}

// ------------------------------------------------------------
//  TRANSICIONES DE ESTADO
// ------------------------------------------------------------
function iniciarTiro() {
  estado = 'disparando';
  hud.progreso.textContent = '¡AL ARCO!';
  hud.temporizador.classList.remove('urgente');
  // Aterrizamos la pelota para un tiro limpio.
  pelota.position.y = CONF.BALL_RADIUS;
  velY = 0;
  enElSuelo = true;
  // Dirección hacia el centro del arco.
  const destino = new THREE.Vector3(0, CONF.BALL_RADIUS, CONF.GOAL_Z);
  dirTiro.copy(destino).sub(pelota.position).normalize();
}

function marcarGol() {
  estado = 'ganado';
  tiempoVictoria = 0.8; // demora para disfrutar las partículas antes del cartel
  sacudida = 1.2;
  Sonido.gol();
  // Varias explosiones de colores en la red.
  const origen = new THREE.Vector3(0, CONF.GOAL_HEIGHT / 2, CONF.GOAL_Z - 2);
  const colores = [0x4dff88, 0xffe14d, 0x4f9dff, 0xff6b35, 0xffffff];
  colores.forEach((color, i) => {
    bursts.push(
      new ParticleBurst(escena, origen, {
        cantidad: 200,
        color,
        velocidad: 22 + i * 4,
        vida: 2,
      })
    );
  });
}

function perder() {
  estado = 'perdido';
  tiempoExplosion = 0;
  Sonido.explosion();
  // Flash rojo
  hud.flash.style.opacity = 0.7;
  pelota.material.emissive?.setHex(0xff0000);
  // Explosión de partículas rojas
  bursts.push(
    new ParticleBurst(escena, pelota.position.clone(), {
      cantidad: 250,
      color: 0xff3b3b,
      velocidad: 20,
      vida: 1.5,
    })
  );
}

function mostrarPantallaFin(victoria) {
  hud.pantallaFin.classList.remove('oculto');
  hud.pantallaFin.classList.add(victoria ? 'victoria' : 'derrota');

  const esUltimoNivel = nivelActual === CONF.LEVELS.length - 1;

  if (victoria) {
    if (esUltimoNivel) {
      hud.finTitulo.textContent = '¡CAMPEÓN!';
      hud.finSubtitulo.textContent = 'Completaste todos los niveles';
      hud.botonReiniciar.textContent = 'Jugar de nuevo';
    } else {
      hud.finTitulo.textContent = '¡GOOOL!';
      hud.finSubtitulo.textContent = 'Nivel Completado';
      hud.botonReiniciar.textContent = 'Siguiente nivel →';
    }
  } else {
    hud.finTitulo.textContent = 'GAME OVER';
    hud.finSubtitulo.textContent = 'Se acabó el tiempo';
    hud.botonReiniciar.textContent = 'Volver a intentar';
  }
}

// ------------------------------------------------------------
//  UPDATES POR ESTADO
// ------------------------------------------------------------
function updateJugando(dt) {
  // Tiempo
  tiempoRestante -= dt;
  if (tiempoRestante <= 0) {
    tiempoRestante = 0;
    actualizarHUD();
    perder();
    return;
  }

  // Movimiento horizontal (XZ) CON INERCIA.
  // La velocidad tiende suavemente a la velocidad "deseada" según las teclas.
  // Si hay input, acelera; si no, se desliza y frena por fricción.
  const dir = leerDireccion();
  const hayInput = dir.lengthSq() > 0;
  const objetivoVx = dir.x * CONF.BALL_SPEED;
  const objetivoVz = dir.z * CONF.BALL_SPEED;
  const ritmo = hayInput ? CONF.BALL_ACCEL : CONF.BALL_FRICTION;
  // Suavizado exponencial: independiente de los FPS.
  const k = 1 - Math.exp(-ritmo * dt);
  velX += (objetivoVx - velX) * k;
  velZ += (objetivoVz - velZ) * k;
  moverPelota({ x: velX * dt, z: velZ * dt });

  // Estamina de salto: se recarga con el tiempo.
  estamina = Math.min(1, estamina + dt / CONF.SALTO_COOLDOWN);

  // Salto (eje Y): seco, edge-triggered y con estamina llena.
  //  - saltoArmado: hay que soltar la tecla entre saltos (no sostener).
  //  - estamina >= 1: la barra tiene que estar llena (frena el bunny-hop).
  if (teclas.has(' ') && saltoArmado && enElSuelo && estamina >= 1) {
    velY = CONF.JUMP_SPEED;
    enElSuelo = false;
    saltoArmado = false;
    estamina = 0;
    Sonido.salto();
  }
  velY -= CONF.GRAVITY * dt;
  pelota.position.y += velY * dt;
  if (pelota.position.y <= CONF.BALL_RADIUS) {
    pelota.position.y = CONF.BALL_RADIUS;
    velY = 0;
    enElSuelo = true;
  }

  // Barra de estamina en el HUD.
  hud.estaminaFill.style.width = `${estamina * 100}%`;
  hud.estaminaFill.classList.toggle('lista', estamina >= 1);

  // Mover a los rivales: los que persiguen van hacia la pelota; el resto patrulla.
  const t = performance.now() / 1000;
  for (const r of rivales) {
    if (r.persigue) {
      const dx = pelota.position.x - r.mesh.position.x;
      const dz = pelota.position.z - r.mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.001) {
        r.mesh.position.x += (dx / d) * r.velocidad * dt;
        r.mesh.position.z += (dz / d) * r.velocidad * dt;
      }
    } else {
      const off = Math.sin(t * r.velocidad + r.fase) * r.rango;
      if (r.eje === 'z') r.mesh.position.z = r.base.z + off;
      else r.mesh.position.x = r.base.x + off;
    }
  }

  // Colisión con RIVALES: tocarlos (en XZ) = explota, sin importar la altura.
  for (const r of rivales) {
    const dx = pelota.position.x - r.mesh.position.x;
    const dz = pelota.position.z - r.mesh.position.z;
    if (Math.hypot(dx, dz) < 1.1 + CONF.BALL_RADIUS) {
      perder();
      return;
    }
  }

  // Colisión con OBSTÁCULOS sólidos: si estás abajo, explota; saltando, pasás.
  const abajoDeLaPelota = pelota.position.y - CONF.BALL_RADIUS;
  for (const o of obstaculos) {
    let chocaXZ;
    if (o.forma === 'radial') {
      const dx = pelota.position.x - o.x;
      const dz = pelota.position.z - o.z;
      chocaXZ = Math.hypot(dx, dz) < o.radio + CONF.BALL_RADIUS;
    } else {
      chocaXZ =
        Math.abs(pelota.position.x - o.x) < o.hx + CONF.BALL_RADIUS &&
        Math.abs(pelota.position.z - o.z) < o.hz + CONF.BALL_RADIUS;
    }
    if (chocaXZ && abajoDeLaPelota < o.tope - 0.15) {
      perder();
      return;
    }
  }

  // ¿Llegó al compañero objetivo? (distancia en XZ)
  const obj = companeros[objetivoActual];
  const dx = pelota.position.x - obj.pos.x;
  const dz = pelota.position.z - obj.pos.z;
  const distancia = Math.hypot(dx, dz);

  // Anillo del objetivo actual: latido
  obj.anillo.material.opacity = 0.5 + 0.3 * Math.sin(performance.now() / 200);
  obj.mesh.position.y = 1.5 + Math.sin(performance.now() / 250) * 0.15; // rebote

  if (distancia < CONF.INFLUENCE_RADIUS) {
    obj.alcanzado = true;
    obj.mesh.material.color.setHex(0x4dff88); // se pone verde
    obj.anillo.material.opacity = 0;
    obj.mesh.position.y = 1.5;

    if (obj.esDelantero) {
      iniciarTiro();
    } else {
      Sonido.pase();
      objetivoActual++;
    }
  }

  actualizarHUD();
}

function updateDisparando(dt) {
  moverPelota({
    x: dirTiro.x * CONF.SHOOT_SPEED * dt,
    z: dirTiro.z * CONF.SHOOT_SPEED * dt,
  });
  // ¿Cruzó la línea de gol dentro de los postes?
  if (pelota.position.z <= CONF.GOAL_Z && Math.abs(pelota.position.x) < medioAncho) {
    marcarGol();
  }
}

function updatePerdido(dt) {
  // La pelota crece rápido (explosión) y el flash rojo se apaga.
  tiempoExplosion += dt;
  const s = 1 + tiempoExplosion * 12;
  pelota.scale.set(s, s, s);
  hud.flash.style.opacity = Math.max(0, 0.7 - tiempoExplosion * 1.2);

  if (tiempoExplosion > 0.4 && hud.pantallaFin.classList.contains('oculto')) {
    pelota.visible = false;
    mostrarPantallaFin(false);
  }
}

function updateGanado(dt) {
  tiempoVictoria -= dt;
  if (tiempoVictoria <= 0 && hud.pantallaFin.classList.contains('oculto')) {
    mostrarPantallaFin(true);
  }
}

// ------------------------------------------------------------
//  BUCLE PRINCIPAL
// ------------------------------------------------------------
let ultimoTiempo = performance.now();

function loop(ahora) {
  requestAnimationFrame(loop);
  // dt = segundos desde el frame anterior (limitado por si hubo un freno).
  const dt = Math.min((ahora - ultimoTiempo) / 1000, 0.05);
  ultimoTiempo = ahora;

  if (estado === 'jugando') updateJugando(dt);
  else if (estado === 'disparando') updateDisparando(dt);
  else if (estado === 'perdido') updatePerdido(dt);
  else if (estado === 'ganado') updateGanado(dt);

  // Partículas (se actualizan siempre; se descartan las que terminaron).
  bursts = bursts.filter((b) => b.update(dt));

  actualizarCamara();
  renderer.render(escena, camara);
}

// ------------------------------------------------------------
//  RESPONSIVE
// ------------------------------------------------------------
window.addEventListener('resize', () => {
  camara.aspect = window.innerWidth / window.innerHeight;
  camara.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ------------------------------------------------------------
//  ¡ARRANCAR!
// ------------------------------------------------------------
empezarNivel();
loop(performance.now());
