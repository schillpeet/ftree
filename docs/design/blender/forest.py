# The forest ring's trees for ftree's clearing: four tall slim conifers, baked into one billboard atlas.
# See README.md in this folder, "Forest ring billboards".
# Run inside Blender (Scripting tab or the Blender MCP), or without a window:
#   HERE = "<repo>/docs/design/blender"; exec(open(HERE + "/forest.py").read())
#   setup(); build_all()                                  # the four trees side by side, 20 m apart
#   preview(HERE + "/forest-preview.jpg")                 # quick renders to judge form and colour
#   bake(HERE + "/../../../ui/app/forest")                # ring-color.png, ring-normal.png, ring.json
#   Blender -b --factory-startup --python-expr 'HERE="..."; exec(open(HERE+"/forest.py").read()); setup(); build_all(); bake(HERE+"/../../../ui/app/forest")'
# Every tree is a rule seeded by its number, so a run always gives the same trees.
# The app (ui/app/ForestRing.tsx) shows each tree as a quad that turns around its trunk toward the camera; the camera
# stays inside the clearing, so one view from the front is all a tree needs.
import bpy, bmesh, json, math, random
from mathutils import Vector, Matrix, noise

HERE = globals().get("HERE") or __import__("os").path.dirname(bpy.data.filepath)
TAU = math.tau

# The four trees (chosen shape 2026-11-17, image A of docs/design/visions): a bare straight trunk up to `crown` of the
# height, then a narrow crown `width` × height wide of irregular tufts that tapers to the tip. `ragged` is how far the
# tufts stand apart and how much their branches differ; `lean` tilts the trunk a little sideways (radians).
TREES = [
    dict(height=30.0, crown=0.45, width=0.40, ragged=0.55, lean=0.010, tint=(0.0, 0.0), seed=1),
    dict(height=31.0, crown=0.50, width=0.35, ragged=0.35, lean=-0.006, tint=(0.015, -0.01), seed=2),
    dict(height=29.0, crown=0.40, width=0.45, ragged=0.9, lean=0.004, tint=(-0.01, 0.01), seed=3),
    dict(height=32.0, crown=0.52, width=0.38, ragged=0.7, lean=-0.014, tint=(0.01, 0.0), seed=4),
]
SPACING = 20.0  # metres between the trees in the scene; the bake renders each alone

# Colours in sRGB, muted: the app's blue-grey haze and the sun do the rest.
BARK_DARK, BARK_LIGHT = "#35302b", "#5a534c"
CLUMP = "#1c2117"
NEEDLE_DARK, NEEDLE_LIGHT = "#272d20", "#454b36"

# The atlas: four cells of 1024 × 2048 side by side; the foot sits FOOT_Y pixels from the cell's top and the tree's
# top on the cell's top edge, so a tree is FOOT_Y / height pixels per metre.
CELL_W, CELL_H, FOOT_Y = 1024, 2048, 2040
MIXES = {}  # per material its switch between colour (0) and normal (1)


