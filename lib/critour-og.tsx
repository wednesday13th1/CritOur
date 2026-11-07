import {ImageResponse} from 'next/og';

export function cardImage(title:string,description:string,impact=false){
 return new ImageResponse(
  <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between',background:'#FFFFFF',color:'#171717',padding:64,fontFamily:'sans-serif'}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:28}}>
    <span>CritOur</span>
    <div style={{display:'flex',gap:8}}>
     {Array.from({length:4},(_,index)=><div key={index} style={{width:24,height:24,borderRadius:4,border:'1px solid #E5E5E5',background:impact&&index===0?'#A9C7EF':'#FAFAFA'}}/>)}
    </div>
   </div>
   <div style={{display:'flex',flexDirection:'column',gap:20}}>
    <div style={{fontSize:62,lineHeight:1.1}}>{title.slice(0,80)}</div>
    <div style={{fontSize:28,color:'#525252'}}>{description.slice(0,150)}</div>
   </div>
   <div style={{display:'flex',height:1,background:'#E5E5E5'}}/>
  </div>,
  {width:1200,height:630,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}},
 );
}
