"""Villager parts from the owner's Quaternius packs (CC0): a bare head on the
UE skeleton, the outfits and the hairstyles, each a small skinned GLB that the
game hangs on one skeleton by bone name.

usage: python3 tools/villagers/build.py RAW_ROOT OUT_DIR
  RAW_ROOT  the checkout of models/raw from the `outfits-raw` and `characters-raw` branches
            (it holds outfits/gltf/Outfits, outfits/textures and characters/...)
  OUT_DIR   godot/assets/models/villagers
"""
import io, json, os, struct, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "wardrobe"))
from kit import GLTF, decimate, hidden

HEAD = ("Head", "neck_01")


def prims(g, keep_mat=None, skip_mesh=()):
    """Skinned primitives in mesh space with their material names."""
    out = []
    for mi, m in enumerate(g.j["meshes"]):
        if m["name"] in skip_mesh: continue
        for pi, pr in enumerate(m["primitives"]):
            mat = g.j["materials"][pr["material"]]["name"]
            if keep_mat and not keep_mat(mat): continue
            p = g.prim(mi, pi)
            out.append({"mesh": m["name"], "mat": mat, "matidx": pr["material"], "pos": p["POSITION"], "nor": p["NORMAL"],
                        "uv": p["TEXCOORD_0"], "J": p["JOINTS_0"].astype(int), "W": p["WEIGHTS_0"].astype(float),
                        "idx": p["indices"].astype(int)})
    return out


def keep_tris(p, mask):
    """Only the triangles whose corners all pass `mask` (per vertex)."""
    t = p["idx"].reshape(-1, 3)
    t = t[mask[t].all(1)]
    used, idx = np.unique(t, return_inverse=True)
    for k in ("pos", "nor", "uv", "J", "W"): p[k] = p[k][used]
    p["idx"] = idx.reshape(-1)
    return p


