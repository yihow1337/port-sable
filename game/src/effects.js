// Short-lived decoration: muzzle flashes, blood, sparks, dust, engine smoke, shell casings and
// the tyre marks a car leaves when it slides. All of it is seeded, so a screenshot repeats.
import{range}from'./rng.js';const MAX_PARTICLES=420;const MAX_SKIDS=340;export function createEffects(){return{particles:[],skids:[],casings:[],flash:0,flashColor:'#ffd9a0'};}
function push(effects,particle){if(effects.particles.length>=MAX_PARTICLES)effects.particles.shift();effects.particles.push(particle);}
export function spawnBurst(effects,random,x,y,options){const count=options.count??8;for(let index=0;index<count;index+=1){const angle=(options.angle??0)+range(random,-(options.spread??Math.PI),options.spread??Math.PI);const speed=range(random,options.speed??40,(options.speed??40)*2.4);push(effects,{x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:range(random,options.life??0.3,(options.life??0.3)*1.9),age:0,size:range(random,options.size??2,(options.size??2)*2.1),color:options.color??'#ffcf86',drag:options.drag??3.4,rise:options.rise??0,glow:options.glow??false,});}
}
export function spawnMuzzleFlash(effects,random,x,y,angle){spawnBurst(effects,random,x,y,{count:5,angle,spread:0.3,speed:200,life:0.07,size:2.8,color:'#fff0c0',glow:true,drag:9});spawnBurst(effects,random,x,y,{count:2,angle,spread:0.8,speed:38,life:0.3,size:2.3,color:'rgba(208,198,180,0.3)',rise:-12,drag:2.4});effects.flash=Math.max(effects.flash,0.5);effects.flashColor='#ffe3ad';}
export function spawnBlood(effects,random,x,y,angle){spawnBurst(effects,random,x,y,{count:10,angle,spread:1.0,speed:95,life:0.36,size:2.6,color:'#b3322c',drag:5.5});}
export function spawnSparks(effects,random,x,y,angle){spawnBurst(effects,random,x,y,{count:9,angle:angle+Math.PI,spread:1.0,speed:150,life:0.2,size:1.9,color:'#ffd98a',glow:true,drag:7});spawnBurst(effects,random,x,y,{count:4,spread:Math.PI,speed:30,life:0.5,size:3.4,color:'rgba(150,142,128,0.45)',rise:-10});}
export function spawnDust(effects,random,x,y){spawnBurst(effects,random,x,y,{count:7,spread:Math.PI,speed:36,life:0.42,size:4.6,color:'rgba(222,206,180,0.5)',rise:-8,drag:2.6});}
export function spawnSmoke(effects,random,x,y,strength){spawnBurst(effects,random,x,y,{count:2,spread:Math.PI,speed:18,life:0.9+strength,size:5+strength*5,color:'rgba(70,64,60,0.4)',rise:-26,drag:1.1});}
export function spawnCasing(effects,random,x,y,angle){if(effects.casings.length>90)effects.casings.shift();effects.casings.push({x,y,vx:Math.cos(angle+1.6)*range(random,40,90),vy:Math.sin(angle+1.6)*range(random,40,90),age:0,life:9,angle:range(random,0,6.2)});}
export function spawnSkid(effects,x,y,angle,width,strength){if(effects.skids.length>=MAX_SKIDS)effects.skids.splice(0,8);const nx=-Math.sin(angle)*width*0.38;const ny=Math.cos(angle)*width*0.38;effects.skids.push({x:x-nx,y:y-ny,x2:x+nx,y2:y+ny,age:0,life:11,strength});}
export function updateEffects(effects,dt){const particles=effects.particles;for(let index=particles.length-1;index>=0;index-=1){const particle=particles[index];particle.age+=dt;if(particle.age>=particle.life){particles.splice(index,1);continue;}
particle.vx-=particle.vx*particle.drag*dt;particle.vy-=particle.vy*particle.drag*dt;particle.vy+=particle.rise*dt;particle.x+=particle.vx*dt;particle.y+=particle.vy*dt;}
for(let index=effects.casings.length-1;index>=0;index-=1){const casing=effects.casings[index];casing.age+=dt;if(casing.age>=casing.life){effects.casings.splice(index,1);continue;}
casing.vx-=casing.vx*5*dt;casing.vy-=casing.vy*5*dt;casing.x+=casing.vx*dt;casing.y+=casing.vy*dt;}
for(let index=effects.skids.length-1;index>=0;index-=1){const skid=effects.skids[index];skid.age+=dt;if(skid.age>=skid.life)effects.skids.splice(index,1);}
effects.flash=Math.max(0,effects.flash-dt*4.6);}
