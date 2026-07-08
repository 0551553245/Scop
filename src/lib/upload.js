import { supabaseBranchManager } from './supabase'

export async function uploadPhoto(file, branchId, taskId) {
  const ext  = file.name.split('.').pop()
  const path = `${branchId}/${taskId}/${Date.now()}-${crypto.randomUUID()}.${ext}`
  const { data, error } = await supabaseBranchManager.storage
    .from('task-photos')
    .upload(path, file, { upsert: true })
  if (error) throw error
  return data.path
}
