export type StatutPV = 'brouillon' | 'valide' | 'cloture'

export interface Chantier {
  id?: number
  nom: string
  numero?: string
  localisation?: string
  maitreOuvrage?: string
  maitreOeuvre?: string
  entreprise?: string
  description?: string
  archive: boolean
  dateCreation: number
  dateModification: number
}

export interface PV {
  id?: number
  chantierId: number
  numero: string
  date: string // ISO yyyy-mm-dd
  objet?: string
  localisation?: string
  controleur?: string // rédacteur / responsable du contrôle (traçabilité)
  entrepriseControle?: string
  conditionsMeteo?: string
  observationsGenerales?: string
  statut: StatutPV
  dateCreation: number
  dateModification: number
}

export type PhaseControle =
  | 'Préparation du support'
  | 'Mise en œuvre'
  | 'Contrôles intermédiaires'
  | 'Contrôle final'
  | 'Autre'

export const PHASES_CONTROLE: PhaseControle[] = [
  'Préparation du support',
  'Mise en œuvre',
  'Contrôles intermédiaires',
  'Contrôle final',
  'Autre'
]

export type ResultatControle = 'conforme' | 'non_conforme' | 'reserve' | 'non_controle'

export const RESULTATS: { value: ResultatControle; label: string }[] = [
  { value: 'conforme', label: 'Conforme' },
  { value: 'non_conforme', label: 'Non conforme' },
  { value: 'reserve', label: 'Réserve' },
  { value: 'non_controle', label: 'Non contrôlé' }
]

export interface PointControle {
  id?: number
  pvId: number
  ordre: number
  phase: string
  designation: string
  reference?: string // critère / référentiel
  resultat: ResultatControle
  observation?: string
  dateCreation: number
}

export interface Photo {
  id?: number
  pvId: number
  pointId?: number | null
  phase?: string
  legende?: string
  nom: string
  type: string
  taille: number
  largeur?: number
  hauteur?: number
  blob: Blob
  dateAjout: number
}

export interface DocumentJoint {
  id?: number
  pvId: number
  nom: string
  type: string
  taille: number
  blob: Blob
  dateAjout: number
}

export interface CharteGraphique {
  couleurPrimaire: string
  couleurSecondaire: string
  police: string
}

export interface Parametres {
  cle: 'global'
  schemaVersion: number
  nomEntreprise?: string
  adresseEntreprise?: string
  telephone?: string
  email?: string
  siret?: string
  logo?: string // dataURL
  charte: CharteGraphique
  piedDePage?: string
  rappelSauvegardeJours: number
  derniereSauvegarde?: number // timestamp
  avertissementSecuriteVu: boolean
}

export const PARAMETRES_DEFAUT: Omit<Parametres, 'cle'> = {
  schemaVersion: 1,
  charte: {
    couleurPrimaire: '#1d4ed8',
    couleurSecondaire: '#1e3a8a',
    police: 'helvetica'
  },
  piedDePage: 'Document généré localement - données stockées sur cet appareil uniquement.',
  rappelSauvegardeJours: 7,
  avertissementSecuriteVu: false
}

export interface Stats {
  chantiers: number
  pvs: number
  points: number
  nonConformites: number
  photos: number
  documents: number
}
