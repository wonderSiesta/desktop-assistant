export interface PetLife {affection:number;energy:number;sleeping:boolean;lastAction:number;lastActive:number;serial:number;action:string;message:string}
export function createPetLife(saved?:{affection?:number;energy?:number;sleeping?:boolean},now?:number):PetLife
export function reactPet(life:PetLife,action:string,now?:number):boolean
export function petLifeSave(life:PetLife):{affection:number;energy:number;sleeping:boolean}
