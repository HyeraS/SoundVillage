import { authorizedPost } from '@/lib/participantAuth';
import { getClient } from '@/lib/supabase';
import { newOperationKey, persistenceFailure, persistenceSuccess } from '@/lib/persistenceResult';

export async function getCurrencyBalance(participantId) {
  const { data, error } = await getClient()
    .from('participant_currency')
    .select('balance')
    .eq('participant_id', participantId)
    .maybeSingle();
  if (error) throw error;
  return data?.balance ?? 0;
}

export async function getTotalEarned(participantId) {
  const { data, error } = await getClient()
    .from('currency_transactions')
    .select('amount')
    .eq('participant_id', participantId)
    .in('type', ['earn_annotation', 'earn_vote']);
  if (error) throw error;
  return (data || []).reduce((sum, row) => sum + row.amount, 0);
}

export async function getOwnedOutfits(participantId) {
  const { data, error } = await getClient()
    .from('participant_outfits')
    .select('outfit_id')
    .eq('participant_id', participantId);
  if (error) throw error;
  return (data || []).map((row) => row.outfit_id);
}

export async function getEquippedOutfit(participantId) {
  const { data, error } = await getClient()
    .from('participant_equipped_outfit')
    .select('outfit_id')
    .eq('participant_id', participantId)
    .maybeSingle();
  if (error) throw error;
  return data?.outfit_id ?? null;
}

export async function setEquippedOutfit(_participantId, outfitId, suppliedKey) {
  const idempotencyKey = suppliedKey || newOperationKey();
  const { data, error } = await getClient().rpc('set_equipped_outfit_v3', {
    p_idempotency_key: idempotencyKey,
    p_outfit_id: outfitId,
  });
  if (error) return persistenceFailure(error, 'outfit_equip', idempotencyKey);
  return persistenceSuccess(data, 'outfit_equip', idempotencyKey);
}

export async function purchaseOutfit({ outfitId, idempotencyKey }) {
  return authorizedPost('/api/participant-purchase', { kind: 'outfit', itemId: outfitId }, idempotencyKey || newOperationKey());
}
