// Build-only authored candidates. Production consumers must use generated projections.

import {
  WORLD_MAP_V4_HOME_BUILDING_SOURCE_ASSET,
  WORLD_MAP_V4_HOME_SITE_GROUND_SOURCE_ASSET,
} from './sourceAssets.mjs'

const HOME_BUILDING = WORLD_MAP_V4_HOME_BUILDING_SOURCE_ASSET
const HOME_GROUND = WORLD_MAP_V4_HOME_SITE_GROUND_SOURCE_ASSET

export const WORLD_MAP_V4_OBJECT_AUTHORITY = Object.freeze({
  'environment-north-forest': 'legacy',
  'environment-west-stream-forest': 'legacy',
  'environment-east-forest': 'legacy',
  'environment-central-gardens': 'legacy',
  'environment-southwest-garden': 'legacy',
  'environment-southeast-garden': 'legacy',
  'environment-south-center-garden': 'legacy',
  'environment-south-forest': 'legacy',
  'landmark-guesthouse': 'legacy',
  'landmark-lab': 'legacy',
  'landmark-animal': 'legacy',
  'landmark-nature': 'legacy',
  'landmark-library': 'native',
  'landmark-urban': 'legacy',
  'landmark-human': 'legacy',
  'landmark-music': 'legacy',
  'landmark-home': 'native',
  'foreground-south-gate': 'legacy',
})

