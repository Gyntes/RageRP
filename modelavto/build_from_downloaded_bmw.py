import bpy
import os
from mathutils import Vector, Matrix


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FBX = r"C:\скрины Патрики\2025-bmw-m5-g90\source\2025-bmw-m5-sedan\source\FINAL_MODEL_S\FINAL_MODEL_S.fbx"
TEXTURE_DIR = r"C:\скрины Патрики\2025-bmw-m5-g90\source\2025-bmw-m5-sedan\textures"
BLEND_PATH = os.path.join(SCRIPT_DIR, "bmw_m5_g90_downloaded_source.blend")
GLB_PATH = os.path.join(SCRIPT_DIR, "bmw_m5_g90_downloaded_source.glb")
FBX_PATH = os.path.join(SCRIPT_DIR, "bmw_m5_g90_downloaded_source_normalized.fbx")
PREVIEW_PATH = os.path.join(SCRIPT_DIR, "bmw_m5_g90_downloaded_preview.png")


bpy.ops.wm.read_factory_settings(use_empty=True)
if hasattr(bpy.ops.wm, "fbx_import"):
    bpy.ops.wm.fbx_import(
        filepath=FBX,
        ignore_leaf_bones=False,
    )
else:
    bpy.ops.import_scene.fbx(filepath=FBX)

objects = list(bpy.context.scene.objects)
mesh_objects = [obj for obj in objects if obj.type == "MESH" and len(obj.data.vertices) > 0]
all_corners = [
    obj.matrix_world @ Vector(corner)
    for obj in mesh_objects
    for corner in obj.bound_box
]
source_min = Vector((min(point.x for point in all_corners),
                     min(point.y for point in all_corners),
                     min(point.z for point in all_corners)))
source_max = Vector((max(point.x for point in all_corners),
                     max(point.y for point in all_corners),
                     max(point.z for point in all_corners)))
source_center = (source_min + source_max) * 0.5

root = bpy.data.objects.new("BMW_M5_G90_GTA_ROOT", None)
bpy.context.collection.objects.link(root)
root["source_format"] = "FBX"
root["source_axis"] = "X width, Y length, Z up"
root["source_scale_factor"] = 100.0

top_objects = [obj for obj in objects if obj.parent is None]
for obj in top_objects:
    obj.parent = root

root.scale = (100.0, 100.0, 100.0)
root.location = (
    -source_center.x * 100.0,
    -source_center.y * 100.0,
    -source_min.z * 100.0,
)
bpy.context.view_layer.objects.active = root

# GTA-facing convention: front remains +Y, roof +Z, right side +X.
armature = bpy.data.armatures.new("bmwm5g90_skeleton")
armature_obj = bpy.data.objects.new("bmwm5g90_skeleton", armature)
bpy.context.collection.objects.link(armature_obj)
armature_obj.parent = root

wheel_positions = {
    "wheel_lf": (-0.776, 1.604, 0.367),
    "wheel_rf": (0.776, 1.604, 0.367),
    "wheel_lr": (-0.761, -1.403, 0.372),
    "wheel_rr": (0.761, -1.403, 0.372),
}
bone_specs = {
    "chassis": (0.0, 0.0, 0.72),
    "chassis_dummy": (0.0, 0.0, 0.72),
    "door_dside_f": (-0.99, 0.78, 1.02),
    "door_pside_f": (0.99, 0.78, 1.02),
    "door_dside_r": (-0.99, -0.72, 1.02),
    "door_pside_r": (0.99, -0.72, 1.02),
    "bonnet": (0.0, 1.92, 1.16),
    "boot": (0.0, -1.78, 1.15),
    "headlight_l": (-0.72, 2.48, 1.08),
    "headlight_r": (0.72, 2.48, 1.08),
    "taillight_l": (-0.72, -2.48, 1.05),
    "taillight_r": (0.72, -2.48, 1.05),
    "windscreen": (0.0, 1.15, 1.40),
    "scratches": (0.0, 0.0, 1.0),
}
bone_specs.update(wheel_positions)

