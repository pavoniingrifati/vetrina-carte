(function(){
 'use strict';
 function init(){
  const grid=document.getElementById('visibleRivals');if(!grid)return;
  const phone=window.matchMedia('(max-width:780px), (max-width:1024px) and (pointer:coarse)');
  const dots=document.createElement('nav');dots.className='mobile-rivals-dots';dots.setAttribute('aria-label','Pagine degli avversari');grid.after(dots);
  let selected=0,cards=[];
  function show(index){
   selected=Math.max(0,Math.min(Math.ceil(cards.length/2)-1,index));
   cards.forEach((card,i)=>{
    if(phone.matches&&(i<selected*2||i>=selected*2+2)){card.style.setProperty('display','none','important');card.setAttribute('aria-hidden','true');}
    else{card.style.removeProperty('display');card.removeAttribute('aria-hidden');}
   });
   Array.from(dots.children).forEach((button,i)=>button.setAttribute('aria-current',i===selected?'true':'false'));
  }
  function build(){
   cards=Array.from(grid.children).filter(node=>node.classList.contains('visible-rival-card'));
   dots.replaceChildren();
   for(let i=0;i<Math.ceil(cards.length/2);i++){
    const button=document.createElement('button');button.type='button';button.setAttribute('aria-label','Avversari: pagina '+(i+1)+' di '+Math.ceil(cards.length/2));button.addEventListener('click',()=>show(i));dots.appendChild(button);
   }
   show(selected);
  }
  new MutationObserver(build).observe(grid,{childList:true});
  phone.addEventListener('change',()=>show(selected));
  let startX=0,startY=0;
  grid.addEventListener('touchstart',event=>{startX=event.touches[0].clientX;startY=event.touches[0].clientY;},{passive:true});
  grid.addEventListener('touchend',event=>{const dx=event.changedTouches[0].clientX-startX,dy=event.changedTouches[0].clientY-startY;if(phone.matches&&Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy))show(selected+(dx<0?1:-1));},{passive:true});
  build();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
