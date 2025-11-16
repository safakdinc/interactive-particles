// @author brunoimbrizi / http://brunoimbrizi.com

precision mediump float;

uniform sampler2D uTexture;
uniform vec3 uColor;

varying vec2 vPUv;
varying vec2 vUv;

void main() {
	vec4 color = vec4(0.0);
	vec2 uv = vUv;
	vec2 puv = vPUv;

  // Pre-computed constants for better performance
	const vec2 center = vec2(0.5);
	const float border = 0.3;
	const float radius = 0.5;

  // Early exit for pixels outside the circle (avoids unnecessary calculations)
	float dist = radius - distance(uv, center);
	if(dist <= 0.0) {
		discard; // Skip rendering fully transparent pixels
	}

  // Optimized texture sampling and luminance calculation
	vec4 colA = texture2D(uTexture, puv);

  // OPTIMIZED: Less aggressive early discard to prevent missing particles
	if(colA.a < 0.001) {
		discard;
	}

  // Use dynamic color from uniform instead of fixed color
	vec3 baseColor = uColor;

  // Set color (no modulation needed, density handles shades)
	vec4 colB = vec4(baseColor, 1.0);

  // Smooth circle edge using optimized smoothstep
	float t = smoothstep(0.0, border, dist);

  // Final color with optimized alpha blending
	color = colB;
	color.a = t;

  // Early exit for nearly transparent pixels (further optimization)
	if(color.a < 0.01) {
		discard;
	}

	gl_FragColor = color;
}