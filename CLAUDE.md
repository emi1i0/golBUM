# CLAUDE.md

Guía para trabajar en este repo con Claude Code.

## Qué es

**GolBUM** — juego arcade 3D en tercera persona hecho con **Three.js** + **Vite**
(JavaScript vanilla, sin framework, ES modules). El jugador controla una pelota
de fútbol con WASD (y salta con ESPACIO), va tocando compañeros en orden (pases)
contrarreloj hasta el delantero, que dispara al arco para el "gol explosivo".
Si se acaba el tiempo —o toca un obstáculo/rival— la pelota explota. Tiene varios
niveles de dificultad creciente con obstáculos (conos/vallas a saltar) y rivales
que se mueven (tocarlos = derrota).

## Comandos

```bash
npm install      # dependencias (primera vez)
npm run dev      # servidor de desarrollo con hot-reload (http://localhost:5173)
npm run build    # build de producción en dist/
npm run preview  # previsualizar el build
```

No hay tests ni linter configurados. Para validar cambios, `npm run build` compila
todos los módulos y falla ante errores de import/sintaxis.

## Estructura

```
index.html        # HUD (contador, nivel, progreso, pantallas de fin) + <canvas>
src/
  main.js         # TODO el juego: mundo, cámara, input, máquina de estados, game loop
  config.js       # constantes tuneables + array LEVELS (niveles)
  particles.js    # clase ParticleBurst (explosiones de partículas)
  sounds.js       # efectos sintetizados con Web Audio API (sin archivos)
  style.css       # estilos del HUD (overlay 2D sobre el canvas 3D)
tools/
  sim-tiempos.mjs # simulador que calcula el tiempo límite justo por nivel
```

## Arquitectura y convenciones

- **Idioma:** todo el código, comentarios e identificadores están en **español**
  (ej. `pelota`, `companeros`, `empezarNivel`, `sacudida`). Mantener esa convención.
- **Máquina de estados** en `main.js`: `estado` ∈ `'jugando' | 'disparando' | 'ganado' | 'perdido'`.
  El `loop()` delega a `updateJugando/Disparando/Perdido/Ganado` según el estado.
- **Game loop** basado en `requestAnimationFrame` con delta-time (`dt`) limitado a
  0.05s. Todo el movimiento se escala por `dt` (unidades/segundo).
- **Coordenadas:** cancha sobre el plano XZ. El arco está en **-Z** (`GOAL_Z`).
  La pelota arranca en +Z y avanza hacia -Z. `y` es la altura.
- **Cámara:** seguimiento suave con `lerp` (no OrbitControls). Offset y suavidad en
  `config.js` (`CAMERA_OFFSET`, `CAMERA_LERP`). `sacudida` da el "camera shake" del gol.
- **Movimiento con inercia:** la pelota NO se mueve a velocidad instantánea. Mantiene
  una velocidad (`velX`/`velZ`) que tiende a la deseada con suavizado exponencial
  (`1 - e^(-ritmo·dt)`, independiente de FPS): acelera con `BALL_ACCEL` al haber input
  y frena con `BALL_FRICTION` al soltar (glide). `BALL_SPEED` es el tope de velocidad.
- **Detección de pases:** por distancia en XZ contra el compañero objetivo
  (`INFLUENCE_RADIUS`), no hay motor de física. El tiro final y la detección de gol
  también son cinemática simple + chequeo de línea de gol.
- **Salto:** física vertical propia (`velY` + `GRAVITY` alta = arco seco), solo eje Y.
  Es edge-triggered (`saltoArmado`: hay que soltar ESPACIO entre saltos) y gasta una
  **estamina** (`estamina` 0..1, recarga en `SALTO_COOLDOWN`); solo se salta con la
  barra llena. El HUD tiene una barra (`#estamina-fill`, clase `.lista` cuando está full).
- **Obstáculos y rivales:** se reconstruyen por nivel (`construirObstaculos` /
  `construirRivales`) igual que los compañeros. Vallas (`tipo:'valla'`) cruzan TODO el
  ancho (solo se pasan saltando); conos (`tipo:'cono'`) son puntuales. Explotan la
  pelota si la tocás con la parte de abajo por debajo de su `tope` (sin saltar). Los
  rivales o patrullan con `sin()` sobre un eje, o **persiguen** la pelota si
  `persigue:true` (velocidad en unidades/seg); explotan al tocarlos en XZ a cualquier
  altura. Todas las colisiones se chequean en `updateJugando`.
- **Sin assets externos:** las texturas (césped, pelota) se dibujan en un `<canvas>`
  en memoria (`crearTexturaCancha`, `crearTexturaPelota`) y los sonidos se sintetizan.
- **HUD:** es DOM/CSS (elementos en `index.html`), no se dibuja en el canvas. `main.js`
  guarda referencias en el objeto `hud` y las actualiza.

## Cómo hacer cambios comunes

- **Ajustar dificultad / agregar niveles:** editar `LEVELS` en `config.js`. Cada nivel
  es `{ nombre, time, ballStart, teammates, obstacles, rivals }`; el ÚLTIMO teammate es
  el delantero. No hace falta tocar la lógica: se reconstruye todo por nivel.
- **Calcular el `time` de cada nivel:** NO ponerlo a ojo. Correr `node tools/sim-tiempos.mjs`,
  que simula un run óptimo (con inercia y estamina) y sugiere `time = óptimo × FACTOR`.
  El `FACTOR` está en `1.3` (afinado por playtesting: deja ~2s de colchón sobre el óptimo).
  Tras cambiar posiciones/obstáculos/rivales de un nivel, volver a correrlo y copiar el
  valor sugerido al `time` del nivel. Cambiar el `FACTOR` reajusta la dificultad global.
- **Velocidades, cámara, tamaño de cancha, arco:** constantes en `config.js`.
- **Nuevos efectos de sonido:** agregar funciones en `sounds.js` usando los helpers
  `tono()` / `ruido()`; llamarlas desde las transiciones de estado en `main.js`.
- **Nuevos efectos visuales de partículas:** instanciar `ParticleBurst` y hacer push
  al array `bursts` (se actualiza y descarta solo en el loop).

## Notas / gotchas

- El **audio** no suena hasta la primera interacción del usuario (política de los
  navegadores). `Sonido.desbloquear()` se llama en el primer keydown/click.
- Al **perder**, la pelota se oculta (`pelota.visible = false`); `empezarNivel()` la
  vuelve a mostrar. Cuidado al agregar lógica que dependa de la visibilidad.
- El botón de la pantalla de fin es **contextual**: avanza de nivel si `estado === 'ganado'`,
  reintenta si no. La pantalla final del último nivel muestra "¡CAMPEÓN!".
- `dist/` es temporal (está en `.gitignore`); no commitear.
