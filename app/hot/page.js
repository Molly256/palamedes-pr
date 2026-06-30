'use client';
import React, { useState, useEffect } from 'react';
import booksData from '../data/books.json';

export default function Hot() {
  const [availableBalance, setAvailableBalance] = useState(0);
  const [ongoingHots, setOngoingHots] = useState([]);
  const [expiredHots, setExpiredHots] = useState([]);
  const [quantities, setQuantities] = useState({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 });
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');

  const getUgandanTime = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Kampala" }));
  const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const getCoverPath = (id) => `/books/covers/${id}.jpg`;

  const refreshFromServer = async () => {
    try {
      const res = await fetch(`/api/hot?phone=${phone}`);
      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setAvailableBalance(Number(data.wallet || 0));
        setOngoingHots(Array.isArray(data.ongoing)? data.ongoing : []); // <- Ongoing Shares section
        setExpiredHots(Array.isArray(data.expired)? data.expired : []); // <- Expired Shares section
      }
    } catch (err) {
      console.error("Failed to refresh data:", err);
    }
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('palamedes_user') || '{}');
    if (!user.phone) { setLoading(false); return; }
    setPhone(user.phone);

    fetch(`/api/hot?phone=${user.phone}`)
   .then(res => {
        if (!res.ok) throw new Error(`Server returned status ${res.status}`);
        return res.json();
    })
   .then(data => {
        if (data.success) {
          setAvailableBalance(Number(data.wallet || 0));
          setOngoingHots(Array.isArray(data.ongoing)? data.ongoing : []);
          setExpiredHots(Array.isArray(data.expired)? data.expired : []);
        }
        setLoading(false);
      }).catch((err) => {
        console.error("Failed to load initial data:", err);
        setLoading(false);
      });
  }, []);

  const handleQty = (id, type) => {
    setQuantities(p => ({...p, [id]: Math.max(1, (p[id] || 1) + (type === 'plus'? 1 : -1))}));
  };

  const handleBuy = async (book) => {
    const qty = Number(quantities[book.id] || 1);
    const price = 50000;
    const cost = price * qty;
    if (availableBalance < cost) return alert("❌ Insufficient available balance");

    const nowUg = getUgandanTime();
    const days = book.id === 1? 30 : 180;
    const exp = new Date(nowUg);
    exp.setDate(exp.getDate() + days);
    const profit = cost * (book.id === 1? 0.01 : 0.05) * days;

    const newHot = {
      hotId: `hot_${Date.now()}`, 
      bookId: Number(book.id), 
      title: String(book.title), 
      author: String(book.author),
      cover: String(getCoverPath(book.id)), 
      pricePaid: Number(cost), 
      quantity: Number(qty), 
      expectedReturn: Number(cost + profit),
      purchaseDateStr: String(formatDate(nowUg)), 
      expirationTimestamp: Number(exp.getTime())
    };

    try {
      const res = await fetch('/api/hot', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ phone: String(phone), action: 'BUY_HOT', payload: { price: Number(cost), newHotInstance: newHot } })
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "Unknown Server Error");
        console.error("Server Error Payload:", errorText);
        return alert(`Server Error (${res.status}): Please check backend logs.`);
      }

      const data = await res.json();
      if (!data.success) return alert(data.error || "Buy failed");

      // KEY CHANGE: Re-fetch from server. This puts it in Ongoing Shares for real
      await refreshFromServer();
      setQuantities(p => ({...p, [book.id]: 1}));
    } catch (err) {
      alert("Buy failed to execute: " + err.message);
      console.error(err);
    }
  };

  const handleCollect = async (hot) => {
    try {
      const res = await fetch('/api/hot', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ phone: String(phone), action: 'COLLECT_HOT', payload: { hotId: String(hot.hotId) } })
      });

      if (!res.ok) {
        return alert(`Collection failed with server status ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) return alert(data.error || "Collect failed");

      // KEY CHANGE: Re-fetch from server. This moves it to Expired Shares for real
      await refreshFromServer();
    } catch (err) {
      alert("Collection request error: " + err.message);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>Loading...</div>;

  return <div style={{ maxWidth: '750px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
      <h3>🔥 Hot Marketplace</h3>
      <div style={{ background: '#f5f5f5', padding: '8px 15px', borderRadius: '20px', fontWeight: 'bold' }}>
        Balance: <span style={{ color: '#2e7d32' }}>{availableBalance.toLocaleString()} shs</span>
      </div>
    </div>
    
    <div>
      {booksData.slice(0, 5).map(book =>
        <div key={book.id} style={{ display: 'flex', border: '1px solid #eee', padding: '15px', marginBottom: '15px', borderRadius: '8px' }}>
          <img src={getCoverPath(book.id)} alt={book.title} style={{ width: '90px', height: '125px', objectFit: 'cover', marginRight: '15px' }} />
          <div style={{ flexGrow: 1 }}>
            <h4>{book.title}</h4>
            <p style={{ color: '#666', fontSize: '13px' }}>Author: {book.author} | Daily: <span style={{ color: 'green', fontWeight: 'bold' }}>{book.id === 1? '1%' : '5%'}</span></p>
            <p style={{ fontWeight: 'bold', margin: '5px 0' }}>Price: 50,000shs</p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ border: '1px solid #ccc', borderRadius: '4px', display: 'flex', alignItems: 'center' }}>
                <button onClick={() => handleQty(book.id, 'minus')} style={{ padding: '2px 6px', border: 'none', fontSize: '12px', width: '28px', height: '28px' }}>-</button>
                <span style={{ padding: '0 5px', fontWeight: 'bold', fontSize: '12px', minWidth: '20px', textAlign: 'center' }}>{quantities[book.id] || 1}</span>
                <button onClick={() => handleQty(book.id, 'plus')} style={{ padding: '2px 6px', border: 'none', fontSize: '12px', width: '28px', height: '28px' }}>+</button>
              </div>
              <button onClick={() => handleBuy(book)} style={{ background: '#00BFFF', color: '#000', fontWeight: '300', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Confirm Buy Hot</button>
            </div>
          </div>
        </div>
      )}
    </div>
    
    <div style={{ marginTop: '30px' }}>
      <h3>⏳ Ongoing Shares</h3>
      {ongoingHots.length === 0? <p style={{ color: '#888', fontStyle: 'italic' }}>No active investments.</p> : ongoingHots.map(hot => {
        const matured = getUgandanTime().getTime() >= Number(hot.expirationTimestamp);
        return <div key={hot.hotId} style={{ display: 'flex', border: '1px solid #eee', padding: '15px', marginBottom: '15px', borderRadius: '8px' }}>
          <div style={{ flexGrow: 1 }}>
            <h4>{hot.title}</h4>
            <p style={{ fontSize: '13px' }}>Price Paid: {Number(hot.pricePaid).toLocaleString()}shs ({hot.quantity} Units)</p>
            <p style={{ color: '#0056b3', fontSize: '14px' }}>Expected Return: <strong>{Number(hot.expectedReturn).toLocaleString()}shs</strong></p>
            <button disabled={!matured} onClick={() => handleCollect(hot)} style={{ marginTop: '8px', background: matured? '#0056b3' : '#ccc', color: matured? '#fff' : '#000', border: matured? 'none' : '1px solid #ccc', padding: '6px 12px', borderRadius: '4px', cursor: matured? 'pointer' : 'not-allowed' }}>Collect Hot Income</button>
          </div>
        </div>;
      })}
    </div>

    <div style={{ marginTop: '30px' }}>
      <h3>✅ Expired Shares</h3>
      {expiredHots.length === 0? <p style={{ color: '#888', fontStyle: 'italic' }}>No completed investments.</p> : expiredHots.map(hot =>
        <div key={hot.hotId} style={{ display: 'flex', border: '1px solid #eee', padding: '15px', marginBottom: '15px', borderRadius: '8px', opacity: 0.7 }}>
          <div style={{ flexGrow: 1 }}>
            <h4>{hot.title}</h4>
            <p style={{ fontSize: '13px' }}>Price Paid: {Number(hot.pricePaid).toLocaleString()}shs ({hot.quantity} Units)</p>
            <p style={{ color: '#0056b3', fontSize: '14px' }}>Expected Return: <strong>{Number(hot.expectedReturn).toLocaleString()}shs</strong></p>
          </div>
        </div>
      )}
    </div>
  </div>;
}