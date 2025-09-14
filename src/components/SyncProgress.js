// src/components/SyncProgress.js - Enhanced sync progress with stage information

import React from 'react'
import { useSelector } from 'react-redux'
import { getSyncingProgress, getSyncing } from 'state/selectors'

export function SyncProgress() {
  const syncing = useSelector(getSyncing)
  const progress = useSelector(getSyncingProgress)
  const syncStage = useSelector(state => state.syncStage)

  if (!syncing) return null

  const progressPercent = Math.min(100, Math.max(0, progress))
  const stageText = syncStage?.stage || 'Syncing...'

  return (
    <div className="sync-progress">
      <div className="progress-container">
        <div className="progress-info">
          <span className="stage-text">{stageText}</span>
          <span className="progress-percent">{Math.round(progressPercent)}%</span>
        </div>
        
        <div className="progress-bar-container">
          <div 
            className="progress-bar"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        {syncStage?.stage && (
          <div className="stage-details">
            {syncStage.stage === 'Loading artists...' && (
              <span className="stage-hint">Fetching your followed artists and saved music</span>
            )}
            {syncStage.stage === 'Analyzing listening preferences...' && (
              <span className="stage-hint">Getting your top artists from Spotify</span>
            )}
            {syncStage.stage === 'Syncing Last.fm data...' && (
              <span className="stage-hint">Importing your Last.fm listening history</span>
            )}
            {syncStage.stage === 'Loading new releases...' && (
              <span className="stage-hint">Finding new releases from your artists</span>
            )}
            {syncStage.stage === 'Processing albums...' && (
              <span className="stage-hint">Organizing and filtering albums</span>
            )}
            {syncStage.stage === 'Loading detailed album info...' && (
              <span className="stage-hint">Getting labels and popularity data</span>
            )}
            {syncStage.stage === 'Calculating recommendations...' && (
              <span className="stage-hint">Computing personalized scores</span>
            )}
            {syncStage.stage === 'Updating history...' && (
              <span className="stage-hint">Tracking new releases</span>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .sync-progress {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 1000;
          background: white;
          border-radius: 12px;
          padding: 16px;
          min-width: 300px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          border: 1px solid #e9ecef;
        }

        .progress-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .progress-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .stage-text {
          font-weight: 500;
          color: #495057;
          font-size: 14px;
        }

        .progress-percent {
          font-size: 12px;
          color: #6c757d;
          font-weight: 600;
        }

        .progress-bar-container {
          width: 100%;
          height: 6px;
          background: #e9ecef;
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #1db954 0%, #1ed760 100%);
          transition: width 0.3s ease;
          border-radius: 3px;
        }

        .stage-details {
          margin-top: 4px;
        }

        .stage-hint {
          font-size: 11px;
          color: #6c757d;
          font-style: italic;
        }

        @media (max-width: 768px) {
          .sync-progress {
            top: 10px;
            right: 10px;
            left: 10px;
            min-width: unset;
            padding: 12px;
          }

          .stage-text {
            font-size: 13px;
          }

          .stage-hint {
            font-size: 10px;
          }
        }

        @media (max-width: 480px) {
          .sync-progress {
            position: relative;
            top: 0;
            right: 0;
            left: 0;
            margin: 10px;
            border-radius: 8px;
          }
        }
      `}</style>
    </div>
  )
}

export default SyncProgress
