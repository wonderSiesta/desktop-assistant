import {createHash} from 'node:crypto'
export function createCollector({store,readImage,readRevision=()=>null,onChange,onError,onSaved=()=>{}}) {
  let seen='',revision=null,suspended=false,busy=false
  const fingerprint=png=>createHash('sha256').update(png).digest('hex')
  const baseline=()=>{const next=readRevision(),image=readImage();seen=image.isEmpty()?'':fingerprint(image.toPNG());revision=next}
  function save(image,png){const size=image.getSize(),scale=Math.min(320/size.width,200/size.height,1);return store.add(png,image.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale))}).toDataURL(),size)}
  return {
    baseline,
    setSuspended(value){suspended=value},
    ownCopy(image){seen=fingerprint(image.toPNG())},
    async importCurrent(){const image=readImage();if(image.isEmpty())throw new Error('当前剪贴板没有图片，请先截图。');const png=image.toPNG();seen=fingerprint(png);const result=await save(image,png);onSaved(result);onChange();return result},
    async poll(){
      if(!store.settings.enabled||suspended||busy)return
      busy=true
      try{
        const next=readRevision();if(next!==null&&next===revision)return
        const image=readImage();if(image.isEmpty()){seen='';revision=next;return}
        const png=image.toPNG(),current=fingerprint(png);revision=next;if(current===seen)return;seen=current
        try{const record=await save(image,png);onSaved(record);onChange()}
        catch(error){await store.configure({enabled:false}).catch(()=>{});onError(error);onChange()}
      }catch(error){onError(error)}finally{busy=false}
    }
  }
}
