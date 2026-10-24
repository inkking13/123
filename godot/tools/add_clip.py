"""Copies an animation from a Meshy export onto one of our body .glb files.

    python3 add_clip.py body.glb meshy-export.glb ClipName [more-bodies.glb ...]

Channels are matched to the body's nodes by name, so one clip made on the
human rig goes onto every body with the same Mixamo-named skeleton. A clip
already on the body under that name is replaced.
"""
import json
import struct
import sys


def read(path):
    b = open(path, "rb").read()
    out = {}
    at = 12
    while at < len(b):
        n, kind = struct.unpack("<II", b[at:at + 8])
        out[kind] = b[at + 8:at + 8 + n]
        at += 8 + n
    return json.loads(out[0x4E4F534A]), bytearray(out.get(0x004E4942, b""))


def write(path, gltf, bin_):
    while len(bin_) % 4: bin_.append(0)
    gltf["buffers"][0]["byteLength"] = len(bin_)
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(bin_), 0x004E4942) + bytes(bin_))


def accessor_bytes(gltf, bin_, i):
    a = gltf["accessors"][i]
    v = gltf["bufferViews"][a["bufferView"]]
    comps = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[a["type"]]
    size = {5126: 4, 5123: 2, 5121: 1, 5125: 4}[a["componentType"]] * comps
    stride = v.get("byteStride", size)
    start = v.get("byteOffset", 0) + a.get("byteOffset", 0)
    return b"".join(bytes(bin_[start + k * stride:start + k * stride + size]) for k in range(a["count"]))


def key(name):
    return name.replace("mixamorig:", "").replace("mixamorig_", "").lower()


def add(body_path, src_path, clip, pick=None):
    src, sbin = read(src_path)
    dst, dbin = read(body_path)
    anims = src.get("animations", [])
    anim = next((a for a in anims if a.get("name") == pick), None) if pick else None
    if anim is None:
        # Meshy exports carry the clip plus sometimes a T-pose; take the longest.
        anim = max(anims, key=lambda a: len(a["channels"]))
    nodes = {key(n.get("name", "")): i for i, n in enumerate(dst["nodes"])}
    new = {"name": clip, "channels": [], "samplers": []}
    copied = {}

    def copy(i):
        if i in copied: return copied[i]
        data = accessor_bytes(src, sbin, i)
        while len(dbin) % 4: dbin.append(0)
        dst["bufferViews"].append({"buffer": 0, "byteOffset": len(dbin), "byteLength": len(data)})
        dbin.extend(data)
        a = dict(src["accessors"][i])
        a["bufferView"] = len(dst["bufferViews"]) - 1
        a.pop("byteOffset", None)
        dst["accessors"].append(a)
        copied[i] = len(dst["accessors"]) - 1
        return copied[i]

    missing = set()
    for ch in anim["channels"]:
        name = src["nodes"][ch["target"]["node"]].get("name", "")
        if key(name) not in nodes:
            missing.add(name)
            continue
        s = anim["samplers"][ch["sampler"]]
        new["samplers"].append({"input": copy(s["input"]), "output": copy(s["output"]),
            "interpolation": s.get("interpolation", "LINEAR")})
        new["channels"].append({"sampler": len(new["samplers"]) - 1,
            "target": {"node": nodes[key(name)], "path": ch["target"]["path"]}})
    dst["animations"] = [a for a in dst.get("animations", []) if a.get("name") != clip] + [new]
    write(body_path, dst, dbin)
    print("%s: +%s (%d channels%s)" % (body_path, clip, len(new["channels"]),
        ", skipped " + ", ".join(sorted(missing)) if missing else ""))


if __name__ == "__main__":
    src, clip = sys.argv[2], sys.argv[3]
    for body in [sys.argv[1]] + sys.argv[4:]:
        add(body, src, clip)
