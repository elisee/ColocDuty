using System;
using System.Collections.Generic;
using System.Json;
using System.Text;

namespace ColocDuty.InGame
{
    class Card
    {
        public readonly int Id;
        public readonly CardData Data;

        static int NextId = 0;

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
            json.Add("action", Data.Action);
            json.Add("description", Data.Description);
            json.Add("type", Data.Type);
            json.Add("cost", Data.Cost);
            json.Add("moneyModifier", Data.MoneyModifier);
            json.Add("moodModifier", Data.MoodModifier);
            return json;
        }
    }
}
