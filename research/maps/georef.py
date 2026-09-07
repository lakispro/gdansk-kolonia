import json, math, sys
import numpy as np
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS=None
LAT0,LON0=54.3825003,18.6262664
cosl=math.cos(math.radians(LAT0))
def enu(lat,lon): return ((lon-LON0)*111320*cosl,(lat-LAT0)*111320)
osm=json.load(open('/home/agent/work/gdansk-kolonia/public/data/osm.json'))

def fit_affine(pairs):
    """pairs: list of ((px,py),(E,N)). returns 2x3 matrix M s.t. [E,N]=M@[px,py,1]"""
    A=np.array([[p[0],p[1],1] for p,_ in pairs]); B=np.array([e for _,e in pairs])
    M,res,rank,sv=np.linalg.lstsq(A,B,rcond=None)
    M=M.T  # 2x3
    resid=[(np.array(e)-(M@np.array([p[0],p[1],1]))) for p,e in pairs]
    return M, [float(np.hypot(*r)) for r in resid]

def warp(src, M, out_png, half=300.0, res=0.25):
    """Warp source image to ENU square [-half,half] at res m/px, north up. Uses inverse of M."""
    Minv=np.linalg.inv(np.vstack([M,[0,0,1]]))
    n=int(2*half/res)
    im=Image.open(src).convert('RGB')
    # PIL affine transform expects output->input mapping (a,b,c,d,e,f): x_in=a*x_out+b*y_out+c
    # x_out,y_out pixel -> E = -half + x_out*res ; N = half - y_out*res
    # pixel_in = Minv @ [E,N,1]
    a=Minv[0,0]*res; b=-Minv[0,1]*res; c=Minv[0,0]*(-half)+Minv[0,1]*half+Minv[0,2]
    d=Minv[1,0]*res; e=-Minv[1,1]*res; f=Minv[1,0]*(-half)+Minv[1,1]*half+Minv[1,2]
    out=im.transform((n,n),Image.AFFINE,(a,b,c,d,e,f),resample=Image.BICUBIC)
    out.save(out_png)
    return out

def overlay(warped_png, out_png, half=300.0, res=0.25, extra=None):
    im=Image.open(warped_png).convert('RGB'); dr=ImageDraw.Draw(im)
    def px(x,y): return ((x+half)/res, (half-y)/res)
    for e in osm['elements']:
        if e['type']!='way': continue
        t=e.get('tags',{}); g=[px(*enu(p['lat'],p['lon'])) for p in e['geometry']]
        if 'building' in t: dr.polygon(g,outline=(0,120,255),width=2)
        elif 'highway' in t and t.get('name'): dr.line(g,fill=(255,0,0),width=3)
        elif 'highway' in t: dr.line(g,fill=(255,120,120),width=1)
        elif 'railway' in t and t['railway']=='rail': dr.line(g,fill=(0,0,0),width=3)
        elif 'waterway' in t: dr.line(g,fill=(0,0,255),width=3)
    for r in (150,220): dr.ellipse([px(-r,r),px(r,-r)],outline=(0,160,0),width=2)
    dr.ellipse([px(-3,3),px(3,-3)],fill=(255,0,255))
    if extra:
        for (E,N),lab in extra:
            dr.ellipse([px(E-4,N+4),px(E+4,N-4)],outline=(255,0,255),width=2); dr.text(px(E+5,N+5),lab,fill=(255,0,255))
    im.save(out_png)
    return im
