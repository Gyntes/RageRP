import os
import shutil
import sys
import tempfile
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Vector


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
SOURCE_BLEND = os.path.join(SCRIPT_DIR, "bmw_m5_g90_downloaded_source.blend")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "bmw_m5_g90_yft_build")
ASSET_NAME = "bmwm5g90"
WHEEL_ROOTS = {
    "3DWheel Front L": "wheel_lf",
    "3DWheel Front R": "wheel_rf",
    "3DWheel Rear L": "wheel_lr",
    "3DWheel Rear R": "wheel_rr",
}
DOOR_BONES = ("door_dside_f", "door_pside_f", "door_dside_r", "door_pside_r")
PANEL_BONES = DOOR_BONES + ("bonnet", "boot")
STEERING_BONE = "steeringwheel"
STEERING_SOURCE_CENTER = Vector((0.4, -0.38, 0.94))
STEERING_RADIUS = 0.33
STEERING_DEPTH = 0.14
TOP_PANEL_MESH_TOKENS = (
    "paint_geo",
    "coloured_geo",
    "base_geo",
    "carbon1_geo",
    "carbon2_geo",
    "badge_geo",
)


def setup_sollumz():
    sys.path.insert(0, os.path.join(PROJECT_DIR, "tools"))
    import addon_utils

    addon_utils.enable("Sollumz", default_set=True, persistent=True)
    from Sollumz.sollumz_properties import LODLevel, SollumType
    from Sollumz.tools.blenderhelper import add_armature_modifier, add_child_of_bone_constraint
    from Sollumz.tools.boundhelper import create_bound_box
    from Sollumz.tools.drawablehelper import set_recommended_bone_properties
    from Sollumz.ybn.collision_materials import create_collision_material_from_index
    from Sollumz.ydr.gta5.shader_materials import create_shader

    return (
        SollumType,
        LODLevel,
        add_armature_modifier,
        add_child_of_bone_constraint,
        create_bound_box,
        set_recommended_bone_properties,
        create_collision_material_from_index,
        create_shader,
    )


def get_descendants(obj):
    result = []
    stack = list(obj.children)
    while stack:
        child = stack.pop()
        result.append(child)
        stack.extend(child.children)
    return result


def mesh_descendants(obj):
    return [
        child for child in get_descendants(obj)
        if child.type == "MESH" and len(child.data.vertices) > 0
    ]


