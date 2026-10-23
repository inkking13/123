// The open map's colour grade: less saturation, a little more contrast and
// a warm tint, drawn over the 3D view and under the interface.
shader_type canvas_item;

uniform sampler2D screen: hint_screen_texture, filter_linear;
uniform float saturation = 1.0;
uniform float contrast = 1.0;
uniform float brightness = 1.0;
uniform vec3 tint = vec3(1.0);

void fragment() {
	vec3 c = texture(screen, SCREEN_UV).rgb;
	float l = dot(c, vec3(0.299, 0.587, 0.114));
	c = mix(vec3(l), c, saturation);
	c = (c - 0.5) * contrast + 0.5;
	COLOR = vec4(clamp(c * brightness * tint, 0.0, 1.0), 1.0);
}