def srgb(hexcode):
    c = [int(hexcode[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c) + (1.0,)


def material(name, color, ao_distance):
    """Emission of colour times ambient occlusion (no light is baked), switchable to the normal in the camera's frame.
    The camera looks along +Y, so the image's right is +X, its up +Z and toward the camera -Y."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    col = color(nt)
    ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
    ao.samples = 16
    ao.inputs["Distance"].default_value = ao_distance
    nt.links.new(col, ao.inputs["Color"])
    em_c = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(ao.outputs["Color"], em_c.inputs["Color"])
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(nt.nodes.new("ShaderNodeNewGeometry").outputs["Normal"], sep.inputs[0])
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    for src, dst, sign in (("X", "X", 1), ("Z", "Y", 1), ("Y", "Z", -1)):
        mad = nt.nodes.new("ShaderNodeMath")
        mad.operation = "MULTIPLY_ADD"
        mad.inputs[1].default_value, mad.inputs[2].default_value = 0.5 * sign, 0.5
        nt.links.new(sep.outputs[src], mad.inputs[0])
        nt.links.new(mad.outputs[0], comb.inputs[dst])
    em_n = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(comb.outputs[0], em_n.inputs["Color"])
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(em_c.outputs[0], mix.inputs[1])
    nt.links.new(em_n.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], nt.nodes.new("ShaderNodeOutputMaterial").inputs["Surface"])
    MIXES[name] = mix
    return m


def ramp(nt, fac, a, b):
    r = nt.nodes.new("ShaderNodeValToRGB")
    r.color_ramp.elements[0].color, r.color_ramp.elements[1].color = srgb(a), srgb(b)
    nt.links.new(fac, r.inputs[0])
    return r.outputs[0]


def bark_color(nt):
    """Grey-brown bark with long vertical streaks."""
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (7, 7, 0.5)
    nt.links.new(nt.nodes.new("ShaderNodeTexCoord").outputs["Object"], mp.inputs[0])
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value, nz.inputs["Detail"].default_value = 2.0, 6.0
    nt.links.new(mp.outputs[0], nz.inputs["Vector"])
    return ramp(nt, nz.outputs["Fac"], BARK_DARK, BARK_LIGHT)


def needle_color(tint):
    """Every needle spray gets its own shade between dark and light olive; `tint` shifts a tree warmer or greener."""
    def build(nt):
        rnd = nt.nodes.new("ShaderNodeObjectInfo").outputs["Random"]
        col = ramp(nt, rnd, NEEDLE_DARK, NEEDLE_LIGHT)
        hsv = nt.nodes.new("ShaderNodeHueSaturation")
        hsv.inputs["Hue"].default_value = 0.5 + tint[0]
        hsv.inputs["Value"].default_value = 1.0 + tint[1] * 3
        nt.links.new(col, hsv.inputs["Color"])
        return hsv.outputs[0]
    return build


def flat_color(hexcode):
    def build(nt):
        rgb = nt.nodes.new("ShaderNodeRGB")
        rgb.outputs[0].default_value = srgb(hexcode)
        return rgb.outputs[0]
    return build


def needles_group(name, mat):
    """Geometry nodes: scatter small needle sprays (thin cones along the surface normal, a little tilted) over the
    crown's clumps, so the crown's edge is fine and fuzzy instead of blobby."""
    ng = bpy.data.node_groups.get(name)
    if ng:
        bpy.data.node_groups.remove(ng)
    ng = bpy.data.node_groups.new(name, "GeometryNodeTree")
    ng.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    n, link = ng.nodes, ng.links.new
    gin, gout = n.new("NodeGroupInput"), n.new("NodeGroupOutput")
    dist = n.new("GeometryNodeDistributePointsOnFaces")
    dist.inputs["Density"].default_value = 45.0
    dist.inputs["Seed"].default_value = 7
    link(gin.outputs[0], dist.inputs["Mesh"])
    cone = n.new("GeometryNodeMeshCone")
    cone.inputs["Vertices"].default_value = 5
    cone.inputs["Radius Top"].default_value = 0.0
    cone.inputs["Radius Bottom"].default_value = 0.05
    cone.inputs["Depth"].default_value = 0.32
    lift = n.new("GeometryNodeTransform")
    lift.inputs["Translation"].default_value = (0, 0, 0.1)  # mostly outside the clump
    link(cone.outputs["Mesh"], lift.inputs["Geometry"])
    smooth = n.new("GeometryNodeSetShadeSmooth")
    link(lift.outputs[0], smooth.inputs["Geometry"])
    setm = n.new("GeometryNodeSetMaterial")
    link(smooth.outputs[0], setm.inputs["Geometry"])
    setm.inputs["Material"].default_value = mat
    inst = n.new("GeometryNodeInstanceOnPoints")
    link(dist.outputs["Points"], inst.inputs["Points"])
    link(setm.outputs[0], inst.inputs["Instance"])
    link(dist.outputs["Rotation"], inst.inputs["Rotation"])
    scale = n.new("FunctionNodeRandomValue")
    scale.data_type = "FLOAT"
    scale.inputs["Min"].default_value, scale.inputs["Max"].default_value = 0.6, 1.4
    link(scale.outputs["Value"], inst.inputs["Scale"])
    tilt = n.new("FunctionNodeRandomValue")
    tilt.data_type = "FLOAT_VECTOR"
    tilt.inputs["Min"].default_value, tilt.inputs["Max"].default_value = (-0.9, -0.9, -3.1), (0.9, 0.9, 3.1)
    rot = n.new("GeometryNodeRotateInstances")
    link(inst.outputs[0], rot.inputs["Instances"])
    link(tilt.outputs["Value"], rot.inputs["Rotation"])
    rot.inputs["Local Space"].default_value = True
    join = n.new("GeometryNodeJoinGeometry")
    link(rot.outputs[0], join.inputs[0])
    link(gin.outputs[0], join.inputs[0])
    link(join.outputs[0], gout.inputs[0])
    return ng


def setup():
    """A fresh scene "Forest" with Cycles, a transparent film, the standard view transform and no lights."""
    sc = bpy.data.scenes.get("Forest") or bpy.data.scenes.new("Forest")
    if bpy.context.window_manager.windows:
        bpy.context.window_manager.windows[0].scene = sc
    sc.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = "GPU"
    except Exception:
        sc.cycles.device = "CPU"
    sc.cycles.samples, sc.cycles.use_denoising = 64, False
    sc.cycles.filter_width = 1.2
    sc.render.film_transparent = True
    sc.view_settings.view_transform, sc.view_settings.look = "Standard", "None"
    sc.view_settings.exposure, sc.view_settings.gamma = 0.0, 1.0
    w = bpy.data.worlds.get("Forest") or bpy.data.worlds.new("Forest")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.0
    sc.world = w
    MIXES.clear()
    return sc


def scene():
    return bpy.data.scenes["Forest"]


def tree_mesh(t):
    """Trunk, dead stubs and branches as one mesh, the crown's clumps as another. The tree stands at the origin."""
    rnd = random.Random(t["seed"])
    H = t["height"]
    base_r = 0.018 * H
    lean = Vector((math.sin(t["lean"]), 0, math.cos(t["lean"])))

    def axis(z):  # the trunk's centre at height z: leaning, with a slow wobble
        return Vector((lean.x * z + 0.08 * math.sin(z * 0.4 + t["seed"]), 0.06 * math.sin(z * 0.33 + 2 * t["seed"]), z))

    wood = bmesh.new()
    # Trunk: a tube that flares at the foot and tapers to the tip, 0.3 m into the ground.
    sides, rings = 14, 60
    for i in range(rings + 1):
        z = -0.3 + (H + 0.3) * i / rings
        u = max(z, 0) / H
        r = base_r * (1 - u) ** 0.85 + 0.03 + base_r * 1.2 * max(0, 1 - z / 1.4) ** 2
        c = axis(z)
        for k in range(sides):
            a = TAU * k / sides
            bump = 1 + 0.06 * noise.noise(Vector((math.cos(a) * 2, math.sin(a) * 2, z * 0.7)))
            wood.verts.new(c + Vector((math.cos(a), math.sin(a), 0)) * r * bump)
    wood.verts.ensure_lookup_table()
    for i in range(rings):
        for k in range(sides):
            a, b = i * sides + k, i * sides + (k + 1) % sides
            wood.faces.new((wood.verts[a], wood.verts[b], wood.verts[b + sides], wood.verts[a + sides]))

    def twig(p, d, length, r0, r1, segs=6):
        d = d.normalized()
        m = Matrix.Translation(p + d * length / 2) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
        bmesh.ops.create_cone(wood, cap_ends=False, segments=segs, radius1=r0, radius2=r1, depth=length, matrix=m)

    def out(a, droop):
        return Vector((math.cos(a) * math.cos(droop), math.sin(a) * math.cos(droop), -math.sin(droop)))

    zc = H * t["crown"]
    # Dead branch stubs on the bare trunk, more of them close to the crown.
    for _ in range(int(10 + 8 * t["ragged"])):
        z = zc * (0.35 + 0.65 * rnd.random() ** 0.6)
        a = rnd.random() * TAU
        twig(axis(z), out(a, math.radians(rnd.uniform(-5, 35))), rnd.uniform(0.4, 1.6), 0.06, 0.01, 5)

    clumps = bmesh.new()

    def clump(p, size, d):
        """An ellipsoid clump, long along its branch, flat from above, with a lumpy surface."""
        side = Vector((-d.y, d.x, 0)).normalized()
        up = d.cross(side).normalized()
        if up.z < 0:
            up = -up
        basis = Matrix((d * 1.05, side * 0.9, up * 0.72)).transposed().to_4x4()
        m = Matrix.Translation(p) @ basis @ Matrix.Scale(size, 4)
        made = bmesh.ops.create_icosphere(clumps, subdivisions=2, radius=1.0, matrix=m)
        seed = Vector((rnd.random(), rnd.random(), rnd.random())) * 100
        for v in made["verts"]:
            off = v.co - p
            v.co = p + off * (1 + 0.5 * noise.noise(off * 1.6 + seed) + 0.2 * noise.noise(off * 4.0 + seed))
        for f in clumps.faces:
            f.smooth = True

    # Crown: tufts stacked up the trunk. A ragged tree has fewer, more distinct tufts with gaps between them.
    def profile(u):  # crown radius over its height (u 0 at the crown's start, 1 at the tip): a column, round on top
        return 0.6 + 0.4 * u / 0.15 if u < 0.15 else 1.0 if u < 0.5 else ((1 - u) / 0.5) ** 0.75

    R = t["width"] * H / 2
    z = zc
    golden = TAU * 0.381966
    a = rnd.random() * TAU
    while z < H - 0.6:
        u = (z - zc) / (H - zc)
        tuft = rnd.uniform(0.8, 1.6) * (1 - 0.4 * u)  # height of one tuft
        count = max(2, int(rnd.uniform(3, 6) * (1 - 0.4 * u)))
        for j in range(count):
            zb = z + tuft * j / count + rnd.uniform(-0.15, 0.15)
            ub = min(max((zb - zc) / (H - zc), 0), 1)
            a += golden + rnd.uniform(-0.5, 0.5)
            length = R * profile(ub) * rnd.uniform(1 - 0.6 * t["ragged"], 1.0 + 0.1 * t["ragged"])
            if length < 0.4:
                continue
            droop = math.radians(rnd.uniform(-12, 22) + 12 * (1 - ub))
            d = out(a, droop)
            p0 = axis(zb)
            twig(p0, d, length, 0.09 * (1 - ub) + 0.03, 0.015)
            # Clumps along the outer part of the branch, the biggest in the middle, a little hanging.
            k_n = max(1, int(length / 0.8) + 1)
            for k in range(k_n):
                f = 0.3 + 0.7 * (k + 0.5) / k_n
                size = (0.6 + 0.4 * math.sin(math.pi * f)) * min(1.0, 0.4 + 0.2 * length) * rnd.uniform(0.7, 1.1)
                p = p0 + d * length * f + Vector((0, 0, -0.15 * size + rnd.uniform(-0.3, 0.3)))
                p += Vector((-d.y, d.x, 0)) * rnd.uniform(-0.35, 0.35) * size
                clump(p, size, d)
                if rnd.random() < 0.5:  # a smaller clump beside it breaks the pad's outline
                    q = p + Vector((rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6), rnd.uniform(-0.5, 0.35))) * size
                    clump(q, size * rnd.uniform(0.45, 0.7), d)
        # A gap of bare trunk between tufts; the more ragged, the larger.
        z += tuft + rnd.uniform(0.2, 0.5) + t["ragged"] * rnd.uniform(0.3, 1.8) * (1 - 0.6 * u)
    # The leader: small clumps up the last metres, so the tip is a point, not a cut.
    for k in range(5):
        zt = H - 2.6 + k * 0.5
        clump(axis(zt) + Vector((rnd.uniform(-0.1, 0.1), 0, 0)), 0.55 - 0.08 * k, out(rnd.random() * TAU, 0.4))
    return wood, clumps


def build(i):
    """Build tree i (0..3) into its own collection, at x = i × SPACING."""
    sc = scene()
    t = TREES[i]
    name = "Ring_%d" % (i + 1)
    old = bpy.data.collections.get(name)
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o)
        bpy.data.collections.remove(old)
    c = bpy.data.collections.new(name)
    sc.collection.children.link(c)
    wood_bm, clump_bm = tree_mesh(t)
    bark = material("Forest_bark", bark_color, 0.6)
    inner = material("Forest_clump", flat_color(CLUMP), 1.2)
    needles = material("Forest_needles_%d" % (i + 1), needle_color(t["tint"]), 1.2)
    objs = []
    for part, bm, mat in (("wood", wood_bm, bark), ("crown", clump_bm, inner)):
        me = bpy.data.meshes.new("%s_%s" % (name, part))
        bm.to_mesh(me)
        bm.free()
        me.materials.append(mat)
        if part == "wood":
            for p in me.polygons:
                p.use_smooth = True
        ob = bpy.data.objects.new(me.name, me)
        ob.location.x = i * SPACING
        c.objects.link(ob)
        objs.append(ob)
    mod = objs[1].modifiers.new("Needles", "NODES")
    mod.node_group = needles_group(name + "_needles", needles)
    return c


