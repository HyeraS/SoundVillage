import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const url = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey) throw new Error('SECURITY_TEST_SUPABASE_* variables are required')
await requireLoopbackSupabaseUrl(url, 'SECURITY_TEST_SUPABASE_URL')

const admin = createClient(url,serviceKey,{auth:{persistSession:false}})
const a = createClient(url,anonKey,{auth:{persistSession:false}})
const b = createClient(url,anonKey,{auth:{persistSession:false}})
const suffix = crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase()
const pidA=`RULE_A_${suffix}`,pidB=`RULE_B_${suffix}`
let userA,userB

const ok = (result,label) => {
  assert.equal(result.error,null,`${label}: ${result.error?.message || ''}`)
  return result.data
}
const annotationArgs = (key,sound,expression,{skip=false,zone}={}) => ({
  p_idempotency_key:key,p_sound_id:sound,p_zone:zone,p_expression_text:skip?'':expression,
  p_selected_features:null,p_confidence:skip?null:3,p_difficulty:null,p_play_count:1,
  p_listening_time_sec:1,p_is_skipped:skip,p_skip_reason:skip?'user_skip':'',p_device_info:'integration',
  p_stage:1,p_version:'integration',
})

try {
  const catalogResult = await admin.from('study_sound_catalog')
    .select('sound_id,zone,sub_category,group_id,canonical_audio_id,file_path,source_dataset,original_filename,source_type,audioset_class',{count:'exact'})
    .range(0,1199)
  const catalog = ok(catalogResult,'full catalog precondition')
  assert.equal(catalogResult.count,1000,'Stage 8 requires the synchronized 1,000-row catalog')
  assert.equal(catalog.length,1000,'The full catalog query must not be truncated')
  assert.equal(new Set(catalog.map(row=>row.canonical_audio_id)).size,995,'Stage 8 requires 995 canonical audio identities')

  const assignedByCanonical = new Map()
  for (const row of catalog.filter(row=>row.group_id===null || row.group_id==='A')) {
    const rows = assignedByCanonical.get(row.canonical_audio_id) || []
    rows.push(row)
    assignedByCanonical.set(row.canonical_audio_id,rows)
  }
  const aliasRows = [...assignedByCanonical.values()].find(rows=>rows.length>1)
  assert(aliasRows,'The canonical catalog must retain at least one A-group alias pair')
  const firstRow=aliasRows[0],aliasRow=aliasRows[1]
  const secondRow=[...assignedByCanonical.values()].find(rows=>rows[0].canonical_audio_id!==firstRow.canonical_audio_id)?.[0]
  assert(secondRow,'The A group must have at least two assigned canonical audio identities')
  const soundA=firstRow.sound_id,aliasA=aliasRow.sound_id,soundA2=secondRow.sound_id
  const canonicalA=firstRow.canonical_audio_id,canonicalA2=secondRow.canonical_audio_id

  ok(await admin.from('study_participants').insert([
    {participant_id:pidA,group_id:'A'},{participant_id:pidB,group_id:'B'},
  ]),'participants')

  userA=ok(await a.auth.signInAnonymously(),'sign in A').user
  userB=ok(await b.auth.signInAnonymously(),'sign in B').user
  ok(await admin.rpc('claim_study_participant_admin',{p_auth_user_id:userA.id,p_group_id:'A',p_participant_id:pidA}),'claim A')
  ok(await admin.rpc('claim_study_participant_admin',{p_auth_user_id:userB.id,p_group_id:'B',p_participant_id:pidB}),'claim B')
  const sessionA=ok(await a.rpc('start_or_resume_study_session_v2',{p_client_instance_id:crypto.randomUUID()}),'start A')
  const sessionB=ok(await b.rpc('start_or_resume_study_session_v2',{p_client_instance_id:crypto.randomUUID()}),'start B')

  // Boundary setup is service-role-only and creates only rows owned by this
  // randomized participant. The final two canonical results still go through
  // the browser RPC so completion and concurrency are tested at the real edge.
  const seedRows=[...assignedByCanonical.values()]
    .map(rows=>rows[0])
    .filter(row=>![canonicalA,canonicalA2].includes(row.canonical_audio_id))
    .map(row=>({
      participant_id:pidA,session_id:'A',experiment_round:1,canonical_audio_id:row.canonical_audio_id,
      sound_id:row.sound_id,zone:row.zone,source_type:row.source_type,sub_category:row.sub_category,
      audioset_class:row.audioset_class,expression_text:'integration boundary seed',selected_features:null,
      confidence:3,difficulty:null,play_count:1,listening_time_sec:0,is_skipped:false,skip_reason:'',
      device_info:'integration-boundary-seed',stage:1,is_verified:false,vote_count:0,version:'integration',
    }))
  for(let index=0;index<seedRows.length;index+=200) {
    ok(await admin.from('annotations').insert(seedRows.slice(index,index+200)),`boundary seed ${index/200+1}`)
  }

  const firstKey=crypto.randomUUID()
  const replay=await Promise.all([
    a.rpc('submit_annotation_v4',annotationArgs(firstKey,soundA,'딩',{zone:firstRow.zone})),
    a.rpc('submit_annotation_v4',annotationArgs(firstKey,soundA,'딩',{zone:firstRow.zone})),
  ])
  const first=ok(replay[0],'annotation first'),sameReplay=ok(replay[1],'annotation replay')
  assert.equal(first.annotationId,sameReplay.annotationId)

  const independentDuplicate=ok(await a.rpc('submit_annotation_v4',annotationArgs(crypto.randomUUID(),soundA,'새 키',{zone:firstRow.zone})),'independent annotation duplicate')
  assert.equal(independentDuplicate.annotationId,first.annotationId)
  assert.equal(independentDuplicate.alreadyCompleted,true)

  const aliasDuplicate=ok(await a.rpc('submit_annotation_v4',annotationArgs(crypto.randomUUID(),aliasA,'다른 제출',{zone:aliasRow.zone})),'alias duplicate')
  assert.equal(aliasDuplicate.annotationId,first.annotationId)
  assert.equal(aliasDuplicate.alreadyCompleted,true)

  const skip=ok(await a.rpc('submit_annotation_v4',annotationArgs(crypto.randomUUID(),soundA2,'',{skip:true,zone:secondRow.zone})),'skip')
  assert.equal(skip.skipped,true)
  const beforeComplete=ok(await a.rpc('get_my_experiment_progress_v1'),'progress before normal response')
  assert.equal(beforeComplete.assignedCount,assignedByCanonical.size)
  assert.equal(beforeComplete.completedCount,assignedByCanonical.size-1)
  assert.equal(beforeComplete.isComplete,false)

  const concurrentKeys=[crypto.randomUUID(),crypto.randomUUID()]
  const concurrent=await Promise.all([
    a.rpc('submit_annotation_v4',annotationArgs(concurrentKeys[0],soundA2,'쾅',{zone:secondRow.zone})),
    a.rpc('submit_annotation_v4',annotationArgs(concurrentKeys[1],soundA2,'쾅쾅',{zone:secondRow.zone})),
  ])
  const normalA2=ok(concurrent[0],'concurrent annotation one')
  const duplicateA2=ok(concurrent[1],'concurrent annotation two')
  assert.equal(normalA2.annotationId,duplicateA2.annotationId)
  const completedAudio=ok(await a.rpc('get_my_completed_audio_v1',{p_zone:null}),'completed audio list')
  assert.equal(new Set(completedAudio.map(row=>row.canonical_audio_id)).size,assignedByCanonical.size)
  assert(completedAudio.some(row=>row.canonical_audio_id===canonicalA))
  assert(completedAudio.some(row=>row.canonical_audio_id===canonicalA2))
  const storedFirst=ok(await admin.from('annotations').select('difficulty,selected_features').eq('id',first.annotationId).single(),'unmeasured fields')
  assert.equal(storedFirst.difficulty,null)
  assert.equal(storedFirst.selected_features,null)
  const progressA=ok(await a.rpc('get_my_experiment_progress_v1'),'completed progress')
  assert.equal(progressA.completedCount,assignedByCanonical.size)
  assert.equal(progressA.isComplete,true)
  const completedSession=ok(await admin.from('study_sessions').select('status,completion_annotation_id,completion_operation_key').eq('id',sessionA.studySessionId).single(),'completed session')
  assert.equal(completedSession.status,'completed')
  assert.equal(completedSession.completion_annotation_id,normalA2.annotationId)
  const winningKey=normalA2.alreadyCompleted ? concurrentKeys[1] : concurrentKeys[0]
  assert.equal(completedSession.completion_operation_key,winningKey)

  const completedCountResult=await admin.from('annotations').select('*',{count:'exact',head:true}).eq('participant_id',pidA)
  assert.equal(completedCountResult.error,null,`completed annotation count: ${completedCountResult.error?.message || ''}`)
  const completedRowCount=completedCountResult.count
  const afterCompletion=await a.rpc('submit_annotation_v4',annotationArgs(crypto.randomUUID(),soundA,'',{skip:true,zone:firstRow.zone}))
  assert(afterCompletion.error,'completed session must reject new skip results')
  const afterCompletedCountResult=await admin.from('annotations').select('*',{count:'exact',head:true}).eq('participant_id',pidA)
  assert.equal(afterCompletedCountResult.error,null,`post-completion annotation count: ${afterCompletedCountResult.error?.message || ''}`)
  assert.equal(afterCompletedCountResult.count,completedRowCount)

  const resumedA=ok(await a.rpc('start_or_resume_study_session_v2',{p_client_instance_id:crypto.randomUUID()}),'resume completed A')
  assert.equal(resumedA.studySessionId,sessionA.studySessionId)
  assert.equal(resumedA.status,'completed')
  const sessionsA=ok(await admin.from('study_sessions').select('id').eq('participant_id',pidA),'session rows A')
  assert.equal(sessionsA.length,1)

  const votedSameKey=crypto.randomUUID()
  const voteArgs=(key,sound,zone=firstRow.zone)=>({p_idempotency_key:key,p_sound_id:sound,p_zone:zone,p_annotation_id:first.annotationId,
    p_confidence:3,p_play_count:1,p_listening_time_sec:1,p_stage:2,p_version:'integration'})
  const voteReplay=await Promise.all([
    b.rpc('submit_museum_vote_v4',voteArgs(votedSameKey,soundA)),
    b.rpc('submit_museum_vote_v4',voteArgs(votedSameKey,soundA)),
  ])
  const vote=ok(voteReplay[0],'vote first'),voteAgain=ok(voteReplay[1],'vote replay')
  assert.equal(vote.voteId,voteAgain.voteId)
  const independentVote=ok(await b.rpc('submit_museum_vote_v4',voteArgs(crypto.randomUUID(),soundA)),'independent vote duplicate')
  assert.equal(independentVote.voteId,vote.voteId)
  assert.equal(independentVote.alreadyCompleted,true)
  const aliasVote=ok(await b.rpc('submit_museum_vote_v4',voteArgs(crypto.randomUUID(),aliasA)),'alias vote duplicate')
  assert.equal(aliasVote.voteId,vote.voteId)
  assert.equal(aliasVote.alreadyCompleted,true)
  const voteRows=ok(await admin.from('votes').select('id').eq('participant_id',pidB).eq('canonical_audio_id',canonicalA),'vote rows')
  assert.equal(voteRows.length,1)

  const playbackBlocked=await b.rpc('submit_museum_vote_v4',{
    ...voteArgs(crypto.randomUUID(),soundA2,secondRow.zone),p_annotation_id:normalA2.annotationId,p_play_count:0,
  })
  assert(playbackBlocked.error,'vote RPC must reject an audio target that never started playback')
  const concurrentVoteKeys=[crypto.randomUUID(),crypto.randomUUID()]
  const concurrentVotes=await Promise.all(concurrentVoteKeys.map(key=>b.rpc('submit_museum_vote_v4',{
    ...voteArgs(key,soundA2,secondRow.zone),p_annotation_id:normalA2.annotationId,
  })))
  const voteA2=ok(concurrentVotes[0],'concurrent vote one')
  const duplicateVoteA2=ok(concurrentVotes[1],'concurrent vote two')
  assert.equal(voteA2.voteId,duplicateVoteA2.voteId)
  const voteRowsA2=ok(await admin.from('votes').select('id').eq('participant_id',pidB).eq('canonical_audio_id',canonicalA2),'concurrent vote rows')
  assert.equal(voteRowsA2.length,1)

  const check=ok(await a.rpc('ensure_today_check_in_v4',{p_idempotency_key:crypto.randomUUID()}),'KST attendance')
  const expectedKstDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
  assert.equal(check.row.check_in_date,expectedKstDate)

  const crossRead=ok(await b.from('annotations').select('id').eq('participant_id',pidA),'cross participant read')
  assert.equal(crossRead.length,0)
  const directInsert=await b.from('votes').insert({participant_id:pidB,session_id:'B',sound_id:soundA,zone:'Lab',annotation_id:first.annotationId})
  assert(directInsert.error,'direct vote INSERT must remain revoked')
  assert.equal(sessionB.status,'active')
  console.log('Experiment rules integration checks passed.')
} finally {
  for (const table of ['user_events','study_sessions','idempotent_operations','currency_transactions','participant_currency','votes','annotations','participant_daily_quests','participant_attendance']) {
    await admin.from(table).delete().in('participant_id',[pidA,pidB])
  }
  await admin.from('study_participants').delete().in('participant_id',[pidA,pidB])
  if(userA) await admin.auth.admin.deleteUser(userA.id)
  if(userB) await admin.auth.admin.deleteUser(userB.id)
}
