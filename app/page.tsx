"use client";
import { useState, useEffect } from 'react';
import { Plane, Sparkles, Dice5, Globe, Music, MapPin, Loader2, Copy, Calendar, CalendarRange, BedDouble } from 'lucide-react';
import { CapacitorHttp } from '@capacitor/core'; // <--- IMPORT NOU

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Inițializez agentul...");
  const [mode, setMode] = useState('exact');
  const [userCurrency, setUserCurrency] = useState('EUR'); 

  const [tipData, setTipData] = useState('exact');
  const [dataValue, setDataValue] = useState('');
  const [flexibil, setFlexibil] = useState(false);

  const [origine, setOrigine] = useState('București');
  const [destinatie, setDestinatie] = useState('');
  const [vibe, setVibe] = useState('Exotic');
  const [buget, setBuget] = useState('');
  const [nrNopti, setNrNopti] = useState('');

  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Mesaje loading
  const messages = [
    "🤖 AI-ul scanează harta lumii...",
    "✈️ Verific companiile aeriene...",
    "🏨 Caut cazare în buget...",
    "🧮 Calculez totalul vacanței...",
    "✨ Generez oferta finală..."
  ];

  useEffect(() => {
    const userLang = navigator.language || "en-US";
    if (userLang.includes('ro')) setUserCurrency('RON');
    else if (userLang.includes('US')) setUserCurrency('USD');
    else if (userLang.includes('GB')) setUserCurrency('GBP');
    else setUserCurrency('EUR');
  }, []);

  useEffect(() => {
    let interval: any;
    if (loading) {
      let i = 0;
      setLoadingMsg(messages[0]);
      interval = setInterval(() => {
        i = (i + 1) % messages.length;
        setLoadingMsg(messages[i]);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleSearch = async () => {
    if(!dataValue) return alert("Alege data!");
    setLoading(true);
    setResult(null);

    try {
      // --- SOLUȚIA NUCLEARĂ: CapacitorHttp ---
      // Aceasta trece de securitatea browserului și merge direct la server
      const options = {
        url: 'https://travel-tiktok-ai.vercel.app/api/cauta',
        headers: { 'Content-Type': 'application/json' },
        data: { // La CapacitorHttp folosim 'data', nu 'body', și trimitem Obiect, nu String!
          tipCautare: mode,
          origine,
          destinatie: mode === 'exact' ? destinatie : '',
          vibe: (mode === 'vibe' || mode === 'global') ? vibe : '',
          buget,
          dataInput: dataValue,
          tipData, flexibil, nrNopti,
          monedaPreferred: userCurrency
        },
      };

      const response = await CapacitorHttp.post(options);
      
      // Capacitor pune răspunsul direct în .data
      const dataRes = response.data;

      if(dataRes.status === 'success') setResult(dataRes);
      else alert(dataRes.message || "Fără rezultate (Serverul a răspuns, dar fără oferte).");

    } catch(e: any) { 
        console.error("Eroare Capacitor:", e);
        // Afișăm eroarea completă ca să știm ce se întâmplă
        alert("Eroare conexiune: " + (e.message || JSON.stringify(e))); 
    }
    finally { setLoading(false); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSkyscannerLink = () => {
    if (!result?.oferta?.aeroport_sosire || !result?.oferta?.data) return "#";
    const o = result.oferta.aeroport_plecare || "OTP"; 
    const d = result.oferta.aeroport_sosire.toLowerCase();
    const d1 = result.oferta.data.slice(2).replace(/-/g, '');
    if(result.oferta.data_intors) {
      const d2 = result.oferta.data_intors.slice(2).replace(/-/g, '');
      return `https://www.skyscanner.ro/transport/zboruri/${o}/${d}/${d1}/${d2}`;
    }
    return `https://www.skyscanner.ro/transport/zboruri/${o}/${d}/${d1}`;
  };

  const getBookingLink = (numeHotel: string) => {
    const query = `${numeHotel} ${result.oferta.destinatie}`;
    return `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(query)}`;
  };

  return (
      <main className="min-h-screen bg-black text-white font-sans selection:bg-pink-500 pb-20">
        <div className="p-8 text-center bg-gradient-to-b from-purple-900/20 to-black">
          <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 drop-shadow-lg">
            TRAVEL TOK <span className="text-white text-xl not-italic font-normal">PRO</span>
          </h1>
          <p className="text-gray-500 text-xs mt-1">Găsește. Filmează. Călătorește.</p>
        </div>

        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-2 bg-gray-900 p-1 rounded-xl">
              <button onClick={() => setMode('exact')} className={`p-2 rounded-lg font-bold text-[10px] md:text-xs flex flex-col items-center gap-1 transition-all ${mode === 'exact' ? 'bg-gray-700 text-white shadow-lg' : 'text-gray-500'}`}><Plane size={16}/> EXACT</button>
              <button onClick={() => setMode('vibe')} className={`p-2 rounded-lg font-bold text-[10px] md:text-xs flex flex-col items-center gap-1 transition-all ${mode === 'vibe' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}><Sparkles size={16}/> VIBE</button>
              <button onClick={() => setMode('roulette')} className={`p-2 rounded-lg font-bold text-[10px] md:text-xs flex flex-col items-center gap-1 transition-all ${mode === 'roulette' ? 'bg-pink-600 text-white shadow-lg' : 'text-gray-500'}`}><Dice5 size={16}/> RULETĂ</button>
              <button onClick={() => setMode('global')} className={`p-2 rounded-lg font-bold text-[10px] md:text-xs flex flex-col items-center gap-1 transition-all ${mode === 'global' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-500'}`}><Globe size={16}/> GLOBAL</button>
            </div>

            <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl space-y-4 shadow-xl">
              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-1">PLECARE (Oraș)</label>
                <input value={origine} onChange={e=>setOrigine(e.target.value)} placeholder="Ex: București, Iași, Cluj" className="w-full bg-black border border-gray-700 p-3 rounded-lg text-center font-bold focus:border-pink-500 outline-none transition-colors" />
              </div>

              <div className="bg-black border border-gray-800 p-3 rounded-xl">
                <div className="flex gap-3 mb-3 border-b border-gray-800 pb-2">
                  <button onClick={() => { setTipData('exact'); setDataValue(''); }} className={`flex items-center gap-2 text-xs font-bold pb-1 transition-colors ${tipData === 'exact' ? 'text-white border-b-2 border-pink-500' : 'text-gray-500'}`}><Calendar size={14}/> Fixă</button>
                  <button onClick={() => { setTipData('luna'); setDataValue(''); }} className={`flex items-center gap-2 text-xs font-bold pb-1 transition-colors ${tipData === 'luna' ? 'text-white border-b-2 border-pink-500' : 'text-gray-500'}`}><CalendarRange size={14}/> Lună</button>
                </div>
                {tipData === 'exact' ? (
                    <div className="space-y-2">
                      <input type="date" value={dataValue} onChange={e=>setDataValue(e.target.value)} className="w-full bg-gray-900 border border-gray-700 p-2 rounded-lg text-white outline-none focus:border-pink-500 [color-scheme:dark]"/>
                      <label className="flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={flexibil} onChange={e=>setFlexibil(e.target.checked)} className="accent-pink-500 w-3 h-3"/> +/- 3 zile</label>
                    </div>
                ) : (
                    <input type="month" value={dataValue} onChange={e=>setDataValue(e.target.value)} className="w-full bg-gray-900 border border-gray-700 p-2 rounded-lg text-white outline-none focus:border-pink-500 [color-scheme:dark]"/>
                )}
              </div>

              {mode === 'exact' && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">DESTINAȚIE</label>
                    <input value={destinatie} onChange={e=>setDestinatie(e.target.value)} placeholder="Ex: Lisabona" className="w-full bg-black border border-gray-700 p-3 rounded-lg focus:border-pink-500 outline-none"/>
                  </div>
              )}

              {(mode === 'vibe' || mode === 'global') && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">VIBE</label>
                    <select value={vibe} onChange={e=>setVibe(e.target.value)} className="w-full bg-black border border-gray-700 p-3 rounded-lg focus:border-pink-500 outline-none">
                      <option>Exotic & Beach 🏝️</option>
                      <option>Party & Nightlife 🍸</option>
                      <option>City Break 🏛️</option>
                      <option>Relax & Spa 🧖‍♀️</option>
                      <option>Adventure 🏔️</option>
                    </select>
                  </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-green-500 block mb-1">BUGET ({userCurrency})</label>
                  <input type="number" value={buget} onChange={e=>setBuget(e.target.value)} placeholder={userCurrency} className="w-full bg-black border border-green-900 p-3 rounded-lg focus:border-green-500 outline-none"/>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-blue-400 block mb-1">NOPȚI</label>
                  <input type="number" value={nrNopti} onChange={e=>setNrNopti(e.target.value)} placeholder="0 = Doar zbor" className="w-full bg-black border border-blue-900 p-3 rounded-lg focus:border-blue-500 outline-none"/>
                </div>
              </div>

              <button onClick={handleSearch} disabled={loading} className={`w-full py-4 rounded-xl font-black text-lg hover:scale-[1.02] active:scale-95 transition-all flex justify-center items-center gap-2 shadow-xl ${mode === 'global' ? 'bg-green-600 shadow-green-900/40' : 'bg-white text-black shadow-white/20'}`}>
                {loading ? <><Loader2 className="animate-spin"/> {loadingMsg}</> : "GĂSEȘTE OFERTA"}
              </button>
            </div>
            
            <div className="w-full h-[50px] bg-gray-800 rounded-lg flex items-center justify-center text-gray-600 text-xs border border-gray-700 border-dashed">
               (Space for AdMob Banner)
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex justify-center">
              <div className="relative w-[300px] h-[600px] bg-black border-[8px] border-gray-800 rounded-[3rem] shadow-2xl overflow-hidden ring-4 ring-gray-900/50">
                {result ? (
                    <div className="h-full flex flex-col justify-between p-4 bg-gray-900 relative animate-fade-in-up">
                      <div className="absolute inset-0 bg-gray-800 z-0 flex items-center justify-center opacity-20"><span className="-rotate-12 text-2xl font-black">VIDEO</span></div>
                      
                      <div className="relative z-10 pt-6 text-center">
                         <h2 className="text-lg font-black text-white leading-relaxed drop-shadow-md break-words px-3">{result.content.hook_vizual}</h2>
                      </div>

                      <div className="relative z-10 flex-1 flex items-center justify-center">
                        <div className="bg-white/10 backdrop-blur-md p-5 rounded-xl border border-white/20 w-full shadow-2xl">
                          <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/10">
                            <span className="text-sm flex items-center gap-2 text-gray-300"><Plane size={14}/> Zbor</span>
                            <span className="font-bold text-white">{result.oferta.pret} {result.oferta.moneda}</span>
                          </div>
                          {result.oferta.pret_hotel_num > 0 && (
                            <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/10">
                              <span className="text-sm flex items-center gap-2 text-gray-300"><BedDouble size={14}/> Hotel ({result.oferta.nr_nopti} n)</span>
                              <span className="font-bold text-white">{result.oferta.pret_hotel_num} {result.oferta.moneda}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-1">
                            <span className="text-sm font-black text-yellow-400">TOTAL</span>
                            <span className="text-2xl font-black text-yellow-400">
                                {result.oferta.total_vacanta} {result.oferta.moneda}
                            </span>
                          </div>
                          <p className="text-[10px] text-center text-gray-400 mt-3 italic">Prețuri estimate. Verifică disponibilitatea.</p>
                        </div>
                      </div>

                      <div className="relative z-10 pb-4 space-y-2">
                        <div className="flex items-center gap-2 text-white/80 text-xs bg-black/40 p-2 rounded-lg"><Music size={12}/> <span className="truncate">{result.content.sunet}</span></div>
                        <p className="text-white text-xs font-semibold opacity-90 line-clamp-3 leading-snug">{result.content.descriere}</p>
                      </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600">
                      {loading ? <Loader2 size={40} className="mb-4 text-pink-500 animate-spin"/> : <Globe size={40} className="mb-4 opacity-30"/>}
                      <p className="text-sm px-8 text-center">{loading ? loadingMsg : "Aștept următoarea destinație..."}</p>
                    </div>
                )}
              </div>
            </div>

            {result && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 animate-slide-in-right shadow-2xl space-y-4">
                  <h3 className="text-purple-400 font-bold flex gap-2 items-center text-sm"><MapPin size={16}/> Detalii & Link-uri</h3>
                  
                  <a href={getSkyscannerLink()} target="_blank" className="flex justify-between items-center bg-gray-800 hover:bg-gray-700 p-3 rounded-lg transition-colors border border-gray-700 group">
                    <span className="text-sm font-bold text-white flex items-center gap-2"><Plane size={14} className="text-blue-400"/> Vezi Zborul</span>
                    <span className="text-green-400 text-sm font-mono group-hover:underline">{result.oferta.pret} {result.oferta.moneda} &rarr;</span>
                  </a>

                  {result.content.hotel_nume && result.content.hotel_nume !== "Caută pe Booking" && (
                    <a href={getBookingLink(result.content.hotel_nume)} target="_blank" className="flex justify-between items-center bg-gray-800 hover:bg-gray-700 p-3 rounded-lg transition-colors border border-gray-700 group">
                        <span className="text-sm font-bold text-white flex items-center gap-2"><BedDouble size={14} className="text-blue-600"/> {result.content.hotel_nume}</span>
                        <span className="text-blue-300 text-sm font-mono group-hover:underline">Rezervă &rarr;</span>
                    </a>
                  )}

                   <div className="mt-2 p-3 bg-black/40 rounded border-l-2 border-pink-500">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Script Voiceover</span>
                        <button onClick={() => copyToClipboard(result.content.script_audio)} className="text-gray-400 hover:text-white"><Copy size={12}/></button>
                    </div>
                    <p className="text-gray-300 italic text-xs leading-relaxed">"{result.content.script_audio}"</p>
                  </div>
                </div>
            )}
          </div>
        </div>
      </main>
  );
}