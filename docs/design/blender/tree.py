# The Blender look-dev of ftree's tiered tree: form, bark and light. See README.md in this folder.
# Run inside Blender (Scripting tab or the Blender MCP), with HERE set to this folder:
#   HERE = "<repo>/docs/design/blender"; exec(open(HERE + "/tree.py").read())
#   setup(); build("E"); grow("E"); show("E")      # the tree, its light, a growth animation
#   bake(HERE + "/../../../ui/app/bark")            # the bark textures the app loads
# Input is the family tree itself (family.json: a couple or single person with children), so the whole
# form is a rule. Every strand, twig and free branch is its own curve object that can grow from 0 to 1.
# The app builds the same form in ui/app/twinedForm.ts; when the rule changes, change it there too.
#
# Two directions are kept. "E" (Tiers) is the one the app uses, "D" (Cascade) is the alternative that
# was not chosen (see VARIANTS below). What both share:
# - Trunk: every couple is a braid of two strands, the braids stand around the eldest couple and fuse
#   into one trunk. Every strand ends as a root.
# - Card angles come from a tidy-tree layout: a family is narrow, the gaps between families are wide.
# - Free branches (no card) are seeded from the family id. They only ever grow up and out of the upper
#   side of the wood, cards only ever hang below it.
# - Bark: plates with furrows, and gold where a plate has come off (bark_graph).
import bpy, bmesh, json, math
from mathutils import Vector, Matrix

HERE = globals().get("HERE") or __import__("os").path.dirname(bpy.data.filepath)  # this folder
FAMILY = json.load(open(HERE + "/family.json"))
CARD_W, CARD_H = 3.6, 4.8
HILL_R = 60.0
TAU = math.tau
rad = math.radians

BASE = dict(
    lowest=7.3, gap=6.3, pin_lift=0.25, drop=0.3,
    R0=6.5, R1=11.0, Rstep=7.5, Rpow=0.7,  # tier radius: R0 for the founders, then R1 + Rstep * (tier-1)^Rpow
    pad=1.0, sib_gap=0.6, fam_gap=2.4, front=0.75, back=0.25, root_half=0.75,  # layout, in units / radians
    ring=1.38, omega=rad(3.0), yref=10, y0=2.6, step=0.3,  # trunk, unchanged from direction A
    wind=0.68, turn=5.5, sr=0.68, thin=0.40,  # strands: winding amplitude per radius, radius at base and end
    rise0=5.2, rise1=6.0, stagger=1.3, swirl=0.45,  # where limbs leave the trunk, and their sideways swing
    fork_root=0.3, fork=0.6, fork_len=0.3,  # share of a couple's own limb that stays twined
    bundle=0.6, bundle_turn=0.3,  # braids travelling in one limb: spacing and slow turn
    tip=[(0.5, 0.0, 0.9), (1.0, 0.18, 0.7), (1.35, 0.55, 0.35)],
    twig_r=0.24, twig_rise=3.6,
    twig_tip_up=[(0.4, 0.0, 0.8), (0.8, 0.3, 0.4)],
    twig_tip_hang=[(0.35, -0.3, 0.8), (0.85, -0.4, 0.6), (1.4, -0.2, 0.35)],
    thread_r=0.035, root_len=10.5,
    crown=8, crown_free=1.25,  # free crown branches and the front window they keep clear
    crown_r=0.3, wrap=0.0, wobble=0.0, knots=0.0, twiglets=False,
)
PROF_CROWN = [(0, 0), (0.06, 0.5), (0.5, 0.95), (1, 1)]
PROF_FILL = [(0, 0), (0.12, 0.62), (0.55, 1.06), (1, 1)]
PROF_SPRIG = [(0, 0), (0.3, 0.5), (0.62, 0.86), (1, 1)]
PROF_SIDE = [(0, 0), (0.35, 0.3), (0.7, 0.7), (1, 1)]
# D "Cascade": a founders' child leaves the trunk with all its descendants, the limb steps DOWN from
#   nest to nest. The wood links the generations, but older wood has to run downhill.
# E "Tiers": every couple leaves the trunk on its own limb, lower for every younger generation, and
#   all wood RISES. A limb runs out low, lets the couple's single children peel off as twigs and then
#   climbs to the couple's fork. Generations are linked by place only: a child's limb leaves the trunk
#   right below its parents' limb and its cards hang in the row under theirs. Tier radii form a dome.
VARIANTS = {
    "D": dict(name="D_Cascade", cascade=True),
    "E": dict(name="E_Tiers", cascade=False, lowest=9.5, fork=0.55, rise_kids=8.9, rise1=5.2, stagger=0.8,
              swirl=0.4, dome=(15.5, 19.5, 0.36), thin=0.46,
              # ends run out long and fine and turn up; limbs sway a little and have knots
              tip=[(0.7, 0.35, 0.85), (1.5, 0.85, 0.62), (2.4, 1.6, 0.38), (3.2, 2.5, 0.12)],
              twig_tip_up=[(0.5, 0.1, 0.8), (1.0, 0.35, 0.5), (1.5, 0.7, 0.15)],
              wobble=0.4, knots=0.07, twiglets=True,
              # free strands wind around the founders' leader, so the trunk stays a trunk up to the crown
              crown_r=0.4, wrap=0.85),  # dome: widest radius, how fast it narrows, height share of the widest tier
}
P = BASE


