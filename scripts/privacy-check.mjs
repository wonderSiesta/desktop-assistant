import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=JSON.parse(await readFile(path.join(root,'release-files.json'),'utf8'));
const binaries=new Map(JSON.parse(await readFile(path.join(root,'binary-assets.json'),'utf8')).map(x=>[x.path,x]));
const issues=[];
for(const name of files){
  if(path.isAbsolute(name)||name.includes('..')||name.includes('\\')||/(^|\/)(\.runtime|data|node_modules|dist|dist-electron|build-output|screenshots|\.git)(\/|$)|\.(lnk|log|exe|zip)$/i.test(name))throw new Error('Unsafe source path');
  const full=path.join(root,name);if((await lstat(full)).isSymbolicLink())throw new Error('Unexpected symlink');
  const bytes=await readFile(full),binary=binaries.get(name);
  if(binary){if(bytes.length!==binary.bytes||createHash('sha256').update(bytes).digest('hex')!==binary.sha256)issues.push(name+': changed binary asset');continue;}
  if(bytes.includes(0)){issues.push(name+': unreviewed binary');continue;}
  const text=bytes.toString('utf8');
  if(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})\b|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|\b[A-Za-z]:\\[^\s<>"'`]+/.test(text))issues.push(name+': potential private content');
}
if(issues.length){console.error(issues.join('\n'));process.exitCode=1;}
else console.log(`Desktop Assistant privacy check passed: ${files.length} approved files, ${binaries.size} verified public media assets; local state excluded.`);
