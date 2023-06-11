import sys
import os

os.system('')

print('\x1b[37m')

need_load_err = True

exit_codes = {
  '2': 'ERR_STACK_UNDERFLOW',
  '3': 'ERR_STACK_OVERFLOW',
  '4': 'ERR_INTEGER_OVERFLOW',
  '5': 'ERR_INTEGER_OUT_OF_RANGE',
  '6': 'ERR_INVALID_OPCODE',
  '7': 'ERR_TYPE_CHECK',
  '8': 'ERR_CELL_OVERFLOW',
  '9': 'ERR_CELL_UNDERFLOW',
  '10': 'ERR_DICT',
  '13': 'ERR_OUT_OF_GAS',
  '32': 'ERR_INVALID_ACTION_LIST',
  '34': 'ERR_ACTION_UNSUPPORTED',
  '37': 'ERR_NOT_ENOUGH_TON',
  '38': 'ERR_NOT_ENOUGH_CURRENCY'
}

with open(__file__ + '/../toncli.log', 'r', encoding='utf-8') as f:
  debug_line_tostr = False
  
  for line in f:
    # if not line.strip(): continue
    if '_io.TextIO' in line: continue
    if 'detached' in line: continue
    
    need_load_err = False
    
    for d in (31, 32, 36, 0):
      line = line.replace('\x1b[%dm' % d, '')
    if '[ 3]' in line:
      continue
      line = ('\x1b[36m' +
              line.removeprefix('[ 3][t 0]')
                  .replace('9223372036854775807', 'UMAX')
                  .replace('[vm.cpp:558]', '[vm558]') + '\x1b[37m')
    
    line = line.removeprefix('INFO: ')
    
    for (code, desc) in exit_codes.items():
      c2 = int(code) + 200
      line = line.replace(f'code: [{code}]', f'code: [{code} | {desc}]')
      line = line.replace(f'code: [{c2}]', f'code: [{c2} | CALLEE_{desc}]')
    
    if line.strip() == '#DEBUG#: s0 = 4445':
      debug_line_tostr = True
      continue
    elif line.startswith('#DEBUG#') and debug_line_tostr:
      debug_line_tostr = False
      try:
        n = int(line.removeprefix('#DEBUG#: s0 = ').rstrip())
        s = ''
        while n:
          s = s + chr(n % 256)
          n //= 256
        line = '\x1b[36m DEBUG : ' + s[::-1] + '\x1b[37m\n'
      except:
        pass
    
    if 'Test' in line and 'AsmTests' not in line:
      color = '\x1b[37m'
      if 'SUCCESS' in line: color = '\x1b[32m'
      if 'FAIL' in line: color = '\x1b[33m'
      
      line = (line
        .replace('[SUCCESS] Test', 'OK,')
        .replace('[FAIL]', 'RE')
        .replace(' Total gas used (including testing code)', ', gas usage')
      )
      
      gas_usage = int(line[line.rfind('[')+1:line.rfind(']')])
      ton_usage = gas_usage * 10**-6
      if '_get]' in line:
        ton_s = ' (offchain request)'
      elif '_transfer]' in line:
        ton_s = ' (money transfer)'
      elif 'init_contract]' in line:
        ton_s = ' (one-time initialization)'
      elif ton_usage > 0.01:
        ton_s = '\x1b[33m (%.5f TON == %.2f req/TON)' % (ton_usage, 1/ton_usage)
      else:
        ton_s = '\x1b[32m (%.5f TON == %.2f req/TON)' % (ton_usage, 1/ton_usage)
      
      line = color + line.rstrip().replace('__test_', '', 1).replace('status: ', '', 1) + ton_s + '\x1b[37m\n'
    
    print(line.replace('\r', ''), end='')

red_border = '\n\x1b[41m\x1b[30m                                        \x1b[40m\x1b[37m\n'

with open(__file__ + '/../toncli.err', 'r', encoding='utf-8') as f:
  skipping_traceback = False
  
  for line in f:
    if '--- Logging error ---' in line: continue
    
    if line.startswith('Traceback'):
      skipping_traceback = True
    elif line.startswith('Arguments') or line.startswith('subprocess'):
      skipping_traceback = False
      continue
    
    if skipping_traceback: continue
    
    if red_border:
      print(red_border)
      red_border = ''
    
    if 'func/' in line or 'func\\' in line:
      path, remainder = line.split(': ', 1)
      print(('\x1b[33m%s: \x1b[37m%s' % (path, remainder)))
    else:
      print(line, end='')
