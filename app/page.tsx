'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, X, Mic, Play, Square, User, Bot } from 'lucide-react';
import { useConversation } from '@elevenlabs/react';
import { GoogleGenAI } from '@google/genai';

// --- Types ---
interface BOMItem {
  name: string;
  sourcing_location: string;
  expected_price: string;
}

interface BriefingData {
  object_identified: string;
  bom_summary: string;
  bom: BOMItem[];
  firecrawl_context: string;
  logistics_risk_profile: 'high' | 'medium' | 'low';
  voice_briefing_summary: string;
  location: string;
}

// --- Constants ---
const INITIAL_STATUS_LINES: string[] = [
  'INITIALISING FORENSIC SCAN...',
  'IMAGE RECEIVED — DECODING ASSET...',
  'GEMINI MATERIAL ANALYSIS: RUNNING',
  'BILL OF MATERIALS: EXTRACTING...',
  'FIRECRAWL SEARCH: QUERY 1 OF 3...',
  'FIRECRAWL SEARCH: QUERY 2 OF 3...',
  'FIRECRAWL SEARCH: QUERY 3 OF 3...',
  'LOGISTICS RISK PROFILE: COMPUTING...',
  'SITUATIONAL BRIEFING: COMPILING...',
  'AGENT READY.',
];

// --- Components ---

const BOMItemCard = ({ item }: { item: BOMItem }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-[#0f0f0f] border border-[#1c1c1c] px-3 py-1.5 font-mono text-[10px] sm:text-[11px] text-[#f0f0f0] uppercase tracking-wider hover:border-[#e8ff00] transition-colors cursor-pointer text-left"
      >
        {item.name}
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/80 z-[60] backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] max-w-[280px] bg-[#0a0a0a] border border-[#1c1c1c] p-5 z-[70] shadow-[0_0_50px_rgba(232,255,0,0.1)] space-y-4"
            >
              <div className="flex justify-between items-start">
                <h4 className="font-syne text-base text-white uppercase leading-tight pr-4">{item.name}</h4>
                <button onClick={() => setIsOpen(false)} className="text-[#5a5a5a] hover:text-white shrink-0">
                  <X size={16} />
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="font-mono text-[9px] text-[#5a5a5a] uppercase tracking-widest">Sourcing Hub</span>
                  <p className="font-mono text-[11px] text-[#e8ff00] uppercase leading-tight">{item.sourcing_location}</p>
                </div>
                <div className="space-y-1">
                  <span className="font-mono text-[9px] text-[#5a5a5a] uppercase tracking-widest">Est. Unit Price</span>
                  <p className="font-mono text-[11px] text-white uppercase">{item.expected_price}</p>
                </div>
              </div>

              <button 
                onClick={() => setIsOpen(false)}
                className="w-full py-2 bg-[#1c1c1c] font-mono text-[9px] text-[#f0f0f0] uppercase tracking-widest hover:bg-[#e8ff00] hover:text-black transition-all"
              >
                Close Data
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const TypewriterLine = ({ text, active, complete }: { text: string; active: boolean; complete: boolean }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    if (active || complete) {
      let i = 0;
      const interval = setInterval(() => {
        setDisplayedText(text.slice(0, i));
        i++;
        if (i > text.length) clearInterval(interval);
      }, 15);
      return () => clearInterval(interval);
    }
  }, [active, complete, text]);

  return (
    <div className={`flex items-center gap-2 font-mono text-xs uppercase tracking-widest mb-2 transition-colors duration-200 ${
      complete ? 'text-[#e8ff00]' : active ? 'text-[#e8ff00] animate-pulse' : 'text-[#2a2a2a]'
    }`}>
      <span>{'>'}</span>
      <span>{displayedText}</span>
    </div>
  );
};

