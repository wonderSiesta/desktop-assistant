import { mkdir, readFile, writeFile, rename, copyFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'

export class CaptureStore {
  constructor(root, maxBytes = 2 * 1024 ** 3) {
    this.root = root; this.maxBytes = maxBytes
    this.records = []; this.settings = { enabled: true, textEnabled: false }
    this.queue = Promise.resolve(); this.warning = null
  }
  async load() {
    await mkdir(join(this.root, 'images'), { recursive: true })
    let data
    try { data = JSON.parse(await readFile(join(this.root, 'index.json'), 'utf8')) }
    catch (e) {
      if (e.code !== 'ENOENT') {
        try { data = JSON.parse(await readFile(join(this.root, 'index.backup.json'), 'utf8')); this.warning = '索引损坏，已从备份恢复。' }
        catch { throw new Error('截图索引损坏，原图仍保存在本机 images 目录；请先备份，不要覆盖。') }
      }
    }
    if (data) {
      if (!Array.isArray(data.records) || data.records.some(r => !/^[a-f0-9-]{36}$/.test(r.id))) throw new Error('截图索引格式无效，原图已保留。')
      this.records = data.records
      this.settings = { ...this.settings, ...data.settings }
    }
    return this.state()
  }
  state() { return { records: this.records.map(r => ({ ...r })), settings: { ...this.settings }, bytes: this.records.reduce((n,r)=>n+r.bytes,0), maxBytes: this.maxBytes, warning: this.warning } }
  run(action) { const operation = this.queue.then(action); this.queue = operation.catch(()=>{}); return operation }
  async persist() {
    const target = join(this.root, 'index.json'), temp = target + '.tmp'
    try { const current = await readFile(target); await writeFile(join(this.root,'index.backup.json.tmp'),current); await rename(join(this.root,'index.backup.json.tmp'),join(this.root,'index.backup.json')) } catch(e) { if(e.code!=='ENOENT')throw e }
    await writeFile(temp,JSON.stringify({records:this.records,settings:this.settings}),'utf8'); await rename(temp,target)
  }
  add(png, thumbnail, size) {
    return this.run(async()=>{
      if (!Buffer.isBuffer(png) || png.length<8 || png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a') throw new Error('不是有效的 PNG 图片')
      if(this.state().bytes+png.length>this.maxBytes)throw new Error('截图库已达到 2 GB 上限，请导出并清理回收站后继续。')
      const id=randomUUID(), timestamp=Date.now(), target=join(this.root,'images',id+'.png')
      await writeFile(target+'.tmp',png);await rename(target+'.tmp',target)
      const record={id,timestamp,title:'截图 '+new Date(timestamp).toLocaleString('zh-CN',{hour12:false}),thumbnail,width:size.width,height:size.height,bytes:png.length,favorite:false,deletedAt:null}
      const previous=this.records;this.records=[record,...this.records]
      try{await this.persist()}catch(e){this.records=previous;throw new Error('图片已写入但索引保存失败，请检查磁盘空间。原图已保留。')}
      return record
    })
  }
  update(ids, patch) {
    return this.run(async()=>{
      if(!Array.isArray(ids)||ids.length>10000)throw new Error('无效的截图选择')
      const selected=new Set(ids),previous=this.records
      this.records=this.records.map(r=>selected.has(r.id)?{...r,...patch,id:r.id}:r)
      try{await this.persist()}catch(e){this.records=previous;throw e}return this.state()
    })
  }
  configure(patch) {
    return this.run(async()=>{const previous=this.settings;this.settings={...previous,...patch};try{await this.persist()}catch(e){this.settings=previous;throw e}return this.state()})
  }
  async image(id) {
    await this.queue
    if(!this.records.some(r=>r.id===id))throw new Error('截图不存在')
    return readFile(join(this.root,'images',id+'.png'))
  }
  async export(ids, parent) {
    await this.queue
    const records=this.records.filter(r=>ids.includes(r.id)&&!r.deletedAt)
    if(!records.length)throw new Error('请先选择截图')
    const destination=join(parent,'Screenshots-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,6))
    await mkdir(destination)
    let count=0
    try {for(const r of [...records].reverse()){await copyFile(join(this.root,'images',r.id+'.png'),join(destination,String(++count).padStart(3,'0')+'-'+r.id+'.png'),constants.COPYFILE_EXCL)}}
    catch {throw new Error('导出未完成，已导出的文件仍在所选目录的新文件夹中，请检查空间和权限后重试。')}
    return {count,destination}
  }
  emptyTrash() {
    return this.run(async()=>{
      const trash=this.records.filter(r=>r.deletedAt),previous=this.records
      this.records=this.records.filter(r=>!r.deletedAt)
      try{await this.persist()}catch(e){this.records=previous;throw e}
      let failed=0
      for(const r of trash){try{await unlink(join(this.root,'images',r.id+'.png'))}catch(e){if(e.code!=='ENOENT')failed++}}
      // Do not retain references to deliberately deleted images in the recovery index.
      await writeFile(join(this.root,'index.backup.json'),JSON.stringify({records:this.records,settings:this.settings}),'utf8')
      if(failed)throw new Error('记录已移除，部分原图未能清理，请检查本机截图数据目录。')
      return this.state()
    })
  }
}
