using System;
using System.Collections.Generic;
using System.Text;

namespace ColocDuty
{
    class ColocPlayer
    {
        public readonly Guid Guid;
        public readonly string Username;
        public ColocPeer Peer;

        public ColocPlayer(Guid guid, string username, ColocPeer peer)
        {
            Guid = guid;
            Username = username;
            Peer = peer;
        }
    }
}
