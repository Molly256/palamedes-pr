"use client";
import React, { useState, useEffect, Suspense, useRef } from "react";
// FIXED: Standard single component import line
import AvatarWithBadge from "@/components/AvatarWithBadge";

function SettingsContent() {
  const [userPhone, setUserPhone] = useState(""); 
  const [username, setUsername] = useState("");
  const [vipLevel, setVipLevel] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  
  // Keeps the screen invisible for a single millisecond while checking browser data
  const [isCheckingCache, setIsCheckingCache] = useState(true); 

  const fileInputRef = useRef(null);

  useEffect(() => {
    // Safely check for browser environment before hitting localStorage
    if (typeof window === "undefined") return;

    // 1. Instantly pull whatever data we already have from memory
    const saved = JSON.parse(localStorage.getItem('palamedes_user') || '{}');
    const phone = saved.phone || "";
    setUserPhone(phone);
    
    if (saved.username) { setUsername(saved.username); setNewUsername(saved.username); }
    if (saved.vip) setVipLevel(saved.vip);
    if (saved.avatar) setAvatarUrl(saved.avatar);

    // Memory reading is complete! Smoothly display layout items
    setIsCheckingCache(false);

    // 2. Fetch fresh data from the server quietly in the background
    async function loadData() {
      if (!phone) return;
      try {
        const response = await fetch(`/api/user?phone=${encodeURIComponent(phone)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            setUsername(data.user.username || "");
            setNewUsername(data.user.username || "");
            setVipLevel(data.user.vip || 0);
            setAvatarUrl(data.user.avatar || "");
            
            const updatedCache = { ...saved, ...data.user };
            localStorage.setItem('palamedes_user', JSON.stringify(updatedCache));
          }
        }
      } catch (err) { 
        console.error("Failed to load fresh backend session sync:", err); 
      }
    }
    loadData();
  }, []);

  const handleSaveUsername = async () => {
    if (!newUsername.trim()) return;
    try {
      const response = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateUsername", phone: userPhone, username: newUsername }),
      });
      if (response.ok) { 
        setUsername(newUsername); 
        setIsEditingUsername(false); 
        
        const saved = JSON.parse(localStorage.getItem('palamedes_user') || '{}');
        saved.username = newUsername;
        localStorage.setItem('palamedes_user', JSON.stringify(saved));
      }
    } catch (err) { alert("Error saving username"); }
  };

  const handleSavePassword = async () => {
    if (newPassword !== repeatPassword) return alert("New passwords do not match!");
    try {
      const response = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updatePassword", phone: userPhone, oldPassword, newPassword }),
      });
      const data = await response.json();
      if (response.ok) {
        alert("Password updated successfully!");
        setIsEditingPassword(false);
        setOldPassword(""); setNewPassword(""); setRepeatPassword("");
      } else { alert(data.message || "Failed to update"); }
    } catch (err) { alert("Error saving password"); }
  };

  const handleAvatarTap = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event) => {
    // FIXED: Safe alternative fallback configuration to handle array index items safely
    const file = event.target.files ? event.target.files[0] : null;
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      try {
        const response = await fetch("/api/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            phone: userPhone,
            avatar: base64String
          }),
        });
        if (response.ok) {
          setAvatarUrl(base64String);
          
          const saved = JSON.parse(localStorage.getItem('palamedes_user') || '{}');
          saved.avatar = base64String;
          localStorage.setItem('palamedes_user', JSON.stringify(saved));
        } else {
          alert("Failed to save selected image");
        }
      } catch (err) {
        console.error("Error uploading image:", err);
        alert("Error saving image");
      }
    };
    reader.readAsDataURL(file);
  };

  // Keep a clean empty screen during server compilation frames
  if (isCheckingCache) {
    return React.createElement("div", { className: "min-h-screen bg-transparent" });
  }

  if (!userPhone) {
    return React.createElement("div", { className: "flex items-center justify-center min-h-screen text-slate-500 text-sm" }, "Session expired");
  }

  const skyBlueBtnClass = "bg-[#00CCFF] text-black px-4 py-2 rounded text-sm";

  return React.createElement("div", { className: "max-w-4xl mx-auto p-6 relative min-h-screen text-slate-800" },
    React.createElement("div", { className: "absolute top-6 right-6 flex items-center" },
      React.createElement("div", { onClick: handleAvatarTap, style: { cursor: "pointer" } },
        React.createElement(AvatarWithBadge, {
          avatar: avatarUrl,
          vipLevel: vipLevel,
          username: username
        })
      ),
      React.createElement("input", {
        type: "file",
        ref: fileInputRef,
        onChange: handleFileChange,
        accept: "image/*",
        style: { display: "none" }
      })
    ),
    React.createElement("div", { className: "mt-24 max-w-md space-y-8" },
      React.createElement("div", { className: "flex justify-between items-center border-b pb-3" }, React.createElement("span", { className: "text-sm" }, "Phone"), React.createElement("span", { className: "text-slate-400 font-mono text-sm" }, userPhone)),
      React.createElement("div", { className: "border-b pb-3 space-y-3" },
        React.createElement("div", { className: "flex justify-between items-center" }, React.createElement("span", { className: "text-sm" }, "Username"), !isEditingUsername ? React.createElement("button", { onClick: () => setIsEditingUsername(true), className: "text-blue-500 text-sm" }, username || "Set Username") : React.createElement("span", { className: "text-xs text-slate-400" }, "Modifying...")),
        isEditingUsername && React.createElement("div", { className: "bg-slate-50 p-3 rounded border flex gap-3 items-center" }, React.createElement("input", { type: "text", value: newUsername, maxLength: 6, onChange: (e) => setNewUsername(e.target.value.slice(0,6)), className: "border p-2 rounded flex-1 text-sm" }), React.createElement("button", { onClick: handleSaveUsername, className: skyBlueBtnClass }, "Save"))
      ),
      React.createElement("div", { className: "border-b pb-3 space-y-3" },
        React.createElement("div", { className: "flex justify-between items-center" }, React.createElement("span", { className: "text-sm" }, "Modify password"), React.createElement("button", { onClick: () => setIsEditingPassword(!isEditingPassword), className: "text-blue-500 text-sm" }, "Modify Password")),
        isEditingPassword && React.createElement("div", { className: "bg-slate-50 p-4 rounded border space-y-3" },
          React.createElement("div", null, React.createElement("input", { type: "password", placeholder: "Old password", value: oldPassword, onChange: (e) => setOldPassword(e.target.value), className: "border p-2 rounded w-full text-sm" })),
          React.createElement("div", null, React.createElement("input", { type: "password", placeholder: "New password", value: newPassword, onChange: (e) => setNewPassword(e.target.value), className: "border p-2 rounded w-full text-sm" })),
          React.createElement("div", null, React.createElement("input", { type: "password", placeholder: "Repeat password", value: repeatPassword, onChange: (e) => setRepeatPassword(e.target.value), className: "border p-2 rounded w-full text-sm" })),
          React.createElement("div", { className: "flex justify-end pt-2" }, React.createElement("button", { onClick: handleSavePassword, className: skyBlueBtnClass }, "Save Password"))
        )
      ),
      React.createElement("div", { className: "pt-6 flex justify-center" }, React.createElement("button", { onClick: () => {localStorage.removeItem('palamedes_user'); window.location.href='/login'}, className: skyBlueBtnClass + " px-12" }, "Logout"))
    )
  );
}

export default function SettingsPage() {
  return (
    React.createElement(Suspense, { fallback: React.createElement("div", { className: "flex items-center justify-center min-h-screen text-sm text-slate-500" }, "Loading user session...") },
      React.createElement(SettingsContent, null)
    )
  );
}