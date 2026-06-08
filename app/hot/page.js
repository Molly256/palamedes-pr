'use client'
import { useState } from 'react'

const cardStyle = {
  backgroundColor: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '12px',
  marginBottom: '12px',
  display: 'flex',
  gap: '12px'
}
const imgStyle = {
  width: '80px',
  height: '80px',
  borderRadius: '6px',
  objectFit: 'cover',
  flexShrink: 0
}
const btnStyle = {
  backgroundColor: '#00BFFF',
  color: 'black',
  fontWeight: '300',
  padding: '6px 12px',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '13px',
  marginTop: '6px'
}
const labelStyle = { fontSize: '13px', fontWeight: '300', color: 'black', marginBottom: '2px' }

export default function HotPage() {
  const [invested, setInvested] = useState({})

  const dividends = [
    {
      id: 'pride',
      name: 'PRIDE AND PREJUDICE',
      cycle: '30days',
      profit: '1%',
      min: '50,000shs',
      img: '/images/pride.jpg' // upload your image here
    },
    {
      id: 'hegel',
      name: 'Hegel lectures',
      cycle: '120days',
      profit: '3%',
      min: '50,000shs',
      img: '/images/hegel.jpg' // upload your image here
    },
    {
      id: 'whale',
      name: 'The whale',
      cycle: '180days',
      profit: '5%',
      min: '50,000shs',
      img: '/images/whale.jpg' // upload your image here
    }
  ]

  const handleInvest = (id) => {
    setInvested({...invested, [id]: true})
    alert('Investment request sent')
  }

  return (
    <div style={{minHeight: '100vh', backgroundColor: '#f9fafb', paddingBottom: '96px'}}>
      <h1 style={{fontSize: '20px', fontWeight: 'bold', textAlign: 'center', padding: '16px', backgroundColor: 'white', color: 'black', borderBottom: '1px solid #e5e7eb'}}>
        PALAMEDES PR COMPANY
      </h1>

      <div style={{padding: '16px'}}>
        <p style={{fontSize: '14px', fontWeight: '300', color: 'black', textAlign: 'center', marginBottom: '16px'}}>
          Welcome to PALAMEDES PR COMPANY board management<br/>
          Buy dividends and increase on your monthly income<br/>
          When you buy shares from our company you become part of the management board
        </p>

        {dividends.map(item => (
          <div key={item.id} style={cardStyle}>
            {/* Left: Image */}
            <img src={item.img} alt={item.name} style={imgStyle} />

            {/* Right: Info */}
            <div style={{flex: 1}}>
              <p style={{fontSize: '14px', fontWeight: 'bold', color: 'black', marginBottom: '4px'}}>{item.name}</p>
              <p style={labelStyle}>Investment cycle: {item.cycle}</p>
              <p style={labelStyle}>Daily profits: {item.profit}</p>
              <p style={labelStyle}>Minimum deposit: {item.min}</p>
              <p style={labelStyle}>Can buy multiple shares</p>

              {!invested[item.id] && (
                <button style={btnStyle} onClick={() => handleInvest(item.id)}>Invest now</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}