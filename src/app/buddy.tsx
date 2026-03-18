'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

// Buddy - 8-bit pitbull puppy & Happy Bear companions
// Ported from Richman's Sport dashboard

type ActivePet = 'winnie' | 'bear';

interface PupState {
  x: number;
  y: number;
  dir: number;
  state: string;
  frame: number;
  stateTimer: number;
  walkSpeed: number;
  awake: boolean;
  t: number;
  path: { x: number; y: number }[];
  pathIdx: number;
  targetX: number;
  targetY: number;
}

// ── Palettes ──

function pupPal(theme: string) {
  const day = theme === 'light';
  return day
    ? { body: '#5a9cc5', bodyLt: '#7eb8e0', dark: '#3a7ca8', white: '#d8eaf5', nose: '#2a5a80', eye: '#1a3a5a', tongue: '#d06070', outline: '#3a6a90' }
    : { body: '#7eb8e0', bodyLt: '#a0d4f0', dark: '#5a9cc5', white: '#e0f0ff', nose: '#3a7ca8', eye: '#1a4a70', tongue: '#e07080', outline: '#4a8ab0' };
}

function bearPal(theme: string) {
  const day = theme === 'light';
  return day
    ? { body: '#8B5E3C', bodyLt: '#A67B5B', dark: '#5C3A1E', white: '#D4B896', nose: '#2a1a0a', eye: '#1a0a00', mouth: '#c05050', ears: '#5C3A1E' }
    : { body: '#A67B5B', bodyLt: '#C49A6C', dark: '#6B4226', white: '#E8D5B7', nose: '#3a2010', eye: '#1a0a00', mouth: '#d06060', ears: '#6B4226' };
}

function px(c: CanvasRenderingContext2D, x: number, y: number, w?: number, h?: number) {
  c.fillRect(x, y, w || 1, h || 1);
}

// ── Draw Winnie (8-bit pitbull) ──

