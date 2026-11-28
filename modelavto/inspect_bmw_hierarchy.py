import bpy

source = r"C:\servGTA5\modelavto\bmw_m5_g90_downloaded_source.blend"
bpy.ops.wm.open_mainfile(filepath=source)

def walk(obj, depth=0):
    if depth > 3:
        return
    print("  " * depth + obj.type + " " + obj.name + " children=" + str(len(obj.children)))
    for child in sorted(obj.children, key=lambda item: item.name):
        if child.type != "MESH" or len(child.data.vertices) == 0:
            walk(child, depth + 1)
        else:
            material_names = [m.name for m in child.data.materials if m]
            print("  " * (depth + 1) + "MESH " + child.name +
                  " v=" + str(len(child.data.vertices)) +
                  " m=" + ",".join(material_names[:4]))

for name in ("BMW_M5_G90_GTA_ROOT", "Wheel1A_3D", "3DWheel Front L",
             "3DWheel Front R", "3DWheel Rear L", "3DWheel Rear R",
             "Calliper Front L", "Calliper Front R", "Calliper Rear L", "Calliper Rear R"):
    obj = bpy.data.objects.get(name)
    if obj:
        print("TREE", name)
        walk(obj)

materials = {}
for obj in bpy.context.scene.objects:
    if obj.type != "MESH" or len(obj.data.vertices) == 0:
        continue
    for material in obj.data.materials:
        if material:
            materials.setdefault(material.name, 0)
            materials[material.name] += len(obj.data.polygons)
print("MATERIAL_POLYGON_COUNTS")
for name, count in sorted(materials.items(), key=lambda item: item[1], reverse=True)[:40]:
    print(name, count)
