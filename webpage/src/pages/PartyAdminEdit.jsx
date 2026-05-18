import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../services/api'

export default function PartyAdminEdit() {
  const { accountId } = useParams()
  const [profile, setProfile] = useState(null)

  useEffect(() => { load() }, [accountId])
  async function load() { try { const r = await api.featureApi.partyAdminStudentDetail({ accountId }); setProfile(r.profile || r) } catch (e) {} }

  return (
    <div className="container">
      <h2>编辑学生：{accountId}</h2>
      <div className="card">
        <pre>{JSON.stringify(profile, null, 2)}</pre>
      </div>
    </div>
  )
}
