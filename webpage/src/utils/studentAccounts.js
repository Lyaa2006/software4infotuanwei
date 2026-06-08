// Frontend filtering is only a defensive display guard. The backend remains the
// authority for student identity and must validate permitted_accounts.role.
export function isStudentAccountRecord(record) {
  const role = String(record?.role ?? '').trim().toLowerCase()
  if (role) return role === 'student'
  if (record?.isStudent === true) return true
  if (record?.isStudent === false) return false
  if (record?.isAdmin === true) return false
  return true
}

export function filterStudentAccountRecords(records) {
  return (Array.isArray(records) ? records : []).filter(isStudentAccountRecord)
}
