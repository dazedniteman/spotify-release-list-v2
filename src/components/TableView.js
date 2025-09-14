// src/components/TableView.js - Table view for releases with sorting

import React, { useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setTableSort, setFilters } from 'state/actions'
import { 
  getTableSortedReleases, 
  getTableSort, 
  getArtistAffinity,
  getSettingsShowAffinityIndicators,
  getSettingsUriLinks
} from 'state/selectors'
import { spotifyLink } from 'helpers'
import { SpotifyEntity } from 'enums'

const { ALBUM, ARTIST } = SpotifyEntity

export function TableView() {
  const dispatch = useDispatch()
  const releases = useSelector(getTableSortedReleases)
  const tableSort = useSelector(getTableSort)
  const artistAffinity = useSelector(getArtistAffinity)
  const showAffinityIndicators = useSelector(getSettingsShowAffinityIndicators)
  const uriLinks = useSelector(getSettingsUriLinks)

  const handleSort = (field) => {
    const newDirection = 
      tableSort.field === field && tableSort.direction === 'asc' ? 'desc' : 'asc'
    
    dispatch(setTableSort({ field, direction: newDirection }))
  }

  const handleArtistFilter = (artistName) => {
    dispatch(setFilters({ search: artistName }))
  }

  const getSortIcon = (field) => {
    if (tableSort.field !== field) return '↕️'
    return tableSort.direction === 'asc' ? '↑' : '↓'
  }

  const getAffinityDisplay = (album) => {
    if (!showAffinityIndicators || !album.affinityScore) return null
    
    const score = album.affinityScore
    if (score >= 70) return '🔥'
    if (score >= 40) return '⭐'
    if (score >= 10) return '💫'
    return null
  }

  const formatArtists = (album) => {
    const allArtists = Object.values(album.artists).flat()
    return allArtists.map(artist => artist.name).join(', ')
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatAlbumType = (album) => {
    const types = Object.keys(album.artists)
    return types.map(type => {
      switch (type) {
        case 'album': return 'Album'
        case 'single': return 'Single'
        case 'compilation': return 'Compilation'
        case 'appears_on': return 'Appears On'
        default: return type
      }
    }).join(', ')
  }

  const memoizedReleases = useMemo(() => releases, [releases])

  if (!releases || releases.length === 0) {
    return (
      <div className="table-view-empty">
        <p>No releases to display</p>
      </div>
    )
  }

  return (
    <div className="table-view">
      <div className="table-container">
        <table className="releases-table">
          <thead>
            <tr>
              {showAffinityIndicators && (
                <th className="sortable" onClick={() => handleSort('affinity')}>
                  Match {getSortIcon('affinity')}
                </th>
              )}
              <th className="sortable" onClick={() => handleSort('releaseDate')}>
                Date {getSortIcon('releaseDate')}
              </th>
              <th className="sortable" onClick={() => handleSort('artist')}>
                Artist {getSortIcon('artist')}
              </th>
              <th className="sortable" onClick={() => handleSort('album')}>
                Album {getSortIcon('album')}
              </th>
              <th>Type</th>
              <th className="sortable" onClick={() => handleSort('totalTracks')}>
                Tracks {getSortIcon('totalTracks')}
              </th>
              {releases.some(r => r.label) && (
                <th>Label</th>
              )}
              {releases.some(r => r.popularity) && (
                <th className="sortable" onClick={() => handleSort('popularity')}>
                  Popularity {getSortIcon('popularity')}
                </th>
              )}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {memoizedReleases.map((album) => {
              const primaryArtist = Object.values(album.artists).flat()[0]
              const affinityDisplay = getAffinityDisplay(album)
              
              return (
                <tr key={album.id} className={`affinity-${album.affinityCategory}`}>
                  {showAffinityIndicators && (
                    <td className="affinity-cell">
                      {affinityDisplay && (
                        <span 
                          className="affinity-indicator"
                          title={`Affinity Score: ${Math.round(album.affinityScore)}`}
                        >
                          {affinityDisplay}
                        </span>
                      )}
                    </td>
                  )}
                  
                  <td className="date-cell">
                    {formatDate(album.releaseDate)}
                  </td>
                  
                  <td className="artist-cell">
                    <button 
                      className="artist-filter-btn"
                      onClick={() => handleArtistFilter(primaryArtist?.name)}
                      title={`Filter by ${primaryArtist?.name}`}
                    >
                      {formatArtists(album)}
                    </button>
                  </td>
                  
                  <td className="album-cell">
                    <div className="album-info">
                      {album.image && (
                        <img 
                          src={album.image} 
                          alt={album.name}
                          className="album-thumbnail"
                        />
                      )}
                      <span className="album-name">{album.name}</span>
                    </div>
                  </td>
                  
                  <td className="type-cell">
                    {formatAlbumType(album)}
                  </td>
                  
                  <td className="tracks-cell">
                    {album.totalTracks}
                  </td>
                  
                  {releases.some(r => r.label) && (
                    <td className="label-cell">
                      {album.label || '—'}
                    </td>
                  )}
                  
                  {releases.some(r => r.popularity) && (
                    <td className="popularity-cell">
                      {album.popularity ? `${album.popularity}%` : '—'}
                    </td>
                  )}
                  
                  <td className="actions-cell">
                    <div className="action-buttons">
                      <a
                        href={spotifyLink(album.id, ALBUM, uriLinks)}
                        className="action-btn spotify-btn"
                        title="Open in Spotify"
                        target={uriLinks ? undefined : '_blank'}
                        rel={uriLinks ? undefined : 'noopener noreferrer'}
                      >
                        🎵
                      </a>
                      {primaryArtist && (
                        <a
                          href={spotifyLink(primaryArtist.id, ARTIST, uriLinks)}
                          className="action-btn artist-btn"
                          title="Open artist in Spotify"
                          target={uriLinks ? undefined : '_blank'}
                          rel={uriLinks ? undefined : 'noopener noreferrer'}
                        >
                          👤
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      <style jsx>{`
        .table-view {
          width: 100%;
          overflow-x: auto;
        }
        
        .table-container {
          min-width: 800px;
        }
        
        .releases-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .releases-table th {
          background: #f8f9fa;
          padding: 12px 8px;
          font-weight: 600;
          text-align: left;
          border-bottom: 2px solid #e9ecef;
          white-space: nowrap;
        }
        
        .releases-table th.sortable {
          cursor: pointer;
          user-select: none;
          transition: background-color 0.2s;
        }
        
        .releases-table th.sortable:hover {
          background: #e9ecef;
        }
        
        .releases-table td {
          padding: 8px;
          border-bottom: 1px solid #e9ecef;
          vertical-align: middle;
        }
        
        .releases-table tr:hover {
          background: #f8f9fa;
        }
        
        .releases-table tr.affinity-high {
          background: rgba(255, 193, 7, 0.1);
        }
        
        .releases-table tr.affinity-medium {
          background: rgba(40, 167, 69, 0.1);
        }
        
        .releases-table tr.affinity-low {
          background: rgba(23, 162, 184, 0.1);
        }
        
        .affinity-indicator {
          font-size: 16px;
          cursor: help;
        }
        
        .artist-filter-btn {
          background: none;
          border: none;
          color: #007bff;
          cursor: pointer;
          text-decoration: underline;
          padding: 0;
          font: inherit;
        }
        
        .artist-filter-btn:hover {
          color: #0056b3;
        }
        
        .album-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .album-thumbnail {
          width: 32px;
          height: 32px;
          border-radius: 4px;
          object-fit: cover;
        }
        
        .album-name {
          font-weight: 500;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .action-buttons {
          display: flex;
          gap: 4px;
        }
        
        .action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 4px;
          text-decoration: none;
          font-size: 14px;
          transition: background-color 0.2s;
        }
        
        .action-btn:hover {
          background: rgba(0,0,0,0.1);
        }
        
        .spotify-btn {
          background: rgba(29, 185, 84, 0.1);
        }
        
        .artist-btn {
          background: rgba(108, 117, 125, 0.1);
        }
        
        .table-view-empty {
          text-align: center;
          padding: 40px 20px;
          color: #6c757d;
        }
        
        .date-cell {
          min-width: 100px;
        }
        
        .tracks-cell,
        .popularity-cell,
        .affinity-cell {
          text-align: center;
          width: 80px;
        }
        
        .type-cell {
          min-width: 100px;
        }
        
        .label-cell {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .actions-cell {
          width: 80px;
        }
        
        @media (max-width: 768px) {
          .table-view {
            font-size: 14px;
          }
          
          .releases-table th,
          .releases-table td {
            padding: 6px 4px;
          }
          
          .album-thumbnail {
            width: 24px;
            height: 24px;
          }
          
          .album-name {
            max-width: 120px;
          }
        }
      `}</style>
    </div>
  )
}

export default TableView
