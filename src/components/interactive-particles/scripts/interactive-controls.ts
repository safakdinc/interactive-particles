import browser from "browser-detect";
import { type Mesh, Vec2 } from "ogl";

import { passiveEvent } from "./utils/events";

class EventEmitter {
  private events: { [key: string]: ((...args: unknown[]) => void)[] } = {};

  emit(event: string, ...args: unknown[]): boolean {
    if (!this.events[event]) return false;
    this.events[event].forEach((callback) => callback(...args));
    return true;
  }

  on(event: string, callback: (...args: unknown[]) => void): this {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
    return this;
  }

  off(event: string, callback: (...args: unknown[]) => void): this {
    if (!this.events[event]) return this;
    this.events[event] = this.events[event].filter((cb) => cb !== callback);
    return this;
  }

  addListener(event: string, callback: (...args: unknown[]) => void): this {
    return this.on(event, callback);
  }

  removeListener(event: string, callback: (...args: unknown[]) => void): this {
    return this.off(event, callback);
  }

  removeAllListeners(event?: string): this {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }
}

type IntersectionData = {
  uv: { x: number; y: number };
  object: Mesh;
};

type BrowserInfo = {
  mobile: boolean;
};

type RectInfo = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export default class InteractiveControls extends EventEmitter {
  private enabled: boolean;
  private el: HTMLElement;
  private mouse: Vec2;
  public objects: Mesh[];
  private hovered: Mesh | null;
  private selected: Mesh | null;
  private isDown: boolean;
  private browser: BrowserInfo;
  private uvCache: { x: number; y: number };
  private handlerDown?: (e: Event) => void;
  private handlerMove?: (e: Event) => void;
  private handlerUp?: (e: Event) => void;
  private handlerLeave?: (e: Event) => void;
  private intersectionData: IntersectionData | null = null;
  private rect?: RectInfo;

  constructor(el: HTMLElement) {
    super();

    this.el = el;
    this.mouse = new Vec2();
    this.objects = [];
    this.hovered = null;
    this.selected = null;
    this.isDown = false;
    this.browser = browser() as BrowserInfo;
    this.uvCache = { x: 0, y: 0 };
    this.enabled = false;
  }

  public enable() {
    if (this.enabled) return;
    this.addListeners();
    this.enabled = true;
  }

  public disable() {
    if (!this.enabled) return;
    this.removeListeners();
    this.enabled = false;
  }

  private addListeners() {
    this.handlerDown = this.onDown.bind(this);
    this.handlerMove = this.onMove.bind(this);
    this.handlerUp = this.onUp.bind(this);
    this.handlerLeave = this.onLeave.bind(this);

    if (this.browser.mobile) {
      this.el.addEventListener("touchstart", this.handlerDown, passiveEvent());
      this.el.addEventListener("touchmove", this.handlerMove, passiveEvent());
      this.el.addEventListener("touchend", this.handlerUp, passiveEvent());
    } else {
      this.el.addEventListener("mousedown", this.handlerDown);
      this.el.addEventListener("mousemove", this.handlerMove);
      this.el.addEventListener("mouseup", this.handlerUp);
      this.el.addEventListener("mouseleave", this.handlerLeave);
    }
  }

  private removeListeners() {
    if (
      !this.handlerDown ||
      !this.handlerMove ||
      !this.handlerUp ||
      !this.handlerLeave
    ) {
      return;
    }

    if (this.browser.mobile) {
      this.el.removeEventListener("touchstart", this.handlerDown);
      this.el.removeEventListener("touchmove", this.handlerMove);
      this.el.removeEventListener("touchend", this.handlerUp);
    } else {
      this.el.removeEventListener("mousedown", this.handlerDown);
      this.el.removeEventListener("mousemove", this.handlerMove);
      this.el.removeEventListener("mouseup", this.handlerUp);
      this.el.removeEventListener("mouseleave", this.handlerLeave);
    }
  }

  public resize() {
    this.rect = this.el.getBoundingClientRect();
  }

  private onMove(e: Event) {
    const t = (e as TouchEvent).touches
      ? (e as TouchEvent).touches[0]
      : (e as MouseEvent);

    const rect = this.el.getBoundingClientRect();

    const x = t.clientX - rect.left;
    const y = t.clientY - rect.top;

    this.mouse.x = (x / rect.width) * 2 - 1;
    this.mouse.y = -((y / rect.height) * 2 - 1);

    this.uvCache.x = x / rect.width;
    this.uvCache.y = 1.0 - y / rect.height;

    if (
      this.objects.length > 0 &&
      this.uvCache.x >= 0 &&
      this.uvCache.x <= 1 &&
      this.uvCache.y >= 0 &&
      this.uvCache.y <= 1
    ) {
      const object = this.objects[0];
      this.intersectionData = { uv: this.uvCache, object };

      if (this.hovered !== object) {
        this.emit("interactive-out", {
          object: this.hovered,
        });
        this.emit("interactive-over", { object });
        this.hovered = object;
      } else {
        this.emit("interactive-move", {
          object,
          intersection: this.intersectionData,
        });
      }
    } else {
      this.intersectionData = null;

      if (this.hovered !== null) {
        this.emit("interactive-out", {
          object: this.hovered,
        });
        this.hovered = null;
      }
    }
  }

  private onDown(e: Event) {
    this.isDown = true;
    this.onMove(e);

    this.emit("interactive-down", {
      object: this.hovered,
      previous: this.selected,
      intersection: this.intersectionData,
    });
    this.selected = this.hovered;
  }

  private onUp() {
    this.isDown = false;
    this.emit("interactive-up", { object: this.hovered });
  }

  private onLeave() {
    this.onUp();
    this.emit("interactive-out", {
      object: this.hovered,
    });
    this.hovered = null;
  }
}
