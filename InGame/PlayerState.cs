using System.Collections.Generic;
using System.Json;

namespace ColocDuty.InGame
{
    class PlayerState
    {
        public readonly List<Card> Deck = new List<Card>();
        public readonly List<Card> Hand = new List<Card>();
        public readonly List<Card> Discard = new List<Card>();

        public void ShuffleDeck()
        {
            foreach (var discardedCard in Discard) Deck.Add(discardedCard);
            Discard.Clear();

            Card.ShuffleCardsList(Deck);
        }

        public void DrawHand(int handSize)
        {
            for (var i = 0; i < handSize; i++)
            {
                if (Deck.Count == 0) {
                    // No more cards to keep filling the hand
                    if (Discard.Count == 0) return;
                    else ShuffleDeck();
                }

                var card = Deck[0];
                Deck.RemoveAt(0);

                Hand.Add(card);
            }
        }

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
