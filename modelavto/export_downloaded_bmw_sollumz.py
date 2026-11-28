import os
import sys
from pathlib import Path
import shutil

import bpy


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
SOURCE_BLEND = os.path.join(SCRIPT_DIR, "bmw_m5_g90_downloaded_source.blend")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "bmw_m5_g90_ragemp_downloaded")
ASSET_NAME = "bmwm5g90"


def setup_sollumz():
    sys.path.insert(0, os.path.join(PROJECT_DIR, "tools"))
    import addon_utils
    addon_utils.enable("Sollumz", default_set=True, persistent=True)
    from Sollumz.sollumz_properties import (
        SollumType,
        LODLevel,
        ArchetypeType,
        AssetType,
    )
    from Sollumz.ydr.gta5.shader_materials import create_shader
    return SollumType, LODLevel, ArchetypeType, AssetType, create_shader


def ensure_uv(obj):
    if not obj.data.uv_layers:
        obj.data.uv_layers.new(name="UVMap 0")
    elif obj.data.uv_layers.get("UVMap 0") is None:
        obj.data.uv_layers[0].name = "UVMap 0"
    if obj.data.uv_layers.get("UVMap 1") is None:
        obj.data.uv_layers.new(name="UVMap 1")
    if obj.data.color_attributes.get("Color 1") is None:
        obj.data.color_attributes.new(name="Color 1", type="BYTE_COLOR", domain="CORNER")


