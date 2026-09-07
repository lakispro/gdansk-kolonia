# research/maps — historical maps and terrain for Danzig-Langfuhr "Reichskolonie" (Gdańsk Wrzeszcz Dolny, Kolonia)

Origin: ul. Adama Mickiewicza 43, WGS84 54.3825003 N, 18.6262664 E (EPSG:2180 E 475734.4, N 724336.0).
Local ENU frame = metres east / north of the origin (same convention as tools/geo.py).

All raster files below were downloaded on 2026-09-07. Nothing here is edited except the derived files marked "derived".

## Downloaded maps (source URL, date, scale, notes)

| file | source | date / edition | scale, dpi | covers block? | notes |
|---|---|---|---|---|---|
| stadtplan_1920_10k_PAN.jpg | http://maps.mapywig.org/m/City_plans/Central_Europe/PLAN_DER_STADT_DANZIG_10K_1920_WA51_25068_PAN-D6797-r1920.jpg (Mapster/mapywig scan of the PAN Gdańsk Library copy, RCIN id 13361) | "Plan der Stadt Danzig, angefertigt im Jahre 1920, Städtisches Vermessungsamt (Block, Direktor), Verlag A.W. Kafemann" | 1:10 000, 300 dpi (9449x14156 px) | yes | PRIMARY 1920 map. Shows the Reichskolonie with street names Bärenweg, Neptunweg, Marineweg, Posadowsky-Weg, Justweg, "Hst. Reichskolonie", "Wohnungs-Genossenschaft Neuschottland", "Sportplatz". Building rows drawn schematically. |
| stadtplan_1921_10k_PAN.jpg | http://maps.mapywig.org/m/City_plans/Central_Europe/PLAN_DER_STADT_DANZIG_10K_1921_WA51_25071_PAN-D11566-r1921.jpg | 1921 edition of the same plan, with hand-drawn red/green route overlays | 1:10 000, 300 dpi | yes | identical base content to 1920 |
| plan_von_danzig_1933_10k.jpg | http://maps.mapywig.org/m/City_plans/Central_Europe/PLAN_von_DANZIG_1933_10K.jpg (Univ. of Chicago copy) | "Plan von Danzig, bearbeitet vom Städtischen Vermessungsamt 1933, 2. Auflage" | 1:10 000, 400 dpi (16529x20874 px) | yes | BEST GEOMETRY. Individual buildings in brown with house numbers, Strießbach in blue, Leegstrieß, Helene-Lange-Schule, Ostseestraße. Used as the geometric reference (see georef.json). |
| tk25_1677_danzig_1918_600dpi.jpg | http://maps.mapywig.org/m/German_maps/series/025K_TK25/1677_(391)_Danzig_1918.jpg | Messtischblatt 1677 (old no. 391) Danzig, "Kgl. Preuß. Landesaufnahme 1908, herausgegeben 1910, Auflagedruck 1918" | 1:25 000, 600 dpi | yes | Shows the state of 1908: first Kolonie houses along the railway, "Hp. Dzg. Reichskolonie". |
| tk25_1677_danzig_1910_300dpi.jpg | http://maps.mapywig.org/m/German_maps/series/025K_TK25/1677_(391)_Danzig_1910_IfL_MB1677(1910).jpg | same sheet, 1910 print (IfL Leipzig) | 1:25 000, 300 dpi | yes | |
| tk25_1677_danzig_1919_WIG_reprint_600dpi.jpg | http://maps.mapywig.org/m/WIG_maps/series/025K_old/1677_(391)_Danzig_Dow._G._Kart._1919_nnVnxh1_BN_Sygn.ZZK_S-20_300_A.jpg | Polish reprint 1919 of the German sheet | 1:25 000, 600 dpi | yes | same content as 1908 survey |
| wig25_rejon_pomorze_27_gdansk_1926_400dpi.jpg | http://maps.mapywig.org/m/WIG_maps/series/025K_old/REJON_POMORZE_ARK_27_(391)_GDANSK_(DANZIG)_1926.jpg | WIG "Rejon Pomorze ark. 27 Gdańsk" 1926 | 1:25 000, 400 dpi | yes | Polish re-edition of the German sheet |
| tk25_1677_danzig_1940_600dpi.jpg | http://maps.mapywig.org/m/German_maps/series/025K_TK25/1677_(391)_Danzig_1940_UW.jpg | Messtischblatt 1677 Danzig, 1940 edition | 1:25 000, 600 dpi | yes | 1930s state |
| wig25_P31-S27-E_gdansk_1936_600dpi.jpg | http://maps.mapywig.org/m/WIG_maps/series/025K/P31-S27-E_GDANSK_1936_2_LoC_G6520_s25_.P6.jpg | WIG P31-S27-E Gdańsk 1936 | 1:25 000, 600 dpi | yes | |
| plan_der_stadt_danzig_1908_10k.jpg | http://maps.mapywig.org/m/City_plans/Central_Europe/PLAN_DER_STADT_DANZIG_10K_1908_SLUB-KS_1666.jpg | Plan der Stadt Danzig 1908 (SLUB Dresden) | 1:10 000, 200 dpi | yes | |
| plan_von_danzig_1911_10k.jpg | http://maps.mapywig.org/m/City_plans/Central_Europe/PLAN_VON_DANZIG_10K_1911_bc_elb.jpg | Plan von Danzig 1911 (Elbląg digital library) | 1:10 000, 400 dpi | yes | |
| plan_der_stadt_danzig_1912.jpg | http://maps.mapywig.org/m/City_plans/Central_Europe/AMPG_Plan_der_Stadt_Danzig_1912.jpg | Plan der Stadt Danzig 1912 (Archiwum Map i Planów Gdańska) | ~1:10 000, 300 dpi (small scan) | yes | |
| polona_plan_von_danzig_1914_kafemann.jpg | https://polona2.pl/archive?uid=30311259&cid=31206235&name=download_fullJPG (Polona, BN, item MzAzMTEyNTk) | Plan von Danzig, Kafemann, 1914 | 1:10 000 | yes | |
| pharus_danzig_ca1922_400dpi.jpg | http://maps.mapywig.org/m/City_plans/Central_Europe/PHARUS-PLAN_DANZIG_8K_Danziger-Verlagsgesellschaft_m.b.jpg | Pharus-Plan Danzig, ca. 1922 | 1:8 000 (+ Langfuhr inset 1:17 000) | NO (inset ends at Hst. Neuschottland) | |
| pharus_danzig_ca1929_600dpi.jpg / polona_pharus_danzig_1925.jpg | http://maps.mapywig.org/m/City_plans/Central_Europe/PHARUS-PLAN_DANZIG_8K_ca_1929_nnTcksl_BN_Sygn._ZZK_34_730.jpg and https://polona2.pl/archive?uid=30311254&cid=31206373&name=download_fullJPG | Pharus-Plan Danzig, BN copy dated 1925 (Mapster: ca. 1929) | 1:8 000 | NO | same scan |
| pharus_danzig_mit_langfuhr_ca1930.jpg | http://maps.mapywig.org/m/City_plans/Central_Europe/AMPG_Gdansk_pharus_danzig_mit_langfuhr.jpg | Pharus-Plan Danzig mit Langfuhr, ca. 1930 | 1:8 000 / 1:10 000, 300 dpi (small) | partly | |
| pharus_danzig_1938.jpg | http://maps.mapywig.org/m/City_plans/Central_Europe/GDAŃSK_Pharus-Plan_Danzig_8K_1938_BCUWr-c8200032635-0001.jpg | Pharus-Plan Danzig 1938 (BCUWr) | 1:8 000 | partly | |
| polona_pharus_danzig_langfuhr_1940.jpg | https://polona2.pl/archive?uid=31957075&cid=32741498&name=download_fullJPG (Polona MzE5NTcwNzU) | Pharus-Plan Danzig / Langfuhr 1940 | 1:8 000 / 1:10 000 | Langfuhr sheet reaches Neuschottland | |
| plan_wrzeszcz_1946_AMPG.jpg | http://maps.mapywig.org/m/City_plans/Central_Europe/AMPG_plan_1946_wrzeszcz.jpg | Plan of Gdańsk-Wrzeszcz 1946 | 300 dpi (small) | yes | post-war state |
| gsgs4496_danzig_north_1944.jpg | http://maps.mapywig.org/m/City_plans/ALLIED/GSGS_4435_Poland_4496_Danzig/GSGS_4496_TOWN_PLAN_OF_DANZIG_(NORTH)_10K_1944.jpg | GSGS 4496 Town plan of Danzig (North) 1944 | 1:10 000, 300 dpi | yes | Allied redraw of the 1930s German plan |
| stephan_strassennamen_danzigs_1911.pdf | http://maps.mapywig.org/m/m_documents/DE//W.STEPHAN_DIE_STRASSENNAHMEN_DANZIGS_1911_bc_elb.pdf | W. Stephan, Die Straßennamen Danzigs, 1911 | – | – | street-name etymologies |
| Plan_der_Stadt_Danzig_1920_mapywig.jpg | http://maps.mapywig.org/m/City_plans/Central_Europe/Plan_der_Stadt_Danzig.jpg | another scan of the 1920 plan (AMPG), 200 dpi | 1:10 000 | yes | lower resolution duplicate |
| PHARUS-PLAN_DANZIG_8K_mapywig.jpg | http://maps.mapywig.org/m/City_plans/Central_Europe/PHARUS-PLAN_DANZIG_8K.jpg | Pharus-Plan Danzig (undated, 1920s) | 1:8 000 | NO | |

