// Point d entree des adapters Tier 1.
// Chaque adapter expose des fonctions fetch* (acceptant un AdapterContext)
// et des helpers *ToCitation pour produire des AdapterCitation uniformes.
//
// Convention d usage cote moteur :
//   import { searchEpoPatents, getPappersCompanyDetails } from '@/lib/sources/adapters';
//
// Pas de side-effect a l import : tous les modules sont stateless,
// l auth EPO est cachee en memoire mais lazy.

export {
  searchEpoPatents,
  epoPatentToCitation,
  type EpoPatentRecord,
} from './epo';

export {
  searchPappersCompany,
  getPappersCompanyDetails,
  pappersToCitation,
  type PappersCompanySearchHit,
  type PappersCompanyDetails,
} from './pappers';

export {
  searchBodaccBySiren,
  searchBodaccProceduresByCompanyName,
  bodaccToCitation,
  type BodaccAnnouncement,
  type BodaccAnnouncementType,
} from './bodacc';

export type { AdapterContext, AdapterCitation } from './types';
export { safeJsonFetch, safeTextFetch } from './types';
