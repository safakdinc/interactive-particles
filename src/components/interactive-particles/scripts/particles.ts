import gsap from "gsap";
import {
    Color,
    Geometry,
    Mesh,
    type OGLRenderingContext,
    Plane,
    Program,
    Texture,
    Transform,
    Vec2,
    Vec3,
} from "ogl";
import particleFragText from "../shaders/fragment.glsl?raw";
import particleVertText from "../shaders/vertex.glsl?raw";
import TouchTexture from "./touch-gesture";

type RippleEffect = {
    center: { x: number; y: number };
    startTime: number;
    strength: number;
};

type UVTransformCache = {
    scaleX: number;
    scaleY: number;
    offsetX: number;
    offsetY: number;
};

type TextureUVCache = {
    x: number;
    y: number;
};

type InteractionEvent = {
    intersection?: {
        uv: { x: number; y: number };
    };
};

type WebGLView = {
    context: OGLRenderingContext;
    fovHeight: number;
    camera: {
        aspect: number;
    };
    renderer: {
        width: number;
        height: number;
    };
    interactive: {
        addListener: (
            event: string,
            handler: (e: InteractionEvent) => void
        ) => void;
        removeListener: (
            event: string,
            handler: (e: InteractionEvent) => void
        ) => void;
        objects: Mesh[];
        disable: () => void;
    };
};

export default class Particles {
    private webgl: WebGLView;
    private context: OGLRenderingContext;
    public container: Transform;
    private width!: number;
    private height!: number;
    private texture!: Texture;
    private numPoints!: number;
    private object3D!: Mesh;
    private hitArea!: Mesh;
    private touch?: TouchTexture;

    private ripple!: RippleEffect | null;
    private rippleDuration: number;
    private rippleFadeOutDuration: number;
    private isRippleActive: boolean;
    private textureUVCache: TextureUVCache;

    private uvTransformCache: UVTransformCache;
    private coverScale?: number;
    private scaledWidth?: number;
    private scaledHeight?: number;

    private handlerInteractiveMove?: (e: InteractionEvent) => void;
    private handlerInteractiveDown?: (e: InteractionEvent) => void;
    private threshold: number;
    private color: { r: number; g: number; b: number };
    private size: number;

    private hexToRgb(hex: string): { r: number; g: number; b: number } {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? {
                  r: parseInt(result[1], 16) / 255,
                  g: parseInt(result[2], 16) / 255,
                  b: parseInt(result[3], 16) / 255,
              }
            : { r: 0.7333333333333333, g: 0.7333333333333333, b: 0.7333333333333333 }; // default to rgb(187, 187, 187)
    }

    constructor(webgl: WebGLView, threshold: number, color: string = "#bbbbbb", size: number = 0.8) {
        this.webgl = webgl;
        this.context = this.webgl.context;
        this.container = new Transform();
        this.threshold = threshold;
        this.color = this.hexToRgb(color);
        this.size = size;

        this.ripple = null;
        this.rippleDuration = 4.0;
        this.rippleFadeOutDuration = 2.0;
        this.isRippleActive = false;

        this.textureUVCache = { x: 0, y: 0 };
        this.uvTransformCache = {
            scaleX: 1.0,
            scaleY: 1.0,
            offsetX: 0.0,
            offsetY: 0.0,
        };
    }

    public init(src: string) {
        const image = new Image();
        image.src = src;
        image.onload = () => {
            this.texture = new Texture(this.context, {
                image,
                minFilter: this.context.LINEAR,
                magFilter: this.context.LINEAR,
            });

            this.width = image.width;
            this.height = image.height;

            this.initPoints(true);
            this.initHitArea();
            this.initTouch();
            this.resize();
            this.show();
        };
    }

