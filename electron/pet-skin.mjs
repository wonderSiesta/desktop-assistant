import {createHash,randomUUID} from 'node:crypto'
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises'
import {join} from 'node:path'
const MAX_BYTES=10*1024*1024
export function inspectSkin(data){
  if(!Buffer.isBuffer(data)||data.length<12)throw new Error('请选择有效的 PNG、JPG、GIF 或 WebP 图片。')
  if(data.length>MAX_BYTES)throw new Error('形象图片不能超过 10 MB。')
  let mime,extension,width=0,height=0
  if(data.subarray(0,8).toString('hex')==='89504e470d0a1a0a'&&data.length>=24&&data.toString('ascii',12,16)==='IHDR'){mime='image/png';extension='png';width=data.readUInt32BE(16);height=data.readUInt32BE(20)}
  else if(/^GIF8[79]a$/.test(data.toString('ascii',0,6))){mime='image/gif';extension='gif';width=data.readUInt16LE(6);height=data.readUInt16LE(8)}
  else if(data[0]===255&&data[1]===216&&data[2]===255){
    mime='image/jpeg';extension='jpg';let i=2
    while(i+8<data.length){if(data[i++]!==255)continue;let marker=data[i++];while(marker===255&&i<data.length)marker=data[i++];if(marker===0xda||marker===0xd9)break;if(marker===0xd8||marker===0x01||marker>=0xd0&&marker<=0xd7)continue;const length=data.readUInt16BE(i);if(length<2||i+length>data.length)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){height=data.readUInt16BE(i+3);width=data.readUInt16BE(i+5);break}i+=length}
  }else if(data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP'&&data.length>=30){
    mime='image/webp';extension='webp';const type=data.toString('ascii',12,16)
    if(type==='VP8X'){width=data.readUIntLE(24,3)+1;height=data.readUIntLE(27,3)+1}
    else if(type==='VP8L'&&data[20]===0x2f){const bits=data.readUInt32LE(21);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1}
    else if(type==='VP8 '&&data.subarray(23,26).toString('hex')==='9d012a'){width=data.readUInt16LE(26)&0x3fff;height=data.readUInt16LE(28)&0x3fff}
  }
  if(!mime||!width||!height)throw new Error('无法识别图片内容，请重新导出为 PNG、JPG、GIF 或 WebP。')
  if(width>4096||height>4096)throw new Error('形象尺寸不能超过 4096 × 4096，请先缩小图片。')
  return {mime,extension,width,height,key:createHash('sha256').update(data).digest('hex')+'.'+extension}
}
export async function saveSkin(root,data){const info=inspectSkin(data);await mkdir(root,{recursive:true});const file=join(root,info.key),temporary=file+'.'+randomUUID()+'.tmp';await writeFile(temporary,data);await rename(temporary,file);return {...info,dataUrl:`data:${info.mime};base64,${data.toString('base64')}`}}
export async function readSkin(root,key){if(!/^[a-f0-9]{64}\.(png|jpg|gif|webp)$/.test(key||''))throw new Error('无效形象文件');const data=await readFile(join(root,key));const info=inspectSkin(data);if(info.key!==key)throw new Error('形象文件已损坏，请重新上传。');return `data:${info.mime};base64,${data.toString('base64')}`}
