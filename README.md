# Lost in Transcription: the atlas

A static site that maps speech recognition word error rate across India's districts. It reads JSON written by `atlas-eval` in the [backend repository](https://github.com/KurianJose7586/ost-in-translation-backend).

There's no build step and no dependencies. Serve the folder and open it:

```sh
python -m http.server 8000
```

| File | What it is |
|---|---|
| `index.html` | Page shell and the methodology page |
| `app.js` | Map, model switcher, tooltip, table, district pages |
| `style.css` | Light and dark themes; the sequential colour ramp |
| `data/baseline.json` | One evaluation round, copied from `atlas-eval` output. Now round M0: ten Hindi districts, three models |
| `map.svg` | District boundaries, projected and simplified (see below) |

## District boundaries

`map.svg` is built from DataMeet's [Census 2011 district map](https://github.com/datameet/maps/tree/master/Districts/Census_2011) (CC BY 2.5 India, attribution required). Its outer boundary follows India's official boundary. Each path's `id` is `state-district`, lowercased with non-letters replaced by hyphens (for example `bihar-patna`), and the site joins on that, so `atlas-eval` must produce the same ids. Vaani spellings and districts created after 2011 need a name-mapping table, which comes once the Vaani district list is available.

To rebuild it:

```sh
npx mapshaper@0.6 2011_Dist.shp \
  -each "id=(ST_NM+'-'+DISTRICT).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')" \
  -proj "+proj=lcc +lat_1=12.47 +lat_2=35.17 +lat_0=24 +lon_0=80 +datum=WGS84" \
  -simplify 4% keep-shapes \
  -o map.svg id-field=id svg-data=DISTRICT,ST_NM width=800 margin=0 precision=0.1
```
