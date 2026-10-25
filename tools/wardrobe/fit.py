"""Fit a Meshy-rigged outfit character onto a game body and write a wardrobe GLB.

usage: python3 fit.py OUTFIT_RIGGED.glb BODY.glb OUT.glb [--debug]
"""
import io, json, struct, sys
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from glb import GLB, skin_info

HEADS = ["Head", "headfront", "HeadTop_End"]
MESHY = {"Spine02": "Spine", "Spine01": "Spine1", "Spine": "Spine2", "neck": "Neck", "head_end": "HeadTop_End"}


def canon(names):
    meshy = "Spine02" in names
    out = []
    for n in names:
        n = n.replace("mixamorig:", "").replace("mixamorig", "")
        if meshy: n = MESHY.get(n, n)
        out.append(n)
    return out


# Child that gives each bone its direction.
CHILD = {"Hips": "Spine", "Spine": "Spine1", "Spine1": "Spine2", "Spine2": "Neck", "Neck": "Head", "Head": "HeadTop_End"}
for s in ("Left", "Right"):
    CHILD.update({s + "Shoulder": s + "Arm", s + "Arm": s + "ForeArm", s + "ForeArm": s + "Hand",
                  s + "UpLeg": s + "Leg", s + "Leg": s + "Foot", s + "Foot": s + "ToeBase"})
# Bones with no child borrow their parent's turn and scale.
BORROW = {"HeadTop_End": "Head", "headfront": "Head", "LeftHand": "LeftForeArm", "RightHand": "RightForeArm",
          "LeftToeBase": "LeftFoot", "RightToeBase": "RightFoot", "LeftHandMiddle4": "LeftForeArm",
          "RightHandMiddle4": "RightForeArm", "LeftToe_End": "LeftFoot", "RightToe_End": "RightFoot"}

# What piece of armour a bone's vertices belong to.
def piece_of(bone):
    """Same body parts as Unit._part_of, and the piece that covers each."""
    if "Head" in bone or "Neck" in bone or bone == "headfront": return "hood"
    if "Hand" in bone or "ForeArm" in bone: return "gloves"
    if bone.endswith("Arm"): return "shoulders"
    if "Spine" in bone or "Shoulder" in bone: return "jacket"
    if "Hips" in bone or "UpLeg" in bone: return "pants"
    return "boots"


def rot_between(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b)
    v = np.cross(a, b); c = float(np.dot(a, b))
    if c < -0.9999: return -np.eye(3)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + K + K @ K / (1 + c)


HEAD_BOX = "--head-box" in sys.argv
HEAD_SCALE = next((float(a.split("=")[1]) for a in sys.argv if a.startswith("--head-scale=")), 1.1)
HEAD_UPRIGHT = "--head-upright" in sys.argv
LAYERED = "--layered" in sys.argv
HEAD_LIFT = next((float(a.split("=")[1]) for a in sys.argv if a.startswith("--head-lift=")), 0.0)


def fit_head(o, b, R):
    """Head gear sized and centred on the body's head: a little wider and deeper
    than it, and no taller than it is wide."""
    o = o @ R.T
    lo, hi = np.percentile(o, [3, 97], axis=0); blo, bhi = np.percentile(b, [3, 97], axis=0)
    so, sb = hi - lo, bhi - blo
    sxz = float(np.clip(max(sb[0] / so[0], sb[2] / so[2]) * 1.1, 0.7, 1.5))
    sy = float(np.clip(sb[1] / so[1] * 1.1, 0.8 * sxz, sxz))
    S = np.diag([sxz, sy, sxz])
    A = S @ R
    co = (lo + hi) / 2; cb = (blo + bhi) / 2
    t = cb - S @ co
    return A, t


