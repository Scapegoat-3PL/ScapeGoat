"""Generate simplified, accurate contiguous-US SVG state polygons.
Source: Basemap UScounties shapefile bundled in Python environment (STATE attribute).
Projected using EPSG:5070 Albers equal-area to preserve regional scale.
"""
import json, os, math
import geopandas as gpd
from shapely.geometry import Polygon, MultiPolygon
from pyproj import Transformer

SRC='/opt/pyvenv/lib/python3.13/site-packages/mpl_toolkits/basemap_data/UScounties.shp'
OUT=os.path.join(os.path.dirname(__file__),'..','public','states.json')
STATES='AL AZ AR CA CO CT DE FL GA ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split()
regions={
 'northeast':'NY NJ PA MA CT MD VA DE NH ME VT RI',
 'southeast':'GA FL NC SC TN AL MS KY',
 'midwest':'IL OH IN MI WI MN MO IA KS NE',
 'southwest':'TX AZ OK AR LA NM',
 'west-coast':'CA WA OR NV UT CO ID',
}
assigned={s:k for k,v in regions.items() for s in v.split()}
counties=gpd.read_file(SRC)
counties=counties[counties.STATE.isin(STATES)]
states=counties.dissolve(by='STATE').to_crs('EPSG:5070')
states.geometry=states.geometry.simplify(2300,preserve_topology=True)
minx,miny,maxx,maxy=states.total_bounds.tolist()
W,H,PAD=1200,740,62
scale=min((W-2*PAD)/(maxx-minx),(H-2*PAD)/(maxy-miny))
x_offset=(W-(maxx-minx)*scale)/2
y_offset=(H-(maxy-miny)*scale)/2

def pt(x,y):
 return (x_offset+(x-minx)*scale,H-(y_offset+(y-miny)*scale))
def coords_to_path(coords):
 if len(coords)<3:return ''
 p=[pt(x,y) for x,y in coords]
 return 'M'+ ' L'.join(f'{x:.1f},{y:.1f}' for x,y in p)+' Z'
def geom_to_path(poly):
 if poly.geom_type=='Polygon': geoms=[poly]
 elif poly.geom_type=='MultiPolygon': geoms=list(poly.geoms)
 else:return ''
 return ' '.join([coords_to_path(p.exterior.coords)+''.join(' '+coords_to_path(r.coords) for r in p.interiors) for p in geoms])
state_data={}
for s,row in states.iterrows():
 g=row.geometry
 bounds=g.bounds
 bx,by=pt(bounds[0],bounds[3]); dx,dy=pt(bounds[2],bounds[1])
 rp=g.representative_point(); cx,cy=pt(rp.x,rp.y)
 state_data[s]={'path':geom_to_path(g),'region':assigned.get(s),'bounds':[round(bx,1),round(by,1),round(dx,1),round(dy,1)],'center':[round(cx,1),round(cy,1)]}
obj={'width':W,'height':H,'projection':{'name':'EPSG:5070','minx':minx,'miny':miny,'maxx':maxx,'maxy':maxy,'scale':scale,'xOffset':x_offset,'yOffset':y_offset},'states':state_data}
with open(OUT,'w') as f: json.dump(obj,f,separators=(',',':'))
print('states',len(state_data),'bytes',os.path.getsize(OUT),'scale',scale,'unassigned',set(STATES)-set(assigned))