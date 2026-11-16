import { RegionRecord, loadDemo, saveDemo } from './data';

export function fetchRecords():RegionRecord[] {return loadDemo();}
export async function persistRecord(record:RegionRecord, prev:RegionRecord[]):Promise<RegionRecord[]> {
 const next=[...prev.filter(r=>r.id!==record.id),record];
 try {saveDemo(next);} catch(e) {if(e instanceof DOMException && (e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED')) throw Error('No hay espacio suficiente en localStorage. Eliminá algunas fotos o usá imágenes más pequeñas.');throw e;}
 return next;
}
export async function removeRecord(record:RegionRecord, prev:RegionRecord[]):Promise<RegionRecord[]> {
 const next=prev.filter(r=>r.id!==record.id);saveDemo(next);return next;
}
// Convierte fotos a WebP de hasta 1000px para ahorrar el espacio limitado de localStorage.
export async function uploadPhoto(file:File, _recordId:string):Promise<string> {
 if(!file.type.startsWith('image/')) throw Error('Seleccioná una imagen válida.');
 if(file.size>15*1024*1024) throw Error('La foto supera los 15 MB.');
 const img=await createImageBitmap(file).catch(()=>{throw Error('No se pudo abrir esta fotografía.');});
 try {
  const scale=Math.min(1,1000/Math.max(img.width,img.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('El navegador no permite procesar imágenes.');ctx.drawImage(img,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/webp',0.68);
 } finally {img.close();}
}
