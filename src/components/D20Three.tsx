import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { D20Theme } from '../../shared/types';

type Face = {
  normal: THREE.Vector3;
  center: THREE.Vector3;
  quaternion: THREE.Quaternion;
};

type SimulationState = {
  startedAt: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  quaternion: THREE.Quaternion;
  angularVelocity: THREE.Vector3;
  settlePosition: THREE.Vector3 | null;
  settleQuaternion: THREE.Quaternion | null;
  finalQuaternion: THREE.Quaternion;
};

const FLOOR_Y = -1.72;
const LEFT_WALL = -4.35;
const RIGHT_WALL = 4.35;
const SETTLE_START = 0.72;

function faceData() {
  const geometry = new THREE.IcosahedronGeometry(1, 0).toNonIndexed();
  const position = geometry.getAttribute('position');
  const faces: Face[] = [];

  for (let i = 0; i < position.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(position, i);
    const b = new THREE.Vector3().fromBufferAttribute(position, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(position, i + 2);
    const center = a.clone().add(b).add(c).divideScalar(3);
    const normal = center.clone().normalize();
    faces.push({
      center: center.multiplyScalar(1.012),
      normal,
      quaternion: new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        normal,
      ),
    });
  }

  geometry.dispose();
  return faces;
}

function numberTexture(value: number, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.font = '900 116px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 10;
  ctx.fillText(String(value), 128, 136);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const palettes: Record<
  D20Theme,
  { surface: string; edge: string; number: string; emissive: string }
> = {
  neon_arcane: {
    surface: '#4c1d95',
    edge: '#c084fc',
    number: '#fff7c2',
    emissive: '#5b21b6',
  },
  classic_polyhedral: {
    surface: '#6b451f',
    edge: '#e8c27a',
    number: '#fff4d6',
    emissive: '#2a1708',
  },
  holographic_scifi: {
    surface: '#063b52',
    edge: '#67e8f9',
    number: '#e6feff',
    emissive: '#075985',
  },
};

function seededRandom(seedText: string) {
  let seed = 2166136261;
  for (const char of seedText) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSimulation(result: number, rollKey: string, faces: Face[]): SimulationState {
  const random = seededRandom(`${rollKey}:${result}`);
  const target = new THREE.Quaternion().setFromUnitVectors(
    faces[result - 1].normal,
    new THREE.Vector3(0, 0, 1),
  );
  const finalYaw = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    (random() - 0.5) * Math.PI * 1.4,
  );
  const finalQuaternion = finalYaw.multiply(target);

  return {
    startedAt: performance.now(),
    position: new THREE.Vector3(-3.6 + random() * 1.2, 2.45 + random() * 0.75, 0),
    velocity: new THREE.Vector3(5.2 + random() * 2.1, 2.1 + random() * 1.7, 0),
    quaternion: new THREE.Quaternion().setFromEuler(
      new THREE.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI),
    ),
    angularVelocity: new THREE.Vector3(
      9 + random() * 8,
      11 + random() * 9,
      8 + random() * 7,
    ),
    settlePosition: null,
    settleQuaternion: null,
    finalQuaternion,
  };
}

function rotateByAngularVelocity(
  quaternion: THREE.Quaternion,
  angularVelocity: THREE.Vector3,
  dt: number,
) {
  const speed = angularVelocity.length();
  if (speed < 0.0001) return;
  const delta = new THREE.Quaternion().setFromAxisAngle(
    angularVelocity.clone().normalize(),
    speed * dt,
  );
  quaternion.premultiply(delta).normalize();
}

