# Kolonia (Danzig-Langfuhr, Reichskolonie) around Mickiewicza 43 in 1920 — map research report

STATUS: PRELIMINARY — georeferencing done, building verdicts automatic (manual review, vanished-structure polygons and land-cover polygons still being written). See README.md for the full list of downloaded maps with URLs.

## Maps found
- **Plan der Stadt Danzig 1920** (Städtisches Vermessungsamt, 1:10 000, 300 dpi scan, mapywig/Mapster; also 1921 edition) — primary 1920 source; shows the Reichskolonie block by block with street names. Georeferenced: `map1920_warped.png/.json`, RMS residual 2.7 m on 6 control points, but the plan itself is schematic (railway bend and colony rows slightly rotated) so expect 5-8 m errors in the core and 10-20 m at the edges.
- **Plan von Danzig 1933** (same office, 2. Auflage, 1:10 000, 400 dpi) — best geometry, individual buildings with house numbers; georeferenced (`map1933_warped.png/.json`, RMS 3.6 m on 6 control points; matches OSM streets within ~5 m). Used for footprint-level verdicts.
- Messtischblatt 1677 Danzig 1:25 000 (survey 1908; prints 1910, 1918, 1919 Polish reprint, 1926 WIG; 1940 edition), WIG 1:25 000 1936, Plan der Stadt Danzig 1908 (Vermessungsamt), Plan der Stadt Danzig 1912 (1:15 000), Pharus plans 1922/1925-29/1938/1940, GSGS 4496 1944, Wrzeszcz 1946 plan. Kafemann "Plan von Danzig" 1911/1914 cover only the inner city.
- Not reachable from this host: Landkartenarchiv.de (502), Gdańsk SIP / geogdansk.pl (timeouts), Polona DeepZoom tiles (403) for the 1909 Kafemann "Plan von Langfuhr" and the 1927 Pharus plan; the 1:2500 Freie Stadt Danzig Geländeplan sheet for this block is not online.

## Street names (verified on the 1920 and 1933 plans + OSM old_name:de + Gedanopedia)
Mickiewicza = Bärenweg; Kochanowskiego = Posadowskyweg; Sochaczewska = Neptunweg (after 1931 Maximilian-Block-Weg); Klonowicza = Marineweg; Reja = Leegstrieß; Dzielna = Simsonweg (not yet in 1920); Modrzewskiego = Justweg; Hallera = Ostseestraße (laid out from 1920, not on the 1920 plan). Strzyża = Strießbach.

## What the block looked like in 1920 (summary, to be expanded)
The Reichskolonie (Kolonie Neuschottland / Neu-Schellmühl) was begun in 1907 by the Reichsmarineamt for Kaiserliche Werft workers and largely finished by 1915: low two-storey row houses with gardens along Marineweg, Posadowskyweg, Neptunweg and Justweg, plus the Wohnungs-Genossenschaft Neuschottland rows on both sides of Posadowskyweg south of Bärenweg. Bärenweg crossed the Neufahrwasser railway by a level crossing east of the colony; the halt "Reichskolonie" lay north-east at Justweg. West of Neptunweg: gardens/fields and the Lenz nursery (Bärenwinkel); south-west: Sportplatz Neuschottland (1916) on meadows; south: Strießbach meadows; east of the railway: open fields/allotments of Gut Schellmühl. Christuskirche (1913-16) stands 300 m west, outside the square.

## Terrain
`terrain.json`: GUGiK NMT, 10 m grid, 51x51, 2.3-7.2 m ASL (flat Strießbach lowland, slight rise to the north-west).
