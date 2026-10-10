/* Track composed nodes once per adapter; preserve nodes, listeners and original anchors. */
(function(){
 'use strict';
 function create(document){
  const locations=new Map();
  return Object.freeze({
   register(node){
    if(!node)return null;
    if(locations.has(node))return locations.get(node);
    const marker=document.createComment('mobile original position');node.before(marker);
    const location=Object.freeze({
     moveTo(parent){if(parent&&node.parentNode!==parent)parent.appendChild(node);},
     restore(){if(marker.parentNode&&(node.parentNode!==marker.parentNode||node.previousSibling!==marker))marker.after(node);},
     release(){this.restore();marker.remove();locations.delete(node);}
    });
    locations.set(node,location);return location;
   },
   restoreAll(){for(const location of locations.values())location.restore();},
   releaseAll(){for(const location of [...locations.values()])location.release();}
  });
 }
 if(typeof module==='object'&&module.exports)module.exports={create};
 else window.FantaMobileLocations=Object.freeze({create});
})();