def rest_mesh(g):
    """All skinned primitives of the file, in rest pose world space."""
    names, ibm, _ = skin_info(g)
    sk = g.j["skins"][0]
    W = np.array([g.world(n) for n in sk["joints"]])
    M = W @ ibm  # rest = bind normally, but carries any armature scale
    out = []
    for mi, m in enumerate(g.j["meshes"]):
        for pi in range(len(m["primitives"])):
            p = g.prim(mi, pi)
            v = np.c_[p["POSITION"], np.ones(len(p["POSITION"]))]
            J = p["JOINTS_0"].astype(int); Wt = p["WEIGHTS_0"].astype(float)
            Wt /= Wt.sum(1, keepdims=True)
            pos = np.zeros((len(v), 3)); nor = np.zeros((len(v), 3))
            for k in range(4):
                Mk = M[J[:, k]]
                pos += Wt[:, k:k + 1] * np.einsum("nij,nj->ni", Mk, v)[:, :3]
                nor += Wt[:, k:k + 1] * np.einsum("nij,nj->ni", Mk[:, :3, :3], p["NORMAL"])
            nor /= np.linalg.norm(nor, axis=1, keepdims=True) + 1e-9
            out.append(dict(pos=pos, nor=nor, uv=p.get("TEXCOORD_0"), J=J, W=Wt, idx=p["indices"].astype(int), mat=p["material"]))
    joints = W[:, :3, 3]
    return canon(names), joints, out


def body_joints(g):
    names, _, bind = skin_info(g)
    return canon(names), bind[:, :3, 3], names


def radii(pos, owner, head, d, sel):
    q = pos[owner == sel] - head
    if len(q) < 20: return None
    dn = d / np.linalg.norm(d)
    perp = q - np.outer(q @ dn, dn)
    return np.median(np.linalg.norm(perp, axis=1))


