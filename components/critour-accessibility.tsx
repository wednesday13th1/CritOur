'use client';

import {useEffect,useState} from 'react';

const storageKey='critour-display-preferences';
const sizes={small:'87.5%',standard:'100%',large:'125%',extra:'150%'} as const;
const palettes=['standard','distinct','mono'] as const;
type Preferences={size:keyof typeof sizes;palette:typeof palettes[number];contrast:boolean;reduce:boolean};
const defaults:Preferences={size:'standard',palette:'standard',contrast:false,reduce:false};

function apply(value:Preferences){
 const root=document.documentElement;
 root.style.setProperty('--cr-text-scale',sizes[value.size]);
 root.dataset.crPalette=value.palette;
 root.dataset.crContrast=String(value.contrast);
 root.dataset.crReduce=String(value.reduce);
}

function read():Preferences {
 try {
  const value=JSON.parse(localStorage.getItem(storageKey)||'null');
  if(!value||typeof value!=='object')return defaults;
  return {
   size:Object.hasOwn(sizes,value.size)?value.size:defaults.size,
   palette:palettes.includes(value.palette)?value.palette:defaults.palette,
   contrast:value.contrast===true,reduce:value.reduce===true,
  };
 }catch{return defaults}
}

export function DisplayPreferences(){
 const [value,setValue]=useState(defaults);
 useEffect(()=>{
  const restore=()=>{const saved=read();apply(saved);setValue(saved)};
  restore();
  const sync=(event:StorageEvent)=>{if(event.key===storageKey||event.key===null)restore()};
  window.addEventListener('storage',sync);
  return()=>window.removeEventListener('storage',sync);
 },[]);
 function update(change:Partial<Preferences>){
  const next={...value,...change};
  setValue(next);apply(next);
  try{localStorage.setItem(storageKey,JSON.stringify(next))}catch{/* Applies to this page even if storage is unavailable. */}
 }
 return <details className="cr-display">
  <summary>表示と操作の設定</summary>
  <div className="cr-display-options">
   <label>文字サイズ<select value={value.size} onChange={e=>update({size:e.target.value as Preferences['size']})}>
    <option value="small">小さめ</option><option value="standard">標準</option><option value="large">大きめ</option><option value="extra">特大</option>
   </select></label>
   <label>貢献の配色<select value={value.palette} onChange={e=>update({palette:e.target.value as Preferences['palette']})}>
    <option value="standard">標準</option><option value="distinct">色の区別を補助する配色</option><option value="mono">モノクロ</option>
   </select></label>
   <label><input type="checkbox" checked={value.contrast} onChange={e=>update({contrast:e.target.checked})}/>高コントラスト</label>
   <label><input type="checkbox" checked={value.reduce} onChange={e=>update({reduce:e.target.checked})}/>アニメーションを減らす</label>
  </div>
 </details>;
}
