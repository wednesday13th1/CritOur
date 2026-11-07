'use client';

import {useState} from 'react';

export function GalleryCover({src,title,category,x=50,y=50}:{
  src?:string;title:string;category:string;x?:number;y?:number;
}) {
  const [failed,setFailed] = useState<string>();
  return <div className="cr-gallery-cover">
    <div className="cr-gallery-placeholder" aria-hidden="true"><strong>{title}</strong><span>{category}</span></div>
    {src&&failed!==src&&<img src={src} alt={title+'のカバー画像'} loading="lazy" decoding="async"
      style={{objectPosition:x+'% '+y+'%'}} onError={()=>setFailed(src)}/>}
  </div>;
}
