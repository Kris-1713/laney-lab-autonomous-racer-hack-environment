'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { getTrack, type TrackObstacle, type TrackPoint } from '@/lib/tracks/track-data';
import { useGameStore } from '@/lib/stores/game-store';

const CENTER_LINE_WIDTH = 0.18;
const DASH_LEN = 1.2;
const GAP_LEN = 0.8;

/**
 * Renders the 3D track surface, boundaries, center line, and ground plane.
 * Styled after AWS DeepRacer tracks — dark asphalt, white curbs, dashed black center line.
 */
export function Track3D({ trackId }: { trackId: string }) {
  const track = getTrack(trackId);
  const visualSeed = useGameStore((s) => s.trackVisualSeed);
  const { surfaceGeo, leftGeo, rightGeo, centerLineGeo } = useMemo(
    () => buildTrackGeometry(track.waypoints, track.width),
    [track],
  );
  const labObstacles = useMemo(
    () => (track.environment === 'lab' ? jitterLabObstacles(track.obstacles ?? [], visualSeed) : (track.obstacles ?? [])),
    [track, visualSeed],
  );

  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color={track.environment === 'lab' ? '#5f5b52' : '#2d5a27'} />
      </mesh>

      {track.environment === 'lab' && <LabEnvironment obstacles={labObstacles} />}

      {/* Track surface */}
      <mesh geometry={surfaceGeo} position={[0, 0.01, 0]} receiveShadow>
        <meshStandardMaterial color="#3a3a3a" side={THREE.DoubleSide} />
      </mesh>

      {/* Center line (dashed black — DeepRacer style) */}
      <mesh geometry={centerLineGeo} position={[0, 0.025, 0]}>
        <meshStandardMaterial color="#111111" side={THREE.DoubleSide} />
      </mesh>

      {/* Left boundary (red/white curb) */}
      <mesh geometry={leftGeo} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#cc3333" />
      </mesh>

      {/* Right boundary (white curb) */}
      <mesh geometry={rightGeo} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#eeeeee" />
      </mesh>

      {/* Start/finish line — checkerboard style */}
      <mesh position={[track.spawnPos[0], 0.03, track.spawnPos[2]]} rotation={[-Math.PI / 2, 0, track.spawnRotation]}>
        <planeGeometry args={[track.width * 2, 0.6]} />
        <meshStandardMaterial color="#ffffff" opacity={0.9} transparent />
      </mesh>
      <mesh position={[track.spawnPos[0], 0.031, track.spawnPos[2]]} rotation={[-Math.PI / 2, 0, track.spawnRotation]}>
        <planeGeometry args={[track.width * 2, 0.15]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
    </group>
  );
}

function hashString(value: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function jitterLabObstacles(obstacles: TrackObstacle[], visualSeed: number): TrackObstacle[] {
  if (!visualSeed) return obstacles;
  return obstacles.map((obs) => {
    const rand = mulberry32((visualSeed ^ hashString(obs.id)) >>> 0);
    const jitterPos = obs.kind === 'chair' ? 0.75 : obs.kind === 'cone' ? 1.0 : 0.45;
    const jitterRot = obs.kind === 'cone' ? 0.25 : 0.45;
    const dx = (rand() * 2 - 1) * jitterPos;
    const dz = (rand() * 2 - 1) * jitterPos;
    const drot = (rand() * 2 - 1) * jitterRot;
    return {
      ...obs,
      x: obs.x + dx,
      z: obs.z + dz,
      rotation: (obs.rotation ?? 0) + drot,
    };
  });
}

function LabEnvironment({ obstacles }: { obstacles: TrackObstacle[] }) {
  return (
    <group>
      {/* Room pad / floor tint */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[90, 60]} />
        <meshStandardMaterial color="#7a7365" roughness={0.95} metalness={0.02} />
      </mesh>

      {/* Subtle room boundary walls */}
      <mesh position={[0, 2.2, -30]}>
        <boxGeometry args={[90, 4.4, 0.6]} />
        <meshStandardMaterial color="#d9d7cf" />
      </mesh>
      <mesh position={[0, 2.2, 30]}>
        <boxGeometry args={[90, 4.4, 0.6]} />
        <meshStandardMaterial color="#d9d7cf" />
      </mesh>
      <mesh position={[-45, 2.2, 0]}>
        <boxGeometry args={[0.6, 4.4, 60]} />
        <meshStandardMaterial color="#d9d7cf" />
      </mesh>
      <mesh position={[45, 2.2, 0]}>
        <boxGeometry args={[0.6, 4.4, 60]} />
        <meshStandardMaterial color="#d9d7cf" />
      </mesh>

      {/* Ceiling lights as visual references */}
      {[-24, 0, 24].map((x) => (
        <group key={`light-${x}`} position={[x, 3.2, 0]}>
          <mesh>
            <boxGeometry args={[10, 0.15, 2]} />
            <meshStandardMaterial color="#f3f1e9" emissive="#fff4bf" emissiveIntensity={0.15} />
          </mesh>
        </group>
      ))}

      {obstacles.map((obs) => (
        <group
          key={obs.id}
          position={[obs.x, 0, obs.z]}
          rotation={[0, obs.rotation ?? 0, 0]}
          scale={obs.scale ?? 1}
        >
          {obs.kind === 'table' && <TableProp />}
          {obs.kind === 'chair' && <ChairProp />}
          {obs.kind === 'cone' && <ConeProp />}
        </group>
      ))}
    </group>
  );
}

function TableProp() {
  return (
    <group>
      <mesh position={[0, 0.78, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.5, 0.14, 2.4]} />
        <meshStandardMaterial color="#a0764a" />
      </mesh>
      {[
        [-2.4, 0.38, -1.0],
        [2.4, 0.38, -1.0],
        [-2.4, 0.38, 1.0],
        [2.4, 0.38, 1.0],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <boxGeometry args={[0.14, 0.76, 0.14]} />
          <meshStandardMaterial color="#6b4f34" />
        </mesh>
      ))}
    </group>
  );
}

