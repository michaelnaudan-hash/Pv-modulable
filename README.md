# PV Chantier — Étanchéité des ouvrages d'art

Application web professionnelle pour **réaliser, renseigner, enregistrer et générer des procès-verbaux (PV) de contrôle de chantier** relatifs à la mise en œuvre des systèmes d'étanchéité sur les ouvrages d'art (ponts-routes, etc.).

## Principes fondamentaux

- **Aucune authentification** : ouverture directe sur le tableau de bord, aucun compte, aucun mot de passe. Le nom du contrôleur est renseigné dans les informations générales de chaque PV (traçabilité documentaire).
- **Fonctionnement intégral hors ligne** (architecture *Offline First*, PWA) après le premier chargement.
- **Stockage 100 % local** sur l'appareil (IndexedDB via Dexie.js), y compris les photos et documents joints.
- **Aucun serveur distant, aucune API externe, aucun abonnement** : tous les traitements (y compris la génération PDF/Word) s'exécutent sur l'appareil.
- **Sauvegarde / restauration** complète en un clic (archive ZIP structurée avec vérification d'intégrité SHA-256).
- **Responsive** : ordinateur, tablette, smartphone. Indicateur visuel **En ligne / Hors ligne**.
- **Architecture modulaire** : les modules futurs (référentiels techniques, destinataires, envoi d'e-mails — qui nécessitera Internet au moment de l'envoi, synchronisation multi-appareils, bibliothèques de contrôles) se greffent sans toucher au cœur.

## Pile technique

React 18 + TypeScript, Vite, Tailwind CSS, Dexie.js (IndexedDB), Service Worker + Cache Storage (vite-plugin-pwa / Workbox), jsPDF + autotable (PDF), `docx` (Word), JSZip (sauvegardes ZIP). Aucune dépendance serveur.

## Développement

```bash
npm install
npm run dev        # serveur de développement
npm run build      # production -> dossier dist/
npm run preview    # sert dist/ sur http://127.0.0.1:4173
```

## Distribution

### Solution A — application hébergée (recommandée)

Déployer le contenu du dossier `dist/` sur **n'importe quel hébergement statique en HTTPS** (ou un serveur local). Ouvrir l'URL dans Chrome/Edge/Firefox/Safari : le Service Worker met en cache tous les fichiers, l'application devient installable (écran d'accueil / bureau) et **fonctionne ensuite sans aucune connexion Internet**.

> Une PWA nécessite un contexte sécurisé (HTTPS, ou `localhost`) pour l'installation et le cache hors ligne — une simple ouverture de `index.html` en `file://` ne permet pas le Service Worker.

### Solution B — distribution autonome (sans hébergement)

Après `npm run build` :

```bash
python3 scripts/serve-dist.py        # ou : npm run serve:dist   -> http://127.0.0.1:8080
# ou : npm run preview                # -> http://127.0.0.1:4173
```

`localhost` étant un contexte sécurisé, le cache hors ligne fonctionne immédiatement. Aucune installation (Node.js, base de données, etc.) n'est requise pour l'utilisateur final : il suffit d'un navigateur et, pour la Solution B, d'un petit serveur statique fourni.

## Données stockées localement

Chantiers · PV (informations générales) · points de contrôle (phase, désignation, référence, résultat, observation) · résultats et non-conformités · photos (compressées automatiquement : max 1600 px, JPEG 82 %, légende, phase, lien vers un point de contrôle) · documents joints · historique · paramètres (charte graphique, logo, rappels).

La structure est **versionnée** (`schemaVersion`) : les futures mises à jour migrent les anciennes données **sans jamais les effacer automatiquement**.

## Sauvegarde

Page « Sauvegarde » : export ZIP (`manifest.json` + empreintes SHA-256 + `data.json` + `files/` binaires), import avec **vérification d'intégrité avant écriture**, mode *fusion* (recommandé) ou *remplacement* (avec confirmation). Rappel de sauvegarde paramétrable ; avertissement si le stockage local dépasse 80 % du quota.

## Avertissement sécurité

Sans authentification, la confidentialité des données repose sur la protection de l'appareil et du navigateur (code, chiffrement). Le stockage du navigateur n'est pas une sauvegarde permanente : exportez régulièrement vos données.

## Arborescence

```
src/
  db.ts               schéma Dexie + versioning
  types.ts            modèles de données
  lib/backup.ts       export/import ZIP + checksums
  lib/pdf.ts          génération PDF (jsPDF, hors ligne)
  lib/docx.ts         génération Word (docx, hors ligne)
  lib/photos.ts       compression d'images (canvas)
  lib/stockage.ts     quota navigateur
  components/         layout responsive, indicateur en ligne, galerie photos…
  pages/              tableau de bord, chantiers, PV, aperçu, sauvegarde, paramètres
```
