using Microsoft.Collections.Extensions;
using System;
using System.Collections.Generic;
using System.IO;
using System.Json;
using System.Threading;

namespace ColocDuty.InGame
{
    class Game
    {
        public static readonly List<CardData> CardDatas = new List<CardData>();
        public static readonly JsonArray CardPaths = new JsonArray();

        public static readonly List<CardData> StarterDeckCardDatas = new List<CardData>();
        public static readonly List<CardData> MarketDeckCardDatas = new List<CardData>();
        public static readonly List<CardData> EventDeckCardDatas = new List<CardData>();

        public static void LoadCards(string cardsDatabasePath, string cardsImagePath, CancellationToken shutdownToken)
        {
            using (var reader = new StreamReader(cardsDatabasePath))
            {
                // Read header to determine what column to use
                var headerLine = reader.ReadLine();

                int nameColumnIndex = 0, zoneColumnIndex = 0, quantityColumnIndex = 0,
                    imageNameColumnIndex = 0, actionColumnIndex = 0, descriptionColumnIndex = 0, typeColumnIndex = 0,
                    costColumnIndex = 0, moneyColumnIndex = 0, hygieneColumnIndex = 0, moodColumnIndex = 0;

                var headerValues = headerLine.Split('\t');
                for (var i = 0; i < headerValues.Length; i++)
                {
                    var headerValue = headerValues[i];

                    // TODO: Name, action and description based on the language

                    if (headerValue == "Name_en") nameColumnIndex = i;
                    else if (headerValue == "Zone") zoneColumnIndex = i;
                    else if (headerValue == "Quantity") quantityColumnIndex = i;
                    else if (headerValue == "Name") imageNameColumnIndex = i;
                    else if (headerValue == "Action_en") actionColumnIndex = i;
                    else if (headerValue == "Description_en") descriptionColumnIndex = i;
                    else if (headerValue == "Type") typeColumnIndex = i;
                    else if (headerValue == "Cost") costColumnIndex = i;
                    else if (headerValue == "Money") moneyColumnIndex = i;
                    else if (headerValue == "Hygiene") hygieneColumnIndex = i;
                    else if (headerValue == "Mood") moodColumnIndex = i;
                }

                // Read all cards
                while (!reader.EndOfStream && !shutdownToken.IsCancellationRequested)
                {
                    var line = reader.ReadLine();
                    var values = line.Split('\t');

                    var name = values[nameColumnIndex].Trim();
                    if (string.IsNullOrWhiteSpace(name)) continue;

                    var type = values[typeColumnIndex];
                    var imageName = values[imageNameColumnIndex].Trim();
                    var cardImagePath = Path.Combine(cardsImagePath, type, $"{imageName}.png");
                    if (!File.Exists(cardImagePath)) Console.WriteLine($"Missing image for card '{type}/{imageName}'");

                    var action = values[actionColumnIndex].Trim();
                    var description = values[descriptionColumnIndex].Trim();
                    var cost = !string.IsNullOrWhiteSpace(values[costColumnIndex]) ? int.Parse(values[costColumnIndex]) : 0;
                    var moneyModifier = !string.IsNullOrWhiteSpace(values[moneyColumnIndex]) ? int.Parse(values[moneyColumnIndex]) : 0;
                    var hygieneModifier = !string.IsNullOrWhiteSpace(values[hygieneColumnIndex]) ? int.Parse(values[hygieneColumnIndex]) : 0;
                    var moodModifier = !string.IsNullOrWhiteSpace(values[moodColumnIndex]) ? int.Parse(values[moodColumnIndex]) : 0;

                    var cardData = new CardData()
                    {
                        Name = name,
                        ImageName = imageName,
                        Action = action,
                        Description = description,
                        Type = type,
                        Cost = cost,
                        MoneyModifier = moneyModifier,
                        HygieneModifier = hygieneModifier,
                        MoodModifier = moodModifier
                    };

                    CardDatas.Add(cardData);
                    CardPaths.Add($"{type}/{imageName}");

                    var zone = values[zoneColumnIndex];
                    var quantity = !string.IsNullOrWhiteSpace(values[quantityColumnIndex]) ? int.Parse(values[quantityColumnIndex]) : 1;

                    for (var i = 0; i < quantity; i++)
                    {
                        if (zone == "Base") StarterDeckCardDatas.Add(cardData);
                        else if (zone == "Market") MarketDeckCardDatas.Add(cardData);
                        else if (zone == "Event") EventDeckCardDatas.Add(cardData);
                        else if (zone == "Malus") { /* TODO */ }
                        else throw new Exception($"Invalid zone field {zone} on card {name}");
                    }

                }
            }
        }