export const WORLD_MAP_V4_AUTHORED_CANDIDATES = Object.freeze([
  Object.freeze({
    schemaVersion: 1,
    id: 'landmark-library',
    kind: 'landmark',
    transform: {
      position: { x: 1146.9613259668508, y: 828.7292817679557 },
      rotationDeg: 0,
      scale: { x: 1, y: 1 },
    },
    anchor: {
      space: 'object-local',
      x: 0,
      y: 0,
      meaning: 'legacy-visual-top-left',
    },
    visual: {
      layers: [{
        id: 'body',
        role: 'body',
        assetId: 'landmark-library',
        rect: { left: 0, top: 0, right: 1544.7513812154696, bottom: 716.0220994475138 },
        renderBand: 'world',
        sortOffsetY: 0,
      }],
      bounds: { mode: 'generated-layer-union' },
    },
    groundContact: {
      space: 'world',
      point: { x: 1918, y: 1339.2265193370165 },
      confidence: 'legacy-derived',
    },
    depth: {
      mode: 'ground-contact',
      sortOffsetY: 0,
      legacySortY: 1339.2265193370165,
    },
    collision: {
      mode: 'authored',
      colliders: [{
        colliderId: 'library-body',
        collisionRole: 'building-body',
        space: 'world',
        shapes: [{ type: 'rect', left: 1728, top: 1184, right: 2112, bottom: 1398 }],
      }],
    },
    interaction: {
      type: 'museum',
      destinationId: 'sound-library',
      legacyIds: ['Library', 'Sound Library'],
      point: { space: 'world', x: 1918, y: 1438 },
      activation: { type: 'axis-distance', halfWidth: 64, halfHeight: 48, inclusive: true },
    },
    navigation: {
      approachPoint: { mode: 'from-interaction-point' },
      route: { mode: 'generated-from-walkable-clearance-mask' },
      guidePath: {
        mode: 'authored-guide',
        space: 'world',
        points: [{ x: 1920, y: 1504 }, { x: 1918, y: 1438 }],
      },
    },
    minimap: {
      visible: true,
      point: { mode: 'from-navigation-approach' },
      label: 'Sound Museum',
      icon: '🏛',
      color: '#C8A96E',
    },
    state: {
      visibility: { default: true, qaModes: ['all', 'objects'] },
      variants: [],
    },
    compatibility: {
      scope: 'render',
      primaryVisualLayerId: 'body',
      renderCategory: 'landmark',
      renderLayer: 'gameplay',
      renderInteractionId: 'Library',
      portalId: 'Sound Library',
      destinationKey: 'Library',
      externalDestinationId: 'Sound Library',
      destinationTarget: {
        tx: 54,
        ty: 37,
        w: 12,
        h: 8,
        approach: { x: 1918, y: 1438 },
      },
      guidePathId: 'spoke-library',
      runtimeSortReferenceY: 1010,
      assetBuildSemanticSortReferenceY: 1147,
    },
    provenance: {
      sourceAssets: [{
        path: 'design/concepts/world-map-reskin-2026-09-18/02-sound-archive-garden-hd-master.png',
        crop: { left: 1730, top: 1250, right: 4060, bottom: 2330 },
      }],
      generator: 'scripts/build-world-map-v4-assets.py',
      registration: { width: 2896, height: 2172, worldWidth: 3840, worldHeight: 2880 },
      sourceNote: 'HD reference crop (1730, 1250, 4060, 2330)',
    },
  }),
  Object.freeze({
    schemaVersion: 1,
    id: 'landmark-home',
    kind: 'landmark',
    transform: {
      position: { x: 1344, y: 1344 },
      rotationDeg: 0,
      scale: { x: 1, y: 1 },
    },
    anchor: {
      space: 'object-local',
      x: 0,
      y: 0,
      meaning: 'site-ground-top-left',
    },
    visual: {
      layers: [{
        id: 'site-ground',
        role: 'ground',
        assetId: HOME_GROUND.id,
        rect: { left: 0, top: 0, right: HOME_GROUND.width, bottom: HOME_GROUND.height },
        renderBand: 'ground',
        sortOffsetY: -1,
      }, {
        id: 'body',
        role: 'body',
        assetId: HOME_BUILDING.id,
        rect: { left: 128, top: 51, right: 128 + HOME_BUILDING.width, bottom: 51 + HOME_BUILDING.height },
        renderBand: 'world',
        sortOffsetY: 0,
      }],
      bounds: { mode: 'generated-layer-union' },
    },
    groundContact: {
      space: 'world',
      point: { x: 1648, y: 1696 },
      confidence: 'approved-art',
    },
    depth: {
      mode: 'ground-contact',
      sortOffsetY: 0,
    },
    collision: {
      mode: 'authored',
      colliders: [{
        colliderId: 'home-body',
        collisionRole: 'building-body',
        space: 'object-local',
        shapes: [{ type: 'rect', left: 176, top: 128, right: 432, bottom: 352 }],
      }],
    },
    interaction: {
      type: 'home',
      destinationId: 'home',
      legacyIds: ['Home'],
      point: { space: 'world', x: 1648, y: 1760 },
      activation: { type: 'axis-distance', halfWidth: 64, halfHeight: 48, inclusive: true },
    },
    navigation: {
      approachPoint: { mode: 'from-interaction-point' },
      route: { mode: 'generated-from-walkable-clearance-mask' },
      guidePath: {
        mode: 'authored-guide',
        space: 'world',
        points: [{ x: 1920, y: 1504 }, { x: 1856, y: 1568 }, { x: 1824, y: 1760 }, { x: 1648, y: 1760 }],
      },
    },
    minimap: {
      visible: true,
      point: { mode: 'from-navigation-approach' },
      label: '우리 집 · 꾸미기',
      icon: '🏠',
      color: '#E98265',
    },
    state: {
      visibility: { default: true, qaModes: ['all', 'objects'] },
      variants: [],
    },
    compatibility: {
      scope: 'render',
      parity: 'intentional-delta',
      primaryVisualLayerId: 'body',
      renderCategory: 'landmark',
      renderLayer: 'gameplay',
      renderInteractionId: 'Home',
      portalId: 'Home',
      destinationKey: 'Home',
      externalDestinationId: 'Home',
      destinationTarget: {
        tx: 47,
        ty: 46,
        w: 9,
        h: 7,
        approach: { x: 1648, y: 1760 },
      },
      guidePathId: 'spoke-home',
      runtimeSortReferenceY: 1696,
      roadConnectionPoint: { x: 1824, y: 1760 },
    },
    provenance: {
      sourceAssets: [{ path: HOME_BUILDING.sourcePath }, { path: HOME_GROUND.sourcePath }],
      generator: 'scripts/build-world-map-v4-runtime-assets.mjs',
      registration: { worldWidth: 3840, worldHeight: 2880 },
      contentHash: `${HOME_BUILDING.sha256}:${HOME_GROUND.sha256}`,
      sourceNote: 'User-approved Candidate A; lossless source promotion with direct-size WebP encoding',
    },
  }),
])
