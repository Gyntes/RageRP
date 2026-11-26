import os
import sys

import bpy


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SOLLUMZ_DIR = os.path.join(SCRIPT_DIR, "..", "tools", "Sollumz")
INPUT_OBJ = os.path.join(SCRIPT_DIR, "tula_pilot_greybox_compact.obj")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "tula_pilot_game_asset")


def main():
    sys.path.insert(0, os.path.abspath(os.path.join(SCRIPT_DIR, "..", "tools")))
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)

    import addon_utils
    addon_utils.enable("Sollumz", default_set=True, persistent=True)

    if hasattr(bpy.ops.wm, "obj_import"):
        bpy.ops.wm.obj_import(filepath=INPUT_OBJ)
    else:
        bpy.ops.import_scene.obj(filepath=INPUT_OBJ)

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    for obj in meshes:
        obj.location = (215.76, -810.12, 30.73)

    print("SOLLUMZ_IMPORT_OK", "objects=", len(meshes), "output=", OUTPUT_DIR)

    from Sollumz.sollumz_properties import SollumType, LODLevel, ArchetypeType, AssetType
    from Sollumz.ydr.gta5.shader_materials import create_shader
    root = bpy.data.objects.new("tula_pilot_greybox", None)
    root.sollum_type = SollumType.DRAWABLE
    root.location = (215.76, -810.12, 30.73)
    bpy.context.collection.objects.link(root)

    for obj in meshes:
        obj.sollum_type = SollumType.DRAWABLE_MODEL
        obj.parent = root
        obj.location = (0.0, 0.0, 0.0)
        obj.sz_lods.active_lod_level = "sollumz_veryhigh"
        obj.sz_lods.active_lod_level = "sollumz_high"
        obj.sz_lods.get_lod(LODLevel.HIGH).mesh = obj.data
        material = create_shader("gta_default.sps")
        material.name = obj.name + "_greybox"
        obj.data.materials.clear()
        obj.data.materials.append(material)
        print("MATERIAL_CHECK", obj.name, hasattr(material, "shader_properties"),
              getattr(getattr(material, "shader_properties", None), "filename", None))
        if not obj.data.uv_layers:
            obj.data.uv_layers.new(name="UVMap 0")
        elif obj.data.uv_layers.get("UVMap 0") is None:
            obj.data.uv_layers[0].name = "UVMap 0"
        if obj.data.color_attributes.get("Color 1") is None:
            obj.data.color_attributes.new(name="Color 1", type="BYTE_COLOR", domain="CORNER")
        for poly in obj.data.polygons:
            poly.use_smooth = False

    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    bpy.context.view_layer.objects.active = root

    ytyp = bpy.context.scene.ytyps.add()
    ytyp.name = "tula_pilot_greybox"
    archetype = ytyp.new_archetype(ArchetypeType.BASE)
    archetype.name = "tula_pilot_greybox"
    archetype.asset = root
    archetype.asset_type = AssetType.DRAWABLE
    archetype.asset_name = root.name
    archetype.lod_dist = 500

    from Sollumz.ymap_next.properties.map import get_maps
    maps = get_maps(bpy.context, create_if_missing=True)
    map_group = maps.new_group()
    map_group.name = "tula_pilot_greybox"
    map_data = map_group.new_map()
    map_data.name = "tula_pilot_greybox"
    entity = map_group.new_entity()
    entity.linked_object = root
    entity.map_data_uuid = map_data.uuid
    entity.archetype_name = "tula_pilot_greybox"
    entity.position = (215.76, -810.12, 30.73)
    entity.rotation = (1.0, 0.0, 0.0, 0.0)
    entity.lod_level = "HD"
    entity.priority_level = "REQUIRED"

    result = bpy.ops.sollumz.export_assets(
        directory=OUTPUT_DIR,
        direct_export=True,
        use_custom_settings=True,
        target_formats={"NATIVE"},
        target_versions={"GEN8", "GEN9"},
    )
    ytyp_result = bpy.ops.sollumz.export_ytyp_io(
        directory=OUTPUT_DIR,
        direct_export=True,
        use_custom_settings=True,
        target_formats={"NATIVE"},
        target_versions={"GEN8", "GEN9"},
    )
    ymap_result = bpy.ops.sollumz.export_ymap(
        directory=OUTPUT_DIR,
        direct_export=True,
        use_custom_settings=True,
        target_formats={"NATIVE"},
        target_versions={"GEN8", "GEN9"},
    )
    exported = sorted(os.listdir(OUTPUT_DIR))
    print("SOLLUMZ_EXPORT_RESULT", result, ytyp_result, ymap_result, exported)


if __name__ == "__main__":
    main()
