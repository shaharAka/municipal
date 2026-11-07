"""Public council GIS area midpoints; never claimed to be collection stops."""
import concurrent.futures,json,ssl,urllib.request,urllib.parse
from pathlib import Path
import certifi
BASE='https://ags20.intertown.co.il/arcgis/rest/services/gln_layers/gln_yeshuvim/MapServer'
CTX=ssl.create_default_context(cafile=certifi.where())
def get(url):return json.load(urllib.request.urlopen(url,context=CTX,timeout=20))
root=get(BASE+'?f=json')
exclude={'תכניות לפי ישובים','מועצה אזורית גולן','מ.א. עמק הירדן'}
groups=[l for l in root['layers'] if l.get('subLayerIds') and l['name'] not in exclude]
def item(layer):
 data=get(f'{BASE}/{layer["id"]}?f=json');e=data.get('extent')
 return None if not e else {'name':layer['name'],'point':{'x':(e['xmin']+e['xmax'])/2,'y':(e['ymin']+e['ymax'])/2},'source':f'{BASE}/{layer["id"]}'}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:places=[p for p in pool.map(item,groups) if p]
geometry={'geometryType':'esriGeometryPoint','geometries':[p['point'] for p in places]}
url='https://utility.arcgisonline.com/ArcGIS/rest/services/Geometry/GeometryServer/project?'+urllib.parse.urlencode({'f':'json','inSR':2039,'outSR':4326,'geometries':json.dumps(geometry)})
projected=get(url)
assert 'geometries' in projected, projected
out={p['name']:{'lat':round(g['y'],6),'lng':round(g['x'],6),'source':p['source'],'accuracy':'town-area midpoint; collection point unverified'} for p,g in zip(places,projected['geometries']) if 32<g['y']<34 and 35<g['x']<37}
# The named demo settlement is adjacent to Kela; this public geographic point
# is separate from the exact pickup location in the council workbook.
out['רמת טראמפ']={'lat':33.132335,'lng':35.690538,'source':'https://he.hamichlol.org.il/רמת_הנשיא_טראמפ','accuracy':'public settlement location; collection point unverified'}
Path('src/web/transport-places.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('Public approximate areas:',len(out));print({k:out[k] for k in ['מרום גולן','אניעם','קדמת צבי','קלע אלון']})
