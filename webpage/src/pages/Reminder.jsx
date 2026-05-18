import React, { useEffect, useState } from 'react'
import api from '../services/api'

function pad2(n) { return String(n).padStart(2, '0') }
function formatDateTime(ts) {
  const n = Number(ts || 0)
  if (!n) return ''
  const d = new Date(n)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const mm = pad2(d.getMinutes())
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function buildPreview(content) {
  const s = String(content ?? '').trim().replace(/\s+/g, ' ')
  if (!s) return ''
  return s.length > 80 ? `${s.slice(0, 80)}...` : s
}

export default function Reminder() {
  const [items, setItems] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const r = await api.featureApi.reminderMyList()
      const list = Array.isArray(r.items) ? r.items : []
      const mapped = list.map(x => ({ ...x, createdAtText: formatDateTime(x.createdAt), preview: buildPreview(x.content) }))
      setItems(mapped)
    } catch (e) {
      // ignore
    }
  }

  async function onTapItem(id) {
    const found = (items || []).find(x => String(x._id) === String(id))
    if (!found) return
    // show details
    window.alert(`${found.title || '通知'}\n\n${found.createdAtText || ''}\n\n${found.content || ''}`)

    if (!found.readAt) {
      try {
        await api.featureApi.reminderMyMarkRead({ id: found._id })
        const next = (items || []).map(x => {
          if (String(x._id) !== String(found._id)) return x
          return { ...x, readAt: Date.now() }
        })
        setItems(next)
      } catch (e) {
        // ignore mark-read errors
      }
    }
  }

  return (
    <div className="container">
      <h2>提醒</h2>
      <div className="card">
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map(i => (
            <li key={i._id} style={{ padding: 10, borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }} onClick={() => onTapItem(i._id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: i.readAt ? 400 : 700 }}>{i.title || '(无标题)'}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{i.createdAtText || ''}</div>
              </div>
              <div style={{ color: '#6b7280', marginTop: 6 }}>{i.preview}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