def set_active_and_select(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def convert_source_materials(create_shader):
    embedded_texture_count = 0
    with tempfile.TemporaryDirectory(prefix="bmwm5_texture_", dir=SCRIPT_DIR) as staging_dir:
        for material in bpy.data.materials:
            name = material.name.lower()
            source_textures = []
            if material.node_tree:
                for node in material.node_tree.nodes:
                    if node.type != "TEX_IMAGE" or node.image is None:
                        continue
                    image = node.image
                    image_path = bpy.path.abspath(image.filepath)
                    if not os.path.isfile(image_path):
                        raise FileNotFoundError(f"Source texture for '{material.name}' is missing: {image_path}")
                    if not image.has_data:
                        staged_path = os.path.join(
                            staging_dir,
                            f"texture_{len(bpy.data.images)}_{len(source_textures)}"
                            f"{os.path.splitext(image_path)[1].lower()}",
                        )
                        shutil.copy2(image_path, staged_path)
                        image.filepath = staged_path
                        image.reload()
                        if image.size[0] > 0 and image.size[1] > 0:
                            image.pixels[0]
                    if not image.has_data:
                        raise RuntimeError(f"Blender could not load source texture: {image_path}")
                    image.pack()
                    image.filepath = image_path
                    source_textures.append((image, os.path.basename(image_path).lower()))

            if "window" in name or "glass" in name:
                shader_name = "vehicle_vehglass.sps"
            elif "light" in name or "emis" in name:
                shader_name = "vehicle_lightsemissive.sps"
            elif "interior" in name or "seatbelt" in name or "tilling" in name:
                shader_name = "vehicle_interior.sps"
            elif "wheel" in name or "tire" in name:
                shader_name = "vehicle_tire.sps"
            elif "paint" in name:
                shader_name = "vehicle_paint1.sps"
            else:
                shader_name = "vehicle_mesh.sps"
            create_shader(shader_name, in_place_material=material)

            samplers = {
                node.name: node for node in material.node_tree.nodes
                if node.type == "TEX_IMAGE"
            }
            for image, filename in source_textures:
                sampler_name = "BumpSampler" if "normal" in filename else "DiffuseSampler"
                sampler = samplers.get(sampler_name)
                if sampler is None:
                    continue
                sampler.image = image
                sampler.texture_properties.embedded = True
                if sampler_name == "BumpSampler":
                    image.colorspace_settings.is_data = True
                embedded_texture_count += 1

    if embedded_texture_count == 0:
        raise RuntimeError("No source texture images could be assigned to GTA shader samplers")
    return embedded_texture_count


def create_texture_conversion_session(fragment, compressor_path):
    if not compressor_path or not os.path.isfile(compressor_path):
        raise RuntimeError(
            "Set COMPRESSONATOR_CLI to the verified Compressonator CLI executable before exporting textures"
        )

    from Sollumz.sollumz_operators import _collect_texture_compression_items
    from Sollumz.sollumz_preferences import get_addon_preferences
    from Sollumz.shared.texture_compressor.session import TextureConversionSession

    preferences = get_addon_preferences(bpy.context)
    preferences.texture_compressor.compressor = "COMPRESSONATOR"
    preferences.texture_compressor.compressonator_executable_path = compressor_path
    preferences.texture_compressor.cache_directory = ""
    session = TextureConversionSession(preferences.texture_compressor.to_settings())
    items = _collect_texture_compression_items(bpy.context, [fragment], [])
    if not items:
        raise RuntimeError("No embedded textures were collected for DDS conversion")
    session.prepare(items)

    unconverted = [
        texture_name for image, texture_name, _parameter_name, _preset in items
        if not image.packed_file or image.packed_file.data[:4] != b"DDS "
        if session.get(image, texture_name) is None
    ]
    if unconverted:
        raise RuntimeError("DDS conversion failed for embedded textures: " + ", ".join(sorted(set(unconverted))))
    return session


def ensure_model_lod(obj, SollumType, LODLevel):
    obj.sollum_type = SollumType.DRAWABLE_MODEL
    uv_source = obj.data.uv_layers.get("UVMap 0")
    if uv_source is None:
        if obj.data.uv_layers:
            uv_source = obj.data.uv_layers[0]
            uv_source.name = "UVMap 0"
        else:
            uv_source = obj.data.uv_layers.new(name="UVMap 0")
    for uv_name in ("UVMap 1", "UVMap 2"):
        if obj.data.uv_layers.get(uv_name) is None:
            uv_layer = obj.data.uv_layers.new(name=uv_name)
            if len(uv_layer.data) == len(uv_source.data):
                uv_values = [0.0] * (len(uv_source.data) * 2)
                uv_source.data.foreach_get("uv", uv_values)
                uv_layer.data.foreach_set("uv", uv_values)
    if obj.data.color_attributes.get("Color 1") is None:
        color_attr = obj.data.color_attributes.new(name="Color 1", type="BYTE_COLOR", domain="CORNER")
        color_attr.data.foreach_set("color", [1.0] * (len(color_attr.data) * 4))
    obj.sz_lods.active_lod_level = LODLevel.HIGH.value
    obj.sz_lods.get_lod(LODLevel.HIGH).mesh = obj.data
    for poly in obj.data.polygons:
        poly.use_smooth = True


def join_model(meshes, name, drawable, SollumType, LODLevel, anchor=None):
    if not meshes:
        return None
    if len(meshes) == 1:
        obj = meshes[0]
    else:
        set_active_and_select(meshes)
        bpy.ops.object.join()
        obj = bpy.context.object
    obj.name = name
    obj.parent = drawable
    ensure_model_lod(obj, SollumType, LODLevel)

    if anchor is not None:
        old_world = obj.matrix_world.copy()
        new_world = anchor.matrix_world.copy()
        obj.data.transform(new_world.inverted() @ old_world)
        obj.matrix_world = new_world

    return obj


def object_world_bounds(obj, face_indices=None):
    vertex_indices = set()
    polygons = obj.data.polygons
    if face_indices is None:
        face_indices = range(len(polygons))
    for face_index in face_indices:
        vertex_indices.update(polygons[face_index].vertices)
    if not vertex_indices:
        return None

    points = [obj.matrix_world @ obj.data.vertices[index].co for index in vertex_indices]
    minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    return minimum, maximum


def merge_bounds(current, addition):
    if current is None:
        return addition
    return (
        Vector(tuple(min(current[0][axis], addition[0][axis]) for axis in range(3))),
        Vector(tuple(max(current[1][axis], addition[1][axis]) for axis in range(3))),
    )


def classify_door_bounds(minimum, maximum):
    if maximum.x - minimum.x > 0.55 or minimum.z < 0.25 or maximum.z > 1.55:
        return None
    if minimum.x >= 0.50:
        side = "pside"
    elif maximum.x <= -0.50:
        side = "dside"
    else:
        return None

    center_y = (minimum.y + maximum.y) * 0.5
    if minimum.y >= -0.45 and maximum.y <= 1.05 and center_y > -0.20:
        return f"door_{side}_f"
    if minimum.y >= -1.48 and maximum.y <= -0.08 and center_y <= -0.20:
        return f"door_{side}_r"
    return None


def connected_face_components(mesh):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.faces.ensure_lookup_table()
    unseen = set(bm.faces)
    components = []
    while unseen:
        start = unseen.pop()
        stack = [start]
        faces = [start.index]
        vertices = set(start.verts)
        while stack:
            face = stack.pop()
            for edge in face.edges:
                for linked_face in edge.link_faces:
                    if linked_face in unseen:
                        unseen.remove(linked_face)
                        stack.append(linked_face)
                        faces.append(linked_face.index)
                        vertices.update(linked_face.verts)
        components.append((faces, [vertex.index for vertex in vertices]))
    bm.free()
    return components


def panel_faces_for_object(obj, top_panel_mesh):
    face_indices = {bone_name: set() for bone_name in PANEL_BONES}
    mesh = obj.data

    for faces, vertices in connected_face_components(mesh):
        points = [obj.matrix_world @ mesh.vertices[index].co for index in vertices]
        minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
        maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
        bone_name = classify_door_bounds(minimum, maximum)
        if bone_name is not None:
            face_indices[bone_name].update(faces)

    if top_panel_mesh:
        assigned_faces = set().union(*face_indices.values())
        normal_matrix = obj.matrix_world.to_3x3()
        for polygon in mesh.polygons:
            if polygon.index in assigned_faces:
                continue
            center = obj.matrix_world @ polygon.center
            normal = (normal_matrix @ polygon.normal).normalized()
            if abs(center.x) >= 0.68 or normal.z <= 0.72 or center.z > 1.15:
                continue
            if 1.00 < center.y < 2.50 and center.z > 0.78:
                face_indices["bonnet"].add(polygon.index)
            elif -2.40 < center.y < -1.00 and center.z > 0.68:
                face_indices["boot"].add(polygon.index)

    return {name: faces for name, faces in face_indices.items() if faces}


def retain_faces(mesh, keep_faces):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.faces.ensure_lookup_table()
    delete_faces = [face for face in bm.faces if face.index not in keep_faces]
    if delete_faces:
        bmesh.ops.delete(bm, geom=delete_faces, context="FACES")
    loose_vertices = [vertex for vertex in bm.verts if not vertex.link_faces]
    if loose_vertices:
        bmesh.ops.delete(bm, geom=loose_vertices, context="VERTS")
    bm.to_mesh(mesh)
    bm.free()


def extract_panel_geometry(body_meshes, steering_center):
    panel_objects = {bone_name: [] for bone_name in PANEL_BONES}
    steering_objects = []
    static_meshes = []
    panel_bounds = {bone_name: None for bone_name in PANEL_BONES}
    face_counts = {bone_name: 0 for bone_name in PANEL_BONES}
    steering_bounds = None
    steering_face_count = 0

    for source_obj in body_meshes:
        top_panel_mesh = any(token in source_obj.name.lower() for token in TOP_PANEL_MESH_TOKENS)
        assignments = panel_faces_for_object(source_obj, top_panel_mesh)
        assigned_faces = set().union(*assignments.values()) if assignments else set()
        steering_faces = set()
        if "interior_geo" in source_obj.name.lower():
            for polygon in source_obj.data.polygons:
                if polygon.index in assigned_faces:
                    continue
                center = source_obj.matrix_world @ polygon.center
                radius = ((center.x - steering_center.x) ** 2 + (center.z - steering_center.z) ** 2) ** 0.5
                if abs(center.y - steering_center.y) <= STEERING_DEPTH and radius <= STEERING_RADIUS:
                    steering_faces.add(polygon.index)

        if not assigned_faces and not steering_faces:
            static_meshes.append(source_obj)
            continue

        if steering_faces:
            steering_mesh = source_obj.data.copy()
            retain_faces(steering_mesh, steering_faces)
            if not len(steering_mesh.polygons):
                bpy.data.meshes.remove(steering_mesh)
                raise RuntimeError(f"Failed to extract {STEERING_BONE} geometry from '{source_obj.name}'")
            steering_obj = bpy.data.objects.new(source_obj.name + "." + STEERING_BONE, steering_mesh)
            bpy.context.scene.collection.objects.link(steering_obj)
            steering_obj.matrix_world = source_obj.matrix_world.copy()
            steering_objects.append(steering_obj)
            steering_bounds = merge_bounds(steering_bounds, object_world_bounds(steering_obj))
            steering_face_count += len(steering_faces)
            assigned_faces.update(steering_faces)

        for bone_name, faces in assignments.items():
            if not faces:
                continue
            part_mesh = source_obj.data.copy()
            retain_faces(part_mesh, faces)
            if not len(part_mesh.polygons):
                bpy.data.meshes.remove(part_mesh)
                raise RuntimeError(f"Failed to extract {bone_name} geometry from '{source_obj.name}'")
            part_obj = bpy.data.objects.new(
                source_obj.name + "." + bone_name,
                part_mesh,
            )
            bpy.context.scene.collection.objects.link(part_obj)
            part_obj.matrix_world = source_obj.matrix_world.copy()
            panel_objects[bone_name].append(part_obj)
            panel_bounds[bone_name] = merge_bounds(
                panel_bounds[bone_name],
                object_world_bounds(part_obj),
            )
            face_counts[bone_name] += len(faces)

        remaining_mesh = source_obj.data.copy()
        retain_faces(remaining_mesh, set(range(len(source_obj.data.polygons))) - assigned_faces)
        if len(remaining_mesh.polygons):
            source_obj.data = remaining_mesh
            static_meshes.append(source_obj)
        else:
            bpy.data.meshes.remove(remaining_mesh)
            bpy.data.objects.remove(source_obj, do_unlink=True)

    required_faces = {
        "door_dside_f": 500,
        "door_pside_f": 500,
        "door_dside_r": 500,
        "door_pside_r": 500,
        "bonnet": 300,
        "boot": 300,
    }
    missing = [
        name for name, minimum in required_faces.items()
        if face_counts[name] < minimum or not panel_objects[name]
    ]
    if missing:
        raise RuntimeError(
            "Source geometry could not be separated into complete movable panels: "
            + ", ".join(f"{name} ({face_counts[name]} faces)" for name in missing)
        )
    if steering_face_count < 1000 or not steering_objects or steering_bounds is None:
        raise RuntimeError(
            f"Could not isolate complete {STEERING_BONE} geometry "
            f"({steering_face_count} faces selected)"
        )
    return (
        static_meshes,
        panel_objects,
        panel_bounds,
        face_counts,
        steering_objects,
        steering_bounds,
        steering_face_count,
    )


def panel_hinge_locations(panel_bounds):
    locations = {}
    for bone_name in DOOR_BONES:
        minimum, maximum = panel_bounds[bone_name]
        side = -1.0 if "_dside_" in bone_name else 1.0
        is_front = bone_name.endswith("_f")
        hinge_y = maximum.y if is_front else minimum.y
        locations[bone_name] = Vector((side * 0.93, hinge_y, 0.74))

    bonnet_minimum, bonnet_maximum = panel_bounds["bonnet"]
    locations["bonnet"] = Vector((0.0, bonnet_minimum.y, max(0.94, bonnet_maximum.z - 0.04)))
    boot_minimum, boot_maximum = panel_bounds["boot"]
    locations["boot"] = Vector((0.0, boot_maximum.y, max(0.88, boot_maximum.z - 0.04)))
    return locations


def set_rotation_limit(pose_bone, axis, maximum):
    constraint = pose_bone.constraints.new("LIMIT_ROTATION")
    constraint.owner_space = "LOCAL"
    for axis_name in ("x", "y", "z"):
        use_limit = axis_name == axis
        setattr(constraint, "use_limit_" + axis_name, use_limit)
        setattr(constraint, "min_" + axis_name, -maximum if use_limit else 0.0)
        setattr(constraint, "max_" + axis_name, maximum if use_limit else 0.0)


def create_bones(
    fragment,
    source_wheels,
    panel_hinges,
    steering_pivot,
    set_recommended_bone_properties,
):
    armature = fragment.data
    bpy.context.view_layer.objects.active = fragment
    fragment.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    bones = {}
    chassis = armature.edit_bones.new("chassis")
    chassis.head = (0.0, 0.0, 0.72)
    chassis.tail = (0.0, 0.08, 0.72)
    bones["chassis"] = chassis

    vehicle_bones = {
        "chassis_dummy": (0.0, 0.0, 0.72),
        "seat_dside_f": (-0.38, 0.62, 0.48),
        "seat_pside_f": (0.38, 0.62, 0.48),
        "seat_dside_r": (-0.38, -0.78, 0.48),
        "seat_pside_r": (0.38, -0.78, 0.48),
        "seat_centre_r": (0.0, -0.78, 0.48),
        **{name: tuple(panel_hinges[name]) for name in PANEL_BONES},
        STEERING_BONE: tuple(steering_pivot),
    }
    for bone_name, location in vehicle_bones.items():
        bone = armature.edit_bones.new(bone_name)
        bone.head = location
        bone.tail = (location[0], location[1] + 0.06, location[2])
        bone.parent = chassis
        bones[bone_name] = bone

    for source_name, bone_name in WHEEL_ROOTS.items():
        pivot = source_wheels[source_name].matrix_world.translation
        bone = armature.edit_bones.new(bone_name)
        bone.head = pivot
        bone.tail = (pivot.x, pivot.y + 0.06, pivot.z)
        bone.parent = chassis
        bones[bone_name] = bone

    bpy.ops.object.mode_set(mode="OBJECT")
    for bone in fragment.data.bones:
        set_recommended_bone_properties(bone)

    for bone_name in DOOR_BONES:
        set_rotation_limit(fragment.pose.bones[bone_name], "z", 1.20)
    set_rotation_limit(fragment.pose.bones["bonnet"], "x", 1.05)
    set_rotation_limit(fragment.pose.bones["boot"], "x", 0.85)
    return bones


def create_collision(
    composite,
    fragment,
    bone_name,
    name,
    location,
    dimensions,
    mass,
    create_bound_box,
    create_collision_material,
    add_child_of_bone_constraint,
):
    bound = create_bound_box()
    bound.name = name
    bound.location = location
    bound.dimensions = dimensions
    bound.data.materials.append(create_collision_material(0))
    bound.parent = composite
    bound.child_properties.mass = mass
    bound.child_properties.shattermap_mode = "NO"
    add_child_of_bone_constraint(bound, fragment, bone_name)
    return bound


def main():
    if not os.path.isfile(SOURCE_BLEND):
        raise FileNotFoundError(SOURCE_BLEND)

    bpy.ops.wm.open_mainfile(filepath=SOURCE_BLEND)
    (
        SollumType,
        LODLevel,
        add_armature_modifier,
        add_child_of_bone_constraint,
        create_bound_box,
        set_recommended_bone_properties,
        create_collision_material,
        create_shader,
    ) = setup_sollumz()

    root = bpy.data.objects.get("BMW_M5_G90_GTA_ROOT")
    if root is None:
        raise RuntimeError("The downloaded BMW source root is missing")

    source_root_matrix = root.matrix_world.copy()
    root.rotation_mode = "XYZ"
    root.rotation_euler.z += 3.141592653589793
    bpy.context.view_layer.update()
    steering_pivot = root.matrix_world @ source_root_matrix.inverted() @ STEERING_SOURCE_CENTER

    source_wheels = {name: bpy.data.objects.get(name) for name in WHEEL_ROOTS}
    if any(obj is None for obj in source_wheels.values()):
        raise RuntimeError("One or more wheel pivots are missing from the source model")

    wheel_meshes = {name: mesh_descendants(obj) for name, obj in source_wheels.items()}
    if any(not meshes for meshes in wheel_meshes.values()):
        raise RuntimeError("One or more source wheel pivots have no mesh geometry")

    wheel_objects = set()
    for meshes in wheel_meshes.values():
        wheel_objects.update(meshes)
    all_source_meshes = [
        obj for obj in bpy.context.scene.objects
        if obj.type == "MESH" and len(obj.data.vertices) > 0
        and obj.name != "Preview Studio Floor"
    ]
    source_body_meshes = [obj for obj in all_source_meshes if obj not in wheel_objects]
    if not source_body_meshes:
        raise RuntimeError("No body geometry was found in the source model")

    embedded_texture_count = convert_source_materials(create_shader)
    (
        body_meshes,
        panel_objects,
        panel_bounds,
        panel_face_counts,
        steering_objects,
        steering_bounds,
        steering_face_count,
    ) = extract_panel_geometry(source_body_meshes, steering_pivot)
    panel_hinges = panel_hinge_locations(panel_bounds)

    os.makedirs(os.path.join(OUTPUT_DIR, "stream", "gen8"), exist_ok=True)
    fragment = bpy.data.objects.new(ASSET_NAME, bpy.data.armatures.new(ASSET_NAME + "_skeleton"))
    bpy.context.scene.collection.objects.link(fragment)
    fragment.sollum_type = SollumType.FRAGMENT

    drawable = bpy.data.objects.new(ASSET_NAME + ".drawable", None)
    bpy.context.scene.collection.objects.link(drawable)
    drawable.sollum_type = SollumType.DRAWABLE
    drawable.parent = fragment

    composite = bpy.data.objects.new(ASSET_NAME + ".collision", None)
    bpy.context.scene.collection.objects.link(composite)
    composite.sollum_type = SollumType.BOUND_COMPOSITE
    composite.parent = fragment

    create_bones(
        fragment,
        source_wheels,
        panel_hinges,
        steering_pivot,
        set_recommended_bone_properties,
    )

    body = join_model(body_meshes, ASSET_NAME + ".body", drawable, SollumType, LODLevel)
    if body is None:
        raise RuntimeError("Failed to combine the static body geometry")

    wheel_models = {}
    for source_name, bone_name in WHEEL_ROOTS.items():
        pivot = source_wheels[source_name]
        wheel = join_model(
            wheel_meshes[source_name],
            ASSET_NAME + "." + bone_name,
            drawable,
            SollumType,
            LODLevel,
            anchor=pivot,
        )
        wheel.sollumz_is_physics_child_mesh = True
        add_child_of_bone_constraint(wheel, fragment, bone_name)
        wheel_models[bone_name] = wheel

    panel_models = {}
    for bone_name in PANEL_BONES:
        anchor = bpy.data.objects.new(ASSET_NAME + "." + bone_name + ".hinge", None)
        bpy.context.scene.collection.objects.link(anchor)
        anchor.matrix_world = Matrix.Translation(panel_hinges[bone_name])
        model = join_model(
            panel_objects[bone_name],
            ASSET_NAME + "." + bone_name,
            drawable,
            SollumType,
            LODLevel,
            anchor=anchor,
        )
        bpy.data.objects.remove(anchor, do_unlink=True)
        if model is None:
            raise RuntimeError(f"No extracted drawable geometry for {bone_name}")
        model.sollumz_is_physics_child_mesh = True
        add_child_of_bone_constraint(model, fragment, bone_name)
        panel_models[bone_name] = model

    steering_anchor = bpy.data.objects.new(ASSET_NAME + "." + STEERING_BONE + ".pivot", None)
    bpy.context.scene.collection.objects.link(steering_anchor)
    steering_anchor.matrix_world = Matrix.Translation(steering_pivot)
    steering_model = join_model(
        steering_objects,
        ASSET_NAME + "." + STEERING_BONE,
        drawable,
        SollumType,
        LODLevel,
        anchor=steering_anchor,
    )
    bpy.data.objects.remove(steering_anchor, do_unlink=True)
    if steering_model is None:
        raise RuntimeError(f"No extracted drawable geometry for {STEERING_BONE}")
    steering_weights = steering_model.vertex_groups.new(name=STEERING_BONE)
    steering_weights.add(
        [vertex.index for vertex in steering_model.data.vertices],
        1.0,
        "REPLACE",
    )
    add_armature_modifier(steering_model, fragment)

    for bone in fragment.data.bones:
        if bone.name in wheel_models or bone.name in panel_models:
            bone.sollumz_use_physics = True
        if bone.name == "chassis":
            bone.sollumz_use_physics = True

    collision_bounds = [create_collision(
        composite, fragment, "chassis", ASSET_NAME + ".collision.chassis",
        (0.0, 0.0, 0.72), (1.90, 4.90, 1.20),
        2250.0,
        create_bound_box, create_collision_material, add_child_of_bone_constraint,
    )]
    for bone_name, wheel in wheel_models.items():
        pivot = source_wheels[next(name for name, value in WHEEL_ROOTS.items() if value == bone_name)]
        collision_bounds.append(create_collision(
            composite, fragment, bone_name, ASSET_NAME + ".collision." + bone_name,
            pivot.matrix_world.translation, (0.72, 0.72, 0.72),
            35.0,
            create_bound_box, create_collision_material, add_child_of_bone_constraint,
        ))
    for bone_name in PANEL_BONES:
        minimum, maximum = panel_bounds[bone_name]
        center = (minimum + maximum) * 0.5
        dimensions = maximum - minimum
        dimensions = tuple(max(value, 0.12) for value in dimensions)
        collision_bounds.append(create_collision(
            composite, fragment, bone_name, ASSET_NAME + ".collision." + bone_name,
            center, dimensions, 12.0 if bone_name in ("bonnet", "boot") else 25.0,
            create_bound_box, create_collision_material, add_child_of_bone_constraint,
        ))

    for obj in list(bpy.data.objects):
        keep_objects = (
            {fragment, drawable, composite, body}
            | set(wheel_models.values())
            | set(panel_models.values())
            | {steering_model}
            | set(collision_bounds)
        )
        if obj in keep_objects:
            continue
        bpy.data.objects.remove(obj, do_unlink=True)

    from Sollumz.iecontext import ExportContext, ExportSettings, export_context_scope
    from szio.gta5 import AssetFormat, AssetTarget, AssetVersion
    from Sollumz.yft.yftexport import export_yft

    targets = (AssetTarget(AssetFormat.NATIVE, AssetVersion.GEN8),)
    settings = ExportSettings(targets=targets)
    compressor_path = os.environ.get("COMPRESSONATOR_CLI")
    texture_session = create_texture_conversion_session(fragment, compressor_path)
    try:
        with export_context_scope(ExportContext(ASSET_NAME, settings, textures=texture_session)):
            bundle = export_yft(fragment)
            bundle.save(Path(OUTPUT_DIR, "stream", "gen8"), targets)
    finally:
        texture_session.cleanup()

    output_file = Path(OUTPUT_DIR, "stream", "gen8", ASSET_NAME + ".yft")
    if not output_file.is_file() or output_file.stat().st_size < 4096:
        raise RuntimeError("YFT export did not produce a non-empty fragment asset")

    from szio.gta5 import AssetType, try_load_asset

    exported_asset = try_load_asset(output_file)
    if exported_asset is None or exported_asset.ASSET_TYPE != AssetType.FRAGMENT:
        raise RuntimeError("Sollumz could not read back the generated YFT fragment")
    if exported_asset.physics is None or exported_asset.physics.lod1 is None:
        raise RuntimeError("The generated YFT does not contain a physics LOD")
    if len(exported_asset.drawable.shader_group.embedded_textures) < 10:
        raise RuntimeError("The generated YFT does not contain the source vehicle textures")
    physics_groups = {group.name: group for group in exported_asset.physics.lod1.groups}
    physics_children = exported_asset.physics.lod1.children
    wheel_child_count = 0
    for bone_name in WHEEL_ROOTS.values():
        group = physics_groups.get(bone_name)
        if group is None:
            raise RuntimeError(f"The generated YFT is missing the {bone_name} physics group")
        child = next(
            (child for child in physics_children if child.group_index == exported_asset.physics.lod1.groups.index(group)),
            None,
        )
        if child is None or child.drawable is None or not any(child.drawable.models.values()):
            raise RuntimeError(f"The generated YFT is missing the {bone_name} wheel drawable")
        wheel_child_count += 1
    if wheel_child_count != len(WHEEL_ROOTS):
        raise RuntimeError(f"Expected {len(WHEEL_ROOTS)} wheel drawables, found {wheel_child_count}")
    panel_child_count = 0
    for bone_name in PANEL_BONES:
        group = physics_groups.get(bone_name)
        if group is None:
            raise RuntimeError(f"The generated YFT is missing the {bone_name} physics group")
        child = next(
            (child for child in physics_children if child.group_index == exported_asset.physics.lod1.groups.index(group)),
            None,
        )
        if child is None or child.drawable is None or not any(child.drawable.models.values()):
            raise RuntimeError(f"The generated YFT is missing the {bone_name} panel drawable")
        panel_child_count += 1
    if panel_child_count != len(PANEL_BONES):
        raise RuntimeError(f"Expected {len(PANEL_BONES)} movable panels, found {panel_child_count}")
    skeleton_bones = {bone.name: bone for bone in exported_asset.drawable.skeleton.bones}
    if any(name not in skeleton_bones for name in PANEL_BONES + (STEERING_BONE,)):
        raise RuntimeError("The YFT is missing one or more required vehicle bones")
    steering_drawables = [
        model
        for lod_models in exported_asset.drawable.models.values()
        for model in lod_models
        if model.has_skin
    ]
    if not steering_drawables or not any(model.geometries for model in steering_drawables):
        raise RuntimeError(f"The YFT has no drawable geometry attached to {STEERING_BONE}")

    blend_path = Path(OUTPUT_DIR, ASSET_NAME + "_fragment.blend")
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    print("BMW_YFT_BUILD_OK", output_file, output_file.stat().st_size)
    print("BMW_YFT_BLEND", blend_path)
    print("BMW_STATIC_MESHES", len(body_meshes))
    print("BMW_WHEEL_MESHES", {name: len(meshes) for name, meshes in wheel_meshes.items()})
    print("BMW_PANEL_FACE_COUNTS", panel_face_counts)
    print("BMW_PANEL_HINGES", {name: tuple(round(value, 3) for value in location) for name, location in panel_hinges.items()})
    print("BMW_STEERING_FACES", steering_face_count)
    print("BMW_STEERING_PIVOT", tuple(round(value, 3) for value in steering_pivot))
    print("BMW_EMBEDDED_TEXTURES", embedded_texture_count)
    print("BMW_ROUNDTRIP_TEXTURES", len(exported_asset.drawable.shader_group.embedded_textures))
    print("BMW_ROUNDTRIP_WHEELS", wheel_child_count)
    print("BMW_ROUNDTRIP_PANELS", panel_child_count)
    print("BMW_ROUNDTRIP_STEERING_MODELS", len(steering_drawables))


if __name__ == "__main__":
    main()
