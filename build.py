#!/usr/bin/python3
import base64
import shutil
import sys
import os

FIFT_LIBS_LIST = 'Fift Asm AsmTests TonUtil Lists Color'.split(' ')
CONTRACTS_LIST = 'plugin registry wallet'.split(' ')

ap = os.path.abspath

base_path = ap(__file__ + '/../')
fift_path = os.environ['FIFTPATH']

print('====== Starting build ====================')

os.system('cls')    # clears screen + enables escape sequences

for fift_lib in FIFT_LIBS_LIST:
  shutil.copy(ap(f'{fift_path}toncli/lib/fift-libs/{fift_lib}.fif'),
              ap(f'{base_path}/{fift_lib}.fif'))

print('====== Loaded libs for toncli ============')

with open(ap(base_path + '/fift/exotic.fif')) as f:
  exotic_patch = f.read()

with open(ap(base_path + '/Asm.fif'), 'a') as f: f.write(exotic_patch)
with open(ap(base_path + '/AsmTests.fif'), 'a') as f: f.write(exotic_patch)

print('====== Patched Fift libraries ============')

os.chdir(base_path)
os.system('toncli run_tests >toncli.log 2>toncli.err')
os.system('python show-log.py')

print('====== Ran tests =========================')

os.system('toncli build')

print('====== Built contract in prod mode =======')

for contract in CONTRACTS_LIST:
  with open(ap(base_path + f'/build/{contract}.fif'), 'a') as f:
    f.write(f'\nboc>B "build/boc/{contract}.boc" B>file')
  os.system(f'toncli fift run build/{contract}.fif')
  
  with open(ap(f'build/boc/{contract}.boc'), 'rb') as rf:
    boc = rf.read()
    print(f'====== BOC of {repr(contract)} is {len(boc)} B')
    with open(ap(f'build/boc/{contract}.hex'), 'wb') as wf:
      wf.write(base64.b64encode(boc))
  
  print(f'====== Saved {repr(contract)} in BOC and HEX representation')

if '--noclean' not in sys.argv:
  for fift_lib in FIFT_LIBS_LIST:
    os.remove(ap(f'{base_path}/{fift_lib}.fif'))
  
  print('====== Deleted Fift libs =================')
