// Synthetic local fixtures for UI checks. Never reads the real clipboard.
import {deflateSync} from 'node:zlib'
import {CaptureStore} from '../electron/capture-store.mjs'
import {resolve} from 'node:path'
const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0})
function chunk(type,data){const name=Buffer.from(type),body=Buffer.concat([name,data]),result=Buffer.alloc(data.length+12);result.writeUInt32BE(data.length);body.copy(result,4);let crc=0xffffffff;for(const b of body)crc=table[(crc^b)&255]^(crc>>>8);result.writeUInt32BE((crc^0xffffffff)>>>0,result.length-4);return result}
function image(theme){const width=600,height=360,header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;const pixels=Buffer.alloc(height*(width*3+1));for(let y=0;y<height;y++)for(let x=0;x<width;x++){let c=y<35?[25,39,61]:[241,244,248];if(y>60&&x>24&&x<150)c=theme;if(y>65&&x>175&&x<565&&y%48<29)c=[211,222,235];if(y>245&&x>175&&x<350)c=theme;const offset=y*(width*3+1)+1+x*3;pixels[offset]=c[0];pixels[offset+1]=c[1];pixels[offset+2]=c[2];}return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))])}
const store=new CaptureStore(resolve(process.argv[2]||'data/ui-demo','captures'));await store.load();await store.configure({enabled:false})
if(!store.records.length){for(const [index,color] of [[0,[80,145,220]],[1,[77,163,125]],[2,[191,135,80]],[3,[135,110,185]]]){const png=image(color),record=await store.add(png,'data:image/png;base64,'+png.toString('base64'),{width:600,height:360});await store.update([record.id],{title:['示例 · 项目资料','示例 · 工作笔记','示例 · 数据对比','示例 · 页面参考'][index],favorite:index===0});}}
console.log('Synthetic demo library prepared; collection is paused.')
