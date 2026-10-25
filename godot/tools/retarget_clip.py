"""Retargets a clip from a Meshy rig onto one of our body .glb files.

    python3 retarget_clip.py meshy-export.glb ClipName body.glb [more-bodies.glb ...]

Meshy's rigging gives a 24-bone skeleton (Hips, Spine02, neck ...) while our
human, dwarf, elf and skeleton bodies carry Mixamo's (mixamorig:Spine ...),
and even the orc's own bones rest at other angles than a fresh rig's. So the
clip is moved bone by bone in model space: each bone turns from its rest by
the same amount the source bone turns from its rest, after lining the two
rests up along the bone. The hips' travel is scaled by hip height. A clip
already on the body under that name is replaced.
"""
import sys

import numpy as np

from add_clip import accessor_bytes, read, write

# Meshy bone -> Mixamo bone. Names on either side are matched without "mixamorig:".
MESHY_TO_MIXAMO = {
    "Hips": "Hips", "Spine02": "Spine", "Spine01": "Spine1", "Spine": "Spine2",
    "neck": "Neck", "Head": "Head",
    "LeftShoulder": "LeftShoulder", "LeftArm": "LeftArm", "LeftForeArm": "LeftForeArm", "LeftHand": "LeftHand",
    "RightShoulder": "RightShoulder", "RightArm": "RightArm", "RightForeArm": "RightForeArm", "RightHand": "RightHand",
    "LeftUpLeg": "LeftUpLeg", "LeftLeg": "LeftLeg", "LeftFoot": "LeftFoot", "LeftToeBase": "LeftToeBase",
    "RightUpLeg": "RightUpLeg", "RightLeg": "RightLeg", "RightFoot": "RightFoot", "RightToeBase": "RightToeBase",
}
# Which child a bone points at, in Meshy names: lines up the rests along it.
AIM = {
    "Hips": "Spine02", "Spine02": "Spine01", "Spine01": "Spine", "Spine": "neck", "neck": "Head",
    "LeftShoulder": "LeftArm", "LeftArm": "LeftForeArm", "LeftForeArm": "LeftHand",
    "RightShoulder": "RightArm", "RightArm": "RightForeArm", "RightForeArm": "RightHand",
    "LeftUpLeg": "LeftLeg", "LeftLeg": "LeftFoot", "LeftFoot": "LeftToeBase",
    "RightUpLeg": "RightLeg", "RightLeg": "RightFoot", "RightFoot": "RightToeBase",
}


