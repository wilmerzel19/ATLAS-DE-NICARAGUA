export type Country = {iso:string; name:string; flag:string; center:[number,number]; zoom:number};
export type RegionRecord = {id:string; countryIso:string; regionKey:string; name:string; title:string; description:string; history:string; culture:string; places:string; cover:string; photos:string[]; published:boolean; updatedAt:number};
export const COUNTRIES:Country[] = [
  {iso:'NIC',name:'Nicaragua',flag:'🇳🇮',center:[-85.2,12.85],zoom:6.5},
  {iso:'HND',name:'Honduras',flag:'🇭🇳',center:[-86.5,14.7],zoom:6.2},
  {iso:'CRI',name:'Costa Rica',flag:'🇨🇷',center:[-84.2,9.9],zoom:6.7},
  {iso:'GTM',name:'Guatemala',flag:'🇬🇹',center:[-90.3,15.65],zoom:6.3},
  {iso:'SLV',name:'El Salvador',flag:'🇸🇻',center:[-88.9,13.75],zoom:7.4},
  {iso:'PAN',name:'Panamá',flag:'🇵🇦',center:[-80.0,8.7],zoom:6.3}
];
export function slug(value:string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
export function recordId(iso:string,name:string) {return `${iso.toLowerCase()}--${slug(name)}`;}
export function blankRecord(iso:string,name:string):RegionRecord {return {id:recordId(iso,name),countryIso:iso,regionKey:slug(name),name,title:name,description:'',history:'',culture:'',places:'',cover:'',photos:[],published:false,updatedAt:Date.now()};}
export const DEMO_RECORDS: RegionRecord[] = [
  {...blankRecord('NIC','Estelí'),description:'Conocido por sus paisajes montañosos, su tradición tabacalera y su cultura del norte de Nicaragua.',history:'Estelí es un importante centro cultural y económico del norte nicaragüense.',culture:'Tradición artesanal, tabacalera y expresiones culturales del norte.',places:'Reserva Natural Miraflor, Salto La Estanzuela.',published:true},
  {...blankRecord('NIC','Managua'),description:'Capital de Nicaragua y centro urbano, económico y cultural del país.',places:'Puerto Salvador Allende, Loma de Tiscapa.',published:true},
  {...blankRecord('NIC','León'),description:'Departamento del occidente nicaragüense, reconocido por su historia, arquitectura y paisajes volcánicos.',places:'Catedral de León, Cerro Negro.',published:true}
];
// Datos de ejemplo al abrir por primera vez; los cambios se conservan en localStorage.
export function loadDemo():RegionRecord[]{try {const data=localStorage.getItem('atlas-vivo-v1'); if(data) return JSON.parse(data) as RegionRecord[];}catch{} return DEMO_RECORDS;}
export function saveDemo(records:RegionRecord[]){localStorage.setItem('atlas-vivo-v1',JSON.stringify(records));}
