using Microsoft.Collections.Extensions;
using System;
using System.Collections.Generic;
using System.Json;
using System.Text;

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

        public const int StartDeckSize = 10;
        public const int StartHandSize = 5;

        public readonly OrderedDictionary<Player, PlayerState> PlayerStates = new OrderedDictionary<Player, PlayerState>();

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

        public JsonObject MakeStateJson()
        {
            var json = new JsonObject();
            json.Add("name", "inGame");
            json.Add("phase", _phase.ToString());

            var jsonPlayerStates = new JsonObject();
            json.Add("playerStates", jsonPlayerStates);

            foreach (var (player, state) in PlayerStates)
            {
                jsonPlayerStates.Add(player.Username, state.MakePublicJson());
            }

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
            json.Add("type", "setTurnPhase");
            json.Add("phase", _phase.ToString());

            _room.BroadcastJson(json);
        }
    }
}
