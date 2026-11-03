const clamp=(value,min,max)=>Math.max(min,Math.min(value,Math.max(min,max)))
export function fitBounds(point,size,area,snap=0){
  const width=Math.min(size.width,area.width),height=Math.min(size.height,area.height)
  let x=clamp(point.x,area.x,area.x+area.width-width),y=clamp(point.y,area.y,area.y+area.height-height)
  if(snap>0){if(x-area.x<=snap)x=area.x;else if(area.x+area.width-width-x<=snap)x=area.x+area.width-width;if(y-area.y<=snap)y=area.y;else if(area.y+area.height-height-y<=snap)y=area.y+area.height-height}
  return {x:Math.round(x),y:Math.round(y),width:Math.round(width),height:Math.round(height)}
}
export function anchorFor(bounds,area,displayId){return {displayId,xRatio:area.width===bounds.width?0:(bounds.x-area.x)/(area.width-bounds.width),yRatio:area.height===bounds.height?0:(bounds.y-area.y)/(area.height-bounds.height)}}
export function restoreAnchor(anchor,size,area){return fitBounds({x:area.x+(area.width-size.width)*clamp(anchor?.xRatio??.97,0,1),y:area.y+(area.height-size.height)*clamp(anchor?.yRatio??.97,0,1)},size,area)}
export function panelBounds(pet,size,area){const left=pet.x+pet.width/2>area.x+area.width/2;return fitBounds({x:left?pet.x-size.width-12:pet.x+pet.width+12,y:pet.y+pet.height-size.height},size,area)}
export function movedEnough(start,current){return Math.hypot(current.x-start.x,current.y-start.y)>=6}
