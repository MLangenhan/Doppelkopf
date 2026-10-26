import type { Card } from '@engine';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { renderCardCanvas } from '../lib/cardImages';
import { CARD_RATIO } from './PlayingCard';

// 3D-Szene für Login und Startseite: Karten schweben im Raum, Licht folgt der Maus.
// Liegt immer HINTER dem Inhalt (die Seite legt ihren Text darüber) und wird nachgeladen.

const CARD_W = 1.69;
const CARD_H = CARD_W * CARD_RATIO;

const HERO_CARDS: Card[] = ['H-10-0', 'C-Q-0', 'S-Q-0', 'D-A-0', 'C-J-0', 'H-Q-0', 'D-10-0', 'S-A-0', 'H-K-0', 'C-A-0'];
const BANNER_CARDS: Card[] = ['C-Q-0', 'H-10-0', 'D-A-0', 'S-Q-0', 'C-J-0', 'H-A-0', 'D-Q-0'];

interface Placement {
  base: THREE.Vector3;
  rot: THREE.Euler;
  phase: number;
}

function layout(variant: 'hero' | 'banner', n: number): Placement[] {
  return Array.from({ length: n }, (_, i) => {
    const phase = i * 1.37;
    if (variant === 'hero') {
      // Ring hinter dem Inhalt, leicht geneigt; die Gruppe dreht sich langsam
      const a = (i / n) * Math.PI * 2;
      return {
        base: new THREE.Vector3(Math.cos(a) * 5.2, Math.sin(a * 2) * 0.6, Math.sin(a) * 3.2 - 2),
        rot: new THREE.Euler(0.1 * Math.sin(phase), -a + Math.PI / 2, 0.25 * Math.cos(phase)),
        phase,
      };
    }
    // Banner: Fächer auf der rechten Seite
    const t = i / (n - 1) - 0.5;
    return {
      base: new THREE.Vector3(t * 4.2, -0.15 - Math.abs(t) * 0.8, -Math.abs(t) * 1.4),
      rot: new THREE.Euler(-0.12, -0.35 + t * 0.4, -t * 0.55),
      phase,
    };
  });
}

export default function CardScene({ variant }: { variant: 'hero' | 'banner' }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x10201a, 7, 17);
    const camera = new THREE.PerspectiveCamera(variant === 'hero' ? 40 : 32, 1, 0.1, 60);
    camera.position.set(0, 0, variant === 'hero' ? 10 : 6.5);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xfff1d6, 1.6);
    key.position.set(3, 4, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6aa8f0, 0.7);
    rim.position.set(-5, -2, -4);
    scene.add(rim);
    const glow = new THREE.PointLight(0xd9b45a, 14, 9, 1.6);
    glow.position.set(0, 0, 3);
    scene.add(glow);

    const faces = variant === 'hero' ? HERO_CARDS : BANNER_CARDS;
    const places = layout(variant, faces.length);
    const geometry = new THREE.PlaneGeometry(CARD_W, CARD_H);
    const materials: THREE.MeshStandardMaterial[] = [];
    const textures: THREE.Texture[] = [];
    const ring = new THREE.Group();
    if (variant === 'hero') ring.rotation.x = 0.22;
    scene.add(ring);

    const makeMaterial = () => {
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.05, alphaTest: 0.5 });
      materials.push(m);
      return m;
    };
    const cards = faces.map((_, i) => {
      const group = new THREE.Group();
      const front = new THREE.Mesh(geometry, makeMaterial());
      const back = new THREE.Mesh(geometry, makeMaterial());
      back.rotation.y = Math.PI;
      group.add(front, back);
      group.position.copy(places[i].base);
      group.rotation.copy(places[i].rot);
      group.scale.setScalar(0.001);
      ring.add(group);
      return { group, front, back };
    });

    const applyTexture = (canvas: HTMLCanvasElement, mat: THREE.MeshStandardMaterial) => {
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      textures.push(tex);
      mat.map = tex;
      mat.needsUpdate = true;
    };
    renderCardCanvas(null).then((c) => {
      if (!disposed) cards.forEach((card) => applyTexture(c, card.back.material as THREE.MeshStandardMaterial));
    });
    faces.forEach((f, i) =>
      renderCardCanvas(f).then((c) => {
        if (!disposed) applyTexture(c, cards[i].front.material as THREE.MeshStandardMaterial);
      }),
    );

    // Größe
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (variant === 'banner') {
        // Fächer ins rechte Drittel, egal wie breit das Banner ist
        const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
        ring.position.x = Math.max(1.5, halfW * 0.5);
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // Maus: Kamera und Licht folgen leicht
    const pointer = new THREE.Vector2(0, 0);
    const onPointer = (e: PointerEvent) => {
      pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    };
    window.addEventListener('pointermove', onPointer);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) return;
      const t = clock.getElapsedTime();

      if (variant === 'hero') ring.rotation.y = t * 0.07;
      cards.forEach(({ group }, i) => {
        const p = places[i];
        // Einflug: nacheinander aus der Tiefe nach oben
        const intro = THREE.MathUtils.clamp((t - 0.15 - i * 0.09) / 1.1, 0, 1);
        const ease = 1 - Math.pow(1 - intro, 3);
        group.scale.setScalar(Math.max(0.001, ease));
        group.position.set(
          p.base.x,
          p.base.y + Math.sin(t * 0.6 + p.phase) * 0.12 - (1 - ease) * 2.5,
          p.base.z,
        );
        group.rotation.set(
          p.rot.x + Math.sin(t * 0.4 + p.phase) * 0.06,
          p.rot.y + Math.sin(t * 0.3 + p.phase) * 0.12,
          p.rot.z + Math.cos(t * 0.5 + p.phase) * 0.04,
        );
      });

      camera.position.x += (pointer.x * 0.9 - camera.position.x) * 0.04;
      camera.position.y += (pointer.y * 0.55 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
      glow.position.x += (pointer.x * 5 - glow.position.x) * 0.06;
      glow.position.y += (pointer.y * 3 - glow.position.y) * 0.06;

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      textures.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
      geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [variant]);

  return <div ref={hostRef} className="pointer-events-none absolute inset-0" aria-hidden />;
}
