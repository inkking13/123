// The river: its painted water drifting downstream, darker in the middle,
// fading into the bank at the edges, ringed with drops in the rain.
shader_type spatial;
render_mode diffuse_lambert, cull_disabled;

uniform sampler2D water_tex: source_color, filter_linear_mipmap, repeat_enable;
uniform bool use_tex = false;
uniform vec3 deep = vec3(0.24, 0.36, 0.4);
uniform vec3 shallow = vec3(0.38, 0.44, 0.4);
uniform float flow = 0.35;   // metres a second downstream
uniform float rain = 0.0;    // 0..1

void fragment() {
	// UV.x runs across, 0 to 1; UV.y counts metres downstream.
	float across = abs(UV.x - 0.5) * 2.0;
	vec2 a = vec2(UV.x * 1.6, UV.y * 0.3 - TIME * flow * 0.3);
	vec2 b = vec2(UV.x * 2.3 + 0.37, UV.y * 0.21 - TIME * flow * 0.22);
	vec3 c = mix(deep, shallow, smoothstep(0.3, 0.75, across));
	if (use_tex) c = mix(c, c * mix(texture(water_tex, a).rgb, texture(water_tex, b).rgb, 0.5) * 2.2, 0.7);
	// Sunlit glints drifting on the surface.
	float glint = smoothstep(0.78, 0.95, sin(UV.y * 2.1 - TIME * flow * 4.0 + sin(UV.x * 17.0) * 1.5) * sin(UV.x * 9.0 + UV.y * 0.7));
	c += vec3(0.08, 0.09, 0.09) * glint;
	// Rain: small rings blinking on a grid of cells.
	vec2 cell = floor(vec2(UV.x * 6.0, UV.y * 1.2));
	vec2 f = fract(vec2(UV.x * 6.0, UV.y * 1.2)) - 0.5;
	float ph = fract(TIME * 1.3 + fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453));
	float ring = smoothstep(0.05, 0.0, abs(length(f) - ph * 0.45)) * (1.0 - ph) * rain;
	ALBEDO = c + vec3(ring * 0.25);
	ROUGHNESS = mix(0.18, 0.35, rain);
	SPECULAR = 0.6;
	// Gone before it meets the bank, so the edge never shows the ground's grid.
	ALPHA = 1.0 - smoothstep(0.42, 0.76, across);
}
