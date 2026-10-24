import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { seededRandom } from '../../shared/random.js';
import { dieTopology } from './topology.js';

export interface DieSample { position: THREE.Vector3; rotation: THREE.Quaternion }
export interface PreparedD20Roll { samples: DieSample[]; faceValues: number[]; topFace: number }
const up = new THREE.Vector3(0, 1, 0);

// The game server owns the result. This simulation only supplies a repeatable
// visual throw. Clients in the same space share the path and numbered faces.
export function prepareD20Roll(result: number, rollId: string, space: 'tray' | 'board' = 'tray'): PreparedD20Roll {
  if (!Number.isInteger(result) || result < 1 || result > 20) throw new RangeError('D20 result must be 1–20.');
  const { vertices, faces, normals, opposite, inradius } = dieTopology;
  const rng = seededRandom(`${rollId}:${result}`), random = () => rng.next();
  const board = space === 'board', halfWidth = board ? 9 : 2.8, halfDepth = board ? 5 : 2.4;
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -28, 0), allowSleep: true });
  (world.solver as CANNON.GSSolver).iterations = 18;
  const material = new CANNON.Material();
  world.addContactMaterial(new CANNON.ContactMaterial(material, material, { friction: board ? .2 : .34, restitution: board ? .48 : .36 }));
  function plane(x: number, z: number, rx: number, ry: number) {
    const wall = new CANNON.Body({ mass: 0, material, shape: new CANNON.Plane() });
    wall.position.set(x, 0, z); wall.quaternion.setFromEuler(rx, ry, 0); world.addBody(wall);
  }
  plane(0, 0, -Math.PI / 2, 0);
  plane(-halfWidth, 0, 0, Math.PI / 2); plane(halfWidth, 0, 0, -Math.PI / 2);
  plane(0, -halfDepth, 0, 0); plane(0, halfDepth, Math.PI, 0);
  const body = new CANNON.Body({ mass: 1, material,
    shape: new CANNON.ConvexPolyhedron({ vertices: vertices.map(v => new CANNON.Vec3(v.x, v.y, v.z)), faces }),
    linearDamping: board ? .15 : .23, angularDamping: .25, sleepSpeedLimit: .12, sleepTimeLimit: .65 });
  world.addBody(body);
  const snapshot = (): DieSample => ({ position: new THREE.Vector3(body.position.x, body.position.y, body.position.z), rotation: new THREE.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w) });
  let samples: DieSample[] = [], topFace = 0, alignment = -1;
  for (let attempt = 0; attempt < 5; attempt++) {
    body.wakeUp();
    if (board) {
      const side = random() < .5 ? -1 : 1;
      body.position.set(side * (halfWidth - 1.1), 2.4 + random(), (random() - .5) * 5.6);
      body.velocity.set(-side * (40 + random() * 12), 1 + random() * 3, (random() < .5 ? -1 : 1) * (10 + random() * 10));
    } else {
      body.position.set((random() - .5) * 2, 3.4 + random(), (random() - .5) * 1.5);
      body.velocity.set((random() - .5) * 12, 1 + random() * 3, (random() - .5) * 10);
    }
    body.angularVelocity.set((random() - .5) * 28, (random() - .5) * 28, (random() - .5) * 28);
    const u = random(), a = random() * Math.PI * 2, b = random() * Math.PI * 2;
    body.quaternion.set(Math.sqrt(1 - u) * Math.sin(a), Math.sqrt(1 - u) * Math.cos(a), Math.sqrt(u) * Math.sin(b), Math.sqrt(u) * Math.cos(b));
    body.aabbNeedsUpdate = true; body.force.setZero(); body.torque.setZero();
    samples = [snapshot()];
    for (let step = 0; step < 1200; step++) {
      world.step(1 / 120); samples.push(snapshot());
      if (step > 180 && body.sleepState === CANNON.Body.SLEEPING) break;
    }
    const last = samples[samples.length - 1]; alignment = -1;
    normals.forEach((normal, index) => {
      const dot = normal.clone().applyQuaternion(last.rotation).y;
      if (dot > alignment) { alignment = dot; topFace = index; }
    });
    if (alignment > .998) break;
  }
  // A rare edge balance must never change or lose the authoritative roll.
  if (alignment <= .998) {
    topFace = 0;
    const last = samples[samples.length - 1];
    const rotation = new THREE.Quaternion().setFromUnitVectors(normals[topFace], up);
    const position = new THREE.Vector3(board ? last.position.x : 0, inradius, board ? last.position.z : 0);
    for (let frame = 1; frame <= 60; frame++) {
      const t = frame / 60, ease = t * t * (3 - 2 * t);
      samples.push({ position: last.position.clone().lerp(position, ease), rotation: last.rotation.clone().slerp(rotation, ease) });
    }
  }
  const faceValues = [...dieTopology.values], target = faceValues.indexOf(result), other = opposite[topFace];
  if (target === other) [faceValues[topFace], faceValues[other]] = [faceValues[other], faceValues[topFace]];
  else if (target !== topFace) {
    const targetOpposite = opposite[target];
    [faceValues[topFace], faceValues[target]] = [faceValues[target], faceValues[topFace]];
    [faceValues[other], faceValues[targetOpposite]] = [faceValues[targetOpposite], faceValues[other]];
  }
  return { samples, faceValues, topFace };
}

export function sampleD20Roll(roll: PreparedD20Roll, progress: number): DieSample {
  const f = THREE.MathUtils.clamp(progress, 0, 1) * (roll.samples.length - 1);
  const index = Math.floor(f), next = Math.min(index + 1, roll.samples.length - 1), t = f - index;
  if (t === 0) return { position: roll.samples[index].position.clone(), rotation: roll.samples[index].rotation.clone() };
  return { position: roll.samples[index].position.clone().lerp(roll.samples[next].position, t), rotation: roll.samples[index].rotation.clone().slerp(roll.samples[next].rotation, t) };
}