def build_all():
    for i in range(len(TREES)):
        build(i)


def top_of(i):
    """The highest point of tree i above its foot, after the needles, in metres."""
    dg = bpy.context.evaluated_depsgraph_get()
    top = 0.0
    for o in bpy.data.collections["Ring_%d" % (i + 1)].objects:
        ev = o.evaluated_get(dg)
        for corner in ev.bound_box:
            top = max(top, (ev.matrix_world @ Vector(corner)).z)
    return top


def render_cell(i, path, normal, scale=1.0, samples=64):
    """Render tree i alone into one cell: orthographic, looking along +Y at the tree, foot FOOT_Y px from the top
    and the top of the tree on the cell's top edge. Writes a float EXR with premultiplied alpha."""
    sc = scene()
    for j in range(len(TREES)):
        col = bpy.data.collections.get("Ring_%d" % (j + 1))
        if col:
            col.hide_render = j != i
    for mix in MIXES.values():
        mix.inputs[0].default_value = 1.0 if normal else 0.0
    H = TREES[i]["height"]
    mpp = H / FOOT_Y  # metres per pixel
    cam = bpy.data.objects.get("Forest_cam") or bpy.data.objects.new("Forest_cam", bpy.data.cameras.new("Forest_cam"))
    if cam.name not in sc.collection.objects:
        sc.collection.objects.link(cam)
    cam.data.type, cam.data.ortho_scale = "ORTHO", CELL_H * mpp
    cam.data.clip_start, cam.data.clip_end = 0.1, 400
    cam.rotation_euler = (math.pi / 2, 0, 0)
    cam.location = (i * SPACING, -100, H - CELL_H / 2 * mpp)
    sc.camera = cam
    sc.cycles.samples = samples
    sc.render.resolution_x, sc.render.resolution_y = int(CELL_W * scale), int(CELL_H * scale)
    sc.render.resolution_percentage = 100
    st = sc.render.image_settings
    st.file_format, st.color_depth, st.color_mode = "OPEN_EXR", "32", "RGBA"
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True, scene=sc.name)


