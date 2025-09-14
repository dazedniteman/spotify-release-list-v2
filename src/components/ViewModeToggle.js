// src/components/ViewModeToggle.js - Toggle between cards and table view

import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { toggleViewMode } from 'state/actions'
import { getViewMode } from 'state/selectors'

export function ViewModeToggle({ className = '' }) {
  const dispatch = useDispatch()
  const viewMode = useSelector(getViewMode)

  const handleToggle = () => {
    dispatch(toggleViewMode())
  }

  return (
    <button
      className={`view-mode-toggle ${className}`}
      onClick={handleToggle}
      title={`Switch to ${viewMode === 'cards' ? 'table' : 'card'} view`}
      aria-label={`Current view: ${viewMode}. Click to switch to ${viewMode === 'cards' ? 'table' : 'card'} view`}
    >
      {viewMode === 'cards' ? (
        <span className="toggle-content">
          📋 Table
        </span>
      ) : (
        <span className="toggle-content">
          🎴 Cards
        </span>
      )}
      
      <style jsx>{`
        .view-mode-toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
          min-width: 80px;
        }
        
        .view-mode-toggle:hover {
          background: #f8f9fa;
          border-color: #adb5bd;
          transform: translateY(-1px);
        }
        
        .view-mode-toggle:active {
          transform: translateY(0);
        }
        
        .toggle-content {
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }
        
        @media (max-width: 480px) {
          .view-mode-toggle {
            padding: 6px 8px;
            font-size: 12px;
            min-width: 60px;
          }
          
          .toggle-content {
            gap: 4px;
          }
        }
      `}</style>
    </button>
  )
}

export default ViewModeToggle