def fit(outfit_path, body_path, out_path, debug=False):
    og = GLB(outfit_path)
    onames, ojoint, oprims = rest_mesh(og)
    bg = GLB(body_path)
    bnames, bjoint, braw = body_joints(bg)
    bp = bg.prim()
    bpos = bp["POSITION"].astype(float); bnor = bp["NORMAL"].astype(float)
    bown = np.array([bnames[j] for j in bp["JOINTS_0"][np.arange(len(bpos)), bp["WEIGHTS_0"].argmax(1)]])
    oi = {n: i for i, n in enumerate(onames)}; bi = {n: i for i, n in enumerate(bnames)}

    # Outfit stands on the ground like the body.
    allpos = np.concatenate([p["pos"] for p in oprims])
    floor = allpos[:, 1].min()
    for p in oprims: p["pos"][:, 1] -= floor
    ojoint = ojoint.copy(); ojoint[:, 1] -= floor
    opos_all = np.concatenate([p["pos"] for p in oprims])
    oown_all = np.concatenate([np.array(onames)[p["J"][np.arange(len(p["J"])), p["W"].argmax(1)]] for p in oprims])

    # Per-bone transforms: turn the bone onto the body's, stretch along it, scale across it.
    # The trunk (hips to chest) moves as one, from the hips to the neck.
    TRUNK = ("Hips", "Spine", "Spine1", "Spine2")
    def seg(n):
        if n in TRUNK: return "Hips", "Neck"
        return n, CHILD[n]
    def rad(pos, own, head, d, names):
        q = pos[np.isin(own, names)] - head
        if len(q) < 20: return None
        dn = d / np.linalg.norm(d)
        return np.median(np.linalg.norm(q - np.outer(q @ dn, dn), axis=1))
    T = {}
    for n in onames:
        src = n if n in CHILD else BORROW.get(n)
        if src is None or src not in oi or src not in bi: continue
        h, c = seg(src)
        if c not in oi or c not in bi: continue
        dO = ojoint[oi[c]] - ojoint[oi[h]]; dB = bjoint[bi[c]] - bjoint[bi[h]]
        R = rot_between(dO, dB)
        a = np.linalg.norm(dB) / np.linalg.norm(dO)
        group = list(TRUNK) if src in TRUNK else [src]
        rO = rad(opos_all, oown_all, ojoint[oi[h]], dO, group)
        rB = rad(bpos, bown, bjoint[bi[h]], dB, group)
        r = float(np.clip(rB / rO * 1.12, 0.7, 1.5)) if rO and rB else a
        if src == "Head" and np.isin(oown_all, HEADS).sum() > 20:
            # Head gear is sized by width: the outfit's head a little wider than the body's.
            wO = np.ptp(opos_all[np.isin(oown_all, HEADS)][:, 0]); wB = np.ptp(bpos[np.isin(bown, HEADS)][:, 0])
            a = r = float(np.clip(wB * HEAD_SCALE / wO, 0.75, 1.3))
            if HEAD_UPRIGHT: R = np.eye(3)  # the outfit's head is already upright
        if src == "Neck":
            r = float(np.clip(r, 0.8, 1.3)); a = float(np.clip(a, 0.6, 1.6))
        dn = dO / np.linalg.norm(dO)
        A = R @ (r * np.eye(3) + (a - r) * np.outer(dn, dn))
        anchor = n if n == src else src
        t = bjoint[bi[anchor]] - A @ ojoint[oi[anchor]]
        if src in TRUNK and n != "Hips":
            t = bjoint[bi["Hips"]] - A @ ojoint[oi["Hips"]]
        if src == "Head" and HEAD_BOX:
            A, t = fit_head(opos_all[np.isin(oown_all, HEADS)], bpos[np.isin(bown, HEADS)], R)
        if src == "Head": t = t + np.array([0, HEAD_LIFT, 0])
        T[n] = (A, t, R)
        if debug: print(f"{n:16s} a={a:.2f} r={r:.2f}")
    ident = (np.eye(3), np.zeros(3), np.eye(3))

    tree = cKDTree(bpos)
    pieces = {}
    for p in oprims:
        pos = np.zeros_like(p["pos"]); nor = np.zeros_like(p["nor"])
        for k in range(4):
            for jn in np.unique(p["J"][:, k]):
                sel = p["J"][:, k] == jn
                A, t, R = T.get(onames[jn], ident)
                w = p["W"][sel, k:k + 1]
                pos[sel] += w * (p["pos"][sel] @ A.T + t)
                nor[sel] += w * (p["nor"][sel] @ R.T)
        nor /= np.linalg.norm(nor, axis=1, keepdims=True) + 1e-9
        # Nothing of the outfit may sink into the body.
        for it in range(3):
            d, k = tree.query(pos)
            depth = np.einsum("ij,ij->i", pos - bpos[k], bnor[k])
            m = 0.006
            push = np.clip(m - depth, 0, 0.08)
            push[d > 0.12] = 0
            if LAYERED:  # layers lying on each other move out together, so none shows through another
                near = cKDTree(pos).query_ball_point(pos, 0.06)
                push = np.array([push[n].max() for n in near])
            pos += push[:, None] * bnor[k]
        p["fpos"] = pos; p["fnor"] = nor; p["head_y"] = ojoint[oi["Head"]][1]; p["head_z"] = ojoint[oi["Head"]][2]
        d, k = tree.query(pos)
        p["bdist"] = d
        p["bhead_z"] = bjoint[bi["Head"]][2]; p["bhead_y"] = bjoint[bi["Head"]][1]
        p["bneck"] = bjoint[bi["Neck"]]
        p["piece"] = np.array([piece_of(b) for b in bown[k]])
        p["obone"] = np.array(onames)[p["J"][np.arange(len(p["J"])), p["W"].argmax(1)]]
    return og, bg, oprims, onames, bnames, braw, bi


def colours(img, uv):
    a = np.asarray(img.convert("RGB"), dtype=float) / 255
    h, w = a.shape[:2]
    x = np.clip((uv[:, 0] % 1) * (w - 1), 0, w - 1).astype(int)
    y = np.clip((uv[:, 1] % 1) * (h - 1), 0, h - 1).astype(int)
    return a[y, x]