def S(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def lerp(a, b, t):
    return a + (b - a) * t


# Angle 0 faces the camera (-Y), positive angles go to the right.
def cyl(r, a, h):
    return Vector((r * math.sin(a), -r * math.cos(a), h))


def polar(p):
    return math.hypot(p.x, p.y), math.atan2(p.x, -p.y)


def hill(r):
    return math.sqrt(max(0.0, HILL_R**2 - r * r)) - HILL_R


def bez(p, t):  # Bezier through any number of control points
    q = [tuple(x) for x in p]
    while len(q) > 1:
        q = [tuple(lerp(a[i], b[i], t) for i in range(2)) for a, b in zip(q, q[1:])]
    return q[0]


def wrap(a):
    return (a + math.pi) % TAU - math.pi


class Rng:
    """mulberry32 seeded with an FNV-1a hash of the family id, so JavaScript can reproduce every number."""

    def __init__(self, text):
        h = 2166136261
        for ch in text.encode():
            h = ((h ^ ch) * 16777619) & 0xFFFFFFFF
        self.s = h

    def __call__(self):
        self.s = (self.s + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.s
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    def between(self, a, b):
        return a + (b - a) * self()


# Catmull-Rom through (Vector, radius, tilt) points.
def catmull(pts, sub):
    out, n = [], len(pts)
    for i in range(n - 1):
        p0, p1, p2, p3 = pts[max(i - 1, 0)][0], pts[i][0], pts[i + 1][0], pts[min(i + 2, n - 1)][0]
        for k in range(sub):
            t = k / sub
            v = 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t**3)
            out.append((v, lerp(pts[i][1], pts[i + 1][1], t), lerp(pts[i][2], pts[i + 1][2], t)))
    out.append(pts[-1])
    return out


def join_prefix(prefix, body, sub=6):
    return catmull(prefix + [body[0], body[2]], sub)[: len(prefix) * sub] + body


def join_suffix(body, suffix, sub=6):
    return body + catmull([body[-3], body[-1]] + suffix, sub)[sub + 1 :]


def frames(pts):
    T = [(pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized() for i in range(len(pts))]
    n1 = Vector((1, 0, 0))
    F = []
    for i, t in enumerate(T):
        if i:
            n1 = T[i - 1].rotation_difference(t) @ n1
        n1 = (n1 - t * n1.dot(t)).normalized()
        F.append((n1.copy(), t.cross(n1)))
    return F


def arcs(pts):
    out = [0.0]
    for k in range(1, len(pts)):
        out.append(out[-1] + (pts[k] - pts[k - 1]).length)
    return out


# Even spacing along the path, so the bark does not stretch and growth runs at an even speed.
def resample(pts, step=0.3):
    out, need = [pts[0]], step
    for i in range(1, len(pts)):
        a, b = pts[i - 1], pts[i]
        d = (b[0] - a[0]).length
        while d >= need and d > 1e-9:
            f = need / d
            a = (a[0].lerp(b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f))
            out.append(a)
            d -= need
            need = step
        need -= d
    if (out[-1][0] - pts[-1][0]).length > step * 0.3:
        out.append(pts[-1])
    else:
        out[-1] = pts[-1]
    return out


# ---------- scene helpers ----------
def coll(name, parent=None):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    for o in list(c.objects):  # only ever clears this experiment's own collections
        data = o.data
        bpy.data.objects.remove(o)
        if data and data.users == 0:
            bpy.data.batch_remove([data])
    return c


def node_tree(idblock):
    try:
        idblock.use_nodes = True
    except Exception:
        pass
    return idblock.node_tree


def strand(c, name, pts, mat, res=5):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 1.0  # the point radius is the real radius
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    cu.twist_mode = "MINIMUM"
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, (v, r, t) in zip(sp.points, pts):
        p.co = (v.x, v.y, v.z, 1)
        p.radius = r
        p.tilt = t
    sp.use_smooth = True
    o = bpy.data.objects.new(name, cu)
    c.objects.link(o)
    cu.materials.append(mat)
    return o


def wood(c, name, pts, mat, t0=0.0, who=""):
    """One growing piece. t0 is the path length from the ground to where this piece starts."""
    pts = resample(pts)
    length = sum((pts[k][0] - pts[k - 1][0]).length for k in range(1, len(pts)))
    o = strand(c, name, pts, mat)
    thick = max(p[1] for p in pts)
    o["bark_len"] = length * min(0.9, max(0.4, 0.45 * (0.5 / max(thick, 0.05)) ** 0.5))
    o["grow_t0"], o["grow_len"], o["who"] = t0, length, who
    return o


def card(c, name, top, mat, who):
    me = bpy.data.meshes.new(name)
    w = CARD_W / 2
    me.from_pydata([(-w, 0, 0), (w, 0, 0), (w, 0, -CARD_H), (-w, 0, -CARD_H)], [], [(0, 1, 2, 3)])
    o = bpy.data.objects.new(name, me)
    o.location = top
    o["who"] = who
    c.objects.link(o)
    me.materials.append(mat)
    con = o.constraints.new("LOCKED_TRACK")  # cards turn towards the camera around the vertical
    con.target = bpy.data.objects.get("Cam_06")
    con.track_axis = "TRACK_NEGATIVE_Y"
    con.lock_axis = "LOCK_Z"
    return o


def flat(name, color, rough=0.8):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    nt = node_tree(m)
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    nt.links.new(b.outputs[0], out.inputs[0])
    m.use_backface_culling = False
    return m


RU = 2.0  # the bark repeats every TAU * RU texture units along the wood and once around it
GOLD = (1.0, 0.42, 0.06)


def bark_graph(nt, along, around):
    """Old bark with gold underneath, as shader nodes. `along` is the path length in texture units,
    `around` runs 0..1 around the wood. The surface is wrapped onto a torus in 4D, so the pattern has
    no seam and tiles in both directions: the same graph is baked into the textures for the app.
    The bark is made of plates (Voronoi cells) with deep furrows between them. Some plates have
    fallen off as a whole and show the golden wood, and gold runs in the furrows next to them."""
    link = nt.links.new

    def N(kind, **kw):
        n = nt.nodes.new(kind)
        for k, v in kw.items():
            setattr(n, k, v)
        return n

    def put(sock, v):
        if hasattr(v, "is_linked"):
            link(v, sock)
        elif v is not None:
            sock.default_value = v

    def math_(op, a, b=None, c=None):
        n = N("ShaderNodeMath", operation=op)
        for i, v in enumerate((a, b, c)):
            put(n.inputs[i], v)
        return n.outputs[0]

    def ramp(fac, stops, interp="EASE"):
        n = N("ShaderNodeValToRGB")
        n.color_ramp.interpolation = interp
        e = n.color_ramp.elements
        while len(e) < len(stops):
            e.new(0.5)
        for el, (pos, col) in zip(e, stops):
            el.position, el.color = pos, ((col, col, col, 1) if isinstance(col, (int, float)) else (*col, 1))
        link(fac, n.inputs[0])
        return n.outputs[0]

    def mix(fac, a, b, colour=False):
        n = N("ShaderNodeMix", data_type="RGBA" if colour else "FLOAT")
        kind = "Color" if colour else "Float"
        sock = lambda ident: next(x for x in list(n.inputs) + list(n.outputs) if x.identifier == ident)
        put(sock("Factor_Float"), fac)
        put(sock("A_" + kind), (*a, 1) if isinstance(a, tuple) else a)
        put(sock("B_" + kind), (*b, 1) if isinstance(b, tuple) else b)
        return sock("Result_" + kind)

    def noise(vec, w, scale, detail, rough=0.55):
        n = N("ShaderNodeTexNoise", noise_dimensions="4D")
        n.inputs["Scale"].default_value, n.inputs["Detail"].default_value, n.inputs["Roughness"].default_value = scale, detail, rough
        link(vec, n.inputs["Vector"])
        link(w, n.inputs["W"])
        return n.outputs[0], n.outputs[1]

    def voronoi(vec, w, scale, feature):
        n = N("ShaderNodeTexVoronoi", voronoi_dimensions="4D", feature=feature)
        n.inputs["Scale"].default_value = scale
        link(vec, n.inputs["Vector"])
        link(w, n.inputs["W"])
        return n

    ang, ua = math_("MULTIPLY", around, TAU), math_("DIVIDE", along, RU)
    vec = N("ShaderNodeCombineXYZ")
    link(math_("COSINE", ang), vec.inputs[0])
    link(math_("SINE", ang), vec.inputs[1])
    link(math_("MULTIPLY", math_("COSINE", ua), RU), vec.inputs[2])
    w = math_("MULTIPLY", math_("SINE", ua), RU)
    _, warp = noise(vec.outputs[0], w, 1.2, 3)
    w1 = N("ShaderNodeVectorMath", operation="SUBTRACT")
    link(warp, w1.inputs[0])
    w1.inputs[1].default_value = (0.5, 0.5, 0.5)
    w2 = N("ShaderNodeVectorMath", operation="SCALE")
    link(w1.outputs[0], w2.inputs[0])
    w2.inputs["Scale"].default_value = 0.6
    w3 = N("ShaderNodeVectorMath", operation="ADD")
    link(vec.outputs[0], w3.inputs[0])
    link(w2.outputs[0], w3.inputs[1])
    p = w3.outputs[0]

    edge = voronoi(p, w, 1.5, "DISTANCE_TO_EDGE").outputs["Distance"]  # distance to the plate's rim
    cellv = voronoi(p, w, 1.5, "F1")
    plate, _ = noise(cellv.outputs["Position"], cellv.outputs["W"], 0.55, 1)  # one value per plate
    cross = ramp(voronoi(p, w, 4.0, "DISTANCE_TO_EDGE").outputs["Distance"], [(0.0, 0.6), (0.1, 1.0)])  # small cracks across
    fine, _ = noise(p, w, 6.0, 8, 0.65)
    grain, _ = noise(p, w, 9.0, 3)
    big, _ = noise(p, w, 0.25, 2)
    moss, _ = noise(p, w, 1.3, 4)
    ridge = ramp(edge, [(0.01, 0.0), (0.22, 1.0)])  # 0 in the furrow, 1 on the plate
    relief = math_("MULTIPLY", math_("MULTIPLY", ridge, cross), math_("MULTIPLY_ADD", fine, 0.4, 0.8))

    gone = ramp(plate, [(0.63, 0.0), (0.645, 1.0)], "LINEAR")  # this plate has fallen off
    vein = math_("MULTIPLY", ramp(plate, [(0.56, 0.0), (0.63, 1.0)]), math_("SUBTRACT", 1.0, ramp(edge, [(0.0, 0.0), (0.03, 1.0)])))
    gold = math_("MAXIMUM", gone, math_("MULTIPLY", vein, 0.8))

    wood = ramp(relief, [(0.0, (0.010, 0.007, 0.005)), (0.25, (0.05, 0.036, 0.026)), (0.6, (0.115, 0.09, 0.068)),
                         (1.0, (0.21, 0.18, 0.145))], "LINEAR")
    wood = mix(ramp(big, [(0.4, 0.0), (0.7, 0.5)]), wood, (0.19, 0.19, 0.18), True)  # weathered grey in places
    wood = mix(math_("MULTIPLY", ramp(moss, [(0.62, 0.0), (0.72, 0.55)]), ridge), wood, (0.13, 0.16, 0.07), True)  # lichen on the plates
    metal = mix(grain, (0.42, 0.2, 0.02), (0.95, 0.6, 0.14), True)
    metal = mix(ramp(edge, [(0.0, 0.0), (0.12, 1.0)]), (0.2, 0.09, 0.01), metal, True)  # darker towards the rim of each plate's bed
    return dict(
        color=mix(gold, wood, metal, True), gold=gold,
        rough=mix(gold, 0.92, math_("MULTIPLY_ADD", grain, 0.25, 0.18)),
        height=mix(gone, relief, math_("MULTIPLY_ADD", grain, 0.15, -0.4)),
    )


def bark(along=0, glow=0.1):
    """The bark on a bevelled curve. `along` says which UV axis runs along the strand (see uv_along);
    the object property `bark_len` is the strand's length in texture units."""
    m = bpy.data.materials.get("Bark_06") or bpy.data.materials.new("Bark_06")
    nt = node_tree(m)
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(b.outputs[0], out.inputs[0])
    uv = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(nt.nodes.new("ShaderNodeTexCoord").outputs["UV"], uv.inputs[0])
    att = nt.nodes.new("ShaderNodeAttribute")
    att.attribute_type, att.attribute_name = "OBJECT", "bark_len"
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    nt.links.new(uv.outputs[along], mul.inputs[0])
    nt.links.new(att.outputs[2], mul.inputs[1])
    g = bark_graph(nt, mul.outputs[0], uv.outputs[1 - along])
    nt.links.new(g["color"], b.inputs["Base Color"])
    nt.links.new(g["gold"], b.inputs["Metallic"])
    nt.links.new(g["rough"], b.inputs["Roughness"])
    b.inputs["Emission Color"].default_value = (*GOLD, 1)
    em = nt.nodes.new("ShaderNodeMath")
    em.operation = "MULTIPLY"
    nt.links.new(g["gold"], em.inputs[0])
    em.inputs[1].default_value = glow
    nt.links.new(em.outputs[0], b.inputs["Emission Strength"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 1.0
    bump.inputs["Distance"].default_value = 0.4
    nt.links.new(g["height"], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], b.inputs["Normal"])
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = 0.35
    return m


def bake(out, width=2048, height=1024, relief=6.0):
    """Bake the bark into tileable textures for the app (Cycles, a few seconds):
    bark-color.jpg (sRGB), bark-normal.jpg (tangent space, +Y up) and bark-gold.jpg (R and B = gold,
    G = roughness, so it serves as metalnessMap and roughnessMap). One texture covers TAU * RU texture
    units along the wood (U) and once around it (V)."""
    import numpy as np
    sc = bpy.context.scene
    me = bpy.data.meshes.new("Bark_bake")
    me.from_pydata([(0, 0, 0), (2, 0, 0), (2, 1, 0), (0, 1, 0)], [], [(0, 1, 2, 3)])
    layer = me.uv_layers.new(name="UVMap")
    for loop, uv in zip(layer.data, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        loop.uv = uv
    ob = bpy.data.objects.new("Bark_bake", me)
    sc.collection.objects.link(ob)
    m = bpy.data.materials.new("Bark_bake")
    nt = node_tree(m)
    nt.nodes.clear()
    uv = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(nt.nodes.new("ShaderNodeTexCoord").outputs["UV"], uv.inputs[0])
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    nt.links.new(uv.outputs[0], mul.inputs[0])
    mul.inputs[1].default_value = TAU * RU
    g = bark_graph(nt, mul.outputs[0], uv.outputs[1])
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(em.outputs[0], nt.nodes.new("ShaderNodeOutputMaterial").inputs[0])
    img = bpy.data.images.new("Bark_bake", width, height, float_buffer=True, is_data=True)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.nodes.active = tex
    me.materials.append(m)
    engine = sc.render.engine
    sc.render.engine = "CYCLES"
    sc.cycles.device, sc.cycles.samples = "CPU", 4
    got = {}
    try:
        with bpy.context.temp_override(active_object=ob, object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
            for key in ("color", "gold", "rough", "height"):
                for l in list(em.inputs[0].links):
                    nt.links.remove(l)
                nt.links.new(g[key], em.inputs[0])
                bpy.ops.object.bake(type="EMIT", margin=0, use_clear=True)
                got[key] = np.array(img.pixels[:], dtype=np.float32).reshape(height, width, 4)[:, :, :3].copy()
    finally:
        sc.render.engine = engine
        bpy.data.objects.remove(ob)
        bpy.data.meshes.remove(me)
        bpy.data.materials.remove(m)
        bpy.data.images.remove(img)

    def save(name, rgb, srgb, w=width, h=height):
        if (w, h) != (width, height):
            rgb = rgb.reshape(h, height // h, w, width // w, 3).mean(axis=(1, 3))
        if srgb:
            rgb = np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * np.clip(rgb, 0, None) ** (1 / 2.4) - 0.055)
        im = bpy.data.images.new(name, w, h, alpha=False, is_data=not srgb)
        im.pixels.foreach_set(np.concatenate([np.clip(rgb, 0, 1), np.ones((h, w, 1), np.float32)], axis=2).ravel())
        im.file_format = "JPEG"
        im.filepath_raw = out + "/" + name + ".jpg"
        im.save(quality=90)
        bpy.data.images.remove(im)

    hgt = got["height"][:, :, 0]
    dx = (np.roll(hgt, -1, axis=1) - np.roll(hgt, 1, axis=1)) * 0.5 * relief  # wraps, so the normal map tiles too
    dy = (np.roll(hgt, -1, axis=0) - np.roll(hgt, 1, axis=0)) * 0.5 * relief
    n = np.stack([-dx, -dy, np.ones_like(hgt)], axis=2)
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    save("bark-color", got["color"], True)
    save("bark-normal", n * 0.5 + 0.5, False)
    gold, rough = got["gold"][:, :, 0], got["rough"][:, :, 0]
    save("bark-gold", np.stack([gold, rough, gold], axis=2), False, width // 2, height // 2)
    return dict(gold_share=round(float((gold > 0.5).mean()), 3), height=(round(float(hgt.min()), 2), round(float(hgt.max()), 2)))


def uv_along(ob):
    """Which UV axis of a bevelled curve runs along it? Vertices are stored ring by ring from base to tip."""
    bpy.context.view_layer.update()
    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me = ev.to_mesh()
    uv, n, cx, cy = me.uv_layers[0].data, len(me.vertices), 0.0, 0.0
    for l in me.loops:
        f = l.vertex_index / n - 0.5
        cx += (uv[l.index].uv.x - 0.5) * f
        cy += (uv[l.index].uv.y - 0.5) * f
    ev.to_mesh_clear()
    return 0 if abs(cx) > abs(cy) else 1


def aim(o, loc, target):
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


def setup():
    """Evening light as in the app: a low warm sun that rakes over the bark, a soft sky, a meadow knoll.
    Leaves Rig_05 untouched; running it again only adjusts what is there."""
    sc = bpy.context.scene
    rig = bpy.data.collections.get("Rig_06") or coll("Rig_06")

    def obj(name, make):
        o = bpy.data.objects.get(name)
        if not o:
            o = bpy.data.objects.new(name, make())
            rig.objects.link(o)
        return o

    cam = obj("Cam_06", lambda: bpy.data.cameras.new("Cam_06"))
    cam.data.lens, cam.data.clip_end = 50, 800
    aim(cam, (0, -66, 15), (0, 0, 15.5))
    sun = obj("Sun_06", lambda: bpy.data.lights.new("Sun_06", "SUN"))
    sun.data.energy, sun.data.color, sun.data.angle = 5.0, (1, 0.84, 0.64), rad(4)
    aim(sun, (34, -30, 22), (0, 0, 12))
    rim = obj("Rim_06", lambda: bpy.data.lights.new("Rim_06", "SUN"))
    rim.data.energy, rim.data.color, rim.data.angle = 1.4, (1, 0.72, 0.45), rad(6)
    aim(rim, (-26, 30, 16), (0, 0, 12))

    def hill_mesh():
        me = bpy.data.meshes.new("Hill_06")
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=128, v_segments=64, radius=HILL_R)
        bm.to_mesh(me)
        bm.free()
        for poly in me.polygons:
            poly.use_smooth = True
        return me

    h = obj("Hill_06", hill_mesh)
    h.location = (0, 0, -HILL_R)
    grass = flat("Hill_06", (0.045, 0.07, 0.028), rough=1.0)
    if not h.data.materials:
        h.data.materials.append(grass)
    w = bpy.data.worlds.get("World_06") or bpy.data.worlds.new("World_06")
    nt = node_tree(w)
    nt.nodes.clear()
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(nt.nodes.new("ShaderNodeTexCoord").outputs["Generated"], sep.inputs[0])
    up = nt.nodes.new("ShaderNodeMapRange")
    up.inputs["From Min"].default_value, up.inputs["From Max"].default_value = -1, 1
    nt.links.new(sep.outputs["Z"], up.inputs["Value"])
    sky = nt.nodes.new("ShaderNodeValToRGB")
    e = sky.color_ramp.elements
    for pos, col in [(0.4, (0.25, 0.22, 0.2)), (0.5, (0.86, 0.72, 0.58)), (0.72, (0.45, 0.56, 0.74)), (1.0, (0.2, 0.32, 0.58))]:
        el = e[0] if pos == 0.4 else e[1] if pos == 0.5 else e.new(pos)
        el.position, el.color = pos, (*col, 1)
    nt.links.new(up.outputs[0], sky.inputs[0])
    bg = nt.nodes.new("ShaderNodeBackground")
    nt.links.new(sky.outputs[0], bg.inputs[0])
    bg.inputs[1].default_value = 0.7
    nt.links.new(bg.outputs[0], nt.nodes.new("ShaderNodeOutputWorld").inputs[0])
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1100, 1000, 100


def shot(path, cam=(0, -66, 15), target=(0, 0, 15.5), res=(1100, 1000), lens=50):
    """A still for checking the look."""
    sc = bpy.context.scene
    co = bpy.data.objects["Cam_06"]
    aim(co, cam, target)
    co.data.lens = lens
    sc.camera = co
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.image_settings.file_format = "JPEG"
    sc.render.image_settings.quality = 88
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


SETS = {"A": ("A_Monolith", "Rig_05", "World_05", "Cam_05"), "B": ("B_Kalligrafie", "Rig_05", "World_05", "Cam_05"),
        "C": ("C_Orbit", "Rig_05", "World_05", "Cam_05"), "D": ("D_Cascade", "Rig_06", "World_06", "Cam_06"),
        "E": ("E_Tiers", "Rig_06", "World_06", "Cam_06")}


def show(key):
    """Switch between the directions with the eye icon, together with their light, sky and camera."""
    top = bpy.context.view_layer.layer_collection.children
    name, rig, world, cam = SETS[key]
    for n in {s[0] for s in SETS.values()} | {"Rig_05", "Rig_06"}:
        if top.get(n):
            off = n not in (name, rig)
            top[n].hide_viewport = off
            bpy.data.collections[n].hide_render = off
    sc = bpy.context.scene
    sc.world = bpy.data.worlds.get(world) or sc.world
    sc.camera = bpy.data.objects.get(cam) or sc.camera


# ---------- layout: a family is narrow, the gaps between families are wide ----------
def layout(root, R):
    slot = lambda t: (CARD_W + P["pad"]) / R(t)
    card_a = {}

    def gap(a, b, t):
        return (P["fam_gap"] if a["kids"] or b["kids"] else P["sib_gap"]) / R(t)

    def measure(n):
        t, row = n["tier"], 0.0
        for i, k in enumerate(n["kids"]):
            row += measure(k) + (gap(n["kids"][i - 1], k, t + 1) if i else 0.0)
        n["row"], n["w"] = row, max(len(n["ids"]) * slot(t), row)
        return n["w"]

    def place(n, center):
        t, cnt = n["tier"], len(n["ids"])
        n["a"] = center
        for i, pid in enumerate(n["ids"]):
            card_a[pid] = center + (i - (cnt - 1) / 2) * slot(t)
        x = center - n["row"] / 2
        for i, k in enumerate(n["kids"]):
            x += gap(n["kids"][i - 1], k, t + 1) if i else 0.0
            place(k, x + k["w"] / 2)
            x += k["w"]

    left, right = [], []
    for k in root["kids"]:  # the founders' children take turns left and right, the front stays open
        measure(k)
        (left if sum(x["w"] for x in left) <= sum(x["w"] for x in right) else right).append(k)
    lo, hi = P["front"], math.pi - P["back"]
    for side, sign in ((left, -1), (right, 1)):
        g = max(0.0, (hi - lo - sum(x["w"] for x in side)) / (len(side) + 1))
        x = lo + g
        for k in side:
            place(k, sign * (x + k["w"] / 2))
            x += k["w"] + g
    root["a"], root["w"] = 0.0, TAU
    for i, pid in enumerate(root["ids"]):
        card_a[pid] = (i - (len(root["ids"]) - 1) / 2) * 2 * P["root_half"]
    return card_a


# ---------- the tree ----------
def build(key="D"):
    P = {**BASE, **VARIANTS[key]}
    c = coll(P["name"])
    cf = coll(P["name"] + "_free", c)
    mat = bark()
    cmat = flat("Card_06", (0.78, 0.72, 0.6), rough=0.7)
    tmat = flat("Thread_06", (0.05, 0.035, 0.025), rough=0.9)
    root = json.loads(json.dumps(FAMILY))
    rng = Rng(root.get("id", "family"))

    nodes = []

    def walk(n, t, parent):
        n["tier"], n["parent"], n["kids"] = t, parent, n.get("children", [])
        n["twig"] = parent is not None and len(n["ids"]) == 1 and not n["kids"]
        nodes.append(n)
        for k in n["kids"]:
            walk(k, t + 1, n)

    walk(root, 0, None)
    depth = max(n["tier"] for n in nodes) + 1
    tier_y = lambda t: P["lowest"] + (depth - 1 - t) * P["gap"]
    pin_y = lambda t: tier_y(t) + P["pin_lift"]
    if P["cascade"]:
        R = lambda t: P["R0"] if t == 0 else P["R1"] + P["Rstep"] * (t - 1) ** P["Rpow"]
    else:
        R = lambda t: P["dome"][0] - P["dome"][1] * ((depth - 1 - t) / max(1, depth - 1) - P["dome"][2]) ** 2
    f0 = lambda n: P["fork_root"] if n is root else P["fork"]
    card_a = layout(root, R)

    # trunk: as in direction A. A child of the founders and all its descendants leave at one height.
    braids = [n for n in nodes if not n["twig"]]
    tops = [n for n in root["kids"] if not n["twig"]]
    root["y_dep"] = tier_y(0) - P["rise0"]
    for k, n in enumerate(tops):
        n["y_dep"] = tier_y(1) - P["rise1"] - P["stagger"] * ((2 * k) % 3) / 2
    for n in braids:
        top = n
        while top["parent"] is not None and top["parent"] is not root:
            top = top["parent"]
        n["top"] = top
        n["y_dep"] = top["y_dep"]
    if not P["cascade"]:  # every couple leaves on its own; with children it starts low enough for their twigs
        for n in braids:
            n["top"] = n
            if n is not root:
                rise = P["rise_kids"] if n["kids"] else P["rise1"]
                n["y_dep"] = max(P["y0"] + 1.5, tier_y(n["tier"]) - rise - P["stagger"] * Rng(n["ids"][0])())
    outer = sorted([n for n in braids if n is not root], key=lambda n: (n["top"]["a"], n["a"]))
    cnt = len(outer)
    want = [n["top"]["a"] - P["swirl"] - P["omega"] * (n["y_dep"] - P["yref"]) for n in outer]
    off = math.atan2(sum(math.sin(w - k * TAU / cnt) for k, w in enumerate(want)),
                     sum(math.cos(w - k * TAU / cnt) for k, w in enumerate(want))) if cnt else 0
    for k, n in enumerate(outer):
        n["home"], n["rho"] = off + k * TAU / cnt, P["ring"]
    root["home"], root["rho"] = 0.0, 0.0
    for n in braids:
        ax, y = [], P["y0"]
        while y < n["y_dep"] - 1e-6:
            ax.append(dict(p=cyl(n["rho"], n["home"] + P["omega"] * (y - P["yref"]), y), t=-1.0, seg=None))
            y += P["step"]
        n["ax"] = ax

    def members(n):
        """The braids that travel along n's own limb: the couple and every descendant couple."""
        out = [n]
        for k in n["kids"] if P["cascade"] else []:
            if not k["twig"]:
                out += members(k)
        return sorted(out, key=lambda m: m["a"])

    def centerline(n):
        """The limb of couple n, from where it leaves its parents (or the trunk) to its own nest."""
        if "C" in n:
            return n["C"]
        t = n["tier"]
        rB, aB, yB = R(t), n["a"], pin_y(t)
        if n is root:  # up, then out: the crown fork of the founders
            rA, aA, yA = 0.0, aB, n["y_dep"]
            D, H = rB - rA, yB - yA
            ctrl = [(rA, yA), (rA + 0.05 * D, yA + 0.7 * H), (rA + 0.55 * D, yA + 1.02 * H), (rB, yB)]
            ang = lambda s: aB
        elif n["parent"] is root or not P["cascade"]:
            mem = members(n)
            cen = sum((m["ax"][-1]["p"] for m in mem), Vector((0, 0, 0))) / len(mem)
            (rA, aA), yA = polar(cen), cen.z
            D, H = rB - rA, yB - yA
            if P["cascade"]:  # out of the trunk, rising, arching over, arriving slightly downhill
                ctrl = [(rA, yA), (rA + 0.10 * D, yA + 0.62 * H), (rA + 0.55 * D, yB + 1.9), (rB, yB)]
            else:  # an elbow out of the trunk, a long low reach, then the climb to the fork
                ctrl = [(rA, yA), (rA, yA + 1.8), (rA + 0.45 * D, yA + 0.9), (rA + 0.72 * D, yA + 0.72 * H), (rB, yB)]
            ang = lambda s: aA + wrap(aB - aA) * S(s / 0.75)
        else:  # on from the parents' nest, one tier down and further out
            rA, aA, yA = R(t - 1), n["parent"]["a"], pin_y(t - 1)
            D = rB - rA
            ctrl = [(rA, yA), (rA + 0.42 * D, yA - 1.3), (rB - 0.38 * D, yB + 1.3), (rB, yB)]
            ang = lambda s: aA + wrap(aB - aA) * S((s - 0.2) / 0.8)
        cnt = max(24, int((abs(D) + abs(yB - yA)) / 0.35))
        pts = []
        for k in range(cnt + 1):
            r, y = bez(ctrl, k / cnt)
            pts.append(cyl(r, ang(k / cnt), y))
        n["C"] = dict(p=pts, t=[k / cnt for k in range(cnt + 1)], F=frames(pts), arc=arcs(pts))
        return n["C"]

    def offset(n, m, k):
        """The place of braid m in the bundle on n's limb."""
        C, mem = n["C"], members(n)
        if len(mem) == 1:
            return Vector((0, 0, 0))
        rho = P["bundle"] / math.sin(math.pi / len(mem)) * lerp(1.0, 0.8, C["t"][k])
        th = TAU * mem.index(m) / len(mem) + P["bundle_turn"] * C["arc"][k]
        return rho * (math.cos(th) * C["F"][k][0] + math.sin(th) * C["F"][k][1])

    seeds = {}

    def knot(who, s):  # the wood swells and thins a little along its way
        seed = seeds.setdefault(who, Rng("knot" + who)() * TAU)
        return 1 + P["knots"] * (0.6 * math.sin(1.7 * s + seed) + 0.4 * math.sin(4.1 * s + 2 * seed))

    bodies, ends = {}, {}
    for b in braids:
        chain = [b]
        while P["cascade"] and chain[0]["parent"] is not None and chain[0]["parent"] is not root:
            chain.insert(0, chain[0]["parent"])
        ax = b["ax"]
        for seg in chain:
            C, own = centerline(seg), seg is b
            raw = []
            for k in range(len(C["p"])):
                o = offset(seg, b, k)
                if own:  # the couple leaves the bundle for its nest
                    o = o * (1 - S((C["t"][k] - f0(b)) / (1 - f0(b))))
                raw.append(C["p"][k] + o)
            corr = ax[-1]["p"] - raw[0]  # no jump where the trunk or the previous limb hands over
            ph = Rng("sway" + b["ids"][0])
            p1, p2 = ph() * TAU, ph() * TAU
            for k in range(1, len(raw)):
                s = C["t"][k]
                sway = P["wobble"] * S(s / 0.3) * S((1 - s) / 0.25) if own else 0.0  # none in the trunk, none at the cards
                bend = sway * (math.sin(0.8 * C["arc"][k] + p1) * C["F"][k][0] + math.sin(1.25 * C["arc"][k] + p2) * C["F"][k][1])
                ax.append(dict(p=raw[k] + corr * (1 - S(s / 0.4)) + bend, t=s if own else -1.0, seg=seg))
        axp = [a["p"] for a in ax]
        F, arc = frames(axp), arcs(axp)
        b["arc"] = arc
        t, ids = b["tier"], b["ids"]
        for i, pid in enumerate(ids):
            d = wrap(card_a[pid] - b["a"])
            pts = []
            for k, a in enumerate(ax):
                r = P["sr"] * lerp(1.0, P["thin"], (arc[k] / arc[-1]) ** 1.15) * knot(pid, arc[k])
                amp = P["wind"] * r * (1.0 if len(ids) > 1 else 0.15)
                turn = TAU * i / len(ids) + TAU * (arc[k] + P["y0"]) / P["turn"]
                delta = 0.0
                if a["t"] > f0(b):  # the two strands part and reach for their cards
                    amp *= 1 - S((a["t"] - f0(b)) / P["fork_len"])
                    delta = d * S((a["t"] - f0(b)) / (1 - f0(b)))
                p = a["p"] + amp * (math.cos(turn) * F[k][0] + math.sin(turn) * F[k][1])
                if delta:
                    p = Matrix.Rotation(delta, 3, "Z") @ p
                pts.append((p, r, 0.0))
            end = pts[-1][1]
            tip = [(cyl(R(t) + dr, card_a[pid], pin_y(t) + dy), rf * end, 0.0) for dr, dy, rf in P["tip"]]
            bodies[pid] = join_suffix(pts, tip)
            if t == 0 or R(t) >= R(t - 1):  # nobody's card hangs right above this end
                ends[pid] = ([q[0] for q in pts], P["root_len"] + arc[-1] * 1.08)

    # roots: every strand grips the hill, spread evenly around (as in direction A)
    ids = list(bodies)
    base = {i: polar(bodies[i][0][0]) for i in ids}
    order = sorted(ids, key=lambda i: base[i][1])
    cnt = len(order)
    off = math.atan2(sum(math.sin(base[i][1] - k * TAU / cnt) for k, i in enumerate(order)),
                     sum(math.cos(base[i][1] - k * TAU / cnt) for k, i in enumerate(order)))
    for k, i in enumerate(order):
        r0, a0 = base[i]
        target, sr = off + k * TAU / cnt, bodies[i][0][1]
        pre = []
        for dr, h, rf in [(9.0, -0.9, 0.08), (7.0, -0.25, 0.34), (5.0, 0.1, 0.6), (3.0, 0.4, 0.9), (1.5, 1.0, 1.22), (0.5, 1.85, 1.15)]:
            r = r0 + dr
            a = a0 + wrap(target - a0) * S(dr / 3.0) + 0.1 * math.sin(dr * 0.8 + k * 2.4) * S(dr / 2)
            pre.append((cyl(r, a, hill(r) + h), sr * rf, 0.0))
        bodies[i] = join_prefix(pre, bodies[i])
    first = None
    for i in ids:
        o = wood(c, "Strand_" + i, bodies[i], mat, 0.0, i)
        first = first or o

    # twigs: a childless single is a thin branch out of its parents' braid
    for w in [n for n in nodes if n["twig"]]:
        par, t = w["parent"], w["tier"]
        ax = par["ax"]
        rE, aE, yE = R(t), w["a"], pin_y(t)
        if par is root:  # out of the leader, up then out, as in direction A
            idx = [i for i, a in enumerate(ax) if a["seg"] is None]
            i0 = min(idx, key=lambda i: abs(ax[i]["p"].z - (yE - P["twig_rise"])))
            s = ax[i0]["p"]
            r0, a0 = polar(s)
            a0 = aE if r0 < 0.5 else a0
            D, H = rE - r0, yE - s.z
            ctrl = [(r0, s.z), (r0 + 0.05 * D, s.z + 0.7 * H), (r0 + 0.55 * D, s.z + 1.02 * H), (rE, yE)]
            ang = lambda u: a0 + wrap(aE - a0) * S(u / 0.6)
            tips = P["twig_tip_up"]
        elif not P["cascade"]:  # peels off the low part of the parents' limb and reaches out below their cards
            rank = [k for k in par["kids"] if k["twig"]].index(w)
            idx = [i for i, a in enumerate(ax) if a["seg"] is par and a["t"] >= 0.2 and a["p"].z <= yE - 1.0]
            i0 = (idx[-1] if idx else next(i for i, a in enumerate(ax) if a["seg"] is par and a["t"] >= 0.3)) - 2 * rank
            s = ax[i0]["p"]
            r0, a0 = polar(s)
            D, H = rE - r0, yE - s.z
            ctrl = [(r0, s.z), (r0 + 0.4 * D, s.z + 0.1 * H), (rE - 0.3 * D, yE - 0.35), (rE, yE)]
            ang = lambda u: a0 + wrap(aE - a0) * S(u / 0.75)
            tips = P["twig_tip_up"]
        else:  # leaves just before the nest, runs on between the parents' cards and hangs down
            sibs = [k for k in par["kids"] if k["twig"]]
            rank = sibs.index(w)
            aP = par["a"] + (rank - (len(sibs) - 1) / 2) * 0.5 / rE  # the middle of the nest, twigs side by side
            i0 = max(i for i, a in enumerate(ax) if a["seg"] is par and a["t"] <= f0(par) - 0.02) - 2 * rank
            s = ax[i0]["p"]
            r0, a0 = polar(s)
            pr = polar(ax[i0 - 3]["p"])[0]
            slope = min(0.3, max(-1.6, (s.z - ax[i0 - 3]["p"].z) / max(0.05, r0 - pr)))
            D, H = rE - r0, s.z - yE
            ctrl = [(r0, s.z), (r0 + 0.45 * D, s.z + 0.45 * D * slope), (rE - 0.12 * D, yE + 0.34 * H), (rE, yE)]
            ang = lambda u: a0 + wrap(aP - a0) * S(u / 0.3) + wrap(aE - aP) * S((u - 0.5) / 0.5)
            tips = P["twig_tip_hang"]
        tr = P["twig_r"] if P["cascade"] or par is root else 0.2 + 0.012 * (rE - r0)  # long reaches are sturdier
        pts = [(ax[i]["p"], tr * lerp(0.3, 1.0, (i - i0 + 5) / 5), 0.0) for i in range(i0 - 5, i0)]
        for k in range(41):
            u = k / 40
            r, y = bez(ctrl, u)
            pts.append((cyl(r, ang(u), y), tr * lerp(1.0, 0.42, u), 0.0))
        end = pts[-1][1]
        tip = [(cyl(rE + dr, aE, yE + dy), rf * end, 0.0) for dr, dy, rf in tips]
        wood(c, "Twig_" + w["ids"][0], join_suffix(pts, tip), mat, P["root_len"] + par["arc"][i0 - 5] * 1.08, w["ids"][0])

    # cards (placeholders) and their threads
    for n in nodes:
        for pid in n["ids"]:
            t = n["tier"]
            top = cyl(R(t), card_a[pid], tier_y(t) - P["drop"])
            card(c, "Card_" + pid, top, cmat, pid)
            th = strand(c, "Thread_" + pid, [(cyl(R(t), card_a[pid], pin_y(t)), P["thread_r"], 0), (top, P["thread_r"], 0)], tmat, res=2)
            th["who"] = pid

    # ---------- free branches: seeded, no cards, always up and out ----------
    def shoot(start, heading, Lh, Lv, prof, bend, wob, r0):
        cnt = max(8, int((Lh + Lv) / 0.45))
        pos, out, ph, hp = Vector((start.x, start.y, 0)), [], rng() * TAU, 0.0
        for k in range(1, cnt + 1):
            s = k / cnt
            h, v = bez(prof, s)
            a = heading + bend * s
            pos = pos + Vector((math.sin(a), -math.cos(a), 0)) * (h - hp) * Lh
            hp = h
            q = pos + Vector((math.cos(a), math.sin(a), 0)) * wob * math.sin(ph + 5 * s) * s
            out.append((Vector((q.x, q.y, start.z + v * Lv)), r0 * lerp(1.0, 0.16, s**0.9), 0.0))
        return out

    def free(name, host, i0, heading, Lh, Lv, prof, bend, wob, r0, subs, t0, pre=None):
        """`subs` = how many side branches per level, e.g. (2, 1). `pre` = an own way up to the start."""
        start = pre[-1][0] if pre else host[i0]
        if pre is None:
            lo = max(0, i0 - 5)
            pre = [(host[i], r0 * lerp(0.3, 1.0, (i - lo) / 5), 0.0) for i in range(lo, i0)]
        body = shoot(start, heading, Lh, Lv, prof, bend, wob, r0)
        wood(cf, "Free_" + name, pre + body, mat, t0)
        pts = [q[0] for q in body]
        for j in range(subs[0] if subs else 0):
            k0 = int(len(pts) * rng.between(0.35, 0.7))
            side = 1 if rng() < 0.5 else -1
            f = rng.between(0.42, 0.6)
            free(name + "." + str(j + 1), pts, k0, heading + bend * k0 / len(pts) + side * rng.between(0.5, 0.95),
                 Lh * f, Lv * f, PROF_SPRIG, side * 0.3, wob * 0.5, r0 * 0.55, subs[1:], t0 + arcs(pts[: k0 + 1])[-1])

    rax = [a["p"] for a in root["ax"]]
    rF = frames(rax)
    crotch = max((n["y_dep"] for n in braids if n is not root), default=root["y_dep"] - 6)
    t_of = lambda i: P["root_len"] + root["arc"][i] * 1.08
    # 1. crown: branches rising from the leader above the main fork, never into the front window
    lead = [i for i, a in enumerate(root["ax"]) if a["p"].z > crotch + 1.5 and a["t"] < 0.15]
    busy = [(n["a"] - P["swirl"] - 0.35, n["a"] + 0.35) for n in tops if P["cascade"]] + [(n["a"] - 0.3, n["a"] + 0.3) for n in root["kids"] if n["twig"]]
    for j in range(P["crown"] if lead else 0):
        a = P["crown_free"] + (j + 0.5 + 0.5 * (rng() - 0.5)) / P["crown"] * (TAU - 2 * P["crown_free"])
        i0 = lead[int(rng() * len(lead))]
        if any(wrap(a - lo) > 0 and wrap(a - hi) < 0 for lo, hi in busy):  # start above the limb that lives here
            high = [i for i in lead if rax[i].z >= pin_y(1) - 0.6]
            i0 = high[int(rng() * len(high))] if high else lead[-1]
        L = rng.between(7.0, 10.5) if P["cascade"] else rng.between(8.0, 12.0)
        pre, t0 = None, t_of(i0)
        if P["wrap"]:  # up through the trunk and around the leader, leaving on the side it heads for
            low = min(n["y_dep"] for n in braids if n is not root)
            i1 = max(0, min(i0 - 12, next(i for i, q in enumerate(rax) if q.z >= low + 1.0)))
            pre, t0 = [], t_of(i1)
            for i in range(i1, i0 + 1):
                f = S((i - i1) / 10)
                th = a - 0.2 - math.pi / 2 + 0.45 * (root["arc"][i] - root["arc"][i0])
                pre.append((rax[i] + P["wrap"] * f * (math.cos(th) * rF[i][0] + math.sin(th) * rF[i][1]), P["crown_r"] * lerp(0.3, 1.0, f), 0.0))
        free("Crown%d" % (j + 1), rax, i0, a - 0.2, (0.72 if P["cascade"] else 0.8) * L, 0.72 * L, PROF_CROWN, 0.4, 0.5,
             P["crown_r"], (2, 1), t0, pre)
    # 2. fillers: a limb without cards in every wide gap between the founders' children
    blocks = sorted([(-P["front"], P["front"])] + [(n["a"] - n["w"] / 2, n["a"] + n["w"] / 2) for n in root["kids"]])
    for j, (lo, hi) in enumerate(blocks):
        nxt = blocks[(j + 1) % len(blocks)][0] + (TAU if j + 1 == len(blocks) else 0)
        for k in range(int((nxt - hi) / 0.9)):
            a = hi + (k + 1) * (nxt - hi) / (int((nxt - hi) / 0.9) + 1)
            i0 = min(range(len(rax)), key=lambda i: abs(rax[i].z - (crotch - rng.between(1.0, 3.0))))
            free("Fill%d_%d" % (j + 1, k + 1), rax, i0, a - 0.3, rng.between(9, 12), rng.between(5.5, 7.5), PROF_FILL,
                 0.45, 0.6, 0.38, (2, 1), t_of(i0))
    # 3. sprigs: short shoots on the upper side of the family limbs, away from the nests
    for n in braids:
        if n is root:
            continue
        ax = n["ax"]
        lo, hi = (0.12, 0.5) if P["cascade"] else (0.3, 0.6)
        cand = [i for i, a in enumerate(ax) if a["seg"] is n and lo <= a["t"] <= hi]
        cnt = 3 if n["parent"] is root else 2
        up = P["cascade"] or n["parent"] is root  # under another limb a shoot goes sideways, not up
        for j in range(cnt):
            i0 = cand[int((j + rng.between(0.2, 0.8)) / cnt * len(cand))]
            hd = ax[i0 + 2]["p"] - ax[i0 - 2]["p"]
            L, side = rng.between(2.6, 4.6), (1 if (j + n["tier"]) % 2 else -1)
            turn = side * (rng.between(0.5, 1.0) if up else rng.between(0.9, 1.3))
            free("Sprig_%s%d" % (n["ids"][0], j + 1), [a["p"] for a in ax], i0, math.atan2(hd.x, -hd.y) + turn,
                 (0.5 if up else 0.9) * L, (0.85 if up else 0.35) * L, PROF_SPRIG if up else PROF_SIDE,
                 side * 0.3, 0.25, 0.14, (1,) if L > 3.8 else (), P["root_len"] + n["arc"][i0] * 1.08)
    # 4. twiglets: where a card hangs, the wood runs on into a fine shoot that points up
    for pid, (pts, t0) in ends.items() if P["twiglets"] else []:
        side = 1 if rng() < 0.5 else -1
        L = rng.between(2.0, 3.4)
        free("Tip_" + pid, pts, len(pts) - 1, card_a[pid] + side * rng.between(0.4, 0.9), 0.75 * L, 0.6 * L, PROF_SPRIG,
             side * 0.3, 0.2, 0.11, (), t0)

    bark(uv_along(first))  # now that a strand exists, point the bark along the wood
    return dict(objects=len(c.all_objects), free=len(cf.objects), cards={k: round(v, 3) for k, v in card_a.items()},
                tiers={t: (round(R(t), 1), round(tier_y(t), 1)) for t in range(depth)})


def grow(key="D", frames=220):
    """Growth as an animation: every piece opens from its base at one common speed, late pieces wait
    until the wood they sit on has arrived. Not rendered, just for scrubbing the timeline."""
    sc = bpy.context.scene
    pieces = [o for o in bpy.data.collections[VARIANTS[key]["name"]].all_objects if "grow_len" in o]
    speed = max(o["grow_t0"] + o["grow_len"] for o in pieces) / (frames - 20)
    edit = bpy.context.preferences.edit
    old, edit.keyframe_new_interpolation_type = edit.keyframe_new_interpolation_type, "LINEAR"
    for o in pieces:
        cu = o.data
        cu.bevel_factor_mapping_end = "SPLINE"
        for value, at in ((0.0, o["grow_t0"]), (1.0, o["grow_t0"] + o["grow_len"])):
            cu.bevel_factor_end = value
            cu.keyframe_insert("bevel_factor_end", frame=1 + at / speed)
    edit.keyframe_new_interpolation_type = old
    sc.frame_start, sc.frame_end = 1, frames
    sc.frame_set(frames)
    return len(pieces)


def check(key="D"):
    """Numbers instead of pictures: kinks, pieces that end in the air, wood too close to a card."""
    c = bpy.data.collections[VARIANTS[key]["name"]]
    objs = list(c.all_objects)
    woods = [o for o in objs if "grow_len" in o]
    cards = [o for o in objs if o.type == "MESH"]
    rep = dict(objects=len(objs), wood=len(woods), cards=len(cards), kinks=[], near=[], steps=[], extent={})
    data = {}
    for o in woods:
        pts = [(Vector(p.co[:3]), p.radius) for p in o.data.splines[0].points]
        data[o.name] = (pts, o["who"])
        worst = 0.0
        for i in range(1, len(pts) - 1):
            a, b = pts[i][0] - pts[i - 1][0], pts[i + 1][0] - pts[i][0]
            if a.length > 1e-6 and b.length > 1e-6:
                worst = max(worst, math.degrees(a.angle(b)))
        if worst > 25:
            rep["kinks"].append((o.name, round(worst)))
        far = max((pts[i][0] - pts[i - 1][0]).length for i in range(1, len(pts)))
        if far > 0.45:
            rep["steps"].append((o.name, round(far, 2)))
    allp = [p for pts, _ in data.values() for p, _ in pts]
    rep["extent"] = dict(r=round(max(math.hypot(p.x, p.y) for p in allp), 1), top=round(max(p.z for p in allp), 1),
                         bottom=round(min(p.z for p in allp), 1))
    for cd in cards:
        x, y, top = cd.location
        for name, (pts, who) in data.items():
            if who == cd["who"]:
                continue
            d = min((math.hypot(p.x - x, p.y - y) - r for p, r in pts if top - CARD_H - 0.2 < p.z < top + 0.1), default=9)
            if d < 1.8:
                rep["near"].append((cd.name, name, round(d, 2)))
    return rep
