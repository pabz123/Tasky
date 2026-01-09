
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
        <section 
            className={`pulse-card plan-preview-card ${isStreaming ? 'loading' : ''}`}
            aria-labelledby={`artifact-title-${artifact.id}`}
            aria-busy={isStreaming}
        >
            <div className="card-header">
                <div className="artifact-style-tag" id={`artifact-title-${artifact.id}`}>{artifact.styleName}</div>
                {artifact.status === 'complete' && onSync && (
                    <button 
                        className="sync-btn" 
                        aria-label={`Sync ${artifact.styleName} plan to dashboard`}
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
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }} aria-hidden="true">
                        <ThinkingIcon />
                    </div>
                ) : (
                    <>
                        <p className="plan-summary">{artifact.summary}</p>
                        <ul className="mini-task-list" style={{ listStyle: 'none', padding: 0 }}>
                            {artifact.tasks.map(t => (
                                <li key={t.id} className={`mini-task priority-${t.priority}`}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontWeight: 600 }}>{t.text}</span>
                                      {t.dueDate && <small style={{ opacity: 0.7, fontSize: '0.7rem' }}>Due: {t.dueDate}</small>}
                                    </div>
                                    {t.estimatedTime && <small style={{ opacity: 0.8, fontSize: '0.75rem' }}>{t.estimatedTime}</small>}
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </section>
    );
});

export default ArtifactCard;
