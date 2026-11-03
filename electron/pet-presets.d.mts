export const PET_PRESETS:{id:string;name:string;description:string;kind:string;folder:string}[]
export function presetId(key?:string|null):string|null
export function animationFor(id:string,view?:{sleeping?:boolean;held?:boolean;motion?:boolean;action?:string;serial?:number;phase?:string}):string
