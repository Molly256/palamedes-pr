'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AvatarWithBadge from '../../components/AvatarWithBadge' // ← added

export default function SettingsPage() {
  const router = useRouter()

  const [user, setUser] = useState({
    avatar: '',
    phone: '',
    nickname: '',
    username: '',
    vip: 0, // ← added vip field for badge color
    hasVipTask: false,
    bankMTN: null,
    bankAirtel: null,
    password: '123456',
    balance: 0
  })

  const [nickname, setNickname] = useState('')
  const [avatarPreview, setAvatarPreview] = useState('')

  const [mtnNumber, setMtnNumber] = useState('')
  const [mtnNames, setMtnNames] = useState('')
  const [airtelNumber, setAirtelNumber] = useState('')
  const [airtelNames, setAirtelNames] = useState('')

  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [repeatPass, setRepeatPass] = useState('')

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    setUser(saved)
    setNickname(saved.nickname || '')
    setAvatarPreview(saved.avatar || '')
  }, [])

  const saveUser = (data) => {
    localStorage.setItem('palamedes_user', JSON.stringify(data))
    setUser(data)
  }

  const handleAvatarChange = (e) => {
    if (!user.hasVipTask) {
      alert('Purchase VIP Task first to edit avatar')
      return
    }
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result
        setAvatarPreview(base64)
        const updated = {...user, avatar: base64}
        saveUser(updated)
        alert('Avatar updated. Same pic + VIP badge will show on Dashboard.')
      }
      reader.readAsDataURL(file)
    }
  }

  const saveNickname = () => {
    if (nickname.length > 6) {
      alert('Nickname max 6 letters only')
      return
    }
    const updated = {...user, nickname}
    saveUser(updated)
    alert('Nickname saved')
  }

  const saveBank = (method) => {
    if (method === 'mtn' &&!user.bankMTN) {
      if (!mtnNumber ||!mtnNames) return alert('Fill all MTN fields')
      const updated = {...user, bankMTN: {number: mtnNumber, names: mtnNames}}
      saveUser(updated)
      alert('MTN Mobile Money saved. Locked forever.')
    }
    if (method === 'airtel' &&!user.bankAirtel) {
      if (!airtelNumber ||!airtelNames) return alert('Fill all Airtel fields')
      const updated = {...user, bankAirtel: {number: airtelNumber, names: airtelNames}}
      saveUser(updated)
      alert('Airtel Mobile Money saved. Locked forever.')
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
    <div style={{padding: '20px 20px 100px 20px', maxWidth: '500px', margin: '0 auto'}}>
      <h1 style={{fontSize: '24px', fontWeight: '900', marginBottom: '30px'}}>Settings</h1>

      {/* Avatar Section - NOW WITH VIP BADGE */}
      <div style={{marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '12px'}}>
        <h3 style={{fontWeight: '900', marginBottom: '15px'}}>Avatar</h3>
        <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>

          {/* FIX: Use AvatarWithBadge so VIP color shows here too */}
          <AvatarWithBadge
            username={user?.username}
            vipLevel={user?.vip || 0}
            size={80}
            avatar={avatarPreview}
          />

          <div style={{flex: 1}}>
            {!user.hasVipTask && <p style={{fontSize: '12px', color: 'red', margin: '0 0 8px 0'}}>Buy VIP Task to edit avatar</p>}
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              disabled={!user.hasVipTask}
              style={{fontSize: '12px', width: '100%'}}
            />
            <p style={{fontSize: '11px', color: '#666', marginTop: '8px'}}>
              This avatar + VIP badge shows on dashboard. Edit only here.
            </p>
          </div>
        </div>
      </div>

      {/* Phone - Locked */}
      <div style={{marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '12px'}}>
        <h3 style={{fontWeight: '900', marginBottom: '15px'}}>Phone Number</h3>
        <input
          type="text"
          value={user.phone}
          disabled
          style={{width: '100%', padding: '12px', background: '#f5f5f5', border: '1px solid #ccc', borderRadius: '8px', color: '#000'}}
        />
        <p style={{fontSize: '11px', color: '#666', marginTop: '8px'}}>Set by system on registration. Cannot edit.</p>
      </div>

      {/* Nickname */}
      <div style={{marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '12px'}}>
        <h3 style={{fontWeight: '900', marginBottom: '15px'}}>Nickname</h3>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value.slice(0, 6))}
          maxLength={6}
          placeholder="Max 6 letters"
          style={{width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '10px'}}
        />
        <button
          onClick={saveNickname}
          style={{padding: '10px 20px', background: '#00BFFF', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700'}}
        >
          Save Nickname
        </button>
      </div>

      {/* Bank Information */}
      <div style={{marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '12px'}}>
        <h3 style={{fontWeight: '900', marginBottom: '15px'}}>Bank Information</h3>
        <p style={{fontSize: '11px', color: '#666', marginBottom: '15px'}}>2 methods only. Once saved, cannot edit again.</p>

        <div style={{marginBottom: '20px', padding: '15px', border: '1px dashed #ccc', borderRadius: '8px'}}>
          <h4 style={{fontWeight: '700', marginBottom: '10px'}}>MTN Mobile Money</h4>
          <input type="text" placeholder="Number" value={user.bankMTN?.number || mtnNumber} onChange={(e) => setMtnNumber(e.target.value)} disabled={!!user.bankMTN} style={{width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '8px', background: user.bankMTN? '#f5f5f5' : 'white'}}/>
          <input type="text" placeholder="Names" value={user.bankMTN?.names || mtnNames} onChange={(e) => setMtnNames(e.target.value)} disabled={!!user.bankMTN} style={{width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '8px', background: user.bankMTN? '#f5f5f5' : 'white'}}/>
          {!user.bankMTN? (
            <button onClick={() => saveBank('mtn')} style={{padding: '8px 16px', background: '#00BFFF', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700'}}>Save MTN</button>
          ) : (
            <p style={{fontSize: '12px', color: 'green', fontWeight: '700'}}>✓ Locked - Cannot edit</p>
          )}
        </div>

        <div style={{padding: '15px', border: '1px dashed #ccc', borderRadius: '8px'}}>
          <h4 style={{fontWeight: '700', marginBottom: '10px'}}>Airtel Mobile Money</h4>
          <input type="text" placeholder="Number" value={user.bankAirtel?.number || airtelNumber} onChange={(e) => setAirtelNumber(e.target.value)} disabled={!!user.bankAirtel} style={{width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '8px', background: user.bankAirtel? '#f5f5f5' : 'white'}}/>
          <input type="text" placeholder="Names" value={user.bankAirtel?.names || airtelNames} onChange={(e) => setAirtelNames(e.target.value)} disabled={!!user.bankAirtel} style={{width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '8px', background: user.bankAirtel? '#f5f5f5' : 'white'}}/>
          {!user.bankAirtel? (
            <button onClick={() => saveBank('airtel')} style={{padding: '8px 16px', background: '#00BFFF', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700'}}>Save Airtel</button>
          ) : (
            <p style={{fontSize: '12px', color: 'green', fontWeight: '700'}}>✓ Locked - Cannot edit</p>
          )}
        </div>
      </div>

      {/* Change Password */}
      <div style={{marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '12px'}}>
        <h3 style={{fontWeight: '900', marginBottom: '15px'}}>Modify Password</h3>
        <input type="password" placeholder="Old password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} style={{width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '8px'}}/>
        <input type="password" placeholder="New password" value={newPass} onChange={(e) => setNewPass(e.target.value)} style={{width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '8px'}}/>
        <input type="password" placeholder="Repeat new password" value={repeatPass} onChange={(e) => setRepeatPass(e.target.value)} style={{width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '10px'}}/>
        <button onClick={changePassword} style={{padding: '10px 20px', background: '#00BFFF', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700'}}>Save Password</button>
      </div>

      {/* Logout - bold light blue border */}
      <button
        onClick={logout}
        style={{
          width: '100%',
          padding: '14px',
          background: 'white',
          color: 'black',
          border: '4px solid #00BFFF', // ← thicker = bold
          borderRadius: '12px',
          fontWeight: '900',
          fontSize: '16px',
          cursor: 'pointer'
        }}
      >
        Logout
      </button>
    </div>
  )
}