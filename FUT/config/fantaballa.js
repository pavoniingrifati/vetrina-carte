'use strict';
window.FUTTU_CONFIG = {
  id: 'fantaballa',
  pageTitle: 'FUT Fantaballa!',
  brand: 'Fantaballa FC',
  description: 'Pacchetti esclusivi Fantaballa FC.',
  openingTheme: {
    id: 'fantaballa',
    atmosphere: 'stadium',
    primaryColor: '#4ee5d8',
    secondaryColor: '#1f9dff',
    accentColor: '#ffe76a',
    backgroundColor: '#07111d',
    surfaceColor: '#0d1c2d',
    eyebrow: 'FANTABALLA FC • PACK OPENING',
    readyText: 'Clicca per aprire subito',
    walkoutRarities: ['Ultra Rara','Season','Leggendaria'],
    walkoutSeries: ['Legend','Leggendaria','Tots','Dream'],
    sound: true
  },
  cardsSources: ['data/cards.json', 'cards.json', 'data/cards-fantaballa.json', '../cards.json'],
  cardGameNames: ['Fantaballa FC'],
  sharedGameNames: ['', 'Svincolato', 'Svicolato', 'Shared', 'Globale', 'Global'],
  defaultPack: 'Patatine',
  homeUrl: 'https://pavoniingrifati.github.io/vetrina-carte/',
  myCardsUrl: 'https://pavoniingrifati.github.io/vetrina-carte/my-cards',
  sections: {
    featured: ['Patatine','Dannazione','Fantaballa Tots','Legend','Gold','Silver','Bronze'],
    stock: ['Fantaballa Tots','Legend','Strumenti','Sfere del drago'],
    foryou: ['Patatine','Dannazione','Legend','Gold'],
    classic: ['Gold','Silver','Bronze'],
    stadium: ['Oggetti','Cosmetic','Strumenti'],
    all: '*'
  },
  packs: [
    { name:'Patatine', kind:'finite', size:1, cost:0, scope:'mode', excludeSeries:['Leggendaria'], cover:'img/patatrine.png', description:'Contiene 1 carta Fantaballa FC. Pacchetto veloce, semplice e immediato.' },
    { name:'Dannazione', kind:'infinite', size:1, cost:0, scope:'mode-or-shared', series:['Cursed'], cover:'img/back%20dannazione.png', description:'Contiene 1 carta della serie Cursed. Selezionalo e aprilo quando vuoi.' },
    { name:'Fantaballa Tots', kind:'finite', size:3, cost:0, scope:'mode', series:['Tots'], tagsAny:['Tots16'], cover:'img/Deck%20back%20Tots.png', description:'Contiene 3 carte Tots16 di Fantaballa FC.' },
    { name:'Legend', kind:'fantaballa-legend-finite', size:3, cost:0, scope:'mode', cover:'img/Back%20legend.png', description:'Contiene 3 carte Fantaballa rare o superiori, con possibilità di carte speciali.' },
    { name:'Oggetti', kind:'infinite', size:3, cost:0, scope:'mode-or-shared', series:['Oggetto'], cover:'img/Deck%20back%20tactcs.png', description:'Contiene 3 carte Oggetto utilizzabili nella tua collezione.' },
    { name:'Gold', kind:'composite', size:9, cost:600, cover:'img/Deck%20back%20ORO.png', parts:[{count:3,scope:'mode-or-shared',series:['Oggetto']},{count:6,scope:'mode',series:['Gold']}], description:'Contiene 9 carte: 3 oggetti e 6 carte della serie Gold.' },
    { name:'Silver', kind:'composite', size:9, cost:0, cover:'img/Deck%20back%20argento.png', parts:[{count:3,scope:'mode-or-shared',series:['Oggetto']},{count:6,scope:'mode',series:['Silver']}], description:'Contiene 9 carte: 3 oggetti e 6 carte della serie Silver.' },
    { name:'Bronze', kind:'composite', size:9, cost:0, cover:'img/Deck%20back%20bronzo.png', parts:[{count:3,scope:'mode-or-shared',series:['Oggetto']},{count:6,scope:'mode',series:['Bronze']}], description:'Contiene 9 carte: 3 oggetti e 6 carte della serie Bronze.' },
    { name:'Cosmetic', kind:'infinite', size:1, cost:0, scope:'mode-or-shared', series:['Cosmetic'], cover:'img/Deck%20back%20cosmetic.png', description:'Contiene 1 cosmetic casuale.' },
    { name:'Strumenti', kind:'finite', size:3, cost:0, scope:'mode', series:['Strumento'], copies:2, uniqueWithinPack:true, cover:'img/Deck%20back%20strumenti.png', description:'Contiene 3 strumenti dedicati a Fantaballa FC.' },
    { name:'Sfere del drago', kind:'finite', size:1, cost:0, scope:'mode', series:['Leggendaria'], cover:'img/Back%20sfere.png', description:'Contiene 1 carta Leggendaria di Fantaballa FC.' }
  ]
};
