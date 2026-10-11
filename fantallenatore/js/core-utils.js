(() => {
  'use strict';

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const clamp = (number, minimum, maximum) => Math.max(minimum, Math.min(maximum, number));

  function randomHash(value) {
    const text=String(value||'');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 100000) / 100000;
  }

  function shuffledCopy(list, random=Math.random) {
    const output=list.slice();
    for(let index=output.length-1;index>0;index-=1){
      const target=Math.floor(random()*(index+1));
      [output[index],output[target]]=[output[target],output[index]];
    }
    return output;
  }

  function playerInitials(name) {
    const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
    if(!parts.length) return 'PL';
    if(parts.length===1) return parts[0].slice(0,2).toUpperCase();
    return (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
  }

  window.FantaCoreUtils=Object.freeze({delay,clamp,randomHash,shuffledCopy,playerInitials});
})();

