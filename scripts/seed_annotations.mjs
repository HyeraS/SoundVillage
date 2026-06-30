/**
 * seed_annotations.mjs
 * DB의 annotations 테이블에 한국어 의성어 시드 데이터를 삽입한다.
 * 실행: node scripts/seed_annotations.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const metadata  = JSON.parse(readFileSync(join(__dirname, '../data/sound_metadata.json'), 'utf8'))

const SUPABASE_URL = 'https://nzzesrjneqsbkgtbaoxy.supabase.co'
const SUPABASE_KEY = 'sb_publishable_MjNaGGc1Dqt16Ap9HNs3rg_Vqedp7T2'

const client = createClient(SUPABASE_URL, SUPABASE_KEY)

/* ─────────────────────────────────────────────
   카테고리별 한국어 의성어 표현 풀
───────────────────────────────────────────── */
const EXPR = {
  // 동물
  'Bark':                ['멍멍', '왈왈', '컹컹'],
  'Dog':                 ['멍멍', '왈왈', '컹컹'],
  'Meow':                ['야옹', '냐옹', '그르르'],
  'Cat':                 ['야옹', '냐옹', '그르르'],
  'Crow':                ['까악까악', '까악', '까악까악까악'],
  'Bird':                ['지저귐', '짹짹', '휘휘'],
  'Chirp and tweet':     ['짹짹', '찍찍', '삐삐삐'],
  'Bird vocalization and bird call and bird song': ['지저귐', '짹짹짹', '솔솔솔'],
  'Gull and seagull':    ['끼룩끼룩', '까악', '끼이익'],
  'Frog':                ['개굴개굴', '쿠루룩', '개골개골'],
  'Insect':              ['이이이이', '으르르르', '붕붕'],
  'Cricket':             ['귀뚤귀뚤', '찌르르르', '찍찍'],
  'Bee':                 ['윙윙', '붕붕', '이이이이'],
  'Horse':               ['힝힝', '히힝', '따그닥따그닥'],
  'Pig':                 ['꿀꿀', '꿀꿀꿀', '흐흐흐'],

  // 자연
  'Thunder':             ['우르릉쾅쾅', '쾅', '우르르르'],
  'Wind':                ['휙휙', '쉬이이이', '윙윙'],
  'Rain':                ['후두둑', '주룩주룩', '뚝뚝'],
  'Stream':              ['졸졸', '콸콸', '찰랑찰랑'],
  'Drip':                ['뚝뚝', '똑똑', '방울방울'],
  'Water':               ['첨벙', '졸졸졸', '철썩'],
  'Ocean':               ['철썩철썩', '파도파도', '쏴아아'],
  'Fire':                ['타닥타닥', '활활', '치직치직'],

  // 도시
  'Motorcycle':          ['부릉부릉', '따다다다', '붕붕'],
  'Car':                 ['부릉부릉', '빵빵', '씽씽'],
  'Engine':              ['부르릉', '부웅웅', '따다닥'],
  'Siren':               ['삐유삐유', '띠리리', '앵앵앵'],
  'Alarm':               ['삐삐삐', '띠리리리', '경보경보'],
  'Train':               ['달가닥달가닥', '칙칙폭폭', '덜컹덜컹'],
  'Traffic noise and roadway noise': ['웅웅', '씽씽', '시끄럽'],

  // 사람
  'Laughter':            ['하하하', '히히히', '깔깔깔'],
  'Chatter':             ['재잘재잘', '웅성웅성', '수다수다'],
  'Cough':               ['콜록콜록', '켁켁', '에헴'],
  'Sneeze':              ['에취', '아취', '앗취'],
  'Breathing':           ['하아하아', '후우후우', '스윽'],
  'Footstep':            ['뚜벅뚜벅', '사각사각', '탁탁'],
  'Clapping':            ['짝짝짝', '박수박수', '철퍼덕'],
  'Finger snapping':     ['딱딱', '딱', '탁탁'],
  'Crying and sobbing':  ['흑흑', '엉엉', '훌쩍훌쩍'],
  'Whispering':          ['쏴아아', '소곤소곤', '스읍'],
  'Singing':             ['라라라', '흥얼흥얼', '도레미'],
  'Child speech and kid speaking': ['재잘재잘', '떠들썩', '웅성웅성'],
  'Crowd':               ['와아아', '웅성웅성', '시끌벅적'],

  // 음악/무대
  'Bell':                ['딩동', '댕댕', '땡땡'],
  'Guitar':              ['쨍쨍', '댕댕', '통통통'],
  'Drum':                ['쿵쿵', '둥둥', '탁탁'],
  'Crash cymbal':        ['쨍', '챙그랑', '쏴아'],
  'Piano':               ['딩딩', '도도레미', '탕탕'],
  'Violin':              ['끼이이이', '서걱서걱', '으으으'],
  'Wind instrument and woodwind instrument': ['뚜루루', '피리피리', '삐삐'],
  'Trumpet':             ['빠라빠라', '빠빠빠', '뚜루루'],
  'Flute':               ['뚜루루루', '삐삐', '파릇파릇'],
  'Clapping':            ['짝짝짝', '짝', '짝짝'],
  'Whoop and yell':      ['우와아', '야호', '와아아'],

  // 미지의 소리 / Lab
  'Typing':              ['타닥타닥', '딸깍딸깍', '탁탁탁'],
  'Clock':               ['째깍째깍', '딸깍', '틱톡'],
  'Squeak':              ['삐걱삐걱', '끼이익', '끽끽'],
  'Glass':               ['쨍그랑', '댕그랑', '깨짱'],
  'Explosion':           ['쾅', '펑', '쾌쾌'],
  'Crack':               ['뚝', '딱', '빠지직'],
  'Scissors':            ['싹둑싹둑', '스르르', '잘각잘각'],
  'Hammer':              ['탕탕탕', '쿵쿵', '퉁퉁'],
  'Chainsaw':            ['위이이이', '으르르르', '따다다다'],
  'Door':                ['삐걱', '끼이익', '쿵'],
  'Keys jingle':         ['짤랑짤랑', '딸랑딸랑', '쨍그랑'],
  'Zipper':              ['지이잉', '스르르', '지직'],
  'Coin dropping':       ['짤랑', '댕그랑', '딸랑'],
  'Dishes and pots and pans': ['쨍그랑', '달가닥', '탕탕'],
  'Frying and sizzling': ['치이익', '지글지글', '치직치직'],
  'Boiling':             ['보글보글', '부글부글', '뽀글뽀글'],
  'Toilet flush':        ['쏴아아', '휘이이', '콸콸'],
  'Appliance':           ['윙윙', '부웅', '위잉'],
  'Camera':              ['찰칵', '딸깍', '촤악'],
  'Printer':             ['쉬이이이', '위이잉', '드르르'],
  'Computer keyboard':   ['타닥타닥', '딸깍딸깍', '탁탁'],
  'Telephone':           ['따르릉', '삐삐삐', '띠리리'],
  'Static and noise':    ['쉬이이이', '스스스', '끝에긁기'],
}