function drawWinnie(ctx: CanvasRenderingContext2D, pup: PupState, theme: string) {
  const c = ctx;
  c.clearRect(0, 0, 24, 24);
  const p = pupPal(theme);
  const f = Math.floor(pup.frame) % 4;
  const isPlay = pup.state === 'pet' || pup.state === 'treat';
  const bob = isPlay ? 0 : Math.round(Math.sin(pup.t) * 0.4);
  const headDip = isPlay ? 1 : 0;

  if (pup.state === 'sleep') {
    c.fillStyle = p.body; c.fillRect(6, 15, 12, 5);
    c.fillStyle = p.white; c.fillRect(8, 17, 6, 3);
    c.fillStyle = p.body; c.fillRect(1, 10, 10, 7);
    c.fillStyle = p.dark; c.fillRect(0, 9, 3, 4); c.fillRect(9, 9, 3, 4);
    c.fillStyle = p.white; c.fillRect(2, 14, 5, 3);
    c.fillStyle = p.nose; px(c, 2, 14, 2, 1);
    c.fillStyle = p.eye; px(c, 4, 12, 2, 1); px(c, 7, 12, 2, 1);
    c.fillStyle = p.body; px(c, 17, 14, 2, 1); px(c, 18, 13, 2, 1);
    return;
  }

  const by = bob + headDip;
  // Head
  c.fillStyle = p.body;
  c.fillRect(1, 1 + by, 11, 10); c.fillRect(0, 3 + by, 13, 6);
  c.fillRect(2, 0 + by, 9, 1);
  // Ears
  c.fillStyle = p.dark;
  c.fillRect(0, 0 + by, 2, 7); c.fillRect(11, 0 + by, 2, 7);
  // Muzzle
  c.fillStyle = p.white;
  c.fillRect(1, 7 + by, 7, 4); c.fillRect(0, 8 + by, 2, 2);
  // Nose
  c.fillStyle = p.nose; px(c, 1, 7 + by, 2, 2);
  // Eyes
  if (isPlay) {
    c.fillStyle = '#ff5577';
    px(c, 3, 3 + by); px(c, 5, 3 + by); px(c, 4, 4 + by);
    px(c, 7, 3 + by); px(c, 9, 3 + by); px(c, 8, 4 + by);
  } else {
    c.fillStyle = p.white; c.fillRect(3, 3 + by, 3, 3); c.fillRect(7, 3 + by, 3, 3);
    c.fillStyle = p.eye;
    const lk = pup.dir > 0 ? 1 : 0;
    c.fillRect(3 + lk, 4 + by, 2, 2); c.fillRect(7 + lk, 4 + by, 2, 2);
    c.fillStyle = p.white; px(c, 3 + lk, 4 + by); px(c, 7 + lk, 4 + by);
  }
  // Mouth
  if (isPlay) {
    c.fillStyle = p.nose; px(c, 2, 10 + by, 4, 1);
    c.fillStyle = p.tongue; c.fillRect(3, 11 + by, 2, 2);
  } else {
    c.fillStyle = p.nose; px(c, 3, 10 + by, 3, 1);
  }
  // Body
  c.fillStyle = p.body; c.fillRect(4, 11 + headDip, 9, 6);
  c.fillStyle = p.white; c.fillRect(5, 14 + headDip, 5, 3);
  c.fillStyle = p.bodyLt; c.fillRect(4, 11 + headDip, 9, 2);
  // Tail
  c.fillStyle = p.body;
  const ts = isPlay ? 8 : 1.5;
  const tw = Math.sin(pup.t * ts) * 1.5;
  const tl = isPlay ? -2 : 0;
  px(c, 13, 11 + headDip + Math.round(tw) + tl, 2, 1);
  px(c, 14, 10 + headDip + Math.round(tw) + tl, 2, 1);
  px(c, 15, 9 + headDip + Math.round(tw * 0.7) + tl, 1, 1);
  // Legs
  const ly = 17 + headDip;
  c.fillStyle = p.body;
  if (pup.state === 'walk') {
    const s = f;
    c.fillRect(5, ly, 2, s < 2 ? 4 : 3); c.fillRect(7, ly, 2, s < 2 ? 3 : 4);
    c.fillRect(9, ly, 2, s >= 2 ? 4 : 3); c.fillRect(11, ly, 2, s >= 2 ? 3 : 4);
    c.fillStyle = p.dark;
    px(c, 5, ly + (s < 2 ? 3 : 2), 2, 1); px(c, 7, ly + (s < 2 ? 2 : 3), 2, 1);
    px(c, 9, ly + (s >= 2 ? 3 : 2), 2, 1); px(c, 11, ly + (s >= 2 ? 2 : 3), 2, 1);
  } else if (isPlay) {
    c.fillRect(4, ly, 2, 4); c.fillRect(6, ly, 2, 4);
    c.fillRect(9, ly - 1, 2, 3); c.fillRect(11, ly - 1, 2, 3);
    c.fillStyle = p.dark;
    px(c, 4, ly + 3, 2, 1); px(c, 6, ly + 3, 2, 1); px(c, 9, ly + 1, 2, 1); px(c, 11, ly + 1, 2, 1);
  } else {
    c.fillRect(5, ly, 2, 3); c.fillRect(7, ly, 2, 3); c.fillRect(9, ly, 2, 3); c.fillRect(11, ly, 2, 3);
    c.fillStyle = p.dark;
    px(c, 5, ly + 2, 2, 1); px(c, 7, ly + 2, 2, 1); px(c, 9, ly + 2, 2, 1); px(c, 11, ly + 2, 2, 1);
  }
}

// ── Draw Happy Bear ──

