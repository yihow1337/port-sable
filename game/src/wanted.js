// Wanted level 0-5 and the police who answer it. Crimes add heat; heat only cools once no officer
// and no cruiser has had a clear line on Riley for a few seconds, and it cools far faster inside
// the hideout. Each star buys the dispatcher another cruiser; two stars and they open fire.
import{AIR,COP,PED,WANTED}from'./config.js';import{nearestNode,nodeAtDistance,solidsNear}from'./city.js';import{copFire,damagePlayer}from'./combat.js';import{createVehicle,damageVehicle,driveVehicle,vehicleSpeed}from'./vehicles.js';import{alertPeds}from'./peds.js';import{spawnSmoke}from'./effects.js';import{range}from'./rng.js';import{createAir,dismissAir,updateAir}from'./air.js';export function starsFor(heat){let stars=0;for(let index=1;index<WANTED.thresholds.length;index+=1){if(heat>=WANTED.thresholds[index])stars=index;}
return stars;}
export function createWanted(){return{heat:0,stars:0,unseen:0,seen:false,spawnTimer:1.2,bustTimer:0,flash:0,lastCrime:'',unit:11,lit:false};}
function callsign(game){game.wanted.unit=(game.wanted.unit%89)+1;return`HP-${String(game.wanted.unit).padStart(2,'0')}`;}
export function dispatchList(game){const player=game.player;const units=[];for(const vehicle of game.vehicles){if(vehicle.role!=='police'||vehicle.abandoned)continue;const away=Math.hypot(vehicle.x-player.x,vehicle.y-player.y);units.push({callsign:vehicle.callsign??'HP-00',role:vehicle.dead?'DOWN':vehicle.blocking?'ROADBLOCK':vehicle.deployed?'ON FOOT':away<170?'RAMMING':'PURSUIT',metres:Math.round(away*0.09),down:Boolean(vehicle.dead),});}
units.sort((a,b)=>a.metres-b.metres);if(game.air){units.unshift({callsign:game.air.callsign,role:game.wanted.lit?'SPOTLIGHT ON':'SEARCHING',metres:Math.round(Math.hypot(game.air.x-player.x,game.air.y-player.y)*0.09),air:true,});}
return units.slice(0,5);}
export function addHeat(game,crime){const amount=WANTED.crimes[crime]??0;if(amount===0)return;const before=game.wanted.stars;game.wanted.heat=Math.min(WANTED.thresholds[5]+180,game.wanted.heat+amount);game.wanted.stars=starsFor(game.wanted.heat);game.wanted.unseen=0;game.wanted.flash=1;game.wanted.lastCrime=crime;game.player.respect+=amount*0.3;if(game.wanted.stars>before){game.audio.wantedUp(game.wanted.stars);game.toast(`Wanted level ${game.wanted.stars}`);}
}
export function clearHeat(game){dismissAir(game);game.wanted.heat=0;game.wanted.stars=0;game.wanted.unseen=0;game.wanted.bustTimer=0;for(const cop of game.cops)cop.state='leave';for(const vehicle of game.vehicles){if(vehicle.role==='police')vehicle.siren=false;}
}
export function hasLineOfSight(city,ax,ay,bx,by){const dx=bx-ax;const dy=by-ay;const distance=Math.hypot(dx,dy);const steps=Math.min(26,Math.max(2,Math.round(distance/46)));for(let step=1;step<steps;step+=1){const x=ax+(dx*step)/steps;const y=ay+(dy*step)/steps;for(const solid of solidsNear(city,x,y,2)){if(solid.kind==='circle'){if(Math.hypot(x-solid.x,y-solid.y)<solid.radius)return false;}else if(x>solid.x&&x<solid.x+solid.w&&y>solid.y&&y<solid.y+solid.h){return false;}
}
}
return true;}
function createCop(random,x,y,angle){return{x,y,angle,aimAngle:angle,health:COP.health,fireTimer:range(random,0.3,0.9),state:'chase',muzzle:0,phase:random()*6.2,timer:0,scream:0,};}
function dispatchCruiser(game){const{city,random,player}=game;const nodeIndex=nodeAtDistance(city,player.x,player.y,1150,random);const node=city.nodes[nodeIndex];const toward=Math.atan2(player.y-node.y,player.x-node.x);const cruiser=createVehicle(random,'cruiser',node.x,node.y,toward,'police');cruiser.callsign=callsign(game);cruiser.driver='police';cruiser.siren=true;cruiser.mode=game.wanted.stars>=WANTED.blockStars&&game.random()<0.4?'block':'chase';cruiser.node=nodeIndex;cruiser.vx=Math.cos(toward)*120;cruiser.vy=Math.sin(toward)*120;game.vehicles.push(cruiser);game.audio.siren(true);return cruiser;}
function liveCruisers(game){let count=0;for(const vehicle of game.vehicles){if(vehicle.role==='police'&&!vehicle.dead&&!vehicle.abandoned)count+=1;}
return count;}
function graphTarget(game,cruiser,targetX,targetY){const city=game.city;if(cruiser.waypointNode===undefined||cruiser.waypointNode<0){cruiser.waypointNode=nearestNode(city,cruiser.x,cruiser.y);}
let node=city.nodes[cruiser.waypointNode];if(Math.hypot(node.x-cruiser.x,node.y-cruiser.y)<62){let best=cruiser.waypointNode;let bestDistance=Math.hypot(node.x-targetX,node.y-targetY);for(const link of node.links){const other=city.nodes[link];const distance=Math.hypot(other.x-targetX,other.y-targetY);if(distance<bestDistance){bestDistance=distance;best=link;}
}
cruiser.waypointNode=best;node=city.nodes[best];}
return{x:node.x,y:node.y};}
function drivePursuit(game,cruiser,dt){const player=game.player;const targetVehicle=player.vehicle;let targetX=player.x;let targetY=player.y;if(targetVehicle){targetX+=targetVehicle.vx*0.55;targetY+=targetVehicle.vy*0.55;}
if(cruiser.mode==='block'){if(!cruiser.blockPoint){const ahead=nodeAtDistance(game.city,targetX,targetY,520,game.random);cruiser.blockPoint={x:game.city.nodes[ahead].x,y:game.city.nodes[ahead].y};}
const reach=Math.hypot(cruiser.blockPoint.x-cruiser.x,cruiser.blockPoint.y-cruiser.y);if(reach<60){const broadside=Math.atan2(targetY-cruiser.y,targetX-cruiser.x)+Math.PI/2;let turn=((broadside-cruiser.angle+Math.PI*3)%(Math.PI*2))-Math.PI;driveVehicle(game.city,cruiser,dt,{throttle:vehicleSpeed(cruiser)>20?-1:0,steer:Math.max(-1,Math.min(1,turn*2)),handbrake:true});cruiser.blocking=true;return;}
targetX=cruiser.blockPoint.x;targetY=cruiser.blockPoint.y;}
const range=Math.hypot(targetX-cruiser.x,targetY-cruiser.y);if(range>300&&cruiser.mode!=='block'){const waypoint=graphTarget(game,cruiser,targetX,targetY);targetX=waypoint.x;targetY=waypoint.y;}
const dx=targetX-cruiser.x;const dy=targetY-cruiser.y;const distance=Math.hypot(dx,dy);const want=Math.atan2(dy,dx);const difference=((want-cruiser.angle+Math.PI*3)%(Math.PI*2))-Math.PI;let throttle=range>120?1:-0.35;if(Math.abs(difference)>1.5&&vehicleSpeed(cruiser)>150)throttle=-0.5;cruiser.stuck=vehicleSpeed(cruiser)<14?cruiser.stuck+dt:0;let steer=Math.max(-1,Math.min(1,difference*2.1));if(cruiser.stuck>1.6){throttle=-0.9;steer=-steer;if(cruiser.stuck>3.4)cruiser.stuck=0;}
driveVehicle(game.city,cruiser,dt,{throttle,steer,handbrake:false});}
export function updateWanted(game,dt){const wanted=game.wanted;const player=game.player;wanted.flash=Math.max(0,wanted.flash-dt*1.6);wanted.stars=starsFor(wanted.heat);if(wanted.stars>=AIR.stars&&!game.air){const away=1500;const bearing=Math.PI*0.25;game.air=createAir(player.x-Math.cos(bearing)*away,player.y-Math.sin(bearing)*away,bearing);game.toast(`${AIR.callsign} is up`);}else if(wanted.stars<AIR.stars&&game.air&&!game.air.leaving){dismissAir(game);}
wanted.lit=updateAir(game,dt);let seen=wanted.lit;for(const vehicle of game.vehicles){if(vehicle.role!=='police'||vehicle.dead)continue;if(Math.hypot(vehicle.x-player.x,vehicle.y-player.y)>WANTED.sightRange)continue;if(hasLineOfSight(game.city,vehicle.x,vehicle.y,player.x,player.y)){seen=true;break;}
}
if(!seen){for(const cop of game.cops){if(cop.health<=0)continue;if(Math.hypot(cop.x-player.x,cop.y-player.y)>WANTED.sightRange)continue;if(hasLineOfSight(game.city,cop.x,cop.y,player.x,player.y)){seen=true;break;}
}
}
wanted.seen=seen;if(seen)wanted.unseen=0;else wanted.unseen+=dt;if(wanted.heat>0&&wanted.unseen>WANTED.coolDelay){wanted.heat=Math.max(0,wanted.heat-(player.hiding?WANTED.hideCool:WANTED.cool)*dt);if(wanted.heat===0)clearHeat(game);}
wanted.spawnTimer-=dt;const allowed=WANTED.maxCruisers[wanted.stars];if(wanted.stars>0&&wanted.unseen<3.5&&wanted.spawnTimer<=0&&liveCruisers(game)<allowed){dispatchCruiser(game);wanted.spawnTimer=Math.max(1.6,5.2-wanted.stars*0.7);}
for(const cruiser of game.vehicles){if(cruiser.role!=='police')continue;cruiser.lightPhase+=dt*9;if(cruiser.dead){cruiser.siren=false;spawnSmoke(game.effects,game.random,cruiser.x,cruiser.y,1);continue;}
if(wanted.stars===0){cruiser.siren=false;cruiser.abandoned=true;cruiser.driver=null;continue;}
if(cruiser.driver!=='police')continue;cruiser.siren=true;drivePursuit(game,cruiser,dt);const distance=Math.hypot(cruiser.x-player.x,cruiser.y-player.y);const shouldDeploy=distance<COP.leaveCarRange&&(!player.vehicle||wanted.stars>=WANTED.blockStars||cruiser.blocking);if(shouldDeploy&&!cruiser.deployed&&vehicleSpeed(cruiser)<90){cruiser.deployed=true;cruiser.driver=null;const side=Math.cos(cruiser.angle+Math.PI/2);const sideY=Math.sin(cruiser.angle+Math.PI/2);for(let seat=0;seat<(wanted.stars>=3?2:1);seat+=1){const sign=seat===0?1:-1;game.cops.push(createCop(game.random,cruiser.x+side*20*sign,cruiser.y+sideY*20*sign,cruiser.angle));}
alertPeds(game.peds,cruiser.x,cruiser.y,180,game.random);}
}
for(let index=game.cops.length-1;index>=0;index-=1){const cop=game.cops[index];cop.scream=Math.max(0,cop.scream-dt);cop.muzzle=Math.max(0,(cop.muzzle??0)-dt*9);if(cop.health<=0){cop.timer+=dt;if(cop.timer>40)game.cops.splice(index,1);continue;}
if(wanted.stars===0||cop.state==='leave'){cop.timer+=dt;if(cop.timer>6)game.cops.splice(index,1);continue;}
const dx=player.x-cop.x;const dy=player.y-cop.y;const distance=Math.hypot(dx,dy)||1;cop.angle=Math.atan2(dy,dx);cop.aimAngle=cop.angle;const closing=distance>(wanted.stars>=WANTED.shootStars?150:24);if(closing){const speed=126;const stepX=cop.x+(dx/distance)*speed*dt;const stepY=cop.y+(dy/distance)*speed*dt;const moved=game.city?stepInCity(game,stepX,stepY):{x:stepX,y:stepY};cop.x=moved.x;cop.y=moved.y;cop.phase+=dt*13;}
if(wanted.stars>=WANTED.shootStars&&hasLineOfSight(game.city,cop.x,cop.y,player.x,player.y))copFire(game,cop,dt);if(!player.vehicle&&distance<30){wanted.bustTimer+=dt;if(wanted.bustTimer>1.3)game.onBusted('busted');}else{wanted.bustTimer=Math.max(0,wanted.bustTimer-dt*0.5);}
}
if(player.vehicle){for(const cruiser of game.vehicles){if(cruiser.role!=='police'||cruiser.dead)continue;const distance=Math.hypot(cruiser.x-player.vehicle.x,cruiser.y-player.vehicle.y);if(distance>46)continue;const closing=Math.abs(player.vehicle.forward)+Math.abs(cruiser.forward);if(closing>150&&!cruiser.rammed){cruiser.rammed=0.8;damageVehicle(cruiser,closing*0.1);damageVehicle(player.vehicle,closing*0.07);damagePlayer(game,2,cruiser.angle);addHeat(game,'ramPolice');}
}
}
for(const cruiser of game.vehicles){if(cruiser.rammed)cruiser.rammed=Math.max(0,cruiser.rammed-dt);}
}
function stepInCity(game,x,y){const result=game.collide(x,y,PED.radius);return result;}
