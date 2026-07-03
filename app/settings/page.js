"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// Inner component that handles the search parameters safely
function SettingsContent() {
  const searchParams = useSearchParams();
  
  // Dynamically reads the active user's phone number from the URL context (e.g., ?phone=+1234567)
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

  // Load backend profile data on component load using the dynamic phone number
  useEffect(() => {
    async function loadData() {
      if (!userPhone) return;
      try {
        const response = await fetch(`/api/user-settings?phone=${encodeURIComponent(userPhone)}`);
        if (response.ok) {
          const data = await response.json();
          setUsername(data.username);
          setNewUsername(data.username);
          setVipColor(data.vipColor);
          setAvatarUrl(data.avatarUrl);
        }
      } catch (err) {
        console.error("Failed to load user settings:", err);
      }
    }
    loadData();
  }, [userPhone]);

  const handleSaveUsername = async () => {
    if (!newUsername.trim()) return;

    try {
      const response = await fetch("/api/user-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateUsername",
          phone: userPhone,
          username: newUsername,
        }),
      });

      if (response.ok) {
        setUsername(newUsername);
        setIsEditingUsername(false);
      } else {
        alert("Failed to update username");
      }
    } catch (err) {
      alert("Error saving username");
    }
  };

  const handleSavePassword = async () => {
    if (newPassword !== repeatPassword) {
      alert("New passwords do not match!");
      return;
    }

    try {
      const response = await fetch("/api/user-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updatePassword",
          phone: userPhone,
          oldPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Password updated successfully!");
        setIsEditingPassword(false);
        setOldPassword("");
        setNewPassword("");
        setRepeatPassword("");
      } else {
        alert(data.error || "Failed to update password");
      }
    } catch (err) {
      alert("Error saving password");
    }
  };

  const handleLogout = () => {
    alert("Logging out...");
  };

  const skyBlueBtnClass = "bg-[#00CCFF] hover:bg-[#00B3E6] text-black font-light px-4 py-2 rounded transition-colors shadow-sm text-sm";

  // Render loading screen if the dynamic phone number hasn't loaded into context yet
  if (!userPhone) {
    return React.createElement(
      "div",
      { className: "flex items-center justify-center min-h-screen text-slate-500 text-sm" },
      "Loading user session..."
    );
  }

  return React.createElement(
    "div",
    { className: "max-w-4xl mx-auto p-6 relative min-h-screen text-slate-800" },
    
    // Top Right Layout Anchor: Avatar and VIP Badge Display
    React.createElement(
      "div",
      { className: "absolute top-6 right-6 flex items-center" },
      React.createElement(
        "div",
        { className: "relative w-16 h-16 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden" },
        React.createElement("img", {
          src: avatarUrl || "https://unsplash.com",
          alt: "User Avatar",
          className: "w-full h-full object-cover"
        }),
        React.createElement(
          "div",
          {
            className: "absolute bottom-0 right-0 w-5 h-5 rounded-full border border-white flex items-center justify-center shadow-md",
            style: { backgroundColor: vipColor },
            title: "VIP Badge"
          },
          React.createElement("span", { className: "text-[10px] text-white" }, "★")
        )
      )
    ),

    // Primary Left/Below Content Grid
    React.createElement(
      "div",
      { className: "mt-24 max-w-md space-y-8" },
      
      // Row 1: Locked Phone Number Interface
      React.createElement(
        "div",
        { className: "flex justify-between items-center border-b pb-3" },
        React.createElement("span", { className: "font-medium text-slate-600 text-sm" }, "Phone"),
        React.createElement("span", { className: "text-slate-400 font-mono tracking-wider text-sm" }, userPhone)
      ),

      // Row 2: Pop-down Username Modification Box
      React.createElement(
        "div",
        { className: "border-b pb-3 space-y-3" },
        React.createElement(
          "div",
          { className: "flex justify-between items-center" },
          React.createElement("span", { className: "font-medium text-slate-600 text-sm" }, "Username"),
          !isEditingUsername
            ? React.createElement(
                "button",
                {
                  onClick: function() { setIsEditingUsername(true); },
                  className: "text-blue-500 hover:underline text-sm font-normal"
                },
                username || "Set Username"
              )
            : React.createElement("span", { className: "text-xs text-slate-400" }, "Modifying Username...")
        ),
        isEditingUsername && React.createElement(
          "div",
          { className: "bg-slate-50 p-3 rounded border flex gap-3 items-center" },
          React.createElement("input", {
            type: "text",
            value: newUsername,
            onChange: function(e) { setNewUsername(e.target.value); },
            className: "border p-2 rounded flex-1 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[#00CCFF]",
            placeholder: "Modify username"
          }),
          React.createElement(
            "button",
            { onClick: handleSaveUsername, className: skyBlueBtnClass },
            "Save"
          )
        )
      ),

      // Row 3: Secure 3-Input Password Box Array
      React.createElement(
        "div",
        { className: "border-b pb-3 space-y-3" },
        React.createElement(
          "div",
          { className: "flex justify-between items-center" },
          React.createElement("span", { className: "font-medium text-slate-600 text-sm" }, "Modify password"),
          React.createElement(
            "button",
            {
              onClick: function() { setIsEditingPassword(!isEditingPassword); },
              className: "text-blue-500 hover:underline text-sm font-normal"
            },
            "Modify Password"
          )
        ),
        isEditingPassword && React.createElement(
          "div",
          { className: "bg-slate-50 p-4 rounded border space-y-3" },
          React.createElement(
            "div",
            null,
            React.createElement("label", { className: "block text-xs text-slate-500 mb-1" }, "Input old password"),
            React.createElement("input", {
              type: "password",
              value: oldPassword,
              onChange: function(e) { setOldPassword(e.target.value); },
              className: "border p-2 rounded w-full bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[#00CCFF]"
            })
          ),
          React.createElement(
            "div",
            null,
            React.createElement("label", { className: "block text-xs text-slate-500 mb-1" }, "Input new password"),
            React.createElement("input", {
              type: "password",
              value: newPassword,
              onChange: function(e) { setNewPassword(e.target.value); },
              className: "border p-2 rounded w-full bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[#00CCFF]"
            })
          ),
          React.createElement(
            "div",
            null,
            React.createElement("label", { className: "block text-xs text-slate-500 mb-1" }, "Repeat new password"),
            React.createElement("input", {
              type: "password",
              value: repeatPassword,
              onChange: function(e) { setRepeatPassword(e.target.value); },
              className: "border p-2 rounded w-full bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[#00CCFF]"
            })
          ),
          React.createElement(
            "div",
            { className: "flex justify-end pt-2" },
            React.createElement(
              "button",
              { onClick: handleSavePassword, className: skyBlueBtnClass },
              "Save Password"
            )
          )
        )
      ),

      // Exact Centered Layout Placement: Logout Action
      React.createElement(
        "div",
        { className: "pt-6 flex justify-center" },
        React.createElement(
          "button",
          { onClick: handleLogout, className: skyBlueBtnClass + " px-12 py-2.5 text-base" },
          "Logout"
        )
      )
    )
  );
}

// Main page export wrapped in a Suspense boundary to fix the build error
export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen text-slate-500 text-sm">
        Loading user session...
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}