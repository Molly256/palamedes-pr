'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AvatarWithBadge from '../../components/AvatarWithBadge'

const sectionStyle = {
  backgroundColor: 'white',
  padding: '16px',
  marginBottom: '1px',
  borderBottom: '1px solid #e5e7eb'
}
const labelStyle = { fontSize: '14px', fontWeight: '300', color: 'black', marginBottom: '4px' }
const inputStyle = {
  width: '180px',
  height: '36px',
  padding: '0 10px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  backgroundColor: 'white',
  color: 'black',
  fontWeight: '300',
  fontSize: '14px',
  marginBottom: '10px'
}
const btnStyle = {
  backgroundColor: '#00BFFF',
  color: 'black',
  fontWeight: '300',
  padding: '6px 14px',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '14px'
}
const logoutBtn = {
  backgroundColor: '#00BFFF',
  color: 'black',
  fontWeight: '300',
  fontSize: '13px',
  padding: '5px 12px',
  borderRadius: '16px',
  border: 'none',
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
      <h1 style={{fontSize: '24px', fontWeight: 'bold', textAlign: 'center', padding: '16px', backgroundColor: 'white', color: 'black', borderBottom: '1px solid #e5e7eb'}}>Settings</h1>

      {/* Top Right: Avatar circle + VIP badge, Username below */}
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

      {/* Left side below: Phone locked + Nickname editable */}
      <div style={sectionStyle}>
        <p style={labelStyle}>Phone number</p>
        <input style={{...inputStyle, backgroundColor: '#f3f4f6'}} value={user.phone} readOnly />

        <p style={labelStyle}>Nickname</p>
        <input style={inputStyle} value={nickname} onChange={(e) => setNickname(e.target.value.slice(0, 6))} maxLength={6} />
        <br />
        <button style={btnStyle} onClick={saveNickname}>Save</button>
      </div>

      {/* Bank Details */}
      <div style={sectionStyle}>
        <p style={labelStyle}>Bank details</p>

        <p style={labelStyle}>MTN Mobile money</p>
        <input style={{...inputStyle, backgroundColor: user.bankMTN? '#f3f4f6' : 'white'}}
          placeholder="Phone" value={mtnNumber}
          onChange={(e) =>!user.bankMTN && setMtnNumber(e.target.value)}
          readOnly={!!user.bankMTN} />
        <br />
        <input style={{...inputStyle, backgroundColor: user.bankMTN? '#f3f4f6' : 'white'}}
          placeholder="Names" value={mtnNames}
          onChange={(e) =>!user.bankMTN && setMtnNames(e.target.value)}
          readOnly={!!user.bankMTN} />
        <br />
        {!user.bankMTN && <button style={btnStyle} onClick={() => saveBank('mtn')}>Save</button>}

        <p style={{...labelStyle, marginTop: '12px'}}>Airtel mobile money</p>
        <input style={{...inputStyle, backgroundColor: user.bankAirtel? '#f3f4f6' : 'white'}}
          placeholder="Phone" value={airtelNumber}
          onChange={(e) =>!user.bankAirtel && setAirtelNumber(e.target.value)}
          readOnly={!!user.bankAirtel} />
        <br />
        <input style={{...inputStyle, backgroundColor: user.bankAirtel? '#f3f4f6' : 'white'}}
          placeholder="Names" value={airtelNames}
          onChange={(e) =>!user.bankAirtel && setAirtelNames(e.target.value)}
          readOnly={!!user.bankAirtel} />
        <br />
        {!user.bankAirtel && <button style={btnStyle} onClick={() => saveBank('airtel')}>Save</button>}
      </div>

      {/* Modify password */}
      <div style={sectionStyle}>
        <p style={labelStyle}>Modify password</p>
        <input style={inputStyle} type="password" placeholder="Old password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} />
        <br />
        <input style={inputStyle} type="password" placeholder="New password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
        <br />
        <input style={inputStyle} type="password" placeholder="Repeat new password" value={repeatPass} onChange={(e) => setRepeatPass(e.target.value)} />
        <br />
        <button style={btnStyle} onClick={changePassword}>Save</button>
      </div>

      {/* VIP Popup - only shows if no VIP */}
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

      {/* Cute small logout button */}
      <div style={{textAlign: 'center', padding: '16px'}}>
        <button style={logoutBtn} onClick={logout}>Logout</button>
      </div>
    </div>
  )
}