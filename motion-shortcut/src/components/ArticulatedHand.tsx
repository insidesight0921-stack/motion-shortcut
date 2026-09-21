import { useEffect, useRef } from "react";
import { VIEWBOX } from "./tutorialViewBox";

// Constraint: <ArticulatedHand> is an HTML <canvas>, not SVG. Render it inside the
// .tutorial-hands overlay that sits on top of the <svg>, never inside the <svg>
// (WebKit mishandles <foreignObject>). x/y/scale are in VIEWBOX units, so group
// transforms must be baked into them at the call site. See docs/DECISIONS.md.

type V = [number, number, number];
type Face = { points: V[]; normal: V; normals?: V[]; nail?: boolean };
const mix = (a: V, b: V, t: number): V =>
  a.map((n, i) => n + (b[i] - n) * t) as V;
const unit = (a: V): V => {
  const l = Math.hypot(...a) || 1;
  return a.map((v) => v / l) as V;
};
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const sub = (a: V, b: V): V => a.map((v, i) => v - b[i]) as V;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};

// A small articulated surface model: each finger has three flexion joints.
// Depth sorting makes the curled fingers cover the palm and the thumb cover the fist.
function model(pose: number[], fingersTogether = false) {
  const faces: Face[] = [];
  const surface = (rings: V[][], nail = false) => {
    // Adjacent faces share the same vertex normals, so light flows across their edges.
    const normals = rings.map((ring, j) =>
      ring.map((_, k) =>
        unit(
          cross(
            sub(
              ring[(k + 1) % ring.length],
              ring[(k + ring.length - 1) % ring.length],
            ),
            sub(
              rings[Math.min(j + 1, rings.length - 1)][k],
              rings[Math.max(j - 1, 0)][k],
            ),
          ),
        ),
      ),
    );
    for (let j = 0; j < rings.length - 1; j++)
      for (let k = 0; k < rings[j].length; k++) {
        const n = (k + 1) % rings[j].length;
        const points = [
          rings[j][k],
          rings[j][n],
          rings[j + 1][n],
          rings[j + 1][k],
        ];
        faces.push({
          points,
          normals: [
            normals[j][k],
            normals[j][n],
            normals[j + 1][n],
            normals[j + 1][k],
          ],
          normal: unit(
            cross(sub(points[1], points[0]), sub(points[3], points[0])),
          ),
          nail,
        });
      }
  };
  const tube = (centers: V[], radii: number[], depth = 0.8, nails = false) => {
    const rings: V[][] = [];
    const backs: { center: V; side: V; back: V; radius: number }[] = [];
    for (let j = 0; j < centers.length; j++) {
      const tangent = unit(
        sub(
          centers[Math.min(j + 1, centers.length - 1)],
          centers[Math.max(0, j - 1)],
        ),
      );
      const side = unit(cross(tangent, [0, 0, 1]));
      const back = unit(cross(side, tangent));
      backs.push({ center: centers[j], side, back, radius: radii[j] });
      rings.push(
        Array.from({ length: 24 }, (_, k) => {
          const a = (k * Math.PI) / 12;
          return centers[j].map(
            (v, i) =>
              v +
              side[i] * Math.cos(a) * radii[j] +
              back[i] * Math.sin(a) * radii[j] * depth,
          ) as V;
        }),
      );
    }
    surface(rings);
    if (nails) {
      // A short rounded nail follows the finger surface, with a curved cuticle.
      const start = Math.max(0, centers.length - 7);
      const end = centers.length - 2;
      for (let j = start; j < end; j++) {
        const points = [j, j + 1].flatMap((row, r) => {
          const b = backs[row];
          const width =
            Math.sin((Math.PI * (row - start)) / (end - start)) * 0.56;
          return (r ? [1, -1] : [-1, 1]).map(
            (sign) =>
              b.center.map(
                (v, i) =>
                  v +
                  sign * b.side[i] * b.radius * width -
                  b.back[i] *
                    (b.radius * depth * Math.sqrt(1 - width * width) + 0.24),
              ) as V,
          );
        });
        faces.push({
          points,
          normal: backs[j].back.map((v) => -v) as V,
          nail: true,
        });
      }
    }
  };
  const palmSections: [number, number, number][] = [
    [99, 24, 8],
    [73, 21, 8],
    [48, 21, 9],
    [34, 26, 11],
    [15, 33, 13],
    [-5, 35, 12],
    [-23, 34, 10],
    [-36, 28, 7],
  ];
  const palmRings: V[][] = [];
  for (let j = 0; j <= 42; j++) {
    const u = (j / 42) * (palmSections.length - 1),
      s = Math.min(palmSections.length - 2, Math.floor(u)),
      t = u - s;
    const a = palmSections[Math.max(0, s - 1)],
      b = palmSections[s],
      c = palmSections[s + 1],
      d = palmSections[Math.min(palmSections.length - 1, s + 2)];
    const [y, w, depth] = b.map(
      (_, k) =>
        0.5 *
        (2 * b[k] +
          (-a[k] + c[k]) * t +
          (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t * t +
          (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t * t * t),
    );
    palmRings.push(
      Array.from({ length: 32 }, (_, k) => {
        const angle = (k * Math.PI) / 16;
        return [Math.cos(angle) * w, y, Math.sin(angle) * depth] as V;
      }),
    );
  }
  surface(palmRings);
  const fingers = [
    { x: -24, y: -31, length: 67, r: 8.4, spread: -0.16 },
    { x: -6, y: -36, length: 78, r: 8.7, spread: -0.025 },
    { x: 12, y: -33, length: 71, r: 8, spread: 0.095 },
    { x: 28, y: -23, length: 54, r: 6.7, spread: 0.24 },
  ];
  fingers.forEach((f, i) => {
    const curl = clamp(pose[i + 1]);
    const centers: V[] = [];
    const radii: number[] = [];
    let p: V = [f.x, f.y, fingersTogether ? [2, 0, -2, -4][i] : 0];
    if (!fingersTogether) {
      // Bury each finger root inside the palm instead of leaving an exposed ring.
      centers.push([f.x * 0.9, f.y + 15, 0], [f.x * 0.97, f.y + 7, 0]);
      radii.push(f.r * 1.12, f.r * 1.06);
    }
    for (let j = 0; j <= 24; j++) {
      const u = j / 24;
      // Flexion is distributed around the MCP, PIP and DIP joints, not a single hinge.
      const theta =
        curl *
        (1.15 + 1.5 * ease((u - 0.31) / 0.16) + 0.92 * ease((u - 0.68) / 0.16));
      if (j)
        p = [
          p[0] +
            (Math.sin(f.spread) *
              (fingersTogether ? 0 : 1) *
              (1 - curl * 0.85) *
              f.length) /
              24,
          p[1] - (Math.cos(theta) * f.length) / 24,
          p[2] + (Math.sin(theta) * f.length) / 24,
        ];
      centers.push([...p]);
      const tip =
        u > 0.87
          ? Math.sqrt(Math.max(0.0001, 1 - ((u - 0.87) / 0.13) ** 2))
          : 1;
      const knuckle = 1;
      radii.push(f.r * (1 - ease(u) * 0.17) * tip * knuckle);
    }
    tube(centers, radii, 0.76, true);
  });
  // Thenar pad gives the thumb a broad attachment instead of a detached rod.
  const thumbCurl = ease((pose[0] - 0.18) / 0.82);
  const thumbOpen: V[] = [
    [-9, 24, 0],
    [-30, 12, 4],
    [-49, -4, 10],
    [-62, -22, 10],
    [-66, -30, 10],
  ];
  const thumbClosed: V[] = [
    [-9, 24, 0],
    [-28, 9, 16],
    [-25, -7, 34],
    [-3, -11, 39],
    [8, -9, 38],
  ];
  // Adducted, upright thumb for the edge-first swipe shown in the photo.
  // This is a separate pose: flexing a spread thumb would curl it across the palm.
  const thumbAlongIndex: V[] = [
    [-9, 30, 0],
    [-22, 15, 6],
    [-29, -5, 10],
    [-31, -25, 10],
    [-30, -42, 9],
  ];
  // L gesture needs an abducted thumb perpendicular to the extended index.
  const thumbL: V[] = [
    [-9, 24, 0],
    [-33, 14, 4],
    [-57, 9, 10],
    [-75, 8, 10],
    [-83, 8, 10],
  ];
  const lShape = (1 - pose[1]) * pose[2] * pose[3] * pose[4];
  const control = fingersTogether
    ? thumbAlongIndex
    : thumbOpen.map((p, i) =>
        mix(mix(p, thumbL[i], lShape), thumbClosed[i], thumbCurl),
      );
  const centers: V[] = [];
  const radii: number[] = [];
  // Catmull–Rom interpolation keeps the thumb web and the two thumb joints rounded.
  for (let j = 0; j <= 24; j++) {
    const u = (j / 24) * 4;
    const s = Math.min(3, Math.floor(u));
    const v = u - s;
    const a = control[Math.max(0, s - 1)],
      b = control[s],
      c = control[s + 1],
      d = control[Math.min(4, s + 2)];
    centers.push(
      b.map(
        (_, k) =>
          0.5 *
          (2 * b[k] +
            (-a[k] + c[k]) * v +
            (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * v * v +
            (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * v * v * v),
      ) as V,
    );
    const q = j / 24;
    const tip =
      q > 0.87 ? Math.sqrt(Math.max(0.0001, 1 - ((q - 0.87) / 0.13) ** 2)) : 1;
    radii.push((fingersTogether ? 15 - 7.5 * q : 14 - 7 * q) * tip);
  }
  tube(centers, radii, 0.8, true);
  return faces;
}

// Orthographic camera, slightly turned to reveal curled fingers and palm depth.
function camera([x, y, z]: V, backFacing = false, edgeOn = false): V {
  // Keep a three-quarter view for the edge-first swipe so the fingers remain readable.
  const yaw = edgeOn ? Math.PI * 0.3 : -0.3 + (backFacing ? Math.PI : 0),
    pitch = -0.14;
  const xx = x * Math.cos(yaw) + z * Math.sin(yaw),
    zz = -x * Math.sin(yaw) + z * Math.cos(yaw);
  return [
    xx,
    y * Math.cos(pitch) - zz * Math.sin(pitch),
    y * Math.sin(pitch) + zz * Math.cos(pitch),
  ];
}
function paint(
  canvas: HTMLCanvasElement,
  pose: number[],
  backFacing: boolean,
  edgeOn: boolean,
) {
  const project = (point: V) => camera(point, backFacing, edgeOn);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(2, 0, 0, 2, 220, 280);
  ctx.clearRect(-110, -140, 220, 250);
  const faces = model(pose, edgeOn).map((f) => ({
    ...f,
    points: f.points.map(project),
    normal: project(f.normal),
    normals: f.normals?.map(project),
  }));
  faces.sort(
    (a, b) =>
      a.points.reduce((s, p) => s + p[2], 0) / a.points.length -
      b.points.reduce((s, p) => s + p[2], 0) / b.points.length,
  );
  faces.forEach((f) => {
    const illumination = (normal: V) => {
      const n = normal[2] < 0 ? normal.map((v) => -v) : normal;
      return 0.82 + 0.18 * clamp(n[0] * -0.35 + n[1] * -0.45 + n[2] * 0.82);
    };
    const skin = (light: number) => {
      const value = Math.min(1, Math.max(0.78, light) + (f.nail ? 0.015 : 0));
      // Base albedo #FCE3CF; diffuse shading preserves the volume.
      return `rgb(${Math.round(252 * value)},${Math.round(227 * value)},${Math.round(207 * value)})`;
    };
    const lights = (f.normals ?? f.points.map(() => f.normal)).map(
      illumination,
    );
    const [p0, p1, , p3] = f.points;
    const ax = p1[0] - p0[0],
      ay = p1[1] - p0[1],
      bx = p3[0] - p0[0],
      by = p3[1] - p0[1];
    const det = ax * by - ay * bx;
    ctx.fillStyle = skin(lights.reduce((sum, v) => sum + v, 0) / lights.length);
    if (Math.abs(det) > 0.001) {
      const dx =
        ((lights[1] - lights[0]) * by - (lights[3] - lights[0]) * ay) / det;
      const dy =
        (ax * (lights[3] - lights[0]) - bx * (lights[1] - lights[0])) / det;
      const magnitude = Math.hypot(dx, dy);
      if (magnitude > 0.00001) {
        const span = Math.max(Math.hypot(ax, ay), Math.hypot(bx, by), 1);
        const gx = (dx / magnitude) * span,
          gy = (dy / magnitude) * span;
        const gradient = ctx.createLinearGradient(
          p0[0] - gx,
          p0[1] - gy,
          p0[0] + gx,
          p0[1] + gy,
        );
        gradient.addColorStop(0, skin(lights[0] - magnitude * span));
        gradient.addColorStop(1, skin(lights[0] + magnitude * span));
        ctx.fillStyle = gradient;
      }
    }
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    f.points.forEach((p, i) => {
      if (i) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
  // Palm creases remain visible when the palm is exposed; folded geometry covers them.
  if (!backFacing && !edgeOn && pose.slice(1).reduce((a, b) => a + b, 0) < 2) {
    ctx.strokeStyle = "rgba(137,101,81,.10)";
    ctx.lineWidth = 0.7;
    const crease = (points: V[]) => {
      ctx.beginPath();
      points
        .map(project)
        .forEach((p, i) =>
          i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]),
        );
      ctx.stroke();
    };
    crease([
      [-20, -12, 12],
      [-9, -5, 13],
      [8, -4, 13],
      [23, -10, 10],
    ]);
    crease([
      [-22, -6, 12],
      [-16, 9, 14],
      [-18, 23, 12],
      [-9, 33, 10],
    ]);
    crease([
      [-12, 19, 14],
      [0, 11, 14],
      [17, 7, 12],
    ]);
    crease([
      [-17, 51, 8],
      [0, 53, 9],
      [17, 51, 8],
    ]);
  }
}

export function ArticulatedHand({
  pose,
  x,
  y,
  scale = 1,
  angle = 0,
  left = false,
  backFacing = false,
  edgeOn = false,
  opacity = 1,
}: {
  pose: number[];
  x: number;
  y: number;
  scale?: number;
  angle?: number;
  left?: boolean;
  backFacing?: boolean;
  edgeOn?: boolean;
  opacity?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paint(ref.current, pose, backFacing, edgeOn);
  }, [pose, backFacing, edgeOn]);
  // Positioned in percentages of the 800×310 overlay so it tracks the <svg> at any size.
  return (
    <canvas
      ref={ref}
      className="tutorial-hand"
      width="440"
      height="500"
      style={{
        left: `${(x / VIEWBOX.w) * 100}%`,
        top: `${(y / VIEWBOX.h) * 100}%`,
        width: `${((220 * scale) / VIEWBOX.w) * 100}%`,
        aspectRatio: "220 / 250",
        // (110, 140) of the 220×250 box is the anchor placed at (x, y) and the pivot.
        transform: `translate(-50%, -56%) rotate(${angle}deg) scaleX(${left ? -1 : 1})`,
        transformOrigin: "50% 56%",
        opacity,
      }}
      aria-hidden="true"
    />
  );
}
