using System.Collections.Generic;
using System.Json;

namespace ColocDuty.InGame
{
    class PlayerState
    {
        public readonly List<Card> Deck = new List<Card>();
        public readonly List<Card> Hand = new List<Card>();

        public JsonObject MakePublicJson()
        {
            var json = new JsonObject();
            json.Add("handCardCount", Hand.Count);
            return json;
        }

        public JsonObject MakeSelfJson()
        {
            var json = new JsonObject();

            var jsonDeck = new JsonArray();
            json.Add("deck", jsonDeck);
            foreach (var card in Deck) jsonDeck.Add(card.MakeJson());

            var jsonHand = new JsonArray();
            json.Add("hand", jsonHand);
            foreach (var card in Hand) jsonHand.Add(card.MakeJson());

            return json;
        }
    }
}
