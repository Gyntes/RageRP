import math
import os
import xml.etree.ElementTree as ET
import json

import bpy


ORIGIN_LON = 37.6175
ORIGIN_LAT = 54.1930
DISTANCE_SCALE = 0.5
METERS_PER_LAT = 111320.0
METERS_PER_LON = METERS_PER_LAT * math.cos(math.radians(ORIGIN_LAT))

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_PATH = os.path.join(SCRIPT_DIR, "source", "tula_pilot.osm")
OUTPUT_OBJ = os.path.join(SCRIPT_DIR, "tula_pilot_greybox_compact.obj")
OUTPUT_BLEND = os.path.join(SCRIPT_DIR, "tula_pilot_greybox_compact.blend")
OUTPUT_MANIFEST = os.path.join(SCRIPT_DIR, "tula_pilot_compact_manifest.json")


def to_local(lon, lat):
    return (
        (lon - ORIGIN_LON) * METERS_PER_LON * DISTANCE_SCALE,
        (lat - ORIGIN_LAT) * METERS_PER_LAT * DISTANCE_SCALE,
    )


def parse_float_tag(tags, keys):
    for key in keys:
        value = tags.get(key)
        if not value:
            continue
        value = value.strip().lower().replace("m", "")
        try:
            return float(value)
        except ValueError:
            pass
    return None


def building_height(tags):
    height = parse_float_tag(tags, ("height",))
    if height is not None:
        return max(2.0, min(height, 180.0))

    levels = parse_float_tag(tags, ("building:levels", "levels"))
    if levels is not None:
        return max(3.0, min(levels * 3.2, 180.0))

    if tags.get("building") in ("church", "cathedral", "temple"):
        return 18.0
    return 8.0


def road_width(tags):
    highway = tags.get("highway", "")
    return {
        "motorway": 18.0,
        "trunk": 15.0,
        "primary": 12.0,
        "secondary": 9.0,
        "tertiary": 7.0,
        "residential": 6.0,
        "unclassified": 6.0,
        "service": 3.5,
        "track": 3.5,
        "pedestrian": 4.0,
        "footway": 2.0,
        "cycleway": 2.5,
    }.get(highway, 4.0)


def tag_map(element):
    return {
        tag.attrib["k"]: tag.attrib.get("v", "")
        for tag in element.findall("tag")
    }


def create_object(name, vertices, faces):
    if not vertices or not faces:
        return None

    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def append_extruded_polygon(vertices, faces, points, height):
    if len(points) < 3:
        return

    start = len(vertices)
    for x, y in points:
        vertices.append((x, y, 0.0))
    for x, y in points:
        vertices.append((x, y, height))

    count = len(points)
    faces.append(tuple(start + i for i in range(count)))
    faces.append(tuple(start + count + i for i in range(count)))
    for i in range(count):
        next_i = (i + 1) % count
        faces.append((
            start + i,
            start + next_i,
            start + count + next_i,
            start + count + i,
        ))


