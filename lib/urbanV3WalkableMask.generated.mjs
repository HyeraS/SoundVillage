// Compatibility facade. The villageId manifest owns the generated module path.
export {
  WALKABLE_MASK_METADATA as URBAN_V3_WALKABLE_MASK_METADATA,
  isMaskCellWalkable as isUrbanV3MaskCellWalkable,
  isMaskPointWalkable as isUrbanV3MaskPointWalkable,
} from './generated/urbanV3WalkableMask.generated.mjs'
