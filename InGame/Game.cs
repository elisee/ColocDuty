using Microsoft.Collections.Extensions;
using System;
using System.Collections.Generic;
using System.Json;
using System.Text;

namespace ColocDuty.InGame
{
    class Game
    {
        public const int StartDeckSize = 10;
        public const int StartHandSize = 5;

        public readonly OrderedDictionary<Player, PlayerState> PlayerStates = new OrderedDictionary<Player, PlayerState>();

        public Game(List<Player> players)
        {
            foreach (var player in players)
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

            var jsonPlayerStates = new JsonObject();
            json.Add("playerStates", jsonPlayerStates);

            foreach (var (player, state) in PlayerStates)
            {
                jsonPlayerStates.Add(player.Username, state.MakePublicJson());
            }

            return json;
        }
    }
}
