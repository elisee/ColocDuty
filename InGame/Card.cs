using System;
using System.Collections.Generic;
using System.Json;
using System.Text;

namespace ColocDuty.InGame
{
    class Card
    {
        public string Name;
        public string Action;
        public string Description;
        public string Type;
        public int Cost;
        public int MoneyModifier;
        public int HygieneModifier;
        public int MoodModifier;

        public JsonObject MakeJson()
        {
            var json = new JsonObject();
            json.Add("name", Name);
            json.Add("action", Action);
            json.Add("description", Description);
            json.Add("type", Type);
            json.Add("cost", Cost);
            json.Add("moneyModifier", MoneyModifier);
            json.Add("moodModifier", MoodModifier);
            return json;
        }
    }
}
