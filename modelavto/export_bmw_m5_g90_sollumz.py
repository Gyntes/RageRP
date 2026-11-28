import os
import sys
from pathlib import Path
import shutil

import bpy
from mathutils import Vector


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
SOLLUMZ_DIR = os.path.join(PROJECT_DIR, "tools", "Sollumz")
SOURCE_BLEND = os.path.join(SCRIPT_DIR, "bmw_m5_g90_2025.blend")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "bmw_m5_g90_ragemp")
ASSET_NAME = "bmwm5g90"


def setup_sollumz():
    sys.path.insert(0, os.path.join(PROJECT_DIR, "tools"))
    import addon_utils
    addon_utils.enable("Sollumz", default_set=True, persistent=True)

    from Sollumz.sollumz_properties import SollumType, LODLevel, ArchetypeType, AssetType
    from Sollumz.ydr.gta5.shader_materials import create_shader
    return SollumType, LODLevel, ArchetypeType, AssetType, create_shader


def create_vehicle_armature():
    armature = bpy.data.armatures.new("bmwm5g90_skeleton")
    armature_obj = bpy.data.objects.new("bmwm5g90_skeleton", armature)
    bpy.context.collection.objects.link(armature_obj)

    bone_specs = {
        "chassis": (0.0, 0.0, 0.72),
        "chassis_dummy": (0.0, 0.0, 0.72),
        "door_dside_f": (-0.99, -1.05, 1.05),
        "door_pside_f": (0.99, -1.05, 1.05),
        "door_dside_r": (-0.99, 0.80, 1.05),
        "door_pside_r": (0.99, 0.80, 1.05),
        "bonnet": (0.0, -1.87, 1.20),
        "boot": (0.0, 1.78, 1.18),
        "wheel_lf": (-0.98, -1.50, 0.46),
        "wheel_rf": (0.98, -1.50, 0.46),
        "wheel_lr": (-0.98, 1.56, 0.46),
        "wheel_rr": (0.98, 1.56, 0.46),
        "headlight_l": (-0.72, -2.54, 1.10),
        "headlight_r": (0.72, -2.54, 1.10),
        "taillight_l": (-0.72, 2.56, 1.08),
        "taillight_r": (0.72, 2.56, 1.08),
        "exhaust": (0.62, 2.68, 0.42),
        "windscreen": (0.0, -1.69, 1.44),
        "scratches": (0.0, 0.0, 1.0),
    }

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

    return armature_obj


def create_collision_box(SollumType):
    from Sollumz.ybn.collision_materials import (
        collisionmats,
        create_collision_material_from_index,
    )
    from Sollumz.tools.boundhelper import create_bound_poly_box

    obj = create_bound_poly_box()
    obj.name = "bmwm5g90_collision"
    obj.sollum_type = SollumType.BOUND_POLY_BOX
    obj.location = (0.0, 0.0, 0.87)
    obj.dimensions = (1.92, 5.16, 1.18)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    collision_index = next(
        index for index, mat in enumerate(collisionmats) if mat.name == "CAR_METAL"
    )
    obj.data.materials.append(create_collision_material_from_index(collision_index))

    composite = bpy.data.objects.new("bmwm5g90", None)
    bpy.context.collection.objects.link(composite)
    composite.sollum_type = SollumType.BOUND_COMPOSITE
    obj.parent = composite
    composite.location = (0.0, 0.0, 0.0)
    return composite


