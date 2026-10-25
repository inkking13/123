// Plants on the open map and at camp, stirred by the wind: the higher a
// vertex stands above the plant's foot, the further it sways. Each plant
// sways on its own beat, from where it stands. Stands in for the
// StandardMaterial3D the plant came with (texture, tint or vertex colours).
shader_type spatial;
render_mode cull_disabled, specular_disabled;

#include "res://shaders/wind.gdshaderinc"
