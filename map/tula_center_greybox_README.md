# Tula central greybox

The OBJ/MTL pair is a first 3D blockout generated from the central OSM feature export:

- `tula_center_greybox.obj`
- `tula_center_greybox.mtl`

The checked greybox contains 3,090 extruded building footprints, 9,277 road-segment surfaces, and 77,889 vertices / 33,679 faces. OBJ topology and material references were validated.

## Coordinate system

- Local origin: city centre, WGS84 `37.6175 E, 54.1930 N`.
- X points east, Y north, Z up.
- Units are metres at a provisional 1:1 scale. This is a local modelling frame, not final RAGE MP world coordinates.
- Geometry is deliberately flat: no DEM terrain, bridge elevations, tunnels, curbs, lane markings, interiors, or collision optimization.

## Greybox assumptions

- Building footprints come from OSM. Explicit height/level tags are used when present; otherwise a generic 8 m height is assigned, with simple special handling for churches.
- Road surface widths are estimated by OSM road class.
- Water and rail are flat proxy surfaces. They are for layout review, not final materials or collision.
- Polygon holes and OSM multipolygon relations are not reconstructed in this first export.
- Review the OBJ in Blender, correct major topology/height issues, then split and optimize it into game-ready assets. The source OSM data and derived GIS/model files require OSM attribution and ODbL review.

Data attribution: © OpenStreetMap contributors, ODbL 1.0. See [`source/README.md`](source/README.md).
