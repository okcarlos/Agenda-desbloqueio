// Uso: node decrypt.js arquivo.ieva arquivo.dump
// Solicita IEV_BACKUP_PASSPHRASE no ambiente local; não imprima a senha em logs.
import { readFile, writeFile } from 'node:fs/promises'
import { scryptSync,createDecipheriv } from 'node:crypto'
const [src,dst]=process.argv.slice(2)
if(!src||!dst||!process.env.IEV_BACKUP_PASSPHRASE)throw new Error('Informe arquivo.ieva, saída.dump e IEV_BACKUP_PASSPHRASE')
const b=await readFile(src)
if(b.toString('ascii',0,4)!=='IEV6'||b.length<64)throw new Error('Formato inválido')
const salt=b.subarray(4,20),iv=b.subarray(20,32),tag=b.subarray(b.length-16)
const key=scryptSync(process.env.IEV_BACKUP_PASSPHRASE,salt,32,{N:16384,r:8,p:1})
const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag)
const plain=Buffer.concat([decipher.update(b.subarray(32,b.length-16)),decipher.final()])
await writeFile(dst,plain,{mode:0o600,flag:'wx'})
console.log('Arquivo descriptografado e autenticado; valide com pg_restore --list antes de restaurar em ambiente separado.')
