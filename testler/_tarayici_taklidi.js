const fs = require('fs');
const IDS = new Set(JSON.parse(fs.readFileSync(process.env.IDFILE,'utf8')));
const SEED = JSON.parse(fs.readFileSync(process.env.SEEDFILE,'utf8'));
function mkEl(id){
  const o = { id, textContent:'', innerHTML:'', value:'', className:'', style:{}, dataset:{},
    files:[], checked:false, addEventListener(){}, removeEventListener(){}, click(){},
    querySelector(){return mkEl('sub')}, querySelectorAll(){return []}, appendChild(){},
    classList:{add(){},remove(){},contains(){return false}},
    getContext(){return new Proxy({},{get:()=>()=>({width:0})})}, toDataURL(){return''} };
  return o;
}
global.document = { getElementById(id){ return IDS.has(id)?mkEl(id):null }, querySelectorAll(){return[]},
  querySelector(){return null}, createElement(){return mkEl('yeni')}, addEventListener(){} };
global.window = { addEventListener(){} };
const _d = Object.assign({}, SEED);
global.localStorage = { _d, get length(){return Object.keys(_d).length},
  setItem(k,v){_d[k]=v}, getItem(k){return _d[k]??null}, removeItem(k){delete _d[k]},
  key(i){return Object.keys(_d)[i]??null} };
global.alert=(m)=>console.log('  [ALERT]',m);
global.confirm=(m)=>{ console.log('  [CONFIRM]',String(m).split('\n')[0].slice(0,70)); return true; };
global.prompt=()=>null;
global.FileReader=function(){}; global.Blob=function(){};
Object.assign(global.URL, {createObjectURL(){return''}, revokeObjectURL(){}});   // Node'un URL sinifini EZME (new URL kullaniliyor)
