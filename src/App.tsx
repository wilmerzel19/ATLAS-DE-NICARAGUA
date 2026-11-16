import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { Map as LibreMap } from 'maplibre-gl';
import type { FeatureCollection, Geometry } from 'geojson';
import { ArrowRight, Camera, Expand, Minimize, Check, ChevronLeft, ChevronRight, ChevronDown, Compass, Edit3, Eye, Globe2, ImagePlus, MapPin, Menu, Plus, Search, Trash2, UploadCloud, X, ZoomIn } from 'lucide-react';
import { blankRecord, COUNTRIES, recordId, type Country, type RegionRecord } from './data';
import { fetchRecords, persistRecord, removeRecord, uploadPhoto } from './store';
import 'maplibre-gl/dist/maplibre-gl.css';

type Area = { name:string; id:string };
const PALETTE = ['#6CA8EB','#F0B65A','#A58AE5','#65C6B0','#EB8B8B','#7DC1DE','#D9BA73','#96B0F2','#82BF91','#D59DB8','#F3CD74','#8DA8DD','#D99071','#91D4CA','#BD9BD6','#79B7A8','#E5AD77','#AEC4E9','#E89EB5','#8FC57F'];
const BASE_STYLE:maplibregl.StyleSpecification = {version:8,glyphs:'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#eef4fb'}}]};
const NIC_PARTS:[string,string][]=[['boaco','Boaco'],['carazo','Carazo'],['chinandega','Chinandega'],['chontales','Chontales'],['esteli','Estelí'],['granada','Granada'],['jinotega','Jinotega'],['leon','León'],['madriz','Madriz'],['managua','Managua'],['masaya','Masaya'],['matagalpa','Matagalpa'],['nueva-segovia','Nueva Segovia'],['raan','Región Autónoma de la Costa Caribe Norte'],['raas','Región Autónoma de la Costa Caribe Sur'],['rio-san-juan','Río San Juan'],['rivas','Rivas']];
function featureName(props: Record<string,unknown> = {}) {return String(props.shapeName || props.NAME_1 || props.name || props.Name || props.NAME || props.admin1Name || 'Región sin nombre');}
function regionAlias(name:string) { return name.replace(/^Regi[oó]n Aut[oó]noma (de la )?/i,'').trim(); }
function boundsOf(g:FeatureCollection):maplibregl.LngLatBounds {const bounds=new maplibregl.LngLatBounds();const scan=(v:unknown)=>{if(Array.isArray(v)){if(typeof v[0]==='number' && typeof v[1]==='number'){bounds.extend([v[0],v[1]]);}else v.forEach(scan);}};g.features.forEach(f=>scan((f.geometry as Geometry & {coordinates?:unknown}).coordinates));return bounds;}
async function getGeometry(iso:string):Promise<FeatureCollection> {
 if(iso==='NIC') {
   // Geometrías independientes publicadas por pacisauctor (OSM). Se unen en el navegador.
   const features=(await Promise.all(NIC_PARTS.map(async ([file,name])=>{
     const response=await fetch(`https://raw.githubusercontent.com/pacisauctor/geojson-nicaragua/master/${file}.geo.json`);
     if(!response.ok)throw Error(`No se pudo cargar el límite de ${name}.`);
     const json=await response.json();
     const pieces=json.type==='FeatureCollection'?json.features:json.type==='Feature'?[json]:json.type==='Polygon'||json.type==='MultiPolygon'?[{type:'Feature',properties:{},geometry:json}]:[];
     if(!pieces.length)throw Error(`Geometría no válida: ${name}.`);
     return pieces.map((f:FeatureCollection['features'][number])=>({...f,properties:{...f.properties,shapeName:name}}));
   }))).flat();
   return {type:'FeatureCollection',features};
 }
 const r=await fetch(`https://www.geoboundaries.org/api/current/gbOpen/${iso}/ADM1/`);
 if(!r.ok)throw Error('No se encontró el mapa de este país.');
 const meta=await r.json();
 const rawUrl=String(meta.simplifiedGeometryGeoJSON || meta.gjDownloadURL);
 // GitHub media sirve el contenido real de Git LFS, en vez del pequeño archivo pointer.
 const mediaUrl=rawUrl.replace('https://github.com/','https://media.githubusercontent.com/media/').replace('/raw/','/');
 const response=await fetch(mediaUrl);
 if(!response.ok)throw Error('No se pudieron cargar los límites geográficos.');
 const json=await response.json() as FeatureCollection;
 if(json.type!=='FeatureCollection'||!Array.isArray(json.features))throw Error('El formato geográfico no es válido.');
 return json;
}
function addLayers(map:LibreMap,geo:FeatureCollection){
  ['region-label','region-border','region-hover','region-fill'].forEach(id=>{if(map.getLayer(id))map.removeLayer(id);});
  if(map.getSource('regions'))map.removeSource('regions');
  const data:FeatureCollection={...geo,features:geo.features.map((f,i)=>({...f,id:i,properties:{...f.properties,regionName:featureName(f.properties as Record<string,unknown>),fillColor:PALETTE[i%PALETTE.length]}}))};
  map.addSource('regions',{type:'geojson',data,generateId:false});
  map.addLayer({id:'region-fill',type:'fill',source:'regions',paint:{'fill-color':['get','fillColor'],'fill-opacity':0.86}});
  map.addLayer({id:'region-hover',type:'fill',source:'regions',paint:{'fill-color':'#123f77','fill-opacity':['case',['boolean',['feature-state','hover'],false],0.28,0]}});
  map.addLayer({id:'region-border',type:'line',source:'regions',paint:{'line-color':'#ffffff','line-width':1.6}});
  map.addLayer({id:'region-label',type:'symbol',source:'regions',layout:{'text-field':['get','regionName'],'text-font':['Open Sans Regular'],'text-size':11,'text-max-width':8,'text-allow-overlap':false},paint:{'text-color':'#193651','text-halo-color':'#ffffff','text-halo-width':1.3}});
}
function MapPanel({country,search,selected,onSelect,onRegions,onError}:{country:Country;search:string;selected:string|null;onSelect:(name:string)=>void;onRegions:(areas:Area[])=>void;onError:(message:string)=>void}){
 const host=useRef<HTMLDivElement>(null); const map=useRef<LibreMap|null>(null);const dataRef=useRef<FeatureCollection|null>(null);const hoverRef=useRef<number|null>(null);const selectRef=useRef(onSelect);selectRef.current=onSelect;
 useEffect(()=>{
  if(!host.current)return;
  const m=new maplibregl.Map({container:host.current,style:BASE_STYLE,center:country.center,zoom:country.zoom,attributionControl:false});map.current=m;
  m.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
  const observer=new ResizeObserver(()=>m.resize());observer.observe(host.current!);
  let cancelled=false;
  const load=async()=>{ try {const geo=await getGeometry(country.iso);if(cancelled)return;dataRef.current=geo;onRegions(Array.from(new Map(geo.features.map(f=>{const name=featureName(f.properties as Record<string,unknown>);return [name,{name,id:recordId(country.iso,name)}] as const;})).values()).sort((a,b)=>a.name.localeCompare(b.name,'es')));if(!m.isStyleLoaded())await new Promise<void>(resolve=>m.once('load',()=>resolve()));if(cancelled)return;addLayers(m,geo);m.fitBounds(boundsOf(geo),{padding:45,duration:500});}catch(e){if(!cancelled)onError(e instanceof Error?e.message:'Error al cargar el mapa.');}};
  void load();
  m.on('click','region-fill',e=>{const f=e.features?.[0];if(f)selectRef.current(String(f.properties?.regionName||''));});
  m.on('mousemove','region-fill',e=>{m.getCanvas().style.cursor='pointer';const id=e.features?.[0]?.id;if(typeof id !== 'number')return;if(hoverRef.current!==null)m.setFeatureState({source:'regions',id:hoverRef.current},{hover:false});hoverRef.current=id;m.setFeatureState({source:'regions',id},{hover:true});});
  m.on('mouseleave','region-fill',()=>{m.getCanvas().style.cursor='';if(hoverRef.current!==null)m.setFeatureState({source:'regions',id:hoverRef.current},{hover:false});hoverRef.current=null;});
  return ()=>{cancelled=true;observer.disconnect();m.remove();map.current=null;};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[country.iso]);
 useEffect(()=>{const m=map.current,geo=dataRef.current;if(!m||!geo||!selected)return;const f=geo.features.find(f=>featureName(f.properties as Record<string,unknown>)===selected);if(f){const single:FeatureCollection={type:'FeatureCollection',features:[f]};try{m.fitBounds(boundsOf(single),{padding:90,duration:500,maxZoom:9});}catch{}}},[selected]);
 useEffect(()=>{if(!search.trim())return;const m=map.current,geo=dataRef.current; if(!m||!geo)return;const f=geo.features.find(f=>featureName(f.properties as Record<string,unknown>).toLowerCase()===search.toLowerCase());if(f)try{m.fitBounds(boundsOf({type:'FeatureCollection',features:[f]}),{padding:95,duration:500,maxZoom:9});}catch{}},[search]);
 return <div className="map-canvas" ref={host}/>;
}
function Modal({record,name,country,onClose,onEdit}:{record:RegionRecord|undefined;name:string;country:Country;onClose:()=>void;onEdit:()=>void}){
 const [photoIndex,setPhotoIndex]=useState<number|null>(null);
 const touchStart=useRef<number|null>(null);
 const pics=record?.photos || [];
 const cover=record?.cover||pics[0];
 const move=(direction:number)=>setPhotoIndex(i=>i===null?null:(i+direction+pics.length)%pics.length);
 useEffect(()=>{
  const fn=(e:KeyboardEvent)=>{
   if(e.key==='Escape') {e.stopPropagation(); if(photoIndex!==null)setPhotoIndex(null);else onClose();}
   if(photoIndex!==null && (e.key==='ArrowRight'||e.key==='ArrowLeft')){e.preventDefault();setPhotoIndex(i=>i===null?null:(i+(e.key==='ArrowRight'?1:-1)+pics.length)%pics.length);}
  };
  document.addEventListener('keydown',fn);
  return()=>document.removeEventListener('keydown',fn);
 },[onClose,photoIndex,pics.length]);
 return <div className="overlay region-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}} role="presentation"><section className="region-modal presentation-modal" role="dialog" aria-modal="true" aria-label={`Información de ${name}`}>
  <button className="close-circle" onClick={onClose} aria-label="Cerrar ficha"><X size={21}/></button>
  <div className="presentation-layout">
   <div className="presentation-media">
    {cover?<button type="button" className="presentation-cover" onClick={()=>setPhotoIndex(Math.max(0,pics.indexOf(cover)))} title="Ampliar fotografía de portada"><img src={cover} alt={`Portada de ${name}`}/><span className="cover-expand"><Expand size={18}/> Ver imagen</span></button>:<div className="presentation-empty"><Camera size={46}/><span>Agregá fotografías para proyectarlas aquí</span></div>}
    {pics.length>0&&<div className="presentation-thumbs" aria-label="Galería fotográfica">{pics.map((src,i)=><button key={`${i}-${src.slice(0,20)}`} type="button" onClick={()=>setPhotoIndex(i)} aria-label={`Ampliar fotografía ${i+1}`}><img src={src} alt={`${name}, fotografía ${i+1}`}/></button>)}</div>}
    {pics.length>0&&<span className="presentation-photo-count">{pics.length} {pics.length===1?'fotografía':'fotografías'} · Tocá para ampliar</span>}
   </div>
   <div className="presentation-details">
    <div className="presentation-heading"><span className="presentation-kicker">{country.flag} {country.name} / Departamento o región</span><h2>{record?.title||name}</h2><span className="presentation-region"><MapPin size={15}/>{name}</span></div>
    <div className="presentation-text">
     {record?.description?<p className="presentation-lead">{record.description}</p>:<div className="placeholder-note">Este departamento todavía no tiene una descripción.</div>}
     {record?.history&&<section><h3>Historia</h3><p>{record.history}</p></section>}
     {record?.culture&&<section><h3>Cultura y tradiciones</h3><p>{record.culture}</p></section>}
     {record?.places&&<section><h3>Lugares destacados</h3><p>{record.places}</p></section>}
    </div>
    <div className="presentation-actions"><button className="outline-btn" onClick={onEdit}><Edit3 size={16}/> Editar información y fotos</button></div>
   </div>
  </div>
  {photoIndex!==null&&pics.length>0&&<div className="lightbox photo-viewer" role="dialog" aria-modal="true" aria-label={`Fotografía ${photoIndex+1} de ${pics.length}`} onMouseDown={e=>{if(e.target===e.currentTarget)setPhotoIndex(null)}} onTouchStart={e=>{touchStart.current=e.touches[0]?.clientX??null}} onTouchEnd={e=>{if(touchStart.current===null)return;const difference=(e.changedTouches[0]?.clientX??touchStart.current)-touchStart.current;touchStart.current=null;if(Math.abs(difference)>55)move(difference<0?1:-1);}}>
    <div className="viewer-toolbar"><span>{name} · {photoIndex+1} / {pics.length}</span><button type="button" className="viewer-close" aria-label="Cerrar fotografía" onClick={()=>setPhotoIndex(null)}><X size={24}/></button></div>
    {pics.length>1&&<button type="button" className="viewer-arrow viewer-prev" onClick={()=>move(-1)} aria-label="Fotografía anterior"><ChevronLeft size={34}/></button>}
    <img key={photoIndex} src={pics[photoIndex]} alt={`Fotografía ${photoIndex+1} de ${name}`}/>
    {pics.length>1&&<button type="button" className="viewer-arrow viewer-next" onClick={()=>move(1)} aria-label="Fotografía siguiente"><ChevronRight size={34}/></button>}
    {pics.length>1&&<div className="viewer-instructions">← → para cambiar fotografía · Deslizá en el celular · Esc para cerrar</div>}
   </div>}
 </section></div>;
}
function Editor({country,name,record,onSave,onDelete,onCancel,busy}:{country:Country;name:string;record?:RegionRecord;onSave:(r:RegionRecord)=>Promise<void>;onDelete:(r:RegionRecord)=>Promise<void>;onCancel:()=>void;busy:boolean}){
 const [draft,setDraft]=useState<RegionRecord>(()=>record?{...record,photos:[...record.photos]}:blankRecord(country.iso,name));
 const [uploading,setUploading]=useState(false);const [error,setError]=useState('');
 const set=(key:keyof RegionRecord,value:string|boolean)=>setDraft(prev=>({...prev,[key]:value}));
 async function addFiles(files:FileList|null){if(!files?.length)return;setUploading(true);setError('');try {const uploaded:string[]=[];for(const f of Array.from(files)){uploaded.push(await uploadPhoto(f,draft.id));}setDraft(d=>({...d,photos:[...d.photos,...uploaded],cover:d.cover||uploaded[0]}));}catch(e){setError(e instanceof Error?e.message:'No se pudo subir.');}finally{setUploading(false);}}
 return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onCancel()}}><section className="editor-modal" role="dialog" aria-modal="true" aria-label="Editar departamento">
  <div className="editor-head"><div><span className="eyebrow">PANEL DE CONTENIDO</span><h2>Editar {name}</h2><p>{country.flag} {country.name} · Gestioná la información visible en el mapa.</p></div><button className="icon-btn" onClick={onCancel} aria-label="Cerrar"><X/></button></div>
  <form onSubmit={async e=>{e.preventDefault();setError('');try{await onSave({...draft,published:true,updatedAt:Date.now()});}catch(err){setError(err instanceof Error?err.message:'No se pudieron guardar los cambios.');}}}>
   <div className="editor-grid"><label>Título<input value={draft.title} onChange={e=>set('title',e.target.value)} required maxLength={120}/></label><div className="local-status"><Check size={16}/> Visible al guardar</div></div>
   <p className="local-help">Los cambios se guardan solo en este navegador. No se sincronizan con otros dispositivos.</p>
   <label>Descripción general<textarea rows={3} value={draft.description} onChange={e=>set('description',e.target.value)} placeholder="Describí este departamento..."/></label>
   <label>Historia<textarea rows={2} value={draft.history} onChange={e=>set('history',e.target.value)} placeholder="Escribí su historia..."/></label>
   <label>Cultura y tradiciones<textarea rows={2} value={draft.culture} onChange={e=>set('culture',e.target.value)} placeholder="Gastronomía, costumbres, festividades..."/></label>
   <label>Lugares destacados<textarea rows={2} value={draft.places} onChange={e=>set('places',e.target.value)} placeholder="Parques, volcanes, monumentos..."/></label>
   <div className="photos-heading"><h3>Fotografías <small>({draft.photos.length})</small></h3><span>Se comprimen para guardarlas en este navegador</span></div>
   <label className="upload-area"><UploadCloud size={27}/><strong>{uploading?'Preparando fotografías...':'Seleccionar o arrastrar fotografías'}</strong><small>JPG, PNG, WEBP · varias a la vez · guardar al terminar</small><input type="file" accept="image/*" multiple disabled={uploading} onChange={e=>{void addFiles(e.target.files);e.target.value='';}}/></label>
   {draft.photos.length>0&&<div className="edit-gallery">{draft.photos.map((src,i)=><div className="edit-photo" key={`${i}-${src.slice(0,16)}`}><img src={src} alt={`Foto ${i+1}`}/><div className="photo-actions"><button type="button" className={draft.cover===src?'cover-active':''} onClick={()=>setDraft(d=>({...d,cover:src}))} title="Definir portada"><Check size={14}/></button><button type="button" onClick={()=>setDraft(d=>{const photos=d.photos.filter((_,j)=>i!==j);return {...d,photos,cover:d.cover===src?(photos[0]||''):d.cover};})} title="Quitar foto"><X size={14}/></button></div>{draft.cover===src&&<span className="cover-tag">PORTADA</span>}</div>)}</div>}
   {error&&<p className="alert">{error}</p>}
   <div className="editor-actions">{record&&<button type="button" className="danger-btn" disabled={busy||uploading} onClick={()=>{if(window.confirm('¿Eliminar esta ficha y todo su texto? Las fotografías también se eliminarán de esta ficha local.'))void onDelete(record);}}><Trash2 size={15}/> Eliminar ficha</button>}<div className="push"/><button type="button" className="outline-btn" onClick={onCancel}>Cancelar</button><button type="submit" className="primary-btn" disabled={busy||uploading}><Check size={17}/>{busy?'Guardando...':'Guardar cambios'}</button></div>
  </form>
 </section></div>;
}
export default function App(){
 const [country,setCountry]=useState(COUNTRIES[0]);const [records,setRecords]=useState<RegionRecord[]>(()=>fetchRecords());const [areas,setAreas]=useState<Area[]>([]);const [selected,setSelected]=useState<string|null>(null);const [search,setSearch]=useState('');const [mapError,setMapError]=useState('');const [menu,setMenu]=useState(false);const [editing,setEditing]=useState(false);const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const [onlyPublished,setOnlyPublished]=useState(false);const [fullScreen,setFullScreen]=useState(false);const mapCard=useRef<HTMLDivElement>(null);
 useEffect(()=>{const sync=()=>setFullScreen(document.fullscreenElement===mapCard.current);document.addEventListener('fullscreenchange',sync);return()=>document.removeEventListener('fullscreenchange',sync);},[]);
 const toggleFullscreen=async()=>{if(!mapCard.current)return;try{if(document.fullscreenElement)await document.exitFullscreen();else await mapCard.current.requestFullscreen();}catch{setNotice('El navegador no permitió activar pantalla completa.');}};
 const region=selected?records.find(r=>r.id===recordId(country.iso,selected)):undefined;
 const matches=useMemo(()=>areas.filter(r=>r.name.toLowerCase().includes(search.toLowerCase()) && (!onlyPublished||records.some(rec=>rec.id===r.id&&rec.published))),[areas,search,onlyPublished,records]);
 const publishedCount=areas.filter(a=>records.some(r=>r.id===a.id&&r.published)).length;
 const openEdit=()=>setEditing(true);
 const chooseCountry=(c:Country)=>{setCountry(c);setSelected(null);setSearch('');setAreas([]);setMapError('');setMenu(false);};
 const save=async(r:RegionRecord)=>{setBusy(true);try{setRecords(await persistRecord(r,records));setEditing(false);setNotice('Ficha guardada correctamente.');setTimeout(()=>setNotice(''),3000);}finally{setBusy(false);}};
 const del=async(r:RegionRecord)=>{setBusy(true);try{setRecords(await removeRecord(r,records));setEditing(false);setSelected(null);setNotice('Ficha eliminada.');}finally{setBusy(false);}};
 return <div className="app">
  <header className="topbar"><div className="brand"><div className="brand-logo"><Globe2 size={25}/></div><div><strong>ATLAS<span>VIVO</span></strong><small>DESCUBRÍ CADA RINCÓN</small></div></div><nav className="desktop-nav"><span className="nav-active">Explorar mapa</span><span className="nav-sub">América Central</span></nav><div className="top-actions"><span className="mode-pill"><span className="green-dot"/> Guardado local</span><button className="header-btn" onClick={()=>{setSelected(areas[0]?.name||null);if(areas.length)setEditing(true);else setNotice('Esperá a que carguen las regiones del mapa.');}}><Edit3 size={17}/> Editar contenido</button><button className="icon-btn mobile-menu" onClick={()=>setMenu(!menu)} aria-label="Menú"><Menu/></button></div></header>
  <div className="layout"><aside className={`sidebar ${menu?'show':''}`}><div className="side-top"><span className="eyebrow">EXPLORADOR GEOGRÁFICO</span><h1>El mundo, <em>más cerca.</em></h1><p>Seleccioná un país y descubrí sus regiones, historias y paisajes.</p></div>
   <div className="side-section"><label className="section-label">PAÍS SELECCIONADO</label><div className="country-select-wrap"><select className="country-select" value={country.iso} onChange={e=>chooseCountry(COUNTRIES.find(c=>c.iso===e.target.value)!)}>{COUNTRIES.map(c=><option key={c.iso} value={c.iso}>{c.flag}  {c.name}</option>)}</select><ChevronDown size={16}/></div></div>
   <div className="side-section"><div className="section-row"><label className="section-label">REGIONES</label><span className="count">{areas.length}</span></div><div className="searchbox"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar departamento..."/></div><label className="checkline"><input type="checkbox" checked={onlyPublished} onChange={e=>setOnlyPublished(e.target.checked)}/> Solo con información agregada</label></div>
   <div className="region-list">{matches.map(a=><button key={a.id} className={`region-row ${selected===a.name?'active':''}`} onClick={()=>{setSelected(a.name);setMenu(false);}}><MapPin size={15}/><span>{regionAlias(a.name)}</span>{records.find(r=>r.id===a.id&&r.published)?<span className="published-dot" title="Publicado"/>:<ArrowRight size={14}/>}</button>)}{matches.length===0&&<p className="muted-list">{areas.length?'No hay coincidencias.':'Cargando regiones...'}</p>}</div>
   <div className="sidebar-foot"><div className="stat-mini"><strong>{publishedCount}<span> / {areas.length||'—'}</span></strong><small>Regiones con contenido</small></div><button className="add-btn" onClick={()=>{setSelected(areas[0]?.name||null);if(areas.length)setEditing(true);else setNotice('Esperá a que carguen las regiones.');}}><Plus size={16}/> Crear contenido</button></div>
  </aside>
  <main className="content"><div className="hero"><div><span className="eyebrow hero-label"><Compass size={15}/> TU PRÓXIMA EXPLORACIÓN</span><h2>Explorá <span>{country.name}.</span></h2><p>Un mapa, miles de historias por descubrir. Tocá una región para empezar.</p></div><div className="hero-mark">{country.flag}</div></div>
   <div className="map-card" ref={mapCard}><div className="map-top"><div><span className="map-pin-icon"><MapPin size={18}/></span><div><strong>Mapa interactivo</strong><small>{country.name} · Divisiones administrativas</small></div></div><div className="map-tools"><span className="live-pill"><span className="green-dot"/> EXPLORAR</span><button className="fullscreen-btn" onClick={()=>void toggleFullscreen()} title={fullScreen?"Salir de pantalla completa":"Proyectar mapa a pantalla completa"}>{fullScreen?<Minimize size={18}/>:<Expand size={18}/>}<span>{fullScreen?"Salir":"Pantalla completa"}</span></button></div></div>
    <div className="map-body"><MapPanel key={country.iso} country={country} selected={selected} search={search} onSelect={name=>setSelected(name)} onRegions={setAreas} onError={setMapError}/>{mapError&&<div className="map-error"><strong>No se pudo cargar el mapa</strong><p>{mapError}</p><small>Revisá tu conexión. Podés cambiar de país e intentarlo de nuevo.</small></div>}<div className="map-hint"><ZoomIn size={15}/> Arrastrá para mover · Rueda para ampliar · Tocá una región</div></div>
    <div className="map-footer"><span><span className="legend-square"/> Límites administrativos <a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer">Datos: geoBoundaries / OSM</a></span><span>{areas.length||'—'} regiones disponibles</span></div>
    {fullScreen&&selected&&!editing&&<Modal key={`fullscreen-${country.iso}-${selected}`} record={region} name={selected} country={country} onClose={()=>setSelected(null)} onEdit={()=>{void document.exitFullscreen().catch(()=>{});openEdit();}}/>}
   </div><div className="bottom-grid"><div className="tip-card"><div className="tip-icon"><Eye/></div><div><strong>Explorá a tu ritmo</strong><p>Seleccioná un departamento en el mapa o desde la lista para ver su ficha.</p></div></div><div className="tip-card"><div className="tip-icon"><ImagePlus/></div><div><strong>Tu propio contenido</strong><p>Editá libremente y guardá tus fotos e historias en este navegador, sin cuentas ni conexión a Firebase.</p></div></div></div>
  </main></div>
  {selected&&!editing&&!fullScreen&&<Modal key={`${country.iso}-${selected}`} record={region} name={selected} country={country} onClose={()=>setSelected(null)} onEdit={openEdit}/>}
  {editing&&selected&&<Editor key={`${country.iso}-${selected}-${region?.updatedAt||0}`} country={country} name={selected} record={region} onSave={save} onDelete={del} onCancel={()=>setEditing(false)} busy={busy}/>}
  {notice&&<div className="toast"><Check size={17}/>{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}
  <footer className="footer"><span>© Atlas Vivo · Creado para explorar y compartir</span><span>Construido con React + MapLibre</span></footer>
 </div>;
}
