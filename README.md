# ⚽ GolBUM — El pase contrarreloj

Juego arcade 3D en tercera persona hecho con [Three.js](https://threejs.org/)
y [Vite](https://vitejs.dev/).

Controlás una pelota de fútbol. Tenés que ir tocando a cada compañero
**en orden** (los pases) antes de que se acabe el tiempo, hasta llegar
al **delantero**. Ahí se define un **PENAL**: cronometrás una mira que
barre el arco y pateás para meter el **gol explosivo**, esquivando al
arquero. Si el reloj llega a 0 antes... 💥 explota todo.

## Cómo jugar

```bash
npm install   # solo la primera vez
npm run dev
```

Abrí la URL que aparece en la terminal (normalmente `http://localhost:5173`).

### Controles

- **W A S D** o **flechas** → mover la pelota por la cancha.
- **ESPACIO** → saltar. Es un salto **seco** (no se mantiene: soltá y volvé a
  apretar) y consume la **barra de estamina**: solo saltás con la barra llena
  (verde). Esto evita el bunny-hop.
- Llevá la pelota hasta el compañero marcado con el **anillo amarillo**.
- Cuando toques al **delantero** (la cápsula naranja), arranca el **penal**:
  una **mira luminosa** barre el arco de lado a lado. Apretá **ESPACIO** en el
  momento justo para patear hacia ahí. El **arquero** (cápsula celeste) se
  lanza a atajar, así que buscá el ángulo. Si te la atajan o tirás afuera,
  la pelota vuelve y podés patear de nuevo hasta que se acabe el tiempo del penal.
- El botón **"Volver a intentar"** reinicia el nivel.

### Obstáculos

- 🟡 **Vallas**: cruzan **toda la cancha**, así que **solo se pasan saltando**.
- 🟠 **Conos**: obstáculos puntuales; los podés esquivar o saltar.
- Tocar cualquiera de los dos en el piso hace **explotar** la pelota.
- 🔴 **Rivales** (cápsulas rojas): en los primeros niveles **patrullan** de un
  lado a otro; en los últimos te **persiguen**. Si te tocan, la pelota
  **explota** al instante → hay que **esquivarlos**.

## Reglas

- ⏱️ Cada nivel tiene su propio tiempo límite (configurable) para llegar al delantero.
- ✅ **Victoria:** gol explosivo con partículas de colores → pasás al siguiente nivel.
- 💥 **Derrota:** si se acaba el tiempo, la pelota explota con un
  flash rojo y aparece "GAME OVER".

## Niveles

El juego tiene **varios niveles** con dificultad creciente (más pases,
más lejos, menos tiempo). Al completar uno pasás al siguiente; al
terminar el último aparece la pantalla de **¡CAMPEÓN!**. Todos los
niveles se definen en `src/config.js` dentro del array `LEVELS`:
podés agregar, sacar o reordenar niveles libremente.

## Sonido

Los efectos (silbato inicial, pase, gol con hinchada, explosión) se
generan por **síntesis en vivo** con la Web Audio API (`src/sounds.js`),
así que no hay archivos de audio y funciona offline. El audio se
activa con tu primera tecla o click (política de los navegadores).

## Estructura del código

```
.
├── index.html          # HUD (contador, mensajes) + <canvas>
├── src/
│   ├── main.js          # mundo, cámara, input, máquina de estados y game loop
│   ├── config.js        # números tuneables + definición de NIVELES
│   ├── particles.js     # sistema de partículas (explosiones)
│   ├── sounds.js        # efectos de sonido sintetizados (Web Audio API)
│   └── style.css        # estilos del HUD
└── package.json
```

## Para tunear el juego

Casi todo se cambia desde **`src/config.js`** sin tocar la lógica:

| Constante          | Qué controla                                  |
| ------------------ | --------------------------------------------- |
| `LEVELS`           | los niveles: tiempo, arranque y compañeros    |
| `BALL_SPEED`       | velocidad de la pelota al controlarla         |
| `PENAL`            | parámetros del penal (arquero, mira, tiempo)  |
| `INFLUENCE_RADIUS` | qué tan cerca hay que estar para "pasar"      |
| `CAMERA_OFFSET`    | ángulo/altura de la cámara                    |
| `CAMERA_LERP`      | qué tan suave sigue la cámara (0–1)           |

Cada entrada de `LEVELS` tiene:

- `time` — segundos del nivel.
- `ballStart` — dónde sale la pelota.
- `teammates` — compañeros en orden (el último es el delantero).
- `obstacles` — conos/vallas a saltar (`{ tipo: 'cono' | 'valla', x, z }`).
- `rivals` — defensores que se mueven (`{ x, z, eje: 'x' | 'z', rango, velocidad }`).

Copiá una entrada y modificala para crear un nivel nuevo.

**El `time` no se pone a ojo:** corré `node tools/sim-tiempos.mjs`, que simula
un run óptimo del nivel y sugiere el tiempo límite (óptimo × `1.3`, el factor que
modela el colchón para un jugador promedio). Cambiaste posiciones/obstáculos/rivales
→ volvé a correrlo y copiá el valor sugerido.

**El penal también se balancea con simulación:** `node tools/sim-penal.mjs` corre
miles de penales por nivel (con un "jugador" bueno y uno flojo) y reporta la
probabilidad de gol, los intentos y el tiempo usado. Sirve para tunear `PENAL` y
`penalDeNivel()` sin que ningún nivel quede imposible ni regalado.

## Ideas para seguir

- Poner obstáculos o rivales que te bloqueen el camino.
- Reemplazar las cápsulas por modelos 3D reales (`.glb`).
- Guardar el récord de tiempo por nivel.

## Comandos

| Comando           | Qué hace                                     |
| ----------------- | -------------------------------------------- |
| `npm run dev`     | Servidor de desarrollo con recarga en vivo   |
| `npm run build`   | Build de producción en `dist/`               |
| `npm run preview` | Previsualiza el build de producción          |