def write_vehicle_meta(output_dir):
    handling_xml = """<?xml version="1.0" encoding="UTF-8"?>
<CVehicleHandlingData>
  <handlingName>bmwm5g90</handlingName>
  <fMass value="2395.000000"/>
  <fInitialDragCoeff value="8.500000"/>
  <fPercentSubmerged value="85.000000"/>
  <vecCentreOfMassOffset x="0.000000" y="0.000000" z="-0.100000"/>
  <vecInertiaMultiplier x="1.000000" y="1.300000" z="1.600000"/>
  <fDriveBiasFront value="0.400000"/>
  <nInitialDriveGears value="8"/>
  <fInitialDriveForce value="0.345000"/>
  <fDriveInertia value="1.000000"/>
  <fClutchChangeRateScaleUpShift value="6.000000"/>
  <fClutchChangeRateScaleDownShift value="6.000000"/>
  <fInitialDriveMaxFlatVel value="54.000000"/>
  <fBrakeForce value="1.150000"/>
  <fBrakeBiasFront value="0.620000"/>
  <fHandBrakeForce value="0.800000"/>
  <fSteeringLock value="40.000000"/>
  <fTractionCurveMax value="2.300000"/>
  <fTractionCurveMin value="2.050000"/>
  <fTractionCurveLateral value="22.500000"/>
  <fTractionSpringDeltaMax value="0.150000"/>
  <fLowSpeedTractionLossMult value="0.100000"/>
  <fCamberStiffnesss value="0.000000"/>
  <fTractionBiasFront value="0.490000"/>
  <fTractionLossMult value="1.000000"/>
  <fSuspensionForce value="2.000000"/>
  <fSuspensionCompDamp value="1.300000"/>
  <fSuspensionReboundDamp value="2.200000"/>
  <fSuspensionUpperLimit value="0.060000"/>
  <fSuspensionLowerLimit value="-0.080000"/>
  <fSuspensionRaise value="0.000000"/>
  <fSuspensionBiasFront value="0.520000"/>
  <fAntiRollBarForce value="0.600000"/>
  <fAntiRollBarBiasFront value="0.500000"/>
  <fRollCentreHeightFront value="0.340000"/>
  <fRollCentreHeightRear value="0.340000"/>
  <fCollisionDamageMult value="0.500000"/>
  <fWeaponDamageMult value="1.000000"/>
  <fDeformationDamageMult value="0.800000"/>
  <fEngineDamageMult value="1.500000"/>
  <fPetrolTankVolume value="68.000000"/>
  <fOilVolume value="8.500000"/>
  <fSeatOffsetDistX value="0.000000"/>
  <fSeatOffsetDistY value="-0.100000"/>
  <fSeatOffsetDistZ value="0.000000"/>
  <nMonetaryValue value="140000"/>
</CVehicleHandlingData>
"""

    vehicles_xml = """<?xml version="1.0" encoding="UTF-8"?>
<CVehicleModelInfo__InitDataList>
  <InitDatas>
    <Item>
      <modelName>bmwm5g90</modelName>
      <txdName>bmwm5g90</txdName>
      <handlingId>bmwm5g90</handlingId>
      <gameName>BMWM5G90</gameName>
      <vehicleMakeName>BMW</vehicleMakeName>
      <expressionDictName>null</expressionDictName>
      <animConvRoofDictName>null</animConvRoofDictName>
      <animConvRoofName>null</animConvRoofName>
      <animConvRoofWindowsAffectedName>null</animConvRoofWindowsAffectedName>
      <ptfxAssetName>null</ptfxAssetName>
      <audioNameHash>schlagen</audioNameHash>
      <layout>LAYOUT_STD_HIGHWINDOW</layout>
      <class>VC_SEDAN</class>
      <secondaryClass>VC_SPORT</secondaryClass>
      <seats value="5"/>
      <seatBoneName>seat_dside_f</seatBoneName>
      <spawnBoneName>chassis</spawnBoneName>
      <trailers />
      <additionalTrailers />
      <doorsWithCollision />
      <drivetrain>DT_AWD</drivetrain>
      <modelFlags>0x44010010</modelFlags>
      <handlingFlags>0x0</handlingFlags>
      <damageFlags>0x0</damageFlags>
      <aiHandling>SPORT</aiHandling>
    </Item>
  </InitDatas>
</CVehicleModelInfo__InitDataList>
"""

    with open(os.path.join(output_dir, "handling.meta"), "w", encoding="utf-8") as file:
        file.write(handling_xml)
    with open(os.path.join(output_dir, "vehicles.meta"), "w", encoding="utf-8") as file:
        file.write(vehicles_xml)

    ragemp_meta = """<?xml version="1.0" encoding="utf-8"?>
<meta>
  <info name="BMW M5 G90 2025" author="RageRP" version="1.0.0" description="Custom BMW M5 G90 sedan" />
  <file path="stream/bmwm5g90.ydr" />
  <file path="stream/bmwm5g90.ybn" />
  <file path="handling.meta" />
  <file path="vehicles.meta" />
</meta>
"""
    with open(os.path.join(output_dir, "meta.xml"), "w", encoding="utf-8") as file:
        file.write(ragemp_meta)

    door_positions = """{
  "model": "bmwm5g90",
  "door_dside_f": {"position": [-0.99, -1.05, 1.05], "open_angle_deg": 68, "hinge_axis": "Y"},
  "door_pside_f": {"position": [0.99, -1.05, 1.05], "open_angle_deg": 68, "hinge_axis": "Y"},
  "door_dside_r": {"position": [-0.99, 0.80, 1.05], "open_angle_deg": 62, "hinge_axis": "Y"},
  "door_pside_r": {"position": [0.99, 0.80, 1.05], "open_angle_deg": 62, "hinge_axis": "Y"},
  "bonnet": {"position": [0.0, -1.87, 1.20], "open_angle_deg": 58, "hinge_axis": "X"},
  "boot": {"position": [0.0, 1.78, 1.18], "open_angle_deg": 48, "hinge_axis": "X"},
  "wheel_lf": [-0.98, -1.50, 0.46],
  "wheel_rf": [0.98, -1.50, 0.46],
  "wheel_lr": [-0.98, 1.56, 0.46],
  "wheel_rr": [0.98, 1.56, 0.46]
}
"""
    with open(os.path.join(output_dir, "door_positions.json"), "w", encoding="utf-8") as file:
        file.write(door_positions)


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    stream_dir = os.path.join(OUTPUT_DIR, "stream")
    os.makedirs(stream_dir, exist_ok=True)

    bpy.ops.wm.open_mainfile(filepath=SOURCE_BLEND)
    SollumzType, LODLevel, ArchetypeType, AssetType, create_shader = setup_sollumz()

    armature = create_vehicle_armature()
    collision = create_collision_box(SollumzType)

    drawable = bpy.data.objects.new(ASSET_NAME, None)
    bpy.context.collection.objects.link(drawable)
    drawable.sollum_type = SollumzType.DRAWABLE
    armature.sollum_type = SollumzType.SKELETON
    armature.parent = drawable

    meshes = [
        obj for obj in bpy.context.scene.objects
        if obj.type == "MESH" and obj.name != "bmwm5g90_collision"
    ]
    for obj in meshes:
        if obj.name == "Studio floor":
            bpy.data.objects.remove(obj, do_unlink=True)
            continue
        obj.parent = drawable
        obj.sollum_type = SollumzType.DRAWABLE_MODEL
        obj.sz_lods.active_lod_level = "sollumz_veryhigh"
        obj.sz_lods.active_lod_level = "sollumz_high"
        obj.sz_lods.get_lod(LODLevel.HIGH).mesh = obj.data
        if not obj.data.uv_layers:
            obj.data.uv_layers.new(name="UVMap 0")
        elif obj.data.uv_layers.get("UVMap 0") is None:
            obj.data.uv_layers[0].name = "UVMap 0"
        if obj.data.uv_layers.get("UVMap 1") is None:
            obj.data.uv_layers.new(name="UVMap 1")
        if obj.data.color_attributes.get("Color 1") is None:
            obj.data.color_attributes.new(name="Color 1", type="BYTE_COLOR", domain="CORNER")
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        if obj.data.materials:
            obj.data.materials.clear()
            shader = create_shader("vehicle_mesh.sps")
            obj.data.materials.append(shader)

    collision.parent = drawable

    ytyp = bpy.context.scene.ytyps.add()
    ytyp.name = ASSET_NAME
    archetype = ytyp.new_archetype(ArchetypeType.BASE)
    archetype.name = ASSET_NAME
    archetype.asset = drawable
    archetype.asset_type = AssetType.DRAWABLE
    archetype.asset_name = drawable.name
    archetype.lod_dist = 500

    write_vehicle_meta(OUTPUT_DIR)

    bpy.ops.object.select_all(action="DESELECT")
    drawable.select_set(True)
    bpy.context.view_layer.objects.active = drawable

    result = bpy.ops.sollumz.export_assets(
        directory=stream_dir,
        direct_export=True,
        use_custom_settings=True,
        target_formats={"NATIVE"},
        target_versions={"GEN8", "GEN9"},
    )

    bpy.ops.object.select_all(action="DESELECT")
    collision.select_set(True)
    bpy.context.view_layer.objects.active = collision
    collision_result = bpy.ops.sollumz.export_assets(
        directory=stream_dir,
        direct_export=True,
        use_custom_settings=True,
        target_formats={"NATIVE"},
        target_versions={"GEN8", "GEN9"},
    )

    try:
        from Sollumz.ybn.ybnexport import export_ybn
        from Sollumz.iecontext import ExportContext, ExportSettings, export_context_scope
        from szio.gta5 import AssetFormat, AssetVersion, AssetTarget

        targets = (
            AssetTarget(AssetFormat.NATIVE, AssetVersion.GEN8),
            AssetTarget(AssetFormat.NATIVE, AssetVersion.GEN9),
        )
        settings = ExportSettings(targets=targets)
        with export_context_scope(ExportContext(ASSET_NAME, settings)):
            ybn_bundle = export_ybn(collision)
            ybn_bundle.save(Path(stream_dir), targets)
        print("RAGEMP_YBN_DIRECT_EXPORT_OK")
    except Exception as error:
        print("RAGEMP_YBN_DIRECT_EXPORT_ERROR", repr(error))

    for version in ("gen8", "gen9"):
        ydr_source = os.path.join(stream_dir, version, ASSET_NAME + ".ydr")
        ydr_target = os.path.join(stream_dir, ASSET_NAME + ".ydr")
        if os.path.isfile(ydr_source) and version == "gen9":
            shutil.copy2(ydr_source, ydr_target)

        ybn_source = os.path.join(stream_dir, version, ASSET_NAME + ".ybn")
        ybn_target = os.path.join(stream_dir, ASSET_NAME + ".ybn")
        if os.path.isfile(ybn_source) and version == "gen9":
            shutil.copy2(ybn_source, ybn_target)
    print("RAGEMP_VEHICLE_EXPORT", result)
    print("RAGEMP_COLLISION_EXPORT", collision_result)
    print("OUTPUT_DIR", OUTPUT_DIR)


if __name__ == "__main__":
    main()
