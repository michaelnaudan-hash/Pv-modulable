#!/usr/bin/env python3
"""Serveur local autonome pour la version de production (dossier dist/).

Usage : python3 scripts/serve-dist.py [port]   (défaut : 8080)

Sert dist/ sur http://127.0.0.1:<port> — un contexte sécurisé (localhost),
ce qui permet au navigateur d'enregistrer le Service Worker : après le
premier chargement, l'application fonctionne entièrement hors ligne.
Aucune installation requise au-delà de Python 3 (présent sur la plupart
des ordinateurs ; sinon utiliser `npx serve dist` ou `npm run preview`).
"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dist')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Pas de cache : pour que les mises à jour soient bien prises en compte
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write('[pv-chantier] %s\n' % (fmt % args))


if __name__ == '__main__':
    if not os.path.isdir(ROOT):
        sys.exit('Dossier dist/ introuvable : exécutez d\u2019abord `npm run build`.')
    with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler) as srv:
        print(f'Application disponible sur http://127.0.0.1:{PORT} (Ctrl+C pour arrêter)')
        print('Ouvrez cette adresse dans Chrome/Edge/Firefox/Safari, puis laissez le navigateur mettre l\u2019application en cache.')
        print('Ensuite, débranchez Internet : tout continue de fonctionner.')
        srv.serve_forever()
