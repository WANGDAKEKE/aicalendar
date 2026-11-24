/** Shared native vector geometry for the widget expression extension. */
export const C=Object.freeze({white:'#F5F5F5',ink:'#111111',blue:'#60C6F4',blueDark:'#299BDE',pink:'#F296AE',amber:'#F4C65B'});
let serial=0;
export const line=(d,color=C.ink,width=3)=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
export function star(cx,cy,r=12,color=C.ink){
  const points=Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.46:r;return `${cx+Math.cos(a)*rr},${cy+Math.sin(a)*rr}`;}).join(' ');
  return `<polygon points="${points}" fill="${color}"/>`;
}
export function heart(cx,cy,r=13,color=C.ink){
  return `<path d="M${cx} ${cy+r*.8}C${cx-r*1.8} ${cy-r*.2} ${cx-r*.75} ${cy-r*1.55} ${cx} ${cy-r*.6}C${cx+r*.75} ${cy-r*1.55} ${cx+r*1.8} ${cy-r*.2} ${cx} ${cy+r*.8}Z" fill="${color}"/>`;
}
export function eye(cx,cy,options={}){
  const {rx=20,ry=32,px=0,py=5,prx=9,pry=14,rot=0,mode='open',pupil='ellipse',highlight=true,watery=false,upperSlope=0,stroke=C.ink,pupilColor=C.ink}=options;
  const id=`eye-extension-${++serial}`;
  if(mode==='closed'||mode==='happy'){
    const d=mode==='happy'?`M${cx-rx} ${cy+5}Q${cx} ${cy-21} ${cx+rx} ${cy+5}`:`M${cx-rx} ${cy}Q${cx} ${cy+18} ${cx+rx} ${cy}`;
    return `<g transform="rotate(${rot} ${cx} ${cy})">${line(d,'#11111155',9)}${line(d,C.white,7)}</g>`;
  }
  let shape=`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
  if(mode==='half') shape=`<path d="M${cx-rx} ${cy-4-upperSlope}L${cx+rx} ${cy-4+upperSlope}Q${cx+rx} ${cy+ry} ${cx} ${cy+ry}Q${cx-rx} ${cy+ry} ${cx-rx} ${cy-4-upperSlope}Z"/>`;
  if(mode==='squint') shape=`<path d="M${cx-rx} ${cy-3}Q${cx} ${cy-14} ${cx+rx} ${cy-3}Q${cx} ${cy+13} ${cx-rx} ${cy-3}Z"/>`;
  if(mode==='sad') shape=`<path d="M${cx-rx} ${cy-ry*.65}Q${cx} ${cy-ry*.5} ${cx+rx} ${cy-ry*.9}Q${cx+rx*1.4} ${cy+ry} ${cx} ${cy+ry}Q${cx-rx*1.4} ${cy+ry} ${cx-rx} ${cy-ry*.65}Z"/>`;
  let iris=`<ellipse cx="${cx+px}" cy="${cy+py}" rx="${prx}" ry="${pry}" fill="${pupilColor}"/>`;
  if(pupil==='star')iris=star(cx+px,cy+py,Math.max(prx,pry),pupilColor);
  if(pupil==='heart')iris=heart(cx+px,cy+py,Math.max(prx,pry),pupilColor);
  if(pupil==='tiny')iris=`<circle cx="${cx+px}" cy="${cy+py}" r="${prx}" fill="${pupilColor}"/>`;
  const glint=highlight&&pupil==='ellipse'?`<ellipse cx="${cx+px+prx*.3}" cy="${cy+py-pry*.4}" rx="${Math.max(1,prx*.28)}" ry="${Math.max(1,prx*.3)}" fill="${C.white}"/>`:'';
  const water=watery?`<path d="M${cx-rx-3} ${cy+ry*.55}Q${cx} ${cy+ry*.22} ${cx+rx+3} ${cy+ry*.55}V${cy+ry+3}H${cx-rx-3}Z" fill="${C.blue}" fill-opacity=".84"/>${line(`M${cx-rx*.75} ${cy+ry*.58}Q${cx} ${cy+ry*.38} ${cx+rx*.7} ${cy+ry*.58}`,C.white,1.8)}`:'';
  const lid=mode==='half'?line(`M${cx-rx} ${cy-4-upperSlope}L${cx+rx} ${cy-4+upperSlope}`,stroke,2):'';
  return `<g transform="rotate(${rot} ${cx} ${cy})"><defs><clipPath id="${id}">${shape}</clipPath></defs><g fill="${C.white}" stroke="#111111" stroke-opacity=".15" stroke-width=".8">${shape}</g><g clip-path="url(#${id})">${iris}${glint}${water}</g>${lid}</g>`;
}
export function pair(left={},right={}, {angle=0}={}){
  return `<g transform="rotate(${angle} 80 56)">${eye(53,53,left)}${eye(107,49,right)}</g>`;
}
export function tear(x,y,{scale=1,angle=0,kind='drop'}={}){
  const shape=kind==='stream'?'<path d="M-6 0Q0 3 6 0L8 30Q7 38 0 38Q-7 38-8 30Z"/>':'<path d="M0 -10C-2 -4-9 2-8 8C-7 18 7 18 8 8C9 2 2 -4 0 -10Z"/>';
  return `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})"><g fill="${C.blue}">${shape}</g>${line(kind==='stream'?'M-2 8L-2 27':'M-3 4Q-5 8-2 10','#FFFFFFAA',1.8)}</g>`;
}
export function sweat(x,y,{scale=1,angle=18}={}){return tear(x,y,{scale,angle});}
export function sparkle(x,y,r=6,color=C.amber){return `<path d="M${x} ${y-r}Q${x+1} ${y-1} ${x+r} ${y}Q${x+1} ${y+1} ${x} ${y+r}Q${x-1} ${y+1} ${x-r} ${y}Q${x-1} ${y-1} ${x} ${y-r}Z" fill="${color}"/>`;}
