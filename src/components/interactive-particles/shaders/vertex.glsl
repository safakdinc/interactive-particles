precision mediump float;

attribute float pindex;
attribute vec3 position;
attribute vec3 offset;
attribute vec2 uv;
attribute float angle;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

uniform float uTime;
uniform float uRandom;
uniform float uDepth;
uniform float uSize;
uniform vec2 uTextureSize;
uniform sampler2D uTexture;
uniform sampler2D uTouch;
uniform float uMoveDisplacement; 

// Ripple effect uniforms
uniform vec2 uRippleCenter;
uniform float uRippleTime;
uniform float uRippleStrength;

uniform float uTexAspect;

varying vec2 vPUv;
varying vec2 vUv;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise2(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float random(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  vUv = uv;

  highp vec2 puv = clamp(offset.xy / uTextureSize, 0.0, 1.0);
  vPUv = puv;

  vec4 colA = texture2D(uTexture, puv);
  float grey = dot(colA.rgb, vec3(0.21, 0.71, 0.07));

  // Pre-computed constants
  const float uRippleK = 15.0;
  const float uRippleSpeed = 0.8;
  const float uRippleRadius = 0.9;
  const float uRingWidth = 0.25 * 0.08;

  float rand1 = random(pindex);
  float rand2 = random(offset.x + pindex);
  float rand3 = random(pindex + 1.0);
  float noise1 = snoise2(vec2(pindex * 0.1, uTime * 0.1));
  float noise2 = snoise2(vec2(uTime * 0.5, pindex * 0.5));
  float noise3 = snoise2(puv * 8.0 + uRippleTime * 1.5);

  vec3 displaced = offset;
  displaced.xy += vec2(rand1 - 0.5, rand2 - 0.5) * uRandom;
  float rndz = (rand1 + noise1);
  displaced.z += rndz * (rand3 * 2.0 * uDepth);
  displaced.xy -= uTextureSize * 0.5;

  float t = texture2D(uTouch, puv).r;
  displaced.z += t * uMoveDisplacement * rndz;
  displaced.x += cos(angle) * t * uMoveDisplacement * rndz;
  displaced.y += sin(angle) * t * uMoveDisplacement * rndz;

  float rippleActive = step(0.001, uRippleStrength);
  if(rippleActive > 0.0) {
    vec2 rippleOffset = puv - uRippleCenter;
    vec2 isoOffset = rippleOffset;
    if(uTexAspect > 1.0) {
      isoOffset.x *= uTexAspect;
    } else {
      isoOffset.y *= 1.0 / uTexAspect;
    }
    float rippleDistance = length(isoOffset);

    float inRadius = step(rippleDistance, uRippleRadius);
    if(inRadius > 0.0) {
      float normalizedDistance = rippleDistance / uRippleRadius;
      float distanceAttenuation = 1.0 / (1.0 + uRippleK * normalizedDistance * normalizedDistance);
      float boundaryFade = 1.0 - smoothstep(0.85, 1.0, normalizedDistance);
      distanceAttenuation *= boundaryFade;

      vec2 rippleDirection = normalize(isoOffset + vec2(0.0001));

      float rippleWaveFront = min(uRippleTime * uRippleSpeed, uRippleRadius);
      float ringDistance = abs(rippleDistance - rippleWaveFront);
      float ringIntensity = exp(-ringDistance * ringDistance / (uRingWidth * uRingWidth));
      float shockwaveStrength = uRippleStrength * distanceAttenuation * ringIntensity * 0.7;

      float cavitationStrength = 0.0;
      const float maxCavitationRadius = 2.3 * uRippleRadius;
      float inCavitation = step(rippleDistance, min(rippleWaveFront, maxCavitationRadius));

      if(inCavitation > 0.0) {
        float explosionForce = exp(-normalizedDistance * 2.0);
        float timeSinceWavePassage = (min(rippleWaveFront, maxCavitationRadius) - rippleDistance) / uRippleSpeed;
        float buildupFactor = 1.0 - exp(-timeSinceWavePassage * 3.0);
        float cavitationNormalizedDistance = rippleDistance / maxCavitationRadius;
        float cavitationFade = 1.0 - cavitationNormalizedDistance;
        cavitationStrength = uRippleStrength * distanceAttenuation * explosionForce * buildupFactor * cavitationFade * 1.5;
      }

      float totalStrength = shockwaveStrength + cavitationStrength;

      float timeFade = 1.0;
      if(uRippleTime > 2.5) {
        float fadeOutTime = uRippleTime - 2.5;
        float returnSpeed = mix(0.6, 1.8, normalizedDistance);
        timeFade = exp(-fadeOutTime * returnSpeed);
      }
      totalStrength *= timeFade;

      if(totalStrength > 0.001) {
        float cavitationBoost = 1.0 + (cavitationStrength / max(uRippleStrength, 0.001)) * 1.2;
        float zBoost = 1.0 + (cavitationStrength / max(uRippleStrength, 0.001)) * 0.8;

        displaced.xy += rippleDirection * totalStrength * cavitationBoost * 2.0;
        displaced.z += totalStrength * rndz * zBoost * 2.5;

        float turbulenceStrength = totalStrength * cavitationBoost * 0.4;
        float turbulence = noise3 * 0.2;
        displaced.xy += rippleDirection * turbulence * turbulenceStrength;
      }
    }
  }

  float psize = (noise2 + 2.0);
  psize *= max(1.0 - grey, 0.2);
  psize *= uSize;

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  mvPosition.xyz += position * psize;
  vec4 finalPosition = projectionMatrix * mvPosition;

  gl_Position = finalPosition;
}