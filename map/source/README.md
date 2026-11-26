# Tula map source data

`tula_center.osm` is a bounded OpenStreetMap data extract used for the detailed central-map draft.

- Download date: 2026-11-26.
- Requested bbox: `37.60,54.18,37.64,54.205` (WGS84 longitude/latitude).
- The extract contains 32,172 nodes, 6,768 ways, and 489 relations.
- Complete ways can include nodes outside the requested bbox. The rendered SVG therefore extends beyond the requested rectangle; this does not mean all features in that larger area were extracted.
- The current GeoJSON conversion includes tagged ways and named POI nodes. Multipolygon relations are not reconstructed yet, so some area boundaries can be incomplete.

Data attribution: © OpenStreetMap contributors. The source database is available under the Open Database License (ODbL) 1.0: <https://www.openstreetmap.org/copyright>.

The source and derived GIS data are reference material, not GTA V map assets. Preserve attribution and review ODbL obligations before redistributing derivative databases or shipping derived data.

The converter is `..\build_tula_map.ps1` and uses only PowerShell/.NET. Script syntax was checked, but direct script execution is blocked by this machine's PowerShell policy; the checked-in GeoJSON/SVG outputs were generated from this extract and validated separately.

The script now accepts `-InputPath`, `-GeoJsonPath`, `-SvgPath`, and `-ControlPointsPath`, so additional extracts can be generated without overwriting the current central files.

`tula_pilot.osm` is a merged, proposed pilot-area extract downloaded on 2026-11-26 for `37.55,54.17,37.64,54.21`. It combines building ways, highway ways, waterways and railways from Overpass. The merged extract contains 72,949 nodes and 15,657 ways. It is a GIS reference, not a game-ready asset, and has no reconstructed multipolygon relations.
