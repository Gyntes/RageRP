import bpy
import math
import os
from mathutils import Vector


OUT_DIR = os.path.dirname(os.path.abspath(__file__))
BLEND_PATH = os.path.join(OUT_DIR, "bmw_m5_g90_2025.blend")
GLB_PATH = os.path.join(OUT_DIR, "bmw_m5_g90_2025.glb")
FBX_PATH = os.path.join(OUT_DIR, "bmw_m5_g90_2025.fbx")
OBJ_PATH = os.path.join(OUT_DIR, "bmw_m5_g90_2025.obj")
PREVIEW_PATH = os.path.join(OUT_DIR, "bmw_m5_g90_preview.png")


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.materials,
    ):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def mat(name, color, metallic=0.0, roughness=0.4, transmission=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Transmission Weight"].default_value = transmission
    return material


def mesh_obj(name, vertices, faces, material=None, bevel=0.0, smooth=True):
    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if material:
        obj.data.materials.append(material)
    if bevel:
        modifier = obj.modifiers.new("Rounded edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        modifier.profile = 0.5
    if smooth:
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


def cube(name, location, scale, material=None, bevel=0.04, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Rounded edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
    if material:
        obj.data.materials.append(material)
    return obj


def uv_sphere(name, location, scale, material=None, segments=48, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        radius=1,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def cylinder(name, location, radius, depth, material=None, rotation=(0, 0, 0), vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    if material:
        obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def torus(name, location, major_radius, minor_radius, material=None, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=48,
        minor_segments=12,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    if material:
        obj.data.materials.append(material)
    return obj


def move_collection(obj, collection_name):
    collection = bpy.data.collections.get(collection_name)
    if not collection:
        collection = bpy.data.collections.new(collection_name)
        bpy.context.scene.collection.children.link(collection)
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def parent_empty(name, objects, location=(0, 0, 0)):
    empty = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(empty)
    empty.location = location
    for obj in objects:
        obj.parent = empty
    return empty


reset_scene()

# Approximate 2025 G90 dimensions in metres: 5096 x 1981 x 1510, wheelbase 3006.
body = mat("Carbon Black Metallic", (0.012, 0.015, 0.018), metallic=0.78, roughness=0.22)
black = mat("Gloss Black", (0.008, 0.008, 0.009), metallic=0.35, roughness=0.16)
glass = mat("Dark Privacy Glass", (0.015, 0.035, 0.055), metallic=0.05, roughness=0.08, transmission=0.18)
chrome = mat("Bright Metal", (0.72, 0.76, 0.79), metallic=1.0, roughness=0.12)
headlight = mat("Cold White LEDs", (0.75, 0.86, 1.0), metallic=0.2, roughness=0.12)
red_light = mat("Red LED", (0.75, 0.01, 0.008), metallic=0.1, roughness=0.12)
amber = mat("Amber Indicator", (1.0, 0.25, 0.02), metallic=0.1, roughness=0.15)
tire = mat("Rubber", (0.018, 0.018, 0.018), metallic=0.0, roughness=0.72)
wheel_metal = mat("Forged Wheel", (0.11, 0.13, 0.15), metallic=0.95, roughness=0.18)
brake = mat("Brake Material", (0.30, 0.31, 0.32), metallic=0.75, roughness=0.24)
caliper = mat("M Blue Caliper", (0.02, 0.12, 0.55), metallic=0.45, roughness=0.22)
leather = mat("Black Merino Leather", (0.018, 0.018, 0.019), metallic=0.0, roughness=0.38)
leather_contrast = mat("Red Contrast Stitch", (0.28, 0.012, 0.012), metallic=0.0, roughness=0.45)
screen = mat("Infotainment Black", (0.004, 0.006, 0.008), metallic=0.1, roughness=0.12)
engine_plastic = mat("Engine Plastic", (0.08, 0.09, 0.10), metallic=0.2, roughness=0.32)

exterior = []
interior = []
mechanical = []

# Main lower body: longitudinal axis along Y.
main_body = cube("Lower body", (0, 0, 0.78), (1.99, 5.10, 0.78), body, 0.15)
exterior.append(main_body)

# Sculpted roof and greenhouse.
roof = mesh_obj(
    "Roof and upper greenhouse",
    [
        (-0.86, -1.55, 1.25), (0.86, -1.55, 1.25),
        (-0.82, 1.15, 1.25), (0.82, 1.15, 1.25),
        (-0.72, 1.55, 1.42), (0.72, 1.55, 1.42),
        (-0.88, -0.20, 1.66), (0.88, -0.20, 1.66),
    ],
    [(0, 1, 3, 2), (2, 3, 7, 6), (4, 5, 7, 6), (0, 2, 6), (1, 5, 7, 3), (0, 4, 5, 1)],
    body,
    0.10,
)
exterior.append(roof)

# Hood and deck surfaces.
hood = cube("Sculpted hood", (0, -1.88, 1.20), (1.70, 1.30, 0.13), body, 0.12, (math.radians(-4), 0, 0))
trunk = cube("Trunk lid", (0, 1.78, 1.18), (1.74, 0.95, 0.12), body, 0.08, (math.radians(5), 0, 0))
exterior.extend([hood, trunk])

# Wheel arches and front/rear bumpers.
cube("Front bumper", (0, -2.48, 0.73), (1.90, 0.28, 0.58), body, 0.10)
cube("Rear bumper", (0, 2.48, 0.70), (1.90, 0.30, 0.54), body, 0.10)

# Side glazing.
for side in (-1, 1):
    cube(
        "Side window",
        (side * 0.865, -0.30, 1.39),
        (0.025, 2.12, 0.48),
        glass,
        0.08,
    )
    cube("Front window", (side * 0.76, -1.38, 1.40), (0.025, 0.18, 0.58), glass, 0.06)
    cube("Rear window", (side * 0.76, 1.30, 1.40), (0.025, 0.18, 0.58), glass, 0.06)
    cube("Window trim", (side * 0.884, -0.30, 1.66), (0.018, 2.20, 0.018), chrome, 0.008)
    cube("Side skirt", (side * 0.99, 0.0, 0.38), (0.10, 3.18, 0.12), black, 0.04)
    for y in (-1.30, 1.30):
        cube("Door handle", (side * 1.002, y, 1.05), (0.018, 0.24, 0.055), chrome, 0.015)

# Front kidney grille.
for x in (-0.35, 0.35):
    cube("Kidney grille surround", (x, -2.65, 0.90), (0.58, 0.10, 0.56), chrome, 0.12)
    cube("Kidney grille mesh", (x, -2.705, 0.90), (0.48, 0.025, 0.46), black, 0.09)
    for i in range(7):
        cube("Kidney vertical blade", (x - 0.19 + i * 0.063, -2.728, 0.90), (0.012, 0.012, 0.40), chrome, 0.004)

# Split daytime-running headlights.
for side in (-1, 1):
    cube("Upper headlight", (side * 0.72, -2.54, 1.10), (0.62, 0.18, 0.16), headlight, 0.06)
    cube("Lower headlight", (side * 0.72, -2.58, 0.94), (0.58, 0.10, 0.08), headlight, 0.035)
    cube("Front lower intake", (side * 0.72, -2.67, 0.48), (0.56, 0.12, 0.26), black, 0.08)

# Tail lights and rear details.
for side in (-1, 1):
    cube("Tail light", (side * 0.72, 2.56, 1.08), (0.58, 0.14, 0.17), red_light, 0.07)
    cube("Tail light inner", (side * 0.72, 2.62, 1.08), (0.44, 0.08, 0.055), red_light, 0.02)
    cube("Exhaust pipe", (side * 0.62, 2.68, 0.42), (0.16, 0.30, 0.16), chrome, 0.08, (math.radians(90), 0, 0))
cube("Rear diffuser", (0, 2.64, 0.36), (1.55, 0.20, 0.32), black, 0.06)
cube("License plate recess", (0, 2.70, 0.78), (0.56, 0.025, 0.22), black, 0.03)

# Windscreen and mirrors.
cube("Windscreen", (0, -1.69, 1.44), (1.44, 0.025, 0.66), glass, 0.05)
cube("Rear glass", (0, 1.49, 1.42), (1.40, 0.025, 0.50), glass, 0.05)
for side in (-1, 1):
    cube("Mirror arm", (side * 1.02, -1.38, 1.42), (0.20, 0.10, 0.07), black, 0.03)
    cube("Mirror housing", (side * 1.17, -1.38, 1.45), (0.26, 0.16, 0.16), body, 0.06)
    cube("Mirror glass", (side * 1.307, -1.38, 1.45), (0.018, 0.10, 0.10), glass, 0.02)

# Wheels with removable collection-style variation, all generated.
wheel_positions = [
    (-0.98, -1.50, 0.46),
    (0.98, -1.50, 0.46),
    (-0.98, 1.56, 0.46),
    (0.98, 1.56, 0.46),
]
wheel_objects = []
for index, (x, y, z) in enumerate(wheel_positions):
    tire_obj = cylinder("Tire", (x, y, z), 0.405, 0.27, tire, (0, math.radians(90), 0), 48)
    rim = cylinder("Forged wheel rim", (x, y, z), 0.298, 0.282, wheel_metal, (0, math.radians(90), 0), 48)
    brake_disc = cylinder("Brake disc", (x, y, z), 0.235, 0.018, brake, (0, math.radians(90), 0), 48)
    caliper_obj = cube("M blue brake caliper", (x + (0.13 if x > 0 else -0.13), y, z + 0.10), (0.10, 0.16, 0.18), caliper, 0.025)

    for spoke in range(10):
        angle = spoke * math.pi * 2 / 10
        sx = x + (0.13 if x > 0 else -0.13)
        sy = y + math.sin(angle) * 0.16
        sz = z + math.cos(angle) * 0.16
        spoke_obj = cube(
            "Wheel spoke",
            (sx, sy, sz),
            (0.045, 0.09, 0.23),
            wheel_metal,
            0.018,
            (angle, 0, 0),
        )
        wheel_objects.append(spoke_obj)
    wheel_objects.extend([tire_obj, rim, brake_disc, caliper_obj])

# Interior cabin.
cube("Interior floor", (0, 0.15, 0.62), (1.66, 3.10, 0.12), leather, 0.05)
cube("Dashboard", (0, -1.08, 1.10), (1.64, 0.22, 0.38), leather, 0.06)
cube("Center console", (0, -0.15, 0.88), (0.34, 1.42, 0.30), black, 0.08)
cube("Headliner", (0, -0.05, 1.67), (1.55, 2.25, 0.05), leather, 0.03)
cube("Screen passenger", (-0.72, -1.19, 1.34), (0.58, 0.035, 0.28), screen, 0.03)
cube("Screen driver", (0.28, -1.19, 1.34), (0.88, 0.035, 0.28), screen, 0.03)

seat_positions = [(-0.52, -0.55), (0.52, -0.55), (-0.52, 0.85), (0.52, 0.85)]
for index, (x, y) in enumerate(seat_positions):
    cube("Seat base %02d" % index, (x, y, 0.80), (0.48, 0.58, 0.16), leather, 0.10)
    cube("Seat back %02d" % index, (x, y + 0.20, 1.18), (0.48, 0.16, 0.72), leather, 0.10)
    cube("Seat bolsters %02d" % index, (x - 0.20, y, 1.05), (0.08, 0.50, 0.48), leather_contrast, 0.05)
    cube("Seat bolsters %02d" % index, (x + 0.20, y, 1.05), (0.08, 0.50, 0.48), leather_contrast, 0.05)

# Steering wheel.
torus("Steering wheel", (-0.48, -0.98, 1.22), 0.19, 0.025, leather, (math.radians(70), 0, 0))
cylinder("Steering wheel hub", (-0.48, -0.98, 1.22), 0.07, 0.035, black, (math.radians(70), 0, 0), 32)
cube("Steering wheel spoke", (-0.48, -0.99, 1.22), (0.25, 0.035, 0.055), leather, 0.02)

# Engine bay detail.
cube("Engine cover", (0, -1.62, 1.07), (1.30, 0.70, 0.20), engine_plastic, 0.08)
for x in (-0.48, -0.32, -0.16, 0.16, 0.32, 0.48):
    cylinder("Engine coil cover", (x, -1.62, 1.20), 0.055, 0.22, black, (math.radians(90), 0, 0), 24)

# Organise primary detail collections.
for obj in exterior:
    move_collection(obj, "Exterior")
for obj in wheel_objects:
    move_collection(obj, "Wheels")
for obj in bpy.context.scene.objects:
    if obj.type in {"MESH", "CURVE", "SURFACE"}:
        if obj.name not in [item.name for item in exterior] and obj.name not in [item.name for item in wheel_objects]:
            if any(token in obj.name.lower() for token in ("seat", "screen", "dashboard", "console", "leather", "steering", "interior", "headliner")):
                move_collection(obj, "Interior")

# Ground and studio lighting.
ground_mat = mat("Studio floor", (0.055, 0.06, 0.07), metallic=0.0, roughness=0.55)
cube("Studio floor", (0, 0, -0.005), (14, 14, 0.02), ground_mat, 0.0)

bpy.ops.object.light_add(type="AREA", location=(-4, -5, 7))
key = bpy.context.object
key.name = "Key softbox"
key.data.energy = 950
key.data.size = 5

bpy.ops.object.light_add(type="AREA", location=(5, 3, 5))
fill = bpy.context.object
fill.name = "Fill softbox"
fill.data.energy = 700
fill.data.size = 4

bpy.ops.object.camera_add(location=(7.5, -8.5, 4.2))
camera = bpy.context.object
camera.name = "Preview camera"
target = Vector((0, 0, 0.95))
direction = target - camera.location
camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = camera

# Scene settings.
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT" if hasattr(bpy.types, "RenderSettings") and "BLENDER_EEVEE_NEXT" in dir(bpy.types.RenderSettings) else "BLENDER_EEVEE"
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = PREVIEW_PATH
scene.view_settings.look = "AgX - Medium High Contrast"
scene.world = bpy.data.worlds.new("Studio World") if not bpy.data.worlds else bpy.data.worlds[0]
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.055, 0.06, 0.07, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45

bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
bpy.ops.export_scene.gltf(filepath=GLB_PATH, export_format="GLB")
bpy.ops.export_scene.fbx(filepath=FBX_PATH, use_selection=False, apply_unit_scale=True, apply_scale_options="FBX_SCALE_ALL")
bpy.ops.wm.obj_export(filepath=OBJ_PATH, export_materials=True) if hasattr(bpy.ops.wm, "obj_export") else None
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

print("MODEL_CREATED")
print(BLEND_PATH)
print(GLB_PATH)
print(FBX_PATH)
print(OBJ_PATH)
print(PREVIEW_PATH)
