import os
import sys
from pathlib import Path

import bpy
import numpy as np


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
YFT_PATH = Path(SCRIPT_DIR, "bmw_m5_g90_yft_build", "stream", "gen8", "bmwm5g90.yft")

sys.path.insert(0, os.path.join(PROJECT_DIR, "tools"))
import addon_utils

addon_utils.enable("Sollumz", default_set=True, persistent=True)

from szio.gta5 import AssetType, try_load_asset

asset = try_load_asset(YFT_PATH)
if asset is None:
    raise RuntimeError("Sollumz could not parse the generated YFT")
if asset.ASSET_TYPE != AssetType.FRAGMENT:
    raise RuntimeError("The generated file is not a GTA fragment")
if asset.drawable is None or asset.drawable.skeleton is None:
    raise RuntimeError("The YFT is missing its drawable skeleton")
if asset.physics is None or asset.physics.lod1 is None:
    raise RuntimeError("The YFT is missing its vehicle physics LOD")

lod = asset.physics.lod1
embedded_textures = asset.drawable.shader_group.embedded_textures
models = [model for level_models in asset.drawable.models.values() for model in level_models]
geometry_count = sum(len(model.geometries) for model in models)
bone_names = {bone.name for bone in asset.drawable.skeleton.bones}
static_models = [
    model for model in models
    if not model.has_skin and model.geometries
]
if not static_models:
    raise RuntimeError("The YFT is missing its static vehicle body")
body_positions = np.concatenate([
    geometry.vertex_buffer["Position"]
    for model in static_models
    for geometry in model.geometries
])
body_dimensions = body_positions.max(axis=0) - body_positions.min(axis=0)
if body_dimensions[0] < 1.0 or body_dimensions[1] < 4.0 or body_dimensions[2] < 0.8:
    raise RuntimeError(
        "The YFT static body is smaller than the vehicle: "
        + ", ".join(f"{dimension:.3f} m" for dimension in body_dimensions)
    )
groups = {group.name: (index, group) for index, group in enumerate(lod.groups)}
children_by_group = {child.group_index: child for child in lod.children}
wheel_bones = ("wheel_lf", "wheel_rf", "wheel_lr", "wheel_rr")
panel_bones = (
    "door_dside_f",
    "door_pside_f",
    "door_dside_r",
    "door_pside_r",
    "bonnet",
    "boot",
)
steering_bone = "steeringwheel"
if not set(wheel_bones + panel_bones + (steering_bone,)).issubset(bone_names):
    raise RuntimeError("The YFT is missing one or more standard wheel, panel, or steering bones")
if len(lod.groups) < 11:
    raise RuntimeError("The YFT is missing chassis, wheel, or panel physics groups")

def verify_moving_drawables(bone_names, label):
    for bone_name in bone_names:
        group = groups.get(bone_name)
        if group is None:
            raise RuntimeError(f"The YFT is missing the {bone_name} physics group")
        child = children_by_group.get(group[0])
        if child is None or child.drawable is None or not any(child.drawable.models.values()):
            raise RuntimeError(f"The YFT is missing the {bone_name} {label} drawable")

verify_moving_drawables(wheel_bones, "wheel")
verify_moving_drawables(panel_bones, "panel")
if not any(model.has_skin for model in models):
    raise RuntimeError("The YFT is missing the skinned steering-wheel drawable")
if geometry_count == 0:
    raise RuntimeError("The YFT drawable has no geometry")
if len(embedded_textures) < 10:
    raise RuntimeError("The YFT is missing most of its source textures")

print("BMW_YFT_ROUNDTRIP_OK")
print("ASSET_TYPE", asset.ASSET_TYPE)
print("BONES", len(asset.drawable.skeleton.bones))
print("PHYSICS_GROUPS", len(lod.groups))
print("PHYSICS_CHILDREN", len(lod.children))
print("WHEEL_DRAWABLES", len(wheel_bones))
print("PANEL_DRAWABLES", len(panel_bones))
print("EMBEDDED_TEXTURES", len(embedded_textures))
print("BODY_DIMENSIONS", tuple(round(float(value), 3) for value in body_dimensions))
print("MODELS", len(models))
print("GEOMETRIES", geometry_count)