def skin_mask(img, p, face_ref=None):
    """True for the outfit model's own bare face: skin-coloured, in its head, facing front."""
    c = colours(img, p["uv"])
    r, g, b = c[:, 0], c[:, 1], c[:, 2]
    mx = c.max(1); sat = (mx - c.min(1)) / (mx + 1e-6)
    skin = (r - g > 0.1) & (g > b) & (sat > 0.25) & (mx > 0.3)
    head = np.isin(p["obone"], ["Head", "headfront", "Neck"])
    # Whatever hugs the body's face is the outfit model's own face.
    face = (p["bdist"] < 0.016) & (p["fpos"][:, 2] > p["bhead_z"] + 0.02) & (p["fpos"][:, 1] < p["bhead_y"] + 0.09)
    if HEAD_BOX:  # the open front of the outfit model's head, from brow to chin
        o = p["pos"]; on = p["nor"]
        face |= (on[:, 2] > 0.3) & (o[:, 2] > p["head_z"] + 0.03) & (o[:, 1] < p["head_y"] + 0.11) & (o[:, 1] > p["head_y"] - 0.07)
    return head & (skin | face)


def face_colour(img, p, head_y):
    """Median colour of the outfit model's cheeks and nose."""
    head = np.isin(p["obone"], HEADS)
    q = p["pos"][head]
    sel = (q[:, 1] > head_y + 0.02) & (q[:, 1] < head_y + 0.09)
    sel &= q[:, 2] > np.quantile(q[sel][:, 2], 0.8)
    c = colours(img, p["uv"][head][sel])
    mx = c.max(1); sat = (mx - c.min(1)) / (mx + 1e-6)
    c = c[(mx > 0.3) & (sat > 0.2) & (c[:, 0] - c[:, 1] > 0.1) & (c[:, 1] > c[:, 2])]
    return np.median(c, axis=0)


def tex_of(g, mat):
    m = g.j["materials"][mat]
    pbr = m.get("pbrMetallicRoughness", {})
    out = {}
    for key, slot in (("base", pbr.get("baseColorTexture")), ("normal", m.get("normalTexture"))):
        if slot:
            src = g.j["textures"][slot["index"]]["source"]
            data, _ = g.image(src)
            out[key] = Image.open(io.BytesIO(data))
    return out


