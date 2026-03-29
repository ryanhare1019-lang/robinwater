import { useRef, useEffect } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  phase: number;
  speed: number;
}

const PARTICLE_COUNT = 50;
const FIELD_SIZE = 4000;

export function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animFrame = useRef<number>(0);

  useEffect(() => {
    const ps: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.1 + Math.random() * 0.3;
      ps.push({
        x: (Math.random() - 0.5) * FIELD_SIZE,
        y: (Math.random() - 0.5) * FIELD_SIZE,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1 + Math.random() * 1, // 1-2px squares
        opacity: 0.03 + Math.random() * 0.05,
        phase: Math.random() * Math.PI * 2,
        speed,
      });
    }
    particles.current = ps;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let t = 0;

    const render = () => {
      t++;
      canvas.width = FIELD_SIZE;
      canvas.height = FIELD_SIZE;
      ctx.clearRect(0, 0, FIELD_SIZE, FIELD_SIZE);

      for (const p of particles.current) {
        p.x += p.vx;
        p.y += p.vy;

        const perpX = -p.vy / p.speed;
        const perpY = p.vx / p.speed;
        const osc = Math.sin(t * 0.02 + p.phase) * 0.3;

        const drawX = p.x + perpX * osc + FIELD_SIZE / 2;
        const drawY = p.y + perpY * osc + FIELD_SIZE / 2;

        // Wrap around
        if (p.x > FIELD_SIZE / 2) p.x -= FIELD_SIZE;
        if (p.x < -FIELD_SIZE / 2) p.x += FIELD_SIZE;
        if (p.y > FIELD_SIZE / 2) p.y -= FIELD_SIZE;
        if (p.y < -FIELD_SIZE / 2) p.y += FIELD_SIZE;

        // Square particles instead of circles
        ctx.fillStyle = `rgba(224, 224, 224, ${p.opacity})`;
        ctx.fillRect(drawX, drawY, p.size, p.size);
      }

      animFrame.current = requestAnimationFrame(render);
    };

    animFrame.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrame.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: -FIELD_SIZE / 2,
        left: -FIELD_SIZE / 2,
        width: FIELD_SIZE,
        height: FIELD_SIZE,
        pointerEvents: "none",
        opacity: 0.8,
      }}
    />
  );
}
