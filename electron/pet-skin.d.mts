export interface SkinInfo{mime:string;extension:string;width:number;height:number;key:string}
export function inspectSkin(data:Buffer):SkinInfo
export function saveSkin(root:string,data:Buffer):Promise<SkinInfo&{dataUrl:string}>
export function readSkin(root:string,key:string):Promise<string>