        readonly Room _room;
        readonly List<Card> _marketDeck;
        readonly OrderedDictionary<long, Card> _marketPile = new OrderedDictionary<long, Card>();

        enum TurnPhase
        {
            PayRentFadeIn,
            PayRent,
            MarketFadeIn,
            Market,
            FadeOut
        }

        TurnPhase _phase;
        double _phaseTimer;

        const double FadeInDuration = 1.0;

        public const int StartHandSize = 7;
        public const int MarketPileSize = 6;

        public readonly OrderedDictionary<Player, PlayerState> PlayerStates = new OrderedDictionary<Player, PlayerState>();

        // Used by PayRent and Market
        readonly List<Player> _pendingPlayers = new List<Player>();

        #region Pay rent Phase
        int _rentAmount;
        #endregion

        #region Market Phase
        #endregion

        public Game(Room room)
        {
            _room = room;

            var moneyAmountInDeck = 0f;
            foreach (var starterCard in StarterDeckCardDatas) moneyAmountInDeck += starterCard.MoneyModifier;

            // Initial target is to pay with rouglhly 2 cards
            _rentAmount = (int)Math.Floor(moneyAmountInDeck / StarterDeckCardDatas.Count * 2);

            foreach (var player in room.Players.Values)
            {
                var playerState = PlayerStates[player] = new PlayerState();

                for (var i = 0; i < StarterDeckCardDatas.Count; i++)
                {
                    playerState.Deck.Add(new Card(StarterDeckCardDatas[i]));
                }

                playerState.ShuffleDeck();
            }

            _marketDeck = new List<Card>();
            foreach (var cardData in MarketDeckCardDatas) _marketDeck.Add(new Card(cardData));
            Card.ShuffleCardsList(_marketDeck);
        }

        public void Update(double deltaTime)
        {
            _phaseTimer += deltaTime;

            switch (_phase)
            {
                case TurnPhase.PayRentFadeIn:
                    if (_phaseTimer >= FadeInDuration)
                    {
                        _pendingPlayers.Clear();

                        foreach (var player in _room.Players.Values)
                        {
                            var playerState = PlayerStates[player];

                            playerState.DrawHand(StartHandSize);
                            SendPlayerSelfGame(player);
                            BroadcastPlayerHandCount(player);

                            var moneyInHand = 0;
                            foreach (var card in playerState.Hand.Values) moneyInHand += card.Data.MoneyModifier;

                            if (moneyInHand < _rentAmount)
                            {
                                // TODO: Remove player from the game properly
                                playerState.IsAlive = false;

                                var broadcastGameoverJson = new JsonObject();
                                broadcastGameoverJson.Add("type", "setGameover");
                                broadcastGameoverJson.Add("username", player.Username);
                                _room.BroadcastJson(broadcastGameoverJson);
                            }
                            else
                            {
                                _pendingPlayers.Add(player);
                            }
                        }

                        SetPhase(TurnPhase.PayRent);
                    }
                    break;

                case TurnPhase.MarketFadeIn:
                    if (_phaseTimer >= FadeInDuration)
                    {
                        _pendingPlayers.Clear();
                        // TODO: Remove or skip dead players
                        _pendingPlayers.AddRange(PlayerStates.Keys);
                        SetPhase(TurnPhase.Market);
                    }
                    break;

                case TurnPhase.FadeOut:
                    if (_phaseTimer >= FadeInDuration)
                    {
                        SetPhase(TurnPhase.PayRentFadeIn);
                    }
                    break;
            }
        }

