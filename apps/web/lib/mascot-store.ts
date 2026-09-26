/**
 * Mutable pose shared by the landing sections (writers, via GSAP) and the
 * mascot canvas (reader, every frame). Kept outside React so scroll-driven
 * updates never trigger re-renders.
 */
export type MascotPose = {
  /** 0 -> 1 parachute landing on intro. */
  descent: number;
  x: number;
  y: number;
  rotY: number;
  scale: number;
  /** Extra drop and shake while the sample chart rugs. */
  dip: number;
  jolt: number;
  /** 0 -> 100 GLB load progress, read by the preloader. */
  progress: number;
  ready: boolean;
  reduced: boolean;
};

export const pose: MascotPose = {
  descent: 0,
  x: 0,
  y: 0,
  rotY: 0,
  scale: 1,
  dip: 0,
  jolt: 0,
  progress: 0,
  ready: false,
  reduced: false,
};

/** Per-section resting poses, keyed by each section's `data-pose` attribute. */
export const POSES = {
  hero: { x: 0, y: 0, rotY: 0, scale: 1 },
  statement: { x: -0.08, y: 0.04, rotY: -0.75, scale: 0.9 },
  trigger: { x: 0, y: 0, rotY: 0.3, scale: 0.88 },
  roles: { x: 0.04, y: 0.06, rotY: 0.95, scale: 0.86 },
  flow: { x: -0.04, y: -0.04, rotY: -0.45, scale: 0.9 },
  guards: { x: 0, y: 0, rotY: -0.45 + Math.PI * 2, scale: 0.84 },
} as const;

export type PoseKey = keyof typeof POSES;
export const POSE_ORDER: PoseKey[] = ["hero", "statement", "trigger", "roles", "flow", "guards"];
