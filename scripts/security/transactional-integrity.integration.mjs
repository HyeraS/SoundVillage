import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const url = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey) throw new Error('SECURITY_TEST_SUPABASE_* variables are required')
await requireLoopbackSupabaseUrl(url, 'SECURITY_TEST_SUPABASE_URL')

const admin = createClient(url,serviceKey,{ auth:{ persistSession:false } })
const a = createClient(url,anonKey,{ auth:{ persistSession:false } })
const b = createClient(url,anonKey,{ auth:{ persistSession:false } })
const suffix = crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase()
const pidA=`TX_A_${suffix}`,pidB=`TX_B_${suffix}`,soundA=`TX_SOUND_A_${suffix}`,soundA2=`TX_SOUND_A2_${suffix}`,soundB=`TX_SOUND_B_${suffix}`
let userA,userB

const ok = (result,label) => {
  assert.equal(result.error,null,`${label}: ${result.error?.message || ''}`)
  return result.data
}
const annotationArgs = (key,sound,expression) => ({
  p_idempotency_key:key,p_sound_id:sound,p_zone:'Lab',
  p_expression_text:expression,p_selected_features:null,p_confidence:3,p_difficulty:null,
  p_play_count:1,p_listening_time_sec:1,p_is_skipped:false,p_skip_reason:'',p_device_info:'test',p_stage:1,p_version:'integration',
})

try {
  ok(await admin.from('study_participants').insert([
    {participant_id:pidA,group_id:'A'},{participant_id:pidB,group_id:'B'},
  ]),'participants')
  ok(await admin.from('study_sound_catalog').insert([
    {sound_id:soundA,zone:'Lab',sub_category:null,group_id:'A',canonical_audio_id:`tx-a:${suffix}`,file_path:`Audio/tx-a-${suffix}`,source_dataset:'tx-a',original_filename:suffix},
    {sound_id:soundA2,zone:'Lab',sub_category:null,group_id:'A',canonical_audio_id:`tx-a2:${suffix}`,file_path:`Audio/tx-a2-${suffix}`,source_dataset:'tx-a2',original_filename:suffix},
    {sound_id:soundB,zone:'Lab',sub_category:null,group_id:'B',canonical_audio_id:`tx-b:${suffix}`,file_path:`Audio/tx-b-${suffix}`,source_dataset:'tx-b',original_filename:suffix},
  ]),'sounds')
  userA=ok(await a.auth.signInAnonymously(),'sign in A').user
  userB=ok(await b.auth.signInAnonymously(),'sign in B').user
  ok(await admin.rpc('claim_study_participant_admin',{p_auth_user_id:userA.id,p_group_id:'A',p_participant_id:pidA}),'claim A')
  ok(await admin.rpc('claim_study_participant_admin',{p_auth_user_id:userB.id,p_group_id:'B',p_participant_id:pidB}),'claim B')
  const sessionA=ok(await a.rpc('start_or_resume_study_session_v2',{p_client_instance_id:crypto.randomUUID()}),'session A')
  const sessionB=ok(await b.rpc('start_or_resume_study_session_v2',{p_client_instance_id:crypto.randomUUID()}),'session B')

  const annotationKey=crypto.randomUUID()
  const concurrent=await Promise.all([
    a.rpc('submit_annotation_v4',annotationArgs(annotationKey,soundA,'딩')),
    a.rpc('submit_annotation_v4',annotationArgs(annotationKey,soundA,'딩')),
  ])
  const first=ok(concurrent[0],'annotation first'),second=ok(concurrent[1],'annotation replay')
  assert.equal(first.annotationId,second.annotationId)
  const annotationRows=ok(await admin.from('annotations').select('id').eq('id',first.annotationId),'annotation count')
  assert.equal(annotationRows.length,1)

  const failedKey=crypto.randomUUID()
  const invalid=await a.rpc('submit_annotation_v4',annotationArgs(failedKey,'NOT_A_SOUND','실패'))
  assert(invalid.error,'invalid sound must fail')
  const failedOperation=ok(await admin.from('idempotent_operations').select('*').eq('idempotency_key',failedKey),'failed operation rollback')
  assert.equal(failedOperation.length,0)

  const candidate=ok(await b.rpc('submit_annotation_v4',annotationArgs(crypto.randomUUID(),soundB,'후보')),'candidate')
  const voteKey=crypto.randomUUID()
  const voteArgs={p_idempotency_key:voteKey,p_sound_id:soundB,p_zone:'Lab',p_annotation_id:candidate.annotationId,p_confidence:3,p_play_count:1,p_listening_time_sec:1,p_stage:2,p_version:'integration'}
  const votes=await Promise.all([a.rpc('submit_museum_vote_v4',voteArgs),a.rpc('submit_museum_vote_v4',voteArgs)])
  assert.equal(ok(votes[0],'vote first').voteId,ok(votes[1],'vote replay').voteId)
  const votedAnnotation=ok(await admin.from('annotations').select('vote_count').eq('id',candidate.annotationId).single(),'vote count')
  assert.equal(votedAnnotation.vote_count,1)

  const checkKey=crypto.randomUUID()
  const check1=ok(await a.rpc('ensure_today_check_in_v4',{p_idempotency_key:checkKey}),'attendance')
  const check2=ok(await a.rpc('ensure_today_check_in_v4',{p_idempotency_key:checkKey}),'attendance replay')
  assert.deepEqual(check1,check2)

  const balance=ok(await admin.from('participant_currency').select('balance').eq('participant_id',pidA).single(),'balance').balance
  const ledger=ok(await admin.from('currency_transactions').select('amount').eq('participant_id',pidA),'ledger')
  assert.equal(balance,ledger.reduce((sum,row)=>sum+row.amount,0))

  const forbidden=await a.rpc('secure_purchase_admin',{p_auth_user_id:userA.id,p_kind:'outfit',p_item_id:'x',p_price:0,p_ledger_type:'spend_shop',p_grant_item_ids:['x'],p_request_id:crypto.randomUUID()})
  assert(forbidden.error,'authenticated role must not execute service purchase')
  assert.equal(sessionA.status,'active')
  assert.equal(sessionB.status,'active')
  console.log('Transactional integrity integration checks passed.')
} finally {
  for (const table of ['idempotent_operations','currency_transactions','participant_currency','votes','annotations','participant_daily_quests','participant_attendance','participant_equipped_outfit','participant_outfits','participant_interior_items','participant_house_layout','participant_house_items']) {
    await admin.from(table).delete().in('participant_id',[pidA,pidB])
  }
  await admin.from('study_sessions').delete().in('participant_id',[pidA,pidB])
  await admin.from('study_sound_catalog').delete().in('sound_id',[soundA,soundA2,soundB])
  await admin.from('study_participants').delete().in('participant_id',[pidA,pidB])
  if(userA) await admin.auth.admin.deleteUser(userA.id)
  if(userB) await admin.auth.admin.deleteUser(userB.id)
}
