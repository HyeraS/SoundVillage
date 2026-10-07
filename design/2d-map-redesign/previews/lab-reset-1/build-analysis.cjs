const fs=require('fs'), path=require('path'), sharp=require('sharp');
const out=__dirname, root=path.resolve(out,'../../../..');
const source=path.join(root,'design/concepts/lab-sound-observatory-concept-v1.png');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
(async()=>{
 const image=fs.readFileSync(source).toString('base64');
 const rows=[
 ['01','중심은 장치 + 건축의 결합','두꺼운 받침·황동 구조·보조 기둥·방사 포장','작은 본체와 거대한 평면 원으로 분리하지 않는다.','#83ded8'],
 ['02','하나의 시설, 연결된 연구 구역','남쪽 진입 → 중앙 회랑 → 서·북·동 연구 bay','작은 하부 방은 주변 bay의 지원 alcove로 통합.','#9dd1c6'],
 ['03','석재의 두께와 단차','벽 상판·정면·기단·오목한 작업 공간을 보존','문턱의 시각 단차와 발 충돌은 별도 설계.','#dab978'],
 ['04','밀도의 대비','벽면·작업대는 풍부하게, 순환 회랑은 조용하게','marker 후보 앞에는 높은 물체·강한 장식 제한.','#c5b4db'],
 ['05','따뜻한 작업등 / 청록 관측 현상','작업등은 머무는 장소, 청록은 관측의 초점','빛을 없애지 않고 바닥의 기본 가독성 확보.','#f0c16b'],
 ['06','플레이를 위해 조정할 것','악기·축음기·생물 표본 → 중립 기록·계측','실제 비례·카메라·수용량은 생성 후 별도 검토.','#edb398']
 ];
 const points=[[724,530],[420,480],[480,95],[230,295],[836,90],[1200,450]];
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1040"><rect width="1800" height="1040" fill="#101d29"/><g font-family="Arial, Apple SD Gothic Neo, sans-serif"><text x="44" y="52" fill="#f2e8d3" font-size="30" font-weight="bold">LAB-RESET-1  /  원본에서 보존할 관계</text><text x="44" y="84" fill="#b4c4cb" font-size="17">원본 직접 분석 · 좌표 고정 전 공간 우선 · 검토용 표시는 원본과 분리</text><image x="32" y="145" width="1100" height="825" href="data:image/png;base64,${image}"/>`;
 points.forEach(([x,y],i)=>{const xx=32+x*1100/1448,yy=145+y*825/1086;svg+=`<circle cx="${xx}" cy="${yy}" r="21" fill="#122532" stroke="${rows[i][4]}" stroke-width="3"/><text x="${xx}" y="${yy+6}" text-anchor="middle" font-size="17" fill="white">0${i+1}</text>`});
 rows.forEach((r,i)=>{let y=160+i*136;svg+=`<rect x="1160" y="${y-25}" width="606" height="120" rx="10" fill="#1d2d3b"/><text x="1180" y="${y+1}" font-size="21" fill="${r[4]}">${r[0]}  ${esc(r[1])}</text><text x="1180" y="${y+35}" font-size="16" fill="#e0e4dc">${esc(r[2])}</text><text x="1180" y="${y+64}" font-size="16" fill="#b4c4cb">${esc(r[3])}</text>`});
 svg+='</g></svg>';fs.writeFileSync(path.join(out,'original-analysis.svg'),svg);await sharp(Buffer.from(svg)).png().toFile(path.join(out,'original-analysis.png'));
 console.log('Original analysis board saved.');
})();
