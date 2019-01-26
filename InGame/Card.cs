using System;
using System.Collections.Generic;
using System.Json;
using System.Text;

namespace ColocDuty.InGame
{
    class Card
    {
        public string Name;

        public JsonObject MakeJson()
        {
            var json = new JsonObject();
            json.Add("name", Name);
            return json;
        }
    }
}
