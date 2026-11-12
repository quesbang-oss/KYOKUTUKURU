#!/usr/bin/env node
// アプリ本体（index.html / src / icons）を www/ にコピーする。Capacitor はここを Android アプリに取り込む。
import { cp, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const www = path.join(root, 'www');
await rm(www, { recursive: true, force: true });
await mkdir(www, { recursive: true });
for (const f of ['index.html', 'src', 'icons']) await cp(path.join(root, f), path.join(www, f), { recursive: true });
console.log('ビルド完了: www/');
