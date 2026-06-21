import { getCached, setCached } from './cache'
import { supabaseOwner } from './supabase'
import { supabaseBranchManager } from './supabase'

export async function prefetchOwnerTasks(profileId, branchIds) {
  const today    = new Date().toISOString().split('T')[0]
  const cacheKey = `owner-tasks-${profileId}-${today}`
  if (getCached(cacheKey)) return

  const [bRes, tBranchRes, tGlobalRes, subRes] = await Promise.all([
    supabaseOwner.from('branches').select('id, name, name_ar').eq('owner_id', profileId).eq('is_active', true),
    supabaseOwner.from('tasks').select('id, name, name_ar, frequency, branch_id, category, requires_photo, requires_note, requires_value, is_active, created_at').eq('is_active', true).in('branch_id', branchIds).order('created_at', { ascending: false }).limit(500),
    supabaseOwner.from('tasks').select('id, name, name_ar, frequency, branch_id, category, requires_photo, requires_note, requires_value, is_active, created_at').eq('is_active', true).is('branch_id', null).eq('created_by', profileId).order('created_at', { ascending: false }).limit(500),
    supabaseOwner.from('task_submissions').select('id, task_id, branch_id, status, note, photo_url, value_entered, submitted_at, submitted_by, users(name, name_ar)').in('branch_id', branchIds).gte('submitted_at', today + 'T00:00:00.000Z').lte('submitted_at', today + 'T23:59:59.999Z').limit(2000),
  ])
  if (bRes.error || tBranchRes.error || tGlobalRes.error || subRes.error) return

  const branchList = bRes.data || []
  const taskList   = [...(tBranchRes.data || []), ...(tGlobalRes.data || [])]
  const subList    = subRes.data || []

  const subMap = {}
  subList.forEach(s => {
    if (!subMap[s.task_id]) subMap[s.task_id] = []
    subMap[s.task_id].push(s)
  })

  setCached(cacheKey, { branches: branchList, tasks: taskList, subMap })
}

export async function prefetchBMDailyTasks(branchId, userId) {
  const today    = new Date().toISOString().split('T')[0]
  const cacheKey = `bm-daily-tasks-${branchId}-${today}`
  if (getCached(cacheKey)) return

  const branchRes = await supabaseBranchManager
    .from('branches')
    .select('id, name, name_ar, owner_id')
    .eq('id', branchId)
    .single()
  if (branchRes.error || !branchRes.data?.owner_id) return

  const ownerId = branchRes.data.owner_id

  const [taskDataRes, subDataRes] = await Promise.all([
    supabaseBranchManager.from('tasks').select('id, name, name_ar, frequency, category, requires_photo, requires_note, requires_value, value_unit').eq('is_active', true).or(`branch_id.eq.${branchId},and(branch_id.is.null,created_by.eq.${ownerId})`).eq('frequency', 'daily').order('created_at', { ascending: true }),
    supabaseBranchManager.from('task_submissions').select('id, task_id, status, note, value_entered, submitted_at').eq('branch_id', branchId).eq('submitted_by', userId).gte('submitted_at', `${today}T00:00:00.000Z`).lte('submitted_at', `${today}T23:59:59.999Z`).limit(1000),
  ])
  if (taskDataRes.error || subDataRes.error) return

  const branchData = branchRes.data
  const subs   = subDataRes.data || []
  const merged = (taskDataRes.data || []).map(task => {
    const sub = subs.find(s => s.task_id === task.id)
    return { task, submission: sub || null }
  })

  setCached(cacheKey, { branch: branchData, tasks: merged })
}
