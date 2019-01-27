﻿using Microsoft.Collections.Extensions;
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
        public static readonly List<Card> MarketDeck = new List<Card>();
        public static readonly List<Card> EventDeck = new List<Card>();

        public static void LoadCards(string cardsDatabasePath, CancellationToken shutdownToken)
        {
            using (var reader = new StreamReader(cardsDatabasePath))
            {
                // Read header to determine what column to use
                var headerLine = reader.ReadLine();

                int nameColumnIndex = 0, zoneColumnIndex = 0, quantityColumnIndex = 0,
                    actionColumnIndex = 0, descriptionColumnIndex = 0, typeColumnIndex = 0,
                    costColumnIndex = 0, moneyColumnIndex = 0, hygieneColumnIndex = 0, moodColumnIndex = 0;

                var headerValues = headerLine.Split('\t');
                for (var i = 0; i < headerValues.Length; i++)
                {
                    var headerValue = headerValues[i];

                    if (headerValue == "Name") nameColumnIndex = i;
                    else if (headerValue == "Zone") zoneColumnIndex = i;
                    else if (headerValue == "Quantity") quantityColumnIndex = i;
                    else if (headerValue == "Action") actionColumnIndex = i;
                    else if (headerValue == "Description") descriptionColumnIndex = i;
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

                    var action = values[actionColumnIndex];
                    var description = values[descriptionColumnIndex];
                    var type = values[typeColumnIndex];
                    var cost = !string.IsNullOrWhiteSpace(values[costColumnIndex]) ? int.Parse(values[costColumnIndex]) : 0;
                    var moneyModifier = !string.IsNullOrWhiteSpace(values[moneyColumnIndex]) ? int.Parse(values[moneyColumnIndex]) : 0;
                    var hygieneModifier = !string.IsNullOrWhiteSpace(values[hygieneColumnIndex]) ? int.Parse(values[hygieneColumnIndex]) : 0;
                    var moodModifier = !string.IsNullOrWhiteSpace(values[moodColumnIndex]) ? int.Parse(values[moodColumnIndex]) : 0;

                    var cardData = new CardData()
                    {
                        Name = name,
                        Action = action,
                        Description = description,
                        Type = type,
                        Cost = cost,
                        MoneyModifier = moneyModifier,
                        HygieneModifier = hygieneModifier,
                        MoodModifier = moodModifier
                    };

                    CardDatas.Add(cardData);
                    CardPaths.Add($"{type}/{name}");

                    var zone = values[zoneColumnIndex];
                    var quantity = !string.IsNullOrWhiteSpace(values[quantityColumnIndex]) ? int.Parse(values[quantityColumnIndex]) : 1;

                    for (var i = 0; i < quantity; i++)
                    {
                        if (zone == "Base") StarterDeckCardDatas.Add(cardData);
                        else if (zone == "Market") MarketDeck.Add(new Card(cardData));
                        else if (zone == "Event") EventDeck.Add(new Card(cardData));
                        else if (zone == "Malus") { /* TODO */ }
                        else throw new Exception($"Invalid zone field {zone} on card {name}");
                    }

                }
            }
        }

        readonly Room _room;

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

        public readonly OrderedDictionary<Player, PlayerState> PlayerStates = new OrderedDictionary<Player, PlayerState>();

        // Used by PayRent and Market
        readonly List<Player> _pendingPlayers = new List<Player>();

        #region Pay rent Phase
        int _rentAmount = 100;
        #endregion

        #region Market Phase
        #endregion

        public Game(Room room)
        {
            _room = room;

            foreach (var player in room.Players.Values)
            {
                var playerState = PlayerStates[player] = new PlayerState();

                for (var i = 0; i < StarterDeckCardDatas.Count; i++)
                {
                    playerState.Deck.Add(new Card(StarterDeckCardDatas[i]));
                }

                playerState.ShuffleDeck();
                playerState.DrawHand(StartHandSize);
            }
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
                        // TODO: Remove or skip dead players
                        _pendingPlayers.AddRange(PlayerStates.Keys);
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

        public void PlayerUseCard(Player player, long cardId)
        {
            if (!_pendingPlayers.Contains(player)) return;
            var playerState = PlayerStates[player];
            if (!playerState.Hand.TryGetValue(cardId, out var card)) return;
            playerState.Hand.Remove(card.Id);

            var broadcastJson = new JsonObject();
            broadcastJson.Add("type", "setHandCardCount");
            broadcastJson.Add("username", player.Username);
            broadcastJson.Add("handCardCount", playerState.Hand.Count);
            _room.BroadcastJson(broadcastJson);

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

            // TODO:
            // if (!MarketHand.TryGetValue(cardId, out var card)) return;
        }

        public void PlayerConfirm(Player player)
        {
            switch (_phase)
            {
                case TurnPhase.PayRent:
                    {
                        if (!_pendingPlayers.Contains(player)) return;

                        // TODO: Check that the player has put enough money for rent

                        _pendingPlayers.Remove(player);

                        var json = new JsonObject();
                        json.Add("type", "playerDone");
                        json.Add("username", player.Username);
                        _room.BroadcastJson(json);

                        if (_pendingPlayers.Count == 0) SetPhase(TurnPhase.MarketFadeIn);
                    }
                    break;

                case TurnPhase.Market:
                    {
                        if (!_pendingPlayers.Contains(player)) return;
                        _pendingPlayers.Remove(player);

                        var json = new JsonObject();
                        json.Add("type", "playerDone");
                        json.Add("username", player.Username);
                        _room.BroadcastJson(json);

                        if (_pendingPlayers.Count == 0) SetPhase(TurnPhase.FadeOut);
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
                        // TODO: Send market
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
