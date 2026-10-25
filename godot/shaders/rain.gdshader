// Rain round the camera's focus: a fixed field of streaks, each falling
// through the box on its own beat and starting again at the top. All the
// motion is in here, so no transforms are rewritten each frame.
shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled, depth_draw_never;

uniform float height = 16.0;   // the box's height, metres
uniform float speed = 19.0;    // metres a second
uniform vec2 slant = vec2(0.12, 0.05);  // sideways drift per metre fallen
uniform float amount = 1.0;    // 0 dry .. 1 full rain
uniform vec4 color: source_color = vec4(0.75, 0.8, 0.88, 0.35);

varying float fade;

void vertex() {
	// INSTANCE_CUSTOM.x: where in its fall the streak starts; .y: its share of the rain.
	float fall = fract(TIME * speed / height + INSTANCE_CUSTOM.x) * height;
	VERTEX.y -= fall;
	VERTEX.xz += slant * fall;
	fade = step(INSTANCE_CUSTOM.y, amount);
}

void fragment() {
	ALBEDO = color.rgb;
	ALPHA = color.a * fade;
}