bpy.context.view_layer.objects.active = armature_obj
armature_obj.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
for name, location in bone_specs.items():
    bone = armature.edit_bones.new(name)
    bone.head = location
    bone.tail = (location[0], location[1] + 0.08, location[2])
    if name not in ("chassis", "chassis_dummy"):
        bone.parent = armature.edit_bones["chassis"]
bpy.ops.object.mode_set(mode="OBJECT")

# Organize source geometry.
collections = {}
for category in ("Body", "Interior", "Windows", "Wheels", "Lights", "Details", "Source"):
    collection = bpy.data.collections.new(category)
    bpy.context.scene.collection.children.link(collection)
    collections[category] = collection

for obj in mesh_objects:
    name_lower = obj.name.lower()
    if any(token in name_lower for token in ("window", "glass", "windscreen")):
        category = "Windows"
    elif any(token in name_lower for token in ("interior", "seat", "belt")):
        category = "Interior"
    elif any(token in name_lower for token in ("light", "emissive")):
        category = "Lights"
    elif any(token in name_lower for token in ("wheel", "tire", "calliper", "rim")):
        category = "Wheels"
    elif any(token in name_lower for token in ("paint", "coloured", "base", "carbon", "badge",
                                              "grille", "engine", "body", "door", "bonnet", "boot")):
        category = "Body"
    else:
        category = "Details"

    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collections[category].objects.link(obj)

# Vehicle-grade metadata for the exported scene.
root["door_dside_f"] = (-0.99, 0.78, 1.02)
root["door_pside_f"] = (0.99, 0.78, 1.02)
root["door_dside_r"] = (-0.99, -0.72, 1.02)
root["door_pside_r"] = (0.99, -0.72, 1.02)
root["bonnet"] = (0.0, 1.92, 1.16)
root["boot"] = (0.0, -1.78, 1.15)
root["vehicle_length_m"] = 5.096
root["vehicle_width_m"] = 1.981
root["vehicle_height_m"] = 1.510
root["wheelbase_m"] = 3.006

# Ground and preview studio.
ground = bpy.data.materials.new("Preview Studio Floor")
ground.diffuse_color = (0.055, 0.06, 0.07, 1.0)
ground.use_nodes = True
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -0.02))
floor = bpy.context.object
floor.name = "Preview Studio Floor"
floor.dimensions = (12, 12, 0.02)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
floor.data.materials.append(ground)

bpy.ops.object.light_add(type="AREA", location=(-4, -5, 7))
key = bpy.context.object
key.name = "Key softbox"
key.data.energy = 1100
key.data.size = 5

bpy.ops.object.light_add(type="AREA", location=(5, 3, 5))
fill = bpy.context.object
fill.name = "Fill softbox"
fill.data.energy = 800
fill.data.size = 4

bpy.ops.object.camera_add(location=(7.5, -8.5, 4.2))
camera = bpy.context.object
camera.name = "Preview camera"
direction = Vector((0, 0, 0.95)) - camera.location
camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = camera

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = PREVIEW_PATH
scene.world = bpy.data.worlds.new("Studio World")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.055, 0.06, 0.07, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45

bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
bpy.ops.export_scene.gltf(filepath=GLB_PATH, export_format="GLB")

if hasattr(bpy.ops.export_scene, "fbx"):
    bpy.ops.export_scene.fbx(filepath=FBX_PATH, apply_scale_options="FBX_SCALE_ALL")

print("DOWNLOADED_SOURCE_BUILD_OK")
print("BLEND", BLEND_PATH)
print("GLB", GLB_PATH)
print("FBX", FBX_PATH)
print("PREVIEW", PREVIEW_PATH)
print("OBJECT_COUNT", len(objects))
print("MESH_COUNT", len(mesh_objects))
print("SOURCE_BBOX_MIN", tuple(round(value, 6) for value in source_min))
print("SOURCE_BBOX_MAX", tuple(round(value, 6) for value in source_max))
