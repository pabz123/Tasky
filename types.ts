
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Task {
    id: string;
    text: string;
    completed: boolean;
    deadline?: string;
    dueDate?: string;
    priority: 'low' | 'medium' | 'high';
    category?: string;
    estimatedTime?: string;
}

export interface Artifact {
  id: string;
  styleName: string;
  tasks: Task[];
  summary: string;
  status: 'streaming' | 'complete' | 'error';
}

export interface Session {
    id: string;
    prompt: string;
    timestamp: number;
    artifacts: Artifact[];
    selectedPlanId?: string;
}

export interface UserProfile {
    name: string;
    stepGoal: number;
    sleepGoal: number;
    waterGoal: number;
    theme: 'light' | 'dark' | 'glass';
}

export interface HealthData {
    steps: number;
    heartRate: number;
    sleepHours: number;
    waterIntake: number; // in ml
    timestamp: number;
}

export interface Achievement {
    id: string;
    title: string;
    description: string;
    timestamp: number;
}

export interface DailyLog {
    id: string;
    content: string;
    timestamp: number;
}

export interface AppNotification {
    id: string;
    type: 'reminder' | 'overdue' | 'achievement' | 'success';
    message: string;
    timestamp: number;
}
