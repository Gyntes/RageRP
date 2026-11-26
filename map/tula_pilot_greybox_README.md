# Tula pilot greybox

The pilot greybox was generated in Blender 5.3 from `source/tula_pilot.osm`.

## Outputs

- `tula_pilot_greybox.blend`
- `tula_pilot_greybox.obj`
- `tula_pilot_greybox.mtl`
- `build_tula_pilot_greybox.py`

## Contents

- 9,671 extruded building footprints
- 5,646 road/routing surfaces
- 340 railway surfaces
- Combined ground plane
- 169,248 OBJ vertices
- 97,979 OBJ faces

## Coordinate system

- Local origin: WGS84 `37.6175 E, 54.1930 N`
- In Blender: local X east, Y north, Z up
- Units: metres
- Initial scale: 1:1

## Assumptions

Buildings use explicit `height`, otherwise `building:levels * 3.2`, otherwise 8 m.
Church-like buildings use 18 m when no height or level tag exists.
Road widths are estimated by highway class.
Waterways are absent from the merged pilot source used for this export.
Multipolygon relations, bridge and tunnel elevations, terrain, collision and interiors are not reconstructed.

The exported files are greybox data for review. They are not RAGE MP map assets and must not be used as a full game replacement.

Data attribution: © OpenStreetMap contributors, ODbL 1.0.

## Compact 0.5x pilot

`tula_pilot_greybox_compact.blend` and `tula_pilot_greybox_compact.obj` use 0.5 horizontal
distance scaling. WGS84 east/north coordinates are converted around `37.6175 E, 54.1930 N`
and multiplied by 0.5. Building heights, road heights and the Z axis remain at their
greybox values. GTA V world coordinates are not assigned; spawn must remain unchanged.