def write(out_path, bg, braw, bi, pieces, textures):
    j = bg.j
    nodes = json.loads(json.dumps(j["nodes"]))
    skin = json.loads(json.dumps(j["skins"][0]))
    for n in nodes: n.pop("mesh", None); n.pop("skin", None)
    bin_ = bytearray(); views = []; accs = []

    def add(arr, target=None, comp=5126, typ="VEC3", minmax=False):
        arr = np.ascontiguousarray(arr)
        while len(bin_) % 4: bin_.append(0)
        off = len(bin_); bin_.extend(arr.tobytes())
        v = {"buffer": 0, "byteOffset": off, "byteLength": arr.nbytes}
        if target: v["target"] = target
        views.append(v)
        a = {"bufferView": len(views) - 1, "componentType": comp, "count": len(arr), "type": typ}
        if minmax: a["min"] = arr.min(0).tolist(); a["max"] = arr.max(0).tolist()
        accs.append(a)
        return len(accs) - 1

    ibm_src = bg.acc(j["skins"][0]["inverseBindMatrices"])
    skin["inverseBindMatrices"] = add(ibm_src.astype(np.float32), typ="MAT4")
    images = []
    for key in ("base", "normal"):
        if key in textures:
            im = textures[key].convert("RGB")
            if max(im.size) > 1024: im = im.resize((1024, 1024), Image.LANCZOS)
            b = io.BytesIO(); im.save(b, "JPEG", quality=88)
            while len(bin_) % 4: bin_.append(0)
            off = len(bin_); bin_.extend(b.getvalue())
            views.append({"buffer": 0, "byteOffset": off, "byteLength": len(b.getvalue())})
            images.append({"name": key, "mimeType": "image/jpeg", "bufferView": len(views) - 1})
    mat = {"name": "armour", "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0.0, "roughnessFactor": 0.8}}
    if len(images) > 1: mat["normalTexture"] = {"index": 1}
    meshes = []
    scene_nodes = list(j["scenes"][j.get("scene", 0)]["nodes"])
    for name, pc in pieces.items():
        if len(pc["idx"]) == 0: continue
        prim = {"attributes": {
            "POSITION": add(pc["pos"].astype(np.float32), 34962, minmax=True),
            "NORMAL": add(pc["nor"].astype(np.float32), 34962),
            "TEXCOORD_0": add(pc["uv"].astype(np.float32), 34962, typ="VEC2"),
            "JOINTS_0": add(pc["J"].astype(np.uint16), 34962, comp=5123, typ="VEC4"),
            "WEIGHTS_0": add(pc["W"].astype(np.float32), 34962, typ="VEC4")},
            "indices": add(pc["idx"].astype(np.uint32), 34963, comp=5125, typ="SCALAR"), "material": 0}
        meshes.append({"name": "armour_" + name, "primitives": [prim]})
        nodes.append({"name": "armour_" + name, "mesh": len(meshes) - 1, "skin": 0})
        scene_nodes.append(len(nodes) - 1)
    while len(bin_) % 4: bin_.append(0)
    out = {"asset": {"version": "2.0", "generator": "raid-commander wardrobe fit"}, "scene": 0,
           "scenes": [{"nodes": scene_nodes}], "nodes": nodes, "skins": [skin], "meshes": meshes,
           "materials": [mat], "textures": [{"source": i} for i in range(len(images))], "images": images,
           "accessors": accs, "bufferViews": views, "buffers": [{"byteLength": len(bin_)}]}
    js = json.dumps(out, separators=(",", ":")).encode()
    while len(js) % 4: js += b" "
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(out_path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack("<II", len(bin_), 0x004E4942)); f.write(bin_)


def smooth_cut(pos, tri, drop, rounds=3):
    """Evens out the edge of a cut: a triangle goes with most of its neighbours,
    so no spikes or slivers are left along it."""
    key = np.unique(np.round(pos, 4), axis=0, return_inverse=True)[1].reshape(-1)
    t = key[tri]
    nv = key.max() + 1
    rows = np.repeat(np.arange(len(t)), 3)
    import scipy.sparse as sp
    VT = sp.csr_matrix((np.ones(len(rows)), (t.reshape(-1), rows)), shape=(nv, len(t)))
    TT = (VT.T @ VT).tocsr()
    TT.setdiag(0); TT.eliminate_zeros()
    TT.data[:] = 1
    deg = np.asarray(TT.sum(1)).reshape(-1) + 1e-9
    d = drop.astype(float)
    for _ in range(rounds):
        f = (TT @ d) / deg
        d = np.where(f > 0.6, 1.0, np.where(f < 0.25, 0.0, d))
    return d > 0.5


def skin_any_of(c):
    mx = c.max(1); sat = (mx - c.min(1)) / (mx + 1e-6)
    return (c[:, 0] - c[:, 1] > 0.1) & (c[:, 1] > c[:, 2]) & (sat > 0.25) & (mx > 0.3)


def paint_shirt(textures, uv, tris):
    """Repaints the given triangles' texels as undyed linen, keeping their shading."""
    from PIL import ImageDraw
    im = textures["base"].convert("RGB")
    w, h = im.size
    mask = Image.new("L", im.size, 0)
    d = ImageDraw.Draw(mask)
    for t in tris:
        d.polygon([(uv[i, 0] % 1 * w, uv[i, 1] % 1 * h) for i in t], fill=255)
    a = np.asarray(im, dtype=float)
    lum = a.mean(2, keepdims=True) / 160
    linen = np.clip(np.array([196, 182, 150]) * lum, 0, 255)
    m = (np.asarray(mask) > 0)[..., None]
    textures["base"] = Image.fromarray(np.where(m, linen, a).astype(np.uint8))


def main(outfit, body, outp, debug=False, keep_skin=("gloves",), drop_head=False, bare_hands=False, open_sleeves=False):
    og, bg, oprims, onames, bnames, braw, bi = fit(outfit, body, outp, debug)
    textures = tex_of(og, oprims[0]["mat"] or 0)
    pieces = {}
    for p in oprims:
        skin = skin_mask(textures["base"], p)
        tri = p["idx"].reshape(-1, 3)
        tp = p["piece"][tri]
        # A triangle goes to the piece most of its corners lie in.
        tpiece = np.where(tp[:, 1] == tp[:, 2], tp[:, 1], tp[:, 0])
        bare = skin[tri].sum(1) >= 2
        drop = bare & ~np.isin(tpiece, keep_skin)
        c = colours(textures["base"], p["uv"])
        mx = c.max(1); sat = (mx - c.min(1)) / (mx + 1e-6)
        if drop_head:  # bare head, hood down: only the collar stays, without the beard
            drop |= np.isin(p["obone"][tri], HEADS).sum(1) >= 2
            f = p["fpos"]; nk = p["bneck"]
            chin = (f[:, 1] > nk[1] - 0.01) & (f[:, 2] > nk[2] + 0.03) & np.isin(p["obone"], ["Head", "headfront", "Neck"])
            drop |= chin[tri].sum(1) >= 2
            hair = (mx < 0.27) & (f[:, 1] > nk[1] - 0.02) & np.isin(p["obone"], ["Head", "headfront", "Neck"])
            drop |= hair[tri].sum(1) >= 2
            # What is left of the head is the lowered hood, a collar that leaves the head whole.
            tpiece = np.where(tpiece == "hood", "collar", tpiece)
        if bare_hands:  # no gloves: the body keeps its own hands and forearms
            skin_any = skin_any_of(c)
            hand = np.char.endswith(p["obone"].astype(str), "Hand")
            drop |= (skin_any & hand)[tri].sum(1) >= 2
            tpiece = np.where(tpiece == "gloves", "sleeves", tpiece)
        if open_sleeves:  # short sleeves: the body's forearms show below them
            tpiece = np.where(np.isin(tpiece, ["sleeves", "gloves"]), "shoulders", tpiece)
        drop = smooth_cut(p["pos"], tri, drop)
        Jb = np.array([bi.get(n, bi.get(BORROW.get(n, ""), 0)) for n in onames])
        # Bare chest under the collar becomes a linen shirt.
        chest = skin_any_of(c) & np.isin(p["obone"], ["Spine", "Spine1", "Spine2", "Neck"])
        paint_shirt(textures, p["uv"], tri[(chest[tri].sum(1) >= 2) & ~drop])
        for name in ("hood", "collar", "jacket", "shoulders", "sleeves", "gloves", "pants", "boots"):
            t = tri[(tpiece == name) & ~drop]
            used = np.unique(t)
            remap = -np.ones(len(p["fpos"]), int); remap[used] = np.arange(len(used))
            pc = pieces.setdefault(name, {"pos": [], "nor": [], "uv": [], "J": [], "W": [], "idx": [], "n": 0})
            pc["pos"].append(p["fpos"][used]); pc["nor"].append(p["fnor"][used]); pc["uv"].append(p["uv"][used])
            pc["J"].append(Jb[p["J"][used]]); pc["W"].append(p["W"][used]); pc["idx"].append(remap[t].reshape(-1) + pc["n"])
            pc["n"] += len(used)
        if debug: print("bare triangles dropped", int(drop.sum()), "of", len(tri))
    for pc in pieces.values():
        for k in ("pos", "nor", "uv", "J", "W", "idx"): pc[k] = np.concatenate(pc[k]) if pc[k] else np.zeros((0,))
    if debug:
        for k, pc in pieces.items(): print(k, len(pc["idx"]) // 3, "tris")
    write(outp, bg, braw, bi, pieces, textures)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3], "--debug" in sys.argv, drop_head="--drop-head" in sys.argv, bare_hands="--bare-hands" in sys.argv,
         open_sleeves="--open-sleeves" in sys.argv)
