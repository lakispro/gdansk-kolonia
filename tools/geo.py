"""Small geodesy helpers: WGS84 <-> EPSG:2180 (PUWG 1992) and local ENU metres.
No pyproj on this host, so a standard transverse-Mercator (Krüger) implementation."""
import math
import json, os
_cfg = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'config.json')))
LAT0, LON0 = _cfg['lat'], _cfg['lon']   # the target building centroid
TARGET_WAY = _cfg['osm_way']; ADDRESS = _cfg['address']
A = 6378137.0; F = 1/298.257222101                    # GRS80
E2 = F*(2-F); EP2 = E2/(1-E2)
K0 = 0.9993; FE = 500000.0; FN = -5300000.0; L0 = math.radians(19.0)

def _M(phi):
    e2=E2; e4=e2*e2; e6=e4*e2
    return A*((1-e2/4-3*e4/64-5*e6/256)*phi-(3*e2/8+3*e4/32+45*e6/1024)*math.sin(2*phi)
              +(15*e4/256+45*e6/1024)*math.sin(4*phi)-(35*e6/3072)*math.sin(6*phi))

def wgs_to_2180(lat, lon):
    phi=math.radians(lat); lam=math.radians(lon)
    N=A/math.sqrt(1-E2*math.sin(phi)**2); T=math.tan(phi)**2; C=EP2*math.cos(phi)**2
    Aa=(lam-L0)*math.cos(phi); M=_M(phi)
    x=FE+K0*N*(Aa+(1-T+C)*Aa**3/6+(5-18*T+T*T+72*C-58*EP2)*Aa**5/120)
    y=FN+K0*(M+N*math.tan(phi)*(Aa**2/2+(5-T+9*C+4*C*C)*Aa**4/24+(61-58*T+T*T+600*C-330*EP2)*Aa**6/720))
    return x, y   # easting, northing

def p2180_to_wgs(x, y):
    M=(y-FN)/K0; mu=M/(A*(1-E2/4-3*E2*E2/64-5*E2**3/256))
    e1=(1-math.sqrt(1-E2))/(1+math.sqrt(1-E2))
    phi1=mu+(3*e1/2-27*e1**3/32)*math.sin(2*mu)+(21*e1*e1/16-55*e1**4/32)*math.sin(4*mu)+(151*e1**3/96)*math.sin(6*mu)
    N1=A/math.sqrt(1-E2*math.sin(phi1)**2); T1=math.tan(phi1)**2; C1=EP2*math.cos(phi1)**2
    R1=A*(1-E2)/(1-E2*math.sin(phi1)**2)**1.5; D=(x-FE)/(N1*K0)
    phi=phi1-(N1*math.tan(phi1)/R1)*(D*D/2-(5+3*T1+10*C1-4*C1*C1-9*EP2)*D**4/24+(61+90*T1+298*C1+45*T1*T1-252*EP2-3*C1*C1)*D**6/720)
    lam=L0+(D-(1+2*T1+C1)*D**3/6+(5-2*C1+28*T1-3*C1*C1+8*EP2+24*T1*T1)*D**5/120)/math.cos(phi1)
    return math.degrees(phi), math.degrees(lam)

def enu(lat, lon):
    """Local metres, +x east, +y north, from the Sucharskiego 9 origin."""
    return ((lon-LON0)*111320*math.cos(math.radians(LAT0)), (lat-LAT0)*111320)

if __name__ == "__main__":
    x,y=wgs_to_2180(LAT0,LON0); print(x,y, p2180_to_wgs(x,y))
