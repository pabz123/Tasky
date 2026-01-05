
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type, Modality, LiveServerMessage } from '@google/genai';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

import { 
    Artifact, 
    Session, 
    Task, 
    Achievement, 
    DailyLog, 
    AppNotification,
    UserProfile,
    HealthData
} from './types';
import { INITIAL_PLACEHOLDERS } from './constants';
import { generateId } from './utils';

import DottedGlowBackground from './components/DottedGlowBackground';
import ArtifactCard from './components/ArtifactCard';
import { 
    ThinkingIcon, 
    SparklesIcon, 
    ArrowUpIcon, 
    GridIcon 
} from './components/Icons';

// --- Helper Functions for Audio Processing ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// --- Icons & UI Components ---
const PulseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
);
const TrophyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
);
const LogIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
);
const BellIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
);
const MicIcon = ({ active }: { active?: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
);
const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
);
const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);
const HealthIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
);

function App() {
  const [viewMode, setViewMode] = useState<'generator' | 'dashboard' | 'health' | 'settings'>('generator');
  const [sessions, setSessions] = useState<Session[]>(() => {
      const saved = localStorage.getItem('tasky_sessions');
      return saved ? JSON.parse(saved) : [];
  });
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(-1);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  
  // Notification Management
  const [activeToasts, setActiveToasts] = useState<AppNotification[]>([]);
  const [notifHistory, setNotifHistory] = useState<AppNotification[]>([]);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);

  // User & Health Data
  const [profile, setProfile] = useState<UserProfile>(() => {
      const saved = localStorage.getItem('tasky_profile');
      return saved ? JSON.parse(saved) : { name: 'User', stepGoal: 10000, sleepGoal: 8, waterGoal: 2500, theme: 'light' };
  });

  const [healthData, setHealthData] = useState<HealthData>(() => {
      const saved = localStorage.getItem('tasky_health');
      return saved ? JSON.parse(saved) : { steps: 4320, heartRate: 72, sleepHours: 6.5, waterIntake: 1200, timestamp: Date.now() };
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
      const saved = localStorage.getItem('tasky_tasks');
      return saved ? JSON.parse(saved) : [
          { id: '1', text: 'Morning Routine & Coffee', completed: false, priority: 'medium', estimatedTime: '30m', dueDate: 'Today' },
          { id: '2', text: 'Daily Goals Setup', completed: true, priority: 'high', estimatedTime: '15m', dueDate: 'Today' }
      ];
  });

  const [achievements, setAchievements] = useState<Achievement[]>([
      { id: 'a1', title: 'Planner Pro', description: 'Used AI to optimize your first full day', timestamp: Date.now() - 86400000 }
  ]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [newLogContent, setNewLogContent] = useState('');

  // Persistence
  useEffect(() => localStorage.setItem('tasky_sessions', JSON.stringify(sessions)), [sessions]);
  useEffect(() => localStorage.setItem('tasky_profile', JSON.stringify(profile)), [profile]);
  useEffect(() => localStorage.setItem('tasky_health', JSON.stringify(healthData)), [healthData]);
  useEffect(() => localStorage.setItem('tasky_tasks', JSON.stringify(tasks)), [tasks]);

  // Voice State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      const interval = setInterval(() => setPlaceholderIndex(prev => (prev + 1) % INITIAL_PLACEHOLDERS.length), 5000);
      return () => clearInterval(interval);
  }, []);

  const addNotification = useCallback((message: string, type: AppNotification['type'] = 'success') => {
      const notif: AppNotification = { id: generateId(), message, type, timestamp: Date.now() };
      setActiveToasts(prev => [...prev, notif]);
      setNotifHistory(prev => [notif, ...prev]);
      setTimeout(() => setActiveToasts(prev => prev.filter(t => t.id !== notif.id)), 5000);
  }, []);

  const addTask = useCallback((text: string, priority: 'low'|'medium'|'high' = 'medium', estimatedTime?: string, dueDate?: string) => {
    const newTask: Task = { id: generateId(), text, completed: false, priority, estimatedTime, dueDate: dueDate || 'Today' };
    setTasks(prev => [newTask, ...prev]);
    addNotification(`Task Added: ${text}`, 'success');
  }, [addNotification]);

  const updateHealth = useCallback((updates: Partial<HealthData>) => {
    setHealthData(prev => ({ ...prev, ...updates, timestamp: Date.now() }));
    addNotification("Health stats synchronized.", "success");
  }, [addNotification]);

  const handleSendMessage = useCallback(async (manualPrompt?: string) => {
    const promptToUse = manualPrompt || inputValue;
    const trimmedInput = promptToUse.trim();
    if (!trimmedInput || isLoading) return;
    
    if (!manualPrompt) setInputValue('');
    setIsLoading(true);
    setViewMode('generator');

    const sessionId = generateId();
    const placeholderArtifacts: Artifact[] = Array(3).fill(null).map((_, i) => ({
        id: `${sessionId}_${i}`,
        styleName: 'Architecting...',
        tasks: [],
        summary: '',
        status: 'streaming',
    }));

    const newSession: Session = { 
        id: sessionId, 
        prompt: trimmedInput, 
        timestamp: Date.now(), 
        artifacts: placeholderArtifacts 
    };

    setSessions(prev => {
        const updated = [...prev, newSession];
        setCurrentSessionIndex(updated.length - 1);
        return updated;
    });

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const generatePlan = async (index: number, planType: string) => {
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: [{ role: 'user', parts: [{ text: `User: ${profile.name}. Goal: "${trimmedInput}". Mode: ${planType}.` }] }],
                config: {
                    systemInstruction: `You are Tasky, an AI Architect. Turn the user goal into a high-efficiency JSON daily planner. Return ONLY valid JSON with 'summary' and 'tasks' array. Include 'dueDate' and 'priority' for tasks.`,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            summary: { type: Type.STRING },
                            tasks: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        text: { type: Type.STRING },
                                        priority: { type: Type.STRING },
                                        estimatedTime: { type: Type.STRING },
                                        dueDate: { type: Type.STRING }
                                    },
                                    required: ["text", "priority", "estimatedTime", "dueDate"]
                                }
                            }
                        }
                    }
                }
            });

            try {
                const data = JSON.parse(response.text);
                setSessions(prev => prev.map(sess => sess.id === sessionId ? {
                    ...sess,
                    artifacts: sess.artifacts.map((art, i) => i === index ? {
                        ...art,
                        styleName: planType,
                        tasks: data.tasks.map((t: any) => ({ ...t, id: generateId(), completed: false })),
                        summary: data.summary,
                        status: 'complete'
                    } : art)
                } : sess));
            } catch (e) {
                console.error("Parse Error", e);
            }
        };

        const planTypes = ["Balanced Harmony", "Peak Focus Sprint", "Gentle Progress"];
        await Promise.all(planTypes.map((type, i) => generatePlan(i, type)));
        addNotification("New plans architected.", "success");
    } catch (e) {
        addNotification("AI Service unavailable.", "overdue");
    } finally {
        setIsLoading(false);
    }
  }, [inputValue, isLoading, addNotification, profile.name]);

  // Voice Interaction
  const toggleLiveSession = async () => {
    if (isLiveActive) {
      if (liveSessionRef.current) liveSessionRef.current.close();
      setIsLiveActive(false);
      return;
    }

    setIsLiveActive(true);
    addNotification("Voice Architect activated...", "success");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      if (!outputAudioContextRef.current) outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `You are Tasky. User is ${profile.name}. You can add tasks or update health stats. Be sophisticated.`,
          tools: [{ 
            functionDeclarations: [
              { name: 'addTask', parameters: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, priority: { type: Type.STRING } }, required: ['text'] } },
              { name: 'updateHealth', parameters: { type: Type.OBJECT, properties: { steps: { type: Type.NUMBER }, waterIntake: { type: Type.NUMBER } } } }
            ] 
          }]
        },
        callbacks: {
          onopen: () => {
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(inputData) }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (m: LiveServerMessage) => {
            if (m.toolCall) {
              for (const fc of m.toolCall.functionCalls) {
                if (fc.name === 'addTask') addTask(fc.args.text as string);
                else if (fc.name === 'updateHealth') updateHealth(fc.args as any);
                sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { ok: true } } }));
              }
            }
            const audio = m.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audio) {
              const ctx = outputAudioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buf = await decodeAudioData(decode(audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buf;
              source.connect(ctx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buf.duration;
            }
          },
          onclose: () => setIsLiveActive(false)
        }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (err) {
      setIsLiveActive(false);
    }
  };

  const syncSchedule = (artifact: Artifact) => {
      setTasks(prev => [...artifact.tasks.map(t => ({ ...t, id: generateId() })), ...prev]);
      addNotification(`Synced plan to monitor.`, 'achievement');
      setViewMode('dashboard');
  };

  return (
    <div className={`theme-${profile.theme}`} id="theme-wrapper">
        <header className="top-nav">
            <div className="nav-logo">
                <PulseIcon /> <span>Tasky<b>.</b></span>
            </div>
            
            <div className="nav-tabs">
                <button className={`nav-tab ${viewMode === 'generator' ? 'active' : ''}`} onClick={() => setViewMode('generator')}>
                    <SparklesIcon /> <span>Plan</span>
                </button>
                <button className={`nav-tab ${viewMode === 'dashboard' ? 'active' : ''}`} onClick={() => setViewMode('dashboard')}>
                    <GridIcon /> <span>Focus</span>
                </button>
                <button className={`nav-tab ${viewMode === 'health' ? 'active' : ''}`} onClick={() => setViewMode('health')}>
                    <HealthIcon /> <span>Health</span>
                </button>
                <button className={`nav-tab ${viewMode === 'settings' ? 'active' : ''}`} onClick={() => setViewMode('settings')}>
                    <SettingsIcon /> <span>Set</span>
                </button>
            </div>

            <div className="nav-actions">
                <div className={`live-status-pill ${isLiveActive ? 'active' : ''}`} onClick={toggleLiveSession}>
                    <MicIcon active={isLiveActive} />
                </div>
            </div>
        </header>

        <main className="immersive-app">
            <DottedGlowBackground gap={32} radius={2} color="rgba(14, 165, 233, 0.05)" glowColor="rgba(212, 175, 55, 0.3)" speedScale={0.3} />

            {viewMode === 'generator' ? (
                <div className="stage-container">
                    <div className={`empty-state ${sessions.length > 0 || isLoading ? 'fade-out' : ''}`}>
                        <h1>Hi, {profile.name}.</h1>
                        <p>Architect your perfect day. Type below and hit <b>Enter</b>.</p>
                    </div>

                    {currentSessionIndex !== -1 && sessions[currentSessionIndex] && (
                        <div className="artifact-grid">
                            {sessions[currentSessionIndex].artifacts.map((art) => (
                                <ArtifactCard key={art.id} artifact={art} onSync={syncSchedule} />
                            ))}
                        </div>
                    )}
                </div>
            ) : viewMode === 'dashboard' ? (
                <div className="pulse-dashboard-container">
                    <div className="pulse-grid">
                        <section className="pulse-card">
                            <div className="card-header"><h4>Daily Focus</h4> <PulseIcon /></div>
                            <div className="card-body">
                                {tasks.length === 0 && <p className="empty-tasks">Monitor empty. Sync a plan!</p>}
                                {tasks.map(t => (
                                    <div key={t.id} className={`task-item ${t.completed ? 'done' : ''}`}>
                                        <button className="checkbox" onClick={() => {
                                            const next = !t.completed;
                                            setTasks(prev => prev.map(pt => pt.id === t.id ? { ...pt, completed: next } : pt));
                                            if (next) addNotification(`Completed: ${t.text}`, 'success');
                                        }}>{t.completed ? '✓' : ''}</button>
                                        <div className="task-content">
                                            <span className="task-text">{t.text}</span>
                                            <div className="task-meta">
                                              {t.dueDate && <span className="task-deadline"><CalendarIcon /> {t.dueDate}</span>}
                                              {t.estimatedTime && <span className="task-estimate">• {t.estimatedTime}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                        <section className="pulse-card">
                            <div className="card-header"><h4>Archive</h4> <LogIcon /></div>
                            <div className="card-body">
                                <div className="log-input-area">
                                    <textarea placeholder="Journal a win..." value={newLogContent} onChange={e => setNewLogContent(e.target.value)} />
                                    <button className="save-log-btn" onClick={() => {
                                        if (!newLogContent.trim()) return;
                                        setDailyLogs(prev => [{ id: generateId(), content: newLogContent, timestamp: Date.now() }, ...prev]);
                                        setNewLogContent('');
                                        addNotification("Note archived.", "success");
                                    }}>Save Entry</button>
                                </div>
                                <div className="history-list">
                                    {dailyLogs.map(l => (
                                        <div key={l.id} className="notif-item">
                                            <small className="notif-time">{new Date(l.timestamp).toLocaleDateString()}</small>
                                            <p>{l.content}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            ) : viewMode === 'health' ? (
                <div className="pulse-dashboard-container">
                    <div className="health-monitor-grid">
                        <div className="health-card steps">
                            <div className="health-icon-wrap"><PulseIcon /></div>
                            <div className="health-info">
                                <h3>{healthData.steps}</h3>
                                <p>Steps Today</p>
                                <div className="health-progress-bg">
                                    <div className="health-progress-bar" style={{ width: `${Math.min(100, (healthData.steps / profile.stepGoal) * 100)}%` }}></div>
                                </div>
                                <small>Goal: {profile.stepGoal}</small>
                            </div>
                        </div>
                        <div className="health-card heart">
                            <div className="health-icon-wrap active"><PulseIcon /></div>
                            <div className="health-info">
                                <h3>{healthData.heartRate} <span>BPM</span></h3>
                                <p>Live Pulse</p>
                                <div className="pulse-visualizer">
                                    <span></span><span></span><span></span><span></span><span></span>
                                </div>
                            </div>
                        </div>
                        <div className="health-card water">
                            <div className="health-icon-wrap"><HealthIcon /></div>
                            <div className="health-info">
                                <h3>{healthData.waterIntake} <span>ml</span></h3>
                                <p>Hydration</p>
                                <div className="water-levels">
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                        <div key={i} className={`water-drop ${healthData.waterIntake >= i * 300 ? 'filled' : ''}`} onClick={() => updateHealth({ waterIntake: i * 300 })}></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="health-card sleep">
                            <div className="health-icon-wrap"><TrophyIcon /></div>
                            <div className="health-info">
                                <h3>{healthData.sleepHours} <span>hrs</span></h3>
                                <p>Last Night's Sleep</p>
                                <small>Goal: {profile.sleepGoal} hrs</small>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="pulse-dashboard-container">
                    <div className="pulse-card settings-card">
                        <div className="card-header"><h4>User Profile</h4> <SettingsIcon /></div>
                        <div className="card-body">
                            <div className="settings-group">
                                <label>Your Name</label>
                                <input type="text" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} />
                            </div>
                            <div className="settings-group">
                                <label>Interface Theme</label>
                                <div className="theme-selector">
                                    <button className={profile.theme === 'light' ? 'active' : ''} onClick={() => setProfile({...profile, theme: 'light'})}>Light</button>
                                    <button className={profile.theme === 'dark' ? 'active' : ''} onClick={() => setProfile({...profile, theme: 'dark'})}>Dark</button>
                                    <button className={profile.theme === 'glass' ? 'active' : ''} onClick={() => setProfile({...profile, theme: 'glass'})}>Glass</button>
                                </div>
                            </div>
                            <div className="settings-group">
                                <label>Daily Step Goal</label>
                                <input type="number" value={profile.stepGoal} onChange={e => setProfile({...profile, stepGoal: parseInt(e.target.value)})} />
                            </div>
                            <div className="settings-group">
                                <label>Sleep Goal (Hours)</label>
                                <input type="number" value={profile.sleepGoal} onChange={e => setProfile({...profile, sleepGoal: parseFloat(e.target.value)})} />
                            </div>
                            <div className="settings-group">
                                <label>Daily Hydration Goal (ml)</label>
                                <input type="number" value={profile.waterGoal} onChange={e => setProfile({...profile, waterGoal: parseInt(e.target.value)})} />
                            </div>
                        </div>
                    </div>
                    <div className="pulse-card history-card" style={{ marginTop: '24px' }}>
                        <div className="card-header"><h4>Plan History</h4> <LogIcon /></div>
                        <div className="card-body">
                            {sessions.length === 0 && <p>No previous plans archived.</p>}
                            <div className="history-list">
                                {sessions.slice().reverse().map((s, idx) => (
                                    <div key={s.id} className="history-item" onClick={() => {
                                        setCurrentSessionIndex(sessions.length - 1 - idx);
                                        setViewMode('generator');
                                    }}>
                                        <strong>{s.prompt}</strong>
                                        <small>{new Date(s.timestamp).toLocaleDateString()} at {new Date(s.timestamp).toLocaleTimeString()}</small>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="floating-input-container">
                <div className={`input-wrapper ${isLoading ? 'loading' : ''}`}>
                    {!inputValue && !isLoading && (
                        <div className="animated-placeholder">
                            <span>{INITIAL_PLACEHOLDERS[placeholderIndex]}</span>
                        </div>
                    )}
                    <input 
                        ref={inputRef} type="text" placeholder={isLoading ? "Architecting..." : ""}
                        value={inputValue} onChange={e => setInputValue(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && !isLoading && inputValue.trim() && handleSendMessage()}
                        disabled={isLoading} 
                    />
                    <button className="send-button" onClick={() => handleSendMessage()} disabled={isLoading || !inputValue.trim()} title="Architect Plan (Enter)">
                        {isLoading ? <ThinkingIcon /> : <ArrowUpIcon />}
                    </button>
                </div>
            </div>
        </main>

        <div className="notification-toast-container">
            {activeToasts.map(n => (
                <div key={n.id} className={`toast ${n.type}`}>
                    <div className="toast-icon">★</div>
                    <div className="toast-message">{n.message}</div>
                </div>
            ))}
        </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
