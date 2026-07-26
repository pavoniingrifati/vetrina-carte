'use strict';
window.FUTTU_CONFIG = {
  id: 'gotham',
  pageTitle: 'FUT Gotham City!',
  brand: 'Gotham City FC',
  description: 'Pacchetti esclusivi Gotham City FC.',
  cardsSources: ['cards (3).json', 'data/cards-gotham.json', 'cards.json', '../cards (3).json'],
  cardGameNames: ['Gotham City', 'Gotham City FC'],
  sharedGameNames: ['', 'Svincolato', 'Shared', 'Globale', 'Global'],
  defaultPack: 'Patatine',
  homeUrl: 'https://pavoniingrifati.github.io/vetrina-carte/',
  myCardsUrl: 'https://pavoniingrifati.github.io/vetrina-carte/my-cards',
  sections: {
    featured: ['Patatine','Dannazione','Gotham Tots','Legend','Fusion2','Gold','Silver','Bronze'],
    stock: ['Gotham Tots','Legend','Fusion2','Strumenti'],
    foryou: ['Patatine','Dannazione','Legend','Fusion2'],
    classic: ['Gold','Silver','Bronze'],
    stadium: ['Oggetti','Cosmetic','Strumenti'],
    all: '*'
  },
  packs: [
    { name:'Patatine', kind:'finite', size:1, cost:0, scope:'mode', excludeRarity:['Season','Leggendaria'], weightByRarity:{'Comune':4,'Non Comune':3,'Rara':2,'Ultra Rara':1}, cover:'patatrine.png', description:'Contiene 1 carta Gotham City FC, con rarità pesate.' },
    { name:'Dannazione', kind:'finite', size:1, cost:0, scope:'mode-or-shared', series:['Cursed'], cover:'img/back%20dannazione.png', description:'Contiene 1 carta Cursed. I pacchetti sono finiti.' },
    { name:'Gotham Tots', kind:'finite', size:3, cost:0, scope:'mode', anyOf:[{tagsAny:['Tots12','Tots13']},{nameIncludesAny:['tots12','tots13']}], cover:'Deck%20back%20Tots.png', description:'Contiene 3 carte TOTS12 o TOTS13 di Gotham City FC.' },
    { name:'Legend', kind:'gotham-legend-infinite', size:3, cost:0, scope:'mode', cover:'Back%20legend.png', description:'Contiene 2 carte normali e una carta finale speciale.' },
    { name:'Fusion2', kind:'finite', size:3, cost:0, scope:'mode', anyOf:[{series:['Fusion2']},{tagsAny:['Fusion2']}], cover:'img/fusione2%20back.png', description:'Contiene 3 carte Fusion2 di Gotham City FC.' },
    { name:'Oggetti', kind:'infinite', size:3, cost:0, scope:'mode-or-shared', series:['Oggetto'], cover:'Deck%20back%20tactcs.png', description:'Contiene 3 carte Oggetto utilizzabili nella tua collezione.' },
    { name:'Gold', kind:'composite', size:9, cost:0, cover:'Deck%20back%20oro%20BATMAN.png', parts:[{count:3,scope:'mode',series:['Oggetto']},{count:6,scope:'mode',series:['Gold']}], description:'Contiene 9 carte: 3 oggetti e 6 carte della serie Gold.' },
    { name:'Silver', kind:'composite', size:9, cost:0, cover:'Deck%20back%20argento%20BATMAN.png', parts:[{count:3,scope:'mode',series:['Oggetto']},{count:6,scope:'mode',series:['Silver']}], description:'Contiene 9 carte: 3 oggetti e 6 carte della serie Silver.' },
    { name:'Bronze', kind:'composite', size:9, cost:0, cover:'Deck%20back%20bronzo%20BATMAN.png', parts:[{count:3,scope:'mode',series:['Oggetto']},{count:6,scope:'mode',series:['Bronze']}], description:'Contiene 9 carte: 3 oggetti e 6 carte della serie Bronze.' },
    { name:'Strumenti', kind:'finite', size:3, cost:0, scope:'mode', series:['Strumento'], copies:2, uniqueWithinPack:true, cover:'Deck%20back%20strumenti.png', description:'Contiene 3 strumenti dedicati a Gotham City FC.' },
    { name:'Cosmetic', kind:'infinite', size:1, cost:0, scope:'mode-or-shared', series:['Cosmetic'], cover:'Deck%20back%20cosmetic.png', description:'Contiene 1 cosmetic casuale.' }
  ]
};