    private initPoints(discard: boolean) {
        this.numPoints = this.width * this.height;

        let numVisible = this.numPoints;
        let originalColors: Float32Array | undefined;
        const kept: number[] = [];

        if (discard) {
            numVisible = 0;

            const img = this.texture.image as HTMLImageElement;
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            if (!ctx) {
                throw new Error("Failed to get 2D context");
            }

            canvas.width = this.width;
            canvas.height = this.height;
            ctx.scale(1, -1);
            ctx.drawImage(img, 0, 0, this.width, this.height * -1);

            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            originalColors = Float32Array.from(imgData.data);

            //threshold adjustment
            const skipThreshold = this.threshold / 255.0;

            for (let i = 0; i < this.numPoints; i++) {
                const idx = i * 4;
                const r = originalColors[idx + 0];
                const g = originalColors[idx + 1];
                const b = originalColors[idx + 2];

                //some magical weight numbers from luminance standards. we are multipling it with rgb channels because human eye won't perceive all colors equally
                const lum = (0.21 * r + 0.71 * g + 0.07 * b) / 255.0;
                if (lum > skipThreshold) continue;

                const darkness = 1.0 - lum;

                //more magical numbers for dithering
                const seed = i * 12.9898 + 78.233;
                const rand = Math.sin(seed) * 43758.5453;
                const dither = Math.abs(rand - Math.floor(rand));

                if (darkness > dither) {
                    kept.push(i);
                }
            }

            numVisible = kept.length;
        } else {
            for (let i = 0; i < this.numPoints; i++) {
                kept.push(i);
            }
        }

        const program = new Program(this.context, {
            vertex: particleVertText,
            fragment: particleFragText,
            uniforms: {
                uTime: { value: 0 },
                uRandom: { value: 1.0 },
                uDepth: { value: 2.0 },
                uSize: { value: 0.0 },
                uTextureSize: { value: new Vec2(this.width, this.height) },
                uTexture: { value: this.texture },
                uTouch: { value: null },
                uMoveDisplacement: { value: 50.0 },
                uRippleCenter: { value: new Vec2(0, 0) },
                uRippleTime: { value: 0.0 },
                uRippleStrength: { value: 0.0 },
                uTexAspect: { value: this.width / this.height },
                uColor: { value: new Vec3(this.color.r, this.color.g, this.color.b) },
            },
            depthTest: false,
            transparent: true,
        });

        const positions = new Float32Array([
            -0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 0,
        ]);
        const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
        const index = new Uint16Array([0, 2, 1, 2, 3, 1]);

        const indices = new Uint16Array(numVisible);
        const offsets = new Float32Array(numVisible * 3);
        const angles = new Float32Array(numVisible);

        for (let j = 0; j < numVisible; j++) {
            const i = kept[j];
            offsets[j * 3 + 0] = i % this.width;
            offsets[j * 3 + 1] = Math.floor(i / this.width);
            indices[j] = i;
            angles[j] = Math.random() * Math.PI;
        }

        const geometry = new Geometry(this.context, {
            position: { size: 3, data: positions },
            uv: { size: 2, data: uvs },
            index: { data: index },
            pindex: { instanced: 1, size: 1, data: indices },
            offset: { instanced: 1, size: 3, data: offsets },
            angle: { instanced: 1, size: 1, data: angles },
        });

        this.object3D = new Mesh(this.context, { geometry, program });
        this.object3D.setParent(this.container);
    }

