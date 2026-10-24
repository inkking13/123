// The open map's ground on a textured land: grass that does not show its
// tiles, dry patches, bare stony earth, forest floor under the woods and the road worn into it
// with soft, uneven edges. The vertex colour still shades patches and hills.
shader_type spatial;
render_mode diffuse_lambert, specular_disabled;

uniform sampler2D grass: source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D floor_tex: source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D road: source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D dry_tex: source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform bool has_dry = false;
// Bare, stony earth: worn patches in the meadow and the road's verges.
uniform sampler2D earth_tex: source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform bool has_earth = false;
uniform sampler2D bank_tex: source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform bool has_bank = false;
// How wet the ground is after rain: darker and a little glossy.
uniform float wet = 0.0;
// r: road, g: woods, b: river bank, painted from the layout; covers the ground square.
uniform sampler2D mask: filter_linear;
uniform sampler2D noise: filter_linear, repeat_enable;
uniform float half_size = 130.0;
uniform vec3 grass_tint = vec3(1.0);
uniform vec3 road_tint = vec3(1.0);

varying vec3 world;

void vertex() {
	world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 p = world.xz;
	float n = texture(noise, p * 0.012).r;
	float fine = texture(noise, p * 0.09).r;
	// The same grass at two scales, the larger turned, so no grid shows.
	vec3 g1 = texture(grass, p * 0.125).rgb;
	vec3 g2 = texture(grass, mat2(vec2(0.8, 0.6), vec2(-0.6, 0.8)) * p * 0.043).rgb;
	vec3 g = mix(g1, g2, 0.45) * grass_tint;
	// Dry, yellowed patches where the noise is high.
	float dry = smoothstep(0.55, 0.75, n);
	vec3 d = has_dry ? texture(dry_tex, p * 0.11).rgb * grass_tint : g * vec3(1.18, 1.02, 0.68);
	g = mix(g, d, dry);
	vec3 m = texture(mask, p / (2.0 * half_size) + 0.5).rgb;
	vec3 e = vec3(0.0);
	if (has_earth) {
		e = texture(earth_tex, p * 0.16).rgb * vec3(0.95, 0.92, 0.86);
		// Worn patches where another stretch of the noise runs low.
		float n2 = texture(noise, p * 0.021 + vec2(0.37, 0.61)).r;
		float bare = smoothstep(0.32, 0.2, n2 + (fine - 0.5) * 0.18);
		// The road's trodden verges.
		float verge = smoothstep(0.08, 0.3, m.r + (fine - 0.5) * 0.3);
		g = mix(g, e, max(bare, verge * 0.85));
	}
	// Forest floor under the trees, ragged at the edge.
	float woods = smoothstep(0.25, 0.65, m.g + (fine - 0.5) * 0.5);
	vec3 c = mix(g, texture(floor_tex, p * 0.2).rgb * 0.75, woods);
	// The road, worn in: its edge wanders with the noise.
	float r = smoothstep(0.35, 0.7, m.r + (fine - 0.5) * 0.45);
	c = mix(c, texture(road, p * 0.25).rgb * road_tint, r);
	// The river's bank: bare wet earth down to the water.
	float bank = smoothstep(0.2, 0.6, m.b + (fine - 0.5) * 0.4);
	vec3 bk = has_earth ? e * vec3(0.72, 0.7, 0.66) : has_bank ? texture(bank_tex, p * 0.2).rgb * vec3(0.6, 0.56, 0.48) : c * vec3(0.7, 0.62, 0.5);
	c = mix(c, bk, bank);
	ALBEDO = c * COLOR.rgb * mix(0.88, 1.08, n) * (1.0 - wet * 0.28);
	ROUGHNESS = 0.95 - wet * 0.4;
}
