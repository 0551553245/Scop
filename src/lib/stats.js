export function getExpectedForBranch(branchId, taskDefs) {
  return taskDefs.filter(t => t.branch_id === null || t.branch_id === branchId).length
}

export function getTotalExpected(branchIds, taskDefs) {
  return taskDefs.reduce((sum, t) => sum + (t.branch_id === null ? branchIds.length : 1), 0)
}

export function calcRate(done, expected) {
  return Math.min(100, Math.round((done / Math.max(expected, 1)) * 100))
}

export function calcPending(done, expected) {
  return Math.max(0, expected - done)
}
