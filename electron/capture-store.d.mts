export interface CaptureRecord { id:string; timestamp:number; title:string; thumbnail:string; width:number; height:number; bytes:number; favorite:boolean; deletedAt:number|null }
export interface CaptureState { records:CaptureRecord[]; settings:{enabled:boolean;textEnabled:boolean}; bytes:number; maxBytes:number; warning:string|null }
export class CaptureStore {
  root:string;records:CaptureRecord[];settings:CaptureState['settings'];warning:string|null;
  constructor(root:string,maxBytes?:number);
  load():Promise<CaptureState>;state():CaptureState;
  add(png:Buffer,thumbnail:string,size:{width:number;height:number}):Promise<CaptureRecord>;
  update(ids:string[],patch:Partial<CaptureRecord>):Promise<CaptureState>;
  configure(patch:Partial<CaptureState['settings']>):Promise<CaptureState>;
  image(id:string):Promise<Buffer>;
  export(ids:string[],parent:string):Promise<{count:number;destination:string}>;
  emptyTrash():Promise<CaptureState>;
}
