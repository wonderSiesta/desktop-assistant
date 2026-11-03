import type {CaptureStore,CaptureRecord} from './capture-store.mjs'
import type {NativeImage} from 'electron'
export function createCollector(options:{store:CaptureStore;readImage:()=>NativeImage;readRevision?:()=>string|null;onChange:()=>void;onError:(error:unknown)=>void;onSaved?:(record:CaptureRecord)=>void}):{
  baseline:()=>void;setSuspended:(value:boolean)=>void;ownCopy:(image:NativeImage)=>void;importCurrent:()=>Promise<CaptureRecord>;poll:()=>Promise<unknown>
}