def append_ribbon(vertices, faces, points, width, z):
    if len(points) < 2:
        return

    half_width = width * 0.5 * DISTANCE_SCALE
    left = []
    right = []
    for i, (x, y) in enumerate(points):
        if i == 0:
            dx = points[1][0] - x
            dy = points[1][1] - y
        elif i == len(points) - 1:
            dx = x - points[i - 1][0]
            dy = y - points[i - 1][1]
        else:
            dx = points[i + 1][0] - points[i - 1][0]
            dy = points[i + 1][1] - points[i - 1][1]

        length = math.hypot(dx, dy)
        if length <= 1e-6:
            continue
        nx = -dy / length * half_width
        ny = dx / length * half_width
        left.append((x + nx, y + ny))
        right.append((x - nx, y - ny))

    if len(left) != len(points) or len(right) != len(points):
        return

    start = len(vertices)
    for lx, ly in left:
        vertices.append((lx, ly, z))
    for rx, ry in right:
        vertices.append((rx, ry, z))

    count = len(points)
    for i in range(count - 1):
        faces.append((start + i, start + i + 1, start + count + i + 1, start + count + i))


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    tree = ET.parse(SOURCE_PATH)
    root = tree.getroot()

    nodes = {}
    for node in root.findall("node"):
        node_id = node.attrib["id"]
        nodes[node_id] = to_local(
            float(node.attrib["lon"]),
            float(node.attrib["lat"]),
        )

    building_vertices = []
    building_faces = []
    road_vertices = []
    road_faces = []
    water_vertices = []
    water_faces = []
    rail_vertices = []
    rail_faces = []

    building_count = 0
    road_count = 0
    water_count = 0
    rail_count = 0

    for way in root.findall("way"):
        tags = tag_map(way)
        refs = [nd.attrib["ref"] for nd in way.findall("nd")]
        points = [nodes[ref] for ref in refs if ref in nodes]
        if len(points) < 2:
            continue

        if "building" in tags:
            if len(points) >= 3:
                if points[0] == points[-1]:
                    points = points[:-1]
                append_extruded_polygon(
                    building_vertices,
                    building_faces,
                    points,
                    building_height(tags),
                )
                building_count += 1
        elif "highway" in tags:
            append_ribbon(
                road_vertices,
                road_faces,
                points,
                road_width(tags),
                0.08,
            )
            road_count += 1
        elif "waterway" in tags:
            append_ribbon(
                water_vertices,
                water_faces,
                points,
                8.0,
                0.02,
            )
            water_count += 1
        elif "railway" in tags:
            append_ribbon(
                rail_vertices,
                rail_faces,
                points,
                3.2,
                0.12,
            )
            rail_count += 1

    min_x = min((x for x, _ in nodes.values()), default=-100)
    max_x = max((x for x, _ in nodes.values()), default=100)
    min_y = min((y for _, y in nodes.values()), default=-100)
    max_y = max((y for _, y in nodes.values()), default=100)
    padding = 100.0
    ground_vertices = [
        (min_x - padding, min_y - padding, -0.6),
        (max_x + padding, min_y - padding, -0.6),
        (max_x + padding, max_y + padding, -0.6),
        (min_x - padding, max_y + padding, -0.6),
    ]

    create_object("pilot_ground", ground_vertices, [(0, 1, 2, 3)])
    create_object("pilot_buildings", building_vertices, building_faces)
    create_object("pilot_roads", road_vertices, road_faces)
    create_object("pilot_water", water_vertices, water_faces)
    create_object("pilot_rail", rail_vertices, rail_faces)

    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_BLEND)

    if hasattr(bpy.ops.wm, "obj_export"):
        bpy.ops.wm.obj_export(
            filepath=OUTPUT_OBJ,
            export_selected_objects=False,
            forward_axis="NEGATIVE_Z",
            up_axis="Y",
        )
    else:
        bpy.ops.export_scene.obj(
            filepath=OUTPUT_OBJ,
            use_selection=False,
            axis_forward="-Z",
            axis_up="Y",
        )

    compact_manifest = {
        "name": "Tula compact pilot",
        "status": "3d-greybox-distance-compressed",
        "source": {
            "osm": "map/source/tula_pilot.osm",
            "projection": "WGS84 EPSG:4326",
            "attribution": "© OpenStreetMap contributors",
            "license": "ODbL-1.0",
        },
        "world_origin": {
            "wgs84": {"longitude": ORIGIN_LON, "latitude": ORIGIN_LAT},
            "local": {"east_m": 0.0, "north_m": 0.0, "up_m": 0.0},
            "gta_world": {
                "x": 215.76,
                "y": -810.12,
                "z": 30.73,
                "status": "temporary-test-origin",
                "spawn_changed": False,
            },
        },
        "transform": {
            "distance_scale": DISTANCE_SCALE,
            "horizontal_formula": [
                "(lon - 37.6175) * 111320 * cos(54.1930 rad) * 0.5",
                "(lat - 54.1930) * 111320 * 0.5",
            ],
            "vertical_scale": 1.0,
            "units": "metres",
            "axis": {"east": "+X", "north": "+Y", "up": "+Z"},
            "gta_world_mapping": [
                "gta_x = 215.76 + east_m",
                "gta_y = -810.12 + north_m",
                "gta_z = 30.73 + up_m",
            ],
        },
        "outputs": {
            "blend": "map/tula_pilot_greybox_compact.blend",
            "obj": "map/tula_pilot_greybox_compact.obj",
            "mtl": "map/tula_pilot_greybox_compact.mtl",
        },
        "counts": {
            "osm_nodes": len(nodes),
            "buildings": building_count,
            "roads": road_count,
            "waterways": water_count,
            "railways": rail_count,
        },
        "not_ready": [
            "GTA V world coordinates",
            "RAGE MP asset package",
            "terrain",
            "bridge and tunnel elevations",
            "collision",
            "interiors",
            "LOD",
        ],
    }
    with open(OUTPUT_MANIFEST, "w", encoding="utf-8") as manifest_file:
        json.dump(compact_manifest, manifest_file, ensure_ascii=False, indent=2)

    print(
        "PILOT_GREYBOX_OK",
        "nodes=", len(nodes),
        "buildings=", building_count,
        "roads=", road_count,
        "water=", water_count,
        "rail=", rail_count,
        "objects=", len(bpy.context.scene.objects),
    )


if __name__ == "__main__":
    main()
