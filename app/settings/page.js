'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AvatarWithBadge from '../../components/AvatarWithBadge'

const sectionStyle = {
  backgroundColor: '#00BFFF',
  padding: '16px',
  marginBottom: '1px'
}
const labelStyle = { fontSize: '14px', fontWeight: '300', color: 'black', marginBottom: '6px' }
const inputStyle = {
  width: '100%',
  padding: '10px',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: 'white',
  color: 'black',
  fontWeight: '300',
  marginBottom: '8px'
}
const btnStyle = {
  backgroundColor: '#00BFFF',
  color: 'black',
  fontWeight: '300',
  padding: '8px 16px',
  borderRadius: '6px',
  border: '2px solid black',
  cursor: 'pointer'
}
const logoutBtn = {
  backgroundColor: '#00BFFF',
  color: 'black',
  fontWeight: '300',
  fontSize: '13px',
  padding: '6px 14px',
  borderRadius: '16px',
  border: '2px solid black',
  cursor: 'pointer',
  marginTop: '24px'
}

export default function SettingsPage() {
  const router = useRouter()
  const fileInputRef = useRef(null)

  const [user, setUser] = useState({
    avatar: '',
    phone: '',
    nickname: '',
    username: '',
    vip: 0,
    bankMTN: null,
    bankAirtel: null,
    password: '123456'
  })

  const [nickname, setNickname] = useState('')
  const [mtnNumber, setMtnNumber] = useState('')
  const [mtnNames, setMtnNames] = useState('')
  const [airtelNumber, setAirtelNumber] = useState('')
  const [airtelNames, setAirtelNames] = useState('')
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [repeatPass, setRepeatPass] = useState('')
  const [showVipPopup, setShowVipPopup] = useState(false)

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    setUser(saved)
    setNickname(saved.nickname || saved.username || '')
    setMtnNumber(saved.bankMTN?.number || '')
    setMtnNames(saved.bankMTN?.names || '')
    setAirtelNumber(saved.bankAirtel?.number || '')
    setAirtelNames(saved.bankAirtel?.names || '')
  }, [])

  const saveUser = (data) => {
    localStorage.setItem('palamedes_user', JSON.stringify(data))
    setUser(data)
  }

  const handleAvatarClick = () => {
    if (!user.vip || user.vip < 1) {
      setShowVipPopup(true)
      return
    }
    fileInputRef.current?.click()
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result
        const updated = {...user, avatar: base64}
        saveUser(updated)
      }
      reader.readAsDataURL(file)
    }
  }

  const saveNickname = () => {
    if (nickname.length > 6) return alert('Nickname max 6 letters only')
    const updated = {...user, nickname}
    saveUser(updated)
    alert('Nickname saved')
  }

  const saveBank = (method) => {
    if (method === 'mtn' &&!user.bankMTN) {
      if (!mtnNumber ||!mtnNames) return alert('Fill all MTN fields')
      const updated = {...user, bankMTN: {number: mtnNumber, names: mtnNames}}
      saveUser(updated)
    }
    if (method === 'airtel' &&!user.bankAirtel) {
      if (!airtelNumber ||!airtelNames) return alert('Fill all Airtel fields')
      const updated = {...user, bankAirtel: {number: airtelNumber, names: airtelNames}}
      saveUser(updated)
    }
  }

  const changePassword = () => {
    if (oldPass!== user.password) return alert('Old password incorrect')
    if (newPass.length < 4) return alert('New password too short')
    if (newPass!== repeatPass) return alert('New passwords do not match')
    const updated = {...user, password: newPass}
    saveUser(updated)
    setOldPass(''); setNewPass(''); setRepeatPass('')
    alert('Password changed successfully')
  }

  const logout = () => {
    localStorage.removeItem('palamedes_user')
    router.push('/login')
  }

  return (
    <div style={{minHeight: '100vh', backgroundColor: '#f9fafb', paddingBottom: '96px'}}>
      <h1 style={{fontSize: '24px', fontWeight: 'bold', textAlign: 'center', padding: '16px', backgroundColor: '#00BFFF', color: 'black'}}>Settings</h1>

      {/* Top Right: Avatar + Username */}
      <div style={{...sectionStyle, display: 'flex', flexDirection: 'column', alignItems: 'flex-end'}}>
        <div onClick={handleAvatarClick} style={{cursor: user.vip >= 1? 'pointer' : 'default'}}>
          <AvatarWithBadge
            username={user.username}
            vipLevel={user.vip || 0}
            size={80}
            avatar={user.avatar}
          />
        </div>
        <p style={{fontSize: '16px', fontWeight: '300', color: 'black', marginTop: '8px'}}>
          {user.nickname || user.username || 'User'}
        </p>
      </div>
      <input type="file" ref={fileInputRef} accept="image/*" onChange={handleAvatarChange} style={{display: 'none'}} />

      {/* Phone + Nickname */}
      <div style={sectionStyle}>
        <p style={labelStyle}>Phone number</p>
        <input style={{...inputStyle, backgroundColor: '#e5e7eb'}} value={user.phone} readOnly />

        <p style={labelStyle}>Nickname</p>
        <input style={inputStyle} value={nickname} onChange={(e) => setNickname(e.target.value.slice(0, 6))} maxLength={6} />
        <button style={btnStyle} onClick={saveNickname}>Save</button>
      </div>

      {/* Bank Details */}
      <div style={sectionStyle}>
        <p style={labelStyle}>Bank details</p>

        <p style={labelStyle}>MTN Mobile money</p>
        <input style={{...inputStyle, backgroundColor: user.bankMTN? '#e5e7eb' : 'white'}}
          placeholder="Phone number" value={mtnNumber}
          onChange={(e) =>!user.bankMTN && setMtnNumber(e.target.value)}
          readOnly={!!user.bankMTN} />
        <input style={{...inputStyle, backgroundColor: user.bankMTN? '#e5e7eb' : 'white'}}
          placeholder="Names" value={mtnNames}
          onChange={(e) =>!user.bankMTN && setMtnNames(e.target.value)}
          readOnly={!!user.bankMTN} />
        {!user.bankMTN && <button style={btnStyle} onClick={() => saveBank('mtn')}>Save</button>}

        <p style={{...labelStyle, marginTop: '12px'}}>Airtel mobile money</p>
        <input style={{...inputStyle, backgroundColor: user.bankAirtel? '#e5e7eb' : 'white'}}
          placeholder="Phone number" value={airtelNumber}
          onChange={(e) =>!user.bankAirtel && setAirtelNumber(e.target.value)}
          readOnly={!!user.bankAirtel} />
        <input style={{...inputStyle, backgroundColor: user.bankAirtel? '#e5e7eb' : 'white'}}
          placeholder="Names" value={airtelNames}
          onChange={(e) =>!user.bankAirtel && setAirtelNames(e.target.value)}
          readOnly={!!user.bankAirtel} />
        {!user.bankAirtel && <button style={btnStyle} onClick={() => saveBank('airtel')}>Save</button>}
      </div>

      {/* Modify Password */}
      <div style={sectionStyle}>
        <p style={labelStyle}>Modify password</p>
        <input style={inputStyle} type="password" placeholder="Old password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} />
        <input style={inputStyle} type="password" placeholder="New password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
        <input style={inputStyle} type="password" placeholder="Repeat new password" value={repeatPass} onChange={(e) => setRepeatPass(e.target.value)} />
        <button style={btnStyle} onClick={changePassword}>Save</button>
      </div>

      {/* VIP Popup */}
      {showVipPopup && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{backgroundColor: 'white', padding: '24px', borderRadius: '8px', textAlign: 'center'}}>
            <p style={{fontSize: '16px', fontWeight: '300', color: 'black', marginBottom: '16px'}}>
              Buy VIP Task to edit avatar
            </p>
            <button style={btnStyle} onClick={() => setShowVipPopup(false)}>OK</button>
          </div>
        </div>
      )}

      {/* Logout */}
      <div style={{textAlign: 'center', padding: '16px'}}>
        <button style={logoutBtn} onClick={logout}>Logout</button>
      </div>
    </div>
  )
}