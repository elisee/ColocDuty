using System;
using System.Collections.Generic;
using System.Text;

namespace ColocDuty
{
    class Player
    {
        public readonly Guid Guid;
        public readonly string Username;
        public Peer Peer;

        public Player(Guid guid, string username, Peer peer)
        {
            Guid = guid;
            Username = username;
            Peer = peer;
        }
    }
}
