
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Artifact } from '../types';
import { ThinkingIcon } from './Icons';

interface ArtifactCardProps {
    artifact: Artifact;
    isFocused?: boolean;
    onClick?: () => void;
    onSync?: (artifact: Artifact) => void;
}

const ArtifactCard = React.memo(({ 
    artifact, 
    onClick,
    onSync
}: ArtifactCardProps) => {
    const isStreaming = artifact.status === 'streaming';

    return (
        <div 
            className={`pulse-card plan-preview-card ${isStreaming ? 'loading' : ''}`}
            onClick={onClick}
        >
            <div className="card-header">
                <div className="artifact-style-tag">{artifact.styleName}</div>
                {artifact.status === 'complete' && onSync && (
                    <button 
                        className="sync-btn" 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            onSync(artifact); 
                        }}
                    >
                        Sync
                    </button>
                )}
            </div>
            <div className="card-body">
                {isStreaming ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                        <ThinkingIcon />
                    </div>
                ) : (
                    <>
                        <p className="plan-summary">{artifact.summary}</p>
                        <div className="mini-task-list">
                            {artifact.tasks.map(t => (
                                <div key={t.id} className={`mini-task priority-${t.priority}`}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontWeight: 600 }}>{t.text}</span>
                                      {t.dueDate && <small style={{ opacity: 0.5, fontSize: '0.7rem' }}>Due: {t.dueDate}</small>}
                                    </div>
                                    {t.estimatedTime && <small style={{ opacity: 0.6, fontSize: '0.75rem' }}>{t.estimatedTime}</small>}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
});

export default ArtifactCard;
