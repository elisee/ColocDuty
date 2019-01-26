using Microsoft.Collections.Extensions;
using System.Collections.Generic;
using System.Json;

namespace ColocDuty.InGame
{
    class Game
    {
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
        #endregion

        #region Market Phase

        #endregion

        public Game(Room room)
        {
            _room = room;

            foreach (var player in room.Players.Values)
            {
                var playerState = PlayerStates[player] = new PlayerState();

                for (var i = 0; i < StartDeckSize; i++)
                {
                    playerState.Deck.Add(new Card { Name = "Deck" });
                }

                // TODO: Use a "FillHand" method or something
                for (var i = 0; i < StartHandSize; i++)
                {
                    playerState.Hand.Add(new Card { Name = "Hand" });
                }
            }
        }

        public JsonObject MakeJson()
        {
            var json = new JsonObject();
            json.Add("phase", MakePhaseJson());
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
                    json.Add("rentPendingPlayers", jsonRentPendingPlayers);
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

        public void Update(double deltaTime)
        {
            _phaseTimer += deltaTime;

            switch (_phase)
            {
                case TurnPhase.PayRentFadeIn:
                    if (_phaseTimer >= FadeInDuration)
                    {
                        SetPhase(TurnPhase.PayRent);
                        _rentPendingPlayers.Clear();
                        _rentPendingPlayers.AddRange(PlayerStates.Keys);
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

        void SetPhase(TurnPhase phase)
        {
            _phase = phase;
            _phaseTimer = 0.0;

            var json = new JsonObject();
            json.Add("type", "goInGamePhase");
            json.Add("phase", MakePhaseJson());
            _room.BroadcastJson(json);
        }
    }
}
