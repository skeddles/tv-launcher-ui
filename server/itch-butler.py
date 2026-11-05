#!/usr/bin/env python3
"""Update a game installed by the itch app, without the itch app's window.

Uses the itch app's own butler (its download/install tool) and database, the
same way the itch app does: butler runs as a daemon and is driven over its
JSON-RPC protocol (https://docs.itch.zone/butlerd/master/): CheckUpdate, then
Install.Queue + Install.Perform. Only the changes are downloaded when the game
is published as builds (tested Nov 2026: 1.4 MB of patches for a 105 MB game).

    python3 -I itch-butler.py update <caveId>

Prints one JSON object per line: {"progress": 0.42}, {"log": "..."},
{"done": true, "version": "1.8.0"} or {"done": true, "version": null} (no
update), {"error": "..."}. Don't run it while the itch app is open (both use
the same database).
"""
import glob
import json
import os
import socket
import subprocess
import sys

ITCH = os.path.expanduser('~/.var/app/io.itch.itch/config/itch')
DB = os.path.join(ITCH, 'db', 'butler.db')


def out(**kw):
    print(json.dumps(kw), flush=True)


def butler_path():
    found = sorted(glob.glob(os.path.join(ITCH, 'broth/butler/versions/*/butler')))
    if not found:
        raise RuntimeError("the itch app hasn't downloaded butler yet (open the itch app once)")
    return found[-1]


class Butler:
    def __init__(self):
        self.proc = subprocess.Popen(
            [butler_path(), 'daemon', '--json', '--transport', 'tcp', '--dbpath', DB, '--destiny-pid', str(os.getpid())],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )
        secret = addr = None
        for line in self.proc.stdout:
            try:
                m = json.loads(line)
            except ValueError:
                continue
            if m.get('type') == 'butlerd/listen-notification':
                secret, addr = m['secret'], m['tcp']['address']
                break
        if not addr:
            raise RuntimeError('butler did not start')
        host, port = addr.rsplit(':', 1)
        self.sock = socket.create_connection((host, int(port)), timeout=600)
        self.f = self.sock.makefile('rw')
        self.next_id = 0
        self.call('Meta.Authenticate', {'secret': secret})

    def call(self, method, params):
        self.next_id += 1
        rid = self.next_id
        self.f.write(json.dumps({'jsonrpc': '2.0', 'id': rid, 'method': method, 'params': params}) + '\n')
        self.f.flush()
        while True:
            line = self.f.readline()
            if not line:
                raise RuntimeError('butler stopped')
            m = json.loads(line)
            if m.get('id') == rid and ('result' in m or 'error' in m):
                if 'error' in m:
                    raise RuntimeError(m['error'].get('message') or str(m['error']))
                return m['result']
            name, prm = m.get('method'), m.get('params') or {}
            if name == 'Progress':
                out(progress=prm.get('progress', 0))
            elif name == 'Log' and prm.get('level') in ('info', 'warning', 'error'):
                out(log=prm.get('message', ''))
            elif 'id' in m:
                # butler asking us something (not seen for updates): answer neutrally
                self.f.write(json.dumps({'jsonrpc': '2.0', 'id': m['id'], 'result': {}}) + '\n')
                self.f.flush()

    def close(self):
        try:
            self.proc.terminate()
        except OSError:
            pass


def update(cave):
    b = Butler()
    try:
        updates = b.call('CheckUpdate', {'caveIds': [cave]}).get('updates') or []
        if not updates or not updates[0].get('choices'):
            out(done=True, version=None)
            return
        choice = updates[0]['choices'][0]
        q = b.call('Install.Queue', {'caveId': cave, 'reason': 'update', 'upload': choice['upload'], 'build': choice.get('build')})
        b.call('Install.Perform', {'id': q['id'], 'stagingFolder': q['stagingFolder']})
        out(done=True, version=(choice.get('build') or {}).get('userVersion') or '')
    finally:
        b.close()


if __name__ == '__main__':
    try:
        if len(sys.argv) != 3 or sys.argv[1] != 'update':
            raise RuntimeError('usage: itch-butler.py update <caveId>')
        update(sys.argv[2])
    except Exception as e:  # reported to the launcher, which shows it
        out(error=str(e))
        sys.exit(1)
