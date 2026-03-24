import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ElementRef,
  ViewChild,
  AfterViewInit,
  signal,
  computed,
} from '@angular/core';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface Point {
  x: number;
  y: number;
}

type GameState = 'idle' | 'running' | 'paused' | 'gameover';

const GRID_SIZE = 20;
const CELL_SIZE = 24;
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;
const INITIAL_SPEED = 150;
const SPEED_INCREMENT = 5;

@Component({
  selector: 'app-snake-game',
  imports: [],
  templateUrl: './snake-game.html',
  styleUrl: './snake-game.scss',
})
export class SnakeGame implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private gameLoop: ReturnType<typeof setTimeout> | null = null;
  private snake: Point[] = [];
  private food: Point = { x: 0, y: 0 };
  private direction: Direction = 'RIGHT';
  private nextDirection: Direction = 'RIGHT';

  readonly canvasSize = CANVAS_SIZE;
  readonly score = signal(0);
  readonly highScore = signal(0);
  readonly gameState = signal<GameState>('idle');
  readonly level = signal(1);
  readonly isPaused = computed(() => this.gameState() === 'paused');
  readonly isRunning = computed(() => this.gameState() === 'running');
  readonly isGameOver = computed(() => this.gameState() === 'gameover');
  readonly isIdle = computed(() => this.gameState() === 'idle');

  ngOnInit(): void {
    const saved = localStorage.getItem('snakeHighScore');
    if (saved) this.highScore.set(+saved);
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.drawIdleScreen();
  }

  ngOnDestroy(): void {
    this.stopLoop();
  }

  startGame(): void {
    this.initGame();
    this.gameState.set('running');
    this.startLoop();
  }

  togglePause(): void {
    if (this.gameState() === 'running') {
      this.gameState.set('paused');
      this.stopLoop();
      this.drawPauseOverlay();
    } else if (this.gameState() === 'paused') {
      this.gameState.set('running');
      this.startLoop();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }

    if (event.key === ' ') {
      if (this.gameState() === 'running' || this.gameState() === 'paused') {
        this.togglePause();
      } else if (this.gameState() === 'gameover' || this.gameState() === 'idle') {
        this.startGame();
      }
      return;
    }

    if (this.gameState() !== 'running') return;

    const map: Record<string, Direction> = {
      ArrowUp: 'UP',
      ArrowDown: 'DOWN',
      ArrowLeft: 'LEFT',
      ArrowRight: 'RIGHT',
      w: 'UP',
      s: 'DOWN',
      a: 'LEFT',
      d: 'RIGHT',
    };

    const newDir = map[event.key];
    if (!newDir) return;

    const opposites: Record<Direction, Direction> = {
      UP: 'DOWN',
      DOWN: 'UP',
      LEFT: 'RIGHT',
      RIGHT: 'LEFT',
    };

    if (newDir !== opposites[this.direction]) {
      this.nextDirection = newDir;
    }
  }

  private initGame(): void {
    this.score.set(0);
    this.level.set(1);
    this.direction = 'RIGHT';
    this.nextDirection = 'RIGHT';
    const mid = Math.floor(GRID_SIZE / 2);
    this.snake = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    this.spawnFood();
  }

  private startLoop(): void {
    this.stopLoop();
    const speed = Math.max(60, INITIAL_SPEED - (this.level() - 1) * SPEED_INCREMENT);
    this.gameLoop = setTimeout(() => this.tick(), speed);
  }

  private stopLoop(): void {
    if (this.gameLoop !== null) {
      clearTimeout(this.gameLoop);
      this.gameLoop = null;
    }
  }

  private tick(): void {
    this.direction = this.nextDirection;
    const head = this.snake[0];
    const newHead: Point = { x: head.x, y: head.y };

    switch (this.direction) {
      case 'UP':    newHead.y -= 1; break;
      case 'DOWN':  newHead.y += 1; break;
      case 'LEFT':  newHead.x -= 1; break;
      case 'RIGHT': newHead.x += 1; break;
    }

    // Wall collision
    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
      this.endGame();
      return;
    }

    // Self collision
    if (this.snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
      this.endGame();
      return;
    }

    this.snake.unshift(newHead);

    if (newHead.x === this.food.x && newHead.y === this.food.y) {
      const newScore = this.score() + 10 * this.level();
      this.score.set(newScore);
      if (newScore > this.highScore()) {
        this.highScore.set(newScore);
        localStorage.setItem('snakeHighScore', String(newScore));
      }
      // Level up every 5 foods
      if (this.snake.length % 5 === 0) {
        this.level.update(l => l + 1);
      }
      this.spawnFood();
    } else {
      this.snake.pop();
    }

    this.draw();
    this.startLoop();
  }

  private spawnFood(): void {
    let pos: Point;
    do {
      pos = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (this.snake.some(s => s.x === pos.x && s.y === pos.y));
    this.food = pos;
  }

  private endGame(): void {
    this.stopLoop();
    this.gameState.set('gameover');
    this.drawGameOverScreen();
  }

  // ---- Drawing ----

  private draw(): void {
    const ctx = this.ctx;
    const cs = CELL_SIZE;

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Grid dots
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        ctx.fillRect(x * cs + cs / 2 - 1, y * cs + cs / 2 - 1, 2, 2);
      }
    }

    // Food (pulsing apple)
    const foodX = this.food.x * cs;
    const foodY = this.food.y * cs;
    const padding = 3;
    ctx.fillStyle = '#f43f5e';
    this.roundRect(ctx, foodX + padding, foodY + padding, cs - padding * 2, cs - padding * 2, 5);
    ctx.fill();
    // shine
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(foodX + padding + 5, foodY + padding + 4, 3, 2, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Snake
    this.snake.forEach((seg, i) => {
      const x = seg.x * cs;
      const y = seg.y * cs;
      const p = 1;

      if (i === 0) {
        // Head gradient
        const grad = ctx.createLinearGradient(x, y, x + cs, y + cs);
        grad.addColorStop(0, '#4ade80');
        grad.addColorStop(1, '#16a34a');
        ctx.fillStyle = grad;
        this.roundRect(ctx, x + p, y + p, cs - p * 2, cs - p * 2, 6);
        ctx.fill();

        // Eyes
        const eyeSize = 3;
        ctx.fillStyle = '#0f172a';
        if (this.direction === 'RIGHT') {
          ctx.beginPath(); ctx.arc(x + cs - 6, y + 6, eyeSize, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + cs - 6, y + cs - 6, eyeSize, 0, Math.PI * 2); ctx.fill();
        } else if (this.direction === 'LEFT') {
          ctx.beginPath(); ctx.arc(x + 6, y + 6, eyeSize, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + 6, y + cs - 6, eyeSize, 0, Math.PI * 2); ctx.fill();
        } else if (this.direction === 'UP') {
          ctx.beginPath(); ctx.arc(x + 6, y + 6, eyeSize, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + cs - 6, y + 6, eyeSize, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.beginPath(); ctx.arc(x + 6, y + cs - 6, eyeSize, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + cs - 6, y + cs - 6, eyeSize, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        // Body — gradient from green to teal
        const t = i / this.snake.length;
        const r = Math.round(74 - t * 20);
        const g = Math.round(222 - t * 50);
        const b = Math.round(128 + t * 30);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        this.roundRect(ctx, x + p, y + p, cs - p * 2, cs - p * 2, 4);
        ctx.fill();
      }
    });
  }

  private drawIdleScreen(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.fillStyle = 'rgba(74, 222, 128, 0.1)';
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * CANVAS_SIZE;
      const y = Math.random() * CANVAS_SIZE;
      ctx.fillRect(x, y, CELL_SIZE - 2, CELL_SIZE - 2);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 36px "Segoe UI", sans-serif';
    ctx.fillText('🐍 SNAKE', CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 30);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '16px "Segoe UI", sans-serif';
    ctx.fillText('Drücke SPACE oder klicke Start', CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 15);
  }

  private drawPauseOverlay(): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 32px "Segoe UI", sans-serif';
    ctx.fillText('PAUSE', CANVAS_SIZE / 2, CANVAS_SIZE / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.fillText('SPACE zum Fortfahren', CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 30);
  }

  private drawGameOverScreen(): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 32px "Segoe UI", sans-serif';
    ctx.fillText('GAME OVER', CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px "Segoe UI", sans-serif';
    ctx.fillText(`Punkte: ${this.score()}`, CANVAS_SIZE / 2, CANVAS_SIZE / 2);
    ctx.fillStyle = '#facc15';
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.fillText(`Highscore: ${this.highScore()}`, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 28);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.fillText('SPACE oder Neu starten', CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 60);
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
