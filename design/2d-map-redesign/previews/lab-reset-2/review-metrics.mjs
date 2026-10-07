import fs from 'node:fs';import * as G from './geometry.mjs';
const root=new URL('./',import.meta.url),slots=JSON.parse(fs.readFileSync(new URL('slots.json',root))),rows=[];
const screens=[{name:'desktop1440',w:1050,h:788},{name:'mobile390',w:364,h:303},{name:'mobile320',w:294,h:245},{name:'landscape844',w:786,h:590}];
const places={spawn:G.SPAWN,front:G.point(724,751),base:G.point(724,710),west:G.point(475,478),archive:G.point(325,418),north:G.point(724,310)};
for(const screen of screens)for(const mode of ['fixed','recommended','legacy'])for(const [place,p] of Object.entries(places))for(let block=1;block<=6;block++){
 const h=mode==='legacy'&&screen.name.startsWith('mobile')?screen.w*(screen.name==='mobile390'?788/390:684/320):screen.h,c=G.camera(p,mode,screen.w,h),visible=slots.filter(s=>s.x-20>=c.x&&s.x+20<=c.x+c.w&&s.y-20>=c.y&&s.y+20<=c.y+c.h);
 rows.push({screen:screen.name,mode,place,block,camera:c,bodyWidth:31.5*screen.w/c.w,activeDiameter:40*screen.w/c.w,otherDiameter:28*screen.w/c.w,minimumActiveGap:24*screen.w/c.w,visible:{active:visible.filter(s=>s.block===block).length,completed:visible.filter(s=>s.block<block).length,locked:visible.filter(s=>s.block>block).length}});
}
let maxDelta=0;for(let y=420;y<1050;y++)for(const x of [340,504,768,1035]){const a=G.camera({x,y},'recommended',364,303),b=G.camera({x,y:y+1},'recommended',364,303);maxDelta=Math.max(maxDelta,Math.hypot(a.x-b.x,a.y-b.y));}
fs.writeFileSync(new URL('camera-density-audit.json',root),JSON.stringify({note:'Static camera model. A/B show same58 provisional slots, missing sounds never padded. No real phone certification.',maxTargetShiftPer1WorldStep:maxDelta,rows},null,2));
console.log(JSON.stringify({rows:rows.length,maxTargetShiftPer1WorldStep:maxDelta}));
