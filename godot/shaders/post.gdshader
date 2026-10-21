shader_type canvas_item;
// The grade over the whole frame: earthy, slightly faded colours, warm
// shadows, a vignette and a little film grain, in one cheap pass.

uniform sampler2D screen_tex : hint_screen_texture, filter_linear;
uniform float saturation = 0.9;
uniform float contrast = 1.06;
uniform vec3 shadow_tint = vec3(0.05, 0.035, 0.02);
uniform vec3 highlight_tint = vec3(1.0, 0.98, 0.93);
uniform float vignette = 0.5;
uniform float grain = 0.03;

void fragment() {
	vec3 c = texture(screen_tex, SCREEN_UV).rgb;
	float l = dot(c, vec3(0.299, 0.587, 0.114));
	c = mix(vec3(l), c, saturation);
	c = (c - 0.5) * contrast + 0.5;
	// Warm, lifted shadows and a parchment cast in the light.
	c = c * highlight_tint + shadow_tint * (1.0 - smoothstep(0.0, 0.6, l));
	vec2 d = SCREEN_UV - 0.5;
	d.y *= 0.8;
	c *= mix(1.0 - vignette, 1.0, smoothstep(0.75, 0.2, length(d)));
	float n = fract(sin(dot(FRAGCOORD.xy + vec2(TIME * 61.0, TIME * 37.0), vec2(12.9898, 78.233))) * 43758.5453);
	c += (n - 0.5) * grain;
	COLOR = vec4(clamp(c, 0.0, 1.0), 1.0);
}
