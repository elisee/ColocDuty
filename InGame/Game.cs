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

        public static void LoadCards(string cardsDatabasePath, CancellationToken shutdownToken)
        {
            using (var reader = new StreamReader(cardsDatabasePath))
            {
                // Read header to determine what column to use
                var headerLine = reader.ReadLine();

                int nameColumnIndex = 0, actionColumnIndex = 0, descriptionColumnIndex = 0, typeColumnIndex = 0;
                int costColumnIndex = 0, moneyColumnIndex = 0, hygieneColumnIndex = 0, moodColumnIndex = 0;

                var headerValues = headerLine.Split('\t');
                for (var i = 0; i < headerValues.Length; i++)
                {
                    var headerValue = headerValues[i];

                    if (headerValue == "Name") nameColumnIndex = i;
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

                    var name = values[nameColumnIndex];
                    if (string.IsNullOrWhiteSpace(name)) continue;

                    var action = values[actionColumnIndex];
                    var description = values[descriptionColumnIndex];
                    var type = values[typeColumnIndex];
                    var cost = !string.IsNullOrWhiteSpace(values[costColumnIndex]) ? int.Parse(values[costColumnIndex]) : 0;
                    var moneyModifier = !string.IsNullOrWhiteSpace(values[moneyColumnIndex]) ? int.Parse(values[moneyColumnIndex]) : 0;
                    var hygieneModifier = !string.IsNullOrWhiteSpace(values[hygieneColumnIndex]) ? int.Parse(values[hygieneColumnIndex]) : 0;
                    var moodModifier = !string.IsNullOrWhiteSpace(values[moodColumnIndex]) ? int.Parse(values[moodColumnIndex]) : 0;

                    CardDatas.Add(new CardData()
                    {
                        Name = name,
                        Action = action,
                        Description = description,
                        Type = type,
                        Cost = cost,
                        MoneyModifier = moneyModifier,
                        HygieneModifier = hygieneModifier,
                        MoodModifier = moodModifier
                    });
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

        public const int StartDeckSize = 14;
        public const int StartHandSize = 7;

        public readonly OrderedDictionary<Player, PlayerState> PlayerStates = new OrderedDictionary<Player, PlayerState>();

        #region Pay rent Phase
        readonly List<Player> _rentPendingPlayers = new List<Player>();
        int _rentAmount = 100;
        #endregion

        #region Market Phase

        #endregion

        public Game(Room room)
        {
            _room = room;

            // TODO: Don't take card randomly initially, it's specified in the database
            var random = new Random();

            foreach (var player in room.Players.Values)
            {
                var playerState = PlayerStates[player] = new PlayerState();

                for (var i = 0; i < StartDeckSize; i++)
                {
                    var data = CardDatas[random.Next(CardDatas.Count)];
                    playerState.Deck.Add(new Card(data));
                }

                // TODO: Use a "FillHand" method or something
                for (var i = 0; i < StartHandSize; i++)
                {
                    var data = CardDatas[random.Next(CardDatas.Count)];
                    playerState.Hand.Add(new Card(data));
                }
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
                        _rentPendingPlayers.Clear();
                        _rentPendingPlayers.AddRange(PlayerStates.Keys);
                        SetPhase(TurnPhase.PayRent);
                    }
                    break;

                case TurnPhase.PayRent:
                    break;

                case TurnPhase.MarketFadeIn:
                    break;

                case TurnPhase.Market:
                    break;

                case TurnPhase.FadeOut:
                    break;
            }
        }

        public void UseCard(Player player, int cardId)
        {
            // TODO...
        }

        void SetPhase(TurnPhase phase)
        {
            _phase = phase;
            _phaseTimer = 0.0;

            var json = new JsonObject();
            json.Add("type", "goInGamePhase");
            json.Add("phase", MakePhaseJson());
            _room.BroadcastJson(json);
        }

        public JsonObject MakeJson()
        {
            var json = new JsonObject();
            json.Add("phase", MakePhaseJson());

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
                    var jsonRentPendingPlayers = new JsonArray();
                    foreach (var player in _rentPendingPlayers) jsonRentPendingPlayers.Add(player.Username);
                    json.Add("rentPendingPlayers", jsonRentPendingPlayers);
                    json.Add("amountDue", _rentAmount);
                    break;
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