def load(path):
    """An EXR as a top-down float array (h, w, 4)."""
    import numpy as np
    im = bpy.data.images.load(path, check_existing=False)
    w, h = im.size
    px = np.empty(w * h * 4, np.float32)
    im.pixels.foreach_get(px)
    bpy.data.images.remove(im)
    return px.reshape(h, w, 4)[::-1].copy()


def cell(i, tmp, scale=1.0, samples=64):
    """Colour (linear, straight alpha), normal (unit vectors, toward the camera +Z) and alpha of tree i."""
    import numpy as np
    render_cell(i, tmp + "/c%d.exr" % i, False, scale, samples)
    render_cell(i, tmp + "/n%d.exr" % i, True, scale, samples)
    c, n = load(tmp + "/c%d.exr" % i), load(tmp + "/n%d.exr" % i)
    a = c[:, :, 3:4]
    safe = np.maximum(a, 1e-4)
    rgb = np.where(a > 0, c[:, :, :3] / safe, 0)
    nv = np.where(a > 0, n[:, :, :3] / safe, 0.5) * 2 - 1
    nv[:, :, 2] = np.abs(nv[:, :, 2])  # thin geometry seen from behind faces the camera too
    nv /= np.maximum(np.linalg.norm(nv, axis=2, keepdims=True), 1e-6)
    nv = np.where(a > 0, nv, np.array([0, 0, 1], np.float32))
    return rgb, nv, a[:, :, 0]


