"use client";
import {useEffect,useRef,useState} from "react";

// A photographic base stays visible until the optional GPU layer is ready.
export function OceanSurface(){
 const [paused,setPaused]=useState(false);
 const root=useRef<HTMLDivElement>(null), canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const host=root.current, el=canvas.current;if(!host||!el)return;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let dispose=()=>{};
  const setup=()=>{
   dispose();el.style.opacity='0';if(motion.matches||paused)return;
   const gl=el.getContext('webgl',{alpha:false,antialias:false,depth:false,powerPreference:'low-power'});if(!gl)return;
   let frame=0,visible=false,ready=false,last=0,time=0,previous=0,dead=false;
   const shaders:WebGLShader[]=[];
   const shader=(kind:number,source:string)=>{const s=gl.createShader(kind);if(!s)return null;shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);return gl.getShaderParameter(s,gl.COMPILE_STATUS)?s:null;};
   const vs=shader(gl.VERTEX_SHADER,'attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}');
   const fs=shader(gl.FRAGMENT_SHADER,`precision mediump float;
    varying vec2 uv;uniform sampler2D water;uniform vec2 resolution;uniform vec2 pointer;uniform float imageRatio;uniform float t;uniform float scrollShift;
    void main(){
     vec2 p=uv;float ratio=resolution.x/resolution.y;
     if(ratio>imageRatio)p.y=(p.y-.5)*imageRatio/ratio+.5;else p.x=(p.x-.5)*ratio/imageRatio+.5;
     p=(p-.5)*.94+.5+pointer*.006+vec2(0.,scrollShift*.015);
     vec2 q=p*14.;
     vec2 swell=vec2(sin(q.y*.73+t*.24)+sin(q.x*.63+q.y*.42-t*.19),cos(q.x*.8-t*.21)+sin(q.y*.56-q.x*.31+t*.16));
     vec2 detail=vec2(sin(q.y*3.1+q.x*.8+t*.37),cos(q.x*2.7-q.y*.9-t*.31));
     vec2 bend=swell*.0027+detail*.00065;
     vec3 color=texture2D(water,vec2(p.x+bend.x,1.-p.y-bend.y)).rgb;
     float light=sin(q.x*1.9+sin(q.y*1.7+t*.2)*1.3+t*.25)*sin(q.y*2.1+sin(q.x*.9-t*.18));
     color+=vec3(.58,.85,.84)*pow(max(light,0.),12.)*.055;
     gl_FragColor=vec4(color,1.);
    }`);
   if(!vs||!fs){shaders.forEach(s=>gl.deleteShader(s));return;}
   const program=gl.createProgram();if(!program)return;gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));return;}
   gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
   const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
   const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   const uniforms=Object.fromEntries(['resolution','pointer','imageRatio','t','scrollShift'].map(k=>[k,gl.getUniformLocation(program,k)]));
   let px=0,py=0,x=0,y=0;
   const resize=()=>{const dpr=Math.min(devicePixelRatio,1.5);el.width=Math.max(1,Math.round(host.clientWidth*dpr));el.height=Math.max(1,Math.round(host.clientHeight*dpr));gl.viewport(0,0,el.width,el.height);gl.uniform2f(uniforms.resolution,el.width,el.height);};
   const draw=(now:number)=>{frame=0;if(dead||!visible||document.hidden||!ready)return;frame=requestAnimationFrame(draw);if(now-last<1000/30)return;last=now;time+=previous?Math.min((now-previous)/1000,.08):0;previous=now;x+=(px-x)*.04;y+=(py-y)*.04;gl.uniform1f(uniforms.t,time);gl.uniform2f(uniforms.pointer,x,y);gl.uniform1f(uniforms.scrollShift,Math.min(1,Math.max(0,-host.getBoundingClientRect().top/host.clientHeight)));gl.drawArrays(gl.TRIANGLES,0,6);el.style.opacity='1';};
   const sync=()=>{if(frame)cancelAnimationFrame(frame);frame=0;previous=0;if(visible&&!document.hidden&&ready&&!dead)frame=requestAnimationFrame(draw);};
   const image=new Image();image.onload=()=>{if(dead)return;gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);gl.uniform1f(uniforms.imageRatio,image.width/image.height);ready=true;resize();sync();};image.src='/ocean-water.webp';
   const pointer=(e:PointerEvent)=>{if(e.pointerType!=='mouse')return;const r=host.getBoundingClientRect();px=(e.clientX-r.left)/r.width-.5;py=(e.clientY-r.top)/r.height-.5;};
   const leave=()=>{px=0;py=0;};const lost=(e:Event)=>{e.preventDefault();el.style.opacity='0';dead=true;if(frame)cancelAnimationFrame(frame);};
   const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();});observer.observe(host);
   const size=new ResizeObserver(resize);size.observe(host);host.addEventListener('pointermove',pointer,{passive:true});host.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',sync);el.addEventListener('webglcontextlost',lost);
   dispose=()=>{dead=true;if(frame)cancelAnimationFrame(frame);image.onload=null;observer.disconnect();size.disconnect();host.removeEventListener('pointermove',pointer);host.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',sync);el.removeEventListener('webglcontextlost',lost);gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));};
  };
  setup();motion.addEventListener('change',setup);return()=>{motion.removeEventListener('change',setup);dispose();};
 },[paused]);
 return <><div className="ocean-surface" ref={root} aria-hidden="true"><img className="ocean-still" src="/ocean-water.webp" alt="" fetchPriority="high"/><canvas ref={canvas}/><div className="ocean-shade"/></div><button className="ocean-pause" onClick={()=>setPaused(p=>!p)} aria-pressed={paused} aria-label={paused?"Resume water animation":"Pause water animation"}>{paused?"Play water ↗":"Pause water Ⅱ"}</button></>;
}
