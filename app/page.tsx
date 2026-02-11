"use client";
import { useState, useEffect } from 'react';
import { Plane, Sparkles, Dice5, Globe, Music, MapPin, Loader2, Copy, Calendar, CalendarRange, Wallet, Moon, ExternalLink, CheckCircle } from 'lucide-react';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Inițializez agentul...");
  const [mode, setMode] = useState('exact');

  const [tipData, setTipData] = useState('exact');
  const [dataValue, setDataValue] = useState('');
  const [flexibil, setFlexibil] = useState(false);

  const [origine, setOrigine] = useState('OTP');
  const [destinatie, setDestinatie] = useState('');
  const [vibe, setVibe] = useState('Exotic');
  const [buget, setBuget] = useState('');
  const [nrNopti, setNrNopti] = useState('');

  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Mesaje loading
  const messages = [
    "🤖 AI-ul scanează harta lumii...",
    "✈️ Verific 300+ companii aeriene...",
    "📉 Negociez prețul biletelor...",
    "🏨 Caut un hotel 'hidden gem'...",
    "✍️ Scriu scenariul viral pentru TikTok...",
    "✨ Aproape gata! Pregătește pașaportul..."
  ];

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
      const res = await fetch('https://travel-tiktok-ai.vercel.app/api/cauta', {
        method: 'POST',
        body: JSON.stringify({
          tipCautare: mode,
          origine,
          destinatie: mode === 'exact' ? destinatie : '',
          vibe: (mode === 'vibe' || mode === 'global') ? vibe : '',
          buget,
          dataInput: dataValue,
          tipData, flexibil, nrNopti
        }),
      });
      const dataRes = await res.json();
      if(dataRes.status === 'success') setResult(dataRes);
      else alert(dataRes.message || "Fără rezultate.");
    } catch(e) { alert("Eroare conexiune."); }
    finally { setLoading(false); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSkyscannerLink = () => {
    if (!result?.oferta?.aeroport_sosire || !result?.oferta?.data) return "#";
    const o = (origine || "OTP").toLowerCase();
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
      <main className="min-h-screen bg-black text-white font-sans selection:bg-pink-500">
        <div className="p-8 text-center bg-gradient-to-b from-purple-900/20 to-black">
          <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 drop-shadow-lg animate-fade-in-down">
            TRAVEL TOK <span className="text-white text-2xl not-italic font-normal">PRO</span>
          </h1>
          <p className="text-gray-400 mt-2">Toate modurile. Toată lumea. Cel mai bun preț.</p>
        </div>

        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* --- CONTROL PANEL --- */}
          <div className="space-y-8">
            <div className="grid grid-cols-4 gap-2 bg-gray-900 p-1 rounded-xl">
              <button onClick={() => setMode('exact')} className={`p-2 rounded-lg font-bold text-[10px] md:text-xs flex flex-col items-center gap-1 transition-all ${mode === 'exact' ? 'bg-gray-700 text-white scale-105 shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}><Plane size={18}/> EXACT</button>
              <button onClick={() => setMode('vibe')} className={`p-2 rounded-lg font-bold text-[10px] md:text-xs flex flex-col items-center gap-1 transition-all ${mode === 'vibe' ? 'bg-blue-600 text-white scale-105 shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}><Sparkles size={18}/> VIBE</button>
              <button onClick={() => setMode('roulette')} className={`p-2 rounded-lg font-bold text-[10px] md:text-xs flex flex-col items-center gap-1 transition-all ${mode === 'roulette' ? 'bg-pink-600 text-white scale-105 shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}><Dice5 size={18}/> RULETĂ</button>
              <button onClick={() => setMode('global')} className={`p-2 rounded-lg font-bold text-[10px] md:text-xs flex flex-col items-center gap-1 transition-all ${mode === 'global' ? 'bg-green-600 text-white scale-105 shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}><Globe size={18}/> GLOBAL</button>
            </div>

            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl space-y-6 shadow-2xl relative">
              {/* 1. PLECARE */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">PLECARE (IATA)</label>
                <input value={origine} onChange={e=>setOrigine(e.target.value.toUpperCase())} className="w-full bg-black border border-gray-700 p-3 rounded-lg text-center font-mono focus:border-pink-500 outline-none transition-colors" maxLength={3}/>
              </div>

              {/* 2. DATA - AICI AM REPARAT CULOAREA CALENDARULUI */}
              <div className="bg-black border border-gray-800 p-4 rounded-xl">
                <div className="flex gap-4 mb-4 border-b border-gray-800 pb-2">
                  <button onClick={() => { setTipData('exact'); setDataValue(''); }} className={`flex items-center gap-2 text-sm font-bold pb-2 transition-colors ${tipData === 'exact' ? 'text-white border-b-2 border-pink-500' : 'text-gray-500 hover:text-gray-300'}`}><Calendar size={16}/> Fixă</button>
                  <button onClick={() => { setTipData('luna'); setDataValue(''); }} className={`flex items-center gap-2 text-sm font-bold pb-2 transition-colors ${tipData === 'luna' ? 'text-white border-b-2 border-pink-500' : 'text-gray-500 hover:text-gray-300'}`}><CalendarRange size={16}/> Lună</button>
                </div>
                {tipData === 'exact' ? (
                    <div className="space-y-3">
                      <input
                          type="date"
                          value={dataValue}
                          onChange={e=>setDataValue(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 p-3 rounded-lg text-white outline-none focus:border-pink-500 [color-scheme:dark] cursor-pointer"
                      />
                      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer hover:text-white transition-colors"><input type="checkbox" checked={flexibil} onChange={e=>setFlexibil(e.target.checked)} className="accent-pink-500 w-4 h-4"/> +/- 3 zile (Flexibil)</label>
                    </div>
                ) : (
                    <input
                        type="month"
                        value={dataValue}
                        onChange={e=>setDataValue(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 p-3 rounded-lg text-white outline-none focus:border-pink-500 [color-scheme:dark] cursor-pointer"
                    />
                )}
              </div>

              {/* 3. INPUTS DINAMICE */}
              {mode === 'exact' && (
                  <div className="animate-fade-in-up">
                    <label className="text-xs font-bold text-gray-500 block mb-1">DESTINAȚIE</label>
                    <input value={destinatie} onChange={e=>setDestinatie(e.target.value)} placeholder="Ex: Lisabona" className="w-full bg-black border border-gray-700 p-3 rounded-lg focus:border-pink-500 outline-none"/>
                  </div>
              )}

              {(mode === 'vibe' || mode === 'global') && (
                  <div className="animate-fade-in-up">
                    <label className="text-xs font-bold text-gray-500 block mb-1">VIBE / MOOD</label>
                    <select value={vibe} onChange={e=>setVibe(e.target.value)} className="w-full bg-black border border-gray-700 p-3 rounded-lg focus:border-pink-500 outline-none">
                      <option>Exotic & Beach 🏝️</option>
                      <option>Party & Nightlife 🍸</option>
                      <option>Relax & Spa 🧖‍♀️</option>
                      <option>Adventure 🏔️</option>
                      <option>City Break 🏛️</option>
                    </select>
                  </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-green-500 block mb-1 flex items-center gap-1"><Wallet size={12}/> BUGET (Opțional)</label>
                  <div className="relative">
                    <input type="number" value={buget} onChange={e=>setBuget(e.target.value)} placeholder="€" className="w-full bg-black border border-green-900 p-3 rounded-lg pr-6 focus:border-green-500 outline-none"/>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-blue-400 block mb-1 flex items-center gap-1"><Moon size={12}/> NOPȚI (Pt. Pachet)</label>
                  <input type="number" value={nrNopti} onChange={e=>setNrNopti(e.target.value)} placeholder="Doar zbor" className="w-full bg-black border border-blue-900 p-3 rounded-lg focus:border-blue-500 outline-none"/>
                </div>
              </div>

              <button
                  onClick={handleSearch}
                  disabled={loading}
                  className={`w-full py-4 rounded-xl font-black text-lg hover:scale-[1.02] active:scale-95 transition-all flex justify-center items-center gap-2 shadow-xl ${mode === 'global' ? 'bg-green-600 text-white shadow-green-900/50' : 'bg-white text-black shadow-white/20'}`}
              >
                {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="animate-spin" /> {loadingMsg}
                    </div>
                ) : (
                    mode === 'global' ? "CAUTĂ ÎN LUME 🌍" : "GĂSEȘTE OFERTA"
                )}
              </button>
            </div>
          </div>

          {/* --- PREVIEW & RESULT --- */}
          <div className="flex flex-col gap-6">
            <div className="flex justify-center">
              <div className="relative w-[300px] h-[600px] bg-black border-[8px] border-gray-800 rounded-[3rem] shadow-2xl overflow-hidden ring-4 ring-gray-900/50">
                {result ? (
                    <div className="h-full flex flex-col justify-between p-4 bg-gray-900 relative animate-fade-in-up">
                      <div className="absolute inset-0 bg-gray-800 z-0 flex items-center justify-center opacity-20"><span className="-rotate-12 text-2xl font-black">VIDEO</span></div>
                      <div className="relative z-10 pt-8 text-center"><span className="bg-red-600 text-white text-[10px] px-2 py-1 rounded font-bold shadow-lg animate-pulse">LIVE DEAL</span></div>
                      <div className="relative z-10 flex-1 flex items-center justify-center">
                        <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 text-center rotate-1 shadow-2xl">
                          <h2 className="text-xl font-black text-white drop-shadow-md leading-tight">{result.content.hook_vizual}</h2>
                          <p className="text-yellow-400 font-bold text-2xl mt-2 drop-shadow-sm">{result.oferta.pret}€ ✈️</p>
                          {result.oferta.nr_nopti > 0 && <p className="text-xs text-gray-200 mt-1 bg-black/40 px-2 py-1 rounded">+ Hotel Inclus</p>}
                        </div>
                      </div>
                      <div className="relative z-10 pb-4 space-y-2">
                        <div className="flex items-center gap-2 text-white/80 text-xs"><Music size={12}/> <span className="truncate w-32">{result.content.sunet}</span></div>
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
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-slide-in-right shadow-2xl">
                  <h3 className="text-purple-400 font-bold flex gap-2 mb-4 items-center"><MapPin/> Detalii Călătorie</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between border-b border-gray-800 pb-2">
                      <span className="text-gray-400">Destinație:</span>
                      <span><b>{result.oferta.destinatie}</b> <span className="text-gray-500">({result.oferta.aeroport_sosire})</span></span>
                    </div>
                    <div className="flex justify-between border-b border-gray-800 pb-2">
                      <span className="text-gray-400">Perioada:</span>
                      <span className="text-right"><b>{result.oferta.data}</b> {result.oferta.data_intors && <><br/><span className="text-xs text-gray-500">până la {result.oferta.data_intors}</span></>}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-800 pb-2">
                      <span className="text-gray-400">Preț Zbor:</span>
                      <b className="text-green-400 text-lg">{result.oferta.pret} EUR</b>
                    </div>

                    {/* HOTEL SECTION */}
                    <div className="pt-2">
                      {result.content.hotel_math ? (
                          <div className="bg-black/30 p-3 rounded-lg border border-blue-900/30">
                            <p className="flex items-center justify-between mb-1">
                              <span className="text-gray-400 flex items-center gap-1"><Moon size={12}/> Hotel Rec:</span>
                              <a href={getBookingLink(result.content.hotel_math.nume)} target="_blank" className="text-blue-400 font-bold hover:underline flex items-center gap-1 text-right">
                                {result.content.hotel_math.nume} <ExternalLink size={12}/>
                              </a>
                            </p>
                            <p className="flex justify-between text-xs">
                              <span className="text-gray-500">Estimat ({result.oferta.nr_nopti} nopți):</span>
                              <b className="text-blue-300">{result.content.hotel_math.pret_total}</b>
                            </p>
                          </div>
                      ) : (
                          result.content.hotel_nume && (
                              <p className="flex items-center justify-between">
                                <span className="text-gray-400 flex items-center gap-1"><Moon size={12}/> Hotel:</span>
                                <a href={getBookingLink(result.content.hotel_nume)} target="_blank" className="text-blue-400 font-bold hover:underline flex items-center gap-1">
                                  {result.content.hotel_nume} <ExternalLink size={12}/>
                                </a>
                              </p>
                          )
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-xs text-gray-500">Script Voiceover:</p>
                      <button onClick={() => copyToClipboard(result.content.script_audio)} className="text-xs flex items-center gap-1 text-gray-400 hover:text-white transition-colors">
                        {copied ? <CheckCircle size={12} className="text-green-500"/> : <Copy size={12}/>}
                        {copied ? "Copiat!" : "Copiază"}
                      </button>
                    </div>
                    <p className="text-gray-300 italic text-sm bg-black/50 p-3 rounded border-l-2 border-pink-500 leading-relaxed">"{result.content.script_audio}"</p>
                  </div>

                  <a href={getSkyscannerLink()} target="_blank" className="block text-center mt-6 bg-pink-600 hover:bg-pink-500 py-3 rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-pink-900/50 transform hover:-translate-y-1">
                    Rezervă Zbor (Skyscanner) ✈️
                  </a>
                </div>
            )}
          </div>
        </div>
      </main>
  );
}