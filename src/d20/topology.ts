import * as THREE from 'three';

export function createDieTopology(radius = 1.15) {
  const geometry = new THREE.IcosahedronGeometry(radius, 0);
  const position = geometry.getAttribute('position');
  const vertices: THREE.Vector3[] = [], faces: number[][] = [];
  for (let i = 0; i < position.count; i += 3) {
    const face: number[] = [];
    for (let j = 0; j < 3; j++) {
      const vertex = new THREE.Vector3().fromBufferAttribute(position, i + j);
      let index = vertices.findIndex(other => other.distanceTo(vertex) < .0001);
      if (index < 0) { index = vertices.length; vertices.push(vertex); }
      face.push(index);
    }
    faces.push(face);
  }
  geometry.dispose();
  const normals = faces.map(face => {
    const [a, b, c] = face.map(index => vertices[index]);
    return b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  });
  const opposite = normals.map(normal => normals.findIndex(other => normal.dot(other) < -.999));
  const values: number[] = [];
  let low = 1;
  for (let i = 0; i < 20; i++) {
    if (values[i]) continue;
    values[i] = low;
    values[opposite[i]] = 21 - low++;
  }
  return { vertices, faces, normals, opposite, values, inradius: vertices[faces[0][0]].dot(normals[0]) };
}
export const dieTopology = createDieTopology();
