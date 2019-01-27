using System;
using System.Collections.Generic;
using System.Json;
using System.Text;

namespace ColocDuty.InGame
{
    class Card
    {
        public readonly long Id;
        public readonly CardData Data;

        static long NextId = 0;

        public static void ShuffleCardsList(List<Card> cards)
        {
            var rng = new Random();

            int n = cards.Count;
            while (n > 1)
            {
                int k = rng.Next(n--);
                var temp = cards[n];
                cards[n] = cards[k];
                cards[k] = temp;
            }
        }

        public Card(CardData data)
        {
            Id = NextId++;
            Data = data;
        }

        public JsonObject MakeJson()
        {
            var json = new JsonObject();
            json.Add("id", Id);
            json.Add("name", Data.Name);
            json.Add("imageName", Data.ImageName);
            json.Add("action", Data.Action);
            json.Add("description", Data.Description);
            json.Add("type", Data.Type);
            json.Add("cost", Data.Cost);
            json.Add("moneyModifier", Data.MoneyModifier);
            json.Add("hygieneModifier", Data.HygieneModifier);
            json.Add("moodModifier", Data.MoodModifier);
            return json;
        }
    }
}
