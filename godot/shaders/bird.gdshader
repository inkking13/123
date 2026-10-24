// Birds on the open map: a dark V whose wings beat, each bird on its own beat
// and now and then held out in a glide.
shader_type spatial;
render_mode cull_disabled, unshaded;

uniform vec4 tint : source_color = vec4(0.1, 0.1, 0.1, 1.0);

void vertex() {
	float id = float(INSTANCE_ID) * 1.7;
	float t = TIME * 9.0 + id * 2.3;
	// Glides for a while every few seconds.
	float glide = smoothstep(0.55, 0.8, sin(TIME * 0.7 + id));
	VERTEX.y += sin(t) * abs(VERTEX.x) * 0.9 * (1.0 - glide);
}

void fragment() {
	ALBEDO = tint.rgb;
}