    private initHitArea() {
        const geometry = new Plane(this.context, { width: 2, height: 2 });
        const program = new Program(this.context, {
            vertex: `
        precision mediump float;
        attribute vec3 position;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
            fragment: `
        void main() {
          gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
        }
      `,
        });

        this.hitArea = new Mesh(this.context, { geometry, program });
        this.hitArea.program.uniforms.uColor = new Color(0xffffff);
        this.hitArea.visible = false;
        this.hitArea.setParent(this.container);
    }

    private initTouch() {
        if (!this.touch) this.touch = new TouchTexture(this.context);
        this.object3D.program.uniforms.uTouch.value = this.touch.texture;
    }

    private addListeners() {
        this.handlerInteractiveMove = this.onInteractiveMove.bind(this);
        this.handlerInteractiveDown = this.onInteractiveDown.bind(this);

        this.webgl.interactive.addListener(
            "interactive-move",
            this.handlerInteractiveMove
        );
        this.webgl.interactive.addListener(
            "interactive-down",
            this.handlerInteractiveDown
        );
        this.webgl.interactive.objects.push(this.hitArea);
    }

    private removeListeners() {
        if (!this.handlerInteractiveMove || !this.handlerInteractiveDown)
            return;

        this.webgl.interactive.removeListener(
            "interactive-move",
            this.handlerInteractiveMove
        );
        this.webgl.interactive.removeListener(
            "interactive-down",
            this.handlerInteractiveDown
        );

        const index = this.webgl.interactive.objects.findIndex(
            (obj) => obj === this.hitArea
        );
        if (index !== -1) {
            this.webgl.interactive.objects.splice(index, 1);
        }
        this.webgl.interactive.disable();
    }

    public update(delta: number, isVisible = true) {
        if (!this.object3D) return;

        if (!isVisible) return;

        if (this.touch) this.touch.update(isVisible);

        this.object3D.program.uniforms.uTime.value += delta;

        const currentTime = performance.now() / 1000;
        this.updateRipple(currentTime);
    }

    public show(time = 1.0) {
        gsap.fromTo(
            this.object3D.program.uniforms.uSize,
            { value: 0.0 },
            { value: this.size, duration: time }
        );
        gsap.to(this.object3D.program.uniforms.uRandom, {
            value: 1.0,
            duration: time,
        });
        gsap.fromTo(
            this.object3D.program.uniforms.uDepth,
            { value: 20.0 },
            { value: 2.0, duration: time * 1.5 }
        );

        this.addListeners();
    }

    public hide(_destroy?: boolean, time = 0.8): Promise<void> {
        return new Promise((resolve) => {
            gsap.to(this.object3D.program.uniforms.uRandom, {
                value: 5.0,
                duration: time,
                onComplete: () => {
                    if (_destroy) this.destroy();
                    resolve();
                },
            });
            gsap.to(this.object3D.program.uniforms.uDepth, {
                value: -20.0,
                duration: time,
                ease: "power2.in",
            });
            gsap.to(this.object3D.program.uniforms.uSize, {
                duration: time * 0.8,
                value: 0.0,
            });

            this.removeListeners();
        });
    }

    public destroy() {
        if (this.object3D) {
            this.container.removeChild(this.object3D);
            this.object3D.program.remove();
        }

        if (this.hitArea) {
            this.container.removeChild(this.hitArea);
            this.hitArea.program.remove();
        }
    }

    public resize() {
        if (!this.object3D) return;

        //fixed uv location calculation based on fov dimensions.
        //direct transform without aspect ratio consideration results offcentered ripple and touch effect.
        //do not get any deeper, it just works

        const fovWidth = this.webgl.fovHeight * this.webgl.camera.aspect;
        const fovHeight = this.webgl.fovHeight;

        const scaleX = fovWidth / this.width;
        const scaleY = fovHeight / this.height;
        const scale = Math.max(scaleX, scaleY);

        this.container.scale.set(scale, scale, 1);

        this.coverScale = scale;
        this.scaledWidth = this.width * scale;
        this.scaledHeight = this.height * scale;

        this.uvTransformCache.scaleX = fovWidth / this.scaledWidth;
        this.uvTransformCache.scaleY = fovHeight / this.scaledHeight;

        this.uvTransformCache.offsetX =
            (1.0 - this.uvTransformCache.scaleX) * 0.5;
        this.uvTransformCache.offsetY =
            (1.0 - this.uvTransformCache.scaleY) * 0.5;
    }

    private mapCanvasUVToTextureUV(canvasUV: {
        x: number;
        y: number;
    }): TextureUVCache {
        if (!this.coverScale) return canvasUV;

        this.textureUVCache.x =
            canvasUV.x * this.uvTransformCache.scaleX +
            this.uvTransformCache.offsetX;
        this.textureUVCache.y =
            canvasUV.y * this.uvTransformCache.scaleY +
            this.uvTransformCache.offsetY;

        return this.textureUVCache;
    }

    private onInteractiveMove(e: InteractionEvent) {
        if (!e.intersection) return;
        const canvasUV = e.intersection.uv;
        const textureUV = this.mapCanvasUVToTextureUV(canvasUV);
        if (this.touch) this.touch.addTouch(textureUV);
    }

    private onInteractiveDown(e: InteractionEvent) {
        if (e.intersection) {
            if (!this.isRippleActive) {
                const canvasUV = e.intersection.uv;
                const textureUV = this.mapCanvasUVToTextureUV(canvasUV);
                this.createRipple(textureUV.x, textureUV.y);
            }
        }
    }

    private createRipple(x: number, y: number) {
        if (this.isRippleActive) return;

        this.ripple = {
            center: { x, y },
            startTime: performance.now() / 1000,
            strength: 80.0,
        };

        this.isRippleActive = true;
    }

    private updateRipple(currentTime: number) {
        if (!this.object3D || !this.ripple) return;

        const elapsed = currentTime - this.ripple.startTime;
        const wavePhase =
            elapsed / (this.rippleDuration - this.rippleFadeOutDuration);
        const fadePhase =
            (elapsed - (this.rippleDuration - this.rippleFadeOutDuration)) /
            this.rippleFadeOutDuration;

        let strength: number;
        if (elapsed < this.rippleDuration - this.rippleFadeOutDuration) {
            strength = this.ripple.strength * Math.exp(-wavePhase * 2);
        } else {
            const fadeProgress = Math.max(0, Math.min(1, fadePhase));
            strength =
                this.ripple.strength *
                Math.exp(-wavePhase * 2) *
                (1.0 - fadeProgress);
        }

        if (elapsed > this.rippleDuration) {
            this.isRippleActive = false;
            this.ripple = null;
            this.object3D.program.uniforms.uRippleStrength.value = 0.0;
            return;
        }

        this.object3D.program.uniforms.uRippleCenter.value.set(
            this.ripple.center.x,
            this.ripple.center.y
        );
        this.object3D.program.uniforms.uRippleTime.value = elapsed;
        this.object3D.program.uniforms.uRippleStrength.value = Math.max(
            0,
            strength
        );
    }
}
