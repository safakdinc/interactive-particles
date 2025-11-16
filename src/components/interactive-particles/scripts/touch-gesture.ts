import { type OGLRenderingContext, Texture } from "ogl";

import { easeOutSine } from "./utils/easing";

type TrailPoint = {
    x: number;
    y: number;
    age: number;
    force: number;
};

type Position = {
    x: number;
    y: number;
};

export default class TouchTexture {
    private context: OGLRenderingContext;
    private size: number;
    private maxAge: number;
    private radius: number;
    private trail: TrailPoint[];
    private posCache: Position;
    private canvas!: HTMLCanvasElement;
    private ctx!: CanvasRenderingContext2D;
    public texture!: Texture;

    constructor(context: OGLRenderingContext) {
        this.context = context;
        this.size = 64;
        this.maxAge = 120;
        this.radius = 0.15;
        this.trail = [];

        this.posCache = { x: 0, y: 0 };

        this.initTexture();
    }

    private initTexture() {
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.canvas.height = this.size;

        const ctx = this.canvas.getContext("2d");
        if (!ctx) {
            throw new Error("Failed to get 2D context from canvas");
        }
        this.ctx = ctx;

        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.texture = new Texture(this.context, {
            image: this.canvas,
            minFilter: this.context.LINEAR,
        });

        this.canvas.id = "touchTexture";
        this.canvas.style.width =
            this.canvas.style.height = `${this.canvas.width}px`;
    }

    public update(isVisible = true) {
        if (!isVisible) return;

        this.clear();

        for (let i = this.trail.length - 1; i >= 0; i--) {
            this.trail[i].age++;
            if (this.trail[i].age > this.maxAge) {
                this.trail.splice(i, 1);
            }
        }

        this.trail.forEach((point) => {
            this.drawTouch(point);
        });

        this.texture.needsUpdate = true;
    }

    private clear() {
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    public addTouch(point: Position) {
        let force = 0;
        const last = this.trail[this.trail.length - 1];
        if (last) {
            const dx = last.x - point.x;
            const dy = last.y - point.y;
            const dd = dx * dx + dy * dy;
            force = Math.min(dd * 10000, 1);
        }
        this.trail.push({ x: point.x, y: point.y, age: 0, force });
    }

    private drawTouch(point: TrailPoint) {
        this.posCache.x = point.x * this.size;
        this.posCache.y = (1 - point.y) * this.size;

        let intensity = 1;
        if (point.age < this.maxAge * 0.3) {
            intensity = easeOutSine(point.age / (this.maxAge * 0.3), 0, 1, 1);
        } else {
            intensity = easeOutSine(
                1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7),
                0,
                1,
                1
            );
        }

        intensity *= point.force;

        const radius = this.size * this.radius * intensity;
        const grd = this.ctx.createRadialGradient(
            this.posCache.x,
            this.posCache.y,
            radius * 0.25,
            this.posCache.x,
            this.posCache.y,
            radius
        );
        grd.addColorStop(0, `rgba(255, 255, 255, 0.2)`);
        grd.addColorStop(1, "rgba(0, 0, 0, 0.0)");

        this.ctx.beginPath();
        this.ctx.fillStyle = grd;
        this.ctx.arc(this.posCache.x, this.posCache.y, radius, 0, Math.PI * 2);
        this.ctx.fill();
    }
}
