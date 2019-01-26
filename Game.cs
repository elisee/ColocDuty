using System;
using System.Collections.Generic;
using System.Json;
using System.Text;

namespace ColocDuty
{
    class Game
    {
        public JsonObject MakeStateJson()
        {
            var json = new JsonObject();
            json.Add("name", "inGame");

            return json;
        }
    }
}
