"""Local-only allowlisted preview server. No production files served except named artwork."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote,urlsplit
import argparse
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
REF={
 '/report.md':HERE.parent.parent/'LAB_RESET_2_PLAYSPACE_VALIDATION.md',
 '/lab-reset-1/environment-world.png':HERE.parent/'lab-reset-1/environment-world.png',
 '/reference/environment.png':HERE.parent/'lab-reset-1/environment-world.png',
 '/reference/body.png':ROOT/'public/assets/world/player_body.png',
 '/reference/clothes.png':ROOT/'public/assets/world/player_clothes.png',
 '/reference/hair.png':ROOT/'public/assets/world/player_hair.png',
}
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,path):
  clean=unquote(urlsplit(path).path)
  if clean in REF:return str(REF[clean])
  p=(HERE/clean.lstrip('/')).resolve()
  if HERE!=p and HERE not in p.parents:return str(HERE/'NOT_FOUND')
  if p.name.startswith('.') or p.suffix in ['.py']:return str(HERE/'NOT_FOUND')
  return str(p)
 def end_headers(self):
  self.send_header('Cache-Control','no-store');super().end_headers()
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8766);args=parser.parse_args()
 print(f'Preview http://127.0.0.1:{args.port}/',flush=True)
 ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
