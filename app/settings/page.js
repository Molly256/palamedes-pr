'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AvatarWithBadge from '../../components/AvatarWithBadge'

const S = '#00BFFF' // hot skyblue
const box = {padding:16, background:'#fff', borderBottom:'1px solid #eee'}
const inpt = {width:'100%', maxWidth:300, height:36, padding:'0 10px', border:'1px solid #ddd', borderRadius:6, margin:'6px 0', fontWeight:300}
const btn = {background:S, color:'black', border:'none', borderRadius:6, padding:'8px 16px', fontWeight:300, cursor:'pointer'}
const lgBtn = {...btn, borderRadius:16, width:'100%', maxWidth:300, marginTop:24}

export default function Settings(){
  const r = useRouter()
  const file = useRef()
  const [u,setU] = useState({phone:'',nickname:'',username:'',vip:0,avatar:'',password:''})
  const [nick,setNick] = useState('')
  const [o,setO] = useState(''),[n,setN] = useState(''),[p,setP] = useState('')
  const [vipPop,setVipPop] = useState(false)

  useEffect(()=>{
    const s = JSON.parse(localStorage.getItem('palamedes_user')||'{}')
    if(!s.phone) return r.push('/login')
    fetch(`/api/user?phone=${s.phone}`).then(res=>res.json()).then(d=>{
      if(d.success){ setU(d.user); setNick(d.user.nickname||d.user.username||'') }
    })
  },[])

  const save = (data)=>{ localStorage.setItem('palamedes_user',JSON.stringify(data)); setU(data) }

  const avatar = ()=> u.vip<1? setVipPop(true) : file.current.click()

  const upAvatar = async(e)=>{
    const f=e.target.files[0]; if(!f) return
    const b=await new Promise(res=>{const rd=new FileReader(); rd.onload=()=>res(rd.result); rd.readAsDataURL(f)})
    const res=await fetch('/api/user',{method:'POST',body:JSON.stringify({action:'updateProfile',phone:u.phone,field:'avatar',value:b})})
    if((await res.json()).success) save({...u,avatar:b})
  }

  const saveNick = async()=>{
    if(!nick||nick.length>6) return alert('Max 6 chars')
    const res=await fetch('/api/user',{method:'POST',body:JSON.stringify({action:'updateProfile',phone:u.phone,field:'nickname',value:nick})})
    if((await res.json()).success) save({...u,nickname:nick})
  }

  const savePass = async()=>{
    if(!o||!n||!p||n!==p||n.length<6) return alert('Check all 3 fields')
    const res=await fetch('/api/user',{method:'POST',body:JSON.stringify({action:'changePassword',phone:u.phone,oldPass:o,newPass:n})})
    const d=await res.json(); alert(d.message)
    if(d.success){ save({...u,password:n}); setO('');setN('');setP('') }
  }

  return(
    <div style={{minHeight:'100vh',background:'#f9fafb'}}>
      <h1 style={{textAlign:'center',padding:16,background:'#fff',borderBottom:'1px solid #eee'}}>Settings</h1>

      <div style={{...box,display:'flex',flexDirection:'column',alignItems:'center'}}>
        <div onClick={avatar}><AvatarWithBadge username={u.username} vipLevel={u.vip} size={90} avatar={u.avatar}/></div>
        <p style={{fontSize:12,color:'#666'}}>{u.vip<1?'VIP1+ for photo':'Tap to change'}</p>
        <p>{nick||u.username}</p>
      </div>
      <input type="file" ref={file} accept="image/*" onChange={upAvatar} hidden/>

      <div style={box}>
        <p style={{fontSize:14,fontWeight:300}}>Phone</p>
        <input style={{...inpt,background:'#f3f3f3'}} value={u.phone} readOnly/>
        <p style={{fontSize:14,fontWeight:300}}>Nickname 6 max</p>
        <input style={inpt} value={nick} maxLength={6} onChange={e=>setNick(e.target.value.slice(0,6))}/>
        <button style={btn} onClick={saveNick}>Save</button>
      </div>

      <div style={box}>
        <p style={{fontSize:14,fontWeight:300}}>Password</p>
        <input style={inpt} type="password" placeholder="Old" value={o} onChange={e=>setO(e.target.value)}/>
        <input style={inpt} type="password" placeholder="New" value={n} onChange={e=>setN(e.target.value)}/>
        <input style={inpt} type="password" placeholder="Repeat" value={p} onChange={e=>setP(e.target.value)}/>
        <button style={btn} onClick={savePass}>Save</button>
      </div>

      <div style={{...box,border:'none',display:'flex',justifyContent:'center'}}>
        <button style={lgBtn} onClick={()=>{localStorage.removeItem('palamedes_user');r.push('/login')}}>Logout</button>
      </div>

      {vipPop&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{background:'#fff',padding:24,borderRadius:8,textAlign:'center'}}>
          <p>VIP1+ needed for avatar</p><button style={btn} onClick={()=>setVipPop(false)}>OK</button>
        </div>
      </div>}
    </div>
  )
}