function drawBear(ctx: CanvasRenderingContext2D, pup: PupState, theme: string) {
  const c = ctx;
  c.clearRect(0, 0, 24, 24);
  const p = bearPal(theme);
  const f = Math.floor(pup.frame) % 4;
  const isPlay = pup.state === 'pet' || pup.state === 'treat';
  const bob = isPlay ? 0 : Math.round(Math.sin(pup.t) * 0.4);
  const headDip = isPlay ? 1 : 0;

  if (pup.state === 'sleep') {
    c.fillStyle = p.body; c.fillRect(5, 14, 14, 6);
    c.fillStyle = p.white; c.fillRect(8, 16, 7, 4);
    c.fillStyle = p.body; c.fillRect(1, 9, 12, 8);
    c.fillStyle = p.ears; c.fillRect(1, 7, 4, 4); c.fillRect(9, 7, 4, 4);
    c.fillStyle = p.white; c.fillRect(3, 13, 6, 3);
    c.fillStyle = p.nose; px(c, 4, 13, 3, 2);
    c.fillStyle = p.eye; px(c, 4, 11, 2, 1); px(c, 8, 11, 2, 1);
    return;
  }

  const by = bob + headDip;
  // Round ears
  c.fillStyle = p.ears;
  c.fillRect(0, 0 + by, 4, 4); c.fillRect(9, 0 + by, 4, 4);
  c.fillStyle = p.bodyLt; px(c, 1, 1 + by, 2, 2); px(c, 10, 1 + by, 2, 2);
  // Big round head
  c.fillStyle = p.body;
  c.fillRect(0, 2 + by, 13, 10); c.fillRect(1, 1 + by, 11, 1); c.fillRect(1, 12 + by, 11, 1);
  // Muzzle
  c.fillStyle = p.white;
  c.fillRect(2, 8 + by, 8, 4); c.fillRect(3, 7 + by, 6, 1);
  // Nose
  c.fillStyle = p.nose; px(c, 4, 8 + by, 4, 2);
  // Eyes
  if (isPlay) {
    c.fillStyle = '#ff5577';
    px(c, 2, 4 + by); px(c, 4, 4 + by); px(c, 3, 5 + by);
    px(c, 8, 4 + by); px(c, 10, 4 + by); px(c, 9, 5 + by);
  } else {
    c.fillStyle = p.eye;
    c.fillRect(3, 4 + by, 2, 3); c.fillRect(8, 4 + by, 2, 3);
    c.fillStyle = p.white; px(c, 3, 4 + by); px(c, 8, 4 + by);
  }
  // Mouth
  if (isPlay) {
    c.fillStyle = p.mouth; px(c, 4, 11 + by, 4, 1);
    c.fillStyle = p.mouth; c.fillRect(5, 12 + by, 2, 1);
  } else {
    c.fillStyle = p.nose; px(c, 5, 11 + by, 2, 1);
  }
  // Body
  c.fillStyle = p.body; c.fillRect(3, 12 + headDip, 10, 6); c.fillRect(2, 13 + headDip, 12, 4);
  c.fillStyle = p.white; c.fillRect(5, 14 + headDip, 5, 4);
  c.fillStyle = p.bodyLt; c.fillRect(3, 12 + headDip, 10, 2);
  // Stubby tail
  c.fillStyle = p.body;
  px(c, 14, 13 + headDip, 1, 2);
  // Legs
  const ly = 17 + headDip;
  c.fillStyle = p.body;
  if (pup.state === 'walk') {
    const s = f;
    c.fillRect(4, ly, 2, s < 2 ? 4 : 3); c.fillRect(6, ly, 2, s < 2 ? 3 : 4);
    c.fillRect(9, ly, 2, s >= 2 ? 4 : 3); c.fillRect(11, ly, 2, s >= 2 ? 3 : 4);
    c.fillStyle = p.dark;
    px(c, 4, ly + (s < 2 ? 3 : 2), 2, 1); px(c, 6, ly + (s < 2 ? 2 : 3), 2, 1);
    px(c, 9, ly + (s >= 2 ? 3 : 2), 2, 1); px(c, 11, ly + (s >= 2 ? 2 : 3), 2, 1);
  } else if (isPlay) {
    c.fillRect(3, ly, 2, 4); c.fillRect(5, ly, 2, 4);
    c.fillRect(9, ly - 1, 2, 3); c.fillRect(11, ly - 1, 2, 3);
    c.fillStyle = p.dark;
    px(c, 3, ly + 3, 2, 1); px(c, 5, ly + 3, 2, 1); px(c, 9, ly + 1, 2, 1); px(c, 11, ly + 1, 2, 1);
  } else {
    c.fillRect(4, ly, 2, 3); c.fillRect(6, ly, 2, 3); c.fillRect(9, ly, 2, 3); c.fillRect(11, ly, 2, 3);
    c.fillStyle = p.dark;
    px(c, 4, ly + 2, 2, 1); px(c, 6, ly + 2, 2, 1); px(c, 9, ly + 2, 2, 1); px(c, 11, ly + 2, 2, 1);
  }
}

// ── Doghouse (for Winnie) ──

