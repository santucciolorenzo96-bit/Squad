import { supabase } from '../supabaseClient.js';

export async function uploadFinanceDocument(teamId, target, file, docType, uploadedBy) {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${teamId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from('finance-documents').upload(path, file, { upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await supabase.from('finance_documents').insert({
    team_id: teamId,
    entry_id: target.entryId || null,
    payment_id: target.paymentId || null,
    file_path: path,
    file_name: file.name,
    mime_type: file.type || null,
    doc_type: docType,
    uploaded_by: uploadedBy
  }).select().single();
  if (error) throw error;
  return data;
}

export async function getFinanceDocumentSignedUrl(filePath) {
  const { data, error } = await supabase.storage.from('finance-documents').createSignedUrl(filePath, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeFinanceDocument(id) {
  const { error } = await supabase.from('finance_documents').delete().eq('id', id);
  if (error) throw error;
}