function ChairProp() {
  return (
    <group>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.08, 0.9]} />
        <meshStandardMaterial color="#2f4f6f" />
      </mesh>
      <mesh position={[0, 0.85, -0.38]} castShadow>
        <boxGeometry args={[0.9, 0.8, 0.08]} />
        <meshStandardMaterial color="#3a5f84" />
      </mesh>
      {[
        [-0.35, 0.21, -0.35],
        [0.35, 0.21, -0.35],
        [-0.35, 0.21, 0.35],
        [0.35, 0.21, 0.35],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <boxGeometry args={[0.08, 0.42, 0.08]} />
          <meshStandardMaterial color="#4b5563" />
        </mesh>
      ))}
    </group>
  );
}

function ConeProp() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.35, 0.5, 12]} />
        <meshStandardMaterial color="#f97316" />
      </mesh>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.04, 12]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
    </group>
  );
}

function buildTrackGeometry(waypoints: TrackPoint[], halfWidth: number) {
  const n = waypoints.length;
  const surfaceVerts: number[] = [];
  const surfaceIndices: number[] = [];
  const leftVerts: number[] = [];
  const leftIndices: number[] = [];
  const rightVerts: number[] = [];
  const rightIndices: number[] = [];

  const curbWidth = 0.4;

  for (let i = 0; i < n; i++) {
    const curr = waypoints[i];
    const next = waypoints[(i + 1) % n];
    const dx = next.x - curr.x;
    const dz = next.z - curr.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    // Normal perpendicular to direction
    const nx = -dz / len;
    const nz = dx / len;

    // Surface: left and right edge
    surfaceVerts.push(curr.x + nx * halfWidth, 0, curr.z + nz * halfWidth);
    surfaceVerts.push(curr.x - nx * halfWidth, 0, curr.z - nz * halfWidth);

    // Left curb
    leftVerts.push(curr.x + nx * halfWidth, 0, curr.z + nz * halfWidth);
    leftVerts.push(curr.x + nx * (halfWidth + curbWidth), 0, curr.z + nz * (halfWidth + curbWidth));

    // Right curb
    rightVerts.push(curr.x - nx * halfWidth, 0, curr.z - nz * halfWidth);
    rightVerts.push(curr.x - nx * (halfWidth + curbWidth), 0, curr.z - nz * (halfWidth + curbWidth));

    if (i < n - 1 || true) { // close the loop
      const base = i * 2;
      const nextBase = ((i + 1) % n) * 2;
      // Two triangles per quad
      surfaceIndices.push(base, nextBase, base + 1);
      surfaceIndices.push(base + 1, nextBase, nextBase + 1);
      leftIndices.push(base, nextBase, base + 1);
      leftIndices.push(base + 1, nextBase, nextBase + 1);
      rightIndices.push(base, nextBase, base + 1);
      rightIndices.push(base + 1, nextBase, nextBase + 1);
    }
  }

  // --- Center line (dashed) ---
  const centerVerts: number[] = [];
  const centerIndices: number[] = [];
  let accumulated = 0;
  let drawing = true; // start with a dash
  let cIdx = 0;

  for (let i = 0; i < n; i++) {
    const curr = waypoints[i];
    const next = waypoints[(i + 1) % n];
    const sdx = next.x - curr.x;
    const sdz = next.z - curr.z;
    const segLen = Math.sqrt(sdx * sdx + sdz * sdz) || 0.01;
    const dirX = sdx / segLen;
    const dirZ = sdz / segLen;
    // Perpendicular
    const pnx = -dirZ;
    const pnz = dirX;

    let traveled = 0;
    while (traveled < segLen) {
      const threshold = drawing ? DASH_LEN : GAP_LEN;
      const remaining = threshold - accumulated;
      const step = Math.min(remaining, segLen - traveled);

      if (drawing) {
        // Start point of this dash segment
        const sx = curr.x + dirX * traveled;
        const sz = curr.z + dirZ * traveled;
        // End point
        const ex = curr.x + dirX * (traveled + step);
        const ez = curr.z + dirZ * (traveled + step);

        const hw = CENTER_LINE_WIDTH;
        const base = cIdx;
        centerVerts.push(sx + pnx * hw, 0, sz + pnz * hw);
        centerVerts.push(sx - pnx * hw, 0, sz - pnz * hw);
        centerVerts.push(ex + pnx * hw, 0, ez + pnz * hw);
        centerVerts.push(ex - pnx * hw, 0, ez - pnz * hw);
        centerIndices.push(base, base + 2, base + 1);
        centerIndices.push(base + 1, base + 2, base + 3);
        cIdx += 4;
      }

      traveled += step;
      accumulated += step;
      if (accumulated >= (drawing ? DASH_LEN : GAP_LEN)) {
        accumulated = 0;
        drawing = !drawing;
      }
    }
  }

  function makeGeo(verts: number[], indices: number[]) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  return {
    surfaceGeo: makeGeo(surfaceVerts, surfaceIndices),
    leftGeo: makeGeo(leftVerts, leftIndices),
    rightGeo: makeGeo(rightVerts, rightIndices),
    centerLineGeo: makeGeo(centerVerts, centerIndices),
  };
}
