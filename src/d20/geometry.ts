import * as THREE from 'three';

// Offset a smaller icosahedron by a sphere: flat faces, cylindrical fillets,
// and spherical corners share continuous normals. Face planes stay in place.
export function roundedD20(vertices: THREE.Vector3[], faces: number[][], normals: THREE.Vector3[], radius = .09) {
  const distance = vertices[faces[0][0]].dot(normals[0]);
  const core = vertices.map(v => v.clone().multiplyScalar(1 - radius / distance));
  const positions: number[] = [], surfaceNormals: number[] = [];
  function triangle(points: THREE.Vector3[], ns: THREE.Vector3[]) {
    const cross = new THREE.Vector3().crossVectors(points[1].clone().sub(points[0]), points[2].clone().sub(points[0]));
    if (cross.dot(ns[0].clone().add(ns[1]).add(ns[2])) < 0) {
      [points[1], points[2]] = [points[2], points[1]];
      [ns[1], ns[2]] = [ns[2], ns[1]];
    }
    points.forEach(p => positions.push(p.x, p.y, p.z));
    ns.forEach(n => surfaceNormals.push(n.x, n.y, n.z));
  }
  const edges = new Map<string, {pair: number[]; sides: number[]}>();
  faces.forEach((face, i) => {
    const n = normals[i];
    triangle(face.map(j => core[j].clone().addScaledVector(n, radius)), [n, n, n]);
    for (let k = 0; k < 3; k++) {
      const pair = [face[k], face[(k + 1) % 3]].sort((a,b) => a-b);
      const key = pair.join(':');
      if (!edges.has(key)) edges.set(key, {pair, sides: []});
      edges.get(key)!.sides.push(i);
    }
  });
  for (const {pair:[a,b], sides:[f,g]} of edges.values()) {
    const n0 = normals[f], n1 = normals[g];
    const angle = Math.acos(THREE.MathUtils.clamp(n0.dot(n1), -1, 1));
    const blend = (t: number) => n0.clone().multiplyScalar(Math.sin((1-t)*angle))
      .addScaledVector(n1, Math.sin(t*angle)).divideScalar(Math.sin(angle)).normalize();
    for (let s = 0; s < 8; s++) {
      const u = blend(s/8), v = blend((s+1)/8);
      const p = [core[a].clone().addScaledVector(u,radius),core[b].clone().addScaledVector(u,radius),core[b].clone().addScaledVector(v,radius),core[a].clone().addScaledVector(v,radius)];
      triangle([p[0],p[1],p[2]],[u,u,v]);
      triangle([p[0],p[2],p[3]],[u,v,v]);
    }
  }
  function cap(center: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, depth: number) {
    if (!depth) {
      triangle([a,b,c].map(n => center.clone().addScaledVector(n,radius)),[a,b,c]);
      return;
    }
    const ab = a.clone().add(b).normalize(), bc = b.clone().add(c).normalize(), ca = c.clone().add(a).normalize();
    cap(center,a,ab,ca,depth-1); cap(center,ab,b,bc,depth-1);
    cap(center,ca,bc,c,depth-1); cap(center,ab,bc,ca,depth-1);
  }
  vertices.forEach((vertex, i) => {
    const axis = vertex.clone().normalize();
    const adjacent = faces.flatMap((face,j) => face.includes(i) ? [normals[j]] : []);
    const x = adjacent[0].clone().addScaledVector(axis,-adjacent[0].dot(axis)).normalize();
    const y = new THREE.Vector3().crossVectors(axis,x);
    adjacent.sort((a,b) => Math.atan2(a.dot(y),a.dot(x))-Math.atan2(b.dot(y),b.dot(x)));
    adjacent.forEach((n,j) => cap(core[i],axis,n,adjacent[(j+1)%adjacent.length],3));
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(surfaceNormals,3));
  geometry.computeBoundingSphere();
  return geometry;
}
