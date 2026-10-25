"""Turn a Quaternius modular outfit (glTF on the UE-style skeleton) into a rigged GLB
that fit.py reads like a Meshy outfit: Mixamo bone names, the bare body dropped,
fingers folded into the hand, a head-top bone added, decimated for phones.

usage: python3 kit.py OUTFIT.gltf OUT.glb [--tris=9000] [--base=ALT_BASECOLOR.png] [--skip=MeshName,...]
"""
import io, json, os, struct, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glb import GLB

UE = {"pelvis": "Hips", "spine_01": "Spine", "spine_02": "Spine1", "spine_03": "Spine2", "neck_01": "Neck", "Head": "Head"}
for s, S in (("l", "Left"), ("r", "Right")):
    UE.update({f"clavicle_{s}": S + "Shoulder", f"upperarm_{s}": S + "Arm", f"lowerarm_{s}": S + "ForeArm",
               f"hand_{s}": S + "Hand", f"thigh_{s}": S + "UpLeg", f"calf_{s}": S + "Leg", f"foot_{s}": S + "Foot",
               f"ball_{s}": S + "ToeBase", f"ball_leaf_{s}": S + "Toe_End"})
FINGERS = ("index", "middle", "pinky", "ring", "thumb")


class GLTF(GLB):
    def __init__(self, path):
        self.j = json.load(open(path))
        self.dir = os.path.dirname(path)
        self.bin = open(os.path.join(self.dir, self.j["buffers"][0]["uri"]), "rb").read()

    def image_file(self, tex):
        return os.path.join(self.dir, self.j["images"][self.j["textures"][tex]["source"]]["uri"])


def decimate(pos, nor, uv, J, W, idx, target):
    """Fewer triangles. meshoptimizer only collapses edges onto vertices that are
    already there and keeps UV seams whole, so every corner keeps its own UV and weights."""
    import meshoptimizer as mo
    out = np.zeros(len(idx), np.uint32)
    n = mo.simplify(out, idx.astype(np.uint32), pos.astype(np.float32), target_index_count=int(target) * 3, target_error=0.02)
    f = out[:n]
    used, f = np.unique(f, return_inverse=True)
    return pos[used], nor[used], uv[used], J[used], W[used], f.reshape(-1)


def hidden(parts, bones, reach=0.06):
    """Triangles wholly covered by another layer of the outfit. Once fitted, layers
    stretch apart a little and the inner one shows through in patches, so they go.
    Outward is away from the nearest bone; a triangle is covered when rays from
    its middle and towards each corner all hit the outfit within `reach`."""
    import trimesh
    pos = np.concatenate([p["rest"] for p in parts])
    off = np.cumsum([0] + [len(p["rest"]) for p in parts])
    tri = np.concatenate([p["idx"].reshape(-1, 3) + o for p, o in zip(parts, off)])
    mesh = trimesh.Trimesh(pos, tri, process=False)
    c = pos[tri]
    a, b = bones[:, 0], bones[:, 1]
    out = []
    for w in (None, 0, 1, 2):
        q = c.mean(1) if w is None else c.mean(1) * 0.35 + c[:, w] * 0.65
        ab = b - a
        t = np.clip(np.einsum("nbk,bk->nb", q[:, None] - a[None], ab) / np.einsum("bk,bk->b", ab, ab), 0, 1)
        near = a[None] + t[..., None] * ab[None]
        d = np.linalg.norm(q[:, None] - near, axis=2)
        k = d.argmin(1)
        dirn = q - near[np.arange(len(q)), k]
        dirn /= np.linalg.norm(dirn, axis=1, keepdims=True) + 1e-9
        hit = np.zeros(len(q), bool)
        ids, rays, loc = mesh.ray.intersects_id(q + dirn * 0.003, dirn, multiple_hits=True, return_locations=True)
        dist = np.linalg.norm(loc - q[rays], axis=1)
        ok = (ids != np.arange(len(q))[rays]) & (dist < reach)
        hit[rays[ok]] = True
        out.append(hit)
    gone = np.logical_and.reduce(out)
    res = []
    start = 0
    for p in parts:
        n = len(p["idx"]) // 3
        res.append(gone[start:start + n]); start += n
    return res