        public void DrawMarketPileCard()
        {
            if (_marketDeck.Count == 0)
            {
                // TODO: No more cards in the deck???? REALLY?
                return;
            }

            var card = _marketDeck[0];
            _marketDeck.RemoveAt(0);

            _marketPile.Add(card.Id, card);
        }

        public JsonArray MakeMarketPileJson()
        {
            var cardsJson = new JsonArray();
            foreach (var card in _marketPile.Values) cardsJson.Add(card.MakeJson());

            return cardsJson;
        }

        public void BroadcastPlayerHandCount(Player player)
        {
            var playerState = PlayerStates[player];

            var broadcastHandJson = new JsonObject();
            broadcastHandJson.Add("type", "setHandCardCount");
            broadcastHandJson.Add("username", player.Username);
            broadcastHandJson.Add("handCardCount", playerState.Hand.Count);
            _room.BroadcastJson(broadcastHandJson);
        }

        public void SendPlayerSelfGame(Player player)
        {
            var playerState = PlayerStates[player];

            var moveJson = new JsonObject();
            moveJson.Add("type", "setSelfGame");
            moveJson.Add("selfGame", playerState.MakeSelfJson());
            _room.SendJson(player.Peer, moveJson);
        }

        public void PlayerUseCard(Player player, long cardId)
        {
            if (!_pendingPlayers.Contains(player)) return;
            var playerState = PlayerStates[player];
            if (!playerState.Hand.TryGetValue(cardId, out var card)) return;
            playerState.Hand.Remove(card.Id);

            BroadcastPlayerHandCount(player);

            playerState.BalanceMoney += card.Data.MoneyModifier;
            var moneyJson = new JsonObject();
            moneyJson.Add("type", "updateBalanceMoney");
            moneyJson.Add("balanceMoney", playerState.BalanceMoney);
            _room.SendJson(player.Peer, moneyJson);

            switch (_phase)
            {
                case TurnPhase.PayRent:
                    {
                        playerState.RentPile.Add(card.Id, card);

                        var moveJson = new JsonObject();
                        moveJson.Add("type", "moveSelfCard");
                        moveJson.Add("source", "hand");
                        moveJson.Add("target", "rentPile");
                        moveJson.Add("cardId", card.Id);
                        _room.SendJson(player.Peer, moveJson);
                        break;
                    }

                case TurnPhase.Market:
                    {
                        playerState.DiscardPile.Add(card);

                        var moveBroadcastJson = new JsonObject();
                        moveBroadcastJson.Add("type", "discard");
                        moveBroadcastJson.Add("username", player.Username);
                        moveBroadcastJson.Add("card", card.MakeJson());
                        _room.BroadcastJson(moveBroadcastJson);
                        break;
                    }
            }
        }

        public void PlayerBuyCard(Player player, long cardId)
        {
            if (_phase != TurnPhase.Market) return;
            if (!_pendingPlayers.Contains(player)) return;

            var playerState = PlayerStates[player];

            if (!_marketPile.TryGetValue(cardId, out var card) || playerState.BalanceMoney < card.Data.Cost) return;

            _marketPile.Remove(cardId);
            DrawMarketPileCard();

            var broadcastJson = new JsonObject();
            broadcastJson.Add("type", "setMarketPile");
            broadcastJson.Add("marketPile", MakeMarketPileJson());
            _room.BroadcastJson(broadcastJson);

            playerState.BalanceMoney -= card.Data.Cost;
            playerState.DiscardPile.Add(card);
            SendPlayerSelfGame(player);
        }