export default function SozoDiscovery() {
  const [appState, setAppState] = useState<'IDLE' | 'PROCESSING' | 'BRIEFING'>('IDLE');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const [transcript, setTranscript] = useState<{ role: 'agent' | 'user'; text: string }[]>([]);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const conversation = useConversation({
    onConnect: () => console.log('Connected to ElevenLabs'),
    onDisconnect: () => console.log('Disconnected from ElevenLabs'),
    onMessage: (message) => {
      setTranscript(prev => [...prev, { 
        role: message.source === 'ai' ? 'agent' : 'user', 
        text: message.message 
      }]);
    },
    onError: (error) => console.error('ElevenLabs Error:', error),
  });

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startAudit = async () => {
    if (!image) return;
    setAppState('PROCESSING');
    setActiveLineIndex(0);

    // Simulation of status lines
    const progressionInterval = setInterval(() => {
      setActiveLineIndex(prev => {
        if (prev < INITIAL_STATUS_LINES.length - 1) return prev + 1;
        clearInterval(progressionInterval);
        return prev;
      });
    }, 800);

    try {
      // Initialize Gemini
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });
      
      // Convert image to base64
      const base64Data = imagePreview?.split(',')[1] || '';
      
      const prompt = `
You are the Sozo Forensic Material Engineer.
Given an image and a location, identify the object and its 
industrial material dependencies.

Rules:
- BOM: list raw elements, specialised components, and chemical 
  requirements. Be specific — not "metal" but "carbon steel" 
  or "6061 aluminium alloy".
- For EACH BOM item, identify the most likely sourcing location (e.g. "Shenzhen, CN", "Antwerp, BE") 
  and an expected unit price in USD based on current market intelligence.
- Generate exactly 3 Firecrawl search queries targeting spot prices, 
  export duties, or port congestion for the identified materials 
  relative to the given location. Make them high-intent and specific.
- Flag any material under active geopolitical, environmental, 
  or supply chain stress.
- voice_briefing_summary: exactly 2 sentences. Lead with the risk. 
  Be direct. No hedging.

Return ONLY valid JSON. No markdown. No preamble. No backticks.

{
  "object_identified": "string",
  "bom": [
    { "name": "material1", "sourcing_location": "location", "expected_price": "$xx.xx" },
    { "name": "material2", "sourcing_location": "location", "expected_price": "$xx.xx" }
  ],
  "firecrawl_queries": ["query1", "query2", "query3"],
  "logistics_risk_profile": "high | medium | low",
  "voice_briefing_summary": "string"
}
`;

      const result = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: image.type,
                  data: base64Data,
                },
              },
              { text: `Location: ${location || 'Global'}` },
            ],
          },
        ],
      });

      const text = result.text;
      if (!text) throw new Error('EMPTY_GEMINI_RESPONSE');
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const geminiData = JSON.parse(jsonMatch ? jsonMatch[0] : text);

      // Step 2: Firecrawl Search via API
      const searchRes = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          queries: geminiData.bom.map((b: any) => b.name),
          location: location || 'Global'
        }),
      });
      const searchData = await searchRes.json();

      setBriefing({
        object_identified: geminiData.object_identified,
        bom_summary: geminiData.bom.map((b: any) => b.name).join(', '),
        bom: searchData.bom_details || geminiData.bom,
        firecrawl_context: searchData.firecrawl_context || 'Live intelligence unavailable.',
        logistics_risk_profile: geminiData.logistics_risk_profile,
        voice_briefing_summary: geminiData.voice_briefing_summary,
        location: location || 'Global',
      });

      // Wait for simulation to finish
      setTimeout(() => {
        setAppState('BRIEFING');
      }, 1500);

    } catch (error) {
      console.error('Audit failed:', error);
      setAppState('IDLE');
      alert('AUDIT SYSTEM FAILURE. RESTARTING...');
    }
  };

  const startInterrogation = async () => {
    if (!briefing) return;
    try {
      await conversation.startSession({
        agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || '',
        // @ts-ignore - ElevenLabs SDK type mismatch in some versions, but connectionType is often needed
        connectionType: 'websocket',
        dynamicVariables: {
          object_identified: briefing.object_identified,
          location: briefing.location,
          bom_summary: briefing.bom_summary,
          logistics_risk_profile: briefing.logistics_risk_profile,
          voice_briefing_summary: briefing.voice_briefing_summary,
          firecrawl_context: briefing.firecrawl_context,
        },
      });
    } catch (error) {
      console.error('Failed to start conversation:', error);
    }
  };

  const resetAudit = () => {
    setAppState('IDLE');
    setImage(null);
    setImagePreview(null);
    setLocation('');
    setBriefing(null);
    setActiveLineIndex(-1);
    setTranscript([]);
    conversation.endSession();
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-black">
      {/* Fixed UI Elements */}
      <div className="fixed top-4 left-4 sm:top-8 sm:left-8 flex items-baseline gap-2 z-30">
        <h1 className="font-syne text-lg sm:text-xl font-bold tracking-tight text-white">SOZO</h1>
        <span className="font-mono text-[9px] sm:text-[11px] text-[#5a5a5a] tracking-widest-xl uppercase">Discovery</span>
      </div>

      <div className="fixed bottom-4 left-4 sm:bottom-8 sm:left-8 font-mono text-[8px] sm:text-[10px] text-[#2a2a2a] tracking-widest uppercase z-30 pointer-events-none">
        SOZO ANALYTICS LAB · ELEVENHACKS S01 · FIRECRAWL x ELEVENLABS
      </div>

      <AnimatePresence mode="wait">
        {appState === 'IDLE' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-[520px] space-y-8 px-4 sm:px-0"
          >
            <div className="space-y-2">
              <h2 className="font-syne text-[24px] sm:text-[28px] text-white leading-tight uppercase">Material Audit System</h2>
              <p className="font-mono text-[12px] sm:text-[13px] text-[#5a5a5a] leading-relaxed">
                Upload an image of any physical object.<br className="hidden sm:block" />
                Receive a live supply chain intelligence briefing.
              </p>
            </div>

            <div className="h-px bg-[#1c1c1c] w-full" />

            <div className="space-y-4">
              <label className="block group cursor-pointer">
                <div className={`relative border border-dashed transition-colors duration-200 flex flex-col items-center justify-center overflow-hidden rounded-none ${
                  imagePreview ? 'border-[#1c1c1c]' : 'border-[#2a2a2a] hover:border-[#e8ff00] h-[200px] sm:h-[240px]'
                }`}>
                  {imagePreview ? (
                    <div className="relative w-full h-[200px] sm:h-[240px]">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        onClick={(e) => { e.preventDefault(); setImage(null); setImagePreview(null); }}
                        className="absolute top-2 right-2 bg-black/50 p-1 hover:text-[#e8ff00]"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Camera className="text-[#2a2a2a] group-hover:text-[#e8ff00] mb-4" size={32} />
                      <span className="font-mono text-[10px] sm:text-[11px] text-[#2a2a2a] group-hover:text-[#e8ff00] tracking-widest uppercase text-center px-4">
                        Drop asset here or click to upload
                      </span>
                    </>
                  )}
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>

              <input
                type="text"
                placeholder="OPERATIONAL LOCATION (city, country)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-black border border-[#1c1c1c] p-[12px] sm:p-[14px] font-mono text-[12px] sm:text-[13px] text-white placeholder:text-[#2a2a2a] focus:outline-none focus:border-[#e8ff00] transition-colors rounded-none"
              />

              <button
                onClick={startAudit}
                disabled={!image}
                className={`w-full h-[48px] sm:h-[52px] font-mono text-[11px] sm:text-[12px] font-medium tracking-widest uppercase transition-colors duration-200 rounded-none ${
                  image 
                    ? 'bg-[#e8ff00] text-black hover:bg-white' 
                    : 'bg-[#1c1c1c] text-[#3a3a3a] cursor-not-allowed'
                }`}
              >
                Start Audit
              </button>
            </div>
          </motion.div>
        )}

        {appState === 'PROCESSING' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-[520px] px-6"
          >
            {INITIAL_STATUS_LINES.map((line, i) => (
              <TypewriterLine 
                key={i} 
                text={line} 
                active={i === activeLineIndex} 
                complete={i < activeLineIndex} 
              />
            ))}
          </motion.div>
        )}

        {appState === 'BRIEFING' && briefing && (
          <motion.div
            key="briefing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 lg:gap-12 px-4 sm:px-8 py-20 lg:py-0 overflow-y-auto lg:overflow-visible h-full lg:h-auto"
          >
            {/* Left Column: Intelligence Panel */}
            <div className="space-y-8 lg:space-y-10">
              <section className="space-y-3">
                <h3 className="font-mono text-[10px] sm:text-[11px] text-[#5a5a5a] tracking-widest uppercase">Asset Identified</h3>
                <p className="font-syne text-xl sm:text-2xl text-white uppercase">{briefing.object_identified}</p>
              </section>

              <section className="space-y-3">
                <h3 className="font-mono text-[10px] sm:text-[11px] text-[#5a5a5a] tracking-widest uppercase">Bill of Materials</h3>
                <div className="flex flex-wrap gap-2">
                  {briefing.bom.map((item, i) => (
                    <BOMItemCard key={i} item={item} />
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="font-mono text-[10px] sm:text-[11px] text-[#5a5a5a] tracking-widest uppercase">Logistics Risk Profile</h3>
                <div className={`inline-block px-4 py-1.5 font-mono text-[10px] sm:text-[11px] font-medium uppercase tracking-widest ${
                  briefing.logistics_risk_profile === 'high' ? 'bg-[#ff3b3b] text-black' :
                  briefing.logistics_risk_profile === 'medium' ? 'bg-[#e8ff00] text-black' :
                  'bg-[#1c1c1c] text-[#f0f0f0]'
                }`}>
                  {briefing.logistics_risk_profile} Risk
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="font-mono text-[10px] sm:text-[11px] text-[#5a5a5a] tracking-widest uppercase">Firecrawl Intelligence</h3>
                <div className="border-l-2 border-[#e8ff00] pl-4 py-1">
                  <p className="font-mono text-[11px] sm:text-[12px] text-[#5a5a5a] leading-relaxed italic">
                    {briefing.firecrawl_context}
                  </p>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="font-mono text-[10px] sm:text-[11px] text-[#5a5a5a] tracking-widest uppercase">Voice Briefing Lead</h3>
                <p className="font-syne text-[14px] sm:text-[15px] text-[#f0f0f0] italic leading-relaxed">
                  &quot;{briefing.voice_briefing_summary}&quot;
                </p>
              </section>
            </div>

            {/* Right Column: Interrogation Panel */}
            <div className="flex flex-col h-full border border-[#1c1c1c] bg-[#0a0a0a] p-5 sm:p-6 space-y-6">
              <div className="space-y-2">
                <h3 className="font-syne text-base text-white uppercase">Forensic Interrogation</h3>
                <p className="font-mono text-[10px] sm:text-[11px] text-[#5a5a5a] leading-relaxed">
                  Your agent has been loaded with the full briefing. Begin the voice audit.
                </p>
              </div>

              <button
                onClick={conversation.status === 'connected' ? () => conversation.endSession() : startInterrogation}
                className={`w-full h-12 sm:h-14 font-syne text-[14px] sm:text-[15px] font-bold uppercase transition-colors duration-200 rounded-none ${
                  conversation.status === 'connected' 
                    ? 'bg-[#ff3b3b] text-white hover:bg-[#ff5555]' 
                    : 'bg-[#e8ff00] text-black hover:bg-white'
                }`}
              >
                {conversation.status === 'connected' ? 'End Session' : 'Start Interrogation'}
              </button>

              <div className="font-mono text-[10px] sm:text-[11px] tracking-widest uppercase">
                {conversation.status === 'disconnected' && <span className="text-[#2a2a2a]">— Agent Standing By</span>}
                {conversation.status === 'connecting' && <span className="text-[#e8ff00] animate-pulse">● Connecting...</span>}
                {conversation.status === 'connected' && (
                  conversation.isSpeaking 
                    ? <span className="text-[#e8ff00]">▶ Agent Speaking</span> 
                    : <span className="text-[#f0f0f0]">◉ Listening</span>
                )}
              </div>

              <div 
                ref={transcriptRef}
                className="flex-1 overflow-y-auto space-y-3 min-h-[180px] max-h-[300px] scrollbar-hide"
              >
                {transcript.map((msg, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className={`font-mono text-[10px] sm:text-[11px] shrink-0 ${msg.role === 'agent' ? 'text-[#e8ff00]' : 'text-[#5a5a5a]'}`}>
                      [{msg.role === 'agent' ? 'SOZO' : 'YOU'}]
                    </span>
                    <span className="font-mono text-[11px] sm:text-[12px] text-[#f0f0f0] leading-tight">
                      {msg.text}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={resetAudit}
                className="w-full py-3 border border-[#1c1c1c] font-mono text-[10px] sm:text-[11px] text-[#5a5a5a] hover:text-[#f0f0f0] hover:border-[#5a5a5a] transition-all uppercase tracking-widest rounded-none"
              >
                New Audit
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
