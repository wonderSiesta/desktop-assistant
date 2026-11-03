export interface Rect {x:number;y:number;width:number;height:number}
export interface Anchor {displayId:number;xRatio:number;yRatio:number}
export function fitBounds(point:{x:number;y:number},size:{width:number;height:number},area:Rect,snap?:number):Rect
export function anchorFor(bounds:Rect,area:Rect,displayId:number):Anchor
export function restoreAnchor(anchor:Anchor|null,size:{width:number;height:number},area:Rect):Rect
export function panelBounds(pet:Rect,size:{width:number;height:number},area:Rect):Rect
export function movedEnough(start:{x:number;y:number},current:{x:number;y:number}):boolean
