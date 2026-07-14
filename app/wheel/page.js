'use client';

import { useState, useRef, useEffect } from 'react';

const TOTAL_SLICES = 7;
const DEGREES_PER_SLICE = 360 / TOTAL_SLICES;
const TARGET_SLICE_INDEX = 0; // 2,000 Shs

export default function LuckyWheelPage() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [spins, setSpins] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  
  const wheelRef = useRef(null);

  // FIXED: Read from palamedes_user like your login stores
  useEffect(() => {
    async function fetchUserData() {
      try {
        // 1. Get phone from palamedes_user object
        const storedUser = localStorage.getItem('palamedes_user');
        
        if (!storedUser) {
          console.error('No user found. Please login first.');
          setLoading(false);
          return;
        }

        const userObj = JSON.parse(storedUser);
        const userPhone = userObj?.phone;
        
        if (!userPhone) {
          console.error('Phone not found in user object');
          setLoading(false);
          return;
        }

        setPhone(userPhone);

        // 2. Fetch spins using that phone
        const res = await fetch(`/api/user?phone=${userPhone}`);
        const data = await res.json();
        
        console.log('Redis response:', data);
        
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
  }, []); // Run once on mount

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
      const targetOffset = TARGET_SLICE_INDEX * DEGREES_PER_SLICE;
      const finalRotationAngle = baseRotations - targetOffset; 

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
            wheelRef.current.style.transform = `rotate(${-targetOffset}deg)`;
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
        <div style={{ fontSize: '18px', fontWeight: '500' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'sans-serif', padding: '20px', minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      
      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
        <div style={{ background: spins > 0 ? '#e8f5e9' : '#fff', padding: '10px 20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: spins > 0 ? '2px solid #4caf50' : 'none' }}>
          <strong>Spins:</strong> <span style={{ color: spins > 0 ? '#2e7d32' : '#999', fontWeight: spins > 0 ? '700' : '400' }}>{spins}</span>
        </div>
      </div>

      {spins === 0 && (
        <div style={{ background: '#fff3cd', padding: '12px 20px', borderRadius: '8px', marginBottom: '20px', color: '#856404', fontSize: '14px' }}>
          Buy or upgrade VIP to activate your wheel!
        </div>
      )}

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
            background: 'conic-gradient(#ff69b4 0% 14.3%, #00bfff 14.3% 28.6%, #32cd32 28.6% 42.9%, #ffd700 42.9% 57.1%, #9370db 57.1% 71.4%, #ff0000 71.4% 85.7%, #006400 85.7% 100%)'
          }} />

          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', fontWeight: 'bolder', color: '#000', fontSize: '12px' }}>
            <span style={{ position: 'absolute', top: '15%', left: '46%', transform: 'rotate(25deg)' }}>2,000</span>
            <span style={{ position: 'absolute', top: '30%', right: '12%', transform: 'rotate(75deg)' }}>3,000</span>
            <span style={{ position: 'absolute', bottom: '25%', right: '15%', transform: 'rotate(125deg)' }}>50,000</span>
            <span style={{ position: 'absolute', bottom: '12%', left: '42%', transform: 'rotate(180deg)' }}>100k</span>
            <span style={{ position: 'absolute', bottom: '30%', left: '12%', transform: 'rotate(235deg)' }}>500k</span>
            <span style={{ position: 'absolute', top: '35%', left: '10%', transform: 'rotate(285deg)' }}>VIP 4</span>
            <span style={{ position: 'absolute', top: '15%', left: '22%', transform: 'rotate(335deg)' }}>VIP 3</span>
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

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '15px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', maxWidth: '400px', width: '90%' }}>
            <h2 style={{ fontSize: '50px', margin: '0 0 10px 0' }}>🥳</h2>
            <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>Congratulations!</h3>
            <p style={{ fontSize: '18px', color: '#666', margin: '0 0 20px 0' }}>You won <strong style={{ color: '#ff69b4' }}>2,000 Shs</strong>!</p>
            <p style={{ fontSize: '14px', color: '#999', margin: '0 0 25px 0' }}>The funds have been instantly credited to your available balance wallet container.</p>
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