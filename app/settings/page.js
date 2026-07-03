"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SettingsContent() {
  const searchParams = useSearchParams();
  const userPhone = searchParams.get("phone") || ""; 

  const [username, setUsername] = useState("");
  const [vipColor, setVipColor] = useState("#64748B");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  useEffect(() => {
    async function loadData() {
      if (!userPhone) return;
      try {
        const response = await fetch(`/api/user?phone=${encodeURIComponent(userPhone)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            setUsername(data.user.username || "");
            setNewUsername(data.user.username || "");
            setVipColor(data.user.vipColor || "#64748B");
            setAvatarUrl(data.user.avatarUrl || "");
          }
        }
      } catch (err) { console.error("Failed to load:", err); }
    }
    loadData();
  }, [userPhone]);

  const handleSaveUsername = async () => {
    if (!newUsername.trim()) return;
    try {
      const response = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateUsername", phone: userPhone, username: newUsername }),
      });
      if (response.ok) { setUsername(newUsername); setIsEditingUsername(false); }
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

  if (!userPhone) {
    return React.createElement("div", { className: "flex items-center justify-center min-h-screen text-slate-500 text-sm" }, "Loading user session...");
  }

  const skyBlueBtnClass = "bg-[#00CCFF] text-black px-4 py-2 rounded text-sm";

  return React.createElement("div", { className: "max-w-4xl mx-auto p-6 relative min-h-screen text-slate-800" },
    React.createElement("div", { className: "absolute top-6 right-6 flex items-center" },
      React.createElement("div", { className: "relative w-16 h-16 rounded-full bg-slate-200 border overflow-hidden" },
        React.createElement("img", { src: avatarUrl || "https://unsplash.com", className: "w-full h-full object-cover" }),
        React.createElement("div", { className: "absolute bottom-0 right-0 w-5 h-5 rounded-full border border-white flex items-center justify-center shadow", style: { backgroundColor: vipColor } }, React.createElement("span", { className: "text-[10px] text-white" }, "★"))
      )
    ),
    React.createElement("div", { className: "mt-24 max-w-md space-y-8" },
      React.createElement("div", { className: "flex justify-between items-center border-b pb-3" }, React.createElement("span", { className: "text-sm" }, "Phone"), React.createElement("span", { className: "text-slate-400 font-mono text-sm" }, userPhone)),
      React.createElement("div", { className: "border-b pb-3 space-y-3" },
        React.createElement("div", { className: "flex justify-between items-center" }, React.createElement("span", { className: "text-sm" }, "Username"), !isEditingUsername ? React.createElement("button", { onClick: () => setIsEditingUsername(true), className: "text-blue-500 text-sm" }, username || "Set Username") : React.createElement("span", { className: "text-xs text-slate-400" }, "Modifying...")),
        isEditingUsername && React.createElement("div", { className: "bg-slate-50 p-3 rounded border flex gap-3 items-center" }, React.createElement("input", { type: "text", value: newUsername, onChange: (e) => setNewUsername(e.target.value), className: "border p-2 rounded flex-1 text-sm" }), React.createElement("button", { onClick: handleSaveUsername, className: skyBlueBtnClass }, "Save"))
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
      React.createElement("div", { className: "pt-6 flex justify-center" }, React.createElement("button", { onClick: () => alert("Logging out..."), className: skyBlueBtnClass + " px-12" }, "Logout"))
    )
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-sm text-slate-500">Loading user session...</div>}>
      <SettingsContent />
    </Suspense>
  );
}