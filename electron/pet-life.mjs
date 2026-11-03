const clamp=n=>Math.max(0,Math.min(100,Math.round(Number(n)||0)))
export function createPetLife(saved={},now=Date.now()){
  return {affection:clamp(saved.affection??20),energy:clamp(saved.energy??80),sleeping:saved.sleeping===true,lastAction:0,lastActive:now,serial:0,action:'idle',message:'单击摸摸我，双击打开助手'}
}
export function reactPet(life,action,now=Date.now()){
  if(!['pat','feed','play','sleep','wake','land','idle'].includes(action))return false
  if(action==='idle'){
    if(life.sleeping||now-life.lastActive<25000)return false
    life.action=now-life.lastActive>180000?'doze':'stretch';life.serial++;return true
  }
  if(now-life.lastAction<700)return false
  life.lastAction=now;life.lastActive=now;life.serial++
  if(action==='sleep'){
    life.sleeping=true;life.action='sleep';life.message='我眯一会儿，截图还会帮你收好。';return true
  }
  if(action==='wake'||life.sleeping){
    life.sleeping=false;life.energy=clamp(life.energy+20);life.action='wake';life.message='醒啦！还想和你玩一会儿。';return true
  }
  if(action==='pat'){life.affection=clamp(life.affection+1);life.action='pat';life.message=life.affection>=60?'最喜欢和你待在一起啦！':'摸摸头，今天也陪着你。'}
  if(action==='feed'){life.energy=clamp(life.energy+15);life.affection=clamp(life.affection+2);life.action='feed';life.message='啊呜！小鱼干真好吃～'}
  if(action==='play'){
    if(life.energy<10){life.action='doze';life.message='玩累啦，喂我一点小鱼干吧。'}
    else{life.energy=clamp(life.energy-8);life.affection=clamp(life.affection+2);life.action='play';life.message='转个圈圈！你的截图我也会看好。'}
  }
  if(action==='land'){life.action='land';life.message='落地！这里就是我的新位置啦。'}
  return true
}
export function petLifeSave(life){return {affection:life.affection,energy:life.energy,sleeping:life.sleeping}}
