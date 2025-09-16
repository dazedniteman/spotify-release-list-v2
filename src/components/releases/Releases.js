// src/components/releases/Releases.js - Main releases component with view modes

import React from 'react'
import { useSelector } from 'react-redux'
import { 
  getReleases, 
  getViewMode, 
  getHasReleases, 
  getSyncing, 
  getUser,
  getLastSyncDate 
} from 'state/selectors'
import { Filters } from 'components/filters'
import { PlaylistModalContainer } from 'components/modals'
import { Content, VerticalLayout } from 'components/common'
import ReleasesHeader from './ReleasesHeader'
import ReleaseList from './ReleaseList'
import Intro from './Intro'
import Loading from './Loading'

/**
 * Main releases component with enhanced view modes
 */
function Releases() {
  const releases = useSelector(getReleases)
  const viewMode = useSelector(getViewMode)
  const hasReleases = useSelector(getHasReleases)
  const syncing = useSelector(getSyncing)
  const user = useSelector(getUser)
  const lastSyncDate = useSelector(getLastSyncDate)

  // Show intro if not logged in
  if (!user && !syncing) {
    return (
      <VerticalLayout className="Releases">
        <ReleasesHeader />
        <Content>
          <Intro />
        </Content>
      </VerticalLayout>
    )
  }

  // Show loading during sync
  if (syncing) {
    return (
      <VerticalLayout className="Releases">
        <ReleasesHeader />
        <Content>
          <Loading />
        </Content>
      </VerticalLayout>
    )
  }

  // Show main content
  return (
    <VerticalLayout className="Releases">
      <ReleasesHeader />
      <Filters />
      <Content>
        {hasReleases ? (
          <ReleaseList releases={releases} />
        ) : (
          <div className="has-text-centered has-text-grey">
            <p>No releases found. Try adjusting your filters or syncing your data.</p>
          </div>
        )}
      </Content>
      <PlaylistModalContainer />
    </VerticalLayout>
  )
}

export default Releases
