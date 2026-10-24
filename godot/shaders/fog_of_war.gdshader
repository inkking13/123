// The fog over the parts of the land the squad has not seen yet: a soft,
// slowly drifting haze, torn at its edge, clearing cell by cell.
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, shadows_disabled;

uniform sampler2D seen: filter_linear;      // a texel a cell, 1 where seen
uniform sampler2D noise: filter_linear, repeat_enable;
uniform vec3 haze = vec3(0.56, 0.55, 0.51);
uniform float night = 0.0;

void fragment() {
	vec2 p = UV;
	float n = texture(noise, p * 3.0 + vec2(TIME * 0.004, TIME * 0.002)).r;
	float n2 = texture(noise, p * 9.0 - vec2(TIME * 0.006, 0.0)).r;
	float s = texture(seen, p).r;
	float fog = 1.0 - smoothstep(0.25, 0.75, s + (n - 0.5) * 0.55 + (n2 - 0.5) * 0.2);
	// Thins out toward the land's edge, where the hills close it in.
	float edge = min(min(p.x, 1.0 - p.x), min(p.y, 1.0 - p.y));
	fog *= smoothstep(0.0, 0.05, edge);
	vec3 c = haze * mix(0.85, 1.08, n) * mix(1.0, 0.22, night);
	ALBEDO = c;
	ALPHA = fog * 0.96;
}
