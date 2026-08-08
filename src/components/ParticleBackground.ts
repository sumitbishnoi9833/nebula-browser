interface Particle { x: number; y: number; vx: number; vy: number; size: number; hue: number; life: number; maxLife: number; }
interface Connection { from: number; to: number; opacity: number; }

export class ParticleBackground {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private connections: Connection[] = [];
  private mouseX = -1000;
  private mouseY = -1000;
  private animationId: number | null = null;
  private width = 0;
  private height = 0;
  private particleCount = 60;
  private connectionDistance = 140;
  private mouseInfluence = 180;
  private reducedMotion = false;

  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) throw new Error(`Canvas ${canvasId} not found`);
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not supported');
    this.ctx = ctx;

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.init();
  }

  private init() {
    this.resize();
    this.createParticles();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    document.addEventListener('mouseleave', () => {
      this.mouseX = -1000;
      this.mouseY = -1000;
    });
  }

  private resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  private createParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push(this.createParticle());
    }
  }

  private createParticle(): Particle {
    const hue = Math.random() > 0.5 ? 190 + Math.random() * 30 : 270 + Math.random() * 40;
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      size: 1.5 + Math.random() * 2.5,
      hue,
      life: 0,
      maxLife: 200 + Math.random() * 300,
    };
  }

  start() {
    if (this.reducedMotion) return;
    this.animate();
  }

  private animate = () => {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.updateParticles();
    this.drawConnections();
    this.drawParticles();
    this.animationId = requestAnimationFrame(this.animate);
  };

  private updateParticles() {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life++;

      const dx = this.mouseX - p.x;
      const dy = this.mouseY - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < this.mouseInfluence && dist > 0) {
        const force = (1 - dist / this.mouseInfluence) * 0.8;
        p.vx -= (dx / dist) * force;
        p.vy -= (dy / dist) * force;
      }

      p.vx *= 0.995;
      p.vy *= 0.995;

      if (p.x < -50) p.x = this.width + 50;
      if (p.x > this.width + 50) p.x = -50;
      if (p.y < -50) p.y = this.height + 50;
      if (p.y > this.height + 50) p.y = -50;

      if (p.life >= p.maxLife) Object.assign(p, this.createParticle());
    }
  }

  private drawParticles() {
    for (const p of this.particles) {
      const alpha = 0.3 + 0.4 * Math.sin(p.life * 0.02);
      const gradient = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
      gradient.addColorStop(0, `hsla(${p.hue}, 80%, 60%, ${alpha})`);
      gradient.addColorStop(1, `hsla(${p.hue}, 80%, 40%, 0)`);
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawConnections() {
    this.connections = [];
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const dx = this.particles[j].x - this.particles[i].x;
        const dy = this.particles[j].y - this.particles[i].y;
        const dist = Math.hypot(dx, dy);
        if (dist < this.connectionDistance) {
          this.connections.push({ from: i, to: j, opacity: 1 - dist / this.connectionDistance });
        }
      }
    }

    for (const conn of this.connections) {
      const p1 = this.particles[conn.from];
      const p2 = this.particles[conn.to];
      const alpha = conn.opacity * 0.15;
      const gradient = this.ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
      gradient.addColorStop(0, `hsla(${p1.hue}, 80%, 60%, ${alpha})`);
      gradient.addColorStop(1, `hsla(${p2.hue}, 80%, 60%, ${alpha})`);
      this.ctx.strokeStyle = gradient;
      this.ctx.lineWidth = 0.6;
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
    }
  }
}
