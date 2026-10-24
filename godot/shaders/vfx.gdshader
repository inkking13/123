// Spell effects: one additive shader for every piece SpellFx draws, so a
// budget phone compiles it once. `shape` picks the picture, `t` runs the
// piece's life from 0 to 1 (fade in, hold, fade out).
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;

uniform vec3 color = vec3(1.0);
uniform float energy = 1.0;
// 0 glow, 1 ring sweeping out, 2 sigil on the ground, 3 slash, 4 column of light, 5 bubble
uniform int shape = 0;
uniform float t = 0.0;
// Turns the picture in its own plane (radians).
uniform float spin = 0.0;
uniform bool billboard = false;
// Drawn by CPUParticles3D: each particle's colour and fade come in COLOR.
uniform bool particle = false;

void vertex() {
	if (billboard) {
		MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
		MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(vec4(length(MODEL_MATRIX[0].xyz), 0.0, 0.0, 0.0),
				vec4(0.0, length(MODEL_MATRIX[1].xyz), 0.0, 0.0), vec4(0.0, 0.0, length(MODEL_MATRIX[2].xyz), 0.0), vec4(0.0, 0.0, 0.0, 1.0));
		MODELVIEW_NORMAL_MATRIX = mat3(MODELVIEW_MATRIX);
	}
}

float fade(float a, float b) {
	return smoothstep(0.0, a, t) * (1.0 - smoothstep(b, 1.0, t));
}

float line(float d, float w) {
	return 1.0 - smoothstep(w * 0.4, w, abs(d));
}

void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float c = cos(spin);
	float s = sin(spin);
	p = mat2(vec2(c, s), vec2(-s, c)) * p;
	float r = length(p);
	float ang = atan(p.y, p.x);
	float a = 0.0;
	if (shape == 0) {
		a = pow(max(0.0, 1.0 - r), 2.2) * fade(0.08, 0.35);
	} else if (shape == 1) {
		float rad = mix(0.12, 0.94, sqrt(t));
		a = line(r - rad, 0.09) * (1.0 - t);
		a += pow(max(0.0, 1.0 - abs(r - rad * 0.8) / rad), 4.0) * 0.12 * (1.0 - t);
		a *= step(r, 1.0);
	} else if (shape == 2) {
		float aa = ang + TIME * 0.5;
		a = line(r - 0.92, 0.035) + line(r - 0.68, 0.03) * 0.9;
		// Marks between the two circles, a different one in each segment.
		float k = aa * 16.0 / 6.2832;
		float cell = floor(k);
		float u = fract(k);
		float h = fract(sin(cell * 91.37) * 437.58);
		float band = step(0.72, r) * step(r, 0.88);
		float y = (r - 0.72) / 0.16;
		float mark = line(u - (0.3 + 0.4 * h), 0.08) + line(y - h, 0.12) * step(0.2, u) * step(u, 0.8);
		a += min(mark, 1.0) * band * 0.8;
		// A six-pointed star turning the other way.
		for (int i = 0; i < 6; i++) {
			float th = -TIME * 0.3 + float(i) * 1.0472;
			float d = dot(p, vec2(cos(th), sin(th)));
			a += line(d - 0.34, 0.025) * step(r, 0.68) * 0.7;
		}
		a += pow(max(0.0, 1.0 - r), 1.5) * 0.25;
		a *= step(r, 1.0) * fade(0.12, 0.7);
	} else if (shape == 3) {
		float sweep = mix(-1.4, 1.4, smoothstep(0.0, 0.4, t));
		float along = clamp((ang + 1.4) / 2.8, 0.0, 1.0);
		float inside = step(-1.4, ang) * step(ang, sweep);
		float w = 0.16 * sin(along * 3.1416) + 0.01;
		a = (1.0 - smoothstep(w * 0.25, w, abs(r - 0.76))) * inside * (0.35 + 0.65 * along);
		a *= 1.0 - smoothstep(0.45, 1.0, t);
	} else if (shape == 4) {
		float f = abs(dot(NORMAL, VIEW));
		a = pow(f, 2.5) * smoothstep(0.0, 0.25, UV.y) * smoothstep(1.0, 0.75, UV.y);
		a *= (0.85 + 0.15 * sin(TIME * 40.0 + UV.y * 24.0)) * fade(0.1, 0.5);
	} else {
		float f = 1.0 - abs(dot(NORMAL, VIEW));
		a = (pow(f, 3.0) * 0.8 + 0.02) * fade(0.15, 0.7);
	}
	ALBEDO = color * energy;
	if (particle) {
		ALBEDO *= COLOR.rgb;
		a *= COLOR.a;
	}
	ALPHA = clamp(a, 0.0, 1.0);
}