def main(src, out, tris=9000, base_override=None, skip=(), cull=True):
    g = GLTF(src)
    nodes = json.loads(json.dumps(g.j["nodes"]))
    skin = g.j["skins"][0]
    joints = list(skin["joints"])
    jname = [nodes[n]["name"] for n in joints]
    ibm = g.acc(skin["inverseBindMatrices"]).reshape(-1, 4, 4)
    # Which joint each original joint's weight goes to.
    to = {}
    for i, n in enumerate(jname):
        if n in UE: to[i] = i
    hand = {s: jname.index(f"hand_{s}") for s in "lr"}
    for i, n in enumerate(jname):
        if n.startswith(FINGERS): to[i] = hand[n[-1]]
        elif i not in to: to[i] = jname.index("pelvis")
    for n in joints:
        nm = nodes[n]["name"]
        nodes[n]["name"] = UE.get(nm, nm)
    # A head-top bone straight above the head, as Mixamo rigs have.
    head = joints[jname.index("Head")]
    Wh = g.world(head)
    top_world = Wh[:3, 3] + np.array([0, 0.22, 0])
    local = np.linalg.inv(Wh) @ np.r_[top_world, 1]
    nodes.append({"name": "HeadTop_End", "translation": local[:3].tolist()})
    nodes[head].setdefault("children", []).append(len(nodes) - 1)
    joints.append(len(nodes) - 1)
    M = np.eye(4); M[:3, 3] = top_world
    ibm = np.concatenate([ibm, np.linalg.inv(M).T[None]], 0)  # stored column-major

    skin_mat = {i for i, m in enumerate(g.j["materials"]) if "Regular" in m["name"]}
    P = {k: [] for k in ("pos", "nor", "uv", "J", "W", "idx")}
    n0 = 0
    parts = []
    for mi, m in enumerate(g.j["meshes"]):
        if m["name"] in skip: continue
        for pi, pr in enumerate(m["primitives"]):
            if pr.get("material") in skin_mat: continue
            p = g.prim(mi, pi)
            Jo = p["JOINTS_0"].astype(int); Wt = p["WEIGHTS_0"].astype(float)
            Jn = np.vectorize(to.get)(Jo)
            # Fold duplicate joints (fingers into the hand) into one slot.
            J2 = np.zeros_like(Jn); W2 = np.zeros_like(Wt)
            for v in range(len(Jn)):
                acc = {}
                for k in range(4): acc[Jn[v, k]] = acc.get(Jn[v, k], 0) + Wt[v, k]
                for k, (jj, ww) in enumerate(sorted(acc.items(), key=lambda x: -x[1])):
                    J2[v, k] = jj; W2[v, k] = ww
            W2 /= W2.sum(1, keepdims=True)
            parts.append((m["name"], p["POSITION"], p["NORMAL"], p["TEXCOORD_0"], J2, W2, p["indices"].astype(int), pr["material"]))
    # Rest pose in world space, for finding the layers hidden under others.
    Mj = np.array([g.world(n) for n in skin["joints"]]) @ g.acc(skin["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
    info = []
    for name, pos, nor, uv, J, W, idx, mat in parts:
        v = np.c_[pos, np.ones(len(pos))]
        rest = sum(W[:, k:k + 1] * np.einsum("nij,nj->ni", Mj[J[:, k]], v)[:, :3] for k in range(4))
        info.append({"rest": rest, "idx": idx})
    jw = {nodes[n]["name"]: g.world(n)[:3, 3] for n in skin["joints"]}
    par = {c: nodes[i]["name"] for i in skin["joints"] for c in [nodes[c]["name"] for c in nodes[i].get("children", [])]}
    bones = np.array([(jw[par[n]], jw[n]) for n in UE.values() if n in par and par[n] in UE.values()])
    if cull:
        gone = hidden(info, bones)
        kept = []
        for (name, pos, nor, uv, J, W, idx, mat), g_ in zip(parts, gone):
            idx = idx.reshape(-1, 3)[~g_].reshape(-1)
            print(f"{name:28s} hidden {int(g_.sum())}")
            used, idx = np.unique(idx, return_inverse=True)
            kept.append((name, pos[used], nor[used], uv[used], J[used], W[used], idx.reshape(-1), mat))
        parts = kept
    total = sum(len(x[6]) // 3 for x in parts)
    ratio = min(1.0, tris / total)
    for name, pos, nor, uv, J, W, idx, mat in parts:
        n = len(idx) // 3
        if ratio < 1 and n > 300:
            pos, nor, uv, J, W, idx = decimate(pos, nor, uv, J, W, idx, max(150, n * ratio))
        print(f"{name:28s} {n:6d} -> {len(idx) // 3:6d}")
        for k, a in zip(("pos", "nor", "uv", "J", "W"), (pos, nor, uv, J, W)): P[k].append(a)
        P["idx"].append(idx + n0); n0 += len(pos)
    P = {k: np.concatenate(v) for k, v in P.items()}
    mat = g.j["materials"][parts[0][7]]

    bin_ = bytearray(); views = []; accs = []
    def add(arr, comp=5126, typ="VEC3", target=None, minmax=False):
        arr = np.ascontiguousarray(arr)
        while len(bin_) % 4: bin_.append(0)
        views.append({"buffer": 0, "byteOffset": len(bin_), "byteLength": arr.nbytes, **({"target": target} if target else {})})
        bin_.extend(arr.tobytes())
        a = {"bufferView": len(views) - 1, "componentType": comp, "count": len(arr), "type": typ}
        if minmax: a["min"] = arr.min(0).tolist(); a["max"] = arr.max(0).tolist()
        accs.append(a); return len(accs) - 1
    def img(path, size=1024):
        im = Image.open(path).convert("RGB")
        if max(im.size) > size: im = im.resize((size, size), Image.LANCZOS)
        b = io.BytesIO(); im.save(b, "JPEG", quality=90)
        while len(bin_) % 4: bin_.append(0)
        views.append({"buffer": 0, "byteOffset": len(bin_), "byteLength": len(b.getvalue())})
        bin_.extend(b.getvalue())
        return {"mimeType": "image/jpeg", "bufferView": len(views) - 1}
    images = [img(base_override or g.image_file(mat["pbrMetallicRoughness"]["baseColorTexture"]["index"]))]
    if "normalTexture" in mat: images.append(img(g.image_file(mat["normalTexture"]["index"])))
    prim = {"attributes": {"POSITION": add(P["pos"].astype(np.float32), target=34962, minmax=True),
                           "NORMAL": add(P["nor"].astype(np.float32), target=34962),
                           "TEXCOORD_0": add(P["uv"].astype(np.float32), typ="VEC2", target=34962),
                           "JOINTS_0": add(P["J"].astype(np.uint16), 5123, "VEC4", 34962),
                           "WEIGHTS_0": add(P["W"].astype(np.float32), typ="VEC4", target=34962)},
            "indices": add(P["idx"].astype(np.uint32), 5125, "SCALAR", 34963), "material": 0}
    for n in nodes: n.pop("mesh", None); n.pop("skin", None)
    nodes.append({"name": "outfit", "mesh": 0, "skin": 0})
    scene = list(g.j["scenes"][0]["nodes"]) + [len(nodes) - 1]
    m2 = {"name": "outfit", "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}}}
    if len(images) > 1: m2["normalTexture"] = {"index": 1}
    j = {"asset": {"version": "2.0"}, "scene": 0, "scenes": [{"nodes": scene}], "nodes": nodes,
         "skins": [{"joints": joints, "inverseBindMatrices": add(ibm.astype(np.float32).reshape(-1, 16), typ="MAT4")}],
         "meshes": [{"name": "outfit", "primitives": [prim]}], "materials": [m2],
         "textures": [{"source": i} for i in range(len(images))], "images": images,
         "accessors": accs, "bufferViews": views, "buffers": [{"byteLength": len(bin_)}]}
    js = json.dumps(j, separators=(",", ":")).encode()
    while len(js) % 4: js += b" "
    while len(bin_) % 4: bin_.append(0)
    with open(out, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 28 + len(js) + len(bin_)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack("<II", len(bin_), 0x004E4942)); f.write(bin_)
    print("total", len(P["idx"]) // 3, "tris")


if __name__ == "__main__":
    a = sys.argv
    opt = lambda k, d=None: next((x.split("=", 1)[1] for x in a if x.startswith(f"--{k}=")), d)
    main(a[1], a[2], int(opt("tris", 9000)), opt("base"), tuple(filter(None, (opt("skip") or "").split(","))))
