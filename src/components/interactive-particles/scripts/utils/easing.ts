type EasingFunction = (t: number, b: number, c: number, d: number) => number;

const easeInQuad: EasingFunction = (t, b, c, d) => {
  t /= d;
  return c * t * t + b;
};

const easeOutQuad: EasingFunction = (t, b, c, d) => {
  t /= d;
  return -c * t * (t - 2) + b;
};

const easeInOutQuad: EasingFunction = (t, b, c, d) => {
  t /= d / 2;
  if (t < 1) return (c / 2) * t * t + b;
  t--;
  return (-c / 2) * (t * (t - 2) - 1) + b;
};

const easeInOutQuart: EasingFunction = (t, b, c, d) => {
  t /= d / 2;
  if (t < 1) {
    return (c / 2) * t * t * t * t + b;
  } else {
    t -= 2;
    return (-c / 2) * (t * t * t * t - 2) + b;
  }
};

const easeInSine: EasingFunction = (t, b, c, d) => {
  return -c * Math.cos((t / d) * (Math.PI / 2)) + c + b;
};

const easeOutSine: EasingFunction = (t, b, c, d) => {
  return c * Math.sin((t / d) * (Math.PI / 2)) + b;
};

const easeInOutSine: EasingFunction = (t, b, c, d) => {
  return (-c / 2) * (Math.cos((Math.PI * t) / d) - 1) + b;
};

export type { EasingFunction };

export {
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInOutQuart,
  easeInSine,
  easeOutSine,
  easeInOutSine,
};
