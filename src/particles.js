import * as THREE from 'three';

// ============================================================
//  ParticleBurst
//  Una explosión de partículas que salen disparadas desde un
//  punto y se van apagando. Se usa tanto para el GOL como para
//  la explosión de derrota (solo cambia el color).
// ============================================================
export class ParticleBurst {
  /**
   * @param {THREE.Scene} escena  escena donde dibujar
   * @param {THREE.Vector3} origen  desde dónde explota
   * @param {object} opciones  { cantidad, color, velocidad, vida }
   */
  constructor(escena, origen, opciones = {}) {
    const {
      cantidad = 300,
      color = 0xffffff,
      velocidad = 25,
      vida = 1.5, // segundos que dura la explosión
    } = opciones;

    this.escena = escena;
    this.vidaMax = vida;
    this.vida = vida;
    this.velocidades = [];

    // Cada partícula es un punto. Guardamos sus posiciones en un buffer.
    const posiciones = new Float32Array(cantidad * 3);
    for (let i = 0; i < cantidad; i++) {
      posiciones[i * 3 + 0] = origen.x;
      posiciones[i * 3 + 1] = origen.y;
      posiciones[i * 3 + 2] = origen.z;

      // Dirección aleatoria en una esfera (explosión hacia todos lados).
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();
      // Un poco de variación en la velocidad de cada partícula.
      this.velocidades.push(dir.multiplyScalar(velocidad * (0.4 + Math.random() * 0.8)));
    }

    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));

    this.material = new THREE.PointsMaterial({
      color,
      size: 0.5,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending, // se ven brillantes al superponerse
    });

    this.puntos = new THREE.Points(geometria, this.material);
    // Todas las partículas nacen en el mismo punto, así que la esfera de
    // recorte queda diminuta en el origen y Three podría "cullear" (ocultar)
    // la explosión entera al dispersarse. La desactivamos: siempre se dibuja.
    this.puntos.frustumCulled = false;
    escena.add(this.puntos);
  }

  /**
   * Actualiza la explosión. Devuelve false cuando ya terminó
   * (para que quien la creó la pueda descartar).
   */
  update(dt) {
    this.vida -= dt;
    if (this.vida <= 0) {
      this.dispose();
      return false;
    }

    const posiciones = this.puntos.geometry.attributes.position.array;
    for (let i = 0; i < this.velocidades.length; i++) {
      const v = this.velocidades[i];
      posiciones[i * 3 + 0] += v.x * dt;
      posiciones[i * 3 + 1] += v.y * dt;
      posiciones[i * 3 + 2] += v.z * dt;

      // Gravedad: las partículas caen un poco.
      v.y -= 20 * dt;
    }
    this.puntos.geometry.attributes.position.needsUpdate = true;

    // Se van desvaneciendo a medida que se acaba la vida.
    this.material.opacity = this.vida / this.vidaMax;
    return true;
  }

  dispose() {
    this.escena.remove(this.puntos);
    this.puntos.geometry.dispose();
    this.material.dispose();
  }
}
