import React, { useEffect, useState } from 'react'
import api from '../services/api'

export default function PolicyQA() {
  const [answer, setAnswer] = useState('')
  const [question, setQuestion] = useState('')

  async function ask() {
    try { const r = await api.featureApi.intelligentPolicyQA({ question }); setAnswer(r.answer || JSON.stringify(r)) } catch (e) { setAnswer('错误') }
  }

  return (
    <div className="container">
      <h2>智能问答</h2>
      <div className="card">
        <input className="input" value={question} onChange={e => setQuestion(e.target.value)} placeholder="输入问题" />
        <div style={{ marginTop: 8 }}>
          <button className="btn" onClick={ask}>提问</button>
        </div>
        <pre style={{ marginTop: 12 }}>{answer}</pre>
      </div>
    </div>
  )
}
