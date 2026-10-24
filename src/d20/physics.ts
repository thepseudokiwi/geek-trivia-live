import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { seededRandom } from '../../shared/random.js';
import { dieTopology } from './topology.js';

export interface DieSample { position: THREE.Vector3; rotation: THREE.Quaternion }
export interface PreparedD20Roll { samples: DieSample[]; faceValues: number[]; topFace: number; sampleTimes?:number[] }
const up = new THREE.Vector3(0, 1, 0);

// The game server owns the result. This simulation only supplies a repeatable
// visual throw. Clients in the same space share the path and numbered faces.
export function prepareD20Roll(result: number, rollId: string, space: 'tray' | 'board' = 'tray'): PreparedD20Roll {
  if (!Number.isInteger(result) || result < 1 || result > 20) throw new RangeError('D20 result must be 1–20.');
  const { vertices, faces, normals, opposite, inradius } = dieTopology;
  const rng = seededRandom(`${rollId}:${result}`), random = () => rng.next();
  const board = space === 'board', halfWidth = board ? 9 : 2.8, halfDepth = board ? 5 : 2.4;
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -28, 0), allowSleep: true });
  (world.solver as CANNON.GSSolver).iterations = 24;
  const material = new CANNON.Material(), felt = new CANNON.Material(), rail = new CANNON.Material();
  // A felt mat absorbs vertical bounce but still lets a thrown die tumble.
  // Rails retain more energy so a long throw can rebound across the board.
  world.addContactMaterial(new CANNON.ContactMaterial(material, felt, { friction: .32, restitution: .24, contactEquationRelaxation: 4 }));
  world.addContactMaterial(new CANNON.ContactMaterial(material, rail, { friction: .2, restitution: .42 }));
  function plane(x: number, z: number, rx: number, ry: number, surface: CANNON.Material) {
    const wall = new CANNON.Body({ mass: 0, material: surface, shape: new CANNON.Plane() });
    wall.position.set(x, 0, z); wall.quaternion.setFromEuler(rx, ry, 0); world.addBody(wall);
  }
  plane(0, 0, -Math.PI / 2, 0, felt);
  plane(-halfWidth, 0, 0, Math.PI / 2, rail); plane(halfWidth, 0, 0, -Math.PI / 2, rail);
  plane(0, -halfDepth, 0, 0, rail); plane(0, halfDepth, Math.PI, 0, rail);
  const body = new CANNON.Body({ mass: 1, material,
    shape: new CANNON.ConvexPolyhedron({ vertices: vertices.map(v => new CANNON.Vec3(v.x, v.y, v.z)), faces }),
    linearDamping: board ? .18 : .23, angularDamping: .32, sleepSpeedLimit: .12, sleepTimeLimit: .5 });
  world.addBody(body);
  const snapshot = (): DieSample => ({ position: new THREE.Vector3(body.position.x, body.position.y, body.position.z), rotation: new THREE.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w) });
  let samples: DieSample[] = [], topFace = 0, alignment = -1;
  for (let attempt = 0; attempt < 5; attempt++) {
    body.wakeUp();
    if (board) {
      const side = random() < .5 ? -1 : 1;
      body.position.set(side * (halfWidth - 1.1), 1.7 + random() * .6, (random() - .5) * 5.6);
      body.velocity.set(-side * (36 + random() * 10), .5 + random() * 1.7, (random() < .5 ? -1 : 1) * (8 + random() * 8));
    } else {
      body.position.set((random() - .5) * 2, 3.4 + random(), (random() - .5) * 1.5);
      body.velocity.set((random() - .5) * 12, 1 + random() * 3, (random() - .5) * 10);
    }
    body.angularVelocity.set((random() - .5) * 28, (random() - .5) * 28, (random() - .5) * 28);
    const u = random(), a = random() * Math.PI * 2, b = random() * Math.PI * 2;
    body.quaternion.set(Math.sqrt(1 - u) * Math.sin(a), Math.sqrt(1 - u) * Math.cos(a), Math.sqrt(u) * Math.sin(b), Math.sqrt(u) * Math.cos(b));
    body.aabbNeedsUpdate = true; body.force.setZero(); body.torque.setZero();
    samples = [snapshot()];
    for (let step = 0; step < 2400; step++) {
      world.step(1 / 240); samples.push(snapshot());
      if (step > 360 && body.sleepState === CANNON.Body.SLEEPING) break;
    }
    const last = samples[samples.length - 1]; alignment = -1;
    normals.forEach((normal, index) => {
      const dot = normal.clone().applyQuaternion(last.rotation).y;
      if (dot > alignment) { alignment = dot; topFace = index; }
    });
    if (alignment > .998) break;
  }
  // A rare edge balance must never change or lose the authoritative roll.
  if (alignment <= .99998 || Math.abs(samples[samples.length-1].position.y-inradius)>.004) {
    const last = samples[samples.length - 1];
    // Correct only the last tiny tilt (or rare edge balance), preserving yaw
    // and the nearest physical resting face instead of turning to face zero.
    const rotation = new THREE.Quaternion().setFromUnitVectors(normals[topFace].clone().applyQuaternion(last.rotation), up).multiply(last.rotation);
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
  // Pace board throws by visible travel and rotation, rather than squeezing the
  // high-speed launch plus a long stationary physics tail into the roll time.
  const sampleTimes = board ? [0] : undefined;
  if (sampleTimes) {
    for (let i = 1; i < samples.length; i++) {
      const distance = samples[i].position.distanceTo(samples[i-1].position);
      const turn = samples[i].rotation.angleTo(samples[i-1].rotation);
      sampleTimes.push(sampleTimes[i-1] + Math.max(.0001, distance/.45, turn/.3));
    }
    const total = sampleTimes[sampleTimes.length-1];
    for (let i = 1; i < sampleTimes.length; i++) sampleTimes[i] /= total;
  }
  return { samples, faceValues, topFace, ...(sampleTimes ? {sampleTimes} : {}) };
}

export function sampleD20Roll(roll: PreparedD20Roll, progress: number): DieSample {
  const bounded = THREE.MathUtils.clamp(progress, 0, 1);
  if (bounded === 0 || bounded === 1) {
    const sample=roll.samples[bounded === 0 ? 0 : roll.samples.length-1];
    return {position:sample.position.clone(),rotation:sample.rotation.clone()};
  }
  let index:number, next:number, t:number;
  if (roll.sampleTimes) {
    const phase = bounded * bounded * (3 - 2 * bounded);
    let low = 0, high = roll.samples.length - 1;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (roll.sampleTimes[middle] <= phase) low = middle; else high = middle;
    }
    index = low; next = high;
    t = (phase - roll.sampleTimes[index]) / (roll.sampleTimes[next] - roll.sampleTimes[index]);
  } else {
    const f = bounded * (roll.samples.length - 1);
    index = Math.floor(f); next = Math.min(index + 1, roll.samples.length - 1); t = f - index;
  }
  if (t === 0) return { position: roll.samples[index].position.clone(), rotation: roll.samples[index].rotation.clone() };
  return { position: roll.samples[index].position.clone().lerp(roll.samples[next].position, t), rotation: roll.samples[index].rotation.clone().slerp(roll.samples[next].rotation, t) };
}
