// wind.gdshader for plants drawn on see-through cards (leaves, grass,
// petals): what the texture leaves clear is cut away.
shader_type spatial;
render_mode cull_disabled, specular_disabled;

#define CUT
#include "res://shaders/wind.gdshaderinc"
