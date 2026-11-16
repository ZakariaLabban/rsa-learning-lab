"""Deterministic RFC 8017 byte-encoding fixtures; standard-library hashes only."""
import argparse
import hashlib
import json
from pathlib import Path

OUTPUT = Path(__file__).resolve().parents[1] / 'frontend/src/engine/__vectors__/encoding-vectors.json'

def mgf(seed, length):
    return b''.join(hashlib.sha256(seed+i.to_bytes(4,'big')).digest() for i in range((length+31)//32))[:length]

def xor(a,b): return bytes(x^y for x,y in zip(a,b,strict=True))

def generate():
    message=b'RFC 8017 deterministic fixture';seed=bytes(range(32));salt=bytes(range(31,-1,-1))
    oaep=[];pss=[]
    for size in (128,256):
        db=hashlib.sha256(b'').digest()+bytes(size-len(message)-66)+b'\x01'+message
        masked=xor(db,mgf(seed,size-33))
        encoded=b'\x00'+xor(seed,mgf(masked,32))+masked
        oaep.append({'size':size,'encoded':encoded.hex()})
    for bits in (1024,1025,1026,2048):
        em_bits=bits-1;length=(em_bits+7)//8
        h=hashlib.sha256(bytes(8)+hashlib.sha256(message).digest()+salt).digest()
        db=bytes(length-66)+b'\x01'+salt
        masked=bytearray(xor(db,mgf(h,length-33)));masked[0]&=255>>(8*length-em_bits)
        pss.append({'bits':bits,'encoded':(bytes(masked)+h+b'\xbc').hex()})
    return json.dumps({'message':message.hex(),'seed':seed.hex(),'salt':salt.hex(),
        'sha256':hashlib.sha256(message).hexdigest(),'mgf1_79':mgf(seed,79).hex(), 'oaep':oaep,'pss':pss},indent=2)+'\n'

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    expected=generate()
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding='utf-8')!=expected:raise SystemExit('Encoding fixtures are stale.')
        print('Encoding fixtures are reproducible.')
    else:OUTPUT.write_text(expected,encoding='utf-8');print('Wrote encoding fixtures.')
