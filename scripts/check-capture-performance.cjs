// Uses only a generated 4K image; never reads the user's clipboard or screenshot library.
const {app,nativeImage}=require('electron')
const {pathToFileURL}=require('node:url')
const {join}=require('node:path')
app.whenReady().then(async()=>{
  let exitCode=0
  try{
    const {createCollector}=await import(pathToFileURL(join(__dirname,'../electron/capture-collector.mjs')).href)
    const width=3840,height=2160,bitmap=Buffer.alloc(width*height*4)
    for(let i=0;i<bitmap.length;i+=4){bitmap[i]=(i>>4)%256;bitmap[i+1]=(i>>9)%256;bitmap[i+2]=(i>>15)%256;bitmap[i+3]=255}
    async function measure(useRevision){
      let encodes=0,reads=0
      const readImage=()=>{
        reads++
        // Each native clipboard read returns a fresh NativeImage, without cached PNG bytes.
        const image=nativeImage.createFromBitmap(bitmap,{width,height})
        return {isEmpty:()=>image.isEmpty(),toPNG:()=>{encodes++;return image.toPNG()},getSize:()=>image.getSize(),resize:options=>image.resize(options)}
      }
      const collector=createCollector({store:{settings:{enabled:true}},readRevision:()=>useRevision?'same':null,readImage,onChange:()=>{},onError:error=>{throw error}})
      collector.baseline();encodes=0;reads=0
      const start=performance.now();let maxTickMs=0
      for(let i=0;i<40;i++){const tick=performance.now();await collector.poll();maxTickMs=Math.max(maxTickMs,performance.now()-tick)}
      return {ticks:40,imageReads:reads,pngEncodes:encodes,totalMs:Math.round(performance.now()-start),maxTickMs:Math.round(maxTickMs*100)/100}
    }
    const previous=await measure(false),current=await measure(true)
    console.log(JSON.stringify({syntheticImage:'3840x2160',previous,current}))
    if(current.pngEncodes!==0||current.imageReads!==0)throw new Error('Unchanged clipboard was processed')
  }catch(error){console.error(error);exitCode=1}finally{app.exit(exitCode)}
})
