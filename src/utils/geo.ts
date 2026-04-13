import * as THREE from 'three';

export function latLngToPosition(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (lat * Math.PI) / 180;
  const theta = (lng * Math.PI) / 180;
  return new THREE.Vector3(
    Math.cos(phi) * Math.cos(theta) * radius,
    Math.sin(phi) * radius,
    Math.cos(phi) * Math.sin(theta) * radius
  );
}
