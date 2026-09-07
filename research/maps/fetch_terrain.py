import sys, json, time, math, urllib.request
sys.path.insert(0,'/home/agent/work/gdansk-kolonia/tools')
from geo import wgs_to_2180
LAT0,LON0=54.3825003,18.6262664
step=10; n=51; half=(n-1)//2*step
cosl=math.cos(math.radians(LAT0))
z=[]; mn=1e9; mx=-1e9
out='/home/agent/work/gdansk-kolonia/research/maps/terrain.json'
for r in range(n):
    yN=half-r*step; row=[]
    for c in range(n):
        xE=-half+c*step
        lat=LAT0+yN/111320; lon=LON0+xE/(111320*cosl)
        x,y=wgs_to_2180(lat,lon)
        for att in range(5):
            try:
                h=float(urllib.request.urlopen(f"https://services.gugik.gov.pl/nmt/?request=GetHByXY&x={y:.1f}&y={x:.1f}",timeout=20).read().decode().strip().replace(',','.'))
                break
            except Exception as e:
                time.sleep(2); h=None
        row.append(h); 
        if h is not None: mn=min(mn,h); mx=max(mx,h)
        time.sleep(0.05)
    z.append(row); print(r, row[:3], flush=True)
json.dump({"step":step,"size":n,"origin":{"lat":LAT0,"lon":LON0},"crs_note":"rows north->south, cols west->east, ENU metres from origin; z metres ASL (PL-EVRF2007-NH) from GUGiK NMT GetHByXY (EPSG:2180, x=northing,y=easting)","min":mn,"max":mx,"z":z},open(out,'w'))
print("done",mn,mx)
