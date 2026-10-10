// Synchronous lifecycle notifications. No game state or controller dependencies.
(() => {
  'use strict';
  function create(){
    const listeners = {tick: new Set(), expired: new Set()};
    function channel(type){
      if(!Object.hasOwn(listeners,type)) throw new TypeError(`Unknown auction clock event: ${type}`);
      return listeners[type];
    }
    return Object.freeze({
      subscribe(type,listener){
        if(typeof listener !== 'function') throw new TypeError('Listener required');
        const subscribers=channel(type);
        subscribers.add(listener);
        return () => subscribers.delete(listener);
      },
      publish(type){
        for(const listener of [...channel(type)]) listener();
      }
    });
  }
  window.FantaAuctionClockEvents=Object.freeze({create});
})();