/* ─────────────────────────────────────────────
   카테고리 매핑 (sub_category → EXPR key)
───────────────────────────────────────────── */
function getExpressions(subCategory) {
  if (EXPR[subCategory]) return EXPR[subCategory]
  // 부분 매칭 시도
  for (const key of Object.keys(EXPR)) {
    if (subCategory.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(subCategory.toLowerCase())) {
      return EXPR[key]
    }
  }
  return ['스스스', '위이이이', '쾅']  // generic fallback
}

/* ─────────────────────────────────────────────
   메인
───────────────────────────────────────────── */
async function main() {
  const sounds = metadata.sounds
  console.log(`총 ${sounds.length}개 소리 처리 시작`)

  // 기존 시드 데이터 삭제 (재실행 안전)
  const { error: delErr } = await client
    .from('annotations')
    .delete()
    .like('participant_id', 'seed_%')
  if (delErr) console.warn('기존 시드 삭제 실패 (무시):', delErr.message)
  else console.log('기존 시드 데이터 삭제 완료')

  let inserted = 0
  const BATCH = 20  // 한 번에 20개씩 삽입

  for (let i = 0; i < sounds.length; i += BATCH) {
    const batch = sounds.slice(i, i + BATCH)
    const rows = []

    for (const sound of batch) {
      const exprs = getExpressions(sound.sub_category)
      exprs.forEach((expr, j) => {
        rows.push({
          participant_id:     `seed_p${j + 1}`,
          session_id:         `seed_session`,
          sound_id:           sound.sound_id,
          zone:               sound.game_zone,
          sub_category:       sound.sub_category,
          expression_text:    expr,
          selected_features:  [],
          confidence:         3 + j,        // 3, 4, 5 순환
          difficulty:         3,
          play_count:         1,
          listening_time_sec: 5,
          is_skipped:         false,
          skip_reason:        '',
          device_info:        'seed-script',
          stage:              1,
          is_verified:        false,
          vote_count:         j,            // 약간의 vote_count 차이
          version:            'v0.4-seed',
        })
      })
    }

    const { error } = await client.from('annotations').insert(rows)
    if (error) {
      console.error(`배치 ${i}~${i + BATCH} 삽입 오류:`, error.message)
    } else {
      inserted += rows.length
      process.stdout.write(`\r삽입 중... ${inserted}개 완료`)
    }
  }

  console.log(`\n✅ 완료! 총 ${inserted}개 표현 삽입`)
}

main().catch(console.error)