function drawDoghouseCanvas(ctx: CanvasRenderingContext2D, theme: string) {
  const c = ctx;
  const p = pupPal(theme);
  c.clearRect(0, 0, 40, 26);
  c.fillStyle = p.body;
  for (let i = 0; i < 6; i++) c.fillRect(9 - i * 2, i, 22 + i * 4, 1);
  c.fillRect(1, 6, 38, 20);
  c.fillStyle = p.dark; c.fillRect(13, 10, 14, 16); c.fillRect(14, 8, 12, 2); c.fillRect(15, 7, 10, 1);
}

// ── Cave (for Bear) ──

function drawCaveCanvas(ctx: CanvasRenderingContext2D, theme: string) {
  const c = ctx;
  const p = bearPal(theme);
  c.clearRect(0, 0, 40, 26);
  c.fillStyle = p.dark;
  c.fillRect(2, 8, 36, 18); c.fillRect(4, 6, 32, 2); c.fillRect(6, 4, 28, 2); c.fillRect(10, 2, 20, 2); c.fillRect(14, 0, 12, 2);
  c.fillStyle = '#0a0a0a'; c.fillRect(12, 10, 16, 16); c.fillRect(14, 8, 12, 2);
  c.fillStyle = p.body; px(c, 5, 10, 3, 2); px(c, 30, 12, 4, 2); px(c, 8, 18, 2, 2); px(c, 32, 18, 3, 2);
}

// ── Sign: "BUDDY" (for Winnie) ──

function drawWinnieSignCanvas(ctx: CanvasRenderingContext2D, theme: string) {
  const c = ctx;
  const p = pupPal(theme);
  c.clearRect(0, 0, 28, 22);
  c.fillStyle = p.body;
  c.fillRect(13, 0, 2, 22);
  c.fillRect(0, 3, 28, 11);
  c.fillStyle = p.white;
  // W
  px(c, 3, 5); px(c, 3, 6); px(c, 3, 7); px(c, 3, 8); px(c, 4, 9); px(c, 5, 8); px(c, 6, 9); px(c, 7, 5); px(c, 7, 6); px(c, 7, 7); px(c, 7, 8);
  // I
  px(c, 9, 5); px(c, 9, 6); px(c, 9, 7); px(c, 9, 8); px(c, 9, 9);
  // N
  px(c, 11, 5); px(c, 11, 6); px(c, 11, 7); px(c, 11, 8); px(c, 11, 9); px(c, 12, 6); px(c, 13, 7); px(c, 14, 5); px(c, 14, 6); px(c, 14, 7); px(c, 14, 8); px(c, 14, 9);
  // N
  px(c, 16, 5); px(c, 16, 6); px(c, 16, 7); px(c, 16, 8); px(c, 16, 9); px(c, 17, 6); px(c, 18, 7); px(c, 19, 5); px(c, 19, 6); px(c, 19, 7); px(c, 19, 8); px(c, 19, 9);
  // I
  px(c, 21, 5); px(c, 21, 6); px(c, 21, 7); px(c, 21, 8); px(c, 21, 9);
  // E
  px(c, 23, 5); px(c, 23, 6); px(c, 23, 7); px(c, 23, 8); px(c, 23, 9); px(c, 24, 5); px(c, 24, 7); px(c, 24, 9); px(c, 25, 5); px(c, 25, 9);
}

// ── Sign: "HAPPY" (for Bear) ──

function drawBearSignCanvas(ctx: CanvasRenderingContext2D, theme: string) {
  const c = ctx;
  const p = bearPal(theme);
  c.clearRect(0, 0, 28, 22);
  c.fillStyle = p.dark;
  c.fillRect(13, 0, 2, 22);
  c.fillRect(0, 3, 28, 11);
  c.fillStyle = p.white;
  // H
  px(c, 2, 5); px(c, 2, 6); px(c, 2, 7); px(c, 2, 8); px(c, 2, 9); px(c, 3, 7); px(c, 4, 5); px(c, 4, 6); px(c, 4, 7); px(c, 4, 8); px(c, 4, 9);
  // A
  px(c, 6, 6); px(c, 6, 7); px(c, 6, 8); px(c, 6, 9); px(c, 7, 5); px(c, 7, 7); px(c, 8, 6); px(c, 8, 7); px(c, 8, 8); px(c, 8, 9);
  // P
  px(c, 10, 5); px(c, 10, 6); px(c, 10, 7); px(c, 10, 8); px(c, 10, 9); px(c, 11, 5); px(c, 11, 7); px(c, 12, 5); px(c, 12, 6);
  // P
  px(c, 14, 5); px(c, 14, 6); px(c, 14, 7); px(c, 14, 8); px(c, 14, 9); px(c, 15, 5); px(c, 15, 7); px(c, 16, 5); px(c, 16, 6);
  // Y
  px(c, 18, 5); px(c, 18, 6); px(c, 19, 7); px(c, 19, 8); px(c, 19, 9); px(c, 20, 5); px(c, 20, 6);
}

