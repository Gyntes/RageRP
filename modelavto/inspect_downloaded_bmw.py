import bpy
import os
from mathutils import Vector


FBX = r"C:\скрины Патрики\2025-bmw-m5-g90\source\2025-bmw-m5-sedan\source\FINAL_MODEL_S\FINAL_MODEL_S.fbx"

bpy.ops.wm.read_factory_settings(use_empty=True)

if hasattr(bpy.ops.wm, "fbx_import"):
    bpy.ops.wm.fbx_import(filepath=FBX, ignore_leaf_bones=False)
else:
    bpy.ops.import_scene.fbx(filepath=FBX)

print("FBX_INSPECTION")
print("OBJECT_COUNT", len(bpy.context.scene.objects))
print("MESH_COUNT", sum(1 for obj in bpy.context.scene.objects if obj.type == "MESH"))
print("ARMATURE_COUNT", sum(1 for obj in bpy.context.scene.objects if obj.type == "ARMATURE"))

mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and len(obj.data.vertices) > 0]
if mesh_objects:
    corners = [obj.matrix_world @ Vector(corner) for obj in mesh_objects for corner in obj.bound_box]
    world_min = tuple(round(min(point[i] for point in corners), 6) for i in range(3))
    world_max = tuple(round(max(point[i] for point in corners), 6) for i in range(3))
    print("WORLD_BBOX_MIN", world_min)
    print("WORLD_BBOX_MAX", world_max)
    print("WORLD_BBOX_SIZE", tuple(round(world_max[i] - world_min[i], 6) for i in range(3)))

print("TOP_LEVEL_OBJECTS")
for obj in sorted((item for item in bpy.context.scene.objects if item.parent is None),
                  key=lambda item: item.name):
    print("TOP", obj.type, obj.name, "children=", len(obj.children),
          "dims=", tuple(round(value, 6) for value in obj.dimensions))

for obj in sorted(bpy.context.scene.objects, key=lambda item: item.name):
    dimensions = tuple(round(value, 4) for value in obj.dimensions)
    location = tuple(round(value, 4) for value in obj.location)
    if obj.type == "MESH":
        triangles = sum(len(poly.vertices) - 2 for poly in obj.data.polygons)
        print("MESH", obj.name, "verts=", len(obj.data.vertices), "polys=", len(obj.data.polygons),
              "tris=", triangles, "dims=", dimensions, "loc=", location)
    elif obj.type == "ARMATURE":
        print("ARMATURE", obj.name, "bones=", len(obj.data.bones), "dims=", dimensions, "loc=", location)
        for bone in obj.data.bones:
            print("BONE", bone.name, tuple(round(value, 4) for value in bone.head),
                  tuple(round(value, 4) for value in bone.tail))
    else:
        print("OBJECT", obj.type, obj.name, "dims=", dimensions, "loc=", location)
