
import { GoogleGenAI } from '@google/genai';
import React, { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';

import { 
    Session, 
    Task, 
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

// --- Supabase Configuration ---
const SUPABASE_URL = 'https://hhnigcgstxjymgxxnyak.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_PJVYmCr9Q6TBRLT3d7Y2hg_dgERETWE';

// Initialize Supabase with basic error handling
let supabase: any = null;
try {
    if (SUPABASE_URL && !SUPABASE_URL.includes('your-project')) {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (e) {
    console.error("Supabase initialization error:", e);
}

const PulseIcon = () => (
    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
);
const HealthIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
);
const SettingsIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1-1 1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);

function App() {
  const [viewMode, setViewMode] = useState<'generator' | 'dashboard' | 'health' | 'settings' | 'auth'>('generator');
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<Session[]>(() => {
      try {
        const saved = localStorage.getItem('tasky_sessions');
        return saved ? JSON.parse(saved) : [];
      } catch { return []; }
  });
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(-1);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  const [profile, setProfile] = useState<UserProfile>(() => {
      try {
        const saved = localStorage.getItem('tasky_profile');
        return saved ? JSON.parse(saved) : { name: 'Architect', stepGoal: 10000, sleepGoal: 8, waterGoal: 2500, theme: 'light' };
      } catch { return { name: 'Architect', stepGoal: 10000, sleepGoal: 8, waterGoal: 2500, theme: 'light' }; }
  });
  const [healthData, setHealthData] = useState<HealthData>(() => {
      try {
        const saved = localStorage.getItem('tasky_health');
        return saved ? JSON.parse(saved) : { steps: 0, heartRate: 72, sleepHours: 0, waterIntake: 0, timestamp: Date.now() };
      } catch { return { steps: 0, heartRate: 72, sleepHours: 0, waterIntake: 0, timestamp: Date.now() }; }
  });
  const [tasks, setTasks] = useState<Task[]>(() => {
      try {
        const saved = localStorage.getItem('tasky_tasks');
        return saved ? JSON.parse(saved) : [];
      } catch { return []; }
  });

  const [activeToasts, setActiveToasts] = useState<AppNotification[]>([]);
  const addNotification = useCallback((message: string, type: AppNotification['type'] = 'success') => {
      const notif: AppNotification = { id: generateId(), message, type, timestamp: Date.now() };
      setActiveToasts(prev => [...prev, notif]);
      setTimeout(() => setActiveToasts(prev => prev.filter(t => t.id !== notif.id)), 4000);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setUser(session?.user ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      setUser(session?.user ?? null);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    });
    const interval = setInterval(() => setPlaceholderIndex(p => (p + 1) % INITIAL_PLACEHOLDERS.length), 5000);
    return () => clearInterval(interval);
  }, []);

  const triggerInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  useEffect(() => {
    localStorage.setItem('tasky_sessions', JSON.stringify(sessions));
    localStorage.setItem('tasky_tasks', JSON.stringify(tasks));
    localStorage.setItem('tasky_profile', JSON.stringify(profile));
    localStorage.setItem('tasky_health', JSON.stringify(healthData));
  }, [sessions, tasks, profile, healthData]);

  const handleSendMessage = useCallback(async () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        addNotification("Configuration Error: Missing API Key", "overdue");
        return;
    }
    
    if (!inputValue.trim() || isLoading) return;
    const prompt = inputValue.trim();
    setInputValue('');
    setIsLoading(true);
    setViewMode('generator');

    const sessionId = generateId();
    const newSession: Session = { 
        id: sessionId, prompt, timestamp: Date.now(), 
        artifacts: Array(3).fill(null).map((_, i) => ({
            id: `${sessionId}_${i}`, styleName: 'Architecting...', tasks: [], summary: '', status: 'streaming'
        }))
    };

    setSessions(prev => {
        const updated = [...prev, newSession];
        setCurrentSessionIndex(updated.length - 1);
        return updated;
    });

    try {
        const ai = new GoogleGenAI({ apiKey });
        const planTypes = ["Balanced Harmony", "Peak Focus Sprint", "Gentle Progress"];
        
        await Promise.all(planTypes.map(async (type, i) => {
            const res = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: [{ role: 'user', parts: [{ text: `User: ${profile.name}. Goal: "${prompt}". Mode: ${type}.` }] }],
                config: {
                    systemInstruction: `Return ONLY JSON with 'summary' and 'tasks' (array). Fields: text, priority, estimatedTime, dueDate.`,
                    responseMimeType: "application/json"
                }
            });
            const data = JSON.parse(res.text);
            setSessions(prev => prev.map(s => s.id === sessionId ? {
                ...s,
                artifacts: s.artifacts.map((art, idx) => idx === i ? {
                    ...art, styleName: type, tasks: data.tasks.map((t: any) => ({ ...t, id: generateId(), completed: false })),
                    summary: data.summary, status: 'complete'
                } : art)
            } : s));
        }));
        addNotification("Architectural plans ready.", "success");
    } catch (e) {
        addNotification("AI Error: Please retry.", "overdue");
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  }, [inputValue, isLoading, profile.name, addNotification]);

  const toggleTask = (taskId: string) => {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t));
  };

  return (
    <div className={`theme-${profile.theme}`} id="theme-wrapper">
        <header className="top-nav">
            <div className="nav-logo" onClick={() => setViewMode('generator')} style={{ cursor: 'pointer' }}>
                <PulseIcon /> <span>Tasky<b>.</b></span>
            </div>
            <nav className="nav-tabs">
                <button className={`nav-tab ${viewMode === 'generator' ? 'active' : ''}`} onClick={() => setViewMode('generator')}><SparklesIcon /> <span>Plan</span></button>
                <button className={`nav-tab ${viewMode === 'dashboard' ? 'active' : ''}`} onClick={() => setViewMode('dashboard')}><GridIcon /> <span>Focus</span></button>
                <button className={`nav-tab ${viewMode === 'health' ? 'active' : ''}`} onClick={() => setViewMode('health')}><HealthIcon /> <span>Health</span></button>
                <button className={`nav-tab ${viewMode === 'settings' ? 'active' : ''}`} onClick={() => setViewMode('settings')}><SettingsIcon /> <span>Settings</span></button>
            </nav>
            <div className="nav-actions">
                <button className={`sync-status-pill ${user ? 'active' : ''}`} onClick={() => setViewMode('auth')}>
                    <div className={`dot ${user ? 'glow' : ''}`}></div> {user ? 'Synced' : 'Cloud Login'}
                </button>
            </div>
        </header>

        <main className="immersive-app">
            <DottedGlowBackground gap={32} radius={2} color="rgba(14, 165, 233, 0.05)" glowColor="rgba(212, 175, 55, 0.3)" speedScale={0.3} />

            {viewMode === 'auth' ? (
                <div className="auth-container">
                    <section className="pulse-card">
                        <div className="card-header"><h4>{user ? 'Cloud Active' : 'Connect Cloud'}</h4></div>
                        <div className="card-body">
                            {user ? (
                                <div style={{ textAlign: 'center' }}>
                                    <p>Logged in as: <strong>{user.email}</strong></p>
                                    <button className="save-log-btn danger" style={{ width: '100%', marginTop: '20px' }} onClick={() => supabase.auth.signOut()}>Logout</button>
                                </div>
                            ) : (
                                <form className="auth-form" onSubmit={async (e) => { 
                                    e.preventDefault(); 
                                    const email = (e.target as any).email.value;
                                    const password = (e.target as any).password.value;
                                    if (!supabase) return addNotification("Supabase not configured", "overdue");
                                    const { error } = await supabase.auth.signInWithPassword({ email, password });
                                    if (error) {
                                        const { error: se } = await supabase.auth.signUp({ email, password });
                                        if (se) addNotification(se.message, "overdue");
                                        else addNotification("Account created!", "success");
                                    }
                                }}>
                                    <input name="email" type="email" placeholder="Email" required />
                                    <input name="password" type="password" placeholder="Password" required />
                                    <button type="submit" className="save-log-btn">Sign In / Sign Up</button>
                                </form>
                            )}
                        </div>
                    </section>
                </div>
            ) : viewMode === 'generator' ? (
                <div className="stage-container">
                    <div className={`empty-state ${sessions.length > 0 || isLoading ? 'fade-out' : ''}`}>
                        <h1>Architect Your Day.</h1>
                        <p>Turn goals into workflows with AI precision.</p>
                    </div>
                    {currentSessionIndex !== -1 && (
                        <div className="artifact-grid">
                            {sessions[currentSessionIndex].artifacts.map((art) => (
                                <ArtifactCard key={art.id} artifact={art} onSync={(a) => {
                                    setTasks(prev => [...a.tasks.map(t => ({...t, id: generateId()})), ...prev]);
                                    setViewMode('dashboard');
                                }} />
                            ))}
                        </div>
                    )}
                </div>
            ) : viewMode === 'dashboard' ? (
                <div className="pulse-dashboard-container">
                    <section className="pulse-card">
                        <div className="card-header"><h4>Focus Board</h4> <PulseIcon /></div>
                        <div className="card-body">
                            {tasks.length === 0 && <p style={{ textAlign: 'center', opacity: 0.5 }}>Board clear. Start architecting!</p>}
                            <ul className="task-list">
                                {tasks.map(t => (
                                    <li key={t.id} className={`task-item ${t.completed ? 'done' : ''}`}>
                                        <button className="checkbox" onClick={() => toggleTask(t.id)}>{t.completed ? '✓' : ''}</button>
                                        <div className="task-content">
                                            <span className="task-text">{t.text}</span>
                                            <div className="task-meta" style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                                                <span>{t.priority} priority</span> • <span>{t.estimatedTime}</span>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </section>
                </div>
            ) : viewMode === 'health' ? (
                <div className="pulse-dashboard-container">
                    <div className="health-monitor-grid">
                        <div className="health-card"><div className="health-info"><h3>{healthData.steps}</h3><p>Steps</p></div></div>
                        <div className="health-card"><div className="health-info"><h3>{healthData.heartRate} <small>BPM</small></h3><p>Heart Rate</p></div></div>
                        <div className="health-card"><div className="health-info"><h3>{healthData.waterIntake} <small>ml</small></h3><p>Hydration</p></div></div>
                        <div className="health-card"><div className="health-info"><h3>{healthData.sleepHours} <small>hrs</small></h3><p>Sleep</p></div></div>
                    </div>
                </div>
            ) : (
                <div className="pulse-dashboard-container">
                    <section className="pulse-card">
                        <div className="card-header"><h4>Settings</h4> <SettingsIcon /></div>
                        <div className="card-body">
                            <div className="settings-group" style={{ marginBottom: '20px' }}>
                                <label>Architect Name</label>
                                <input style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-soft)' }} type="text" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} />
                            </div>
                            <div className="settings-group">
                                <label>Theme</label>
                                <div className="theme-selector">
                                    {['light', 'dark', 'glass'].map(t => (
                                        <button key={t} className={profile.theme === t ? 'active' : ''} onClick={() => setProfile({...profile, theme: t as any})}>{t.toUpperCase()}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            <div className="floating-input-container">
                <div className={`input-wrapper ${isLoading ? 'loading' : ''}`}>
                    {!inputValue && !isLoading && <div className="animated-placeholder" style={{ position: 'absolute', left: '24px', opacity: 0.5 }}>{INITIAL_PLACEHOLDERS[placeholderIndex]}</div>}
                    <input value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} disabled={isLoading} />
                    <button className="send-button" onClick={handleSendMessage} disabled={isLoading || !inputValue.trim()}>{isLoading ? <ThinkingIcon /> : <ArrowUpIcon />}</button>
                </div>
            </div>
        </main>
        <div className="notification-toast-container">
            {activeToasts.map(n => <div key={n.id} className="toast">{n.message}</div>)}
        </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) ReactDOM.createRoot(rootElement).render(<App />);
