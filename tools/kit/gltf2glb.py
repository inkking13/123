"""Pack a Quaternius glTF (.gltf + .bin + .png) into one light .glb for the phone.

Each picture is shrunk to at most --max px and stored as JPEG (PNG when it
has see-through parts, like leaves). Normal and roughness maps are dropped:
on the map they cost memory and the Redmi cannot tell. Window glass, which is
see-through in the kit, becomes a dim warm pane so it needs no blending.

    python3 -I gltf2glb.py SRC.gltf OUT.glb [--max 512]
"""
import argparse
import io
import json
import os
import struct

from PIL import Image


def pack(src: str, out: str, max_px: int) -> None:
    base = os.path.dirname(src)
    d = json.load(open(src))
    blob = bytearray()
    for b in d["buffers"]:
        blob += open(os.path.join(base, b["uri"]), "rb").read()
    used = set()
    for m in d.get("materials", []):
        m.pop("normalTexture", None)
        m.pop("occlusionTexture", None)
        pbr = m.setdefault("pbrMetallicRoughness", {})
        pbr.pop("metallicRoughnessTexture", None)
        pbr["metallicFactor"] = 0
        pbr.setdefault("roughnessFactor", 0.9)
        if m.get("alphaMode") == "BLEND":
            m["alphaMode"] = "OPAQUE"
            pbr["baseColorFactor"] = [0.16, 0.12, 0.08, 1.0]
            m["emissiveFactor"] = [0.35, 0.22, 0.08]
        if "baseColorTexture" in pbr:
            used.add(pbr["baseColorTexture"]["index"])
    # Keep only the colour textures, renumbered.
    tex_map = {}
    textures = []
    for i, t in enumerate(d.get("textures", [])):
        if i in used:
            tex_map[i] = len(textures)
            textures.append(t)
    img_map = {}
    images = []
    for t in textures:
        s = t["source"]
        if s not in img_map:
            img_map[s] = len(images)
            images.append(d["images"][s])
        t["source"] = img_map[s]
    for m in d.get("materials", []):
        pbr = m["pbrMetallicRoughness"]
        if "baseColorTexture" in pbr:
            pbr["baseColorTexture"]["index"] = tex_map[pbr["baseColorTexture"]["index"]]
    views = d.get("bufferViews", [])
    for im in images:
        pic = Image.open(os.path.join(base, im.pop("uri")))
        if max(pic.size) > max_px:
            k = max_px / max(pic.size)
            pic = pic.resize((max(1, round(pic.width * k)), max(1, round(pic.height * k))), Image.LANCZOS)
        buf = io.BytesIO()
        clear = pic.mode in ("RGBA", "LA") and pic.getextrema()[-1][0] < 250
        if clear:
            pic.save(buf, "PNG", optimize=True)
            im["mimeType"] = "image/png"
        else:
            pic.convert("RGB").save(buf, "JPEG", quality=88)
            im["mimeType"] = "image/jpeg"
        while len(blob) % 4:
            blob.append(0)
        views.append({"buffer": 0, "byteOffset": len(blob), "byteLength": buf.tell()})
        blob += buf.getvalue()
        im["bufferView"] = len(views) - 1
    d["bufferViews"] = views
    d["textures"] = textures
    d["images"] = images
    if not textures:
        d.pop("textures"); d.pop("images", None); d.pop("samplers", None)
    while len(blob) % 4:
        blob.append(0)
    d["buffers"] = [{"byteLength": len(blob)}]
    js = json.dumps(d, separators=(",", ":")).encode()
    while len(js) % 4:
        js += b" "
    total = 12 + 8 + len(js) + 8 + len(blob)
    with open(out, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(blob), 0x004E4942) + bytes(blob))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--max", type=int, default=512)
    a = ap.parse_args()
    pack(a.src, a.out, a.max)