def dilate(img, filled, steps):
    """Spread colour `steps` pixels past the alpha edge, each new pixel the mean of its filled neighbours."""
    import numpy as np
    img, filled = img.copy(), filled.copy()
    for _ in range(steps):
        acc = np.zeros_like(img)
        cnt = np.zeros(filled.shape, np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx or dy:
                    f = np.roll(np.roll(filled, dy, 0), dx, 1)
                    acc += np.roll(np.roll(img, dy, 0), dx, 1) * f[:, :, None]
                    cnt += f
        grow = (~filled) & (cnt > 0)
        img[grow] = acc[grow] / cnt[grow][:, None]
        filled = filled | grow
    return img, filled


def to_srgb(x):
    import numpy as np
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - 0.055)


def save_png(path, rgba):
    """Write a top-down array of display values (0..1) to an 8-bit PNG without any colour conversion."""
    import numpy as np
    h, w, ch = rgba.shape
    if ch == 3:  # written as RGB without alpha, which keeps the normal map smaller
        rgba = np.concatenate([rgba, np.ones((h, w, 1), np.float32)], axis=2)
    im = bpy.data.images.new("Forest_out", w, h, alpha=ch == 4)
    im.colorspace_settings.name = "Non-Color"
    im.alpha_mode = "STRAIGHT"
    im.pixels.foreach_set(np.ascontiguousarray(rgba[::-1], np.float32).ravel())
    im.file_format = "PNG"
    im.filepath_raw = path
    im.save()
    bpy.data.images.remove(im)


