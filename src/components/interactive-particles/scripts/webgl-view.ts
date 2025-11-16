import { Camera, type OGLRenderingContext, Renderer, Transform } from "ogl";
import type App from "./interactive-canvas";
import InteractiveControls from "./interactive-controls";
import Particles from "./particles";

export default class WebGLView {
    public app: App;
    public scene!: Transform; // i know, i got shocked too but it's the closest thing to a scene from threejs
    public renderer!: Renderer;
    public context!: OGLRenderingContext;
    public camera!: Camera;
    public interactive!: InteractiveControls;
    public particles!: Particles;
    public fovHeight!: number;
    private lastTime!: number;

    constructor(app: App) {
        this.app = app;

        this.initOGL();
        this.initParticles();
        this.initControls();
        this.particles.init(this.app.image);
        this.resize();
    }

    private initOGL() {
        if (!this.app.container) {
            console.error("App container is not defined.");
            return;
        }

        const containerWidth = this.app.container?.clientWidth;
        const containerHeight = this.app.container?.clientHeight;

        this.scene = new Transform();

        this.renderer = new Renderer({ antialias: true, alpha: true });
        this.context = this.renderer.gl;

        this.camera = new Camera(this.context, {
            fov: 50,
            aspect: containerWidth / containerHeight,
            near: 1,
            far: 10000,
        });

        //adjustable density for different images
        const baseCameraPosition = 200;
        this.camera.position.z = baseCameraPosition / this.app.density;

        this.lastTime = performance.now();
    }

    private initControls() {
        this.interactive = new InteractiveControls(this.renderer.gl.canvas);
    }

    private initParticles() {
        this.particles = new Particles(this, this.app.threshold, this.app.color, this.app.size);
        this.particles.container.setParent(this.scene);
    }

    public update() {
        const currentTime = performance.now();
        const delta = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        if (this.particles) this.particles.update(delta, this.app.isVisible);
    }

    public draw() {
        this.renderer.render({ scene: this.scene, camera: this.camera });
    }

    public resize() {
        if (!this.renderer || !this.app.container) {
            console.error("Renderer or App container is not defined.");
            return;
        }

        const containerWidth = this.app.container.clientWidth;
        const containerHeight = this.app.container.clientHeight;

        this.camera.aspect = containerWidth / containerHeight;
        this.camera.updateProjectionMatrix();

        this.fovHeight =
            2 *
            Math.tan((this.camera.fov * Math.PI) / 180 / 2) *
            this.camera.position.z;

        this.renderer.setSize(containerWidth, containerHeight);

        const canvas = this.renderer.gl.canvas;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";

        if (this.interactive) {
            this.interactive.resize();
        }
        if (this.particles) this.particles.resize();
    }

    public dispose() {
        if (this.interactive) {
            this.interactive.disable();
        }
        if (this.particles) {
            this.particles.destroy();
        }

        if (this.renderer?.gl.canvas.parentNode) {
            this.renderer.gl.canvas.parentNode.removeChild(
                this.renderer.gl.canvas
            );
        }
    }
}
