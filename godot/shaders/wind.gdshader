// Plants on the open map and at camp, stirred by the wind: the higher a
// vertex stands above the plant's foot, the further it sways. Each plant
// sways on its own beat, from where it stands. Stands in for the
// StandardMaterial3D the plant came with (texture, tint or vertex colours).
shader_type spatial;
render_mode cull_disabled, specular_disabled;

uniform sampler2D albedo_tex: source_color, filter_linear_mipmap, repeat_enable;
uniform bool use_tex = true;
uniform bool use_vertex_color = false;
uniform vec4 tint: source_color = vec4(1.0);
uniform float roughness = 0.9;
// How far the top sways, as a share of the height where the sway is full.
uniform float sway = 0.03;
uniform float height = 4.0;
uniform float gust = 1.0;   // the weather's wind, 1 calm to 2.5 a storm

void vertex() {
	vec3 root = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	float h = clamp(VERTEX.y / height, 0.0, 1.5);
	h *= h;
	float t = TIME * (0.8 + 0.4 * gust);
	float wave = sin(t * 1.3 + root.x * 0.13 + root.z * 0.09) * 0.7 + sin(t * 2.9 + root.x * 0.41 - root.z * 0.2) * 0.3;
	float amount = sway * height * h * gust;
	// The wind blows mostly one way, so plants lean with it and spring back.
	VERTEX.x += (wave + 0.35 * (gust - 1.0)) * amount;
	VERTEX.z += sin(t * 1.1 + root.z * 0.17) * amount * 0.45;
}

void fragment() {
	vec4 c = tint;
	if (use_tex) c *= texture(albedo_tex, UV);
	if (use_vertex_color) c *= COLOR;
	ALBEDO = c.rgb;
	ROUGHNESS = roughness;
}