        public void PlayerConfirm(Player senderPlayer)
        {
            switch (_phase)
            {
                case TurnPhase.PayRent:
                    {
                        if (!_pendingPlayers.Contains(senderPlayer)) return;

                        if (PlayerStates[senderPlayer].BalanceMoney < _rentAmount) return;

                        _pendingPlayers.Remove(senderPlayer);

                        var json = new JsonObject();
                        json.Add("type", "playerDone");
                        json.Add("username", senderPlayer.Username);
                        _room.BroadcastJson(json);

                        if (_pendingPlayers.Count == 0)
                        {
                            foreach (var card in _marketPile.Values) _marketDeck.Add(card);
                            Card.ShuffleCardsList(_marketDeck);

                            _marketPile.Clear();
                            for (var i = 0; i < MarketPileSize; i++) DrawMarketPileCard();

                            foreach (var player in _room.Players.Values)
                            {
                                var playerState = PlayerStates[player];

                                playerState.RentPile.Clear();
                                playerState.BalanceMoney = 0;
                                
                                SendPlayerSelfGame(player);
                            }

                            SetPhase(TurnPhase.MarketFadeIn);
                        }
                    }
                    break;

                case TurnPhase.Market:
                    {
                        if (!_pendingPlayers.Contains(senderPlayer)) return;
                        _pendingPlayers.Remove(senderPlayer);

                        var json = new JsonObject();
                        json.Add("type", "playerDone");
                        json.Add("username", senderPlayer.Username);
                        _room.BroadcastJson(json);

                        if (_pendingPlayers.Count == 0)
                        {
                            // TODO: Increase this smartly based on the current deck of the players maybe?
                            _rentAmount = (int)Math.Ceiling(_rentAmount * 1.05);

                            foreach (var player in _room.Players.Values)
                            {
                                var playerState = PlayerStates[player];

                                foreach (var card in playerState.Hand.Values) playerState.DiscardPile.Add(card);
                                playerState.Hand.Clear();

                                playerState.BalanceMoney = 0;
                                
                                SendPlayerSelfGame(player);
                                BroadcastPlayerHandCount(player);
                            }

                            SetPhase(TurnPhase.FadeOut);
                        }
                    }
                    break;
            }
        }

        void SetPhase(TurnPhase phase)
        {
            _phase = phase;
            _phaseTimer = 0.0;

            var json = new JsonObject();
            json.Add("type", "goInGamePhase");
            json.Add("phase", MakePhaseJson());
            json.Add("pendingUsernames", MakePendingUsernamesJson());
            _room.BroadcastJson(json);
        }

        JsonArray MakePendingUsernamesJson()
        {
            var json = new JsonArray();
            foreach (var player in _pendingPlayers) json.Add(player.Username);
            return json;
        }

        public JsonObject MakeJson()
        {
            var json = new JsonObject();
            json.Add("phase", MakePhaseJson());
            json.Add("pendingUsernames", MakePendingUsernamesJson());

            json.Add("mood", 12);
            json.Add("maxMood", 20);

            json.Add("hygiene", 17);
            json.Add("maxHygiene", 20);

            json.Add("playerStates", MakePlayerStatesJson());
            return json;
        }

        public JsonObject MakePhaseJson()
        {
            var json = new JsonObject();
            json.Add("name", _phase.ToString());

            switch (_phase)
            {
                case TurnPhase.PayRent:
                    {
                        var jsonPendingPlayers = new JsonArray();
                        json.Add("amountDue", _rentAmount);
                        break;
                    }

                case TurnPhase.Market:
                    {
                        json.Add("marketPile", MakeMarketPileJson());
                        break;
                    }
            }

            return json;
        }

        public JsonObject MakePlayerStatesJson()
        {
            var json = new JsonObject();
            foreach (var (player, state) in PlayerStates) json.Add(player.Username, state.MakePublicJson());
            return json;
        }
    }
}
