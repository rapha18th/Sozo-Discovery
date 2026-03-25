'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useConversation } from '@elevenlabs/react';

interface Briefing {
  object_identified: string;
  location: string;
  bom_summary: string;
  bom: string[];
  firecrawl_context: string;
  logistics_risk_profile: 'high' | 'medium' | 'low';
  conversational_briefing_summary: string;
}

interface Props {
  briefing: Briefing;
  onNewAudit: () => void;
}

export default function InterrogationPanel({ briefing, onNewAudit }: Props) {
  const [sessionState, setSessionState] = useState<'idle' | 'connecting' | 'connected' | 'ended' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [messages, setMessages] = useState<{ role: 'agent' | 'user'; text: string }[]>([]);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const conversation = useConversation({
    onConnect: () => setSessionState('connected'),
    onDisconnect: () => setSessionState('ended'),
    onMessage: (message) => {
      setMessages((prev) => [
        ...prev,
        { role: message.source === 'ai' ? 'agent' : 'user', text: message.message },
      ]);
    },
    onError: (error) => {
      setSessionState('error');
      setErrorMessage(typeof error === 'string' ? error : 'Session error occurred.');
    },
  });

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  const handleStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      setSessionState('error');
      setErrorMessage('Microphone access denied.');
      return;
    }

    setSessionState('connecting');
    try {
      await conversation.startSession({
        agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || '',
        // @ts-ignore
        connectionType: 'websocket',
        dynamicVariables: {
          object_identified: briefing.object_identified,
          location: briefing.location,
          bom_summary: briefing.bom_summary,
          logistics_risk_profile: briefing.logistics_risk_profile,
          conversational_briefing_summary: briefing.conversational_briefing_summary,
          firecrawl_context: briefing.firecrawl_context,
        },
      });
    } catch (err: any) {
      setSessionState('error');
      setErrorMessage(err.message || 'Failed to start session.');
    }
  };

  const handleEnd = async () => {
    await conversation.endSession();
  };

  const getStatusText = () => {
    switch (sessionState) {
      case 'idle': return '— AGENT STANDING BY';
      case 'connecting': return '● CONNECTING...';
      case 'connected': return conversation.isSpeaking ? '▶ AGENT SPEAKING' : '◉ LISTENING';
      case 'ended': return '■ SESSION COMPLETE';
      case 'error': return `✕ ${errorMessage}`;
      default: return '';
    }
  };

  const getStatusColor = () => {
    switch (sessionState) {
      case 'idle': return '#2a2a2a';
      case 'connecting': return '#e8ff00';
      case 'connected': return conversation.isSpeaking ? '#e8ff00' : '#f0f0f0';
      case 'ended': return '#5a5a5a';
      case 'error': return '#ff3b3b';
      default: return '#5a5a5a';
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      border: '1px solid #1c1c1c',
      backgroundColor: '#0a0a0a',
      padding: '24px',
      gap: '24px',
      boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', color: '#fff', margin: 0, textTransform: 'uppercase' }}>
          Forensic Interrogation
        </h3>
        <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#5a5a5a', margin: 0, lineHeight: '1.5' }}>
          Your agent has been loaded with the full briefing. Begin the conversational audit.
        </p>
      </div>

      {sessionState !== 'ended' && (
        <button
          onClick={sessionState === 'connected' ? handleEnd : handleStart}
          disabled={sessionState === 'connecting'}
          style={{
            width: '100%',
            height: '56px',
            backgroundColor: sessionState === 'connected' ? '#ff3b3b' : (sessionState === 'connecting' ? '#1c1c1c' : '#e8ff00'),
            color: sessionState === 'connected' ? '#fff' : (sessionState === 'connecting' ? '#3a3a3a' : '#000'),
            fontFamily: 'Syne, sans-serif',
            fontSize: '15px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            border: 'none',
            cursor: sessionState === 'connecting' ? 'default' : 'pointer',
            transition: 'background-color 120ms ease'
          }}
        >
          {sessionState === 'connected' ? 'End Session' : (sessionState === 'connecting' ? 'Connecting...' : 'Start Interrogation')}
        </button>
      )}

      <div style={{
        fontFamily: 'DM Mono, monospace',
        fontSize: '11px',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: getStatusColor(),
        animation: sessionState === 'connecting' ? 'pulse 1s infinite' : 'none'
      }}>
        {getStatusText()}
      </div>

      <div 
        ref={transcriptRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minHeight: '200px',
          maxHeight: '320px',
          paddingRight: '4px'
        }}
      >
        {messages.length === 0 ? (
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#2a2a2a' }}>
            — AWAITING TRANSMISSION
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ 
                fontFamily: 'DM Mono, monospace', 
                fontSize: '11px', 
                color: msg.role === 'agent' ? '#e8ff00' : '#5a5a5a',
                flexShrink: 0
              }}>
                [{msg.role === 'agent' ? 'DISCOVERY' : 'YOU'}]
              </span>
              <span style={{ 
                fontFamily: 'DM Mono, monospace', 
                fontSize: '12px', 
                color: '#f0f0f0', 
                lineHeight: '1.7' 
              }}>
                {msg.text}
              </span>
            </div>
          ))
        )}
      </div>

      <button
        onClick={onNewAudit}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: 'transparent',
          border: '1px solid #1c1c1c',
          color: '#5a5a5a',
          fontFamily: 'DM Mono, monospace',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          cursor: 'pointer',
          transition: 'all 120ms ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.color = '#f0f0f0';
          e.currentTarget.style.borderColor = '#3a3a3a';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.color = '#5a5a5a';
          e.currentTarget.style.borderColor = '#1c1c1c';
        }}
      >
        New Audit
      </button>

      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        div::-webkit-scrollbar {
          width: 2px;
        }
        div::-webkit-scrollbar-track {
          background: #000;
        }
        div::-webkit-scrollbar-thumb {
          background: #1c1c1c;
        }
      `}</style>
    </div>
  );
}
