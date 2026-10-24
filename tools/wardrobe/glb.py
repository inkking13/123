import json, struct, numpy as np

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


class GLB:
    def __init__(self, path):
        f = open(path, "rb").read()
        l = struct.unpack("<I", f[12:16])[0]
        self.j = json.loads(f[20:20 + l])
        o = 20 + l
        bl = struct.unpack("<I", f[o:o + 4])[0]
        self.bin = f[o + 8:o + 8 + bl]

    def view(self, i):
        v = self.j["bufferViews"][i]
        s = v.get("byteOffset", 0)
        return self.bin[s:s + v["byteLength"]]

    def acc(self, i):
        a = self.j["accessors"][i]
        v = self.j["bufferViews"][a["bufferView"]]
        dt = CT[a["componentType"]]
        n = NC[a["type"]]
        off = v.get("byteOffset", 0) + a.get("byteOffset", 0)
        stride = v.get("byteStride", 0)
        isz = np.dtype(dt).itemsize * n
        if stride and stride != isz:
            raw = np.frombuffer(self.bin, np.uint8, a["count"] * stride, off).reshape(a["count"], stride)[:, :isz]
            arr = np.frombuffer(raw.tobytes(), dt).reshape(a["count"], n)
        else:
            arr = np.frombuffer(self.bin, dt, a["count"] * n, off).reshape(a["count"], n)
        if a.get("normalized"):
            arr = arr.astype(np.float32) / np.iinfo(dt).max
        return arr.copy()

    def local(self, n):
        node = self.j["nodes"][n]
        if "matrix" in node:
            return np.array(node["matrix"], float).reshape(4, 4).T
        t = np.array(node.get("translation", [0, 0, 0]), float)
        r = node.get("rotation", [0, 0, 0, 1])
        s = np.array(node.get("scale", [1, 1, 1]), float)
        x, y, z, w = r
        R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        M = np.eye(4)
        M[:3, :3] = R * s
        M[:3, 3] = t
        return M

    def parents(self):
        p = {}
        for i, n in enumerate(self.j["nodes"]):
            for c in n.get("children", []):
                p[c] = i
        return p

    def world(self, n):
        p = self.parents()
        M = self.local(n)
        while n in p:
            n = p[n]
            M = self.local(n) @ M
        return M

    def prim(self, mesh=0, prim=0):
        pr = self.j["meshes"][mesh]["primitives"][prim]
        out = {k: self.acc(v) for k, v in pr["attributes"].items()}
        out["indices"] = self.acc(pr["indices"]).reshape(-1) if "indices" in pr else np.arange(len(out["POSITION"]))
        out["material"] = pr.get("material")
        return out

    def image(self, i):
        im = self.j["images"][i]
        return self.view(im["bufferView"]), im.get("mimeType")


def skin_info(g, skin=0):
    s = g.j["skins"][skin]
    names = [g.j["nodes"][n]["name"] for n in s["joints"]]
    ibm = g.acc(s["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
    bind = np.array([np.linalg.inv(m) for m in ibm])
    return names, ibm, bind
