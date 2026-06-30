'use client';
import React, { useState, useEffect } from 'react';
import booksData from '../data/books.json';

export default function Hot() {
  const [availableBalance, setAvailableBalance] = useState(0);
  const [ongoingHots, setOngoingHots] = useState([]);
  const [expiredHots, setExpiredHots] = useState([]);
  const [quantities, setQuantities] = useState({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 });
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState(''); // <- 1. Real user

  const getUgandanTime = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Kampala" }));
  const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const getCoverPath = (id) => `/books/covers/${id}.jpg`;

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('palamedes_user') || '{}'); // <- 2. Read real user
    if (!user.phone) { setLoading(false); return; }
    setPhone(user.phone);

    fetch(`/api/hot?phone=${user.phone}`) // <- 3. Use phone not user_101
   .then(res => res.json())
   .then(data => {
        if (data.success) {
          setAvailableBalance(Number(data.wallet || 0)); // <- 4. wallet not availableBalance
          if (data.ongoing) setOngoingHots(data.ongoing);
          if (data.expired) setExpiredHots(data.expired);
        }
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  const handleQty = (id, type) => {
    setQuantities(p => Object.assign({}, p, { [id]: Math.max(1, (p[id] || 1) + (type === 'plus'? 1 : -1)) }));
  };

  const handleBuy = async (book) => {
    const qty = quantities[book.id] || 1;
    const price = 50000;
    const cost = price * qty;
    if (availableBalance < cost) return alert("❌ Insufficient available balance");

    const nowUg = getUgandanTime();
    const days = book.id === 1? 30 : 180;
    const exp = new Date(nowUg);
    exp.setDate(exp.getDate() + days);
    const profit = cost * (book.id === 1? 0.01 : 0.05) * days;

    const newHot = {
      hotId: `hot_${Date.now()}`, bookId: book.id, title: book.title, author: book.author,
      cover: getCoverPath(book.id), pricePaid: cost, quantity: qty, expectedReturn: cost + profit,
      purchaseDateStr: formatDate(nowUg), expirationTimestamp: exp.getTime()
    };

    const res = await fetch('/api/hot', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ phone, action: 'BUY_HOT', payload: { price, newHotInstance: newHot } }) // <- phone
    });
    const data = await res.json();
    if (!data.success) return alert(data.error || "Buy failed");

    setAvailableBalance(data.wallet); // <- wallet
    setOngoingHots(p => [].concat(p, [newHot]));
    setQuantities(p => Object.assign({}, p, { [book.id]: 1 }));
  };

  const handleCollect = async (hot) => {
    const res = await fetch('/api/hot', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ phone, action: 'COLLECT_HOT', payload: { hotId: hot.hotId, hot } }) // <- phone
    });
    const data = await res.json();
    if (!data.success) return alert(data.error || "Collect failed");

    setAvailableBalance(data.wallet); // <- wallet
    setOngoingHots(p => p.filter(i => i.hotId!== hot.hotId));
    setExpiredHots(p => [].concat(p, [hot]));
  };

  if (loading) return React.createElement('div', { style: { textAlign: 'center', padding: '50px' } }, 'Loading...');

  return React.createElement('div', { style: { maxWidth: '750px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' } },
    React.createElement('div', { style: { borderBottom: '2px solid #222', paddingBottom: '12px', marginBottom: '20px' } },
      React.createElement('h2', null, 'HOT'),
      React.createElement('p', null, 'Available Balance: ', React.createElement('strong', { style: { color: '#0056b3' } }, availableBalance.toLocaleString() + 'shs')), // <- FIXED
      React.createElement('div', { style: { display: 'flex', gap: '10px', marginTop: '10px' } },
        React.createElement('button', { style: { background: '#222', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '13px' } }, '🛒 Marketplace')
      )
    ),
    React.createElement(React.Fragment, null,
      React.createElement('div', null,
        React.createElement('h3', null, '🔥 Hot Marketplace'),
        booksData.slice(0, 5).map(book =>
          React.createElement('div', { key: book.id, style: { display: 'flex', border: '1px solid #eee', padding: '15px', marginBottom: '15px', borderRadius: '8px' } },
            React.createElement('img', { src: getCoverPath(book.id), alt: book.title, style: { width: '90px', height: '125px', objectFit: 'cover', marginRight: '15px' } }),
            React.createElement('div', { style: { flexGrow: 1 } },
              React.createElement('h4', null, book.title),
              React.createElement('p', { style: { color: '#666', fontSize: '13px' } }, 'Author: ' + book.author + ' | Daily: ', React.createElement('span', { style: { color: 'green', fontWeight: 'bold' } }, book.id === 1? '1%' : '5%')),
              React.createElement('p', { style: { fontWeight: 'bold', margin: '5px 0' } }, 'Price: 50,000shs'),
              React.createElement('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } },
                React.createElement('div', { style: { border: '1px solid #ccc', borderRadius: '4px', display: 'flex', alignItems: 'center' } },
                  React.createElement('button', { onClick: () => handleQty(book.id, 'minus'), style: { padding: '2px 6px', border: 'none', fontSize: '12px', width: '28px', height: '28px' } }, '-'),
                  React.createElement('span', { style: { padding: '0 5px', fontWeight: 'bold', fontSize: '12px', minWidth: '20px', textAlign: 'center' } }, quantities[book.id] || 1),
                  React.createElement('button', { onClick: () => handleQty(book.id, 'plus'), style: { padding: '2px 6px', border: 'none', fontSize: '12px', width: '28px', height: '28px' } }, '+')
                ),
                React.createElement('button', {
                  onClick: () => handleBuy(book),
                  style: { background: '#00BFFF', color: '#000', fontWeight: '300', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }
                }, 'Confirm Buy Hot')
              )
            )
          )
        )
      ),
      React.createElement('div', { style: { marginTop: '30px' } },
        React.createElement('h3', null, '⏳ Ongoing Hots'),
        ongoingHots.length === 0? React.createElement('p', { style: { color: '#888', fontStyle: 'italic' } }, 'No active investments.') : ongoingHots.map(hot => {
          const matured = getUgandanTime().getTime() >= hot.expirationTimestamp;
          return React.createElement('div', { key: hot.hotId, style: { display: 'flex', border: '1px solid #eee', padding: '15px', marginBottom: '15px', borderRadius: '8px' } },
            React.createElement('div', { style: { flexGrow: 1 } },
              React.createElement('h4', null, hot.title),
              React.createElement('p', { style: { fontSize: '13px' } }, 'Price Paid: ' + hot.pricePaid.toLocaleString() + 'shs (' + hot.quantity + ' Units)'), // <- FIXED
              React.createElement('p', { style: { color: '#0056b3', fontSize: '14px' } }, 'Expected Return: ', React.createElement('strong', null, hot.expectedReturn.toLocaleString() + 'shs')), // <- FIXED
              React.createElement('button', { disabled:!matured, onClick: () => handleCollect(hot), style: { marginTop: '8px', background: matured? '#0056b3' : '#ccc', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: matured? 'pointer' : 'not-allowed' } }, 'Collect Hot Income')
            )
          );
        })
      ),
      React.createElement('div', { style: { marginTop: '30px' } },
        React.createElement('h3', null, '✅ Expired Hots'),
        expiredHots.length === 0? React.createElement('p', { style: { color: '#888', fontStyle: 'italic' } }, 'No completed investments.') : expiredHots.map(hot =>
          React.createElement('div', { key: hot.hotId, style: { display: 'flex', border: '1px solid #eee', padding: '15px', marginBottom: '15px', borderRadius: '8px', opacity: 0.7 } },
            React.createElement('div', { style: { flexGrow: 1 } },
              React.createElement('h4', null, hot.title),
              React.createElement('p', { style: { fontSize: '13px' } }, 'Price Paid: ' + hot.pricePaid.toLocaleString() + 'shs (' + hot.quantity + ' Units)'), // <- FIXED
              React.createElement('p', { style: { color: '#0056b3', fontSize: '14px' } }, 'Expected Return: ', React.createElement('strong', null, hot.expectedReturn.toLocaleString() + 'shs')) // <- FIXED
            )
          )
        )
      )
    )
  );
}