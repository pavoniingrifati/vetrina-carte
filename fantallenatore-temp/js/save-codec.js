(() => {
  'use strict';

  const PREFIX='FZ1:';
  const RESET_CODE=32767;

  function baseDictionary(){
    const dictionary=new Map();
    for(let index=0;index<256;index+=1) dictionary.set(String.fromCharCode(index),index);
    return dictionary;
  }

  function compress(text){
    const bytes=new TextEncoder().encode(text);
    if(!bytes.length) return '';
    let dictionary=baseDictionary(),next=256,current='';
    const codes=[];
    const reset=()=>{dictionary=baseDictionary();next=256;};
    for(const byte of bytes){
      const character=String.fromCharCode(byte),candidate=current+character;
      if(dictionary.has(candidate)){current=candidate;continue;}
      if(current) codes.push(dictionary.get(current));
      if(next<RESET_CODE) dictionary.set(candidate,next++);
      else{codes.push(RESET_CODE);reset();}
      current=character;
    }
    if(current) codes.push(dictionary.get(current));
    let output='';
    const chunkSize=8192;
    for(let index=0;index<codes.length;index+=chunkSize){
      output+=String.fromCharCode(...codes.slice(index,index+chunkSize).map(code=>code+32));
    }
    return output;
  }

  function decompress(data){
    if(!data) return '';
    let dictionary=[];
    const reset=()=>{dictionary=Array.from({length:256},(_,index)=>String.fromCharCode(index));};
    reset();
    let next=256,previous=null;
    const chunks=[];
    for(let index=0;index<data.length;index+=1){
      const code=data.charCodeAt(index)-32;
      if(code===RESET_CODE){reset();next=256;previous=null;continue;}
      let entry;
      if(code>=0&&code<next&&dictionary[code]!==undefined) entry=dictionary[code];
      else if(code===next&&previous!==null) entry=previous+previous.charAt(0);
      else throw new Error('Salvataggio compresso non valido');
      chunks.push(entry);
      if(previous!==null&&next<RESET_CODE) dictionary[next++]=previous+entry.charAt(0);
      previous=entry;
    }
    const byteString=chunks.join('');
    const bytes=new Uint8Array(byteString.length);
    for(let index=0;index<byteString.length;index+=1) bytes[index]=byteString.charCodeAt(index)&255;
    return new TextDecoder().decode(bytes);
  }

  function encode(json){
    try{
      const compressed=compress(json);
      const packed=PREFIX+compressed;
      return packed.length<json.length?packed:json;
    }catch(error){
      console.warn('Compressione save non disponibile, uso JSON normale',error);
      return json;
    }
  }

  function decode(stored){
    if(typeof stored!=='string'||!stored.startsWith(PREFIX)) return stored;
    return decompress(stored.slice(PREFIX.length));
  }

  window.FantaSaveCodec=Object.freeze({PREFIX,compress,decompress,encode,decode});
})();

