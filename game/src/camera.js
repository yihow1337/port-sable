// A follow camera that eases toward whatever Riley is riding in, leads his velocity a little,
// pulls out as he speeds up, and shakes when he is hit. It also owns the world/screen transforms
// everything else draws through.
import{CAMERA,VIEW,WORLD}from'./config.js';export function createCamera(x,y){return{x,y,zoom:CAMERA.footZoom,targetZoom:CAMERA.footZoom,shake:0,shakeX:0,shakeY:0,phase:0};}
export function snapCamera(camera,game){const focus=focusOf(game);camera.x=focus.x;camera.y=focus.y;camera.zoom=focus.zoom;camera.targetZoom=focus.zoom;clamp(camera);}
function focusOf(game){const player=game.player;const vehicle=player.vehicle;if(vehicle){const speed=Math.hypot(vehicle.vx,vehicle.vy);const pull=Math.min(1,speed/vehicle.kind.topSpeed);return{x:vehicle.x+vehicle.vx*CAMERA.lead,y:vehicle.y+vehicle.vy*CAMERA.lead,zoom:CAMERA.driveZoom-pull*0.1,};}
return{x:player.x+player.vx*CAMERA.lead*0.5,y:player.y+player.vy*CAMERA.lead*0.5,zoom:CAMERA.footZoom,};}
function clamp(camera){const halfWidth=VIEW.width/2/camera.zoom;const halfHeight=VIEW.height/2/camera.zoom;camera.x=Math.max(halfWidth-150,Math.min(WORLD.width-halfWidth+150,camera.x));camera.y=Math.max(halfHeight-190,Math.min(WORLD.height-halfHeight+40,camera.y));}
export function updateCamera(camera,game,dt){const focus=focusOf(game);const ease=1-Math.exp(-CAMERA.lerp*dt);camera.x+=(focus.x-camera.x)*ease;camera.y+=(focus.y-camera.y)*ease;camera.targetZoom=focus.zoom;camera.zoom+=(camera.targetZoom-camera.zoom)*(1-Math.exp(-CAMERA.zoomLerp*dt));camera.phase+=dt*37;camera.shake=Math.max(0,camera.shake-CAMERA.shakeDecay*dt);const amount=Math.min(CAMERA.maxShake,camera.shake);camera.shakeX=Math.sin(camera.phase*1.7)*amount;camera.shakeY=Math.cos(camera.phase*2.3)*amount;clamp(camera);}
export function worldToScreen(camera,x,y){return{x:(x-camera.x)*camera.zoom+VIEW.width/2+camera.shakeX,y:(y-camera.y)*camera.zoom+VIEW.height/2+camera.shakeY,};}
export function screenToWorld(camera,x,y){return{x:(x-VIEW.width/2-camera.shakeX)/camera.zoom+camera.x,y:(y-VIEW.height/2-camera.shakeY)/camera.zoom+camera.y,};}
export function viewBounds(camera,pad){const halfWidth=VIEW.width/2/camera.zoom+pad;const halfHeight=VIEW.height/2/camera.zoom+pad;return{x:camera.x-halfWidth,y:camera.y-halfHeight,w:halfWidth*2,h:halfHeight*2};}
