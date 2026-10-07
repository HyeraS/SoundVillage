// RESET-2 only. Hand interpreted base footprints; no pixel-color collision extraction.
export const SCALE=1536/1448;
export const WORLD={w:1536,h:1152,tile:32};
export const PLAYER={w:22,h:28,spriteW:72,spriteH:88,speed:5.85/0.01667};
export const point=(x,y)=>({x:x*SCALE,y:y*SCALE});
const rect=(id,x,y,w,h,note='manual ground contact')=>({id,type:'rect',x:x*SCALE,y:y*SCALE,w:w*SCALE,h:h*SCALE,note});
const ellipse=(id,cx,cy,rx,ry)=>({id,type:'ellipse',cx:cx*SCALE,cy:cy*SCALE,rx:rx*SCALE,ry:ry*SCALE,note:'manual base envelope; painted raised top excluded'});
const poly=(id,pts)=>({id,type:'polygon',points:pts.map(([x,y])=>[x*SCALE,y*SCALE])});
export const FLOOR=poly('interior-floor',[[63,212],[416,212],[416,95],[1035,95],[1035,210],[1383,210],[1383,840],[1300,884],[834,884],[834,1085],[613,1085],[613,884],[155,884],[63,836]]);
export const SOLIDS=[
 rect('north-back',430,91,592,49),rect('north-west-wall',414,130,30,170),rect('north-east-wall',1009,135,28,165),
 rect('archive-back',66,210,345,25),rect('signal-back',1040,209,343,25),
 rect('archive-boundary-upper',393,248,38,175),rect('archive-boundary-lower',389,531,43,100),
 rect('signal-boundary-upper',1008,250,36,172),rect('signal-boundary-lower',1009,533,36,98),
 rect('west-support-divider',64,627,337,27),rect('east-support-divider',1042,627,340,27),
 rect('southwest-inner-wall',471,746,34,132),rect('southeast-inner-wall',940,746,34,132),
 rect('southwest-gate-wall',505,847,110,52),rect('southeast-gate-wall',834,847,106,52),
 rect('south-rim-west',154,857,315,28),rect('south-rim-east',974,857,331,28),
 rect('southwest-plant',329,710,49,43),rect('southwest-instruments',377,770,75,56),
 rect('southwest-back',74,680,251,36),rect('southwest-desk',119,766,64,51),
 rect('southeast-back',1075,677,277,48),rect('southeast-desk',1108,780,91,53),rect('southeast-panel',1265,781,104,55),
 rect('archive-shelf-a',87,241,69,87),rect('archive-shelf-b',187,231,132,34),rect('archive-desk',162,310,65,49),
 rect('archive-left-wall-devices',64,348,57,183),rect('archive-low-desk',88,554,89,51),
 ellipse('archive-observer-base',239,481,48,36),ellipse('archive-east-pillar',349,286,27,26),
 rect('spectrum-west-desk',466,153,101,48),rect('spectrum-east-desk',876,155,106,48),
 rect('spectrum-console',665,188,119,38),ellipse('spectrum-pillar-west',619,212,27,30),ellipse('spectrum-pillar-east',824,212,27,30),
 rect('signal-shelves',1094,229,219,37),rect('signal-workbench',1106,295,98,46),
 ellipse('signal-observer-base',1180,491,65,39),rect('signal-wall-instruments',1338,337,41,209),rect('signal-low-desk',1294,567,74,39),
 ellipse('central-base',724,558,162,102),
 ellipse('central-west-support',545,394,39,27),ellipse('central-east-support',903,394,39,27),
 rect('central-west-pillar',552,526,41,77),rect('central-east-pillar',851,523,35,78),
 ellipse('lamp-west',523,536,14,14),ellipse('lamp-east',922,537,14,14),ellipse('lamp-front',594,650,14,13),
 ellipse('entrance-lamp-west',584,840,23,30),ellipse('entrance-lamp-east',865,840,23,30),
];
// Foreground replays original pixels only inside hand-traced silhouettes. Not alpha-clean final sprites.
export const OCCLUDERS=[
 {...poly('upper-frame',[[674,304],[706,302],[747,310],[788,332],[818,363],[843,407],[855,450],[855,513],[837,513],[838,448],[827,407],[804,368],[778,346],[744,327],[704,317],[674,320]]),depth:610*SCALE,note:'approximate brass arch silhouette; thin edge/empty-hole accuracy pending'},
 {...poly('west-frame',[[560,590],[548,587],[549,480],[560,444],[592,415],[641,391],[690,374],[742,365],[747,382],[696,390],[648,406],[601,430],[576,457],[564,485]]),depth:610*SCALE,note:'frame upper projection; not a collision wall'},
 {...rect('central-top',571,438,292,134),depth:646*SCALE,note:'conservative upper machinery projection; rectangular replay may occlude extra background'},
 {...rect('west-support-top',522,327,48,60),depth:421*SCALE},
 {...rect('east-support-top',880,327,49,60),depth:421*SCALE},
 {...rect('archive-partition-cap',392,393,39,25),depth:425*SCALE},
 {...rect('archive-low-cap',389,516,43,24),depth:549*SCALE},
 {...rect('archive-observer-top',218,383,44,83),depth:512*SCALE},
 {...rect('archive-workbench-top',159,281,69,44),depth:359*SCALE},
];
export const SPAWN=point(724,969);
export const EXIT=rect('exit',655,1040,135,42);
export const APPROACHES=[rect('entrance',676,910,96,96),rect('archive-opening',372,438,96,80),rect('spectrum-approach',677,276,96,74),rect('signal-opening',984,438,96,80)];
export const ROUTE=[[724,969],[724,878],[724,751],[565,717],[483,629],[475,478],[365,476],[325,418],[286,390],[325,418],[365,476],[475,478],[483,629],[565,717],[724,751],[724,969]].map(([x,y])=>point(x,y));
export const LOOP=[[724,751],[565,717],[483,629],[475,478],[481,314],[724,310],[977,314],[976,478],[976,629],[875,727],[724,751]].map(([x,y])=>point(x,y));
export const TEST_AREA=poly('first-route-scope',[[610,1025],[838,1025],[838,717],[610,674],[528,604],[530,438],[388,430],[388,365],[250,365],[250,555],[370,555],[443,631],[530,758],[610,856]]);
export const BLOCK_REGIONS=[
 rect('B1',540,700,375,220),rect('B2',69,653,453,195),rect('B3',69,236,461,384),
 rect('B4',445,144,551,224),rect('B5',951,236,427,382),rect('B6',974,653,404,195)
];
export function inside(x,y,s){if(s.type==='rect')return x>=s.x&&x<=s.x+s.w&&y>=s.y&&y<=s.y+s.h;if(s.type==='ellipse')return ((x-s.cx)/s.rx)**2+((y-s.cy)/s.ry)**2<=1;let c=false;const a=s.points;for(let i=0,j=a.length-1;i<a.length;j=i++){if(((a[i][1]>y)!==(a[j][1]>y))&&(x<(a[j][0]-a[i][0])*(y-a[i][1])/(a[j][1]-a[i][1])+a[i][0]))c=!c;}return c;}
export const footBox=(x,y)=>({x:x-11,y:y-28,w:22,h:28});
export function boxHits(b,s){if(s.type==='rect')return b.x<s.x+s.w&&b.x+b.w>s.x&&b.y<s.y+s.h&&b.y+b.h>s.y;if(s.type==='ellipse'){let x=Math.max(b.x,Math.min(s.cx,b.x+b.w)),y=Math.max(b.y,Math.min(s.cy,b.y+b.h));return inside(x,y,s);}const corners=[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]];if(corners.some(([x,y])=>inside(x,y,s))||s.points.some(([x,y])=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h))return true;const cross=(a,c,d)=>(c[0]-a[0])*(d[1]-a[1])-(c[1]-a[1])*(d[0]-a[0]);const meets=(a,c,d,e)=>Math.max(a[0],c[0])>=Math.min(d[0],e[0])&&Math.max(d[0],e[0])>=Math.min(a[0],c[0])&&Math.max(a[1],c[1])>=Math.min(d[1],e[1])&&Math.max(d[1],e[1])>=Math.min(a[1],c[1])&&cross(a,c,d)*cross(a,c,e)<=0&&cross(d,e,a)*cross(d,e,c)<=0;return s.points.some((a,i)=>corners.some((d,j)=>meets(a,s.points[(i+1)%s.points.length],d,corners[(j+1)%4])));}
export function blocked(x,y){const b=footBox(x,y);for(const xx of [b.x,b.x+b.w/2,b.x+b.w])for(const yy of [b.y,b.y+b.h/2,b.y+b.h])if(!inside(xx,yy,FLOOR))return 'floor-edge';return SOLIDS.find(s=>boxHits(b,s))?.id||null;}
export function move(p,dx,dy){let q={...p},hits=[];const n=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/3));for(let i=0;i<n;i++){let hit=blocked(q.x+dx/n,q.y);if(!hit)q.x+=dx/n;else if(dx)hits.push(hit);hit=blocked(q.x,q.y+dy/n);if(!hit)q.y+=dy/n;else if(dy)hits.push(hit);}return {x:q.x,y:q.y,hits:[...new Set(hits)]};}
function segmentDistance(x,y,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);}
export function reserved(x,y){if(y>905*SCALE)return true;if(ROUTE.slice(1,7).some((b,i)=>segmentDistance(x,y,ROUTE[i],b)<36))return true;return APPROACHES.some(s=>inside(x,y,s))||Math.hypot(x-SPAWN.x,y-SPAWN.y)<64||inside(x,y,EXIT)||(x>692*SCALE&&x<756*SCALE&&y>685*SCALE);}
export function clearance(x,y){const b={x:x-32,y:y-32,w:64,h:64};for(let xx=b.x;xx<=b.x+64;xx+=8)for(let yy=b.y;yy<=b.y+64;yy+=8)if(!inside(xx,yy,FLOOR))return false;if(SOLIDS.some(s=>boxHits(b,s)))return false;if(OCCLUDERS.some(s=>boxHits({x:x-20,y:y-20,w:40,h:40},s)))return false;return [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{for(let d=0;d<=64;d+=4)if(blocked(x+dx*d,y+dy*d))return false;return true;});}
export function camera(p,mode,screenW,screenH){let w,h;const mobile=screenW<600;if(mode==='full')return {x:0,y:0,w:1536,h:1152};if(mode==='legacy'){h=576;w=Math.round(h*screenW/screenH);}else{w=mobile?640:768;h=w*screenH/screenW;}w=Math.min(w,1536);h=Math.min(h,1152);const north=mode==='recommended'?Math.max(0,1-Math.abs(p.x-768)/440)*Math.max(0,1-Math.abs(p.y-720)/420)*100:0;return {x:Math.max(0,Math.min(1536-w,p.x-w/2)),y:Math.max(0,Math.min(1152-h,p.y-14-h/2-north)),w,h};}