function Die({
  result,
  theme,
  durationMs,
  rollKey,
  onLanded,
}: {
  result: number;
  theme: D20Theme;
  durationMs: number;
  rollKey: string;
  onLanded: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const reported = useRef(false);
  const faces = useMemo(faceData, []);
  const palette = palettes[theme];
  const textures = useMemo(
    () => faces.map((_, index) => numberTexture(index + 1, palette.number)),
    [faces, palette.number],
  );
  const simulation = useRef(buildSimulation(result, rollKey, faces));

  useEffect(() => {
    simulation.current = buildSimulation(result, rollKey, faces);
    reported.current = false;
  }, [faces, result, rollKey]);

  useEffect(
    () => () => {
      textures.forEach((texture) => texture.dispose());
    },
    [textures],
  );

  useFrame((_, frameDelta) => {
    const die = group.current;
    if (!die) return;

    const sim = simulation.current;
    const raw = Math.min(
      1,
      (performance.now() - sim.startedAt) / Math.max(1, durationMs),
    );

    if (raw < SETTLE_START) {
      const dt = Math.min(frameDelta, 1 / 30);
      sim.velocity.y -= 9.8 * dt;
      sim.position.addScaledVector(sim.velocity, dt);
      rotateByAngularVelocity(sim.quaternion, sim.angularVelocity, dt);

      if (sim.position.x <= LEFT_WALL || sim.position.x >= RIGHT_WALL) {
        sim.position.x = THREE.MathUtils.clamp(sim.position.x, LEFT_WALL, RIGHT_WALL);
        sim.velocity.x *= -0.72;
        sim.angularVelocity.multiplyScalar(0.92);
      }

      if (sim.position.y <= FLOOR_Y) {
        sim.position.y = FLOOR_Y;
        sim.velocity.y = Math.abs(sim.velocity.y) * 0.48;
        sim.velocity.x *= 0.82;
        sim.angularVelocity.multiplyScalar(0.76);
        sim.angularVelocity.z += sim.velocity.x * 0.16;
      }
    } else {
      if (!sim.settlePosition) {
        sim.settlePosition = sim.position.clone();
        sim.settleQuaternion = sim.quaternion.clone();
      }
      const settleRaw = (raw - SETTLE_START) / (1 - SETTLE_START);
      const ease = 1 - Math.pow(1 - settleRaw, 4);
      const hop = Math.sin(settleRaw * Math.PI * 2.2) * (1 - ease) * 0.2;
      sim.position.lerpVectors(
        sim.settlePosition,
        new THREE.Vector3(0, -0.08, 0),
        ease,
      );
      sim.position.y += hop;
      sim.quaternion.slerpQuaternions(
        sim.settleQuaternion!,
        sim.finalQuaternion,
        ease,
      );
    }

    die.position.copy(sim.position);
    die.quaternion.copy(sim.quaternion);

    if (shadow.current) {
      const height = Math.max(0, sim.position.y - FLOOR_Y);
      const scale = 0.82 + Math.min(1.3, height * 0.18);
      shadow.current.position.x = sim.position.x;
      shadow.current.scale.set(scale, 0.45 * scale, 1);
      const material = shadow.current.material as THREE.MeshBasicMaterial;
      material.opacity = THREE.MathUtils.clamp(0.34 - height * 0.055, 0.08, 0.34);
    }

    if (raw >= 1 && !reported.current) {
      reported.current = true;
      onLanded();
    }
  });

  return (
    <>
      <mesh ref={shadow} position={[0, FLOOR_Y - 0.76, -0.35]} renderOrder={0}>
        <circleGeometry args={[0.78, 40]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <group ref={group}>
        <mesh>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={palette.surface}
            emissive={palette.emissive}
            emissiveIntensity={0.32}
            metalness={0.52}
            roughness={0.28}
            flatShading
          />
        </mesh>
        {faces.map((face, index) => (
          <mesh
            key={index}
            position={face.center}
            quaternion={face.quaternion}
            renderOrder={2}
          >
            <planeGeometry args={[0.48, 0.48]} />
            <meshBasicMaterial
              map={textures[index]}
              transparent
              depthWrite={false}
              polygonOffset
              polygonOffsetFactor={-3}
            />
          </mesh>
        ))}
        <lineSegments>
          <edgesGeometry args={[new THREE.IcosahedronGeometry(1.002, 0)]} />
          <lineBasicMaterial color={palette.edge} />
        </lineSegments>
      </group>
    </>
  );
}

export function D20Three({
  result,
  theme,
  durationMs,
  rollKey,
  onLanded,
}: {
  result: number;
  theme: D20Theme;
  durationMs: number;
  rollKey: string;
  onLanded: () => void;
}) {
  return (
    <div className="d20-three" role="img" aria-label={`D20 result ${result}`}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 8.4], fov: 42 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        fallback={null}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[4, 5, 6]} intensity={3.2} />
        <pointLight position={[-4, -2, 3]} intensity={2.2} color="#67e8f9" />
        <Die
          result={result}
          theme={theme}
          durationMs={durationMs}
          rollKey={rollKey}
          onLanded={onLanded}
        />
      </Canvas>
    </div>
  );
}
