let alreadyTested = false;
let passiveSupported = false;

const isSupported = (): boolean => {
  if (alreadyTested) return passiveSupported;
  alreadyTested = true;

  try {
    const opts = Object.defineProperty({}, "passive", {
      get: () => {
        passiveSupported = true;
      },
    });
    const noop = (): void => {};
    window.addEventListener("test", noop, opts);
    window.removeEventListener("test", noop, opts);
  } catch {
    return passiveSupported;
  }
  return passiveSupported;
};

const passiveEvent = (): AddEventListenerOptions | boolean => {
  return isSupported() ? { passive: true } : false;
};

export { passiveEvent };
