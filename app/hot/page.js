'use client';
import React, { useState, useEffect } from 'react';
import booksData from '../data/books.json';

export default function Hot() {
  const [availableBalance, setAvailableBalance] = useState(0); // No demo money
  const [txHistory, setTxHistory] = useState([]);
  const [ongoingHots, setOngoingHots] = useState([]);
  const [expiredHots, setExpiredHots] = useState([]);
  const [quantities, setQuantities] = useState({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 });
  const [activeSubTab, setActiveSubTab] = useState('marketplace');
  const [loading, setLoading] = useState(true);
  const userId = "user_101";

  const getUgandanTime = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Kampala" }));
  const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const getCoverPath = (id) => `/books/covers/${id}.jpg`;

  useEffect(() => {
    fetch(`/api/hot?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.availableBalance !== null) setAvailableBalance(Number(data.availableBalance));
          if (data.ongoing) setOngoingHots(data.ongoing);
          if (data.expired) setExpiredHots(data.expired);
          if (data.history) setTxHistory(data.history);
        }
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  const handleQty = (id, type) => {
    setQuantities(p => ({ ...p, [id]: Math.max(1, (p[id] || 1) + (type === 'plus' ? 1 : -1)) }));
  };

  const handleBuy = async (book) => {
    const qty = quantities[book.id] || 1;
    const cost = 50000 * qty;
    if (availableBalance < cost) return alert("❌ Insufficient available balance");

    const nowUg = getUgandanTime();
    const days = book.id === 1 ? 30 : 180;
    const exp = new Date(nowUg);
    exp.setDate(exp.getDate() + days);
    const profit = cost * (book.id === 1 ? 0.01 : 0.05) * days;
    const updatedAvailableBalance = availableBalance - cost;

    const newHot = {
      hotId: `hot_${Date.now()}`, bookId: book.id, title: book.title, author: book.author,
      cover: getCoverPath(book.id),
      pricePaid: cost, quantity: qty, expectedReturn: cost + profit,
      purchaseDateStr: formatDate(nowUg), expirationTimestamp: exp.getTime()
    };

    const newTx = { 
      id: `tx_${Date.now()}`, 
      title: "hot bought", 
      amount: `-${cost.toLocaleString()} SHS`, 
      date: formatDate(nowUg) 
    };

    setAvailableBalance(updatedAvailableBalance);
    setOngoingHots(p => [...p, newHot]);
    setTxHistory(p => [newTx, ...p]);
    setQuantities(p => ({ ...p, [book.id]: 1 }));

    await fetch('/api/hot', { 
      method: 'POST', 
      body: JSON.stringify({ 
        userId, 
        action: 'BUY_HOT', 
        payload: { updatedAvailableBalance, newHotInstance: newHot, newTx } 
      }) 
    });
  };

  const handleCollect = async (hot) => {
    const updatedAvailableBalance = availableBalance + hot.expectedReturn;
    const nowUg = getUgandanTime();
    const newTx = { id: `tx_${Date.now()}`, title: "hot income collected", amount: `+${hot.expectedReturn.toLocaleString()} SHS`, date: formatDate(nowUg) };

    setAvailableBalance(updatedAvailableBalance);
    setOngoingHots(p => p.filter(i => i.hotId !== hot.hotId));
    setExpiredHots(p => [...p, hot]);
    setTxHistory(p => [newTx, ...p]);

    await fetch('/api/hot', { 
      method: 'POST', 
      body: JSON.stringify({ 
        userId, 
        action: 'COLLECT_HOT', 
        payload: { updatedAvailableBalance, hotId: hot.hotId, hot, newTx } 
      }) 
    });
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '750px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #222', paddingBottom: '12px' }}>
        <div>
          <h2>HOT</h2>
          <p>Available Balance: <strong style={{ color: '#0056b3' }}>{availableBalance.toLocaleString()} SHS</strong></p>
        </div>
        <button onClick={() => setActiveSubTab(activeSubTab === 'marketplace' ? 'history' : 'marketplace')} style={{ background: '#111', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' }}>
          {activeSubTab === 'marketplace' ? '📜 TX History' : '🛒 Marketplace'}
        </button>
      </div>

      {activeSubTab === 'history' ? (
        <div style={{ marginTop: '20px' }}>
          <h3>Transaction Log History</h3>
          {txHistory.length === 0 ? <p>No records found.</p> : txHistory.map(tx => (
            <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid #eee' }}>
              <div style={{ fontWeight: '300', color: '#000' }}>{tx.title}</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: '700' }}>{tx.amount}</div>
                <div style={{ fontSize: '11px', color: '#718096', marginTop: '2px' }}>{tx.date}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div style={{ marginTop: '20px' }}>
            <h3>🔥 Hot Marketplace</h3>
            {booksData.slice(0, 5).map(book => (
              <div key={book.id} style={{ display: 'flex', border: '1px solid #eee', padding: '15px', marginBottom: '15px', borderRadius: '8px' }}>
                <img src={getCoverPath(book.id)} alt={book.title} style={{ width: '90px', height: '125px', objectFit: 'cover', marginRight: '15px' }} />
                <div style={{ flexGrow: 1 }}>
                  <h4>{book.title}</h4>
                  <p style={{ color: '#666', fontSize: '13px' }}>Author: {book.author}</p>
                  <p style={{ fontSize: '13px' }}>Daily Income: <span style={{ color: 'green', fontWeight: 'bold' }}>{book.id === 1 ? "1%" : "5%"}</span> for {book.id === 1 ? 30 : 180} Days</p>
                  <p style={{ fontWeight: 'bold', margin: '5px 0' }}>Price: 50,000 SHS</p>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ border: '1px solid #ccc', borderRadius: '4px' }}>
                      <button onClick={() => handleQty(book.id, 'minus')} style={{ padding: '5px 10px', border: 'none' }}>-</button>
                      <span style={{ padding: '0 10px', fontWeight: 'bold' }}>{quantities[book.id] || 1}</span>
                      <button onClick={() => handleQty(book.id, 'plus')} style={{ padding: '5px 10px', border: 'none' }}>+</button>
                    </div>
                    <button onClick={() => handleBuy(book)} style={{ background: '#28a745', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>
                      Confirm Buy Hot ({((quantities[book.id] || 1) * 50000).toLocaleString()} SHS)
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '30px' }}>
            <h3>⏳ Ongoing Hots</h3>
            {ongoingHots.length === 0 ? <p style={{ color: '#888', fontStyle: 'italic' }}>No active investments.</p> : ongoingHots.map(hot => {
              const matured = getUgandanTime().getTime() >= hot.expirationTimestamp;
              return (
                <div key={hot.hotId} style={{ display: 'flex', border: '1px solid #eee', padding: '15px', marginBottom: '15px', borderRadius: '8px' }}>
                  <img src={hot.cover} alt={hot.title} style={{ width: '90px', height: '125px', objectFit: 'cover', marginRight: '15px' }} />
                  <div style={{ flexGrow: 1 }}>
                    <h4>{hot.title}</h4>
                    <p style={{ fontSize: '13px' }}>Price Paid: {hot.pricePaid.toLocaleString()} SHS ({hot.quantity} Units)</p>
                    <p style={{ color: '#0056b3', fontSize: '14px' }}>Expected Return: <strong>{hot.expectedReturn.toLocaleString()} SHS</strong></p>
                    <p style={{ fontSize: '11px', color: '#666' }}>📅 Bought: {hot.purchaseDateStr} | Expires: {formatDate(new Date(hot.expirationTimestamp))}</p>
                    <button disabled={!matured} onClick={() => handleCollect(hot)} style={{ marginTop: '8px', background: matured ? '#0056b3' : '#ccc', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: matured ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>
                      Collect Hot Income
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '30px' }}>
            <h3>✅ Expired Hots</h3>
            {expiredHots.length === 0 ? <p style={{ color: '#888', fontStyle: 'italic' }}>No completed investments.</p> : expiredHots.map(hot => (
              <div key={hot.hotId} style={{ display: 'flex', border: '1px solid #eee', padding: '15px', marginBottom: '15px', borderRadius: '8px', opacity: 0.7 }}>
                <img src={hot.cover} alt={hot.title} style={{ width: '90px', height: '125px', objectFit: 'cover', marginRight: '15px' }} />
                <div style={{ flexGrow: 1 }}>
                  <h4>{hot.title}</h4>
                  <p style={{ fontSize: '13px' }}>Total Settled: {hot.expectedReturn.toLocaleString()} SHS</p>
                  <div style={{ display: 'inline-block', background: '#c6f6d5', color: '#22543d', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', marginTop: '5px' }}>Closed & Settled</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}