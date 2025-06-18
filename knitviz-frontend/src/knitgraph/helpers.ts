import type { MathCollection } from "mathjs";
import { Vector3 } from "three";

export function toVec3(v: number[]): Vector3 {
  if (v.length != 3) {
    throw new Error("Vector must have 3 components");
  }
  return new Vector3(v[0], v[1], v[2]);
}
export function fromVec3(v: Vector3): number[] {
  return [v.x, v.y, v.z];
}
