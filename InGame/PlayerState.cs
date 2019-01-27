using Microsoft.Collections.Extensions;
using System.Collections.Generic;
using System.Json;

namespace ColocDuty.InGame
{
    class PlayerState
    {
        public readonly List<Card> Deck = new List<Card>();
        public readonly OrderedDictionary<long, Card> Hand = new OrderedDictionary<long, Card>();
        public readonly OrderedDictionary<long, Card> RentPile = new OrderedDictionary<long, Card>();

        public readonly List<Card> DiscardPile = new List<Card>();

        public int Money = 0;

        public void ShuffleDeck()
        {
            foreach (var discardedCard in DiscardPile) Deck.Add(discardedCard);
            DiscardPile.Clear();

            Card.ShuffleCardsList(Deck);
        }

        public void DrawHand(int handSize)
        {
            Hand.Clear();

            for (var i = 0; i < handSize; i++)
            {
                if (Deck.Count == 0)
                {
                    // No more cards to keep filling the hand
                    if (DiscardPile.Count == 0) return;
                    else ShuffleDeck();
                }

                var card = Deck[0];
                Deck.RemoveAt(0);

                Hand.Add(card.Id, card);
            }
        }

        public JsonObject MakePublicJson()
        {
            var json = new JsonObject();
            json.Add("handCardCount", Hand.Count);

            var jsonDiscardPile = new JsonArray();
            json.Add("discardPile", jsonDiscardPile);
            foreach (var card in DiscardPile) jsonDiscardPile.Add(card.MakeJson());

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
            foreach (var card in Hand.Values) jsonHand.Add(card.MakeJson());

            var jsonRentPile = new JsonArray();
            json.Add("rentPile", jsonRentPile);
            foreach (var card in RentPile.Values) jsonRentPile.Add(card.MakeJson());

            return json;
        }
    }
}
