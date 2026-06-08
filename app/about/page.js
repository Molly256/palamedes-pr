export default function AboutPage() {
  return (
    <main className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-12 text-gray-600 font-light leading-relaxed">
        
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#00BFFF] mb-4">Book PR & Author Marketing by the UK’s Oldest and Most Trusted Book PR Agency</h1>
          <p className="mb-4">At Palamedes PR, we don’t just promote stories—we help shape them.</p>
          <p className="mb-4">Through our in-house NAPA news agency, Belters News, and as the exclusive editorial partner of The European magazine, we provide authors with direct access to influential media platforms that other UK book PR agencies simply cannot match.</p>
          <p className="mb-4">This unique media reach allows us to secure guaranteed national press, TV, and radio coverage faster and more effectively than any other book marketing firm in the UK.</p>
          <p className="mb-4">We work with both represented and independent authors of fiction and non-fiction, as well as small presses, major publishing houses, and literary agents. Since 2009, our award-winning team has delivered exceptional book publicity and marketing campaigns every working day of the year—placing books in the UK’s top media outlets and securing prime-time broadcast appearances.</p>
          <p className="mb-4">Most campaigns deliver widespread coverage within just 14 days. Unlike other book PR firms, we offer a peace-of-mind guarantee with measurable, published results.</p>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-bold text-[#00BFFF] mb-4">Palamedes PR – Leading UK Book PR & Consumer Marketing Agency</h2>
          <p>Palamedes is one of the most trusted UK public relations agencies, specialising in book PR, author marketing, and high-impact consumer campaigns. From our London base, we create multi-award-winning editorial and broadcast content for national and international media across business, lifestyle, and general news sectors. Through our in-house NAPA news agency, Belters News, and sister talent management agency, The Double Agents, we offer clients unrivalled media access and influencer engagement. Since 2009, we’ve delivered headline-grabbing book and product launches that get the nation talking.</p>
        </div>

        <div className="mb-8">
          <p className="font-semibold text-gray-800">PALAMEDES PR LTD</p>
          <p>07170018 - Incorporated on 25 February 2010</p>
          <p>Norfolk House, 22-24 Market Place, Swaffham, England, PE37 7QH</p>
        </div>

        {/* Certificate Image */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-[#00BFFF] mb-4">Certification</h3>
          <img 
            src="/certificate.jpg" 
            alt="Palamedes PR Certificate" 
            className="w-full h-auto border-gray-200 rounded-lg shadow-md"
          />
        </div>

        <div className="text-sm">
          <p className="mb-2">Privacy policy           Cookie policy</p>
          <p className="mb-4">Website Terms of Use</p>
          <p className="italic mb-4">"The Palamedes guys are bursting with brilliant ideas that translate well in the national press. This makes working with the PPR team a genuine pleasure for journalists" Daily Express</p>
          <p className="text-xs">All content copyright Palamedes®, a registered trademark, 2009-2026. All rights reserved.</p>
          <p className="text-xs">A Belters Group Company</p>
        </div>

      </div>
    </main>
  )
}