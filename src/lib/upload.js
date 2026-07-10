/**
 * Upload a task photo to private storage. Returns the storage PATH (not a public URL).
 * Display via signed URLs — never store base64 or public URLs (BUG #038, #157).
 */
export async function uploadPhoto(client, file, branchId, taskId) {
  const ext = file.name.split('.').pop()
  const path = `${branchId}/${taskId}/${Date.now()}.${ext}`
  const { data, error } = await client.storage
    .from('task-photos')
    .upload(path, file, { upsert: true })
  if (error) throw error
  return data.path
}
