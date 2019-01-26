using ColocDuty.InGame;
using System;
using System.Collections.Generic;
using System.Json;
using System.Text;

namespace ColocDuty
{
    class Player
    {
        public readonly Guid Guid;
        public readonly string Username;
        public readonly int CharacterIndex;
        public Peer Peer;

        public Player(Guid guid, string username, int characterIndex, Peer peer)
        {
            Guid = guid;
            Username = username;
            CharacterIndex = characterIndex;
            Peer = peer;
        }

        public JsonObject MakeSelfJson()
        {
            var json = new JsonObject();
            json.Add("guid", Guid.ToString());
            json.Add("username", Username);
            json.Add("characterIndex", CharacterIndex);
            return json;
        }

        public JsonObject MakePublicJson()
        {
            var json = new JsonObject();
            json.Add("username", Username);
            json.Add("characterIndex", CharacterIndex);
            return json;
        }
    }
}
