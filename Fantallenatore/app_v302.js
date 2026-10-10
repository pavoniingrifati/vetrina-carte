(() => {
  'use strict';

  if(!window.FantaGameRules) throw new Error('Modulo js/game-rules.js non caricato');
  if(!window.FantaCoreUtils) throw new Error('Modulo js/core-utils.js non caricato');
  if(!window.FantaSaveCodec) throw new Error('Modulo js/save-codec.js non caricato');
  if(!window.FantaSaveManager) throw new Error('Modulo js/save-manager.js non caricato');
  if(!window.FantaSeasonEngine) throw new Error('Modulo js/season-engine.js non caricato');
  if(!window.FantaTransferEngine) throw new Error('Modulo js/transfer-engine.js non caricato');
  if(!window.FantaCareerEngine) throw new Error('Modulo js/career-engine.js non caricato');
  if(!window.FantaStorageSnapshot) throw new Error('Modulo js/storage-snapshot.js non caricato');
  if(!window.FantaCpuLineupPolicy) throw new Error('Modulo js/cpu-lineup-policy.js non caricato');
  if(!window.FantaAuctionEngine) throw new Error('Modulo js/auction-engine.js non caricato');
  const {
    GAME_CONFIG,ROLE_LIMITS,ROLE_ORDER,ROLE_LABELS,ROLE_PLURALS,
    INITIAL_BUDGET,FANTASY_SEASON_MATCHDAYS,TOTAL_SLOTS,BID_WINDOW_MS,
    MARKET_VALUE_POOL_TARGET,MARKET_ROLE_TARGET,MARKET_ALPHA,ROLE_BID_CORRECTION,
    TOP_VALUE_THRESHOLD,FANTASY_MAX_SUBS,SERIEA_MIN_VOTE_MINUTES,
    FORMATION_EVENT_CHANCE,ADMIN_RULE_EVENT_CHANCE,CAREER_STARTING_EUROS
  }=window.FantaGameRules;
  const {delay,clamp,randomHash,shuffledCopy,playerInitials}=window.FantaCoreUtils;
  const {encode:encodeSavePayload,decode:decodeSavePayload}=window.FantaSaveCodec;
  const {
    buildFantasySeasonSchedule:buildSeasonSchedule,
    freshStandings:buildFreshStandings,
    freshClubStandings,sortStandings,applyFantasyMatch,applyClubMatches,buildDoubleRoundRobin
  }=window.FantaSeasonEngine;
  const TransferEngine=window.FantaTransferEngine;
  const CareerEngine=window.FantaCareerEngine;
  const AuctionEngine=window.FantaAuctionEngine;

  // DOMAIN_BINDINGS_BEGIN
  // The shell owns shared state; domain modules own behavior. Accessors stay live after reload or test overrides.
  let {comparableAuctionFvm,careerMarketProfiles,buildMarketValueMap,refreshMarketValueMap,baseAuctionValue,roleSpend,targetFor,cpuLeagueRuleSensitivity,cpuLeagueRuleAuctionFactor,scarcityFactor,freePerSlot,wealthFactor,urgencyFactor,cpuRoleUrgencyState,hasGoodRelations,isHotRival,needFactor,auctionReputationMultiplier,buildSeasonAuctionReputation,cpuAuctionCompetence,cpuAuctionRoleQuality,cpuAuctionStarterEstimate,cpuFootballAuctionFactor,cpuCoverageEnabled,cpuClubRoleHierarchy,cpuMainKeeper,cpuCoverInfo,cpuMissingKeeperCover,cpuKeeperReserve,cpuOpenRoleSpendingCap,cpuAuctionSpendingCap,strategicPlayerScore,strategicSlotInterest,cpuBundleLimit,cpuLimit,jumpSize,cpuPersonalityPool,pickCpuPersonalities,freshManagers}=window.FantaDomains['auction-policy'].create({
    get AuctionEngine(){return AuctionEngine;},
    get GAME_CONFIG(){return GAME_CONFIG;},
    get INITIAL_BUDGET(){return INITIAL_BUDGET;},
    get MARKET_ALPHA(){return MARKET_ALPHA;},
    get MARKET_ROLE_TARGET(){return MARKET_ROLE_TARGET;},
    get MARKET_VALUE_POOL_TARGET(){return MARKET_VALUE_POOL_TARGET;},
    get PERSONALITIES(){return PERSONALITIES;},
    get ROLE_BID_CORRECTION(){return ROLE_BID_CORRECTION;},
    get ROLE_LIMITS(){return ROLE_LIMITS;},
    get ROLE_ORDER(){return ROLE_ORDER;},
    get SPECIAL_RIVAL_IDS(){return SPECIAL_RIVAL_IDS;},
    get TOP_VALUE_THRESHOLD(){return TOP_VALUE_THRESHOLD;},
    get TOTAL_SLOTS(){return TOTAL_SLOTS;},
    get auctionEffects(){return auctionEffects;},
    get auctionPlayerAnalysis(){return auctionPlayerAnalysis;},
    get auctionReputationMultiplier(){return auctionReputationMultiplier;},
    get auctionStarterProbability(){return auctionStarterProbability;},
    get baseAuctionValue(){return baseAuctionValue;},
    get basePlayerValueReference(){return basePlayerValueReference;},
    get baseSerieAPlayers(){return baseSerieAPlayers;},
    get buildMarketValueMap(){return buildMarketValueMap;},
    get canOwn(){return canOwn;},
    get careerHash(){return careerHash;},
    get careerMarketProfiles(){return careerMarketProfiles;},
    get clamp(){return clamp;},
    get clubRoleStarterSlots(){return clubRoleStarterSlots;},
    get comparableAuctionFvm(){return comparableAuctionFvm;},
    get cpuAuctionCompetence(){return cpuAuctionCompetence;},
    get cpuAuctionRoleQuality(){return cpuAuctionRoleQuality;},
    get cpuAuctionSpendingCap(){return cpuAuctionSpendingCap;},
    get cpuAuctionStarterEstimate(){return cpuAuctionStarterEstimate;},
    get cpuBundleLimit(){return cpuBundleLimit;},
    get cpuClubRoleHierarchy(){return cpuClubRoleHierarchy;},
    get cpuCoverInfo(){return cpuCoverInfo;},
    get cpuCoverageEnabled(){return cpuCoverageEnabled;},
    get cpuFootballAuctionFactor(){return cpuFootballAuctionFactor;},
    get cpuKeeperReserve(){return cpuKeeperReserve;},
    get cpuLeagueRuleAuctionFactor(){return cpuLeagueRuleAuctionFactor;},
    get cpuLeagueRuleSensitivity(){return cpuLeagueRuleSensitivity;},
    get cpuLimit(){return cpuLimit;},
    get cpuMainKeeper(){return cpuMainKeeper;},
    get cpuMissingKeeperCover(){return cpuMissingKeeperCover;},
    get cpuOpenRoleSpendingCap(){return cpuOpenRoleSpendingCap;},
    get cpuPersonalityPool(){return cpuPersonalityPool;},
    get cpuRoleUrgencyState(){return cpuRoleUrgencyState;},
    get currentAuctionRole(){return currentAuctionRole;},
    get currentPlayerOvr(){return currentPlayerOvr;},
    get freePerSlot(){return freePerSlot;},
    get freshRivalIdentityPool(){return freshRivalIdentityPool;},
    get hasGoodRelations(){return hasGoodRelations;},
    get isHotRival(){return isHotRival;},
    get leagueRulesFor(){return leagueRulesFor;},
    get marketValueMap(){return marketValueMap;}, set marketValueMap(value){marketValueMap=value;},
    get maxLegalBid(){return maxLegalBid;},
    get needFactor(){return needFactor;},
    get normalizedStarterProbability(){return normalizedStarterProbability;},
    get openRoleAuction(){return openRoleAuction;},
    get pickCpuPersonalities(){return pickCpuPersonalities;},
    get playerMap(){return playerMap;},
    get profileArchetype(){return profileArchetype;},
    get relationship(){return relationship;},
    get roleSlotsRemaining(){return roleSlotsRemaining;},
    get roleSpend(){return roleSpend;},
    get scarcityFactor(){return scarcityFactor;},
    get slotRankingCache(){return slotRankingCache;},
    get slotsRemaining(){return slotsRemaining;},
    get starterHierarchyBias(){return starterHierarchyBias;},
    get state(){return state;},
    get strategicPlayerScore(){return strategicPlayerScore;},
    get strategicSlotInterest(){return strategicSlotInterest;},
    get targetFor(){return targetFor;},
    get urgencyFactor(){return urgencyFactor;},
    get wealthFactor(){return wealthFactor;}
  });
  let {freshState,showPersistenceError,saveState,showToast,saveWithFeedback,stopGameRuntime,migrateRarityHunterPurchase,migrateCareerDivisionScale,normalizeSavedState,parseStoredPayload,loadSaved,clearSaved,initializeSaveSystem}=window.FantaDomains['persistence-controller'].create({
    get $(){return $;},
    get CAREER_STARTING_EUROS(){return CAREER_STARTING_EUROS;},
    get COACH_AVATAR_DEFAULT(){return COACH_AVATAR_DEFAULT;},
    get CareerEngine(){return CareerEngine;},
    get GAME_CONFIG(){return GAME_CONFIG;},
    get SEASON_SPONSORS(){return SEASON_SPONSORS;},
    get TransferEngine(){return TransferEngine;},
    get activateCatalogBase(){return activateCatalogBase;},
    get auditAndRepairState(){return auditAndRepairState;},
    get autocompleteMode(){return autocompleteMode;}, set autocompleteMode(value){autocompleteMode=value;},
    get baseSerieAPlayers(){return baseSerieAPlayers;},
    get buildStorageSnapshot(){return buildStorageSnapshot;},
    get clearAuctionRuntimeTimers(){return clearAuctionRuntimeTimers;},
    get closeAuctionEventModal(){return closeAuctionEventModal;},
    get compactLongCareerState(){return compactLongCareerState;},
    get decodeSavePayload(){return decodeSavePayload;},
    get defaultLeagueRules(){return defaultLeagueRules;},
    get freshManagers(){return freshManagers;},
    get hideAdminRuleModal(){return hideAdminRuleModal;},
    get hideAwardAnimation(){return hideAwardAnimation;},
    get hideFormationChoiceModal(){return hideFormationChoiceModal;},
    get hideRoleRemainderAutoSim(){return hideRoleRemainderAutoSim;},
    get hideRoleTransitionModal(){return hideRoleTransitionModal;},
    get hideSerieATvBanner(){return hideSerieATvBanner;},
    get lineupAssistantAdjustments(){return lineupAssistantAdjustments;}, set lineupAssistantAdjustments(value){lineupAssistantAdjustments=value;},
    get lineupDraft(){return lineupDraft;}, set lineupDraft(value){lineupDraft=value;},
    get lineupPartialContext(){return lineupPartialContext;}, set lineupPartialContext(value){lineupPartialContext=value;},
    get lineupReadOnly(){return lineupReadOnly;}, set lineupReadOnly(value){lineupReadOnly=value;},
    get migrateCareerDivisionScale(){return migrateCareerDivisionScale;},
    get migrateRarityHunterPurchase(){return migrateRarityHunterPurchase;},
    get normalizeSavedState(){return normalizeSavedState;},
    get parseStoredPayload(){return parseStoredPayload;},
    get roleRemainderAutoSim(){return roleRemainderAutoSim;}, set roleRemainderAutoSim(value){roleRemainderAutoSim=value;},
    get saveErrorToastAt(){return saveErrorToastAt;}, set saveErrorToastAt(value){saveErrorToastAt=value;},
    get saveManager(){return saveManager;},
    get saveState(){return saveState;},
    get serieALive(){return serieALive;}, set serieALive(value){serieALive=value;},
    get showPersistenceError(){return showPersistenceError;},
    get showToast(){return showToast;},
    get shuffledCopy(){return shuffledCopy;},
    get snapshotSerieALive(){return snapshotSerieALive;},
    get state(){return state;},
    get stopHubNewsCarousel(){return stopHubNewsCarousel;},
    get toastTimer(){return toastTimer;}, set toastTimer(value){toastTimer=value;}
  });
  let {playerSeasonPotentialProfile,clubRoleStarterSlots,starterHierarchyBias,normalizedStarterProbability,auctionStarterProbability,auctionPlayerAnalysis}=window.FantaDomains['auction-analysis-policy'].create({
    get careerHash(){return careerHash;},
    get clamp(){return clamp;},
    get clubMap(){return clubMap;},
    get state(){return state;}
  });
  let {renderAll,renderPhaseBanner,renderRoster,managerLiveAuctionBadges,buildLeagueManagerCards,renderManagers,averageRosterValue,renderTurn,nominationSort,openNominationModal,closeNominationModal,renderNominationClubFilter,nominationCard,auctionObserverActive,renderPlayerResults,renderAuctionRoomList,auctionBundlePlayerMarkup,renderAuction}=window.FantaDomains['auction-views'].create({
    get $(){return $;},
    get RIVAL_ART(){return RIVAL_ART;},
    get ROLE_LABELS(){return ROLE_LABELS;},
    get ROLE_LIMITS(){return ROLE_LIMITS;},
    get ROLE_ORDER(){return ROLE_ORDER;},
    get ROLE_PLURALS(){return ROLE_PLURALS;},
    get TOTAL_SLOTS(){return TOTAL_SLOTS;},
    get activePactForPlayer(){return activePactForPlayer;},
    get advanceRolePhaseIfNeeded(){return advanceRolePhaseIfNeeded;},
    get allRostersComplete(){return allRostersComplete;},
    get auctionPlayerAnalysis(){return auctionPlayerAnalysis;},
    get autocompleteMode(){return autocompleteMode;}, set autocompleteMode(value){autocompleteMode=value;},
    get baseAuctionValue(){return baseAuctionValue;},
    get canOwn(){return canOwn;},
    get clamp(){return clamp;},
    get clubColor(){return clubColor;},
    get clubMap(){return clubMap;},
    get clubName(){return clubName;},
    get clubShort(){return clubShort;},
    get cpuRoleUrgencyState(){return cpuRoleUrgencyState;},
    get currentAuctionRole(){return currentAuctionRole;},
    get escapeHtml(){return escapeHtml;},
    get finishAuction(){return finishAuction;},
    get hasGoodRelations(){return hasGoodRelations;},
    get isHotRival(){return isHotRival;},
    get lastBidFlash(){return lastBidFlash;}, set lastBidFlash(value){lastBidFlash=value;},
    get managerCanNominate(){return managerCanNominate;},
    get maxBidNow(){return maxBidNow;},
    get maxLegalBid(){return maxLegalBid;},
    get nominate(){return nominate;},
    get nominationUiKey(){return nominationUiKey;}, set nominationUiKey(value){nominationUiKey=value;},
    get openRoleAuction(){return openRoleAuction;},
    get playerAvatarMarkup(){return playerAvatarMarkup;},
    get playerInitials(){return playerInitials;},
    get playerMap(){return playerMap;},
    get playerStars(){return playerStars;},
    get profileArchetype(){return profileArchetype;},
    get renderArcadeBanner(){return renderArcadeBanner;},
    get renderAuctionPowers(){return renderAuctionPowers;},
    get renderCountdown(){return renderCountdown;},
    get renderVisibleRivals(){return renderVisibleRivals;},
    get roleCount(){return roleCount;},
    get roleSlotsRemaining(){return roleSlotsRemaining;},
    get roleSpend(){return roleSpend;},
    get roleSpendPct(){return roleSpendPct;},
    get state(){return state;}
  });
  let {auctionWindowMs,clearAuctionRuntimeTimers,renderCountdown,startCountdownTicker,resetBidClock,nextDelay,cpuNominationDelay,cpuReactionDelay}=window.FantaDomains['auction-clock'].create({
    get $(){return $;},
    get BID_WINDOW_MS(){return BID_WINDOW_MS;},
    get autocompleteMode(){return autocompleteMode;}, set autocompleteMode(value){autocompleteMode=value;},
    get awardAnimationTimer(){return awardAnimationTimer;}, set awardAnimationTimer(value){awardAnimationTimer=value;},
    get awardAuction(){return awardAuction;},
    get bidFlashTimer(){return bidFlashTimer;}, set bidFlashTimer(value){bidFlashTimer=value;},
    get bidSpotlightTimer(){return bidSpotlightTimer;}, set bidSpotlightTimer(value){bidSpotlightTimer=value;},
    get clamp(){return clamp;},
    get countdownTimer(){return countdownTimer;}, set countdownTimer(value){countdownTimer=value;},
    get cpuLimit(){return cpuLimit;},
    get cpuReactionTimers(){return cpuReactionTimers;}, set cpuReactionTimers(value){cpuReactionTimers=value;},
    get cpuRoleUrgencyState(){return cpuRoleUrgencyState;},
    get hasGoodRelations(){return hasGoodRelations;},
    get isHotRival(){return isHotRival;},
    get playerMap(){return playerMap;},
    get profileArchetype(){return profileArchetype;},
    get renderAuctionRoomList(){return renderAuctionRoomList;},
    get state(){return state;},
    get suddenInterestTimer(){return suddenInterestTimer;}, set suddenInterestTimer(value){suddenInterestTimer=value;},
    get uiTimer(){return uiTimer;}, set uiTimer(value){uiTimer=value;}
  });
  let {prepareArcadeAuction,renderArcadeBanner,showArcadeModal,resolveSealedAuction,handleArcadeAction}=window.FantaDomains['auction-arcade-controller'].create({
    get $(){return $;},
    get ARCADE_AUCTION_LABELS(){return ARCADE_AUCTION_LABELS;},
    get AuctionEngine(){return AuctionEngine;},
    get ROLE_LABELS(){return ROLE_LABELS;},
    get ROLE_LIMITS(){return ROLE_LIMITS;},
    get TOTAL_SLOTS(){return TOTAL_SLOTS;},
    get auctionBundlePlayerMarkup(){return auctionBundlePlayerMarkup;},
    get auctionObserverActive(){return auctionObserverActive;},
    get autoUserLimit(){return autoUserLimit;},
    get autocompleteMode(){return autocompleteMode;}, set autocompleteMode(value){autocompleteMode=value;},
    get awardAuction(){return awardAuction;},
    get beginBidRound(){return beginBidRound;},
    get canOwn(){return canOwn;},
    get clearAuctionRuntimeTimers(){return clearAuctionRuntimeTimers;},
    get clubName(){return clubName;},
    get cpuLimit(){return cpuLimit;},
    get escapeHtml(){return escapeHtml;},
    get maxLegalBid(){return maxLegalBid;},
    get openRoleAuction(){return openRoleAuction;},
    get playerMap(){return playerMap;},
    get renderAuction(){return renderAuction;},
    get saveState(){return saveState;},
    get state(){return state;},
    get strategicPlayerScore(){return strategicPlayerScore;}
  });
  let {flashBidder,bidReaction,bidCommentMoment,showBidSpotlight,showAwardAnimation,hideAwardAnimation,awardLossReactionData,showAwardLossReaction}=window.FantaDomains['auction-feedback'].create({
    get $(){return $;},
    get RIVAL_ART(){return RIVAL_ART;},
    get RIVAL_BID_REACTIONS(){return RIVAL_BID_REACTIONS;},
    get RIVAL_LOSS_REACTIONS(){return RIVAL_LOSS_REACTIONS;},
    get TOP_VALUE_THRESHOLD(){return TOP_VALUE_THRESHOLD;},
    get autocompleteMode(){return autocompleteMode;}, set autocompleteMode(value){autocompleteMode=value;},
    get baseAuctionValue(){return baseAuctionValue;},
    get bidFlashTimer(){return bidFlashTimer;}, set bidFlashTimer(value){bidFlashTimer=value;},
    get bidSpotlightTimer(){return bidSpotlightTimer;}, set bidSpotlightTimer(value){bidSpotlightTimer=value;},
    get careerHash(){return careerHash;},
    get clamp(){return clamp;},
    get hasGoodRelations(){return hasGoodRelations;},
    get isHotRival(){return isHotRival;},
    get lastBidFlash(){return lastBidFlash;}, set lastBidFlash(value){lastBidFlash=value;},
    get playerAvatarMarkup(){return playerAvatarMarkup;},
    get playerInitials(){return playerInitials;},
    get profileArchetype(){return profileArchetype;},
    get renderAuctionRoomList(){return renderAuctionRoomList;},
    get state(){return state;}
  });
  let {ensureManagerTeamIdentityState,ensureAuctionPowers,auctionPowerMaxUses,auctionPowerUses,consumeAuctionPower,canUseOneShot,renderAuctionPowers,auctionPowerTargets,pauseForAuctionPower,resumeAfterAuctionPower,openAuctionPower,useScoutPower,closeAuctionPowerModal,resolveAuctionPowerTarget,useBluffPower,useOneShotPower}=window.FantaDomains['auction-powers-controller'].create({
    get $(){return $;},
    get FIXTURE_TEAM_COLORS(){return FIXTURE_TEAM_COLORS;},
    get RIVAL_ART(){return RIVAL_ART;},
    get addAuctionLog(){return addAuctionLog;},
    get autocompleteMode(){return autocompleteMode;}, set autocompleteMode(value){autocompleteMode=value;},
    get awardAuction(){return awardAuction;},
    get beginBidRound(){return beginBidRound;},
    get canOwn(){return canOwn;},
    get clearAuctionRuntimeTimers(){return clearAuctionRuntimeTimers;},
    get cpuLimit(){return cpuLimit;},
    get escapeHtml(){return escapeHtml;},
    get maxLegalBid(){return maxLegalBid;},
    get playerInitials(){return playerInitials;},
    get playerMap(){return playerMap;},
    get profileArchetype(){return profileArchetype;},
    get renderAuction(){return renderAuction;},
    get renderCountdown(){return renderCountdown;},
    get saveState(){return saveState;},
    get showToast(){return showToast;},
    get state(){return state;}
  });
  let {addAuctionLog,nominate,scheduleAdvance,adminOneShotScore,tryAdminOneShot,beginBidRound,currentSuddenInterestEffect,activateSuddenInterest,scheduleSuddenInterestEntry,scheduleCpuReactions,cpuReact,advanceAuction,autoUserLimit,userBid,fastForwardCpuAuctionAfterUserPass,userPass,userCannotBeatCurrentAuction,autoSkipUserIfCannotBid,awardAuction,nominationCallCount,registerNominationCall,nextNominatorIndex,allRostersComplete,scheduleNomination,cpuNominateCurrent,freeRoleNominationWeights,chooseNomination,finishAuction}=window.FantaDomains['auction-controller'].create({
    get AuctionEngine(){return AuctionEngine;},
    get BID_WINDOW_MS(){return BID_WINDOW_MS;},
    get PERSONALITIES(){return PERSONALITIES;},
    get ROLE_LIMITS(){return ROLE_LIMITS;},
    get ROLE_ORDER(){return ROLE_ORDER;},
    get TOP_VALUE_THRESHOLD(){return TOP_VALUE_THRESHOLD;},
    get TOTAL_SLOTS(){return TOTAL_SLOTS;},
    get activePactForPlayer(){return activePactForPlayer;},
    get auctionEffects(){return auctionEffects;},
    get auctionReputationMultiplier(){return auctionReputationMultiplier;},
    get auditAndRepairState(){return auditAndRepairState;},
    get autocompleteMode(){return autocompleteMode;}, set autocompleteMode(value){autocompleteMode=value;},
    get awardAnimationTimer(){return awardAnimationTimer;}, set awardAnimationTimer(value){awardAnimationTimer=value;},
    get awardLossReactionData(){return awardLossReactionData;},
    get baseAuctionValue(){return baseAuctionValue;},
    get beginRoleRemainderAutoSim(){return beginRoleRemainderAutoSim;},
    get beginRoleTransition(){return beginRoleTransition;},
    get canOwn(){return canOwn;},
    get careerHash(){return careerHash;},
    get changeRelationship(){return changeRelationship;},
    get clamp(){return clamp;},
    get clearAuctionRuntimeTimers(){return clearAuctionRuntimeTimers;},
    get closeNominationModal(){return closeNominationModal;},
    get cpuAuctionCompetence(){return cpuAuctionCompetence;},
    get cpuAuctionStarterEstimate(){return cpuAuctionStarterEstimate;},
    get cpuFootballAuctionFactor(){return cpuFootballAuctionFactor;},
    get cpuKeepsPact(){return cpuKeepsPact;},
    get cpuLimit(){return cpuLimit;},
    get cpuMissingKeeperCover(){return cpuMissingKeeperCover;},
    get cpuNominationDelay(){return cpuNominationDelay;},
    get cpuReactionDelay(){return cpuReactionDelay;},
    get cpuReactionTimers(){return cpuReactionTimers;}, set cpuReactionTimers(value){cpuReactionTimers=value;},
    get currentAuctionRole(){return currentAuctionRole;},
    get currentPlayerOvr(){return currentPlayerOvr;},
    get endRoleRemainderAutoSim(){return endRoleRemainderAutoSim;},
    get flashBidder(){return flashBidder;},
    get hideAwardAnimation(){return hideAwardAnimation;},
    get hideRoleRemainderAutoSim(){return hideRoleRemainderAutoSim;},
    get hideRoleTransitionModal(){return hideRoleTransitionModal;},
    get integrityNote(){return integrityNote;},
    get jumpSize(){return jumpSize;},
    get managerCanNominate(){return managerCanNominate;},
    get maxLegalBid(){return maxLegalBid;},
    get maybeTriggerAuctionEvent(){return maybeTriggerAuctionEvent;},
    get openRoleAuction(){return openRoleAuction;},
    get playerMap(){return playerMap;},
    get prepareArcadeAuction(){return prepareArcadeAuction;},
    get profileArchetype(){return profileArchetype;},
    get recordUserAuctionPick(){return recordUserAuctionPick;},
    get registerDirectAuctionDuel(){return registerDirectAuctionDuel;},
    get renderAll(){return renderAll;},
    get renderAuction(){return renderAuction;},
    get renderManagers(){return renderManagers;},
    get renderRoster(){return renderRoster;},
    get renderTradeWindow(){return renderTradeWindow;},
    get renderTurn(){return renderTurn;},
    get resetBidClock(){return resetBidClock;},
    get resolveRespectedAuctionPact(){return resolveRespectedAuctionPact;},
    get rolePhaseComplete(){return rolePhaseComplete;},
    get roleRemainderAutoSim(){return roleRemainderAutoSim;}, set roleRemainderAutoSim(value){roleRemainderAutoSim=value;},
    get roleSlotsRemaining(){return roleSlotsRemaining;},
    get roleSpend(){return roleSpend;},
    get saveState(){return saveState;},
    get showArcadeModal(){return showArcadeModal;},
    get showAwardAnimation(){return showAwardAnimation;},
    get showAwardLossReaction(){return showAwardLossReaction;},
    get showBidSpotlight(){return showBidSpotlight;},
    get showPactBetrayPrompt(){return showPactBetrayPrompt;},
    get showToast(){return showToast;},
    get slotsRemaining(){return slotsRemaining;},
    get state(){return state;},
    get strategicSlotInterest(){return strategicSlotInterest;},
    get suddenInterestTimer(){return suddenInterestTimer;}, set suddenInterestTimer(value){suddenInterestTimer=value;},
    get targetFor(){return targetFor;},
    get tickAuctionEventEffectsOnNomination(){return tickAuctionEventEffectsOnNomination;},
    get uiTimer(){return uiTimer;}, set uiTimer(value){uiTimer=value;},
    get userCompletedCurrentRole(){return userCompletedCurrentRole;},
    get winterLedgerFor(){return winterLedgerFor;}
  });
  let {currentTradeWindow,tradeOfferSelection,tradeOfferValid,tradeAvailabilityFactor,tradeLineupStrength,tradePlayerWorth,tradeCpuDecision,completeTrade,tradeActiveKind,tradeCreditsValue,tradeSetSelection,adjustTradeCredits,tradeRosterPlayerMarkup,tradePlayerCardMarkup,tradeFilteredRoster,renderTradeRosterChoices,renderTradeWindow,submitTradeOffer,acceptTradeCounter,finishTradeWindow,leagueRoleAverage,calibrationStatus,compactLineupPlayerName,bestTheoreticalLineup,bestXIHtml,wireLeagueRosterViewToggles,buildFinalLeagueRosterCards,renderSummary,teamPreviewScore}=window.FantaDomains['trade-roster-controller'].create({
    get $(){return $;},
    get INITIAL_BUDGET(){return INITIAL_BUDGET;},
    get MARKET_ROLE_TARGET(){return MARKET_ROLE_TARGET;},
    get ROLE_LIMITS(){return ROLE_LIMITS;},
    get ROLE_ORDER(){return ROLE_ORDER;},
    get ROLE_PLURALS(){return ROLE_PLURALS;},
    get TOTAL_SLOTS(){return TOTAL_SLOTS;},
    get availableLineupFormations(){return availableLineupFormations;},
    get baseAuctionValue(){return baseAuctionValue;},
    get bestTheoreticalLineup(){return bestTheoreticalLineup;},
    get bestXIHtml(){return bestXIHtml;},
    get buildAutoLineup(){return buildAutoLineup;},
    get buildFinalLeagueRosterCards(){return buildFinalLeagueRosterCards;},
    get calibrationStatus(){return calibrationStatus;},
    get careerHash(){return careerHash;},
    get clamp(){return clamp;},
    get clubName(){return clubName;},
    get compactLineupPlayerName(){return compactLineupPlayerName;},
    get completeTrade(){return completeTrade;},
    get currentPlayerOvr(){return currentPlayerOvr;},
    get currentTradeWindow(){return currentTradeWindow;},
    get escapeHtml(){return escapeHtml;},
    get leagueRoleAverage(){return leagueRoleAverage;},
    get lineupPlayerValue(){return lineupPlayerValue;},
    get lineupSlots(){return lineupSlots;},
    get managerById(){return managerById;},
    get playerAvatarMarkup(){return playerAvatarMarkup;},
    get playerFormMetrics(){return playerFormMetrics;},
    get playerOvrLabel(){return playerOvrLabel;},
    get playerSeasonStat(){return playerSeasonStat;},
    get playerSeasonStatus(){return playerSeasonStatus;},
    get playerStatusForDay(){return playerStatusForDay;},
    get renderFixtureCoachPortrait(){return renderFixtureCoachPortrait;},
    get renderSeasonDashboard(){return renderSeasonDashboard;},
    get renderSponsorSelection(){return renderSponsorSelection;},
    get renderSummary(){return renderSummary;},
    get renderTradeRosterChoices(){return renderTradeRosterChoices;},
    get renderTradeWindow(){return renderTradeWindow;},
    get roleSpend(){return roleSpend;},
    get saveState(){return saveState;},
    get seasonFixtureTheme(){return seasonFixtureTheme;},
    get showScreen(){return showScreen;},
    get state(){return state;},
    get tradeActiveKind(){return tradeActiveKind;},
    get tradeAvailabilityFactor(){return tradeAvailabilityFactor;},
    get tradeCpuDecision(){return tradeCpuDecision;},
    get tradeCreditsValue(){return tradeCreditsValue;},
    get tradeFilteredRoster(){return tradeFilteredRoster;},
    get tradeLineupStrength(){return tradeLineupStrength;},
    get tradeOfferSelection(){return tradeOfferSelection;},
    get tradeOfferValid(){return tradeOfferValid;},
    get tradePlayerCardMarkup(){return tradePlayerCardMarkup;},
    get tradePlayerWorth(){return tradePlayerWorth;},
    get tradeRosterPlayerMarkup(){return tradeRosterPlayerMarkup;},
    get visibleFormLabel(){return visibleFormLabel;},
    get winterLedgerFor(){return winterLedgerFor;}
  });
  let {ensurePlayerSeasonSystems,playerSeasonStat,ensureSerieATransferMarket,syncSerieATransferWorld,serieATransferStatsSnapshot,ensureMisterJunior,addMisterJuniorToWinterPlan,generateSerieATransferWindowPlan,registerSerieATransferWindowPlan,completedSeasonUserPosition,careerSeasonOutcome,completedUserSeasonRecap,recordUserAuctionPick,finalizeCompletedSeasonOvrBases,ensureNextSeasonFlow,nextSeasonSummerPlan,archiveCompletedSeasonIfNeeded,renderNextSeasonFlow,simulateNextSeasonSummerMarket,renderSeasonKeeperChoice,applySeasonKeeper,buildNextSeasonCareerDraft,openNextSeasonAuctionSetup,handleNextSeasonPrimaryAction,winterExpectedWindowId,winterMarketPlan,createWinterBudgetLedger,winterLedgerFor,expectedWinterBudget,ensureWinterMarketFlow,activateWinterTransferWindowIfNeeded,winterTransferOperationMarkup,settleWinterMarketFinances,simulateWinterMarket,renderWinterMarketIntro,renderWinterMarketSummary,cpuWinterReleaseScore,releaseWinterPlayer,processCpuWinterReleases,openWinterReleases,useGuaranteedWinterSale,toggleGuaranteedWinterSaleMode,renderWinterReleaseScreen,toggleWinterRelease,confirmWinterReleases,startWinterRepairAuction,routeWinterMarketFlow,showPendingWinterTransferSummary,closeWinterTransferSummary,playerSeasonStatus,playerStatusForDay,playerFormMetrics,qualitativeFormLabel,visibleFormLabel,visibleNewsDetail,playerAvailabilityText,sortedSerieAStandings,updateSerieAStandingsFromStoredMatches,seasonPlayerOwner}=window.FantaDomains['career-market-controller'].create({
    get $(){return $;},
    get GAME_CONFIG(){return GAME_CONFIG;},
    get INITIAL_BUDGET(){return INITIAL_BUDGET;},
    get ROLE_LABELS(){return ROLE_LABELS;},
    get ROLE_LIMITS(){return ROLE_LIMITS;},
    get ROLE_ORDER(){return ROLE_ORDER;},
    get SEASON_SPONSORS(){return SEASON_SPONSORS;},
    get TOTAL_SLOTS(){return TOTAL_SLOTS;},
    get TransferEngine(){return TransferEngine;},
    get WINTER_AUCTION_BASE_CREDITS(){return WINTER_AUCTION_BASE_CREDITS;},
    get WINTER_TRANSFER_TRIGGER_MATCHDAY(){return WINTER_TRANSFER_TRIGGER_MATCHDAY;},
    get activateCatalogBase(){return activateCatalogBase;},
    get addMisterJuniorToWinterPlan(){return addMisterJuniorToWinterPlan;},
    get advanceRealLeague(){return advanceRealLeague;},
    get advanceRolePhaseIfNeeded(){return advanceRolePhaseIfNeeded;},
    get applyClubMatches(){return applyClubMatches;},
    get archiveCompletedSeasonIfNeeded(){return archiveCompletedSeasonIfNeeded;},
    get autocompleteMode(){return autocompleteMode;},
    get baseSerieAPlayers(){return baseSerieAPlayers;},
    get beginRoleRemainderAutoSim(){return beginRoleRemainderAutoSim;},
    get buildNextSeasonCareerDraft(){return buildNextSeasonCareerDraft;},
    get buildSeasonAuctionReputation(){return buildSeasonAuctionReputation;},
    get careerDivisionLabel(){return careerDivisionLabel;},
    get careerDraft(){return careerDraft;}, set careerDraft(value){careerDraft=value;},
    get careerEuros(){return careerEuros;},
    get careerFantapoints(){return careerFantapoints;},
    get careerHash(){return careerHash;},
    get careerPowerSelection(){return careerPowerSelection;}, set careerPowerSelection(value){careerPowerSelection=value;},
    get careerRulesNextAction(){return careerRulesNextAction;}, set careerRulesNextAction(value){careerRulesNextAction=value;},
    get careerSeasonLabel(){return careerSeasonLabel;},
    get careerSeasonOutcome(){return careerSeasonOutcome;},
    get clamp(){return clamp;},
    get clubName(){return clubName;},
    get clubShort(){return clubShort;},
    get compactLongCareerState(){return compactLongCareerState;},
    get completedSeasonUserPosition(){return completedSeasonUserPosition;},
    get completedUserSeasonRecap(){return completedUserSeasonRecap;},
    get consumableQuantity(){return consumableQuantity;},
    get consumeConsumable(){return consumeConsumable;},
    get cpuWinterReleaseScore(){return cpuWinterReleaseScore;},
    get createWinterBudgetLedger(){return createWinterBudgetLedger;},
    get currentAuctionRole(){return currentAuctionRole;},
    get currentPlayerOvr(){return currentPlayerOvr;},
    get defaultLeagueRules(){return defaultLeagueRules;},
    get emptyPlayerSeasonStat(){return emptyPlayerSeasonStat;},
    get ensureCareerEconomy(){return ensureCareerEconomy;},
    get ensureMisterJunior(){return ensureMisterJunior;},
    get ensureNextSeasonFlow(){return ensureNextSeasonFlow;},
    get ensurePlayerSeasonSystems(){return ensurePlayerSeasonSystems;},
    get ensureRealLeague(){return ensureRealLeague;},
    get ensureSeasonState(){return ensureSeasonState;},
    get ensureSerieATransferMarket(){return ensureSerieATransferMarket;},
    get ensureWinterMarketFlow(){return ensureWinterMarketFlow;},
    get escapeHtml(){return escapeHtml;},
    get estimatedStarterProbability(){return estimatedStarterProbability;},
    get fantaclassificaIsActive(){return fantaclassificaIsActive;},
    get finalizeCompletedSeasonOvrBases(){return finalizeCompletedSeasonOvrBases;},
    get finishAuction(){return finishAuction;},
    get freshManagers(){return freshManagers;},
    get freshSerieAStandings(){return freshSerieAStandings;},
    get generateSerieATransferWindowPlan(){return generateSerieATransferWindowPlan;},
    get initializedSeasonSystems(){return initializedSeasonSystems;},
    get leagueRulesFor(){return leagueRulesFor;},
    get managerById(){return managerById;},
    get nextNominatorIndex(){return nextNominatorIndex;},
    get nextSeasonMarketSimulationRunning(){return nextSeasonMarketSimulationRunning;}, set nextSeasonMarketSimulationRunning(value){nextSeasonMarketSimulationRunning=value;},
    get nextSeasonSetupMode(){return nextSeasonSetupMode;}, set nextSeasonSetupMode(value){nextSeasonSetupMode=value;},
    get nextSeasonSummerPlan(){return nextSeasonSummerPlan;},
    get normalizedCoachAvatar(){return normalizedCoachAvatar;},
    get openNextSeasonAuctionSetup(){return openNextSeasonAuctionSetup;},
    get openRoleAuction(){return openRoleAuction;},
    get playerAvatarMarkup(){return playerAvatarMarkup;},
    get playerFormMetrics(){return playerFormMetrics;},
    get playerMap(){return playerMap;},
    get playerOvrLabel(){return playerOvrLabel;},
    get playerSeasonStat(){return playerSeasonStat;},
    get playerSeasonStatus(){return playerSeasonStatus;},
    get playerStatusForDay(){return playerStatusForDay;},
    get processCpuWinterReleases(){return processCpuWinterReleases;},
    get qualitativeFormLabel(){return qualitativeFormLabel;},
    get refreshMarketValueMap(){return refreshMarketValueMap;},
    get registerSerieATransferWindowPlan(){return registerSerieATransferWindowPlan;},
    get releaseWinterPlayer(){return releaseWinterPlayer;},
    get renderAll(){return renderAll;},
    get renderCareerPowerSelection(){return renderCareerPowerSelection;},
    get renderCareerWallets(){return renderCareerWallets;},
    get renderNextSeasonFlow(){return renderNextSeasonFlow;},
    get renderSeasonDashboard(){return renderSeasonDashboard;},
    get renderSeasonKeeperChoice(){return renderSeasonKeeperChoice;},
    get renderTradeWindow(){return renderTradeWindow;},
    get renderWinterMarketIntro(){return renderWinterMarketIntro;},
    get renderWinterMarketSummary(){return renderWinterMarketSummary;},
    get renderWinterReleaseScreen(){return renderWinterReleaseScreen;},
    get roleCount(){return roleCount;},
    get roleSlotsRemaining(){return roleSlotsRemaining;},
    get saveState(){return saveState;},
    get scheduleNomination(){return scheduleNomination;},
    get serieAStrengthCache(){return serieAStrengthCache;}, set serieAStrengthCache(value){serieAStrengthCache=value;},
    get serieATransferStatsSnapshot(){return serieATransferStatsSnapshot;},
    get settleWinterMarketFinances(){return settleWinterMarketFinances;},
    get shopItemActive(){return shopItemActive;},
    get showCareerSetupStep(){return showCareerSetupStep;},
    get showScreen(){return showScreen;},
    get showToast(){return showToast;},
    get shuffledCopy(){return shuffledCopy;},
    get simulateNextSeasonSummerMarket(){return simulateNextSeasonSummerMarket;},
    get sortFantasyLeagueStandings(){return sortFantasyLeagueStandings;},
    get sortStandings(){return sortStandings;},
    get sortedSerieAStandings(){return sortedSerieAStandings;},
    get startWinterRepairAuction(){return startWinterRepairAuction;},
    get state(){return state;},
    get syncSerieATransferWorld(){return syncSerieATransferWorld;},
    get toggleWinterRelease(){return toggleWinterRelease;},
    get updateCareerIdentityControls(){return updateCareerIdentityControls;},
    get updateSerieAStandingsFromStoredMatches(){return updateSerieAStandingsFromStoredMatches;},
    get useGuaranteedWinterSale(){return useGuaranteedWinterSale;},
    get userCompletedCurrentRole(){return userCompletedCurrentRole;},
    get winterExpectedWindowId(){return winterExpectedWindowId;},
    get winterGuaranteedSaleMode(){return winterGuaranteedSaleMode;}, set winterGuaranteedSaleMode(value){winterGuaranteedSaleMode=value;},
    get winterLedgerFor(){return winterLedgerFor;},
    get winterMarketPlan(){return winterMarketPlan;},
    get winterMarketSimulationRunning(){return winterMarketSimulationRunning;}, set winterMarketSimulationRunning(value){winterMarketSimulationRunning=value;},
    get winterTransferOperationMarkup(){return winterTransferOperationMarkup;},
    get wireSeasonPlayerButtons(){return wireSeasonPlayerButtons;}
  });
  let {sortedStandings,sortedFullStandingsForView,renderFullStandingsSortState,setLeagueStandingsSort,managerById,currentUserFixture,userOpponentIdForDay,cpuFormationForDay,pendingBigMatchContext,pendingPartialPerformance,pendingPartialFantasySnapshot,pendingPartialPlayerInfo,seasonPlayerStatCards,renderSeasonPlayerModal,closeSeasonPlayerModal,wireSeasonPlayerButtons,renderLeagueNavActive,standardizeLeagueShells,fullStandingsRowsHtml,fullScheduleHtml,renderCalendarDayResults,leagueFullRosterHtml,openLeagueRosterModal,closeLeagueRosterModal,buildLeagueTopXICards,wireLeagueTopXICards,renderLeagueRostersScreen,renderLeagueCalendarScreen,renderCareerHonours,openCareerHonours,renderLeagueStandingsScreen}=window.FantaDomains['league-views'].create({
    get PRE_AUCTION_RULE_DEFS(){return PRE_AUCTION_RULE_DEFS;},
    get leagueRulesFor(){return leagueRulesFor;},
    get $(){return $;},
    get LEAGUE_STANDINGS_DEFAULT_DIRECTION(){return LEAGUE_STANDINGS_DEFAULT_DIRECTION;},
    get ROLE_LABELS(){return ROLE_LABELS;},
    get ROLE_LIMITS(){return ROLE_LIMITS;},
    get ROLE_ORDER(){return ROLE_ORDER;},
    get applyGameConfiguration(){return applyGameConfiguration;},
    get bestXIHtml(){return bestXIHtml;},
    get buildLeagueTopXICards(){return buildLeagueTopXICards;},
    get careerDivisionLabel(){return careerDivisionLabel;},
    get careerPromotionNote(){return careerPromotionNote;},
    get chooseCpuFormation(){return chooseCpuFormation;},
    get closeSeasonNewsArchive(){return closeSeasonNewsArchive;},
    get clubName(){return clubName;},
    get clubShort(){return clubShort;},
    get completedSeasonUserPosition(){return completedSeasonUserPosition;},
    get completedUserSeasonRecap(){return completedUserSeasonRecap;},
    get currentFantasyPerformance(){return currentFantasyPerformance;},
    get currentPlayerOvr(){return currentPlayerOvr;},
    get emptyPlayerSeasonStat(){return emptyPlayerSeasonStat;},
    get ensureCareerEconomy(){return ensureCareerEconomy;},
    get ensureSeasonState(){return ensureSeasonState;},
    get escapeHtml(){return escapeHtml;},
    get estimatedStarterProbability(){return estimatedStarterProbability;},
    get evolutionPlayerData(){return evolutionPlayerData;},
    get fantaclassificaIsActive(){return fantaclassificaIsActive;},
    get forcedFormationRuleForDay(){return forcedFormationRuleForDay;},
    get fullScheduleHtml(){return fullScheduleHtml;},
    get fullStandingsRowsHtml(){return fullStandingsRowsHtml;},
    get halfPoint(){return halfPoint;},
    get leagueFullRosterHtml(){return leagueFullRosterHtml;},
    get leagueStandingsSort(){return leagueStandingsSort;}, set leagueStandingsSort(value){leagueStandingsSort=value;},
    get lineupPartialContext(){return lineupPartialContext;},
    get lineupPlayersForManager(){return lineupPlayersForManager;},
    get managerById(){return managerById;},
    get openLeagueRosterModal(){return openLeagueRosterModal;},
    get pendingBigMatchContext(){return pendingBigMatchContext;},
    get pendingPartialPerformance(){return pendingPartialPerformance;},
    get playerAvatarMarkup(){return playerAvatarMarkup;},
    get playerFormMetrics(){return playerFormMetrics;},
    get playerMap(){return playerMap;},
    get playerOvrLabel(){return playerOvrLabel;},
    get playerSeasonStat(){return playerSeasonStat;},
    get playerStatusForDay(){return playerStatusForDay;},
    get renderCalendarDayResults(){return renderCalendarDayResults;},
    get renderCareerHonours(){return renderCareerHonours;},
    get renderCareerWallets(){return renderCareerWallets;},
    get renderFullStandingsSortState(){return renderFullStandingsSortState;},
    get renderLeagueNavActive(){return renderLeagueNavActive;},
    get renderLeagueStandingsScreen(){return renderLeagueStandingsScreen;},
    get renderSeasonPlayerModal(){return renderSeasonPlayerModal;},
    get renderSummary(){return renderSummary;},
    get riskAdjustmentForPerformance(){return riskAdjustmentForPerformance;},
    get seasonPlayerOwner(){return seasonPlayerOwner;},
    get seasonPlayerStatCards(){return seasonPlayerStatCards;},
    get serieAFixtureForPlayer(){return serieAFixtureForPlayer;},
    get serieAMatchupDifficulty(){return serieAMatchupDifficulty;},
    get setLeagueStandingsSort(){return setLeagueStandingsSort;},
    get shopItemActive(){return shopItemActive;},
    get showScreen(){return showScreen;},
    get sortFantasyLeagueStandings(){return sortFantasyLeagueStandings;},
    get sortedFullStandingsForView(){return sortedFullStandingsForView;},
    get sortedSerieAStandings(){return sortedSerieAStandings;},
    get sortedStandings(){return sortedStandings;},
    get state(){return state;},
    get stopHubNewsCarousel(){return stopHubNewsCarousel;},
    get userOpponentIdForDay(){return userOpponentIdForDay;},
    get visibleFormLabel(){return visibleFormLabel;},
    get wireLeagueTopXICards(){return wireLeagueTopXICards;},
    get wireSeasonPlayerButtons(){return wireSeasonPlayerButtons;}
  });
  let {ensureCareerEconomy,sponsorVisualAsset,sponsorVisualBrand,currentSponsorChoice,currentSponsorOffers,selectSeasonSponsor,selectAcademySponsorPlayer,renderSponsorSelection,seasonSponsorFromChoice,sponsorFreeSubscriptionAvailable,sponsorCanMakeShopItemFree,sortStandingsSnapshot,grantImmediateSponsorBonus,grantBigMatchSponsorReward,grantStreakSponsorReward,grantWinSponsorReward,grantFutureAuctionSponsorBonus,ensureSeasonShop,shopItemActive,careerEuros,careerFantapoints,ensureConsumableState,consumableQuantity,consumableDayEffect,addConsumable,consumeConsumable,totalConsumablesOwned,shopPurchaseOrigin,animateShopPurchase,buyConsumableItem,grantMatchdayFantapoints,careerDivisionLabel,careerPromotionNote,careerSeasonLabel,renderCareerWallets,applyGameConfiguration,formationEventChance,seasonShockChance,formationChoiceRarity,formationChoiceRarityLabel,formationRarityWeights,formationRaritiesUnlocked,specialFormationEventsUnlocked,deterministicFormationTemplateOrder,buyShopItem,shopItemsPerPage,shopItemEffectLine,shopCardHtml,closeShopProductModal,openShopProductModal,renderShopItems}=window.FantaDomains['shop-controller'].create({
    get $(){return $;},
    get CAREER_STARTING_EUROS(){return CAREER_STARTING_EUROS;},
    get CareerEngine(){return CareerEngine;},
    get FORMATION_CHOICE_RARITY_BY_TEMPLATE(){return FORMATION_CHOICE_RARITY_BY_TEMPLATE;},
    get FORMATION_CHOICE_TEMPLATES(){return FORMATION_CHOICE_TEMPLATES;},
    get FORMATION_EVENT_CHANCE(){return FORMATION_EVENT_CHANCE;},
    get GAME_CONFIG(){return GAME_CONFIG;},
    get SEASON_SPONSORS(){return SEASON_SPONSORS;},
    get SHOP_ITEMS(){return SHOP_ITEMS;},
    get SPECIAL_FORMATION_EVENT_TEMPLATE_IDS(){return SPECIAL_FORMATION_EVENT_TEMPLATE_IDS;},
    get SPONSOR_FREE_SHOP_IDS(){return SPONSOR_FREE_SHOP_IDS;},
    get addConsumable(){return addConsumable;},
    get animateMatchdayRewardNumber(){return animateMatchdayRewardNumber;},
    get animateShopPurchase(){return animateShopPurchase;},
    get buyConsumableItem(){return buyConsumableItem;},
    get buyShopItem(){return buyShopItem;},
    get careerDivisionLabel(){return careerDivisionLabel;},
    get careerEuros(){return careerEuros;},
    get careerFantapoints(){return careerFantapoints;},
    get careerHash(){return careerHash;},
    get careerSeasonLabel(){return careerSeasonLabel;},
    get clamp(){return clamp;},
    get closeShopProductModal(){return closeShopProductModal;},
    get consumableQuantity(){return consumableQuantity;},
    get currentPlayerOvr(){return currentPlayerOvr;},
    get currentSponsorChoice(){return currentSponsorChoice;},
    get currentSponsorOffers(){return currentSponsorOffers;},
    get ensureCareerEconomy(){return ensureCareerEconomy;},
    get ensureConsumableState(){return ensureConsumableState;},
    get ensureSeasonState(){return ensureSeasonState;},
    get escapeHtml(){return escapeHtml;},
    get formationChoiceRarity(){return formationChoiceRarity;},
    get formationEventChance(){return formationEventChance;},
    get formationRaritiesUnlocked(){return formationRaritiesUnlocked;},
    get formationRarityWeights(){return formationRarityWeights;},
    get openShopProductModal(){return openShopProductModal;},
    get renderCareerWallets(){return renderCareerWallets;},
    get renderLeagueShopScreen(){return renderLeagueShopScreen;},
    get renderShopItems(){return renderShopItems;},
    get renderSponsorSelection(){return renderSponsorSelection;},
    get saveState(){return saveState;},
    get selectAcademySponsorPlayer(){return selectAcademySponsorPlayer;},
    get selectSeasonSponsor(){return selectSeasonSponsor;},
    get shopCardHtml(){return shopCardHtml;},
    get shopCategoryFilter(){return shopCategoryFilter;}, set shopCategoryFilter(value){shopCategoryFilter=value;},
    get shopItemActive(){return shopItemActive;},
    get shopItemEffectLine(){return shopItemEffectLine;},
    get shopItemsPerPage(){return shopItemsPerPage;},
    get shopPageIndex(){return shopPageIndex;}, set shopPageIndex(value){shopPageIndex=value;},
    get shopPurchaseOrigin(){return shopPurchaseOrigin;},
    get showToast(){return showToast;},
    get shuffledCopy(){return shuffledCopy;},
    get sortFantasyLeagueStandings(){return sortFantasyLeagueStandings;},
    get sortStandingsSnapshot(){return sortStandingsSnapshot;},
    get specialFormationEventsUnlocked(){return specialFormationEventsUnlocked;},
    get sponsorCanMakeShopItemFree(){return sponsorCanMakeShopItemFree;},
    get sponsorFreeSubscriptionAvailable(){return sponsorFreeSubscriptionAvailable;},
    get sponsorVisualAsset(){return sponsorVisualAsset;},
    get sponsorVisualBrand(){return sponsorVisualBrand;},
    get state(){return state;},
    get totalConsumablesOwned(){return totalConsumablesOwned;}
  });
  let {estimatedStarterProbability,scoutStarterBadge,assistantAutoLineupCapabilities,assistantBasePlayerValue,advancedAutoLineupValue,assistantAutoLineupAnalysisHtml,buildAdvancedAutoLineup,bestAdvancedFormation}=window.FantaDomains['assistant-policy'].create({
    get activeFormationChoice(){return activeFormationChoice;},
    get adaptTacticalProLineup(){return adaptTacticalProLineup;},
    get adminBlockedStarterForManager(){return adminBlockedStarterForManager;},
    get advancedAutoLineupValue(){return advancedAutoLineupValue;},
    get allowedLineupFormation(){return allowedLineupFormation;},
    get assistantAutoLineupCapabilities(){return assistantAutoLineupCapabilities;},
    get assistantBasePlayerValue(){return assistantBasePlayerValue;},
    get availableLineupFormations(){return availableLineupFormations;},
    get buildAdvancedAutoLineup(){return buildAdvancedAutoLineup;},
    get careerHash(){return careerHash;},
    get clamp(){return clamp;},
    get clubRoleStarterSlots(){return clubRoleStarterSlots;},
    get currentPlayerOvr(){return currentPlayerOvr;},
    get enforceFaithReserveStarterInLineup(){return enforceFaithReserveStarterInLineup;},
    get enforcePlayerBenchedInLineup(){return enforcePlayerBenchedInLineup;},
    get ensureSeasonState(){return ensureSeasonState;},
    get estimatedStarterProbability(){return estimatedStarterProbability;},
    get lineupCountsForFormation(){return lineupCountsForFormation;},
    get lineupPlayerValue(){return lineupPlayerValue;},
    get lineupSlots(){return lineupSlots;},
    get normalizedStarterProbability(){return normalizedStarterProbability;},
    get playerFormMetrics(){return playerFormMetrics;},
    get playerMap(){return playerMap;},
    get playerSeasonStat(){return playerSeasonStat;},
    get playerStatusForDay(){return playerStatusForDay;},
    get serieAMatchupDifficulty(){return serieAMatchupDifficulty;},
    get shopItemActive(){return shopItemActive;},
    get starterHierarchyBias(){return starterHierarchyBias;},
    get starterReportActive(){return starterReportActive;},
    get state(){return state;},
    get tacticalExpectedLineupPoints(){return tacticalExpectedLineupPoints;},
    get worldPlayerModifier(){return worldPlayerModifier;}
  });
  let {evolutionPlayerData,evolutionPotentialClass,evolutionHighlightHtml,evolutionPlayerRowHtml,dataCenterContext,dataCenterPremiumHtml,renderDataCenterOverviewPanel,dataCenterPlayerRowHtml,renderDataCenterPlayersPanel,renderDataCenterEvolutionPanel,setDataCenterTab,renderLeagueDataCenterScreen,renderLeagueEvolutionScreen}=window.FantaDomains['datacenter-views'].create({
    get $(){return $;},
    get assistantAutoLineupAnalysisHtml(){return assistantAutoLineupAnalysisHtml;},
    get auctionObserverActive(){return auctionObserverActive;},
    get bestAdvancedFormation(){return bestAdvancedFormation;},
    get buildAdvancedAutoLineup(){return buildAdvancedAutoLineup;},
    get clubName(){return clubName;},
    get currentPlayerOvr(){return currentPlayerOvr;},
    get dataCenterContext(){return dataCenterContext;},
    get dataCenterPlayerRowHtml(){return dataCenterPlayerRowHtml;},
    get dataCenterPremiumHtml(){return dataCenterPremiumHtml;},
    get dataCenterTab(){return dataCenterTab;}, set dataCenterTab(value){dataCenterTab=value;},
    get emptyPlayerSeasonStat(){return emptyPlayerSeasonStat;},
    get ensureSeasonState(){return ensureSeasonState;},
    get escapeHtml(){return escapeHtml;},
    get estimatedStarterProbability(){return estimatedStarterProbability;},
    get evolutionFilter(){return evolutionFilter;}, set evolutionFilter(value){evolutionFilter=value;},
    get evolutionHighlightHtml(){return evolutionHighlightHtml;},
    get evolutionPlayerData(){return evolutionPlayerData;},
    get evolutionPlayerRowHtml(){return evolutionPlayerRowHtml;},
    get evolutionPotentialClass(){return evolutionPotentialClass;},
    get managerById(){return managerById;},
    get playerFormMetrics(){return playerFormMetrics;},
    get playerOvrLabel(){return playerOvrLabel;},
    get playerSeasonPotentialProfile(){return playerSeasonPotentialProfile;},
    get playerAvatarMarkup(){return playerAvatarMarkup;},
    get playerSeasonStat(){return playerSeasonStat;},
    get playerStatusForDay(){return playerStatusForDay;},
    get qualitativeFormLabel(){return qualitativeFormLabel;},
    get renderCareerWallets(){return renderCareerWallets;},
    get renderDataCenterEvolutionPanel(){return renderDataCenterEvolutionPanel;},
    get renderDataCenterOverviewPanel(){return renderDataCenterOverviewPanel;},
    get renderDataCenterPlayersPanel(){return renderDataCenterPlayersPanel;},
    get renderLeagueDataCenterScreen(){return renderLeagueDataCenterScreen;},
    get renderLeagueNavActive(){return renderLeagueNavActive;},
    get renderSummary(){return renderSummary;},
    get requestOpenLineup(){return requestOpenLineup;},
    get seasonPlayerOwner(){return seasonPlayerOwner;},
    get serieAFixtureForPlayer(){return serieAFixtureForPlayer;},
    get serieAMatchupBadgeHtml(){return serieAMatchupBadgeHtml;},
    get serieAMatchupDifficulty(){return serieAMatchupDifficulty;},
    get setDataCenterTab(){return setDataCenterTab;},
    get shopItemActive(){return shopItemActive;},
    get showScreen(){return showScreen;},
    get state(){return state;},
    get stopHubNewsCarousel(){return stopHubNewsCarousel;},
    get wireSeasonPlayerButtons(){return wireSeasonPlayerButtons;}
  });
  let {socialOwnedPlayers,socialHandle,socialPersonality,ensureSocialState,socialConversation,socialMotivationForPlayer,socialRelationLabel,socialMessageTone,socialReactionData,socialReplyText,socialRecordMotivation,socialSendMessage,socialPlayerAvatarHtml,socialConversationPreview,socialStoryHtml,socialConversationRowHtml,socialMessageHtml,renderSocialChat,renderLeagueSocialScreen,sendCurrentSocialMessage,renderLeagueShopScreen}=window.FantaDomains['social-controller'].create({
    get $(){return $;},
    get careerHash(){return careerHash;},
    get clamp(){return clamp;},
    get clubName(){return clubName;},
    get clubShort(){return clubShort;},
    get ensureSeasonState(){return ensureSeasonState;},
    get ensureSocialState(){return ensureSocialState;},
    get escapeHtml(){return escapeHtml;},
    get managerById(){return managerById;},
    get playerAvatarMarkup(){return playerAvatarMarkup;},
    get playerFormMetrics(){return playerFormMetrics;},
    get playerOvrLabel(){return playerOvrLabel;},
    get renderCareerWallets(){return renderCareerWallets;},
    get renderLeagueNavActive(){return renderLeagueNavActive;},
    get renderLeagueSocialScreen(){return renderLeagueSocialScreen;},
    get renderShopItems(){return renderShopItems;},
    get renderSocialChat(){return renderSocialChat;},
    get renderSummary(){return renderSummary;},
    get saveState(){return saveState;},
    get showScreen(){return showScreen;},
    get showToast(){return showToast;},
    get socialConversation(){return socialConversation;},
    get socialConversationPreview(){return socialConversationPreview;},
    get socialHandle(){return socialHandle;},
    get socialMessageHtml(){return socialMessageHtml;},
    get socialMessageTone(){return socialMessageTone;},
    get socialMotivationForPlayer(){return socialMotivationForPlayer;},
    get socialOwnedPlayers(){return socialOwnedPlayers;},
    get socialPersonality(){return socialPersonality;},
    get socialPlayerAvatarHtml(){return socialPlayerAvatarHtml;},
    get socialReactionData(){return socialReactionData;},
    get socialRecordMotivation(){return socialRecordMotivation;},
    get socialRelationLabel(){return socialRelationLabel;},
    get socialReplyText(){return socialReplyText;},
    get socialSearchQuery(){return socialSearchQuery;},
    get socialSelectedPlayerId(){return socialSelectedPlayerId;}, set socialSelectedPlayerId(value){socialSelectedPlayerId=value;},
    get socialSendMessage(){return socialSendMessage;},
    get socialStoryHtml(){return socialStoryHtml;},
    get state(){return state;},
    get stopHubNewsCarousel(){return stopHubNewsCarousel;}
  });
  let {expertStarterLabel,expertAdviceAnalysis,expertAdviceScore,expertAdviceSentence,expertPrecisionActive,expertPrecisionScoreBonus,expertDayState,intuitionExpertSentence,expertReasonParagraphs,renderExpertStory,changeExpertStoryStep,closeExpertReason,openExpertReason,renderExpertAdvice}=window.FantaDomains['expert-controller'].create({
    get $(){return $;},
    get EXPERT_IDS(){return EXPERT_IDS;},
    get INTUITION_EXPERTS(){return INTUITION_EXPERTS;},
    get INTUITION_KIND_LABEL(){return INTUITION_KIND_LABEL;},
    get careerHash(){return careerHash;},
    get closeExpertReason(){return closeExpertReason;},
    get currentPlayerOvr(){return currentPlayerOvr;},
    get ensureSeasonState(){return ensureSeasonState;},
    get escapeHtml(){return escapeHtml;},
    get estimatedStarterProbability(){return estimatedStarterProbability;},
    get expertAdviceAnalysis(){return expertAdviceAnalysis;},
    get expertAdviceSentence(){return expertAdviceSentence;},
    get expertDayState(){return expertDayState;},
    get expertPrecisionActive(){return expertPrecisionActive;},
    get expertPrecisionScoreBonus(){return expertPrecisionScoreBonus;},
    get expertReasonParagraphs(){return expertReasonParagraphs;},
    get expertStarterLabel(){return expertStarterLabel;},
    get expertStoryState(){return expertStoryState;}, set expertStoryState(value){expertStoryState=value;},
    get intuitionExpertSentence(){return intuitionExpertSentence;},
    get managerById(){return managerById;},
    get openExpertReason(){return openExpertReason;},
    get playerAvatarMarkup(){return playerAvatarMarkup;},
    get playerFormMetrics(){return playerFormMetrics;},
    get playerMap(){return playerMap;},
    get playerOvrLabel(){return playerOvrLabel;},
    get playerSeasonStat(){return playerSeasonStat;},
    get playerStatusForDay(){return playerStatusForDay;},
    get qualitativeFormLabel(){return qualitativeFormLabel;},
    get renderExpertStory(){return renderExpertStory;},
    get serieAFixtureForPlayer(){return serieAFixtureForPlayer;},
    get serieAMatchupDifficulty(){return serieAMatchupDifficulty;},
    get shopItemActive(){return shopItemActive;},
    get state(){return state;}
  });
  let {hubNewsTypeLabel,hubNewsTheme,ensureSeasonNewsState,addSeasonNews,fantasyResultForManager,recentManagerRun,managerStreak,newsFixtureForDay,generatePreMatchNews,generatePostMatchNews,ensureSeasonNewsForCurrentState,buildHubNews,newsReliabilityLabel,seasonNewsPlayerAvatarHtml,renderSeasonNewsArchive,openSeasonNewsArchive,closeSeasonNewsArchive,stopHubNewsCarousel,setHubNewsSlide,startHubNewsCarousel,renderHubNews,managerRecentLeagueResults,deterministicCpuFormation,managerMostUsedFormation,matchCenterProbablePlayers,managerRoleData,matchCenterKeyPlayer,matchCenterRecommendedFormation,renderMatchCenter,openMatchCenter,closeMatchCenter,renderSeasonDashboard,renderOpponentMalusBanner,showOpponentMalusNotice,closeOpponentMalusNotice,showWeekendArrivalLoading}=window.FantaDomains['dashboard-controller'].create({
    get $(){return $;},
    get FANTASY_SEASON_MATCHDAYS(){return FANTASY_SEASON_MATCHDAYS;},
    get LINEUP_FORMATIONS(){return LINEUP_FORMATIONS;},
    get activateWinterTransferWindowIfNeeded(){return activateWinterTransferWindowIfNeeded;},
    get addSeasonNews(){return addSeasonNews;},
    get advancedAutoLineupValue(){return advancedAutoLineupValue;},
    get applySeasonFixtureHeroVisuals(){return applySeasonFixtureHeroVisuals;},
    get assistantAutoLineupAnalysisHtml(){return assistantAutoLineupAnalysisHtml;},
    get assistantCoachCarryEnabled(){return assistantCoachCarryEnabled;},
    get availableLineupFormations(){return availableLineupFormations;},
    get bestAdvancedFormation(){return bestAdvancedFormation;},
    get bestPlayersForRole(){return bestPlayersForRole;},
    get buildAdvancedAutoLineup(){return buildAdvancedAutoLineup;},
    get buildHubNews(){return buildHubNews;},
    get careerHash(){return careerHash;},
    get clamp(){return clamp;},
    get closeMatchCenter(){return closeMatchCenter;},
    get clubName(){return clubName;},
    get clubShort(){return clubShort;},
    get cpuLeagueFormationBias(){return cpuLeagueFormationBias;},
    get currentPlayerOvr(){return currentPlayerOvr;},
    get currentUserFixture(){return currentUserFixture;},
    get deterministicCpuFormation(){return deterministicCpuFormation;},
    get emptyPlayerSeasonStat(){return emptyPlayerSeasonStat;},
    get ensureManagerTeamIdentityState(){return ensureManagerTeamIdentityState;},
    get ensureMatchdayFlowEntry(){return ensureMatchdayFlowEntry;},
    get ensureOpponentMalusRoll(){return ensureOpponentMalusRoll;},
    get ensureSeasonNewsForCurrentState(){return ensureSeasonNewsForCurrentState;},
    get ensureSeasonNewsState(){return ensureSeasonNewsState;},
    get ensureSeasonState(){return ensureSeasonState;},
    get escapeHtml(){return escapeHtml;},
    get estimatedStarterProbability(){return estimatedStarterProbability;},
    get fantaclassificaIsActive(){return fantaclassificaIsActive;},
    get fantasyResultForManager(){return fantasyResultForManager;},
    get generatePreMatchNews(){return generatePreMatchNews;},
    get hashPick(){return hashPick;},
    get hubNewsCarouselCount(){return hubNewsCarouselCount;}, set hubNewsCarouselCount(value){hubNewsCarouselCount=value;},
    get hubNewsCarouselIndex(){return hubNewsCarouselIndex;}, set hubNewsCarouselIndex(value){hubNewsCarouselIndex=value;},
    get hubNewsCarouselTimer(){return hubNewsCarouselTimer;}, set hubNewsCarouselTimer(value){hubNewsCarouselTimer=value;},
    get hubNewsTheme(){return hubNewsTheme;},
    get hubNewsTypeLabel(){return hubNewsTypeLabel;},
    get lineupCountsForFormation(){return lineupCountsForFormation;},
    get lineupPlayerValue(){return lineupPlayerValue;},
    get managerById(){return managerById;},
    get managerStreak(){return managerStreak;},
    get newsFixtureForDay(){return newsFixtureForDay;},
    get newsReliabilityLabel(){return newsReliabilityLabel;},
    get opponentMalusNoticeDay(){return opponentMalusNoticeDay;}, set opponentMalusNoticeDay(value){opponentMalusNoticeDay=value;},
    get opponentMalusNoticeFocus(){return opponentMalusNoticeFocus;}, set opponentMalusNoticeFocus(value){opponentMalusNoticeFocus=value;},
    get pendingPartialFantasySnapshot(){return pendingPartialFantasySnapshot;},
    get playerAvatarMarkup(){return playerAvatarMarkup;},
    get playerFormMetrics(){return playerFormMetrics;},
    get playerMap(){return playerMap;},
    get playerOvrLabel(){return playerOvrLabel;},
    get playerSeasonStat(){return playerSeasonStat;},
    get playerStatusForDay(){return playerStatusForDay;},
    get qualitativeFormLabel(){return qualitativeFormLabel;},
    get recentManagerRun(){return recentManagerRun;},
    get renderCareerWallets(){return renderCareerWallets;},
    get renderExpertAdvice(){return renderExpertAdvice;},
    get renderFixtureCoachPortrait(){return renderFixtureCoachPortrait;},
    get renderHubNews(){return renderHubNews;},
    get renderLeagueNavActive(){return renderLeagueNavActive;},
    get renderMatchCenter(){return renderMatchCenter;},
    get renderOpponentMalusBanner(){return renderOpponentMalusBanner;},
    get renderSeasonNewsArchive(){return renderSeasonNewsArchive;},
    get renderSummary(){return renderSummary;},
    get requestOpenLineup(){return requestOpenLineup;},
    get routeWinterMarketFlow(){return routeWinterMarketFlow;},
    get saveState(){return saveState;},
    get seasonFixtureTheme(){return seasonFixtureTheme;},
    get seasonNewsPlayerAvatarHtml(){return seasonNewsPlayerAvatarHtml;},
    get seedAssistantCoachLineupForDay(){return seedAssistantCoachLineupForDay;},
    get serieAFixtureForPlayer(){return serieAFixtureForPlayer;},
    get serieAMatchupBadgeHtml(){return serieAMatchupBadgeHtml;},
    get serieAMatchupDifficulty(){return serieAMatchupDifficulty;},
    get setHubNewsSlide(){return setHubNewsSlide;},
    get shopItemActive(){return shopItemActive;},
    get showScreen(){return showScreen;},
    get sortedStandings(){return sortedStandings;},
    get startHubNewsCarousel(){return startHubNewsCarousel;},
    get state(){return state;},
    get stopHubNewsCarousel(){return stopHubNewsCarousel;},
    get visibleNewsDetail(){return visibleNewsDetail;},
    get weekendArrivalLoading(){return weekendArrivalLoading;}, set weekendArrivalLoading(value){weekendArrivalLoading=value;},
    get wireSeasonPlayerButtons(){return wireSeasonPlayerButtons;}
  });
  let {continueMatchdayFromLineup,handleDashboardPrimaryAction}=window.FantaDomains['matchday-controller'].create({
    get continueMatchdayFromLineup(){return continueMatchdayFromLineup;},
    get ensureAllPreMatchEventRolls(){return ensureAllPreMatchEventRolls;},
    get ensureMatchdayFlowEntry(){return ensureMatchdayFlowEntry;},
    get ensureSeasonState(){return ensureSeasonState;},
    get nextPendingMatchdayEvent(){return nextPendingMatchdayEvent;},
    get renderAdminRuleModal(){return renderAdminRuleModal;},
    get renderFormationChoiceModal(){return renderFormationChoiceModal;},
    get renderNextSeasonFlow(){return renderNextSeasonFlow;},
    get renderSeasonDashboard(){return renderSeasonDashboard;},
    get saveState(){return saveState;},
    get setMatchdayFlowPhase(){return setMatchdayFlowPhase;},
    get showOpponentMalusNotice(){return showOpponentMalusNotice;},
    get showToast(){return showToast;},
    get showWeekendArrivalLoading(){return showWeekendArrivalLoading;},
    get startSerieALiveMatchday(){return startSerieALiveMatchday;},
    get weekendArrivalLoading(){return weekendArrivalLoading;}
  });
  let {lineupDayKey,ensureLineupDayStore,lineupSlots,lineupRequiredStarters,lineupPlayerValue,cpuLeagueRuleLineupValue,cpuLeagueFormationBias,lineupCountsForFormation,normalizeSavedLineup,syncDraftBenchOrder,draftBenchPlayers,moveBenchPlayer,openLineupScreen,draftStarterIds,draftSlotForPlayer,draftPlayerById,setDraftFormation,selectLineupPlayer,nominateLineupCaptain,placePlayerInSlot,openLineupSlotPicker,placeSelectedInSlot,benchSelectedPlayer,clearLineupDragVisuals,beginLineupDrag,endLineupDrag,bindLineupDragDrop,clearDraftLineup,bestPlayersForRole,buildAutoLineup,formationCpuBias,chooseCpuFormation,tacticalExpectedPlayerPoints,tacticalExpectedLineupPoints,adaptTacticalProLineup,autoFillUserLineup,ensureAssistantCoachLineup,assistantCoachCarryEnabled,saveAssistantCoachTemplateFromDraft,toggleAssistantCoachCarry,assistantCoachTemplateForDay,repairAssistantInheritedLineup,seedAssistantCoachLineupForDay,unavailableDraftStarters,repairUnavailableStartersInDraft,saveLineupDraft,confirmUserLineup,closeConsumableModal,lineupConsumableActionState,renderConsumableInventory,openConsumableInventory,beginConsumableUse,showConsumableTargets,applyTargetedConsumable,enforceOpponentConsumableBlock,renderLineupScreen}=window.FantaDomains['lineup-controller'].create({
    get $(){return $;},
    get LINEUP_FORMATIONS(){return LINEUP_FORMATIONS;},
    get ROLE_LABELS(){return ROLE_LABELS;},
    get ROLE_ORDER(){return ROLE_ORDER;},
    get ROLE_PLURALS(){return ROLE_PLURALS;},
    get SHOP_ITEMS(){return SHOP_ITEMS;},
    get activeAdminRule(){return activeAdminRule;},
    get activeAdminRuleEffect(){return activeAdminRuleEffect;},
    get activeFormationChoice(){return activeFormationChoice;},
    get activeOpponentMalus(){return activeOpponentMalus;},
    get adminBlockedStarterForManager(){return adminBlockedStarterForManager;},
    get adminFaithReserveEligibleIds(){return adminFaithReserveEligibleIds;},
    get adminForcedStarterForManager(){return adminForcedStarterForManager;},
    get adminWildcardStartingSlotLimit(){return adminWildcardStartingSlotLimit;},
    get advancedAutoLineupValue(){return advancedAutoLineupValue;},
    get allowedLineupFormation(){return allowedLineupFormation;},
    get applyTargetedConsumable(){return applyTargetedConsumable;},
    get assistantAutoLineupAnalysisHtml(){return assistantAutoLineupAnalysisHtml;},
    get assistantAutoLineupCapabilities(){return assistantAutoLineupCapabilities;},
    get assistantCoachCarryEnabled(){return assistantCoachCarryEnabled;},
    get assistantCoachTemplateForDay(){return assistantCoachTemplateForDay;},
    get availableLineupFormations(){return availableLineupFormations;},
    get beginConsumableUse(){return beginConsumableUse;},
    get beginLineupDrag(){return beginLineupDrag;},
    get benchSelectedPlayer(){return benchSelectedPlayer;},
    get bestAdvancedFormation(){return bestAdvancedFormation;},
    get bestPlayersForRole(){return bestPlayersForRole;},
    get bindLineupDragDrop(){return bindLineupDragDrop;},
    get blockedOpponentPlayerIds(){return blockedOpponentPlayerIds;},
    get blockedOpponentPlayerId(){return blockedOpponentPlayerId;},
    get buildAdvancedAutoLineup(){return buildAdvancedAutoLineup;},
    get buildAutoLineup(){return buildAutoLineup;},
    get canPlacePlayerInLineupSlot(){return canPlacePlayerInLineupSlot;},
    get clamp(){return clamp;},
    get clearLineupDragVisuals(){return clearLineupDragVisuals;},
    get closeConsumableModal(){return closeConsumableModal;},
    get clubShort(){return clubShort;},
    get compactLineupPlayerName(){return compactLineupPlayerName;},
    get consumableDayEffect(){return consumableDayEffect;},
    get consumableQuantity(){return consumableQuantity;},
    get consumeConsumable(){return consumeConsumable;},
    get cpuFormationForDay(){return cpuFormationForDay;},
    get cpuLeagueFormationBias(){return cpuLeagueFormationBias;},
    get cpuLeagueRuleLineupValue(){return cpuLeagueRuleLineupValue;},
    get cpuLeagueRuleSensitivity(){return cpuLeagueRuleSensitivity;},
    get currentPlayerOvr(){return currentPlayerOvr;},
    get currentUserFixture(){return currentUserFixture;},
    get draftBenchPlayers(){return draftBenchPlayers;},
    get draftPlayerById(){return draftPlayerById;},
    get draftSlotForPlayer(){return draftSlotForPlayer;},
    get draftStarterIds(){return draftStarterIds;},
    get endLineupDrag(){return endLineupDrag;},
    get enforceAdminLastReserve(){return enforceAdminLastReserve;},
    get enforceFaithReserveStarterInLineup(){return enforceFaithReserveStarterInLineup;},
    get enforcePlayerBenchedInLineup(){return enforcePlayerBenchedInLineup;},
    get enforceStarterInLineup(){return enforceStarterInLineup;},
    get ensureAssistantCoachLineup(){return ensureAssistantCoachLineup;},
    get ensureForcedFormationDraft(){return ensureForcedFormationDraft;},
    get ensureLineupDayStore(){return ensureLineupDayStore;},
    get ensureSeasonState(){return ensureSeasonState;},
    get escapeHtml(){return escapeHtml;},
    get estimatedStarterProbability(){return estimatedStarterProbability;},
    get fantasyRuleForDay(){return fantasyRuleForDay;},
    get forcedFormationRuleForDay(){return forcedFormationRuleForDay;},
    get formationChoiceCategoryClass(){return formationChoiceCategoryClass;},
    get formationChoiceCategoryLabel(){return formationChoiceCategoryLabel;},
    get formationCpuBias(){return formationCpuBias;},
    get leagueRulesFor(){return leagueRulesFor;},
    get lineupAssistantAdjustments(){return lineupAssistantAdjustments;}, set lineupAssistantAdjustments(value){lineupAssistantAdjustments=value;},
    get lineupConsumableActionState(){return lineupConsumableActionState;},
    get lineupCountsForFormation(){return lineupCountsForFormation;},
    get lineupDayKey(){return lineupDayKey;},
    get lineupDraft(){return lineupDraft;}, set lineupDraft(value){lineupDraft=value;},
    get lineupDragPlayerId(){return lineupDragPlayerId;}, set lineupDragPlayerId(value){lineupDragPlayerId=value;},
    get lineupOutOfRoleEntries(){return lineupOutOfRoleEntries;},
    get lineupPartialContext(){return lineupPartialContext;}, set lineupPartialContext(value){lineupPartialContext=value;},
    get lineupPlayerFaceMarkup(){return lineupPlayerFaceMarkup;},
    get lineupPlayerValue(){return lineupPlayerValue;},
    get lineupReadOnly(){return lineupReadOnly;}, set lineupReadOnly(value){lineupReadOnly=value;},
    get lineupRequiredStarters(){return lineupRequiredStarters;},
    get lineupSelectedPlayerId(){return lineupSelectedPlayerId;}, set lineupSelectedPlayerId(value){lineupSelectedPlayerId=value;},
    get lineupSlots(){return lineupSlots;},
    get lineupTurnoverDeltaFromPrevious(){return lineupTurnoverDeltaFromPrevious;},
    get managerById(){return managerById;},
    get moveBenchPlayer(){return moveBenchPlayer;},
    get normalizeSavedLineup(){return normalizeSavedLineup;},
    get openLineupSlotPicker(){return openLineupSlotPicker;},
    get pendingBigMatchContext(){return pendingBigMatchContext;},
    get pendingPartialFantasySnapshot(){return pendingPartialFantasySnapshot;},
    get pendingPartialPlayerInfo(){return pendingPartialPlayerInfo;},
    get placePlayerInSlot(){return placePlayerInSlot;},
    get playerFormMetrics(){return playerFormMetrics;},
    get playerOvrLabel(){return playerOvrLabel;},
    get playerSeasonStat(){return playerSeasonStat;},
    get playerStatusForDay(){return playerStatusForDay;},
    get renderCareerWallets(){return renderCareerWallets;},
    get renderConsumableInventory(){return renderConsumableInventory;},
    get renderLineupScreen(){return renderLineupScreen;},
    get renderSeasonDashboard(){return renderSeasonDashboard;},
    get repairAssistantInheritedLineup(){return repairAssistantInheritedLineup;},
    get repairUnavailableStartersInDraft(){return repairUnavailableStartersInDraft;},
    get saveAssistantCoachTemplateFromDraft(){return saveAssistantCoachTemplateFromDraft;},
    get saveLineupDraft(){return saveLineupDraft;},
    get saveState(){return saveState;},
    get scoutStarterBadge(){return scoutStarterBadge;},
    get seedAssistantCoachLineupForDay(){return seedAssistantCoachLineupForDay;},
    get selectLineupPlayer(){return selectLineupPlayer;},
    get serieAFixtureForPlayer(){return serieAFixtureForPlayer;},
    get serieAMatchupDifficulty(){return serieAMatchupDifficulty;},
    get setDraftFormation(){return setDraftFormation;},
    get shopItemActive(){return shopItemActive;},
    get showConsumableTargets(){return showConsumableTargets;},
    get showScreen(){return showScreen;},
    get showToast(){return showToast;},
    get specialTrainingPlayerIds(){return specialTrainingPlayerIds;},
    get specialTrainingUsedForPlayer(){return specialTrainingUsedForPlayer;},
    get starterReportActive(){return starterReportActive;},
    get state(){return state;},
    get stopHubNewsCarousel(){return stopHubNewsCarousel;},
    get syncDraftBenchOrder(){return syncDraftBenchOrder;},
    get tacticalExpectedLineupPoints(){return tacticalExpectedLineupPoints;},
    get tacticalExpectedPlayerPoints(){return tacticalExpectedPlayerPoints;},
    get totalConsumablesOwned(){return totalConsumablesOwned;},
    get unavailableDraftStarters(){return unavailableDraftStarters;},
    get userOpponentIdForDay(){return userOpponentIdForDay;},
    get validateAdminRuleLineup(){return validateAdminRuleLineup;},
    get visibleFormLabel(){return visibleFormLabel;},
    get wildcardSlotCompatible(){return wildcardSlotCompatible;}
  });
  let {formationChoiceCategoryLabel,formationChoiceCategoryClass,formationChoiceDayState,adminRuleDayState,activeAdminRule,activeAdminRuleEffect,hasPendingMatchdayEvent,nextPendingMatchdayEvent,hashPick,sortedByChoiceHash,isDerbyFixtureForPlayer,formationChoiceContextForManagers,fantasyAppearanceRate,formationChoiceContext,specialRivalManager,opponentMalusDayState,opponentMalusChanceForManager,generateOpponentMalusOption,ensureOpponentMalusRoll,activeOpponentMalus,generateFormationChoiceOptions,sanitizeLockedFormationChoiceEntry,adminRuleRarityProfile,generateAdminRuleOption,ensureAdminRuleRoll,ensureAllPreMatchEventRolls,forcedFormationRuleForDay,adminForcedStarterForManager,adminBenchableTopPlayer,previousUnusedBenchEligibleIds,adminBlockedStarterForManager,adminFaithReserveEligibleIds,adminWildcardStartingSlotLimit,wildcardSlotCompatible,lineupOutOfRoleEntries,canPlacePlayerInLineupSlot,enforceStarterInLineup,enforceAdminLastReserve,enforcePlayerBenchedInLineup,enforceFaithReserveStarterInLineup,lineupTurnoverDeltaFromPrevious,validateAdminRuleLineup,adminRuleNeedsLineupReconfirm,syncFlowAfterPreMatchResolution,adminRuleCover,ensureForcedFormationDraft,ensureFormationChoiceRoll,activeFormationChoice,tacticForManager,riskAdjustmentForPerformance,fantasyRuleForDay,starterReportActive,specialTrainingPlayerIds,specialTrainingPlayerId,specialTrainingUsedForPlayer,blockedOpponentPlayerIds,blockedOpponentPlayerId,worldPlayerModifier,formationPlayerModifier,formationChoiceCover,rerollFormationChoiceCards,rerollAdminRuleCard,renderFormationChoiceModal,resolveSeasonShock,openNextSeasonEvent,hideFormationChoiceModal,renderAdminRuleModal,hideAdminRuleModal,minimizeMatchdayEvent,restoreMatchdayEvent,resolveAdminRule,resolveFormationChoice,requestOpenLineup}=window.FantaDomains['matchday-events-controller'].create({
    get $(){return $;},
    get ADMIN_RULE_EVENT_CHANCE(){return ADMIN_RULE_EVENT_CHANCE;},
    get ADMIN_RULE_RARITY_PROFILES(){return ADMIN_RULE_RARITY_PROFILES;},
    get ADMIN_RULE_TEMPLATES(){return ADMIN_RULE_TEMPLATES;},
    get FANTASY_MAX_SUBS(){return FANTASY_MAX_SUBS;},
    get FANTASY_SEASON_MATCHDAYS(){return FANTASY_SEASON_MATCHDAYS;},
    get FORMATION_CHOICE_TEMPLATES(){return FORMATION_CHOICE_TEMPLATES;},
    get GAME_CONFIG(){return GAME_CONFIG;},
    get LINEUP_FORMATIONS(){return LINEUP_FORMATIONS;},
    get SERIEA_DERBY_PAIRS(){return SERIEA_DERBY_PAIRS;},
    get SERIEA_MIN_VOTE_MINUTES(){return SERIEA_MIN_VOTE_MINUTES;},
    get SPECIAL_RIVAL_IDS(){return SPECIAL_RIVAL_IDS;},
    get activeAdminRule(){return activeAdminRule;},
    get activeAdminRuleEffect(){return activeAdminRuleEffect;},
    get activeFormationChoice(){return activeFormationChoice;},
    get activeOpponentMalus(){return activeOpponentMalus;},
    get adminBlockedStarterForManager(){return adminBlockedStarterForManager;},
    get adminFaithReserveEligibleIds(){return adminFaithReserveEligibleIds;},
    get adminRuleCover(){return adminRuleCover;},
    get adminRuleDayState(){return adminRuleDayState;},
    get adminRuleNeedsLineupReconfirm(){return adminRuleNeedsLineupReconfirm;},
    get adminRuleRarityProfile(){return adminRuleRarityProfile;},
    get adminWildcardStartingSlotLimit(){return adminWildcardStartingSlotLimit;},
    get careerHash(){return careerHash;},
    get clamp(){return clamp;},
    get consumableDayEffect(){return consumableDayEffect;},
    get consumableQuantity(){return consumableQuantity;},
    get consumeConsumable(){return consumeConsumable;},
    get cpuLeagueRuleLineupValue(){return cpuLeagueRuleLineupValue;},
    get currentPlayerOvr(){return currentPlayerOvr;},
    get currentUserFixture(){return currentUserFixture;},
    get deterministicFormationTemplateOrder(){return deterministicFormationTemplateOrder;},
    get draftPlayerById(){return draftPlayerById;},
    get enforceAdminLastReserve(){return enforceAdminLastReserve;},
    get ensureAdminRuleRoll(){return ensureAdminRuleRoll;},
    get ensureFormationChoiceRoll(){return ensureFormationChoiceRoll;},
    get ensureOpponentMalusRoll(){return ensureOpponentMalusRoll;},
    get ensurePlayerSeasonSystems(){return ensurePlayerSeasonSystems;},
    get ensureSeasonState(){return ensureSeasonState;},
    get escapeHtml(){return escapeHtml;},
    get expertDayState(){return expertDayState;},
    get forcedFormationRuleForDay(){return forcedFormationRuleForDay;},
    get formationChoiceCategoryClass(){return formationChoiceCategoryClass;},
    get formationChoiceCategoryLabel(){return formationChoiceCategoryLabel;},
    get formationChoiceContext(){return formationChoiceContext;},
    get formationChoiceContextForManagers(){return formationChoiceContextForManagers;},
    get formationChoiceCover(){return formationChoiceCover;},
    get formationChoiceDayState(){return formationChoiceDayState;},
    get formationChoiceRarity(){return formationChoiceRarity;},
    get formationChoiceRarityLabel(){return formationChoiceRarityLabel;},
    get formationEventChance(){return formationEventChance;},
    get formationRaritiesUnlocked(){return formationRaritiesUnlocked;},
    get generateAdminRuleOption(){return generateAdminRuleOption;},
    get generateFormationChoiceOptions(){return generateFormationChoiceOptions;},
    get generateOpponentMalusOption(){return generateOpponentMalusOption;},
    get hashPick(){return hashPick;},
    get hideAdminRuleModal(){return hideAdminRuleModal;},
    get hideFormationChoiceModal(){return hideFormationChoiceModal;},
    get leagueRulesFor(){return leagueRulesFor;},
    get leagueStandingsSort(){return leagueStandingsSort;}, set leagueStandingsSort(value){leagueStandingsSort=value;},
    get lineupDraft(){return lineupDraft;},
    get lineupOutOfRoleEntries(){return lineupOutOfRoleEntries;},
    get lineupPlayerValue(){return lineupPlayerValue;},
    get lineupSelectedPlayerId(){return lineupSelectedPlayerId;}, set lineupSelectedPlayerId(value){lineupSelectedPlayerId=value;},
    get lineupSlots(){return lineupSlots;},
    get lineupTurnoverDeltaFromPrevious(){return lineupTurnoverDeltaFromPrevious;},
    get managerById(){return managerById;},
    get nextPendingMatchdayEvent(){return nextPendingMatchdayEvent;},
    get openLineupScreen(){return openLineupScreen;},
    get openNextSeasonEvent(){return openNextSeasonEvent;},
    get opponentMalusChanceForManager(){return opponentMalusChanceForManager;},
    get opponentMalusDayState(){return opponentMalusDayState;},
    get opponentMalusRollsInProgress(){return opponentMalusRollsInProgress;},
    get playerStatusForDay(){return playerStatusForDay;},
    get renderAdminRuleModal(){return renderAdminRuleModal;},
    get renderFormationChoiceModal(){return renderFormationChoiceModal;},
    get renderSeasonDashboard(){return renderSeasonDashboard;},
    get rerollAdminRuleCard(){return rerollAdminRuleCard;},
    get rerollFormationChoiceCards(){return rerollFormationChoiceCards;},
    get resolveAdminRule(){return resolveAdminRule;},
    get resolveFormationChoice(){return resolveFormationChoice;},
    get resolveSeasonShock(){return resolveSeasonShock;},
    get sanitizeLockedFormationChoiceEntry(){return sanitizeLockedFormationChoiceEntry;},
    get saveState(){return saveState;},
    get seasonShockChance(){return seasonShockChance;},
    get serieAFixtureForPlayer(){return serieAFixtureForPlayer;},
    get setMatchdayFlowPhase(){return setMatchdayFlowPhase;},
    get showToast(){return showToast;},
    get sortedByChoiceHash(){return sortedByChoiceHash;},
    get specialRivalManager(){return specialRivalManager;},
    get specialTrainingPlayerIds(){return specialTrainingPlayerIds;},
    get specialTrainingUsedForPlayer(){return specialTrainingUsedForPlayer;},
    get state(){return state;},
    get syncDraftBenchOrder(){return syncDraftBenchOrder;},
    get syncFlowAfterPreMatchResolution(){return syncFlowAfterPreMatchResolution;},
    get userOpponentIdForDay(){return userOpponentIdForDay;},
    get validateAdminRuleLineup(){return validateAdminRuleLineup;},
    get wildcardSlotCompatible(){return wildcardSlotCompatible;}
  });
  let {seededSerieRand,halfPoint,buildSerieASchedule,serieAFixtureForPlayer,serieAStrengthRowsForDay,serieAMatchupDifficulty,serieAFixtureCompactText,serieAFixtureFullText,serieAMatchupBadgeHtml,clubPool,rankedClubPlayers,serieAPlayerDayProfile,chooseSerieATacticalShape,buildSerieAClubSelection,baseLivePerformance,lockerVoteModifier,participantWeight,weightedPerformancePick,activePerformances,serieAUnitWeightedAverage,serieATeamUnitProfile,serieAGoalProbability,matchStrength,buildSerieAMatch,serieAClubStrength,selectSerieABigMatch,buildSerieADay,playedMinutes,decisivePerformance,finalizeSerieAMatchRatings,finalizeSerieAPhaseRatings,liveFantasyValue,perfEventText,liveEventBadgesMarkup,performanceText,fantasyGoals,lineupPlayersForManager,currentFantasyPerformance,lineupBenchPlayers,classicDefenseModifierResult,applyAdminTeamScoring,simulateFantasyTeamFromSerieA,updateStandingsFromMatch}=window.FantaDomains['football-engine'].create({
    get ROLE_ORDER(){return ROLE_ORDER;},
    get SERIEA_TACTICAL_IDENTITY(){return SERIEA_TACTICAL_IDENTITY;},
    get SERIEA_TACTICAL_SHAPES(){return SERIEA_TACTICAL_SHAPES;},
    get SERIEA_UNIT_WEIGHTS(){return SERIEA_UNIT_WEIGHTS;},
    get activeAdminRuleEffect(){return activeAdminRuleEffect;},
    get activeFormationChoice(){return activeFormationChoice;},
    get activePerformances(){return activePerformances;},
    get adminBlockedStarterForManager(){return adminBlockedStarterForManager;},
    get applyAdminTeamScoring(){return applyAdminTeamScoring;},
    get applyFantasyMatch(){return applyFantasyMatch;},
    get baseLivePerformance(){return baseLivePerformance;},
    get buildDoubleRoundRobin(){return buildDoubleRoundRobin;},
    get buildSerieAClubSelection(){return buildSerieAClubSelection;},
    get buildSerieAMatch(){return buildSerieAMatch;},
    get careerHash(){return careerHash;},
    get chooseSerieATacticalShape(){return chooseSerieATacticalShape;},
    get clamp(){return clamp;},
    get classicDefenseModifierResult(){return classicDefenseModifierResult;},
    get clubName(){return clubName;},
    get clubPool(){return clubPool;},
    get clubShort(){return clubShort;},
    get cpuLeagueRuleLineupValue(){return cpuLeagueRuleLineupValue;},
    get currentFantasyPerformance(){return currentFantasyPerformance;},
    get currentPlayerOvr(){return currentPlayerOvr;},
    get decisivePerformance(){return decisivePerformance;},
    get ensureSeasonState(){return ensureSeasonState;},
    get escapeHtml(){return escapeHtml;},
    get fantasyGoals(){return fantasyGoals;},
    get fantasyRuleForDay(){return fantasyRuleForDay;},
    get finalizeSerieAMatchRatings(){return finalizeSerieAMatchRatings;},
    get formationPlayerModifier(){return formationPlayerModifier;},
    get halfPoint(){return halfPoint;},
    get leagueRulesFor(){return leagueRulesFor;},
    get lineupBenchPlayers(){return lineupBenchPlayers;},
    get lineupPlayersForManager(){return lineupPlayersForManager;},
    get lineupSlots(){return lineupSlots;},
    get liveFantasyValue(){return liveFantasyValue;},
    get lockerVoteModifier(){return lockerVoteModifier;},
    get matchStrength(){return matchStrength;},
    get participantWeight(){return participantWeight;},
    get playedMinutes(){return playedMinutes;},
    get playerFormMetrics(){return playerFormMetrics;},
    get playerMap(){return playerMap;},
    get playerStatusForDay(){return playerStatusForDay;},
    get riskAdjustmentForPerformance(){return riskAdjustmentForPerformance;},
    get seededSerieRand(){return seededSerieRand;},
    get selectSerieABigMatch(){return selectSerieABigMatch;},
    get serieABigMatch(){return serieABigMatch;},
    get serieAClubStrength(){return serieAClubStrength;},
    get serieAFixtureForPlayer(){return serieAFixtureForPlayer;},
    get serieAGoalProbability(){return serieAGoalProbability;},
    get serieALive(){return serieALive;},
    get serieAMatchupDifficulty(){return serieAMatchupDifficulty;},
    get serieAPlayerDayProfile(){return serieAPlayerDayProfile;},
    get serieAStrengthCache(){return serieAStrengthCache;}, set serieAStrengthCache(value){serieAStrengthCache=value;},
    get serieAStrengthRowsForDay(){return serieAStrengthRowsForDay;},
    get serieATeamUnitProfile(){return serieATeamUnitProfile;},
    get serieAUnitWeightedAverage(){return serieAUnitWeightedAverage;},
    get socialMotivationForPlayer(){return socialMotivationForPlayer;},
    get state(){return state;},
    get tacticForManager(){return tacticForManager;},
    get weightedPerformancePick(){return weightedPerformancePick;},
    get worldPlayerModifier(){return worldPlayerModifier;}
  });
  let {ensureCpuLineupsForDay,serieALiveTickBase,serieALiveTickDelay,restartSerieALiveTimer,setSerieALiveSpeed,toggleSerieALivePause,jumpToNextSerieAEvent,renderSerieALiveSpeedControls,serieAEventFantasySide,captureWatchedVoteSnapshot,updateWatchedVoteFlashes,tvEventClass,tvFinalTitle,tvEventDetail,tvFantasyFocus,animateMatchParticles,setSerieATvBanner,hideSerieATvBanner,triggerSerieATvPresentation,eventHeadline,serieALiveFantasyContext,serieAEventTouchesFantasyMatch,fantasyFocusedEventHeadline,applySerieAEvent,serieABigMatch,isBigMatchClub,serieAMinuteForPlayer,serieALiveSnapshotForManager,startSerieABigMatchPhase,snapshotSerieALive,hydrateSerieALive,finishSerieAMultiLivePhase,fantasyLiveSnapshot,setSerieAMatchesExpanded,renderSerieALive,tickSerieALive,simulateFullMatchdayDirectly,startSerieALiveMatchday,skipSerieALive,startPendingBigMatchFromHub}=window.FantaDomains['live-controller'].create({
    get $(){return $;},
    get COACH_SHIRTS(){return COACH_SHIRTS;},
    get SERIEA_LIVE_SPEEDS(){return SERIEA_LIVE_SPEEDS;},
    get activePerformances(){return activePerformances;},
    get adminBlockedStarterForManager(){return adminBlockedStarterForManager;},
    get adminForcedStarterForManager(){return adminForcedStarterForManager;},
    get allowedLineupFormation(){return allowedLineupFormation;},
    get animateMatchParticles(){return animateMatchParticles;},
    get applySerieAEvent(){return applySerieAEvent;},
    get blockedOpponentPlayerIds(){return blockedOpponentPlayerIds;},
    get blockedOpponentPlayerId(){return blockedOpponentPlayerId;},
    get buildAutoLineup(){return buildAutoLineup;},
    get buildSerieADay(){return buildSerieADay;},
    get captureWatchedVoteSnapshot(){return captureWatchedVoteSnapshot;},
    get clamp(){return clamp;},
    get clubName(){return clubName;},
    get clubShort(){return clubShort;},
    get cpuFormationForDay(){return cpuFormationForDay;},
    get cpuLeagueRuleLineupValue(){return cpuLeagueRuleLineupValue;},
    get currentFantasyPerformance(){return currentFantasyPerformance;},
    get decisivePerformance(){return decisivePerformance;},
    get enforceOpponentConsumableBlock(){return enforceOpponentConsumableBlock;},
    get enforcePlayerBenchedInLineup(){return enforcePlayerBenchedInLineup;},
    get enforceStarterInLineup(){return enforceStarterInLineup;},
    get ensureCpuLineupsForDay(){return ensureCpuLineupsForDay;},
    get ensureMatchdayFlowEntry(){return ensureMatchdayFlowEntry;},
    get ensureSeasonState(){return ensureSeasonState;},
    get escapeHtml(){return escapeHtml;},
    get eventHeadline(){return eventHeadline;},
    get fantasyFocusedEventHeadline(){return fantasyFocusedEventHeadline;},
    get fantasyGoals(){return fantasyGoals;},
    get fantasyLiveSnapshot(){return fantasyLiveSnapshot;},
    get finalizeSerieALiveMatchday(){return finalizeSerieALiveMatchday;},
    get finalizeSerieAPhaseRatings(){return finalizeSerieAPhaseRatings;},
    get finishSerieAMultiLivePhase(){return finishSerieAMultiLivePhase;},
    get forcedFormationRuleForDay(){return forcedFormationRuleForDay;},
    get halfPoint(){return halfPoint;},
    get hideSerieATvBanner(){return hideSerieATvBanner;},
    get hydrateSerieALive(){return hydrateSerieALive;},
    get isBigMatchClub(){return isBigMatchClub;},
    get leagueRulesFor(){return leagueRulesFor;},
    get lineupBenchPlayers(){return lineupBenchPlayers;},
    get lineupPlayersForManager(){return lineupPlayersForManager;},
    get liveEventBadgesMarkup(){return liveEventBadgesMarkup;},
    get liveFantasyValue(){return liveFantasyValue;},
    get managerById(){return managerById;},
    get normalizedCoachAvatar(){return normalizedCoachAvatar;},
    get playerAvatarMarkup(){return playerAvatarMarkup;},
    get playerMap(){return playerMap;},
    get renderMatchdayResult(){return renderMatchdayResult;},
    get renderSeasonDashboard(){return renderSeasonDashboard;},
    get renderSerieALive(){return renderSerieALive;},
    get renderSerieALiveSpeedControls(){return renderSerieALiveSpeedControls;},
    get requestOpenLineup(){return requestOpenLineup;},
    get restartSerieALiveTimer(){return restartSerieALiveTimer;},
    get riskAdjustmentForPerformance(){return riskAdjustmentForPerformance;},
    get saveState(){return saveState;},
    get seededSerieRand(){return seededSerieRand;},
    get serieABigMatch(){return serieABigMatch;},
    get serieAEventFantasySide(){return serieAEventFantasySide;},
    get serieAEventTouchesFantasyMatch(){return serieAEventTouchesFantasyMatch;},
    get serieALive(){return serieALive;}, set serieALive(value){serieALive=value;},
    get serieALiveFantasyContext(){return serieALiveFantasyContext;},
    get serieALiveSnapshotForManager(){return serieALiveSnapshotForManager;},
    get serieALiveTickBase(){return serieALiveTickBase;},
    get serieALiveTickDelay(){return serieALiveTickDelay;},
    get serieAMatchesExpanded(){return serieAMatchesExpanded;}, set serieAMatchesExpanded(value){serieAMatchesExpanded=value;},
    get serieAMinuteForPlayer(){return serieAMinuteForPlayer;},
    get setMatchdayFlowPhase(){return setMatchdayFlowPhase;},
    get setSerieAMatchesExpanded(){return setSerieAMatchesExpanded;},
    get setSerieATvBanner(){return setSerieATvBanner;},
    get showOpponentMalusNotice(){return showOpponentMalusNotice;},
    get showScreen(){return showScreen;},
    get showToast(){return showToast;},
    get skipSerieALive(){return skipSerieALive;},
    get snapshotSerieALive(){return snapshotSerieALive;},
    get startPendingBigMatchFromHub(){return startPendingBigMatchFromHub;},
    get state(){return state;},
    get tickSerieALive(){return tickSerieALive;},
    get triggerSerieATvPresentation(){return triggerSerieATvPresentation;},
    get tvEventClass(){return tvEventClass;},
    get tvEventDetail(){return tvEventDetail;},
    get tvFantasyFocus(){return tvFantasyFocus;},
    get tvFinalTitle(){return tvFinalTitle;},
    get updateWatchedVoteFlashes(){return updateWatchedVoteFlashes;},
    get userOpponentIdForDay(){return userOpponentIdForDay;},
    get weekendArrivalLoading(){return weekendArrivalLoading;},
    get renderFixtureCoachPortrait(){return renderFixtureCoachPortrait;},
    get seasonFixtureTheme(){return seasonFixtureTheme;},
});
  let {updatePersistentPlayerStatuses,updatePlayerSeasonStatsFromLive,playerOvrDevelopment,currentPlayerOvr,playerOvrLabel,applyPlayerOvrChange,updatePlayerOvrEvolution,updateSerieASeasonWorld,applyLockerRoomOvrOutcome}=window.FantaDomains['player-development'].create({
    get activeFormationChoice(){return activeFormationChoice;},
    get addSeasonNews(){return addSeasonNews;},
    get applyLockerRoomOvrOutcome(){return applyLockerRoomOvrOutcome;},
    get applyPlayerOvrChange(){return applyPlayerOvrChange;},
    get clamp(){return clamp;},
    get currentFantasyPerformance(){return currentFantasyPerformance;},
    get currentPlayerOvr(){return currentPlayerOvr;},
    get emptyPlayerSeasonStat(){return emptyPlayerSeasonStat;},
    get ensurePlayerSeasonSystems(){return ensurePlayerSeasonSystems;},
    get ensureSeasonState(){return ensureSeasonState;},
    get playedMinutes(){return playedMinutes;},
    get playerMap(){return playerMap;},
    get playerOvrDevelopment(){return playerOvrDevelopment;},
    get playerSeasonPotentialProfile(){return playerSeasonPotentialProfile;},
    get seededSerieRand(){return seededSerieRand;},
    get state(){return state;},
    get updatePersistentPlayerStatuses(){return updatePersistentPlayerStatuses;},
    get updatePlayerOvrEvolution(){return updatePlayerOvrEvolution;},
    get updatePlayerSeasonStatsFromLive(){return updatePlayerSeasonStatsFromLive;},
    get updateSerieAStandingsFromStoredMatches(){return updateSerieAStandingsFromStoredMatches;}
  });
  let {finalizeSerieALiveMatchday,renderMatchdayResult,closeMatchdayFantapointsReward,animateMatchdayRewardNumber,renderMatchdayFantapointsReward}=window.FantaDomains['result-controller'].create({
    get $(){return $;},
    get CareerEngine(){return CareerEngine;},
    get FANTASY_SEASON_MATCHDAYS(){return FANTASY_SEASON_MATCHDAYS;},
    get activateWinterTransferWindowIfNeeded(){return activateWinterTransferWindowIfNeeded;},
    get activeFormationChoice(){return activeFormationChoice;},
    get animateMatchParticles(){return animateMatchParticles;},
    get animateMatchdayRewardNumber(){return animateMatchdayRewardNumber;},
    get careerEuros(){return careerEuros;},
    get closeMatchdayFantapointsReward(){return closeMatchdayFantapointsReward;},
    get clubShort(){return clubShort;},
    get ensureCareerEconomy(){return ensureCareerEconomy;},
    get ensureMatchdayFlowEntry(){return ensureMatchdayFlowEntry;},
    get ensureSeasonState(){return ensureSeasonState;},
    get escapeHtml(){return escapeHtml;},
    get generatePostMatchNews(){return generatePostMatchNews;},
    get grantBigMatchSponsorReward(){return grantBigMatchSponsorReward;},
    get grantFutureAuctionSponsorBonus(){return grantFutureAuctionSponsorBonus;},
    get grantMatchdayFantapoints(){return grantMatchdayFantapoints;},
    get grantSeasonPrizeIfNeeded(){return grantSeasonPrizeIfNeeded;},
    get grantStreakSponsorReward(){return grantStreakSponsorReward;},
    get grantWinSponsorReward(){return grantWinSponsorReward;},
    get hideSerieATvBanner(){return hideSerieATvBanner;},
    get leagueRulesSummary(){return leagueRulesSummary;},
    get managerById(){return managerById;},
    get performanceText(){return performanceText;},
    get renderCareerWallets(){return renderCareerWallets;},
    get renderFixtureCoachPortrait(){return renderFixtureCoachPortrait;},
    get renderMatchdayFantapointsReward(){return renderMatchdayFantapointsReward;},
    get renderMatchdayResult(){return renderMatchdayResult;},
    get renderSeasonDashboard(){return renderSeasonDashboard;},
    get renderSerieALive(){return renderSerieALive;},
    get saveState(){return saveState;},
    get seasonFixtureTheme(){return seasonFixtureTheme;},
    get seedAssistantCoachLineupForDay(){return seedAssistantCoachLineupForDay;},
    get serieALive(){return serieALive;}, set serieALive(value){serieALive=value;},
    get setMatchdayFlowPhase(){return setMatchdayFlowPhase;},
    get showScreen(){return showScreen;},
    get showToast(){return showToast;},
    get simulateFantasyTeamFromSerieA(){return simulateFantasyTeamFromSerieA;},
    get snapshotSerieALive(){return snapshotSerieALive;},
    get sortedStandings(){return sortedStandings;},
    get state(){return state;},
    get updateSerieASeasonWorld(){return updateSerieASeasonWorld;},
    get updateStandingsFromMatch(){return updateStandingsFromMatch;}
  });
  let {quickReadyYield,setQuickReadyLoading,updateQuickReadyProgress,quickAwardGeneratedPlayer,generateReadyRosters}=window.FantaDomains['ready-rosters-controller'].create({
    get $(){return $;},
    get QUICK_ROLE_NAMES(){return QUICK_ROLE_NAMES;},
    get ROLE_LIMITS(){return ROLE_LIMITS;},
    get ROLE_ORDER(){return ROLE_ORDER;},
    get TOTAL_SLOTS(){return TOTAL_SLOTS;},
    get allRostersComplete(){return allRostersComplete;},
    get auditAndRepairState(){return auditAndRepairState;},
    get autoUserLimit(){return autoUserLimit;},
    get autocompleteMode(){return autocompleteMode;}, set autocompleteMode(value){autocompleteMode=value;},
    get canOwn(){return canOwn;},
    get chooseNomination(){return chooseNomination;},
    get cpuLimit(){return cpuLimit;},
    get maxLegalBid(){return maxLegalBid;},
    get nextNominatorIndex(){return nextNominatorIndex;},
    get openRoleAuction(){return openRoleAuction;},
    get playerMap(){return playerMap;},
    get prepareNewGame(){return prepareNewGame;},
    get quickAwardGeneratedPlayer(){return quickAwardGeneratedPlayer;},
    get quickReadyYield(){return quickReadyYield;},
    get recordUserAuctionPick(){return recordUserAuctionPick;},
    get registerNominationCall(){return registerNominationCall;},
    get currentTradeWindow(){return currentTradeWindow;},
    get renderSummary(){return renderSummary;},
    get rolePhaseComplete(){return rolePhaseComplete;},
    get roleSlotsRemaining(){return roleSlotsRemaining;},
    get saveState(){return saveState;},
    get selectedPlayerId(){return selectedPlayerId;}, set selectedPlayerId(value){selectedPlayerId=value;},
    get setQuickReadyLoading(){return setQuickReadyLoading;},
    get showScreen(){return showScreen;},
    get state(){return state;},
    get updateQuickReadyProgress(){return updateQuickReadyProgress;}
  });
  let {ensureAuctionEvents,auctionEffects,relationship,changeRelationship,registerDirectAuctionDuel,resolveRespectedAuctionPact,lateInRole,eventEligibleBase,cpuEventCandidates,sharedInterestingPlayers,auctionEventAlreadyShown,eventRolePlayers,tablePressureEligible,availableEventTypes,weightedPick,maybeTriggerAuctionEvent,pickCpu,buildAuctionEvent,eventPortrait,auctionEventGenericPortrait,showAuctionEventModal,resolveAuctionEvent,minimizeAuctionEventModal,restoreAuctionEventModal,closeAuctionEventModal,activePactForPlayer,cpuKeepsPact,showPactBetrayPrompt,tickAuctionEventEffectsOnNomination}=window.FantaDomains['auction-events-controller'].create({
    get $(){return $;},
    get AUCTION_EVENT_CHANCE(){return AUCTION_EVENT_CHANCE;},
    get RIVAL_ART(){return RIVAL_ART;},
    get TOTAL_SLOTS(){return TOTAL_SLOTS;},
    get auctionEffects(){return auctionEffects;},
    get auctionEventGenericPortrait(){return auctionEventGenericPortrait;},
    get autocompleteMode(){return autocompleteMode;},
    get availableEventTypes(){return availableEventTypes;},
    get baseAuctionValue(){return baseAuctionValue;},
    get beginBidRound(){return beginBidRound;},
    get buildAuctionEvent(){return buildAuctionEvent;},
    get canOwn(){return canOwn;},
    get changeRelationship(){return changeRelationship;},
    get clamp(){return clamp;},
    get closeAuctionEventModal(){return closeAuctionEventModal;},
    get clubName(){return clubName;},
    get cpuEventCandidates(){return cpuEventCandidates;},
    get cpuLimit(){return cpuLimit;},
    get currentAuctionRole(){return currentAuctionRole;},
    get currentPlayerOvr(){return currentPlayerOvr;},
    get ensureAuctionEvents(){return ensureAuctionEvents;},
    get escapeHtml(){return escapeHtml;},
    get eventEligibleBase(){return eventEligibleBase;},
    get eventPortrait(){return eventPortrait;},
    get eventRolePlayers(){return eventRolePlayers;},
    get hasGoodRelations(){return hasGoodRelations;},
    get isHotRival(){return isHotRival;},
    get maxLegalBid(){return maxLegalBid;},
    get pickCpu(){return pickCpu;},
    get playerInitials(){return playerInitials;},
    get playerMap(){return playerMap;},
    get profileArchetype(){return profileArchetype;},
    get relationship(){return relationship;},
    get renderAll(){return renderAll;},
    get resolveAuctionEvent(){return resolveAuctionEvent;},
    get roleSlotsRemaining(){return roleSlotsRemaining;},
    get saveState(){return saveState;},
    get scheduleNomination(){return scheduleNomination;},
    get sharedInterestingPlayers(){return sharedInterestingPlayers;},
    get showAuctionEventModal(){return showAuctionEventModal;},
    get showToast(){return showToast;},
    get state(){return state;},
    get tablePressureEligible(){return tablePressureEligible;},
    get userBid(){return userBid;},
    get weightedPick(){return weightedPick;}
  });
  let {applyPreAuctionPack,showPreAuctionPack}=window.FantaDomains['pack-controller'].create({
    get ROLE_LIMITS(){return ROLE_LIMITS;},
    get auctionObserverActive(){return auctionObserverActive;},
    get auctionPlayerAnalysis(){return auctionPlayerAnalysis;},
    get clubShort(){return clubShort;},
    get currentPlayerOvr(){return currentPlayerOvr;},
    get escapeHtml(){return escapeHtml;},
    get leagueRulesFor(){return leagueRulesFor;},
    get playerAvatarMarkup(){return playerAvatarMarkup;},
    get playerMap(){return playerMap;},
    get randomHash(){return randomHash;},
    get renderAll(){return renderAll;},
    get saveState(){return saveState;},
    get scheduleNomination(){return scheduleNomination;},
    get state(){return state;}
  });
  let {fixtureTeamColors,applyFixtureTeamColors,seasonFixtureTheme,teamBadgeInitials,simpleHash,buildPixelCrestData,buildCoachSilhouette,renderFixtureCrest,renderFixtureCoachPortrait,applySeasonFixtureHeroVisuals,rivalCards,renderVisibleRivals}=window.FantaDomains['visual-identity'].create({
    get $(){return $;},
    get FIXTURE_HERO_THEMES(){return FIXTURE_HERO_THEMES;},
    get FIXTURE_TEAM_COLORS(){return FIXTURE_TEAM_COLORS;},
    get RIVAL_ART(){return RIVAL_ART;},
    get RIVAL_PRESENTATION(){return RIVAL_PRESENTATION;},
    get applyFixtureTeamColors(){return applyFixtureTeamColors;},
    get buildCoachSilhouette(){return buildCoachSilhouette;},
    get buildPixelCrestData(){return buildPixelCrestData;},
    get escapeHtml(){return escapeHtml;},
    get fixtureTeamColors(){return fixtureTeamColors;},
    get normalizedCoachAvatar(){return normalizedCoachAvatar;},
    get pixelPlayerAvatarData(){return pixelPlayerAvatarData;},
    get playerInitials(){return playerInitials;},
    get profileArchetype(){return profileArchetype;},
    get renderFixtureCoachPortrait(){return renderFixtureCoachPortrait;},
    get rivalCards(){return rivalCards;},
    get seasonFixtureTheme(){return seasonFixtureTheme;},
    get simpleHash(){return simpleHash;},
    get state(){return state;},
    get teamBadgeInitials(){return teamBadgeInitials;}
  });
  let {renderCareerAvatarEditor,updateCareerAvatarEditor,careerIdentity,updateCareerIdentityControls,setInitialCareerCatalog,showCareerTeamSubstep,advanceCareerIdentityStep,openCareerSetup,showCareerSetupStep,continueCareerSetup,syncCareerIdentity,rerollPreAuctionRules,renderCareerLeagueRules,openCareerRulesStep,startReadyRostersFromCareer,proceedFromCareerRules,backFromCareerRules,showGameInstructions,careerPowerSlotCost,renderCareerPowerSelection,toggleCareerPower,startCareerAuction}=window.FantaDomains['career-setup-controller'].create({
    get $(){return $;},
    get PRE_AUCTION_RULE_DEFS(){return PRE_AUCTION_RULE_DEFS;},
    get TransferEngine(){return TransferEngine;},
    get activateCatalogBase(){return activateCatalogBase;},
    get adminRuleCover(){return adminRuleCover;},
    get applyGameConfiguration(){return applyGameConfiguration;},
    get careerDraft(){return careerDraft;}, set careerDraft(value){careerDraft=value;},
    get careerIdentity(){return careerIdentity;},
    get careerPowerSelection(){return careerPowerSelection;}, set careerPowerSelection(value){careerPowerSelection=value;},
    get careerPowerSlotCost(){return careerPowerSlotCost;},
    get careerRulesNextAction(){return careerRulesNextAction;}, set careerRulesNextAction(value){careerRulesNextAction=value;},
    get careerTeamSubstep(){return careerTeamSubstep;}, set careerTeamSubstep(value){careerTeamSubstep=value;},
    get defaultLeagueRules(){return defaultLeagueRules;},
    get escapeHtml(){return escapeHtml;},
    get formationChoiceRarityLabel(){return formationChoiceRarityLabel;},
    get freshState(){return freshState;},
    get generatePreAuctionLeagueRules(){return generatePreAuctionLeagueRules;},
    get generateReadyRosters(){return generateReadyRosters;},
    get leagueRuleCardData(){return leagueRuleCardData;},
    get leagueRuleEffectText(){return leagueRuleEffectText;},
    get leagueRulesFor(){return leagueRulesFor;},
    get nextSeasonSetupMode(){return nextSeasonSetupMode;}, set nextSeasonSetupMode(value){nextSeasonSetupMode=value;},
    get normalizedCoachAvatar(){return normalizedCoachAvatar;},
    get openCareerRulesStep(){return openCareerRulesStep;},
    get pixelPlayerAvatarData(){return pixelPlayerAvatarData;},
    get renderCareerAvatarEditor(){return renderCareerAvatarEditor;},
    get renderCareerLeagueRules(){return renderCareerLeagueRules;},
    get renderCareerPowerSelection(){return renderCareerPowerSelection;},
    get saveState(){return saveState;},
    get showCareerSetupStep(){return showCareerSetupStep;},
    get showCareerTeamSubstep(){return showCareerTeamSubstep;},
    get showToast(){return showToast;},
    get startAuction(){return startAuction;},
    get state(){return state;},
    get syncCareerIdentity(){return syncCareerIdentity;},
    get syncSerieATransferWorld(){return syncSerieATransferWorld;},
    get updateCareerIdentityControls(){return updateCareerIdentityControls;},
    get updateResumeButton(){return updateResumeButton;}
  });
  // DOMAIN_BINDINGS_END

  const SAVE_KEY = 'fantallenatore_v330_save'; // legacy localStorage key, usata solo per migrazione/fallback
  // V3.2.35.56 · Evoluzione OVR normalizzata per ruolo: P/D valorizzati, bonus offensivi ridimensionati per A.
  // V3.2.35.55 · Economia asta fantasy: il budget si concentra davvero sull'attacco.
  // MARKET_VALUE_POOL_TARGET conserva la distribuzione FVM di base, mentre
  // MARKET_ROLE_TARGET guida la pianificazione dei 500 crediti delle CPU.
  const SEASON_SPONSORS = {
    double_block:{
      id:'double_block',name:'Zalandiolo',icon:'🛍️',
      title:'Due Blocchi Avversario nella stessa giornata',
      description:'Puoi usare Blocco Avversario su due giocatori diversi della stessa fantasquadra rivale. Ogni blocco consuma un oggetto del tuo inventario. Valido per tutta la stagione.'
    },
    win_bonus:{
      id:'win_bonus',
      name:'Vittoria Energia',
      icon:'🏆',
      title:'+1 € per ogni vittoria',
      description:'Ogni vittoria nella lega fantasy accredita immediatamente 1 € nel saldo carriera.'
    },
    free_subscription:{
      id:'free_subscription',
      name:'FantaLab',
      icon:'🎁',
      title:'1 abbonamento gratuito',
      description:'Durante la stagione puoi attivare gratis, a scelta, FantaData Pro, Scout Plus oppure Assistente Tecnico.'
    },
    future_auction:{
      id:'future_auction',
      name:'Progetto Futuro',
      icon:'🚀',
      title:'+30 crediti alla prossima asta',
      description:'Alla fine della stagione vengono messi da parte 30 crediti extra per la prossima asta della carriera.'
    },
    bonus_firma:{
      id:'bonus_firma',
      name:'Amauri',
      icon:'💰',
      title:'+12 € subito · +12 € se sei tra i primi due alla G19',
      description:'Ricevi 12 € all’inizio. Alla fine della giornata 19 ricevi altri 12 € se sei tra i primi due in classifica.'
    },
    big_match:{
      id:'big_match',
      name:'Netoflix',
      icon:'🔥',
      title:'+8 € battendo una Top 3 · massimo 40 €',
      description:'Ogni volta che batti una squadra che, prima della giornata, occupa una delle prime 3 posizioni, ottieni 8 €, fino a 40 € per stagione.'
    },
    streak_bonus:{
      id:'streak_bonus',
      name:'Adibala',
      icon:'📈',
      title:'+10 € ogni 3 vittorie consecutive · massimo 40 €',
      description:'Ogni blocco di 3 vittorie consecutive ti premia con 10 € aggiuntivi, fino a 40 € per stagione.'
    },
    academy:{
      id:'academy',name:'Ala Romelu',icon:'🎓',
      title:'+2 OVR garantiti a un giocatore scelto',
      description:'Prima di iniziare scegli un giocatore della tua rosa: cresce subito di 2 OVR, nel limite massimo di 99.'
    },
    fantasy_bonus:{
      id:'fantasy_bonus',name:'McTominasy’s',icon:'◆',
      title:'+2 FP con almeno 2 gol fantasy',
      description:'Dopo ogni giornata in cui la tua squadra segna almeno 2 gol fantasy ricevi 2 Fantapoints extra.'
    },
    fantacana:{
      id:'fantacana',name:'Haaland Rover',icon:'🃏',
      title:'Un titolare fuori ruolo ogni giornata',
      description:'Puoi schierare un solo titolare fuori ruolo tra difesa, centrocampo e attacco. Il portiere resta nel proprio ruolo.'
    }
  };
  const SPONSOR_FREE_SHOP_IDS = ['fantadata_pro','scout_plus','assistant_coach'];

  const SHOP_ITEMS = {
    fantadata_pro:{
      id:'fantadata_pro',name:'FantaData Pro',icon:'📊',image:'assets/shop/fantadata-pro.webp',category:'DATI',section:'data',cost:20,fpCost:100,
      description:'Sblocca statistiche avanzate e forma dettagliata dei tuoi giocatori per tutta la stagione.',
      features:['Media voto e fantamedia','Forma recente dettagliata','Difficoltà dell’avversario Serie A','Dati disponibili fino a fine stagione']
    },
    scout_plus:{
      id:'scout_plus',name:'Scout Plus',icon:'🎯',image:'assets/shop/scout-plus.webp',category:'SCOUTING',section:'data',cost:20,fpCost:100,
      description:'Aggiunge una stima della probabilità di titolarità per aiutarti nelle scelte di formazione.',
      features:['Probabilità stimata di titolarità','Tiene conto di ruolo, OVR e gerarchie','La previsione non è una certezza','Attivo fino a fine stagione']
    },
    assistant_coach:{
      id:'assistant_coach',name:'Assistente Tecnico',icon:'🧠',image:'assets/shop/assistente-tecnico.webp',category:'STAFF',section:'staff',cost:10,fpCost:50,
      description:'Automatizza la gestione della formazione e interviene quando un titolare diventa indisponibile.',
      features:['Sblocca AUTO XI','Mantiene formazione e panchina','Sostituisce gli indisponibili','Usa Scout Plus e FantaData se posseduti']
    },
    assistant_tactical_pro:{
      id:'assistant_tactical_pro',name:'Assistente Tattico Pro',icon:'📋',image:'assets/shop/assistente-tattico-pro.webp',category:'STAFF',section:'staff',cost:10,fpCost:50,
      description:'Potenzia l’Assistente Tecnico: adatta AUTO XI e Mantieni formazione a regole Admin, eventi e giocatori fuori ruolo.',
      features:['Richiede Assistente Tecnico','Gestisce turnover e moduli obbligatori','Valuta Haaland Rover e i Jolly','Considera effetti conosciuti · fino a fine stagione']
    },
    fortune:{
      id:'fortune',name:'Fortuna',icon:'🍀',image:'assets/shop/fortuna.webp',category:'POWER-UP',section:'powerup',cost:15,fpCost:75,
      description:'Aumenta la frequenza con cui puoi scegliere una carta prima della giornata.',
      features:['Probabilità evento carte dal 35% al 50%','Effetto automatico per tutta la stagione','Si applica quando premi CONTINUA','Compatibile con Eventi Speciali']
    },
    special_events:{
      id:'special_events',name:'Eventi Speciali',icon:'🃏',image:'assets/shop/eventi-speciali.webp',category:'POWER-UP',section:'powerup',cost:22,fpCost:110,
      description:'Sblocca le carte giocatore Rare ed Epiche, comprese le quattro carte speciali più potenti.',
      features:['Sblocca Rare ed Epiche','Abilita Momento di grazia e Occasione della vita','Abilita Rigorista d’eccezione','Abilita Partita ad altissima tensione']
    },
    expert_precision:{
      id:'expert_precision',name:'Esperti Pro',icon:'🔎',image:'assets/shop/esperti-pro.webp',category:'POWER-UP',section:'powerup',cost:18,fpCost:90,
      description:'Rende molto più affidabili i consigli dei tre esperti estratti ogni giornata.',
      features:['Gli esperti intuitivi sbagliano molto meno spesso','Gli analisti intercettano meglio i segnali nascosti della giornata','Le previsioni restano probabilistiche e non diventano infallibili','Attivo fino a fine stagione']
    },
    cons_training:{
      id:'cons_training',name:'Allenamento Speciale',icon:'🏋️',image:'assets/shop/consumables/allenamento-speciale.webp',category:'CONSUMABILE',section:'consumable',cost:10,currency:'fp',consumable:true,
      description:'Scegli un tuo giocatore e gli assegna un boost temporaneo di rendimento per la prossima partita.',
      features:['Scegli il giocatore dalla tua rosa','+0,25 al rendimento atteso','Leggero aumento delle chance di gol e assist','Puoi usarlo più volte nella stessa giornata, ma una sola volta per giocatore']
    },
    cons_opponent_block:{
      id:'cons_opponent_block',name:'Blocco Avversario',icon:'🚫',image:'assets/shop/consumables/blocco-avversario.webp',category:'CONSUMABILE',section:'consumable',cost:60,currency:'fp',consumable:true,
      description:'Scegli un giocatore della prossima fantasquadra avversaria: non potrà essere schierato in quella giornata.',
      features:['Usabile prima della Diretta Gol','Il giocatore resta fuori da titolari e panchina','La CPU ricostruisce automaticamente il proprio XI','1 blocco per giornata · 2 con Zalandiolo, su giocatori diversi']
    },
    cons_reroll_rules:{
      id:'cons_reroll_rules',name:'Rimescola Regole',icon:'🎲',image:'assets/shop/consumables/rimescola-regole.webp',category:'CONSUMABILE',section:'consumable',cost:25,currency:'fp',consumable:true,
      description:'Risorteggia tutte e tre le regole pre-asta. Acquistabile solo con Fantapunti; si conserva per la prossima stagione.',
      features:['Usabile nella schermata del regolamento prima dell’asta','Consuma 1 oggetto e sostituisce tutte e tre le regole','Puoi ripetere il sorteggio finché hai oggetti','Non utilizzabile ad asta iniziata']
    },
    cons_reroll_admin:{
      id:'cons_reroll_admin',name:'Reroll Admin',icon:'📜',image:'assets/shop/consumables/reroll-admin.webp',category:'CONSUMABILE',section:'consumable',cost:18,currency:'fp',consumable:true,
      description:'Scarta la regola Admin prepartita appena uscita e ne genera subito una diversa.',
      features:['Usabile quando compare la carta Admin','Consuma 1 unità a ogni reroll','Può essere usato più volte se ne possiedi più di uno','La nuova regola resta da confermare']
    },
    cons_starter_report:{
      id:'cons_starter_report',name:'Report Titolarità',icon:'📋',image:'assets/shop/consumables/report-titolarita.webp',category:'CONSUMABILE',section:'consumable',cost:10,currency:'fp',consumable:true,
      description:'Sblocca per una singola giornata la stima di titolarità di tutta la tua rosa.',
      features:['Valido fino alla Diretta Gol della giornata','Mostra la % accanto a titolari e panchina','Non è necessario se possiedi Scout Plus','Consuma 1 unità']
    },
    cons_reroll_event:{
      id:'cons_reroll_event',name:'Reroll Evento',icon:'🎴',image:'assets/shop/consumables/reroll-evento.webp',category:'CONSUMABILE',section:'consumable',cost:15,currency:'fp',consumable:true,
      description:'Rigenera le tre carte evento prepartita prima di sceglierne una.',
      features:['Sostituisce tutte e 3 le carte','Mantiene rarità e logiche del tuo shop','Consuma 1 unità per reroll','Può essere usato più volte prima della scelta']
    },
    cons_guaranteed_sale:{
      id:'cons_guaranteed_sale',name:'Cessione Garantita',icon:'💼',image:'assets/shop/consumables/cessione-garantita.webp',category:'CONSUMABILE',section:'consumable',cost:50,currency:'fp',consumable:true,
      description:'Nel mercato invernale cedi immediatamente un tuo giocatore recuperando il prezzo pagato all’asta.',
      features:['Usabile nella fase Svincoli di gennaio','Scegli tu il giocatore','Recuperi il prezzo di acquisto invece della sola quotazione','Consuma 1 unità']
    },
    cons_celebrity:{
      id:'cons_celebrity',name:'Celebrità',icon:'🌟',image:'assets/shop/celebrita.png',category:'PAY TO WIN',section:'paytowin',cost:20,fpCost:100,consumable:true,
      description:'Attivala dall’inventario: nella prossima stagione potrai scegliere 2 sponsor tra i 3 disponibili.',
      features:['Due sponsor con entrambi gli effetti attivi','Vale solo per la prossima stagione','Non modifica gli sponsor della stagione in corso','Un solo utilizzo utile per stagione · consuma 1 oggetto']
    }
  };

  const LEAGUE_RULE_DEFAULTS = Object.freeze({
    defenseModifier:'off',
    maxFantasySubs:FANTASY_MAX_SUBS,
    firstGoalThreshold:66,
    cleanSheetBonus:0,
    formation334Allowed:false,
    captainBonus:'off',
    decisiveGoalBonus:false
  });

  const PRE_AUCTION_RULE_DEFS = Object.freeze([
    Object.freeze({id:'packOpening',icon:'📦',title:'Spacchettamento',values:Object.freeze([true]),label:()=> '4 GIOCATORI A 1 CREDITO',detail:()=> 'Ogni allenatore riceve un giocatore casuale per ruolo dal listone, a 1 credito ciascuno. Costi e posti rosa sono scalati prima dell’asta.'}),
    Object.freeze({
      id:'defenseModifier',icon:'🛡️',title:'Modificatore Difesa',
      values:Object.freeze(['off','classic']),
      label:value=>value==='classic'?'CLASSICO':'OFF',
      detail:value=>value==='classic'?'Media di P + 3 migliori D: +1 / +3 / +6 FP.':'Nessun modificatore difesa.'
    }),
    Object.freeze({
      id:'maxFantasySubs',icon:'🔄',title:'Numero sostituzioni',
      values:Object.freeze([1,3,5]),
      label:value=>`${Number(value)} CAMBI`,
      detail:value=>`Massimo ${Number(value)} sostituzion${Number(value)===1?'e':'i'} fantasy per giornata.`
    }),
    Object.freeze({
      id:'firstGoalThreshold',icon:'⚽',title:'Soglia primo gol',
      values:Object.freeze([65,66,67]),
      label:value=>`${Number(value)} FP`,
      detail:value=>`Il primo gol fantasy scatta a ${Number(value)} fantapunti; poi resta una fascia ogni 6 FP.`
    }),
    Object.freeze({
      id:'cleanSheetBonus',icon:'🧤',title:'Porta inviolata',
      values:Object.freeze([0,1,2]),
      label:value=>Number(value)===2?'MEGA · +2 AL PORTIERE':Number(value)===1?'+1 AL PORTIERE':'OFF',
      detail:value=>Number(value)>0?`Il portiere che chiude senza gol subiti riceve +${Number(value)} FP.`:'Nessun bonus per la porta inviolata.'
    }),
    Object.freeze({
      id:'formation334Allowed',icon:'⚔️',title:'Modulo 3-3-4',
      values:Object.freeze([false,true]),
      label:value=>value?'CONSENTITO':'NON CONSENTITO',
      detail:value=>value?'Il modulo offensivo 3-3-4 è disponibile per tutte le fantasquadre.':'Il modulo 3-3-4 non può essere usato in questa stagione.'
    }),
    Object.freeze({
      id:'captainBonus',icon:'©️',title:'Bonus capitano',
      values:Object.freeze(['off','seven','eight']),
      label:value=>value==='seven'?'+1 CON VOTO ≥ 7':value==='eight'?'+2 CON VOTO ≥ 8':'OFF',
      detail:value=>value==='off'?'Nessun bonus capitano.':value==='seven'?'Il capitano titolare riceve +1 FP se il voto base è almeno 7.':'Il capitano titolare riceve +2 FP se il voto base è almeno 8.'
    }),
    Object.freeze({
      id:'decisiveGoalBonus',icon:'🏆',title:'Gol decisivo',
      values:Object.freeze([false,true]),
      label:value=>value?'+1 FP':'OFF',
      detail:value=>value?'Il marcatore del gol della vittoria della propria squadra reale riceve +1 FP.':'Nessun bonus per il gol della vittoria.'
    }),
    Object.freeze({
      id:'alternateCatalog',icon:'🔀',title:'Universo alternativo · Pokémon',
      values:Object.freeze([true]),
      label:()=> 'CAMBIO LISTONE',
      detail:()=> 'Puoi accettare o rifiutare: cambia il listone attivo tra Serie A e Pokémon. I giocatori restano nelle stagioni successive finché non cambi di nuovo.'
    }),
    Object.freeze({
      id:'keeperConfirmation',icon:'🔐',title:'Conferma giocatore',
      values:Object.freeze([true]),label:()=> '1 CONFERMA UTENTE',
      detail:()=> 'A fine stagione puoi confermare un tuo giocatore al prezzo di acquisto: costo e posto rosa scalati dalla prossima asta. Solo per l’utente.'
    }),
    Object.freeze({
      id:'freeRoleAuction',icon:'🎲',title:'Asta senza reparti',
      values:Object.freeze([true]),
      label:()=> 'TUTTI I RUOLI LIBERI',
      detail:()=> 'Durante l’asta puoi chiamare giocatori di qualsiasi ruolo. Non ci sono fasi per reparto; ogni rosa deve comunque rispettare 3 P, 8 D, 8 C e 6 A.'
    })
  ]);

  function defaultLeagueRules(){
    return {
      generated:false,
      selectedCategories:[],
      defenseModifier:LEAGUE_RULE_DEFAULTS.defenseModifier,
      maxFantasySubs:LEAGUE_RULE_DEFAULTS.maxFantasySubs,
      firstGoalThreshold:LEAGUE_RULE_DEFAULTS.firstGoalThreshold,
      cleanSheetBonus:LEAGUE_RULE_DEFAULTS.cleanSheetBonus,
      formation334Allowed:LEAGUE_RULE_DEFAULTS.formation334Allowed,
      captainBonus:LEAGUE_RULE_DEFAULTS.captainBonus,
      decisiveGoalBonus:LEAGUE_RULE_DEFAULTS.decisiveGoalBonus,
      alternateCatalog:false,
      catalogDecision:null,
      keeperConfirmation:false,
      packOpening:false,
      freeRoleAuction:false
    };
  }

  function leagueRulesFor(source=state){
    const raw=source?.leagueRules||{};
    return {
      ...defaultLeagueRules(),
      ...raw,
      selectedCategories:Array.isArray(raw.selectedCategories)?raw.selectedCategories.slice(0,3):[]
    };
  }

  function preAuctionRuleDef(id){
    return PRE_AUCTION_RULE_DEFS.find(rule=>rule.id===id)||null;
  }

  function generatePreAuctionLeagueRules(target){
    if(!target) return defaultLeagueRules();
    const existing=leagueRulesFor(target);
    if(existing.generated && existing.selectedCategories.length===3){
      target.leagueRules=existing;
      return existing;
    }
    const seed=String(target.marketSeed||`${Date.now()}-${Math.random()}`)+(target.leagueRulesRerollCount?`|rules-reroll-${target.leagueRulesRerollCount}`:'');
    const selected=PRE_AUCTION_RULE_DEFS
      .filter(rule=>Number(target.career?.division||GAME_CONFIG.startingDivision)<=3 || (rule.id!=='alternateCatalog' && rule.id!=='freeRoleAuction' && rule.id!=='packOpening'))
      .filter(rule=>rule.id!=='alternateCatalog' || randomHash(`${seed}|alternate-catalog-offer`)<.25)
      .slice()
      .sort((a,b)=>randomHash(`${seed}|league-rule-category|${a.id}`)-randomHash(`${seed}|league-rule-category|${b.id}`))
      .slice(0,3);
    const next=defaultLeagueRules();
    next.generated=true;
    next.selectedCategories=selected.map(rule=>rule.id);
    selected.forEach(rule=>{
      const roll=randomHash(`${seed}|league-rule-value|${rule.id}`);
      const index=Math.min(rule.values.length-1,Math.floor(roll*rule.values.length));
      next[rule.id]=rule.values[index];
    });
    target.leagueRules=next;
    return next;
  }

  function leagueRuleCardData(source=state){
    const rules=leagueRulesFor(source);
    return rules.selectedCategories.map(id=>{
      const def=preAuctionRuleDef(id);
      if(!def) return null;
      const value=rules[id];
      const label=id==='alternateCatalog' && rules.catalogDecision ? (rules.catalogDecision==='accept'?'CAMBIO ACCETTATO':'CAMBIO RIFIUTATO') : def.label(value);
      const rarity=(id==='alternateCatalog'||id==='freeRoleAuction'||id==='packOpening')?'rare':'common';
      return {id,icon:def.icon,title:id==='cleanSheetBonus'&&Number(value)===2?'Porta inviolata mega':def.title,value,label,detail:def.detail(value),rarity};
    }).filter(Boolean);
  }

  function leagueRuleEffectText(id,value){
    switch(String(id||'')){
      case 'defenseModifier':
        return value==='classic'
          ? 'Effetto: a fine giornata si calcola la media di portiere + 3 migliori difensori. Se la media è alta puoi ottenere bonus extra alla squadra.'
          : 'Effetto: la difesa non assegna alcun bonus extra ai fantapunti finali.';
      case 'maxFantasySubs':
        return `Effetto: dalla panchina possono entrare al massimo ${Number(value)} sostituzion${Number(value)===1?'e':'i'} fantasy.`;
      case 'firstGoalThreshold':
        return `Effetto: il primo gol fantasy si sblocca a ${Number(value)} fantapunti. Una soglia più bassa rende i risultati più facili da muovere.`;
      case 'cleanSheetBonus':
        return Number(value)>0
          ? `Effetto: il portiere che chiude la partita senza subire gol riceve +${Number(value)} fantapunt${Number(value)===1?'o':'i'}.`
          : 'Effetto: la porta inviolata non assegna nessun bonus al portiere.';
      case 'formation334Allowed':
        return value?'Effetto: anche il modulo 3-3-4 è disponibile nella scelta della formazione, per te e per le CPU.':'Effetto: il modulo 3-3-4 resta escluso per tutte le fantasquadre.';
      case 'captainBonus':
        return value==='seven'?'Effetto: il capitano titolare con voto base almeno 7 riceve +1 FP.':value==='eight'?'Effetto: il capitano titolare con voto base almeno 8 riceve +2 FP.':'Effetto: il capitano non riceve bonus.';
      case 'decisiveGoalBonus':
        return value?'Effetto: il gol che determina la vittoria nella partita reale assegna +1 FP al suo marcatore.':'Effetto: nessun bonus per il gol della vittoria.';
      case 'alternateCatalog':
        return 'Effetto: se accetti, la prossima asta e la stagione useranno l’altro listone. Il mercato estero resta separato e continua a funzionare.';
      case 'packOpening':
        return 'Effetto: 1 P, 1 D, 1 C e 1 A casuali per ogni squadra. Ogni giocatore costa 1 credito ed è escluso dall’asta.';
      case 'freeRoleAuction':
        return 'Effetto: non ci sono fasi P → D → C → A. Tu e le CPU potete chiamare qualunque ruolo, rispettando sempre i posti disponibili nella rosa.';
      default:
        return 'Effetto: questa regola modifica il regolamento della stagione.';
    }
  }

  function leagueRulesSummary(source=state){
    const rules=leagueRulesFor(source);
    return `Mod. Difesa ${rules.defenseModifier==='classic'?'CLASSICO':'OFF'} · Cambi ${rules.maxFantasySubs} · Primo gol ${rules.firstGoalThreshold} FP · Porta inviolata ${Number(rules.cleanSheetBonus)>0?`+${Number(rules.cleanSheetBonus)}${Number(rules.cleanSheetBonus)===2?' MEGA':''}`:'OFF'} · 3-3-4 ${rules.formation334Allowed?'CONSENTITO':'NON CONSENTITO'} · Capitano ${rules.captainBonus==='seven'?'+1 (voto 7)':rules.captainBonus==='eight'?'+2 (voto 8)':'OFF'} · Gol decisivo ${rules.decisiveGoalBonus?'+1':'OFF'}`;
  }

  const FORMATION_CHOICE_RARITY_BY_TEMPLATE = {
    'boost-vote':'common','boost-goal':'rare','boost-assist':'rare',
    'boost-training':'common','boost-derby':'rare','boost-offensive-freedom':'rare',
    'boost-penalty-specialist':'rare','boost-grace-moment':'epic','boost-life-chance':'epic',
    'malus-vote':'common','malus-goal':'rare','malus-assist':'rare',
    'malus-tough-opponent':'rare','malus-card-risk':'common','malus-negative-form':'common','malus-high-tension':'rare',
    'risk-vote':'common','risk-goal':'rare','risk-double':'epic','risk-injury':'rare'
    ,'locker-reserve':'common','locker-starter':'common','locker-duel':'common',
    'locker-captain':'rare','locker-turnaround':'common',
    'boost-special-training':'epic','boost-birthday':'rare'
  };

  const SPECIAL_FORMATION_EVENT_TEMPLATE_IDS = new Set([
    'boost-penalty-specialist',
    'boost-grace-moment',
    'boost-life-chance',
    'malus-high-tension',
    'locker-captain','boost-special-training','boost-birthday'
  ]);

  const FORMATION_CHOICE_TEMPLATES = [
    {
      id:'boost-vote',category:'boost',icon:'⬆',title:'Fiducia totale',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`boost-vote|${index}`);
        if(!p) return null;
        return {
          id:`boost-vote-${p.id}`,category:'boost',icon:'⬆',
          title:`Fiducia a ${p.name}`,
          text:`${p.name} parte con un vantaggio di +0,5 sul voto di giornata.`,
          effect:{kind:'player_vote',targetPlayerId:String(p.id),delta:.5}
        };
      }
    },
    {
      id:'boost-goal',category:'boost',icon:'⚽',title:'Licenza di segnare',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`boost-goal|${index}`,x=>x.role==='A'||x.role==='C');
        if(!p) return null;
        return {
          id:`boost-goal-${p.id}`,category:'boost',icon:'⚽',
          title:`Licenza di segnare · ${p.name}`,
          text:`${p.name} avrà probabilità molto più alta di essere scelto come marcatore.`,
          effect:{kind:'goal_weight',targetPlayerId:String(p.id),multiplier:1.85}
        };
      }
    },
    {
      id:'boost-assist',category:'boost',icon:'👟',title:'Piede caldo',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`boost-assist|${index}`,x=>x.role==='C'||x.role==='A'||x.role==='D');
        if(!p) return null;
        return {
          id:`boost-assist-${p.id}`,category:'boost',icon:'👟',
          title:`Piede caldo · ${p.name}`,
          text:`${p.name} avrà probabilità molto più alta di servire un assist.`,
          effect:{kind:'assist_weight',targetPlayerId:String(p.id),multiplier:1.9}
        };
      }
    },
    {
      id:'boost-training',category:'boost',icon:'🌟',title:'Allenamento eccellente',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`boost-training|${index}`);
        if(!p) return null;
        return {
          id:`boost-training-${p.id}`,category:'boost',icon:'🌟',
          title:`Allenamento eccellente · ${p.name}`,
          text:`${p.name} ha impressionato in settimana: titolarità più probabile e rendimento atteso leggermente migliore.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),starterScoreDelta:5.5,starterProbabilityDelta:14,voteDelta:.15}
        };
      }
    },
    {
      id:'boost-derby',category:'boost',icon:'🔥',title:'Derby',
      build:(ctx,index)=>{
        const p=ctx.pickOwnStrict(`boost-derby|${index}`,x=>x.role!=='P' && isDerbyFixtureForPlayer(x,ctx.day));
        if(!p) return null;
        return {
          id:`boost-derby-${p.id}`,category:'boost',icon:'🔥',
          title:`Derby · ${p.name}`,
          text:`${p.name} vive una partita ad altissima tensione: molte più possibilità di gol o assist, ma cresce anche il rischio cartellino.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),goalMultiplier:1.65,assistMultiplier:1.45,cardMultiplier:1.70}
        };
      }
    },
    {
      id:'boost-offensive-freedom',category:'boost',icon:'🚀',title:'Libertà offensiva',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`boost-offensive-freedom|${index}`,x=>x.role!=='P');
        if(!p) return null;
        return {
          id:`boost-offensive-freedom-${p.id}`,category:'boost',icon:'🚀',
          title:`Libertà offensiva · ${p.name}`,
          text:`Il mister concede a ${p.name} maggiore libertà negli ultimi metri: aumentano le probabilità di bonus.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),goalMultiplier:1.45,assistMultiplier:1.50}
        };
      }
    },
    {
      id:'boost-penalty-specialist',category:'boost',icon:'🎯',title:'Rigorista d’eccezione',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`boost-penalty-specialist|${index}`,x=>x.role==='A'||x.role==='C');
        if(!p) return null;
        return {
          id:`boost-penalty-specialist-${p.id}`,category:'boost',icon:'🎯',
          title:`Rigorista d’eccezione · ${p.name}`,
          text:`${p.name} diventa il primo candidato a battere un eventuale rigore: sale molto il peso offensivo e un po' anche la probabilità di bonus.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),goalMultiplier:1.95,assistMultiplier:1.10,voteDelta:.10}
        };
      }
    },
    {
      id:'boost-grace-moment',category:'boost',icon:'👑',title:'Momento di grazia',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`boost-grace-moment|${index}`,x=>x.role!=='P');
        if(!p) return null;
        return {
          id:`boost-grace-moment-${p.id}`,category:'boost',icon:'👑',
          title:`Momento di grazia · ${p.name}`,
          text:`${p.name} arriva da una settimana speciale: è molto più probabile che parta titolare e che trovi una giocata decisiva.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),starterScoreDelta:8.5,starterProbabilityDelta:20,voteDelta:.25,goalMultiplier:1.55,assistMultiplier:1.55}
        };
      }
    },
    {
      id:'boost-life-chance',category:'boost',icon:'💎',title:'Occasione della vita',
      build:(ctx,index)=>{
        const p=ctx.pickOwnStrict(`boost-life-chance|${index}`,x=>x.role!=='P' && estimatedStarterProbability(x,ctx.day)<=60);
        if(!p) return null;
        return {
          id:`boost-life-chance-${p.id}`,category:'boost',icon:'💎',
          title:`Occasione della vita · ${p.name}`,
          text:`${p.name} riceve una chance enorme per mettersi in mostra: cresce tanto la titolarità e, se gioca, può produrre bonus sopra le attese.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),starterScoreDelta:11,starterProbabilityDelta:24,voteDelta:.15,goalMultiplier:1.40,assistMultiplier:1.35}
        };
      }
    },
    {
      id:'malus-vote',category:'malus',icon:'⬇',title:'Pressione addosso',
      build:(ctx,index)=>{
        const p=ctx.pickOpponent(`malus-vote|${index}`);
        if(!p) return null;
        return {
          id:`malus-vote-${p.id}`,category:'malus',icon:'⬇',
          title:`Pressione su ${p.name}`,
          text:`${p.name}, del tuo prossimo avversario, parte con -0,5 sul voto di giornata.`,
          effect:{kind:'player_vote',targetPlayerId:String(p.id),delta:-.5}
        };
      }
    },
    {
      id:'malus-goal',category:'malus',icon:'🔒',title:'Marcatura speciale',
      build:(ctx,index)=>{
        const p=ctx.pickOpponent(`malus-goal|${index}`,x=>x.role==='A'||x.role==='C');
        if(!p) return null;
        return {
          id:`malus-goal-${p.id}`,category:'malus',icon:'🔒',
          title:`Marcatura speciale · ${p.name}`,
          text:`${p.name} avrà molte meno possibilità di essere scelto come marcatore.`,
          effect:{kind:'goal_weight',targetPlayerId:String(p.id),multiplier:.35}
        };
      }
    },
    {
      id:'malus-assist',category:'malus',icon:'✂',title:'Linee di passaggio chiuse',
      build:(ctx,index)=>{
        const p=ctx.pickOpponent(`malus-assist|${index}`,x=>x.role==='C'||x.role==='A'||x.role==='D');
        if(!p) return null;
        return {
          id:`malus-assist-${p.id}`,category:'malus',icon:'✂',
          title:`Blocca ${p.name}`,
          text:`${p.name} avrà molte meno possibilità di servire un assist.`,
          effect:{kind:'assist_weight',targetPlayerId:String(p.id),multiplier:.35}
        };
      }
    },
    {
      id:'malus-tough-opponent',category:'malus',icon:'🧱',title:'Avversario ostico',
      build:(ctx,index)=>{
        const p=ctx.pickOpponentStrict(`malus-tough-opponent|${index}`,x=>x.role!=='P' && serieAMatchupDifficulty(x,ctx.day)?.key==='hard');
        if(!p) return null;
        return {
          id:`malus-tough-opponent-${p.id}`,category:'malus',icon:'🧱',
          title:`Avversario ostico · ${p.name}`,
          text:`${p.name}, schierabile dal tuo avversario fantasy, affronta una gara molto difficile: probabilità di gol e assist ridotte.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),goalMultiplier:.58,assistMultiplier:.58}
        };
      }
    },
    {
      id:'malus-card-risk',category:'malus',icon:'🟨',title:'Rischio cartellino',
      build:(ctx,index)=>{
        const p=ctx.pickOpponent(`malus-card-risk|${index}`,x=>x.role!=='P');
        if(!p) return null;
        return {
          id:`malus-card-risk-${p.id}`,category:'malus',icon:'🟨',
          title:`Rischio cartellino · ${p.name}`,
          text:`${p.name}, del tuo avversario fantasy, arriva a una partita nervosa: aumenta sensibilmente la probabilità di ammonizione o espulsione.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),cardMultiplier:1.90}
        };
      }
    },
    {
      id:'malus-negative-form',category:'malus',icon:'📉',title:'Periodo negativo',
      build:(ctx,index)=>{
        const p=ctx.pickOpponent(`malus-negative-form|${index}`);
        if(!p) return null;
        return {
          id:`malus-negative-form-${p.id}`,category:'malus',icon:'📉',
          title:`Periodo negativo · ${p.name}`,
          text:`${p.name} attraversa un momento complicato: il suo voto base atteso parte leggermente più basso.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),voteDelta:-.20}
        };
      }
    },
    {
      id:'malus-high-tension',category:'malus',icon:'🟥',title:'Partita ad altissima tensione',
      build:(ctx,index)=>{
        const p=ctx.pickOpponent(`malus-high-tension|${index}`,x=>x.role!=='P');
        if(!p) return null;
        return {
          id:`malus-high-tension-${p.id}`,category:'malus',icon:'🟥',
          title:`Partita ad altissima tensione · ${p.name}`,
          text:`${p.name}, del tuo avversario fantasy, arriva a una gara tesissima: aumenta molto il rischio di giallo o rosso e la serenità sotto porta cala.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),cardMultiplier:2.35,goalMultiplier:.85,assistMultiplier:.85,voteDelta:-.10}
        };
      }
    },
    {
      id:'risk-injury',category:'risk',icon:'🩹',title:'Oltre il limite',
      build:(ctx,index)=>{
        const p=ctx.pickOwnStrict(`risk-injury|${index}`,player=>!playerStatusForDay(player.id,ctx.day).unavailable);
        if(!p)return null;
        return {id:`risk-injury-${p.id}`,category:'risk',icon:'🩹',title:`Oltre il limite · ${p.name}`,
          text:`${p.name} parte con +1 al voto base, ma ha il 50% di rischio di infortunarsi durante la partita se scende in campo. L’esito rimane nascosto fino alla Diretta Gol.`,
          effect:{kind:'risk_injury',targetPlayerId:String(p.id),voteDelta:1,injuryChance:.5}};
      }
    },
    {
      id:'risk-vote',category:'risk',icon:'🎲',title:'Scommessa sul voto',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`risk-vote|${index}`);
        if(!p) return null;
        return {
          id:`risk-vote-${p.id}`,category:'risk',icon:'🎲',
          title:`Scommessa su ${p.name}`,
          text:`Se ${p.name} prende almeno 6,5: +2 Fantapunti. Se prende meno di 6,5: -2 Fantapunti.`,
          effect:{kind:'risk_vote',targetPlayerId:String(p.id),threshold:6.5,reward:2,penalty:-2}
        };
      }
    },
    {
      id:'risk-goal',category:'risk',icon:'🎰',title:'Bomber o niente',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`risk-goal|${index}`,x=>x.role==='A'||x.role==='C');
        if(!p) return null;
        return {
          id:`risk-goal-${p.id}`,category:'risk',icon:'🎰',
          title:`Bomber o niente · ${p.name}`,
          text:`Se ${p.name} segna: +3 Fantapunti extra. Se non segna: -1 Fantapunto.`,
          effect:{kind:'risk_goal',targetPlayerId:String(p.id),reward:3,penalty:-1}
        };
      }
    },
    {
      id:'risk-double',category:'risk',icon:'⚡',title:'Tutto o niente',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`risk-double|${index}`);
        if(!p) return null;
        return {
          id:`risk-double-${p.id}`,category:'risk',icon:'⚡',
          title:`Tutto o niente · ${p.name}`,
          text:`Bonus e malus di ${p.name} valgono x2. Può diventare decisivo... in entrambi i sensi.`,
          effect:{kind:'risk_double_events',targetPlayerId:String(p.id)}
        };
      }
    },
    {
      id:'locker-reserve',category:'locker',icon:'🪑',title:'La riserva scalpita',
      build:(ctx,index)=>{
        const p=ctx.pickOwnStrict(`locker-reserve|${index}`,x=>fantasyAppearanceRate(x.id,ctx.day)<=.30 && ctx.day>=5);
        if(!p)return null;
        return {id:`locker-reserve-${p.id}`,category:'locker',icon:'🪑',title:`La riserva scalpita · ${p.name}`,
          text:`${p.name} chiede una chance. Se lo schieri titolare, +0,5 al voto; con voto base almeno 7 può guadagnare +1 OVR.`,
          effect:{kind:'locker_vote',targetPlayerId:String(p.id),delta:.5,requireStarter:true,ovrCondition:'seven'}};
      }
    },
    {
      id:'locker-starter',category:'locker',icon:'💬',title:'Il titolare perde il posto',
      build:(ctx,index)=>{
        const p=ctx.pickOwnStrict(`locker-starter|${index}`,x=>fantasyAppearanceRate(x.id,ctx.day)>=.60 && ctx.day>=5);
        if(!p)return null;
        return {id:`locker-starter-${p.id}`,category:'locker',icon:'💬',title:`Il titolare perde il posto · ${p.name}`,
          text:`${p.name} vuole ritrovare spazio. Se lo schieri titolare, +0,5 al voto; se resta fuori, -0,5 al voto nella giornata seguente, se gioca.`,
          effect:{kind:'locker_vote',targetPlayerId:String(p.id),delta:.5,requireStarter:true,nextDayPenalty:-.5}};
      }
    },
    {
      id:'locker-duel',category:'locker',icon:'⚔️',title:'Due giocatori, una maglia',
      build:(ctx,index)=>{
        const p=ctx.pickOwnStrict(`locker-duel|${index}`,x=>ctx.user.roster.some(y=>y.id!==x.id && y.role===x.role));
        if(!p)return null;
        return {id:`locker-duel-${p.id}`,category:'locker',icon:'⚔️',title:`Due giocatori, una maglia · ${p.name}`,
          text:`Sostieni ${p.name} nella sfida per il posto: se lo schieri titolare, +0,5 al voto. Con una grande prestazione può ottenere +1 OVR.`,
          effect:{kind:'locker_vote',targetPlayerId:String(p.id),delta:.5,requireStarter:true,ovrCondition:'seven'}};
      }
    },
    {
      id:'locker-captain',category:'locker',icon:'©️',title:'Il capitano interviene',
      build:(ctx,index)=>{
        const ids=ctx.user.roster.map(p=>String(p.id));
        if(ids.length<3)return null;
        return {id:`locker-captain-${ctx.day}`,category:'locker',icon:'©️',title:'Il capitano interviene',
          text:'Il capitano parla al gruppo: fino a tre tuoi titolari ricevono +0,25 al voto base nella prossima giornata.',
          effect:{kind:'locker_team',maxPlayers:3,delta:.25}};
      }
    },
    {
      id:'locker-turnaround',category:'locker',icon:'🌅',title:'Partita della svolta',
      build:(ctx,index)=>{
        const p=ctx.pickOwnStrict(`locker-turnaround|${index}`,x=>{
          const recent=state?.season?.playerSeasonStats?.[String(x.id)]?.recent||[];
          return recent.length && Number(recent[recent.length-1].vote)<6;
        });
        if(!p)return null;
        return {id:`locker-turnaround-${p.id}`,category:'locker',icon:'🌅',title:`Partita della svolta · ${p.name}`,
          text:`Dai fiducia a ${p.name}: se lo schieri e prende almeno 7 di voto base, +1 OVR; sotto 6, -1 OVR.`,
          effect:{kind:'locker_turnaround',targetPlayerId:String(p.id),requireStarter:true}};
      }
    },
    {
      id:'boost-special-training',category:'boost',icon:'🏋️',title:'Allenamento speciale',
      build:(ctx,index)=>{
        const role=['P','D','C','A'][Math.floor(careerHash(`special-training|${ctx.day}|${index}`)*4)];
        return {id:`boost-special-training-${role}`,category:'boost',icon:'🏋️',title:`Allenamento speciale · ${ROLE_PLURALS[role]}`,
          text:`I tuoi titolari ${ROLE_PLURALS[role].toLowerCase()} ricevono +0,25 al voto base in questa giornata.`,
          effect:{kind:'locker_team',role,maxPlayers:25,delta:.25}};
      }
    },
    {
      id:'boost-birthday',category:'boost',icon:'🎂',title:'Compleanno del giocatore',
      build:(ctx,index)=>{
        const p=ctx.pickOwnStrict(`boost-birthday|${index}`,x=>x.role!=='P' && estimatedStarterProbability(x,ctx.day)>=55);
        if(!p)return null;
        return {id:`boost-birthday-${p.id}`,category:'boost',icon:'🎂',title:`Compleanno di ${p.name}`,
          text:`Se ${p.name} scende in campo nella sua partita reale: 50% gol certo, 50% autogol certo. L'esito resta nascosto fino alla Diretta Gol.`,
          effect:{kind:'birthday',targetPlayerId:String(p.id)}};
      }
    },
  ];

  const ADMIN_RULE_TEMPLATES = [
    {id:'admin-golden-bench',rarity:'common',build:day=>({id:`admin-golden-bench-${day}`,category:'admin',icon:'🪑',title:'Panchina d’oro',text:'Per tutte le squadre: il primo panchinaro che entra nella formazione fantasy riceve +1 extra se segna. Il bonus si assegna una sola volta, anche se segna più gol.',effect:{kind:'admin_rule',ruleId:'golden_bench'}})},
    {id:'admin-cesarini',rarity:'common',build:day=>({id:`admin-cesarini-${day}`,category:'admin',icon:'⏱️',title:'Zona Cesarini',text:'Per questa giornata, per tutte le squadre, ogni gol segnato dall’85° minuto compreso vale +4 invece di +3. Sono inclusi i rigori segnati; gli autogol mantengono il loro malus.',effect:{kind:'admin_rule',ruleId:'cesarini'}})},
    {id:'admin-underdog',rarity:'rare',build:day=>({id:`admin-underdog-${day}`,category:'admin',icon:'🌟',title:'Underdog',text:'Per tutte le squadre: ogni titolare della formazione fantasy con OVR inferiore a 75 riceve +0,5 fantapunti se prende voto. Il bonus non modifica il voto base e non vale per chi subentra dalla panchina.',effect:{kind:'admin_rule',ruleId:'underdog'}})},
    {
      id:'admin-goal-threshold-76',rarity:'epic',
      build:(day)=>({
        id:`admin-goal-threshold-76-${day}`,
        category:'admin',icon:'🥅',title:'Gol ad alta quota · Soglia 76',
        text:'Solo per questa giornata, tutte le fantasquadre segnano il primo gol a 76 Fantapunti. I successivi scattano ogni 6 punti: 82, 88, 94… Dalla prossima giornata torna la soglia stagionale.',
        effect:{kind:'admin_rule',ruleId:'goal_threshold_76',firstGoalThreshold:76}
      })
    },
    {
      id:'admin-turnover-3',rarity:'common',
      build:(day)=>{
        if(Number(day||0)<=1) return null;
        return {
          id:`admin-turnover-3-${day}`,
          category:'admin',
          icon:'🔁',
          title:'Turnover obbligatorio',
          text:'L\'Admin impone un mini-turnover: devi cambiare almeno 3 titolari rispetto alla giornata precedente prima di poter confermare la formazione.',
          effect:{kind:'admin_rule',ruleId:'forced_turnover_3',minimumChanges:3}
        };
      }
    },
    {
      id:'admin-forced-formation',rarity:'common',
      build:(day)=>{
        const pool=['3-5-2','3-4-3','4-4-2','4-5-1','5-3-2'];
        const forced=hashPick(sortedByChoiceHash(pool.map(key=>({id:key,name:key})),`admin-rule-formation|${day}`),`admin-rule-formation|${day}`)?.id || '4-4-2';
        return {
          id:`admin-forced-formation-${forced}-${day}`,
          category:'admin',
          icon:'📐',
          title:`Modulo imposto dall’Admin · ${forced}`,
          text:`Per questa giornata l'Admin obbliga tutte le fantasquadre a usare il modulo ${forced}. Puoi schierarti liberamente, ma devi confermare la formazione con questo assetto.`,
          effect:{kind:'admin_rule',ruleId:'forced_formation',formation:forced}
        };
      }
    },
    {
      id:'admin-no-subs',rarity:'common',
      build:(day)=>({
        id:`admin-no-subs-${day}`,
        category:'admin',
        icon:'🚫',
        title:'Niente sostituzioni',
        text:'Regola secca dell\'Admin: per questa giornata nessun panchinaro potrà sostituire un titolare senza voto. Si gioca con gli 11 scelti.',
        effect:{kind:'admin_rule',ruleId:'no_substitutions'}
      })
    },
    {
      id:'admin-extra-subs',rarity:'common',
      build:(day)=>({
        id:`admin-extra-subs-${day}`,
        category:'admin',
        icon:'🔄',
        title:'Panchina profonda',
        text:`L'Admin amplia la panchina operativa: per questa giornata puoi effettuare fino a 7 sostituzioni fantasy invece delle ${leagueRulesFor(state).maxFantasySubs} previste dal regolamento.`,
        effect:{kind:'admin_rule',ruleId:'extra_subs_7'}
      })
    },
    {
      id:'admin-wildcard-sub',rarity:'rare',
      build:(day)=>({
        id:`admin-wildcard-sub-${day}`,
        category:'admin',
        icon:'🧩',
        title:'Jolly tattico',
        text:'Regola Admin: una volta, se manca un sostituto dello stesso ruolo, può entrare un panchinaro di qualunque ruolo.',
        effect:{kind:'admin_rule',ruleId:'wildcard_sub'}
      })
    },
    {
      id:'admin-best-bench',rarity:'common',
      build:(day)=>({
        id:`admin-best-bench-${day}`,
        category:'admin',
        icon:'📋',
        title:'Panchina meritocratica',
        text:'Regola Admin: nelle sostituzioni entra il panchinaro compatibile con il Fantavoto migliore, non il primo in ordine.',
        effect:{kind:'admin_rule',ruleId:'best_bench'}
      })
    },
    {
      id:'admin-forced-starter',rarity:'rare',
      build:(day)=>{
        const season=ensureSeasonState();
        const round=season?.schedule?.[Math.max(0,Number(day||1)-1)];
        const fantasyMatch=round?.matches?.find(m=>m.homeId==='user'||m.awayId==='user');
        if(!fantasyMatch) return null;
        const opponentId=fantasyMatch.homeId==='user'?fantasyMatch.awayId:fantasyMatch.homeId;
        const user=managerById('user'), opponent=managerById(opponentId);
        const userPool=(user?.roster||[]).filter(player=>!playerStatusForDay(player.id,day).unavailable);
        const oppPool=(opponent?.roster||[]).filter(player=>!playerStatusForDay(player.id,day).unavailable);
        if(!userPool.length || !oppPool.length) return null;
        const userPlayer=hashPick(sortedByChoiceHash(userPool,`admin-forced-starter-user|${day}`),`admin-forced-starter-user|${day}`);
        const opponentPlayer=hashPick(sortedByChoiceHash(oppPool,`admin-forced-starter-opp|${day}|${opponentId}`),`admin-forced-starter-opp|${day}|${opponentId}`);
        if(!userPlayer || !opponentPlayer) return null;
        return {
          id:`admin-forced-starter-${day}-${userPlayer.id}-${opponentPlayer.id}`,
          category:'admin',
          icon:'📌',
          title:'Titolare imposto',
          text:`L'Admin impone ${userPlayer.name} nel tuo XI. Per equilibrio, anche ${opponent?.team||'il tuo avversario'} dovrà schierare ${opponentPlayer.name}.`,
          effect:{
            kind:'admin_rule',ruleId:'forced_starter_pair',
            userPlayerId:String(userPlayer.id),userPlayerName:userPlayer.name,
            opponentId:String(opponentId),opponentPlayerId:String(opponentPlayer.id),opponentPlayerName:opponentPlayer.name
          }
        };
      }
    },
    {
      id:'admin-revolution-5',rarity:'rare',
      build:(day)=>{
        if(Number(day||0)<=1) return null;
        return {
          id:`admin-revolution-5-${day}`,
          category:'admin',
          icon:'🌪️',
          title:'Formazione rivoluzionata',
          text:'L\'Admin vuole una rivoluzione: devi cambiare almeno 5 titolari rispetto alla giornata precedente prima di poter confermare la formazione.',
          effect:{kind:'admin_rule',ruleId:'forced_turnover_5',minimumChanges:5}
        };
      }
    },
    {
      id:'admin-top-player-bench',rarity:'rare',
      build:(day)=>{
        const season=ensureSeasonState();
        const fixture=currentUserFixture();
        if(!season || !fixture) return null;
        const opponentId=fixture.homeId==='user'?fixture.awayId:fixture.homeId;
        const user=managerById('user'), opponent=managerById(opponentId);
        const topUser=adminBenchableTopPlayer(user,day);
        const topOpponent=adminBenchableTopPlayer(opponent,day);
        if(!topUser || !topOpponent) return null;
        return {
          id:`admin-top-player-bench-${day}-${topUser.id}-${topOpponent.id}`,
          category:'admin',
          icon:'🔒',
          title:'Top Player in panchina',
          text:`L'Admin manda in panchina i due uomini copertina: ${topUser.name} deve essere l’ultima riserva per te e ${topOpponent.name} deve essere l’ultima riserva per ${opponent?.team||'la CPU avversaria'}.`,
          effect:{
            kind:'admin_rule',ruleId:'top_player_bench',
            userPlayerId:String(topUser.id),userPlayerName:topUser.name,
            opponentId:String(opponentId),opponentPlayerId:String(topOpponent.id),opponentPlayerName:topOpponent.name
          }
        };
      }
    },
    {
      id:'admin-faith-reserve',rarity:'rare',
      build:(day)=>{
        const eligibleIds=previousUnusedBenchEligibleIds(day);
        if(!eligibleIds.length) return null;
        return {
          id:`admin-faith-reserve-${day}`,
          category:'admin',
          icon:'🌱',
          title:'Fiducia alla riserva',
          text:'Devi schierare titolare almeno un giocatore che nella giornata precedente era in panchina e non è entrato. Le riserve valide vengono evidenziate nella schermata formazione.',
          effect:{kind:'admin_rule',ruleId:'faith_reserve',eligiblePlayerIds:eligibleIds.slice()}
        };
      }
    },
    {
      id:'admin-wildcard-starter',rarity:'epic',
      build:(day)=>({
        id:`admin-wildcard-starter-${day}`,
        category:'admin',
        icon:'🃏',
        title:'Wildcard dell\'Admin',
        text:'Per questa giornata puoi schierare un solo giocatore fuori ruolo in uno slot compatibile. Portiere escluso: sono ammessi soltanto ruoli adiacenti D↔C e C↔A.',
        effect:{kind:'admin_rule',ruleId:'wildcard_starting_slot',maxOutOfRole:1}
      })
    },
    {
      id:'admin-double-wildcard',rarity:'epic',
      build:(day)=>({
        id:`admin-double-wildcard-${day}`,
        category:'admin',
        icon:'🃏',
        title:'Doppio Jolly',
        text:'Per questa giornata puoi schierare fino a 2 giocatori fuori ruolo. Portiere escluso: restano valide soltanto le compatibilità D↔C e C↔A.',
        effect:{kind:'admin_rule',ruleId:'double_wildcard_starting_slot',maxOutOfRole:2}
      })
    },
    {
      id:'admin-butterfly-555',rarity:'epic',
      build:(day)=>{
        const enough=manager=>['P','D','C','A'].every(role=>(manager?.roster||[]).filter(p=>p.role===role).length>=(role==='P'?1:5));
        if(!state?.managers?.every(enough)) return null;
        return {
          id:`admin-butterfly-555-${day}`,
          category:'admin',icon:'🦋',title:'5-5-5 · Modulo a farfalla',
          text:'Per questa giornata tutte le fantasquadre giocano col 5-5-5: 5 difensori, 5 centrocampisti, 5 attaccanti e un portiere. Tutti e 16 i titolari contribuiscono ai Fantapunti.',
          effect:{kind:'admin_rule',ruleId:'butterfly_555',formation:'5-5-5'}
        };
      }
    },
    {
      id:'admin-fantaclassifica',rarity:'epic',
      build:(day)=>{
        const season=ensureSeasonState();
        if(!season || season.fantaclassificaActive) return null;
        return {
          id:`admin-fantaclassifica-${day}`,
          category:'admin',
          icon:'🏆',
          title:'Fantaclassifica',
          text:'Da questo momento e fino alla fine della stagione la classifica della lega viene ordinata sui Fantapunti totali accumulati, non sui normali punti ottenuti da vittorie e pareggi.',
          effect:{kind:'admin_rule',ruleId:'fantaclassifica',persistent:true,activatedDay:Number(day||1)}
        };
      }
    }
  ];

  const SERIEA_TACTICAL_SHAPES = [
    {key:'4-3-3',req:{P:1,D:4,C:3,A:3}},
    {key:'4-4-2',req:{P:1,D:4,C:4,A:2}},
    {key:'3-5-2',req:{P:1,D:3,C:5,A:2}},
    {key:'3-4-3',req:{P:1,D:3,C:4,A:3}},
    {key:'5-3-2',req:{P:1,D:5,C:3,A:2}},
    {key:'4-5-1',req:{P:1,D:4,C:5,A:1}}
  ];


  // V3.2.35.55 · Identità tattiche Serie A. Sono preferenze, non vincoli:
  // qualità della rosa, forma e indisponibilità possono sempre far cambiare modulo.
  const SERIEA_TACTICAL_IDENTITY = {
    atalanta:['3-4-3','3-5-2'], bologna:['4-3-3','4-5-1'], cagliari:['4-4-2','3-5-2'],
    como:['4-3-3','4-5-1'], fiorentina:['3-4-3','4-3-3'], frosinone:['4-4-2','4-3-3'],
    genoa:['3-5-2','4-4-2'], inter:['3-5-2','3-4-3'], juventus:['4-3-3','3-5-2'],
    lazio:['4-3-3','4-5-1'], lecce:['4-4-2','4-3-3'], milan:['4-3-3','4-4-2'],
    monza:['4-4-2','3-4-3'], napoli:['4-3-3','3-4-3'], parma:['4-4-2','4-3-3'],
    roma:['3-4-3','3-5-2'], sassuolo:['4-3-3','4-5-1'], torino:['5-3-2','3-5-2'],
    udinese:['3-5-2','4-4-2'], venezia:['4-4-2','3-5-2']
  };

  const originalSerieAClubs=(window.FANTA_CLUBS||[]).map(c=>({...c}));
  const serieBClubs=(window.FANTA_SERIE_B?.clubs||[]).filter(c=>!originalSerieAClubs.some(a=>a.id===c.id));
  const clubMap = new Map([...originalSerieAClubs,...serieBClubs].map(c => [c.id, c]));
  const serieBPlayers=(window.FANTA_SERIE_B?.players||[]).map(p=>({...p,id:`serie-b-${p.id}`,originalClub:p.club,marketStatus:'serie_a',hidden:false}));

  function ensureRealLeague(source){
    if(!source.realLeague) source.realLeague={serieA:originalSerieAClubs.map(c=>c.id),serieB:serieBClubs.map(c=>c.id),lastCompletedSeason:0,lastChanges:null};
    return source.realLeague;
  }

  function syncRealLeagueClubs(source){
    const ids=source?ensureRealLeague(source).serieA:originalSerieAClubs.map(c=>c.id);
    window.FANTA_CLUBS.splice(0,window.FANTA_CLUBS.length,...ids.map(id=>clubMap.get(id)).filter(Boolean));
  }

  function advanceRealLeague(source,standings){
    const league=ensureRealLeague(source);
    const seasonNumber=Number(source.career?.seasonNumber||1);
    if(Number(league.lastCompletedSeason)>=seasonNumber || !Array.isArray(standings) || standings.length!==20 || standings.some(s=>Number(s.played||0)<38)) return league.lastChanges;
    const relegated=standings.slice(-3).map(s=>s.clubId);
    const promoted=league.serieB.slice().sort((a,b)=>randomHash(`${source.marketSeed}|real-promotion|${seasonNumber}|${a}`)-randomHash(`${source.marketSeed}|real-promotion|${seasonNumber}|${b}`)).slice(0,3);
    if(promoted.length!==3 || relegated.some(id=>!league.serieA.includes(id))) return null;
    // Pokémon stay Pokémon: carry the three relegated rosters into the new clubs.
    if(source.catalogMode==='pokemon'){
      const market=ensureSerieATransferMarket(source);
      market.playerClubOverrides ||= {};
      (window.FANTA_PLAYERS||[]).forEach(p=>{const index=relegated.indexOf(p.club);if(index>=0)market.playerClubOverrides[String(p.id)]=promoted[index];});
    }
    league.serieA=league.serieA.filter(id=>!relegated.includes(id)).concat(promoted);
    league.serieB=league.serieB.filter(id=>!promoted.includes(id)).concat(relegated);
    league.lastCompletedSeason=seasonNumber;
    league.lastChanges={seasonNumber,relegated,promoted};
    syncSerieATransferWorld(source);
    return league.lastChanges;
  }
  // Snapshot immutabile del database di partenza: il mondo Serie A runtime può
  // cambiare club, perdere giocatori all'estero e ricevere nuovi arrivi.
  const originalSerieAPlayers = (window.FANTA_PLAYERS || []).map(p => ({...p,originalClub:p.club,marketStatus:'serie_a',hidden:false}));
  const baseSerieAPlayers = originalSerieAPlayers.map(p=>({...p}));
  const basePlayerValueReference = new Map(baseSerieAPlayers.map(p => [String(p.id), {...p}]));
  const playerMap = new Map(baseSerieAPlayers.map(p => [String(p.id), p]));
  let activeCatalogKey='base';

  function pokemonBasePlayers(seed){
    const names=window.FANTA_POKEMON_CATALOG||[];
    const clubs=originalSerieAClubs.map(club=>club.id)
      .sort((a,b)=>randomHash(`${seed}|club-order|${a}`)-randomHash(`${seed}|club-order|${b}`));
    // Minimi ben superiori ai 30 P, 80 D, 80 C e 60 A richiesti dalle 10 rose.
    const roles=['P','D','C','A'];
    const distribution=[60,170,170,Math.max(0,names.length-400)];
    const slots=roles.flatMap((role,index)=>Array(distribution[index]).fill(role));
    const ordered=names.map((entry,index)=>({...entry,index,order:randomHash(`${seed}|role|${entry.id}`)}))
      .sort((a,b)=>a.order-b.order||a.index-b.index);
    return ordered.map((entry,index)=>{
      const role=slots[index];
      const ovr=Number(entry.ovr);
      const club=clubs[index%clubs.length]||'roma';
      const quotation=Math.max(1,Math.round(1+Math.pow(Math.max(0,ovr-58)/36,2)*32));
      return {id:entry.id,name:entry.name,role,roleLabel:ROLE_LABELS[role],nation:'Pokémon',ovr,club,originalClub:club,quotation,
        fvm:Math.max(1,Math.round(quotation*(role==='A'?2.1:role==='C'?1.8:role==='D'?1.5:1.3))),marketStatus:'serie_a',hidden:false};
    });
  }

  function activateCatalogBase(source){
    const mode=source?.catalogMode==='pokemon'?'pokemon':'base';
    const seed=String(source?.pokemonCatalogSeed||source?.marketSeed||'pokemon');
    syncRealLeagueClubs(source);
    const league=ensureRealLeague(source);
    if(mode==='pokemon' && !league.pokemonInitialClubs){
      const missing=league.serieA.filter(id=>!originalSerieAClubs.some(c=>c.id===id));
      league.pokemonInitialClubs=originalSerieAClubs.map(c=>league.serieA.includes(c.id)?c.id:missing.shift());
    }
    const key=mode==='pokemon'?`pokemon:${seed}:${league.pokemonInitialClubs.join(',')}`:'base-with-serie-b';
    if(key===activeCatalogKey) return;
    const base=mode==='pokemon'?pokemonBasePlayers(seed).map(p=>({...p,club:league.pokemonInitialClubs[originalSerieAClubs.findIndex(c=>c.id===p.club)],originalClub:league.pokemonInitialClubs[originalSerieAClubs.findIndex(c=>c.id===p.club)]})):[...originalSerieAPlayers,...serieBPlayers];
    baseSerieAPlayers.splice(0,baseSerieAPlayers.length,...base);
    basePlayerValueReference.clear();
    base.forEach(player=>basePlayerValueReference.set(String(player.id),{...player}));
    activeCatalogKey=key;
  }

  function applyCatalogDecision(draft){
    const rules=leagueRulesFor(draft);
    const oldMode=draft.catalogMode==='pokemon'?'pokemon':'base';
    if(!rules.selectedCategories.includes('alternateCatalog') || rules.catalogDecision!=='accept') return;
    draft.catalogWorlds ||= {};
    draft.catalogWorlds[oldMode]={transferMarket:JSON.parse(JSON.stringify(draft.transferMarket)),playerBaseOvr:{...(draft.playerBaseOvr||{})}};
    const nextMode=oldMode==='pokemon'?'base':'pokemon';
    draft.catalogMode=nextMode;
    draft.pokemonCatalogSeed ||= draft.marketSeed;
    const saved=draft.catalogWorlds[nextMode];
    draft.transferMarket=saved?JSON.parse(JSON.stringify(saved.transferMarket)):TransferEngine.createMarketState(`${draft.pokemonCatalogSeed}|${nextMode}`);
    draft.playerBaseOvr={...(saved?.playerBaseOvr||{})};
    activateCatalogBase(draft);
    draft.availableIds=baseSerieAPlayers.map(player=>String(player.id));
    syncSerieATransferWorld(draft);
  }


  // V2.1 · formazione: coordinate adattate dal vecchio motore Fantaballa.
  // Il database corrente espone i macro-ruoli P/D/C/A: qualunque giocatore del
  // reparto può occupare uno degli slot tattici di quel reparto.
  function makeFormationSlots(key, specs) {
    const counts = {P:0,D:0,C:0,A:0};
    return specs.map((s,idx) => {
      const [label,role,x,y] = s;
      counts[role] += 1;
      return { key:label, role, x, y, instanceId:`${key}-${role}-${counts[role]}-${idx}` };
    });
  }

  const LINEUP_FORMATIONS = {
    '4-3-3': makeFormationSlots('4-3-3', [
      ['AS','A',22,18],['PC','A',50,14],['AD','A',78,18],
      ['CC','C',35,49],['MED','C',50,57],['CC','C',65,49],
      ['TS','D',23,79],['DC','D',39,82],['DC','D',61,82],['TD','D',77,79],['P','P',50,93]
    ]),
    '4-4-2': makeFormationSlots('4-4-2', [
      ['PC','A',39,18],['PC','A',61,18],
      ['ES','C',21,48],['CC','C',40,55],['CC','C',60,55],['ED','C',79,48],
      ['TS','D',23,79],['DC','D',39,82],['DC','D',61,82],['TD','D',77,79],['P','P',50,93]
    ]),
    '4-5-1': makeFormationSlots('4-5-1', [
      ['PC','A',50,15],
      ['ES','C',19,43],['CC','C',35,54],['COC','C',50,40],['CC','C',65,54],['ED','C',81,43],
      ['TS','D',23,79],['DC','D',39,82],['DC','D',61,82],['TD','D',77,79],['P','P',50,93]
    ]),
    '3-4-3': makeFormationSlots('3-4-3', [
      ['AS','A',22,18],['PC','A',50,14],['AD','A',78,18],
      ['ES','C',21,50],['CC','C',40,56],['CC','C',60,56],['ED','C',79,50],
      ['DC','D',34,80],['DC','D',50,80],['DC','D',66,80],['P','P',50,93]
    ]),
    '3-3-4': makeFormationSlots('3-3-4', [
      ['AS','A',15,21],['PC','A',38,15],['PC','A',62,15],['AD','A',85,21],
      ['CC','C',27,51],['MED','C',50,57],['CC','C',73,51],
      ['DC','D',34,80],['DC','D',50,80],['DC','D',66,80],['P','P',50,93]
    ]),
    '3-5-2': makeFormationSlots('3-5-2', [
      ['PC','A',39,18],['PC','A',61,18],
      ['ES','C',19,48],['CC','C',36,58],['COC','C',50,40],['CC','C',64,58],['ED','C',81,48],
      ['DC','D',34,80],['DC','D',50,80],['DC','D',66,80],['P','P',50,93]
    ]),
    '5-3-2': makeFormationSlots('5-3-2', [
      ['PC','A',39,18],['PC','A',61,18],
      ['CC','C',35,52],['MED','C',50,59],['CC','C',65,52],
      ['TS','D',15,78],['DC','D',32,80],['DC','D',50,80],['DC','D',68,80],['TD','D',85,78],['P','P',50,93]
    ]),
    '5-4-1': makeFormationSlots('5-4-1', [
      ['PC','A',50,15],
      ['ES','C',21,48],['CC','C',40,55],['CC','C',60,55],['ED','C',79,48],
      ['TS','D',15,78],['DC','D',32,80],['DC','D',50,80],['DC','D',68,80],['TD','D',85,78],['P','P',50,93]
    ]),
    '5-5-5': makeFormationSlots('5-5-5', [
      ['AS','A',12,18],['AS','A',31,14],['PC','A',50,18],['AD','A',69,14],['AD','A',88,18],
      ['ES','C',12,48],['CC','C',31,50],['MED','C',50,54],['CC','C',69,50],['ED','C',88,48],
      ['TS','D',12,78],['DC','D',31,80],['DC','D',50,78],['DC','D',69,80],['TD','D',88,78],['P','P',50,94]
    ])
  };

  function allowedLineupFormation(key,source=state){
    return !!LINEUP_FORMATIONS[key] && (key!=='3-3-4' || !!leagueRulesFor(source).formation334Allowed)
      && (key!=='5-5-5' || activeAdminRuleEffect(source?.season?.currentMatchday)?.ruleId==='butterfly_555');
  }

  function availableLineupFormations(source=state){
    return Object.keys(LINEUP_FORMATIONS).filter(key=>allowedLineupFormation(key,source));
  }

  let lineupDraft = null;
  let lineupSelectedPlayerId = null;
  let lineupReadOnly = false;
  let lineupDragPlayerId = null;
  let lineupPartialContext = null;
  let lineupAssistantAdjustments = [];
  let serieALive = null;
  let hubNewsCarouselTimer = null;
  let hubNewsCarouselIndex = 0;
  let hubNewsCarouselCount = 0;

  const PERSONALITIES = [
    { id:'user', name:'Tu', label:'Fantallenatore', aggression:1.00, volatility:.05, topBias:1.00, heat:.02, targets:{P:30,D:60,C:120,A:290} },
    { id:'bomber', name:'Beppe', team:'Beppe FC', label:'Il Bomberista', aggression:1.01, volatility:.08, topBias:1.02, heat:.05, targets:{P:25,D:50,C:105,A:320} },
    { id:'ragioniere', name:'Marco', team:'Atletico Bilancio', label:'Il Ragioniere', aggression:1.00, volatility:.025, topBias:.99, heat:.005, targets:{P:35,D:75,C:135,A:255} },
    { id:'spendaccione', name:'Fabio', team:'Real Spendaccione', label:'Lo Spendaccione', aggression:1.03, volatility:.10, topBias:1.05, heat:.08, targets:{P:25,D:55,C:110,A:310} },
    { id:'tirchio', name:'Luca', team:'AC Risparmio', label:'Il Tirchio', aggression:1.00, volatility:.05, topBias:.94, heat:.01, valueHunter:true, targets:{P:35,D:70,C:135,A:260} },
    { id:'moneyball', name:'Davide', team:'Data United', label:'Moneyball', aggression:1.00, volatility:.03, topBias:1.00, heat:.01, valueHunter:true, targets:{P:35,D:70,C:145,A:250} },
    { id:'tifoso', name:'Simone', team:'Curva Nord FC', label:'Il Tifoso', aggression:1.01, volatility:.07, topBias:1.00, heat:.03, favoriteClub:'inter', targets:{P:30,D:60,C:120,A:290} },
    { id:'collezionista', name:'Andrea', team:'Galácticos', label:'Collezionista di Top', aggression:1.02, volatility:.06, topBias:1.06, heat:.06, targets:{P:25,D:50,C:105,A:320} },
    { id:'esperto', name:'Stefano', team:'Metodo FC', label:"L'Esperto", aggression:1.01, volatility:.02, topBias:1.01, heat:.01, expert:true, targets:{P:30,D:60,C:120,A:290} },
    { id:'pazzo', name:'Gigi', team:'Caos 11', label:'Il Pazzo', aggression:1.00, volatility:.14, topBias:1.02, heat:.10, targets:{P:25,D:55,C:110,A:310} },
    { id:'gambler', name:'Lorenzo', team:'Risk FC', label:'Il Gambler', aggression:1.05, volatility:.16, topBias:1.02, heat:.12, riskTaker:true, targets:{P:25,D:50,C:105,A:320} },
    { id:'stratega', name:'Riccardo', team:'Mastermind FC', label:'Il DS Stratega', aggression:1.00, volatility:.02, topBias:1.01, heat:.01, expert:true, targets:{P:30,D:65,C:135,A:270} },
    { id:'rivale', name:'Alessio', team:'Nemesis FC', label:'Il Rivale Diretto', aggression:1.04, volatility:.08, topBias:1.04, heat:.10, targets:{P:30,D:55,C:115,A:300} },

    // Rivali speciali per le categorie superiori.
    { id:'squalo', name:'Vittorio', team:'Shark Capital', label:'Lo Squalo', aggression:1.07, volatility:.09, topBias:1.08, heat:.13, riskTaker:true, targets:{P:24,D:50,C:105,A:321} },
    { id:'camaleonte', name:'Nicolò', team:'Adaptive XI', label:'Il Camaleonte', aggression:1.02, volatility:.03, topBias:1.01, heat:.02, expert:true, valueHunter:true, targets:{P:30,D:62,C:132,A:276} },
    { id:'fantadata', name:'Tommaso', team:'Fantadata Lab', label:'Il Fantadata', aggression:1.03, volatility:.02, topBias:1.03, heat:.02, expert:true, valueHunter:true, targets:{P:30,D:60,C:138,A:282} },
    { id:'predatore', name:'Diego', team:'Predators FC', label:'Il Predatore', aggression:1.06, volatility:.07, topBias:1.07, heat:.11, riskTaker:true, targets:{P:24,D:52,C:110,A:314} },
    { id:'broker', name:'Federico', team:'Broker League', label:'Il Broker', aggression:1.08, volatility:.06, topBias:1.09, heat:.10, targets:{P:23,D:48,C:106,A:323} },
    { id:'admin', name:'Admin', team:'Admin FC', label:'Admin', aggression:1.055, volatility:.018, topBias:1.065, heat:.035, expert:true, valueHunter:true, targets:{P:30,D:64,C:132,A:274} },
  ];

  const SPECIAL_RIVAL_IDS = ['squalo','camaleonte','fantadata','predatore','broker'];

  let state = null;
  let marketValueMap = buildMarketValueMap();
  let careerDraft = null;
  let careerPowerSelection = [];
  let careerRulesNextAction = 'auction';
  let careerTeamSubstep = 'identity';
  let nextSeasonSetupMode = false;
  let nextSeasonMarketSimulationRunning = false;
  let toastTimer = null;
  const slotRankingCache = new Map();
  const initializedSeasonSystems = new WeakSet();
  let uiTimer = null;
  let countdownTimer = null;
  let cpuReactionTimers = [];
  let bidFlashTimer = null;
  let bidSpotlightTimer = null;
  let awardAnimationTimer = null;
  let suddenInterestTimer = null;
  let lastBidFlash = null;
  let autocompleteMode = false;
  let roleRemainderAutoSim = false;
  let roleRemainderRestoreTurbo = false;
  let selectedPlayerId = null;
  let nominationUiKey = '';
  let evolutionFilter = 'movers';
  let dataCenterTab = 'overview';
  let socialSelectedPlayerId = null;
  let socialSearchQuery = '';

  const $ = id => document.getElementById(id);
  function careerHash(key) {
    const seed = state?.marketSeed || 'legacy';
    return randomHash(`${seed}|${key}`);
  }

  function profileArchetype(manager) {
    return String(manager?.profile?.archetype || manager?.profile?.id || '').toLowerCase();
  }

  function roleCount(manager, role) {
    return AuctionEngine.roleCount(manager,role);
  }

  function openRoleAuction(){
    return !!state && leagueRulesFor(state).freeRoleAuction===true;
  }

  function managerCanNominate(manager){
    if(!manager || slotsRemaining(manager)<=0) return false;
    return state.availableIds.some(id=>{
      const player=playerMap.get(String(id));
      return player && canOwn(manager,player) && maxLegalBid(manager,player)>=1;
    });
  }

  function slotsRemaining(manager) { return AuctionEngine.slotsRemaining(manager,TOTAL_SLOTS); }
  function roleSlotsRemaining(manager, role) { return AuctionEngine.roleSlotsRemaining(manager,role,ROLE_LIMITS); }

  function currentAuctionRole() {
    if (!state) return ROLE_ORDER[0];
    if(openRoleAuction()){
      const live=state.auction?.playerId && playerMap.get(String(state.auction.playerId));
      if(live) return live.role;
      const picked=$('roleFilter')?.value;
      if(ROLE_ORDER.includes(picked)) return picked;
      const manager=state.managers?.[state.nominationIndex];
      return ROLE_ORDER.find(role=>roleSlotsRemaining(manager,role)>0)||ROLE_ORDER[0];
    }
    return ROLE_ORDER[Math.min(Number(state.currentRoleIndex||0), ROLE_ORDER.length-1)];
  }

  function currentRoleLabel() { return ROLE_LABELS[currentAuctionRole()] || currentAuctionRole(); }

  function userCompletedCurrentRole(role=currentAuctionRole()) {
    const user=state?.managers?.find(m=>m.id==='user');
    return !!user && roleSlotsRemaining(user,role)<=0;
  }

  function showRoleRemainderAutoSim(role){
    const banner=$('roleAutoSimBanner');
    if(!banner) return;
    const title=$('roleAutoSimTitle');
    const copy=$('roleAutoSimText');
    if(title) title.textContent=`Simulazione ${ROLE_PLURALS[role]||role} CPU…`;
    if(copy) copy.textContent=`Hai completato i tuoi ${(ROLE_PLURALS[role]||role).toLowerCase()}. Le aste rimanenti del reparto vengono risolte automaticamente.`;
    banner.classList.remove('hidden');
    banner.setAttribute('aria-hidden','false');
  }

  function hideRoleRemainderAutoSim(){
    const banner=$('roleAutoSimBanner');
    if(!banner) return;
    banner.classList.add('hidden');
    banner.setAttribute('aria-hidden','true');
  }

  function beginRoleRemainderAutoSim(role=currentAuctionRole()){
    if(!state || openRoleAuction() || state.completed || roleRemainderAutoSim || rolePhaseComplete(role) || !userCompletedCurrentRole(role)) return false;
    roleRemainderAutoSim=true;
    roleRemainderRestoreTurbo=!!state.turbo;
    autocompleteMode=true;
    state.turbo=true;
    if($('turboToggle')) $('turboToggle').checked=true;
    showRoleRemainderAutoSim(role);
    showToast(`✓ ${ROLE_LABELS[role]} completati: simulo automaticamente le aste CPU rimanenti.`);
    return true;
  }

  function endRoleRemainderAutoSim(){
    if(!roleRemainderAutoSim) return;
    roleRemainderAutoSim=false;
    autocompleteMode=false;
    state.turbo=roleRemainderRestoreTurbo;
    if($('turboToggle')) $('turboToggle').checked=!!state.turbo;
    hideRoleRemainderAutoSim();
  }

  const PLAYER_AVATAR_CACHE = new Map();
  const COACH_AVATAR_DEFAULT={hair:'0',expression:'smile',skin:'0',shirt:'purple'};
  const COACH_SHIRTS={purple:'#7447c9',blue:'#348bd1',red:'#c64a57',green:'#278e69',yellow:'#d7ab35',black:'#353c52'};
  function normalizedCoachAvatar(value){
    const candidate=value && typeof value==='object' ? value : {};
    return {
      hair:['0','1','2','3'].includes(String(candidate.hair))?String(candidate.hair):COACH_AVATAR_DEFAULT.hair,
      expression:['smile','focused','serious','surprised'].includes(candidate.expression)?candidate.expression:COACH_AVATAR_DEFAULT.expression,
      skin:['0','1','2','3','4'].includes(String(candidate.skin))?String(candidate.skin):COACH_AVATAR_DEFAULT.skin,
      shirt:Object.hasOwn(COACH_SHIRTS,candidate.shirt)?candidate.shirt:COACH_AVATAR_DEFAULT.shirt
    };
  }
  function pixelPlayerAvatarData(player){
    if(!player) return '';
    const custom=player.avatarCustomization?normalizedCoachAvatar(player.avatarCustomization):null;
    const identity=String(player.id||player.name||'player');
    const key=identity+(custom?'|'+Object.values(custom).join('|'):'');
    if(PLAYER_AVATAR_CACHE.has(key)) return PLAYER_AVATAR_CACHE.get(key);
    let seed=2166136261;
    // Le scelte dell'allenatore servono solo alla cache: non devono alterare
    // capelli, occhi o altri dettagli generati dal suo identificativo.
    const seedSource=custom?identity:`${key}|${player.name||''}|${player.club||''}`;
    for(const ch of seedSource){seed^=ch.charCodeAt(0);seed=Math.imul(seed,16777619)>>>0;}
    if(/^pokemon-\d+$/.test(identity)){
      const colors=[
        ['#f0ae54','#ffe0a0','#a45c36'],['#75c58e','#b8e7a5','#3a825f'],
        ['#6da9d9','#b7daf1','#4169a7'],['#a88bd5','#dac9f1','#6c56a4'],
        ['#e78092','#f6bdc9','#a84970'],['#e0cd66','#f5eba9','#9c7d39'],
        ['#8eabae','#d5e3db','#536f7b'],['#c88762','#f3c399','#865645']
      ];
      const variant=(salt,count)=>{
        let value=seed^Math.imul(salt,0x9e3779b9);
        value=Math.imul(value^(value>>>16),0x85ebca6b);
        value=Math.imul(value^(value>>>13),0xc2b2ae35);
        return ((value^(value>>>16))>>>0)%count;
      };
      const [body,light,dark]=colors[variant(13,colors.length)];
      const trim=({P:'#f2c94c',D:'#37c47a',C:'#48a9ff',A:'#ef6273'}[player.role]||'#ffd84d');
      const ears=[
        `<path d="M23 35L16 7l20 13m37 15L80 7 60 20" fill="${body}" stroke="${dark}" stroke-width="5"/>`,
        `<path d="M27 33V10h13v17m16 0V10h13v23" fill="${body}" stroke="${dark}" stroke-width="5"/>`,
        `<path d="M23 34L8 22l9 23m56-11 15-12-9 23" fill="${body}" stroke="${dark}" stroke-width="5"/>`,
        `<path d="M29 30L19 12l20 12m18 0 20-12-10 18" fill="${light}" stroke="${dark}" stroke-width="5"/>`,
        `<path d="M28 29L35 5l9 21m8 0 9-21 7 24" fill="${dark}" stroke="${dark}" stroke-width="4"/>`,
        `<path d="M24 35L8 29l16-5m48 11 16-6-16-5" fill="${light}" stroke="${dark}" stroke-width="5"/>`
      ][variant(29,6)];
      const heads=[
        `<path d="M22 34h8V23h36v11h8v22h-7v10H29V56h-7z"/>`,
        `<path d="M19 36h9V25h40v11h9v23h-9v10H28V59h-9z"/>`,
        `<path d="M26 29h44v9h7v19h-7v10H26V57h-7V38h7z"/>`,
        `<path d="M28 22h40v11h8v23h-9v13H29V56h-9V33h8z"/>`
      ][variant(43,4)];
      const markings=[
        `<rect x="24" y="44" width="9" height="7" fill="${light}"/><rect x="63" y="44" width="9" height="7" fill="${light}"/>`,
        `<path d="M40 25h16v11H40z" fill="${dark}"/><rect x="44" y="29" width="8" height="5" fill="${light}"/>`,
        `<rect x="28" y="25" width="8" height="11" fill="${dark}"/><rect x="60" y="25" width="8" height="11" fill="${dark}"/>`,
        `<path d="M25 53h13v5H25m33-5h13v5H58" fill="${light}"/>`,
        ''
      ][variant(61,5)];
      const eyes=[
        '<rect x="32" y="39" width="8" height="9"/><rect x="56" y="39" width="8" height="9"/>',
        '<path d="M31 41h10v7H31zm24 0h10v7H55z"/>',
        '<rect x="34" y="41" width="6" height="6"/><rect x="56" y="41" width="6" height="6"/>'
      ][variant(79,3)];
      const snout=variant(97,3)===0
        ? `<path d="M35 54h26v11H35z" fill="${light}"/><rect x="44" y="54" width="8" height="6" fill="${dark}"/><path d="M41 63h14" stroke="${dark}" stroke-width="3"/>`
        : variant(97,3)===1
          ? `<path d="M40 54h16v10H40z" fill="${light}"/><rect x="45" y="55" width="6" height="5" fill="${dark}"/>`
          : `<rect x="45" y="54" width="6" height="5" fill="${dark}"/><path d="M39 62h18" stroke="${dark}" stroke-width="3"/>`;
      const number=Number(identity.slice(8))||0;
      const crest=Array.from({length:9},(_,index)=>(number&(1<<index))
        ? `<rect x="${41+(index%3)*5}" y="${83+Math.floor(index/3)*4}" width="4" height="3" fill="${dark}"/>`:'').join('');
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" shape-rendering="crispEdges">
        <path d="M14 96V76l14-12h40l14 12v20z" fill="${dark}" stroke="#101226" stroke-width="4"/>
        ${ears}<g fill="${body}" stroke="${dark}" stroke-width="4" stroke-linejoin="miter">${heads}</g>
        ${markings}<g fill="#17243b">${eyes}</g>${snout}
        <path d="M16 83h64v13H16z" fill="${trim}"/><path d="M30 83h36v13H30z" fill="${body}"/>${crest}
      </svg>`;
      const uri=`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
      PLAYER_AVATAR_CACHE.set(key,uri);
      return uri;
    }
    const pick=(list,shift=0)=>list[(seed>>>shift)%list.length];
    const skins=['#f2c18d','#dfa06d','#c77c4d','#9b5838','#72412d'];
    const hairs=['#17131b','#3b2519','#6c3c1c','#a45d24','#d3a34e','#c8b79e'];
    const eyes=['#18243a','#31553e','#5a3b26','#3f6187'];
    const roleTrim=custom?COACH_SHIRTS[custom.shirt]:({P:'#f2c94c',D:'#37c47a',C:'#48a9ff',A:'#ef6273'}[player.role]||'#ffd84d');
    const skin=custom?skins[Number(custom.skin)]:pick(skins,1),hair=pick(hairs,5),eye=pick(eyes,9),shirt=custom?COACH_SHIRTS[custom.shirt]:(clubColor(player.club)||'#5542a8');
    const hairStyle=custom?Number(custom.hair):(seed>>>12)%4,beard=!custom&&((seed>>>16)%5)>=3,scar=!custom&&((seed>>>19)%11)===0;
    const hairShape=[
      `<path d="M24 30V18h8v-6h32v6h8v12h-8V24H32v6z" fill="${hair}"/>`,
      `<path d="M24 32V18h6v-6h36v6h6v14h-8V23H32v9z" fill="${hair}"/><rect x="32" y="8" width="24" height="6" fill="${hair}"/>`,
      `<path d="M24 30V20h6v-7h10V9h24v6h8v15h-8v-7H32v7z" fill="${hair}"/>`,
      `<path d="M25 28V18h8v-5h30v5h8v10h-7v-5H32v5z" fill="${hair}"/>`
    ][hairStyle];
    const beardShape=beard?`<path d="M31 50h34v10l-9 9H40l-9-9z" fill="${hair}"/><rect x="40" y="50" width="16" height="5" fill="${skin}"/>`:'';
    const scarShape=scar?`<path d="M58 36l-5 9" stroke="#8d4a3b" stroke-width="2"/>`:'';
    const brows=custom?.expression==='focused'?`<path d="M32 35l9 3m22-3l-9 3" stroke="${hair}" stroke-width="3"/>`:
      custom?.expression==='surprised'?`<path d="M32 32h9m14 0h9" stroke="${hair}" stroke-width="3"/>`:'';
    const mouth=custom?.expression==='serious'?'<path d="M40 58h16" stroke="#8b4938" stroke-width="3"/>':
      custom?.expression==='focused'?'<path d="M41 58h14" stroke="#8b4938" stroke-width="3"/>':
      custom?.expression==='surprised'?'<rect x="44" y="55" width="9" height="9" fill="#8b4938"/>':
      '<path d="M38 56h20v4l-6 4H44l-6-4z" fill="#8b4938"/><path d="M42 57h12" stroke="#fff5dc" stroke-width="2"/>';
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" shape-rendering="crispEdges">
      <path d="M12 96V78c0-15 14-25 36-25s36 10 36 25v18z" fill="${shirt}" stroke="#090d19" stroke-width="4"/>
      <path d="M12 83h72v13H12z" fill="${roleTrim}" opacity=".92"/><path d="M20 82h56v14H20z" fill="${shirt}"/>
      <path d="M37 52h22v15L48 74 37 67z" fill="${skin}" stroke="#090d19" stroke-width="3"/>
      <path d="M26 25h44v23c0 14-9 23-22 23s-22-9-22-23z" fill="${skin}" stroke="#090d19" stroke-width="4"/>
      ${hairShape}${brows}<rect x="33" y="37" width="7" height="5" fill="${eye}"/><rect x="56" y="37" width="7" height="5" fill="${eye}"/>
      <rect x="46" y="43" width="5" height="8" fill="#a86445"/>${custom?mouth:'<path d="M39 56h18v4H39z" fill="#8b4938"/>'}${beardShape}${scarShape}
      <path d="M31 73l17 9 17-9 7 23H24z" fill="rgba(7,11,24,.24)"/>
    </svg>`;
    const uri=`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    PLAYER_AVATAR_CACHE.set(key,uri);
    return uri;
  }

  function playerAvatarMarkup(player,alt=''){
    return `<img src="${pixelPlayerAvatarData(player)}" alt="${escapeHtml(alt||player?.name||'Giocatore')}" loading="lazy">`;
  }

  function lineupPlayerFaceMarkup(player,size=''){
    const cls=String(size||'').trim();
    return `<span class="lineup-player-face ${escapeHtml(cls)}">${playerAvatarMarkup(player,player?.name||'Giocatore')}</span>`;
  }

  function playerStars(ovr) {
    const val = Number(ovr||0);
    const full = clamp(Math.round((val - 55) / 7), 1, 5);
    return '★'.repeat(full) + '☆'.repeat(5-full);
  }

  function ensureIntegrityState() {
    if (!state) return null;
    if (!state.integrity || typeof state.integrity !== 'object') {
      state.integrity = { checks:0, repairs:0, warnings:0, lastCheck:null, recent:[] };
    }
    if (!Array.isArray(state.integrity.recent)) state.integrity.recent = [];
    return state.integrity;
  }

  function integrityNote(type, message, context='runtime') {
    const bag = ensureIntegrityState();
    if (!bag) return;
    if (type === 'repair') bag.repairs++;
    else bag.warnings++;
    bag.recent.push({ type, message, context, at:Date.now() });
    if (bag.recent.length > 40) bag.recent = bag.recent.slice(-40);
    console.warn(`[Asta integrity/${context}] ${message}`);
  }

  function auditAndRepairState(context='runtime') {
    if (!state || !Array.isArray(state.managers)) return true;
    const bag = ensureIntegrityState();
    bag.checks++;
    bag.lastCheck = { context, at:Date.now() };
    let clean = true;

    // 1) A player can belong to one roster only. If a duplicate ever appears,
    // keep the first owner and refund/remove all accidental duplicates.
    const owners = new Map();
    state.managers.forEach(m => {
      if (!Array.isArray(m.roster)) m.roster = [];
      const kept = [];
      for (const item of m.roster) {
        if (!item || !playerMap.has(item.id)) { clean=false; integrityNote('repair', `${m.team}: voce rosa non valida rimossa`, context); continue; }
        if (owners.has(item.id)) {
          clean=false;
          integrityNote('repair', `${item.name}: duplicato rimosso da ${m.team}`, context);
          continue;
        }
        owners.set(item.id,m.id);
        kept.push(item);
      }
      m.roster = kept;
    });

    // 2) Enforce hard roster and role limits. This should never fire in normal play,
    // but makes corrupted saves/self-inconsistent states recoverable.
    state.managers.forEach(m => {
      for (const role of ROLE_ORDER) {
        const inRole = m.roster.filter(x=>x.role===role);
        if (inRole.length > ROLE_LIMITS[role]) {
          clean=false;
          const extras = inRole.slice(ROLE_LIMITS[role]);
          const extraIds = new Set(extras.map(x=>x.id));
          m.roster = m.roster.filter(x=>!extraIds.has(x.id));
          extras.forEach(x=>owners.delete(x.id));
          integrityNote('repair', `${m.team}: rimossi ${extras.length} ${ROLE_PLURALS[role].toLowerCase()} oltre il limite`, context);
        }
      }
      if (m.roster.length > TOTAL_SLOTS) {
        clean=false;
        const extras = m.roster.slice(TOTAL_SLOTS);
        m.roster = m.roster.slice(0,TOTAL_SLOTS);
        extras.forEach(x=>owners.delete(x.id));
        integrityNote('repair', `${m.team}: rosa ridotta a ${TOTAL_SLOTS} giocatori`, context);
      }

      // Prima di gennaio vale la contabilità dell'asta iniziale. Dopo l'apertura
      // invernale il ledger include bonus base, rimborsi e spesa della mini asta.
      const spent = m.roster.reduce((s,x)=>s+Math.max(0,Number(x.price||0)),0);
      const winterBudget=state.winterMarketFlow?.ledger?.[m.id]
        ? expectedWinterBudget(m.id)
        : null;
      const auctionBaseBudget=Math.max(0,Number(state.auctionStartingBudgets?.[m.id]??INITIAL_BUDGET));
      const expectedBudget = winterBudget===null ? Math.max(0, auctionBaseBudget-spent+Number(state.tradeBudgetAdjustments?.[m.id]||0)) : winterBudget;
      if (!Number.isFinite(Number(m.budget)) || Number(m.budget)!==expectedBudget) {
        clean=false;
        m.budget = expectedBudget;
        integrityNote('repair', `${m.team}: budget riallineato a ${expectedBudget}`, context);
      }
      const minReserve = slotsRemaining(m);
      if (m.budget < minReserve) {
        clean=false;
        integrityNote('warning', `${m.team}: budget ${m.budget} sotto la riserva minima ${minReserve}`, context);
      }
    });

    // 3) Available list is rebuilt from the authoritative rosters.
    const allIds = (window.FANTA_PLAYERS || []).map(p=>p.id);
    const currentAuctionId = state.auction?.playerId || null;
    const expectedAvailable = allIds.filter(id=>!owners.has(id));
    const currentSet = new Set(state.availableIds || []);
    const mismatch = expectedAvailable.length !== currentSet.size || expectedAvailable.some(id=>!currentSet.has(id));
    if (mismatch) {
      clean=false;
      state.availableIds = expectedAvailable;
      integrityNote('repair', 'Lista svincolati ricostruita dalle rose', context);
    }
    // The current auction player must still be available until awardAuction removes it.
    if (currentAuctionId && !state.availableIds.includes(currentAuctionId) && !owners.has(currentAuctionId)) {
      state.availableIds.push(currentAuctionId);
      clean=false;
      integrityNote('repair', 'Giocatore in asta reinserito tra i disponibili', context);
    }

    // 4) Live-auction legality: unique active IDs, valid leader, legal current price.
    if (state.auction) {
      const a = state.auction;
      const p = playerMap.get(a.playerId);
      const validManagers = new Set(state.managers.map(m=>m.id));
      a.activeIds = [...new Set((a.activeIds||[]).filter(id=>validManagers.has(id)))];
      if (!p || owners.has(a.playerId)) {
        clean=false;
        state.auction = null;
        integrityNote('repair', 'Asta non valida annullata in sicurezza', context);
      } else {
        let leader = state.managers.find(m=>m.id===a.highBidderId);
        if (!leader || !canOwn(leader,p)) {
          clean=false;
          leader = state.managers.find(m=>m.id===a.nominatorId && canOwn(m,p)) || state.managers.find(m=>canOwn(m,p));
          if (leader) { a.highBidderId=leader.id; a.price=1; }
          else { state.auction=null; }
          integrityNote('repair', 'Leader asta non valido corretto', context);
        }
        if (state.auction && leader) {
          const leaderMax = maxLegalBid(leader,p);
          if (!Number.isFinite(Number(a.price)) || a.price < 1 || a.price > leaderMax) {
            clean=false;
            a.price = clamp(Math.round(Number(a.price)||1),1,Math.max(1,leaderMax));
            integrityNote('repair', `Prezzo asta ricondotto al massimo legale (${a.price})`, context);
          }
          if (!a.activeIds.includes(leader.id)) a.activeIds.push(leader.id);
          a.activeIds = a.activeIds.filter(id=>{
            const m=state.managers.find(x=>x.id===id);
            return !!m && (id===leader.id || (id==='user' && !autocompleteMode && canOwn(m,p)) || (canOwn(m,p) && maxLegalBid(m,p)>a.price));
          });
        }
      }
    }

    // 5) Nomination pointer must always reference someone who can still fill the current role.
    if (!state.auction && !state.completed && state.currentRoleIndex < ROLE_ORDER.length) {
      const role=currentAuctionRole();
      const idx=clamp(Number(state.nominationIndex||0),0,state.managers.length-1);
      state.nominationIndex=idx;
      if (openRoleAuction()?!managerCanNominate(state.managers[idx]):roleSlotsRemaining(state.managers[idx],role)<=0) {
        state.nominationIndex=nextNominatorIndex(idx);
        clean=false;
        integrityNote('repair', 'Turno di chiamata riallineato a un manager eleggibile', context);
      }
    }
    return clean;
  }

  function rolePhaseComplete(role=currentAuctionRole()) {
    return !!state && state.managers.every(m => roleSlotsRemaining(m, role) <= 0);
  }

  function advanceRolePhaseIfNeeded() {
    if (!state) return false;
    if(openRoleAuction()) return false;
    let advanced = false;
    while (state.currentRoleIndex < ROLE_ORDER.length && rolePhaseComplete(ROLE_ORDER[state.currentRoleIndex])) {
      state.currentRoleIndex++;
      advanced = true;
    }
    return advanced;
  }


  function roleTransitionCopy(transition=state?.roleTransition) {
    if (!transition) return null;
    const from=transition.fromRole;
    const to=transition.toRole;
    const fromName=ROLE_PLURALS[from] || ROLE_LABELS[from] || from;
    const toName=to ? (ROLE_PLURALS[to] || ROLE_LABELS[to] || to) : null;
    return {
      eyebrow: transition.final ? 'ASTA · ULTIMO REPARTO COMPLETATO' : 'ASTA · REPARTO COMPLETATO',
      title: transition.final ? `${fromName} completati` : `${fromName} completati`,
      message: transition.final
        ? `Tutte le squadre hanno completato anche gli ${String(fromName).toLowerCase()}. L’asta è terminata.`
        : `Tutte le squadre hanno completato i ${String(fromName).toLowerCase()}. Quando sei pronto, si passa ai ${String(toName).toLowerCase()}.`,
      button: transition.final ? 'VAI AL RIEPILOGO' : `CONTINUA · ${String(toName).toUpperCase()}`
    };
  }

  function showRoleTransitionModal(){
    const modal=$('roleTransitionModal');
    const tr=state?.roleTransition;
    if(!modal || !tr) return;
    const copy=roleTransitionCopy(tr);
    $('roleTransitionEyebrow').textContent=copy.eyebrow;
    $('roleTransitionTitle').textContent=copy.title;
    $('roleTransitionMessage').textContent=copy.message;
    $('roleTransitionContinue').textContent=copy.button;
    const from=tr.fromRole;
    const totalNeeded=ROLE_LIMITS[from]*state.managers.length;
    const totalBought=state.managers.reduce((sum,m)=>sum+roleCount(m,from),0);
    $('roleTransitionStats').innerHTML=`<div><span>${escapeHtml(ROLE_PLURALS[from]||from)}</span><strong>${totalBought}/${totalNeeded}</strong><small>posti completati</small></div><div><span>PROSSIMA FASE</span><strong>${tr.final?'FINE ASTA':escapeHtml((ROLE_LABELS[tr.toRole]||tr.toRole).toUpperCase())}</strong><small>${tr.final?'riepilogo rose':'nuovo reparto'}</small></div>`;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
  }

  function hideRoleTransitionModal(){
    const modal=$('roleTransitionModal');
    if(!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
  }

  function beginRoleTransition(fromRole){
    const nextRole=state.currentRoleIndex<ROLE_ORDER.length ? ROLE_ORDER[state.currentRoleIndex] : null;
    state.roleTransition={fromRole,toRole:nextRole,final:!nextRole,createdAt:Date.now()};
    clearAuctionRuntimeTimers();
    saveState();
    renderAll();
    showRoleTransitionModal();
  }

  function continueAfterRoleTransition(){
    if(!state?.roleTransition) return;
    const wasFinal=!!state.roleTransition.final;
    state.roleTransition=null;
    hideRoleTransitionModal();
    if(wasFinal || state.currentRoleIndex>=ROLE_ORDER.length || allRostersComplete()){
      saveState();
      return finishAuction();
    }
    state.nominationIndex=nextNominatorIndex(state.nominationIndex);
    auditAndRepairState('role-transition-continue');
    saveState();
    renderAll();
    if(state.managers[state.nominationIndex].id!=='user') scheduleNomination();
  }

  function canOwn(manager, player) {
    return AuctionEngine.canOwn(manager,player,ROLE_LIMITS,TOTAL_SLOTS);
  }

  function maxLegalBid(manager, player) {
    const bundle=state?.auction?.arcade?.type==='bundle' && state.auction.playerId===player?.id ? playerMap.get(state.auction.arcade.secondPlayerId) : null;
    if(bundle) return Math.max(0,AuctionEngine.maxBundleBid(manager,[player,bundle],ROLE_LIMITS,TOTAL_SLOTS));
    return AuctionEngine.maxLegalBid(manager,player,ROLE_LIMITS,TOTAL_SLOTS);
  }

  // V3.2.35.56.99 · Valori asta dinamici per gennaio e stagioni successive.
  // La prima asta conserva esattamente il FVM originale. Quando un giocatore
  // evolve di OVR o arriva dal pool estero, viene invece confrontato con pari
  // ruolo/OVR del database iniziale per evitare top player valutati 1 credito.
  /* @domain auction-policy comparableAuctionFvm */

  /* @domain auction-policy careerMarketProfiles */

  /* @domain auction-policy buildMarketValueMap */

  /* @domain auction-policy refreshMarketValueMap */

  /* @domain auction-policy baseAuctionValue */

  /* @domain auction-policy roleSpend */

  /* @domain auction-policy targetFor */

  // V3.2.35.56.32 · Le CPU leggono il regolamento stagionale.
  // Il regolamento modifica leggermente le priorità, senza cancellare la personalità del manager.
  /* @domain auction-policy cpuLeagueRuleSensitivity */

  /* @domain auction-policy cpuLeagueRuleAuctionFactor */

  /* @domain auction-policy scarcityFactor */

  /* @domain auction-policy freePerSlot */

  /* @domain auction-policy wealthFactor */

  /* @domain auction-policy urgencyFactor */

  // V3.2.35.43 · Urgenza reparto leggibile e più aggressiva.
  /* @domain auction-policy cpuRoleUrgencyState */

  /* @domain auction-policy hasGoodRelations */

  /* @domain auction-policy isHotRival */

  /* @domain auction-policy needFactor */

  /* @domain auction-policy auctionReputationMultiplier */

  /* @domain auction-policy buildSeasonAuctionReputation */

  // V3.2.35.56.159 · Competenza progressiva, a budget e informazioni uguali.
  /* @domain auction-policy cpuAuctionCompetence */

  /* @domain auction-policy cpuAuctionRoleQuality */

  /* @domain auction-policy cpuAuctionStarterEstimate */

  /* @domain auction-policy cpuFootballAuctionFactor */

  /* @domain auction-policy cpuCoverageEnabled */

  /* @domain auction-policy cpuClubRoleHierarchy */

  /* @domain auction-policy cpuMainKeeper */

  /* @domain auction-policy cpuCoverInfo */

  /* @domain auction-policy cpuMissingKeeperCover */

  /* @domain auction-policy cpuKeeperReserve */

  /* @domain auction-policy cpuOpenRoleSpendingCap */

  /* @domain auction-policy cpuAuctionSpendingCap */

  /* @domain auction-policy strategicPlayerScore */

  /* @domain auction-policy strategicSlotInterest */

  /* @domain auction-policy cpuBundleLimit */

  /* @domain auction-policy cpuLimit */

  /* @domain auction-policy jumpSize */

  const RIVAL_TEAM_NAMES = [
    'Real Colizzati',
    'Pochi Maledetti e Subito',
    'Atletico Ma Non Troppo',
    'FC Scarsenal',
    'Real Madrink',
    'Birra e Fantacalcio',
    'Gli Sbronzi di Riace',
    'Longobarda FC',
    'Pippe United',
    'Deportivo La Carogna',
    'Borgorosso FC',
    'Dinamo Bidone',
    'AC Picchia',
    'FC Cazzari',
    'I Senza Voto',
    'Zero Tituli',
    'Gli Ultimi Saranno Primi',
    'Quelli del 6 Politico',
    'Pareggio FC',
    'La Banda del +3',
    'Gli Assistiti',
    'Cartellino Rosso FC',
    'Gli Ammoniti',
    'FC Fuori Forma'
  ];

  const RIVAL_COLOR_BASES = [
    ['#d83d55','#251721'], ['#3d7dff','#101a35'], ['#f0b436','#3b1e17'],
    ['#53b96f','#132d20'], ['#8b68d9','#251840'], ['#2fafd2','#112b35'],
    ['#e553a3','#34152a'], ['#f07a35','#3c1d12'], ['#c7c9d8','#242638'],
    ['#7fc65a','#1d3218'], ['#f2d64b','#403515'], ['#5b71df','#161d48'],
    ['#c85de0','#35183e'], ['#3fc6a0','#12342c'], ['#e85f5f','#3b1717'],
    ['#a7d34d','#2e3d14'], ['#6eb9ff','#17324d'], ['#d9925a','#3b2416'],
    ['#b9a0ff','#2b2342'], ['#f0a7c8','#3c2030'], ['#79d8d0','#163433'],
    ['#efc16b','#3b2c16'], ['#9ed36d','#25361a'], ['#df6f98','#3b1c29']
  ];

  function freshRivalIdentityPool(count=9){
    const names=shuffledCopy(RIVAL_TEAM_NAMES).slice(0,count);
    const colors=shuffledCopy(RIVAL_COLOR_BASES).slice(0,count);
    return names.map((team,i)=>({
      team,
      teamColors:{primary:colors[i][0],secondary:colors[i][1]}
    }));
  }

  /* @domain auction-policy cpuPersonalityPool */

  /* @domain auction-policy pickCpuPersonalities */

  /* @domain auction-policy freshManagers */

  /* @domain persistence-controller freshState */

  const {buildStorageSnapshot,compactLongCareerState}=window.FantaStorageSnapshot.create({compactMarketState:TransferEngine.compactMarketState});

  // La persistenza tecnica vive in save-manager.js; qui resta soltanto la
  // serializzazione dello stato specifica di Fantallenatore.
  let saveErrorToastAt=0;

  /* @domain persistence-controller showPersistenceError */

  const saveManager=window.FantaSaveManager.createSaveManager({
    env:window,
    legacyKey:SAVE_KEY,
    dbName:'fantallenatore_db',
    dbVersion:1,
    storeName:'saves',
    currentSlot:'current',
    backupSlot:'backup',
    encode:encodeSavePayload,
    onError:showPersistenceError,
    onWarning:(...args)=>console.warn(...args)
  });

  /* @domain persistence-controller saveState */

  /* @domain persistence-controller showToast */

  /* @domain persistence-controller saveWithFeedback */

  /* @domain persistence-controller stopGameRuntime */

  /* @domain persistence-controller migrateRarityHunterPurchase */

  /* @domain persistence-controller migrateCareerDivisionScale */

  /* @domain persistence-controller normalizeSavedState */

  /* @domain persistence-controller parseStoredPayload */

  /* @domain persistence-controller loadSaved */

  /* @domain persistence-controller clearSaved */

  /* @domain persistence-controller initializeSaveSystem */

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(el => {
      const active=el.id===id;
      el.classList.toggle('active',active);
      el.setAttribute('aria-hidden',String(!active));
    });
    const activeScreen=$(id);
    if(activeScreen){
      activeScreen.setAttribute('tabindex','-1');
      requestAnimationFrame(()=>activeScreen.focus({preventScroll:true}));
    }
    document.body.classList.toggle('is-main-menu',id==='setupScreen');
  }

  function managerName(m) { return m.id === 'user' ? m.team : m.team; }
  function clubName(id) { return clubMap.get(id)?.name || id; }
  function clubShort(id) { return clubMap.get(id)?.shortName || String(id||'').slice(0,3).toUpperCase(); }
  function clubColor(id) { return clubMap.get(id)?.colorClub?.primary || '#34445e'; }
  function maxBidNow(manager) {
    const left = slotsRemaining(manager);
    if (left <= 0) return 0;
    return Math.max(0, manager.budget - Math.max(0,left-1));
  }
  function roleSpendPct(manager, role) { return Math.round(roleSpend(manager,role) / INITIAL_BUDGET * 100); }

  /* @domain auction-views renderAll */

  /* @domain auction-views renderPhaseBanner */

  /* @domain auction-views renderRoster */

  /* @domain auction-views managerLiveAuctionBadges */

  /* @domain auction-views buildLeagueManagerCards */

  /* @domain auction-views renderManagers */

  /* @domain auction-views averageRosterValue */

  /* @domain auction-views renderTurn */

  /* @domain auction-views nominationSort */

  /* @domain auction-views openNominationModal */

  /* @domain auction-views closeNominationModal */

  /* @domain auction-views renderNominationClubFilter */

  /* @domain auction-views nominationCard */

  /* @domain auction-views auctionObserverActive */

  /* @domain auction-analysis-policy playerSeasonPotentialProfile */

  /* @domain auction-analysis-policy clubRoleStarterSlots */

  /* @domain auction-analysis-policy starterHierarchyBias */

  /* @domain auction-analysis-policy normalizedStarterProbability */

  /* @domain auction-analysis-policy auctionStarterProbability */

  /* @domain auction-analysis-policy auctionPlayerAnalysis */

  /* @domain auction-views renderPlayerResults */

  /* @domain auction-views renderAuctionRoomList */

  /* @domain auction-views auctionBundlePlayerMarkup */

  /* @domain auction-views renderAuction */

  /* @domain auction-controller addAuctionLog */

  /* @domain auction-clock auctionWindowMs */

  /* @domain auction-clock clearAuctionRuntimeTimers */

  /* @domain auction-clock renderCountdown */

  /* @domain auction-clock startCountdownTicker */

  /* @domain auction-clock resetBidClock */

  /* @domain auction-clock nextDelay */

  /* @domain auction-clock cpuNominationDelay */

  /* @domain auction-clock cpuReactionDelay */

  const ARCADE_AUCTION_LABELS={sealed:'RILANCIO AL BUIO',mystery:'PACCO SORPRESA',bundle:'DUE AL PREZZO DI UNO',hammer:'MARTELLO LAMPO',switch:'CAMBIO DI PROGRAMMA'};

  /* @domain auction-arcade-controller prepareArcadeAuction */

  /* @domain auction-arcade-controller renderArcadeBanner */

  /* @domain auction-arcade-controller showArcadeModal */

  /* @domain auction-arcade-controller resolveSealedAuction */

  /* @domain auction-arcade-controller handleArcadeAction */

  /* @domain auction-controller nominate */

  /* @domain auction-controller scheduleAdvance */

  /* @domain auction-controller adminOneShotScore */

  /* @domain auction-controller tryAdminOneShot */

  /* @domain auction-controller beginBidRound */

  /* @domain auction-controller currentSuddenInterestEffect */

  /* @domain auction-controller activateSuddenInterest */

  /* @domain auction-controller scheduleSuddenInterestEntry */

  /* @domain auction-controller scheduleCpuReactions */

  /* @domain auction-feedback flashBidder */

  const RIVAL_BID_REACTIONS = {
    bomber:['Per un bomber si può osare!','I gol costano, e io rilancio!'],
    ragioniere:['I conti tornano. Rilancio.','Il prezzo è ancora sostenibile.'],
    spendaccione:['Questo lo prendo io!','Il prezzo non mi spaventa!'],
    tirchio:['Solo al prezzo giusto.','Un credito in più, non uno spreco.'],
    moneyball:['I numeri dicono sì.','Il valore è ancora dalla mia parte.'],
    tifoso:['Ci credo fino in fondo!','Per i miei beniamini non mollo!'],
    collezionista:['Un top così deve essere mio.','Aggiungo un altro campione!'],
    esperto:['Mossa calcolata.','So esattamente quanto vale.'],
    pazzo:['Alziamo ancora!','Adesso facciamo sul serio!'],
    gambler:['Rischio tutto!','Vediamo chi ha più coraggio!'],
    stratega:['Era tutto previsto.','Questo rilancio fa parte del piano.'],
    rivale:['Non te lo lascio.','Se lo vuoi, dovrai sudartelo.']
  };

  /* @domain auction-feedback bidReaction */

  /* @domain auction-feedback bidCommentMoment */

  /* @domain auction-feedback showBidSpotlight */

  /* @domain auction-feedback showAwardAnimation */

  /* @domain auction-feedback hideAwardAnimation */

  const RIVAL_LOSS_REACTIONS = {
    bomber:['Dannazione, quello mi serviva.','Hai vinto questo duello.'],
    ragioniere:['Troppo caro. Te lo lascio.','A quel prezzo hai avuto più coraggio.'],
    spendaccione:['Me lo ricorderò.','La prossima non te la lascio.'],
    tirchio:['A quel prezzo è tutto tuo.','Troppo caro per i miei gusti.'],
    moneyball:['I numeri dicevano stop.','Hai spinto oltre il mio valore.'],
    tifoso:['Questa brucia.','Non volevo lasciartelo.'],
    collezionista:['Mi hai tolto un pezzo importante.','Bel colpo. Ma non è finita.'],
    esperto:['Duello perso. Si va avanti.','Hai letto bene l’asta.'],
    pazzo:['No! Lo volevo io!','Va bene, questa l’hai vinta tu.'],
    gambler:['Hai avuto più coraggio.','Stavolta il rischio ha pagato te.'],
    stratega:['Cambio piano.','Segnato. Adesso mi adatto.'],
    rivale:['Me lo ricorderò.','Uno a te. La prossima è mia.'],
    admin:['Valutazione aggiornata.','Hai vinto la chiamata. Il campionato è lungo.']
  };

  /* @domain auction-feedback awardLossReactionData */

  /* @domain auction-feedback showAwardLossReaction */

  /* @domain auction-controller cpuReact */

  /* @domain auction-controller advanceAuction */

  /* @domain auction-powers-controller ensureManagerTeamIdentityState */

  /* @domain auction-powers-controller ensureAuctionPowers */

  /* @domain auction-powers-controller auctionPowerMaxUses */
  /* @domain auction-powers-controller auctionPowerUses */
  /* @domain auction-powers-controller consumeAuctionPower */
  /* @domain auction-powers-controller canUseOneShot */

  /* @domain auction-powers-controller renderAuctionPowers */

  /* @domain auction-powers-controller auctionPowerTargets */

  /* @domain auction-powers-controller pauseForAuctionPower */
  /* @domain auction-powers-controller resumeAfterAuctionPower */

  /* @domain auction-powers-controller openAuctionPower */

  /* @domain auction-powers-controller useScoutPower */

  /* @domain auction-powers-controller closeAuctionPowerModal */

  /* @domain auction-powers-controller resolveAuctionPowerTarget */

  /* @domain auction-powers-controller useBluffPower */

  /* @domain auction-powers-controller useOneShotPower */

  /* @domain auction-controller autoUserLimit */

  /* @domain auction-controller userBid */

  /* @domain auction-controller fastForwardCpuAuctionAfterUserPass */

  /* @domain auction-controller userPass */

  /* @domain auction-controller userCannotBeatCurrentAuction */

  /* @domain auction-controller autoSkipUserIfCannotBid */

  /* @domain auction-controller awardAuction */

  /* @domain auction-controller nominationCallCount */

  /* @domain auction-controller registerNominationCall */

  /* @domain auction-controller nextNominatorIndex */

  /* @domain auction-controller allRostersComplete */

  /* @domain auction-controller scheduleNomination */

  /* @domain auction-controller cpuNominateCurrent */

  /* @domain auction-controller freeRoleNominationWeights */

  /* @domain auction-controller chooseNomination */

  /* @domain auction-controller finishAuction */

  /* @domain trade-roster-controller currentTradeWindow */

  /* @domain trade-roster-controller tradeOfferSelection */

  /* @domain trade-roster-controller tradeOfferValid */

  /* @domain trade-roster-controller tradeAvailabilityFactor */

  /* @domain trade-roster-controller tradeLineupStrength */

  /* @domain trade-roster-controller tradePlayerWorth */

  /* @domain trade-roster-controller tradeCpuDecision */

  /* @domain trade-roster-controller completeTrade */

  /* @domain trade-roster-controller tradeActiveKind */

  /* @domain trade-roster-controller tradeCreditsValue */

  /* @domain trade-roster-controller tradeSetSelection */

  /* @domain trade-roster-controller adjustTradeCredits */

  /* @domain trade-roster-controller tradeRosterPlayerMarkup */

  /* @domain trade-roster-controller tradePlayerCardMarkup */

  /* @domain trade-roster-controller tradeFilteredRoster */

  /* @domain trade-roster-controller renderTradeRosterChoices */

  /* @domain trade-roster-controller renderTradeWindow */

  /* @domain trade-roster-controller submitTradeOffer */

  /* @domain trade-roster-controller acceptTradeCounter */

  /* @domain trade-roster-controller finishTradeWindow */

  /* @domain trade-roster-controller leagueRoleAverage */

  /* @domain trade-roster-controller calibrationStatus */



  /* @domain trade-roster-controller compactLineupPlayerName */

  /* @domain trade-roster-controller bestTheoreticalLineup */

  /* @domain trade-roster-controller bestXIHtml */

  /* @domain trade-roster-controller wireLeagueRosterViewToggles */

  /* @domain trade-roster-controller buildFinalLeagueRosterCards */

  /* @domain trade-roster-controller renderSummary */

  /* @domain trade-roster-controller teamPreviewScore */


  function buildFantasySeasonSchedule(managers,totalRounds=FANTASY_SEASON_MATCHDAYS,existingRounds=[]){
    return buildSeasonSchedule(managers,totalRounds,existingRounds,careerHash);
  }

  function freshStandings(managers) {
    return buildFreshStandings(managers);
  }

  function freshSerieAStandings(){
    return freshClubStandings(window.FANTA_CLUBS||[]);
  }

  function emptyPlayerSeasonStat(player){
    return {
      playerId:String(player.id),name:player.name,club:player.club,role:player.role,
      appearances:0,starts:0,subApps:0,minutes:0,voteCount:0,voteSum:0,fantasySum:0,
      goals:0,assists:0,yellow:0,red:0,missedPenalty:0,savedPenalty:0,cleanSheets:0,
      bestVote:null,worstVote:null,recent:[],lastDay:0
    };
  }

  /* @domain career-market-controller ensurePlayerSeasonSystems */

  /* @domain career-market-controller playerSeasonStat */


  // V3.2.35.56.37 · Motore calciomercato Serie A.
  // La finestra viene pianificata dal motore puro; UI, listone fantasy e mercato
  // di riparazione verranno collegati nei passaggi successivi.
  /* @domain career-market-controller ensureSerieATransferMarket */

  /* @domain career-market-controller syncSerieATransferWorld */

  /* @domain career-market-controller serieATransferStatsSnapshot */

  /* @domain career-market-controller ensureMisterJunior */

  /* @domain career-market-controller addMisterJuniorToWinterPlan */

  /* @domain career-market-controller generateSerieATransferWindowPlan */

  /* @domain career-market-controller registerSerieATransferWindowPlan */

  /* @domain career-market-controller completedSeasonUserPosition */

  /* @domain career-market-controller careerSeasonOutcome */

  /* @domain career-market-controller completedUserSeasonRecap */

  /* @domain career-market-controller recordUserAuctionPick */

  /* @domain career-market-controller finalizeCompletedSeasonOvrBases */

  /* @domain career-market-controller ensureNextSeasonFlow */

  /* @domain career-market-controller nextSeasonSummerPlan */

  /* @domain career-market-controller archiveCompletedSeasonIfNeeded */

  /* @domain career-market-controller renderNextSeasonFlow */

  /* @domain career-market-controller simulateNextSeasonSummerMarket */

  /* @domain career-market-controller renderSeasonKeeperChoice */

  /* @domain career-market-controller applySeasonKeeper */

  /* @domain career-market-controller buildNextSeasonCareerDraft */

  /* @domain career-market-controller openNextSeasonAuctionSetup */

  /* @domain career-market-controller handleNextSeasonPrimaryAction */

  const WINTER_TRANSFER_TRIGGER_MATCHDAY=19;
  const WINTER_AUCTION_BASE_CREDITS=50;
  let winterMarketSimulationRunning=false;
  let winterGuaranteedSaleMode=false;

  /* @domain career-market-controller winterExpectedWindowId */

  /* @domain career-market-controller winterMarketPlan */

  /* @domain career-market-controller createWinterBudgetLedger */

  /* @domain career-market-controller winterLedgerFor */

  /* @domain career-market-controller expectedWinterBudget */

  /* @domain career-market-controller ensureWinterMarketFlow */

  /* @domain career-market-controller activateWinterTransferWindowIfNeeded */

  /* @domain career-market-controller winterTransferOperationMarkup */

  /* @domain career-market-controller settleWinterMarketFinances */

  /* @domain career-market-controller simulateWinterMarket */

  /* @domain career-market-controller renderWinterMarketIntro */

  /* @domain career-market-controller renderWinterMarketSummary */

  /* @domain career-market-controller cpuWinterReleaseScore */

  /* @domain career-market-controller releaseWinterPlayer */

  /* @domain career-market-controller processCpuWinterReleases */

  /* @domain career-market-controller openWinterReleases */

  /* @domain career-market-controller useGuaranteedWinterSale */

  /* @domain career-market-controller toggleGuaranteedWinterSaleMode */

  /* @domain career-market-controller renderWinterReleaseScreen */

  /* @domain career-market-controller toggleWinterRelease */

  /* @domain career-market-controller confirmWinterReleases */

  /* @domain career-market-controller startWinterRepairAuction */

  /* @domain career-market-controller routeWinterMarketFlow */

  /* @domain career-market-controller showPendingWinterTransferSummary */
  /* @domain career-market-controller closeWinterTransferSummary */

  /* @domain career-market-controller playerSeasonStatus */

  /* @domain career-market-controller playerStatusForDay */

  /* @domain career-market-controller playerFormMetrics */

  /* @domain career-market-controller qualitativeFormLabel */

  /* @domain career-market-controller visibleFormLabel */

  /* @domain career-market-controller visibleNewsDetail */

  /* @domain career-market-controller playerAvailabilityText */

  /* @domain career-market-controller sortedSerieAStandings */

  /* @domain career-market-controller updateSerieAStandingsFromStoredMatches */

  /* @domain career-market-controller seasonPlayerOwner */

  function ensureSeasonState() {
    if (!state) return null;
    if (!state.season || !state.season.started) return null;
    if (!Array.isArray(state.season.schedule) || state.season.schedule.length===0) {
      state.season.schedule = buildFantasySeasonSchedule(state.managers);
    } else if (state.season.schedule.length!==FANTASY_SEASON_MATCHDAYS) {
      // Migrazione: conserva tutte le giornate già presenti/giocate e completa il calendario fino a 38.
      state.season.schedule = buildFantasySeasonSchedule(state.managers,FANTASY_SEASON_MATCHDAYS,state.season.schedule);
    }
    if (!Array.isArray(state.season.standings) || state.season.standings.length!==state.managers.length) {
      state.season.standings = freshStandings(state.managers);
    }
    state.season.currentMatchday = clamp(Number(state.season.currentMatchday||1),1,FANTASY_SEASON_MATCHDAYS);
    if (!state.season.matchdayResults || typeof state.season.matchdayResults !== 'object') state.season.matchdayResults = {};

    // V2.7.2 migration: ricostruisce i Fantapunti totali dai risultati già giocati
    // per rendere compatibili anche i salvataggi delle versioni precedenti.
    const missingFantasyTotals = state.season.standings.some(s=>!Number.isFinite(Number(s.fantasyPoints)));
    if (missingFantasyTotals) {
      state.season.standings.forEach(s=>{ s.fantasyPoints=0; });
      Object.values(state.season.matchdayResults).forEach(dayResult=>{
        (dayResult?.matches||[]).forEach(m=>{
          const h=state.season.standings.find(s=>s.managerId===m.homeId);
          const a=state.season.standings.find(s=>s.managerId===m.awayId);
          if(h) h.fantasyPoints+=Number(m.homeFantasy||0);
          if(a) a.fantasyPoints+=Number(m.awayFantasy||0);
        });
      });
    }

    if (!state.season.lineups || typeof state.season.lineups !== 'object') state.season.lineups = {};
    if (!state.season.dashboardReadyDays || typeof state.season.dashboardReadyDays !== 'object') state.season.dashboardReadyDays = {};
    if (!state.season.matchdayFlow || typeof state.season.matchdayFlow !== 'object') state.season.matchdayFlow = {};
    if (!Array.isArray(state.season.newsFeed)) state.season.newsFeed = [];
    if (!state.season.newsGeneratedDays || typeof state.season.newsGeneratedDays !== 'object') state.season.newsGeneratedDays = {};
    if (!state.season.newsMeta || typeof state.season.newsMeta !== 'object') state.season.newsMeta = {};
    if (!Array.isArray(state.season.serieASchedule) || state.season.serieASchedule.length !== 38) state.season.serieASchedule = buildSerieASchedule();
    if (!state.season.serieAResults || typeof state.season.serieAResults !== 'object') state.season.serieAResults = {};
    if (state.season.pendingBigMatch === undefined) state.season.pendingBigMatch = null;
    if (!state.season.dayPhase) state.season.dayPhase = 'ready';
    if (!state.season.formationChoices || typeof state.season.formationChoices !== 'object') state.season.formationChoices = {};
    if (!state.season.adminRules || typeof state.season.adminRules !== 'object') state.season.adminRules = {};
    if (!state.season.opponentMalusEvents || typeof state.season.opponentMalusEvents !== 'object') state.season.opponentMalusEvents = {};
    if(!state.season.fantaclassificaActive){
      const activatedEntry=Object.values(state.season.adminRules).find(entry=>entry?.resolved && entry?.selectedOption?.effect?.ruleId==='fantaclassifica');
      if(activatedEntry){
        state.season.fantaclassificaActive=true;
        state.season.fantaclassificaActivatedDay=Number(activatedEntry.day||activatedEntry.selectedOption?.effect?.activatedDay||1);
      }
    }
    if (!state.season.shopPurchases || typeof state.season.shopPurchases !== 'object') state.season.shopPurchases = {};
    if (!state.season.consumables || typeof state.season.consumables !== 'object') state.season.consumables = {inventory:{},effects:{},usageHistory:[],purchaseHistory:[]};
    if (!state.season.consumables.inventory || typeof state.season.consumables.inventory !== 'object') state.season.consumables.inventory={};
    if (!state.season.consumables.effects || typeof state.season.consumables.effects !== 'object') state.season.consumables.effects={};
    if (!Array.isArray(state.season.consumables.usageHistory)) state.season.consumables.usageHistory=[];
    if (!Array.isArray(state.season.consumables.purchaseHistory)) state.season.consumables.purchaseHistory=[];
    if(state.season.sponsor && !state.season.sponsor.winRewards) state.season.sponsor.winRewards={};
    if (!state.season.playerOvrDevelopment || typeof state.season.playerOvrDevelopment !== 'object') state.season.playerOvrDevelopment = {};
    if (!Array.isArray(state.season.playerDevelopmentEvents)) state.season.playerDevelopmentEvents = [];
    ensureSocialState(state.season);
    if (!state.season.assistantCoachLineup || typeof state.season.assistantCoachLineup !== 'object') state.season.assistantCoachLineup = {enabled:false,formation:null,starters:{},bench:[],updatedAt:0,lastSourceDay:0};
    ensureCareerEconomy();
    ensurePlayerSeasonSystems(state.season);
    return state.season;
  }

  function startLeague() {
    if (!state || !state.completed) return;
    if(currentTradeWindow('summer').stage!=='completed') return renderTradeWindow('summer');
    const sponsorChoice=currentSponsorChoice();
    if(!state.season?.started && (!sponsorChoice || CareerEngine.selectedSponsorChoices(state).length<(Number(state.sponsorSlots)===2?2:1))){
      const sponsorPanel=$('sponsorSelectionPanel');
      sponsorPanel?.scrollIntoView({behavior:'smooth',block:'start'});
      window.setTimeout(()=>{
        const firstCard=document.querySelector('#sponsorCards [data-sponsor-card]');
        firstCard?.focus({preventScroll:true});
      },420);
      return;
    }
    const academyChoice=CareerEngine.selectedSponsorChoices(state).find(choice=>choice.id==='academy');
    if(!state.season?.started && academyChoice){
      const chosenId=String(academyChoice.playerId||'');
      const player=state.managers?.[0]?.roster?.find(p=>String(p.id)===chosenId && Number(p.ovr||0)<=97);
      if(!player){showToast('Ala Romelu: scegli un giocatore prima di iniziare il campionato.',true);return;}
    }
    if (!state.season?.started) {
      state.season = {
        started:true,
        createdAt:Date.now(),
        currentMatchday:1,
        schedule:buildFantasySeasonSchedule(state.managers),
        standings:freshStandings(state.managers),
        lineups:{},
        dashboardReadyDays:{},
        matchdayFlow:{},
        newsFeed:[],
        newsGeneratedDays:{},
        newsMeta:{},
        matchdayResults:{},
        serieASchedule:buildSerieASchedule(),
        serieAResults:{},
        serieAStandings:freshSerieAStandings(),
        playerSeasonStats:{},
        playerStatus:{},
        simDataUpdatedDays:{},
        formationChoices:{},
        adminRules:{},
        opponentMalusEvents:{},
        fantaclassificaActive:false,
        fantaclassificaActivatedDay:0,
        shopPurchases:{},
        consumables:{inventory:{...(state.carryoverConsumables||{})},effects:{},usageHistory:[],purchaseHistory:[]},
        sponsor:seasonSponsorFromChoice(sponsorChoice),
        playerOvrDevelopment:{},
        playerDevelopmentEvents:[],
        social:{conversations:{},motivationByDay:{},activity:[]},
        assistantCoachLineup:{enabled:false,formation:null,starters:{},bench:[],updatedAt:0,lastSourceDay:0},
        pendingBigMatch:null,
        dayPhase:'ready'
      };
      const immediateSponsorBonus=grantImmediateSponsorBonus(state.season);
      const academySponsor=CareerEngine.findSeasonSponsor(state.season,'academy');
      if(academySponsor){
        const player=state.managers[0].roster.find(p=>String(p.id)===String(academySponsor.playerId));
        if(player){
          const growth=applyPlayerOvrChange(player,2,1,'Ala Romelu: crescita garantita','sponsor_academy');
          academySponsor.academyGrowthGranted=!!growth;
          academySponsor.academyPlayerName=player.name;
        }
      }
      if(Number(state.career?.nextSponsorSeason)===Number(state.career?.seasonNumber)) delete state.career.nextSponsorSeason;
      delete state.carryoverConsumables;
      saveState();
      if(immediateSponsorBonus) showToast(`Sponsor: +${immediateSponsorBonus} € immediati.`);
    }
    renderSeasonDashboard();
  }


  function ensureMatchdayFlowEntry(season,day){
    if(!season || !day) return null;
    if(!season.matchdayFlow || typeof season.matchdayFlow!=='object') season.matchdayFlow={};
    const key=String(day);
    let entry=season.matchdayFlow[key];
    if(!entry || typeof entry!=='object'){
      let phase='lineup';
      if(season.matchdayResults?.[key]) phase='completed';
      else if(season.pendingBigMatch?.day===day || season.activeLive?.day===day) phase='live';
      else {
        if(hasPendingMatchdayEvent(day,season)) phase='event_pending';
        else if(season.dashboardReadyDays?.[key]) phase='match_ready';
      }
      entry={day,phase,updatedAt:Date.now()};
      season.matchdayFlow[key]=entry;
    }
    if(season.matchdayResults?.[key]) entry.phase='completed';
    else if(season.pendingBigMatch?.day===day || season.activeLive?.day===day) entry.phase='live';
    else if(hasPendingMatchdayEvent(day,season)) entry.phase='event_pending';
    return entry;
  }

  function setMatchdayFlowPhase(season,day,phase,extra={}){
    const entry=ensureMatchdayFlowEntry(season,day);
    if(!entry) return null;
    entry.phase=phase;
    entry.updatedAt=Date.now();
    Object.assign(entry,extra||{});
    // Compatibilità con i salvataggi V3.2.7: questa mappa resta sincronizzata,
    // ma la fonte autorevole dalla V3.2.8 è matchdayFlow.
    if(!season.dashboardReadyDays || typeof season.dashboardReadyDays!=='object') season.dashboardReadyDays={};
    season.dashboardReadyDays[String(day)]=['match_ready','live','completed'].includes(phase);
    return entry;
  }

  function currentMatchdayFlow(season=ensureSeasonState()){
    return season ? ensureMatchdayFlowEntry(season,season.currentMatchday||1) : null;
  }

  function fantaclassificaIsActive(season=state?.season){
    return !!season?.fantaclassificaActive;
  }

  function sortFantasyLeagueStandings(rows,season=state?.season){
    if(!fantaclassificaIsActive(season)) return sortStandings(rows);
    return (rows||[]).slice().sort((a,b)=>{
      const fantasyDelta=Number(b.fantasyPoints||0)-Number(a.fantasyPoints||0);
      if(Math.abs(fantasyDelta)>.0001) return fantasyDelta;
      const gfDelta=Number(b.gf||0)-Number(a.gf||0);
      if(gfDelta) return gfDelta;
      const gdA=Number(a.gf||0)-Number(a.ga||0), gdB=Number(b.gf||0)-Number(b.ga||0);
      if(gdB!==gdA) return gdB-gdA;
      return Number(a.seed||0)-Number(b.seed||0);
    });
  }

  /* @domain league-views sortedStandings */


  let leagueStandingsSort={key:'position',direction:'asc'};
  const LEAGUE_STANDINGS_DEFAULT_DIRECTION={
    position:'asc',team:'asc',played:'desc',points:'desc',fantasyPoints:'desc',
    wins:'desc',draws:'desc',losses:'asc',gf:'desc',ga:'asc',gd:'desc'
  };

  /* @domain league-views sortedFullStandingsForView */

  /* @domain league-views renderFullStandingsSortState */

  /* @domain league-views setLeagueStandingsSort */

  /* @domain league-views managerById */

  /* @domain league-views currentUserFixture */


  /* @domain league-views userOpponentIdForDay */

  /* @domain league-views cpuFormationForDay */

  /* @domain league-views pendingBigMatchContext */

  /* @domain league-views pendingPartialPerformance */

  /* @domain league-views pendingPartialFantasySnapshot */

  /* @domain league-views pendingPartialPlayerInfo */

  /* @domain league-views seasonPlayerStatCards */

  /* @domain league-views renderSeasonPlayerModal */

  /* @domain league-views closeSeasonPlayerModal */

  /* @domain league-views wireSeasonPlayerButtons */

  /* @domain league-views renderLeagueNavActive */

  /* @domain league-views standardizeLeagueShells */

  /* @domain league-views fullStandingsRowsHtml */

  /* @domain league-views fullScheduleHtml */

  /* @domain league-views renderCalendarDayResults */

  /* @domain league-views leagueFullRosterHtml */

  /* @domain league-views openLeagueRosterModal */

  /* @domain league-views closeLeagueRosterModal */

  /* @domain league-views buildLeagueTopXICards */

  /* @domain league-views wireLeagueTopXICards */

  /* @domain league-views renderLeagueRostersScreen */

  /* @domain league-views renderLeagueCalendarScreen */

  /* @domain league-views renderCareerHonours */

  /* @domain league-views openCareerHonours */

  /* @domain league-views renderLeagueStandingsScreen */

  /* @domain shop-controller ensureCareerEconomy */

  /* @domain shop-controller sponsorVisualAsset */

  /* @domain shop-controller sponsorVisualBrand */

  /* @domain shop-controller currentSponsorChoice */

  /* @domain shop-controller currentSponsorOffers */

  /* @domain shop-controller selectSeasonSponsor */

  /* @domain shop-controller selectAcademySponsorPlayer */

  /* @domain shop-controller renderSponsorSelection */

  /* @domain shop-controller seasonSponsorFromChoice */

  /* @domain shop-controller sponsorFreeSubscriptionAvailable */

  /* @domain shop-controller sponsorCanMakeShopItemFree */


  /* @domain shop-controller sortStandingsSnapshot */

  /* @domain shop-controller grantImmediateSponsorBonus */

  /* @domain shop-controller grantBigMatchSponsorReward */

  /* @domain shop-controller grantStreakSponsorReward */

  /* @domain shop-controller grantWinSponsorReward */

  /* @domain shop-controller grantFutureAuctionSponsorBonus */

  /* @domain shop-controller ensureSeasonShop */

  /* @domain shop-controller shopItemActive */

  /* @domain shop-controller careerEuros */

  /* @domain shop-controller careerFantapoints */

  /* @domain shop-controller ensureConsumableState */

  /* @domain shop-controller consumableQuantity */

  /* @domain shop-controller consumableDayEffect */

  /* @domain shop-controller addConsumable */

  /* @domain shop-controller consumeConsumable */

  /* @domain shop-controller totalConsumablesOwned */

  /* @domain shop-controller shopPurchaseOrigin */

  /* @domain shop-controller animateShopPurchase */

  /* @domain shop-controller buyConsumableItem */

  /* @domain shop-controller grantMatchdayFantapoints */

  /* @domain shop-controller careerDivisionLabel */

  /* @domain shop-controller careerPromotionNote */

  /* @domain shop-controller careerSeasonLabel */

  /* @domain shop-controller renderCareerWallets */

  /* @domain shop-controller applyGameConfiguration */

  /* @domain shop-controller formationEventChance */

  /* @domain shop-controller seasonShockChance */

  /* @domain shop-controller formationChoiceRarity */

  /* @domain shop-controller formationChoiceRarityLabel */

  /* @domain shop-controller formationRarityWeights */

  /* @domain shop-controller formationRaritiesUnlocked */

  /* @domain shop-controller specialFormationEventsUnlocked */

  /* @domain shop-controller deterministicFormationTemplateOrder */

  /* @domain shop-controller buyShopItem */

  let shopCategoryFilter='all';
  let shopPageIndex=0;

  /* @domain shop-controller shopItemsPerPage */

  /* @domain shop-controller shopItemEffectLine */

  /* @domain shop-controller shopCardHtml */

  /* @domain shop-controller closeShopProductModal */

  /* @domain shop-controller openShopProductModal */

  /* @domain shop-controller renderShopItems */

  /* @domain assistant-policy estimatedStarterProbability */

  /* @domain assistant-policy scoutStarterBadge */

  /* @domain assistant-policy assistantAutoLineupCapabilities */

  /* @domain assistant-policy assistantBasePlayerValue */

  /* @domain assistant-policy advancedAutoLineupValue */

  /* @domain assistant-policy assistantAutoLineupAnalysisHtml */

  /* @domain assistant-policy buildAdvancedAutoLineup */

  /* @domain assistant-policy bestAdvancedFormation */

  function grantSeasonPrizeIfNeeded(season=ensureSeasonState()){
    const career=ensureCareerEconomy();
    const standings=sortedStandings();
    const previousGranted=!!season?.careerPrize?.granted;
    const prize=CareerEngine.grantSeasonPrize(career,season,standings);
    if(prize&&!previousGranted) renderCareerWallets();
    return prize;
  }

  /* @domain datacenter-views evolutionPlayerData */

  /* @domain datacenter-views evolutionPotentialClass */

  /* @domain datacenter-views evolutionHighlightHtml */

  /* @domain datacenter-views evolutionPlayerRowHtml */

  /* @domain datacenter-views dataCenterContext */

  /* @domain datacenter-views dataCenterPremiumHtml */

  /* @domain datacenter-views renderDataCenterOverviewPanel */

  /* @domain datacenter-views dataCenterPlayerRowHtml */

  /* @domain datacenter-views renderDataCenterPlayersPanel */

  /* @domain datacenter-views renderDataCenterEvolutionPanel */

  /* @domain datacenter-views setDataCenterTab */

  /* @domain datacenter-views renderLeagueDataCenterScreen */

  /* @domain datacenter-views renderLeagueEvolutionScreen */


  /* @domain social-controller socialOwnedPlayers */

  /* @domain social-controller socialHandle */

  /* @domain social-controller socialPersonality */

  /* @domain social-controller ensureSocialState */

  /* @domain social-controller socialConversation */

  /* @domain social-controller socialMotivationForPlayer */

  /* @domain social-controller socialRelationLabel */

  /* @domain social-controller socialMessageTone */

  /* @domain social-controller socialReactionData */

  /* @domain social-controller socialReplyText */

  /* @domain social-controller socialRecordMotivation */

  /* @domain social-controller socialSendMessage */

  /* @domain social-controller socialPlayerAvatarHtml */

  /* @domain social-controller socialConversationPreview */

  /* @domain social-controller socialStoryHtml */

  /* @domain social-controller socialConversationRowHtml */

  /* @domain social-controller socialMessageHtml */

  /* @domain social-controller renderSocialChat */

  /* @domain social-controller renderLeagueSocialScreen */

  /* @domain social-controller sendCurrentSocialMessage */



  let shopResizeTimer=0;
  window.addEventListener('resize',()=>{
    clearTimeout(shopResizeTimer);
    shopResizeTimer=setTimeout(()=>{
      if($('leagueShopScreen')?.classList.contains('active')){
        shopPageIndex=0;
        renderShopItems();
      }
    },120);
  });

  /* @domain social-controller renderLeagueShopScreen */

  /* @domain expert-controller expertStarterLabel */

  /* @domain expert-controller expertAdviceAnalysis */

  /* @domain expert-controller expertAdviceScore */

  /* @domain expert-controller expertAdviceSentence */

  // La sorpresa nasce prima del consiglio: l'esperto puo coglierla oppure no.
  // Il sorteggio e lo stato sono separati dalle prestazioni e rimangono identici
  // ricaricando il salvataggio o aprendo piu volte la dashboard.
  const EXPERT_IDS=['professore','fantabomber','moneystats','intuitivo','visionario','sibilla','glitch'];
  const INTUITION_EXPERTS={
    intuitivo:{kinds:['starter','vote'],accuracy:.60,proAccuracy:.88},
    visionario:{kinds:['goal','assist'],accuracy:.46,proAccuracy:.78},
    sibilla:{kinds:['starter','vote'],accuracy:.69,proAccuracy:.92},
    glitch:{kinds:['goal','assist'],accuracy:.38,proAccuracy:.72}
  };
  const INTUITION_KIND_LABEL={starter:'TITOLARITÀ',vote:'VOTO',goal:'GOL',assist:'ASSIST'};

  /* @domain expert-controller expertPrecisionActive */

  /* @domain expert-controller expertPrecisionScoreBonus */

  /* @domain expert-controller expertDayState */

  /* @domain expert-controller intuitionExpertSentence */

  /* @domain expert-controller expertReasonParagraphs */

  let expertStoryState=null;

  /* @domain expert-controller renderExpertStory */

  /* @domain expert-controller changeExpertStoryStep */

  /* @domain expert-controller closeExpertReason */

  /* @domain expert-controller openExpertReason */

  /* @domain expert-controller renderExpertAdvice */

  /* @domain dashboard-controller hubNewsTypeLabel */


  /* @domain dashboard-controller hubNewsTheme */

  /* @domain dashboard-controller ensureSeasonNewsState */

  /* @domain dashboard-controller addSeasonNews */

  /* @domain dashboard-controller fantasyResultForManager */

  /* @domain dashboard-controller recentManagerRun */

  /* @domain dashboard-controller managerStreak */

  /* @domain dashboard-controller newsFixtureForDay */

  /* @domain dashboard-controller generatePreMatchNews */

  /* @domain dashboard-controller generatePostMatchNews */

  /* @domain dashboard-controller ensureSeasonNewsForCurrentState */

  /* @domain dashboard-controller buildHubNews */

  /* @domain dashboard-controller newsReliabilityLabel */


  /* @domain dashboard-controller seasonNewsPlayerAvatarHtml */

  /* @domain dashboard-controller renderSeasonNewsArchive */

  /* @domain dashboard-controller openSeasonNewsArchive */

  /* @domain dashboard-controller closeSeasonNewsArchive */

  /* @domain dashboard-controller stopHubNewsCarousel */

  /* @domain dashboard-controller setHubNewsSlide */

  /* @domain dashboard-controller startHubNewsCarousel */

  /* @domain dashboard-controller renderHubNews */

  /* @domain dashboard-controller managerRecentLeagueResults */

  /* @domain dashboard-controller deterministicCpuFormation */

  /* @domain dashboard-controller managerMostUsedFormation */

  /* @domain dashboard-controller matchCenterProbablePlayers */

  /* @domain dashboard-controller managerRoleData */

  /* @domain dashboard-controller matchCenterKeyPlayer */

  /* @domain dashboard-controller matchCenterRecommendedFormation */

  /* @domain dashboard-controller renderMatchCenter */

  /* @domain dashboard-controller openMatchCenter */

  /* @domain dashboard-controller closeMatchCenter */

  /* @domain dashboard-controller renderSeasonDashboard */


  let opponentMalusNoticeDay=null;
  let opponentMalusNoticeFocus=null;

  /* @domain dashboard-controller renderOpponentMalusBanner */

  /* @domain dashboard-controller showOpponentMalusNotice */

  /* @domain dashboard-controller closeOpponentMalusNotice */

  let weekendArrivalLoading=false;

  /* @domain dashboard-controller showWeekendArrivalLoading */

  /* @domain matchday-controller continueMatchdayFromLineup */

  /* @domain matchday-controller handleDashboardPrimaryAction */

  /* @domain lineup-controller lineupDayKey */

  /* @domain lineup-controller ensureLineupDayStore */

  /* @domain lineup-controller lineupSlots */

  /* @domain lineup-controller lineupRequiredStarters */

  /* @domain lineup-controller lineupPlayerValue */

  /* @domain lineup-controller cpuLeagueRuleLineupValue */

  /* @domain lineup-controller cpuLeagueFormationBias */

  /* @domain lineup-controller lineupCountsForFormation */

  /* @domain lineup-controller normalizeSavedLineup */

  /* @domain lineup-controller syncDraftBenchOrder */

  /* @domain lineup-controller draftBenchPlayers */

  /* @domain lineup-controller moveBenchPlayer */

  /* @domain matchday-events-controller formationChoiceCategoryLabel */

  /* @domain matchday-events-controller formationChoiceCategoryClass */

  /* @domain matchday-events-controller formationChoiceDayState */

  /* @domain matchday-events-controller adminRuleDayState */

  /* @domain matchday-events-controller activeAdminRule */

  /* @domain matchday-events-controller activeAdminRuleEffect */

  /* @domain matchday-events-controller hasPendingMatchdayEvent */

  /* @domain matchday-events-controller nextPendingMatchdayEvent */

  /* @domain matchday-events-controller hashPick */

  /* @domain matchday-events-controller sortedByChoiceHash */

  const SERIEA_DERBY_PAIRS = new Set([
    'inter|milan','lazio|roma','juventus|torino'
  ]);

  /* @domain matchday-events-controller isDerbyFixtureForPlayer */

  /* @domain matchday-events-controller formationChoiceContextForManagers */

  /* @domain matchday-events-controller fantasyAppearanceRate */

  /* @domain matchday-events-controller formationChoiceContext */

  /* @domain matchday-events-controller specialRivalManager */

  /* @domain matchday-events-controller opponentMalusDayState */

  /* @domain matchday-events-controller opponentMalusChanceForManager */

  /* @domain matchday-events-controller generateOpponentMalusOption */

  const opponentMalusRollsInProgress=new Set();

  /* @domain matchday-events-controller ensureOpponentMalusRoll */

  /* @domain matchday-events-controller activeOpponentMalus */

  /* @domain matchday-events-controller generateFormationChoiceOptions */

  /* @domain matchday-events-controller sanitizeLockedFormationChoiceEntry */

  const ADMIN_RULE_RARITY_PROFILES = Object.freeze({
    4:Object.freeze({common:1.00,rare:0,epic:0}),
    3:Object.freeze({common:.70,rare:.25,epic:.05}),
    2:Object.freeze({common:.50,rare:.35,epic:.15}),
    1:Object.freeze({common:.50,rare:.35,epic:.15})
  });

  /* @domain matchday-events-controller adminRuleRarityProfile */

  /* @domain matchday-events-controller generateAdminRuleOption */

  /* @domain matchday-events-controller ensureAdminRuleRoll */

  /* @domain matchday-events-controller ensureAllPreMatchEventRolls */

  /* @domain matchday-events-controller forcedFormationRuleForDay */

  /* @domain matchday-events-controller adminForcedStarterForManager */

  /* @domain matchday-events-controller adminBenchableTopPlayer */

  /* @domain matchday-events-controller previousUnusedBenchEligibleIds */

  /* @domain matchday-events-controller adminBlockedStarterForManager */

  /* @domain matchday-events-controller adminFaithReserveEligibleIds */

  /* @domain matchday-events-controller adminWildcardStartingSlotLimit */

  /* @domain matchday-events-controller wildcardSlotCompatible */

  /* @domain matchday-events-controller lineupOutOfRoleEntries */

  /* @domain matchday-events-controller canPlacePlayerInLineupSlot */

  /* @domain matchday-events-controller enforceStarterInLineup */

  /* @domain matchday-events-controller enforceAdminLastReserve */

  /* @domain matchday-events-controller enforcePlayerBenchedInLineup */

  /* @domain matchday-events-controller enforceFaithReserveStarterInLineup */

  /* @domain matchday-events-controller lineupTurnoverDeltaFromPrevious */

  /* @domain matchday-events-controller validateAdminRuleLineup */

  /* @domain matchday-events-controller adminRuleNeedsLineupReconfirm */

  /* @domain matchday-events-controller syncFlowAfterPreMatchResolution */

  /* @domain matchday-events-controller adminRuleCover */

  /* @domain matchday-events-controller ensureForcedFormationDraft */

  /* @domain matchday-events-controller ensureFormationChoiceRoll */

  /* @domain matchday-events-controller activeFormationChoice */

  /* @domain matchday-events-controller tacticForManager */

  /* @domain matchday-events-controller riskAdjustmentForPerformance */

  /* @domain matchday-events-controller fantasyRuleForDay */

  /* @domain matchday-events-controller starterReportActive */

  /* @domain matchday-events-controller specialTrainingPlayerIds */

  /* @domain matchday-events-controller specialTrainingPlayerId */

  /* @domain matchday-events-controller specialTrainingUsedForPlayer */

  /* @domain matchday-events-controller blockedOpponentPlayerIds */

  /* @domain matchday-events-controller blockedOpponentPlayerId */

  /* @domain matchday-events-controller worldPlayerModifier */

  /* @domain matchday-events-controller formationPlayerModifier */

  /* @domain matchday-events-controller formationChoiceCover */

  /* @domain matchday-events-controller rerollFormationChoiceCards */

  /* @domain matchday-events-controller rerollAdminRuleCard */

  /* @domain matchday-events-controller renderFormationChoiceModal */

  /* @domain matchday-events-controller resolveSeasonShock */

  /* @domain matchday-events-controller openNextSeasonEvent */

  /* @domain matchday-events-controller hideFormationChoiceModal */

  /* @domain matchday-events-controller renderAdminRuleModal */

  /* @domain matchday-events-controller hideAdminRuleModal */

  /* @domain matchday-events-controller minimizeMatchdayEvent */

  /* @domain matchday-events-controller restoreMatchdayEvent */

  /* @domain matchday-events-controller resolveAdminRule */

  /* @domain matchday-events-controller resolveFormationChoice */

  /* @domain matchday-events-controller requestOpenLineup */

  /* @domain lineup-controller openLineupScreen */

  /* @domain lineup-controller draftStarterIds */

  /* @domain lineup-controller draftSlotForPlayer */

  /* @domain lineup-controller draftPlayerById */

  /* @domain lineup-controller setDraftFormation */

  /* @domain lineup-controller selectLineupPlayer */

  /* @domain lineup-controller nominateLineupCaptain */

  /* @domain lineup-controller placePlayerInSlot */

  /* @domain lineup-controller openLineupSlotPicker */

  /* @domain lineup-controller placeSelectedInSlot */

  /* @domain lineup-controller benchSelectedPlayer */

  /* @domain lineup-controller clearLineupDragVisuals */

  /* @domain lineup-controller beginLineupDrag */

  /* @domain lineup-controller endLineupDrag */

  /* @domain lineup-controller bindLineupDragDrop */

  /* @domain lineup-controller clearDraftLineup */

  /* @domain lineup-controller bestPlayersForRole */

  /* @domain lineup-controller buildAutoLineup */

  /* @domain lineup-controller formationCpuBias */

  /* @domain lineup-controller chooseCpuFormation */

  /* @domain lineup-controller tacticalExpectedPlayerPoints */

  /* @domain lineup-controller tacticalExpectedLineupPoints */

  /* @domain lineup-controller adaptTacticalProLineup */

  /* @domain lineup-controller autoFillUserLineup */

  /* @domain lineup-controller ensureAssistantCoachLineup */

  /* @domain lineup-controller assistantCoachCarryEnabled */

  /* @domain lineup-controller saveAssistantCoachTemplateFromDraft */

  /* @domain lineup-controller toggleAssistantCoachCarry */

  /* @domain lineup-controller assistantCoachTemplateForDay */

  /* @domain lineup-controller repairAssistantInheritedLineup */

  /* @domain lineup-controller seedAssistantCoachLineupForDay */

  /* @domain lineup-controller unavailableDraftStarters */

  /* @domain lineup-controller repairUnavailableStartersInDraft */

  /* @domain lineup-controller saveLineupDraft */

  /* @domain lineup-controller confirmUserLineup */

  /* @domain lineup-controller closeConsumableModal */

  /* @domain lineup-controller lineupConsumableActionState */

  /* @domain lineup-controller renderConsumableInventory */

  /* @domain lineup-controller openConsumableInventory */

  /* @domain lineup-controller beginConsumableUse */

  /* @domain lineup-controller showConsumableTargets */

  /* @domain lineup-controller applyTargetedConsumable */

  /* @domain lineup-controller enforceOpponentConsumableBlock */

  /* @domain lineup-controller renderLineupScreen */


  // V2.3 · La giornata fantasy nasce da una simulazione unica della Serie A.
  // Lo stesso calciatore ha quindi lo stesso voto/eventi ovunque: prima si gioca
  // la Serie A, poi quei voti vengono usati per tutte le fantasquadre.
  /* @domain football-engine seededSerieRand */

  /* @domain football-engine halfPoint */

  /* @domain football-engine buildSerieASchedule */

  let serieAStrengthCache={key:null,rows:null};

  /* @domain football-engine serieAFixtureForPlayer */

  /* @domain football-engine serieAStrengthRowsForDay */

  /* @domain football-engine serieAMatchupDifficulty */

  /* @domain football-engine serieAFixtureCompactText */

  /* @domain football-engine serieAFixtureFullText */

  /* @domain football-engine serieAMatchupBadgeHtml */

  /* @domain football-engine clubPool */

  /* @domain football-engine rankedClubPlayers */

  /* @domain football-engine serieAPlayerDayProfile */

  /* @domain football-engine chooseSerieATacticalShape */

  /* @domain football-engine buildSerieAClubSelection */

  /* @domain football-engine baseLivePerformance */

  /* @domain football-engine lockerVoteModifier */

  /* @domain football-engine participantWeight */

  /* @domain football-engine weightedPerformancePick */

  /* @domain football-engine activePerformances */

  // V3.2.35.56.63 · La forza reale di una squadra non è più una sola media OVR.
  // Attacco, protezione difensiva e controllo del centrocampo vengono valutati
  // separatamente. In questo modo un grande portiere non aumenta artificialmente
  // la probabilità di segnare e un attacco forte pesa davvero sulla produzione gol.
  const SERIEA_UNIT_WEIGHTS={
    attack:{P:.02,D:.18,C:.72,A:1.35},
    defense:{P:1.50,D:1.15,C:.42,A:.08},
    control:{P:.05,D:.38,C:1.15,A:.62}
  };

  /* @domain football-engine serieAUnitWeightedAverage */

  /* @domain football-engine serieATeamUnitProfile */

  /* @domain football-engine serieAGoalProbability */

  /* @domain football-engine matchStrength */

  /* @domain football-engine buildSerieAMatch */


  /* @domain football-engine serieAClubStrength */

  /* @domain football-engine selectSerieABigMatch */

  /* @domain football-engine buildSerieADay */

  /* @domain football-engine playedMinutes */

  /* @domain football-engine decisivePerformance */

  /* @domain football-engine finalizeSerieAMatchRatings */

  /* @domain football-engine finalizeSerieAPhaseRatings */

  /* @domain football-engine liveFantasyValue */

  /* @domain football-engine perfEventText */

  /* @domain football-engine liveEventBadgesMarkup */

  /* @domain football-engine performanceText */

  /* @domain football-engine fantasyGoals */

  /* @domain football-engine lineupPlayersForManager */

  /* @domain football-engine currentFantasyPerformance */

  /* @domain football-engine lineupBenchPlayers */

  /* @domain football-engine classicDefenseModifierResult */

  /* @domain football-engine applyAdminTeamScoring */

  /* @domain football-engine simulateFantasyTeamFromSerieA */

  /* @domain football-engine updateStandingsFromMatch */

  /* @domain live-controller ensureCpuLineupsForDay */

  const SERIEA_LIVE_SPEEDS={0.5:0.5,1:1,2:2,4:4};
  let serieAMatchesExpanded=true;

  /* @domain live-controller serieALiveTickBase */

  /* @domain live-controller serieALiveTickDelay */

  /* @domain live-controller restartSerieALiveTimer */

  /* @domain live-controller setSerieALiveSpeed */

  /* @domain live-controller toggleSerieALivePause */

  /* @domain live-controller jumpToNextSerieAEvent */

  /* @domain live-controller renderSerieALiveSpeedControls */

  /* @domain live-controller serieAEventFantasySide */

  /* @domain live-controller captureWatchedVoteSnapshot */

  /* @domain live-controller updateWatchedVoteFlashes */

  /* @domain live-controller tvEventClass */

  /* @domain live-controller tvFinalTitle */

  /* @domain live-controller tvEventDetail */

  /* @domain live-controller tvFantasyFocus */

  // Decorative particles never change match timing, currency or input availability.
  /* @domain live-controller animateMatchParticles */

  /* @domain live-controller setSerieATvBanner */

  /* @domain live-controller hideSerieATvBanner */

  /* @domain live-controller triggerSerieATvPresentation */

  /* @domain live-controller eventHeadline */

  /* @domain live-controller serieALiveFantasyContext */

  /* @domain live-controller serieAEventTouchesFantasyMatch */

  /* @domain live-controller fantasyFocusedEventHeadline */

  /* @domain live-controller applySerieAEvent */


  /* @domain live-controller serieABigMatch */

  /* @domain live-controller isBigMatchClub */

  /* @domain live-controller serieAMinuteForPlayer */

  /* @domain live-controller serieALiveSnapshotForManager */

  /* @domain live-controller startSerieABigMatchPhase */

  /* @domain live-controller snapshotSerieALive */

  /* @domain live-controller hydrateSerieALive */

  /* @domain live-controller finishSerieAMultiLivePhase */

  /* @domain live-controller fantasyLiveSnapshot */

  /* @domain live-controller setSerieAMatchesExpanded */

  /* @domain live-controller renderSerieALive */

  /* @domain live-controller tickSerieALive */

  /* @domain live-controller simulateFullMatchdayDirectly */

  /* @domain live-controller startSerieALiveMatchday */

  /* @domain live-controller skipSerieALive */

  /* @domain live-controller startPendingBigMatchFromHub */

  /* @domain player-development updatePersistentPlayerStatuses */

  /* @domain player-development updatePlayerSeasonStatsFromLive */

  /* @domain player-development playerOvrDevelopment */

  /* @domain player-development currentPlayerOvr */

  /* @domain player-development playerOvrLabel */

  /* @domain player-development applyPlayerOvrChange */

  /* @domain player-development updatePlayerOvrEvolution */

  /* @domain player-development updateSerieASeasonWorld */

  /* @domain player-development applyLockerRoomOvrOutcome */

  /* @domain result-controller finalizeSerieALiveMatchday */

  /* @domain result-controller renderMatchdayResult */

  /* @domain result-controller closeMatchdayFantapointsReward */

  /* @domain result-controller animateMatchdayRewardNumber */

  /* @domain result-controller renderMatchdayFantapointsReward */

  const QUICK_ROLE_NAMES={P:'Portieri',D:'Difensori',C:'Centrocampisti',A:'Attaccanti'};

  /* @domain ready-rosters-controller quickReadyYield */

  /* @domain ready-rosters-controller setQuickReadyLoading */

  /* @domain ready-rosters-controller updateQuickReadyProgress */

  /* @domain ready-rosters-controller quickAwardGeneratedPlayer */

  /* @domain ready-rosters-controller generateReadyRosters */


  // ========================= V3.2.5 — EVENTI ASTA =========================
  const AUCTION_EVENT_CHANCE=window.FantaAuctionEvents.settings.chance;
  /* @domain auction-events-controller ensureAuctionEvents */
  /* @domain auction-events-controller auctionEffects */
  /* @domain auction-events-controller relationship */
  /* @domain auction-events-controller changeRelationship */
  /* @domain auction-events-controller registerDirectAuctionDuel */

  /* @domain auction-events-controller resolveRespectedAuctionPact */
  /* @domain auction-events-controller lateInRole */
  /* @domain auction-events-controller eventEligibleBase */
  /* @domain auction-events-controller cpuEventCandidates */
  /* @domain auction-events-controller sharedInterestingPlayers */
  /* @domain auction-events-controller auctionEventAlreadyShown */
  /* @domain auction-events-controller eventRolePlayers */
  /* @domain auction-events-controller tablePressureEligible */
  /* @domain auction-events-controller availableEventTypes */
  /* @domain auction-events-controller weightedPick */
  /* @domain auction-events-controller maybeTriggerAuctionEvent */
  /* @domain auction-events-controller pickCpu */
  /* @domain auction-events-controller buildAuctionEvent */
  /* @domain auction-events-controller eventPortrait */
  /* @domain auction-events-controller auctionEventGenericPortrait */
  /* @domain auction-events-controller showAuctionEventModal */
  /* @domain auction-events-controller resolveAuctionEvent */
  /* @domain auction-events-controller minimizeAuctionEventModal */
  /* @domain auction-events-controller restoreAuctionEventModal */
  /* @domain auction-events-controller closeAuctionEventModal */
  /* @domain auction-events-controller activePactForPlayer */
  /* @domain auction-events-controller cpuKeepsPact */
  /* @domain auction-events-controller showPactBetrayPrompt */
  /* @domain auction-events-controller tickAuctionEventEffectsOnNomination */

  /* @domain pack-controller applyPreAuctionPack */

  /* @domain pack-controller showPreAuctionPack */

  function startAuction(fromCareer=false) {
    prepareNewGame(fromCareer);
    hideRoleTransitionModal();
    selectedPlayerId = null;
    roleRemainderAutoSim = false;
    autocompleteMode = false;
    hideRoleRemainderAutoSim();
    saveState();
    showScreen('auctionScreen');
    renderAll();
    showPreAuctionPack();
  }

  async function resumeAuction() {
    stopGameRuntime();
    state = await loadSaved();
    if (!state) return;
    syncSerieATransferWorld(state);
    if(openRoleAuction() && $('roleFilter')) $('roleFilter').value='ALL';
    auditAndRepairState('resume');
    autocompleteMode = false;
    $('turboToggle').checked = !!state.turbo;
    if (state.completed) {
      const active=state.season?.activeLive;
      const activeResult=active && state.season.matchdayResults?.[String(active.day)];
      if(active?.reviewComplete && activeResult) {
        serieALive=hydrateSerieALive(active);
        serieAMatchesExpanded=true;
        showScreen('serieALiveScreen');
        renderSerieALive();
        return;
      }
      if(active && active.day===state.season.currentMatchday && !activeResult) {
        serieALive=hydrateSerieALive(active);
        showScreen('serieALiveScreen');
        renderSerieALive();
        if(serieALive.phase!=='between') restartSerieALiveTimer();
        return;
      }
      if(state.season?.pendingBigMatch?.snapshot){
        serieALive=hydrateSerieALive(state.season.pendingBigMatch.snapshot,'between');
        state.season.activeLive=snapshotSerieALive(serieALive);
        saveState();
        showScreen('serieALiveScreen');
        renderSerieALive();
        return;
      }
      if(state.season?.started && state.season?.completed) return renderSeasonDashboard();
      if(state.winterMarketFlow?.stage==='trades') return renderTradeWindow('winter');
      if(!state.season?.started && currentTradeWindow('summer').stage!=='completed') return renderTradeWindow('summer');
      return state.season?.started ? renderSeasonDashboard() : renderSummary();
    }
    showScreen('auctionScreen');
    if(state.roleTransition){
      renderAll();
      showRoleTransitionModal();
      return;
    }
    advanceRolePhaseIfNeeded();
    if (!state.auction && (openRoleAuction()?!managerCanNominate(state.managers[state.nominationIndex]):roleSlotsRemaining(state.managers[state.nominationIndex], currentAuctionRole())<=0)) {
      state.nominationIndex = nextNominatorIndex(state.nominationIndex);
    }
    renderAll();
    if (state.auctionEvents?.pending) { showAuctionEventModal(state.auctionEvents.pending); return; }
    if(!openRoleAuction() && !rolePhaseComplete(currentAuctionRole()) && userCompletedCurrentRole(currentAuctionRole())) {
      beginRoleRemainderAutoSim(currentAuctionRole());
      renderAll();
    }
    if(showPreAuctionPack()) return;
    if (state.auction) {
      // A paused local file should never expire while closed: resuming starts a fresh 5-second window.
      state.auction.awaitingUser = false;
      state.auction.awarding = false;
      state.auction.presenting = false;
      beginBidRound();
    } else if (state.managers[state.nominationIndex].id!=='user') scheduleNomination();
  }

  async function autoCompleteAuction() {
    if (!state || state.completed) return;
    if (!await window.PixelDialog.confirm({eyebrow:'AUTOCOMPLETAMENTO',title:'Completare automaticamente l’asta?',message:'Anche la tua squadra verrà gestita da una CPU neutrale fino alla fine dell’asta.',consequence:'L’operazione non può essere annullata durante la simulazione.',confirmLabel:'COMPLETA ASTA',cancelLabel:'ANNULLA',tone:'warning'})) return;
    autocompleteMode = true;
    state.turbo = true;
    $('turboToggle').checked = true;
    if (state.auction) {
      state.auction.awaitingUser = false;
      beginBidRound();
    } else {
      scheduleNomination();
    }
    renderTurn();
  }

  async function resetGame() {
    if (!await window.PixelDialog.confirm({eyebrow:'RESET CARRIERA',title:'Cancellare il salvataggio?',message:'Perderai asta, rose, campionato e progressi della carriera presenti su questo dispositivo.',consequence:'Questa operazione non può essere annullata.',confirmLabel:'CANCELLA TUTTO',cancelLabel:'MANTIENI SALVATAGGIO',tone:'danger'})) return;
    stopGameRuntime();
    await clearSaved();
    state = null;
    careerDraft = null;
    $('careerSetupScreen')?.classList.add('hidden');
    autocompleteMode = false;
    showScreen('setupScreen');
    updateResumeButton();
  }

  async function updateResumeButton() {
    const s = await loadSaved();
    $('resumeBtn').classList.toggle('hidden', !s);
    if (s) $('resumeBtn').textContent = 'RIPRENDI SALVATAGGIO';
  }

  function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }


  const RIVAL_ART = {
    bomber:'bomberista',ragioniere:'ragioniere',spendaccione:'spendaccione',tirchio:'tirchio',
    moneyball:'moneyball',tifoso:'tifoso',collezionista:'collezionista',esperto:'esperto',
    pazzo:'pazzo',gambler:'gambler',stratega:'ds_stratega',rivale:'rivale',
    squalo:'squalo',camaleonte:'camaleonte',fantadata:'fantadata',predatore:'predatore',broker:'broker',admin:'admin'
  };

  const RIVAL_PRESENTATION = {
    bomber:        { description:'Vive per i bomber. Investe tutto in attacco.', tags:['OFFENSIVO','BOMBER'], tone:'red' },
    ragioniere:    { description:'Calcoli e bilancio. Sempre sul pezzo.', tags:['EQUILIBRATO','GESTIONE'], tone:'blue' },
    spendaccione:  { description:'Non bada a spese. Ama i top player.', tags:['AGGRESSIVO','BIG NAMES'], tone:'red' },
    tirchio:       { description:'Aspetta gli affari. Mai una spesa folle.', tags:['DIFENSIVO','AFFARI'], tone:'green' },
    moneyball:     { description:'Numeri e statistiche. Valore prima del nome.', tags:['STRATEGICO','UNDERDOG'], tone:'blue' },
    esperto:       { description:'Tattica ed esperienza. Conosce il gioco.', tags:['EQUILIBRATO','COMPLETEZZA'], tone:'violet' },
    tifoso:        { description:'Compra i suoi beniamini. Segue sempre il cuore.', tags:['EMOTIVO','FEDELTÀ'], tone:'orange' },
    pazzo:         { description:'Imprevedibile. Fa mosse folli.', tags:['IMPREVEDIBILE','RISCHIO'], tone:'pink' },
    collezionista: { description:'Vuole tutti i top. Ama i giocatori simbolo.', tags:['AGGRESSIVO','COLLEZIONE'], tone:'red' },
    rivale:        { description:'Vuole batterti. Osserva e ti copia.', tags:['COMPETITIVO','ANTI-JHZ'], tone:'crimson' },
    gambler:       { description:'Ama il rischio. Rilancia senza paura.', tags:['AUDACE','RISCHIO'], tone:'pink' },
    stratega:      { description:'Pianifica ogni mossa. Cura tutti i reparti.', tags:['STRATEGICO','PIANIFICAZIONE'], tone:'violet' },
    squalo:        { description:'Sente il sangue nell’acqua e alza il ritmo dell’asta.', tags:['AGGRESSIVO','TOP HUNTER'], tone:'crimson' },
    camaleonte:    { description:'Si adatta al tavolo e cambia pelle in base alla situazione.', tags:['ADATTIVO','LETTURA'], tone:'green' },
    fantadata:     { description:'Vive di numeri, proiezioni e vantaggi marginali.', tags:['DATI','ANALISI'], tone:'violet' },
    predatore:     { description:'Aspetta l’attimo giusto e colpisce i giocatori più appetitosi.', tags:['PRESSIONE','ISTINTO'], tone:'orange' },
    broker:        { description:'Muove capitali e tratta come un vero re del mercato.', tags:['LUSSO','TRATTATIVE'], tone:'blue' },
    admin:         { description:'Il boss della Serie A. Rosa equilibrata, asta lucida e One Shot: una volta per asta prende un giocatore a 1 credito.', tags:['BOSS FINALE','ONE SHOT · 1 USO'], tone:'violet' }
  };


  const FIXTURE_HERO_THEMES = {
    user:{ primary:'#ffd84d', secondary:'#7051ff', panel:'rgba(22,19,49,.82)', line:'rgba(255,216,77,.72)', glow:'rgba(255,216,77,.18)' },
    blue:{ primary:'#72d5ff', secondary:'#2b7cff', panel:'rgba(8,22,59,.82)', line:'rgba(93,201,255,.72)', glow:'rgba(93,201,255,.18)' },
    red:{ primary:'#ffba63', secondary:'#ff5e63', panel:'rgba(48,17,34,.82)', line:'rgba(255,106,124,.68)', glow:'rgba(255,106,124,.18)' },
    green:{ primary:'#8bffb8', secondary:'#2fbe6c', panel:'rgba(12,42,35,.82)', line:'rgba(92,242,133,.68)', glow:'rgba(92,242,133,.17)' },
    violet:{ primary:'#c8a5ff', secondary:'#7e5cff', panel:'rgba(30,14,59,.84)', line:'rgba(160,135,239,.72)', glow:'rgba(139,104,255,.20)' },
    pink:{ primary:'#ff97d2', secondary:'#e553a3', panel:'rgba(57,15,50,.82)', line:'rgba(255,122,194,.70)', glow:'rgba(255,122,194,.18)' },
    orange:{ primary:'#ffc57a', secondary:'#ff8a47', panel:'rgba(58,26,12,.82)', line:'rgba(255,164,87,.74)', glow:'rgba(255,164,87,.18)' },
    crimson:{ primary:'#ff8b99', secondary:'#d73b53', panel:'rgba(62,17,28,.84)', line:'rgba(255,99,123,.72)', glow:'rgba(255,99,123,.20)' }
  };


  const FIXTURE_TEAM_COLORS = {
    user:          { primary:'#ffd84d', secondary:'#6e4fd6' },
    bomber:        { primary:'#e53935', secondary:'#111111' },
    ragioniere:    { primary:'#3d7dff', secondary:'#dbe8ff' },
    spendaccione:  { primary:'#e2ad32', secondary:'#8f2433' },
    tirchio:       { primary:'#39b66a', secondary:'#10271a' },
    moneyball:     { primary:'#40c9e8', secondary:'#173d74' },
    tifoso:        { primary:'#2678d8', secondary:'#101010' },
    collezionista: { primary:'#f4f1df', secondary:'#c79a2f' },
    esperto:       { primary:'#8b68d9', secondary:'#2c1c4e' },
    pazzo:         { primary:'#e553a3', secondary:'#241126' },
    gambler:       { primary:'#eb5a61', secondary:'#342066' },
    stratega:      { primary:'#735fe5', secondary:'#1f2344' },
    rivale:        { primary:'#d83d55', secondary:'#27222f' },
    squalo:        { primary:'#61b8ff', secondary:'#16365a' },
    camaleonte:    { primary:'#7edb67', secondary:'#1f3f2a' },
    fantadata:     { primary:'#6f83ff', secondary:'#2d2454' },
    predatore:     { primary:'#ffb54d', secondary:'#5b2c12' },
    broker:        { primary:'#62d3d7', secondary:'#1f2d45' },
    admin:         { primary:'#a648dd', secondary:'#161020' }
  };

  /* @domain visual-identity fixtureTeamColors */

  /* @domain visual-identity applyFixtureTeamColors */

  /* @domain visual-identity seasonFixtureTheme */

  /* @domain visual-identity teamBadgeInitials */

  /* @domain visual-identity simpleHash */

  /* @domain visual-identity buildPixelCrestData */

  /* @domain visual-identity buildCoachSilhouette */

  /* @domain visual-identity renderFixtureCrest */

  /* @domain visual-identity renderFixtureCoachPortrait */

  /* @domain visual-identity applySeasonFixtureHeroVisuals */

  /* @domain visual-identity rivalCards */

  /* @domain visual-identity renderVisibleRivals */

  /* @domain career-setup-controller renderCareerAvatarEditor */

  /* @domain career-setup-controller updateCareerAvatarEditor */

  /* @domain career-setup-controller careerIdentity */

  /* @domain career-setup-controller updateCareerIdentityControls */

  /* @domain career-setup-controller setInitialCareerCatalog */

  /* @domain career-setup-controller showCareerTeamSubstep */

  /* @domain career-setup-controller advanceCareerIdentityStep */

  /* @domain career-setup-controller openCareerSetup */

  /* @domain career-setup-controller showCareerSetupStep */

  /* @domain career-setup-controller continueCareerSetup */

  /* @domain career-setup-controller syncCareerIdentity */

  /* @domain career-setup-controller rerollPreAuctionRules */

  /* @domain career-setup-controller renderCareerLeagueRules */

  /* @domain career-setup-controller openCareerRulesStep */

  /* @domain career-setup-controller startReadyRostersFromCareer */

  /* @domain career-setup-controller proceedFromCareerRules */

  /* @domain career-setup-controller backFromCareerRules */

  /* @domain career-setup-controller showGameInstructions */

  /* @domain career-setup-controller careerPowerSlotCost */

  /* @domain career-setup-controller renderCareerPowerSelection */


  /* @domain career-setup-controller toggleCareerPower */

  /* @domain career-setup-controller startCareerAuction */

  function prepareNewGame(fromCareer=false){
    const teamInput=fromCareer?$('careerTeamNameInput'):$('teamNameInput');
    const managerInput=fromCareer?$('coachNameInput'):$('managerNameInput');
    const teamName=teamInput.value.trim()||'Team JHZ';
    const managerName=managerInput.value.trim()||'Mister';
    stopGameRuntime();
    state=fromCareer && careerDraft?careerDraft:freshState(teamName,managerName);
    applyCatalogDecision(state);
    syncSerieATransferWorld(state);
    applySeasonKeeper(state);
    applyPreAuctionPack(state);
    if($('roleFilter')) $('roleFilter').value=openRoleAuction()?'ALL':'P';
    state.teamName=teamName; state.managerName=managerName;
    state.managers[0].team=teamName; state.managers[0].name=managerName;
    $('teamNameInput').value=teamName; $('managerNameInput').value=managerName;
    careerDraft=null;
    nextSeasonSetupMode=false;
    $('careerSetupScreen').classList.add('hidden');
    applyGameConfiguration();
    renderVisibleRivals();
  }



  // Events
  document.addEventListener('keydown',event=>{
    const modal=$('arcadeAuctionModal');
    if(event.key!=='Tab' || !modal || modal.classList.contains('hidden'))return;
    const controls=[...modal.querySelectorAll('input,select,button')];
    if(!controls.length)return;
    if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1).focus();}
    else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0].focus();}
  });
  document.addEventListener('click',event=>{
    const action=event.target.closest('[data-arcade-action]')?.dataset.arcadeAction;
    if(action) handleArcadeAction(action);
  });
  $('startBtn').addEventListener('click',openCareerSetup);
  $('instructionsBtn')?.addEventListener('click',showGameInstructions);
  $('followBtn')?.addEventListener('click',()=>window.open('https://www.instagram.com/fantaballafm','_blank','noopener,noreferrer'));
  document.querySelectorAll('#careerTeamStep [data-coach-avatar]').forEach(select=>select.addEventListener('change',updateCareerAvatarEditor));
  $('coachNameInput')?.addEventListener('input',renderCareerAvatarEditor);
  $('coachNameInput')?.addEventListener('input',updateCareerIdentityControls);
  $('careerTeamNameInput')?.addEventListener('input',updateCareerIdentityControls);
  $('careerTeamNameInput')?.addEventListener('keydown',event=>{
    if(event.key!=='Tab'||event.shiftKey||event.ctrlKey||event.altKey||event.metaKey)return;
    const coachInput=$('coachNameInput');
    if(!coachInput||coachInput.disabled)return;
    event.preventDefault();
    event.stopPropagation();
    coachInput.focus();
  });
  $('careerPokemonToggle')?.addEventListener('change',event=>setInitialCareerCatalog(!!event.target.checked));
  $('careerIdentityNextBtn')?.addEventListener('click',advanceCareerIdentityStep);
  $('careerAvatarBackBtn')?.addEventListener('click',()=>showCareerTeamSubstep('identity'));
  $('careerAvatarNextBtn')?.addEventListener('click',()=>showCareerTeamSubstep('launch'));
  $('careerLaunchBackBtn')?.addEventListener('click',()=>showCareerTeamSubstep('avatar'));
  $('careerContinueBtn')?.addEventListener('click',continueCareerSetup);
  $('careerStartAuctionBtn')?.addEventListener('click',startCareerAuction);
  $('careerRulesRerollBtn')?.addEventListener('click',rerollPreAuctionRules);
  $('careerRulesContinueBtn')?.addEventListener('click',proceedFromCareerRules);
  document.querySelectorAll('#careerCatalogChoice [data-catalog-decision]').forEach(button=>button.addEventListener('click',()=>{
    if(!careerDraft) return;
    careerDraft.leagueRules.catalogDecision=button.dataset.catalogDecision;
    renderCareerLeagueRules();
  }));
  $('careerRulesBackBtn')?.addEventListener('click',backFromCareerRules);
  $('careerPowersBackBtn')?.addEventListener('click',()=>{ if(nextSeasonSetupMode){ $('careerSetupScreen')?.classList.add('hidden'); careerDraft=null; careerPowerSelection=[]; nextSeasonSetupMode=false; renderNextSeasonFlow(); } else { showCareerSetupStep('team'); showCareerTeamSubstep('launch'); } });
  document.querySelectorAll('[data-career-power]').forEach(card=>{
    card.addEventListener('click',()=>{
      if(card.getAttribute('aria-disabled')==='true') return;
      toggleCareerPower(card.dataset.careerPower);
    });
    card.addEventListener('keydown',(event)=>{
      if(event.key==='Enter' || event.key===' '){
        event.preventDefault();
        if(card.getAttribute('aria-disabled')==='true') return;
        toggleCareerPower(card.dataset.careerPower);
      }
    });
  });
  $('careerBackBtn')?.addEventListener('click',()=>{
    careerDraft=null;
    careerPowerSelection=[];
    $('careerSetupScreen').classList.add('hidden');
  });
  $('quickReadyBtn')?.addEventListener('click',startReadyRostersFromCareer);
  $('roleTransitionContinue')?.addEventListener('click',continueAfterRoleTransition);
  document.querySelectorAll('[data-minimize-matchday-event]').forEach(button=>button.addEventListener('click',()=>minimizeMatchdayEvent(button.dataset.minimizeMatchdayEvent)));
  $('matchdayEventRestoreBtn')?.addEventListener('click',restoreMatchdayEvent);

  $('resumeBtn').addEventListener('click',()=>{
    $('careerSetupScreen')?.classList.add('hidden');
    resumeAuction();
  });
  $('saveBtn').addEventListener('click',()=>saveWithFeedback('saveBtn'));
  $('resetBtn').addEventListener('click', resetGame);
  $('newAuctionBtn').addEventListener('click', resetGame);
  $('startLeagueBtn')?.addEventListener('click', startLeague);
  $('tradeOutgoing')?.addEventListener('change',()=>{
    const trade=currentTradeWindow(tradeActiveKind());
    trade.pending=null;renderTradeWindow(trade.kind);
  });
  $('tradeOpponent')?.addEventListener('change',()=>{
    const trade=currentTradeWindow(tradeActiveKind());
    trade.pending=null;renderTradeWindow(trade.kind);
  });
  $('tradeIncoming')?.addEventListener('change',()=>{
    const trade=currentTradeWindow(tradeActiveKind());
    trade.pending=null;renderTradeWindow(trade.kind);
  });
  $('tradeCredits')?.addEventListener('input',()=>{
    const trade=currentTradeWindow(tradeActiveKind());
    const input=$('tradeCredits');
    const max=Math.max(0,Number(input?.max||0));
    const numeric=clamp(tradeCreditsValue(),0,max);
    if(input) input.value=String(numeric);
    trade.notice='Proposta modificata.';
    renderTradeWindow(trade.kind);
  });
  $('tradeCreditsMinus')?.addEventListener('click',()=>adjustTradeCredits(-1));
  $('tradeCreditsPlus')?.addEventListener('click',()=>adjustTradeCredits(1));
  $('tradeClearOutgoing')?.addEventListener('click',()=>tradeSetSelection('tradeOutgoing',''));
  $('tradeClearIncoming')?.addEventListener('click',()=>tradeSetSelection('tradeIncoming',''));
  ['tradeMyRole','tradeMySort','tradeRivalRole','tradeRivalSort'].forEach(id=>$(id)?.addEventListener('change',()=>renderTradeRosterChoices()));
  $('tradeMyRosterList')?.addEventListener('click',ev=>{
    const row=ev.target.closest('[data-trade-outgoing]');
    if(!row) return;
    tradeSetSelection('tradeOutgoing',row.dataset.tradeOutgoing||'');
  });
  $('tradeRivalRosterList')?.addEventListener('click',ev=>{
    const row=ev.target.closest('[data-trade-incoming]');
    if(!row) return;
    tradeSetSelection('tradeIncoming',row.dataset.tradeIncoming||'');
  });
  $('tradeOfferBtn')?.addEventListener('click',submitTradeOffer);
  $('tradeCounterBtn')?.addEventListener('click',acceptTradeCounter);
  $('tradeFinishBtn')?.addEventListener('click',finishTradeWindow);
  $('backToAuctionSummaryBtn')?.addEventListener('click', () => renderSummary());
  $('seasonSaveBtn')?.addEventListener('click',()=>saveWithFeedback('seasonSaveBtn'));
  $('lineupBtn')?.addEventListener('click', requestOpenLineup);
  $('opponentMalusBanner')?.addEventListener('click',()=>showOpponentMalusNotice(state?.season?.currentMatchday,true));
  $('opponentMalusAcknowledge')?.addEventListener('click',()=>closeOpponentMalusNotice(true));
  document.addEventListener('keydown',event=>{
    if(opponentMalusNoticeDay===null) return;
    if(event.key==='Escape'){event.preventDefault();closeOpponentMalusNotice(false);}
    if(event.key==='Tab'){event.preventDefault();$('opponentMalusAcknowledge').focus();}
  });
  $('playMatchdayBtn')?.addEventListener('click', handleDashboardPrimaryAction);
  $('simulateMatchdayBtn')?.addEventListener('click', simulateFullMatchdayDirectly);
  $('openCalendarDashboardBtn')?.addEventListener('click', renderLeagueCalendarScreen);
  $('closeMatchCenterBtn')?.addEventListener('click', closeMatchCenter);
  $('matchCenterModal')?.querySelector('.match-center-backdrop')?.addEventListener('click', closeMatchCenter);
  $('closeLeagueRosterModal')?.addEventListener('click', closeLeagueRosterModal);
  $('leagueRosterModal')?.querySelector('.league-roster-modal-backdrop')?.addEventListener('click', closeLeagueRosterModal);
  $('startPendingBigMatchBtn')?.addEventListener('click', startPendingBigMatchFromHub);
  $('skipSerieALiveBtn')?.addEventListener('click', skipSerieALive);
  $('nextSerieAEventBtn')?.addEventListener('click', jumpToNextSerieAEvent);
  $('auctionEventMinimizeBtn')?.addEventListener('click',minimizeAuctionEventModal);
  $('auctionEventRestoreBtn')?.addEventListener('click',restoreAuctionEventModal);
  document.querySelectorAll('[data-live-speed]').forEach(btn=>btn.addEventListener('click',()=>setSerieALiveSpeed(btn.dataset.liveSpeed)));
  $('serieAPauseBtn')?.addEventListener('click', toggleSerieALivePause);
  $('resultFantapointsContinueBtn')?.addEventListener('click', closeMatchdayFantapointsReward);
  $('resultContinueBtn')?.addEventListener('click', renderSeasonDashboard);
  $('winterTransferContinue')?.addEventListener('click',closeWinterTransferSummary);
  $('nextSeasonPrimaryBtn')?.addEventListener('click',handleNextSeasonPrimaryAction);
  $('simulateWinterMarketBtn')?.addEventListener('click',simulateWinterMarket);
  $('openWinterReleasesBtn')?.addEventListener('click',openWinterReleases);
  $('confirmWinterReleasesBtn')?.addEventListener('click',confirmWinterReleases);
  $('winterGuaranteedSaleBtn')?.addEventListener('click',toggleGuaranteedWinterSaleMode);
  $('backToSeasonBtn')?.addEventListener('click', renderSeasonDashboard);
  $('openFullStandingsBtn')?.addEventListener('click', renderLeagueStandingsScreen);
  $('openCareerHonoursBtn')?.addEventListener('click',()=>{
    const panel=$('careerHonoursPanel');
    panel?.classList.toggle('hidden');
    $('openCareerHonoursBtn')?.setAttribute('aria-expanded',String(!panel?.classList.contains('hidden')));
    if(!panel?.classList.contains('hidden')) renderCareerHonours();
  });
  $('nextSeasonHonoursBtn')?.addEventListener('click',openCareerHonours);
  $('openNewsArchiveBtn')?.addEventListener('click', openSeasonNewsArchive);
  $('closeSeasonNewsModal')?.addEventListener('click', closeSeasonNewsArchive);
  $('seasonNewsModal')?.querySelector('.season-news-modal-backdrop')?.addEventListener('click', closeSeasonNewsArchive);
  $('closeSeasonPlayerModal')?.addEventListener('click', closeSeasonPlayerModal);
  $('socialSendBtn')?.addEventListener('click',sendCurrentSocialMessage);
  $('socialMessageInput')?.addEventListener('input',e=>{
    if($('socialMessageCounter')) $('socialMessageCounter').textContent=`${String(e.target.value||'').length}/180`;
  });
  $('socialMessageInput')?.addEventListener('keydown',e=>{
    if(e.key==='Enter' && !e.shiftKey){
      e.preventDefault();
      sendCurrentSocialMessage();
    }
  });
  $('socialPlayerSearch')?.addEventListener('input',e=>{
    socialSearchQuery=String(e.target.value||'');
    if(document.getElementById('leagueSocialScreen')?.classList.contains('active')) renderLeagueSocialScreen();
  });
  $('seasonPlayerModal')?.addEventListener('click',e=>{if(e.target===$('seasonPlayerModal')) closeSeasonPlayerModal();});
  applyGameConfiguration();
  standardizeLeagueShells();
  renderCareerWallets();
  document.querySelectorAll('[data-season-global-save]').forEach(btn=>btn.addEventListener('click',()=>saveWithFeedback(btn)));
  document.querySelectorAll('[data-season-global-menu]').forEach(btn=>btn.addEventListener('click',renderSummary));
  document.querySelectorAll('[data-datacenter-tab]').forEach(btn=>btn.addEventListener('click',()=>setDataCenterTab(btn.dataset.datacenterTab)));
  document.querySelectorAll('[data-league-nav]').forEach(btn=>btn.addEventListener('click',()=>{
    const target=btn.dataset.leagueNav;
    if(target==='dashboard') renderSeasonDashboard();
    else if(target==='rosters') renderLeagueRostersScreen();
    else if(target==='calendar') renderLeagueCalendarScreen();
    else if(target==='standings') renderLeagueStandingsScreen();
    else if(target==='datacenter') renderLeagueDataCenterScreen();
    else if(target==='evolution') renderLeagueEvolutionScreen();
    else if(target==='social') renderLeagueSocialScreen();
    else if(target==='shop') renderLeagueShopScreen();
  }));
  $('lineupSaveBtn')?.addEventListener('click', () => { if(saveLineupDraft(false)){ $('lineupSaveBtn').textContent='Salvato ✓'; setTimeout(()=>$('lineupSaveBtn').textContent='Salva',800); } });
  document.querySelectorAll('[data-open-consumable-inventory]').forEach(btn=>btn.addEventListener('click',openConsumableInventory));
  $('closeConsumableModal')?.addEventListener('click',closeConsumableModal);
  $('consumableModal')?.querySelector('[data-consumable-close]')?.addEventListener('click',closeConsumableModal);
  $('consumableTargetBack')?.addEventListener('click',()=>{ $('consumableTargetPanel')?.classList.add('hidden'); $('consumableInventoryGrid')?.classList.remove('hidden'); renderConsumableInventory(); });
  $('autoLineupBtn')?.addEventListener('click', autoFillUserLineup);
  $('carryLineupBtn')?.addEventListener('click', toggleAssistantCoachCarry);
  $('assistantFixOutBtn')?.addEventListener('click', ()=>repairUnavailableStartersInDraft());
  $('clearLineupBtn')?.addEventListener('click', clearDraftLineup);
  $('benchSelectedBtn')?.addEventListener('click', benchSelectedPlayer);
  $('captainSelectedBtn')?.addEventListener('click', nominateLineupCaptain);
  $('confirmLineupBtn')?.addEventListener('click', confirmUserLineup);
  $('playerSearch').addEventListener('input', renderPlayerResults);
  $('roleFilter').addEventListener('change', renderPlayerResults);
  $('clubFilter').addEventListener('change', renderPlayerResults);
  $('sortFilter').addEventListener('change', renderPlayerResults);
  $('openNominationModal')?.addEventListener('click', openNominationModal);
  $('openNominationModalBtn')?.addEventListener('click', openNominationModal);
  $('closeNominationModal')?.addEventListener('click', closeNominationModal);
  $('nominationModalBackdrop')?.addEventListener('click', closeNominationModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeNominationModal(); closeSeasonNewsArchive(); closeMatchCenter(); closeLeagueRosterModal(); closeConsumableModal(); } });
  $('passBtn').addEventListener('click', userPass);
  $('powerBlockBtn')?.addEventListener('click',()=>openAuctionPower('block'));
  $('powerScoutBtn')?.addEventListener('click',()=>openAuctionPower('scout'));
  $('powerBluffBtn')?.addEventListener('click',()=>openAuctionPower('bluff'));
  $('powerOneShotBtn')?.addEventListener('click',()=>openAuctionPower('oneShot'));
  $('auctionPowerCancel')?.addEventListener('click',()=>closeAuctionPowerModal(true));
  $('auctionPowerModal')?.querySelector('.auction-event-backdrop')?.addEventListener('click',()=>closeAuctionPowerModal(true));
  document.querySelectorAll('[data-inc]').forEach(btn => btn.addEventListener('click', () => userBid(Number(btn.dataset.inc))));
  $('turboToggle').addEventListener('change', e => { if(state){state.turbo=e.target.checked;saveState();} });
  $('autoCompleteBtn').addEventListener('click', autoCompleteAuction);

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden' && state){saveState();void saveManager.flush();}
  });
  window.addEventListener('pagehide',()=>{if(state){saveState();void saveManager.flush();}});
  window.addEventListener('beforeunload',()=>{ if(state) saveState(); });
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden' && state) saveState(); });
  initializeSaveSystem().then(updateResumeButton).catch(e=>{ console.warn('Avvio sistema salvataggi non riuscito',e); updateResumeButton(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape' && $('seasonPlayerModal')?.classList.contains('show')) closeSeasonPlayerModal(); });
  $('expertReasonModal')?.querySelectorAll('[data-expert-reason-close]').forEach(button=>button.addEventListener('click',closeExpertReason));
  $('expertStoryPrev')?.addEventListener('click',()=>changeExpertStoryStep(-1));
  $('expertStoryNext')?.addEventListener('click',()=>changeExpertStoryStep(1));
  document.addEventListener('keydown',e=>{
    if(!$('expertReasonModal')?.classList.contains('show')) return;
    if(e.key==='Escape'){closeExpertReason();return;}
  });
})();
