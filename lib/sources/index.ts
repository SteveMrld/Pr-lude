// Point d entree du module sources.
// Le registry centralise la classification editoriale.
// Les adaptateurs et le branchement dans les moteurs viennent
// dans des commits ulterieurs (cf plan SourcesRegistry commit 2 et 3).

export {
  SOURCES_REGISTRY,
  getSourceById,
  getSourcesByTier,
  getSourcesByDomain,
  getSourcesByAccess,
  getByokSources,
  getMustHaveSourcesForDomain,
  dominantTier,
  instructionLevel,
  tierLabel,
} from './registry';

export type {
  SourceTier,
  AccessMode,
  SourceDomain,
  SourceDescriptor,
  InstructionLevel,
} from './registry';