Catalogue pages used: Mapster point query http://igrek.amzp.pl/result.php?cmd=pt&locsys=1&uni=-714319&box=0.0001&hideempty=on (all sheets covering Gdańsk), Polona API https://polona2.pl/api/entities/?query=Danzig%20plan.

Not obtainable from this host: Landkartenarchiv.de (HTTP 502 for every request), mapa.gdansk.gda.pl / geogdansk.pl (connection refused/timeout — the Gdańsk SIP historical layers and 1945 aerials could not be probed for WMS), Polona DeepZoom tiles (HTTP 403 for the 1909 "Plan von Langfuhr" Kafemann and the 1927 Pharus plan), Freie Stadt Danzig Geländeplan 1:2500 (only 14 sheets are on mapywig, none covers Langfuhr/Reichskolonie; the sheet for this block would be about "VIII 19"/"IX 19").

## Derived files

- `georef.py` — small toolkit (affine fit, warp, OSM overlay).
- `map1920_warped.png`, `map1920_warped.json` — 1920 Stadtplan warped to the 600 m x 600 m ENU square (0.25 m/px, north up).
- `map1933_warped.png`, `map1933_warped.json` — 1933 Plan von Danzig warped the same way (better geometry, used for building verdicts).
- `overlay_check.png`, `overlay_check_1933.png` — today's OSM buildings/streets/rail/stream drawn on the warped maps.
- `buildings1920.json` — verdict per OSM building, vanished structures, land cover, street-name mapping.
- `terrain.json` — GUGiK NMT elevations on a 10 m grid (51x51, 500 m square), from https://services.gugik.gov.pl/nmt/?request=GetHByXY&x=<northing>&y=<easting> (EPSG:2180; note the service takes x = northing).
- `fetch_terrain.py` — the sampler.
- `osm_wide_700m.json` — (if present) Overpass download of streets/rail/stream within 700 m, for overlay checks.
- `report.md` — findings.
