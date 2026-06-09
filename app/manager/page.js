export default function ManagerPage() {
  const phone = "447412283536"
  const waLink = `https://wa.me/${phone}?text=Hello%20Manager`

  return (
    <button 
      onClick={() => window.open(waLink, "_blank")}
      className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#25D366] hover:bg-[#1EBE57] active:bg-[#128C7E] text-white font-semibold shadow-lg transition"
    >
      👤 Manager
    </button>
  )
}