def join_collection(collection, SollumType, LODLevel, create_shader):
    members = [obj for obj in collection.objects if obj.type == "MESH" and obj.name != "Preview Studio Floor"]
    if not members:
        return None

    bpy.ops.object.select_all(action="DESELECT")
    for obj in members:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = members[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = "bmwm5g90_" + collection.name.lower().replace(" ", "_")

    category = collection.name
    shader_name = "vehicle_mesh.sps"
    if category == "Body":
        shader_name = "vehicle_paint1.sps"
    elif category == "Interior":
        shader_name = "vehicle_interior.sps"
    elif category == "Windows":
        shader_name = "vehicle_vehglass.sps"
    elif category == "Lights":
        shader_name = "vehicle_lightsemissive.sps"
    elif category == "Wheels":
        shader_name = "vehicle_tire.sps"

    obj.data.materials.clear()
    obj.data.materials.append(create_shader(shader_name))
    ensure_uv(obj)
    obj.sollum_type = SollumType.DRAWABLE_MODEL
    obj.sz_lods.active_lod_level = "sollumz_veryhigh"
    obj.sz_lods.active_lod_level = "sollumz_high"
    obj.sz_lods.get_lod(LODLevel.HIGH).mesh = obj.data
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def write_meta(output_dir):
    os.makedirs(output_dir, exist_ok=True)
    stream_dir = os.path.join(output_dir, "stream")
    os.makedirs(stream_dir, exist_ok=True)

    meta = """<?xml version="1.0" encoding="utf-8"?>
<meta>
  <info name="BMW M5 G90 2025" author="RageRP" version="1.0.0" description="Custom BMW M5 G90 sedan based on downloaded detailed source" />
  <file path="stream/bmwm5g90.ydr" />
  <file path="stream/bmwm5g90.ybn" />
  <file path="handling.meta" />
  <file path="vehicles.meta" />
</meta>
"""
    handling = """<?xml version="1.0" encoding="UTF-8"?>
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
  <nMonetaryValue value="140000"/>
</CVehicleHandlingData>
"""
    vehicles = """<?xml version="1.0" encoding="UTF-8"?>
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
    doors = """{
  "model": "bmwm5g90",
  "door_dside_f": {"position": [-0.99, 0.78, 1.02], "open_angle_deg": 68, "hinge_axis": "Y"},
  "door_pside_f": {"position": [0.99, 0.78, 1.02], "open_angle_deg": 68, "hinge_axis": "Y"},
  "door_dside_r": {"position": [-0.99, -0.72, 1.02], "open_angle_deg": 62, "hinge_axis": "Y"},
  "door_pside_r": {"position": [0.99, -0.72, 1.02], "open_angle_deg": 62, "hinge_axis": "Y"},
  "bonnet": {"position": [0.0, 1.92, 1.16], "open_angle_deg": 58, "hinge_axis": "X"},
  "boot": {"position": [0.0, -1.78, 1.15], "open_angle_deg": 48, "hinge_axis": "X"}
}
"""
    for name, content in (
        ("meta.xml", meta),
        ("handling.meta", handling),
        ("vehicles.meta", vehicles),
        ("door_positions.json", doors),
    ):
        with open(os.path.join(output_dir, name), "w", encoding="utf-8") as file:
            file.write(content)
    return stream_dir


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    stream_dir = write_meta(OUTPUT_DIR)

    bpy.ops.wm.open_mainfile(filepath=SOURCE_BLEND)
    SollumType, LODLevel, ArchetypeType, AssetType, create_shader = setup_sollumz()

    floor = bpy.data.objects.get("Preview Studio Floor")
    if floor:
        bpy.data.objects.remove(floor, do_unlink=True)

    root = bpy.data.objects.get("BMW_M5_G90_GTA_ROOT")
    if root:
        root.name = ASSET_NAME

    drawable = bpy.data.objects.new(ASSET_NAME, None)
    bpy.context.collection.objects.link(drawable)
    drawable.sollum_type = SollumType.DRAWABLE
    if root:
        root.parent = drawable

    joined = []
    for collection_name in ("Body", "Interior", "Windows", "Wheels", "Lights", "Details"):
        collection = bpy.data.collections.get(collection_name)
        if collection:
            obj = join_collection(collection, SollumType, LODLevel, create_shader)
            if obj:
                obj.parent = drawable
                joined.append(obj)

    ytyp = bpy.context.scene.ytyps.add()
    ytyp.name = ASSET_NAME
    archetype = ytyp.new_archetype(ArchetypeType.BASE)
    archetype.name = ASSET_NAME
    archetype.asset = drawable
    archetype.asset_type = AssetType.DRAWABLE
    archetype.asset_name = drawable.name
    archetype.lod_dist = 500

    from Sollumz.tools.boundhelper import create_bound_poly_box
    collision = create_bound_poly_box()
    collision.name = "bmwm5g90_collision"
    collision.sollum_type = SollumType.BOUND_POLY_BOX
    collision.location = (0.0, 0.0, 0.75)
    collision.dimensions = (1.98, 5.10, 1.50)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    composite = bpy.data.objects.new("bmwm5g90_collision_composite", None)
    bpy.context.collection.objects.link(composite)
    composite.sollum_type = SollumType.BOUND_COMPOSITE
    collision.parent = composite
    composite.parent = drawable

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
            bundle = export_ybn(composite)
            bundle.save(Path(stream_dir), targets)
    except Exception as error:
        print("RAGEMP_YBN_EXPORT_ERROR", repr(error))

    for version in ("gen8", "gen9"):
        ydr_source = os.path.join(stream_dir, version, ASSET_NAME + ".ydr")
        ydr_target = os.path.join(stream_dir, ASSET_NAME + ".ydr")
        if os.path.isfile(ydr_source) and version == "gen9":
            shutil.copy2(ydr_source, ydr_target)
        ybn_source = os.path.join(stream_dir, version, ASSET_NAME + ".ybn")
        ybn_target = os.path.join(stream_dir, ASSET_NAME + ".ybn")
        if os.path.isfile(ybn_source) and version == "gen9":
            shutil.copy2(ybn_source, ybn_target)

    print("DOWNLOADED_RAGEMP_EXPORT", result)
    print("JOINED_MODEL_GROUPS", [obj.name for obj in joined])
    print("OUTPUT_DIR", OUTPUT_DIR)


if __name__ == "__main__":
    main()
