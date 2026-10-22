shader_type canvas_item;
// A picture clipped to a rounded rectangle, optionally drained to grey (fallen heroes).

uniform vec2 size_px = vec2(100.0);
uniform float radius_px = 8.0;
uniform float gray = 0.0;

void fragment() {
	vec4 c = texture(TEXTURE, UV);
	vec2 p = UV * size_px;
	vec2 h = size_px * 0.5;
	vec2 q = abs(p - h) - (h - vec2(radius_px));
	float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius_px;
	float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
	c.rgb = mix(c.rgb, vec3(l * 0.8), gray);
	c.a *= clamp(0.5 - d, 0.0, 1.0);
	COLOR = c;
}
