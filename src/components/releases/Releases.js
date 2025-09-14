// src/components/Releases.js - Updated to use new view modes

import React from 'react'
import { useSelector } from 'react-redux'
import { getReleases, getViewMode, getHasReleases } from 'state/selectors'
import TableView from './TableView'
import ViewModeToggle from './ViewModeToggle'
import SyncProgress from './SyncProgress'
// Import your existing card components
import ReleasesCards from './ReleasesCards' // or whatever you call your current card view

export function Releases() {
  const releases = useSelector(getReleases)
  const viewMode = useSelector(getViewMode)
  const hasReleases = useSelector(getHasReleases)

  if (!hasReleases) {
    return (
      <div className="releases-empty">
        <p>No releases found. Try adjusting your filters or syncing your data.</p>
      </div>
    )
  }

  return (
    <div className="releases-container">
      <SyncProgress />
      
      {/* Header with view toggle */}
      <div className="releases-header">
        <div className="releases-stats">
          <span>{releases.length} releases</span>
        </div>
        <ViewModeToggle />
      </div>

      {/* Conditional rendering based on view mode */}
      {viewMode === 'table' ? (
        <TableView />
      ) : (
        <ReleasesCards releases={releases} />
      )}

      <style jsx>{`
        .releases-container {
          width: 100%;
          padding: 20px;
        }

        .releases-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 1px solid #e9ecef;
        }

        .releases-stats {
          color: #6c757d;
          font-size: 14px;
        }

        .releases-empty {
          text-align: center;
          padding: 40px 20px;
          color: #6c757d;
        }

        @media (max-width: 768px) {
          .releases-container {
            padding: 10px;
          }
          
          .releases-header {
            flex-direction: column;
            gap: 10px;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  )
}

export default Releases
