'use strict';
window.FUTTU_CONFIG = {
  id: 'gotham',
  pageTitle: 'FUT Gotham City!',
  brand: 'Gotham City FC',
  description: 'Pacchetti esclusivi Gotham City FC.',
  openingTheme: {
    id: 'gotham',
    atmosphere: 'dark-rain',
    primaryColor: '#8f6cff',
    secondaryColor: '#2e9cff',
    accentColor: '#ffd55d',
    backgroundColor: '#05060c',
    surfaceColor: '#12101d',
    eyebrow: 'GOTHAM CITY FC • NIGHT OPENING',
    readyText: 'La notte sta per rivelare la carta',
    walkoutRarities: ['Ultra Rara','Season','Leggendaria'],
    walkoutSeries: ['Legend','Leggendaria','Tots','Dark','Dark Souls','Fusion2'],
    sound: true
  },
  cardsSources: ['data/cards.json'],
  cardGameNames: ['Gotham City', 'Gotham City FC', 'Gotahm City'],
  sharedGameNames: ['', 'Svincolato', 'Svicolato', 'Shared', 'Globale', 'Global'],
  defaultPack: 'Patatine',
  homeUrl: 'index.html',
  myCardsUrl: 'my-cards/',
  sections: {
    featured: ['Patatine','Dannazione','Gotham Tots','World Cup','Legend','Fusion2','Gold','Silver','Bronze'],
    stock: ['Gotham Tots','Legend','Fusion2','Strumenti'],
    foryou: ['Patatine','Dannazione','Legend','Fusion2'],
    classic: ['Gold','Silver','Bronze'],
    stadium: ['Oggetti','Cosmetic','Strumenti'],
    all: '*'
  },
  packs: [
    { name:'Patatine', kind:'finite', size:1, cost:0, referenceCost:20000, referenceCurrency:'likes', scope:'mode', excludeRarity:['Season','Leggendaria'], weightByRarity:{'Comune':4,'Non Comune':3,'Rara':2,'Ultra Rara':1}, cover:'img/patatrine.webp', description:'Contiene 1 carta Gotham City FC, con rarità pesate.' },
    { name:'Dannazione', kind:'finite', size:1, cost:0, referenceCost:0, referenceCurrency:'none', scope:'mode-or-shared', series:['Cursed'], cover:'img/back%20dannazione.webp', description:'Contiene 1 carta Cursed. I pacchetti sono finiti.' },
    { name:'Gotham Tots', kind:'finite', size:3, cost:0, scope:'mode', anyOf:[{tagsAny:['Tots12','Tots13']},{nameIncludesAny:['tots12','tots13']}], cover:'img/Deck%20back%20Tots.webp', description:'Contiene 3 carte TOTS12 o TOTS13 di Gotham City FC.' },
    { name:'World Cup', kind:'finite', size:3, cost:0, referenceCost:1500, referenceCurrency:'coins', scope:'mode', series:['World Cup'], uniqueWithinPack:true, cover:'img/back%20world.webp', description:'Contiene carte World Cup di Gotham City FC. Nessun doppione: ogni carta compare una sola volta nella sequenza dei pacchetti.' },
    { name:'Legend', kind:'gotham-legend-infinite', size:3, cost:0, scope:'mode', cover:'img/Back%20legend.webp', description:'Contiene 2 carte normali e una carta finale speciale.' },
    { name:'Fusion2', kind:'finite', size:3, cost:0, scope:'mode', anyOf:[{series:['Fusion2']},{tagsAny:['Fusion2']}], cover:'img/fusione2%20back.webp', description:'Contiene 3 carte Fusion2 di Gotham City FC.' },
    { name:'Oggetti', kind:'infinite', size:3, cost:0, scope:'mode-or-shared', series:['Oggetto'], cover:'img/Deck%20back%20tactcs.webp', description:'Contiene 3 carte Oggetto utilizzabili nella tua collezione.' },
    { name:'Gold', kind:'composite', size:9, cost:0, referenceCost:800, referenceCurrency:'coins', cover:'img/Deck%20back%20oro%20BATMAN.webp', parts:[{count:3,scope:'mode',series:['Oggetto']},{count:6,scope:'mode',series:['Gold']}], description:'Contiene 9 carte: 3 oggetti e 6 carte della serie Gold.' },
    { name:'Silver', kind:'composite', size:9, cost:0, referenceCost:400, referenceCurrency:'coins', cover:'img/Deck%20back%20argento%20BATMAN.webp', parts:[{count:3,scope:'mode',series:['Oggetto']},{count:6,scope:'mode',series:['Silver']}], description:'Contiene 9 carte: 3 oggetti e 6 carte della serie Silver.' },
    { name:'Bronze', kind:'composite', size:9, cost:0, referenceCost:100, referenceCurrency:'coins', cover:'img/Deck%20back%20bronzo%20BATMAN.webp', parts:[{count:3,scope:'mode',series:['Oggetto']},{count:6,scope:'mode',series:['Bronze']}], description:'Contiene 9 carte: 3 oggetti e 6 carte della serie Bronze.' },
    { name:'Strumenti', kind:'finite', size:3, cost:0, scope:'mode', series:['Strumento'], copies:2, uniqueWithinPack:true, cover:'img/Deck%20back%20strumenti.webp', description:'Contiene 3 strumenti dedicati a Gotham City FC.' },
    { name:'Cosmetic', kind:'infinite', size:1, cost:0, scope:'mode-or-shared', series:['Cosmetic'], cover:'img/Deck%20back%20cosmetic.webp', description:'Contiene 1 cosmetic casuale.' }
  ]
};