def tmpdir():
    import tempfile
    return tempfile.mkdtemp(prefix="forest-")


def preview(path, scale=0.5, samples=32):
    """Every tree twice on neutral grey: the atlas colour as baked (top), and lit through its normals by a sun from
    the front left and a sky from above (bottom), roughly as the app will light it."""
    import numpy as np
    tmp = tmpdir()
    grey = np.array([0.5, 0.5, 0.5], np.float32)
    sun = np.array([-0.55, 0.55, 0.63], np.float32)
    sun /= np.linalg.norm(sun)
    cols = []
    for i in range(len(TREES)):
        rgb, nv, a = cell(i, tmp, scale, samples)
        lit = rgb * (0.35 + 0.25 * (nv[:, :, 1:2] * 0.5 + 0.5) + 0.9 * np.clip(nv @ sun, 0, 1)[:, :, None])
        top = to_srgb(rgb) * a[:, :, None] + grey * (1 - a[:, :, None])
        bottom = to_srgb(lit) * a[:, :, None] + grey * (1 - a[:, :, None])
        cols.append(np.concatenate([top, bottom], axis=0))
    gap = np.full((cols[0].shape[0], 16, 3), 0.5, np.float32)
    sheet = np.concatenate(sum([[c, gap] for c in cols], [])[:-1], axis=1)
    im = bpy.data.images.new("Forest_preview", sheet.shape[1], sheet.shape[0])
    im.colorspace_settings.name = "Non-Color"
    im.pixels.foreach_set(np.concatenate([sheet, np.ones(sheet.shape[:2] + (1,), np.float32)], axis=2)[::-1].ravel())
    im.file_format = "JPEG"
    im.filepath_raw = path
    im.save(quality=90)
    bpy.data.images.remove(im)
    return [round(top_of(i), 2) for i in range(len(TREES))]


def bake(out, samples=64):
    """Render the four cells and write ring-color.png (sRGB, straight alpha, colour dilated 4 px past the edge),
    ring-normal.png (tangent space, OpenGL +Y up) and ring.json into `out`."""
    import numpy as np, os
    os.makedirs(out, exist_ok=True)
    tmp = tmpdir()
    color = np.zeros((CELL_H, CELL_W * len(TREES), 4), np.float32)
    normal = np.zeros((CELL_H, CELL_W * len(TREES), 3), np.float32)
    trees = []
    for i, t in enumerate(TREES):
        rgb, nv, a = cell(i, tmp, 1.0, samples)
        filled = a > 0.02
        mean = rgb[filled].mean(axis=0)
        rgb, grown = dilate(rgb, filled, 4)
        rgb[~grown] = mean  # past the border, the tree's mean colour, so the smallest mipmaps keep its tone
        nv, _ = dilate(nv, filled, 4)
        nv[~grown] = (0, 0, 1)
        x = i * CELL_W
        color[:, x:x + CELL_W, :3] = to_srgb(rgb)
        color[:, x:x + CELL_W, 3] = a
        normal[:, x:x + CELL_W] = nv * 0.5 + 0.5
        trees.append(dict(height=t["height"], foot=[CELL_W // 2, FOOT_Y]))
    save_png(out + "/ring-color.png", color)
    save_png(out + "/ring-normal.png", normal)
    with open(out + "/ring.json", "w") as f:
        json.dump(dict(trees=trees), f, indent=2)
        f.write("\n")
    return dict(trees=trees, tops=[round(top_of(i), 2) for i in range(len(TREES))])