def q2m(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def m2q(m):
    t = np.trace(m)
    if t > 0:
        s = np.sqrt(t + 1.0) * 2
        q = [(m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s, 0.25 * s]
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = np.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        q = [0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s, (m[2, 1] - m[1, 2]) / s]
    elif m[1, 1] > m[2, 2]:
        s = np.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        q = [(m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s, (m[0, 2] - m[2, 0]) / s]
    else:
        s = np.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
        q = [(m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s, (m[1, 0] - m[0, 1]) / s]
    q = np.array(q)
    return q / np.linalg.norm(q)


def turn(a, b):
    """The shortest turn taking direction a onto direction b."""
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    v = np.cross(a, b)
    c = float(np.dot(a, b))
    if c < -0.9999:
        axis = np.cross(a, [1, 0, 0])
        if np.linalg.norm(axis) < 1e-3: axis = np.cross(a, [0, 1, 0])
        axis /= np.linalg.norm(axis)
        return 2 * np.outer(axis, axis) - np.eye(3)
    k = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + k + k @ k / (1 + c)


def bare(name):
    return name.replace("mixamorig:", "").replace("mixamorig_", "")


class Rig:
    def __init__(self, gltf):
        self.g = gltf
        self.parent = {}
        for i, n in enumerate(gltf["nodes"]):
            for c in n.get("children", []): self.parent[c] = i
        self.joints = gltf["skins"][0]["joints"]
        self.by_name = {bare(gltf["nodes"][i]["name"]): i for i in self.joints}
        self.root = self.joints[0]
        while self.parent.get(self.root) in self.joints: self.root = self.parent[self.root]

    def local(self, i):
        n = self.g["nodes"][i]
        return q2m(n.get("rotation", [0, 0, 0, 1])), np.array(n.get("translation", [0, 0, 0]), float), np.array(n.get("scale", [1, 1, 1]), float)

    def above(self, i):
        """Rotation, scale and position of the nodes over the skeleton's root, in model space."""
        R, S, P = np.eye(3), 1.0, np.zeros(3)
        chain = []
        j = self.parent.get(i)
        while j is not None:
            chain.append(j)
            j = self.parent.get(j)
        for k in reversed(chain):
            r, t, s = self.local(k)
            P = P + R @ (S * t)
            R = R @ r
            S = S * s[0]
        return R, S, P

    def rest(self, rot=None, pos=None):
        """Model-space rotation and position of every joint, with these local rotations and hips position."""
        Rr, Sr, Pr = self.above(self.root)
        G, X = {}, {}

        def walk(i, R, S, P):
            r, t, s = self.local(i)
            if rot and i in rot: r = rot[i]
            if pos is not None and i == self.root: t = pos
            X[i] = P + R @ (S * t)
            G[i] = R @ r
            for c in self.g["nodes"][i].get("children", []):
                if c in self.joints: walk(c, G[i], S * s[0], X[i])
        walk(self.root, Rr, Sr, Pr)
        return G, X


def retarget(src_path, clip, body_path):
    sg, sbin = read(src_path)
    tg, tbin = read(body_path)
    src, dst = Rig(sg), Rig(tg)
    anim = max(sg["animations"], key=lambda a: len(a["channels"]))

    # The source's keys, per bone: Meshy keys every bone on the same frames.
    times, rot, hips_pos = None, {}, None
    for ch in anim["channels"]:
        s = anim["samplers"][ch["sampler"]]
        node, path = ch["target"]["node"], ch["target"]["path"]
        t = np.frombuffer(accessor_bytes(sg, sbin, s["input"]), np.float32)
        v = np.frombuffer(accessor_bytes(sg, sbin, s["output"]), np.float32)
        if times is None or len(t) > len(times): times = t
        if path == "rotation": rot[node] = v.reshape(-1, 4)
        if path == "translation" and node == src.root: hips_pos = v.reshape(-1, 3)
    n = len(times)

    # A body rigged by Meshy itself (the orc) keeps Meshy's names.
    names = {m: m for m in MESHY_TO_MIXAMO} if "Spine02" in dst.by_name else MESHY_TO_MIXAMO
    G_s0, X_s0 = src.rest()
    G_t0, X_t0 = dst.rest()
    # Line each target bone's rest up with the source's along the bone.
    pairs = {}
    for m, b in names.items():
        if m in src.by_name and b in dst.by_name: pairs[dst.by_name[b]] = src.by_name[m]
    if dst.by_name.get("Hips") is None:
        raise SystemExit(body_path + ": no Hips bone")
    line = {}
    for m, b in names.items():
        if b not in dst.by_name or m not in src.by_name: continue
        tb, sb = dst.by_name[b], src.by_name[m]
        aim = AIM.get(m)
        if aim and aim in src.by_name and names[aim] in dst.by_name:
            ta, sa = dst.by_name[names[aim]], src.by_name[aim]
            line[tb] = turn(X_t0[ta] - X_t0[tb], X_s0[sa] - X_s0[sb])
    # Hands, head and toes keep their parent's line-up.
    for tb in dst.joints:
        if tb not in line:
            p = dst.parent.get(tb)
            line[tb] = line.get(p, np.eye(3))

    Rt_above, St_above, _ = dst.above(dst.root)
    rest_hips_s = X_s0[src.root]
    rest_hips_t = X_t0[dst.root]
    k = rest_hips_t[1] / rest_hips_s[1]

    out_rot = {b: np.zeros((n, 4), np.float32) for b in dst.joints}
    out_hips = np.zeros((n, 3), np.float32)
    for f in range(n):
        G_s, X_s = src.rest({i: q2m(rot[i][f]) for i in rot}, hips_pos[f] if hips_pos is not None else None)
        G_t = {}

        def walk(i, parent_G):
            if i in pairs:
                s = pairs[i]
                G_t[i] = G_s[s] @ G_s0[s].T @ line[i] @ G_t0[i]
            else:
                r, _, _ = dst.local(i)
                G_t[i] = parent_G @ r
            local = parent_G.T @ G_t[i]
            out_rot[i][f] = m2q(local)
            for c in tg["nodes"][i].get("children", []):
                if c in dst.joints: walk(c, G_t[i])
        walk(dst.root, Rt_above)
        model = rest_hips_t + (X_s[src.root] - rest_hips_s) * k
        out_hips[f] = Rt_above.T @ (model - dst.above(dst.root)[2]) / St_above

    # Write it into the body as its own buffer views.
    new = {"name": clip, "channels": [], "samplers": []}

    def put(arr, kind, minmax=False):
        data = np.ascontiguousarray(arr, np.float32).tobytes()
        while len(tbin) % 4: tbin.append(0)
        tg["bufferViews"].append({"buffer": 0, "byteOffset": len(tbin), "byteLength": len(data)})
        tbin.extend(data)
        acc = {"bufferView": len(tg["bufferViews"]) - 1, "componentType": 5126, "count": len(arr), "type": kind}
        if minmax:
            acc["min"] = [float(arr.min())]
            acc["max"] = [float(arr.max())]
        tg["accessors"].append(acc)
        return len(tg["accessors"]) - 1

    t_acc = put(times - times[0], "SCALAR", True)
    for b in dst.joints:
        new["samplers"].append({"input": t_acc, "output": put(out_rot[b], "VEC4"), "interpolation": "LINEAR"})
        new["channels"].append({"sampler": len(new["samplers"]) - 1, "target": {"node": b, "path": "rotation"}})
    new["samplers"].append({"input": t_acc, "output": put(out_hips, "VEC3"), "interpolation": "LINEAR"})
    new["channels"].append({"sampler": len(new["samplers"]) - 1, "target": {"node": dst.root, "path": "translation"}})
    tg["animations"] = [a for a in tg.get("animations", []) if a.get("name") != clip] + [new]
    write(body_path, tg, tbin)
    print("%s: +%s (%d frames, %d bones from the clip)" % (body_path, clip, n, len(pairs)))


if __name__ == "__main__":
    for body in sys.argv[3:]:
        retarget(sys.argv[1], sys.argv[2], body)
