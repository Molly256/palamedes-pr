'use client';

import { useState, useRef, useEffect } from 'react';

const TOTAL_SLICES = 7;
const DEGREES_PER_SLICE = 360 / TOTAL_SLICES;
const TARGET_SLICE_INDEX = 0; // 2,000 Shs - pink slice

export default function LuckyWheelPage() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [spins, setSpins] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  
  const wheelRef = useRef(null);

  useEffect(() => {
    async function fetchUserData() {
      try {
        const storedUser = localStorage.getItem('palamedes_user');
        if (!storedUser) {
          setLoading(false);
          return;
        }

        const userObj = JSON.parse(storedUser);
        const userPhone = userObj?.phone;
        if (!userPhone) {
          setLoading(false);
          return;
        }

        setPhone(userPhone);

        const res = await fetch(`/api/user?phone=${userPhone}`);
        const data = await res.json();
        
        if (data.success && data.user) {
          setSpins(data.user.spins || 0);
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchUserData();
  }, []);

  async function startLuckyWheelSpin() {
    if (isSpinning || spins < 1 || !phone) return;
    setIsSpinning(true);

    try {
      const response = await fetch('/api/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        alert(data.error || "No spins available!");
        setIsSpinning(false);
        return;
      }

      const baseRotations = 6 * 360;
      const sliceCenter = TARGET_SLICE_INDEX * DEGREES_PER_SLICE + (DEGREES_PER_SLICE / 2);
      const finalRotationAngle = baseRotations + (360 - sliceCenter); 

      if (wheelRef.current) {
        wheelRef.current.style.transition = "transform 4s cubic-bezier(0.1, 0.8, 0.3, 1)";
        wheelRef.current.style.transform = `rotate(${finalRotationAngle}deg)`;
      }

      setTimeout(() => {
        setShowModal(true);
        setSpins(data.remainingSpins);

        setTimeout(() => {
          if (wheelRef.current) {
            wheelRef.current.style.transition = "none";
            wheelRef.current.style.transform = `rotate(${-sliceCenter}deg)`;
          }
          setIsSpinning(false);
        }, 500);

      }, 4000);

    } catch (error) {
      console.error("Spin execution error:", error);
      alert("Something went wrong. Try again.");
      setIsSpinning(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
        <div style={{ fontSize: '18px', fontWeight: '500' }}>Loading wheel...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'sans-serif', padding: '20px', minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      
      <h1 style={{ 
        color: '#00BFFF', 
        fontSize: '20px', 
        fontWeight: '900', 
        marginBottom: '20px',
        letterSpacing: '1px',
        textAlign: 'center'
      }}>
        PALAMEDES-PR COMPANY LUCKY WHEEL
      </h1>
      
      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
        <div style={{ background: spins > 0 ? '#e8f5e9' : '#fff', padding: '10px 20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: spins > 0 ? '2px solid #4caf50' : 'none' }}>
          <strong>Spins:</strong> <span style={{ color: spins > 0 ? '#2e7d32' : '#999', fontWeight: spins > 0 ? '700' : '400' }}>{spins}</span>
        </div>
      </div>

      <div style={{ position: 'relative', width: '320px', height: '320px', margin: '40px 0' }}>
        
        <div style={{
          position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)',
          width: '0', height: '0', borderLeft: '15px solid transparent', borderRight: '15px solid transparent',
          borderTop: '25px solid #333', zIndex: 10
        }} />

        <div 
          ref={wheelRef}
          style={{
            width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)', position: 'relative', border: '5px solid #fff'
          }}
        >
          <div style={{
            width: '100%', height: '100%',
            background: 'conic-gradient(#ff69b4 0deg 51.4deg, #00bfff 51.4deg 102.8deg, #32cd32 102.8deg 154.3deg, #ffd700 154.3deg 205.7deg, #9370db 205.7deg 257.1deg, #ff0000 257.1deg 308.6deg, #006400 308.6deg 360deg)'
          }} />

          {/* FIXED LABELS - Centered in each slice, upright */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', fontWeight: 'bold', color: '#000', fontSize: '13px', textShadow: '1px 1px 2px rgba(255,255,255,0.9)' }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(25.7deg) translateY(-105px) rotate(-25.7deg)' }}>2,000</div>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(77.1deg) translateY(-105px) rotate(-77.1deg)' }}>3,000</div>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(128.5deg) translateY(-105px) rotate(-128.5deg)' }}>50,000</div>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(179.9deg) translateY(-105px) rotate(-179.9deg)' }}>100k</div>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(231.3deg) translateY(-105px) rotate(-231.3deg)' }}>500k</div>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(282.7deg) translateY(-105px) rotate(-282.7deg)' }}>VIP 4</div>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(334.1deg) translateY(-105px) rotate(-334.1deg)' }}>VIP 3</div>
          </div>
        </div>

        <button 
          onClick={startLuckyWheelSpin}
          disabled={isSpinning || spins < 1}
          style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: '70px', height: '70px', borderRadius: '50%', border: '4px solid #fff',
            backgroundColor: spins > 0 ? '#ffd700' : '#ccc', 
            color: '#333', fontSize: '24px', fontWeight: 'bold',
            cursor: isSpinning || spins < 1 ? 'not-allowed' : 'pointer', 
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 12,
            opacity: isSpinning || spins < 1 ? 0.6 : 1
          }}
        >
          ⭐
        </button>
      </div>

      <div style={{ 
        maxWidth: '400px', 
        textAlign: 'center', 
        color: '#666', 
        fontSize: '14px', 
        lineHeight: '1.5',
        marginTop: '10px',
        padding: '0 20px'
      }}>
        Whenever you upgrade or get a successful invite you get a chance to spin the wheel and win different prizes allocated on the lucky wheel.
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '15px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', maxWidth: '400px', width: '90%' }}>
            <h2 style={{ fontSize: '50px', margin: '0 0 10px 0' }}>🥳</h2>
            <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>Congratulations!</h3>
            <p style={{ fontSize: '18px', color: '#666', margin: '0 0 20px 0' }}>You won <strong style={{ color: '#ff69b4' }}>2,000 Shs</strong>!</p>
            <p style={{ fontSize: '14px', color: '#999', margin: '0 0 25px 0' }}>The funds have been instantly credited to your available balance.</p>
            <button 
              onClick={() => setShowModal(false)}
              style={{ background: '#333', color: '#fff', border: 'none', padding: '10px 25px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Awesome!
            </button>
          </div>
        </div>
      )}

    </div>
  );
}