def rest(g, p):
    sk = g.j["skins"][0]
    M = np.array([g.world(n) for n in sk["joints"]]) @ g.acc(sk["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
    v = np.c_[p["pos"], np.ones(len(p["pos"]))]
    return sum(p["W"][:, k:k + 1] * np.einsum("nij,nj->ni", M[p["J"][:, k]], v)[:, :3] for k in range(4))


def cull_hidden(g, ps):
    """Drops what one layer of the outfit hides under another (see kit.hidden)."""
    nodes = g.j["nodes"]; sk = g.j["skins"][0]
    jw = {nodes[n]["name"]: g.world(n)[:3, 3] for n in sk["joints"]}
    par = {nodes[c]["name"]: nodes[i]["name"] for i in sk["joints"] for c in nodes[i].get("children", [])}
    main = ["pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "Head"] + [f"{b}_{s}" for s in "lr" for b in
            ("clavicle", "upperarm", "lowerarm", "hand", "thigh", "calf", "foot", "ball")]
    bones = np.array([(jw[par[n]], jw[n]) for n in main if n in par and par[n] in jw])
    gone = hidden([{"rest": rest(g, p), "idx": p["idx"]} for p in ps], bones)
    return [_drop(p, gm) for p, gm in zip(ps, gone)]


def _drop(p, gone_tri):
    t = p["idx"].reshape(-1, 3)[~gone_tri]
    used, idx = np.unique(t, return_inverse=True)
    for k in ("pos", "nor", "uv", "J", "W"): p[k] = p[k][used]
    p["idx"] = idx.reshape(-1)
    return p


def shrink(ps, tris):
    total = sum(len(p["idx"]) // 3 for p in ps)
    r = min(1.0, tris / max(total, 1))
    for p in ps:
        n = len(p["idx"]) // 3
        if r < 1 and n > 200:
            p["pos"], p["nor"], p["uv"], p["J"], p["W"], p["idx"] = decimate(p["pos"], p["nor"], p["uv"], p["J"], p["W"], p["idx"], max(100, n * r))
    return ps


def write(g, ps, out, textures, size=512):
    """One GLB: the source's whole node tree (the skeleton), one skinned mesh per
    material, colour textures only, as JPEG. `textures` maps material name to image path."""
    nodes = json.loads(json.dumps(g.j["nodes"]))
    for n in nodes: n.pop("mesh", None); n.pop("skin", None)
    sk = g.j["skins"][0]
    bin_ = bytearray(); views = []; accs = []

    def add(arr, comp=5126, typ="VEC3", target=None, minmax=False):
        arr = np.ascontiguousarray(arr)
        while len(bin_) % 4: bin_.append(0)
        views.append({"buffer": 0, "byteOffset": len(bin_), "byteLength": arr.nbytes, **({"target": target} if target else {})})
        bin_.extend(arr.tobytes())
        a = {"bufferView": len(views) - 1, "componentType": comp, "count": len(arr), "type": typ}
        if minmax: a["min"] = arr.min(0).tolist(); a["max"] = arr.max(0).tolist()
        accs.append(a); return len(accs) - 1

    mats, images, meshes, by_mat = [], [], [], {}
    for p in ps: by_mat.setdefault(p["mat"], []).append(p)
    scene = list(g.j["scenes"][0]["nodes"])
    for mat, group in by_mat.items():
        im = Image.open(textures[mat]).convert("RGB")
        if max(im.size) > size: im = im.resize((size, size), Image.LANCZOS)
        b = io.BytesIO(); im.save(b, "JPEG", quality=88)
        while len(bin_) % 4: bin_.append(0)
        views.append({"buffer": 0, "byteOffset": len(bin_), "byteLength": len(b.getvalue())}); bin_.extend(b.getvalue())
        images.append({"mimeType": "image/jpeg", "bufferView": len(views) - 1})
        mats.append({"name": mat, "doubleSided": True, "pbrMetallicRoughness": {"baseColorTexture": {"index": len(images) - 1},
                     "metallicFactor": 0.0, "roughnessFactor": 0.85}})
        P = {k: np.concatenate([q[k] for q in group]) for k in ("pos", "nor", "uv", "J", "W")}
        off = np.cumsum([0] + [len(q["pos"]) for q in group])
        idx = np.concatenate([q["idx"] + o for q, o in zip(group, off)])
        W = P["W"] / P["W"].sum(1, keepdims=True)
        prim = {"attributes": {"POSITION": add(P["pos"].astype(np.float32), target=34962, minmax=True),
                               "NORMAL": add(P["nor"].astype(np.float32), target=34962),
                               "TEXCOORD_0": add(P["uv"].astype(np.float32), typ="VEC2", target=34962),
                               "JOINTS_0": add(P["J"].astype(np.uint16), 5123, "VEC4", 34962),
                               "WEIGHTS_0": add(W.astype(np.float32), typ="VEC4", target=34962)},
                "indices": add(idx.astype(np.uint32), 5125, "SCALAR", 34963), "material": len(mats) - 1}
        meshes.append({"name": "part_" + mat, "primitives": [prim]})
        nodes.append({"name": "part_" + mat, "mesh": len(meshes) - 1, "skin": 0})
        scene.append(len(nodes) - 1)
    ibm = g.acc(sk["inverseBindMatrices"]).astype(np.float32)
    j = {"asset": {"version": "2.0", "generator": "raid-commander villagers"}, "scene": 0, "scenes": [{"nodes": scene}],
         "nodes": nodes, "skins": [{"joints": sk["joints"], "inverseBindMatrices": add(ibm, typ="MAT4")}],
         "meshes": meshes, "materials": mats, "textures": [{"source": i} for i in range(len(images))], "images": images,
         "accessors": accs, "bufferViews": views, "buffers": [{"byteLength": len(bin_)}]}
    js = json.dumps(j, separators=(",", ":")).encode()
    while len(js) % 4: js += b" "
    while len(bin_) % 4: bin_.append(0)
    with open(out, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 28 + len(js) + len(bin_)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack("<II", len(bin_), 0x004E4942)); f.write(bin_)
    print(f"{os.path.basename(out):32s} {sum(len(p['idx']) // 3 for p in ps):6d} tris")


def tex(g, mat_name):
    m = next(m for m in g.j["materials"] if m["name"] == mat_name)
    return g.image_file(m["pbrMetallicRoughness"]["baseColorTexture"]["index"])


def main(raw, out):
    os.makedirs(out, exist_ok=True)
    base = os.path.join(raw, "characters", "Base Characters", "Godot - UE")
    hair_dir = os.path.join(raw, "characters", "Hairstyles", "Rigged to Head Bone", "glTF (Godot -Unreal)")
    outfits = os.path.join(raw, "outfits", "gltf", "Outfits")
    alt = os.path.join(raw, "outfits", "textures")
    # Heads: the body cut to its head and neck; the outfits bring their own arms and hands.
    for sex, src in (("male", "Superhero_Male_FullBody"), ("female", "Superhero_Female_FullBody")):
        g = GLTF(os.path.join(base, src + ".gltf"))
        names = [g.j["nodes"][n]["name"] for n in g.j["skins"][0]["joints"]]
        ps = []
        for p in prims(g, keep_mat=lambda m: m != "MI_Hair_1" and m != "MI_Hair_2"):
            if p["mat"].startswith("MI_Superhero"):
                own = np.array(names)[p["J"][np.arange(len(p["J"])), p["W"].argmax(1)]]
                p = keep_tris(p, np.isin(own, HEAD))
            ps.append(p)
        ps = shrink(ps, 2600)
        write(g, ps, os.path.join(out, f"head-{sex}.glb"), {p["mat"]: tex(g, p["mat"]) for p in ps})
    # Outfits, each in its own colours and the kit's other ones.
    for sex, cut in (("male", "Male"), ("female", "Female")):
        for kind, skip, alts in (("peasant", (), ["T_Peasant_2_BaseColor.png"]),
                                 ("ranger", (f"{cut}_Ranger_Body_Belt_1.001", "Female_Ranger_Body_Belt_2"), ["T_Ranger_3_BaseColor.png"])):
            g = GLTF(os.path.join(outfits, f"{cut}_{kind.capitalize()}.gltf"))
            ps = cull_hidden(g, prims(g, skip_mesh=skip))
            ps = shrink(ps, 5000)
            for v, over in enumerate([None] + alts):
                t = {p["mat"]: tex(g, p["mat"]) for p in ps}
                if over: t = {k: (os.path.join(alt, over) if "Regular" not in k else f) for k, f in t.items()}
                write(g, ps, os.path.join(out, f"{kind}{v + 1}-{sex}.glb"), t)
    # Hair, beard and brows, already skinned to the head bone.
    for f in sorted(os.listdir(hair_dir)):
        if not f.endswith(".gltf"): continue
        g = GLTF(os.path.join(hair_dir, f))
        ps = shrink(prims(g), 1400)
        name = f[:-5].replace("Hair_", "").replace("Eyebrows_", "brows-").lower()
        write(g, ps, os.path.join(out, f"hair-{name}.glb"), {p["mat"]: tex(g, p["mat"]) for p in ps})


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
