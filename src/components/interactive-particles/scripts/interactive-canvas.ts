import WebGLView from "./webgl-view";

export default class InteractiveCanvas {
  public container?: HTMLElement;
  public image: string;
  public isVisible: boolean;
  public threshold: number;
  public density: number;
  public color: string;
  public size: number;
  private webgl?: WebGLView;
  private observer?: IntersectionObserver;
  private animationFrame?: number;
  private handlerAnimate?: () => void;

  constructor(
    image: string,
    container?: HTMLElement,
    threshold: number = 200,
    density: number = 1,
    color: string = "#0047bb",
    size: number = 0.8,
  ) {
    this.container = container;
    this.image = image;
    this.threshold = threshold;
    this.density = density;
    this.color = color;
    this.size = size;
    this.isVisible = false;
    this.init();
  }

  private init() {
    this.initWebGL();
    this.initViewportObserver();
    this.addListeners();
    this.animate();
    this.resize();
  }

  private initWebGL() {
    this.webgl = new WebGLView(this);
    if (!this.container) {
      console.error("App container is not defined.");
      return;
    }
    this.container.appendChild(this.webgl.renderer.gl.canvas);
  }

  private initViewportObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          this.isVisible = entry.isIntersecting;
          if (this.isVisible && !this.animationFrame) {
            this.animate();
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "50px 0px 50px 0px",
      },
    );

    if (this.container) {
      this.observer.observe(this.container);
    }
  }

  private addListeners() {
    this.handlerAnimate = this.animate.bind(this);
  }

  private animate() {
    if (this.isVisible) {
      this.update();
      this.draw();
    }

    if (this.handlerAnimate) {
      this.animationFrame = requestAnimationFrame(this.handlerAnimate);
    }
  }

  public enableControls() {
    if (this.webgl?.interactive) {
      this.webgl.interactive.enable();
    }
  }

  public update() {
    if (this.webgl) this.webgl.update();
  }

  public draw() {
    if (this.webgl) this.webgl.draw();
  }

  public resize() {
    if (this.webgl) this.webgl.resize();
  }

  public dispose() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.webgl) {
      this.webgl.dispose();
    }
  }
}