export default function Buddy({ theme }: { theme: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dhCanvasRef = useRef<HTMLCanvasElement>(null);
  const signCanvasRef = useRef<HTMLCanvasElement>(null);
  const pupRef = useRef<PupState>({
    x: 100, y: 60, dir: 1, state: 'walk', frame: 0,
    stateTimer: Date.now(), walkSpeed: 0.4, awake: true, t: 0,
    path: [], pathIdx: 0, targetX: 0, targetY: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const activePetRef = useRef<ActivePet>('winnie');
  const [activePet, setActivePet] = useState<ActivePet>('winnie');
  const swapTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const drawHouseAndSign = useCallback((pet: ActivePet) => {
    const dhCtx = dhCanvasRef.current?.getContext('2d');
    const signCtx = signCanvasRef.current?.getContext('2d');
    if (!dhCtx || !signCtx) return;
    if (pet === 'winnie') {
      drawDoghouseCanvas(dhCtx, theme);
      drawWinnieSignCanvas(signCtx, theme);
    } else {
      drawCaveCanvas(dhCtx, theme);
      drawBearSignCanvas(signCtx, theme);
    }
  }, [theme]);

  const switchPet = useCallback((pet: ActivePet) => {
    activePetRef.current = pet;
    setActivePet(pet);
    drawHouseAndSign(pet);
  }, [drawHouseAndSign]);

  const togglePet = useCallback(() => {
    const next = activePetRef.current === 'winnie' ? 'bear' : 'winnie';
    switchPet(next);
  }, [switchPet]);

  const setupPath = useCallback(() => {
    const container = containerRef.current?.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const dhEl = dhCanvasRef.current;
    // Walk horizontally at doghouse level, like Richmans Sport dashboard
    const dhBottom = dhEl ? dhEl.getBoundingClientRect().bottom - rect.top : 60;
    const walkY = dhBottom - 48;
    const w = rect.width - 48;
    pupRef.current.path = [
      { x: 0, y: walkY },
      { x: w, y: walkY },
    ];
    pupRef.current.pathIdx = 0;
    pupRef.current.x = 0;
    pupRef.current.y = walkY;
    pupRef.current.targetX = w;
    pupRef.current.targetY = walkY;
    pupRef.current.pathIdx = 1;
  }, []);

  // Draw house/sign on theme or pet change
  useEffect(() => {
    drawHouseAndSign(activePetRef.current);
  }, [theme, drawHouseAndSign]);

  // Auto-swap timer: switch pets every 10 minutes
  useEffect(() => {
    swapTimerRef.current = setInterval(() => {
      togglePet();
    }, 600000);
    return () => {
      if (swapTimerRef.current) clearInterval(swapTimerRef.current);
    };
  }, [togglePet]);

  useEffect(() => {
    setupPath();

    const loop = () => {
      const pup = pupRef.current;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) { animRef.current = requestAnimationFrame(loop); return; }

      const now = Date.now();
      pup.t += 0.015;

      if (pup.state === 'pet' || pup.state === 'treat') {
        pup.frame += 0.04;
        if (now - pup.stateTimer > 3000) { pup.state = 'walk'; pup.stateTimer = now; }
      } else if (pup.state === 'walk' && pup.awake) {
        pup.frame += 0.02;
        const tx = pup.targetX, ty = pup.targetY;
        const dx = tx - pup.x, dy = ty - pup.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 2) {
          if (Math.random() < 0.3) { pup.state = 'sit'; pup.stateTimer = now; }
          pup.pathIdx = (pup.pathIdx + 1) % pup.path.length;
          pup.targetX = pup.path[pup.pathIdx].x;
          pup.targetY = pup.path[pup.pathIdx].y;
        } else {
          pup.x += dx / dist * pup.walkSpeed;
          pup.y += dy / dist * pup.walkSpeed;
        }
        if (Math.abs(dx) > 1) pup.dir = dx > 0 ? 1 : -1;
        if (now - pup.stateTimer > 120000) {
          pup.state = 'sleep'; pup.awake = false;
        }
      } else if (pup.state === 'sit') {
        pup.frame += 0.01;
        if (now - pup.stateTimer > 3000) {
          pup.state = 'walk'; pup.stateTimer = now;
          pup.pathIdx = (pup.pathIdx + 1) % pup.path.length;
          pup.targetX = pup.path[pup.pathIdx].x;
          pup.targetY = pup.path[pup.pathIdx].y;
        }
      } else if (pup.state === 'sleep') {
        pup.frame += 0.01;
      } else if (pup.state === 'wakeUp') {
        pup.frame += 0.08;
        pup.dir = Math.sin((now - pup.stateTimer) * 0.02) > 0 ? 1 : -1;
        if (now - pup.stateTimer > 2000) {
          pup.state = 'walk'; pup.stateTimer = now; pup.dir = 1;
          setupPath();
        }
      }

      // Draw active pet
      if (activePetRef.current === 'winnie') {
        drawWinnie(ctx, pup, theme);
      } else {
        drawBear(ctx, pup, theme);
      }

      // Position the canvas element
      const el = canvasRef.current?.parentElement;
      if (el) {
        el.style.left = pup.x + 'px';
        el.style.top = pup.y + 'px';
        el.style.transform = pup.dir < 0 ? 'scaleX(-1)' : '';
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    const handleResize = () => {
      if (pupRef.current.awake && pupRef.current.state === 'walk') setupPath();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [theme, setupPath]);

  const handleClick = () => {
    const pup = pupRef.current;
    if (!pup.awake) {
      pup.awake = true;
      pup.state = 'wakeUp';
      pup.stateTimer = Date.now();
      pup.frame = 0;
      return;
    }
    const act = Math.random() > 0.5 ? 'pet' : 'treat';
    pup.state = act;
    pup.frame = 0;
    pup.stateTimer = Date.now();
  };

  const handleDoghouseClick = () => {
    const pup = pupRef.current;
    if (!pup.awake) {
      pup.awake = true;
      pup.state = 'wakeUp';
      pup.stateTimer = Date.now();
    } else {
      pup.state = 'sleep';
      pup.awake = false;
      pup.x = -100;
      pup.y = -100;
    }
  };

  return (
    <div ref={containerRef}>
      {/* Doghouse / Cave + Sign + Toggle */}
      <div
        className="flex items-end justify-center gap-0 mb-4 pt-2"
        style={{ imageRendering: 'pixelated' }}
      >
        <div className="relative cursor-pointer" onClick={handleDoghouseClick}>
          <canvas ref={dhCanvasRef} width={40} height={26} style={{ width: 80, height: 52, imageRendering: 'pixelated' }} />
          {!pupRef.current.awake && (
            <div className="absolute -top-3 right-2 flex gap-0.5 pointer-events-none">
              <span className="text-xs font-bold animate-pulse" style={{ color: 'var(--accent)' }}>z</span>
              <span className="text-sm font-bold animate-pulse" style={{ color: 'var(--accent)', animationDelay: '0.3s' }}>z</span>
              <span className="text-base font-bold animate-pulse" style={{ color: 'var(--accent)', animationDelay: '0.6s' }}>z</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-center ml-1 mb-1">
          <canvas ref={signCanvasRef} width={28} height={22} style={{ width: 56, height: 44, imageRendering: 'pixelated' }} />
        </div>
      </div>

      {/* Pet toggle button - fixed top right */}
      <button
        onClick={togglePet}
        title={activePet === 'winnie' ? 'Switch to Happy Bear' : 'Switch to Winnie'}
        className="fixed top-4 right-4 text-2xl cursor-pointer hover:scale-110 transition-transform select-none z-50"
        style={{ background: 'none', border: 'none', padding: '4px 8px' }}
      >
        {activePet === 'winnie' ? '\u{1F415}' : '\u{1F43B}'}
      </button>

      {/* Walking pet */}
      <div
        onClick={handleClick}
        className="absolute cursor-pointer z-50"
        style={{ width: 48, height: 48, imageRendering: 'pixelated' }}
      >
        <canvas
          ref={canvasRef}
          width={24}
          height={24}
          style={{ width: 48, height: 48, imageRendering: 'pixelated' }}
        />
      </div>
    </div>
  );
}
